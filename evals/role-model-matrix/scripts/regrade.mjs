#!/usr/bin/env node
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyResult } from "../lib/classification.mjs";
import { gradeRun } from "../lib/grader.mjs";
import { latestByFingerprint, readJournal } from "../lib/journal.mjs";
import { loadSuite } from "../lib/manifest.mjs";

const scriptFile = fileURLToPath(import.meta.url);
const scriptRoot = path.resolve(path.dirname(scriptFile), "..");
const OBJECTIVE_KINDS = new Set(["command", "file_regex"]);

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!["--source", "--output", "--suite"].includes(name) || !argv[index + 1]) {
      throw new Error("usage: regrade.mjs --source <run-directory> --output <json-file> [--suite <suite.json>]");
    }
    options[name.slice(2)] = argv[index + 1];
    index += 1;
  }
  if (!options.source || !options.output) throw new Error("--source and --output are required");
  return options;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

async function canonicalDestination(candidate) {
  let current = path.resolve(candidate);
  const missing = [];
  while (true) {
    try {
      const existing = await realpath(current);
      return path.join(existing, ...missing.reverse());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      missing.push(path.basename(current));
      current = parent;
    }
  }
}

export async function validateRegradePaths(sourceDirectory, outputFile, resultsRoot = path.join(scriptRoot, "results")) {
  const source = path.resolve(sourceDirectory);
  const output = path.resolve(outputFile);
  const regradesRoot = path.resolve(resultsRoot, "regrades");
  if (isInside(source, output)) throw new Error("--output must not be inside the frozen source directory");
  if (!isInside(regradesRoot, output)) throw new Error(`--output must be inside ${regradesRoot}`);
  try {
    if ((await lstat(output)).isSymbolicLink()) throw new Error("--output may not be a symbolic link");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const canonicalSource = await canonicalDestination(source);
  const canonicalOutput = await canonicalDestination(output);
  const canonicalRegrades = await canonicalDestination(regradesRoot);
  if (isInside(canonicalSource, canonicalOutput)) throw new Error("--output canonical path must not be inside the frozen source directory");
  if (!isInside(canonicalRegrades, canonicalOutput)) throw new Error(`--output canonical path must be inside ${canonicalRegrades}`);
  return { sourceDirectory: canonicalSource, outputFile: canonicalOutput };
}

export function regradeEligibility(role, source) {
  if (!role) return "role_missing";
  if (source.fixtureId !== role.fixture.fixtureId || source.fixtureVersion !== role.fixture.version) return "fixture_changed";
  if (!source.output) return "output_missing";
  return null;
}

function manifestWithRecordedChanges(beforeManifest, changedPaths = []) {
  const entries = beforeManifest.entries.map((entry) => ({ ...entry }));
  const byPath = new Map(entries.map((entry) => [entry.path, entry]));
  for (const changedPath of changedPaths) {
    if (byPath.has(changedPath)) byPath.get(changedPath).sha256 = `offline-regrade:${changedPath}`;
    else entries.push({ path: changedPath, type: "file", size: 0, mode: 0o644, sha256: `offline-regrade:${changedPath}` });
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  return { entries, digest: "offline-regrade-recorded-workspace-delta" };
}

function carriedObjectiveAssertions(role, source) {
  const previous = new Map((source.grader?.assertions ?? []).map((assertion) => [assertion.id, assertion]));
  const carried = {};
  for (const assertion of role.rubric.assertions.filter((candidate) => OBJECTIVE_KINDS.has(candidate.kind))) {
    if (!previous.has(assertion.id)) throw new Error(`objective assertion ${assertion.id} is absent from frozen grader evidence`);
    carried[assertion.id] = previous.get(assertion.id);
  }
  return carried;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const safePaths = await validateRegradePaths(options.source, options.output);
  const suite = await loadSuite(path.resolve(options.suite ?? path.join(scriptRoot, "suite.json")));
  const sourceRun = JSON.parse(await readFile(path.join(safePaths.sourceDirectory, "run.json"), "utf8"));
  const sourceRecords = [...latestByFingerprint(await readJournal(path.join(safePaths.sourceDirectory, "journal.jsonl"))).values()];
  const roles = new Map(suite.roles.map((role) => [role.id, role]));
  const records = [];

  for (const source of sourceRecords) {
    const role = roles.get(source.roleId);
    const reason = regradeEligibility(role, source);
    if (reason) {
      records.push({ caseId: source.caseId, roleId: source.roleId, model: source.model, effort: source.effort, sourceStatus: source.status, eligibility: "excluded", reason });
      continue;
    }

    try {
      const afterManifest = manifestWithRecordedChanges(role.workspaceManifest, source.workspace?.changedPaths);
      const grader = await gradeRun(role.rubric, {
        outputText: JSON.stringify(source.output),
        structuredOutput: source.output,
        workspace: role.paths.workspace,
        suiteRoot: suite.root,
        beforeManifest: role.workspaceManifest,
        afterManifest,
        commandTimeoutMs: 10000,
        traceMetrics: source.metrics ?? {},
        carriedAssertions: carriedObjectiveAssertions(role, source),
      });
      const policyPass = source.policy?.pass !== false;
      const harnessPass = source.harnessPass === true;
      const gatePass = grader.criticalPass && policyPass;
      const scoringComplete = grader.scoringComplete;
      const qualityPass = grader.pass && policyPass;
      const status = classifyResult({ timedOut: source.process?.timedOut === true, harnessPass, gatePass, scoringComplete, qualityPass });
      const sourceAssertions = new Map((source.grader?.assertions ?? []).map((assertion) => [assertion.id, assertion]));
      records.push({
        caseId: source.caseId,
        roleId: source.roleId,
        model: source.model,
        effort: source.effort,
        fixtureId: source.fixtureId,
        fixtureVersion: source.fixtureVersion,
        eligibility: "regraded",
        source: { status: source.status, score: source.grader?.score, criticalPass: source.grader?.criticalPass, qualityPass: source.qualityPass },
        regrade: { status, score: grader.score, criticalPass: grader.criticalPass, scoringComplete, qualityPass, overallPass: harnessPass && gatePass && scoringComplete && qualityPass },
        assertionProvenance: Object.fromEntries(grader.assertions.map((assertion) => [assertion.id, assertion.evidence?.provenance ?? "recomputed_from_frozen_record"])),
        changedAssertions: grader.assertions.filter((assertion) => sourceAssertions.has(assertion.id) && sourceAssertions.get(assertion.id).status !== assertion.status)
          .map((assertion) => ({ id: assertion.id, from: sourceAssertions.get(assertion.id).status, to: assertion.status })),
      });
    } catch (error) {
      records.push({ caseId: source.caseId, roleId: source.roleId, model: source.model, effort: source.effort, sourceStatus: source.status, eligibility: "excluded", reason: "regrade_error", error: error.message });
    }
  }

  const regraded = records.filter((record) => record.eligibility === "regraded");
  const artifact = {
    regradeVersion: "1.1.0",
    generatedAt: new Date().toISOString(),
    source: { directory: safePaths.sourceDirectory, runId: sourceRun.runId, suiteVersion: sourceRun.suiteVersion },
    target: { suiteVersion: suite.suiteVersion },
    boundary: "Additive offline regrade. Source artifacts are unchanged. Stored-output, telemetry, and recorded workspace-delta assertions are recomputed; objective file and command results are carried forward with provenance. Changed fixtures require fresh model calls.",
    summary: {
      sourceCases: sourceRecords.length,
      regradedCases: regraded.length,
      excludedCases: records.length - regraded.length,
      statusChanges: regraded.filter((record) => record.source.status !== record.regrade.status).length,
      scoreChanges: regraded.filter((record) => record.source.score !== record.regrade.score).length,
      assertionChanges: regraded.reduce((total, record) => total + record.changedAssertions.length, 0),
    },
    records,
  };

  await mkdir(path.dirname(safePaths.outputFile), { recursive: true });
  await writeFile(safePaths.outputFile, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(artifact.summary));
  return artifact;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(scriptFile)) await main();
