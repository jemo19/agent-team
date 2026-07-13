# Terminal-Bench 2 Host Codex Bridge

This Harbor 0.18 custom agent keeps subscription-authenticated Codex on the
host. The candidate RPC exposes only bounded `environment.exec`; it exposes no
upload/download, `auth.json`, Codex home, host path, service API, env overlay,
or user selector. After Codex stops, adapter-owned code performs the separately
bounded workspace-only upload described below; the candidate cannot invoke it.

Each trial creates a short mode-`0700` socket directory under `/tmp`, binds
only that directory at `/run/host-codex-bridge`, and removes it after the
bridge closes. Evidence remains on the separate Harbor logs mount, so long
Harbor trial paths cannot exceed the AF_UNIX address limit.

Before any task stdout or stderr returns to Codex, the bridge replaces Windows
drive/WSL mounts, Docker overlay backing paths, Docker Desktop host mounts, and
known operator-home paths with `[REDACTED_HOST_PATH]`. Audit records contain
raw-byte and redacted-response SHA-256 values plus redaction counts, never raw
host metadata.

After Codex exits and before Harbor invokes the verifier, the adapter validates
and uploads the isolated workspace into the task container root. Only regular,
non-symlink files under that workspace are eligible; credential-like paths,
devices, traversal, excessive file counts, and byte-limit violations fail the
trial. `workspace-sync.jsonl` records relative paths, sizes, SHA-256 digests,
and statuses without file contents. Adapter evidence paths under
`/logs/agent/host-codex` and `/run/host-codex` are also redacted from candidate
output.

Import path: `agents.host_codex_bridge:HostCodexBridge` with this directory on
`PYTHONPATH`. The agent has no built-in-Codex or unsandboxed fallback.

The bridge accepts exactly one JSONL request shape:
`{id, argv, virtual_cwd, timeout_sec}`. `argv` must be `['-c', command]` or
`['-lc', command]`; the virtual cwd must remain under `/workspace`. Output,
request size, and execution time are capped. Audit logs store command digests,
not command bodies. Codex JSONL events, its final message, and its host-side
session tree remain in the Harbor agent logs for later conversion/review.

Run deterministic tests only:

```bash
cd /mnt/c/docs/ai-teams/evals/public-benchmarks/terminal-bench-2
uv run --with pytest --with pytest-asyncio pytest -q
```

Do not run a Terminal-Bench cell until every item in `PREFLIGHT.md` is reviewed.

The first 17-configuration, five-task screen and its crash-recovery provenance
are recorded in `RESULTS-2026-07-12.md`.
