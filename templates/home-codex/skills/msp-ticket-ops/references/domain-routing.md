# Domain Routing

The coordinator owns lifecycle and evidence, not universal execution.

| Domain | Skill | Agent/owner | Boundary |
| --- | --- | --- | --- |
| Linux host/service | `$linux-server-maintenance` | `infra_recon`, `infra_planner`, then an explicitly authorized operator | Inventory-backed recon/change packet; planners do not execute |
| Terraform/OpenTofu | `$infrastructure-as-code-ops` | `iac_planner`, then authorized IaC operator | Local source, plan/state safety; apply/state operations remain separate gates |
| Local web application | `$web-project-delivery` | `web_scout` when needed, `web_builder` for bounded code | No deployment or real database apply from the delivery workflow |
| Security/trust boundary | Owning technical workflow | `risk_reviewer` plus the domain owner | Reviewer finds risk; does not authorize or implement |
| Complex infrastructure diagnosis | Relevant infra skill | `infra_recon` or `infra_planner`; higher-tier owner if named locally | Read-only planning unless exact remote authority is passed |
| Customer communication | This lifecycle | `customer_comms` | Draft only; sending/PSA update is a separate explicit write |
| Unknown domain | Narrowest documented owner | Extension point | Do not route by guess or make triage the executor |

No dedicated write-capable Linux/customer-system executor was found in the inspected agent definitions. Preserve the execution owner as an explicit human/operator or locally documented agent rather than inventing one.

## Handoff packet

- Ticket ID and minimal customer context
- Verified customer, requester, target/asset, and trusted source
- Authorized scope, authorization source, window, and exclusions
- Classification, risk/severity, and acceptance criteria
- Minimal redacted evidence and labeled hypotheses
- Constraints, stop conditions, and communication impact
- Required verification and rollback expectation
- Required return: exact targets; work/commands/changes; evidence; verification; rollback status; residual risk; incomplete work; checks not run

Do not include unnecessary PII, raw secrets, attachments, full email chains, or entire ticket histories.
