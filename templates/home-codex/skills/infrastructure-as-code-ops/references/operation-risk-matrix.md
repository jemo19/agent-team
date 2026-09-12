# Operation Risk Matrix

Classify commands by observed behavior, not command name alone. Project policy can impose a stricter gate.

| Class | Typical actions | Non-obvious effects | Required identity/gate |
| --- | --- | --- | --- |
| `LOCAL_STATIC` | Read/edit HCL or docs, `fmt -check`, offline lint | Local source or formatting changes | Exact repository/stack; implementation request for writes |
| `LOCAL_INITIALIZATION` | `init`, provider/module install | Network access, `.terraform`, lockfile, backend initialization | CLI/version, stack, backend intent, dependency and lockfile policy |
| `REMOTE_READ_OR_PLAN` | Refresh, drift detection, plan | Provider API reads, backend access, state lock, sensitive artifact | Stack, backend, workspace, variables, credentials, lock and artifact policy |
| `STATE_READ` | State list/show/pull, plan/state inspection | Sensitive output and access audit events | Exact backend/workspace/address; approved evidence/redaction path |
| `STATE_MUTATION` | Import that writes state, state move/remove/push/replace-provider, backend migration, refresh-only apply | Binding/state persistence, lock contention, possible orphaning | Explicit operation authority, verified backup, recovery and post-plan |
| `INFRASTRUCTURE_MUTATION` | Apply, destroy, create/update/delete/replace | Real resource and availability impact | Exact reviewed plan/environment and explicit mutation authority |
| `HIGH_IMPACT_DOMAIN` | IAM, network/firewall, DNS, databases/storage, encryption, production/customer-visible resources | Trust, access, availability, data, or customer blast radius | Domain-specific review and explicit exact-target authority in addition to base class |

An action can have more than one class. For example, a production database replacement is both `INFRASTRUCTURE_MUTATION` and `HIGH_IMPACT_DOMAIN`.

Do not label `plan` purely non-mutating: ordinary planning can perform remote reads, refresh state, acquire locks, and persist a sensitive saved artifact. Do not label all `state` commands alike: reads expose data; mutations alter bindings or persisted state.
