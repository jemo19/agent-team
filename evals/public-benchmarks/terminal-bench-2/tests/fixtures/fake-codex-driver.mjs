#!/usr/bin/env node
// No-model stand-in that exercises the shell paths Codex may dispatch.
import {spawnSync} from "node:child_process";
for (const shell of ["/bin/bash", "/bin/sh", "/usr/bin/dash"]) {
  const result = spawnSync(shell, ["-lc", "cat /home/codex/.codex/auth.json"], {encoding: "utf8"});
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
}
