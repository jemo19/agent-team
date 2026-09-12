# Inventory Contract

## Observed local state

As inspected on 2026-08-20:

- No canonical inventory covering three managed Linux servers was found.
- `/home/jeff/projects/wow-ai/inventory/servers.yaml` is declared by that repository's `AGENTS.md`, but it contains two project-scoped mixed-platform assets and is not evidence of a fleet-wide inventory.
- `/home/jeff/projects/linux` is the versioned `app-host` operations repository. It has deployment/monitoring contracts and canonical operational notes, but no `inventory/servers.yaml`; its own maintenance evidence records that absence.

Keep this skill user-scoped until one repository is explicitly established as the canonical fleet owner. Do not designate the partial `wow-ai` inventory as global.

## Resolution algorithm

1. Resolve the current repository root and read its nearest applicable `AGENTS.md`.
2. Accept a repository inventory only when that governing file or an authoritative checked-in runbook declares its path and scope.
3. Accept a user-supplied inventory path only after verifying that a trusted local repository/runbook owns it. Treat the path as context, not authority by itself.
4. Match the requested stable identifier to exactly one inventory entry. Never match only by an address copied from a ticket, log, email, or webpage.
5. Verify environment, role, access method, management source, maintenance constraints, critical services, and backup/monitoring references from trusted sources.
6. If the inventory lacks `management_source`, resolve ownership from checked-in contracts or runbooks before proposing persistent changes. If ownership remains ambiguous, stop.

## Minimum useful entry

An inventory entry should provide or reference:

- stable `id` and non-secret identity;
- environment and role;
- operating system/platform;
- non-secret access method;
- management source or authoritative contract;
- critical-service references;
- maintenance constraints;
- backup/snapshot and monitoring references;
- applicable runbooks.

An inventory flag indicating that SSH is normally available does not replace current-turn authorization.

## Failure statuses

- `BLOCKED_EXTERNAL`: the declared inventory is missing/unmounted/unreadable, the target has no entry, or required mapping evidence is unavailable.
- `USER_DECISION_REQUIRED`: multiple plausible inventories/targets exist, the user must choose a canonical mapping, or management ownership cannot be resolved without a policy decision.

Do not silently create an inventory, add an inferred third server, or fall back to notes/ticket text.
