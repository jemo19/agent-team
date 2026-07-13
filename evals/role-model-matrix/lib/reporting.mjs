import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { latestByFingerprint, readJournal } from "./journal.mjs";
import { CREDIT_PLANNING_SNAPSHOT } from "./options.mjs";
import { writeJsonAtomic } from "./common.mjs";

const REPORTING_VERSION = "1.3.1";
const DIAGNOSTIC_CATEGORIES = ["harness", "policy", "gate", "scoring_indeterminate", "noncritical_failed", "nonterminal"];

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))];
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function finite(value) {
  return Number.isFinite(value) ? value : null;
}

function totalTokens(usage) {
  if (Number.isFinite(usage?.total_tokens)) return usage.total_tokens;
  const input = Number.isFinite(usage?.input_tokens) ? usage.input_tokens : 0;
  const output = Number.isFinite(usage?.output_tokens) ? usage.output_tokens : 0;
  return input + output;
}

function normalizeUsage(usage = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(usage)) if (Number.isFinite(value)) normalized[key] = value;
  normalized.total_tokens = totalTokens(usage);
  return normalized;
}

function policyPass(record) {
  if (typeof record.policy?.pass === "boolean") return record.policy.pass;
  if (typeof record.policyPass === "boolean") return record.policyPass;
  if (typeof record.grader?.policyPass === "boolean") return record.grader.policyPass;
  return null;
}

function dimensionScores(grader) {
  if (grader?.dimensionScores && typeof grader.dimensionScores === "object" && !Array.isArray(grader.dimensionScores)) return grader.dimensionScores;
  if (grader?.dimensions && typeof grader.dimensions === "object" && !Array.isArray(grader.dimensions)) return grader.dimensions;
  const grouped = new Map();
  for (const assertion of grader?.assertions ?? []) {
    const dimension = assertion.dimension ?? assertion.category;
    if (typeof dimension !== "string" || !dimension) continue;
    if (!grouped.has(dimension)) grouped.set(dimension, { earned: 0, available: 0 });
    const current = grouped.get(dimension);
    const weight = Number.isFinite(assertion.weight) ? assertion.weight : 0;
    current.available += weight;
    if (assertion.pass) current.earned += weight;
  }
  return Object.fromEntries([...grouped].map(([name, value]) => [name, { ...value, percent: value.available ? (value.earned / value.available) * 100 : null }]));
}

function activityMetrics(record) {
  const completed = record.metrics?.itemCompleted ?? {};
  let commandCount = 0;
  let toolCount = 0;
  for (const [type, count] of Object.entries(completed)) {
    if (!Number.isFinite(count)) continue;
    if (/command|shell|exec/i.test(type)) commandCount += count;
    if (!/agent_message|reasoning|plan|todo/i.test(type)) toolCount += count;
  }
  const telemetry = record.metrics?.delegationTelemetry;
  const delegationState = telemetry?.state
    ?? (record.metrics?.subagentMetricsAvailable === false
      ? "identity_unavailable"
      : Number.isFinite(record.metrics?.subagentCount) && record.metrics.subagentCount > 0
        ? "observed"
        : "none_observed");
  return {
    itemCompleted: completed,
    toolCount,
    commandCount,
    collaborationCallCount: finite(record.metrics?.collaborationCallCount) ?? 0,
    subagentCount: finite(record.metrics?.subagentCount),
    subagentMetricsAvailable: record.metrics?.subagentMetricsAvailable !== false,
    delegationState,
    childOutcomeTelemetryAvailable: telemetry?.childOutcomeTelemetryAvailable === true,
    childUsageTelemetryAvailable: telemetry?.childUsageTelemetryAvailable === true,
    recoveredTransportWarningCount: Array.isArray(record.metrics?.recoveredTransportWarnings) ? record.metrics.recoveredTransportWarnings.length : 0,
    fatalRootErrorCount: Array.isArray(record.metrics?.fatalRootErrors) ? record.metrics.fatalRootErrors.length : 0,
  };
}

function failureCategory(record) {
  if (!record.terminal) return "nonterminal";
  if (record.harnessPass !== true) return "harness";
  if (record.policyPass === false) return "policy";
  if (record.gatePass !== true) return "gate";
  if (record.scoringComplete !== true) return "scoring_indeterminate";
  if (record.qualityPass !== true) return "noncritical_failed";
  return null;
}

function humanStatus(annotation, fallback) {
  const source = annotation ?? fallback ?? {};
  return {
    status: source.status ?? "not_reviewed",
    reviewer: source.reviewer ?? null,
    reviewedAt: source.reviewedAt ?? null,
    notes: source.notes ?? null,
    verdict: source.verdict ?? null,
  };
}

function enrichRecord(record, run, annotations) {
  const descriptor = (run.roleDescriptors ?? []).find((role) => role.roleId === record.roleId) ?? {};
  const usage = normalizeUsage(record.usage);
  const policy = policyPass(record);
  const activity = activityMetrics(record);
  const score = finite(record.grader?.score);
  const scoreLowerBound = finite(record.grader?.scoreLowerBound) ?? score;
  const scoreUpperBound = finite(record.grader?.scoreUpperBound) ?? score;
  const scoringComplete = record.grader?.scoringComplete ?? score !== null;
  const qualityPass = record.qualityPass ?? record.qualityComplete ?? (record.grader?.pass === true && policy !== false);
  const noncriticalFailures = record.noncriticalFailures ?? (record.grader?.assertions ?? [])
    .filter((assertion) => !assertion.critical && assertion.pass === false)
    .map((assertion) => assertion.id);
  const taskOutcomeScore = finite(record.grader?.taskOutcomeScore) ?? score;
  const humanReview = humanStatus(annotations?.cases?.[record.fingerprint] ?? annotations?.cases?.[record.caseId], annotations ?? run.humanReview);
  const enriched = {
    ...record,
    taskId: record.taskId ?? descriptor.taskId ?? `${record.roleId}-task-v1`,
    fixtureId: record.fixtureId ?? descriptor.fixtureId ?? `${record.roleId}-fixture-v1`,
    fixtureVersion: record.fixtureVersion ?? descriptor.fixtureVersion ?? null,
    difficulty: record.fixtureDifficulty ?? record.difficulty ?? descriptor.difficulty ?? null,
    taskSummary: record.taskSummary ?? descriptor.taskSummary ?? null,
    taskFile: record.taskFile ?? descriptor.taskFile ?? null,
    fixturePath: record.fixturePath ?? descriptor.fixturePath ?? null,
    policyPass: policy,
    qualityScore: score,
    scoreLowerBound,
    scoreUpperBound,
    scoringComplete,
    qualityPass,
    noncriticalFailures,
    taskOutcomeScore,
    dimensionScores: dimensionScores(record.grader),
    usage,
    totalTokens: usage.total_tokens,
    activity,
    failureCategory: null,
    validForQualityAggregate: record.terminal === true && record.harnessPass === true && record.gatePass === true && policy !== false && score !== null,
    validForTaskOutcomeAggregate: record.terminal === true && record.harnessPass === true && record.gatePass === true && policy !== false && taskOutcomeScore !== null,
    creditPlanning: {
      min: CREDIT_PLANNING_SNAPSHOT.creditsPerMessage.min,
      max: CREDIT_PLANNING_SNAPSHOT.creditsPerMessage.max,
      caveat: "per candidate message; excludes retries and Ultra child-agent messages",
    },
    humanReview,
  };
  enriched.failureCategory = failureCategory(enriched);
  return enriched;
}

function medianDimensionScores(records) {
  const names = new Set(records.flatMap((record) => Object.keys(record.dimensionScores ?? {})));
  const output = {};
  for (const name of [...names].sort()) {
    const values = records.map((record) => {
      const value = record.dimensionScores?.[name];
      if (Number.isFinite(value)) return value;
      if (Number.isFinite(value?.percent)) return value.percent;
      if (Number.isFinite(value?.score)) return value.score;
      return null;
    }).filter(Number.isFinite);
    if (values.length) {
      const earned = records.map((record) => record.dimensionScores?.[name]?.earned).filter(Number.isFinite);
      const available = records.map((record) => record.dimensionScores?.[name]?.available).filter(Number.isFinite);
      output[name] = {
        percent: median(values),
        earned: earned.length ? median(earned) : null,
        available: available.length ? median(available) : null,
      };
    }
  }
  return output;
}

function usageMedians(records) {
  const keys = new Set(records.flatMap((record) => Object.keys(record.usage ?? {})));
  return Object.fromEntries([...keys].sort().map((key) => [key, median(records.map((record) => record.usage?.[key]).filter(Number.isFinite))]));
}

function groupRecords(records, attemptRecords) {
  const groups = new Map();
  for (const record of records) {
    const key = `${record.roleId}\0${record.model}\0${record.effort}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.values()].map((items) => {
    const completed = items.filter((item) => item.terminal);
    const aggregateEligible = completed.filter((item) => item.validForQualityAggregate);
    const taskOutcomeEligible = completed.filter((item) => item.validForTaskOutcomeAggregate);
    const gateEligible = completed.filter((item) => item.harnessPass === true && item.gatePass === true && item.policyPass !== false);
    const diagnosticEligible = completed.filter((item) => item.harnessPass === true && item.policyPass !== false);
    const harnessPassed = completed.filter((item) => item.harnessPass === true);
    const gatePassed = completed.filter((item) => item.gatePass === true && item.harnessPass === true);
    const knownPolicy = completed.filter((item) => typeof item.policyPass === "boolean");
    const qualityPassed = gateEligible.filter((item) => item.qualityPass === true);
    const scoringComplete = gateEligible.filter((item) => item.scoringComplete === true);
    const attempts = attemptRecords.filter((attempt) => attempt.roleId === items[0].roleId && attempt.model === items[0].model && attempt.effort === items[0].effort).length;
    const result = {
      roleId: items[0].roleId,
      displayName: items[0].displayName,
      taskIds: [...new Set(items.map((item) => item.taskId))].sort(),
      fixtureIds: [...new Set(items.map((item) => item.fixtureId))].sort(),
      model: items[0].model,
      effort: items[0].effort,
      isBaseline: items.some((item) => item.isBaseline),
      delegationConstrained: items.some((item) => item.delegationConstrained),
      scheduledCases: items.length,
      attempts,
      terminal: completed.length,
      harnessPassed: harnessPassed.length,
      harnessPassRate: completed.length ? harnessPassed.length / completed.length : null,
      gatePassed: gatePassed.length,
      gatePassRate: completed.length ? gatePassed.length / completed.length : null,
      policyKnownRuns: knownPolicy.length,
      policyPassed: knownPolicy.filter((item) => item.policyPass).length,
      policyPassRate: knownPolicy.length ? knownPolicy.filter((item) => item.policyPass).length / knownPolicy.length : null,
      qualityPassRuns: qualityPassed.length,
      qualityPassRate: gateEligible.length ? qualityPassed.length / gateEligible.length : null,
      scoringCompleteRuns: scoringComplete.length,
      scoringCompleteRate: gateEligible.length ? scoringComplete.length / gateEligible.length : null,
      aggregateEligibleRuns: aggregateEligible.length,
      taskOutcomeEligibleRuns: taskOutcomeEligible.length,
      medianScore: median(aggregateEligible.map((item) => item.qualityScore).filter(Number.isFinite)),
      medianDiagnosticScore: median(diagnosticEligible.map((item) => item.qualityScore).filter(Number.isFinite)),
      medianDiagnosticScoreLowerBound: median(diagnosticEligible.map((item) => item.scoreLowerBound).filter(Number.isFinite)),
      medianDiagnosticScoreUpperBound: median(diagnosticEligible.map((item) => item.scoreUpperBound).filter(Number.isFinite)),
      medianScoreLowerBound: median(gateEligible.map((item) => item.scoreLowerBound).filter(Number.isFinite)),
      medianScoreUpperBound: median(gateEligible.map((item) => item.scoreUpperBound).filter(Number.isFinite)),
      medianTaskOutcomeScore: median(taskOutcomeEligible.map((item) => item.taskOutcomeScore).filter(Number.isFinite)),
      p95Score: percentile(aggregateEligible.map((item) => item.qualityScore).filter(Number.isFinite), 0.95),
      medianDimensionScores: medianDimensionScores(aggregateEligible),
      medianDurationMs: median(gateEligible.map((item) => item.durationMs).filter(Number.isFinite)),
      p95DurationMs: percentile(gateEligible.map((item) => item.durationMs).filter(Number.isFinite), 0.95),
      usageMedians: usageMedians(gateEligible),
      medianTotalTokens: median(gateEligible.map((item) => item.totalTokens).filter(Number.isFinite)),
      p95TotalTokens: percentile(gateEligible.map((item) => item.totalTokens).filter(Number.isFinite), 0.95),
      medianToolCount: median(gateEligible.map((item) => item.activity.toolCount).filter(Number.isFinite)),
      medianCommandCount: median(gateEligible.map((item) => item.activity.commandCount).filter(Number.isFinite)),
      medianCollaborationCallCount: median(gateEligible.map((item) => item.activity.collaborationCallCount).filter(Number.isFinite)),
      medianSubagentCount: median(gateEligible.map((item) => item.activity.subagentCount).filter(Number.isFinite)),
      delegationTelemetryStates: Object.fromEntries([...new Set(gateEligible.map((item) => item.activity.delegationState))].sort().map((state) => [state, gateEligible.filter((item) => item.activity.delegationState === state).length])),
      childOutcomeTelemetryRuns: gateEligible.filter((item) => item.activity.childOutcomeTelemetryAvailable).length,
      childUsageTelemetryRuns: gateEligible.filter((item) => item.activity.childUsageTelemetryAvailable).length,
      recoveredTransportWarningRuns: completed.filter((item) => item.activity.recoveredTransportWarningCount > 0).length,
      recoveredTransportWarningCount: completed.reduce((total, item) => total + item.activity.recoveredTransportWarningCount, 0),
      criticalFailures: completed.reduce((total, item) => total + (item.grader?.criticalFailures?.length ?? 0), 0),
      failures: Object.fromEntries(DIAGNOSTIC_CATEGORIES.map((category) => [category, items.filter((item) => item.failureCategory === category).length])),
      humanReviewStatuses: Object.fromEntries([...new Set(items.map((item) => item.humanReview.status))].sort().map((status) => [status, items.filter((item) => item.humanReview.status === status).length])),
      baselineDelta: null,
    };
    return result;
  }).sort((a, b) => a.roleId.localeCompare(b.roleId) || a.model.localeCompare(b.model) || a.effort.localeCompare(b.effort));
}

function subtract(left, right) {
  return Number.isFinite(left) && Number.isFinite(right) ? left - right : null;
}

function addBaselineDeltas(groups, run) {
  const baselines = run.baselines ?? Object.fromEntries(groups.filter((group) => group.isBaseline).map((group) => [group.roleId, { model: group.model, effort: group.effort }]));
  const byRole = new Map();
  for (const group of groups) {
    const current = baselines[group.roleId];
    const baseline = groups.find((candidate) => candidate.roleId === group.roleId && candidate.model === current?.model && candidate.effort === current?.effort);
    const enriched = {
      ...group,
      currentBaseline: current ?? null,
      baselineAvailable: Boolean(baseline),
      baselineDelta: baseline ? {
        medianScore: subtract(group.medianScore, baseline.medianScore),
        medianTotalTokens: subtract(group.medianTotalTokens, baseline.medianTotalTokens),
        medianDurationMs: subtract(group.medianDurationMs, baseline.medianDurationMs),
        gatePassRate: subtract(group.gatePassRate, baseline.gatePassRate),
        qualityPassRate: subtract(group.qualityPassRate, baseline.qualityPassRate),
      } : null,
    };
    if (!byRole.has(group.roleId)) byRole.set(group.roleId, []);
    byRole.get(group.roleId).push(enriched);
  }
  const roleOrder = new Map((run.roleDescriptors ?? []).map((role, index) => [role.roleId, index]));
  const configurationOrder = new Map((run.matrix ?? []).map((pair, index) => [`${pair.model}\0${pair.effort}`, index]));
  return [...byRole.values()].flat().sort((a, b) => {
    const roleDelta = (roleOrder.get(a.roleId) ?? Number.MAX_SAFE_INTEGER) - (roleOrder.get(b.roleId) ?? Number.MAX_SAFE_INTEGER);
    if (roleDelta) return roleDelta;
    const configurationDelta = (configurationOrder.get(`${a.model}\0${a.effort}`) ?? Number.MAX_SAFE_INTEGER) - (configurationOrder.get(`${b.model}\0${b.effort}`) ?? Number.MAX_SAFE_INTEGER);
    return configurationDelta || a.model.localeCompare(b.model) || a.effort.localeCompare(b.effort);
  });
}

function paretoFrontier(groups) {
  const eligible = groups.filter((group) => Number.isFinite(group.gatePassRate) && Number.isFinite(group.medianScore) && Number.isFinite(group.medianTotalTokens) && Number.isFinite(group.medianDurationMs));
  return eligible.filter((candidate) => !eligible.some((other) => other !== candidate
    && other.gatePassRate >= candidate.gatePassRate
    && other.medianScore >= candidate.medianScore
    && other.medianTotalTokens <= candidate.medianTotalTokens
    && other.medianDurationMs <= candidate.medianDurationMs
    && (other.gatePassRate > candidate.gatePassRate || other.medianScore > candidate.medianScore || other.medianTotalTokens < candidate.medianTotalTokens || other.medianDurationMs < candidate.medianDurationMs)))
    .map((group) => ({ model: group.model, effort: group.effort, gatePassRate: group.gatePassRate, medianScore: group.medianScore, medianTotalTokens: group.medianTotalTokens, medianDurationMs: group.medianDurationMs }));
}

function reviewedCase(annotation) {
  return new Set(["accept", "accept_with_notes", "reject", "invalid", "cannot_determine", "complete", "approved"]).has(annotation?.status ?? annotation?.disposition);
}

function caseAnnotation(annotations, caseId) {
  return annotations?.cases?.[caseId]
    ?? Object.values(annotations?.cases ?? {}).find((annotation) => annotation?.caseId === caseId);
}

function configurationKey(candidate) {
  return `${candidate?.model ?? ""}\0${candidate?.effort ?? ""}`;
}

export function recommendationAnalysis(groups, run, annotations) {
  const output = [];
  for (const roleId of [...new Set(groups.map((group) => group.roleId))].sort()) {
    const roleGroups = groups.filter((group) => group.roleId === roleId);
    const reasons = [];
    const roleReview = annotations?.roles?.[roleId];
    const finalists = Array.isArray(roleReview?.finalists) ? roleReview.finalists : [];
    const finalistKeys = new Set(finalists.map(configurationKey));
    const finalistGroups = roleGroups.filter((group) => finalistKeys.has(configurationKey(group)));
    if (run.phase !== "screen") reasons.push("full screen phase has not completed");
    if (roleGroups.length < (run.matrix?.length ?? 17)) reasons.push("not all frozen model/effort configurations are represented");
    if (new Set(roleGroups.flatMap((group) => group.fixtureIds)).size < 3) reasons.push("fewer than three distinct fixtures are represented");
    const review = annotations?.status ?? run.humanReview?.status ?? "not_reviewed";
    if (!new Set(["complete", "approved"]).has(review)) reasons.push("human review is not complete");
    if (!new Set(["complete", "approved"]).has(roleReview?.status)) reasons.push("per-role review worksheet is not complete");
    if (!finalists.length) reasons.push("finalist configurations are not declared");
    if (finalistGroups.length !== finalists.length) reasons.push("one or more declared finalists are absent from results");
    if (finalistGroups.some((group) => group.aggregateEligibleRuns < 3)) reasons.push("fewer than three gate-passing runs exist for at least one declared finalist");
    if (finalistGroups.some((group) => new Set(group.fixtureIds).size < 3)) reasons.push("fewer than three distinct fixtures are represented for at least one declared finalist");
    const baseline = run.baselines?.[roleId];
    if (baseline && !finalistKeys.has(configurationKey(baseline))) reasons.push("current control is not included in the declared finalists");
    const requiredCaseIds = Array.isArray(roleReview?.requiredCaseIds) ? roleReview.requiredCaseIds : [];
    if (!requiredCaseIds.length) reasons.push("required human-review case IDs are not declared");
    if (requiredCaseIds.some((caseId) => !reviewedCase(caseAnnotation(annotations, caseId)))) reasons.push("one or more required cases lack a human disposition");
    const entry = { roleId, evidenceSufficient: reasons.length === 0, reasons };
    if (!reasons.length) {
      const frontier = paretoFrontier(finalistGroups);
      const ranked = [...finalistGroups].filter((group) => Number.isFinite(group.gatePassRate) && Number.isFinite(group.medianScore))
        .sort((a, b) => b.gatePassRate - a.gatePassRate || b.medianScore - a.medianScore || a.medianTotalTokens - b.medianTotalTokens || a.medianDurationMs - b.medianDurationMs);
      entry.provisionalPareto = frontier;
      entry.provisionalRecommendation = ranked.length ? { model: ranked[0].model, effort: ranked[0].effort, rationale: "highest gate-pass rate, then median quality, with token and latency tie-breakers", requiresOperatorRoutingApproval: true } : null;
    }
    output.push(entry);
  }
  return output;
}

function usageTotals(records) {
  const keys = new Set(records.flatMap((record) => Object.keys(record.usage ?? {})));
  return Object.fromEntries([...keys].sort().map((key) => [key, records.reduce((total, record) => total + (Number.isFinite(record.usage?.[key]) ? record.usage[key] : 0), 0)]));
}

async function readAnnotations(runDirectory, run) {
  try {
    return JSON.parse(await readFile(path.join(runDirectory, "human-review.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error(`invalid human-review.json: ${error.message}`);
    return run.humanReview ?? { status: "not_reviewed", reviewer: null, reviewedAt: null, notes: null, cases: {} };
  }
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(0)}%` : "";
}

function formatDelta(value, suffix = "") {
  if (!Number.isFinite(value)) return "";
  return `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(2)}${suffix}`;
}

export async function generateReports(runDirectory) {
  const journalFile = path.join(runDirectory, "journal.jsonl");
  const run = JSON.parse(await readFile(path.join(runDirectory, "run.json"), "utf8"));
  const rawRecords = await readJournal(journalFile);
  const annotations = await readAnnotations(runDirectory, run);
  const latestRaw = [...latestByFingerprint(rawRecords).values()];
  const latest = latestRaw.map((record) => enrichRecord(record, run, annotations));
  const groups = addBaselineDeltas(groupRecords(latest, rawRecords), run);
  const failures = latest.filter((record) => record.failureCategory !== null);
  const recommendations = recommendationAnalysis(groups, run, annotations);
  const aggregate = {
    reportingVersion: REPORTING_VERSION,
    generatedAt: new Date().toISOString(),
    run,
    humanReview: humanStatus(annotations, run.humanReview),
    attemptCount: rawRecords.length,
    latestCases: latest.length,
    statusCounts: Object.fromEntries([...new Set(latest.map((item) => item.status))].sort().map((status) => [status, latest.filter((item) => item.status === status).length])),
    failureCounts: Object.fromEntries(DIAGNOSTIC_CATEGORIES.map((category) => [category, failures.filter((record) => record.failureCategory === category).length])),
    usageTotals: usageTotals(latest.filter((record) => record.terminal)),
    transportWarnings: {
      cases: latest.filter((record) => record.activity.recoveredTransportWarningCount > 0).length,
      count: latest.reduce((total, record) => total + record.activity.recoveredTransportWarningCount, 0),
    },
    creditPlanning: run.creditPlanning ?? {
      ...CREDIT_PLANNING_SNAPSHOT,
      candidateMessages: run.plannedCases,
      estimatedCredits: { min: run.plannedCases * 5, max: run.plannedCases * 40 },
    },
    aggregatePolicy: "Combined quality medians require complete scoring. Quality pass means every assertion passed; noncritical failures remain scored diagnostics. Task-outcome and operational medians use terminal harness-valid, gate-passing, policy-nonfailing cases. Gate-failed scores are excluded diagnostics. Indeterminate assertions remain intervals and never enter combined-score rankings.",
    groups,
    recommendationAnalysis: recommendations,
    failures,
    attemptRecords: rawRecords,
    cases: latest,
  };
  await mkdir(runDirectory, { recursive: true });
  await writeJsonAtomic(path.join(runDirectory, "results.json"), aggregate);

  const usageKeys = [...new Set(latest.flatMap((item) => Object.keys(item.usage ?? {})))].sort();
  const caseHeaders = ["case_id", "role_id", "task_id", "fixture_id", "fixture_version", "difficulty", "task_summary", "model", "effort", "repetition", "attempt", "phase", "is_baseline", "delegation_constrained", "status", "failure_category", "harness_pass", "policy_pass", "gate_pass", "quality_pass", "scoring_complete", "quality_score", "score_lower_bound", "score_upper_bound", "task_outcome_score", "dimension_scores", "critical_failures", "critical_indeterminate", "noncritical_failures", "duration_ms", ...usageKeys.map((key) => `usage_${key}`), "tool_count", "command_count", "collaboration_call_count", "observable_subagent_count", "delegation_telemetry_state", "child_outcome_telemetry_available", "child_usage_telemetry_available", "recovered_transport_warning_count", "fatal_root_error_count", "tool_item_types", "changed_paths", "harness_errors", "human_review_status", "human_review_verdict", "artifact_directory"];
  const caseRows = latest.map((item) => [
    item.caseId, item.roleId, item.taskId, item.fixtureId, item.fixtureVersion, item.difficulty, item.taskSummary, item.model, item.effort, item.repetition, item.attempt, item.phase, item.isBaseline, item.delegationConstrained, item.status, item.failureCategory,
    item.harnessPass, item.policyPass, item.gatePass, item.qualityPass, item.scoringComplete, item.qualityScore, item.scoreLowerBound, item.scoreUpperBound, item.taskOutcomeScore, item.dimensionScores, item.grader?.criticalFailures, item.grader?.criticalIndeterminate, item.noncriticalFailures,
    item.durationMs, ...usageKeys.map((key) => item.usage?.[key]), item.activity.toolCount, item.activity.commandCount, item.activity.collaborationCallCount, item.activity.subagentCount, item.activity.delegationState, item.activity.childOutcomeTelemetryAvailable, item.activity.childUsageTelemetryAvailable, item.activity.recoveredTransportWarningCount, item.activity.fatalRootErrorCount, item.activity.itemCompleted,
    item.workspace?.changedPaths, item.harnessErrors, item.humanReview.status, item.humanReview.verdict, item.artifactDirectory,
  ]);
  await writeFile(path.join(runDirectory, "results.csv"), `${[caseHeaders, ...caseRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");

  const summaryHeaders = ["role_id", "task_ids", "fixture_ids", "model", "effort", "is_baseline", "delegation_constrained", "terminal", "attempts", "aggregate_eligible_runs", "task_outcome_eligible_runs", "harness_pass_rate", "policy_pass_rate", "gate_pass_rate", "quality_pass_rate", "scoring_complete_rate", "median_score", "median_diagnostic_score", "median_score_lower_bound", "median_score_upper_bound", "median_task_outcome_score", "median_dimension_scores", "median_total_tokens", "p95_total_tokens", "median_duration_ms", "p95_duration_ms", "median_tool_count", "median_command_count", "median_collaboration_call_count", "median_observable_subagent_count", "delegation_telemetry_states", "child_outcome_telemetry_runs", "child_usage_telemetry_runs", "recovered_transport_warning_runs", "recovered_transport_warning_count", "baseline_score_delta", "baseline_token_delta", "baseline_latency_delta", "failure_counts", "human_review_statuses"];
  const summaryRows = groups.map((group) => [
    group.roleId, group.taskIds, group.fixtureIds, group.model, group.effort, group.isBaseline, group.delegationConstrained, group.terminal, group.attempts, group.aggregateEligibleRuns, group.taskOutcomeEligibleRuns,
    group.harnessPassRate, group.policyPassRate, group.gatePassRate, group.qualityPassRate, group.scoringCompleteRate, group.medianScore, group.medianDiagnosticScore, group.medianScoreLowerBound, group.medianScoreUpperBound, group.medianTaskOutcomeScore, group.medianDimensionScores,
    group.medianTotalTokens, group.p95TotalTokens, group.medianDurationMs, group.p95DurationMs, group.medianToolCount, group.medianCommandCount, group.medianCollaborationCallCount, group.medianSubagentCount, group.delegationTelemetryStates, group.childOutcomeTelemetryRuns, group.childUsageTelemetryRuns, group.recoveredTransportWarningRuns, group.recoveredTransportWarningCount,
    group.baselineDelta?.medianScore, group.baselineDelta?.medianTotalTokens, group.baselineDelta?.medianDurationMs, group.failures, group.humanReviewStatuses,
  ]);
  await writeFile(path.join(runDirectory, "summary.csv"), `${[summaryHeaders, ...summaryRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");

  const lines = [
    `# AI Team Role Evaluation: ${run.runId}`,
    "",
    `- Phase: \`${run.phase}\``,
    `- Run status: \`${run.status ?? "unknown"}\``,
    `- Suite version: \`${run.suiteVersion}\``,
    `- Harness digest: \`${run.harnessCodeDigest ?? "not recorded"}\``,
    `- Codex: \`${run.cliVersion}\``,
    `- Service tier: \`${run.serviceTier ?? run.executionOptions?.serviceTier ?? "default"}\``,
    `- Seed: \`${run.seed ?? "not recorded"}\``,
    `- Concurrency: ${run.executionOptions?.concurrency ?? "not recorded"} (ceiling ${run.executionOptions?.concurrencyCeiling ?? "not recorded"})`,
    `- Timeouts: candidate=${run.executionOptions?.timeoutMs ?? "not recorded"} ms; grader=${run.executionOptions?.commandTimeoutMs ?? "not recorded"} ms`,
    `- Stop ceilings: candidates=${run.executionOptions?.candidateCeiling ?? "not recorded"}; timeouts=${run.executionOptions?.maxTimeouts ?? "not recorded"}; harness failures=${run.executionOptions?.maxHarnessFailures ?? "not recorded"}; total tokens=${run.executionOptions?.maxTotalTokens ?? "not set"}; estimated credits=${run.executionOptions?.maxEstimatedCredits ?? "not recorded"}`,
    `- Isolation preflight: ${run.isolationPreflight?.pass === true ? "pass" : run.isolationPreflight?.pass === false ? "fail" : "not recorded"}`,
    `- Planned cases: ${run.plannedCases}`,
    `- Latest cases: ${latest.length}; attempts: ${rawRecords.length}`,
    `- Human review: \`${aggregate.humanReview.status}\` (reviewer: ${aggregate.humanReview.reviewer ?? "not assigned"})`,
    `- Statuses: ${Object.entries(aggregate.statusCounts).map(([key, value]) => `${key}=${value}`).join(", ") || "none"}`,
    `- Failure classes: ${Object.entries(aggregate.failureCounts).map(([key, value]) => `${key}=${value}`).join(", ")}`,
    `- Recovered transport warnings: ${aggregate.transportWarnings.count} across ${aggregate.transportWarnings.cases} case(s)`,
    "",
    "> Combined-score medians require complete scoring. Quality pass means every assertion passed; a noncritical failure is reported separately from scoring indeterminacy. Gate-failed scores are excluded diagnostics. Indeterminate assertions appear as intervals and never enter ranking.",
    "",
    "## Role And Candidate Results",
    "",
    "| Role / task / fixture | Model | Effort | Current | Delegation constrained | Scored / terminal | Harness | Policy | Gate | Quality pass | Scoring complete | Combined score | Excluded diagnostic | Interval | Task outcome | Dimensions | Score delta | Median tokens | Token delta | Median ms | Latency delta | Tools / commands / calls / observable children / transport warnings | Delegation telemetry |",
    "|---|---|---:|:---:|:---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|---:|---:|---:|---:|---:|---|---|",
  ];
  for (const group of groups) {
    const activity = [group.medianToolCount, group.medianCommandCount, group.medianCollaborationCallCount, group.medianSubagentCount ?? "n/a", group.recoveredTransportWarningCount].join(" / ");
    const intervalLower = group.aggregateEligibleRuns ? group.medianScoreLowerBound : group.medianDiagnosticScoreLowerBound;
    const intervalUpper = group.aggregateEligibleRuns ? group.medianScoreUpperBound : group.medianDiagnosticScoreUpperBound;
    const interval = Number.isFinite(intervalLower) && Number.isFinite(intervalUpper)
      ? `${intervalLower}-${intervalUpper}`
      : "";
    const diagnostic = group.aggregateEligibleRuns < group.terminal ? group.medianDiagnosticScore ?? "" : "";
    const delegation = Object.entries(group.delegationTelemetryStates).map(([state, count]) => `${state}:${count}`).join(", ") || "none";
    lines.push(`| ${group.displayName}<br>\`${group.taskIds.join(", ")}\`<br>\`${group.fixtureIds.join(", ")}\` | \`${group.model}\` | \`${group.effort}\` | ${group.isBaseline ? "yes" : ""} | ${group.delegationConstrained ? "yes" : ""} | ${group.aggregateEligibleRuns}/${group.terminal} | ${formatPercent(group.harnessPassRate)} | ${formatPercent(group.policyPassRate)} | ${formatPercent(group.gatePassRate)} | ${formatPercent(group.qualityPassRate)} | ${formatPercent(group.scoringCompleteRate)} | ${group.medianScore ?? "n/a"} | ${diagnostic} | ${interval} | ${group.medianTaskOutcomeScore ?? ""} | ${Object.keys(group.medianDimensionScores).length ? JSON.stringify(group.medianDimensionScores) : ""} | ${formatDelta(group.baselineDelta?.medianScore)} | ${group.medianTotalTokens ?? ""} | ${formatDelta(group.baselineDelta?.medianTotalTokens)} | ${group.medianDurationMs ?? ""} | ${formatDelta(group.baselineDelta?.medianDurationMs)} | ${activity} | ${delegation} |`);
  }

  lines.push("", "## Recommendation Readiness", "");
  const ready = recommendations.filter((entry) => entry.evidenceSufficient);
  if (!ready.length) lines.push("No provisional routing recommendation is emitted: the evidence gate is not yet satisfied.", "");
  for (const entry of recommendations) {
    if (entry.evidenceSufficient) lines.push(`- \`${entry.roleId}\`: provisional \`${entry.provisionalRecommendation?.model}/${entry.provisionalRecommendation?.effort}\`; operator routing approval still required.`);
    else lines.push(`- \`${entry.roleId}\`: insufficient evidence: ${entry.reasons.join("; ")}.`);
  }

  lines.push("", "## Failures And Diagnostics", "");
  if (!failures.length) lines.push("No harness, policy, gate, scoring-indeterminate, noncritical-failure, or nonterminal cases.");
  else for (const failure of failures) {
    const indeterminate = (failure.grader?.assertions ?? []).filter((assertion) => assertion.status === "indeterminate").map((assertion) => assertion.id);
    const interval = Number.isFinite(failure.scoreLowerBound) && Number.isFinite(failure.scoreUpperBound) ? `score interval ${failure.scoreLowerBound}-${failure.scoreUpperBound}` : null;
    const diagnosticScore = Number.isFinite(failure.qualityScore) ? `excluded diagnostic score ${failure.qualityScore}` : null;
    const details = (failure.harnessErrors ?? []).join("; ")
      || (failure.policy?.violations ?? []).map((violation) => violation.code ?? violation.message ?? JSON.stringify(violation)).join("; ")
      || (failure.grader?.criticalFailures ?? []).join(", ")
      || (indeterminate.length ? `indeterminate assertions: ${indeterminate.join(", ")}; ${interval}` : null)
      || (failure.noncriticalFailures?.length ? `noncritical assertions: ${failure.noncriticalFailures.join(", ")}` : null)
      || "diagnostic state unavailable";
    lines.push(`- \`${failure.caseId}\` (\`${failure.roleId}/${failure.model}/${failure.effort}\`): ${failure.failureCategory}; ${details}${diagnosticScore ? `; ${diagnosticScore}` : ""}`);
  }

  lines.push(
    "",
    "## Usage And Planning Caveat",
    "",
    `- Captured token totals: ${Object.entries(aggregate.usageTotals).map(([key, value]) => `${key}=${value}`).join(", ") || "none"}`,
    `- Credit planning range: ${aggregate.creditPlanning.estimatedCredits?.min ?? "unknown"}-${aggregate.creditPlanning.estimatedCredits?.max ?? "unknown"} credits for candidate messages.`,
    `- Source/date: ${aggregate.creditPlanning.source ?? CREDIT_PLANNING_SNAPSHOT.source} (${aggregate.creditPlanning.accessedAt ?? CREDIT_PLANNING_SNAPSHOT.accessedAt}).`,
    `- Caveat: ${aggregate.creditPlanning.caveat ?? CREDIT_PLANNING_SNAPSHOT.caveat}`,
    "- Credits are not inferred from tokens here because no authoritative per-token credit conversion is pinned. Ultra child usage and child identity/count may be unavailable in the parent trace. Collaboration-call counts are descriptive only and never prove successful delegation.",
    "",
    "## Human Review Placeholder",
    "",
    "Human review is required before capability claims or routing changes. Complete the generated case dispositions and per-role finalist worksheet in a local `human-review.json`, then regenerate this report.",
    "",
  );
  await writeFile(path.join(runDirectory, "report.md"), lines.join("\n"), "utf8");

  const reviewTemplate = path.join(runDirectory, "human-review-template.json");
  try {
    await access(reviewTemplate);
  } catch {
    await writeJsonAtomic(reviewTemplate, {
      status: "not_reviewed",
      reviewer: null,
      reviewedAt: null,
      notes: null,
      cases: Object.fromEntries(latest.map((record) => [record.fingerprint, { caseId: record.caseId, status: "not_reviewed", verdict: null, notes: null }])),
      roles: Object.fromEntries((run.roleDescriptors ?? []).map((role) => [role.roleId, {
        status: "not_reviewed",
        requiredCaseIds: [],
        finalists: [],
        recommendedDefault: null,
        escalationOnly: null,
        confidence: null,
        notes: null,
      }])),
    });
  }
  return aggregate;
}
