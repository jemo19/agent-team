#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: readonly-host-check.sh <ssh_alias>

Runs a conservative read-only Linux host check over SSH.
Review commands before use. Use only on systems you own/administer.
EOF
}

if [[ "${1:-}" == "--help" || $# -ne 1 ]]; then
  usage
  exit 0
fi

HOST="$1"

ssh "$HOST" 'set -e
printf "### hostnamectl\n"; hostnamectl || true
printf "\n### uptime\n"; uptime || true
printf "\n### boot time\n"; who -b || true
printf "\n### memory\n"; free -h || true
printf "\n### disk\n"; df -hT || true
printf "\n### block devices\n"; lsblk -f || true
printf "\n### failed units\n"; systemctl --failed --no-pager || true
printf "\n### recent boot errors\n"; journalctl -p err -b --no-pager | tail -100 || true
printf "\n### listening sockets\n"; ss -tulpn || true
printf "\n### addresses\n"; ip -brief addr || true
printf "\n### routes\n"; ip route || true
printf "\n### mounts\n"; findmnt || true
printf "\n### top memory processes\n"; ps aux --sort=-%mem | head -20 || true
printf "\n### top cpu processes\n"; ps aux --sort=-%cpu | head -20 || true
printf "\n### apt upgradable sample\n"; apt list --upgradable 2>/dev/null | head -100 || true
'
