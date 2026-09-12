# Local Ops AGENTS.md

This repo is for managing three Linux servers and small-MSP customer operations.

## Shared execution invariants

- Use a proportionate workflow; this repository's stricter evidence requirements below remain authoritative for ops work.
- `$local-goal-loop` is explicit-only. Its invocation authorizes bounded local child routing with the configured roles/models/efforts without another permission prompt: DIRECT uses no child; STAGED and CONTROLLED may route useful independent packets. Outside the skill, subagents and independent review remain optional unless risk or the requested work warrants them.
- Preserve unrelated work, use one operator/writer per scope, and verify before closeout.
- The assigned objective authorizes necessary in-scope work. Skills and stronger models do not expand it. Missing inventory, access, tools, external authorization, or essential business facts are not reasoning failures.
- Runtime access inherits `FULL_ACCESS_BY_DESIGN`: `danger-full-access` with approval policy `never`. Role boundaries coordinate ownership rather than enforce security isolation.
- Do not recursively spawn subagents.

## Planner-to-executor routing

- Routine local work keeps the direct path when ownership, procedure, risk, and verification are already obvious.
- Use an Astra-high planner for consequential architecture, infrastructure design, cross-boundary work, difficult rollback, material ambiguity, or significant failed attempts.
- The planner works read-only by role and marks a packet `READY` only when it includes acceptance criteria, trusted evidence, exact target/source ownership, ordered procedure, preserved behavior/exclusions, validation, risk and impact, rollback feasibility, abort conditions, objective/external authorization facts, unresolved questions, and the minimum executor role/model/effort.
- A `READY` packet lets the root execute or assign work already included in the objective without another operator prompt.
- Executors verify packets against current inventory, runbooks, and runtime state and return contradictions to the root instead of silently redesigning them.

## Default operating mode

- Plan first.
- Treat all remote/customer work as sensitive.
- Start with read-only analysis.
- Use evidence files for all non-trivial work.
- Do not store secrets in this repo.
- Do not ask the operator for routine permission or clarification after the objective starts. The root resolves in-scope choices; unavailable credentials, MFA, enforced external confirmations, or missing essential target facts are structured blockers.
- Use bounded read-only subagents for planning, inventory review, docs lookup,
  ticket triage, and independent review when useful.
- After consolidating useful results from a completed subagent, close that agent
  thread so stale agents do not exhaust the thread cap.

## Risk classes

- Green: read-only/local planning, no customer impact.
- Yellow: reversible operational change, possible service impact.
- Red: privileged, destructive, customer-visible, security-sensitive, data-impacting, or hard to roll back.

## Required root checks

Before these actions, verify the trusted target, objective scope, expected impact,
rollback/abort condition, and post-change check, then proceed without a second
operator prompt:

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
