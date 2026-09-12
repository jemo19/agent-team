# Change Surface Checklist

Use only the rows relevant to the requested behavior. Repository instructions and observed ownership override generic expectations.

| Surface | Ownership evidence before editing | Typical risk or review trigger |
|---|---|---|
| UI/rendering | route, component, design-system pattern, current rendered state | accessibility, layout regression, hydration |
| Client state | store/hook/form owner, state transitions, loading/error paths | stale state, race, optimistic rollback |
| Server/API | route/server action, validation, service boundary | error semantics, authorization, compatibility |
| Authentication/authorization | identity source, policy check, resource owner | security review required |
| Data model/schema | schema, repository/query layer, migration history | integrity, backfill, rollback, real-DB apply boundary |
| Jobs/queues | producer, consumer, retry/idempotency contract | duplicate/lost work, ordering |
| Cache | key ownership, invalidation, fallback source | stale or cross-tenant data |
| Third-party integration | adapter/client, timeout/retry mapping, fixture | external failures, rate limits, secret boundary |
| Observability | existing logs/metrics/traces and error reporting | sensitive data, noisy or missing signal |
| Public contract | types/schema/API consumed outside the owner | compatibility and independent review |

Before implementation, state which rows are affected and which are explicitly not affected. If evidence reveals a new surface, update the plan before editing that surface.
