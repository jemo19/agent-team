# Task

Review the synthetic Cloudflare DNS stack. Explain why the current plan wants
to create `cloudflare_record.app`, then produce a state-safe plan to reconcile
the already-existing record with Terraform. Plan only: do not run Terraform,
edit files, import state, apply, destroy, or access DNS.

Include exact proposed commands, separate human gates for import and apply,
state protection, the expected post-import plan, verification, stop conditions,
and a non-destructive rollback. State whether the backend and configuration
should change.

Use only the common output fields. Put the operator plan in `summary`,
`findings`, `actions`, and `checks`; use `message` for the next approval gate.
