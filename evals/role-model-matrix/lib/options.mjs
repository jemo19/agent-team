import { randomBytes } from "node:crypto";

export const EXECUTION_DEFAULTS = Object.freeze({
  repetitions: 1,
  concurrency: 1,
  concurrencyCeiling: 4,
  hardConcurrencyCeiling: 16,
  candidateCeiling: 250,
  hardCandidateCeiling: 5000,
  timeoutMs: 1_800_000,
  hardTimeoutMs: 3_600_000,
  commandTimeoutMs: 120_000,
  hardCommandTimeoutMs: 600_000,
  maxTimeouts: 3,
  maxHarnessFailures: 5,
  maxEstimatedCredits: 10_000,
  serviceTier: "default",
});

export const CREDIT_PLANNING_SNAPSHOT = Object.freeze({
  source: "https://developers.openai.com/codex/pricing",
  accessedAt: "2026-07-09",
  creditsPerMessage: Object.freeze({ min: 5, max: 40 }),
  caveat: "Planning range, not a quote. Context, reasoning, tools, caching, retries, and Ultra child-agent usage can change actual consumption.",
});

export function parseOptions(argv) {
  const options = { values: {}, flags: new Set(), positional: [] };
  const booleanFlags = new Set(["--dry-run", "--prepare", "--execute", "--help", "--retry-failed", "--bundled-catalog"]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      options.positional.push(token);
      continue;
    }
    if (booleanFlags.has(token)) {
      options.flags.add(token.slice(2));
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${token} requires a value`);
    options.values[token.slice(2)] = value;
    index += 1;
  }
  return options;
}

export function csvList(value) {
  if (value === undefined) return null;
  const values = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!values.length) throw new Error("comma-separated filter cannot be empty");
  return values;
}

export function parseNonNegativeInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative integer`);
  return parsed;
}

export function defaultSeed() {
  return `matrix-${randomBytes(12).toString("hex")}`;
}

export function createSeededRandom(seed, sha256) {
  if (typeof seed !== "string" || seed.length === 0) throw new Error("seed must be a non-empty string");
  let state = Number.parseInt(sha256(seed).slice(0, 8), 16) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(items, seed, sha256) {
  const random = createSeededRandom(seed, sha256);
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function enforcePlanCeilings({
  plannedCases,
  concurrency,
  timeoutMs,
  commandTimeoutMs,
  candidateCeiling,
  concurrencyCeiling,
  maxEstimatedCredits,
  hardCandidateCeiling = EXECUTION_DEFAULTS.hardCandidateCeiling,
  hardConcurrencyCeiling = EXECUTION_DEFAULTS.hardConcurrencyCeiling,
  hardTimeoutMs = EXECUTION_DEFAULTS.hardTimeoutMs,
  hardCommandTimeoutMs = EXECUTION_DEFAULTS.hardCommandTimeoutMs,
  creditsPerMessageMax = CREDIT_PLANNING_SNAPSHOT.creditsPerMessage.max,
}) {
  const errors = [];
  if (candidateCeiling > hardCandidateCeiling) errors.push(`--candidate-ceiling cannot exceed hard ceiling ${hardCandidateCeiling}`);
  if (plannedCases > candidateCeiling) errors.push(`planned cases ${plannedCases} exceed candidate ceiling ${candidateCeiling}`);
  if (concurrencyCeiling > hardConcurrencyCeiling) errors.push(`--concurrency-ceiling cannot exceed hard ceiling ${hardConcurrencyCeiling}`);
  if (concurrency > concurrencyCeiling) errors.push(`concurrency ${concurrency} exceeds concurrency ceiling ${concurrencyCeiling}`);
  if (timeoutMs > hardTimeoutMs) errors.push(`--timeout-ms cannot exceed ${hardTimeoutMs}`);
  if (commandTimeoutMs > hardCommandTimeoutMs) errors.push(`--command-timeout-ms cannot exceed ${hardCommandTimeoutMs}`);
  const estimatedCreditsMax = plannedCases * creditsPerMessageMax;
  if (estimatedCreditsMax > maxEstimatedCredits) {
    errors.push(`estimated planning maximum ${estimatedCreditsMax} credits exceeds ceiling ${maxEstimatedCredits}`);
  }
  if (errors.length) throw new Error(`Execution guardrail failed:\n- ${errors.join("\n- ")}`);
  return { estimatedCreditsMax };
}

export function optionHelp() {
  return `Options:
  --suite <file>          Dry-run/test suite override (prepared runs use the default)
  --phase <name>          calibration or screen
  --dry-run               Validate and print an ephemeral no-call preview
  --prepare               Persist a frozen no-call plan for operator review
  --execute               Execute only a previously prepared --resume run
  --resume <run-id>       Resume with the exact frozen execution settings
  --run-id <id>           Explicit id for a new run
  --results <directory>   Results root (default: <suite>/results)
  --scratch <directory>   Isolated workspaces for a new plan (default: /tmp/ai-team-role-evals)
  --roles <csv>           Restrict role ids
  --models <csv>          Restrict model slugs
  --efforts <csv>         Restrict reasoning efforts
  --repetitions <n>       Runs per matrix cell (default: 1)
  --concurrency <n>       Parallel isolated cases (default: 1)
  --concurrency-ceiling <n> Operational ceiling (default: 4; hard max: 16)
  --candidate-ceiling <n> Planned-case ceiling (default: 250; hard max: 5000)
  --timeout-ms <n>        Codex timeout per case (default: 1800000; max: 3600000)
  --command-timeout-ms <n> Grader timeout (default: 120000; max: 600000)
  --max-timeouts <n>      Stop scheduling after this many timeouts (default: 3)
  --max-harness-failures <n> Stop after this many harness failures (default: 5)
  --max-total-tokens <n>  Optional captured-token stop ceiling
  --max-estimated-credits <n> Planning maximum before scheduling (default: 10000)
  --service-tier default  Fixed service-tier label; Fast is a separate experiment
  --seed <text>           Seeded matrix randomization (generated and stored by default)
  --codex <path>          Dry-run/test Codex override (prepared runs use codex)
  --bwrap <path>          Dry-run/test Bubblewrap override (prepared runs use bwrap)
  --auth-file <path>      Dry-run/test auth override; metadata only is probed
  --retry-failed          Re-run prior failed/timeout terminal cases on resume
  --bundled-catalog       Dry-run/test bundled catalog override
`;
}
