import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gradeRun } from "../lib/grader.mjs";
import { loadSuite } from "../lib/manifest.mjs";

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("reference outputs beat visible-text keyword dumps for every static fixture", async () => {
  const suite = await loadSuite(path.join(suiteRoot, "suite.json"));
  const controlled = suite.roles.filter((role) => role.referenceOutputFile);
  assert.equal(controlled.length, 11);

  for (const role of controlled) {
    const context = {
      workspace: role.paths.workspace,
      suiteRoot: suite.root,
      beforeManifest: role.workspaceManifest,
      afterManifest: role.workspaceManifest,
      commandTimeoutMs: 1000,
      traceMetrics: { subagentCount: 0 },
    };
    const reference = await gradeRun(role.rubric, {
      ...context,
      structuredOutput: role.referenceOutputFile,
      outputText: JSON.stringify(role.referenceOutputFile),
    });
    const negative = await gradeRun(role.rubric, {
      ...context,
      structuredOutput: role.negativeControlOutputFile,
      outputText: JSON.stringify(role.negativeControlOutputFile),
    });

    assert.equal(reference.score, 100, `${role.id} reference output must earn 100`);
    assert.equal(reference.criticalPass, true, `${role.id} reference output must pass critical gates`);
    assert.ok(negative.score <= 15, `${role.id} keyword dump scored ${negative.score}`);
    assert.equal(negative.criticalPass, false, `${role.id} keyword dump must fail a critical gate`);
  }
});
