# Local Agentic Production Team for Codex CLI

Agent Team is a local-first operating framework for using Codex CLI like a
small production team. It is designed around practical local workflows rather
than a vendor-neutral agent platform:

- one human operator;
- Codex CLI as the primary interface;
- role-routed GPT-5.6 models and reasoning effort instead of using the highest
  effort everywhere;
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
  agents/*.toml
  rules/agent-team.rules

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

The human operator remains the owner and change authority. Agents can
investigate, draft, propose, implement in local repos, test, and produce
evidence. They should not perform privileged production or customer-impacting
changes without explicit human approval.

## Model routing

The default team uses `gpt-5.6-sol` for root orchestration, builders, planners,
architects, and reviewers. Read-heavy scouts, test mapping, infrastructure
reconnaissance, MSP triage, and customer communication use
`gpt-5.6-terra`. Keep `gpt-5.6-luna` available for future deterministic,
high-volume batch roles rather than assigning it to nuanced work by default.

Reasoning effort remains role-based: `xhigh` for architecture, planning, and
risk review; `high` for implementation and infrastructure recon; and `medium`
for support agents. The current root control uses `gpt-5.6-sol` at `ultra`,
while interactive Plan mode uses `xhigh`. These are controls to evaluate, not
assumed winners.

## Role and model evaluation

The versioned evaluation design lives in
`docs/16-role-model-evaluation.md`; its executable package lives in
`evals/role-model-matrix/`. Version 1 defines one synthetic
difficult/adversarial fixture for each of 14 role surfaces and freezes 17
supported Sol, Terra, and Luna reasoning configurations. A complete screen is
238 candidate runs before confirmations. The current suite is `1.4.2` with
harness `1.3.1`. It records indeterminate delegation telemetry as a score
interval, keeps model-generated commands outside the Codex authentication
namespace, distinguishes recovered transport warnings from fatal failures, and
has 69 deterministic regression tests.

The local harness uses the installed `codex exec` client and existing Codex
authentication, not custom Responses/Evals API request code. Candidate turns
consume Codex usage; deterministic grading and reports remain local. The
completed two-cell Ultra smoke-test analysis is in
`evals/role-model-matrix/PILOT.md`. Calibration v6 human review and offline
replay under suite `1.4.2` / harness `1.3.1` produce 13 supported passes and
one supported `customer_comms` failure. The July 12 screen completed all 238
cells, but human review found pervasive deterministic-grader false negatives
and a root-orchestration classification anomaly. Preserve it as calibration
evidence; it does not support a routing change.

A separate public lane under
`evals/public-benchmarks/terminal-bench-2/` completed an 85-cell,
17-configuration by five-task Terminal-Bench 2 screen through a host-side
subscription-authenticated bridge. Results and crash-recovery provenance are
in `RESULTS-2026-07-12.md`. No OpenAI API key or OpenAI API call was used.

Run static validation and inspect the no-call preview before any billed pilot.
Raw traces stay in the ignored local results directory. No benchmark result
changes active routing automatically: hard failures, representative traces,
repeatability, cost, latency, and human review all belong at the routing gate.

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
mkdir -p ~/.codex ~/.codex/agents ~/.codex/rules ~/.agents/skills
cp templates/home-codex/AGENTS.md ~/.codex/AGENTS.md
cp templates/home-codex/config.toml ~/.codex/config.toml
cp templates/home-codex/rules/default.rules ~/.codex/rules/agent-team.rules
cp templates/home-codex/agents/*.toml ~/.codex/agents/
cp -R templates/home-codex/skills/* ~/.agents/skills/
```

`templates/home-codex/rules/default.rules` is the source template. The current
installed rules file is `~/.codex/rules/agent-team.rules`.

Validate installed skills after copying or editing `SKILL.md` files:

```bash
for root in ~/.codex/skills ~/.agents/skills /mnt/c/docs/skills; do
  [ -d "$root" ] && find "$root" -name SKILL.md -printf '%h\n'
done | sort | while IFS= read -r skill_dir; do
  python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill_dir"
done
```

Do not blindly copy the sample config over an existing `~/.codex/config.toml` without backing it up.

## First useful Codex prompt

Open Codex in `~/agentic-team/local-ops` and run:

The prompt names subagents directly as an example, but the installed global instructions already grant standing authorization for useful read-only subagents on non-trivial work.

```text
Read AGENTS.md and goals/GOAL_TEMPLATE.md. Do not run SSH or make changes yet.
Create a first-pass local production team inventory plan for my three Linux servers and MSP operations. Use the Fable-style loop: define the goal contract, spawn read-only scout subagents for docs/inventory/checklist review, then consolidate a safe phase plan. Stop before any remote command.
```
