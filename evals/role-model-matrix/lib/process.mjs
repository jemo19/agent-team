import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const DEFAULT_CAPTURE_LIMIT = 1024 * 1024;

export function codexEnvironment(extra = {}) {
  const allowed = [
    "HOME",
    "CODEX_HOME",
    "PATH",
    "LANG",
    "LC_ALL",
    "TMPDIR",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "OPENAI_API_KEY",
  ];
  const environment = {};
  for (const key of allowed) if (process.env[key] !== undefined) environment[key] = process.env[key];
  environment.CODEX_DISABLE_GLOBAL_BYPASS = "1";
  return { ...environment, ...extra };
}

export function toolEnvironment(home, extra = {}) {
  const environment = {
    PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: home,
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL ?? "C.UTF-8",
    CI: "1",
  };
  for (const key of ["NVM_DIR", "AI_TEAM_EVAL_NODE_BIN"]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  return { ...environment, ...extra };
}

export function terminateProcessTree(child, signal = "SIGTERM") {
  if (!child.pid) return;
  try {
    if (os.platform() !== "win32") process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    try { child.kill(signal); } catch { /* already exited */ }
  }
}

export function runProcess(command, args, options = {}) {
  const startedAt = Date.now();
  const captureLimit = options.captureLimit ?? DEFAULT_CAPTURE_LIMIT;
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let spawnError = null;
    let settled = false;
    let killTimer = null;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: os.platform() !== "win32",
      shell: false,
      stdio: [options.stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });

    const append = (current, chunk) => {
      if (current.length >= captureLimit) return [current, true];
      const next = current + chunk.toString("utf8");
      if (next.length <= captureLimit) return [next, false];
      return [next.slice(0, captureLimit), true];
    };

    child.stdout.on("data", (chunk) => {
      [stdout, stdoutTruncated] = append(stdout, chunk);
      options.onStdout?.(chunk);
    });
    child.stderr.on("data", (chunk) => {
      [stderr, stderrTruncated] = append(stderr, chunk);
      options.onStderr?.(chunk);
    });
    child.on("error", (error) => { spawnError = error; });

    const timeout = options.timeoutMs ? setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child, "SIGTERM");
      killTimer = setTimeout(() => terminateProcessTree(child, "SIGKILL"), options.killGraceMs ?? 5000);
      killTimer.unref();
    }, options.timeoutMs) : null;
    timeout?.unref();

    const abort = () => {
      terminateProcessTree(child, "SIGTERM");
      killTimer ??= setTimeout(() => terminateProcessTree(child, "SIGKILL"), options.killGraceMs ?? 5000);
      killTimer.unref();
    };
    options.signal?.addEventListener("abort", abort, { once: true });

    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (killTimer) clearTimeout(killTimer);
      options.signal?.removeEventListener("abort", abort);
      resolve({
        code,
        signal,
        timedOut,
        spawnError: spawnError?.message ?? null,
        durationMs: Date.now() - startedAt,
        stdout,
        stderr,
        stdoutTruncated,
        stderrTruncated,
      });
    });

    if (options.stdin !== undefined) {
      child.stdin.on("error", () => {});
      child.stdin.end(options.stdin);
    }
  });
}

export function tomlString(value) {
  return JSON.stringify(String(value));
}

export function safeToolCwd(workspace, relative = ".") {
  const root = path.resolve(workspace);
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error(`command cwd escapes workspace: ${relative}`);
  return target;
}
