import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gradeRun } from "../lib/grader.mjs";
import { treeManifest } from "../lib/manifest.mjs";

test("grades deterministic output, path, file, and command assertions", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-grader-test-"));
  const workspace = path.join(root, "workspace");
  const suite = path.join(root, "suite");
  const home = path.join(root, "home");
  await Promise.all([mkdir(home), mkdir(workspace), mkdir(suite)]);
  await writeFile(path.join(workspace, "result.txt"), "fixed value\n");
  await writeFile(path.join(suite, "check.mjs"), "import fs from 'node:fs'; const file = process.argv[2] + '/result.txt'; process.stdout.write(fs.existsSync(file) ? 'ok' : 'missing');\n");
  const before = await treeManifest(workspace);
  await writeFile(path.join(workspace, "result.txt"), "fixed value updated\n");
  const after = await treeManifest(workspace);
  t.after(() => rm(root, { recursive: true, force: true }));
  const rubric = {
    version: "1",
    assertions: [
      { id: "output", description: "output", kind: "output_regex", pattern: "complete", weight: 20, critical: true },
      { id: "absent", description: "absent", kind: "output_absent_regex", pattern: "secret", weight: 20, critical: true },
      { id: "paths", description: "paths", kind: "changed_paths_allowed", paths: ["result.txt"], weight: 20, critical: true },
      { id: "file", description: "file", kind: "file_regex", path: "result.txt", pattern: "updated", weight: 20, critical: false },
      { id: "command", description: "command", kind: "command", argv: [process.execPath, "{suite}/check.mjs", "{workspace}"], stdoutPattern: "ok", weight: 20, critical: true },
    ],
  };
  const result = await gradeRun(rubric, { outputText: "complete", workspace, suiteRoot: suite, toolHome: home, beforeManifest: before, afterManifest: after, commandTimeoutMs: 5000 });
  assert.equal(result.pass, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.criticalFailures, []);
});

test("critical failures override a partial numerical score", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-grader-fail-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = await treeManifest(root);
  const rubric = {
    version: "1",
    assertions: [
      { id: "required", description: "required", kind: "output_regex", pattern: "required", weight: 60, critical: true },
      { id: "clean", description: "clean", kind: "workspace_unchanged", weight: 40, critical: false },
    ],
  };
  const result = await gradeRun(rubric, { outputText: "wrong", workspace: root, suiteRoot: root, toolHome: root, beforeManifest: manifest, afterManifest: manifest, commandTimeoutMs: 1000 });
  assert.equal(result.pass, false);
  assert.equal(result.criticalPass, false);
  assert.equal(result.score, 40);
});

test("grades structured fields, subagent traces, and dimension totals", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-grader-structured-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = await treeManifest(root);
  const rubric = {
    version: "1",
    assertions: [
      { id: "coverage", description: "coverage", dimension: "quality", kind: "output_all", field: "findings", patterns: ["alpha", "beta"], absentPatterns: ["secret"], flags: "i", weight: 60, critical: true },
      { id: "delegation", description: "delegation", dimension: "process", kind: "subagent_count", minimum: 2, maximum: 4, weight: 40, critical: true },
    ],
  };
  const result = await gradeRun(rubric, {
    outputText: "unused",
    structuredOutput: { outcome: "complete", summary: "done", findings: ["Alpha", "Beta"], actions: [], checks: [], message: "done" },
    traceMetrics: { subagentCount: 3, subagentMetricsAvailable: true },
    workspace: root,
    suiteRoot: root,
    beforeManifest: manifest,
    afterManifest: manifest,
    commandTimeoutMs: 1000,
  });
  assert.equal(result.pass, true);
  assert.equal(result.dimensions.quality.earned, 60);
  assert.equal(result.dimensions.quality.available, 60);
  assert.equal(result.dimensions.quality.percent, 100);
  assert.equal(result.dimensions.quality.coveragePercent, 100);
  assert.equal(result.dimensions.process.earned, 40);
});

test("does not convert unavailable child identity telemetry into a zero count", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-grader-telemetry-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = await treeManifest(root);
  const result = await gradeRun({
    version: "1",
    assertions: [{ id: "delegation", description: "delegation", dimension: "evidence", kind: "subagent_count", minimum: 1, weight: 100, critical: false }],
  }, {
    outputText: "",
    traceMetrics: { subagentCount: null, subagentMetricsAvailable: false, collaborationCallCount: 5 },
    workspace: root,
    suiteRoot: root,
    beforeManifest: manifest,
    afterManifest: manifest,
    commandTimeoutMs: 1000,
  });
  assert.equal(result.pass, false);
  assert.equal(result.assertions[0].evidence, "subagent identity/count telemetry is unavailable");
  assert.equal(result.assertions[0].status, "indeterminate");
  assert.equal(result.assertions[0].pass, null);
  assert.equal(result.score, null);
  assert.equal(result.scoreLowerBound, 0);
  assert.equal(result.scoreUpperBound, 100);
  assert.equal(result.scoringComplete, false);
});

test("isolated command graders cannot mutate a host sentinel or open network", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-grader-boundary-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, "workspace");
  const suite = path.join(root, "suite");
  const hidden = path.join(suite, "hidden", "grade.mjs");
  const sentinel = path.join(root, "host-sentinel.txt");
  await Promise.all([mkdir(workspace, { recursive: true }), mkdir(path.dirname(hidden), { recursive: true })]);
  await writeFile(sentinel, "untouched\n");
  await writeFile(path.join(workspace, "candidate.mjs"), [
    "import { execFileSync } from 'node:child_process';",
    "import { writeFileSync } from 'node:fs';",
    "export let workspaceReadOnly = false;",
    "export let networkBlocked = false;",
    `try { writeFileSync(${JSON.stringify(sentinel)}, 'changed'); } catch {}`,
    "try { writeFileSync('/workspace/forbidden.txt', 'changed'); } catch { workspaceReadOnly = true; }",
    "try { execFileSync('/usr/bin/curl', ['--max-time', '1', 'http://1.1.1.1'], {stdio:'ignore'}); } catch { networkBlocked = true; }",
    "",
  ].join("\n"));
  await writeFile(hidden, [
    "import assert from 'node:assert/strict';",
    "const candidate = await import('file:///workspace/candidate.mjs');",
    "assert.equal(candidate.workspaceReadOnly, true);",
    "assert.equal(candidate.networkBlocked, true);",
    "process.stdout.write('boundary held');",
    "",
  ].join("\n"));
  const manifest = await treeManifest(workspace);
  const rubric = {
    version: "1",
    assertions: [{
      id: "boundary",
      description: "boundary",
      dimension: "safety",
      kind: "command",
      argv: ["node", "{suite}/hidden/grade.mjs"],
      stdoutPattern: "boundary held",
      weight: 100,
      critical: true,
    }],
  };
  const result = await gradeRun(rubric, {
    outputText: "",
    workspace,
    suiteRoot: suite,
    beforeManifest: manifest,
    afterManifest: manifest,
    commandTimeoutMs: 5000,
  });
  assert.equal(result.pass, true, JSON.stringify(result.assertions[0].evidence));
  assert.equal(await readFile(sentinel, "utf8"), "untouched\n");
  assert.equal(result.assertions[0].evidence.network, "unshared");
  assert.equal(result.assertions[0].evidence.workspace, "read-only");
});
