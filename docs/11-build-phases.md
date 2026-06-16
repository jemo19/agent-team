# 11 — Build Phases for the Local Production Team

## Phase 0 — Manual review of package

Read:

- `README.md`
- `START_HERE.md`
- `BUILD_WITH_CODEX.md`

No changes.

## Phase 1 — Global Codex layer

Install:

- `~/.codex/AGENTS.md`
- `~/.codex/config.toml`
- `~/.codex/agents/*.toml`
- `~/.codex/rules/agent-team.rules`
- `~/.agents/skills/*/SKILL.md`

Serialized. Do not parallelize changes to global config.

Done when:

- Files installed or merged.
- Codex starts without config errors.
- Rules file passes at least one `codex execpolicy check` command.

## Phase 2 — Local ops repo

Create:

- `~/agentic-team/local-ops`
- Inventory.
- Customer templates.
- Scripts.
- Runbooks.
- Evidence folders.

Serialized for initial repo creation.

Done when:

- Repo exists.
- `servers.yaml` is filled.
- Scripts show help.
- A synthetic MSP ticket can be created.

## Phase 3 — First web repo pilot

Pick a low-risk repo.

Install:

- Project `AGENTS.md`.
- `.codex/config.toml`.
- Project agents.
- `.agentic` goal/check/runbook files.

Done when:

- Codex can summarize project instructions.
- Read-only scout run completes.
- Test/build commands are known.

## Phase 4 — First read-only infra inventory

Run one server at a time.

Done when:

- Evidence collected.
- No changes made.
- Risks/follow-ups identified.

## Phase 5 — First synthetic MSP workflow

Use demo customer and fake request.

Done when:

- Ticket triaged.
- Customer response drafted.
- Execution plan has approval gate.
- No remote work performed.

## Phase 6 — First real web task

Choose a small feature/bug.

Done when:

- Goal file exists.
- Scouts ran.
- Diff created.
- Checks passed.
- Reviewer ran.
- Final summary produced.

## Phase 7 — First real maintenance task

Choose low-risk maintenance.

Done when:

- Backup/checks confirmed.
- Exact commands approved.
- One server changed.
- Verification recorded.
- Closeout produced.

## Phase 8 — Improve automation

Only after several manual cycles:

- Add more read-only scripts.
- Add project-specific checks.
- Add customer-specific runbooks.
- Add monitoring/log parsing helpers.
- Add ticket system integration if needed.

Do not automate execution before the planning/check/evidence workflow feels boring.
