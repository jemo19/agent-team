---
name: local-goal-loop
description: "Use only when explicitly requested to coordinate systematic, multi-stage, high-risk, or cross-domain work with the configured Astra, Sol, and Luna roles, bounded escalation, persistent recovery state, and evidence-backed gates. Do not use implicitly for routine work or a task with one obvious path."
---

# Local Goal Loop

Use a bounded **GOAL -> PLAN -> INVOKE -> EXECUTE -> CHECK -> REVIEW -> RECORD** process for genuinely large or risky work. The installed invocation policy is explicit-only, so invoke this skill as `$local-goal-loop`. This workflow runs only in the root; children must not load it, dispatch children, or operate the goal loop. Do not manufacture ceremony for a small task. INVOKE and REVIEW are optional when delegation or independent review is not justified.

Compose with governing `AGENTS.md`, native Codex goals and plans, and the inherited full-access runtime. Treat `/goal` and `/plan` as client features, never shell commands. The operator's objective is the authority source; this skill neither widens nor narrows that scope.

## 1. GOAL

Create a compact goal contract:

- desired outcome;
- in-scope and out-of-scope work;
- constraints;
- Definition of Done;
- verification method;
- relevant authorization and environment boundaries.

If an active native goal exists, it is the source of truth: reference or refine it instead of creating a competing goal. For details too large for the native goal field, use the repository's existing project-state convention and reference that file when the client supports doing so. Do not invent unsupported goal syntax.

## 2. PLAN

Choose the smallest suitable execution mode:

- `DIRECT`: one obvious path in one session. State that the heavy loop is unnecessary, use the governing policy's minimal planning/checking form, and create no skill-specific ledger or subagent.
- `STAGED`: several dependent steps or meaningful validation. Use a stage map and invoke the smallest useful configured child lane only when work separates cleanly and delegation adds material value.
- `CONTROLLED`: long-running, high-risk, cross-domain, production-sensitive, or difficult-to-reverse work. Use formal gates and persistent state; invoke configured planner, scout, executor, or review lanes only when justified by the stage map.

For `STAGED` and `CONTROLLED`, make a numbered stage map. Each stage names:

1. expected artifact or decision;
2. owner;
3. inputs;
4. exact, failable pass condition;
5. validation command, comparison, or observable evidence;
6. downstream stages invalidated if the stage changes.

Use the native plan as the current stage map when available; do not maintain a competing plan.

## 3. INVOKE

Explicit `$local-goal-loop` invocation authorizes the root to launch and close bounded local subagents within the user's existing task scope. The assigned objective also authorizes every necessary in-scope action it actually includes, such as deployment, remote or privileged work, customer-visible writes, destructive work, database mutation, or infrastructure apply. Do not ask again for those actions; remain inside the objective and verified target.

The persistent root baseline is Astra/low at Standard speed for bounded work; select root-medium for ambiguity. Use the supported new-session profiles only after they exist and validate:

- bounded work, clerical dispatch, status collection, and thread closeout: `codex --profile root-low`, layering `/home/jeff/.codex/root-low.config.toml`;
- consequential architecture, ambiguous cross-component diagnosis, interacting trust boundaries, data integrity, difficult recovery, production planning, or high-risk root acceptance: `codex --profile root-high`, layering `/home/jeff/.codex/root-high.config.toml`.

Do not relabel the current session's effort. If a required profile is absent or does not resolve to Astra at the named effort, return `BLOCKED_EXTERNAL`; instructions alone do not change effort.

Use the configured role at its pinned standing assignment:

- Sol/low: `default`, `worker`;
- Luna/medium: `explorer`, `test_mapper`, `customer_comms`;
- Sol/medium: `web_scout`, `web_builder`, `project_builder`;
- Sol/high: `project_reviewer`;
- Astra/low: `infra_recon`;
- Astra/medium: `msp_triage`;
- Astra/high: `project_architect`, `test_strategist`, `risk_reviewer`, `infra_planner`, `iac_planner`.

Use on-demand variants only for a justified bounded escalation, never as standing stages: Sol/high `web_scout_high` for asynchronous flows, retries, distributed state, authorization paths, or conflicting evidence; Sol/high `web_builder_high` or `project_builder_high` for difficult diagnosis or implementation; Astra/high `project_reviewer_astra_high` for security boundaries, migrations, integrity, recovery, production infrastructure, or consequential cross-component review.

Delegation is optional. Use zero to two children normally, at most two concurrent children by default. Route only a packet that is independently useful and safely bounded. Children never spawn children. Keep one active writer per overlapping file, module, generated artifact, database, port, browser session, or remote resource, including root ownership. Root owns decomposition, integration, acceptance, final verification, escalation, and thread closeout.

Every packet specifies: task and parent IDs; objective and acceptance criteria; source of truth and revision/snapshot; read and write scope; allowed and prohibited tools/actions; inherited `FULL_ACCESS_BY_DESIGN` runtime; inputs and evidence locations; dependencies and resource ownership; requested model/effort; required checks; attempt budget and escalation conditions; and expected output. Children route questions and external blockers to root, never directly to the operator.

Every return specifies: task ID and one status; summary and changed artifacts; findings with exact evidence; checks and observed outcomes; unrun checks and reasons; assumptions and unresolved questions; blocker or escalation reason; and ownership release or transfer. Attach effective model/effort only from trustworthy runtime metadata; never ask a child to invent it.

## 4. EXECUTE

Execute one bounded stage or packet at a time. Before mutation, determine:

- the current objective covers the target and action;
- the fresh runtime resolved to `danger-full-access` with approval policy `never`;
- required backup or rollback prerequisites exist;
- no other agent owns the write scope.

The assigned objective normally authorizes all necessary in-scope implementation, tool use, tests, dependencies, escalation, integration, and completion actions. It also authorizes destructive, privileged, production, and customer-visible work when those effects are actually included. Root resolves routine ambiguity and child questions; only a missing external fact, unavailable credential/MFA/password, enforced external confirmation, unknown destructive target, or truly operator-owned choice becomes a blocker.

## 5. CHECK

After each stage:

1. Run its named deterministic or observable check.
2. Record the result, exit status, artifact, or evidence.
3. If it fails, make at most one targeted repair based on new evidence.
4. Re-run every check invalidated by the repair.
5. Mark a verified pass as `RESOLVED`. If still unresolved, stop with one status:
   - `ESCALATION_REQUIRED`
   - `BLOCKED_EXTERNAL`
   - `USER_DECISION_REQUIRED`

For a non-resolved status, preserve partial artifacts and record the failed criterion, exact evidence, attempted repair, eliminated hypotheses, bounded unresolved scope, and required capability or decision.

Only the root promotes or replaces a child. Allow at most two upward promotions per work item, counting model and effort changes together; stop the previous writer and transfer ownership first. One exceptional xhigh attempt on a supported selected model requires a prior high attempt on the unresolved portion, relevant evidence, a reasoning-related blocker, consequential risk, root approval, and room within the same two-promotion limit. Never assign standing xhigh, Max, or Ultra.

Do not escalate model capability for missing credentials, unsupported models, rate limits, unavailable tools, missing access, external outages, runtime denial, or a genuinely operator-owned decision. Continue independent work and return the blocker to root without starting a login flow or waiting for interactive input.

## 6. REVIEW

Review is optional. Use independent review when justified by security or trust-boundary changes, authentication or authorization, data migration or integrity risk, public API or schema changes, production infrastructure, broad or difficult-to-reverse changes, meaningful cross-module blast radius, significant failed attempts, or explicit user request. Otherwise perform a concise self-review.

Give an independent reviewer the acceptance criteria and relevant diff or artifacts. Require concrete blocking findings to be separated from optional improvements.

## 7. RECORD

For normal one-session work, put evidence in the final response only. Do not create skill-specific persistent state for `DIRECT` work.

For long-running work, use one compact repository-local run ledger. Follow an existing repository convention when present; do not create parallel state. Otherwise use a non-invasive path such as `.codex/runs/<task-slug>/RUN.md` and the template in [references/run-ledger-template.md](references/run-ledger-template.md). Do not place the ledger in an external notes vault, and do not record secrets, customer data, or private host details.

At every continuation, restart, or compaction, re-read the single ledger and re-establish the current revision/snapshot, workspace status, active ownership, running children/processes, outstanding external actions, volatile evidence, and recorded next action before acting. Do not replay an action that may already have completed.

## Loop limits and stopping rules

- At most one targeted repair for the same failed stage before escalation.
- At most two upward promotions per work item, counting model and effort promotions together; keep at most one escalation agent active.
- Do not reset promotion limits by renaming, rephrasing, or splitting the same failed item.
- Never retry identically without new evidence or a materially different approach.
- Do not permit recursive agent spawning.
- Reject infinite "keep improving" work without a measurable stopping condition.
- Stop when the Definition of Done is verified or a genuine external blocker or operator-owned decision remains after root has resolved routine choices.

Governing project policy may require additional state or evidence. Use that convention instead of adding a second ledger. Shared always-on safety and reporting rules remain authoritative and are intentionally not duplicated here.
