# 15 - Public Current State

Last reviewed: 2026-09-12

This file describes the public release state of the agent-team framework. It is
safe to publish. Keep exact workstation paths, server names, IP addresses,
private repository names, customer names, and credential references in ignored
private files instead.

For the current Astra maintenance and verification limits, see
[HARNESS_USAGE_AUDIT.md](../HARNESS_USAGE_AUDIT.md).

## Public Purpose

Agent Team is a Codex-centered operating framework for:

- selecting a workflow proportionate to the work;
- using role-routed subagents for bounded scouting, implementation, test
  mapping, or risk-justified review, then closing completed threads;
- managing web project delivery with project-local `AGENTS.md` guidance;
- executing objective-authorized infrastructure and MSP-style work with trusted target, rollback, and verification gates;
- recording evidence, checks, and handoff notes instead of relying on chat
  memory.

The controlled loop is explicit-only through `$local-goal-loop`:

```text
GOAL -> PLAN -> INVOKE (ROUTE OR DELEGATE) -> EXECUTE -> CHECK -> REVIEW -> RECORD
```

Routine work takes a direct implementation-and-validation path without
mandatory agents, reviewers, or persistent evidence files.

When `$local-goal-loop` is explicitly invoked, that invocation activates its
bounded local workflow without another model-selection or subagent-permission
prompt. STAGED and CONTROLLED work may route valid bounded packets through the
configured Astra, Sol, and Luna roles when delegation adds value; the loop does
not require a child or independent review for every task. The Astra-low root
retains integration and final verification. The assigned objective authorizes
all necessary in-scope actions, including external or production effects it
actually requests. Full access does not widen the target or requested outcome.

Consequential or materially ambiguous work can use a selective
planner-to-executor path: an Astra-high architect with a read-only contract
produces a complete
`READY` implementation packet; mechanical non-specialist work may route to
Sol-low `worker`, while specialist or judgment-heavy implementation stays with
the named Sol-medium builder. Executors validate packets against current
repository evidence and return contradictions to the root.

Project guidance now supports a concrete external notes root. The code-root
directory name provides the default mapping, while explicit canonical-name
overrides handle intentional identity differences. A separate synchronizer
manages only its delimited `AGENTS.md` block, preserves project-specific
instructions, and leaves legacy content migration outside that synchronizer's
scope.

The canonical public identity is `ai-teams`; a singular `ai-team` sibling is a
compatibility index only. Exact workstation paths and helper-workspace mappings
belong in ignored private state.

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

The installed root baseline is `gpt-6-astra` at low. Unpinned children
default to `gpt-5.6-sol` at low, and the documented child-thread ceiling is
two.
All 16 stable roles are centralized under `~/.codex/agents`; project-scoped
same-name copies are intentionally absent.

| Agent | Model | Permission intent | Effort | Accepted custom skill |
|---|---|---|---:|---|
| `default` | `gpt-5.6-sol` | read-only contract | low | none |
| `worker` | `gpt-5.6-sol` | scoped-write contract | low | none |
| `explorer` | `gpt-5.6-luna` | read-only contract | medium | none |
| `web_scout` | `gpt-5.6-sol` | read-only contract | medium | none |
| `web_builder` | `gpt-5.6-sol` | scoped-write contract | medium | web delivery |
| `project_architect` | `gpt-6-astra` | read-only contract | high | none |
| `project_builder` | `gpt-5.6-sol` | scoped-write contract | medium | none |
| `project_reviewer` | `gpt-5.6-sol` | read-only contract | high | none |
| `test_mapper` | `gpt-5.6-luna` | read-only contract | medium | none |
| `test_strategist` | `gpt-6-astra` | read-only contract | high | none |
| `risk_reviewer` | `gpt-6-astra` | read-only contract | high | none |
| `infra_recon` | `gpt-6-astra` | recon-only contract | low | Linux maintenance, recon-constrained |
| `infra_planner` | `gpt-6-astra` | planning-only contract | high | Linux maintenance, planning-constrained |
| `iac_planner` | `gpt-6-astra` | planning-only contract | high | IaC ops, planning-constrained |
| `msp_triage` | `gpt-6-astra` | triage-only contract | medium | MSP ticket ops, triage-constrained |
| `customer_comms` | `gpt-5.6-luna` | draft-only contract | medium | none |

Every child disables `local-goal-loop`. Codex 0.153.4 role files intentionally
omit sandbox and approval overrides, so children inherit `danger-full-access`
and approval policy `never`. Read-only, planning-only, and scoped-write limits
are coordination contracts rather than security isolation. Established feature
and skill exclusions remain in place, with plugins retained for web-builder
roles. Root retains all five accepted skills and controls one-off escalation.
Four on-demand variants provide Sol-high Scout/Builder routes and an Astra-high
consequential Reviewer route without mutating standing roles. No standing
xhigh, Max, or Ultra assignment exists. See `docs/17-agent-architecture.md`.

## Role Evaluation State

The v1/v6 benchmark below is retained as historical evidence for the previous
14-role routing. It does not define the current 16-role architecture or justify
standing xhigh assignments. Current routing is the table above and must be
validated with the integration smoke matrix.

The public-safe benchmark specification is
`docs/16-role-model-evaluation.md`, with executable fixtures and reporting under
`evals/role-model-matrix/`. Version 1 covers 14 root, global, and project-local
role surfaces against a frozen 17-configuration matrix, for 238 screening cells
per repetition. The default implementation is suite `3.1.0`; the held-out
finalist manifests are `3.2.0`, with harness `1.8.0`.

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

The July 15 V2 screen completed all 238 seeded cells: 63 passed, 96 gate failed,
65 quality failed, 12 scoring indeterminate, and two timed out. Independent
case-level review plus diff review of the 121 failures found 84 grader false
negatives and 37 genuine model failures. Suite `1.7.0` implements those audited corrections and
preserves all prior passes and genuine failures. Its additive regrade covers
221 compatible cases: 170 passed, 11 gate failed, 26 quality failed, 12 remain
indeterminate, and two remain source timeouts. Only 17 changed Project Builder
cases were excluded; their corrected fresh retest passed 17/17. The two prior
Luna Web Builder timeout cells also passed 2/2, producing composite evidence of
189 passed, 11 gate failed, 26 quality failed, 12 indeterminate, and zero
timeouts. The 12 root-orchestration
indeterminate cells remain a CLI telemetry limitation rather than model
failures. The completed case audit does not replace blinded finalist review or
the three-fixture routing gate.

Suite 3.1 replaces the remaining Infra Planner and Risk Reviewer ceilings and
adds offline repeat analysis with Wilson intervals. The July 16 Builder/Scout
repeat lane produced 36 pass, eight quality failure, and five gate failure in
49 calls. Sol/low is the leading challenger for both roles, but same-fixture
repeats did not satisfy the distinct-fixture routing gate, so that campaign
left active routing unchanged. See
`evals/role-model-matrix/V3-MULTIFIXTURE-REPEAT-RESULTS-2026-07-16.md`.

The final Builder/Scout expansion completed exactly 24 held-out calls on four
new fixtures with no operational failure. Across three distinct fixtures,
Builder Sol/high is 11/11 on hard gates versus Sol/low 10/11, including one
genuine low-effort autosave transport-aliasing failure. Scout Sol/low is 11/11
on hard gates and 9/11 at full quality versus Terra/medium 8/11 and 2/11.
Builder remained on Sol/high in that campaign. The separate human routing gate
approved Scout Sol/low, and that route was applied at the time. The later
explicit standing matrix supersedes that routing decision without rewriting
its result. See
`evals/role-model-matrix/FINAL-BUILDER-SCOUT-ROUTING-RESULTS-2026-07-16.md`.

A separate public lane under `evals/public-benchmarks/terminal-bench-2/`
completed 85 comparable Terminal-Bench 2 cells: all 17 configurations on five
pinned tasks. Sol/xhigh and Terra/ultra each scored 4/5, with wide overlapping
Wilson intervals. The host-side bridge kept subscription authentication outside
task containers and used no OpenAI API key. This small public screen is also
insufficient for a general ranking; see `RESULTS-2026-07-12.md`.

## Installed Skills and Local Extensions

The public package owns reusable skill templates and validation guidance. The
workstation can also have local skills under `~/.codex/skills`,
`~/.agents/skills`, and an optional operator-configured shared skill root.

Publicly reusable skill categories:

- local goal planning and evidence capture;
- web project delivery;
- Linux/server maintenance planning;
- infrastructure-as-code operations;
- MSP ticket triage and customer-safe communication.

Project-specific deploy skills are local extensions. Keep exact hostnames,
private paths, SSH command allow-lists, credential locations, and customer facts
in the project docs or ignored private notes.

Historical validation status as of 2026-08-30 (retained for the evaluation
harness and previous routing; it does not prove the current matrix):

- the GPT-5.6 agent TOMLs parse, all configured model/effort pairs exist in the
  current local Codex catalog, and migration smoke calls succeeded before the
  current usage-limit stop;
- the role-model evaluation manifest resolves 14 calibration controls and the
  completed 238-cell screen;
- default suite `3.1.0`, finalist manifests `3.2.0`, and harness `1.8.0` pass
  166 tests across 22 files, static manifest validation, semantic
  calibration controls, builder seed/gold controls, and terminal-classification
  regression checks;
- calibration v6 completed 14/14 controls and its human review plus current
  offline replay are preserved in the local ignored results directory;
- the host-side Terminal-Bench bridge passes 17 tests, and the five-task public
  screen has 85 terminal scored results with clean post-run lifecycle checks;
- installed skill frontmatter validates across the local skill roots;
- installed and canonical `local-goal-loop` copies were aligned for that
  release; its JSON/YAML metadata and behavior/trigger eval files validated.
  The later configuration narrows STAGED/CONTROLLED delegation to a selective,
  root-owned decision;
- npm fixture discovery supports both prefix-local and distro package layouts;
  155 evaluation tests outside the nested-namespace lane and every fixture,
  routing, and notes synchronizer test pass. The current execution profile
  rejects Bubblewrap user-namespace creation, so the full isolation lane is
  unavailable rather than bypassed;
- local Codex session records expose structured child and skill evidence, but
  analytics may omit those events; absence from analytics is not proof of
  non-use;
- the latest project routing check covers 38 roots with zero missing configs,
  zero agent drift, and zero project shadows; the previously outstanding
  `marketing` and `research-skill` folders now have the standard thread config;
- a deploy-skill YAML warning caused by a list-valued `description` was fixed by
  making the `description` field a scalar string;
- `README.md`, `HANDOFF.md`, `MEMORY.md`, `NOTES.md`, and this file should be
  updated together when the operating model changes.

For the September configuration migration, minimal authenticated access checks
succeeded for `gpt-6-astra`, `gpt-5.6-sol`, and `gpt-5.6-luna`. Role dispatch,
fallback, profile, concurrency, recursion, per-surface permission, and
preservation results belong in the private migration record. Until those
checks are recorded, treat those behaviors as pending runtime validation rather
than extending the three model-access results.

## Policy Boundary Lessons

- Global and managed project command rules contain no broad `prompt` decisions.
  SSH, file transfer, privilege, service, package, Docker, firewall, and IaC
  work proceeds when the objective includes it and the owning workflow's target
  and recovery checks pass.
- Fresh root and child sessions must resolve `danger-full-access` with approval
  policy `never`. App and configured MCP tool policies use supported automatic
  approval settings. External credentials, MFA, provider confirmation, and
  disconnected accounts remain technical blockers rather than local prompts.
- Historical 0.153.4 checks used a full-bypass wrapper. The September 12
  installation uses the official standalone command and preserves existing
  permission configuration. This maintenance does not rerun destructive probes
  or claim that configuration alone proves every tool's approval behavior.
- The separate machine-wide Browser configuration uses `never_ask` for origin,
  history, download, upload, and CDP access with wildcard allow lists, so an
  unlisted project origin does not create another permission prompt.

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
