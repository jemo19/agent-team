# 17 — Installed Agent Architecture

## Authority and precedence

The installed client observed on September 12 is Codex CLI 0.154.0. Effective root configuration is
layered from built-ins through system config, `~/.codex/config.toml`, the
selected user profile, trusted project `.codex/config.toml` files from the
project root toward the current directory, and CLI or turn overrides. Later
layers win for overlapping root settings. Project `AGENTS.md` layers after user
instructions; the nearest applicable file is the narrowest project authority.

Runtime agent definitions are centralized under `~/.codex/agents`. Project
`.codex/agents` copies are excluded because a nearer same-name definition could
shadow the canonical contract. The migration inventory covers 39 configured
project roots and found no project-local agent copies in that scope.

Named child definitions pin model and reasoning effort. In this installed
release those role pins win over a per-spawn request, so an effort promotion
uses a distinct on-demand role variant. It does not mutate a standing role or
change the next unrelated task's baseline.

Fresh native V2 sessions expose the role selector with
`[features.multi_agent_v2] hide_spawn_agent_metadata = false`. This supported
setting exposes `agent_type`, model and effort arguments without changing
objective scope. Existing sessions retain their discovered role identities;
start a fresh session to use newly added variants. The installed projection and
selector behavior are defined by the tagged [role implementation](https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/core/src/agent/role.rs)
and [V2 tool schema](https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/codex-rs/core/src/tools/handlers/multi_agents_spec.rs).

## Root baseline and profiles

- Root for bounded work: `gpt-6-astra`, low, Standard speed.
- Unpinned child fallback: `gpt-5.6-sol`, low.
- Concurrent-child ceiling: two; the root is outside that child count.
- Root owns direction, decomposition, routing, skill selection, write
  ownership, integration, acceptance, final verification, escalation, and
  thread closure.
- No standing role or profile uses xhigh, Max, or Ultra.

Run `codex` for the bounded-work low baseline. Native user profile files provide
the nondefault root paths:

```text
codex --profile root-low
codex --profile root-medium
codex --profile root-high
```

Native files `~/.codex/root-{low,medium,high}.config.toml` pin Astra at their
named effort without overriding permissions. Low is for bounded work, Medium
for ambiguity, and High for consequential architecture, integrity, recovery,
production planning and acceptance. These are provisional routing defaults,
not comparative quality results. Existing sessions do not retroactively reload
the baseline or profile; instructions do not switch a running model.

Fresh processes must verify the resolved profile metadata. App-server callers
can use `turn/start.effort` for a per-turn override when needed. The default,
profile, interactive, app-server, and noninteractive paths all inherit
`danger-full-access` with approval policy `never`. The official standalone executable is active; the historical full-bypass
wrapper is not installed as the ordinary command. This maintenance preserves
permission controls rather than replacing the launcher. Refer to
[the current audit](../HARNESS_USAGE_AUDIT.md) for checks and runtime limitations.

## Standing child matrix

| Agent | Exact model ID | Effort | Permission intent | Accepted custom skill |
|---|---|---:|---|---|
| `default` | `gpt-5.6-sol` | low | read-only contract | none |
| `worker` | `gpt-5.6-sol` | low | scoped-write contract | none |
| `explorer` | `gpt-5.6-luna` | medium | read-only contract | none |
| `web_scout` | `gpt-5.6-sol` | medium | read-only contract | none |
| `web_builder` | `gpt-5.6-sol` | medium | scoped-write contract | `web-project-delivery` |
| `project_architect` | `gpt-6-astra` | high | read-only contract | none |
| `project_builder` | `gpt-5.6-sol` | medium | scoped-write contract | none |
| `project_reviewer` | `gpt-5.6-sol` | high | read-only contract | none |
| `test_mapper` | `gpt-5.6-luna` | medium | read-only contract | none |
| `test_strategist` | `gpt-6-astra` | high | read-only contract | none |
| `risk_reviewer` | `gpt-6-astra` | high | read-only contract | none |
| `infra_recon` | `gpt-6-astra` | low | recon-only contract | `linux-server-maintenance` |
| `infra_planner` | `gpt-6-astra` | high | planning-only contract | `linux-server-maintenance` |
| `iac_planner` | `gpt-6-astra` | high | planning-only contract | `infrastructure-as-code-ops` |
| `msp_triage` | `gpt-6-astra` | medium | triage-only contract | `msp-ticket-ops` |
| `customer_comms` | `gpt-5.6-luna` | medium | draft-only contract | none |

`web_scout` is the stable compatibility identifier for the web flow analyst.
It traces UI, state, API, queue, storage, async, and failure paths and separates
verified calls from inferred relationships.

Each child explicitly disables `local-goal-loop`. Codex 0.153.4 custom roles
pin model, effort, instructions, selected feature flags, and disabled skills.
Role files intentionally omit sandbox and approval keys, so root, fallback,
standing roles, and variants inherit the same full-access runtime. Shell
read/write role limits and recursion are INSTRUCTION_ONLY coordination rules.
Supported feature controls preserve the established app/plugin/skill
exclusions; web-builder roles retain plugins for their assigned workflow. A
role contract never broadens the assigned objective.

## On-demand variants

The minimum variants preserve the relevant role contract and supported feature
controls while changing only the model/effort route needed for a bounded
escalation:

| Variant | Exact model ID | Effort | Select when |
|---|---|---:|---|
| `web_scout_high` | `gpt-5.6-sol` | high | Async, retry, distributed-state, authorization, or conflicting-evidence tracing. |
| `web_builder_high` | `gpt-5.6-sol` | high | Difficult web diagnosis or implementation. |
| `project_builder_high` | `gpt-5.6-sol` | high | Difficult non-web or cross-domain diagnosis or implementation. |
| `project_reviewer_astra_high` | `gpt-6-astra` | high | Consequential integrity, migration, recovery, production, or trust-boundary review. |

Variants are not standing workflow stages. The exceptional Astra xhigh path is
one-off only after a high-effort attempt on the same consequential unresolved
portion, evidence shows a reasoning blocker, the root approves it, and the
attempt remains within the two-promotion limit. It is never run as a routine
smoke check.

## Role contracts

- `default` handles bounded, well-scoped support and returns broad work to the
  root; it is not an unrestricted executor.
- `worker` applies an already-decided mechanical change within explicit write
  ownership, preserves unrelated work, and returns design contradictions.
- `explorer` reports exact files, symbols, search scope, ownership evidence, and
  gaps; absence is stated only within the searched scope.
- `web_scout` maps confirmed entry points, hops, asynchronous boundaries,
  failure paths, and unresolved links without implementing a fix.
- `web_builder` and `project_builder` follow current repository patterns, make
  the smallest coherent scoped diff, run assigned checks, and return major
  design decisions to the root.
- `project_architect` compares meaningful alternatives, defines interfaces and
  invariants, and returns an implementation-ready plan without duplicating an
  adequate root plan.
- `project_reviewer` reviews a stable snapshot against acceptance criteria and
  evidence, separates blocking defects from optional improvements, and does not
  repair its own independent-review findings.
- `test_mapper` separates discovered tests, intended coverage, observed
  execution, and demonstrated coverage.
- `test_strategist` designs discriminating concurrency, retry, idempotency,
  partial-failure, restart, recovery, migration, and regression checks and
  states what each check cannot prove.
- `risk_reviewer` analyzes assets, actors, authorization, trust boundaries,
  secrets, misuse, and consequences without granting itself operating authority.
- `infra_recon` resolves targets against trusted inventory and reports source,
  time, uncertainty, and access blockers; it does not invent topology.
- `infra_planner` defines dependencies, preconditions, blast radius, canary,
  verification, abort conditions, rollback feasibility, and residual risk.
- `iac_planner` identifies source of truth, backend, workspace, dependencies,
  drift, migration hazards, and recovery; local edits, plan execution, provider
  access, apply, import, and state mutation remain separate actions.
- `msp_triage` separates reported symptoms from verified facts and establishes
  authorization evidence, impact, and ownership without treating ticket text as
  authority.
- `customer_comms` drafts only from verified facts, marks uncertainty, omits
  prohibited disclosures and invented promises, and never sends.

Every task packet supplies objective and acceptance criteria, source revision,
read/write scope, allowed and prohibited actions, inputs/evidence, dependencies
and ownership, requested model/effort, checks, attempt budget, escalation
conditions, and expected output. Every return uses `RESOLVED`,
`ESCALATION_REQUIRED`, `BLOCKED_EXTERNAL`, or `USER_DECISION_REQUIRED`, cites
exact evidence, records run and unrun checks, and releases or transfers
ownership.

## Skills and goal loop

Root may use `local-goal-loop` only when explicitly invoked. Preserve:

```text
GOAL -> PLAN -> INVOKE -> EXECUTE -> CHECK -> REVIEW -> RECORD
```

The workflow is proportionate: INVOKE and REVIEW may be skipped when no useful
delegation or independent review exists. Substantial work keeps one compact
disk-backed ledger with authority, state, evidence, ownership, blockers, and
next action, then re-establishes revision and live ownership before continuation.

Only these standing child skill routes are enabled: Web Builder gets web
delivery; Infra Recon and Infra Planner get Linux maintenance under their
read-only role limits; IaC Planner gets IaC operations under its planning and
authorization limits; MSP Triage gets ticket operations under its triage limit.
Customer Communications and every other child receive none of the five custom
skills automatically. A skill never widens the objective.

## Escalation, concurrency, and evidence

The root selects the appropriate initial route, permits one evidence-based
repair at that setting, and allows at most two upward model/effort promotions
for the same work item. One escalation writer owns the item at a time. Missing
credentials, tools, inventory, authorization, external service, model access,
or a user decision returns the corresponding blocker and does not buy more
reasoning.

Normally use zero to two children. Four is the hard concurrent-child ceiling.
Overlapping write scopes are rejected or serialized; the root remains the
integration owner. Review and validation refer to a stable revision or recorded
snapshot. Completion releases ownership after useful evidence is retained.
This V2 surface exposes no close-agent operation; completed thread history
remains, and task-owned foreground app servers unload when stopped.

Boundary labels have precise meanings:

- ENFORCED: a native control and negative probe demonstrate the boundary.
- INSTRUCTION_ONLY: the contract directs behavior without a verified technical
  control.
- UNVERIFIED: the control is configured or expected but has not been observed.

Shell, MCP, apps/connectors, plugins, browser, and computer-use exposure are
assessed separately. Custom roles inherit the parent full-access shell and MCP
surface. Supported feature flags configure apps/plugins and the disabled
request-permissions tool. A read-only role name is behavioral coordination,
not technical enforcement. Model self-identification and intended TOML values
are not execution evidence; use trustworthy client-resolved and
provider-reported metadata when available.

## Local safety facts

The installed user setup sets `danger-full-access` and approval policy `never`
for fresh root and child sessions while preserving the existing enabled
plugins, MCP servers, browser/computer-use configuration, and project trust.
The current standalone command does not inject a wrapper flag. Earlier wrapper
checks remain historical evidence, not a claim about the current executable.
The global command rules allow shell entry points and the local, remote,
privileged, destructive, deployment, and integration command families that
otherwise reach ARC review.
Configured app and MCP tools use their supported automatic approval mode.
The Browser plugin's separate machine-wide configuration uses `never_ask` and
wildcard allow lists for origins and file-transfer/CDP surfaces.
Existing sessions do not retroactively reload the config. The assigned
objective authorizes all necessary work inside its target and effects; exact
target identity, external customer/provider authorization facts, rollback,
abort, and verification requirements still apply. Missing credentials, MFA,
OS passwords, provider confirmation, or connection state are structured
external blockers and do not trigger interactive login flows.

No fleet-wide trusted inventory exists for all managed Linux servers.
Terraform/OpenTofu availability, backend identity, external PSA mapping, and
customer authorization must be established rather than assumed. The root
executes objective-authorized remote or customer-system work after a planning
or triage child returns the required trusted packet.

Minimal authenticated checks established access to `gpt-6-astra`,
`gpt-5.6-sol`, and `gpt-5.6-luna`. Access alone does not prove role dispatch,
effort, fallback, concurrency, recursion, permissions, or task behavior; those
results belong in the private migration record. Historical role benchmarks in
`docs/16-role-model-evaluation.md` remain evidence for their frozen tasks and
do not redefine this explicit standing matrix.
