#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: new-ticket.sh <customer_slug> <request text>

Creates a local Markdown ticket. Do not include secrets in request text.
EOF
}

if [[ "${1:-}" == "--help" || $# -lt 2 ]]; then
  usage
  exit 0
fi

CUSTOMER="$1"
shift
REQUEST="$*"
DATE="$(date +%F)"
SLUG="$(echo "$REQUEST" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//' | cut -c1-50)"
mkdir -p tickets
FILE="tickets/${DATE}_${CUSTOMER}_${SLUG}.md"
cat > "$FILE" <<EOF
# Ticket: ${REQUEST}

## Metadata

- Date: ${DATE}
- Customer: ${CUSTOMER}
- Requester:
- Source:
- Authorization status: unknown
- Urgency: unknown
- Risk: unknown

## Request

${REQUEST}

## Triage

## Missing information

## Plan

## Approval

## Execution notes

## Verification

## Closeout
EOF

echo "$FILE"
