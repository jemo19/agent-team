# 08 — Checks and Gates

## Principle

Models can reason. Checks must verify.

A goal is not done because an agent says it is done. It is done when the agreed checks pass or when you explicitly accept a known exception.

## Web project gates

### Before implementation

- Goal file exists.
- Scope is clear.
- Files/areas likely affected are known.
- Tests/check commands are known.
- Risks are listed.

### Before final answer

- Diff reviewed.
- `git diff --check` run.
- Relevant tests run.
- Typecheck/lint/build run where available.
- Reviewer pass completed.
- Documentation updated if behavior changed.

### Red flags

- Agent changed lockfile unexpectedly.
- Agent changed auth/security code without explicit scope.
- Agent added dependency without approval.
- Agent skipped tests due vague reason.
- Agent made broad formatting changes mixed with logic.
- Agent edited generated files manually.

## Infra gates

### Before remote recon

- Server identity confirmed.
- Authorization confirmed.
- Command list reviewed.
- Commands are read-only.
- Evidence path created.

### Before change

- Backup/restore confidence checked.
- Current state captured.
- Exact commands reviewed.
- Rollback written.
- Maintenance window approved if needed.
- Customer impact considered.

### After change

- Service health verified.
- Logs checked.
- Monitoring checked.
- Evidence updated.
- Follow-ups created.

## MSP gates

### Before customer-impacting work

- Customer/requester authorized.
- Scope confirmed.
- Approval recorded.
- Maintenance window confirmed.
- Rollback/verification ready.

### Before closeout

- Work performed exactly matches ticket.
- Verification result recorded.
- Customer summary is accurate.
- No secrets/internal notes included.

## Completion language

Agents must use precise status:

- `Complete`: all required checks passed.
- `Complete with exceptions`: checks skipped/failed with accepted reason.
- `Blocked`: cannot proceed without info/approval/access.
- `Plan only`: no execution performed.
- `Recon only`: read-only work performed.

## Evidence checklist

For any non-trivial goal, record:

- Goal file.
- Plan.
- Subagent findings.
- Commands run.
- Outputs or summarized outputs.
- Tests/checks.
- Review findings.
- Approval notes.
- Closeout.
