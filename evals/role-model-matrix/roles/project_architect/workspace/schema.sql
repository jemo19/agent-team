CREATE TABLE user_preferences (
  user_id TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  json_value TEXT NOT NULL,
  PRIMARY KEY (user_id, preference_key)
);
