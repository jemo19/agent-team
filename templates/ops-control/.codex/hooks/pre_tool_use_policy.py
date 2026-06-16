#!/usr/bin/env python3
"""
Conservative Codex PreToolUse hook for the local-ops repo.
Blocks obviously destructive commands in normal sessions.
This is a guardrail, not a complete security boundary.
"""
import json
import re
import sys

try:
    payload = json.load(sys.stdin)
except Exception:
    # Allow if no hook payload; useful for smoke tests.
    sys.exit(0)

cmd = ""
try:
    tool_input = payload.get("tool_input") or {}
    cmd = tool_input.get("command") or ""
except Exception:
    cmd = ""

normalized = re.sub(r"\s+", " ", cmd.strip()).lower()

block_patterns = [
    (r"\brm\s+-rf\s+/(\s|$)", "Refusing recursive deletion of root."),
    (r"\bmkfs(\.|\s|$)", "Filesystem creation/destruction must be a manual runbook, not a Codex command."),
    (r"\bdd\s+.*\bof=/dev/", "Raw disk writes are blocked."),
    (r"\bshutdown\b", "Shutdown is blocked by local ops policy."),
    (r"\breboot\b", "Reboot is blocked by local ops policy."),
    (r"\bpoweroff\b", "Poweroff is blocked by local ops policy."),
    (r"\biptables\b.*\b(-f|--flush)\b", "Firewall flush is blocked."),
    (r"\bnft\b.*\bflush\b", "Firewall flush is blocked."),
    (r"\bufw\s+reset\b", "Firewall reset is blocked."),
    (r"\buserdel\b", "User deletion requires a manual approved runbook."),
    (r"\bgroupdel\b", "Group deletion requires a manual approved runbook."),
]

for pattern, reason in block_patterns:
    if re.search(pattern, normalized):
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason
            }
        }))
        sys.exit(0)

# Warn, but do not block, common high-risk operations. Codex rules/approval should still prompt.
warn_patterns = [
    (r"\bsudo\b", "Privileged command detected. Human approval and evidence are required."),
    (r"\bssh\b", "Remote command detected. Confirm target, scope, and approval."),
    (r"\bsystemctl\s+(restart|stop|disable|enable)\b", "Service state change detected."),
    (r"\bapt\s+(upgrade|full-upgrade|dist-upgrade|install|remove|purge)\b", "Package change detected."),
    (r"\bdocker\s+compose\s+(up|down|restart|pull)\b", "Docker compose change detected."),
]

for pattern, msg in warn_patterns:
    if re.search(pattern, normalized):
        print(json.dumps({"systemMessage": msg}))
        sys.exit(0)

sys.exit(0)
