# 15 - Public Current State

Last reviewed: 2026-06-15

This file describes the public release state of the agent-team framework. It is
safe to publish. Keep exact workstation paths, server names, IP addresses,
private repository names, customer names, and credential references in ignored
private files instead.

## Public Purpose

Agent Team is a Codex-centered operating framework for:

- planning non-trivial work before edits;
- using subagents for bounded scouting, implementation, test mapping, and
  review;
- managing web project delivery with project-local `AGENTS.md` guidance;
- preparing infrastructure and MSP-style work with approval gates;
- recording evidence, checks, and handoff notes instead of relying on chat
  memory.

The normal loop is:

```text
GOAL -> PLAN -> INVOKE SUBAGENTS -> EXECUTE -> CHECK -> REVIEW -> HUMAN GATE -> RECORD EVIDENCE
```

## Public Repository Boundary

This repository should contain reusable framework material only:

- docs and runbooks;
- reusable Codex config templates;
- reusable custom-agent definitions;
- reusable skill templates;
- project and ops-control templates;
- validation scripts.

This repository must not contain:

- passwords, API keys, tokens, private keys, MFA codes, cookies, or sessions;
- `.env` files or secret Terraform variable files;
- Terraform/OpenTofu state or plan files;
- real customer names, customer systems, or customer ticket data;
- private server IPs, Tailscale IPs, internal DNS names, or SSH aliases;
- exact local infrastructure maps that are not intended for public release.

## Private Local State

Use ignored local files for exact environment state. Recommended names:

```text
private/current-state.private.md
private/project-map.private.md
private/servers.private.yaml
private/projects.private.yaml
```

The checked-in `.gitignore` excludes `private/`, `*.private.md`, and
`*.private.yaml`.

The public docs can describe patterns. Private files can contain exact local
facts. Do not copy private facts back into checked-in docs unless they are
sanitized.

## Installed Agent Routing

Public templates currently define these global custom agents:

| Agent | Mode | Effort | Purpose |
|---|---|---:|---|
| `customer_comms` | read-only | medium | Draft customer-safe communication. |
| `iac_planner` | read-only | xhigh | Plan Terraform/OpenTofu state, import, drift, and desired-state work. |
| `infra_planner` | read-only | xhigh | Build server/customer change plans with rollback and evidence. |
| `infra_recon` | read-only | high | Prepare safe read-only server reconnaissance. |
| `msp_triage` | read-only | medium | Classify MSP-style requests and produce ticket plans. |
| `risk_reviewer` | read-only | xhigh | Review correctness, security, auth, data, and operational risk. |
| `test_mapper` | read-only | medium | Locate tests, commands, fixtures, and coverage gaps. |
| `web_builder` | workspace-write | high | Implement bounded web project packets. |
| `web_scout` | read-only | medium | Map web code paths, conventions, tests, and risks. |

Project-local templates define:

| Agent | Mode | Effort | Purpose |
|---|---|---:|---|
| `project_architect` | read-only | xhigh | Plan multi-file project changes. |
| `project_builder` | workspace-write | high | Implement bounded project-specific packets. |
| `project_reviewer` | read-only | xhigh | Review project diffs before closeout. |

## Current Public Release Tasks

Before making this repository public:

1. Keep local/private state under ignored private files.
2. Sanitize all checked-in docs and templates.
3. Remove generated files such as `__pycache__/`.
4. Run `bash scripts/validate-package.sh`.
5. Run a secret/public-risk scan.
6. Publish from a fresh sanitized history if earlier private commits contained
   local environment details.

## Local Workflow After Public Release

Use this repository for reusable framework work. Use ignored private files, a
separate private notes repo, or the local ops control repo for exact operational
state.

When updating docs:

- update public docs with generic examples and reusable instructions;
- update private files with real local paths, servers, customer references, and
  next actions;
- never assume a public doc can safely mention a private repo, server, IP, or
  customer.
