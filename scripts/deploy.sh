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
: "${WEB_ORIGIN:?WEB_ORIGIN is required}"
: "${ACCESS_KEY:?ACCESS_KEY is required}"
: "${SESSION_SECRET:?SESSION_SECRET is required}"

DEPLOY_SSH_PORT="${DEPLOY_SSH_PORT:-22}"
SKIP_PRE_DEPLOY_BACKUP="${SKIP_PRE_DEPLOY_BACKUP:-0}"

KEY_PATH="$DEPLOY_SSH_KEY"
if [[ "$KEY_PATH" != /* ]]; then
  KEY_PATH="$ROOT/$KEY_PATH"
fi
if [[ ! -f "$KEY_PATH" ]]; then
  echo "SSH key not found: $KEY_PATH" >&2
  exit 1
fi

for cmd in rsync scp ssh curl mktemp; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing local dependency: $cmd" >&2
    exit 1
  fi
done

create_ssh_wrap
TMP_ENV="$(mktemp)"
cleanup() {
  rm -f "$SSH_WRAP" "$TMP_ENV"
}
trap cleanup EXIT

write_env_line() {
  local key="$1"
  local value="${2-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s="%s"\n' "$key" "$value"
}

echo "==> Remote preflight checks"
remote "command -v docker >/dev/null && docker compose version >/dev/null"
remote "mkdir -p '${DEPLOY_PATH}' '${DEPLOY_PATH}/data'"
remote "test -w '${DEPLOY_PATH}'"
remote "test -r '${DEPLOY_PATH}/certs/fullchain.pem' && test -r '${DEPLOY_PATH}/certs/privkey.pem'"

if [[ "$SKIP_PRE_DEPLOY_BACKUP" != "1" ]]; then
  echo "==> Pre-deploy backup"
  ENV_FILE="$ENV_FILE" bash "$ROOT/scripts/dump-db.sh"
fi

echo "==> Ensure ${DEPLOY_PATH}/data on ${DEPLOY_USER}@${DEPLOY_HOST}"
remote "mkdir -p '${DEPLOY_PATH}/data'"

echo "==> Rsync project → ${DEPLOY_PATH}"
rsync -az --delete \
  -e "$SSH_WRAP" \
  --exclude '.git/' \
  --exclude '.github/' \
  --exclude '.deploy-keys/' \
  --exclude 'node_modules/' \
  --exclude '**/node_modules/' \
  --exclude 'data/' \
  --exclude 'certs/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'env.prod' \
  --exclude 'env.prod.example' \
  --exclude 'apps/*/dist/' \
  --exclude 'packages/*/dist/' \
  ./ "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

{
  write_env_line ACCESS_KEY "$ACCESS_KEY"
  write_env_line SESSION_SECRET "$SESSION_SECRET"
  write_env_line WEB_ORIGIN "$WEB_ORIGIN"
  write_env_line TELEGRAM_BOT_TOKEN "${TELEGRAM_BOT_TOKEN:-}"
  write_env_line ALLOWED_TELEGRAM_IDS "${ALLOWED_TELEGRAM_IDS:-}"
  write_env_line VITE_TELEGRAM_BOT_ID "${VITE_TELEGRAM_BOT_ID:-}"
  write_env_line ROUTERAI_API_KEY "${ROUTERAI_API_KEY:-}"
  write_env_line ROUTERAI_BASE_URL "${ROUTERAI_BASE_URL:-https://routerai.ru/api/v1}"
  write_env_line ROUTERAI_MODEL "${ROUTERAI_MODEL:-openai/gpt-4o}"
  write_env_line DATABASE_PATH "./data/moneyflow.db"
  write_env_line PORT "3000"
  write_env_line NODE_ENV "production"
} > "$TMP_ENV"

echo "==> Upload .env"
scp -S "$SSH_WRAP" "$TMP_ENV" "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/.env"
remote "chmod 600 '${DEPLOY_PATH}/.env' || true"

echo "==> docker compose up --build --wait"
remote "cd '${DEPLOY_PATH}' && docker compose up -d --build --remove-orphans --wait"

echo "==> Verify deployed containers"
remote "cd '${DEPLOY_PATH}' && docker compose ps"
remote "cd '${DEPLOY_PATH}' && APP_CID=\$(docker compose ps -q app) && test -n \"\$APP_CID\" && docker inspect --format='app_container={{.Name}} image={{.Config.Image}} image_id={{.Image}} state={{.State.Status}} started={{.State.StartedAt}}' \"\$APP_CID\""

echo "==> Internal app health (inside container)"
remote "cd '${DEPLOY_PATH}' && docker compose exec -T app node -e 'fetch(\"http://127.0.0.1:3000/health\").then((r)=>{if(!r.ok) throw new Error(\"non-200\"); return r.text();}).then((body)=>{if(!body) throw new Error(\"empty body\"); console.log(body);}).catch((err)=>{console.error(err); process.exit(1);})'"

echo "==> Health check ${WEB_ORIGIN}/health"
# IP origins often fail cert name verify (LE issued for hostname) — allow -k for IP hosts
CURL_OPTS=(-fsS --max-time 10)
WEB_HOST="$(printf '%s' "$WEB_ORIGIN" | sed -E 's#^[a-zA-Z][a-zA-Z0-9+.-]*://##' | cut -d/ -f1 | cut -d: -f1)"
if [[ "$WEB_HOST" =~ ^[0-9.]+$ ]] || [[ "$WEB_HOST" =~ : ]]; then
  CURL_OPTS+=(-k)
fi
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if curl "${CURL_OPTS[@]}" "${WEB_ORIGIN}/health" | grep -q '"ok":true'; then
    echo "Health check passed"
    echo "App: ${WEB_ORIGIN}/k/${ACCESS_KEY}/"
    exit 0
  fi
  echo "Attempt ${i}/15 failed, retrying..."
  sleep 8
done

echo "Health check failed" >&2
exit 1
