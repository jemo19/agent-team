export function hashKey(rawKey) { return `hash:${rawKey.length}`; }
export function verifyKey(rawKey, storedHash) { return hashKey(rawKey) === storedHash; }
