# Task

Implement `parsePageSize` in `src/pagination.mjs` and update only its test file if useful. Missing values (`undefined`, `null`, or `""`) return 25. Accept only string ASCII digits representing 1 through 100. Malformed values throw `TypeError` with code `INVALID_PAGE_SIZE`; digit strings outside the range throw `RangeError` with code `PAGE_SIZE_OUT_OF_RANGE`. Do not trim input, clamp values, or edit the consumer. Run the visible test command and report files and checks.

Use only the common output fields. Put the implementation and focused-test file
disposition in `actions`, and include malformed/range coverage plus command
results in `checks`.
