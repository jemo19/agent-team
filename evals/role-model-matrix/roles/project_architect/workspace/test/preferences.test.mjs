import test from "node:test";
import assert from "node:assert/strict";
import { clearPreferencesForTest, getPreference, setPreference } from "../src/preferences.mjs";

test("preferences round trip JSON values by user and key", () => {
  clearPreferencesForTest();
  setPreference("user-1", "theme", { mode: "dark" });
  assert.deepEqual(getPreference("user-1", "theme"), { mode: "dark" });
  assert.equal(getPreference("user-2", "theme"), null);
});
