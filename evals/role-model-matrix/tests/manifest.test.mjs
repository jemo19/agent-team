import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { changedPaths, loadSuite, treeManifest, validateOutput, validateRubric } from "../lib/manifest.mjs";

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-manifest-test-"));
  await mkdir(path.join(root, "role", "workspace"), { recursive: true });
  await writeFile(path.join(root, "role", "role.md"), "Role instructions\n");
  await writeFile(path.join(root, "role", "task.md"), "Task instructions\n");
  await writeFile(path.join(root, "role", "workspace", "input.txt"), "before\n");
  await writeFile(path.join(root, "role", "rubric.json"), JSON.stringify({
    version: "1",
    assertions: [{ id: "summary", description: "summary", kind: "output_regex", pattern: "summary", weight: 100, critical: true, dimension: "correctness" }],
  }));
  await writeFile(path.join(root, "suite.json"), JSON.stringify({
    suiteVersion: "1",
    matrix: [{ model: "gpt-5.6-sol", efforts: ["medium"] }],
    baselines: { example: { model: "gpt-5.6-sol", effort: "medium" } },
    roles: [{
      id: "example",
      displayName: "Example",
      sandbox: "read-only",
      roleFile: "role/role.md",
      taskFile: "role/task.md",
      workspace: "role/workspace",
      rubricFile: "role/rubric.json",
      fixture: {
        fixtureId: "example-fixture",
        version: "1.0.0",
        difficulty: "standard",
        taskSummary: "Synthetic manifest fixture",
        instructionSource: "controlled-instruction-surrogate",
        sourceNote: "Test-only controlled surrogate",
      },
      hiddenFiles: [],
      referenceOutputFile: "role/reference-output.json",
      negativeControlOutputFile: "role/negative-control-output.json",
    }],
  }));
  const control = { outcome: "complete", summary: "ok", findings: [], actions: [], checks: [], message: "done" };
  await writeFile(path.join(root, "role", "reference-output.json"), JSON.stringify(control));
  await writeFile(path.join(root, "role", "negative-control-output.json"), JSON.stringify(control));
  const suite = JSON.parse(await readFile(path.join(root, "suite.json"), "utf8"));
  suite.roles[0].hiddenFiles = ["role/reference-output.json", "role/negative-control-output.json"];
  await writeFile(path.join(root, "suite.json"), JSON.stringify(suite));
  return root;
}

test("loads a valid suite and computes deterministic workspace changes", async (t) => {
  const root = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const suite = await loadSuite(path.join(root, "suite.json"));
  assert.equal(suite.roles.length, 1);
  assert.equal(suite.baselines.example.effort, "medium");
  const before = await treeManifest(path.join(root, "role", "workspace"));
  await writeFile(path.join(root, "role", "workspace", "input.txt"), "after\n");
  const after = await treeManifest(path.join(root, "role", "workspace"));
  assert.deepEqual(changedPaths(before, after), ["input.txt"]);
});

test("rejects invalid weights and workspace symlinks", async (t) => {
  assert.match(validateRubric({ version: "1", assertions: [{ id: "x", description: "x", kind: "workspace_unchanged", weight: 90, critical: true, dimension: "scope" }] }).join("\n"), /expected 100/);
  const root = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await symlink("input.txt", path.join(root, "role", "workspace", "link.txt"));
  await assert.rejects(loadSuite(path.join(root, "suite.json")), /forbidden symlink/);
});

test("detects chmod-only workspace changes", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-manifest-mode-test-"));
  const file = path.join(root, "script.mjs");
  await writeFile(file, "export {};\n", { mode: 0o644 });
  t.after(() => rm(root, { recursive: true, force: true }));
  const before = await treeManifest(root);
  await chmod(file, 0o755);
  const after = await treeManifest(root);
  assert.deepEqual(changedPaths(before, after), ["script.mjs"]);
});

test("fingerprints hidden graders and rejects hidden files staged in the workspace", async (t) => {
  const root = await makeFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const suiteFile = path.join(root, "suite.json");
  const suite = JSON.parse(await readFile(suiteFile, "utf8"));
  await writeFile(path.join(root, "role", "hidden.txt"), "first\n");
  suite.roles[0].hiddenFiles.push("role/hidden.txt");
  await writeFile(suiteFile, JSON.stringify(suite));
  const first = await loadSuite(suiteFile);
  await writeFile(path.join(root, "role", "hidden.txt"), "second\n");
  const second = await loadSuite(suiteFile);
  assert.notEqual(first.roles[0].fingerprint, second.roles[0].fingerprint);

  suite.roles[0].hiddenFiles = ["role/reference-output.json", "role/negative-control-output.json", "role/workspace/input.txt"];
  await writeFile(suiteFile, JSON.stringify(suite));
  await assert.rejects(loadSuite(suiteFile), /outside the staged workspace/);
});

test("validates field-scoped and trace-based assertion contracts", () => {
  const errors = validateRubric({
    version: "2",
    assertions: [
      { id: "content", description: "content", kind: "output_all", field: "findings", patterns: ["one", "two"], weight: 70, critical: true, dimension: "correctness" },
      { id: "delegation", description: "delegation", kind: "subagent_count", minimum: 2, maximum: 6, weight: 30, critical: false, dimension: "evidence" },
    ],
  });
  assert.deepEqual(errors, []);
  assert.match(validateRubric({
    version: "2",
    assertions: [
      { id: "content", description: "content", kind: "output_all", field: "findings", patterns: ["one"], pattern: "legacy", weight: 100, critical: true, dimension: "correctness" },
    ],
  }).join("\n"), /unsupported for output_all/);

  assert.deepEqual(validateRubric({
    version: "2",
    assertions: [
      { id: "concept", description: "concept", kind: "output_all", fields: ["summary", "findings"], patterns: ["approved contact"], normalizers: ["unicode-punctuation", "hyphen-as-space"], weight: 100, critical: true, dimension: "correctness" },
    ],
  }), []);
  assert.match(validateRubric({
    version: "2",
    assertions: [
      { id: "ambiguous", description: "ambiguous", kind: "output_all", field: "summary", fields: ["findings"], patterns: ["x"], weight: 100, critical: true, dimension: "correctness" },
    ],
  }).join("\n"), /exactly one of field or fields/);
});

test("validates the strict final output shape", () => {
  assert.deepEqual(validateOutput({ outcome: "complete", summary: "ok", findings: [], actions: [], checks: [], message: "done" }), []);
  assert.match(validateOutput({ outcome: "maybe" }).join("\n"), /outcome|missing/);
});
