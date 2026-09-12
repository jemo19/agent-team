# State Surgery Runbook

Use only for imports, binding corrections, moves/removals, provider replacement, pushes, backend migration, or other state persistence. Prefer correct configuration and ordinary planning over surgery.

## Preconditions

1. Identify executable/version, stack, backend, workspace, credentials policy, current commit, and exact state generation/serial when the backend exposes it safely.
2. Prove no concurrent run or foreign lock exists.
3. Obtain a backend-supported backup/snapshot and verify that recovery is technically available. A local copy is not automatically sufficient for every backend.
4. Record exact configuration address and remote object identity without exposing sensitive attributes.
5. Describe current binding, expected binding after the operation, dependent resources, and the failure mode being corrected.
6. Define exact recovery and post-operation plan checks.

Missing backup, uncertain identity, active lock, or ambiguous ownership is a stop condition.

## Execution boundary

- Configuration-driven import declarations are source changes until a plan/apply workflow persists them; confirm CLI support.
- CLI import generally writes state immediately and is `STATE_MUTATION`.
- State list/show/pull are `STATE_READ`: do not persist or paste raw output.
- Move, remove, push, replace-provider, backend migration, and refresh-only apply are `STATE_MUTATION`.

Execute one reviewed operation at a time. Never use state surgery to conceal configuration drift or bypass the resource graph.

## Verification

Confirm the intended binding, then run an appropriately authorized plan and reject unexplained changes. Verify dependent resources and application behavior where relevant. Record only redacted evidence, backup identity, result, recovery status, and any remaining manual reconciliation.
