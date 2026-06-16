# Terraform/OpenTofu Workflow

Use for infrastructure-as-code work on server projects.

## Plan-only start

1. Read `inventory/projects.yaml`, `inventory/servers.yaml`, project docs, and stack files.
2. Confirm target stack and environment.
3. Confirm backend/state location without printing secrets.
4. Identify whether the work is drift review, import, new desired state, or cleanup.
5. Produce exact commands before running them.

## Safe checks

```bash
terraform fmt -check
terraform validate
terraform plan
```

Use `tofu` equivalents when the stack uses OpenTofu.

## Stop for approval

Stop before:

- apply
- destroy
- import
- state operations
- provider credential changes
- backend changes
- DNS/firewall/IAM/SSH/service/package/disk/database/backup changes

## Evidence

Record:

- stack
- backend/state reference
- command plan
- plan summary
- risk class
- approval
- apply output summary, if approved
- verification
- rollback/follow-up
