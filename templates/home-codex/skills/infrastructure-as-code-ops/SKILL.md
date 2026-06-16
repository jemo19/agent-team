---
name: infrastructure-as-code-ops
description: Use for Terraform/OpenTofu server workflows, desired state, drift review, imports, plans, state safety, IaC validation, and gated infrastructure changes.
---

# Infrastructure as Code Ops Skill

Default to plan-only/read-only until a human approves exact commands.

Workflow:

1. Read `AGENTS.md`, project docs, inventory, and existing Terraform/OpenTofu files.
2. Identify the target stack, environment, backend/state location, providers, and credentials policy.
3. Classify risk: Green for read-only/fmt/validate/plan, Yellow for reversible desired-state changes, Red for apply/destroy/import/state/security/network/data-impacting work.
4. Build a desired-state plan and drift notes before editing.
5. Run only non-mutating checks unless approved: `terraform fmt -check`, `terraform validate`, `terraform plan` or `tofu` equivalents.
6. Stop for approval before `apply`, `destroy`, `import`, `state`, provider credential changes, backend changes, DNS, firewall, IAM, SSH, package, service, disk, database, or backup changes.
7. Capture plan output summaries and evidence.
8. Execute one stack at a time when approved.
9. Verify service health and record closeout.

Never store secrets in Terraform variables, state, plans, docs, repo files, or chat. Use password-manager or environment references only.
