import test from "node:test";
import assert from "node:assert/strict";
import { summarizeChecks } from "../src/check-summary.mjs";

test("all passing checks are complete", () => {
  assert.deepEqual(summarizeChecks([
    { name: "lint", status: "pass" },
    { name: "test", status: "pass" }
  ]), {
    outcome: "complete",
    counts: { total: 2, passed: 2, failed: 0, skipped: 0 }
  });
});

test("a failed check blocks completion", () => {
  assert.equal(summarizeChecks([
    { name: "lint", status: "pass" },
    { name: "test", status: "fail" }
  ]).outcome, "blocked");
});
