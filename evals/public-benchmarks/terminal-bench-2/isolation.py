"""Build the fail-closed bwrap command for host-side Codex."""

from __future__ import annotations

import os
import shutil
from pathlib import Path


class IsolationUnavailable(RuntimeError):
    pass


def build_bwrap_command(*, codex_js: Path, node: Path, candidate_shell: Path,
                        codex_home: Path, run_dir: Path, socket_dir: Path, model: str,
                        reasoning_effort: str | None, command_timeout_sec: int = 300) -> list[str]:
    bwrap = shutil.which("bwrap")
    if not bwrap:
        raise IsolationUnavailable("bubblewrap is required; no unsandboxed fallback is allowed")
    auth = codex_home / "auth.json"
    if not auth.is_file():
        raise IsolationUnavailable("Codex subscription auth.json was not found")
    for path in (codex_js, node, candidate_shell, socket_dir):
        if not path.exists():
            raise IsolationUnavailable(f"required path is missing: {path}")
    try:
        node_root = node.resolve().parents[1]
        codex_relative = codex_js.resolve().relative_to(node_root)
    except (IndexError, ValueError) as exc:
        raise IsolationUnavailable("Codex and Node must share one bindable runtime root") from exc
    sandbox_home = run_dir / "sandbox-home"
    sandbox_codex = sandbox_home / ".codex"
    sessions = run_dir / "sessions"
    workspace = run_dir / "workspace"
    sandbox_codex.mkdir(parents=True, exist_ok=True, mode=0o700)
    sessions.mkdir(parents=True, exist_ok=True, mode=0o700)
    workspace.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Only the credential file crosses into the outer namespace, read-only.
    # Generated commands cannot access it because /bin/bash is the RPC surrogate.
    cmd = [bwrap, "--die-with-parent", "--new-session", "--unshare-pid", "--unshare-ipc",
           "--unshare-uts", "--unshare-cgroup", "--proc", "/proc", "--dev", "/dev",
           "--ro-bind", "/usr", "/usr", "--symlink", "usr/bin", "/bin",
           "--ro-bind", "/lib", "/lib"]
    if Path("/lib64").exists():
        cmd.extend(["--ro-bind", "/lib64", "/lib64"])
    cmd.extend(["--dir", "/etc", "--dir", "/etc/ssl"])
    if Path("/etc/ssl/certs").exists():
        cmd.extend(["--ro-bind", "/etc/ssl/certs", "/etc/ssl/certs"])
    for source in ("/etc/resolv.conf", "/etc/hosts", "/etc/nsswitch.conf"):
        path = Path(source)
        if path.exists():
            cmd.extend(["--ro-bind", str(path.resolve()), source])
    cmd.extend(["--tmpfs", "/tmp", "--tmpfs", "/home",
           "--dir", "/home/codex", "--dir", "/home/codex/.codex", "--dir", "/opt",
           "--ro-bind", str(node_root), "/opt/node",
           "--ro-bind", str(auth), "/home/codex/.codex/auth.json",
           "--bind", str(sessions), "/home/codex/.codex/sessions",
           "--bind", str(workspace), "/workspace", "--bind", str(run_dir), "/run/host-codex",
           "--bind", str(socket_dir), "/run/host-codex-bridge",
           # Mask every standard POSIX shell target. Codex may not select an
           # alternate real shell to read the outer namespace.
           "--ro-bind", str(candidate_shell), "/usr/bin/bash",
           # /usr/bin/sh is a symlink to dash on the supported host; masking
           # the resolved target masks both /usr/bin/sh and /bin/sh.
           "--ro-bind", str(candidate_shell), "/usr/bin/dash", "--chdir", "/workspace",
           "--setenv", "HOME", "/home/codex", "--setenv", "CODEX_HOME", "/home/codex/.codex",
           "--setenv", "PATH", "/opt/node/bin:/usr/bin:/bin",
           "--setenv", "HARBOR_CODEX_BRIDGE_SOCKET", "/run/host-codex-bridge/bridge.sock",
           "--setenv", "HARBOR_CODEX_COMMAND_TIMEOUT", str(command_timeout_sec),
           "--setenv", "SHELL", "/bin/bash", "/opt/node/bin/node", f"/opt/node/{codex_relative}", "exec", "-", "--json",
           "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox",
           "--ignore-user-config", "--ignore-rules", "-C", "/workspace",
           "-o", "/run/host-codex/final-message.txt"])
    if model:
        cmd.extend(["--model", model])
    if reasoning_effort:
        cmd.extend(["-c", f'model_reasoning_effort="{reasoning_effort}"'])
    return cmd
