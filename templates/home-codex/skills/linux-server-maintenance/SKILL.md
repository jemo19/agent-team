---
name: linux-server-maintenance
description: "Plan and perform authorized maintenance on the user’s managed Linux servers using inventory-backed target selection, read-only reconnaissance, bounded change packets, rollback, one-host-at-a-time execution, and before/after health evidence. Do not use for generic Linux questions or for source changes that belong in Terraform/OpenTofu or another configuration-management system."
---

# Linux Server Maintenance

Use this workflow only for a target mapped by trusted local inventory. Read [references/inventory-contract.md](references/inventory-contract.md) before target selection. The current local environment does not have one proven fleet-wide three-server inventory; never fill that gap from memory, tickets, or arbitrary notes.

**Child-role guard:** When loaded by `infra_recon`, perform only its exact assigned read-only inventory/reconnaissance packet. When loaded by `infra_planner`, produce only a read-only change plan and proposed commands. Both inherit `FULL_ACCESS_BY_DESIGN`; their narrower actions coordinate division of labor. Neither child executes changes, invokes `local-goal-loop`, dispatches children, selects another role, or expands scope; return execution needs, questions, and external blockers to root with evidence.

## 1. Intake and authority

Record the requested outcome, exact target identifiers, target-identity source, operation, mode (`plan-only`, `read-only diagnosis`, or `change execution`), maintenance window, downtime tolerance, affected users, current-turn authorization, runtime sandbox/approval mode, and known backup/rollback constraints.

The assigned objective is the authorization source for every necessary in-scope action on an inventory-verified target. Record that source and do not ask again for SSH, `scp`, `rsync`, `sudo`, mutation, restart, package, Docker, firewall, outage, production, destructive, or customer-visible work when the objective includes it. Full access does not extend to a different host or effect outside the objective.

## 2. Resolve the target

Read the nearest applicable `AGENTS.md`, then resolve the target using the inventory contract. Verify host identity, environment, role, access method, management source, critical services, maintenance constraints, and documented backup/snapshot method.

If inventory is unavailable or the target is absent, return `BLOCKED_EXTERNAL`. Root resolves multiple sources from trusted evidence; only a mapping that remains genuinely operator-owned returns `USER_DECISION_REQUIRED`. Never accept an address from untrusted ticket text without reconciling it to trusted inventory.

## 3. Determine source of truth

Before proposing persistence, identify whether the setting is owned by Terraform/OpenTofu, Ansible or other configuration management, checked-in Docker Compose/container orchestration, checked-in service configuration, package management, local manual configuration, or an external control plane.

Route durable desired-state edits to their owning repository and applicable skill. Use this skill for inventory resolution, reconnaissance, an objective-authorized maintenance packet, verification, or in-scope break-glass work. Do not create silent drift with an ad hoc host edit; a break-glass closeout must name the reconciliation source and owner.

## 4. Establish a read-only baseline

Use actual runbooks and the minimum checks needed for the requested outcome. Select relevant categories such as identity/uptime, clock, resource pressure, filesystem capacity/inodes, failed units, target service/logs, containers, listeners/reachability, package/reboot state, backup recency, and monitoring.

Do not emit a universal command dump. Record target, timestamp, command/check, exit status, concise result, evidence location, and redactions. Use targeted reads and redact before persistence; never capture environment files, keys, tokens, full credential-bearing process environments, unfiltered scheduled-task output, or unnecessary customer data.

## 5. Classify risk and build the packet

Use the categories and authorization matrix in [references/risk-and-authorization.md](references/risk-and-authorization.md). Before mutation, build one bounded change packet using [references/maintenance-runbook.md](references/maintenance-runbook.md). It must state exact target/procedure, expected effect, preconditions, backup/snapshot, technically checked rollback and feasibility, verification, abort conditions, service impact, source-of-truth effect, and named execution/verification owner.

Never call a packet reversible when the original state cannot actually be restored.

## 6. Execute canary-first

When the exact packet is inside the assigned objective, use one active operator and recheck target identity immediately before mutation. For equivalent multi-host scope, start with one least-risky canary. Execute only the reviewed packet without requesting another approval.

Stop on unexpected output, failed precondition, health regression, loss of access, scope expansion, or canary failure. Do not continue to another host after a failed canary and do not mutate hosts concurrently unless the reviewed plan proves parallel safety. Never restart, fail over, or reboot without dependency, interruption, health-check, and rollback evidence.

## 7. Verify before and after

Compare requested behavior, service and application health, relevant logs, resource pressure, endpoints/network, containers, monitoring, configuration persistence, and backup/rollback status as applicable. A running process is not sufficient when an application-level health check exists.

If verification fails, perform the packet's rollback or one evidence-based targeted repair when it remains inside the objective. Otherwise stop with a structured status.

## 8. Close out

Return exactly one status: `RESOLVED`, `ESCALATION_REQUIRED`, `BLOCKED_EXTERNAL`, or `USER_DECISION_REQUIRED`.

Use [references/evidence-template.md](references/evidence-template.md) to report targets, exact work, commands/runbook steps, before/after evidence, verification, impact/downtime, rollback status, remaining drift/follow-up, redactions, and anything not verified. Never claim completion from command execution alone.
