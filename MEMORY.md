# Agent Team Memory

Last updated: 2026-07-12

## Durable Decisions

- This repo is the public reusable Agent Team framework for Codex CLI.
- Public docs must stay generic and reusable.
- Exact local state belongs in ignored private files or a separate private ops
  repo.
- If committed history contains private local state, publish from fresh
  sanitized history before making the GitHub repo public.
- Subagents may be used by default for non-trivial, parallelizable work, but
  production, privileged, destructive, customer-visible, and hard-to-reverse
  actions still require explicit human approval.
- Completed subagent threads should be closed after their useful findings are
  consolidated into the main thread. Stale completed agents can exhaust the
  active thread cap and block later scouting.
- Do not use a generic catch-all SSH prompt rule in reusable rules when exact
  project deploy commands are allow-listed locally; the most restrictive
  matching rule wins.
- If a local exec-policy check says a command is allowed but the outer command
  runner rejects it, record that as a launcher/session approval boundary rather
  than a repo rules failure.
- Skill frontmatter must keep `description` as a scalar YAML string. A local
  deployment skill warning was fixed on 2026-06-19 by quoting the description,
  and installed skill validation passed afterward.
- The Agent Team model baseline is GPT-5.6: use `gpt-5.6-sol` for demanding
  orchestration, implementation, planning, architecture, and review; use
  `gpt-5.6-terra` for read-heavy and support roles. Reserve `gpt-5.6-luna` for
  deterministic, high-volume work.
- Do not retain a copied older-model base prompt through
  `model_instructions_file` during a model upgrade. Remove or revalidate the
  override so the selected model receives its current shipped instructions.
- Treat current model/effort routing as a benchmark control. Evaluate role
  behavior with frozen synthetic fixtures, deterministic gates, trace and usage
  evidence, repeated finalists, and human review before changing routing.
- Keep public benchmark results separate from the internal role-model suite.
  The July 12 Terminal-Bench 2 five-task screen completed 85 comparable cells;
  its small sample and overlapping intervals do not support a routing change.
- Harbor's built-in Codex subscription adapter copies reusable authentication
  into task containers. Use the tested host-side bridge, keep candidate tools
  bounded to the task environment, and require artifact/security cleanup gates.
- The role-model suite is at `1.4.2` with harness `1.3.1` and 69 tests across
  12 files. It runs through local `codex exec` with existing Codex
  authentication; V1 does not contain custom Responses/Evals API request code.
  Candidate calls use Codex-plan usage while deterministic graders and reports
  are local.
- Ultra collaboration-call records are not the same as observable children.
  Use `observed`, `none_observed`, or `identity_unavailable`; when child
  identities are unavailable, keep the delegation assertion indeterminate,
  report score bounds, and never substitute zero or award points for waits.
- Keep Codex authentication only in the outer client namespace. Route every
  model-generated shell command through the nested command namespace where
  auth, control, artifacts, suite, and hidden paths are not mounted; require the
  native boundary probe before execution. Freeze and digest reviewed preflight
  artifacts and settings, and stop scheduling on unexpected runner exceptions.
- Treat same-fixture repeats as stability evidence only. A routing
  recommendation requires each finalist to pass at least three distinct
  fixtures, all required human review, and a separate operator approval.
- Calibration v6 is the current control evidence: human review found 13 role
  passes and one supported `customer_comms` failure. Offline replay under suite
  `1.4.2` / harness `1.3.1` preserves that 13/1 result while correcting only
  observed harness and lexical-classification defects.
- The atomic Luna/max semantic judge is shadow-only. Protocol 3.1 requires
  15/15 agreement in both forward and reverse passes, zero critical false
  passes, zero policy/tool/schema/process errors, and never changes scores or
  routing.
- The July 12 screen completed all 238 cells, but grader brittleness and a
  root-orchestration classification anomaly invalidate headline rankings.
  Preserve raw evidence, fix/version the grader, and regrade offline before
  finalist stability work.

## Public/Private Split

Public:

- framework docs;
- generic examples;
- reusable templates;
- custom-agent definitions;
- skill templates;
- validation scripts.

Private:

- real server/project/customer maps;
- internal IPs, SSH aliases, Tailscale names, and host details;
- private repo inventory;
- customer tickets and customer systems;
- credential references and secret-manager item names.

Ignored local-private patterns:

```text
private/
*.private.md
*.private.yaml
```

## Current Agent Model and Effort Routing

Root surfaces:

- root orchestration: `gpt-5.6-sol`, `ultra`
- interactive Plan mode: `gpt-5.6-sol`, `xhigh`

Global agents:

- `customer_comms`: `gpt-5.6-terra`, `medium`
- `iac_planner`: `gpt-5.6-sol`, `xhigh`
- `infra_planner`: `gpt-5.6-sol`, `xhigh`
- `infra_recon`: `gpt-5.6-terra`, `high`
- `msp_triage`: `gpt-5.6-terra`, `medium`
- `risk_reviewer`: `gpt-5.6-sol`, `xhigh`
- `test_mapper`: `gpt-5.6-terra`, `medium`
- `web_builder`: `gpt-5.6-sol`, `high`
- `web_scout`: `gpt-5.6-terra`, `medium`

Project-local agents:

- `project_architect`: `gpt-5.6-sol`, `xhigh`
- `project_builder`: `gpt-5.6-sol`, `high`
- `project_reviewer`: `gpt-5.6-sol`, `xhigh`

## Validation Commands

```bash
bash scripts/validate-package.sh
git diff --check
node evals/role-model-matrix/scripts/validate.mjs
node evals/role-model-matrix/scripts/run.mjs --phase screen --dry-run
```

Prepared local review artifacts:

```text
evals/role-model-matrix/results/2026-07-09-gpt56-role-calibration-v6/human-calibration-review.md
evals/role-model-matrix/results/2026-07-10-semantic-judge-pilot-v3-1-retry-preflight/preflight.md
evals/role-model-matrix/results/2026-07-10-gpt56-role-screen-v4/preflight.md
```

Installed skill validation:

```bash
for root in ~/.codex/skills ~/.agents/skills /mnt/c/docs/skills; do
  [ -d "$root" ] && find "$root" -name SKILL.md -printf '%h\n'
done | sort | while IFS= read -r skill_dir; do
  python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py "$skill_dir"
done
```

Recommended public-risk scan:

```bash
rg -n -i "(password|passwd|secret|token|api[_-]?key|private[_-]?key|credential|keepass|\\.env|BEGIN .*PRIVATE KEY|ssh-rsa|ssh-ed25519|ghp_|github_pat_|AKIA|cloudflare|stripe|resend|mfa|totp|cookie|session|tailscale|192\\.168\\.|100\\.)" .
```

Review scan output manually. Some matches are expected in security docs and
generic templates; real values are not acceptable.

## Next Maintainer Notes

- Keep `README.md`, `HANDOFF.md`, `NOTES.md`, and this file synchronized.
- Keep `docs/14-project-and-infra-team-map.md` and
  `docs/15-current-state.md` public-safe.
- Do not add generated bytecode, local logs, evidence output, or build scratch
  files to Git.
- Use fresh sanitized Git history before public visibility changes if private
  content was committed earlier.
