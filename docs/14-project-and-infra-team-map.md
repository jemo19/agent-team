# 14 - Project and Infrastructure Team Map

This framework expects two layers:

```text
docs root      Durable context, runbooks, handoffs, notes, and decisions
code root      Implementation repos, tests, project AGENTS.md, and local goals
```

The exact paths are intentionally operator-specific. Public examples use
placeholder names. Keep real project names, server names, private remotes,
customer names, and internal IPs in ignored private files or a private ops repo.

## Source Framework Repo

This repository owns the reusable operating model:

- docs;
- templates;
- custom agents;
- skills;
- runbooks;
- validation scripts.

The public repository should not contain exact local infrastructure state.

## Project Pairing Convention

Each serious project should have:

- a code root, such as `~/projects/<project>`;
- a docs root, such as `~/docs/<project>`;
- a project `AGENTS.md` in the code root;
- optional `.agentic/` goals, checks, evidence, and runbooks in the code root;
- an entry in local ops when the project maps to a deployed service, server, or
  customer workflow.

Public example:

```text
Name: Example Web App
Code: ~/projects/example-web
Docs: ~/docs/example-web
GitHub: <owner>/<repo>
Role: web application delivery
Workflow: web-project
```

## Server/IaC Project Pairing

The server team should be infrastructure-as-code first. The desired posture is:

```text
inventory -> desired state -> plan -> human approval -> apply -> verify -> evidence
```

Public example:

```text
Name: Example App Host
Code: ~/projects/example-app-host
Docs: ~/docs/example-app-host
GitHub: <owner>/<private-or-public-repo>
Role: Linux app host operations
Workflow: infra-iac
```

Start safely:

1. Inventory current state from docs and read-only recon.
2. Write desired-state notes and module boundaries.
3. Add Terraform/OpenTofu skeletons with no destructive resources.
4. Run `terraform fmt` / `tofu fmt`.
5. Run `terraform validate` / `tofu validate`.
6. Run plan-only commands with reviewed variables and backend.
7. Stop before apply.

Human approval is required for:

- `terraform apply`;
- `terraform destroy`;
- `terraform import`;
- `terraform state *`;
- provider credential changes;
- backend/state changes;
- DNS, firewall, IAM, SSH, service, package, disk, database, or backup changes.

## Local Ops Repo Mapping

The local ops repo should orchestrate cross-project work. It should not replace
project repos or durable project docs. It should point to them and hold
sanitized inventories, goals, runbooks, checklists, tickets, and evidence.

Recommended structure:

```text
local-ops/
  inventory/
    projects.yaml
    servers.yaml
  infrastructure/
    README.md
    stacks/
      example-app-host/
      example-network/
    modules/
  goals/
  evidence/
  runbooks/
  checklists/
  tickets/
```

Project-specific code remains in the project repo. Project-specific notes
remain in the project docs root. Cross-project operational evidence belongs in
local ops.

## Public/Private Split

Use the checked-in examples to document structure and workflow. Use ignored
private files for exact local state:

```text
private/project-map.private.md
private/servers.private.yaml
private/projects.private.yaml
```

Do not commit real server names, internal IPs, customer names, private remotes,
or credential references to the public framework repo.
