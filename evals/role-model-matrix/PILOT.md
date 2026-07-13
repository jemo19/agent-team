# Ultra Isolation Pilot

## Purpose

This pilot validates the execution boundary and reporting semantics before a
14-role calibration or 238-cell screen. It is not routing evidence.

The harness invokes the local `codex exec` client with the operator's existing
Codex authentication. It does not make custom Responses API or OpenAI Evals API
calls. Candidate turns consume Codex usage; fixture copying, deterministic
grading, trace parsing, and report generation are local.

## Pilot Runs

### V1: Invalid Harness Attempt

The first root Ultra attempt used the Codex CLI `--ephemeral` flag. Ultra began
its collaboration workflow, but child lookup failed with `collab spawn failed:
no thread with id ...`. The attempt was interrupted and is classified as an
invalid harness result, not a model-quality result. It may have consumed usage
that the interrupted trace did not capture.

The fix was to remove the CLI flag while keeping `CODEX_HOME` on a private
Bubblewrap tmpfs that is destroyed when the candidate process exits. This
retains disposable local state without breaking Ultra's parent/child lookup.

### V2: Completed Two-Cell Smoke Test

Run ID: `2026-07-09-ultra-isolation-pilot-v2`

Both candidates completed with valid structured output and passed the harness,
policy, and deterministic hard gates. The figures below are an audited
reanalysis of the immutable V2 traces using the hardened telemetry semantics.
They remain engineering smoke evidence, not benchmark evidence: independent
review later found that V2 mounted the Codex authentication file in the same
filesystem view used by model-generated shell commands. No trace attempted to
read it, but the preventive boundary was insufficient.

| Task | Model | Effort | Hard gate | Combined score | Task outcome | Tokens | Duration | Tools | Commands | Collaboration calls | Observable children | Delegation telemetry |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Root orchestration incident summary | `gpt-5.6-sol` | `ultra` | pass | indeterminate, `80-100` | `100` | 295,296 | 229,671 ms | 10 | 5 | 5 | unknown | `identity_unavailable` |
| Web builder strict page-size parser | `gpt-5.6-sol` | `ultra` | pass | `100` | `100` | 79,333 | 76,890 ms | 6 | 4 | 0 | 0 | `none_observed` |
| **Total** | | | | | | **374,629** | **306,561 ms** | **16** | **9** | **5** | | |

The root trace contained five completed `collab_tool_call` records, all using
`wait`, with empty `receiver_thread_ids` and empty `agents_states`. The final
response said independent agents worked, and file changes appeared between wait
events, but those are circumstantial. Codex CLI 0.144.0 did not expose child
identities, child outcomes, or child usage in this parent JSONL trace. The
framework therefore records the delegation assertion as indeterminate. It does
not turn missing telemetry into zero, award delegation points for wait calls,
or infer a successful child count from prose.

The original generated V2 `report.md` predates this hardening. It shows the root
as an 80-point incomplete result and double-counts started/completed tool-event
pairs. Preserve that report as immutable run evidence; use this audited note and
newer harness reports for interpretation.

## Decisions From The Pilot

- Keep namespace-local session state; do not pass CLI `--ephemeral` to root
  Ultra evaluations.
- Run model-generated shell commands in a nested Bubblewrap namespace that
  omits `/codex-home`, auth, control, artifact, suite, and hidden paths. Require
  the native non-billed boundary probe before billed execution.
- Count completed tool operations rather than lifecycle events.
- Report completed collaboration calls separately from observable children.
- Use delegation telemetry states `observed`, `none_observed`, and
  `identity_unavailable`.
- When an assertion is indeterminate, report lower/upper score bounds, withhold
  the combined score, and exclude it from ranking and recommendations.
- Preserve the fixed-denominator non-delegation task-outcome score so task
  quality remains comparable without pretending orchestration was observed.
- Require observable child identities or a separate acceptance trace before a
  root routing recommendation claims demonstrated delegation.

## Next Gate

The pilot's original gate is complete. Calibration v6 ran all 14 production
controls; human review and suite-1.4.2/harness-1.3.1 replay support 13 passes
and one `customer_comms` failure. The July 12 screen also completed all 238
cells and received its required human review.

The remaining order is:

1. Version and independently validate fixes for semantic assertion brittleness
   and root-orchestration terminal classification.
2. Offline-regrade the preserved 238 outputs without rewriting frozen evidence.
3. Use same-fixture repeats only for stability; require at least three distinct
   fixtures per finalist before any routing recommendation.

Production routing remains unchanged throughout these gates.
