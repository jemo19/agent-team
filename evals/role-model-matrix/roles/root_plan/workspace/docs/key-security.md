# Key Security Contract

Use `requireOrgAdmin`. Permit both hashes during the 15-minute overlap. Emit `org.api_key.rotated` without raw key material. Concurrent rotations must not leave more than two active keys. Cleanup owns expiration.
