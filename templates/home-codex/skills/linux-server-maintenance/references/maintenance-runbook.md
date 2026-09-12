# Maintenance Runbook

Use actual project runbooks and commands. This reference defines packet structure and observed local ownership, not a universal Linux command list.

## Local source ownership observed

- `wow-ai` project operations: inventory/runbooks/evidence under `/home/jeff/projects/wow-ai`; its inventory is scoped only to assets mapped by that repo.
- `app-host` versioned deployment and monitoring contracts: `/home/jeff/projects/linux/contracts/`.
- `app-host` durable operational notes: `/mnt/media5tb/AI/Obsidian/docs/app-host`; repository pointer documents must not become competing copies.
- Terraform/OpenTofu desired state: `/home/jeff/projects/portfolio/iac`, using the IaC workflow rather than ad hoc host edits.

No checked-in Ansible source was found in the inspected canonical operations projects. Do not infer that absence means configuration is manually owned; verify each setting.

## Preflight baseline

Before a change packet can pass:

- trusted target mapping resolves exactly once;
- the assigned objective covers the exact operation;
- target identity is rechecked;
- relevant source of truth is named;
- minimum before-state and application-level health evidence are captured;
- backup/snapshot existence and restore relevance are checked when the change could need them;
- rollback mechanics, prerequisites, and access are technically feasible;
- maintenance window and expected interruption are explicit when applicable;
- abort conditions and evidence location are ready;
- secret-safe collection/redaction is defined.

## Change packet

Record:

1. exact target and management source;
2. exact procedure/commands;
3. expected effect and preserved behavior;
4. preconditions;
5. backup/snapshot evidence;
6. rollback steps and feasibility result;
7. before/after verification;
8. abort conditions;
9. estimated impact/downtime;
10. execution owner and verification owner;
11. follow-up source reconciliation, if break-glass.

## Canary and stop behavior

For multiple equivalent hosts, choose one least-risky canary and state why. Complete its after-checks before continuing. A simulated or real canary failure stops the packet; remaining hosts stay untouched until evidence supports a revised plan within the objective.

Stop immediately on identity mismatch, unexpected privilege requirement, ownership/permission mismatch, partial change, failed health check, lost access, secret exposure, missing backup/rollback prerequisite, or scope expansion.

## Local failure-history lessons

- A prior broad scheduled-task read exposed an unrelated bearer credential in internal output. Query only known non-secret lines or redact before output; never collect entire cron/task environments as generic evidence.
- A prior cleanup packet stopped when file ownership prevented an approved removal. Treat ownership/privilege checks as preconditions and never continue across the remaining manifest after failure.
- Destructive retention removed old recovery points that could not be recreated. Such work is `DATA_OR_DESTRUCTIVE`, not reversible, even when the deletion procedure itself is bounded.
- Container/process state alone did not replace route, monitoring, and application-level checks. Verification must match the requested behavior.

## Objective closeout gate

`RESOLVED` requires the requested behavior and every mandatory after-check to pass, impact to be recorded, rollback state known, and remaining drift assigned. Otherwise use the applicable escalation/blocker status and state what remains unverified.
