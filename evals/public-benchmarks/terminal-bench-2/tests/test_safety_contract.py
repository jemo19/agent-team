from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import threading
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def test_model_effort_allowlist_and_unknown_kwargs(tmp_path):
    py = Path.home()/".local/share/uv/tools/harbor/bin/python"
    code = f'''import sys
sys.path.insert(0, {str(ROOT)!r})
from agents.host_codex_bridge import HostCodexBridge
HostCodexBridge({str(tmp_path)!r}, "gpt-5.6-luna", reasoning_effort="max")
checks=[lambda:HostCodexBridge({str(tmp_path)!r},"gpt-5.7-sol"),lambda:HostCodexBridge({str(tmp_path)!r},"gpt-5.6-luna",reasoning_effort="ultra"),lambda:HostCodexBridge({str(tmp_path)!r},"gpt-5.6-sol",surprise=True),lambda:HostCodexBridge({str(tmp_path)!r},"gpt-5.6-sol",extra_env={{"AZURE_OPENAI_API_KEY":"x"}})]
for check in checks:
 try: check(); raise AssertionError("accepted invalid config")
 except (ValueError,TypeError): pass
'''
    subprocess.run([str(py), "-c", code], check=True)


def test_fake_harbor_lifecycle_uses_only_exec_and_tears_down_socket(tmp_path):
    py = Path.home()/".local/share/uv/tools/harbor/bin/python"
    code = f'''import asyncio,sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, {str(ROOT)!r})
import agents.host_codex_bridge as mod
from harbor.models.agent.context import AgentContext
class Env:
 def __init__(self): self.calls=[]; self.uploads={{}}
 async def exec(self, **kw):
  assert set(kw) <= {{"command","cwd","timeout_sec"}}; self.calls.append(kw)
  return SimpleNamespace(stdout="/task\\n",stderr="",return_code=0)
 async def upload_file(self, source_path, target_path): self.uploads[target_path]=Path(source_path).read_bytes()
 def __getattr__(self,name):
  if name in ("upload_file","download_file","service_exec"): raise AssertionError(name)
  raise AttributeError(name)
class Proc:
 returncode=0
 async def communicate(self): return (b"codex-cli 1.2.3\\nLogged in using ChatGPT\\n",b"")
 async def wait(self): return 0
 def terminate(self): pass
 def kill(self): pass
async def main():
 env=Env(); logs=Path({str(tmp_path)!r})/("very-long-harbor-trial-path-"*5)/"logs"; logs.mkdir(parents=True); home=Path({str(tmp_path)!r})/"home"; home.mkdir(); (home/"auth.json").write_text("sentinel")
 agent=mod.HostCodexBridge(logs,"gpt-5.6-sol",codex_home=str(home)); ctx=AgentContext()
 with patch.object(mod.shutil,"which",side_effect=lambda name,path=None: "/tmp/node/bin/codex" if name=="codex" else "/tmp/node/bin/node"), patch.object(mod.asyncio,"create_subprocess_exec",return_value=Proc()):
  await agent.setup(env)
  agent._codex_js=Path("/tmp/fake.js"); agent._node=Path("/tmp/node")
  def fake_build(**kw): (kw["run_dir"]/"workspace/result.txt").write_text("created"); return ["/bin/true"]
  with patch.object(mod,"build_bwrap_command",side_effect=fake_build): await agent.run("task",env,ctx)
 assert env.calls[0] == {{"command":"pwd"}} and env.uploads["/task/result.txt"] == b"created"
 assert (logs/"codex-events.jsonl").exists() and (logs/"bridge-audit.jsonl").exists()
 assert (logs/"workspace-sync.jsonl").exists() and '"status": "uploaded"' in (logs/"workspace-sync.jsonl").read_text()
 assert len(str(logs)) > 108
 assert ctx.metadata["host_codex_bridge"]["status"] == "ok" and ctx.metadata["host_codex_bridge"]["socket_removed"] and ctx.metadata["host_codex_bridge"]["socket_dir_removed"]
asyncio.run(main())
'''
    subprocess.run([str(py), "-c", code], check=True)


def test_workspace_sync_rejects_symlink_oversize_and_auth_paths(tmp_path):
    py = Path.home()/".local/share/uv/tools/harbor/bin/python"
    code = f'''import asyncio,sys
from pathlib import Path
from types import SimpleNamespace
sys.path.insert(0, {str(ROOT)!r})
from agents.host_codex_bridge import sync_workspace,WorkspaceSyncError
class Env:
 def __init__(self): self.uploads=[]
 async def exec(self,**kw): return SimpleNamespace(return_code=0,stdout="",stderr="")
 async def upload_file(self,**kw): self.uploads.append(kw)
async def rejected(kind):
 root=Path({str(tmp_path)!r})/kind; root.mkdir(); env=Env()
 manifest=root.parent/(kind+".jsonl")
 if kind=="symlink": (root/"link").symlink_to("/etc/passwd")
 elif kind=="oversize": (root/"large.bin").write_bytes(b"x"*9)
 elif kind=="auth": (root/"auth.json").write_text("secret")
 elif kind=="dotenv": (root/".env.production").write_text("secret")
 else: (root/"client.key").write_text("secret")
 try: await sync_workspace(env,root,"/app",manifest,max_file_bytes=8); raise AssertionError("unsafe workspace accepted")
 except WorkspaceSyncError: pass
 assert env.uploads == [] and '"status": "rejected"' in manifest.read_text()
async def main():
 for kind in ("symlink","oversize","auth","dotenv","private-key"): await rejected(kind)
asyncio.run(main())
'''
    subprocess.run([str(py), "-c", code], check=True)


def test_nonzero_and_mid_upload_failure_have_sync_evidence(tmp_path):
    py = Path.home()/".local/share/uv/tools/harbor/bin/python"
    code = f'''import asyncio,sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0, {str(ROOT)!r})
import agents.host_codex_bridge as mod
from harbor.models.agent.context import AgentContext
class Proc:
 def __init__(self,rc): self.returncode=rc
 async def wait(self): return self.returncode
 def terminate(self): pass
 def kill(self): pass
class Env:
 def __init__(self,fail_second=False): self.uploads=[]; self.fail_second=fail_second
 async def exec(self,**kw): return SimpleNamespace(return_code=0,stdout="",stderr="")
 async def upload_file(self,source_path,target_path):
  if self.fail_second and len(self.uploads)==1: raise OSError("synthetic upload failure")
  self.uploads.append((target_path,Path(source_path).read_bytes()))
async def run_case(name,rc,fail_second):
 logs=Path({str(tmp_path)!r})/name; logs.mkdir(); home=Path({str(tmp_path)!r})/(name+"-home"); home.mkdir(); (home/"auth.json").write_text("x")
 agent=mod.HostCodexBridge(logs,"gpt-5.6-sol",codex_home=str(home)); agent._container_root="/app"; agent._version="fake"; agent._codex_js=Path("/fake.js"); agent._node=Path("/node")
 env=Env(fail_second); ctx=AgentContext()
 def build(**kw):
  (kw["run_dir"]/"workspace/a.txt").write_text("a")
  if fail_second: (kw["run_dir"]/"workspace/b.txt").write_text("b")
  return ["/bin/true"]
 try:
  with patch.object(mod,"build_bwrap_command",side_effect=build),patch.object(mod.asyncio,"create_subprocess_exec",return_value=Proc(rc)): await agent.run("task",env,ctx)
  raise AssertionError("failure case returned successfully")
 except (RuntimeError,OSError): pass
 return logs,env,ctx
async def main():
 logs,env,ctx=await run_case("nonzero",9,False)
 assert env.uploads==[("/app/a.txt",b"a")] and ctx.metadata["host_codex_bridge"]["return_code"]==9
 assert ctx.metadata["host_codex_bridge"]["status"]=="failed" and ctx.metadata["host_codex_bridge"]["failure_class"]=="CodexNonZeroExit"
 logs,env,ctx=await run_case("mid-upload",0,True)
 records=[__import__("json").loads(x) for x in (logs/"workspace-sync.jsonl").read_text().splitlines()]
 assert env.uploads==[("/app/a.txt",b"a")] and [r["status"] for r in records]==["uploaded","failed"]
 assert ctx.metadata["host_codex_bridge"]["status"]=="failed" and ctx.metadata["host_codex_bridge"]["failure_class"]=="OSError"
asyncio.run(main())
'''
    subprocess.run([str(py), "-c", code], check=True)


def test_live_bwrap_all_shell_paths_are_rpc_surrogates(tmp_path):
    bwrap = shutil.which("bwrap")
    node = Path(shutil.which("node") or "")
    if not bwrap or not node.exists(): pytest.skip("bwrap and node required")
    node_root = node.resolve().parents[1]
    run = tmp_path / "run"; run.mkdir(); sock_path = run / "bridge.sock"
    auth = tmp_path / "auth.json"; sentinel = "AUTH_SENTINEL_MUST_NOT_RETURN"; auth.write_text(sentinel)
    seen = []
    server = socket.socket(socket.AF_UNIX); server.bind(str(sock_path)); server.listen(4)
    def serve():
        for _ in range(3):
            conn, _ = server.accept(); raw = b""
            while not raw.endswith(b"\n"): raw += conn.recv(65536)
            req = json.loads(raw); seen.append(req["argv"][1])
            conn.sendall((json.dumps({"id":req["id"],"ok":True,"return_code":1,"stdout":"","stderr":"blocked","truncated":False})+"\n").encode()); conn.close()
        server.close()
    thread = threading.Thread(target=serve, daemon=True); thread.start()
    shell = ROOT / "bridge/candidate-shell.mjs"
    base = [bwrap,"--die-with-parent","--ro-bind","/usr","/usr","--symlink","usr/bin","/bin","--ro-bind","/lib","/lib"]
    if Path("/lib64").exists(): base += ["--ro-bind","/lib64","/lib64"]
    base += ["--ro-bind","/etc","/etc","--proc","/proc","--dev","/dev","--tmpfs","/home",
             "--dir","/home/codex","--dir","/home/codex/.codex","--ro-bind",str(auth),"/home/codex/.codex/auth.json",
             "--dir","/opt","--ro-bind",str(node_root),"/opt/node","--dir","/run/bridge","--bind",str(run),"/run/bridge",
             "--ro-bind",str(shell),"/usr/bin/bash","--ro-bind",str(shell),"/usr/bin/dash",
             "--setenv","PATH","/opt/node/bin:/usr/bin:/bin","--setenv","HARBOR_CODEX_BRIDGE_SOCKET","/run/bridge/bridge.sock"]
    driver = ROOT / "tests/fixtures/fake-codex-driver.mjs"
    base += ["--ro-bind",str(driver),"/run/fake-codex-driver.mjs"]
    proc = subprocess.run(base + ["/opt/node/bin/node","/run/fake-codex-driver.mjs"], capture_output=True, timeout=10)
    outputs = proc.stdout + proc.stderr
    thread.join(timeout=5)
    assert len(seen) == 3 and all("cat /home/codex/.codex/auth.json" in value for value in seen), outputs.decode(errors="replace")
    assert sentinel.encode() not in outputs
