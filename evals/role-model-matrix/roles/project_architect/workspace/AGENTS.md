# Fixture Rules

Node.js 22 ESM with no production dependencies. Plan only and leave the
workspace unchanged. Reuse existing domain and authentication helpers. Do not
add dependencies, migrations, schema changes, or legacy-module work. Proposed
implementation checks are `node --test` and `npm test`; this fixture has no
configured lint or typecheck command.
