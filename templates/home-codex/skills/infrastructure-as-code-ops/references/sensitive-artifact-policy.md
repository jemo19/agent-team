# Sensitive Artifact Policy

Terraform/OpenTofu state and saved plans may contain resource attributes, input values, provider data, prior state, backend configuration, and other secrets or sensitive metadata. Local state is commonly plaintext. Remote encryption and access controls depend on the selected backend and its configuration.

Marking an input or output `sensitive` commonly redacts normal display. It does not by itself remove the value from state or saved plans, or encrypt the artifact. Machine-readable output such as `show -json`, state pull, and raw outputs can reveal values hidden in normal terminal output.

## Handling rules

- Never commit state, saved plans, raw plan/state JSON, credential-bearing `.tfvars` or environment files, raw environment dumps, or backend secret configuration.
- Do not paste raw artifacts into chat, tickets, evidence, or repository files.
- Store remote state only in an approved access-controlled backend, with encryption and locking when supported and configured.
- Store a necessary saved plan in a protected non-repository path with least-privilege access and bounded retention; record identity metadata separately in redacted form.
- Summarize only resource addresses, action types, counts, risks, and non-sensitive conclusions.
- Do not inspect or export more data than the decision requires.
- Prefer secret-manager references and provider-supported mechanisms. Use ephemeral values or write-only arguments only after verifying support in the installed CLI and provider versions.
- Never promise that every sensitive value can be excluded from IaC artifacts.

Delete or retain artifacts only under the documented policy for that backend/workflow. Confirm removal without echoing contents.
