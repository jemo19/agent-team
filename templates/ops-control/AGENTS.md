# Local Ops AGENTS.md

This repo is for managing three Linux servers and small-MSP customer operations.

## Default operating mode

- Plan first.
- Treat all remote/customer work as sensitive.
- Start with read-only analysis.
- Use evidence files for all non-trivial work.
- Do not store secrets in this repo.
- Do not run SSH or mutating commands without explicit approval.

## Risk classes

- Green: read-only/local planning, no customer impact.
- Yellow: reversible operational change, possible service impact.
- Red: privileged, destructive, customer-visible, security-sensitive, data-impacting, or hard to roll back.

## Required gates

Stop for approval before:

- SSH execution.
- `sudo`.
- Package install/upgrade/remove.
- Service restart/stop/disable/enable.
- Docker compose up/down/restart/pull.
- Firewall/network changes.
- User/group/IAM/SSH changes.
- Database changes.
- DNS/mail-routing changes.
- Backup deletion/retention changes.
- Reboot/shutdown.
- Customer-facing messages.

## Evidence

For each goal or ticket, create:

```text
evidence/YYYY-MM-DD/<goal-id>/
  plan.md
  commands.md
  checks.md
  review.md
  closeout.md
```

## Server inventory

Use `inventory/servers.yaml`. Do not store credentials there.

## Customer folders

Use `customers/<customer>/`. Do not store secrets. Store references to secret-manager items only.
