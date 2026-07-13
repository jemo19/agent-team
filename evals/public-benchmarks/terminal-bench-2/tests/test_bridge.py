from __future__ import annotations

import asyncio
import json
import os
import socket
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from bridge.server import BridgeLimits, EnvironmentExecBridge, REDACTED_HOST_PATH, redact_host_paths
from isolation import IsolationUnavailable, build_bwrap_command


class FakeEnvironment:
    def __init__(self): self.calls = []
    async def exec(self, **kwargs):
        assert set(kwargs) <= {"command", "cwd", "timeout_sec"}
        self.calls.append(kwargs)
        command = kwargs["command"]
        if "sleep-test" in command: await asyncio.sleep(0.05)
        return SimpleNamespace(stdout="x" * 20, stderr="err", return_code=7)
    def __getattr__(self, name):
        if name in {"upload_file", "download_file", "start", "stop"}: raise AssertionError(f"forbidden API: {name}")
        raise AttributeError(name)


async def rpc(path, payload):
    reader, writer = await asyncio.open_unix_connection(path)
    writer.write(json.dumps(payload).encode() + b"\n"); await writer.drain(); writer.write_eof()
    response = json.loads(await reader.readline()); writer.close(); await writer.wait_closed(); return response


@pytest.mark.asyncio
async def test_command_roundtrip_uses_only_default_exec(tmp_path):
    env = FakeEnvironment(); sock = tmp_path / "b.sock"
    async with EnvironmentExecBridge(env, sock, tmp_path / "audit.jsonl", container_root="/root/task", limits=BridgeLimits(output_bytes=8)):
        out = await rpc(sock, {"id":"a", "argv":["-lc","printf ok"], "virtual_cwd":"/workspace/sub", "timeout_sec":1})
    assert out == {"id":"a", "ok":True, "return_code":7, "stdout":"xxxxxxxx", "stderr":"err", "truncated":True}
    assert env.calls == [{"command": "bash -lc 'printf ok'", "cwd": "/root/task/sub", "timeout_sec": 1}]
    audit = json.loads((tmp_path / "audit.jsonl").read_text())
    assert audit["sequence"] == 1 and audit["command_sha256"]
    assert audit["stdout_raw_sha256"] and audit["stderr_raw_sha256"]
    assert audit["stdout_redacted_sha256"] and audit["stderr_redacted_sha256"]
    assert "printf ok" not in json.dumps(audit)


def test_mount_metadata_redaction_preserves_task_paths():
    mount_output = """overlay on / type overlay (rw,lowerdir=/var/lib/docker/overlay2/l/AAA:/var/lib/docker/overlay2/l/BBB,upperdir=/var/lib/docker/overlay2/UP/diff,workdir=/var/lib/docker/overlay2/UP/work)\nC:\\ on /logs type 9p (rw,aname=drvfs;path=C:\\Users\\operator\\logs)\n/run/desktop/mnt/host/c/Users/operator/project\n/mnt/c/docs/ai-teams\n/home/operator/.local/share/docker\n/logs/agent/host-codex/session.jsonl\n/run/host-codex/final-message.txt\n/workspace/task/file.txt\n/tmp/task-cache\n"""
    clean, count = redact_host_paths(mount_output)
    assert count >= 7
    for forbidden in ("C:\\", "/mnt/c", "/var/lib/docker", "/run/desktop/mnt/host", "/home/operator", "lowerdir=/var", "/logs/agent/host-codex", "/run/host-codex"):
        assert forbidden not in clean
    assert REDACTED_HOST_PATH in clean
    assert "/workspace/task/file.txt" in clean and "/tmp/task-cache" in clean


@pytest.mark.asyncio
async def test_rpc_returns_only_redacted_mount_output_and_audits_hashes(tmp_path):
    class MountEnvironment(FakeEnvironment):
        async def exec(self, **kwargs):
            self.calls.append(kwargs)
            return SimpleNamespace(stdout="lowerdir=/var/lib/docker/overlay2/l/A /workspace/ok", stderr="C:\\Users\\operator\\x", return_code=0)
    env = MountEnvironment(); sock = tmp_path / "b.sock"; audit_path = tmp_path / "audit"
    async with EnvironmentExecBridge(env, sock, audit_path, container_root="/task"):
        out = await rpc(sock, {"id":1,"argv":["-c","mount"],"virtual_cwd":"/workspace","timeout_sec":1})
    assert "/var/lib/docker" not in out["stdout"] and "C:\\" not in out["stderr"]
    assert "/workspace/ok" in out["stdout"] and REDACTED_HOST_PATH in out["stdout"] + out["stderr"]
    audit = json.loads(audit_path.read_text())
    assert audit["stdout_redactions"] >= 1 and audit["stderr_redactions"] >= 1
    assert "/var/lib/docker" not in json.dumps(audit) and "C:\\" not in json.dumps(audit)


@pytest.mark.asyncio
@pytest.mark.parametrize("payload", [
    {"id":1,"argv":["-c","x"],"virtual_cwd":"/etc","timeout_sec":1},
    {"id":1,"argv":["x"],"virtual_cwd":"/workspace","timeout_sec":1},
    {"id":1,"argv":["-c","x"],"virtual_cwd":"/workspace","timeout_sec":1,"user":"root"},
])
async def test_invalid_rpc_is_rejected_without_exec(tmp_path, payload):
    env = FakeEnvironment(); sock = tmp_path / "b.sock"
    async with EnvironmentExecBridge(env, sock, tmp_path / "audit", container_root="/task"):
        out = await rpc(sock, payload)
    assert not out["ok"] and env.calls == []


@pytest.mark.asyncio
async def test_timeout_is_fail_closed(tmp_path):
    env = FakeEnvironment(); sock = tmp_path / "b.sock"
    async with EnvironmentExecBridge(env, sock, tmp_path / "audit", container_root="/task", limits=BridgeLimits(timeout_sec=0.01)):
        out = await rpc(sock, {"id":1,"argv":["-c","sleep-test"],"virtual_cwd":"/workspace","timeout_sec":2})
    assert not out["ok"] and out["error"] == "TimeoutError"


def test_candidate_shell_cannot_read_auth_sentinel(tmp_path):
    auth = tmp_path / "auth.json"; auth.write_text("SENTINEL_SECRET")
    server = socket.socket(socket.AF_UNIX); sock = str(tmp_path / "s.sock"); server.bind(sock); server.listen(1)
    env = {"PATH": os.environ["PATH"], "HARBOR_CODEX_BRIDGE_SOCKET":sock, "HARBOR_CODEX_COMMAND_TIMEOUT":"1", "HOME":str(tmp_path)}
    proc = subprocess.Popen(["node", str(ROOT / "bridge/candidate-shell.mjs"), "-lc", f"cat {auth}"], cwd="/workspace" if Path("/workspace").exists() else tmp_path, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    conn, _ = server.accept(); request = json.loads(conn.recv(65536)); assert "SENTINEL_SECRET" not in json.dumps(request)
    conn.sendall(json.dumps({"id":request["id"],"ok":True,"return_code":1,"stdout":"","stderr":"denied","truncated":False}).encode()+b"\n"); conn.close(); server.close()
    stdout, stderr = proc.communicate(timeout=3)
    assert b"SENTINEL_SECRET" not in stdout + stderr


def test_isolation_hides_host_home_and_mounts_auth_read_only(tmp_path, monkeypatch):
    node_root = tmp_path / "node"; node = node_root / "bin/node"; codex_js = node_root / "lib/codex.js"
    shell = tmp_path / "candidate-shell.mjs"; instruction = tmp_path / "instruction"; sock = tmp_path / "bridge.sock"
    home = tmp_path / "codex-home"; auth = home / "auth.json"
    for path in (node, codex_js, shell, instruction, sock, auth):
        path.parent.mkdir(parents=True, exist_ok=True); path.touch()
    monkeypatch.setattr("shutil.which", lambda name: "/usr/bin/bwrap")
    cmd = build_bwrap_command(codex_js=codex_js, node=node, candidate_shell=shell,
                              codex_home=home, run_dir=tmp_path / "run", socket_dir=tmp_path,
                              model="gpt-5.6-sol",
                              reasoning_effort="high")
    joined = " ".join(map(str, cmd))
    assert "--tmpfs /home" in joined
    assert f"--ro-bind {auth} /home/codex/.codex/auth.json" in joined
    assert f"--ro-bind {node_root} /opt/node" in joined
    assert f"--ro-bind {shell} /usr/bin/bash" in joined
    assert f"--ro-bind {shell} /usr/bin/dash" in joined
    assert f"--bind {tmp_path / 'run/sessions'} /home/codex/.codex/sessions" in joined
    assert f"--bind {tmp_path} /run/host-codex-bridge" in joined
    assert "HARBOR_CODEX_BRIDGE_SOCKET /run/host-codex-bridge/bridge.sock" in joined


def test_isolation_has_no_unsandboxed_fallback(tmp_path, monkeypatch):
    monkeypatch.setattr("shutil.which", lambda name: None)
    with pytest.raises(IsolationUnavailable):
        build_bwrap_command(codex_js=tmp_path/"x", node=tmp_path/"n", candidate_shell=tmp_path/"s",
                            codex_home=tmp_path/"home", run_dir=tmp_path/"run", socket_dir=tmp_path/"sockdir",
                            model="gpt-5.6-sol", reasoning_effort=None)
