# 03 — Fable-Style Goal Loop for Codex

This is the main operating pattern.

## The loop

```text
GOAL
  -> PLAN
    -> INVOKE
      -> EXECUTE
        -> CHECK
          -> REVIEW
            -> APPROVE / MERGE / APPLY
              -> RECORD
```

## 1. GOAL

A goal is a written contract. It should include:

- Desired outcome.
- Scope.
- Out-of-scope items.
- Target repo, server, or customer.
- Risk class.
- Allowed tools.
- Disallowed tools.
- Acceptance checks.
- Stop conditions.
- Human approval gates.

Use this minimum schema:

```markdown
# GOAL: <short name>

## Context
<why this is being done>

## Target
- Repo/server/customer:
- Environment:
- Owner:

## Desired outcome
<what done means>

## Explicit non-goals
- <thing not to touch>

## Risk class
- Green: read-only or local-only, no customer impact
- Yellow: reversible change, possible service impact
- Red: privileged/destructive/customer-visible/security-sensitive

## Allowed actions
- <allowed>

## Forbidden actions
- <forbidden>

## Required checks
- <check command or manual check>

## Approval gates
- <gate>

## Stop conditions
- <condition>
```

## 2. PLAN

Planning is mandatory before edits or remote changes.

The planner must output:

- System understanding.
- Assumptions.
- Open questions.
- Work packets.
- Parallelizable tasks.
- Serialized tasks.
- Checks.
- Rollback.
- Evidence path.

A good plan has enough detail that a fresh worker agent can execute a packet without re-litigating the entire problem.

## 3. INVOKE

Use subagents by default for non-trivial work once the plan identifies independent work packets. The standing authorization covers read-only scouts, reviewers, test mappers, docs lookups, and other bounded sidecar tasks; it is not a per-task user approval gate.

Close completed subagent threads after their useful findings have been consolidated into the main thread. Completed agents are disposable; leaving them open can exhaust the active thread cap and block later scouting.

### Common invocation pattern

```text
Spawn these subagents in parallel and wait for all results:

1. web_scout: map the affected code paths. Read-only. Return files, functions, entry points, and risks.
2. test_mapper: identify existing tests and missing tests. Read-only. Return exact commands and suggested test cases.
3. risk_reviewer: inspect for security, data integrity, auth, performance, and maintainability risks. Read-only.

Do not let subagents edit files. Consolidate their findings into a single plan before implementation, then close the completed scout threads.
```

### When to invoke write-capable workers

Only after:

- The plan is written.
- The file ownership is clear.
- The worker has a bounded packet.
- The required checks are known.
- You are not running multiple workers against the same files.

## 4. EXECUTE

Execution should be boring:

- Work one packet at a time.
- Keep diffs small.
- Prefer project conventions.
- Run checks early.
- Record commands.
- Stop if assumptions are wrong.

For web projects, execution can happen in a feature branch/worktree.

For infra/MSP, execution should happen from a reviewed checklist. The agent may prepare commands, but the human should approve before remote mutation.

## 5. CHECK

Checks must be deterministic where possible.

Web checks:

- Typecheck.
- Lint.
- Unit tests.
- Integration tests.
- Build.
- E2E/browser checks if applicable.
- Migration dry-runs if applicable.

Infra checks:

- Backup exists.
- Current state captured.
- Service health before change.
- Dry-run available and performed.
- Change executed.
- Service health after change.
- Logs checked.
- Rollback path still valid.

MSP checks:

- Customer authorization recorded.
- Ticket notes updated.
- Scope matches request.
- No secrets in notes.
- Change verified.
- Customer summary drafted.

## 6. REVIEW

Use independent review. The reviewer should not be the same agent that implemented the change.

Review questions:

- Does the diff satisfy the goal?
- Were all checks run?
- Is the test coverage adequate?
- Are there hidden data/auth/security risks?
- Did the worker touch out-of-scope files?
- Is rollback clear?
- Is the closeout summary accurate?

## 7. APPROVE / MERGE / APPLY

Human approval is required for:

- Production deployment.
- Customer-visible changes.
- Privileged server commands.
- Data migrations.
- DNS changes.
- Firewall/IAM/user changes.
- Backup deletion/retention changes.
- Any irreversible or hard-to-rollback operation.

## 8. RECORD

Every completed goal should end with:

- What changed.
- Why it changed.
- Commands run.
- Checks passed/failed.
- Files changed.
- Risks accepted.
- Follow-ups.

## Parallel/serial examples

### Web feature

Parallel:

- Scout affected code.
- Map tests.
- Check framework docs.
- Identify UI states.

Serial:

- Decide API/data contract.
- Implement shared interface.
- Implement UI/backend changes.
- Run tests.
- Review diff.
- Merge/deploy.

### Server patching

Parallel:

- Read runbooks.
- Check backup policy.
- Generate per-host read-only recon plan.
- Draft customer/internal comms if downtime is possible.

Serial:

- Approve window.
- Patch one host.
- Verify.
- Continue to next host.
- Update evidence.

### MSP ticket

Parallel:

- Triage request.
- Check customer profile/runbook.
- Draft missing-info questions.
- Draft execution checklist.

Serial:

- Get approval/missing info.
- Execute change.
- Verify.
- Send closeout.
