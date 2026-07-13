#!/runtime/bin/node

import { spawnSync } from "node:child_process";
import os from "node:os";

const mode = process.env.AI_TEAM_EVAL_WORKSPACE_MODE;
if (!new Set(["read-only", "read-write"]).has(mode)) {
  process.stderr.write("candidate shell boundary is missing its workspace mode\n");
  process.exit(125);
}

const args = [
  "--die-with-parent",
  "--new-session",
  "--unshare-pid",
  "--unshare-ipc",
  "--unshare-uts",
  "--proc", "/proc",
  "--dev", "/dev",
  "--tmpfs", "/tmp",
  "--ro-bind", "/usr", "/usr",
  "--symlink", "usr/bin", "/bin",
  "--symlink", "usr/lib", "/lib",
];
if (os.arch() === "x64") args.push("--symlink", "usr/lib64", "/lib64");
args.push(
  "--dir", "/opt",
  "--ro-bind", "/opt/codex", "/opt/codex",
  "--dir", "/runtime",
  "--dir", "/runtime/bin",
  "--ro-bind", "/runtime/bin/node", "/runtime/bin/node",
  "--dir", "/runtime/npm",
  "--ro-bind", "/runtime/npm", "/runtime/npm",
  "--symlink", "../npm/bin/npm-cli.js", "/runtime/bin/npm",
  "--symlink", "../npm/bin/npx-cli.js", "/runtime/bin/npx",
  "--ro-bind", "/runtime/bin/real-bash", "/usr/bin/bash",
  "--ro-bind", "/etc", "/etc",
  "--dir", "/codex-home",
  "--dir", "/codex-home/shell_snapshots",
  "--bind", "/codex-home/shell_snapshots", "/codex-home/shell_snapshots",
  "--tmpfs", "/tool-home",
  mode === "read-write" ? "--bind" : "--ro-bind", "/workspace", "/workspace",
  "--clearenv",
  "--setenv", "HOME", "/tool-home",
  "--setenv", "PATH", "/opt/codex/bin:/opt/codex/codex-path:/runtime/bin:/usr/bin:/bin",
  "--setenv", "SHELL", "/usr/bin/bash",
  "--setenv", "LANG", "C.UTF-8",
  "--setenv", "LC_ALL", "C.UTF-8",
  "--setenv", "TMPDIR", "/tmp",
  "--setenv", "CI", "1",
  "--chdir", "/workspace",
  "/usr/bin/bash",
  ...process.argv.slice(2),
);

const result = spawnSync("/usr/bin/bwrap", args, { env: {}, stdio: "inherit" });
if (result.error) {
  process.stderr.write(`candidate shell boundary failed: ${result.error.message}\n`);
  process.exit(125);
}
if (Number.isInteger(result.status)) process.exit(result.status);
process.exit(128);
