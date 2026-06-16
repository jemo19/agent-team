# 07 — MSP Operations Team

## Purpose

The MSP team helps with customer requests, maintenance, documentation, and routine admin work. It should reduce your cognitive load without creating customer risk.

## Customer folder model

```text
customers/customer-slug/
  customer-profile.md
  systems.yaml
  runbooks/
  tickets/
  maintenance-policy.md
  evidence/
```

Do not store secrets. Store pointers such as:

```text
Credential source: Bitwarden item "Customer / Production SSH".
MFA source: customer-owned admin account; request code during approved window.
```

## Ticket workflow

```text
INTAKE -> TRIAGE -> PLAN -> APPROVAL -> EXECUTE -> VERIFY -> CLOSEOUT
```

## Intake

Capture:

- Customer.
- Requester.
- Request date/time.
- Requested change.
- Business reason.
- Desired deadline.
- Affected systems.
- Attachments/logs/screenshots.
- Authorization status.

## Triage

Classify:

- Request type: access, server, DNS, email, backup, monitoring, app support, security, billing/admin, unknown.
- Risk: Green/Yellow/Red.
- Urgency: P1/P2/P3/P4.
- Missing info.
- Customer approval required.
- Maintenance window required.

## Planning

MSP plan must include:

- Exact scope.
- Systems affected.
- Proposed steps.
- Verification.
- Rollback.
- Customer impact.
- Approval requirement.
- Communication draft.

## Execution

For customer systems, execution is serialized unless the plan proves safe parallelism.

Human approval required for:

- Customer-visible downtime.
- DNS changes.
- Mail routing changes.
- Firewall/VPN changes.
- User privilege changes.
- Data restore/delete/migration.
- Backup retention changes.
- Security incident containment actions.
- Any change outside a pre-approved maintenance policy.

## Verification

Use objective checks:

- DNS query result.
- Service health endpoint.
- Login test.
- Mail flow test.
- Backup job success.
- Monitoring green.
- Customer confirmation.

## Closeout

A closeout note should include:

- What was requested.
- What was done.
- When it was done.
- Verification performed.
- Customer-visible impact.
- Follow-up actions.

## MSP agent roles

### `msp_triage`

Read-only. Converts rough customer requests into structured tickets.

### `customer_comms`

Read-only. Drafts customer-safe responses. It should not overpromise or reveal internal uncertainty unnecessarily.

### `infra_planner`

Builds execution/rollback/verification plans.

### `risk_reviewer`

Reviews plans for blast radius, missing approval, and verification gaps.

## Synthetic ticket drills

Before using on real customers, run synthetic tickets:

```bash
bash scripts/new-ticket.sh demo-customer "Synthetic request: create a new user account for Jane Doe"
```

Then ask Codex to triage and plan without executing.

## Customer communication style

Use direct, professional wording:

- State what you understand.
- Ask for missing info clearly.
- Identify maintenance window if needed.
- Avoid exposing internal implementation details unless relevant.
- Avoid saying work is complete until verified.

Example:

```text
We can make this change. Before scheduling it, please confirm the target hostname, the desired value, and whether a brief DNS propagation delay is acceptable. Once confirmed, I will apply the change, verify it from an external resolver, and send the result back on this ticket.
```
