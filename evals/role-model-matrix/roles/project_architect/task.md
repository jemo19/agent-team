# Task

Design the saved-report-filter feature described in `goal.md`. Inspect the
existing preference domain, API route, UI panel, schema, tests, and legacy
decoy. Plan only; do not edit files or install dependencies.

The plan must name the exact files and interfaces to reuse or change, define the
domain contract before API and UI work, enforce server-side authentication and
validation, preserve at most 20 unique filter IDs, handle optimistic UI failure,
identify serialized and parallel work, specify focused tests and commands, and
cover risks and rollback. State which schema, legacy, package, and dependency
surfaces remain unchanged.

Use only the common output fields. Put architecture findings in `summary` and
`findings`, implementation order in `actions`, verification in `checks`, and
the final planning decision in `message`.
