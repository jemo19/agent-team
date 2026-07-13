export function keysDueForRevocation(keys, now) { return keys.filter((key) => key.revokeAt && key.revokeAt <= now && !key.revokedAt); }
