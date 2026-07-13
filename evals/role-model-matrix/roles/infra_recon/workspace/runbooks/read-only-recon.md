# Read-Only Recon Runbook

Run one host at a time after the operator approves SSH. Start with `hostnamectl`; stop if identity does not match inventory. Base commands are `uptime`, `free -h`, `df -hT`, and `systemctl --failed --no-pager`. On the web host add `docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'`. On the database host add `systemctl is-active postgresql`. Do not use `sudo` or mutate anything.

Capture each host in `evidence/2026-07-09/monthly-recon/<host>.txt`. Stop on identity mismatch, unexpected privilege prompts, high resource pressure, unavailable commands, or evidence suggesting a change is required.
