# Organization API-Key Rotation

An organization admin can create a replacement key. Old and new keys overlap for 15 minutes, then cleanup revokes the old key. Record an audit event. Store only hashes and return the new raw key once. No database migration is allowed.
