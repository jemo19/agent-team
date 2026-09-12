# Infrastructure as Code

This folder is for server desired-state planning and Terraform/OpenTofu workflows.

Start with inventory and read-only recon. Do not run state-changing IaC commands until the plan, backend/state safety, rollback, and verification are reviewed.

Suggested layout:

```text
infrastructure/
  stacks/
    example-app-host/
    example-network/
    example-monitoring/
  modules/
```

Routine preparation:

- Read existing `.tf` files.
- Run `terraform fmt -check` or `tofu fmt -check`.
- Run `terraform validate` or `tofu validate`.
- Prepare a plan command for review.

Requires exact target, reviewed plan/state safety, rollback, verification, and
an objective that includes mutation; no second operator prompt is added:

- `terraform apply` / `tofu apply`
- `terraform destroy` / `tofu destroy`
- `terraform import` / `tofu import`
- `terraform state *` / `tofu state *`
- backend/state changes
- provider credential changes
- DNS, firewall, IAM, SSH, package, service, disk, database, or backup changes
