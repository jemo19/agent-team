import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { enforcePlanCeilings } from "../lib/options.mjs";
import { generateReports } from "../lib/reporting.mjs";
import { guardrailState, planMatrix, preflightArtifactDigests, rejectPrepareRuntimeModifiers, rejectResumePlanModifiers } from "../scripts/run.mjs";

const efforts = {
  "gpt-5.6-sol": ["low", "medium", "high", "xhigh", "max", "ultra"],
  "gpt-5.6-terra": ["low", "medium", "high", "xhigh", "max", "ultra"],
  "gpt-5.6-luna": ["low", "medium", "high", "xhigh", "max"],
};

function fakeInputs() {
  const roleIds = ["root_orchestration", "root_plan", "web_scout", "web_builder", "test_mapper", "risk_reviewer", "infra_recon", "infra_planner", "iac_planner", "msp_triage", "customer_comms", "project_architect", "project_builder", "project_reviewer"];
  const matrix = Object.entries(efforts).flatMap(([model, levels]) => levels.map((effort) => ({ model, effort })));
  const baselines = Object.fromEntries(roleIds.map((roleId) => [roleId, { model: roleId.startsWith("root_") ? "gpt-5.6-sol" : "gpt-5.6-terra", effort: roleId === "root_orchestration" ? "ultra" : "medium" }]));
  const roles = roleIds.map((id) => ({ id, displayName: id, sandbox: id.includes("builder") || id === "root_orchestration" ? "workspace-write" : "read-only", fingerprint: `fixture-${id}` }));
  return {
    suite: { suiteVersion: "test", matrix, baselines, roles },
    catalog: {
      digest: "catalog",
      models: Object.entries(efforts).map(([slug, levels]) => ({ slug, supportedInApi: true, visibility: "list", efforts: levels })),
    },
  };
}

function plan(phase, seed = "seed-one") {
  const { suite, catalog } = fakeInputs();
  return planMatrix({
    suite,
    catalog,
    phase,
    repetitions: 1,
    seed,
    cliVersionValue: "codex-cli-test",
    outputSchemaDigest: "schema",
    harnessCodeDigest: "harness",
  });
}

test("calibration has 14 baseline cases and the full screen has 238 cases", () => {
  const calibration = plan("calibration");
  const screen = plan("screen");
  assert.equal(calibration.length, 14);
  assert.equal(screen.length, 238);
  assert.equal(new Set(screen.map((item) => `${item.model}/${item.effort}`)).size, 17);
  assert.equal(screen.filter((item) => item.delegationConstrained).length, 24);
});

test("seeded matrix scheduling is deterministic and seed-sensitive", () => {
  const first = plan("screen", "same-seed").map((item) => item.caseId);
  const second = plan("screen", "same-seed").map((item) => item.caseId);
  const different = plan("screen", "different-seed").map((item) => item.caseId);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, different);
});

test("plan guardrails accept the 238-cell screen and reject ceiling violations", () => {
  assert.deepEqual(enforcePlanCeilings({
    plannedCases: 238,
    concurrency: 1,
    timeoutMs: 1_800_000,
    commandTimeoutMs: 120_000,
    candidateCeiling: 250,
    concurrencyCeiling: 4,
    maxEstimatedCredits: 10_000,
  }), { estimatedCreditsMax: 9520 });
  assert.throws(() => enforcePlanCeilings({
    plannedCases: 251,
    concurrency: 1,
    timeoutMs: 1_800_000,
    commandTimeoutMs: 120_000,
    candidateCeiling: 250,
    concurrencyCeiling: 4,
    maxEstimatedCredits: 20_000,
  }), /planned cases 251 exceed candidate ceiling 250/);
  assert.throws(() => enforcePlanCeilings({
    plannedCases: 10,
    concurrency: 5,
    timeoutMs: 1_800_000,
    commandTimeoutMs: 120_000,
    candidateCeiling: 250,
    concurrencyCeiling: 4,
    maxEstimatedCredits: 10_000,
  }), /concurrency 5 exceeds concurrency ceiling 4/);
  assert.throws(() => enforcePlanCeilings({
    plannedCases: 238,
    concurrency: 1,
    timeoutMs: 1_800_000,
    commandTimeoutMs: 120_000,
    candidateCeiling: 250,
    concurrencyCeiling: 4,
    maxEstimatedCredits: 9_000,
  }), /estimated planning maximum 9520 credits exceeds ceiling 9000/);
});

test("direct execution is refused until a persisted plan is resumed", () => {
  const script = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "scripts", "run.mjs");
  const result = spawnSync(process.execPath, [script, "--phase", "screen", "--execute"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /direct execution is disabled; use --prepare/);
});

test("unexpected interrupted cases count toward the harness ceiling", () => {
  const state = guardrailState([
    { fingerprint: "one", status: "interrupted", usage: {} },
    { fingerprint: "two", status: "harness_failed", usage: {} },
  ], { maxTimeouts: 3, maxHarnessFailures: 2, maxTotalTokens: null });
  assert.equal(state.interruptedCases, 1);
  assert.equal(state.harnessFailures, 2);
  assert.match(state.stopReason, /harness-failure ceiling reached/);
});

test("resume rejects reviewed-setting overrides and preflight edits change the digest", () => {
  assert.throws(() => rejectResumePlanModifiers({
    values: { resume: "run", concurrency: "2" },
    flags: new Set(["execute"]),
    positional: [],
  }), /--concurrency/);
  assert.throws(() => rejectPrepareRuntimeModifiers({
    values: { "auth-file": "/tmp/auth.json" },
    flags: new Set(["prepare"]),
    positional: [],
  }), /--auth-file/);
  const preview = { runId: "run", execution: { concurrency: 1 } };
  const original = preflightArtifactDigests(preview, "reviewed\n");
  assert.notEqual(original.preflightDigest, preflightArtifactDigests(preview, "tampered\n").preflightDigest);
  assert.notEqual(original.preflightDigest, preflightArtifactDigests({ ...preview, execution: { concurrency: 2 } }, "reviewed\n").preflightDigest);
});

test("aggregate medians exclude harness failures and gate failures", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-preflight-report-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const run = {
    runId: "aggregate-control",
    phase: "screen",
    status: "completed",
    suiteVersion: "1",
    cliVersion: "codex-cli-test",
    plannedCases: 4,
    matrix: Array.from({ length: 17 }, (_, index) => ({ model: "model", effort: String(index) })),
    baselines: { web_scout: { model: "gpt-5.6-terra", effort: "medium" } },
    roleDescriptors: [{ roleId: "web_scout", displayName: "Web scout", taskId: "fixture:task", fixtureId: "fixture", fixtureVersion: "1", difficulty: "advanced", taskSummary: "Scout.", sandbox: "read-only" }],
    humanReview: { status: "not_reviewed" },
  };
  await writeFile(path.join(root, "run.json"), JSON.stringify(run));
  const base = { roleId: "web_scout", displayName: "Web scout", model: "gpt-5.6-terra", effort: "medium", phase: "screen", isBaseline: true, terminal: true, durationMs: 100, usage: { input_tokens: 60, output_tokens: 40, reasoning_output_tokens: 20 }, metrics: { itemCompleted: { command_execution: 2 }, subagentCount: 0 }, workspace: { changedPaths: [] }, harnessErrors: [] };
  const records = [
    { ...base, fingerprint: "valid", caseId: "valid", repetition: 1, attempt: 1, status: "passed", harnessPass: true, gatePass: true, qualityComplete: true, grader: { score: 80, pass: true, criticalFailures: [], assertions: [] } },
    { ...base, fingerprint: "gate", caseId: "gate", repetition: 2, attempt: 1, status: "gate_failed", harnessPass: true, gatePass: false, qualityComplete: false, durationMs: 1, usage: { input_tokens: 1, output_tokens: 1, reasoning_output_tokens: 1 }, grader: { score: 100, pass: false, criticalFailures: ["critical"], assertions: [] } },
    { ...base, fingerprint: "harness", caseId: "harness", repetition: 3, attempt: 1, status: "harness_failed", harnessPass: false, gatePass: true, qualityComplete: true, durationMs: 1, usage: { input_tokens: 1, output_tokens: 1, reasoning_output_tokens: 1 }, grader: { score: 100, pass: true, criticalFailures: [], assertions: [] }, harnessErrors: ["invalid output"] },
    { ...base, fingerprint: "policy", caseId: "policy", repetition: 4, attempt: 1, status: "gate_failed", harnessPass: true, gatePass: false, qualityComplete: false, durationMs: 1, usage: { input_tokens: 1, output_tokens: 1, reasoning_output_tokens: 1 }, policy: { pass: false, violations: [{ code: "outside_workspace" }] }, grader: { score: 100, pass: true, criticalFailures: [], assertions: [] } },
  ];
  await writeFile(path.join(root, "journal.jsonl"), `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  const report = await generateReports(root);
  assert.equal(report.groups[0].aggregateEligibleRuns, 1);
  assert.equal(report.groups[0].medianScore, 80);
  assert.equal(report.groups[0].medianDiagnosticScore, 90);
  assert.equal(report.groups[0].medianTotalTokens, 100);
  assert.equal(report.groups[0].medianDurationMs, 100);
  assert.equal(report.failureCounts.gate, 1);
  assert.equal(report.failureCounts.harness, 1);
  assert.equal(report.failureCounts.policy, 1);
  const markdown = await readFile(path.join(root, "report.md"), "utf8");
  assert.match(markdown, /Indeterminate assertions appear as intervals/);
  assert.match(markdown, /excluded diagnostic score 100/);
  assert.match(markdown, /outside_workspace/);
});
