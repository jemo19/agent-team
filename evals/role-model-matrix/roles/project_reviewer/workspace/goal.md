# Goal: Report List Limit

Add a `limit` query parser for report listing.

Contract:

- missing values (`undefined`, `null`, or `""`) use the default 20;
- otherwise accept only string ASCII digits representing an integer from 1
  through 50 inclusive;
- every other value throws `TypeError` with `code = "INVALID_LIMIT"`;
- change only the parser implementation and focused tests;
- keep the existing CI command and all unrelated files unchanged.
