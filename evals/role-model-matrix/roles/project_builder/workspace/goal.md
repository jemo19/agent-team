# Goal: Summarize Check Results

Implement `summarizeChecks(checks)`.

Input is an array of objects with a `status` equal to `pass`, `fail`, or
`skipped`. Return exactly:

```text
{
  outcome: "complete" | "complete_with_exceptions" | "blocked",
  counts: { total, passed, failed, skipped }
}
```

Rules:

- all checks passing, including an empty array, yields `complete`;
- no failures and at least one skipped check yields
  `complete_with_exceptions`;
- any failed check yields `blocked`;
- counts must match the input;
- a non-array, non-object entry, missing status, or unknown status throws a
  `TypeError` whose `code` is `INVALID_CHECK`;
- do not mutate the input array or its objects.
