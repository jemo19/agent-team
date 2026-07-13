#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Shell syntax =="
find "$ROOT/templates/ops-control/scripts" -type f -name "*.sh" -print0 |
  xargs -0 -r bash -n

echo "== Python syntax =="
python3 -m py_compile "$ROOT/templates/ops-control/.codex/hooks/pre_tool_use_policy.py"

if command -v node >/dev/null 2>&1; then
  echo "== Role evaluation JavaScript syntax =="
  find "$ROOT/evals/role-model-matrix" -type f -name "*.mjs" \
    -exec node --check {} \;

  echo "== Role evaluation suite =="
  node "$ROOT/evals/role-model-matrix/scripts/validate.mjs"
else
  echo "node not found; skipping role evaluation checks"
fi

if command -v codex >/dev/null 2>&1; then
  RULES="$ROOT/templates/home-codex/rules/default.rules"
  echo "== Codex execpolicy rules =="
  CODEX_DISABLE_GLOBAL_BYPASS=1 codex execpolicy check --pretty --rules "$RULES" -- sudo systemctl restart nginx >/dev/null
  CODEX_DISABLE_GLOBAL_BYPASS=1 codex execpolicy check --pretty --rules "$RULES" -- mkfs.ext4 /dev/sdb1 >/dev/null
  CODEX_DISABLE_GLOBAL_BYPASS=1 codex execpolicy check --pretty --rules "$RULES" -- terraform apply >/dev/null
  CODEX_DISABLE_GLOBAL_BYPASS=1 codex execpolicy check --pretty --rules "$RULES" -- ssh srv1 uptime >/dev/null
else
  echo "codex not found; skipping execpolicy checks"
fi

if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "== Git whitespace =="
  git -C "$ROOT" diff --check
fi

echo "Package validation passed."
