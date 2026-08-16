#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/ssh.sh"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/moneyflow-YYYYMMDD-HHMMSS.db" >&2
  exit 1
fi

SOURCE_DUMP="$1"
if [[ "$SOURCE_DUMP" != /* ]]; then
  SOURCE_DUMP="$ROOT/$SOURCE_DUMP"
fi
if [[ ! -f "$SOURCE_DUMP" ]]; then
  echo "Dump file not found: $SOURCE_DUMP" >&2
  exit 1
fi

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

echo "This will replace remote DB at ${DEPLOY_PATH}/data/moneyflow.db"
if [[ "${FORCE_RESTORE:-0}" != "1" ]]; then
  read -r -p "Type YES to continue: " confirmation
  if [[ "$confirmation" != "YES" ]]; then
    echo "Restore aborted."
    exit 1
  fi
fi

create_ssh_wrap
TMP_REMOTE_DUMP="data/_restore_tmp_$(date +%s).db"
cleanup() {
  rm -f "$SSH_WRAP"
}
trap cleanup EXIT

echo "==> Upload dump to ${DEPLOY_USER}@${DEPLOY_HOST}"
scp -S "$SSH_WRAP" "$SOURCE_DUMP" \
  "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/${TMP_REMOTE_DUMP}"

echo "==> Backup current remote DB before restore"
remote "cd '${DEPLOY_PATH}' && docker compose exec -T app node --input-type=module -e \"
import Database from 'better-sqlite3';
import fs from 'node:fs';
const srcPath = './data/moneyflow.db';
const dstPath = './data/pre-restore-' + new Date().toISOString().replace(/[:.]/g, '-') + '.db';
if (fs.existsSync(srcPath)) {
  const src = new Database(srcPath, { readonly: true, fileMustExist: true });
  await src.backup(dstPath);
  src.close();
  console.log('backup=' + dstPath);
}
\""

echo "==> Stop app and replace database"
remote "cd '${DEPLOY_PATH}' && docker compose stop app"
# Drop leftover WAL/SHM from the previous DB — otherwise SQLite overlays the
# restored file with stale pages and the app can show an empty/zero balance.
remote "cd '${DEPLOY_PATH}' && rm -f data/moneyflow.db-wal data/moneyflow.db-shm"
remote "cd '${DEPLOY_PATH}' && mv '${TMP_REMOTE_DUMP}' data/moneyflow.db"

echo "==> Start app and wait for health"
remote "cd '${DEPLOY_PATH}' && docker compose up -d --wait app"
remote "cd '${DEPLOY_PATH}' && docker compose ps"

echo "Restore completed from: $SOURCE_DUMP"
