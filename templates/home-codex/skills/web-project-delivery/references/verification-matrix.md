# Verification Matrix

Select checks from repository-defined commands and installed tooling. Do not invent commands, install tools, or treat one surface's check as proof of another.

| Changed surface | Smallest useful proof | Broader proof when warranted | Do not claim |
|---|---|---|---|
| Pure logic | targeted unit test with boundary cases | package test/typecheck | runtime/UI behavior from unit tests alone |
| API/server action | handler/service test for success, validation, error, and authorization | contract/integration test, typecheck | browser success without checking the request/response contract |
| UI rendering/state | component test or safe local reproduction | real-browser flow, console and relevant network inspection, responsive states | visual success from code inspection |
| Cross-layer UI/API/data | one check per changed boundary plus end-to-end happy/error flow | package build and existing E2E | full success when one layer was untested |
| Bug regression | failing reproduction or regression test before; pass after | adjacent suite and typecheck | fixed solely because implementation looks plausible |
| Refactor | unchanged characterization tests and public types | package suite/build | behavior preservation without a baseline |
| Schema/migration source | schema validation, generated diff inspection, migration test against an authorized disposable database | application integration tests | that any real database was migrated |
| Auth/tenant boundary | deny/allow tests for ownership and role cases | security review and E2E | safety from happy-path tests only |
| Cache/job/integration | deterministic adapter/worker tests including failure/retry/invalidation | authorized integration test | external service correctness without observable evidence |

## Browser path

When UI behavior changed and a safe local app is runnable:

1. Follow the installed Browser skill rather than duplicating its setup here.
2. Reproduce the target state in a real browser.
3. Inspect the rendered result plus relevant console and network evidence.
4. Exercise affected loading, empty, success, and error states.
5. Check responsive behavior when layout changed.

If browser tooling or a safe runtime is unavailable, record the exact missing prerequisite and limit the completion claim.

## Database boundary

Creating or editing schema/migration files, generating migration artifacts, and validating them against an explicitly disposable local database are local verification activities only when repository policy and user scope allow them. Applying migrations to shared, remote, staging, production, customer, or otherwise real environments is a separate external action. Record the intended target and obtain authorization before that action.
