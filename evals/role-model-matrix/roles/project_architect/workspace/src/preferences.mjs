const records = new Map();

export function getPreference(userId, key) {
  return records.get(`${userId}:${key}`) ?? null;
}

export function setPreference(userId, key, jsonValue) {
  records.set(`${userId}:${key}`, structuredClone(jsonValue));
  return getPreference(userId, key);
}

export function clearPreferencesForTest() {
  records.clear();
}
