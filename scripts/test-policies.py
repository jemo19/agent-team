#!/usr/bin/env python3
"""Behavior checks for the reusable Codex rules and ops-control hook."""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
HOOK = ROOT / "templates/ops-control/.codex/hooks/pre_tool_use_policy.py"
HOOKS_CONFIG = ROOT / "templates/ops-control/.codex/hooks.json"
RULES = ROOT / "templates/home-codex/rules/default.rules"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def run_hook(command: object) -> dict[str, object] | None:
    payload = json.dumps({"tool_input": {"command": command}})
    result = subprocess.run(
        [sys.executable, str(HOOK)],
        input=payload,
        text=True,
        capture_output=True,
        check=False,
        timeout=10,
    )
    require(result.returncode == 0, f"hook failed for {command!r}: {result.stderr}")
    require(result.stderr == "", f"hook wrote stderr for {command!r}: {result.stderr}")
    return json.loads(result.stdout) if result.stdout else None


def test_hook_wiring() -> None:
    config = json.loads(HOOKS_CONFIG.read_text(encoding="utf-8"))
    entries = config.get("hooks", {}).get("PreToolUse", [])
    require(entries == [], "full-access templates must not register a PreToolUse approval hook")


def test_hook_behavior() -> int:
    full_access_cases = [
        "rm -rf /tmp/task-owned-dir",
        "mkfs.ext4 /dev/test-device",
        "dd if=image.iso of=/dev/test-device",
        "sudo true",
        "ssh srv1 uptime",
        "systemctl restart nginx",
        "apt install nginx",
        "docker compose up -d",
        "terraform apply saved.plan",
    ]
    for command in full_access_cases:
        require(run_hook(command) is None, f"full-access command should not trigger a prompt for {command!r}")

    require(run_hook("printf ok") is None, "safe command should not emit a hook decision")
    require(run_hook(42) is None, "non-string command should fail open without crashing")

    malformed = subprocess.run(
        [sys.executable, str(HOOK)],
        input="not-json",
        text=True,
        capture_output=True,
        check=False,
        timeout=10,
    )
    require(malformed.returncode == 0, "malformed hook payload should fail open")
    require(malformed.stdout == "" and malformed.stderr == "", "malformed hook payload should be silent")
    return len(full_access_cases) + 3


def execpolicy(command: list[str]) -> dict[str, object]:
    codex = shutil.which("codex")
    require(codex is not None, "codex executable is unavailable")
    env = os.environ.copy()
    env["CODEX_DISABLE_GLOBAL_BYPASS"] = "1"
    result = subprocess.run(
        [codex, "execpolicy", "check", "--pretty", "--rules", str(RULES), "--", *command],
        text=True,
        capture_output=True,
        check=False,
        env=env,
        timeout=10,
    )
    require(result.returncode == 0, f"execpolicy failed for {command}: {result.stderr}")
    require(result.stderr == "", f"execpolicy wrote stderr for {command}: {result.stderr}")
    return json.loads(result.stdout)


def test_execpolicy() -> tuple[int, bool]:
    if shutil.which("codex") is None:
        print("codex not found; skipping execpolicy decision assertions")
        return 0, True

    cases = [(["/bin/bash", "-lc", "rm -rf -- /tmp/task-owned-dir"], "allow", ["/bin/bash"])]
    for command, decision, prefix in cases:
        output = execpolicy(command)
        require(output.get("decision") == decision, f"wrong execpolicy decision for {command}")
        matches = output.get("matchedRules", [])
        require(matches, f"execpolicy did not match {command}")
        actual = matches[0].get("prefixRuleMatch", {}).get("matchedPrefix")
        require(actual == prefix, f"wrong execpolicy prefix for {command}: {actual}")

    for command in [
        ["ssh", "srv1", "uptime"],
        ["scp", "file", "srv1:/tmp/file"],
        ["sudo", "systemctl", "restart", "nginx"],
        ["terraform", "apply"],
    ]:
        output = execpolicy(command)
        require(output.get("decision") == "allow", f"full-access rule did not allow {command}")
        require(output.get("matchedRules"), f"full-access rule did not match {command}")
    return 5, False


def main() -> None:
    test_hook_wiring()
    hook_cases = test_hook_behavior()
    policy_cases, skipped = test_execpolicy()
    suffix = " (execpolicy skipped)" if skipped else ""
    print(f"Policy behavior passed: {hook_cases} hook cases, {policy_cases} execpolicy cases{suffix}.")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, json.JSONDecodeError) as error:
        print(f"Policy behavior failed: {error}", file=sys.stderr)
        raise SystemExit(1)
