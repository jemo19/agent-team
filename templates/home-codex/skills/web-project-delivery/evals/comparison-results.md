# Web Project Delivery Comparison — 2026-08-20

## Method

- Codex version: `0.148.0`.
- Four dependency-free fixture repositories were created under `/tmp/web-project-delivery-eval-20260820-2040` and committed only as disposable fixture baselines.
- Each scenario used separate clean copies for normal Codex (`baseline`) and the revised skill (`revised`).
- The same installed `web_builder` role performed both arms in separate clean agent contexts; its model assignment was not changed.
- Baseline agents were told not to read or use this skill. Revised agents explicitly read the skill and only routed references.
- Both arms were prohibited from spawning subagents, accessing the network, adding dependencies, deploying, committing results, or touching user repositories.
- Token counts were not exposed. Wall-clock timestamps were recorded when available.

## Results

| Scenario | Normal Codex baseline | Revised skill | Comparison |
|---|---|---|---|
| Simple validator bug | Correct one-line fix; 2/2 tests; manual assertions covered other invalid inputs; about 30 seconds | Same fix plus durable tests for missing, invalid, and negative inputs; 3/3 tests; about 41 seconds | Revised skill materially improved regression coverage at a modest 11-second and 7-line cost. |
| Cross-layer saved filter | Correct UI/API/store feature; 5/5 tests; 47 added lines; about 48 seconds | Functionally equivalent; explicit ownership/surface map; 5/5 tests; 49 added lines; about 64 seconds | Equivalent correctness and focus; revised evidence was clearer but cost about 16 seconds. |
| Mobile banner regression | One CSS rule removed; real browser pre/post mobile and desktop evidence; no console errors; server stopped | Identical code result and browser coverage; no console errors; server stopped | Equivalent functional and verification quality. Total duration was not consistently exposed. |
| Nullable migration source | Correct schema and migration source; validator passed; no database connection/apply; about 34 seconds | Identical source result; explicit data-surface classification and apply boundary; about 26 seconds | Equivalent correctness; revised reporting was clearer and was not slower in the observed run. |

Across both arms:

- Functional outcomes: 4/4 passed.
- User corrections required: 0.
- Unnecessary subagent calls: 0.
- Deployment, real database apply, production action, and network access: 0.
- Diff focus: all eight fixture changes remained within their requested files/surfaces.

The independent static trigger review classified all 4 positive and 7 negative cases correctly. No runtime implicit-trigger harness was available, so trigger results are static rather than an observed model-selection trace.

## Decision

Keep `web-project-delivery` enabled with normal implicit discovery. The revised skill produced a material verification improvement in the simple bug case without causing agent fan-out, scope expansion, or an unjustified overall cost increase. No `[[skills.config]]` override is added.

## Limitations

- One run per arm and scenario; model variance is not measured.
- Revised use was explicit inside the behavior harness so reference use could be isolated; implicit matching was assessed independently from frontmatter only.
- Tokens were unavailable, and browser reports exposed evidence timestamps rather than consistent total duration.
- Fixtures are intentionally small and cannot represent every real monorepo, auth, database, or browser constraint.
