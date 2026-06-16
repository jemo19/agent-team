# Build This With Codex

Use this file as the initial implementation prompt for Codex CLI. The build is split into phases so Codex can execute safely and you can stop after any phase.

## Root prompt to paste into Codex

```text
You are helping me build my local agentic production team for Codex CLI.

Scope:
- Local workstation only.
- Codex CLI is the primary interface.
- Model effort is routed by role; do not use maximum reasoning for every subagent by default.
- I work on multiple web-based projects.
- I manage Linux/server operations with approval gates.
- I need assistance with ticket-style requests, maintenance, documentation, triage, and sysadmin planning.

Read README.md, START_HERE.md, docs/03-fable-style-goal-loop.md, docs/04-codex-local-configuration.md, and templates/.

Do not modify my real ~/.codex yet unless I explicitly approve.
Do not run SSH.
Do not run destructive commands.
First produce a phase plan with exact files to copy/create, risks, rollback steps, and validation checks.
After I approve, execute Phase 0 only.
```

## Phase 0 — Inventory and dry run

**Goal:** Understand what exists before copying anything.

Codex may run:

```bash
pwd
ls -la
find . -maxdepth 3 -type f | sort
[ -d ~/.codex ] && find ~/.codex -maxdepth 3 -type f | sort || true
[ -d ~/.agents ] && find ~/.agents -maxdepth 3 -type f | sort || true
codex --version || true
```

Codex must produce:

- `build-evidence/phase-0-inventory.md`
- A list of existing files it would overwrite.
- A rollback plan.

**Completion check:** No existing file has been overwritten.

Optional package validation:

```bash
bash scripts/validate-package.sh
```

## Phase 1 — Install personal Codex defaults

**Goal:** Put reusable local team instructions into `~/.codex` and reusable skills into `~/.agents/skills`.

Serialized because it touches global configuration.

Suggested commands after human approval:

```bash
mkdir -p ~/.codex/agents ~/.codex/rules ~/.agents/skills
cp -n templates/home-codex/AGENTS.md ~/.codex/AGENTS.md
cp -n templates/home-codex/config.toml ~/.codex/config.toml
cp -n templates/home-codex/rules/default.rules ~/.codex/rules/agent-team.rules
cp -n templates/home-codex/agents/*.toml ~/.codex/agents/
cp -R templates/home-codex/skills/* ~/.agents/skills/
```

`templates/home-codex/rules/default.rules` is the package template. The current
installed rules file should be `~/.codex/rules/agent-team.rules`.

Use `cp -n` to avoid overwrite. If a file exists, Codex should propose a merge instead of replacing it.

**Completion checks:**

```bash
find ~/.codex -maxdepth 3 -type f | sort
find ~/.agents/skills -maxdepth 3 -name SKILL.md | sort
codex execpolicy check --pretty --rules ~/.codex/rules/agent-team.rules -- sudo systemctl restart nginx || true
```

## Phase 2 — Create local ops control repo

**Goal:** Create a repo for three-server management and MSP operations.

```bash
mkdir -p ~/agentic-team
cp -R templates/ops-control ~/agentic-team/local-ops
cd ~/agentic-team/local-ops
git init
git add .
git commit -m "Initialize local ops control repo" || true
```

Manual edits required after copy:

- Rename `inventory/servers.example.yaml` to `inventory/servers.yaml`.
- Rename `inventory/projects.example.yaml` to `inventory/projects.yaml`.
- Fill in hostnames, SSH aliases, roles, maintenance windows, and backup notes in private/local inventory files.
- Fill in code roots, docs roots, GitHub remotes, and workflow type for managed projects in private/local inventory files.
- Create customer folders from `customers/_TEMPLATE` only for customers you are authorized to manage.
- Do not store passwords, API keys, private keys, or one-time codes in this repo.
- Do not run `terraform apply`, `terraform destroy`, `terraform import`, or `terraform state` commands until a reviewed plan and approval gate exist.

**Completion checks:**

```bash
cd ~/agentic-team/local-ops
bash scripts/readonly-host-check.sh --help
bash scripts/service-health-check.sh --help
python3 .codex/hooks/pre_tool_use_policy.py < /dev/null || true
```

## Phase 3 — Install web project team in one repo

**Goal:** Pilot the web team on one low-risk project.

From inside your chosen project repo:

```bash
cp -n /path/to/local-agentic-production-team/templates/web-project/AGENTS.md ./AGENTS.md
mkdir -p .codex/agents .agentic/goals .agentic/checks .agentic/runbooks
cp -n /path/to/local-agentic-production-team/templates/web-project/.codex/config.toml .codex/config.toml
cp -n /path/to/local-agentic-production-team/templates/web-project/.codex/agents/*.toml .codex/agents/
cp -n /path/to/local-agentic-production-team/templates/web-project/.agentic/GOAL_TEMPLATE.md .agentic/GOAL_TEMPLATE.md
cp -n /path/to/local-agentic-production-team/templates/web-project/.agentic/checks/web-checks.md .agentic/checks/web-checks.md
cp -n /path/to/local-agentic-production-team/templates/web-project/.agentic/runbooks/feature.md .agentic/runbooks/feature.md
```

**Completion checks:**

```bash
git diff -- AGENTS.md .codex .agentic
```

Then run a read-only prompt:

This prompt can name the scout agents directly, but the global instructions already provide standing authorization for useful read-only subagents on non-trivial parallelizable work.

```text
Read AGENTS.md and .agentic/GOAL_TEMPLATE.md. Do not modify files. Spawn web_scout, test_mapper, and risk_reviewer in parallel to map this codebase. Return a codebase onboarding summary: stack, entry points, test commands, build commands, risky areas, and recommended first automation improvements.
```

## Phase 4 — MSP synthetic ticket drill

**Goal:** Validate the MSP workflow without touching a real customer system.

In `~/agentic-team/local-ops`:

```bash
bash scripts/new-ticket.sh demo-customer "Synthetic request: update DNS TXT record for example.com"
```

Then in Codex:

```text
Use the MSP ticket workflow. Triage the newest demo-customer ticket. Produce a customer-safe response, missing-info questions, risk class, execution plan, verification plan, rollback plan, and closeout summary template. Do not run any customer or remote commands.
```

**Completion checks:**

- Ticket has triage notes.
- Plan includes human/customer approval gate if the change is customer-impacting.
- No secrets are requested in chat.
- No remote commands were run.

## Phase 5 — First real read-only server inventory

**Goal:** Run safe recon only.

Human must confirm the `servers.yaml` entries first.

```text
Read AGENTS.md and inventory/servers.yaml. Use the local infra read-only workflow. Generate a per-server read-only command plan. Do not execute it yet. Commands must not use sudo, modify files, restart services, change firewall rules, install packages, or write to remote hosts.
```

After review, you may approve running `scripts/readonly-host-check.sh <ssh_alias>` manually or through Codex one server at a time.

**Completion checks:**

- Evidence file created under `evidence/YYYY-MM-DD/`.
- Each command output is summarized.
- Any proposed change is separated into a new goal with approval gate.
