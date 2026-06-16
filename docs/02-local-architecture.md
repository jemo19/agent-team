# 02 — Local Architecture

## System shape

```text
                 YOU
                  |
                  v
        Codex CLI root session
                  |
      +-----------+-----------+
      |           |           |
  Web Team   Local Infra   MSP Ops Team
      |           |           |
  project    local-ops      customers/
  repos      repo           tickets/
```

The root Codex session is the orchestrator. It reads the goal, plans work, decides which subagents to invoke, waits for them, consolidates results, and asks for approval where required.

Subagents are specialists. They should be narrow, bounded, and disposable. Most subagents should be read-only until the plan is clear.

## Repositories and directories

### Global personal Codex layer

```text
~/.codex/
  AGENTS.md
  config.toml
  agents/
    web-scout.toml
    web-builder.toml
    test-mapper.toml
    risk-reviewer.toml
    infra-recon.toml
    infra-planner.toml
    msp-triage.toml
    customer-comms.toml
  rules/
    agent-team.rules

~/.agents/skills/
  local-goal-loop/SKILL.md
  web-project-delivery/SKILL.md
  linux-server-maintenance/SKILL.md
  msp-ticket-ops/SKILL.md
```

Global files define your default operating agreements and reusable agents. These are personal to your workstation.

### Web project repos

Each web project should have:

```text
project-x/
  AGENTS.md
  .codex/
    config.toml
    agents/
      project-architect.toml
      project-builder.toml
      project-reviewer.toml
  .agentic/
    GOAL_TEMPLATE.md
    goals/
    checks/web-checks.md
    runbooks/feature.md
```

The project `AGENTS.md` is the most important file. It tells Codex how to install, build, test, lint, run locally, and avoid project-specific mistakes.

### Local ops repo

```text
~/agentic-team/local-ops/
  AGENTS.md
  inventory/
    servers.yaml
  customers/
    _TEMPLATE/
    customer-a/
    customer-b/
  tickets/
  goals/
  evidence/
  runbooks/
  checklists/
  scripts/
  .codex/
    config.toml
    hooks.json
    hooks/pre_tool_use_policy.py
```

This is the control repo for local infrastructure and MSP operations. It should be private. It should contain metadata, runbooks, inventory, ticket notes, and evidence, but not secrets.

## Tool boundaries

### Normal web development

- Sandbox: `workspace-write`.
- Approval: `on-request`.
- Network: off by default unless dependency install/docs lookup is explicitly needed.
- Allowed autonomous actions: edit repo files, run tests, run local build, run lint, create docs, inspect git diff.
- Human approval required: new production dependencies, schema/data migrations, deployment, secrets, destructive git operations.

### Local infra and MSP operations

- Default mode: read-only planning.
- Remote commands: require explicit human approval.
- Privileged commands: require explicit human approval and written goal/evidence.
- Customer-affecting commands: require customer/business approval if your MSP policy requires it.
- Destructive or hard-to-reverse actions: separate goal, backup check, rollback plan, execution window.

## Model/effort routing

You currently use GPT-5.5 as the known working model in Codex CLI. Route reasoning effort by role instead of defaulting every subagent to `xhigh`.

Where the CLI supports effort/model changes, use this local routing:

| Work type | Suggested effort | Why |
|---|---:|---|
| Root orchestration | xhigh | Needs planning, risk control, synthesis. |
| Project architecture and migration planning | xhigh | Per-repo architects handle serious cross-file decisions and sequencing. |
| Infra/customer change planning | xhigh | Server/customer planning has enough blast radius to justify maximum reasoning by default. |
| Project implementation worker | high | Builders receive bounded packets, but still need enough reasoning to avoid bad edits. |
| Read-only scouts | medium | Cheaper/faster; they only gather facts. |
| Test mapper | medium | Finds commands and gaps; escalate only for complex regression strategy. |
| Project reviewer / security/risk reviewer | xhigh | Independent review should be strict. |
| Customer comms/documentation | medium | Needs clarity, less deep reasoning. |

Do not use `xhigh` everywhere as the normal path. Keep project-local architecture and review strong, keep bounded builders at `high`, and use cheaper sidecar scouts for file mapping and routine evidence gathering.

## Parallelism policy

The user has granted standing authorization for Codex to use subagents by default on non-trivial work when the work can be split safely. This is intended to trade token burn for lower wall-clock time.

Parallelism is useful when agents do not write the same things.

Safe to parallelize:

- Read-only codebase exploration.
- Test discovery.
- Documentation lookup.
- UI/UX inspection.
- Security review.
- Infra read-only inventory planning.
- MSP ticket triage and customer response drafting.

Usually serialize:

- Final plan approval.
- Shared interface/API contract changes.
- Database migrations.
- Auth changes.
- Lockfile/package-manager changes.
- Terraform/OpenTofu/Ansible apply equivalents.
- SSH writes and privileged server changes.
- Customer-facing communications.
- Final merge/release/deploy.

## Evidence model

Every non-trivial goal should leave an evidence trail:

```text
.agentic/goals/GOAL-YYYYMMDD-slug.md
.agentic/evidence/GOAL-YYYYMMDD-slug/
  plan.md
  scout-results.md
  command-log.md
  checks.md
  review.md
  approval.md
  closeout.md
```

For local ops/MSP:

```text
~/agentic-team/local-ops/evidence/YYYY-MM-DD/GOAL-ID/
```

Evidence is what lets you trust the team, resume work later, and explain customer work.
