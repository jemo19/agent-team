---
name: web-project-delivery
description: "Implement a local web feature, bug fix, or bounded refactor. Excludes trivial edits, standalone review, planning-only work, and deployment-only tasks."
---

# Web Project Delivery

Deliver the requested behavior through the existing owning code and verify the affected flow. Keep the diff scoped and preserve unrelated work. This skill supplies web-specific checks; it does not require a separate plan, scout, builder, and reviewer for every task.

## Ownership and implementation

Read applicable project instructions; identify the package manager, lockfile and required checks. Find the nearest analogous feature or trace the failing path before editing. Use a reproduction, failing test, browser/console evidence or exact code-path evidence for bugs; use observable baseline behavior for refactors.

Trace only affected UI, state, API, validation, data and asynchronous boundaries. Consult [change surfaces](references/change-surface-checklist.md) for changes spanning multiple boundaries. Make the smallest coherent diff. Add a dependency only when justified by the objective and update its lockfile. Do not replace libraries by preference, hide errors, blindly accept snapshots or weaken assertions.

Use one writer per overlapping scope. Root may request a scout when ownership is materially ambiguous and separate exploration helps. A delegated `web_builder` or `web_builder_high` inherits `FULL_ACCESS_BY_DESIGN` within its write packet: it never spawns children, invokes `local-goal-loop`, or performs independent review. Return cross-role questions, stale packet contradictions and external blockers to root with evidence.

## Verification and review

Use [the verification matrix](references/verification-matrix.md) for the affected surfaces; run required repository checks and relevant regression tests. Cover affected API validation, authorization, success/error behavior and compatibility. For UI changes, use a real browser when tools are available and the app can run safely; inspect affected loading, empty, success, error and responsive states, plus relevant console/network evidence. Do not claim visual verification from code alone.

For bugs, verify the original failure is resolved or demonstrate a regression test failing before and passing after. Rerun checks when relevant inputs change, prior evidence is stale, failure remains or the task requires fresh evidence. Do not add unrelated checks solely for ceremony.

Self-review bounded changes. Retain independent review for auth/security, tenant isolation, data integrity, migrations, public contracts, broad or consequential multi-module changes, significant failed attempts, or an explicit task requirement. Give the reviewer acceptance criteria, relevant diff and checks; separate blocking findings from optional improvements.

Generating migration source or a successful local build does not prove a database apply or production deployment. Execute those effects only when included in the objective, with exact target and recovery evidence through the owning workflow; do not request another routine confirmation.

Report behavior, changed files, checks run/not run, browser evidence, risks and external blockers. Do not mark unverified required work complete. Use [the report template](assets/final-report-template.md) only when a structured handoff helps.
