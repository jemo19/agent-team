import test from "node:test";
import assert from "node:assert/strict";
import { getIncidentResponse } from "../src/route.mjs";

test("returns a successful response", () => {
  const response = getIncidentResponse({ id: "inc-1", status: "investigating", publicMessage: "Checking", internalNote: "private", updatedAt: "2026-07-09T12:00:00Z" });
  assert.equal(response.status, 200);
  assert.equal(response.body.id, "inc-1");
});
