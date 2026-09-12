# Local Agentic Production Team for Codex CLI

## September 12 Astra maintenance

The active baseline is Astra Low at Standard speed for bounded work, with
`root-medium` for ambiguity and `root-high` for consequential reasoning. The
spawned-worker cap is two, excluding the primary. Existing named Sol/Luna/Astra
roles remain available; ordinary work does not require a team. Keep required
independent review and task-specific operational controls.

Startup instructions and web delivery now emphasize relevant context and
acceptance instead of repeated process. Read notes by need and rerun checks
when inputs changed, evidence is stale, failures remain or a gate requires it.
The standalone 0.154.0 executable is active; older wrapper claims below are
historical. Permission settings were preserved. Existing sessions retain their
loaded instructions and may retain model overrides; use a fresh session.

See [the maintenance report](HARNESS_USAGE_AUDIT.md) for evidence, validation,
limitations and rollback. Older dated entries are historical, not instructions
to restore their settings. No savings percentage or benchmark win is claimed.


## Identity and authority

- Canonical project identity: `ai-teams`.
- Canonical framework and notes authority: this repository.
- A singular `ai-team` sibling may exist as a compatibility index, but it is
  not a second writable authority.
- Exact workstation paths and helper-workspace mappings belong in ignored
  private state, not this public repository.

Agent Team is a local-first operating framework for using Codex CLI like a
small production team. It is designed around practical local workflows rather
than a vendor-neutral agent platform:

- one human operator;
- Codex CLI as the primary interface;
- role-routed Astra, Sol, and Luna models with reasoning effort matched to the
  work instead of using the highest effort everywhere;
- multiple local web application repositories;
- Linux/server operations with inventory, canaries, rollback, and verification;
- MSP-style ticket, maintenance, documentation, triage, and closeout workflows.

The design goal is a **local production team**: a practical Codex-driven
operating system for doing more work safely, faster, and with less context loss.

## The core pattern

For explicitly requested systematic work or genuinely long/risky tasks, invoke
the Fable-inspired loop with `$local-goal-loop`:

```text
GOAL -> PLAN -> INVOKE (ROUTE OR DELEGATE) -> EXECUTE -> CHECK -> REVIEW -> RECORD
```

Routine work uses a direct path instead. `$local-goal-loop` is explicit-only;
even when invoked, delegation and independent review remain optional when they
do not add value. The Astra-low root owns direction, routing, integration,
acceptance, final verification, escalation, and thread closure. Invocation
authorizes the bounded local workflow. The assigned objective is the authority
boundary: work needed inside it proceeds without a second approval, while
unrelated actions and explicit exclusions remain out of scope.

Consequential or materially ambiguous work can use a selective
planner-to-executor path. An Astra-high `project_architect` follows a read-only
contract and produces a `READY` implementation packet. The root routes mechanical
non-specialist work to Sol-low `worker`; specialist work and implementation
requiring meaningful judgment stay with their named Sol-medium builder.
Executors verify packets against the current worktree instead of treating plans
as unquestionable instructions.

Pair each code root with one external durable-notes root. The project directory
name is the default mapping, while explicit canonical-name overrides handle
intentional identity differences. Global guidance provides the fallback;
concrete, managed project `AGENTS.md` blocks make the read/write location
explicit while keeping implementation evidence in the repository.

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
    16-role-model-evaluation.md
  evals/
    role-model-matrix/       # synthetic fixtures, runner, graders, reports
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
  browser/config.toml
  agents/*.toml
  rules/agent-team.rules

~/.local/bin/
  codex (official standalone command)

~/.agents/skills/
  local-goal-loop/SKILL.md
  web-project-delivery/SKILL.md
  linux-server-maintenance/SKILL.md
  infrastructure-as-code-ops/SKILL.md
  msp-ticket-ops/SKILL.md

~/.codex/skills/
  project-specific local extensions, such as production deploy workflows
  and specialized UI/project helpers. Keep private hostnames, command
  allow-lists, and runbook facts in project docs or private notes.
```

## Roles

There are three operating teams:

1. **Web Project Team** — builds, debugs, tests, reviews, and ships web apps.
2. **Local Infra Team** — inventories, observes, patches, and manages your three Linux servers.
3. **MSP Operations Team** — handles customer requests, maintenance windows, documentation, risk classification, verification, and customer-ready summaries.

The human operator remains the owner and assigns the objective. Once assigned,
Codex completes the necessary in-scope work with full access and no routine
approval prompts, including privileged, production, and customer-impacting work
when the objective includes it. External credentials, customer authorization,
and explicit task exclusions remain real constraints.

## Model routing

The installed baseline is an Astra-low root with an unpinned Sol-low child
fallback. Luna handles narrow file/test mapping and draft-only communication;
Sol handles bounded implementation, web-flow analysis, and ordinary review;
Astra handles consequential architecture, test strategy, risk, infrastructure,
IaC, and sensitive triage. Every named child pins its own model and effort.
Role pins override requested spawn settings in the installed runtime, so four
explicit on-demand variants provide the supported high-effort Scout, Builder,
and consequential Reviewer paths without mutating standing roles. No standing
role uses xhigh, Max, or Ultra. See `docs/17-agent-architecture.md` for the
exact 16-role matrix, profile commands, variants, and bounded escalation.
The installed no-prompt execution controls and verification are summarized in
`docs/19-full-access-autonomous.md`.

## Historical evaluations

The existing `evals/` tree is historical evidence and is unchanged by this
configuration release. No older unpublished campaign history is included.
Use `HARNESS_USAGE_AUDIT.md` for this maintenance's actual checks and limits.

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
10. `docs/16-role-model-evaluation.md`

Then copy templates:

```bash
mkdir -p ~/agentic-team
cp -R templates/ops-control ~/agentic-team/local-ops
mkdir -p ~/.codex ~/.codex/agents ~/.codex/browser ~/.codex/rules ~/.agents/skills
cp templates/home-codex/AGENTS.md ~/.codex/AGENTS.md
cp templates/home-codex/config.toml ~/.codex/config.toml
cp templates/home-codex/browser/config.toml ~/.codex/browser/config.toml
cp templates/home-codex/rules/default.rules ~/.codex/rules/agent-team.rules
cp templates/home-codex/agents/*.toml ~/.codex/agents/
cp -R templates/home-codex/skills/* ~/.agents/skills/
```

`templates/home-codex/rules/default.rules` is the source template. The current
installed rules file is `~/.codex/rules/agent-team.rules`.

Validate installed skills after copying or editing `SKILL.md` files:

```bash
for root in ~/.codex/skills ~/.agents/skills "${SHARED_SKILLS_ROOT:-}"; do
  [ -n "$root" ] && [ -d "$root" ] && find "$root" -name SKILL.md -printf '%h\n'
done | sort | while IFS= read -r skill_dir; do
  python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill_dir"
done
```

Do not blindly copy the sample config over an existing `~/.codex/config.toml` without backing it up.

## First useful Codex prompt

Open Codex in the applicable trusted operations workspace. Do not assume a
fleet-wide inventory exists; identify the workspace's declared inventory first.

```text
Read AGENTS.md and the workspace's declared inventory/runbooks. Do not run SSH or make changes. Map only exact trusted asset IDs, identify missing target mappings as BLOCKED_EXTERNAL, and produce a bounded baseline/change-plan outline. Use a subagent only if separate read-heavy inventory analysis materially helps.
```
