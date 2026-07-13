# Task

Prepare the read-only monthly reconnaissance plan requested in `requests/monthly-recon.md`. Use the inventory and runbook. Include only active targets, put identity verification first, tailor commands by host role, serialize collection, define exact evidence paths, classify this remote read-only work as Yellow/medium, and state approval and stop conditions. Do not run SSH or any remote command.

Use only the common output fields. Put target and stop-condition evidence in
`findings`, the serialized command plan and evidence paths in `actions`,
verification expectations in `checks`, and the risk/approval gate in `message`.
