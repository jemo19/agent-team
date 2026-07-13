import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { assertSafeRelative, readJson, resolveInside, sha256, stableStringify } from "./common.mjs";

const SANDBOXES = new Set(["read-only", "workspace-write"]);
const KINDS = new Set([
  "output_all",
  "output_regex",
  "output_absent_regex",
  "subagent_count",
  "workspace_unchanged",
  "changed_paths_allowed",
  "file_regex",
  "command",
]);
const DIMENSIONS = new Set(["correctness", "evidence", "safety", "verification", "scope", "clarity"]);
const OUTPUT_FIELDS = new Set(["outcome", "summary", "findings", "actions", "checks", "message"]);
const DIFFICULTIES = new Set(["standard", "advanced", "adversarial"]);
const OUTPUT_NORMALIZERS = new Set(["unicode-punctuation", "hyphen-as-space"]);
const ASSERTION_FIELDS = {
  output_all: ["field", "fields", "patterns", "absentPatterns", "flags", "normalizers"],
  output_regex: ["pattern", "flags"],
  output_absent_regex: ["pattern", "flags"],
  subagent_count: ["minimum", "maximum"],
  workspace_unchanged: [],
  changed_paths_allowed: ["paths"],
  file_regex: ["path", "pattern", "flags"],
  command: ["argv", "cwd", "expectedExitCode", "stdoutPattern", "stderrPattern", "timeoutMs"],
};

function requiredString(value, label, errors) {
  if (typeof value !== "string" || value.length === 0) errors.push(`${label} must be a non-empty string`);
}

function validateRegex(pattern, flags, label, errors) {
  requiredString(pattern, `${label}.pattern`, errors);
  if (flags !== undefined && (typeof flags !== "string" || /[^dgimsuvy]/.test(flags))) {
    errors.push(`${label}.flags contains unsupported regular-expression flags`);
  }
  try {
    if (typeof pattern === "string") new RegExp(pattern, flags ?? "");
  } catch (error) {
    errors.push(`${label} has invalid regular expression: ${error.message}`);
  }
}

export function validateRubric(rubric, label = "rubric") {
  const errors = [];
  if (!rubric || typeof rubric !== "object" || Array.isArray(rubric)) return [`${label} must be an object`];
  requiredString(rubric.version, `${label}.version`, errors);
  if (!Array.isArray(rubric.assertions) || rubric.assertions.length === 0) {
    errors.push(`${label}.assertions must be a non-empty array`);
    return errors;
  }
  const ids = new Set();
  let weight = 0;
  rubric.assertions.forEach((assertion, index) => {
    const at = `${label}.assertions[${index}]`;
    if (!assertion || typeof assertion !== "object" || Array.isArray(assertion)) {
      errors.push(`${at} must be an object`);
      return;
    }
    requiredString(assertion.id, `${at}.id`, errors);
    requiredString(assertion.description, `${at}.description`, errors);
    if (ids.has(assertion.id)) errors.push(`${at}.id duplicates ${assertion.id}`);
    ids.add(assertion.id);
    if (!KINDS.has(assertion.kind)) errors.push(`${at}.kind is unsupported: ${assertion.kind}`);
    const allowedFields = new Set(["id", "description", "kind", "weight", "critical", "dimension", ...(ASSERTION_FIELDS[assertion.kind] ?? [])]);
    const unknownFields = Object.keys(assertion).filter((key) => !allowedFields.has(key));
    if (unknownFields.length) errors.push(`${at} has fields unsupported for ${assertion.kind}: ${unknownFields.join(", ")}`);
    if (typeof assertion.weight !== "number" || !Number.isFinite(assertion.weight) || assertion.weight <= 0) {
      errors.push(`${at}.weight must be a positive number`);
    } else {
      weight += assertion.weight;
    }
    if (typeof assertion.critical !== "boolean") errors.push(`${at}.critical must be boolean`);
    if (!DIMENSIONS.has(assertion.dimension)) errors.push(`${at}.dimension is unsupported: ${assertion.dimension}`);
    if (assertion.kind === "output_all") {
      const hasField = assertion.field !== undefined;
      const hasFields = assertion.fields !== undefined;
      if (hasField === hasFields) errors.push(`${at} must define exactly one of field or fields`);
      if (hasField && !OUTPUT_FIELDS.has(assertion.field)) errors.push(`${at}.field is unsupported: ${assertion.field}`);
      if (hasFields) {
        if (!Array.isArray(assertion.fields) || assertion.fields.length === 0) errors.push(`${at}.fields must be a non-empty array`);
        else {
          const uniqueFields = new Set(assertion.fields);
          if (uniqueFields.size !== assertion.fields.length) errors.push(`${at}.fields must not contain duplicates`);
          assertion.fields.forEach((field) => {
            if (!OUTPUT_FIELDS.has(field)) errors.push(`${at}.fields contains unsupported field: ${field}`);
          });
        }
      }
      if (assertion.normalizers !== undefined) {
        if (!Array.isArray(assertion.normalizers) || assertion.normalizers.length === 0) errors.push(`${at}.normalizers must be a non-empty array when present`);
        else {
          if (new Set(assertion.normalizers).size !== assertion.normalizers.length) errors.push(`${at}.normalizers must not contain duplicates`);
          assertion.normalizers.forEach((normalizer) => {
            if (!OUTPUT_NORMALIZERS.has(normalizer)) errors.push(`${at}.normalizers contains unsupported normalizer: ${normalizer}`);
          });
        }
      }
      if (!Array.isArray(assertion.patterns) || assertion.patterns.length === 0) {
        errors.push(`${at}.patterns must be a non-empty array`);
      } else {
        assertion.patterns.forEach((pattern, patternIndex) => validateRegex(pattern, assertion.flags, `${at}.patterns[${patternIndex}]`, errors));
      }
      if (assertion.absentPatterns !== undefined) {
        if (!Array.isArray(assertion.absentPatterns) || assertion.absentPatterns.length === 0) {
          errors.push(`${at}.absentPatterns must be a non-empty array when present`);
        } else {
          assertion.absentPatterns.forEach((pattern, patternIndex) => validateRegex(pattern, assertion.flags, `${at}.absentPatterns[${patternIndex}]`, errors));
        }
      }
    }
    if (assertion.kind === "output_regex" || assertion.kind === "output_absent_regex") {
      validateRegex(assertion.pattern, assertion.flags, at, errors);
    }
    if (assertion.kind === "changed_paths_allowed") {
      if (!Array.isArray(assertion.paths)) errors.push(`${at}.paths must be an array`);
      else assertion.paths.forEach((entry, pathIndex) => {
        try { assertSafeRelative(entry, `${at}.paths[${pathIndex}]`); } catch (error) { errors.push(error.message); }
      });
    }
    if (assertion.kind === "file_regex") {
      try { assertSafeRelative(assertion.path, `${at}.path`); } catch (error) { errors.push(error.message); }
      validateRegex(assertion.pattern, assertion.flags, at, errors);
    }
    if (assertion.kind === "command") {
      if (!Array.isArray(assertion.argv) || assertion.argv.length === 0 || assertion.argv.some((arg) => typeof arg !== "string")) {
        errors.push(`${at}.argv must be a non-empty array of strings`);
      }
      const executable = assertion.argv?.[0]?.split(/[\\/]/).pop()?.toLowerCase();
      if (["sh", "bash", "zsh", "fish", "cmd", "cmd.exe", "powershell", "pwsh"].includes(executable)) {
        errors.push(`${at}.argv may not invoke a command shell`);
      }
      if (assertion.cwd !== undefined) {
        try { assertSafeRelative(assertion.cwd, `${at}.cwd`); } catch (error) { errors.push(error.message); }
      }
      if (assertion.expectedExitCode !== undefined && !Number.isInteger(assertion.expectedExitCode)) errors.push(`${at}.expectedExitCode must be an integer`);
      if (assertion.timeoutMs !== undefined && (!Number.isSafeInteger(assertion.timeoutMs) || assertion.timeoutMs < 1)) errors.push(`${at}.timeoutMs must be a positive integer`);
      if (assertion.stdoutPattern !== undefined) validateRegex(assertion.stdoutPattern, "", `${at}.stdoutPattern`, errors);
      if (assertion.stderrPattern !== undefined) validateRegex(assertion.stderrPattern, "", `${at}.stderrPattern`, errors);
    }
    if (assertion.kind === "subagent_count") {
      if (!Number.isSafeInteger(assertion.minimum) || assertion.minimum < 0) errors.push(`${at}.minimum must be a non-negative integer`);
      if (assertion.maximum !== undefined && (!Number.isSafeInteger(assertion.maximum) || assertion.maximum < assertion.minimum)) {
        errors.push(`${at}.maximum must be an integer greater than or equal to minimum`);
      }
    }
  });
  if (Math.abs(weight - 100) > 1e-9) errors.push(`${label} assertion weights total ${weight}, expected 100`);
  return errors;
}

export function validateOutput(value) {
  const errors = [];
  const keys = ["outcome", "summary", "findings", "actions", "checks", "message"];
  const outcomes = new Set(["complete", "partial", "blocked", "failed"]);
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["output must be an object"];
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`output has unknown field ${key}`);
  for (const key of keys) if (!(key in value)) errors.push(`output is missing ${key}`);
  if (!outcomes.has(value.outcome)) errors.push("output.outcome is invalid");
  for (const key of ["summary", "message"]) if (typeof value[key] !== "string") errors.push(`output.${key} must be a string`);
  for (const key of ["findings", "actions", "checks"]) {
    if (!Array.isArray(value[key]) || value[key].some((item) => typeof item !== "string")) errors.push(`output.${key} must be an array of strings`);
  }
  return errors;
}

async function inspectTree(root) {
  const entries = [];
  async function walk(directory) {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const absolute = path.join(directory, child.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      const details = await lstat(absolute);
      if (relative === ".git" && details.isDirectory()) continue;
      if (details.isSymbolicLink()) throw new Error(`fixture workspace contains forbidden symlink: ${relative}`);
      if (details.isDirectory()) await walk(absolute);
      else if (details.isFile()) entries.push({ path: relative, type: "file", size: details.size, mode: details.mode & 0o777, sha256: sha256(await readFile(absolute)) });
      else throw new Error(`fixture workspace contains unsupported entry: ${relative}`);
    }
  }
  await walk(root);
  return entries;
}

export async function treeManifest(root) {
  const entries = await inspectTree(root);
  return { entries, digest: sha256(stableStringify(entries)) };
}

export function changedPaths(before, after) {
  const signature = (entry) => stableStringify({ type: entry.type, size: entry.size, mode: entry.mode, sha256: entry.sha256 });
  const left = new Map(before.entries.map((entry) => [entry.path, signature(entry)]));
  const right = new Map(after.entries.map((entry) => [entry.path, signature(entry)]));
  return [...new Set([...left.keys(), ...right.keys()])].filter((file) => left.get(file) !== right.get(file)).sort();
}

export async function loadSuite(suiteFile) {
  const absoluteSuite = path.resolve(suiteFile);
  const root = path.dirname(absoluteSuite);
  const realRoot = await realpath(root);
  const suite = await readJson(absoluteSuite);
  const errors = [];
  if (!suite || typeof suite !== "object" || Array.isArray(suite)) throw new Error("suite.json must be an object");
  requiredString(suite.suiteVersion, "suiteVersion", errors);
  if (!Array.isArray(suite.matrix) || suite.matrix.length === 0) errors.push("matrix must be a non-empty array");
  const matrix = [];
  const matrixModels = new Set();
  const matrixPairs = new Set();
  for (const [index, entry] of (suite.matrix ?? []).entries()) {
    const at = `matrix[${index}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(`${at} must be an object`);
      continue;
    }
    requiredString(entry.model, `${at}.model`, errors);
    if (matrixModels.has(entry.model)) errors.push(`${at}.model duplicates ${entry.model}`);
    matrixModels.add(entry.model);
    if (!Array.isArray(entry.efforts) || entry.efforts.length === 0) errors.push(`${at}.efforts must be a non-empty array`);
    const localEfforts = new Set();
    for (const effort of entry.efforts ?? []) {
      requiredString(effort, `${at}.efforts`, errors);
      if (localEfforts.has(effort)) errors.push(`${at}.efforts duplicates ${effort}`);
      localEfforts.add(effort);
      const key = `${entry.model}\0${effort}`;
      if (matrixPairs.has(key)) errors.push(`${at} duplicates ${entry.model}/${effort}`);
      matrixPairs.add(key);
      matrix.push({ model: entry.model, effort });
    }
    const unknown = Object.keys(entry).filter((key) => !["model", "efforts"].includes(key));
    if (unknown.length) errors.push(`${at} has unknown fields: ${unknown.join(", ")}`);
  }
  if (!suite.baselines || typeof suite.baselines !== "object" || Array.isArray(suite.baselines)) errors.push("baselines must be an object keyed by role id");
  if (!Array.isArray(suite.roles) || suite.roles.length === 0) errors.push("roles must be a non-empty array");
  const ids = new Set();
  const fixtureIds = new Set();
  const roles = [];
  for (const [index, role] of (suite.roles ?? []).entries()) {
    const at = `roles[${index}]`;
    if (!role || typeof role !== "object" || Array.isArray(role)) {
      errors.push(`${at} must be an object`);
      continue;
    }
    for (const key of ["id", "displayName", "sandbox", "roleFile", "taskFile", "workspace", "rubricFile"]) requiredString(role[key], `${at}.${key}`, errors);
    const allowedRoleKeys = ["id", "displayName", "sandbox", "roleFile", "taskFile", "workspace", "rubricFile", "fixture", "hiddenFiles", "referenceOutputFile", "negativeControlOutputFile", "goldWorkspaceFiles"];
    const unknownRoleKeys = Object.keys(role).filter((key) => !allowedRoleKeys.includes(key));
    if (unknownRoleKeys.length) errors.push(`${at} has unknown fields: ${unknownRoleKeys.join(", ")}`);
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(role.id ?? "")) errors.push(`${at}.id must contain lowercase letters, digits, underscores, or hyphens`);
    if (ids.has(role.id)) errors.push(`${at}.id duplicates ${role.id}`);
    ids.add(role.id);
    if (!SANDBOXES.has(role.sandbox)) errors.push(`${at}.sandbox must be read-only or workspace-write`);
    if (!role.fixture || typeof role.fixture !== "object" || Array.isArray(role.fixture)) {
      errors.push(`${at}.fixture must be an object`);
    } else {
      for (const key of ["fixtureId", "version", "difficulty", "taskSummary", "instructionSource", "sourceNote"]) {
        requiredString(role.fixture[key], `${at}.fixture.${key}`, errors);
      }
      const unknownFixtureKeys = Object.keys(role.fixture).filter((key) => !["fixtureId", "version", "difficulty", "taskSummary", "instructionSource", "sourceNote"].includes(key));
      if (unknownFixtureKeys.length) errors.push(`${at}.fixture has unknown fields: ${unknownFixtureKeys.join(", ")}`);
      if (fixtureIds.has(role.fixture.fixtureId)) errors.push(`${at}.fixture.fixtureId duplicates ${role.fixture.fixtureId}`);
      fixtureIds.add(role.fixture.fixtureId);
      if (!DIFFICULTIES.has(role.fixture.difficulty)) errors.push(`${at}.fixture.difficulty is unsupported: ${role.fixture.difficulty}`);
      if (role.fixture.instructionSource !== "controlled-instruction-surrogate") {
        errors.push(`${at}.fixture.instructionSource must be controlled-instruction-surrogate`);
      }
    }
    if (!Array.isArray(role.hiddenFiles)) errors.push(`${at}.hiddenFiles must be an array`);
    const paths = {};
    for (const key of ["roleFile", "taskFile", "workspace", "rubricFile"]) {
      try { paths[key] = resolveInside(root, role[key], `${at}.${key}`); } catch (error) { errors.push(error.message); }
    }
    const hiddenPaths = [];
    for (const [hiddenIndex, hiddenFile] of (role.hiddenFiles ?? []).entries()) {
      try {
        const hiddenPath = resolveInside(root, hiddenFile, `${at}.hiddenFiles[${hiddenIndex}]`);
        if (hiddenPaths.some((entry) => entry.relative === hiddenFile)) errors.push(`${at}.hiddenFiles duplicates ${hiddenFile}`);
        hiddenPaths.push({ relative: hiddenFile, absolute: hiddenPath });
      } catch (error) {
        errors.push(error.message);
      }
    }
    const controlPaths = {};
    for (const key of ["referenceOutputFile", "negativeControlOutputFile"]) {
      if (role[key] === undefined) continue;
      try {
        controlPaths[key] = resolveInside(root, role[key], `${at}.${key}`);
        if (!(role.hiddenFiles ?? []).includes(role[key])) errors.push(`${at}.${key} must also be listed in hiddenFiles`);
      } catch (error) {
        errors.push(error.message);
      }
    }
    if ((role.referenceOutputFile === undefined) !== (role.negativeControlOutputFile === undefined)) {
      errors.push(`${at} must define both referenceOutputFile and negativeControlOutputFile or neither`);
    }
    if (role.sandbox === "read-only" && (role.referenceOutputFile === undefined || role.negativeControlOutputFile === undefined)) {
      errors.push(`${at} read-only fixtures require reference and negative-control outputs`);
    }
    if (role.sandbox === "workspace-write") {
      if (!role.goldWorkspaceFiles || typeof role.goldWorkspaceFiles !== "object" || Array.isArray(role.goldWorkspaceFiles) || Object.keys(role.goldWorkspaceFiles).length === 0) {
        errors.push(`${at} workspace-write fixtures require goldWorkspaceFiles`);
      } else {
        for (const [target, source] of Object.entries(role.goldWorkspaceFiles)) {
          try { assertSafeRelative(target, `${at}.goldWorkspaceFiles target`); } catch (error) { errors.push(error.message); }
          if (typeof source !== "string" || !(role.hiddenFiles ?? []).includes(source)) {
            errors.push(`${at}.goldWorkspaceFiles source must be listed in hiddenFiles: ${source}`);
          }
        }
      }
    }
    if (Object.keys(paths).length !== 4) continue;
    try {
      for (const [key, target] of Object.entries(paths)) {
        if ((await lstat(target)).isSymbolicLink()) errors.push(`${at}.${key} may not be a symlink`);
        const realTarget = await realpath(target);
        if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) errors.push(`${at}.${key} resolves outside the suite root`);
      }
      if (!(await stat(paths.workspace)).isDirectory()) errors.push(`${at}.workspace is not a directory`);
      for (const key of ["roleFile", "taskFile", "rubricFile"]) if (!(await stat(paths[key])).isFile()) errors.push(`${at}.${key} is not a file`);
      const realWorkspace = await realpath(paths.workspace);
      const hiddenEntries = [];
      for (const hidden of hiddenPaths) {
        if ((await lstat(hidden.absolute)).isSymbolicLink()) errors.push(`${at}.hiddenFiles may not contain a symlink: ${hidden.relative}`);
        if (!(await stat(hidden.absolute)).isFile()) errors.push(`${at}.hiddenFiles entry is not a file: ${hidden.relative}`);
        const realHidden = await realpath(hidden.absolute);
        if (realHidden !== realRoot && !realHidden.startsWith(`${realRoot}${path.sep}`)) {
          errors.push(`${at}.hiddenFiles resolves outside the suite root: ${hidden.relative}`);
        }
        if (realHidden === realWorkspace || realHidden.startsWith(`${realWorkspace}${path.sep}`)) {
          errors.push(`${at}.hiddenFiles must remain outside the staged workspace: ${hidden.relative}`);
        }
        hiddenEntries.push({ path: hidden.relative, sha256: sha256(await readFile(hidden.absolute)) });
      }
      hiddenEntries.sort((a, b) => a.path.localeCompare(b.path));
      const controls = {};
      for (const [key, controlPath] of Object.entries(controlPaths)) {
        const value = await readJson(controlPath);
        const outputErrors = validateOutput(value);
        if (outputErrors.length) errors.push(...outputErrors.map((error) => `${at}.${key}: ${error}`));
        controls[key] = value;
      }
      const rubric = await readJson(paths.rubricFile);
      errors.push(...validateRubric(rubric, `${at}.rubric`));
      roles.push({ ...role, paths, rubric, hiddenManifest: { entries: hiddenEntries, digest: sha256(stableStringify(hiddenEntries)) }, ...controls });
    } catch (error) {
      errors.push(`${at}: ${error.message}`);
    }
  }
  if (errors.length) throw new Error(`Suite validation failed:\n- ${errors.join("\n- ")}`);
  const baselineKeys = Object.keys(suite.baselines).sort();
  const roleKeys = roles.map((role) => role.id).sort();
  if (stableStringify(baselineKeys) !== stableStringify(roleKeys)) {
    throw new Error("Suite validation failed:\n- baselines must contain exactly one entry for every role id");
  }
  for (const [roleId, baseline] of Object.entries(suite.baselines)) {
    if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) throw new Error(`Suite validation failed:\n- baseline ${roleId} must be an object`);
    requiredString(baseline.model, `baselines.${roleId}.model`, errors);
    requiredString(baseline.effort, `baselines.${roleId}.effort`, errors);
    const unknown = Object.keys(baseline).filter((key) => !["model", "effort"].includes(key));
    if (unknown.length) errors.push(`baselines.${roleId} has unknown fields: ${unknown.join(", ")}`);
    if (!matrixPairs.has(`${baseline.model}\0${baseline.effort}`)) errors.push(`baseline ${roleId} is not in the frozen matrix: ${baseline.model}/${baseline.effort}`);
  }
  if (errors.length) throw new Error(`Suite validation failed:\n- ${errors.join("\n- ")}`);
  for (const role of roles) {
    role.workspaceManifest = await treeManifest(role.paths.workspace);
    role.roleText = await readFile(role.paths.roleFile, "utf8");
    role.taskText = await readFile(role.paths.taskFile, "utf8");
    role.fingerprint = sha256(stableStringify({
      definition: { id: role.id, displayName: role.displayName, sandbox: role.sandbox },
      fixture: role.fixture,
      roleText: role.roleText,
      taskText: role.taskText,
      workspace: role.workspaceManifest.digest,
      hidden: role.hiddenManifest.digest,
      rubric: role.rubric,
    }));
  }
  return { suiteFile: absoluteSuite, root, suiteVersion: suite.suiteVersion, matrix, baselines: suite.baselines, roles };
}
