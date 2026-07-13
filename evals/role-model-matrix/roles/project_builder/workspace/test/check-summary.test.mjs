import test from "node:test";
import assert from "node:assert/strict";
import { scheduleChecks } from "../src/check-summary.mjs";

test("independent checks share a sorted layer", () => {
  assert.deepEqual(scheduleChecks([
    { id: "test", dependsOn: [] },
    { id: "lint", dependsOn: [] },
  ]), [["lint", "test"]]);
});

test("dependencies create later layers", () => {
  assert.deepEqual(scheduleChecks([
    { id: "build", dependsOn: ["lint", "test"] },
    { id: "test", dependsOn: [] },
    { id: "lint", dependsOn: [] },
  ]), [["lint", "test"], ["build"]]);
});
