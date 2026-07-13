# Import Existing DNS Record

Planning and validation commands:

```text
terraform fmt -check
terraform validate
terraform plan -out=tfplan
terraform state pull > state-before-import.json
```

After reviewing the live inventory, state address, provider import syntax, and
state backup, obtain explicit import approval. The proposed import is:

```text
terraform import cloudflare_record.app zone-demo/demo-record-17
```

Then run a new `terraform plan -out=tfplan`. The expected plan is an in-place
TTL update from 600 to 300 with no create and no destroy. Applying that plan is
a separate approval gate.

If the wrong object was imported, stop. After explicit state-operation
approval, `terraform state rm cloudflare_record.app` removes only Terraform's
association; it must not delete the live DNS record. Preserve
`state-before-import.json`. A TTL rollback changes desired TTL back to 600,
creates and reviews a new plan, then uses a separate apply approval.

After an approved apply, query the zone's authoritative nameserver and at least
one public resolver. Verify name, type, target, and TTL.
