# 04 — Codex Local Configuration

## Global config principles

The installed user layer owns the root model, child fallback, thread ceiling,
and the one canonical copy of each stable agent. Project config owns only
project behavior such as notes write roots and the same two-thread ceiling.
Project `AGENTS.md` owns repository-specific constraints.

Use a proportionate direct path for routine work. `$local-goal-loop` is
explicit-only; invoking it authorizes its bounded local workflow. DIRECT
remains agent-free. STAGED and CONTROLLED may route valid bounded packets
through the installed Astra/Sol/Luna roles when delegation adds value, but do
not require a child merely because the loop is active. Outside the skill,
subagents, independent review, and persistent ledgers remain proportionate and
risk-based.

## Suggested `~/.codex/config.toml`

Use `templates/home-codex/config.toml` as the starting file. Key settings:

```toml
model = "gpt-6-astra"
model_reasoning_effort = "low"
service_tier = "default"
sandbox_mode = "danger-full-access"
approval_policy = "never"

[agents]
enabled = true
max_concurrent_threads_per_session = 2
default_subagent_model = "gpt-5.6-sol"
default_subagent_reasoning_effort = "low"

[features]
hooks = true

[apps._default]
default_tools_approval_mode = "approve"
destructive_enabled = true
open_world_enabled = true
```

The reusable template and installed user file both set `danger-full-access`
with approval policy `never`. Existing enabled app and MCP integrations use
their supported `approve` tool mode so Codex does not add another prompt;
external authentication, MFA, provider confirmations, and disabled accounts
remain independent availability facts. The migration preserves unrelated
plugins, browser/computer-use integration, project trust entries, and other
customization. Existing sessions do not retroactively reload the changed file.

The observed 0.154.0 workstation command is the official standalone executable
through its installation symlink. The historical wrapper template is retained
for recovery; do not overwrite the installed command during this usage audit.
`danger-full-access` / `never` remain in the existing configuration. Runtime
or external tool restrictions must be reported from actual evidence; a
configuration value alone does not prove every tool will execute.

Browser has an additional machine-wide policy at
`~/.codex/browser/config.toml`. The canonical
`templates/home-codex/browser/config.toml` sets origin, history, download,
upload, and CDP approval modes to `never_ask`, enables full CDP and WebMCP, and
uses wildcard allow lists. This removes the Browser-specific origin prompt for
all projects; it is separate from the CLI shell approval policy.

The installed root baseline is Astra-low. Specialized agents explicitly pin
model and effort, and the unpinned child fallback is Sol-low. In the installed
runtime, a custom role pin wins over a per-spawn request. Bounded escalation
therefore uses four explicit on-demand variants rather than temporarily editing
a shared standing role.

Root effort profiles use the native user-profile files:

```text
~/.codex/root-low.config.toml
~/.codex/root-medium.config.toml
~/.codex/root-high.config.toml
```

Start bounded work with `codex`, ambiguous work with
`codex --profile root-medium`, the high acceptance path with
`codex --profile root-high`, and an explicit bounded/clerical path with
`codex --profile root-low`; the same ordering works with `codex exec`. In this
installed release, verify each profile in a fresh process and use the
`turn/start.effort` field where an app-server caller needs a per-turn override.
A running session does not retroactively reload edits to the baseline or
selected profile.

When upgrading models, review `model_instructions_file` before carrying it
forward. Remove any override that copies an older model's base instructions so
the new model receives its current shipped prompt. Keep an override only when
it contains intentional, model-independent local instructions that have been
revalidated against the selected model.

## Personal `AGENTS.md`

Use `templates/home-codex/AGENTS.md` for compact shared invariants. Keep complete
domain workflows in skills, not the global policy. The root owns delegation,
write ownership, integration, escalation, and final verification.

## Custom agents

Canonical user agents in this package:

| Agent | Model | Permission intent | Effort | Purpose |
|---|---|---|---:|---|
| `default` | `gpt-5.6-sol` | read-only contract | low | Bounded general support and fallback. |
| `worker` | `gpt-5.6-sol` | scoped-write contract | low | Mechanical implementation from an explicit packet. |
| `explorer` | `gpt-5.6-luna` | read-only contract | medium | Fast read-heavy mapping. |
| `web_scout` | `gpt-5.6-sol` | read-only contract | medium | Analyze UI/API/data flows and ownership. |
| `web_builder` | `gpt-5.6-sol` | scoped-write contract | medium | Implement bounded web changes. |
| `project_architect` | `gpt-6-astra` | read-only contract | high | Consequential architecture decisions. |
| `project_builder` | `gpt-5.6-sol` | scoped-write contract | medium | Non-web/cross-domain implementation. |
| `project_reviewer` | `gpt-5.6-sol` | read-only contract | high | Diff correctness and regression review. |
| `test_mapper` | `gpt-5.6-luna` | read-only contract | medium | Existing test inventory and mapping. |
| `test_strategist` | `gpt-6-astra` | read-only contract | high | Failure scenarios and regression priorities. |
| `risk_reviewer` | `gpt-6-astra` | read-only contract | high | Security and consequential risk. |
| `infra_recon` | `gpt-6-astra` | recon-only contract | low | Inventory-backed Linux recon. |
| `infra_planner` | `gpt-6-astra` | planning-only contract | high | Linux canary/rollback planning. |
| `iac_planner` | `gpt-6-astra` | planning-only contract | high | IaC dependencies, state, migration, and recovery planning. |
| `msp_triage` | `gpt-6-astra` | triage-only contract | medium | MSP lifecycle intake and sensitive routing. |
| `customer_comms` | `gpt-5.6-luna` | draft-only contract | medium | Customer-safe drafts. |

Codex 0.153.4 custom roles pin model, effort, instructions, selected feature
flags, and disabled skills. Role files intentionally omit sandbox and approval
overrides, so every child inherits `danger-full-access` and `never` from root.
Read-only, planning-only, and scoped-write labels coordinate division of labor
and ownership; they are not technical isolation. Supported feature controls
keep the established app/plugin/skill exclusions, every child explicitly
disables `local-goal-loop`, and `customer_comms` disables `msp-ticket-ops`.

Minimum on-demand variants:

| Variant | Model | Effort | Use |
|---|---|---:|---|
| `web_scout_high` | `gpt-5.6-sol` | high | Async/retry/distributed/auth flow tracing. |
| `web_builder_high` | `gpt-5.6-sol` | high | Difficult web diagnosis or implementation. |
| `project_builder_high` | `gpt-5.6-sol` | high | Difficult non-web/cross-domain implementation. |
| `project_reviewer_astra_high` | `gpt-6-astra` | high | Consequential review involving integrity, migration, recovery, or trust boundaries. |

These variants are escalation mechanisms, not additional standing workflow
stages. No standing or variant definition uses xhigh, Max, or Ultra.

## Project routing rollout

Use the synchronizer to install the canonical user agent bench, reconcile the
documented two-thread project config, and fail closed if a project-scoped
agent shadow appears:

```bash
node scripts/sync-agent-routing.mjs --check --projects-root "$HOME/projects"
node scripts/sync-agent-routing.mjs --write --projects-root "$HOME/projects"
```

The command covers immediate project directories and first-party repositories
one level below `portfolio/`. It never creates project `.codex/agents` copies
and does not delete a detected shadow automatically. Agent contracts remain
exact copies of `templates/home-codex/agents` under `~/.codex/agents`.

## Shared invariant rollout

Use the marker-safe synchronizer to propagate the canonical shared execution
block without replacing project-specific instructions:

```bash
node scripts/sync-shared-invariants.mjs --check --projects-root "$HOME/projects" --targets-file reviewed-targets.txt
node scripts/sync-shared-invariants.mjs --write --projects-root "$HOME/projects" --targets-file reviewed-targets.txt
```

For workstation-wide changes, use a reviewed target file containing only active
managed `AGENTS.md` paths. This prevents discovered archives or unmanaged files
from joining a write pass. The command manages only files with exactly one
ordered marker pair, preserves all text outside it, and fails closed on missing,
outside-root, duplicate, malformed, or drifted targets. The canonical block is
read from `templates/web-project/AGENTS.md`.

## Project notes rollout

Use the project-notes synchronizer separately from model routing. It manages a
marker-delimited block in each immediate project's `AGENTS.md`, creates the
concrete external notes root when writing, and preserves project-specific text:

```bash
node scripts/sync-project-notes.mjs --check --projects-root "$HOME/projects" --docs-base "<notes-base>" --mapping-file "<private-mapping.json>"
node scripts/sync-project-notes.mjs --write --projects-root "$HOME/projects" --docs-base "<notes-base>" --mapping-file "<private-mapping.json>"
```

Exact workstation paths and canonical-name overrides are local/private
configuration. A mapping file is mandatory whenever any project identity does
not match its code-directory basename; omitting it would route that project back
to a basename-derived notes folder. Reuse the same mapping file for both
`--check` and `--write`. A project set whose canonical names all match their
basenames, such as a separately synchronized nested portfolio, may omit it.

Pass a local read-only legacy-root map with `--legacy-map-file <path>` only when
a project must continue reading a differently named historical notes root. The
command must stop if the notes base is unavailable and must never move or merge
legacy note content.

The synchronizer adds the concrete project notes path to project-local
`sandbox_workspace_write.writable_roots`. Because Codex ignores project config
until a project is trusted, an operator who needs this behavior before per-root
trust is established can also put the selected canonical project notes roots in
the installed global `writable_roots`. Avoid granting the whole notes base when
it also contains unrelated or read-only legacy trees. Any global fallback
should be an explicit local choice, not a hard-coded public template default.

The current role benchmark is suite `3.1.0`, with held-out finalist manifests
at `3.2.0`, harness `1.8.0`, and 166 tests across 22 files.
The July 15 Sol/Terra/Luna V2 screen completed all 238 cells. An additive
failure audit and diff review found 84 grader false negatives and 37 genuine failures. The
suite-1.7.0 regrade preserves the frozen source and covers 221 compatible cases:
170 pass, 11 gate failure, 26 quality failure, 12 indeterminate, and two source
timeouts, while excluding only the 17 changed Project Builder cells. Those
cells then passed 17/17, and the two prior timeout cells passed 2/2, yielding a
189/11/26/12/0 composite. Twelve root-orchestration cells remain honestly indeterminate
because the CLI trace exposes no child identity, outcome, or usage evidence.
See `docs/16-role-model-evaluation.md` for the methodology and evidence paths.
The Builder and Scout finalists completed the three-fixture gate. The operator
kept Builder on Sol/high and approved Scout Sol/low at that time. The later
explicit standing matrix supersedes that routing decision while preserving the
historical evidence.

## Rules

`templates/home-codex/rules/default.rules` is the source template. Install it
as `~/.codex/rules/agent-team.rules` so the live workstation policy has a
project-specific name.

The full-access rules intentionally contain no `prompt` decisions. The assigned
objective, trusted target identity, owning workflow, rollback, and verification
govern ordinary SSH, transfer, privilege, service, package, Docker, firewall,
and IaC commands. The reusable rule keeps one narrow `forbidden` class for raw
filesystem creation. Keep secrets out of repositories and command output.

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

Explicit skill use and analytics are separate concerns. A structured
`local-goal-loop` attachment in local session events proves the skill was
provided to the turn even when no skill lifecycle event appears in analytics.
Likewise, child `session_meta` plus effective `turn_context` is stronger
evidence than a main-chat model summary. Record missing telemetry honestly.

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

Use planning-only when the objective asks for a plan. The runtime remains full
access; the no-write restriction is a task and role contract.

### Normal implementation and infrastructure execution

Use the default `danger-full-access` / `never` configuration. Determine scope
from the objective, establish exact targets, execute necessary actions without a
second permission prompt, and capture checks and rollback evidence appropriate
to impact.

### Emergency incident

Use the same full-access contract with inventory-backed identity, a bounded
change packet, before/after health checks, timestamps, abort conditions, and
recovery evidence. An unavailable credential or enforced external confirmation
is a blocker; do not start an interactive login flow.
