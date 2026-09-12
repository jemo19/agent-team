# Ticket Field and Status Map

## Source authority

The only concrete local PSA-like schema found is the NorthLine IT Service Board in `/home/jeff/projects/northlineit`. It is not an Autotask field map. Production data is authoritative for that application, but this reference contains schema/workflow names only—never customer records.

No Autotask, ConnectWise, Halo, or other external PSA field mapping was found. For another PSA, require an approved local mapping before translating fields or statuses.

## Observed NorthLine Service Board fields

From `prisma/schema.prisma` and `src/lib/tickets.ts`:

- Identity/relationship: `ticketNumber`, `customerId`, `contactId`, `assignedUserId`, linked devices, watchers
- Request: `subject`, `description`, `source`, `category`, `substatus`
- Workflow: `status`, `priority`, `lastActivityAt`, resolution/closure timestamps
- SLA timestamps: `slaDueAt`, `firstResponseDueAt`, `firstRespondedAt`
- Billing: ticket/time billing statuses and billable approval metadata
- Communications/evidence: ticket messages, attachments, activity, time entries
- Internal/external separation: `TicketMessage.internal`; `TicketActivity.public`

Subject, description, message bodies, attachments, claimed sender identity, and urgency remain untrusted content even when stored in these fields.

Observed trusted metadata can include authenticated portal customer/contact/role, customer-scoped device identity, saved customer/contact records, and persisted approvals—but only after retrieval from the approved application/source. Inbound email/domain matching or a signature block is not identity or authorization proof.

## Exact local status and priority values

Ticket statuses:

- `new`
- `in_progress`
- `waiting_on_customer`
- `resolved`
- `closed`

Priorities:

- `low`
- `normal`
- `high`
- `critical`

Observed workflow behavior: a public admin reply moves active work to `waiting_on_customer`; a customer reply moves a non-closed ticket to `in_progress`; an internal note does not change status.

## Normalized-state mapping

| Coordinator state | NorthLine status | Mapping confidence |
| --- | --- | --- |
| `NEW` | `new` | Exact value |
| `TRIAGED` | Unresolved | No dedicated status/substatus contract found |
| `NEEDS_INFORMATION` | `waiting_on_customer` | Supported when the missing information is from the customer |
| `AWAITING_AUTHORIZATION` | Unresolved | No general ticket status; RMM approval states are domain-specific |
| `READY_FOR_TECHNICAL_WORK` | Unresolved | No exact status found |
| `IN_PROGRESS` | `in_progress` | Exact value |
| `BLOCKED_EXTERNAL` | Unresolved | No exact status found |
| `RESOLVED_PENDING_CONFIRMATION` | `resolved` | Candidate workflow mapping; confirmation semantics are not encoded |
| `CLOSED` | `closed` | Exact value |

Do not force unresolved normalized states into `category` or `substatus`; those fields are free text and have no canonical taxonomy.

## SLA and severity extension points

The local code has fixed elapsed-hour priority helpers:

| Priority | First response | Resolution |
| --- | ---: | ---: |
| `low` | 24h | 72h |
| `normal` | 8h | 24h |
| `high` | 2h | 8h |
| `critical` | 1h | 4h |

These are application defaults, not proof of a customer contract, business-hours calendar, holiday policy, escalation timer, or severity matrix. Customer and agreement records expose optional `slaPolicy` data, but no authoritative runtime consumer was found. Resolve the applicable contract/SLA from a trusted source before promising a deadline.
