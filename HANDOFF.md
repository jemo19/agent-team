# Agent Team Handoff

Last updated: 2026-06-15

## Current State

This repository is being prepared as the public `agent-team` framework repo.
It contains reusable Codex CLI operating docs, templates, custom-agent
definitions, skill templates, runbooks, and validation scripts.

Exact local environment state is intentionally not public. Keep it in ignored
private files or a separate private ops repository.

## Public Boundary

Safe to keep public:

- reusable workflow docs;
- generic examples;
- Codex config templates;
- custom-agent templates;
- skill templates;
- project and ops-control skeletons;
- validation scripts.

Do not commit:

- exact server names, IPs, SSH aliases, or private network details;
- real customer names, tickets, systems, or contact details;
- private repo names that should not be public;
- `.env` files, tokens, keys, MFA codes, cookies, Terraform state, plan files,
  or credential references.

## Private Local State

The repo ignores these patterns:

```text
private/
*.private.md
*.private.yaml
```

Recommended private files:

```text
private/current-state.private.md
private/project-map.private.md
private/servers.private.yaml
private/projects.private.yaml
```

Before public release, detailed local maps were preserved locally under
`private/`. They must remain untracked.

## Agent Routing

Global templates:

- `web_scout`: `medium`
- `web_builder`: `high`
- `test_mapper`: `medium`
- `risk_reviewer`: `xhigh`
- `infra_recon`: `high`
- `infra_planner`: `xhigh`
- `iac_planner`: `xhigh`
- `msp_triage`: `medium`
- `customer_comms`: `medium`

Project-local templates:

- `project_architect`: `xhigh`
- `project_builder`: `high`
- `project_reviewer`: `xhigh`

## Public Release Checklist

Before making the repo public:

1. Run `bash scripts/validate-package.sh`.
2. Run a public-risk scan for secrets and local environment details.
3. Remove generated files such as `__pycache__/`.
4. Confirm `private/` files are ignored and untracked.
5. Publish from fresh sanitized history if previous commits contained private
   local state.
6. Verify the GitHub repo visibility after changing it to public.

## Maintenance Notes

- Update `README.md`, `HANDOFF.md`, and `MEMORY.md` together when the public
  operating model changes.
- Update `docs/15-current-state.md` for public release state only.
- Put exact local maps in ignored private files, not checked-in docs.
- Treat this repo as reusable framework source; use local ops/private notes for
  exact server, project, customer, and credential context.
