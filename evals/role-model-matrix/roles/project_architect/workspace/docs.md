# Existing Preference Design

`user_preferences.json_value` stores arbitrary JSON behind the domain helpers in
`src/preferences.mjs`. Feature routes own their validation and authorization.
The established UI error state uses an `error` value and restores the previous
optimistic state when a save rejects.
