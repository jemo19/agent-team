#!/usr/bin/env node
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compatibleMatrix, loadCatalog } from "../lib/catalog.mjs";
import { sha256, stableStringify } from "../lib/common.mjs";
import { validateIsolationEnvironment } from "../lib/isolation.mjs";
import { loadSuite } from "../lib/manifest.mjs";
import { parseOptions } from "../lib/options.mjs";
import { runProcess, toolEnvironment } from "../lib/process.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function within(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function overlaps(left, right) {
  return within(left, right) || within(right, left);
}

async function existingRealAncestor(target) {
  let candidate = path.resolve(target);
  const suffix = [];
  while (true) {
    try {
      const details = await lstat(candidate);
      if (details.isSymbolicLink()) throw new Error(`results path traverses a symlink: ${candidate}`);
      const resolved = await realpath(candidate);
      return path.join(resolved, ...suffix.reverse());
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(candidate);
      if (parent === candidate) throw error;
      suffix.push(path.basename(candidate));
      candidate = parent;
    }
  }
}

export async function validateResultsPath({ suite, resultsRoot }) {
  const resolved = path.resolve(resultsRoot);
  const canonical = await existingRealAncestor(resolved);
  const protectedPaths = [
    suite.suiteFile,
    path.join(suite.root, "lib"),
    path.join(suite.root, "scripts"),
    path.join(suite.root, "schemas"),
    path.join(suite.root, "roles"),
    path.join(suite.root, "tests"),
    path.join(suite.root, "README.md"),
  ];
  for (const protectedPath of protectedPaths) {
    if (overlaps(canonical, protectedPath)) {
      throw new Error(`results path overlaps benchmark source or fixtures: ${resolved} <-> ${protectedPath}`);
    }
  }

  const gitRootResult = await runProcess("git", ["rev-parse", "--show-toplevel"], {
    cwd: suite.root,
    env: toolEnvironment(suite.root),
    timeoutMs: 10_000,
  });
  const gitRoot = gitRootResult.code === 0 ? path.resolve(gitRootResult.stdout.trim()) : null;
  let locality;
  let ignored = false;
  if (gitRoot && within(gitRoot, canonical)) {
    const probe = path.join(canonical, ".ignore-probe");
    const ignoreResult = await runProcess("git", ["check-ignore", "--quiet", probe], {
      cwd: gitRoot,
      env: toolEnvironment(suite.root),
      timeoutMs: 10_000,
    });
    if (ignoreResult.code !== 0) throw new Error(`${resolved} is inside the worktree but is not covered by gitignore`);
    const relative = path.relative(gitRoot, canonical);
    const tracked = await runProcess("git", ["ls-files", "--", relative], {
      cwd: gitRoot,
      env: toolEnvironment(suite.root),
      timeoutMs: 10_000,
    });
    if (tracked.code !== 0) throw new Error(`cannot verify tracked files beneath results path: ${tracked.stderr.trim() || tracked.code}`);
    if (tracked.stdout.trim()) throw new Error(`${resolved} contains paths already tracked by git`);
    locality = "git-ignored-worktree";
    ignored = true;
  } else if (within(os.tmpdir(), canonical)) {
    locality = "system-temporary-directory";
  } else {
    throw new Error(`custom results path must be git-ignored inside this worktree or beneath ${os.tmpdir()}: ${resolved}`);
  }
  return { resultsRoot: resolved, canonicalResultsRoot: canonical, locality, gitIgnored: ignored, gitRoot };
}

async function walkFiles(directory, base, output) {
  const children = await readdir(directory, { withFileTypes: true });
  children.sort((a, b) => a.name.localeCompare(b.name));
  for (const child of children) {
    const absolute = path.join(directory, child.name);
    if (child.isDirectory()) await walkFiles(absolute, base, output);
    else if (child.isFile()) output.push(absolute);
    else throw new Error(`harness digest source contains unsupported entry: ${absolute}`);
  }
}

export async function computeHarnessCodeDigest(suiteRoot) {
  const files = [];
  for (const directory of ["lib", "scripts", "schemas"]) await walkFiles(path.join(suiteRoot, directory), suiteRoot, files);
  const entries = [];
  for (const file of files.sort()) {
    const contents = await readFile(file);
    entries.push({ path: path.relative(suiteRoot, file).split(path.sep).join("/"), sha256: sha256(contents) });
  }
  return { digest: sha256(stableStringify(entries)), entries };
}

export async function validateEnvironment({ suite, catalog, resultsRoot, codex = "codex", bwrap = "bwrap", authFile, requireAuth = false }) {
  const supported = new Set(compatibleMatrix(catalog).map((pair) => `${pair.model}\0${pair.effort}`));
  const errors = [];
  for (const pair of suite.matrix) if (!supported.has(`${pair.model}\0${pair.effort}`)) errors.push(`frozen matrix uses unsupported ${pair.model}/${pair.effort}`);
  for (const [roleId, baseline] of Object.entries(suite.baselines)) {
    if (!supported.has(`${baseline.model}\0${baseline.effort}`)) errors.push(`baseline ${roleId} uses unsupported ${baseline.model}/${baseline.effort}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const resultPath = await validateResultsPath({ suite, resultsRoot });
  const harness = await computeHarnessCodeDigest(suite.root);
  const isolation = await validateIsolationEnvironment({ codex, bwrap, authFile, requireAuth });
  if (!isolation.pass) {
    const failures = [...(isolation.structural?.errors ?? [])];
    if (isolation.authentication?.error) failures.push(isolation.authentication.error);
    throw new Error(`isolation preflight failed:\n- ${failures.join("\n- ") || "unknown isolation failure"}`);
  }
  return {
    ok: true,
    suite: suite.suiteFile,
    suiteVersion: suite.suiteVersion,
    roles: suite.roles.length,
    catalogDigest: catalog.digest,
    frozenConfigurations: suite.matrix.length,
    resultPath,
    harnessCodeDigest: harness.digest,
    harnessCodeFiles: harness.entries,
    isolation,
  };
}

export async function runHarnessTests(suiteRoot) {
  const testRoot = path.join(suiteRoot, "tests");
  const testFiles = (await readdir(testRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.mjs"))
    .map((entry) => path.join(testRoot, entry.name))
    .sort();
  if (!testFiles.length) throw new Error(`no harness tests found beneath ${testRoot}`);
  const result = await runProcess(process.execPath, ["--test", ...testFiles], {
    cwd: suiteRoot,
    env: toolEnvironment(suiteRoot),
    timeoutMs: 180_000,
    captureLimit: 8 * 1024 * 1024,
  });
  if (result.code !== 0 || result.timedOut || result.spawnError) {
    throw new Error(`harness tests failed: ${result.spawnError || result.stderr.trim() || result.stdout.trim() || result.code}`);
  }
  const match = result.stdout.match(/^(?:#|ℹ) tests (\d+)$/m);
  return { command: [process.execPath, "--test", ...testFiles], testFiles, testCount: match ? Number(match[1]) : null, durationMs: result.durationMs, stdout: result.stdout };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const suiteFile = path.resolve(options.values.suite ?? path.join(here, "..", "suite.json"));
  const codex = options.values.codex ?? "codex";
  const suite = await loadSuite(suiteFile);
  const catalog = await loadCatalog({ codex, bundled: options.flags.has("bundled-catalog") });
  const resultsRoot = path.resolve(options.values.results ?? path.join(suite.root, "results"));
  const validation = await validateEnvironment({ suite, catalog, resultsRoot, codex, bwrap: options.values.bwrap, authFile: options.values["auth-file"], requireAuth: false });
  const tests = await runHarnessTests(suite.root);
  console.log(JSON.stringify({
    ...validation,
    tests: {
      passed: true,
      testCount: tests.testCount,
      testFileCount: tests.testFiles.length,
      durationMs: tests.durationMs,
      command: tests.command,
    },
  }, null, 2));
}

const invokedAsScript = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedAsScript) main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
