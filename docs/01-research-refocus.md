# 01 — Research Refocus: What Matters for This Local Team


## Source notes used for this refactor

This package is designed for Codex CLI local work, not for cross-vendor portability. The design uses these current facts:

- OpenAI documents Codex CLI as a local terminal coding agent that can inspect, edit, and run code in the selected directory: https://developers.openai.com/codex/cli
- Codex reads `AGENTS.md` from global and project scopes before work starts: https://developers.openai.com/codex/guides/agents-md
- Codex subagents can be spawned for parallel exploration, implementation plans, and reviews. Codex's product default is explicit user prompting; this package records standing user authorization for default subagent use on non-trivial parallelizable work. Codex supports custom agents with fields such as `name`, `description`, `developer_instructions`, `model`, `model_reasoning_effort`, and `sandbox_mode`: https://developers.openai.com/codex/subagents
- Codex sandboxing and approval policy are separate controls. Local defaults are intended to allow workspace edits while asking for approval before crossing boundaries or using network access: https://developers.openai.com/codex/agent-approvals-security and https://developers.openai.com/codex/concepts/sandboxing
- Codex skills are `SKILL.md` folders with optional scripts/references/assets and are loaded through progressive disclosure: https://developers.openai.com/codex/skills
- Codex hooks can run deterministic scripts on lifecycle events such as `PreToolUse`, `PermissionRequest`, `PostToolUse`, `SubagentStart`, and `Stop`: https://developers.openai.com/codex/hooks
- Codex rules can require prompts or forbid commands outside the sandbox via `.rules` files: https://developers.openai.com/codex/rules
- Anthropic described Claude Fable 5 as built for demanding reasoning and long-horizon agentic work, and documented task budgets, tool use, fallback behavior, and large context support: https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5
- Anthropic later stated that access to Fable 5 and Mythos 5 was disabled for all customers to comply with a June 12, 2026 U.S. government directive: https://www.anthropic.com/news/fable-mythos-access
- Simon Willison's June 11, 2026 field report describes Fable as highly proactive, useful, and potentially expensive/risky if given broad tool access without strong boundaries: https://simonwillison.net/2026/Jun/11/fable-is-relentlessly-proactive/
- Simon Willison's parallel-agent workflow notes emphasize scouts, architect/planner separation, and the review bottleneck: https://simonwillison.net/2025/Oct/5/parallel-coding-agents/
- GitLab's June 2026 write-up on Fable emphasized long-horizon workflows, verification loops, incident investigation, and parallel sub-agent reliability, while also noting Fable's suspension: https://about.gitlab.com/blog/mythos-class-claude-fable-5-on-gitlab/


## Design conclusion

The earlier portability layer is unnecessary for the way you are actually working. You do not need a vendor-neutral agent platform right now. You need a **local operating system for Codex CLI** that gives you better leverage without making production/server/customer work reckless.

Codex already provides the primitives:

- **Instructions:** `AGENTS.md` at global and project scopes.
- **Roles:** custom agents in `~/.codex/agents` and `.codex/agents`.
- **Parallelism:** standing-authorized subagent use for safe parallel work.
- **Safety:** sandbox mode, approval policy, rules, and hooks.
- **Reusable process:** skills under `~/.agents/skills` or repo-local `.agents/skills`.
- **Deterministic validation:** test commands, scripts, hooks, linting, health checks, and evidence files.

The refactor therefore optimizes for:

1. Local speed.
2. Repeatable Codex prompts.
3. Explicit boundaries for infrastructure/customer work.
4. Small files Codex can consume predictably.
5. A workflow you can use daily without building a platform first.

## What to copy from Fable-style workflows

The useful Fable pattern is not a specific model dependency. It is this sequence:

```text
1. Understand the goal.
2. Build a plan before changing anything.
3. Fan out read-only scouts or specialists.
4. Let the main agent consolidate findings.
5. Execute bounded work packets.
6. Run deterministic checks.
7. Run independent review.
8. Stop at human approval gates for risky work.
9. Record evidence.
```

Fable's perceived strength was long-horizon goal pursuit and proactivity. That is valuable for codebase exploration, debugging, incident analysis, and complex migrations. It is dangerous when paired with broad local/production tool access. Simon Willison's field report is the practical warning: a proactive model can invent elaborate debugging approaches, use GUI/browser/screenshot tools without being directly asked, and spend material cost while chasing a goal. For your local production team, that means:

- Define the goal tightly.
- Define tool boundaries tightly.
- Use read-only scouts first.
- Require checks and evidence.
- Keep `danger-full-access` out of normal workflows.
- Make production/customer-affecting changes human-gated.

## What to avoid

Do not start with a fully autonomous MSP agent that reads tickets, logs into customer systems, changes DNS/firewalls/servers, and sends customer mail. That is too much blast radius.

Do not let multiple write-capable agents modify the same repo concurrently unless they are in separate worktrees and the file ownership is clear.

Do not let Codex run arbitrary SSH + `sudo` commands during exploratory sessions.

Do not store customer secrets, SSH keys, API tokens, passwords, recovery codes, or private keys in the local ops repo.

## How this maps to your work

You are the principal engineer, reviewer, customer authority, and change approver. Codex supplies:

- Parallel codebase scouts.
- Implementation workers.
- Test writers.
- Reviewers.
- Infra recon assistants.
- Maintenance planners.
- Customer-ticket triagers.
- Documentation and evidence scribes.

This is not replacing you. It is converting your work into a repeatable production line.
