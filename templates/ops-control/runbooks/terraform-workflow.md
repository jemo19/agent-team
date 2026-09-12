# Terraform/OpenTofu Workflow

Use for infrastructure-as-code work on server projects.

## Plan-only start

1. Read `inventory/projects.yaml`, `inventory/servers.yaml`, project docs, and stack files.
2. Resolve the target stack and environment from the objective and trusted inventory.
3. Verify backend/state location without printing secrets.
4. Identify whether the work is drift review, import, new desired state, or cleanup.
5. Produce exact commands before running them.

## Safe checks

```bash
terraform fmt -check
terraform validate
terraform plan
```

Use `tofu` equivalents when the stack uses OpenTofu.

## Root execution check

Before these actions, the root verifies exact target, plan, state safety,
rollback/abort conditions, and objective authority, then proceeds:

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
- objective/external authorization evidence
- apply output summary, if applied
- verification
- rollback/follow-up
