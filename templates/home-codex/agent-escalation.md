# Root-controlled routing and escalation

All fresh root and child sessions run `FULL_ACCESS_BY_DESIGN`: `danger-full-access` with approval policy `never`. Role write/read limits coordinate work; they are not security isolation. The assigned objective authorizes its necessary in-scope actions, and children return questions, contradictions, and external blockers to root rather than asking the operator. Root resolves routine ambiguity and requests operator input only for a genuinely operator-owned choice that cannot be inferred from the objective and trusted evidence.

Root baseline is `gpt-6-astra` / `low` at Standard speed for bounded work. Use `codex --strict-config --profile root-medium` for ambiguous work; use `codex --strict-config --profile root-high` for consequential reasoning and acceptance. Plain `codex` uses low. A fresh thread must confirm its resolved model/effort because project or launch overrides may win. Existing sessions retain their loaded configuration; do not claim that a specialist changes root effort.

Select the appropriate specialist initially when risk is evident. Each work item receives at most one targeted repair at its current configuration, supported by new evidence, and at most two upward promotions total, counting model and effort together. Root alone authorizes escalation. Keep one active escalation agent per item; stop the previous writer and transfer exact ownership and preserved artifacts before replacement. Do not reset the budget by renaming, rephrasing, or splitting the same failed item.

Use four outcomes: RESOLVED, ESCALATION_REQUIRED, BLOCKED_EXTERNAL, USER_DECISION_REQUIRED. Preserve partial results for every nonresolved outcome. Missing credentials, unsupported models, unavailable tools, rate limits, sandbox denial, outages, trusted inventory, authorization, or user decisions are not reasoning failures. Do not retry these with more reasoning or silently substitute a model.

## Supported promotion paths

Pinned custom role settings override per-spawn model/effort requests. Never edit a shared standing file temporarily. Use these on-demand variants only when a bounded task needs them:

| Standing role | On-demand variant | Resolved target |
|---|---|---|
| web_scout | web_scout_high | gpt-5.6-sol / high |
| web_builder | web_builder_high | gpt-5.6-sol / high |
| project_builder | project_builder_high | gpt-5.6-sol / high |
| project_reviewer | project_reviewer_astra_high | gpt-6-astra / high |

Builders return unresolved architecture or consequential reasoning to an appropriate Astra/high specialist. Infrastructure recon returns ambiguous interpretation to an Astra medium/high specialist. Sensitive drafts receive appropriate higher-capability review. Choose a named specialist whose scope matches; do not force every escalation through a fixed ladder. Native metadata must confirm effective settings. Start the next unrelated item at its standing baseline.

One exceptional xhigh attempt is permitted only after high addressed the unresolved portion, evidence is collected, the failure is reasoning-related, the work is security-critical, production-critical, hard to reverse or comparably consequential, the selected model supports xhigh, root approves and records it, and the attempt fits within the same two-promotion budget. No standing xhigh role/profile; Max and Ultra are excluded. A qualified root session can use `codex --strict-config -m gpt-6-astra -c 'model_reasoning_effort="xhigh"'`. Do not launch xhigh simply to test this gate.

## Packet, evidence, and ownership

Use `agent-task-packet.json` and `agent-task-return.json` beside this reference. A JSON shape is not a security boundary. Scope includes files, shared databases, ports, fixtures, browser sessions, generated files, lockfiles, and remote resources. Root checks overlapping ownership and serializes or rejects conflicts; this is instruction-only without a verified lock. Children do not delegate, invoke local-goal-loop, or operate beyond task authority.

An escalation adds the failed criterion, current role/model/effort, observed failure, attempts/repairs, eliminated hypotheses, exact evidence references, bounded unresolved scope, constraints, requested capability and output. The replacement rechecks the current revision and packet. Record PASS, FAIL, BLOCKED and NOT_RUN separately; model agreement is not execution evidence. A fresh independent reviewer of consequential work receives a stable snapshot, acceptance criteria, surrounding context, and all available failures/checks before the builder's narrative.

Shell, MCP, apps, browser and computer-use controls can still have separate technical availability and authentication. Report ENFORCED, INSTRUCTION_ONLY or UNVERIFIED per boundary. Missing credentials, MFA, OS passwords, provider confirmation, or connection state are `BLOCKED_EXTERNAL`; do not launch an interactive login or wait for stdin. Skills and stronger models never widen the objective.
