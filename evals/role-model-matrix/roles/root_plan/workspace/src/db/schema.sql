CREATE TABLE org_api_keys (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, key_hash TEXT NOT NULL, created_at TEXT NOT NULL, revoke_at TEXT, revoked_at TEXT);
