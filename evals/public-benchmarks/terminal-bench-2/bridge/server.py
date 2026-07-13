"""A deliberately small JSONL RPC bridge to ``BaseEnvironment.exec``.

The socket is reachable by the host-side Codex sandbox.  It does not expose
Harbor's upload/download, service, user, or environment APIs.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any


class BridgeRequestError(ValueError):
    """A request failed the bridge's fail-closed validation."""


@dataclass(frozen=True)
class BridgeLimits:
    request_bytes: int = 256 * 1024
    output_bytes: int = 2 * 1024 * 1024
    timeout_sec: int = 300


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()


REDACTED_HOST_PATH = "[REDACTED_HOST_PATH]"
_HOST_PATH_PATTERNS = tuple(re.compile(pattern, re.IGNORECASE) for pattern in (
    # Windows paths and WSL drive mounts. Stop at mount-option separators.
    r"(?<![A-Za-z0-9])[A-Za-z]:\\[^\s,;\"']*",
    r"(?<![A-Za-z0-9])(?:[A-Za-z]:)(?=\s|$|[,;])",
    r"/mnt/[a-z](?:/[^\s,;\"']*)?",
    # Docker Desktop/engine backing paths and overlay option values.
    r"/run/desktop/mnt/host(?:/[^\s,;\"']*)?",
    r"/var/lib/docker(?:/[^\s,;\"']*)?",
    r"(?<=lowerdir=)[^\s,]+",
    r"(?<=upperdir=)[^\s,]+",
    r"(?<=workdir=)[^\s,]+",
    # Host user homes must never cross into a candidate.
    r"/home/[A-Za-z0-9._-]+(?:/[^\s,;\"']*)?",
    r"/logs/agent/host-codex(?:/[^\s,;\"']*)?",
    r"/run/host-codex(?:/[^\s,;\"']*)?",
))


def redact_host_paths(value: str) -> tuple[str, int]:
    """Replace host path metadata without changing normal task-container paths."""
    total = 0
    for pattern in _HOST_PATH_PATTERNS:
        value, count = pattern.subn(REDACTED_HOST_PATH, value)
        total += count
    return value, total


def _validate_request(raw: Any, limits: BridgeLimits) -> dict[str, Any]:
    if not isinstance(raw, dict) or set(raw) != {"id", "argv", "virtual_cwd", "timeout_sec"}:
        raise BridgeRequestError("request must contain exactly id, argv, virtual_cwd, timeout_sec")
    request_id = raw["id"]
    if not isinstance(request_id, (str, int)) or isinstance(request_id, bool):
        raise BridgeRequestError("id must be a string or integer")
    argv = raw["argv"]
    if not isinstance(argv, list) or len(argv) != 2 or argv[0] not in ("-c", "-lc"):
        raise BridgeRequestError("only bash -c or bash -lc is supported")
    if not isinstance(argv[1], str) or "\x00" in argv[1]:
        raise BridgeRequestError("command must be a NUL-free string")
    cwd = raw["virtual_cwd"]
    if not isinstance(cwd, str) or not cwd.startswith("/workspace"):
        raise BridgeRequestError("virtual_cwd must be /workspace or a descendant")
    path = PurePosixPath(cwd)
    if ".." in path.parts or path != PurePosixPath("/workspace") and PurePosixPath("/workspace") not in path.parents:
        raise BridgeRequestError("virtual_cwd escapes /workspace")
    timeout = raw["timeout_sec"]
    if not isinstance(timeout, (int, float)) or isinstance(timeout, bool) or timeout <= 0:
        raise BridgeRequestError("timeout_sec must be positive")
    return {"id": request_id, "shell_flag": argv[0], "command": argv[1], "cwd": path,
            "timeout": min(float(timeout), limits.timeout_sec)}


class EnvironmentExecBridge:
    def __init__(self, environment: Any, socket_path: Path, audit_path: Path, *, container_root: str, limits: BridgeLimits | None = None):
        self.environment = environment
        self.socket_path = Path(socket_path)
        self.audit_path = Path(audit_path)
        self.container_root = PurePosixPath(container_root)
        if not self.container_root.is_absolute() or ".." in self.container_root.parts:
            raise ValueError("container_root must be an absolute normalized path")
        self.limits = limits or BridgeLimits()
        self._server: asyncio.AbstractServer | None = None
        self._sequence = 0

    async def __aenter__(self) -> "EnvironmentExecBridge":
        self.socket_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.audit_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.audit_path.touch(mode=0o600, exist_ok=True)
        try:
            self.socket_path.unlink()
        except FileNotFoundError:
            pass
        self._server = await asyncio.start_unix_server(self._handle, path=self.socket_path)
        os.chmod(self.socket_path, 0o600)
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._server is not None:
            self._server.close()
            await self._server.wait_closed()
        try:
            self.socket_path.unlink()
        except FileNotFoundError:
            pass

    def _audit(self, event: dict[str, Any]) -> None:
        self._sequence += 1
        record = {"sequence": self._sequence, "timestamp_unix": time.time(), **event}
        with self.audit_path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(record, sort_keys=True) + "\n")

    async def _handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        request_id: Any = None
        try:
            data = await reader.readline()
            if len(data) > self.limits.request_bytes or not data.endswith(b"\n"):
                raise BridgeRequestError("request exceeds size limit or is not JSONL")
            raw = json.loads(data)
            request_id = raw.get("id") if isinstance(raw, dict) else None
            request = _validate_request(raw, self.limits)
            relative = request["cwd"].relative_to(PurePosixPath("/workspace"))
            cwd = self.container_root / relative
            import shlex
            command = f"bash {request['shell_flag']} {shlex.quote(request['command'])}"
            started = time.monotonic()
            result = await asyncio.wait_for(
                self.environment.exec(command=command, cwd=str(cwd),
                                      timeout_sec=max(1, math.ceil(request["timeout"]))),
                timeout=request["timeout"],
            )
            raw_stdout = (result.stdout or "").encode("utf-8", errors="replace")
            raw_stderr = (result.stderr or "").encode("utf-8", errors="replace")
            clean_stdout, stdout_redactions = redact_host_paths(raw_stdout.decode("utf-8", errors="replace"))
            clean_stderr, stderr_redactions = redact_host_paths(raw_stderr.decode("utf-8", errors="replace"))
            stdout = clean_stdout.encode("utf-8")[: self.limits.output_bytes]
            stderr = clean_stderr.encode("utf-8")[: self.limits.output_bytes]
            response = {
                "id": request["id"], "ok": True, "return_code": int(result.return_code),
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
                "truncated": len(clean_stdout.encode()) > len(stdout) or len(clean_stderr.encode()) > len(stderr),
            }
            self._audit({"id": request["id"], "status": "ok", "command_sha256": _digest(request["command"]), "cwd": str(request["cwd"]), "return_code": response["return_code"], "elapsed_ms": round((time.monotonic() - started) * 1000), "stdout_bytes": len(stdout), "stderr_bytes": len(stderr), "stdout_raw_sha256": hashlib.sha256(raw_stdout).hexdigest(), "stderr_raw_sha256": hashlib.sha256(raw_stderr).hexdigest(), "stdout_redacted_sha256": hashlib.sha256(stdout).hexdigest(), "stderr_redacted_sha256": hashlib.sha256(stderr).hexdigest(), "stdout_redactions": stdout_redactions, "stderr_redactions": stderr_redactions, "truncated": response["truncated"]})
        except Exception as exc:
            response = {"id": request_id, "ok": False, "error": type(exc).__name__,
                        "message": "request rejected or execution failed"}
            self._audit({"id": request_id, "status": "rejected", "error": type(exc).__name__, "message_sha256": _digest(str(exc))})
        writer.write((json.dumps(response, sort_keys=True) + "\n").encode())
        try:
            await writer.drain()
        finally:
            writer.close()
            await writer.wait_closed()
