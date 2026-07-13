import { readFile, stat } from "node:fs/promises";
import { changedPaths } from "./manifest.mjs";
import { graderIsolation } from "./isolation.mjs";
import { runProcess, safeToolCwd } from "./process.mjs";

const OUTPUT_FIELDS = new Set(["outcome", "summary", "findings", "actions", "checks", "message"]);

function normalizeConceptText(value, normalizers = []) {
  let text = value;
  for (const normalizer of normalizers) {
    if (normalizer === "unicode-punctuation") {
      text = text
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
        .replace(/[\u00A0\u202F]/g, " ");
    } else if (normalizer === "hyphen-as-space") {
      text = text.replace(/[-\u2010-\u2015\u2212]+/g, " ");
    }
  }
  return text;
}

function globRegex(pattern) {
  let output = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*") { output += ".*"; index += 1; }
    else if (char === "*") output += "[^/]*";
    else if (char === "?") output += "[^/]";
    else output += char.replace(/[\\^$+?.()|{}[\]]/g, "\\$&");
  }
  return new RegExp(`${output}$`);
}

function matchesAllowed(file, patterns) {
  return patterns.some((pattern) => globRegex(pattern.replaceAll("\\", "/")).test(file));
}

async function gradeAssertion(assertion, context) {
  const base = {
    id: assertion.id,
    description: assertion.description,
    dimension: assertion.dimension ?? "unspecified",
    kind: assertion.kind,
    weight: assertion.weight,
    critical: assertion.critical,
  };
  try {
    if (assertion.kind === "output_regex") {
      const pass = new RegExp(assertion.pattern, assertion.flags ?? "").test(context.outputText);
      return { ...base, pass, evidence: pass ? "pattern matched" : `pattern did not match: ${assertion.pattern}` };
    }
    if (assertion.kind === "output_absent_regex") {
      const pass = !new RegExp(assertion.pattern, assertion.flags ?? "").test(context.outputText);
      return { ...base, pass, evidence: pass ? "forbidden pattern absent" : `forbidden pattern matched: ${assertion.pattern}` };
    }
    if (assertion.kind === "output_all") {
      const fields = assertion.fields ?? [assertion.field];
      if (!Array.isArray(fields) || fields.length === 0 || fields.some((field) => !OUTPUT_FIELDS.has(field))) {
        throw new Error(`unsupported structured-output fields: ${JSON.stringify(fields)}`);
      }
      if (!context.structuredOutput || typeof context.structuredOutput !== "object") {
        return { ...base, pass: false, evidence: "structured output is unavailable" };
      }
      const fieldTexts = new Map();
      for (const field of fields) {
        const value = context.structuredOutput[field];
        if (typeof value !== "string" && (!Array.isArray(value) || value.some((entry) => typeof entry !== "string"))) {
          return { ...base, pass: false, evidence: `${field} is not text or an array of text` };
        }
        const text = Array.isArray(value) ? value.join("\n") : value;
        fieldTexts.set(field, normalizeConceptText(text, assertion.normalizers));
      }
      const flags = assertion.flags ?? "";
      const matchField = (pattern) => fields.find((field) => new RegExp(pattern, flags).test(fieldTexts.get(field)));
      const patternMatches = assertion.patterns.map((pattern) => ({ pattern, field: matchField(pattern) ?? null }));
      const forbiddenMatches = (assertion.absentPatterns ?? []).map((pattern) => ({ pattern, field: matchField(pattern) ?? null }));
      const missing = patternMatches.filter((match) => match.field === null).map((match) => match.pattern);
      const forbidden = forbiddenMatches.filter((match) => match.field !== null);
      const pass = missing.length === 0 && forbidden.length === 0;
      return {
        ...base,
        pass,
        evidence: {
          field: assertion.field ?? null,
          fields,
          matched: assertion.patterns.length - missing.length,
          required: assertion.patterns.length,
          missing,
          forbidden,
          patternMatches,
        },
      };
    }
    if (assertion.kind === "subagent_count") {
      const count = context.traceMetrics?.subagentCount;
      if (context.traceMetrics?.subagentMetricsAvailable === false || !Number.isSafeInteger(count) || count < 0) {
        return { ...base, pass: null, evidence: "subagent identity/count telemetry is unavailable" };
      }
      const minimum = assertion.minimum;
      const maximum = assertion.maximum;
      const pass = count >= minimum && (maximum === undefined || count <= maximum);
      return { ...base, pass, evidence: { count, minimum, maximum: maximum ?? null } };
    }
    if (assertion.kind === "workspace_unchanged") {
      const changes = changedPaths(context.beforeManifest, context.afterManifest);
      return { ...base, pass: changes.length === 0, evidence: changes.length ? `changed: ${changes.join(", ")}` : "workspace unchanged" };
    }
    if (assertion.kind === "changed_paths_allowed") {
      const changes = changedPaths(context.beforeManifest, context.afterManifest);
      const unexpected = changes.filter((file) => !matchesAllowed(file, assertion.paths));
      return { ...base, pass: unexpected.length === 0, evidence: unexpected.length ? `unexpected changes: ${unexpected.join(", ")}` : `changed paths allowed: ${changes.join(", ") || "none"}` };
    }
    if (assertion.kind === "file_regex") {
      const file = safeToolCwd(context.workspace, assertion.path);
      if (!(await stat(file)).isFile()) return { ...base, pass: false, evidence: `${assertion.path} is not a regular file` };
      const text = await readFile(file, "utf8");
      const pass = new RegExp(assertion.pattern, assertion.flags ?? "").test(text);
      return { ...base, pass, evidence: pass ? `${assertion.path} matched` : `${assertion.path} did not match ${assertion.pattern}` };
    }
    if (assertion.kind === "command") {
      const isolated = await graderIsolation({
        assertion,
        workspace: context.workspace,
        suiteRoot: context.suiteRoot,
        bwrap: context.bwrap,
      });
      const result = await runProcess(isolated.command, isolated.arguments, {
        env: isolated.environment,
        timeoutMs: assertion.timeoutMs ?? context.commandTimeoutMs,
      });
      const expectedExitCode = assertion.expectedExitCode ?? 0;
      const exitPass = !result.timedOut && !result.spawnError && result.code === expectedExitCode;
      const stdoutPass = assertion.stdoutPattern === undefined || new RegExp(assertion.stdoutPattern).test(result.stdout);
      const stderrPass = assertion.stderrPattern === undefined || new RegExp(assertion.stderrPattern).test(result.stderr);
      return {
        ...base,
        pass: exitPass && stdoutPass && stderrPass,
        evidence: {
          ...isolated.display,
          exitCode: result.code,
          timedOut: result.timedOut,
          spawnError: result.spawnError,
          stdout: result.stdout,
          stderr: result.stderr,
          stdoutTruncated: result.stdoutTruncated,
          stderrTruncated: result.stderrTruncated,
        },
      };
    }
    return { ...base, pass: false, evidence: `unsupported assertion kind: ${assertion.kind}` };
  } catch (error) {
    return { ...base, pass: false, evidence: `grader error: ${error.message}` };
  }
}

export async function gradeRun(rubric, context) {
  const assertions = [];
  for (const assertion of rubric.assertions) {
    const result = await gradeAssertion(assertion, context);
    assertions.push({ ...result, status: result.pass === null ? "indeterminate" : result.pass ? "pass" : "fail" });
  }
  const scoreLowerBound = assertions.filter((assertion) => assertion.pass === true).reduce((total, assertion) => total + assertion.weight, 0);
  const indeterminateWeight = assertions.filter((assertion) => assertion.pass === null).reduce((total, assertion) => total + assertion.weight, 0);
  const scoreUpperBound = scoreLowerBound + indeterminateWeight;
  const scoringComplete = indeterminateWeight === 0;
  const score = scoringComplete ? scoreLowerBound : null;
  const taskOutcomeAssertions = assertions.filter((assertion) => assertion.kind !== "subagent_count");
  const taskOutcomeWeight = taskOutcomeAssertions.reduce((total, assertion) => total + assertion.weight, 0);
  const taskOutcomeScoringComplete = taskOutcomeAssertions.every((assertion) => assertion.pass !== null);
  const taskOutcomeEarned = taskOutcomeAssertions.filter((assertion) => assertion.pass === true).reduce((total, assertion) => total + assertion.weight, 0);
  const taskOutcomeScore = taskOutcomeScoringComplete && taskOutcomeWeight > 0
    ? Number(((taskOutcomeEarned / taskOutcomeWeight) * 100).toFixed(2))
    : null;
  const criticalFailures = assertions.filter((assertion) => assertion.critical && assertion.pass === false).map((assertion) => assertion.id);
  const criticalIndeterminate = assertions.filter((assertion) => assertion.critical && assertion.pass === null).map((assertion) => assertion.id);
  const dimensions = {};
  for (const assertion of assertions) {
    const dimension = dimensions[assertion.dimension] ??= {
      earned: 0,
      available: 0,
      assessed: 0,
      indeterminate: 0,
      percent: 0,
      lowerBoundPercent: 0,
      upperBoundPercent: 0,
      coveragePercent: 100,
      complete: true,
      pass: true,
      criticalPass: true,
      criticalFailures: [],
      criticalIndeterminate: [],
    };
    dimension.available += assertion.weight;
    if (assertion.pass === true) {
      dimension.earned += assertion.weight;
      dimension.assessed += assertion.weight;
    } else if (assertion.pass === false) {
      dimension.assessed += assertion.weight;
      dimension.pass = false;
    } else {
      dimension.indeterminate += assertion.weight;
      dimension.complete = false;
      dimension.pass = false;
    }
    if (assertion.critical && assertion.pass === false) {
      dimension.criticalPass = false;
      dimension.criticalFailures.push(assertion.id);
    }
    if (assertion.critical && assertion.pass === null) {
      dimension.criticalPass = false;
      dimension.criticalIndeterminate.push(assertion.id);
    }
  }
  for (const dimension of Object.values(dimensions)) {
    dimension.percent = dimension.complete && dimension.available > 0 ? Number(((dimension.earned / dimension.available) * 100).toFixed(2)) : null;
    dimension.lowerBoundPercent = dimension.available === 0 ? 0 : Number(((dimension.earned / dimension.available) * 100).toFixed(2));
    dimension.upperBoundPercent = dimension.available === 0 ? 0 : Number((((dimension.earned + dimension.indeterminate) / dimension.available) * 100).toFixed(2));
    dimension.coveragePercent = dimension.available === 0 ? 100 : Number(((dimension.assessed / dimension.available) * 100).toFixed(2));
  }
  return {
    rubricVersion: rubric.version,
    score,
    scoreLowerBound,
    scoreUpperBound,
    scoringComplete,
    indeterminateWeight,
    taskOutcomeScore,
    taskOutcomeWeight,
    taskOutcomeScoringComplete,
    pass: scoringComplete && assertions.every((assertion) => assertion.pass === true),
    criticalPass: criticalFailures.length === 0 && criticalIndeterminate.length === 0,
    criticalFailures,
    criticalIndeterminate,
    dimensions,
    assertions,
  };
}
