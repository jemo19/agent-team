import test from "node:test";
import assert from "node:assert/strict";
import { paginateRecords } from "../src/pagination.mjs";

const records = [
  { id: "b", createdAt: "2026-07-12T12:00:00.000Z" },
  { id: "a", createdAt: "2026-07-13T12:00:00.000Z" },
];

test("returns a bounded page", () => {
  assert.deepEqual(paginateRecords(records, { limit: "1" }).items.map(({ id }) => id), ["a"]);
});

test("rejects a malformed limit", () => {
  assert.throws(() => paginateRecords(records, { limit: "1x" }), { code: "INVALID_PAGE_SIZE" });
});
