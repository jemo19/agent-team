# Astra harness usage audit — 2026-09-12

## Result and evidence

Keep the specialist bench and operational safeguards; reduce default process.
The installed baseline changed from **Astra/high to Astra/low, Standard speed**.
Medium and High remain explicit profiles. The worker cap changed from four to
two, excluding the primary. This is a reversible baseline, not a measured
quality/cost optimum. No percentage saving is claimed.

The operator's linked Pro research was read through Chrome. Its main finding
agrees with OpenAI's [Astra prompting and skill guidance](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra):
activation boundaries and unnecessary process matter more than removing useful
tools indiscriminately. The existing answer and official documentation resolved
the implementation questions; no additional Pro research conversation or billed
benchmark was needed.

## Observed installation and loading

- Codex CLI 0.154.0, Linux, official standalone executable via installation
  symlink; default Codex home. The earlier shell wrapper is not the active
  executable. No upgrade, launcher replacement or upstream patch was made.
- Global configuration had Astra/high, Standard (`service_tier = "default"`),
  Sol/low child fallback and four children. Documentation said Astra/medium.
- No active `model_instructions_file`, injected `developer_instructions`,
  configured fallback filenames or global AGENTS override was found in the
  audited layers. Project config sets the child cap and canonical notes root.
- Model-free `codex debug prompt-input` shows one global AGENTS document and
  one helper-project AGENTS document. Their shared policy repeated the same
  large block; this was content duplication, not two global file loads.
- Skills use progressive disclosure. Catalog presence is not proof the whole
  skill body was loaded. The Impeccable alias resolves to the same skill folder;
  it was not treated as a proven duplicate-load bug or removed.
- Sixteen named roles and four escalation variants were retained byte-for-byte.
  Apps, MCP, authentication, browser policy, sandbox, approval policy, trust,
  cache and compaction settings were preserved.

## Applied changes

1. Shortened global instructions and the marker-managed project block. Keep
   scope, autonomy, target/recovery requirements, secret handling, one-writer
   ownership, required review, truthful checks and completion. Put detailed
   delegation and escalation rules in the existing on-demand reference.
2. Made notes reads conditional on missing context, recovery or relevant past
   decisions. Canonical notes locations and project-specific content remain.
   Long-running work still uses one recovery ledger.
3. Installed Low/Standard bounded-work defaults, a Medium profile and a cap of
   two. Existing Low/High profiles and specialist assignments remain. Updated
   canonical configs, synchronizers and their matching assertions.
4. Replaced the fixed web-delivery itinerary with an outcome-focused entrypoint.
   Retained ownership tracing, bug evidence, browser checks, affected API checks,
   regression proof and independent review for consequential changes.
5. Narrowed the Pro workforce trigger to requested worker-lane orchestration;
   ordinary coding and reading/following up one chat are excluded. Its execution
   protections and invocation-policy metadata were preserved. The optional
   stronger explicit-only setting was not silently imposed.
6. Reconciled active configuration guidance, templates and current summaries.
   Historical evaluation files and pre-existing work remain outside this patch.

Deployment scope: installed user configuration/instructions/skills, 36 managed
project instruction blocks, and 39 project configuration roots. No application,
server, database, customer system or production workload was deployed.

## Skill disposition

| Skill group | Disposition | Reason |
| --- | --- | --- |
| Web project delivery | REWRITE | Shorter outcome guide; preserve web-specific proof and review |
| Local goal loop | KEEP explicit-only | Existing invocation policy already excludes routine selection; align baseline/cap |
| Pro workforce | REWRITE_TRIGGER | Requested worker lanes only; retain all send/recovery/account/model gates |
| Linux maintenance, IaC ops, MSP tickets | KEEP | Narrow domains with material inventory, authorization and recovery requirements |
| Cloudflare tools, browser, artifacts, UI | KEEP | Useful domain/tool knowledge; no demonstrated cause for disabling |
| Bundled/system/plugin skills | KEEP | Leave package-managed content intact |
| Impeccable alias | KEEP | Same resolved folder; no demonstrated double activation |

No skill was deleted or disabled. Explicit-only policy and disabling are
supported separately in [Build skills](https://learn.chatgpt.com/docs/build-skills).
Static trigger examples: a web feature fits web delivery; a typo, deploy-only
request or PR-only review does not. Requested Pro worker lanes fit workforce;
reading an existing conversation does not. These examples were reviewed, not
run as behavioral model evaluations.

## Measured sizes and telemetry limits

| Surface | Before bytes | After bytes |
| --- | ---: | ---: |
| Installed global AGENTS | 8,109 | 4,882 |
| Helper-project AGENTS | 7,579 | 4,723 |
| Web delivery SKILL | 6,649 | 3,383 |
| Rendered prompt text, same ordinary probe | 39,152 | 32,873 |

The prompt measurement precedes the final workforce-description edit and is a
conservative checkpoint. Bytes are not tokens or allowance credits. The prompt
renderer is not a model response and does not establish behavior or savings.

A bounded metadata sample inspected three recent local records (one Astra and
two Sol), excluding this audit. The Astra record contains Low/High/Max contexts,
multiple session metadata records and compactions; the two Sol records report
Medium. A few wait calls were present, but this sample does not establish an
empty-poll storm. Nested code-mode calls and complete parent/child attribution
were not reconstructed. No full-session narratives were loaded for diagnosis.

Last cumulative counters were inspected once per record, never summed across
updates or added to per-event usage. Because records can reset and parent/child
rollups were not resolved, no tree total, subscription-meter conversion or causal
cost claim is made. Cache reads and reasoning are subset fields, not extra
usage to add again. Concurrent activity and allowance resets remain unmeasured.

## Verification

- PASS: TOML parsing and existing setup validator, including all 20 role
  contracts and profile file values.
- PASS: model-free strict app-server config/read resolves Astra/low, Standard,
  cap two, Sol/low fallback, full access and never approval. Low/Medium/High
  effort overrides resolve correctly. Profile files are statically checked;
  a CLI profile-driven inference run was not performed.
- PASS: model-free prompt rendering confirms the global/project loading shape
  and reduced text size; the explicit-only local-goal-loop is absent from the
  ordinary catalog.
- PASS: 26 synchronizer tests; live routing check across 39 roots and invariant
  check across 36 reviewed targets report zero drift/shadows.
- PASS: changed skill frontmatter and source/installed parity; file hash guards
  and semantic comparison preserve all unrelated global config values.
- PASS: package shell/Python syntax and policy behavior (12 hook, five execpolicy
  cases); relevant deterministic checks run separately.
- BLOCKED: full package validation reaches the pre-existing Bubblewrap namespace
  restriction in the evaluation preflight. No isolation boundary was bypassed.
- Separate notes-map diagnostic reports existing missing/mismatched destinations
  and missing project instructions outside this instruction-text change. No
  notes migration or new canonical target was guessed; exact items are private.
- NOT RUN: paid A/B model trials, worker-cap stress test, destructive approval
  probes, production tests and allowance-meter comparisons. No result here
  certifies a particular percentage saving or all future tool behavior.

## Fresh sessions and bounded comparison

Use `codex` for bounded work, `codex --profile root-medium` for ambiguity, or
`codex --profile root-high` for consequential work. `root-low` remains an explicit
alias for the bounded-work baseline. CLI help confirms the native profile-file
mechanism. These profiles retain global instructions; they are not isolated
prompt environments. Existing sessions may retain prior instructions/overrides.
Check the selected model/effort and `/fast status` when launching; do not restart
healthy active jobs merely to adopt this patch.

For a later small comparison, use three matched tasks: a bounded bug fix, a
cross-module feature and a consequential review. Hold starting state and
acceptance criteria constant. Record actual parent/child settings, completed
checks, rework, elapsed time, model responses/waits and correctly interpreted
usage; log allowance-meter movement separately with concurrent activity/reset
notes. Compare one major variable at a time. This is a plan, not an executed
benchmark or a mandatory recurring audit.

## Recovery and ownership

Private backups live outside instruction/skill discovery and public Git, with
original modes, before/after SHA-256 values and an exact file manifest. The local
rollback helper supports preview and selected-file restoration, refuses changed
post-deployment targets, and does not touch other task artifacts. Exact commands
and paths are in the private migration record. Use a scoped Git revert for a
published framework change, not a hard reset of unrelated work.

This maintenance has one owner and no child agents. Public source commits are
limited to its files/hunks; existing uncommitted evaluation work is preserved.
The [instruction-chain documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md),
[subagent controls](https://learn.chatgpt.com/docs/agent-configuration/subagents)
and [speed settings](https://learn.chatgpt.com/docs/agent-configuration/speed)
were checked against the installed CLI rather than assumed from role names.
