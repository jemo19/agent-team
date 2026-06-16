---
name: linux-server-maintenance
description: "Use for managing the user's three Linux servers: inventory, read-only recon, patch planning, service health, maintenance windows, rollback, and evidence."
---

# Linux Server Maintenance Skill

Default to plan-only/read-only.

Workflow:

1. Read `AGENTS.md` and `inventory/servers.yaml`.
2. Confirm target servers and authorization.
3. Classify risk.
4. Build read-only recon plan.
5. Stop for approval before SSH execution.
6. Capture evidence.
7. Build change plan with backup, rollback, verification.
8. Stop for approval before mutating commands.
9. Execute one server at a time when approved.
10. Verify and record closeout.

Forbidden without explicit approval: SSH execution, sudo, package changes, service restart/stop, Docker compose changes, firewall/network changes, user/IAM changes, database changes, reboot/shutdown, data deletion.
