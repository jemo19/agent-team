# 10 — Runbooks

## Runbook: New web feature

1. Create goal file.
2. Ask Codex to plan only.
3. Spawn read-only scouts in parallel.
4. Consolidate plan.
5. Approve implementation packet.
6. Implement in branch/worktree.
7. Run checks.
8. Independent review.
9. Fix findings.
10. Final summary.

Prompt:

```text
Use the web-project delivery workflow. Goal: <goal>. Plan first. Spawn read-only scouts for code path, tests, and risk. Wait for all. Consolidate a plan. Do not edit until the plan is written.
```

## Runbook: Web bugfix

1. Capture bug symptom.
2. Find reproduction path.
3. Map affected code.
4. Identify regression test.
5. Implement minimal fix.
6. Run regression test.
7. Run broader checks.
8. Review.

Prompt:

```text
Bug: <symptom>. Reproduce or explain why reproduction is not possible. Spawn web_scout and test_mapper in parallel. Then propose the smallest safe fix with a regression test. Do not implement until plan is complete.
```

## Runbook: Monthly server maintenance

1. Create maintenance goal.
2. Read inventory.
3. Generate read-only recon plan.
4. Approve recon.
5. Run recon one server at a time.
6. Summarize patch/reboot/service risks.
7. Build exact change plan.
8. Approve maintenance window.
9. Execute one server at a time.
10. Verify and close.

Prompt:

```text
Use the linux-server-maintenance workflow. Scope: monthly maintenance for srv1/srv2/srv3. Start with read-only planning only. Produce recon commands, risk matrix, backup checks, maintenance order, verification, and rollback. Do not run SSH until approved.
```

## Runbook: Server incident triage

1. Define affected service/server.
2. Capture current state.
3. Check recent changes.
4. Check logs.
5. Hypothesize.
6. Propose one reversible action.
7. Approve.
8. Execute.
9. Verify.

Prompt:

```text
Incident: <symptom>. Affected server/service: <target>. Use read-only recon first. Build a timeline, likely causes, commands to inspect, and one-at-a-time remediation plan. Stop before any mutating command.
```

## Runbook: MSP ticket intake

1. Create ticket file.
2. Triage request.
3. Identify missing info.
4. Classify risk/urgency.
5. Draft customer response.
6. Create execution plan.
7. Approval gate.
8. Execute/verify/close.

Prompt:

```text
Use the MSP ticket ops workflow. Triage ticket <path>. Produce structured triage, missing questions, risk class, customer response draft, execution plan, verification plan, and approval gate. Do not execute remote/customer commands.
```

## Runbook: DNS change for customer

1. Verify authorized requester.
2. Confirm zone, record type, name, value, TTL.
3. Check current record.
4. Plan change and rollback.
5. Approval.
6. Apply change.
7. Verify with authoritative and public resolvers.
8. Closeout.

## Runbook: User access change

1. Verify requester authorization.
2. Verify target user identity.
3. Define requested permissions.
4. Check least privilege.
5. Approval if privileged.
6. Apply change.
7. Verify access.
8. Record in ticket.

## Runbook: Backup restore check

1. Identify system/data.
2. Identify backup source.
3. Confirm latest successful backup.
4. Confirm restore method.
5. If testing restore, use isolated target.
6. Record result.
7. Do not overwrite production data without explicit Red approval.
