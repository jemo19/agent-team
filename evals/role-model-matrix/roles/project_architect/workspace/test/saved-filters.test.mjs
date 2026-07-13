import test from "node:test";
import assert from "node:assert/strict";
import { getSavedFilters } from "../src/api/saved-filters.mjs";

test("saved filters require authentication", () => {
  assert.throws(() => getSavedFilters({}), (error) => error.code === "UNAUTHORIZED");
});
