# Web Checks

Fill in project-specific commands.

## Universal

```bash
git status --short
git diff --check
git diff --stat
```

## Project-specific

```bash
<test command>
<typecheck command>
<lint command>
<build command>
```

## Review checklist

- Goal satisfied.
- No out-of-scope files.
- Tests cover new/changed behavior.
- No unexpected dependencies.
- No secrets.
- No auth/data/security regression.
- Final summary lists checks run.
