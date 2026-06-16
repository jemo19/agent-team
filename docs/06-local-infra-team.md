# 06 — Local Infra Team for Three Linux Servers

## Purpose

The local infra team helps manage your three Linux servers. It is not a free-roaming root automation bot. It is a planning, recon, checklist, verification, and documentation assistant with guarded execution.

## Control repo

Use:

```text
~/agentic-team/local-ops/
```

Important files:

```text
AGENTS.md
inventory/servers.yaml
scripts/readonly-host-check.sh
scripts/service-health-check.sh
runbooks/
checklists/
goals/
evidence/
```

## Inventory model

Each server should have:

- ID.
- Hostname.
- SSH alias.
- Role.
- Environment.
- Critical services.
- Backup method.
- Maintenance window.
- Reboot policy.
- Owner.
- Notes.

Do not put credentials in inventory.

## Risk classes

### Green

Read-only. No service impact.

Examples:

- Check uptime.
- Check disk.
- Check failed systemd units.
- Check package updates available.
- Check Docker container status.
- Summarize logs.

### Yellow

Reversible changes with possible service impact.

Examples:

- Restart a non-critical service.
- Apply routine package updates.
- Change app config with rollback.
- Docker compose pull/up for a non-critical service.

### Red

Privileged, destructive, security-sensitive, or customer-visible.

Examples:

- Firewall changes.
- User/IAM changes.
- SSH changes.
- Major OS upgrade.
- Database migration.
- Disk/partition operations.
- Backup retention deletion.
- Any command whose failure can lock you out.

## Read-only recon command set

Safe candidates, adjusted per distro:

```bash
hostnamectl
uptime
who -b
free -h
df -hT
lsblk -f
systemctl --failed --no-pager
journalctl -p err -b --no-pager | tail -100
ss -tulpn
ip -brief addr
ip route
findmnt
ps aux --sort=-%mem | head -20
ps aux --sort=-%cpu | head -20
```

Package state:

```bash
apt list --upgradable 2>/dev/null | head -100
needrestart -b 2>/dev/null || true
```

Docker state if applicable:

```bash
docker ps --format 'table {{.Names}}	{{.Image}}	{{.Status}}	{{.Ports}}'
docker compose ls 2>/dev/null || true
```

These are still remote commands. Run them only against servers you own/administer and only with your approval.

## Standard maintenance workflow

### Phase A — Goal contract

Example:

```text
Goal: Monthly patch review for srv1, srv2, srv3.
Risk: Yellow if patching occurs; Green for read-only recon.
Allowed now: read-only recon only.
Forbidden now: sudo apt upgrade, reboot, service restart, file edits, firewall changes.
```

### Phase B — Parallel planning

Parallelize:

- `infra_recon`: read inventory and propose read-only recon commands per host.
- `infra_planner`: build maintenance plan and risk matrix.
- `customer_comms` if any MSP customers are affected.

### Phase C — Read-only recon

Run one server at a time unless you are certain commands are read-only and low load.

Capture output to evidence.

### Phase D — Change plan

For each server:

- Current state.
- Proposed commands.
- Expected impact.
- Backup status.
- Rollback.
- Verification.
- Reboot required?
- Maintenance window.

### Phase E — Human gate

You approve exact commands.

### Phase F — Execute serialized

For three servers, patch one at a time:

1. Pre-check.
2. Backup/restore confidence check.
3. Apply change.
4. Verify service health.
5. Wait if needed.
6. Proceed to next server.

### Phase G — Closeout

Record:

- Versions before/after.
- Services restarted.
- Reboot status.
- Tests/health checks.
- Incidents.
- Follow-ups.

## Incident triage workflow

1. Define symptom and affected server/service.
2. Start read-only.
3. Capture current state before changing anything.
4. Identify recent changes.
5. Check logs.
6. Form hypothesis.
7. Propose minimal reversible action.
8. Approve.
9. Execute one action.
10. Verify.
11. Continue or rollback.

## What Codex may do

Codex may:

- Read inventory and runbooks.
- Prepare command plans.
- Summarize command output.
- Compare before/after state.
- Draft maintenance windows.
- Create evidence files.
- Draft post-maintenance reports.

Codex must stop for approval before:

- SSH execution if not already approved for that goal.
- `sudo`.
- `systemctl restart|stop|disable|enable`.
- Package install/upgrade/remove.
- Docker compose up/down/pull/restart.
- Firewall/network changes.
- User/group/SSH changes.
- `/etc` edits.
- Database changes.
- Reboots/shutdowns.
