import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const workspace = process.argv[2];
const { getIncidentResponse } = await import(pathToFileURL(path.join(workspace, "src/route.mjs")).href + `?v=${Date.now()}`);
for (const [status, publicMessage, expectedMessage] of [
  ["investigating", "Checking", "Checking"],
  ["monitoring", "Watching", "Watching"],
  ["resolved", "Restored", "Restored"],
  ["monitoring", "", "Update pending."],
]) {
  const incident = { id: `inc-${status}`, status, publicMessage, internalNote: "operator-only", updatedAt: "2026-07-09T12:00:00Z", databaseOnly: "hidden" };
  const response = getIncidentResponse(incident);
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(response.body).sort(), ["id", "message", "status", "updatedAt"]);
  assert.equal(response.body.status, status);
  assert.equal(response.body.message, expectedMessage);
}
console.log("root incident contract passed");
