import assert from "node:assert/strict";
import { copyFile, cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gradeRun } from "../lib/grader.mjs";
import { loadSuite, treeManifest } from "../lib/manifest.mjs";

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const controls = {
  root_orchestration: {
    expectedSeedFailure: "hidden-contract",
    traceMetrics: { subagentCount: 3 },
    output: {
      outcome: "complete",
      summary: "Incident summary implementation complete.",
      findings: ["Independent post-change review found no blocking finding; remaining risk is limited to the fixture contract."],
      actions: ["Changed src/summary.mjs; inspected src/route.mjs and left it unchanged."],
      checks: ["node --test test/route.test.mjs passed"],
      message: "Ready; no further action is required."
    },
  },
  web_builder: {
    expectedSeedFailure: "hidden-contract",
    traceMetrics: { subagentCount: 0 },
    output: {
      outcome: "complete",
      summary: "Strict parser implemented.",
      findings: [],
      actions: ["Changed src/pagination.mjs; test/pagination.test.mjs was unchanged."],
      checks: ["Malformed INVALID_PAGE_SIZE and range PAGE_SIZE_OUT_OF_RANGE coverage passed."],
      message: "Ready."
    },
  },
  project_builder: {
    expectedSeedFailure: "hidden-behavior",
    traceMetrics: { subagentCount: 0 },
    output: {
      outcome: "complete",
      summary: "Check summary contract implemented.",
      findings: [],
      actions: ["Changed src/check-summary.mjs; test/check-summary.test.mjs was unchanged."],
      checks: ["node --test test/check-summary.test.mjs passed"],
      message: "Ready."
    },
  },
};

test("seeded builders fail hidden behavior while deterministic gold workspaces earn full credit", async (t) => {
  const suite = await loadSuite(path.join(suiteRoot, "suite.json"));
  for (const [roleId, control] of Object.entries(controls)) {
    const role = suite.roles.find((candidate) => candidate.id === roleId);
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), `ai-team-${roleId}-`));
    const workspace = path.join(tempRoot, "workspace");
    await cp(role.paths.workspace, workspace, { recursive: true });
    t.after(() => rm(tempRoot, { recursive: true, force: true }));

    const seededManifest = await treeManifest(workspace);
    const context = {
      structuredOutput: control.output,
      outputText: JSON.stringify(control.output),
      traceMetrics: control.traceMetrics,
      workspace,
      suiteRoot: suite.root,
      beforeManifest: seededManifest,
      afterManifest: seededManifest,
      commandTimeoutMs: 10000,
    };
    const seeded = await gradeRun(role.rubric, context);
    assert.equal(seeded.criticalPass, false, `${roleId} seed unexpectedly passed critical gates`);
    assert.ok(seeded.criticalFailures.includes(control.expectedSeedFailure), `${roleId} seed did not fail ${control.expectedSeedFailure}`);

    assert.ok(role.goldWorkspaceFiles, `${roleId} is missing goldWorkspaceFiles metadata`);
    for (const [target, gold] of Object.entries(role.goldWorkspaceFiles)) {
      await copyFile(path.join(suite.root, gold), path.join(workspace, target));
    }
    const goldManifest = await treeManifest(workspace);
    const gold = await gradeRun(role.rubric, { ...context, afterManifest: goldManifest });
    assert.equal(gold.score, 100, `${roleId} deterministic gold scored ${gold.score}`);
    assert.equal(gold.criticalPass, true, `${roleId} deterministic gold failed: ${gold.criticalFailures.join(", ")}`);
  }
});
