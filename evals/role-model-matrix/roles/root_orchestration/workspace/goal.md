# Public Incident Summary

Return exactly `{ id, status, message, updatedAt }`. Preserve the statuses `investigating`, `monitoring`, and `resolved`. Use `publicMessage`, or `Update pending.` when it is empty. Never expose `internalNote` or any extra database field. Keep the existing route response shape `{ status: 200, body }`.
