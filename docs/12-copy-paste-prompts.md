# 12 — Copy/Paste Prompts

## Universal goal start

```text
Use the local-goal-loop workflow.

Goal: <describe goal>
Context: <why>
Target: <repo/server/customer>
Risk expectation: <Green/Yellow/Red or unknown>
Allowed now: planning and read-only analysis only.
Forbidden now: file edits, remote commands, privileged commands, deployments, customer-visible changes.

First create a goal contract and plan. Then use standing authorization to run useful read-only subagents in parallel after identifying safe independent work. Identify which steps must be serialized. Stop before execution.
```

## Web project codebase scout

```text
Read AGENTS.md. Do not edit files.
Spawn web_scout, test_mapper, and risk_reviewer in parallel.
Task: map this repo for <feature/bug/refactor>.
Return: entry points, affected files, data flow, existing tests, missing tests, build/test commands, risks, and recommended implementation sequence.
```

## Web feature implementation

```text
Use the web-project delivery workflow.
Goal: <feature>.
Use the existing plan in <goal file>.
Implement only packet <packet id>.
Stay within these files: <files>.
Do not change dependencies, migrations, auth, deployment config, or unrelated formatting.
Run these checks: <commands>.
After implementation, summarize diff and checks.
```

## Independent web review

```text
Spawn project_reviewer or risk_reviewer.
Read-only review of current diff against <goal file>.
Focus on correctness, security, data integrity, auth, regressions, missing tests, and out-of-scope edits.
Return blocking findings first, then non-blocking findings. Include exact file/line references when possible.
```

## Infra read-only plan

```text
Use the linux-server-maintenance workflow.
Read AGENTS.md and inventory/servers.yaml.
Scope: <server(s)>.
Allowed now: plan only.
Forbidden: SSH execution, sudo, package changes, service restarts, reboots, firewall changes, file edits.
Produce a read-only recon command list, risk matrix, evidence path, and stop conditions.
```

## Infra maintenance execution checklist

```text
Convert the approved maintenance plan into an execution checklist.
For each server include: pre-checks, backup confirmation, exact commands, expected output, rollback, post-checks, and stop conditions.
Do not execute commands. I will approve execution separately.
```

## MSP ticket triage

```text
Use the MSP ticket ops workflow.
Triage ticket: <path or pasted ticket text>.
Allowed now: ticket analysis, customer-safe draft, planning.
Forbidden: remote/customer commands, credential requests, actual customer message sending.
Return: summary, risk, urgency, missing info, approval needed, proposed response, execution plan, verification, rollback, closeout template.
```

## Customer-safe response draft

```text
Draft a customer-safe response for ticket <id>.
Tone: concise, professional, no internal implementation details unless necessary.
Include: what I understand, missing info/questions, expected impact, approval request if needed, next step.
Do not claim completion.
```

## Post-change closeout

```text
Prepare closeout for <goal/ticket> using the evidence files.
Include: work performed, time, systems touched, verification, customer impact, exceptions, follow-ups.
Do not include secrets, internal doubts, or raw logs unless needed.
```
