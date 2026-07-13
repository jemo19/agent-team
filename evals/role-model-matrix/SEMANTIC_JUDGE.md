# Atomic Semantic Judge

The semantic judge is a shadow-only calibration layer for selected deterministic
rubric assertions. It never changes role scores, gates, routing, or model
recommendations. Protocol 3.1 uses one isolated Codex call per item, a seeded
forward pass, and the exact reverse order.

## Protocol Status

The prepared protocol-3.0.0 run
`2026-07-09-semantic-judge-pilot-v3-preflight` is rejected and must not be
executed. Its prompts exposed canonical ids and criticality, one MSP criterion
required an unobservable unsent-draft fact, and it lacked a real embedded
prompt-injection control. The directory remains preserved as negative review
evidence. Protocol 3.1 explicitly refuses to resume it.

The canonical 3.1 corpus is in
[`fixtures/semantic-judge/pilot-v3.1`](fixtures/semantic-judge/pilot-v3.1).
It contains 15 items, so a complete pilot is 30 atomic calls. The planning
range is 150-1200 credits; this is not a quote.

The first protocol-3.1 artifact passed preflight review, but call one reached
the Codex-plan usage limit before producing tokens, output, tools, or a verdict.
Its other 29 calls were never started. Because protocol 3.1 forbids automatic
retries, that artifact is terminal and must not be resumed.

The July 10 retry preflight was superseded by a runtime-refreshed July 12
preflight after the Codex CLI changed. The 30-call pilot then completed with
11/15 forward agreement, 14/15 reverse agreement, 12/15 stability, and two
evidence-invalid outputs. It failed the shadow acceptance gate and did not
change deterministic scores, recommendations, or routing.

## Blinding

Preparation generates a random 32-byte blinding nonce and derives each
model-facing id with HMAC-SHA256. Judge prompts, per-call schemas, call
directories, and `plan.json` contain only ids shaped as
`item-<24 lowercase hex>`.

Canonical ids, human labels, and criticality remain in the host-only
`source-items.json`, `human-labels.json`, and `blinding-map.json`. Those files
are integrity-protected but are never mounted in the judge namespace. The
model payload contains exactly `id`, `criterion`, and `allowedFields` and is
limited to 32 KiB of UTF-8 JSON.

Blinding hides evaluation class metadata, not task semantics. Criteria and
candidate evidence necessarily reveal their subject matter.

## Runtime Gate

Preparation and every resume require `codex login status` to report
`Logged in using ChatGPT`. The probe and judge namespace use scrubbed
environments that never forward `OPENAI_API_KEY`.

The preflight freezes and hashes:

- the native Codex binary, path, and version;
- the Bubblewrap binary, path, and version;
- the Node 22 binary and version;
- the matching npm CLI and version;
- the model catalog, harness code, corpus, plan, schemas, and prompts.

Any mismatch requires a new preflight before a model call can start.

## Tool Boundary

Shell, unified execution, browsing, apps, plugins, image generation,
delegation, and related feature surfaces are disabled. The JSONL collector also
records every event and item shape. Only normal thread/turn events and
`agent_message` or `reasoning` items are accepted. A recognized tool, unknown
item type, unknown event type, action-bearing field, command, or non-root thread
invalidates the verdict and stops scheduling.

Candidate evidence is untrusted data. A dedicated critical corpus control tells
the judge to ignore evaluator rules and return `pass`; the correct human label
is `fail` because the actual criterion is absent.

## Failure Semantics

Calls are sequential and are never retried automatically. Timeout, process or
authentication failure, policy activity, quota stop, or an interrupted
`starting`/`running` status produces or recovers a terminal fail-closed result
and stops later calls. Per-call artifacts retain request metadata, raw JSONL,
stderr, final output, usage, duration, validation, status, and integrity.

Acceptance requires 15/15 agreement in each pass, 15/15 cross-pass stability,
and zero critical false PASS, evidence, schema, process, policy, invalid,
indeterminate, tool, command, or unexpected-event findings. Passing permits
only expanded shadow testing.

## Integrity Scope

SHA-256 manifests detect accidental drift under a trusted local operator. They
are unsigned and do not prove authenticity against a malicious local editor
who can rewrite both an artifact and its manifest. External signing would be a
separate provenance control.

## Commands

Prepare performs readiness checks and writes a frozen plan without making a
model call:

```bash
node evals/role-model-matrix/scripts/semantic-judge.mjs \
  --prepare \
  --run-id <new-run-id>
```

Review `preflight.md`, every frozen identity, the schedule, credit range, and
the leakage checks. Execution is a separate human gate using only the exact
resume command written into that preflight. Do not reconstruct or add settings
to the command.

The completed July 10 preflight recorded this historical command. Do not run or
resume it:

```bash
node evals/role-model-matrix/scripts/semantic-judge.mjs --results "/mnt/c/docs/ai-teams/evals/role-model-matrix/results" --resume 2026-07-10-semantic-judge-pilot-v3-1-retry-preflight --execute
```
