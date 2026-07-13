"""Harbor 0.18 custom agent that keeps Codex subscription auth host-side."""

from __future__ import annotations

import asyncio
import json
import hashlib
import os
import shutil
import tempfile
import stat
import shlex
from pathlib import Path
from typing import Any

from harbor.agents.base import BaseAgent
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

from bridge.server import EnvironmentExecBridge
from isolation import build_bwrap_command


class WorkspaceSyncError(RuntimeError):
    pass


async def sync_workspace(environment: BaseEnvironment, workspace: Path, container_root: str,
                         manifest_path: Path, *, max_files: int = 1000,
                         max_file_bytes: int = 2 * 1024 * 1024,
                         max_total_bytes: int = 16 * 1024 * 1024) -> dict[str, int]:
    """Upload a validated workspace tree without exposing any other host path."""
    workspace = workspace.resolve(strict=True)
    candidates: list[tuple[Path, Path, int, str]] = []
    total = 0
    def reject(relative: Path | None, reason: str) -> None:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        record = {"path": relative.as_posix() if relative is not None else None,
                  "status": "rejected", "reason": reason}
        with manifest_path.open("a", encoding="utf-8") as manifest:
            manifest.write(json.dumps(record, sort_keys=True) + "\n")
        raise WorkspaceSyncError(reason)
    for path in sorted(workspace.rglob("*")):
        relative = path.relative_to(workspace)
        if path.is_symlink():
            reject(relative, "workspace symlink is forbidden")
        mode = path.lstat().st_mode
        if stat.S_ISDIR(mode):
            continue
        if not stat.S_ISREG(mode):
            reject(relative, "non-regular workspace entry is forbidden")
        lower_name = relative.name.lower()
        private_names = {"auth.json", "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"}
        private_suffixes = {".pem", ".key", ".p12", ".pfx", ".jks", ".kdbx"}
        if (any(part in {".codex", ".ssh", ".gnupg"} for part in relative.parts)
                or lower_name.startswith(".env") or lower_name in private_names
                or relative.suffix.lower() in private_suffixes):
            reject(relative, "credential-like workspace path is forbidden")
        resolved = path.resolve(strict=True)
        if workspace not in resolved.parents:
            reject(relative, "workspace entry escapes root")
        size = resolved.stat().st_size
        if size > max_file_bytes:
            reject(relative, "workspace file exceeds per-file cap")
        total += size
        if total > max_total_bytes:
            reject(relative, "workspace exceeds total byte cap")
        if len(candidates) + 1 > max_files:
            reject(relative, "workspace exceeds file-count cap")
        digest = hashlib.sha256(resolved.read_bytes()).hexdigest()
        candidates.append((resolved, relative, size, digest))
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with manifest_path.open("w", encoding="utf-8") as manifest:
        for source, relative, size, digest in candidates:
            target = str(Path(container_root) / relative)
            record = {"path": relative.as_posix(), "sha256": digest, "bytes": size, "status": "pending"}
            try:
                parent = str(Path(target).parent)
                result = await environment.exec(command=f"mkdir -p -- {shlex.quote(parent)}")
                if result.return_code != 0:
                    raise WorkspaceSyncError(f"remote parent creation failed: {relative}")
                await environment.upload_file(source_path=source, target_path=target)
                record["status"] = "uploaded"
            except Exception as exc:
                record["status"] = "failed"
                record["error_class"] = type(exc).__name__
                manifest.write(json.dumps(record, sort_keys=True) + "\n"); manifest.flush()
                raise
            manifest.write(json.dumps(record, sort_keys=True) + "\n")
    return {"files": len(candidates), "bytes": total}


class HostCodexBridge(BaseAgent):
    SUPPORTS_ATIF = False

    MODEL_EFFORTS = {
        "gpt-5.6-sol": {"low", "medium", "high", "xhigh", "max", "ultra"},
        "gpt-5.6-terra": {"low", "medium", "high", "xhigh", "max", "ultra"},
        "gpt-5.6-luna": {"low", "medium", "high", "xhigh", "max"},
    }

    def __init__(self, logs_dir: Path, model_name: str, logger: Any = None,
                 mcp_servers: list[Any] | None = None, skills_dir: str | None = None,
                 extra_env: dict[str, str] | None = None, *, reasoning_effort: str = "high",
                 command_timeout_sec: int = 300, overall_timeout_sec: int = 3600,
                 codex_home: str | None = None):
        if model_name not in self.MODEL_EFFORTS:
            raise ValueError(f"model_name must be one of {sorted(self.MODEL_EFFORTS)}")
        if reasoning_effort not in self.MODEL_EFFORTS[model_name]:
            raise ValueError(f"reasoning effort {reasoning_effort!r} is unsupported for {model_name}")
        if extra_env:
            raise ValueError("extra_env is forbidden; the sandbox uses a strict environment allowlist")
        super().__init__(logs_dir=logs_dir, model_name=model_name, logger=logger,
                         mcp_servers=mcp_servers, skills_dir=skills_dir)
        self.reasoning_effort = reasoning_effort
        self.command_timeout_sec = command_timeout_sec
        self.overall_timeout_sec = overall_timeout_sec
        self.codex_home = Path(codex_home or os.environ.get("CODEX_HOME", Path.home() / ".codex"))
        self._version: str | None = None

    @staticmethod
    def name() -> str:
        return "host-codex-bridge"

    def version(self) -> str | None:
        return self._version

    async def setup(self, environment: BaseEnvironment) -> None:
        # Probe only the task's default working directory. No agent or credential
        # artifact is uploaded to the task environment.
        result = await environment.exec(command="pwd")
        if result.return_code != 0 or not (result.stdout or "").strip().startswith("/"):
            raise RuntimeError("unable to determine task-container working directory")
        self._container_root = (result.stdout or "").strip().splitlines()[-1]
        codex = shutil.which("codex")
        node = shutil.which("node")
        if not codex or not node:
            raise RuntimeError("host Codex CLI and Node are required; no built-in Harbor Codex fallback")
        runtime_codex = shutil.which("codex", path=str(Path(node).parent))
        if not runtime_codex:
            raise RuntimeError("Codex must be installed in the selected Node runtime")
        self._node = Path(node).resolve()
        self._codex_js = Path(runtime_codex).resolve()
        proc = await asyncio.create_subprocess_exec(
            codex, "--version", stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE, cwd=str(self.logs_dir),
        )
        stdout, _ = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError("host Codex version probe failed")
        self._version = stdout.decode(errors="replace").strip()
        login = await asyncio.create_subprocess_exec(
            codex, "login", "status",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=self._codex_environment(),
            cwd=str(self.logs_dir),
        )
        login_output, _ = await login.communicate()
        login_text = login_output.decode(errors="replace").strip()
        if login.returncode != 0 or "Logged in using ChatGPT" not in login_text:
            safe_status = login_text[:200].replace(str(self.codex_home), "<CODEX_HOME>")
            raise RuntimeError(
                f"host Codex is not authenticated through the ChatGPT subscription: {safe_status or 'no status output'}"
            )

    def _codex_environment(self) -> dict[str, str]:
        """Return a minimal host environment with every API-key route removed."""
        allowed = {
            key: value for key, value in os.environ.items()
            if key in {
                "PATH", "LANG", "LC_ALL", "TERM", "TZ", "SSL_CERT_FILE", "SSL_CERT_DIR",
                "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
            }
        }
        allowed["HOME"] = str(Path.home())
        allowed["CODEX_HOME"] = str(self.codex_home)
        return allowed

    async def run(self, instruction: str, environment: BaseEnvironment, context: AgentContext) -> None:
        run_dir = self.logs_dir / "host-codex"
        run_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        (run_dir / "workspace").mkdir(parents=True, exist_ok=True, mode=0o700)
        instruction_path = run_dir / "instruction.txt"
        instruction_path.write_text(instruction, encoding="utf-8")
        socket_dir = Path(tempfile.mkdtemp(prefix="hcb-", dir="/tmp"))
        os.chmod(socket_dir, 0o700)
        socket_path = socket_dir / "bridge.sock"
        audit_path = self.logs_dir / "bridge-audit.jsonl"
        events_path = self.logs_dir / "codex-events.jsonl"
        final_path = run_dir / "final-message.txt"
        sync_manifest_path = self.logs_dir / "workspace-sync.jsonl"
        base = Path(__file__).resolve().parents[1]
        codex = Path(shutil.which("codex") or "")
        node = Path(shutil.which("node") or "")
        from bridge.server import BridgeLimits
        status = "starting"
        argv_digest = None
        metadata = {"model": self.model_name, "reasoning_effort": self.reasoning_effort,
                    "codex_version": self._version, "bridge_version": "0.2.0",
                    "artifacts": ["bridge-audit.jsonl", "codex-events.jsonl", "final-message.txt", "host-codex/sessions"]}
        context.metadata = {"host_codex_bridge": metadata}
        try:
          async with EnvironmentExecBridge(environment, socket_path, audit_path, container_root=self._container_root,
                                         limits=BridgeLimits(timeout_sec=self.command_timeout_sec)):
            command = build_bwrap_command(codex_js=self._codex_js, node=self._node,
                                          candidate_shell=base / "bridge/candidate-shell.mjs",
                                          codex_home=self.codex_home, run_dir=run_dir, socket_dir=socket_dir,
                                          model=self.model_name,
                                          reasoning_effort=self.reasoning_effort,
                                          command_timeout_sec=self.command_timeout_sec)
            argv_digest = hashlib.sha256("\0".join(map(str, command)).encode()).hexdigest()
            with instruction_path.open("rb") as stdin, events_path.open("wb") as stdout:
                proc = await asyncio.create_subprocess_exec(
                    *command,
                    stdin=stdin,
                    stdout=stdout,
                    stderr=asyncio.subprocess.STDOUT,
                    env=self._codex_environment(),
                    cwd=str(run_dir),
                )
                try:
                    return_code = await asyncio.wait_for(proc.wait(), timeout=self.overall_timeout_sec)
                except TimeoutError:
                    proc.terminate()
                    try:
                        await asyncio.wait_for(proc.wait(), timeout=10)
                    except TimeoutError:
                        proc.kill(); await proc.wait()
                    raise RuntimeError("host Codex exceeded the overall trial timeout")
          sync_result = await sync_workspace(environment, run_dir / "workspace",
                                             self._container_root, sync_manifest_path)
          metadata["workspace_sync"] = sync_result
          status = "ok" if return_code == 0 else "failed"
        except BaseException as exc:
          status = "timeout" if "timeout" in str(exc).lower() else "failed"
          metadata["failure_class"] = type(exc).__name__
          raise
        finally:
          socket_was_removed = not socket_path.exists()
          shutil.rmtree(socket_dir, ignore_errors=True)
          metadata.update({"status": status, "argv_sha256": argv_digest,
                           "socket_removed": socket_was_removed,
                           "socket_dir_removed": not socket_dir.exists(),
                           "artifact_presence": {
                               "bridge-audit.jsonl": audit_path.exists(),
                               "codex-events.jsonl": events_path.exists(),
                               "final-message.txt": final_path.exists(),
                               "sessions": (run_dir / "sessions").exists(),
                               "workspace-sync.jsonl": sync_manifest_path.exists(),
                           }})
        # Copy the final response from the host sandbox into Harbor's host logs.
        # Task upload is limited to the validated workspace sync above.
        if final_path.exists():
            (self.logs_dir / "final-message.txt").write_bytes(final_path.read_bytes())
        metadata["return_code"] = return_code
        if return_code != 0:
            metadata["failure_class"] = "CodexNonZeroExit"
            raise RuntimeError(f"host Codex exited with status {return_code}")
