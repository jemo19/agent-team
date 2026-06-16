# Read-Only Server Recon Runbook

Use only on systems you are authorized to administer.

Suggested commands:

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

Do not use sudo unless explicitly approved.
