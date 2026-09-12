# Plan Review Checklist

## Identity

- CLI name/version and exact stack directory
- Git commit and dirty-worktree summary
- backend type and state identifier, without secret configuration
- selected workspace/environment
- variable files and other value sources by identity, not raw values
- provider/module lock selections
- refresh and lock behavior
- saved-plan path, permissions, creation time, retention, and checksum when used

An artifact is not reusable when commit, stack, backend, workspace, variable sources, CLI compatibility, provider selections, or relevant state has changed.

## Change review

Report a redacted summary of:

- add/change/destroy counts
- every delete and replacement
- unknown values that affect behavior or reviewability
- dependency-sensitive ordering and availability risk
- IAM/authorization or trust-boundary changes
- network/firewall and DNS changes
- databases, storage, encryption, secrets, or data-integrity changes
- provider/module/lockfile changes
- unexpected resources and drift unrelated to the request
- expected downtime, rollback/forward-fix, and application-level verification

The pass condition is: the plan matches the requested desired state and recorded identity, contains no unexplained change or unrelated drift, and has feasible verification/recovery. A successful exit status alone does not pass.

## Apply handoff

State whether the artifact is speculative or intended for apply. If the objective includes apply, verify that it covers the exact environment and reviewed artifact, then apply without a second interactive approval prompt.
