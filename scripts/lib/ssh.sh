# Sourced by dump-db.sh / restore-db.sh.
# Requires: KEY_PATH, DEPLOY_SSH_PORT, DEPLOY_USER, DEPLOY_HOST

create_ssh_wrap() {
  SSH_WRAP="$(mktemp)"
  cat > "$SSH_WRAP" <<EOF
#!/usr/bin/env bash
exec ssh \\
  -i $(printf '%q' "$KEY_PATH") \\
  -p $(printf '%q' "$DEPLOY_SSH_PORT") \\
  -o IdentitiesOnly=yes \\
  -o StrictHostKeyChecking=accept-new \\
  "\$@"
EOF
  chmod +x "$SSH_WRAP"
}

remote() {
  "$SSH_WRAP" "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"
}
