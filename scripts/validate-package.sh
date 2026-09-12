#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

for required in python3 node codex git; do
  if ! command -v "$required" >/dev/null 2>&1; then
    echo "Required validation tool is unavailable: $required" >&2
    exit 1
  fi
done

if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Authoritative package validation requires a Git worktree: $ROOT" >&2
  exit 1
fi

echo "== Shell syntax =="
find "$ROOT/templates/ops-control/scripts" -type f -name "*.sh" -print0 |
  xargs -0 -r bash -n

echo "== Python syntax =="
python3 -c 'import pathlib, sys; compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec")' \
  "$ROOT/templates/ops-control/.codex/hooks/pre_tool_use_policy.py"

echo "== Policy behavior =="
python3 "$ROOT/scripts/test-policies.py"

echo "== Role evaluation JavaScript syntax =="
find "$ROOT/evals/role-model-matrix" -type f -name "*.mjs" \
  -exec node --check {} \;

echo "== Role evaluation suite =="
node "$ROOT/evals/role-model-matrix/scripts/validate.mjs"

echo "== Fixture test policy =="
node "$ROOT/scripts/validate-fixture-tests.mjs"

echo "== Agent routing synchronizer =="
node --test "$ROOT/scripts/sync-agent-routing.test.mjs"

echo "== Shared invariant synchronizer =="
node --check "$ROOT/scripts/sync-shared-invariants.mjs"
node --test "$ROOT/scripts/sync-shared-invariants.test.mjs"

echo "== Project notes synchronizer =="
node --check "$ROOT/scripts/sync-project-notes.mjs"
node --test "$ROOT/scripts/sync-project-notes.test.mjs"

echo "== Git whitespace =="
git -C "$ROOT" diff --check

echo "Package validation passed."
