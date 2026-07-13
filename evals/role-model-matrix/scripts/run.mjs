#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compatibleMatrix, loadCatalog } from "../lib/catalog.mjs";
import { parsePositiveInteger, relativePortable, sanitizeId, sha256, stableStringify, writeJsonAtomic } from "../lib/common.mjs";
import { createJournal, latestByFingerprint, readJournal } from "../lib/journal.mjs";
import { loadSuite } from "../lib/manifest.mjs";
import {
  CREDIT_PLANNING_SNAPSHOT,
  EXECUTION_DEFAULTS,
  csvList,
  defaultSeed,
  enforcePlanCeilings,
  optionHelp,
  parseOptions,
  seededShuffle,
} from "../lib/options.mjs";
import { generateReports } from "../lib/reporting.mjs";
import { codexVersion, HARNESS_VERSION, makeCase, markInterrupted, runCase } from "../lib/runner.mjs";
import { computeHarnessCodeDigest, runHarnessTests, validateEnvironment } from "./validate.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function selectedRoles(suite, filter) {
  if (!filter) return suite.roles;
  const requested = new Set(filter);
  const found = suite.roles.filter((role) => requested.has(role.id));
  const missing = [...requested].filter((id) => !found.some((role) => role.id === id));
  if (missing.length) throw new Error(`unknown role filters: ${missing.join(", ")}`);
  return found;
}

export function planMatrix({ suite, catalog, phase, roleFilter, modelFilter, effortFilter, repetitions, seed, cliVersionValue, outputSchemaDigest, harnessCodeDigest }) {
  const roles = selectedRoles(suite, roleFilter);
  const liveKeys = new Set(compatibleMatrix(catalog).map((pair) => `${pair.model}\0${pair.effort}`));
  for (const pair of suite.matrix) if (!liveKeys.has(`${pair.model}\0${pair.effort}`)) throw new Error(`frozen matrix pair is unavailable: ${pair.model}/${pair.effort}`);
  const supported = suite.matrix.filter((pair) => (!modelFilter || modelFilter.includes(pair.model)) && (!effortFilter || effortFilter.includes(pair.effort)));
  if (modelFilter) {
    const known = new Set(suite.matrix.map((pair) => pair.model));
    const unknown = modelFilter.filter((model) => !known.has(model));
    if (unknown.length) throw new Error(`models are not in the frozen matrix: ${unknown.join(", ")}`);
  }
  if (effortFilter) {
    const known = new Set(suite.matrix.map((pair) => pair.effort));
    const unknown = effortFilter.filter((effort) => !known.has(effort));
    if (unknown.length) throw new Error(`efforts are not in the frozen matrix: ${unknown.join(", ")}`);
  }
  const supportedKeys = new Set(suite.matrix.map((pair) => `${pair.model}\0${pair.effort}`));
  const cells = [];
  if (phase === "calibration") {
    for (const role of roles) {
      const baseline = suite.baselines[role.id];
      if (modelFilter && !modelFilter.includes(baseline.model)) continue;
      if (effortFilter && !effortFilter.includes(baseline.effort)) continue;
      if (!supportedKeys.has(`${baseline.model}\0${baseline.effort}`)) throw new Error(`unsupported baseline for ${role.id}: ${baseline.model}/${baseline.effort}`);
      cells.push({ role, model: baseline.model, effort: baseline.effort });
    }
  } else if (phase === "screen") {
    for (const role of roles) for (const pair of supported) cells.push({ role, ...pair });
  } else {
    throw new Error("--phase must be calibration or screen");
  }
  if (!cells.length) throw new Error("filters selected no valid role/model/effort cells");
  const cases = [];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    // Shuffle the cell order independently per repetition, then interleave all
    // repetitions with a final shuffle. This avoids model or role blocks while
    // remaining exactly reproducible from the persisted seed.
    for (const cell of seededShuffle(cells, `${seed}:cells:${repetition}`, sha256)) {
      cases.push(makeCase({
        suite,
        role: cell.role,
        model: cell.model,
        effort: cell.effort,
        repetition,
        catalogDigest: catalog.digest,
        cliVersion: cliVersionValue,
        outputSchemaDigest,
        harnessDigest: harnessCodeDigest,
        phase,
      }));
    }
  }
  return seededShuffle(cases, `${seed}:all`, sha256);
}

function newRunId(phase, requested) {
  if (requested) {
    const sanitized = sanitizeId(requested);
    if (!sanitized) throw new Error("--run-id must contain at least one letter, digit, dot, underscore, or hyphen");
    return sanitized;
  }
  return `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${phase}-${sha256(String(process.hrtime.bigint())).slice(0, 6)}`;
}

function validateScratchRoot(scratchRoot) {
  const resolved = path.resolve(scratchRoot);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`scratch root must be a dedicated child beneath ${os.tmpdir()}: ${resolved}`);
  }
  return resolved;
}

function roleDescriptors(suite) {
  return suite.roles.map((role) => ({
    roleId: role.id,
    displayName: role.displayName,
    taskId: role.fixture?.fixtureId ? `${role.fixture.fixtureId}:task` : `${role.id}-task-v1`,
    fixtureId: role.fixture?.fixtureId ?? `${role.id}-fixture-v1`,
    fixtureVersion: role.fixture?.version ?? null,
    difficulty: role.fixture?.difficulty ?? null,
    taskSummary: role.fixture?.taskSummary ?? null,
    instructionSource: role.fixture?.instructionSource ?? null,
    taskFile: relativePortable(suite.root, role.paths.taskFile),
    fixturePath: relativePortable(suite.root, role.paths.workspace),
    sandbox: role.sandbox,
    currentBaseline: suite.baselines[role.id],
  }));
}

function executionSettings(options, pinned = {}) {
  const pinnedNames = {
    "service-tier": "serviceTier",
    repetitions: "repetitions",
    concurrency: "concurrency",
    "concurrency-ceiling": "concurrencyCeiling",
    "candidate-ceiling": "candidateCeiling",
    "timeout-ms": "timeoutMs",
    "command-timeout-ms": "commandTimeoutMs",
    "max-timeouts": "maxTimeouts",
    "max-harness-failures": "maxHarnessFailures",
    "max-total-tokens": "maxTotalTokens",
    "max-estimated-credits": "maxEstimatedCredits",
  };
  const value = (name, fallback) => options.values[name] ?? pinned[pinnedNames[name] ?? name] ?? String(fallback);
  const serviceTier = value("service-tier", EXECUTION_DEFAULTS.serviceTier);
  if (serviceTier !== "default") throw new Error("only --service-tier default is supported; benchmark Fast as a separate experiment");
  const maxTotalTokensRaw = options.values["max-total-tokens"] ?? pinned.maxTotalTokens;
  return {
    repetitions: parsePositiveInteger(value("repetitions", EXECUTION_DEFAULTS.repetitions), "--repetitions"),
    concurrency: parsePositiveInteger(value("concurrency", EXECUTION_DEFAULTS.concurrency), "--concurrency"),
    concurrencyCeiling: parsePositiveInteger(value("concurrency-ceiling", EXECUTION_DEFAULTS.concurrencyCeiling), "--concurrency-ceiling"),
    candidateCeiling: parsePositiveInteger(value("candidate-ceiling", EXECUTION_DEFAULTS.candidateCeiling), "--candidate-ceiling"),
    timeoutMs: parsePositiveInteger(value("timeout-ms", EXECUTION_DEFAULTS.timeoutMs), "--timeout-ms"),
    commandTimeoutMs: parsePositiveInteger(value("command-timeout-ms", EXECUTION_DEFAULTS.commandTimeoutMs), "--command-timeout-ms"),
    maxTimeouts: parsePositiveInteger(value("max-timeouts", EXECUTION_DEFAULTS.maxTimeouts), "--max-timeouts"),
    maxHarnessFailures: parsePositiveInteger(value("max-harness-failures", EXECUTION_DEFAULTS.maxHarnessFailures), "--max-harness-failures"),
    maxTotalTokens: maxTotalTokensRaw === undefined || maxTotalTokensRaw === null ? null : parsePositiveInteger(maxTotalTokensRaw, "--max-total-tokens"),
    maxEstimatedCredits: parsePositiveInteger(value("max-estimated-credits", EXECUTION_DEFAULTS.maxEstimatedCredits), "--max-estimated-credits"),
    serviceTier,
  };
}

function creditPlanning(plannedCases) {
  return {
    ...CREDIT_PLANNING_SNAPSHOT,
    candidateMessages: plannedCases,
    estimatedCredits: {
      min: plannedCases * CREDIT_PLANNING_SNAPSHOT.creditsPerMessage.min,
      max: plannedCases * CREDIT_PLANNING_SNAPSHOT.creditsPerMessage.max,
    },
    excludes: ["automated judge calls", "retries", "Ultra child-agent messages"],
  };
}

export function buildPreview({ run, plan, settings, validation }) {
  const selectedKeys = new Set(plan.map((item) => `${item.model}\0${item.effort}`));
  const selectedConfigurations = run.matrix
    .filter((pair) => selectedKeys.has(`${pair.model}\0${pair.effort}`))
    .map((pair) => ({ ...pair, plannedCalls: plan.filter((item) => item.model === pair.model && item.effort === pair.effort).length }));
  return {
    kind: "ai-team-role-model-evaluation-preflight",
    billedModelCallsPerformed: 0,
    runId: run.runId,
    phase: run.phase,
    seed: run.seed,
    roles: run.roleDescriptors,
    frozenConfigurationCount: run.matrix.length,
    selectedConfigurationCount: selectedConfigurations.length,
    selectedConfigurations,
    repetitions: run.repetitions,
    totalCandidateCalls: plan.length,
    specialistUltraCalls: plan.filter((item) => item.delegationConstrained).length,
    rootUltraCalls: plan.filter((item) => item.effort === "ultra" && item.multiAgentEnabled).length,
    deterministicJudgeCalls: plan.length,
    modelJudgeCalls: 0,
    schedule: plan.map((item, index) => {
      const role = run.roleDescriptors.find((candidate) => candidate.roleId === item.roleId);
      return { order: index + 1, caseId: item.caseId, roleId: item.roleId, displayName: role?.displayName ?? item.displayName, taskId: role?.taskId ?? null, fixtureId: role?.fixtureId ?? null, model: item.model, effort: item.effort, repetition: item.repetition, isBaseline: item.isBaseline, delegationConstrained: item.delegationConstrained };
    }),
    execution: {
      concurrency: settings.concurrency,
      caseTimeoutMs: settings.timeoutMs,
      graderCommandTimeoutMs: settings.commandTimeoutMs,
      serviceTier: settings.serviceTier,
      candidateCeiling: settings.candidateCeiling,
      concurrencyCeiling: settings.concurrencyCeiling,
      maxTimeouts: settings.maxTimeouts,
      maxHarnessFailures: settings.maxHarnessFailures,
      maxTotalTokens: settings.maxTotalTokens,
      maxEstimatedCredits: settings.maxEstimatedCredits,
    },
    isolation: {
      mode: "Bubblewrap Codex namespace plus a nested candidate-command namespace that omits auth/control paths, and a separate networkless grader namespace",
      approvalPolicy: "never",
      networkAccess: "candidate API transport only; candidate tools and grader namespace have no network access",
      userConfig: "ignored",
      userRules: "ignored",
      memoriesAppsPlugins: "disabled",
      specialistDelegation: "disabled",
      rootDelegation: "enabled with bounded depth and threads",
      scratchGit: "clean local main-branch baseline; metadata excluded from workspace scoring",
      sandboxByRole: Object.fromEntries(run.roleDescriptors.map((role) => [role.roleId, role.sandbox])),
      preflightProbe: validation.isolation,
    },
    creditPlanning: run.creditPlanning,
    resultPath: validation.resultPath,
    harnessCodeDigest: run.harnessCodeDigest,
    caseFingerprintInputDigest: run.caseFingerprintInputDigest,
    planDigest: run.planDigest,
    resumeCommand: `node evals/role-model-matrix/scripts/run.mjs --results ${JSON.stringify(validation.resultPath.resultsRoot)} --resume ${run.runId} --execute`,
  };
}

function preflightMarkdown(preview) {
  const lines = [
    `# AI Team Evaluation Preflight: ${preview.runId}`,
    "",
    "> This file was generated without model calls. Review it before using the exact resume command below.",
    "",
    "## Frozen Plan",
    "",
    `- Phase: \`${preview.phase}\``,
    `- Seed: \`${preview.seed}\``,
    `- Roles/tasks/fixtures: ${preview.roles.length}`,
    `- Frozen model/effort configurations: ${preview.frozenConfigurationCount}`,
    `- Selected configurations in this plan: ${preview.selectedConfigurationCount}`,
    `- Candidate calls: ${preview.totalCandidateCalls}`,
    `- Deterministic grader executions: ${preview.deterministicJudgeCalls}`,
    `- Specialist Ultra calls (delegation constrained): ${preview.specialistUltraCalls}`,
    `- Root Ultra calls (delegation available): ${preview.rootUltraCalls}`,
    `- Harness code digest: \`${preview.harnessCodeDigest}\``,
    `- Case fingerprint input digest: \`${preview.caseFingerprintInputDigest}\``,
    `- Frozen plan digest: \`${preview.planDigest}\``,
    "",
    "## Roles And Fixtures",
    "",
    "| Role | Task ID | Fixture ID / version | Difficulty | Task summary | Sandbox | Current baseline |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const role of preview.roles) {
    lines.push(`| ${role.displayName} | \`${role.taskId}\` | \`${role.fixtureId}\` / \`${role.fixtureVersion ?? "unknown"}\` | ${role.difficulty ?? "unknown"} | ${role.taskSummary ?? ""} | \`${role.sandbox}\` | \`${role.currentBaseline.model}/${role.currentBaseline.effort}\` |`);
  }
  lines.push(
    "",
    "## Selected Model And Reasoning Configurations",
    "",
    "| Model | Reasoning effort | Planned calls |",
    "|---|---:|---:|",
  );
  for (const configuration of preview.selectedConfigurations) {
    lines.push(`| \`${configuration.model}\` | \`${configuration.effort}\` | ${configuration.plannedCalls} |`);
  }
  lines.push(
    "",
    "## Complete Randomized Schedule",
    "",
    "| Order | Case | Role | Task | Fixture | Model | Effort | Repeat | Current baseline | Delegation constrained |",
    "|---:|---|---|---|---|---|---:|---:|:---:|:---:|",
  );
  for (const entry of preview.schedule) {
    lines.push(`| ${entry.order} | \`${entry.caseId}\` | ${entry.displayName} | \`${entry.taskId}\` | \`${entry.fixtureId}\` | \`${entry.model}\` | \`${entry.effort}\` | ${entry.repetition} | ${entry.isBaseline ? "yes" : ""} | ${entry.delegationConstrained ? "yes" : ""} |`);
  }
  lines.push(
    "",
    "## Execution Guardrails",
    "",
    `- Concurrency: ${preview.execution.concurrency} (ceiling ${preview.execution.concurrencyCeiling})`,
    `- Case timeout: ${preview.execution.caseTimeoutMs} ms`,
    `- Grader command timeout: ${preview.execution.graderCommandTimeoutMs} ms`,
    `- Maximum timeouts: ${preview.execution.maxTimeouts}`,
    `- Maximum harness failures: ${preview.execution.maxHarnessFailures}`,
    `- Maximum captured tokens: ${preview.execution.maxTotalTokens ?? "not set"}`,
    `- Candidate ceiling: ${preview.execution.candidateCeiling}`,
    `- Maximum planning estimate: ${preview.execution.maxEstimatedCredits} credits`,
    `- Service tier: \`${preview.execution.serviceTier}\``,
    `- Isolation: ${preview.isolation.mode}; approvals ${preview.isolation.approvalPolicy}; parent Codex API egress retained; candidate tool network disabled by Codex sandbox and trace-gated`,
    `- Bubblewrap probe: ${preview.isolation.preflightProbe?.structural?.bubblewrap?.pass ? "pass" : "fail"}`,
    `- Codex runtime probe: ${preview.isolation.preflightProbe?.structural?.codexRuntime?.pass ? "pass" : "fail"} (${preview.isolation.preflightProbe?.structural?.codexRuntime?.kind ?? "unknown"})`,
    `- Fixture runtime probe: ${preview.isolation.preflightProbe?.structural?.fixtureRuntime?.pass ? "pass" : "fail"} (Node ${preview.isolation.preflightProbe?.structural?.fixtureRuntime?.node ?? "unknown"}; npm ${preview.isolation.preflightProbe?.structural?.fixtureRuntime?.npm ?? "unknown"})`,
    `- Candidate command credential-boundary probe: ${preview.isolation.preflightProbe?.structural?.candidateCommandNamespace?.pass ? "pass" : "fail"}`,
    `- Networkless grader probe: ${preview.isolation.preflightProbe?.structural?.graderNamespace?.pass ? "pass" : "fail"}`,
    `- Scratch Git baseline: ${preview.isolation.scratchGit}`,
    `- Authentication metadata probe: ${preview.isolation.preflightProbe?.authentication?.required ? (preview.isolation.preflightProbe.authentication.present ? "pass" : "fail") : "not required for this preview"}`,
    "",
    "## Credit Planning Range",
    "",
    `- ${preview.creditPlanning.creditsPerMessage.min}-${preview.creditPlanning.creditsPerMessage.max} credits per candidate message`,
    `- Plan range: ${preview.creditPlanning.estimatedCredits.min}-${preview.creditPlanning.estimatedCredits.max} credits`,
    `- Source: ${preview.creditPlanning.source} (accessed ${preview.creditPlanning.accessedAt})`,
    `- Caveat: ${preview.creditPlanning.caveat}`,
    `- Excludes: ${preview.creditPlanning.excludes.join(", ")}`,
    "",
    "## Review Gate",
    "",
    "- [ ] Roles, tasks, fixtures, and current baselines are correct.",
    "- [ ] Candidate count, randomized schedule seed, concurrency, and timeouts are acceptable.",
    "- [ ] Credit planning range and exclusions are understood.",
    "- [ ] Result path is local/ignored and the isolation policy is acceptable.",
    "",
    "Execution is deliberately unavailable from a new plan. After review, run:",
    "",
    "```bash",
    preview.resumeCommand,
    "```",
    "",
  );
  return lines.join("\n");
}

export function preflightArtifactDigests(preview, markdownText) {
  const preflightJsonDigest = sha256(stableStringify(preview));
  const preflightMarkdownDigest = sha256(markdownText);
  return {
    preflightJsonDigest,
    preflightMarkdownDigest,
    preflightDigest: sha256(stableStringify({ preflightJsonDigest, preflightMarkdownDigest })),
  };
}

function usageTotal(record) {
  const usage = record?.usage ?? {};
  if (Number.isFinite(usage.total_tokens)) return usage.total_tokens;
  return (Number.isFinite(usage.input_tokens) ? usage.input_tokens : 0) + (Number.isFinite(usage.output_tokens) ? usage.output_tokens : 0);
}

export function guardrailState(records, settings) {
  const latest = [...latestByFingerprint(records).values()];
  const timeouts = latest.filter((record) => record.status === "timeout").length;
  const interruptedCases = latest.filter((record) => record.status === "interrupted").length;
  const harnessFailures = latest.filter((record) => record.status === "harness_failed" || record.status === "interrupted").length;
  const totalTokens = latest.reduce((total, record) => total + usageTotal(record), 0);
  let stopReason = null;
  if (timeouts >= settings.maxTimeouts && settings.maxTimeouts >= 0) stopReason = `timeout ceiling reached (${timeouts}/${settings.maxTimeouts})`;
  if (!stopReason && harnessFailures >= settings.maxHarnessFailures && settings.maxHarnessFailures >= 0) stopReason = `harness-failure ceiling reached (${harnessFailures}/${settings.maxHarnessFailures})`;
  if (!stopReason && settings.maxTotalTokens !== null && totalTokens >= settings.maxTotalTokens) stopReason = `captured-token ceiling reached (${totalTokens}/${settings.maxTotalTokens})`;
  return { timeouts, harnessFailures, interruptedCases, totalTokens, stopReason };
}

async function executePlan({ suite, plan, runDirectory, scratchRoot, codex, bwrap, authFile, settings, retryFailed }) {
  const journalFile = path.join(runDirectory, "journal.jsonl");
  const records = await readJournal(journalFile);
  const existing = latestByFingerprint(records);
  const attempts = new Map();
  for (const record of records) if (record.fingerprint) attempts.set(record.fingerprint, (attempts.get(record.fingerprint) ?? 0) + 1);
  const pending = plan.filter((caseInfo) => {
    const prior = existing.get(caseInfo.fingerprint);
    if (!prior || !prior.terminal) return true;
    if (retryFailed && ["harness_failed", "gate_failed", "timeout"].includes(prior.status)) return true;
    return false;
  }).map((caseInfo) => ({ caseInfo, attempt: (attempts.get(caseInfo.fingerprint) ?? 0) + 1 }));
  const roleMap = new Map(suite.roles.map((role) => [role.id, role]));
  const journal = await createJournal(journalFile);
  const controller = new AbortController();
  const latestRecords = new Map(existing);
  let cursor = 0;
  let processed = 0;
  let stopScheduling = false;
  let interrupted = false;
  let stopReason = guardrailState([...latestRecords.values()], settings).stopReason;
  if (stopReason) stopScheduling = true;
  const onSignal = () => {
    interrupted = true;
    stopReason = "operator signal";
    stopScheduling = true;
    controller.abort();
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  const outputSchema = path.join(suite.root, "schemas", "output.schema.json");

  function takePending() {
    if (stopScheduling || cursor >= pending.length) return null;
    const item = { ...pending[cursor], scheduleIndex: cursor };
    cursor += 1;
    return item;
  }

  async function worker() {
    while (true) {
      const item = takePending();
      if (!item) return;
      const { caseInfo, attempt, scheduleIndex } = item;
      let result;
      try {
        result = await runCase({
          caseInfo,
          role: roleMap.get(caseInfo.roleId),
          runDirectory,
          scratchRoot,
          codex,
          outputSchema,
          timeoutMs: settings.timeoutMs,
          commandTimeoutMs: settings.commandTimeoutMs,
          suiteRoot: suite.root,
          bwrap,
          authFile,
          signal: controller.signal,
          attempt,
        });
      } catch (error) {
        result = await markInterrupted(caseInfo, runDirectory, error, attempt);
      }
      await journal.append(result);
      processed += 1;
      latestRecords.set(caseInfo.fingerprint, result);
      process.stderr.write(`[${scheduleIndex + 1}/${pending.length}] ${caseInfo.caseId}: ${result.status}\n`);
      const state = guardrailState([...latestRecords.values()], settings);
      if (result.stopSuite) {
        stopReason = result.stopReason ?? "Codex usage, entitlement, availability, or rate-limit stop";
        stopScheduling = true;
        controller.abort();
      } else if (state.stopReason) {
        stopReason = state.stopReason;
        stopScheduling = true;
      }
    }
  }

  if (!stopScheduling) {
    await Promise.all(Array.from({ length: Math.min(settings.concurrency, Math.max(1, pending.length)) }, () => worker()));
  }
  await journal.flush();
  process.removeListener("SIGINT", onSignal);
  process.removeListener("SIGTERM", onSignal);
  const finalRecords = [...latestRecords.values()];
  const finalGuardrails = guardrailState(finalRecords, settings);
  const terminalFingerprints = new Set(finalRecords.filter((record) => record.terminal).map((record) => record.fingerprint));
  const remainingPlanCases = plan.filter((caseInfo) => !terminalFingerprints.has(caseInfo.fingerprint)).length;
  return {
    pendingAtStart: pending.length,
    scheduled: cursor,
    processed,
    unscheduledThisInvocation: Math.max(0, pending.length - cursor),
    remaining: remainingPlanCases,
    nonterminalCases: finalRecords.filter((record) => !record.terminal).length,
    interrupted,
    stopped: Boolean(stopReason),
    stopReason,
    guardrails: finalGuardrails,
  };
}

export function rejectResumePlanModifiers(options) {
  const forbidden = [
    "suite", "phase", "run-id", "roles", "models", "efforts", "repetitions", "seed",
    "scratch", "codex", "bwrap", "auth-file", "service-tier", "concurrency",
    "concurrency-ceiling", "candidate-ceiling", "timeout-ms", "command-timeout-ms",
    "max-timeouts", "max-harness-failures", "max-total-tokens", "max-estimated-credits",
  ];
  const present = forbidden.filter((name) => options.values[name] !== undefined);
  if (present.length) throw new Error(`resume uses its frozen plan; remove these options: ${present.map((name) => `--${name}`).join(", ")}`);
  if (options.flags.has("bundled-catalog")) throw new Error("resume uses its frozen catalog source; remove --bundled-catalog");
}

export function rejectPrepareRuntimeModifiers(options) {
  const forbidden = ["suite", "codex", "bwrap", "auth-file"];
  const present = forbidden.filter((name) => options.values[name] !== undefined);
  if (present.length) throw new Error(`prepared runs use the default validated runtime; remove these options: ${present.map((name) => `--${name}`).join(", ")}`);
  if (options.flags.has("bundled-catalog")) throw new Error("prepared runs require the refreshed catalog; remove --bundled-catalog");
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.flags.has("help")) {
    console.log(`Usage: run.mjs --phase <calibration|screen> --dry-run [options]\n       run.mjs --phase <calibration|screen> --prepare [options]\n       run.mjs --resume <run-id> --execute [--retry-failed]\n\n${optionHelp()}`);
    return;
  }
  const modes = ["dry-run", "prepare", "execute"].filter((flag) => options.flags.has(flag));
  if (modes.length !== 1) throw new Error("choose exactly one of --dry-run, --prepare, or --execute");
  const mode = modes[0];
  if (mode === "execute" && !options.values.resume) throw new Error("direct execution is disabled; use --prepare, review preflight.md, then --resume <run-id> --execute");
  if (mode !== "execute" && options.values.resume) throw new Error("--resume is only valid with --execute");
  if (mode === "prepare") rejectPrepareRuntimeModifiers(options);

  const suiteFile = path.resolve(options.values.suite ?? path.join(here, "..", "suite.json"));
  const suite = await loadSuite(suiteFile);
  const codex = options.values.codex ?? "codex";
  const resultsRoot = path.resolve(options.values.results ?? path.join(suite.root, "results"));
  const catalog = await loadCatalog({ codex, bundled: options.flags.has("bundled-catalog") });
  const validation = await validateEnvironment({
    suite,
    catalog,
    resultsRoot,
    codex,
    bwrap: options.values.bwrap,
    authFile: options.values["auth-file"],
    requireAuth: mode !== "dry-run",
  });
  const cliVersionValue = await codexVersion(codex);
  const outputSchemaText = await readFile(path.join(suite.root, "schemas", "output.schema.json"), "utf8");
  const outputSchemaDigest = sha256(outputSchemaText);
  const harness = await computeHarnessCodeDigest(suite.root);
  let runDirectory;
  let run;
  let plan;

  if (mode === "execute") {
    rejectResumePlanModifiers(options);
    const runId = sanitizeId(options.values.resume);
    if (!runId) throw new Error("--resume must contain at least one letter, digit, dot, underscore, or hyphen");
    runDirectory = path.join(resultsRoot, runId);
    run = JSON.parse(await readFile(path.join(runDirectory, "run.json"), "utf8"));
    plan = JSON.parse(await readFile(path.join(runDirectory, "plan.json"), "utf8"));
    const preflightJsonText = await readFile(path.join(runDirectory, "preflight.json"), "utf8");
    const preflightMarkdownText = await readFile(path.join(runDirectory, "preflight.md"), "utf8");
    const storedPreview = JSON.parse(preflightJsonText);
    if (run.preflightPrepared !== true) throw new Error("run is not a persisted reviewed preflight; prepare it before execution");
    const settings = executionSettings({ values: {}, flags: new Set(), positional: [] }, run.executionOptions ?? {});
    const drift = [];
    if (run.planDigest !== sha256(stableStringify(plan))) drift.push("frozen plan digest");
    if (run.harnessVersion !== HARNESS_VERSION) drift.push("harness version");
    if (run.harnessCodeDigest !== harness.digest) drift.push("harness code digest");
    if (run.suiteVersion !== suite.suiteVersion) drift.push("suite version");
    if (run.catalogDigest !== catalog.digest) drift.push("model catalog");
    if (run.cliVersion !== cliVersionValue) drift.push("Codex CLI version");
    if (run.outputSchemaDigest !== outputSchemaDigest) drift.push("output schema");
    const currentCaseInputDigest = sha256(stableStringify({ outputSchemaDigest, harnessCodeDigest: harness.digest }));
    if (run.caseFingerprintInputDigest !== currentCaseInputDigest) drift.push("case fingerprint inputs");
    const currentRoles = Object.fromEntries(suite.roles.map((role) => [role.id, role.fingerprint]));
    if (stableStringify(run.roleFingerprints) !== stableStringify(currentRoles)) drift.push("role fixtures");
    const expectedPreview = buildPreview({ run, plan, settings, validation });
    const expectedMarkdown = `${preflightMarkdown(expectedPreview)}\n`;
    const { preflightJsonDigest, preflightMarkdownDigest, preflightDigest } = preflightArtifactDigests(storedPreview, preflightMarkdownText);
    if (run.preflightJsonDigest !== preflightJsonDigest || run.preflightMarkdownDigest !== preflightMarkdownDigest || run.preflightDigest !== preflightDigest) drift.push("preflight artifact digest");
    if (stableStringify(storedPreview) !== stableStringify(expectedPreview)) drift.push("preflight JSON reconstruction");
    if (preflightMarkdownText !== expectedMarkdown) drift.push("preflight Markdown reconstruction");
    if (drift.length) throw new Error(`cannot resume because these fingerprints changed: ${drift.join(", ")}`);

    enforcePlanCeilings({ plannedCases: plan.length, ...settings });
    const scratchRoot = validateScratchRoot(run.scratchRoot ?? "/tmp/ai-team-role-evals");
    const tests = await runHarnessTests(suite.root);
    const invocation = {
      startedAt: new Date().toISOString(),
      mode: "execute-prepared-plan",
      planReviewGate: { acknowledged: true, method: "explicit --resume <run-id> --execute", planDigest: run.planDigest },
      executionOptions: settings,
      scratchRoot,
      resultsRoot,
      retryFailed: options.flags.has("retry-failed"),
      staticValidation: { ok: validation.ok, harnessCodeDigest: validation.harnessCodeDigest, resultPath: validation.resultPath, isolation: validation.isolation },
      tests: { command: tests.command, testFiles: tests.testFiles, testCount: tests.testCount, durationMs: tests.durationMs, passed: true },
    };
    run = { ...run, status: "running", executionOptions: settings, scratchRoot, updatedAt: new Date().toISOString(), executionHistory: [...(run.executionHistory ?? []), invocation] };
    await writeJsonAtomic(path.join(runDirectory, "run.json"), run);
    const execution = await executePlan({ suite, plan, runDirectory, scratchRoot, codex, bwrap: options.values.bwrap, authFile: options.values["auth-file"], settings, retryFailed: options.flags.has("retry-failed") });
    const latestInvocation = { ...invocation, completedAt: new Date().toISOString(), execution };
    const status = execution.interrupted ? "interrupted" : execution.stopped ? "stopped" : execution.remaining > 0 ? "partial" : "completed";
    run = { ...run, status, updatedAt: latestInvocation.completedAt, execution, executionHistory: [...run.executionHistory.slice(0, -1), latestInvocation] };
    await writeJsonAtomic(path.join(runDirectory, "run.json"), run);
    const report = await generateReports(runDirectory);
    console.log(JSON.stringify({ runId: run.runId, runDirectory, status, execution, statuses: report.statusCounts, report: path.join(runDirectory, "report.md") }, null, 2));
    if (status !== "completed") process.exitCode = 2;
    return;
  }

  const phase = options.values.phase;
  if (!phase) throw new Error("new previews require --phase calibration or --phase screen");
  const settings = executionSettings(options);
  const seed = options.values.seed ?? defaultSeed();
  const caseFingerprintInputDigest = sha256(stableStringify({ outputSchemaDigest, harnessCodeDigest: harness.digest }));
  plan = planMatrix({
    suite,
    catalog,
    phase,
    roleFilter: csvList(options.values.roles),
    modelFilter: csvList(options.values.models),
    effortFilter: csvList(options.values.efforts),
    repetitions: settings.repetitions,
    seed,
    cliVersionValue,
    outputSchemaDigest,
    harnessCodeDigest: harness.digest,
  });
  enforcePlanCeilings({ plannedCases: plan.length, ...settings });
  const runId = newRunId(phase, options.values["run-id"]);
  runDirectory = path.join(resultsRoot, runId);
  run = {
    runId,
    phase,
    status: mode === "prepare" ? "prepared" : "preview",
    preflightPrepared: mode === "prepare",
    createdAt: new Date().toISOString(),
    harnessVersion: HARNESS_VERSION,
    harnessCodeDigest: harness.digest,
    harnessCodeFiles: harness.entries,
    caseFingerprintInputDigest,
    suiteFile: suite.suiteFile,
    suiteVersion: suite.suiteVersion,
    cliVersion: cliVersionValue,
    catalogDigest: catalog.digest,
    catalogSource: catalog.source,
    outputSchemaDigest,
    roleFingerprints: Object.fromEntries(suite.roles.map((role) => [role.id, role.fingerprint])),
    roleDescriptors: roleDescriptors(suite),
    baselines: suite.baselines,
    matrix: suite.matrix,
    plannedCases: plan.length,
    planDigest: sha256(stableStringify(plan)),
    repetitions: settings.repetitions,
    seed,
    serviceTier: settings.serviceTier,
    executionOptions: settings,
    scratchRoot: validateScratchRoot(options.values.scratch ?? "/tmp/ai-team-role-evals"),
    resultPathValidation: validation.resultPath,
    isolationPreflight: validation.isolation,
    creditPlanning: creditPlanning(plan.length),
    humanReview: { status: "not_reviewed", reviewer: null, reviewedAt: null, notes: null },
  };
  const preview = buildPreview({ run, plan, settings, validation });
  if (mode === "dry-run") {
    console.log(JSON.stringify({ dryRun: true, preview, run, cases: plan }, null, 2));
    return;
  }

  await mkdir(resultsRoot, { recursive: true });
  try {
    await mkdir(runDirectory, { recursive: false });
  } catch (error) {
    if (error.code === "EEXIST") throw new Error(`run directory already exists: ${runDirectory}`);
    throw error;
  }
  const preflightMarkdownText = `${preflightMarkdown(preview)}\n`;
  const preflightDigests = preflightArtifactDigests(preview, preflightMarkdownText);
  run = {
    ...run,
    ...preflightDigests,
  };
  await writeJsonAtomic(path.join(runDirectory, "run.json"), run);
  await writeJsonAtomic(path.join(runDirectory, "plan.json"), plan);
  await writeJsonAtomic(path.join(runDirectory, "catalog.json"), { source: catalog.source, digest: catalog.digest, models: catalog.models });
  await writeJsonAtomic(path.join(runDirectory, "preflight.json"), preview);
  await writeFile(path.join(runDirectory, "preflight.md"), preflightMarkdownText, "utf8");
  console.log(JSON.stringify({ prepared: true, billedModelCallsPerformed: 0, runId, runDirectory, preflight: path.join(runDirectory, "preflight.md"), executeAfterReview: preview.resumeCommand }, null, 2));
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
