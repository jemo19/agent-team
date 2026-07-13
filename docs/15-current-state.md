# 15 - Public Current State

Last reviewed: 2026-07-12

This file describes the public release state of the agent-team framework. It is
safe to publish. Keep exact workstation paths, server names, IP addresses,
private repository names, customer names, and credential references in ignored
private files instead.

## Public Purpose

Agent Team is a Codex-centered operating framework for:

- planning non-trivial work before edits;
- using subagents for bounded scouting, implementation, test mapping, and
  review, then closing completed agent threads after consolidation;
- managing web project delivery with project-local `AGENTS.md` guidance;
- preparing infrastructure and MSP-style work with approval gates;
- recording evidence, checks, and handoff notes instead of relying on chat
  memory.

The normal loop is:

```text
GOAL -> PLAN -> INVOKE SUBAGENTS -> EXECUTE -> CHECK -> REVIEW -> HUMAN GATE -> RECORD EVIDENCE
```

## Public Repository Boundary

This repository should contain reusable framework material only:

- docs and runbooks;
- reusable Codex config templates;
- reusable custom-agent definitions;
- reusable skill templates;
- project and ops-control templates;
- validation scripts.

This repository must not contain:

- passwords, API keys, tokens, private keys, MFA codes, cookies, or sessions;
- `.env` files or secret Terraform variable files;
- Terraform/OpenTofu state or plan files;
- real customer names, customer systems, or customer ticket data;
- private server IPs, Tailscale IPs, internal DNS names, or SSH aliases;
- exact local infrastructure maps that are not intended for public release.

## Private Local State

Use ignored local files for exact environment state. Recommended names:

```text
private/current-state.private.md
private/project-map.private.md
private/servers.private.yaml
private/projects.private.yaml
```

The checked-in `.gitignore` excludes `private/`, `*.private.md`, and
`*.private.yaml`.

The public docs can describe patterns. Private files can contain exact local
facts. Do not copy private facts back into checked-in docs unless they are
sanitized.

## Agent Model Routing

Root controls currently use:

| Surface | Model | Effort | Evaluation note |
|---|---|---:|---|
| Root orchestration | `gpt-5.6-sol` | ultra | Measures deep orchestration and automatic delegation; compare directly with max. |
| Interactive Plan mode | `gpt-5.6-sol` | xhigh | Confirm separately in interactive Plan mode because non-interactive execution is only a surrogate. |

Public templates currently define these global custom agents:

| Agent | Model | Mode | Effort | Purpose |
|---|---|---|---:|---|
| `customer_comms` | `gpt-5.6-terra` | read-only | medium | Draft customer-safe communication. |
| `iac_planner` | `gpt-5.6-sol` | read-only | xhigh | Plan Terraform/OpenTofu state, import, drift, and desired-state work. |
| `infra_planner` | `gpt-5.6-sol` | read-only | xhigh | Build server/customer change plans with rollback and evidence. |
| `infra_recon` | `gpt-5.6-terra` | read-only | high | Prepare safe read-only server reconnaissance. |
| `msp_triage` | `gpt-5.6-terra` | read-only | medium | Classify MSP-style requests and produce ticket plans. |
| `risk_reviewer` | `gpt-5.6-sol` | read-only | xhigh | Review correctness, security, auth, data, and operational risk. |
| `test_mapper` | `gpt-5.6-terra` | read-only | medium | Locate tests, commands, fixtures, and coverage gaps. |
| `web_builder` | `gpt-5.6-sol` | workspace-write | high | Implement bounded web project packets. |
| `web_scout` | `gpt-5.6-terra` | read-only | medium | Map web code paths, conventions, tests, and risks. |

Project-local templates define:

| Agent | Model | Mode | Effort | Purpose |
|---|---|---|---:|---|
| `project_architect` | `gpt-5.6-sol` | read-only | xhigh | Plan multi-file project changes. |
| `project_builder` | `gpt-5.6-sol` | workspace-write | high | Implement bounded project-specific packets. |
| `project_reviewer` | `gpt-5.6-sol` | read-only | xhigh | Review project diffs before closeout. |

This first migration preserves the previous role effort levels so model behavior
can be evaluated independently. `gpt-5.6-luna` is intentionally unassigned
until the framework adds a deterministic high-volume role.

## Role Evaluation State

The public-safe benchmark specification is
`docs/16-role-model-evaluation.md`, with executable fixtures and reporting under
`evals/role-model-matrix/`. Version 1 covers 14 root, global, and project-local
role surfaces against a frozen 17-configuration matrix, for 238 screening cells
per repetition. The current implementation is suite `1.5.0` with harness
`1.4.0`.

The benchmark uses synthetic data and isolated disposable workspaces. It
records harness validity, critical gates, task quality, latency, token usage,
tool behavior, filesystem changes, and delegation evidence separately. It uses
local `codex exec` with existing Codex authentication rather than custom
Responses/Evals API request code. The parent Codex client retains only the API
egress needed for model calls; candidate tools and every grader remain
network-disabled and trace-gated. Static validation and dry-run planning make
no model calls. Billed results remain exploratory until finalist repeats,
representative trace review, and the human routing gate are complete.

The July 2026 Sol Ultra smoke test completed a root orchestration fixture and a
specialist builder fixture. Both passed deterministic gates; the builder scored
100. Root task outcome scored 100, but the combined score is an 80-100 interval
because CLI 0.144.0 did not expose child identities or child usage. The suite
now keeps wait-call counts descriptive and marks delegation
`identity_unavailable` instead of inferring success or zero children.

The current calibration evidence is v6. It completed all 14 installed controls;
human semantic review found 13 passes and one supported `customer_comms`
failure. Preserved-output replay under suite `1.4.2` / harness `1.3.1` produces
the same 13/1 disposition. The replay corrects only demonstrated quoted-command
parsing, recovered-transport classification, and deterministic paraphrase
misses. It does not weaken the remaining customer-message gate.

The optional Luna/max semantic judge is shadow-only and cannot alter scores or
routing. Its fresh protocol-3.1 pilot completed but failed the shadow acceptance
gate, so deterministic scoring remained unchanged.

The July 12 screen completed all 238 seeded cells. Human review found pervasive
lexical and field-placement false negatives plus a root-orchestration terminal
classification anomaly. Preserve the run as harness-calibration evidence; its
raw 152-pass/86-gate-failure split does not support a model ranking or routing
change.

Suite `1.5.0` implements the corrective boundary: explicit semantic
alternatives search logical output fields, terminal status distinguishes hard
gates, incomplete scoring, and quality failures, and the two ceiling-effect
builders are replaced by V2 cursor-pagination and dependency-DAG fixtures. An
additive offline regrade covered 204 compatible cases and excluded the 34
changed builder cases. It recovered 31 semantic credits and rejected one old
keyword-only credit without rewriting the frozen source run. A fresh V2 screen
and human review are still required before ranking or routing decisions.

A separate public lane under `evals/public-benchmarks/terminal-bench-2/`
completed 85 comparable Terminal-Bench 2 cells: all 17 configurations on five
pinned tasks. Sol/xhigh and Terra/ultra each scored 4/5, with wide overlapping
Wilson intervals. The host-side bridge kept subscription authentication outside
task containers and used no OpenAI API key. This small public screen is also
insufficient for a general ranking; see `RESULTS-2026-07-12.md`.

## Installed Skills and Local Extensions

The public package owns reusable skill templates and validation guidance. The
workstation can also have local skills under `~/.codex/skills`, `~/.agents/skills`,
and `/mnt/c/docs/skills`.

Publicly reusable skill categories:

- local goal planning and evidence capture;
- web project delivery;
- Linux/server maintenance planning;
- infrastructure-as-code operations;
- MSP ticket triage and customer-safe communication.

Project-specific deploy skills are local extensions. Keep exact hostnames,
private paths, SSH command allow-lists, credential locations, and customer facts
in the project docs or ignored private notes.

Validation status as of 2026-07-13:

- the GPT-5.6 agent TOMLs parse, all configured model/effort pairs exist in the
  current local Codex catalog, and migration smoke calls succeeded before the
  current usage-limit stop;
- the role-model evaluation manifest resolves 14 calibration controls and the
  completed 238-cell screen;
- suite `1.5.0` / harness `1.4.0` passes 76 tests across 13 files, static
  manifest validation, semantic
  calibration controls, builder seed/gold controls, and terminal-classification
  regression checks;
- calibration v6 completed 14/14 controls and its human review plus current
  offline replay are preserved in the local ignored results directory;
- the host-side Terminal-Bench bridge passes 17 tests, and the five-task public
  screen has 85 terminal scored results with clean post-run lifecycle checks;
- installed skill frontmatter validates across the local skill roots;
- a deploy-skill YAML warning caused by a list-valued `description` was fixed by
  making the `description` field a scalar string;
- `README.md`, `HANDOFF.md`, `MEMORY.md`, `NOTES.md`, and this file should be
  updated together when the operating model changes.

## Policy Boundary Lessons

- Avoid reusable catch-all SSH prompt rules when local exact deploy allow-lists
  are used; most-restrictive matching can turn an exact allow into a prompt.
- If a command is allowed by `codex execpolicy check` but still rejected by the
  tool runner, treat it as a session/launcher approval boundary and stop for a
  correct approval-capable session or documented runner.

## Current Public Release Tasks

Before making this repository public:

1. Keep local/private state under ignored private files.
2. Sanitize all checked-in docs and templates.
3. Remove generated files such as `__pycache__/`.
4. Run `bash scripts/validate-package.sh`.
5. Run a secret/public-risk scan.
6. Publish from a fresh sanitized history if earlier private commits contained
   local environment details.

## Local Workflow After Public Release

Use this repository for reusable framework work. Use ignored private files, a
separate private notes repo, or the local ops control repo for exact operational
state.

When updating docs:

- update public docs with generic examples and reusable instructions;
- update private files with real local paths, servers, customer references, and
  next actions;
- never assume a public doc can safely mention a private repo, server, IP, or
  customer.
