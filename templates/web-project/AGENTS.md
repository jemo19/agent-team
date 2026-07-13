# Project AGENTS.md

Replace placeholders before serious use.

## Project summary

- Name: <project name>
- Type: web application
- Runtime/framework: <Next.js / Remix / Django / Rails / Laravel / etc.>
- Package manager: <npm / pnpm / yarn / uv / poetry / cargo / etc.>
- Database: <none / Postgres / MySQL / SQLite / etc.>
- Deployment target: <VPS / Docker / Vercel / etc.>

## Setup commands

```bash
<install command>
```

## Development commands

```bash
<dev server command>
```

## Checks

```bash
<test command>
<typecheck command>
<lint command>
<build command>
```

## Conventions

- Follow existing project style.
- Keep changes scoped to the goal.
- Do not add dependencies without explicit approval.
- Do not change deployment, auth, database schema, migrations, or secrets handling unless the goal explicitly requires it.
- Do not mix broad formatting with behavior changes.

## Environment and secrets

- Do not read or print `.env*` files unless explicitly approved.
- Do not commit secrets.
- Use `.env.example` for documentation.

## Agent workflow

Use:

```text
GOAL -> PLAN -> INVOKE SUBAGENTS -> EXECUTE -> CHECK -> REVIEW -> HUMAN GATE -> RECORD EVIDENCE
```

For non-trivial work, create a goal file in `.agentic/goals/`.

- Subagents may be used by default for bounded read-only scouting, test mapping,
  docs lookup, and independent review when they reduce wall-clock time.
- After consolidating useful results from a completed subagent, close that agent
  thread so stale agents do not exhaust the thread cap.
