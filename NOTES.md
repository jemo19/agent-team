# Agent Team Notes

Updated: 2026-07-12

## Current Operating Notes

- Canonical docs root: `C:\docs\ai-teams` (`/mnt/c/docs/ai-teams` in WSL).
- Public reusable framework state belongs in this docs root.
- Exact project, server, customer, credential, host, and command allow-list facts
  belong in ignored private notes or the relevant project docs.
- The active loop is:

```text
GOAL -> PLAN -> INVOKE SUBAGENTS -> EXECUTE -> CHECK -> REVIEW -> HUMAN GATE -> RECORD EVIDENCE
```

- Subagents are authorized by default for non-trivial, safely parallelizable work.
  Close completed subagent threads after consolidation.
- Keep model effort routed by role instead of defaulting every subagent to maximum
  reasoning.
- Route demanding team roles through `gpt-5.6-sol` and read-heavy/support roles
  through `gpt-5.6-terra`. Keep `gpt-5.6-luna` unassigned until a deterministic,
  high-volume role needs it.
- Validate skills after any `SKILL.md` metadata edit; `description` must be a
  scalar YAML string.

## Recent 2026-06-19 Updates

- Removed the reusable catch-all SSH prompt pattern from the agent-team rule
  template so exact local deploy allow-lists are not overridden.
- Documented the launcher/session approval boundary: if exec-policy allows a
  command but the outer runner rejects it, do not hide or wrap the command.
- Updated templates and active project `AGENTS.md` files to close completed
  subagent threads after consolidation.
- Confirmed installed skill validation passes after the deploy-skill YAML fix.

## Recent 2026-07-12 Updates

- Completed the 238-cell internal role-model screen and preserved it as grader
  calibration evidence after human review found semantic false negatives and a
  root-orchestration classification anomaly. No routing changed.
- Added a separate Terminal-Bench 2 public lane using Harbor `0.18.0` and a
  tested host-side Codex bridge; no OpenAI API key or API call was used.
- Completed 85 comparable public cells across all 17 GPT-5.6 configurations and
  five pinned tasks. Sol/xhigh and Terra/ultra each scored 4/5, but the sample
  is too small for a general ranking.
- Recovered a terminal crash during the final Sol/high video trial by removing
  the orphan container and rerunning only the interrupted cell. The abandoned
  attempt never reached workspace sync or verification and was not scored.

## Recent 2026-07-09 Updates

- Migrated installed global agents, reusable templates, and the AI Team helper
  agents from `gpt-5.5` to role-routed GPT-5.6 Sol and Terra assignments.
- Preserved each role's existing reasoning effort as the migration baseline.
- Removed the installed GPT-5.5 `model_instructions_file` override so GPT-5.6
  uses its current shipped instructions; the old local file remains inactive.
- Verified the model family against official OpenAI docs and the local Codex
  model catalog before changing configuration.
- Added a versioned role-model evaluation design and local harness covering 14
  role surfaces across the frozen 17-cell Sol/Terra/Luna reasoning matrix. The
  current root control is Sol `ultra`; Plan mode is Sol `xhigh`.
- The initial screen is 238 candidate runs. Its then-current preflight passed
  static, cost, fixture, isolation, and independent review. Raw traces remain
  ignored, and no result changes active routing automatically.
- Hardened the suite through `1.4.2` and harness `1.3.1` after the Ultra pilot,
  six calibration iterations, human review, offline replay, and independent
  security/scoring review. The current package passes 69 tests across 12 files.
- Removed the CLI `--ephemeral` flag after the first invalid pilot showed it
  broke Ultra parent/child lookup; session state remains disposable inside the
  Bubblewrap namespace. Tool and command counts now deduplicate lifecycle
  events, and empty collaboration waits cannot earn delegation points.
- Independent review found that the pilot's model shell shared the outer Codex
  auth filesystem. The current harness intercepts shell commands into a nested
  Bubblewrap namespace with no auth/control/artifact paths and verifies that
  boundary with native Codex before execution. It also freezes/digests both
  preflight artifacts, stops on runner exceptions, distinguishes missing child
  usage, and requires reviewed finalist declarations before recommendations.
- Calibration v5 human review found 12 passes and two supported failures.
  Calibration v6 corrected the MSP-triage omission and produced 13 human
  semantic passes with one supported `customer_comms` failure. The current
  offline replay preserves that 13/1 outcome.
- The v6 run exposed and now regression-tests two harness defects: quoted local
  `rg` alternation was misread as a remote command, and a recovered WebSocket
  reconnect was treated as fatal despite a healthy terminal result.
- A batched Luna/max shadow judge was rejected for a critical false pass and
  invalid evidence citations. Atomic protocol 3.0 was rejected before calls
  for label leakage and an unobservable criterion. Protocol 3.1 uses opaque
  IDs, host-only labels, atomic forward/reverse calls, strict event policy, and
  a real injection control.
- The fresh protocol-3.1 shadow pilot later completed but failed its acceptance
  gate, so it did not alter deterministic scoring.
- The screen completed all 238 cells under suite `1.4.2` and harness `1.3.1`.
  Human review found grader brittleness and a root-orchestration classification
  anomaly, so no production route changed. Same-fixture repeats remain stability
  evidence only; recommendations require distinct fixtures, human review, and
  operator approval.
- Implemented suite `1.5.0` / harness `1.4.0`: semantic concept alternatives
  now span logical output fields, terminal results classify incomplete scoring
  and quality failures honestly, and both builder fixtures use harder V2
  contracts. The additive offline regrade covered 204 compatible cases,
  excluded 34 changed builder cases, recovered 31 semantic credits, and
  rejected one old keyword-only credit without rewriting frozen evidence.
  Repository validation passes 76 tests across 13 files.
