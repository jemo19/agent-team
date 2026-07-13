# Agent Team Handoff

Last updated: 2026-07-12

## Current State

This repository is being prepared as the public `agent-team` framework repo.
It contains reusable Codex CLI operating docs, templates, custom-agent
definitions, skill templates, runbooks, and validation scripts.

Exact local environment state is intentionally not public. Keep it in ignored
private files or a separate private ops repository.

## Current Operating State

- The local goal loop is:

```text
GOAL -> PLAN -> INVOKE SUBAGENTS -> EXECUTE -> CHECK -> REVIEW -> HUMAN GATE -> RECORD EVIDENCE
```

- Subagents have standing authorization for non-trivial, safely parallelizable
  work. After their useful findings are consolidated, close completed subagent
  threads so stale agents do not exhaust the active thread cap.
- Model routing uses the GPT-5.6 family by role. Root orchestration, builders,
  architecture, infrastructure planning, and risk review use `gpt-5.6-sol`;
  scouts, test mapping, infrastructure recon, triage, and customer comms use
  `gpt-5.6-terra`. `gpt-5.6-luna` remains unassigned until a deterministic,
  high-volume role justifies it.
- Reasoning effort remains role-based, not "maximum everywhere": architecture,
  infrastructure planning, and risk review use `xhigh`; bounded builders and
  infra recon use `high`; scouts, test mappers, triage, and customer comms use
  `medium`.
- The current root control is `gpt-5.6-sol` at `ultra`; interactive Plan mode
  remains `xhigh`. The role-model evaluation program treats every installed
  assignment as a control rather than an assumed winner.
- `docs/16-role-model-evaluation.md` and `evals/role-model-matrix/` define the
  reviewable 14-role, 17-configuration benchmark. Static validation and dry
  runs are non-billed; raw traces stay ignored; routing changes require a
  separate human gate after repeat and trace review.
- The benchmark is at suite `1.4.2`, harness `1.3.1`, with 69 tests across 12
  files. It retains the Sol Ultra isolation-pilot lessons: empty wait calls are
  not proof of delegation, missing child identity produces an honest score
  interval, and model-generated shell commands run in a probed nested
  namespace without auth/control paths.
- Calibration v6 completed all 14 production controls. Human review found 13
  semantic passes and one supported `customer_comms` failure. Replay of the
  preserved traces under the current suite/harness also yields 13 passes and
  one failure; the replay fixes only demonstrated parser, recovered-transport,
  and paraphrase-classification defects.
- The Luna/max atomic semantic judge remains shadow-only. The fresh
  protocol-3.1 pilot completed but failed its shadow acceptance gate, so it did
  not change deterministic scores.
- The July 12 internal screen completed all 238 cells. Human review invalidated
  headline rankings because of lexical/field-placement false negatives and a
  root-orchestration classification anomaly. Production routing is unchanged.
- The separate Terminal-Bench 2 public lane completed 85 scored cells across
  all 17 configurations and five pinned tasks. Sol/xhigh and Terra/ultra each
  scored 4/5, with wide overlapping intervals. Treat this as a small public
  screen, not a routing decision; see
  `evals/public-benchmarks/terminal-bench-2/RESULTS-2026-07-12.md`.
- The runner uses local `codex exec` with existing Codex authentication. It
  does not implement custom Responses or Evals API calls; candidate turns use
  Codex credits while deterministic graders and reports run locally.
- The July 2026 migration removed the installed `model_instructions_file`
  override that copied GPT-5.5 base instructions. The old file remains local
  but inactive; current GPT-5.6 models now receive their shipped instructions.
- A generic catch-all SSH prompt rule should not live in reusable rule
  templates when exact project deploy commands are allow-listed locally. Codex
  resolves multiple matching rules to the most restrictive decision, so generic
  prompt rules can override narrower allows.
- If `codex execpolicy check` allows a deploy command but the command runner
  still rejects it, treat that as a session/launcher approval boundary. Do not
  bypass it by hiding the SSH command; restart in an interactive approval-capable
  session or use a documented external shell/runner.
- Installed skill frontmatter validation passed on 2026-06-19 across the local
  skill roots. The project deploy skill warning caused by a YAML list-valued
  `description` was fixed by making `description` a scalar string.
- Project-specific deployment skills and exact host/runbook details are local
  extensions. Keep their private operational facts in project docs or private
  notes, not in the public framework docs.

## Public Boundary

Safe to keep public:

- reusable workflow docs;
- generic examples;
- Codex config templates;
- custom-agent templates;
- skill templates;
- project and ops-control skeletons;
- validation scripts.

Do not commit:

- exact server names, IPs, SSH aliases, or private network details;
- real customer names, tickets, systems, or contact details;
- private repo names that should not be public;
- `.env` files, tokens, keys, MFA codes, cookies, Terraform state, plan files,
  or credential references.

## Private Local State

The repo ignores these patterns:

```text
private/
*.private.md
*.private.yaml
```

Recommended private files:

```text
private/current-state.private.md
private/project-map.private.md
private/servers.private.yaml
private/projects.private.yaml
```

Before public release, detailed local maps were preserved locally under
`private/`. They must remain untracked.

## Agent Routing

Root surfaces:

- root orchestration: `gpt-5.6-sol`, `ultra`
- interactive Plan mode: `gpt-5.6-sol`, `xhigh`

Global templates:

- `web_scout`: `medium`
- `web_builder`: `high`
- `test_mapper`: `medium`
- `risk_reviewer`: `xhigh`
- `infra_recon`: `high`
- `infra_planner`: `xhigh`
- `iac_planner`: `xhigh`
- `msp_triage`: `medium`
- `customer_comms`: `medium`

Project-local templates:

- `project_architect`: `xhigh`
- `project_builder`: `high`
- `project_reviewer`: `xhigh`

## Evaluation Campaign Next Actions

1. Version the internal suite/harness fixes for semantic assertion brittleness
   and root-orchestration terminal classification.
2. Offline-regrade the preserved 238-cell screen without rewriting frozen raw
   evidence, then independently review the new grader.
3. For the public lane, freeze and oracle-validate a stratified ten-task cohort
   before any larger campaign or general model claim.

## Public Release Checklist

Before making the repo public:

1. Run `bash scripts/validate-package.sh`.
2. Run a public-risk scan for secrets and local environment details.
3. Remove generated files such as `__pycache__/`.
4. Confirm `private/` files are ignored and untracked.
5. Publish from fresh sanitized history if previous commits contained private
   local state.
6. Verify the GitHub repo visibility after changing it to public.

## Maintenance Notes

- Update `README.md`, `HANDOFF.md`, `MEMORY.md`, `NOTES.md`, and
  `docs/15-current-state.md` together when the public operating model changes.
- Update `docs/15-current-state.md` for public release state only.
- Put exact local maps in ignored private files, not checked-in docs.
- Treat this repo as reusable framework source; use local ops/private notes for
  exact server, project, customer, and credential context.
