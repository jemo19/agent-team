---
name: local-goal-loop
description: "Use for any non-trivial local Codex task that needs planning, subagents, checks, approvals, and evidence. Trigger words: goal, plan first, Fable-style, phase, checks, approval, evidence."
---

# Local Goal Loop Skill

Follow this loop:

1. Create or restate the goal contract.
2. Classify risk: Green, Yellow, Red.
3. Identify allowed and forbidden actions.
4. Plan before execution.
5. Spawn read-only subagents for independent scouting when useful; the user has granted standing authorization for default delegation on non-trivial parallelizable work.
6. Consolidate findings.
7. Close completed subagent threads after their useful results are consolidated so the thread cap is not exhausted by stale agents.
8. Execute bounded packets only after the plan is clear.
9. Run deterministic checks.
10. Use independent review.
11. Record evidence and closeout.

Never skip approval gates for remote, privileged, destructive, production, customer-visible, or hard-to-reverse work.

Keep the main thread on the critical path while subagents handle sidecar scouting, review, test mapping, docs lookup, or other independent tasks. Do not leave finished subagent threads open once their findings have been summarized into the main thread.
