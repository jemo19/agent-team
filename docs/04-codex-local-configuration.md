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
model = "gpt-5.6-sol"
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

The reusable template keeps `xhigh` as a conservative root default. The
currently installed evaluation control is `gpt-5.6-sol` at `ultra`, with
interactive Plan mode at `xhigh`. That installed assignment is a benchmark
control, not a proven winner; do not copy it into every role or change it from
screening evidence alone.

If your installed Codex build uses a different spelling for extra-high reasoning, keep using the working CLI setting you already use and adjust this template accordingly.

When upgrading models, review `model_instructions_file` before carrying it
forward. Remove any override that copies an older model's base instructions so
the new model receives its current shipped prompt. Keep an override only when
it contains intentional, model-independent local instructions that have been
revalidated against the selected model.

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

| Agent | Model | Default mode | Effort | Purpose |
|---|---|---|---:|---|
| `web_scout` | `gpt-5.6-terra` | read-only | medium | Map code paths, entry points, conventions. |
| `web_builder` | `gpt-5.6-sol` | workspace-write | high | Implement bounded web project changes. |
| `test_mapper` | `gpt-5.6-terra` | read-only | medium | Locate tests and propose missing coverage. |
| `risk_reviewer` | `gpt-5.6-sol` | read-only | xhigh | Review security, correctness, data risks. |
| `infra_recon` | `gpt-5.6-terra` | read-only | high | Prepare safe server inventory/recon. |
| `infra_planner` | `gpt-5.6-sol` | read-only | xhigh | Build maintenance/change plans. |
| `iac_planner` | `gpt-5.6-sol` | read-only | xhigh | Plan Terraform/OpenTofu state, import, drift, and desired-state work. |
| `msp_triage` | `gpt-5.6-terra` | read-only | medium | Classify requests and produce ticket plan. |
| `customer_comms` | `gpt-5.6-terra` | read-only | medium | Draft customer-safe messages. |

The project-local architect, builder, and reviewer templates use
`gpt-5.6-sol`. Keep `gpt-5.6-luna` for future clear, repeatable, high-volume
roles instead of assigning it to nuanced coding, infrastructure, or customer
work by default. See the official [Codex models](https://developers.openai.com/codex/models)
and [subagents](https://developers.openai.com/codex/subagents) guidance for the
current model and custom-agent semantics.

Do not over-specialize too early. Add agents only after you see repeated work patterns.

The current role benchmark is suite `1.4.2` with harness `1.3.1`. Calibration
supports 13 of 14 installed controls on the V1 fixtures; `customer_comms` has a
real fixture failure. The July 12 Sol/Terra/Luna screen completed all 238 cells,
but human review found assertion brittleness and a root-orchestration terminal
classification anomaly. Preserve it for offline regrading rather than using its
raw rankings. See `docs/16-role-model-evaluation.md` for the methodology and
next gate. Production routing remains unchanged until finalist stability, three
distinct fixtures, human review, and operator approval are complete.

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

Avoid catch-all SSH prompt rules in reusable rule templates when project-specific SSH deploy commands are allow-listed in the installed workstation rules. Codex resolves multiple matching rules to the most restrictive decision, so a generic `pattern = ["ssh"]` prompt overrides narrower `allow` rules. Keep private host-specific allow-lists in the installed local rules file, not in public or reusable templates.

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
- `infrastructure-as-code-ops`
- `msp-ticket-ops`

A skill should contain workflow instructions, not long project-specific data. Project-specific facts belong in the repo `AGENTS.md`, inventory YAML, customer profiles, runbooks, and goal files.

Local installations may also include project-specific deploy skills and other
helpers under `~/.codex/skills` or `/mnt/c/docs/skills`. Keep those runbooks
private/public-safe according to the project boundary.

Validate skill frontmatter after edits:

```bash
for root in ~/.codex/skills ~/.agents/skills /mnt/c/docs/skills; do
  [ -d "$root" ] && find "$root" -name SKILL.md -printf '%h\n'
done | sort | while IFS= read -r skill_dir; do
  python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill_dir"
done
```

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
