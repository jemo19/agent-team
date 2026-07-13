import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { generateReports, recommendationAnalysis } from "../lib/reporting.mjs";

test("generates JSON, CSV, and Markdown reports from the append-only journal", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-report-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "run.json"), JSON.stringify({
    runId: "demo",
    phase: "calibration",
    suiteVersion: "1",
    cliVersion: "codex-cli 0.144.0",
    plannedCases: 1,
    roleDescriptors: [{ roleId: "root_orchestration", displayName: "Root orchestration" }],
  }));
  const record = {
    fingerprint: "fingerprint",
    caseId: "demo-case",
    roleId: "root_orchestration",
    displayName: "Root orchestration",
    model: "gpt-5.6-sol",
    effort: "ultra",
    repetition: 1,
    attempt: 1,
    phase: "calibration",
    isBaseline: true,
    status: "passed",
    terminal: true,
    harnessPass: true,
    gatePass: true,
    overallPass: true,
    qualityPass: false,
    scoringComplete: false,
    durationMs: 100,
    usage: { input_tokens: 10, cached_input_tokens: 2, output_tokens: 5, reasoning_output_tokens: 3 },
    grader: {
      pass: false,
      score: null,
      scoreLowerBound: 80,
      scoreUpperBound: 100,
      scoringComplete: false,
      taskOutcomeScore: 100,
      criticalFailures: [],
      assertions: [{ id: "actual-delegation", status: "indeterminate", pass: null }],
    },
    metrics: {
      itemCompleted: { command_execution: 2, collab_tool_call: 1, agent_message: 1 },
      collaborationCallCount: 1,
      subagentCount: null,
      subagentMetricsAvailable: false,
      toolEvents: [{ eventType: "item.started" }, { eventType: "item.completed" }],
      commandEvents: [{ eventType: "item.started" }, { eventType: "item.completed" }],
      recoveredTransportWarnings: ["Reconnecting... 1/5 (...)"],
      fatalRootErrors: [],
    },
    workspace: { changedPaths: [] },
    harnessErrors: [],
    artifactDirectory: "/tmp/demo",
  };
  await writeFile(path.join(root, "journal.jsonl"), `${JSON.stringify(record)}\n`);
  const report = await generateReports(root);
  assert.equal(report.statusCounts.scoring_indeterminate, 1);
  assert.equal(report.cases[0].overallPass, false);
  assert.equal(report.groups[0].qualityPassRuns, 0);
  assert.equal(report.groups[0].aggregateEligibleRuns, 0);
  assert.equal(report.groups[0].taskOutcomeEligibleRuns, 1);
  assert.equal(report.groups[0].medianScore, null);
  assert.equal(report.groups[0].medianScoreLowerBound, 80);
  assert.equal(report.groups[0].medianScoreUpperBound, 100);
  assert.equal(report.groups[0].medianTaskOutcomeScore, 100);
  assert.equal(report.groups[0].medianToolCount, 3);
  assert.equal(report.groups[0].medianCommandCount, 2);
  assert.equal(report.groups[0].medianCollaborationCallCount, 1);
  assert.equal(report.groups[0].medianSubagentCount, null);
  assert.equal(report.groups[0].recoveredTransportWarningRuns, 1);
  assert.equal(report.groups[0].recoveredTransportWarningCount, 1);
  assert.deepEqual(report.transportWarnings, { cases: 1, count: 1 });
  assert.equal(report.failureCounts.scoring_indeterminate, 1);
  assert.match(await readFile(path.join(root, "results.csv"), "utf8"), /gate_pass,quality_pass/);
  assert.match(await readFile(path.join(root, "report.md"), "utf8"), /Tools \/ commands \/ calls \/ observable children \/ transport warnings/);
  assert.match(await readFile(path.join(root, "report.md"), "utf8"), /3 \/ 2 \/ 1 \/ n\/a \/ 1/);
  assert.match(await readFile(path.join(root, "report.md"), "utf8"), /Recovered transport warnings: 1 across 1 case/);
  assert.match(await readFile(path.join(root, "report.md"), "utf8"), /n\/a \|  \| 80-100 \| 100/);
  const reviewTemplate = JSON.parse(await readFile(path.join(root, "human-review-template.json"), "utf8"));
  assert.deepEqual(reviewTemplate.roles.root_orchestration.finalists, []);
});

test("recommendations require declared reviewed finalists and rank gate-pass rate first", () => {
  const matrix = Array.from({ length: 17 }, (_, index) => ({ model: `model-${index}`, effort: `effort-${index}` }));
  const groups = matrix.map((candidate, index) => ({
    roleId: "web_scout",
    ...candidate,
    fixtureIds: ["routine", "difficult", "adversarial"],
    aggregateEligibleRuns: index < 2 ? 3 : 1,
    gatePassRate: index === 0 ? 0.9 : 1,
    medianScore: index === 0 ? 95 : index === 1 ? 90 : 100,
    medianTotalTokens: 100 + index,
    medianDurationMs: 1000 + index,
  }));
  const run = {
    phase: "screen",
    matrix,
    baselines: { web_scout: matrix[0] },
    humanReview: { status: "not_reviewed" },
  };
  const annotations = {
    status: "approved",
    cases: { "case-a": { status: "accept" } },
    roles: {
      web_scout: {
        status: "approved",
        requiredCaseIds: ["case-a"],
        finalists: [matrix[0], matrix[1]],
      },
    },
  };
  const [ready] = recommendationAnalysis(groups, run, annotations);
  assert.equal(ready.evidenceSufficient, true, ready.reasons.join("; "));
  assert.deepEqual(ready.provisionalRecommendation.model, "model-1");

  const [blocked] = recommendationAnalysis(groups, run, { ...annotations, cases: {} });
  assert.equal(blocked.evidenceSufficient, false);
  assert.match(blocked.reasons.join("; "), /lack a human disposition/);
});
