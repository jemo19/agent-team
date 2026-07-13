import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = process.argv[2];
const mode = process.argv[3] ?? "core";
const { paginateRecords } = await import(pathToFileURL(path.join(workspace, "src/pagination.mjs")).href + `?v=${Date.now()}`);
const stamp = "2026-07-13T12:00:00.000Z";
const records = [
  { id: "z", createdAt: "2026-07-14T12:00:00.000Z", value: 0 },
  { id: "a", createdAt: stamp, value: 2 },
  { id: "A", createdAt: stamp, value: 1 },
  { id: "b", createdAt: stamp, value: 3 },
  { id: "d", createdAt: "2026-07-12T12:00:00.000Z", value: 4 },
];

function decodeCanonicalCursor(raw) {
  assert.match(raw, /^[A-Za-z0-9_-]+$/);
  const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  assert.deepEqual(Object.keys(value), ["v", "createdAt", "id"]);
  assert.equal(value.v, 1);
  assert.equal(typeof value.createdAt, "string");
  assert.equal(typeof value.id, "string");
  assert.equal(Buffer.from(JSON.stringify(value)).toString("base64url"), raw);
  return value;
}

if (mode === "core") {
  const first = paginateRecords(records, { limit: "3" });
  assert.deepEqual(first.items.map(({ id }) => id), ["z", "A", "a"]);
  const second = paginateRecords([...records].reverse(), { limit: "2", cursor: first.nextCursor });
  assert.deepEqual(second.items.map(({ id }) => id), ["b", "d"]);
  assert.equal(second.nextCursor, null);
  console.log("core pagination contract passed");
  process.exit(0);
}

if (mode === "cursor") {
  const first = paginateRecords(records, { limit: "3" });
  assert.deepEqual(decodeCanonicalCursor(first.nextCursor), { v: 1, createdAt: stamp, id: "a" });
  assert.deepEqual(paginateRecords(records, { limit: "3", cursor: first.nextCursor }).items.map(({ id }) => id), ["b", "d"]);
  const malformed = [
    "not-base64!",
    Buffer.from("not-json").toString("base64url"),
    Buffer.from(JSON.stringify({ v: 2, createdAt: stamp, id: "a" })).toString("base64url"),
    Buffer.from(JSON.stringify({ v: 1, createdAt: 7, id: "a" })).toString("base64url"),
    Buffer.from(JSON.stringify({ v: 1, createdAt: stamp, id: "a", extra: true })).toString("base64url"),
    Buffer.from(JSON.stringify({ id: "a", createdAt: stamp, v: 1 })).toString("base64url"),
  ];
  for (const cursor of malformed) {
    assert.throws(() => paginateRecords(records, { cursor }), (error) => error instanceof TypeError && error.code === "INVALID_CURSOR");
  }
  console.log("cursor contract passed");
  process.exit(0);
}

if (mode === "safety") {
  const many = Array.from({ length: 101 }, (_, index) => ({ id: String(index).padStart(3, "0"), createdAt: stamp }));
  const before = structuredClone(many);
  assert.equal(paginateRecords(many).items.length, 25);
  assert.equal(paginateRecords(many, { limit: "1" }).items.length, 1);
  assert.equal(paginateRecords(many, { limit: "01" }).items.length, 1);
  assert.equal(paginateRecords(many, { limit: "100" }).items.length, 100);
  for (const cursor of [undefined, null, ""]) assert.deepEqual(paginateRecords(records, { limit: "2", cursor }).items.map(({ id }) => id), ["z", "A"]);
  for (const raw of ["0", "101", "999"]) {
    assert.throws(() => paginateRecords(records, { limit: raw }), (error) => error instanceof RangeError && error.code === "PAGE_SIZE_OUT_OF_RANGE");
  }
  for (const raw of [null, "", "10abc", " 10 ", "1.5", "+2", "-2", 10, {}, "０１"]) {
    assert.throws(() => paginateRecords(records, { limit: raw }), (error) => error instanceof TypeError && error.code === "INVALID_PAGE_SIZE");
  }
  paginateRecords(many, { limit: "3" });
  assert.deepEqual(many, before);
  console.log("safety contract passed");
  process.exit(0);
}

throw new Error(`unknown grader mode: ${mode}`);
