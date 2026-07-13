# Goal: Schedule Check Dependencies

Implement `scheduleChecks(checks)` as a pure function. Each check is
`{ id: string, dependsOn: string[] }`. Return deterministic execution layers as
an array of arrays of check IDs. Every layer contains all currently-ready checks
in lexicographic order; dependencies must appear in earlier layers.

Reject a non-array, malformed checks, duplicate IDs, duplicate dependencies,
unknown dependencies, and self-dependencies with `TypeError` code
`INVALID_CHECK_GRAPH`. Reject every cycle with `Error` code
`CHECK_GRAPH_CYCLE`. Never mutate the input or its nested dependency arrays.
