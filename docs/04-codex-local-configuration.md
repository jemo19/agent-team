# 04 — Codex Local Configuration

## Global config principles

Your global Codex config should make the safe path easy:

- `workspace-write` for normal coding.
- `on-request` approvals.
- Network off by default.
- Max subagent depth `1`.
- Thread cap around `6`.
- Custom agents with read-only defaults for scouts/reviewers.
- Standing authorization for proactive subagent use on non-trivial parallelizable work.
- Explicit rules for privileged/destructive commands.

## Suggested `~/.codex/config.toml`

Use `templates/home-codex/config.toml` as the starting file. Key settings:

```toml
model = "gpt-5.5"
model_reasoning_effort = "xhigh"
sandbox_mode = "workspace-write"
approval_policy = "on-request"

[agents]
max_threads = 6
max_depth = 1
job_max_runtime_seconds = 1800

[sandbox_workspace_write]
network_access = false

[features]
hooks = true
```

If your installed Codex build uses a different spelling for extra-high reasoning, keep using the working CLI setting you already use and adjust this template accordingly.

## Personal `AGENTS.md`

Use `templates/home-codex/AGENTS.md` for your global operating rules. It tells Codex:

- Plan before acting.
- Prefer subagent scouts before broad edits.
- Treat the user's standing authorization as explicit delegation permission for useful subagent work.
- Keep infra/MSP work human-gated.
- Record evidence.
- Avoid secrets in files/prompts.
- Run checks before declaring done.

## Custom agents

Global custom agents in this package:

| Agent | Default mode | Effort | Purpose |
|---|---|---:|---|
| `web_scout` | read-only | medium | Map code paths, entry points, conventions. |
| `web_builder` | workspace-write | high | Implement bounded web project changes. |
| `test_mapper` | read-only | medium | Locate tests and propose missing coverage. |
| `risk_reviewer` | read-only | xhigh | Review security, correctness, data risks. |
| `infra_recon` | read-only | high | Prepare safe server inventory/recon. |
| `infra_planner` | read-only | xhigh | Build maintenance/change plans. |
| `iac_planner` | read-only | xhigh | Plan Terraform/OpenTofu state, import, drift, and desired-state work. |
| `msp_triage` | read-only | medium | Classify requests and produce ticket plan. |
| `customer_comms` | read-only | medium | Draft customer-safe messages. |

Do not over-specialize too early. Add agents only after you see repeated work patterns.

## Rules

`templates/home-codex/rules/default.rules` is the source template. Install it
as `~/.codex/rules/agent-team.rules` so the live workstation policy has a
project-specific name.

The rules are not a complete security boundary. They are a friction layer. The stronger boundaries are:

- Codex sandbox.
- Your approval policy.
- No secrets in repo.
- No broad production credentials in shell env.
- Human approval for customer/server changes.

## Hooks

Hooks are useful for deterministic checks that should not depend on model judgment. The ops-control template includes a `PreToolUse` policy hook that blocks obviously destructive shell commands.

Use hooks carefully:

- Keep them simple.
- Keep them deterministic.
- Do not put secrets in hook output.
- Test them outside Codex.
- Review/trust them via `/hooks` before relying on them.

## Skills

Skills are reusable operating procedures. This package includes:

- `local-goal-loop`
- `web-project-delivery`
- `linux-server-maintenance`
- `msp-ticket-ops`

A skill should contain workflow instructions, not long project-specific data. Project-specific facts belong in the repo `AGENTS.md`, inventory YAML, customer profiles, runbooks, and goal files.

## Recommended session modes

### Planning-only

Use when beginning infra/MSP work:

```text
Switch to read-only / planning mode. Do not edit files or run commands. Produce the plan first.
```

### Normal web implementation

Use default `workspace-write` / `on-request`.

### Infra execution

Do not use broad `danger-full-access`. Prefer one approved command at a time, with evidence capture.

### Emergency incident

In an incident, speed matters, but records still matter. Use:

- Read-only recon first where possible.
- One command at a time.
- Before/after health checks.
- Timestamped evidence.
- Manual approval for disruptive steps.
