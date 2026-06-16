#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Shell syntax =="
find "$ROOT/templates/ops-control/scripts" -type f -name "*.sh" -print0 |
  xargs -0 -r bash -n

echo "== Python syntax =="
python3 -m py_compile "$ROOT/templates/ops-control/.codex/hooks/pre_tool_use_policy.py"

if command -v codex >/dev/null 2>&1; then
  RULES="$ROOT/templates/home-codex/rules/default.rules"
  echo "== Codex execpolicy rules =="
  codex execpolicy check --pretty --rules "$RULES" -- sudo systemctl restart nginx >/dev/null
  codex execpolicy check --pretty --rules "$RULES" -- mkfs.ext4 /dev/sdb1 >/dev/null
  codex execpolicy check --pretty --rules "$RULES" -- terraform apply >/dev/null
  codex execpolicy check --pretty --rules "$RULES" -- ssh srv1 uptime >/dev/null
else
  echo "codex not found; skipping execpolicy checks"
fi

echo "Package validation passed."
