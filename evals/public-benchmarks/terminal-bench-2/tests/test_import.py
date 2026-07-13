from pathlib import Path
import os
import subprocess


ROOT = Path(__file__).resolve().parents[1]


def test_harbor_018_can_import_custom_agent():
    site = Path.home() / ".local/share/uv/tools/harbor/lib/python3.12/site-packages"
    env = dict(os.environ, PYTHONPATH=f"{ROOT}:{site}")
    code = "from agents.host_codex_bridge import HostCodexBridge; from harbor.agents.base import BaseAgent; assert issubclass(HostCodexBridge, BaseAgent); print(HostCodexBridge.import_path())"
    out = subprocess.run([str(Path.home()/".local/share/uv/tools/harbor/bin/python"), "-c", code], env=env, text=True, capture_output=True, check=True)
    assert "agents.host_codex_bridge:HostCodexBridge" in out.stdout


def test_codex_environment_excludes_api_credentials():
    site = Path.home() / ".local/share/uv/tools/harbor/lib/python3.12/site-packages"
    env = dict(os.environ, PYTHONPATH=f"{ROOT}:{site}", OPENAI_API_KEY="sentinel",
               OPENAI_BASE_URL="https://invalid.example")
    code = (
        "from agents.host_codex_bridge import HostCodexBridge; "
        "from pathlib import Path; a=HostCodexBridge(logs_dir=Path('/tmp/host-codex-test'), model_name='gpt-5.6-terra'); e=a._codex_environment(); "
        "assert 'OPENAI_API_KEY' not in e and 'OPENAI_BASE_URL' not in e; "
        "assert e['CODEX_HOME'].endswith('.codex')"
    )
    subprocess.run([str(Path.home()/".local/share/uv/tools/harbor/bin/python"), "-c", code],
                   env=env, text=True, capture_output=True, check=True)
