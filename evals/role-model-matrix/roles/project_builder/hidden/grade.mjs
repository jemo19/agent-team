import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = process.argv[2];
const mode = process.argv[3] ?? "behavior";
if (!workspace) throw new Error("workspace argument is required");

if (mode === "package") {
  const packageJson = JSON.parse(await readFile(path.join(workspace, "package.json"), "utf8"));
  assert.deepEqual(packageJson, { type: "module", scripts: { test: "node --test test/check-summary.test.mjs" } });
  console.log("package contract passed");
  process.exit(0);
}

const { scheduleChecks } = await import(`${pathToFileURL(path.join(workspace, "src/check-summary.mjs")).href}?v=${Date.now()}`);
const check = (id, dependsOn = []) => ({ id, dependsOn });

if (mode === "behavior") {
  assert.deepEqual(scheduleChecks([]), []);
  assert.deepEqual(scheduleChecks([check("test"), check("lint")]), [["lint", "test"]]);
  const graph = [
    check("deploy", ["integration", "build"]),
    check("lint"),
    check("build", ["lint"]),
    check("docs"),
    check("integration", ["unit"]),
    check("unit", ["lint"]),
  ];
  const expected = [["docs", "lint"], ["build", "unit"], ["integration"], ["deploy"]];
  assert.deepEqual(scheduleChecks(graph), expected);
  assert.deepEqual(scheduleChecks([...graph].reverse()), expected);
  console.log("behavior contract passed");
  process.exit(0);
}

if (mode === "safety") {
  const invalid = (value) => assert.throws(() => scheduleChecks(value), (error) => error instanceof TypeError && error.code === "INVALID_CHECK_GRAPH");
  for (const value of [null, {}, "checks", [null], [{}], [check("")], [{ id: "a" }], [{ id: "a", dependsOn: "b" }], [check("a"), check("a")], [check("a", ["b", "b"])]]) invalid(value);
  invalid([check("a", ["missing"])]);
  invalid([check("a", ["a"])]);
  for (const graph of [
    [check("a", ["b"]), check("b", ["a"])],
    [check("a", ["b"]), check("b", ["c"]), check("c", ["a"])],
    [check("ready"), check("a", ["b"]), check("b", ["a"])],
  ]) {
    assert.throws(() => scheduleChecks(graph), (error) => error instanceof Error && !(error instanceof TypeError) && error.code === "CHECK_GRAPH_CYCLE");
  }
  const graph = [check("build", ["lint", "test"]), check("test"), check("lint")];
  const before = structuredClone(graph);
  scheduleChecks(graph);
  assert.deepEqual(graph, before);
  console.log("safety contract passed");
  process.exit(0);
}

throw new Error(`unknown grader mode: ${mode}`);
