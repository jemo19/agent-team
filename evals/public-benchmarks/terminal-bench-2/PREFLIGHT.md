# Safe Adapter Preflight

Status: **FIVE-TASK SCREEN COMPLETE**. Expansion to a larger campaign remains
blocked on a newly frozen, oracle-validated task cohort.

- [x] Seventeen tests pass against Harbor 0.18.0.
- [x] A scrubbed-environment login probe reports `Logged in using ChatGPT` and
      the adapter forwards no API-key environment variable.
- [x] Independent source review confirms the candidate RPC exposes no
      upload/download/service/user/env API; adapter-owned post-run sync is
      workspace-only and bounded.
- [x] `bwrap` is present and aborts closed when unavailable.
- [x] A no-model fake-Codex sentinel proves `/bin/bash`, `/bin/sh`, and dash
      resolve to the surrogate and the
      outer read-only `auth.json` cannot be returned by candidate shell commands.
- [x] Representative Docker/WSL mount output is redacted before candidate
      return; normal `/workspace` and `/tmp` task paths remain unchanged.
- [x] Isolated workspace changes are bounded, validated, and synchronized into
      the task container before verifier execution.

The stopped video-processing control cell is **infrastructure-invalid** and is
excluded from model scoring: its file-change output remained in the isolated
host workspace and was not present in `/app` for the verifier.
- [x] Inspected `overfull-hbox`, its task metadata, instruction, pinned image,
      oracle result, and resolved single-task Harbor configuration.
- [x] Ran one subscription control: `gpt-5.6-terra` / `medium` on
      `terminal-bench/overfull-hbox`; Harbor completed without exception and
      returned reward `0.0` after 3/4 verifier tests passed.
- [x] Confirmed `bridge-audit.jsonl` (21 records), `codex-events.jsonl`, and
      `final-message.txt`; post-run scans found no auth, API-key, or host-path
      evidence and Harbor deleted the task container.
- [x] Completed the 17-configuration by five-task public screen with 85 scored
      cells, including a crash-recovered Sol/high video cell.
- [x] Re-ran artifact, security, process, socket, and container cleanup checks.
      See `RESULTS-2026-07-12.md` for the frozen disposition and provenance.
- [ ] Stop immediately on auth content, unredacted host paths, bridge bypass,
      candidate-triggered transfer, out-of-workspace upload, download, service
      operation, unexpected user, or API-key evidence.

Forbidden: Harbor's built-in Codex adapter, `OPENAI_API_KEY`, OpenAI API usage,
credential copies into task containers, and fallback execution without bwrap.
