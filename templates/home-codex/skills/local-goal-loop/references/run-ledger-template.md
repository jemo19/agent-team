# Run Ledger: <task slug>

Use this template only when the work is long-running enough to require persistent resume state. Prefer an existing repository convention and keep a single ledger.

## Recovery snapshot

- Last updated:
- Current revision or recorded snapshot:
- Workspace status:
- Active root/child ownership:
- Running children and local processes:
- Shared resources in use:
- Outstanding external actions:
- Last completed action and evidence:
- Safe next action:
- Replay check: confirm the last action did not already complete before continuing.

## Goal and Definition of Done

- Outcome:
- In scope:
- Out of scope:
- Definition of Done:
- Verification method:

## Constraints and authority

- User-authorized actions:
- Source of authorization:
- Environment and sandbox boundaries:
- Objective authority and external blockers:
- Sensitive-data exclusions:
- Rollback prerequisites:

## Stage map

| # | Stage / artifact | Owner | Inputs | Failable pass condition | Check or evidence | Invalidates if changed | Status |
|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  | Pending |

Allowed stage status values: `Pending`, `In progress`, `Passed`, `Failed`, `Blocked`.

## Decisions

| Date/time | Decision | Evidence and rationale | Downstream impact |
|---|---|---|---|
|  |  |  |  |

## Checks and evidence

| Stage | Command, comparison, or observation | Result / exit status | Artifact or evidence location |
|---|---|---|---|
|  |  |  |  |

## Failed attempts and eliminated hypotheses

| Stage | Attempt or hypothesis | New evidence | Why eliminated | Repair count |
|---|---|---|---|---|
|  |  |  |  | 0 |

## Blockers

- Status: `RESOLVED` / `ESCALATION_REQUIRED` / `BLOCKED_EXTERNAL` / `USER_DECISION_REQUIRED`
- Blocking condition:
- Required external change or decision:

## Next action

- Next bounded stage or stop condition:
- Targeted repair count:
- Upward promotion count:
- Active escalation agent, if any:

## Resume instructions

1. Re-read this ledger and governing `AGENTS.md` files.
2. Confirm the active native goal and plan still match this ledger.
3. Re-establish the current revision/snapshot, workspace status, active ownership, running children/processes, shared resources, outstanding external actions, and volatile evidence.
4. Verify the last recorded action did not already complete.
5. Continue only from the recorded safe next action; do not replay a completed action or repeat a failed attempt without new evidence.
