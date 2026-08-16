#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_HOOK="$ROOT/.githooks/pre-commit"
TARGET_HOOK="$ROOT/.git/hooks/pre-commit"

if [[ ! -f "$SOURCE_HOOK" ]]; then
  echo "Hook source not found: $SOURCE_HOOK" >&2
  exit 1
fi

cp "$SOURCE_HOOK" "$TARGET_HOOK"
chmod +x "$TARGET_HOOK"

echo "Installed git pre-commit hook:"
echo "  $TARGET_HOOK"
