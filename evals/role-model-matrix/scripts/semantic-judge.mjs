#!/usr/bin/env node
import fs from "node:fs";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readJson, sanitizeId, sha256, stableStringify, writeJsonAtomic } from "../lib/common.mjs";
import { candidateIsolation, captureRuntimeIdentity, validateIsolationEnvironment } from "../lib/isolation.mjs";
import { createJournal, readJournal } from "../lib/journal.mjs";
import { createJsonlCollector } from "../lib/jsonl.mjs";
import { parseOptions } from "../lib/options.mjs";
import { runProcess } from "../lib/process.mjs";
import {
  SEMANTIC_JUDGE_DEFAULTS,
  SEMANTIC_JUDGE_VERSION,
  SEMANTIC_PAYLOAD_MAX_BYTES,
  buildAtomicOutputSchema,
  buildAtomicPrompt,
  buildAtomicSchedule,
  createOpaqueMapping,
  evaluateSemanticJudgeTrace,
  judgeCliArguments,
  serializeAtomicPayload,
  semanticCreditPlanning,
  summarizeAtomicPilot,
  validateAtomicVerdict,
  validateHumanLabels,
  validateSemanticItems,
} from "../lib/semantic-judge.mjs";
import { loadSemanticModelCatalog, probeChatGptLogin } from "../lib/semantic-runtime.mjs";
import { loadSuite } from "../lib/manifest.mjs";
import { computeHarnessCodeDigest, validateResultsPath } from "./validate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const schemaTemplate = path.join(packageRoot, "schemas", "semantic-judge-output.schema.json");
const defaultSource = path.join(packageRoot, "fixtures", "semantic-judge", "pilot-v3.1");
const scratchRoot = path.join(os.tmpdir(), "ai-team-semantic-judge");
const productionDependencies = Object.freeze({
  loadCatalog: loadSemanticModelCatalog,
  validateIsolation: validateIsolationEnvironment,
  captureRuntimeIdentity,
  probeLogin: probeChatGptLogin,
  computeHarness: computeHarnessCodeDigest,
  isolateCandidate: candidateIsolation,
  runProcess,
});

function dependencies(overrides = {}) {
  return { ...productionDependencies, ...overrides };
}

function help() {
  return `Atomic semantic-judge shadow pilot

Prepare a frozen, zero-call plan:
  node evals/role-model-matrix/scripts/semantic-judge.mjs --prepare --run-id <id> [options]

Execute only after reviewing preflight.md:
  node evals/role-model-matrix/scripts/semantic-judge.mjs --resume <id> --execute [--results <dir>]

Prepare options:
  --source <directory>       Input corpus root (default: fixtures/semantic-judge/pilot-v3.1)
  --results <directory>      Result root (default: role-model-matrix/results)
  --model <slug>             Frozen judge model (default: gpt-5.6-luna)
  --effort <level>           Frozen reasoning effort (default: max)
  --seed <text>              Forward shuffle seed; reverse is exact reversal
  --timeout-ms <n>           Per-call timeout (default: 900000)
  --max-estimated-credits <n> Planning ceiling (default: 1200)
  --codex <path>             Codex executable used for non-billed readiness and later execution
  --bwrap <path>             Bubblewrap executable

The runner is always shadow-only. It never writes deterministic scores or role recommendations.
`;
}

function parsePositive(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(`${label} must be a positive integer`);
  return number;
}

function safeRunId(value) {
  const runId = sanitizeId(value);
  if (!runId || runId === "." || runId === "..") throw new Error("run id is empty or unsafe after sanitization");
  return runId;
}

function assertJudgeAvailable(catalog, model, effort) {
  const entry = catalog.models.find((candidate) => candidate.slug === model);
  if (!entry || !entry.supportedInApi) throw new Error(`judge model is unavailable in the bundled catalog: ${model}`);
  if (!entry.efforts.includes(effort)) throw new Error(`judge effort is unavailable for ${model}: ${effort}`);
}

function assertPrepareOptions(options) {
  const allowedValues = new Set(["run-id", "source", "results", "model", "effort", "seed", "timeout-ms", "max-estimated-credits", "codex", "bwrap"]);
  const unknown = Object.keys(options.values).filter((key) => !allowedValues.has(key));
  if (unknown.length || options.positional.length) throw new Error(`unsupported prepare options: ${[...unknown, ...options.positional].join(", ")}`);
  if (!options.flags.has("prepare") || options.flags.has("execute")) throw new Error("new runs require --prepare and may not include --execute");
  if (!options.values["run-id"]) throw new Error("--prepare requires --run-id");
}

function assertResumeOptions(options) {
  const allowedValues = new Set(["resume", "results"]);
  const unknown = Object.keys(options.values).filter((key) => !allowedValues.has(key));
  if (unknown.length || options.positional.length) throw new Error(`resume settings are frozen; unsupported overrides: ${[...unknown, ...options.positional].join(", ")}`);
  if (!options.values.resume || !options.flags.has("execute") || options.flags.has("prepare")) {
    throw new Error("execution requires the exact --resume <run-id> --execute gate");
  }
}

async function hashFile(file) {
  return sha256(await readFile(file));
}

async function closeStream(stream) {
  stream.end();
  if (!stream.closed) await once(stream, "close");
}

async function immutableIntegrity(runDirectory, relativeFiles) {
  const entries = [];
  for (const relative of [...relativeFiles].sort()) entries.push({ path: relative, sha256: await hashFile(path.join(runDirectory, relative)) });
  return { algorithm: "sha256", entries, digest: sha256(stableStringify(entries)) };
}

async function verifyIntegrity(runDirectory) {
  const integrity = await readJson(path.join(runDirectory, "integrity.json"));
  const actual = await immutableIntegrity(runDirectory, integrity.entries.map((entry) => entry.path));
  if (actual.digest !== integrity.digest) throw new Error("prepared semantic-judge artifacts drifted after preflight");
  return integrity;
}

async function fileExists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function verifyCallIntegrity(runDirectory, callId) {
  const manifest = path.join(runDirectory, "calls", callId, "artifact-integrity.json");
  const integrity = await readJson(manifest);
  const actual = await immutableIntegrity(runDirectory, integrity.entries.map((entry) => entry.path));
  if (actual.digest !== integrity.digest) throw new Error(`per-call artifact integrity failed for ${callId}`);
  return integrity;
}

function invalidateForArtifactDrift(result, error) {
  return {
    ...result,
    status: "artifact_integrity_failed",
    observedVerdict: null,
    validatedVerdict: "indeterminate",
    processErrors: [...(result.processErrors ?? []), error.message],
    validation: {
      valid: false,
      schemaErrors: result.validation?.schemaErrors ?? [],
      evidenceErrors: result.validation?.evidenceErrors ?? [],
    },
    stopExecution: true,
    artifactIntegrity: { pass: false, error: error.message },
  };
}

async function verifiedTerminalResult(runDirectory, result) {
  try {
    await verifyCallIntegrity(runDirectory, result.callId);
    return { ...result, artifactIntegrity: { pass: true } };
  } catch (error) {
    return invalidateForArtifactDrift(result, error);
  }
}

async function promotePartial(partial, complete) {
  if (await fileExists(complete)) return;
  if (await fileExists(partial)) await rename(partial, complete);
  else await writeFile(complete, "", { mode: 0o600 });
}

async function recoverInterruptedCall({ runDirectory, call, reason }) {
  const directory = path.join(runDirectory, "calls", call.callId);
  const statusFile = path.join(directory, "status.json");
  let status = {};
  try { status = await readJson(statusFile); } catch { /* represented in the recovery result */ }
  const eventsFile = path.join(directory, "events.jsonl");
  const stderrFile = path.join(directory, "stderr.log");
  const finalMessageFile = path.join(directory, "final-message.json");
  await Promise.all([
    promotePartial(path.join(directory, "events.jsonl.partial"), eventsFile),
    promotePartial(path.join(directory, "stderr.log.partial"), stderrFile),
    fileExists(finalMessageFile).then((exists) => exists ? undefined : writeFile(finalMessageFile, "", { mode: 0o600 })),
  ]);
  const collector = createJsonlCollector();
  collector.push(await readFile(eventsFile));
  const metrics = collector.finish();
  const completedAt = new Date().toISOString();
  const started = Date.parse(status.startedAt ?? "");
  const durationMs = Number.isFinite(started) ? Math.max(0, Date.parse(completedAt) - started) : null;
  const processErrors = [reason];
  const semanticTrace = evaluateSemanticJudgeTrace(metrics);
  const policyErrors = semanticTrace.errors;
  const result = {
    ...call,
    semanticJudgeVersion: SEMANTIC_JUDGE_VERSION,
    shadowOnly: true,
    status: status.status === "running" ? "interrupted" : "setup_failed",
    terminal: true,
    startedAt: status.startedAt ?? null,
    completedAt,
    durationMs,
    process: null,
    processErrors,
    policyErrors,
    output: null,
    outputSource: "missing",
    validation: { valid: false, schemaErrors: [], evidenceErrors: [] },
    observedVerdict: null,
    validatedVerdict: "indeterminate",
    usage: metrics.usage,
    metrics: {
      eventCount: metrics.eventCount,
      eventTypes: metrics.eventTypes,
      parseErrors: metrics.parseErrors,
      toolEventCount: metrics.toolEvents.length,
      commandEventCount: metrics.commandEvents.length,
      unexpectedEventCount: semanticTrace.unexpectedEventCount,
      toolEvents: metrics.toolEvents,
      commandEvents: metrics.commandEvents,
      eventRecords: metrics.eventRecords,
    },
    stopExecution: true,
  };
  const resultFile = path.join(directory, "result.json");
  const usageFile = path.join(directory, "usage.json");
  await Promise.all([
    writeJsonAtomic(resultFile, result),
    writeJsonAtomic(usageFile, metrics.usage),
    writeJsonAtomic(statusFile, { callId: call.callId, fingerprint: call.fingerprint, status: result.status, terminal: true, completedAt }),
  ]);
  const relativeArtifacts = [
    path.join("calls", call.callId, "prompt.txt"),
    path.join("calls", call.callId, "output.schema.json"),
    path.relative(runDirectory, eventsFile),
    path.relative(runDirectory, finalMessageFile),
    path.relative(runDirectory, stderrFile),
    path.relative(runDirectory, usageFile),
    path.relative(runDirectory, resultFile),
  ];
  const requestFile = path.join(directory, "request.json");
  if (await fileExists(requestFile)) relativeArtifacts.push(path.relative(runDirectory, requestFile));
  await writeJsonAtomic(path.join(directory, "artifact-integrity.json"), await immutableIntegrity(runDirectory, relativeArtifacts));
  return verifiedTerminalResult(runDirectory, result);
}

function preflightMarkdown(preflight) {
  return [
    `# Atomic Semantic Judge Preflight: ${preflight.runId}`,
    "",
    "> Shadow-only plan. Preparation performed zero model calls. Review before executing the exact resume command.",
    "",
    "## Frozen Protocol",
    "",
    `- Protocol: \`${preflight.semanticJudgeVersion}\``,
    `- Judge: \`${preflight.judge.model}\` at \`${preflight.judge.effort}\``,
    `- Authentication: ${preflight.authentication.status}; API key forwarded: no`,
    `- Runtime identity digest: \`${preflight.runtimeIdentityDigest}\``,
    `- Items: ${preflight.itemCount}`,
    `- Atomic calls: ${preflight.callCount} (${preflight.itemCount} forward + ${preflight.itemCount} exact reverse)`,
    `- Seed: \`${preflight.seed}\``,
    `- Concurrency: 1`,
    `- Timeout per call: ${preflight.timeoutMs} ms`,
    `- Model payload ceiling: ${preflight.payload.maximumBytes} bytes; largest prepared payload: ${preflight.payload.maximumObservedBytes} bytes`,
    `- Estimated credit planning range: ${preflight.creditPlanning.estimatedCredits.min}-${preflight.creditPlanning.estimatedCredits.max}`,
    "- Candidate fields are untrusted and never instructions.",
    "- Judge ids are opaque. Canonical ids, human labels, and criticality remain host-side and are never mounted.",
    "- Shell, unified execution, tools, browsing, apps, plugins, and delegation are disabled; any recognized or unknown actionable event rejects the pilot.",
    "- Calls are never retried automatically. Interrupted or malformed calls fail closed.",
    "- Verdicts remain shadow-only and cannot alter deterministic scores, gates, routing, or recommendations.",
    "- SHA-256 manifests detect trusted-local accidental drift; they are unsigned and are not an authenticity proof against a malicious local editor.",
    "",
    "## Acceptance Gate",
    "",
    `- Human agreement: ${preflight.itemCount}/${preflight.itemCount} forward and ${preflight.itemCount}/${preflight.itemCount} reverse`,
    `- Cross-pass stability: ${preflight.itemCount}/${preflight.itemCount}`,
    "- Critical false PASS: 0",
    "- Evidence/schema/process/policy errors and invalid terminal results: 0",
    "- Indeterminate verdicts: 0",
    "- Tool/command events: 0",
    "",
    "## Exact Resume Command",
    "",
    "```bash",
    preflight.resumeCommand,
    "```",
    "",
    "Passing this gate permits only expanded shadow testing, never effective grading.",
    "",
  ].join("\n");
}

function shadowReport(summary, run, calls, results, labels, blinding) {
  const resultByCall = new Map(results.map((result) => [result.callId, result]));
  const sourceByOpaque = new Map(blinding.entries.map((entry) => [entry.opaqueId, entry.sourceId]));
  const lines = [
    `# Atomic Semantic Judge Shadow Report: ${run.runId}`,
    "",
    `**Decision: ${summary.status}.** This report is shadow-only and did not modify deterministic scores.`,
    "",
    `- Judge: \`${run.judge.model}\` at \`${run.judge.effort}\``,
    `- Calls complete: ${summary.terminalCallCount}/${summary.callCount}`,
    `- Forward human agreement: ${summary.passStats.forward.agreement}/${summary.passStats.forward.total}`,
    `- Reverse human agreement: ${summary.passStats.reverse.agreement}/${summary.passStats.reverse.total}`,
    `- Stability: ${summary.stability.agreement}/${summary.stability.total}`,
    `- Critical false PASS: ${summary.acceptance.criticalFalsePassCount}`,
    `- Evidence errors: ${summary.acceptance.evidenceErrorCount}`,
    `- Schema errors: ${summary.acceptance.schemaErrorCount}`,
    `- Process errors: ${summary.acceptance.processErrorCount}`,
    `- Policy errors: ${summary.acceptance.policyErrorCount}`,
    `- Invalid terminal results: ${summary.acceptance.invalidResultCount}`,
    `- Indeterminate verdicts: ${summary.acceptance.indeterminateCount}`,
    `- Tool events: ${summary.acceptance.toolEventCount}; command events: ${summary.acceptance.commandEventCount}`,
    `- Unexpected/actionable events: ${summary.acceptance.unexpectedEventCount}`,
    "",
    "| Pass | Position | Item | Human | Validated | Status | Evidence | Tools |",
    "|---|---:|---|---|---|---|---|---:|",
  ];
  for (const call of calls) {
    const result = resultByCall.get(call.callId);
    const sourceId = sourceByOpaque.get(call.itemId);
    lines.push(`| ${call.pass} | ${call.position} | \`${sourceId}\` | ${labels[sourceId]} | ${result?.validatedVerdict ?? "missing"} | ${result?.status ?? "missing"} | ${result?.validation?.evidenceErrors?.length ? "fail" : result ? "pass" : "missing"} | ${result?.metrics?.toolEventCount ?? ""} |`);
  }
  lines.push("", "Passing means accepted for expanded shadow testing only.", "");
  return lines.join("\n");
}

export async function prepareSemanticRun(config, dependencyOverrides = {}) {
  const deps = dependencies(dependencyOverrides);
  const suite = config.suite ?? await loadSuite(path.join(packageRoot, "suite.json"));
  const resultsRoot = path.resolve(config.resultsRoot ?? path.join(packageRoot, "results"));
  await validateResultsPath({ suite, resultsRoot });
  const runId = safeRunId(config.runId);
  const runDirectory = path.join(resultsRoot, runId);
  const sourceRoot = path.resolve(config.sourceRoot ?? defaultSource);
  const items = await readJson(path.join(sourceRoot, "items.json"));
  const labels = await readJson(path.join(sourceRoot, "human-labels.json"));
  const corpusManifest = await readJson(path.join(sourceRoot, "manifest.json"));
  const itemErrors = validateSemanticItems(items);
  const labelErrors = validateHumanLabels(labels, items);
  if (itemErrors.length || labelErrors.length) throw new Error(`semantic source validation failed:\n- ${[...itemErrors, ...labelErrors].join("\n- ")}`);
  if (corpusManifest.corpusVersion !== SEMANTIC_JUDGE_VERSION || corpusManifest.itemCount !== items.length) {
    throw new Error(`semantic corpus manifest does not match protocol ${SEMANTIC_JUDGE_VERSION}`);
  }
  const model = config.model ?? SEMANTIC_JUDGE_DEFAULTS.model;
  const effort = config.effort ?? SEMANTIC_JUDGE_DEFAULTS.effort;
  const seed = config.seed ?? SEMANTIC_JUDGE_DEFAULTS.seed;
  const timeoutMs = config.timeoutMs ?? SEMANTIC_JUDGE_DEFAULTS.timeoutMs;
  const codex = config.codex ?? "codex";
  const bwrap = config.bwrap ?? "bwrap";
  const catalog = config.catalog ?? await deps.loadCatalog(codex);
  assertJudgeAvailable(catalog, model, effort);
  const isolation = config.isolation ?? await deps.validateIsolation({ codex, bwrap, requireAuth: true });
  if (!isolation.pass) throw new Error(`semantic isolation/auth readiness failed: ${[...(isolation.structural?.errors ?? []), isolation.authentication?.error].filter(Boolean).join("; ")}`);
  const authentication = config.authentication ?? await deps.probeLogin(codex);
  if (authentication.method !== "chatgpt" || authentication.authenticated !== true || authentication.apiKeyForwarded !== false) {
    throw new Error("semantic judge preparation requires verified ChatGPT login with no API key forwarded");
  }
  const runtimeIdentity = config.runtimeIdentity ?? await deps.captureRuntimeIdentity({ codex, bwrap });
  if (!runtimeIdentity.digest) throw new Error("semantic runtime identity is incomplete");
  const harness = config.harness ?? await deps.computeHarness(packageRoot);
  const blinded = createOpaqueMapping(items, config.blindingNonce);
  const { modelItems, ...blinding } = blinded;
  let calls = buildAtomicSchedule(modelItems, { seed, model, effort });
  const prompts = new Map();
  const schemas = new Map();
  calls = calls.map((call) => {
    const item = modelItems.find((entry) => entry.id === call.itemId);
    const payload = serializeAtomicPayload(item);
    const prompt = buildAtomicPrompt(item);
    const schema = buildAtomicOutputSchema(item);
    prompts.set(call.callId, prompt);
    schemas.set(call.callId, schema);
    return {
      ...call,
      payloadBytes: payload.bytes,
      promptBytes: Buffer.byteLength(prompt, "utf8"),
      promptDigest: sha256(prompt),
      outputSchemaDigest: sha256(stableStringify(schema)),
    };
  });
  const maxEstimatedCredits = config.maxEstimatedCredits ?? 1200;
  const creditPlanning = semanticCreditPlanning(calls.length);
  if (creditPlanning.estimatedCredits.max > maxEstimatedCredits) throw new Error(`estimated credit maximum ${creditPlanning.estimatedCredits.max} exceeds ceiling ${maxEstimatedCredits}`);
  const run = {
    kind: "atomic-semantic-judge-shadow-run",
    semanticJudgeVersion: SEMANTIC_JUDGE_VERSION,
    runId,
    state: "prepared",
    preparedAt: new Date().toISOString(),
    shadowOnly: true,
    effectiveGrading: false,
    deterministicScoreWrites: false,
    judge: { model, effort, apiKeyUsed: false },
    authentication,
    runtimeIdentity,
    runtimeIdentityDigest: runtimeIdentity.digest,
    seed,
    scheduleRule: "seeded forward permutation followed by its exact reverse",
    itemCount: items.length,
    callCount: calls.length,
    concurrency: 1,
    timeoutMs,
    maxEstimatedCredits,
    creditPlanning,
    codex,
    bwrap,
    source: {
      artifactRoot: sourceRoot,
      itemsDigest: sha256(stableStringify(items)),
      humanLabelsDigest: sha256(stableStringify(labels)),
      manifestDigest: sha256(stableStringify(corpusManifest)),
      reportDigest: await hashFile(path.join(sourceRoot, "report.md")),
    },
    blindingDigest: sha256(stableStringify(blinding)),
    catalogDigest: catalog.digest,
    harnessCodeDigest: harness.digest,
    schemaTemplateDigest: await hashFile(schemaTemplate),
    planDigest: sha256(stableStringify(calls)),
    isolationPreflight: isolation,
    acceptanceGate: {
      agreementForward: `${items.length}/${items.length}`,
      agreementReverse: `${items.length}/${items.length}`,
      stability: `${items.length}/${items.length}`,
      criticalFalsePasses: 0,
      evidenceErrors: 0,
      schemaErrors: 0,
      processErrors: 0,
      policyErrors: 0,
      invalidTerminalResults: 0,
      indeterminateVerdicts: 0,
      toolEvents: 0,
      commandEvents: 0,
      unexpectedEvents: 0,
    },
  };
  const maximumObservedBytes = Math.max(...calls.map((call) => call.payloadBytes));
  const preflight = {
    kind: "atomic-semantic-judge-shadow-preflight",
    billedModelCallsPerformed: 0,
    runId,
    semanticJudgeVersion: SEMANTIC_JUDGE_VERSION,
    shadowOnly: true,
    judge: run.judge,
    authentication,
    runtimeIdentityDigest: runtimeIdentity.digest,
    itemCount: items.length,
    callCount: calls.length,
    seed,
    timeoutMs,
    payload: { maximumBytes: SEMANTIC_PAYLOAD_MAX_BYTES, maximumObservedBytes },
    creditPlanning,
    acceptanceGate: run.acceptanceGate,
    schedule: calls.map(({ callId, pass, position, itemId, fingerprint, promptDigest, outputSchemaDigest }) => ({ callId, pass, position, itemId, fingerprint, promptDigest, outputSchemaDigest })),
    resumeCommand: `node evals/role-model-matrix/scripts/semantic-judge.mjs --results ${JSON.stringify(resultsRoot)} --resume ${runId} --execute`,
  };
  await mkdir(resultsRoot, { recursive: true });
  try { await mkdir(runDirectory); } catch (error) {
    if (error.code === "EEXIST") throw new Error(`run directory already exists: ${runDirectory}`);
    throw error;
  }
  await Promise.all([
    writeJsonAtomic(path.join(runDirectory, "run.json"), run),
    writeJsonAtomic(path.join(runDirectory, "plan.json"), calls),
    writeJsonAtomic(path.join(runDirectory, "source-items.json"), items),
    writeJsonAtomic(path.join(runDirectory, "human-labels.json"), labels),
    writeJsonAtomic(path.join(runDirectory, "corpus-manifest.json"), corpusManifest),
    writeJsonAtomic(path.join(runDirectory, "blinding-map.json"), blinding),
    writeJsonAtomic(path.join(runDirectory, "runtime-identity.json"), runtimeIdentity),
    writeJsonAtomic(path.join(runDirectory, "catalog.json"), catalog),
    writeJsonAtomic(path.join(runDirectory, "preflight.json"), preflight),
    writeFile(path.join(runDirectory, "preflight.md"), preflightMarkdown(preflight), "utf8"),
    writeFile(path.join(runDirectory, "judge-output.schema.json"), await readFile(schemaTemplate), { mode: 0o600 }),
  ]);
  const immutable = ["run.json", "plan.json", "source-items.json", "human-labels.json", "corpus-manifest.json", "blinding-map.json", "runtime-identity.json", "catalog.json", "preflight.json", "preflight.md", "judge-output.schema.json"];
  for (const call of calls) {
    const directory = path.join(runDirectory, "calls", call.callId);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "prompt.txt"), prompts.get(call.callId), { mode: 0o600 });
    await writeJsonAtomic(path.join(directory, "output.schema.json"), schemas.get(call.callId));
    await writeJsonAtomic(path.join(directory, "status.json"), { callId: call.callId, fingerprint: call.fingerprint, status: "prepared", terminal: false });
    immutable.push(path.join("calls", call.callId, "prompt.txt"), path.join("calls", call.callId, "output.schema.json"));
  }
  const integrity = await immutableIntegrity(runDirectory, immutable);
  await writeJsonAtomic(path.join(runDirectory, "integrity.json"), integrity);
  return { prepared: true, billedModelCallsPerformed: 0, runId, runDirectory, preflight: path.join(runDirectory, "preflight.md"), executeAfterReview: preflight.resumeCommand };
}

function executionStop(processResult, metrics) {
  return /usage limit|credit|quota|rate.?limit|\b429\b|entitlement|model.*not available|not logged in|unauthori[sz]ed|authentication|\b401\b/i.test(`${processResult.stderr}\n${JSON.stringify(metrics.errors)}`);
}

async function runAtomicCall({ run, runDirectory, call, item, deps }) {
  const directory = path.join(runDirectory, "calls", call.callId);
  const existingStatus = await readJson(path.join(directory, "status.json"));
  const resultFile = path.join(directory, "result.json");
  try {
    const existing = await readJson(resultFile);
    if (existing.terminal) return verifiedTerminalResult(runDirectory, existing);
  } catch { /* not terminal */ }
  if (existingStatus.status !== "prepared") {
    return recoverInterruptedCall({
      runDirectory,
      call,
      reason: `prior call status is ${existingStatus.status}; automatic retry is forbidden`,
    });
  }
  const promptFile = path.join(directory, "prompt.txt");
  const outputSchema = path.join(directory, "output.schema.json");
  const prompt = await readFile(promptFile, "utf8");
  if (sha256(prompt) !== call.promptDigest) throw new Error(`prompt drift for ${call.callId}`);
  const parsedSchema = await readJson(outputSchema);
  if (sha256(stableStringify(parsedSchema)) !== call.outputSchemaDigest) throw new Error(`output schema drift for ${call.callId}`);
  const finalMessageFile = path.join(directory, "final-message.json");
  const eventsPartial = path.join(directory, "events.jsonl.partial");
  const stderrPartial = path.join(directory, "stderr.log.partial");
  const eventsFile = path.join(directory, "events.jsonl");
  const stderrFile = path.join(directory, "stderr.log");
  const startedAt = new Date().toISOString();
  await writeJsonAtomic(path.join(directory, "status.json"), { callId: call.callId, fingerprint: call.fingerprint, status: "starting", terminal: false, startedAt });
  await writeFile(finalMessageFile, "", { flag: "wx", mode: 0o600 });
  const workspace = path.join(scratchRoot, run.runId, call.callId, "workspace");
  await rm(path.dirname(workspace), { recursive: true, force: true });
  await mkdir(workspace, { recursive: true });
  const args = judgeCliArguments(run.judge);
  const isolated = await deps.isolateCandidate({
    bwrap: run.bwrap,
    codex: run.codex,
    workspace,
    workspaceWritable: false,
    finalMessageFile,
    outputSchema,
    codexArguments: args,
  });
  const request = {
    ...call,
    semanticJudgeVersion: SEMANTIC_JUDGE_VERSION,
    shadowOnly: true,
    startedAt,
    executable: "bubblewrap-isolated-codex",
    arguments: args,
    promptDigest: call.promptDigest,
    outputSchemaDigest: call.outputSchemaDigest,
    isolation: isolated.evidence,
    humanLabelIncluded: false,
    sourceIdIncluded: false,
    criticalityIncluded: false,
    apiKeyUsed: false,
  };
  await writeJsonAtomic(path.join(directory, "request.json"), request);
  await writeJsonAtomic(path.join(directory, "status.json"), { callId: call.callId, fingerprint: call.fingerprint, status: "running", terminal: false, startedAt: request.startedAt });
  const eventStream = fs.createWriteStream(eventsPartial, { flags: "wx" });
  const stderrStream = fs.createWriteStream(stderrPartial, { flags: "wx" });
  const collector = createJsonlCollector();
  const processResult = await deps.runProcess(isolated.command, isolated.arguments, {
    env: isolated.environment,
    stdin: prompt,
    timeoutMs: run.timeoutMs,
    captureLimit: 2 * 1024 * 1024,
    onStdout(chunk) { eventStream.write(chunk); collector.push(chunk); },
    onStderr(chunk) { stderrStream.write(chunk); },
  });
  await Promise.all([closeStream(eventStream), closeStream(stderrStream)]);
  await rename(eventsPartial, eventsFile);
  await rename(stderrPartial, stderrFile);
  const metrics = collector.finish();
  let outputText = "";
  try { outputText = await readFile(finalMessageFile, "utf8"); } catch { /* classified below */ }
  if (!outputText.trim()) outputText = metrics.rootFinalMessage ?? "";
  let output = null;
  let parseError = null;
  try { output = JSON.parse(outputText); } catch (error) { parseError = `final output is not JSON: ${error.message}`; }
  const validation = output ? validateAtomicVerdict(item, output) : { valid: false, schemaErrors: [parseError ?? "missing final output"], evidenceErrors: [], observedVerdict: null, validatedVerdict: "indeterminate" };
  const processErrors = [];
  if (processResult.code !== 0) processErrors.push(`codex exited ${processResult.code}`);
  if (processResult.spawnError) processErrors.push(`spawn failed: ${processResult.spawnError}`);
  if (processResult.timedOut) processErrors.push("codex timed out");
  if (processResult.stdoutTruncated) processErrors.push("event stream was truncated");
  if (processResult.stderrTruncated) processErrors.push("stderr was truncated");
  if (metrics.parseErrors.length) processErrors.push(`${metrics.parseErrors.length} malformed JSONL events`);
  if (metrics.rootTurnCompleted !== 1) processErrors.push(`expected one completed root turn, observed ${metrics.rootTurnCompleted}`);
  if (metrics.rootTurnFailed || metrics.rootErrors.length) processErrors.push("root Codex turn emitted failure/error events");
  if (!outputText.trim()) processErrors.push("missing final output");
  const semanticTrace = evaluateSemanticJudgeTrace(metrics);
  const policyErrors = semanticTrace.errors;
  const valid = validation.valid && processErrors.length === 0 && policyErrors.length === 0;
  const completedAt = new Date().toISOString();
  const result = {
    ...call,
    semanticJudgeVersion: SEMANTIC_JUDGE_VERSION,
    shadowOnly: true,
    terminal: true,
    status: processResult.timedOut ? "timeout" : processErrors.length ? "process_failed" : policyErrors.length ? "policy_failed" : validation.schemaErrors.length ? "schema_invalid" : validation.evidenceErrors.length ? "evidence_invalid" : "completed_valid",
    startedAt: request.startedAt,
    completedAt,
    durationMs: processResult.durationMs,
    process: {
      code: processResult.code,
      signal: processResult.signal,
      timedOut: processResult.timedOut,
      spawnError: processResult.spawnError,
      stdoutTruncated: processResult.stdoutTruncated,
      stderrTruncated: processResult.stderrTruncated,
    },
    processErrors,
    policyErrors,
    output,
    outputSource: outputText ? (await stat(finalMessageFile)).size > 0 ? "output_last_message_file" : "root_jsonl_fallback" : "missing",
    validation: { valid, schemaErrors: validation.schemaErrors, evidenceErrors: validation.evidenceErrors },
    observedVerdict: validation.observedVerdict,
    validatedVerdict: valid ? validation.validatedVerdict : "indeterminate",
    usage: metrics.usage,
    metrics: {
      eventCount: metrics.eventCount,
      eventTypes: metrics.eventTypes,
      parseErrors: metrics.parseErrors,
      toolEventCount: metrics.toolEvents.length,
      commandEventCount: metrics.commandEvents.length,
      unexpectedEventCount: semanticTrace.unexpectedEventCount,
      toolEvents: metrics.toolEvents,
      commandEvents: metrics.commandEvents,
      eventRecords: metrics.eventRecords,
    },
    stopExecution: processErrors.length > 0 || policyErrors.length > 0 || executionStop(processResult, metrics),
  };
  await Promise.all([
    writeJsonAtomic(resultFile, result),
    writeJsonAtomic(path.join(directory, "usage.json"), metrics.usage),
    writeJsonAtomic(path.join(directory, "status.json"), { callId: call.callId, fingerprint: call.fingerprint, status: result.status, terminal: true, completedAt }),
  ]);
  const artifacts = await immutableIntegrity(runDirectory, [
    path.relative(runDirectory, promptFile),
    path.relative(runDirectory, outputSchema),
    path.relative(runDirectory, path.join(directory, "request.json")),
    path.relative(runDirectory, eventsFile),
    path.relative(runDirectory, finalMessageFile),
    path.relative(runDirectory, stderrFile),
    path.relative(runDirectory, path.join(directory, "usage.json")),
    path.relative(runDirectory, resultFile),
  ]);
  await writeJsonAtomic(path.join(directory, "artifact-integrity.json"), artifacts);
  return verifiedTerminalResult(runDirectory, result);
}

async function readResults(runDirectory, calls) {
  const results = [];
  for (const call of calls) {
    try {
      const result = await readJson(path.join(runDirectory, "calls", call.callId, "result.json"));
      if (result.terminal) results.push(await verifiedTerminalResult(runDirectory, result));
    } catch { /* incomplete */ }
  }
  return results;
}

export async function executeSemanticRun(config, dependencyOverrides = {}) {
  const deps = dependencies(dependencyOverrides);
  const requestedRunId = safeRunId(config.runId);
  const runDirectory = path.join(path.resolve(config.resultsRoot ?? path.join(packageRoot, "results")), requestedRunId);
  await access(runDirectory);
  await verifyIntegrity(runDirectory);
  const run = await readJson(path.join(runDirectory, "run.json"));
  if (run.semanticJudgeVersion !== SEMANTIC_JUDGE_VERSION) {
    throw new Error(`semantic-judge protocol ${run.semanticJudgeVersion ?? "unknown"} is rejected; prepare a fresh ${SEMANTIC_JUDGE_VERSION} run`);
  }
  const [calls, items, labels, catalog, blinding, frozenRuntimeIdentity, corpusManifest] = await Promise.all([
    readJson(path.join(runDirectory, "plan.json")),
    readJson(path.join(runDirectory, "source-items.json")),
    readJson(path.join(runDirectory, "human-labels.json")),
    readJson(path.join(runDirectory, "catalog.json")),
    readJson(path.join(runDirectory, "blinding-map.json")),
    readJson(path.join(runDirectory, "runtime-identity.json")),
    readJson(path.join(runDirectory, "corpus-manifest.json")),
  ]);
  if (run.runId !== requestedRunId) throw new Error("resume run id does not match frozen run");
  if (!run.shadowOnly || run.effectiveGrading !== false || run.deterministicScoreWrites !== false) throw new Error("run is not frozen as shadow-only");
  if (run.planDigest !== sha256(stableStringify(calls))) throw new Error("plan digest mismatch");
  if (run.source.itemsDigest !== sha256(stableStringify(items))) throw new Error("item digest mismatch");
  if (run.source.humanLabelsDigest !== sha256(stableStringify(labels))) throw new Error("human-label digest mismatch");
  if (run.source.manifestDigest !== sha256(stableStringify(corpusManifest))) throw new Error("corpus-manifest digest mismatch");
  if (run.blindingDigest !== sha256(stableStringify(blinding))) throw new Error("blinding-map digest mismatch");
  const rebuilt = createOpaqueMapping(items, blinding.nonceHex);
  const { modelItems, ...rebuiltBlinding } = rebuilt;
  if (stableStringify(rebuiltBlinding) !== stableStringify(blinding)) throw new Error("host-only blinding map is inconsistent");
  const harness = await deps.computeHarness(packageRoot);
  if (harness.digest !== run.harnessCodeDigest) throw new Error("harness code drifted after prepare; create a new preflight");
  const liveCatalog = await deps.loadCatalog(run.codex);
  if (liveCatalog.digest !== run.catalogDigest || catalog.digest !== run.catalogDigest) throw new Error("bundled catalog drifted after prepare");
  const isolation = await deps.validateIsolation({ codex: run.codex, bwrap: run.bwrap, requireAuth: true });
  if (!isolation.pass) throw new Error("isolation or existing Codex login is not ready");
  const liveAuthentication = await deps.probeLogin(run.codex);
  if (stableStringify(liveAuthentication) !== stableStringify(run.authentication)
    || liveAuthentication.method !== "chatgpt"
    || liveAuthentication.apiKeyForwarded !== false) {
    throw new Error("ChatGPT login method changed after semantic-judge preparation");
  }
  const liveRuntimeIdentity = await deps.captureRuntimeIdentity({ codex: run.codex, bwrap: run.bwrap });
  if (liveRuntimeIdentity.digest !== run.runtimeIdentityDigest
    || stableStringify(frozenRuntimeIdentity) !== stableStringify(run.runtimeIdentity)
    || stableStringify(liveRuntimeIdentity) !== stableStringify(frozenRuntimeIdentity)) {
    throw new Error("Codex, Bubblewrap, Node, or npm identity changed after semantic-judge preparation");
  }
  const itemById = new Map(modelItems.map((item) => [item.id, item]));
  for (const call of calls) {
    const item = itemById.get(call.itemId);
    if (!item) throw new Error(`plan references an unknown opaque item: ${call.itemId}`);
    const payload = serializeAtomicPayload(item);
    if (payload.bytes !== call.payloadBytes || sha256(stableStringify(item)) !== call.itemDigest) {
      throw new Error(`model payload drifted after prepare for ${call.callId}`);
    }
  }
  const journal = await createJournal(path.join(runDirectory, "journal.jsonl"));
  const priorJournal = await readJournal(path.join(runDirectory, "journal.jsonl"));
  const journaledStates = new Set(priorJournal.map((record) => `${record.callId}\0${record.status}`));
  const history = await createJournal(path.join(runDirectory, "execution-history.jsonl"));
  await history.append({ type: "execute_started", at: new Date().toISOString(), runId: run.runId, model: run.judge.model, effort: run.judge.effort });
  for (const call of calls) {
    let result;
    try {
      result = await runAtomicCall({ run, runDirectory, call, item: itemById.get(call.itemId), deps });
    } catch (error) {
      result = await recoverInterruptedCall({ runDirectory, call, reason: `semantic judge attempt failed closed: ${error.message}` });
    }
    const journalKey = `${result.callId}\0${result.status}`;
    if (!journaledStates.has(journalKey)) {
      await journal.append(result);
      journaledStates.add(journalKey);
    }
    if (result.stopExecution) break;
  }
  await Promise.all([journal.flush(), history.flush()]);
  const results = await readResults(runDirectory, calls);
  const summary = summarizeAtomicPilot({ items, labels, calls, results, blinding });
  const usage = results.reduce((total, result) => {
    for (const key of ["input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens"]) total[key] += result.usage?.[key] ?? 0;
    total.durationMs += result.durationMs ?? 0;
    return total;
  }, { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0, durationMs: 0 });
  const finalSummary = { ...summary, runId: run.runId, judge: run.judge, usage, humanLabelsMergedOnlyAtAggregate: true };
  await Promise.all([
    writeJsonAtomic(path.join(runDirectory, "summary.json"), finalSummary),
    writeJsonAtomic(path.join(runDirectory, "results.json"), { shadowOnly: true, deterministicScoresModified: false, results }),
    writeFile(path.join(runDirectory, "report.md"), shadowReport(finalSummary, run, calls, results, labels, blinding), "utf8"),
  ]);
  await history.append({ type: "execute_completed", at: new Date().toISOString(), runId: run.runId, status: finalSummary.status, terminalCalls: results.length });
  await history.flush();
  return { runDirectory, summary: finalSummary };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.flags.has("help")) {
    console.log(help());
    return;
  }
  if (options.flags.has("prepare")) {
    assertPrepareOptions(options);
    const result = await prepareSemanticRun({
      runId: options.values["run-id"],
      sourceRoot: options.values.source,
      resultsRoot: options.values.results,
      model: options.values.model,
      effort: options.values.effort,
      seed: options.values.seed,
      timeoutMs: options.values["timeout-ms"] ? parsePositive(options.values["timeout-ms"], "--timeout-ms") : undefined,
      maxEstimatedCredits: options.values["max-estimated-credits"] ? parsePositive(options.values["max-estimated-credits"], "--max-estimated-credits") : undefined,
      codex: options.values.codex,
      bwrap: options.values.bwrap,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  assertResumeOptions(options);
  const result = await executeSemanticRun({ runId: options.values.resume, resultsRoot: options.values.results });
  console.log(JSON.stringify(result, null, 2));
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
