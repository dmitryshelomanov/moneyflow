#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/ssh.sh"

ENV_FILE="${ENV_FILE:-env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy env.prod.example to env.prod and fill values." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

: "${DEPLOY_HOST:?DEPLOY_HOST is required}"
: "${DEPLOY_USER:?DEPLOY_USER is required}"
: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${DEPLOY_SSH_KEY:?DEPLOY_SSH_KEY is required}"

DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
LOCAL_DIR="${LOCAL_DUMP_DIR:-$ROOT/data/dumps}"
KEEP_DUMPS="${KEEP_DUMPS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
LOCAL_FILE="${LOCAL_DIR}/moneyflow-${STAMP}.db"
REMOTE_TMP_REL="data/_dump_tmp.db"

KEY_PATH="$DEPLOY_SSH_KEY"
if [[ "$KEY_PATH" != /* ]]; then
  KEY_PATH="$ROOT/$KEY_PATH"
fi
if [[ ! -f "$KEY_PATH" ]]; then
  echo "SSH key not found: $KEY_PATH" >&2
  exit 1
fi

for cmd in scp ssh mktemp; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing local dependency: $cmd" >&2
    exit 1
  fi
done

create_ssh_wrap
cleanup() {
  rm -f "$SSH_WRAP"
}
trap cleanup EXIT

mkdir -p "$LOCAL_DIR"

echo "==> Online SQLite backup on ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}"
# better-sqlite3 .backup is consistent under WAL while the app is running
remote "cd $(printf '%q' "$DEPLOY_PATH") && docker compose exec -T app node --input-type=module -e \"
import Database from 'better-sqlite3';
import fs from 'node:fs';
const srcPath = './data/moneyflow.db';
const dstPath = './data/_dump_tmp.db';
if (!fs.existsSync(srcPath)) {
  console.error('DB not found:', srcPath);
  process.exit(1);
}
fs.rmSync(dstPath, { force: true });
const src = new Database(srcPath, { readonly: true, fileMustExist: true });
await src.backup(dstPath);
src.close();
console.log('backup_bytes=' + fs.statSync(dstPath).size);
\""

echo "==> Download → ${LOCAL_FILE}"
scp -S "$SSH_WRAP" \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/${REMOTE_TMP_REL}" \
  "$LOCAL_FILE"

echo "==> Cleanup remote temp dump"
remote "rm -f $(printf '%q' "${DEPLOY_PATH}/${REMOTE_TMP_REL}")"

MIN_BYTES=1024
DUMP_SIZE="$(stat -f%z "$LOCAL_FILE" 2>/dev/null || stat -c%s "$LOCAL_FILE" 2>/dev/null || echo 0)"
if [[ "$DUMP_SIZE" -lt "$MIN_BYTES" ]]; then
  echo "Dump too small (${DUMP_SIZE} bytes), refusing to keep it." >&2
  rm -f "$LOCAL_FILE"
  exit 1
fi

if [[ "$KEEP_DUMPS" =~ ^[0-9]+$ ]] && [[ "$KEEP_DUMPS" -gt 0 ]]; then
  index=0
  while IFS= read -r dump_path; do
    index=$((index + 1))
    if [[ "$index" -gt "$KEEP_DUMPS" ]]; then
      rm -f "$dump_path"
    fi
  done < <(ls -1t "$LOCAL_DIR"/moneyflow-*.db 2>/dev/null || true)
fi

echo "Dump saved: ${LOCAL_FILE}"
ls -lh "$LOCAL_FILE"
