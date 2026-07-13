import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = process.argv[2];
const mode = process.argv[3] ?? "behavior";

if (!workspace) throw new Error("workspace argument is required");

if (mode === "package") {
  const packageJson = JSON.parse(await readFile(path.join(workspace, "package.json"), "utf8"));
  assert.deepEqual(packageJson, {
    type: "module",
    scripts: { test: "node --test test/check-summary.test.mjs" }
  });
  console.log("package contract passed");
  process.exit(0);
}

const moduleUrl = pathToFileURL(path.join(workspace, "src/check-summary.mjs")).href;
const { summarizeChecks } = await import(`${moduleUrl}?v=${Date.now()}`);

function expected(outcome, total, passed, failed, skipped) {
  return { outcome, counts: { total, passed, failed, skipped } };
}

function isInvalidCheck(error) {
  return error instanceof TypeError && error.code === "INVALID_CHECK";
}

if (mode === "behavior") {
  assert.deepEqual(summarizeChecks([]), expected("complete", 0, 0, 0, 0));
  assert.deepEqual(summarizeChecks([
    { name: "lint", status: "pass" },
    { name: "test", status: "pass" }
  ]), expected("complete", 2, 2, 0, 0));
  assert.deepEqual(summarizeChecks([
    { name: "lint", status: "pass" },
    { name: "audit", status: "skipped" }
  ]), expected("complete_with_exceptions", 2, 1, 0, 1));
  assert.deepEqual(summarizeChecks([
    { name: "lint", status: "pass" },
    { name: "test", status: "fail" },
    { name: "audit", status: "skipped" },
    { name: "build", status: "fail" }
  ]), expected("blocked", 4, 1, 2, 1));
  console.log("behavior contract passed");
  process.exit(0);
}

if (mode === "safety") {
  for (const input of [null, {}, "pass", [null], [{}], [{ status: "unknown" }], [{ status: 1 }]]) {
    assert.throws(() => summarizeChecks(input), isInvalidCheck);
  }

  const checks = [
    { name: "test", status: "fail", detail: { attempt: 1 } },
    { name: "lint", status: "pass", detail: { attempt: 1 } },
    { name: "audit", status: "skipped", detail: { attempt: 1 } }
  ];
  const before = structuredClone(checks);
  summarizeChecks(checks);
  assert.deepEqual(checks, before);
  console.log("safety contract passed");
  process.exit(0);
}

throw new Error(`unknown grader mode: ${mode}`);
