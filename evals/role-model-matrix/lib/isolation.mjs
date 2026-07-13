import { constants as fsConstants } from "node:fs";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { access, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runProcess } from "./process.mjs";
import { sha256, stableStringify } from "./common.mjs";

const GUEST = Object.freeze({
  artifacts: "/artifacts",
  auth: "/codex-home/auth.json",
  codexHome: "/codex-home",
  candidateShell: "/runtime/bin/candidate-shell",
  control: "/control",
  graderHome: "/home/grader",
  node: "/runtime/bin/node",
  realBash: "/runtime/bin/real-bash",
  output: "/artifacts/final-message.json",
  outputSchema: "/control/output.schema.json",
  shellSnapshots: "/codex-home/shell_snapshots",
  toolHome: "/tool-home",
  vendor: "/opt/codex",
  workspace: "/workspace",
});

const PLATFORM_RUNTIME = Object.freeze({
  "linux:x64": ["@openai/codex-linux-x64", "x86_64-unknown-linux-musl"],
  "linux:arm64": ["@openai/codex-linux-arm64", "aarch64-unknown-linux-musl"],
});

const FIXTURE_NODE_MAJOR = 22;

let bubblewrapProbe = null;
let fixtureRuntimeProbe = null;

function pathEntries() {
  return (process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin").split(path.delimiter).filter(Boolean);
}

async function isRegularFile(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

async function isDirectory(directory) {
  try { return (await stat(directory)).isDirectory(); } catch { return false; }
}

async function hashRegularFile(file) {
  const digest = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return digest.digest("hex");
}

async function executableOnPath(command) {
  const candidates = command.includes(path.sep)
    ? [path.resolve(command)]
    : pathEntries().map((entry) => path.join(entry, command));
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      if ((await stat(candidate)).isFile()) return candidate;
    } catch { /* try the next PATH entry */ }
  }
  throw new Error(`required executable not found: ${command}`);
}

function versionParts(name) {
  const match = name.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : null;
}

function compareVersionsDescending(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return right.localeCompare(left);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return b[index] - a[index];
  }
  return 0;
}

async function fixtureNodeCandidates(explicit) {
  const candidates = [];
  const add = (candidate) => {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  };
  add(explicit);
  if (Number(process.versions.node.split(".")[0]) === FIXTURE_NODE_MAJOR) add(process.execPath);
  const nvmRoot = process.env.NVM_DIR ?? (process.env.HOME ? path.join(process.env.HOME, ".nvm") : null);
  if (nvmRoot) {
    const versionsRoot = path.join(nvmRoot, "versions", "node");
    try {
      const versions = (await readdir(versionsRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && versionParts(entry.name)?.[0] === FIXTURE_NODE_MAJOR)
        .map((entry) => entry.name)
        .sort(compareVersionsDescending);
      for (const version of versions) add(path.join(versionsRoot, version, "bin", "node"));
    } catch { /* a non-NVM installation may still be supplied explicitly */ }
  }
  try {
    add(await executableOnPath("node"));
  } catch { /* reported by the runtime resolver */ }
  return candidates;
}

async function resolveFixtureRuntime(explicit = process.env.AI_TEAM_EVAL_NODE_BIN) {
  const cacheKey = explicit ?? "auto";
  if (fixtureRuntimeProbe?.key === cacheKey) return fixtureRuntimeProbe.runtime;
  const failures = [];
  for (const candidate of await fixtureNodeCandidates(explicit)) {
    try {
      const node = await realpath(candidate);
      if (!(await isRegularFile(node))) throw new Error("not a regular file");
      const nodeResult = await runProcess(node, ["--version"], { env: {}, timeoutMs: 5000 });
      const nodeVersion = nodeResult.stdout.trim();
      if (nodeResult.code !== 0 || Number(nodeVersion.match(/^v(\d+)/)?.[1]) !== FIXTURE_NODE_MAJOR) {
        throw new Error(`expected Node ${FIXTURE_NODE_MAJOR}, observed ${nodeVersion || nodeResult.code}`);
      }
      const prefix = path.dirname(path.dirname(node));
      const npmRoot = path.join(prefix, "lib", "node_modules", "npm");
      const npmPackage = JSON.parse(await readFile(path.join(npmRoot, "package.json"), "utf8"));
      if (npmPackage.name !== "npm" || typeof npmPackage.version !== "string") throw new Error("matching npm package metadata is invalid");
      for (const file of ["bin/npm-cli.js", "bin/npx-cli.js"]) {
        if (!(await isRegularFile(path.join(npmRoot, file)))) throw new Error(`matching npm package is missing ${file}`);
      }
      const runtime = { node, nodeVersion, nodeMajor: FIXTURE_NODE_MAJOR, npmRoot, npmVersion: npmPackage.version };
      fixtureRuntimeProbe = { key: cacheKey, runtime };
      return runtime;
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(`Node ${FIXTURE_NODE_MAJOR} with its matching npm package is required for fixture execution${failures.length ? `:\n- ${failures.join("\n- ")}` : ""}`);
}

function baseNamespaceArguments({ unshareNetwork }) {
  const args = [
    "--die-with-parent",
    "--new-session",
    "--unshare-pid",
    "--unshare-ipc",
    "--unshare-uts",
  ];
  if (unshareNetwork) args.push("--unshare-net");
  args.push(
    "--proc", "/proc",
    "--dev", "/dev",
    "--tmpfs", "/tmp",
    "--ro-bind", "/usr", "/usr",
    "--symlink", "usr/bin", "/bin",
    "--symlink", "usr/lib", "/lib",
  );
  if (os.arch() === "x64") args.push("--symlink", "usr/lib64", "/lib64");
  return args;
}

function addReadOnlyBindIfPresent(args, source, destination = source) {
  if (!source) return;
  args.push("--ro-bind", source, destination);
}

async function probeBubblewrap(bwrap) {
  const resolved = await executableOnPath(bwrap);
  const key = resolved;
  if (bubblewrapProbe?.key === key) return resolved;
  const result = await runProcess(resolved, [
    "--die-with-parent",
    "--new-session",
    "--unshare-pid",
    "--unshare-net",
    "--proc", "/proc",
    "--dev", "/dev",
    "--ro-bind", "/usr", "/usr",
    "--symlink", "usr/bin", "/bin",
    "--symlink", "usr/lib", "/lib",
    ...(os.arch() === "x64" ? ["--symlink", "usr/lib64", "/lib64"] : []),
    "/usr/bin/true",
  ], { env: {}, timeoutMs: 5000 });
  if (result.code !== 0 || result.timedOut || result.spawnError) {
    throw new Error(`bubblewrap isolation probe failed: ${result.spawnError ?? result.stderr.trim() ?? result.code}`);
  }
  bubblewrapProbe = { key };
  return resolved;
}

async function nativeRuntimeFromPackageLauncher(launcher) {
  let target;
  try { target = await realpath(launcher); } catch { return null; }
  const suffix = `${path.sep}@openai${path.sep}codex${path.sep}bin${path.sep}codex.js`;
  if (!target.endsWith(suffix)) return null;
  const packageRoot = path.dirname(path.dirname(target));
  const platform = PLATFORM_RUNTIME[`${os.platform()}:${os.arch()}`];
  if (!platform) return null;
  const [platformPackage, triple] = platform;
  const vendor = path.join(packageRoot, "node_modules", "@openai", platformPackage.replace("@openai/", ""), "vendor", triple);
  const executable = path.join(vendor, "bin", "codex");
  if (!(await isRegularFile(executable)) || !(await isDirectory(path.join(vendor, "codex-resources")))) return null;
  return { executable, vendor };
}

async function nativeRuntimeFromBinary(candidate) {
  let target;
  try { target = await realpath(candidate); } catch { return null; }
  if (path.basename(target) !== "codex" || !(await isRegularFile(target))) return null;
  const vendor = path.dirname(path.dirname(target));
  if (!(await isDirectory(path.join(vendor, "codex-resources"))) || !(await isDirectory(path.join(vendor, "codex-path")))) return null;
  return { executable: target, vendor };
}

async function resolveCodexRuntime(codex, allowMockCodex) {
  if (allowMockCodex) {
    const script = await executableOnPath(codex);
    return { kind: "mock-node", script, node: process.execPath };
  }
  const candidates = [];
  if (process.env.CODEX_NATIVE_BIN) candidates.push(process.env.CODEX_NATIVE_BIN);
  if (process.env.CODEX_REAL_BIN) candidates.push(process.env.CODEX_REAL_BIN);
  try { candidates.push(await executableOnPath(codex)); } catch { /* reported after all candidates */ }
  for (const entry of pathEntries()) {
    const candidate = path.join(entry, "codex");
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }
  for (const candidate of candidates) {
    const native = await nativeRuntimeFromBinary(candidate) ?? await nativeRuntimeFromPackageLauncher(candidate);
    if (native) return { kind: "native", ...native };
  }
  throw new Error("could not establish a self-contained native Codex runtime; set CODEX_NATIVE_BIN to the packaged native binary");
}

async function resolveAuthFile(explicit) {
  const auth = explicit
    ?? (process.env.CODEX_HOME ? path.join(process.env.CODEX_HOME, "auth.json") : null)
    ?? (process.env.HOME ? path.join(process.env.HOME, ".codex", "auth.json") : null);
  if (!auth) throw new Error("Codex auth.json could not be located");
  let details;
  try { details = await lstat(auth); } catch { throw new Error("Codex auth.json is unavailable"); }
  if (!details.isFile() || details.isSymbolicLink()) throw new Error("Codex auth.json must be a regular, non-symlink file");
  if ((details.mode & 0o077) !== 0) throw new Error("Codex auth.json permissions must not grant group or other access");
  return path.resolve(auth);
}

function candidateEnvironmentArguments(workspaceWritable) {
  const pairs = {
    HOME: GUEST.codexHome,
    CODEX_HOME: GUEST.codexHome,
    PATH: `${GUEST.vendor}/bin:${GUEST.vendor}/codex-path:/runtime/bin:/usr/bin:/bin`,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    TMPDIR: "/tmp",
    CODEX_DISABLE_GLOBAL_BYPASS: "1",
    AI_TEAM_EVAL_WORKSPACE_MODE: workspaceWritable ? "read-write" : "read-only",
    SHELL: "/usr/bin/bash",
  };
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"]) {
    if (process.env[key]) pairs[key] = process.env[key];
  }
  return ["--clearenv", ...Object.entries(pairs).flatMap(([key, value]) => ["--setenv", key, value])];
}

/**
 * Build an outer bubblewrap boundary for an evaluated Codex process. The suite
 * root is deliberately never accepted as an input, so it cannot be mounted by
 * accident. auth.json is bind-mounted directly and is never opened or copied.
 */
export async function candidateIsolation(options) {
  const bwrap = await probeBubblewrap(options.bwrap ?? "bwrap");
  const runtime = await resolveCodexRuntime(options.codex ?? "codex", options.allowMockCodex === true);
  const fixtureRuntime = await resolveFixtureRuntime(options.fixtureNode);
  const auth = await resolveAuthFile(options.authFile);
  const candidateShell = path.join(path.dirname(fileURLToPath(import.meta.url)), "candidate-shell.mjs");
  for (const [label, target] of Object.entries({
    workspace: options.workspace,
    artifactOutput: options.finalMessageFile,
    outputSchema: options.outputSchema,
  })) {
    if (!target || !(await isRegularFile(target)) && label !== "workspace") throw new Error(`${label} isolation input is unavailable`);
  }
  if (!(await isDirectory(options.workspace))) throw new Error("workspace isolation input is not a directory");
  if (!(await isRegularFile(candidateShell))) throw new Error("candidate shell boundary is unavailable");
  if (!(await isRegularFile("/usr/bin/bash"))) throw new Error("candidate shell requires /usr/bin/bash");

  const args = baseNamespaceArguments({ unshareNetwork: false });
  args.push(
    "--dir", "/opt",
    "--dir", GUEST.vendor,
    "--dir", "/runtime",
    "--dir", "/runtime/bin",
    "--dir", "/runtime/npm",
    "--ro-bind", fixtureRuntime.npmRoot, "/runtime/npm",
    "--symlink", "../npm/bin/npm-cli.js", "/runtime/bin/npm",
    "--symlink", "../npm/bin/npx-cli.js", "/runtime/bin/npx",
  );
  if (runtime.kind === "native") {
    args.push("--ro-bind", runtime.vendor, GUEST.vendor);
  } else {
    args.push(
      "--dir", `${GUEST.vendor}/bin`,
      "--ro-bind", runtime.script, `${GUEST.vendor}/bin/mock-codex.mjs`,
    );
  }
  args.push(
    "--ro-bind", fixtureRuntime.node, GUEST.node,
    "--ro-bind", "/usr/bin/bash", GUEST.realBash,
    "--ro-bind", candidateShell, GUEST.candidateShell,
    "--ro-bind", candidateShell, "/usr/bin/bash",
  );
  args.push(
    "--dir", "/etc",
    "--dir", "/etc/ssl",
  );
  if (await isDirectory("/etc/ssl/certs")) addReadOnlyBindIfPresent(args, "/etc/ssl/certs");
  for (const file of ["/etc/resolv.conf", "/etc/hosts", "/etc/nsswitch.conf"]) {
    if (await isRegularFile(file)) addReadOnlyBindIfPresent(args, file);
  }
  args.push(
    "--dir", GUEST.codexHome,
    "--dir", GUEST.shellSnapshots,
    "--ro-bind", auth, GUEST.auth,
    "--dir", GUEST.toolHome,
    "--dir", GUEST.artifacts,
    "--bind", options.finalMessageFile, GUEST.output,
    "--dir", GUEST.control,
    "--ro-bind", options.outputSchema, GUEST.outputSchema,
    options.workspaceWritable ? "--bind" : "--ro-bind", options.workspace, GUEST.workspace,
    ...candidateEnvironmentArguments(options.workspaceWritable),
    "--chdir", GUEST.workspace,
  );
  const executable = runtime.kind === "native" ? `${GUEST.vendor}/bin/codex` : GUEST.node;
  const prefix = runtime.kind === "native" ? [] : [`${GUEST.vendor}/bin/mock-codex.mjs`];
  return {
    command: bwrap,
    arguments: [...args, executable, ...prefix, ...options.codexArguments],
    environment: {},
    guest: GUEST,
    runtimeKind: runtime.kind,
    evidence: {
      mode: "bubblewrap",
      boundaryEstablished: true,
      runtime: runtime.kind,
      auth: { present: true, bind: "read-only", copied: false },
      candidateShellAuthPath: "not-mounted",
      candidateShellBoundary: "nested-bubblewrap-mount-namespace",
      workspace: options.workspaceWritable ? "read-write" : "read-only",
      suiteMounted: false,
      hiddenEvaluationMaterialMounted: false,
      outputSchema: "read-only-control-bind",
      outputMessage: "single-file-artifact-bind",
      sessionState: "namespace-local-tmpfs-destroyed-on-exit",
      fixtureRuntime: { node: fixtureRuntime.nodeVersion, npm: fixtureRuntime.npmVersion },
      codexApiNetwork: "available",
      candidateShellNetwork: "disabled-by-codex-sandbox",
    },
  };
}

function inside(root, target) {
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`);
}

async function mapGraderArguments(assertion, workspace, suiteRoot) {
  const hiddenFiles = new Map();
  const mapped = [];
  for (let index = 1; index < assertion.argv.length; index += 1) {
    const original = assertion.argv[index];
    const expanded = original.replaceAll("{workspace}", workspace).replaceAll("{suite}", suiteRoot);
    let candidate = expanded;
    if (!path.isAbsolute(candidate)) candidate = path.resolve(suiteRoot, candidate);
    if (await isRegularFile(candidate) && inside(suiteRoot, candidate) && !inside(workspace, candidate)) {
      hiddenFiles.set(path.resolve(candidate), candidate);
      mapped.push("__HIDDEN_SCRIPT__");
      continue;
    }
    if (expanded.includes(suiteRoot)) throw new Error(`grader argument exposes suite path: ${original}`);
    if (inside(workspace, expanded)) {
      mapped.push(`${GUEST.workspace}${path.resolve(expanded).slice(path.resolve(workspace).length)}`);
      continue;
    }
    if (original.includes("{workspace}") || original.includes("{suite}")) {
      throw new Error(`grader placeholder could not be isolated: ${original}`);
    }
    mapped.push(original);
  }
  if (hiddenFiles.size > 1) throw new Error("a command grader may mount only one hidden script");
  const hiddenScript = [...hiddenFiles.keys()][0] ?? null;
  const guestHidden = hiddenScript ? `/grader/${path.basename(hiddenScript)}` : null;
  return {
    arguments: mapped.map((entry) => entry === "__HIDDEN_SCRIPT__" ? guestHidden : entry),
    hiddenScript,
    guestHidden,
  };
}

/** Build a fresh, networkless namespace for one command assertion. */
export async function graderIsolation(options) {
  const bwrap = await probeBubblewrap(options.bwrap ?? "bwrap");
  const fixtureRuntime = await resolveFixtureRuntime(options.fixtureNode);
  const executable = path.basename(options.assertion.argv[0]);
  if (executable !== "node") throw new Error(`isolated command grader executable is not allowlisted: ${options.assertion.argv[0]}`);
  const mapped = await mapGraderArguments(options.assertion, options.workspace, options.suiteRoot);
  const args = baseNamespaceArguments({ unshareNetwork: true });
  args.push(
    "--dir", "/runtime",
    "--dir", "/runtime/bin",
    "--ro-bind", fixtureRuntime.node, GUEST.node,
    "--dir", "/home",
    "--dir", GUEST.graderHome,
    "--ro-bind", options.workspace, GUEST.workspace,
  );
  if (mapped.hiddenScript) {
    args.push("--dir", "/grader", "--ro-bind", mapped.hiddenScript, mapped.guestHidden);
  }
  args.push(
    "--clearenv",
    "--setenv", "HOME", GUEST.graderHome,
    "--setenv", "PATH", "/runtime/bin:/usr/bin:/bin",
    "--setenv", "LANG", "C.UTF-8",
    "--setenv", "LC_ALL", "C.UTF-8",
    "--setenv", "CI", "1",
    "--chdir", GUEST.workspace,
    GUEST.node,
    ...mapped.arguments,
  );
  return {
    command: bwrap,
    arguments: args,
    environment: {},
    display: {
      argv: ["node", ...mapped.arguments],
      cwd: GUEST.workspace,
      hiddenScriptMounted: Boolean(mapped.hiddenScript),
      network: "unshared",
      workspace: "read-only",
    },
  };
}

async function probeCodexRuntime(bwrap, runtime) {
  if (runtime.kind !== "native") throw new Error("the production isolation probe requires a native Codex runtime");
  const args = baseNamespaceArguments({ unshareNetwork: true });
  args.push(
    "--dir", "/opt",
    "--ro-bind", runtime.vendor, GUEST.vendor,
    "--clearenv",
    "--setenv", "HOME", "/tmp",
    "--setenv", "PATH", `${GUEST.vendor}/bin:${GUEST.vendor}/codex-path:/usr/bin:/bin`,
    `${GUEST.vendor}/bin/codex`,
    "--version",
  );
  const result = await runProcess(bwrap, args, { env: {}, timeoutMs: 10000 });
  if (result.code !== 0 || result.timedOut || result.spawnError) {
    throw new Error(`isolated Codex runtime probe failed: ${result.spawnError ?? result.stderr.trim() ?? result.code}`);
  }
  return result.stdout.trim();
}

/** Capture the exact local runtime selected for a prepared evaluation. */
export async function captureRuntimeIdentity(options = {}) {
  const bwrap = await probeBubblewrap(options.bwrap ?? "bwrap");
  const bwrapExecutable = await realpath(bwrap);
  const bwrapVersionResult = await runProcess(bwrapExecutable, ["--version"], { env: {}, timeoutMs: 5000 });
  if (bwrapVersionResult.code !== 0 || bwrapVersionResult.timedOut || bwrapVersionResult.spawnError) {
    throw new Error(`bubblewrap version probe failed: ${bwrapVersionResult.spawnError ?? bwrapVersionResult.stderr.trim() ?? bwrapVersionResult.code}`);
  }
  const codexRuntime = await resolveCodexRuntime(options.codex ?? "codex", false);
  const codexVersion = await probeCodexRuntime(bwrapExecutable, codexRuntime);
  const fixtureRuntime = await resolveFixtureRuntime(options.fixtureNode);
  const npmCli = await realpath(path.join(fixtureRuntime.npmRoot, "bin", "npm-cli.js"));
  const components = {
    bubblewrap: {
      executable: bwrapExecutable,
      version: bwrapVersionResult.stdout.trim(),
      sha256: await hashRegularFile(bwrapExecutable),
    },
    codex: {
      kind: codexRuntime.kind,
      executable: codexRuntime.executable,
      version: codexVersion,
      sha256: await hashRegularFile(codexRuntime.executable),
    },
    node: {
      executable: fixtureRuntime.node,
      version: fixtureRuntime.nodeVersion,
      sha256: await hashRegularFile(fixtureRuntime.node),
    },
    npm: {
      executable: npmCli,
      version: fixtureRuntime.npmVersion,
      sha256: await hashRegularFile(npmCli),
    },
  };
  return { ...components, digest: sha256(stableStringify(components)) };
}

async function probeCandidateCommandNamespace(bwrap, codex) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-candidate-shell-probe-"));
  try {
    const workspace = path.join(root, "workspace");
    const auth = path.join(root, "auth.json");
    const output = path.join(root, "output.json");
    const schema = path.join(root, "schema.json");
    await mkdir(workspace, { recursive: true });
    await writeFile(path.join(workspace, "marker.txt"), "candidate boundary\n");
    await writeFile(path.join(workspace, "package.json"), JSON.stringify({ scripts: { test: "node -p process.versions.node" } }));
    await writeFile(auth, "{}\n", { mode: 0o600 });
    await writeFile(output, "");
    await writeFile(schema, "{}\n");
    const isolated = await candidateIsolation({
      bwrap,
      codex,
      authFile: auth,
      workspace,
      workspaceWritable: true,
      finalMessageFile: output,
      outputSchema: schema,
      codexArguments: [
        "sandbox",
        "-c", "sandbox_mode=\"workspace-write\"",
        "-c", "sandbox_workspace_write.network_access=false",
        "/usr/bin/bash", "-c",
        `test ! -e /codex-home/auth.json && test -d /codex-home/shell_snapshots && test ! -e /control && test ! -e /artifacts && test -r /workspace/marker.txt && test "$(node -p 'process.versions.node.split(\".\")[0]')" = ${FIXTURE_NODE_MAJOR} && npm --version > /tmp/npm-version && npm test --silent > /tmp/npm-test-output && grep -q '^${FIXTURE_NODE_MAJOR}[.]' /tmp/npm-test-output && touch /workspace/probe-write && printf candidate-shell-ready`,
      ],
    });
    const result = await runProcess(isolated.command, isolated.arguments, { env: isolated.environment, timeoutMs: 20000 });
    if (result.code !== 0 || result.timedOut || result.spawnError || result.stdout !== "candidate-shell-ready") {
      throw new Error(`candidate command namespace probe failed: ${result.spawnError ?? result.stderr.trim() ?? result.code}`);
    }
    await access(path.join(workspace, "probe-write"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function probeGraderNamespace(bwrap) {
  const root = await mkdtemp(path.join(os.tmpdir(), "ai-team-isolation-probe-"));
  try {
    const suiteRoot = path.join(root, "suite");
    const workspace = path.join(root, "workspace");
    const hidden = path.join(suiteRoot, "hidden", "probe.mjs");
    await mkdir(path.dirname(hidden), { recursive: true });
    await mkdir(workspace, { recursive: true });
    await writeFile(path.join(workspace, "marker.txt"), "isolated\n");
    await writeFile(hidden, [
      "import { existsSync, readFileSync, readdirSync } from 'node:fs';",
      "if (process.env.HOME !== '/home/grader') process.exit(11);",
      "if (readdirSync('/').includes('suite')) process.exit(12);",
      "if (existsSync('/mnt') || existsSync('/home/operator')) process.exit(13);",
      "if (readFileSync('/workspace/marker.txt', 'utf8') !== 'isolated\\n') process.exit(14);",
      "process.stdout.write('grader isolation ready');",
      "",
    ].join("\n"));
    const isolated = await graderIsolation({
      bwrap,
      assertion: { argv: ["node", "{suite}/hidden/probe.mjs"] },
      workspace,
      suiteRoot,
    });
    const result = await runProcess(isolated.command, isolated.arguments, { env: isolated.environment, timeoutMs: 10000 });
    if (result.code !== 0 || result.timedOut || result.spawnError || result.stdout !== "grader isolation ready") {
      throw new Error(`grader namespace probe failed: ${result.spawnError ?? result.stderr.trim() ?? result.code}`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/**
 * Non-billed readiness probe. Structural isolation is reported separately from
 * auth presence so static validation does not require credentials. auth.json is
 * checked only with lstat metadata; the file is never opened or copied.
 */
export async function validateIsolationEnvironment(options = {}) {
  const structural = {
    pass: false,
    bubblewrap: { pass: false },
    codexRuntime: { pass: false },
    fixtureRuntime: { pass: false },
    graderNamespace: { pass: false },
    candidateCommandNamespace: { pass: false },
    errors: [],
  };
  let bwrap;
  try {
    bwrap = await probeBubblewrap(options.bwrap ?? "bwrap");
    structural.bubblewrap = { pass: true, executable: bwrap };
  } catch (error) {
    structural.errors.push(error.message);
  }
  try {
    const runtime = await resolveFixtureRuntime(options.fixtureNode);
    structural.fixtureRuntime = {
      pass: true,
      node: runtime.nodeVersion,
      nodeMajor: runtime.nodeMajor,
      npm: runtime.npmVersion,
    };
  } catch (error) {
    structural.errors.push(error.message);
  }
  if (bwrap) {
    try {
      const runtime = await resolveCodexRuntime(options.codex ?? "codex", false);
      const version = await probeCodexRuntime(bwrap, runtime);
      structural.codexRuntime = { pass: true, kind: runtime.kind, version };
    } catch (error) {
      structural.errors.push(error.message);
    }
    try {
      await probeGraderNamespace(bwrap);
      structural.graderNamespace = { pass: true, network: "unshared", workspace: "read-only", home: "empty" };
    } catch (error) {
      structural.errors.push(error.message);
    }
    try {
      await probeCandidateCommandNamespace(bwrap, options.codex ?? "codex");
      structural.candidateCommandNamespace = { pass: true, authPath: "not-mounted", controlPaths: "not-mounted", workspace: "bounded", network: "codex-sandbox-disabled" };
    } catch (error) {
      structural.errors.push(error.message);
    }
  }
  structural.pass = structural.bubblewrap.pass && structural.codexRuntime.pass && structural.fixtureRuntime.pass && structural.graderNamespace.pass && structural.candidateCommandNamespace.pass;

  const authentication = { required: options.requireAuth === true, present: false, metadataValid: false };
  try {
    await resolveAuthFile(options.authFile);
    authentication.present = true;
    authentication.metadataValid = true;
  } catch (error) {
    authentication.error = error.message;
  }
  return {
    pass: structural.pass && (!authentication.required || authentication.metadataValid),
    structural,
    authentication,
  };
}

export const isolationGuestPaths = GUEST;
