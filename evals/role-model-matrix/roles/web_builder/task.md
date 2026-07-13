# Task

Implement `paginateRecords(records, options)` in `src/pagination.mjs` and update
only its test file if useful.

- Return `{ items, nextCursor }` without mutating `records` or its items.
- Sort canonical ISO `createdAt` strings descending, then ASCII `id` strings in
  ascending ECMAScript code-unit order. This ordering must remain stable when
  timestamps tie and when the input order changes.
- `options.limit` defaults to 25 when omitted. Otherwise it must be a string of
  ASCII digits representing 1 through 100. Malformed limits throw `TypeError`
  with code `INVALID_PAGE_SIZE`; out-of-range digit strings throw `RangeError`
  with code `PAGE_SIZE_OUT_OF_RANGE`.
- A missing, `null`, or empty cursor starts the first page. A non-empty cursor is
  canonical base64url JSON with exactly `{ "v": 1, "createdAt": string,
  "id": string }`. Malformed, non-canonical, wrong-version, or wrong-type cursors
  throw `TypeError` with code `INVALID_CURSOR`.
- Continue strictly after the cursor's sort key. Return `nextCursor: null` only
  when no records remain after the returned page.

Do not add dependencies or edit `src/search.mjs`. Run the visible test command
and report files and checks.

Use only the common output fields. Put the implementation and focused-test file
disposition in `actions`, and include ordering, cursor, malformed/range, and
immutability coverage plus command results in `checks`.
