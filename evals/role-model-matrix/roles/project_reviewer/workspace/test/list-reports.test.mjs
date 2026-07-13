import test from "node:test";
import assert from "node:assert/strict";
import { parseReportLimit } from "../src/list-reports.mjs";

test("defaults a missing limit", () => {
  assert.equal(parseReportLimit(undefined), 20);
});

test("accepts a common limit", () => {
  assert.equal(parseReportLimit("10"), 10);
});
