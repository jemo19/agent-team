#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: service-health-check.sh <ssh_alias> <service_name>

Runs read-only service status checks over SSH.
Review before use. Use only on systems you own/administer.
EOF
}

if [[ "${1:-}" == "--help" || $# -ne 2 ]]; then
  usage
  exit 0
fi

HOST="$1"
SERVICE="$2"

ssh "$HOST" "set -e
printf '### systemctl status %s\n' '$SERVICE'; systemctl status '$SERVICE' --no-pager || true
printf '\n### journal tail %s\n' '$SERVICE'; journalctl -u '$SERVICE' -n 100 --no-pager || true
"
