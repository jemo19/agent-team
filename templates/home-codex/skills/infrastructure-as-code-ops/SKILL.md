---
name: infrastructure-as-code-ops
description: "Plan, edit, validate, review, and apply objective-authorized Terraform/OpenTofu changes with correct workspace/backend selection, sensitive plan/state handling, drift review, state-safety gates, and post-change verification. Do not use for generic Linux service maintenance or unrelated application code."
---

# Infrastructure as Code Operations

Use the nearest `AGENTS.md` and repository runbooks as governing context. The assigned objective supplies authority for its in-scope IaC work; this skill structures execution without widening that scope.

**Child-role guard:** When loaded by standing `iac_planner`, inherit `FULL_ACCESS_BY_DESIGN` while remaining read-only and planning-only. Inspect local sources, identify source/state/backend/workspace dependencies and hazards, and return proposed patches or commands; actual mutation belongs to the root or assigned writer. Do not execute init/plan/apply/import/state operations, invoke `local-goal-loop`, dispatch children, select another role, or expand scope. Return implementation needs, questions, and provider or external blockers to root with evidence. The role boundary coordinates work; it is not sandbox isolation.

## 1. Establish the operation contract

Record the requested outcome, whether implementation or plan-only was requested, exact stack, environment, backend, state location, workspace, variable sources, CLI and version, provider/module versions, lockfile, credential policy, current commit/worktree, CI checks, and any active run or lock. Derive these from trusted files and tooling; never guess environment or workspace from a directory name.

Classify every proposed action using [the operation risk matrix](references/operation-risk-matrix.md). The objective may include local HCL editing, initialization, remote planning, state operations, and infrastructure mutation together or separately. Do not invent a second approval gate for an included stage.

If the request is host package, service, filesystem, Docker, or OS maintenance rather than IaC desired state, route it to `$linux-server-maintenance`.

## 2. Discover safely

Before editing or executing, inspect only the minimum necessary source, lockfiles, CI, and documented context. Do not read or print credentials, real state, saved plans, raw plan/state JSON, credential-bearing variable files, or backend secrets.

Determine whether the requested setting belongs to Terraform/OpenTofu, another configuration system, or manual operations. Preserve unrelated working-tree changes. If stack, backend, workspace, variable identity, or objective scope cannot be established from trusted evidence, return the unresolved fact to root; stop only for a genuine `BLOCKED_EXTERNAL` or operator-owned decision.

## 3. Define desired state and the smallest change

State current managed behavior, desired behavior, affected resource addresses, expected adds/changes/deletes/replacements, dependencies, compatibility, rollback or forward-fix strategy, and verification. Make the smallest coherent HCL/documentation change.

Do not use `-target` routinely. An exceptional targeted operation must explain why the full graph is unsuitable and what consistency risk remains. A reviewed saved plan or noninteractive `-auto-approve` is allowed when the objective includes apply and identity, drift, recovery, and verification gates pass.

## 4. Initialize and validate by class

Before `init`, determine whether it downloads providers/modules, changes `.terraform`, writes the dependency lockfile, accesses a backend, needs credentials, or reconfigures/migrates backend state. Run the required mode when it is inside the objective. Treat `-upgrade`, `-reconfigure`, changed backend parameters, and backend migration as distinct reviewed effects within the same objective.

Run project-provided checks with the installed CLI/version. `fmt -check` may be `LOCAL_STATIC`; `validate` is only local-static when its prerequisites already exist and it requires no initialization or remote access. Categorize lint, security, module, and policy checks by their actual behavior. Install a justified missing tool when required by the objective and report it. Review lockfile changes as source changes.

## 5. Plan and review

Before a remote read or plan, verify exact stack, backend, workspace, variable sources, refresh and locking behavior, credentials, target environment, artifact policy, and whether another run is active. Planning may read providers, refresh state, acquire a lock, and expose sensitive data; it is not zero-risk.

Use [the plan-review checklist](references/plan-review-checklist.md). Reject a plan with unexplained destroys, replacements, unrelated drift, identity mismatch, or unexpected high-impact changes even when the command succeeds.

When a saved plan is justified, protect it, bind it to commit/workspace/backend/variables/CLI/timestamp, and set bounded retention. When the objective includes apply, apply the exact reviewed artifact without asking again; reject stale or mismatched artifacts. Execute one stack at a time.

## 6. Handle state deliberately

State reads and state mutations are different operation classes, but both can expose sensitive values. Never treat `show -json`, state pull/show, or machine-readable output as casual evidence.

For imports or state surgery, read [the state-surgery runbook](references/state-surgery-runbook.md). Require a verified backend-supported backup/snapshot, exact resource and remote-object identity, no concurrent run, expected before/after bindings, recovery steps, dependent-resource review, one operation at a time, and a resulting plan. Configuration-driven import support is version-dependent; distinguish it from CLI operations that immediately write state.

## 7. Protect artifacts

Follow [the sensitive-artifact policy](references/sensitive-artifact-policy.md). State and saved plans may contain sensitive values. `sensitive` commonly redacts display; it does not guarantee encryption or omission. Prefer supported ephemeral values, write-only arguments, or secret-manager references only after confirming installed CLI/provider support.

Never commit state, plan files, raw plan/state JSON, credential-bearing variable or environment files, raw environment dumps, or credential-bearing backend configuration. Do not paste raw backend configuration into chat or tickets. Keep summaries redacted and artifacts access-controlled with bounded retention.

## 8. Mutation, stop conditions, and verification

Apply, destroy, replacement, import/state mutation, backend migration, provider credential changes, and high-impact domains require exact environment identity, an objective that includes the effect, and a reviewed operation. They do not require another local confirmation. Stop on identity mismatch, unexpected lock, new drift, unexpected destroy/replacement, missing backup, failed precondition, scope expansion, or provider/API failure that leaves state uncertain.

After an authorized mutation, verify the apply/state result, resource or service behavior, monitoring and availability, data integrity where relevant, configuration persistence, and a follow-up plan/drift check. Record artifact identity and manual reconciliation. Command completion alone is not success.

Close with [the closeout template](references/closeout-template.md) and one status: `RESOLVED`, `ESCALATION_REQUIRED`, `BLOCKED_EXTERNAL`, or `USER_DECISION_REQUIRED`. Do not escalate model capability for credentials, inaccessible backends, foreign locks, unavailable providers, or genuinely operator-owned environment choices. Do not start login flows or wait for interactive input; continue independent work before returning the blocker to root.
