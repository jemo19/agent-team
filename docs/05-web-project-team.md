# 05 — Web Project Team

## Purpose

The web project team helps you build and maintain web applications across multiple repos. It should be optimized for:

- Codebase onboarding.
- Feature implementation.
- Bug fixing.
- Refactoring.
- Test creation.
- Security/correctness review.
- Documentation updates.
- Release notes.

## Per-project installation

Copy `templates/web-project` files into each repo you want Codex to work on.

Minimum files:

```text
AGENTS.md
.codex/config.toml
.codex/agents/project-architect.toml
.codex/agents/project-builder.toml
.codex/agents/project-reviewer.toml
.agentic/GOAL_TEMPLATE.md
.agentic/checks/web-checks.md
.agentic/runbooks/feature.md
```

Then edit `AGENTS.md` for that specific project:

- Package manager.
- Install command.
- Dev server command.
- Test command.
- Typecheck command.
- Lint command.
- Build command.
- Framework conventions.
- Env var policy.
- Database/migration policy.
- Deployment policy.

## Team roles

### Root orchestrator

Usually the main Codex session. Responsibilities:

- Read goal.
- Plan.
- Spawn scouts.
- Consolidate.
- Assign implementation packet.
- Run checks.
- Request review.
- Prepare final summary.

### `web_scout`

Read-only. Use for:

- Finding entry points.
- Mapping affected files.
- Understanding routing/state/data flow.
- Identifying project conventions.

Prompt shape:

```text
Use web_scout. Read-only. Map the code paths relevant to <goal>. Return exact files, symbols, data flow, tests, and risks. Do not propose large rewrites.
```

### `project_architect`

Read-only planner for the current repo. Use for:

- Interface decisions.
- Migration sequencing.
- Major refactors.
- Integration design.

### `web_builder` / `project_builder`

Write-capable. Use only after a bounded packet exists.

Good packet:

```text
Implement only the frontend validation changes in files A, B, C. Do not touch API handlers or database code. Run npm test -- validation after changes.
```

Bad packet:

```text
Fix the app.
```

### `test_mapper`

Read-only or test-write after approval. Use for:

- Existing test discovery.
- Missing coverage plan.
- Edge cases.
- Test command mapping.

### `risk_reviewer` / `project_reviewer`

Read-only. Use after implementation:

- Security.
- Correctness.
- Auth/data exposure.
- Race conditions.
- Regression risk.
- Missing tests.

## Standard web feature workflow

### Phase A — Goal contract

Create `.agentic/goals/GOAL-YYYYMMDD-short-name.md`.

### Phase B — Parallel scouting

Run in parallel:

1. `web_scout`: code path map.
2. `test_mapper`: test map.
3. `risk_reviewer`: risk pre-review.
4. Optional docs scout: framework/API behavior.

### Phase C — Plan

Root agent consolidates:

- Proposed design.
- Files to touch.
- Tests to add/change.
- Commands to run.
- Known risks.
- Serialized tasks.

### Phase D — Implementation

One write-capable worker unless file ownership is clean enough to split.

Use separate worktrees for multi-worker implementation:

```bash
git worktree add ../project-goal-ui -b ai/goal-ui
git worktree add ../project-goal-api -b ai/goal-api
```

Do not let two agents change the same files or lockfile concurrently.

### Phase E — Checks

Run project checks from `AGENTS.md` and `.agentic/checks/web-checks.md`.

Minimum:

```bash
git diff --check
npm test              # or project equivalent
npm run typecheck     # if available
npm run lint          # if available
npm run build         # if available
```

### Phase F — Independent review

Ask:

```text
Spawn project_reviewer. Review the diff against the goal. Read-only. Find correctness/security/test issues only. Ignore style-only preferences unless they hide a bug. Return blocking and non-blocking findings.
```

### Phase G — Closeout

Final answer must include:

- Files changed.
- Behavior changed.
- Tests run.
- Tests not run and why.
- Risks remaining.
- Follow-ups.

## Bugfix workflow

For bugs, reproduce before fixing unless impossible.

1. Capture symptom.
2. Spawn scout to trace code path.
3. Spawn test mapper to find/add regression test.
4. Implement minimal fix.
5. Run regression test.
6. Run relevant suite.
7. Review.

## Refactor workflow

Refactors need stricter boundaries.

- Define behavior-preservation checks.
- Prefer mechanical changes.
- Run tests before and after.
- Avoid mixing feature work with refactor.
- Use smaller batches.
- Have reviewer compare public API behavior.

## Deployment

Deployment is a human gate. Codex may:

- Prepare release notes.
- Prepare deployment checklist.
- Verify build artifacts.
- Inspect CI config.
- Draft rollback steps.

Codex should not deploy production without explicit approval.
