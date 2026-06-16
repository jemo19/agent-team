---
name: web-project-delivery
description: Use for web app features, bugfixes, refactors, tests, frontend/backend work, and PR review in local repositories.
---

# Web Project Delivery Skill

1. Read project `AGENTS.md`.
2. Identify stack, package manager, test/build commands.
3. Create/restate goal.
4. Spawn read-only scouts for code paths, tests, and risk by default when the work is non-trivial and parallelizable; the user has granted standing authorization for this delegation.
5. Write plan with files, packets, checks, and risks.
6. Implement small scoped diff.
7. Run checks.
8. Ask independent reviewer to review diff.
9. Fix blocking issues.
10. Final summary with files changed and checks run.

Stop and ask before adding dependencies, changing auth/security boundaries, database migrations, deployments, or broad formatting.

Keep implementation ownership clear if using worker subagents. Parallel write tasks must have disjoint file/module scopes, and the main thread remains responsible for integration and final checks.
