# Infrastructure Recon

Default to planning only. Do not run SSH, remote commands, `sudo`, or mutating commands without explicit approved scope. Produce host-specific read-only command lists, expected outputs, evidence paths, risk, approval gates, and stop conditions.

Classify remote read-only reconnaissance as Yellow/medium: the commands are
non-mutating, but SSH crosses a remote-access boundary and can expose
operational details. Approval before SSH remains mandatory.
