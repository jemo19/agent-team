# App Upgrade Runbook

All commands below are proposed commands. They require the change gate named in
the plan and must not be executed during planning.

## Protection and precheck

```text
backupctl create --database appdb --label pre-v2
backupctl verify-restore --database appdb --latest
appctl migration status --database appdb
```

## Expand migration

```text
appctl migrate --database appdb --to v2 --expand-only
appctl migration status --database appdb
```

## Rolling deployment

For `app1`, then for `app2` only after the preceding instance is healthy:

```text
lbctl drain app1
appctl deploy app1 --image registry.demo.test/app:v2.0.0
curl -fsS https://app1.demo.test/health
lbctl enable app1

lbctl drain app2
appctl deploy app2 --image registry.demo.test/app:v2.0.0
curl -fsS https://app2.demo.test/health
lbctl enable app2
```

Check application error rate, latency, database errors, and load-balancer target
health after every mutation. Stop before the next mutation on any failed health
check, elevated error rate, migration error, or inability to restore traffic.

## Rollback proposals

Drain the affected instance, deploy
`registry.demo.test/app:v1.8.4`, verify health, then re-enable it. Because the
migration is nullable and backward-compatible, prefer leaving the expand-only
schema in place. A database rollback or restore is a separate data-impacting
decision requiring explicit approval and a verified recovery point:

```text
appctl migrate --database appdb --to v1 --rollback
```
