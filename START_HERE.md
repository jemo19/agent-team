# Start Here

This package replaces the earlier portability-first design. It is intentionally local, Codex-centered, and operational.

For the current installed state, project map, server map, repos, and next steps,
read `docs/15-current-state.md`.

## Your target end state

You will have a local control system that lets you say things like:

```text
Codex, implement this web feature in project X. Plan first, spawn scouts for code paths/tests/security/docs, then build, run checks, and give me a reviewable diff.
```

```text
Codex, prepare monthly maintenance for the three Linux servers. Read-only recon first. Build a maintenance plan with risk, expected downtime, backup checks, and exact commands. Do not execute changes until I approve.
```

```text
Codex, customer Acme asked for a mailbox/DNS/server change. Triage the request, gather missing info, produce the customer response, and prepare the execution checklist. Stop at the approval gate.
```

## What not to do first

Do not begin by wiring every API, customer portal, SSH key, and ticket system into Codex. That creates tool risk before you have process maturity.

Start with file-based operations:

- Markdown goal contracts.
- YAML inventories.
- Read-only recon scripts.
- Human-reviewed maintenance plans.
- Evidence logs.
- Small web-project workflows.

Then add integrations only where repeated friction justifies it.

## Day-one implementation order

Most day-one setup has already been completed for the current workstation. Use
this list for rebuilds or new machines, then compare against
`docs/15-current-state.md`.

1. Back up your existing Codex config.
2. Install the home Codex config and custom agents.
3. Create `~/agentic-team/local-ops` from the ops template.
4. Fill in `inventory/servers.yaml` from the sample.
5. Pick one low-risk web repo and copy the web-project template files into it.
6. Run one read-only web codebase mapping goal.
7. Run one read-only local infra inventory goal.
8. Run one synthetic MSP ticket through intake/triage/plan/close without touching a customer system.

## The mental model

Treat Codex like a small team of junior-to-senior specialists with one very fast senior engineer as orchestrator. Give them:

- A written ticket.
- A role.
- A boundary.
- A checklist.
- A way to prove completion.
- A stop condition.

Do not give them vague authority over production systems.
