#!/usr/bin/env bash
# MoneyFlow public installer. Prefer:
#   bash <(curl -Ls https://raw.githubusercontent.com/dmitryshelomanov/moneyflow/main/install.sh)
# Inspect the script before running it. Do not pipe curl into bash if you need prompts.
set -euo pipefail

GITHUB_REPO="${GITHUB_REPO:-dmitryshelomanov/moneyflow}"
GITHUB_REF="${GITHUB_REF:-main}"
INSTALL_DIR="${INSTALL_DIR:-/opt/moneyflow}"
IMAGE="ghcr.io/${GITHUB_REPO}"

COMMAND="${1:-install}"
PURGE=0
if [[ "${2:-}" == "--purge" || "${1:-}" == "--purge" ]]; then
  PURGE=1
fi
if [[ "$COMMAND" == "--purge" ]]; then
  COMMAND="uninstall"
fi

log() { printf '==> %s\n' "$*"; }
err() { printf 'error: %s\n' "$*" >&2; }

need_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    err "Run as root: sudo bash <(curl -Ls https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_REF}/install.sh)"
    exit 1
  fi
}

ensure_tty() {
  if [[ -t 0 ]]; then
    return 0
  fi
  if [[ -r /dev/tty ]]; then
    exec </dev/tty
  fi
}

is_ipv4() {
  [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]
}

normalize_host() {
  local h="$1"
  h="${h#http://}"
  h="${h#https://}"
  h="${h%%/*}"
  printf '%s' "$h"
}

write_env_line() {
  local key="$1"
  local value="${2-}"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '%s="%s"\n' "$key" "$value"
}

github_url() {
  printf 'https://raw.githubusercontent.com/%s/%s/%s' "$GITHUB_REPO" "$GITHUB_REF" "$1"
}

download() {
  local rel="$1"
  local dest="$2"
  curl -fsSL "$(github_url "$rel")" -o "$dest"
}

prompt_var() {
  local dest="$1"
  local message="$2"
  local default="${3-}"
  if [[ -z "$default" && -n "${!dest:-}" ]]; then
    default="${!dest}"
  fi
  if [[ "${RECONFIGURE:-0}" != "1" && -n "${!dest:-}" ]]; then
    return 0
  fi
  if [[ ! -t 0 ]]; then
    if [[ -n "$default" || -z "${!dest:-}" ]]; then
      printf -v "$dest" '%s' "${default}"
    fi
    return 0
  fi
  local input=""
  if [[ -n "$default" ]]; then
    read -r -p "$message [$default]: " input || true
  else
    read -r -p "$message: " input || true
  fi
  if [[ -z "$input" ]]; then
    input="$default"
  fi
  printf -v "$dest" '%s' "$input"
}

confirm() {
  local message="$1"
  local reply=""
  if [[ "${FORCE:-}" == "1" ]]; then
    return 0
  fi
  read -r -p "$message [y/N]: " reply || true
  [[ "$reply" == "y" || "$reply" == "Y" || "$reply" == "yes" ]]
}

check_os() {
  if [[ ! -f /etc/os-release ]]; then
    err "Unsupported OS (need Debian/Ubuntu or Docker already installed)"
    exit 1
  fi
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    debian | ubuntu) ;;
    *)
      if ! command -v docker >/dev/null 2>&1; then
        err "Unsupported OS '${ID:-unknown}'. Install Docker yourself or use Debian/Ubuntu."
        exit 1
      fi
      log "OS ${ID} is not Debian/Ubuntu; continuing because Docker is present"
      ;;
  esac
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return 0
  fi
  log "Installing Docker"
  curl -fsSL https://get.docker.com | sh
  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable --now docker >/dev/null 2>&1 || true
  fi
  if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    err "Docker / Compose plugin is missing after install"
    exit 1
  fi
}

load_existing_env() {
  if [[ -f "$INSTALL_DIR/.env" ]]; then
    # shellcheck disable=SC1091
    set -a
    # shellcheck disable=SC1090
    source "$INSTALL_DIR/.env"
    set +a
  fi
}

write_env_file() {
  local dest="$1"
  {
    write_env_line ACCESS_KEY "$ACCESS_KEY"
    write_env_line SESSION_SECRET "$SESSION_SECRET"
    write_env_line WEB_ORIGIN "$WEB_ORIGIN"
    write_env_line TELEGRAM_BOT_TOKEN "${TELEGRAM_BOT_TOKEN:-}"
    write_env_line ALLOWED_TELEGRAM_IDS "${ALLOWED_TELEGRAM_IDS:-}"
    write_env_line TELEGRAM_BOT_ID "${TELEGRAM_BOT_ID:-}"
    write_env_line ROUTERAI_API_KEY "${ROUTERAI_API_KEY:-}"
    write_env_line ROUTERAI_BASE_URL "${ROUTERAI_BASE_URL:-https://routerai.ru/api/v1}"
    write_env_line ROUTERAI_MODEL "${ROUTERAI_MODEL:-openai/gpt-4o}"
    write_env_line DATABASE_PATH "./data/moneyflow.db"
    write_env_line PORT "3000"
    write_env_line NODE_ENV "production"
    write_env_line MONEYFLOW_TAG "$MONEYFLOW_TAG"
    write_env_line MF_SITE "$MF_SITE"
  } >"$dest"
  chmod 600 "$dest"
}

image_tag_from_ref() {
  local ref="$1"
  if [[ "$ref" =~ ^v?[0-9]+\.[0-9]+ ]]; then
    printf '%s' "${ref#v}"
  else
    printf 'latest'
  fi
}

has_tls_certs() {
  [[ -r "$INSTALL_DIR/certs/fullchain.pem" && -r "$INSTALL_DIR/certs/privkey.pem" ]]
}

choose_caddyfile() {
  mkdir -p "$INSTALL_DIR/certs"
  if [[ "${MF_SITE:-}" != ":80" ]] && has_tls_certs; then
    download deploy/Caddyfile "$INSTALL_DIR/Caddyfile"
    log "TLS: ${INSTALL_DIR}/certs/fullchain.pem + privkey.pem"
  else
    download deploy/Caddyfile.http "$INSTALL_DIR/Caddyfile"
    if [[ "${MF_SITE:-}" == ":80" ]]; then
      log "IP install: HTTP only on port 80"
    else
      log "No TLS certs yet — HTTP on :80"
      log "Put fullchain.pem and privkey.pem in ${INSTALL_DIR}/certs, then: ${INSTALL_DIR}/install.sh update"
    fi
  fi
}

compose() {
  docker compose -f "$INSTALL_DIR/docker-compose.yml" --project-directory "$INSTALL_DIR" "$@"
}

print_success() {
  cat <<EOF

MoneyFlow is up.

  Dashboard: ${WEB_ORIGIN}/k/${ACCESS_KEY}/
  Health:    ${WEB_ORIGIN}/health
  Data:      ${INSTALL_DIR}/data
  TLS certs: ${INSTALL_DIR}/certs/fullchain.pem
             ${INSTALL_DIR}/certs/privkey.pem
             (symlinks to Let's Encrypt live files are fine)

Telegram web login needs a real domain + HTTPS and the domain attached in BotFather.
Update later:
  ${INSTALL_DIR}/install.sh update
Uninstall:
  ${INSTALL_DIR}/install.sh uninstall
EOF
}

collect_config() {
  if [[ -z "${DOMAIN:-}" ]]; then
    if [[ "${MF_SITE:-}" == ":80" || "${WEB_ORIGIN:-}" == http://* ]]; then
      DOMAIN="$(normalize_host "${WEB_ORIGIN:-}")"
    elif [[ -n "${MF_SITE:-}" && "${MF_SITE}" != ":80" ]]; then
      DOMAIN="$MF_SITE"
    fi
  fi
  prompt_var DOMAIN "Domain or server IP"
  DOMAIN="$(normalize_host "$DOMAIN")"
  if [[ -z "$DOMAIN" ]]; then
    err "Domain or IP is required"
    exit 1
  fi

  if is_ipv4 "$DOMAIN"; then
    MF_SITE=":80"
    WEB_ORIGIN="http://${DOMAIN}"
    log "IP install: HTTP only on port 80 (Telegram web OAuth will not work)"
  else
    MF_SITE="$DOMAIN"
    WEB_ORIGIN="https://${DOMAIN}"
  fi

  prompt_var TELEGRAM_BOT_TOKEN "Telegram bot token (optional)" ""
  prompt_var ALLOWED_TELEGRAM_IDS "Allowed Telegram user ids, comma-separated (optional)" ""
  prompt_var ROUTERAI_API_KEY "RouterAI API key (optional)" ""

  prompt_var ACCESS_KEY "ACCESS_KEY (hidden URL segment)" "${ACCESS_KEY:-$(openssl rand -hex 16)}"
  if [[ -z "${SESSION_SECRET:-}" ]]; then
    SESSION_SECRET="$(openssl rand -hex 32)"
  fi
  if [[ "${#ACCESS_KEY}" -lt 8 ]]; then
    err "ACCESS_KEY must be at least 8 characters"
    exit 1
  fi
  MONEYFLOW_TAG="$(image_tag_from_ref "$GITHUB_REF")"
}

fetch_release_files() {
  mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/certs"
  download deploy/docker-compose.yml "$INSTALL_DIR/docker-compose.yml"
  choose_caddyfile
  download install.sh "$INSTALL_DIR/install.sh"
  chmod 755 "$INSTALL_DIR/install.sh"
}

start_stack() {
  log "Pulling ${IMAGE}:${MONEYFLOW_TAG:-latest}"
  compose pull
  log "Starting containers"
  compose up -d --remove-orphans --wait
  compose ps
  compose exec -T app node -e 'fetch("http://127.0.0.1:3000/health").then((r)=>{if(!r.ok) throw new Error("non-200"); return r.text();}).then((body)=>{if(!body) throw new Error("empty body"); console.log(body);}).catch((err)=>{console.error(err); process.exit(1);})'
}

cmd_install() {
  need_root
  ensure_tty
  check_os
  for cmd in curl openssl; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      err "Missing dependency: $cmd"
      exit 1
    fi
  done
  install_docker

  if [[ -f "$INSTALL_DIR/.env" && "$COMMAND" == "install" ]]; then
    log "Existing install at ${INSTALL_DIR} — updating image"
    cmd_update
    return
  fi

  if [[ "$COMMAND" == "reconfigure" ]]; then
    load_existing_env
    RECONFIGURE=1
  fi

  collect_config
  fetch_release_files
  write_env_file "$INSTALL_DIR/.env"
  start_stack
  print_success
}

cmd_update() {
  need_root
  if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    err "No install found at ${INSTALL_DIR}"
    exit 1
  fi
  local requested_tag="${MONEYFLOW_TAG:-}"
  local requested_ref="$GITHUB_REF"
  load_existing_env
  GITHUB_REF="$requested_ref"
  if [[ -n "$requested_tag" ]]; then
    MONEYFLOW_TAG="$requested_tag"
  else
    MONEYFLOW_TAG="$(image_tag_from_ref "$GITHUB_REF")"
  fi
  if [[ -z "${MF_SITE:-}" ]]; then
    if [[ "${WEB_ORIGIN:-}" == http://* ]]; then
      MF_SITE=":80"
    else
      MF_SITE="$(normalize_host "${WEB_ORIGIN:-}")"
    fi
  fi
  fetch_release_files
  write_env_file "$INSTALL_DIR/.env"
  start_stack
  print_success
}

cmd_uninstall() {
  need_root
  ensure_tty
  if [[ ! -d "$INSTALL_DIR" ]]; then
    log "Nothing to uninstall at ${INSTALL_DIR}"
    exit 0
  fi
  if [[ "$PURGE" -eq 1 ]]; then
    if ! confirm "Stop MoneyFlow and DELETE ${INSTALL_DIR} (including SQLite data)?"; then
      err "Aborted"
      exit 1
    fi
  else
    if ! confirm "Stop MoneyFlow containers at ${INSTALL_DIR}?"; then
      err "Aborted"
      exit 1
    fi
  fi
  if [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then
    if [[ "$PURGE" -eq 1 ]]; then
      compose down --remove-orphans --volumes || true
    else
      compose down --remove-orphans || true
    fi
  fi
  if [[ "$PURGE" -eq 1 ]]; then
    rm -rf "$INSTALL_DIR"
    log "Removed ${INSTALL_DIR}"
  else
    log "Containers stopped. Data kept in ${INSTALL_DIR}/data"
    log "Purge everything with: ${INSTALL_DIR}/install.sh uninstall --purge"
  fi
}

usage() {
  cat <<EOF
Usage: install.sh [install|update|reconfigure|uninstall] [--purge]

  install       Fresh install, or update if ${INSTALL_DIR} already exists
  update        Pull the image and recreate containers
  reconfigure   Prompt again and rewrite .env
  uninstall     Stop containers (add --purge to delete data)

Env overrides: GITHUB_REPO GITHUB_REF INSTALL_DIR DOMAIN
               TELEGRAM_BOT_TOKEN ALLOWED_TELEGRAM_IDS ROUTERAI_API_KEY
               ACCESS_KEY SESSION_SECRET MONEYFLOW_TAG FORCE=1
EOF
}

case "$COMMAND" in
  install | reconfigure) cmd_install ;;
  update) cmd_update ;;
  uninstall) cmd_uninstall ;;
  -h | --help | help) usage ;;
  *)
    usage
    exit 1
    ;;
esac
