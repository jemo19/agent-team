# Local Agentic Production Team for Codex CLI

Agent Team is a local-first operating framework for using Codex CLI like a
small production team. It is designed around practical local workflows rather
than a vendor-neutral agent platform:

- one human operator;
- Codex CLI as the primary interface;
- role-routed model effort instead of using maximum reasoning everywhere;
- multiple local web application repositories;
- Linux/server operations with approval gates;
- MSP-style ticket, maintenance, documentation, triage, and closeout workflows.

The design goal is a **local production team**: a practical Codex-driven
operating system for doing more work safely, faster, and with less context loss.

## The core pattern

Use a Fable-inspired loop, implemented in Codex:

```text
GOAL -> PLAN -> INVOKE SUBAGENTS -> EXECUTE -> CHECK -> REVIEW -> HUMAN GATE -> RECORD EVIDENCE
```

The important lesson from Fable is not “use Claude Fable.” The lesson is the operating pattern: give the model a clear goal, explicit boundaries, a real plan, delegated subgoals, deterministic checks, and permission gates. Codex already has the pieces needed for this locally: `AGENTS.md`, custom agents, subagents, skills, hooks, sandboxing, rules, and approval policy.

## Package layout

```text
local-agentic-production-team/
  README.md
  START_HERE.md
  BUILD_WITH_CODEX.md
  docs/
    01-research-refocus.md
    02-local-architecture.md
    03-fable-style-goal-loop.md
    04-codex-local-configuration.md
    05-web-project-team.md
    06-local-infra-team.md
    07-msp-operations-team.md
    08-checks-and-gates.md
    09-security-and-approval-model.md
    10-runbooks.md
    11-build-phases.md
    12-copy-paste-prompts.md
    14-project-and-infra-team-map.md
    15-current-state.md
  templates/
    home-codex/              # files intended for ~/.codex and ~/.agents
    web-project/             # files to copy into each web project repo
    ops-control/             # local infra + MSP control repo template
```

## Public and Private Boundaries

This public repository contains reusable framework material: docs, templates,
agent definitions, skill templates, runbooks, and validation scripts.

Keep exact local state out of public Git history:

- real server names, internal IPs, Tailscale IPs, and SSH aliases;
- real customer names, tickets, and system inventories;
- private repository names that should not be public;
- credential references, password-manager item names, `.env` files, Terraform
  state, plan files, tokens, and keys.

Use ignored local files for private state. The repo ignores `private/`,
`*.private.md`, and `*.private.yaml`.

Recommended local-only files:

```text
private/current-state.private.md
private/project-map.private.md
private/servers.private.yaml
private/projects.private.yaml
```

## The local repos this framework expects

Public current state is tracked in `docs/15-current-state.md`. Exact local
project, server, and customer maps should live in ignored private files or a
separate private ops repo.

Create three durable areas on your workstation:

```text
~/agentic-team/
  README.md
  local-ops/                 # three Linux servers + MSP control repo
  web-project-template/      # optional template copied into each project
  shared-prompts/            # prompt snippets and goal templates

~/projects/
  project-a/
  project-b/
  project-c/

~/.codex/
  AGENTS.md
  config.toml
  agents/*.toml
  rules/agent-team.rules

~/.agents/skills/
  local-goal-loop/SKILL.md
  web-project-delivery/SKILL.md
  linux-server-maintenance/SKILL.md
  infrastructure-as-code-ops/SKILL.md
  msp-ticket-ops/SKILL.md
```

## Roles

There are three operating teams:

1. **Web Project Team** — builds, debugs, tests, reviews, and ships web apps.
2. **Local Infra Team** — inventories, observes, patches, and manages your three Linux servers.
3. **MSP Operations Team** — handles customer requests, maintenance windows, documentation, risk classification, verification, and customer-ready summaries.

The human operator remains the owner and change authority. Agents can
investigate, draft, propose, implement in local repos, test, and produce
evidence. They should not perform privileged production or customer-impacting
changes without explicit human approval.

## Fast start

Read these in order:

1. `START_HERE.md`
2. `BUILD_WITH_CODEX.md`
3. `docs/03-fable-style-goal-loop.md`
4. `docs/04-codex-local-configuration.md`
5. `docs/05-web-project-team.md`
6. `docs/06-local-infra-team.md`
7. `docs/07-msp-operations-team.md`
8. `docs/14-project-and-infra-team-map.md`
9. `docs/15-current-state.md`

Then copy templates:

```bash
mkdir -p ~/agentic-team
cp -R templates/ops-control ~/agentic-team/local-ops
mkdir -p ~/.codex ~/.codex/agents ~/.codex/rules ~/.agents/skills
cp templates/home-codex/AGENTS.md ~/.codex/AGENTS.md
cp templates/home-codex/config.toml ~/.codex/config.toml
cp templates/home-codex/rules/default.rules ~/.codex/rules/agent-team.rules
cp templates/home-codex/agents/*.toml ~/.codex/agents/
cp -R templates/home-codex/skills/* ~/.agents/skills/
```

`templates/home-codex/rules/default.rules` is the source template. The current
installed rules file is `~/.codex/rules/agent-team.rules`.

Do not blindly copy the sample config over an existing `~/.codex/config.toml` without backing it up.

## First useful Codex prompt

Open Codex in `~/agentic-team/local-ops` and run:

The prompt names subagents directly as an example, but the installed global instructions already grant standing authorization for useful read-only subagents on non-trivial work.

```text
Read AGENTS.md and goals/GOAL_TEMPLATE.md. Do not run SSH or make changes yet.
Create a first-pass local production team inventory plan for my three Linux servers and MSP operations. Use the Fable-style loop: define the goal contract, spawn read-only scout subagents for docs/inventory/checklist review, then consolidate a safe phase plan. Stop before any remote command.
```
