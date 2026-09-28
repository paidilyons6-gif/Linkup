#!/usr/bin/env bash
# Apply a Stripe webhook signing secret to Supabase Edge Function secrets.
# Usage:
#   SUPABASE_ACCESS_TOKEN=sbp_... ./scripts/apply-webhook-secret.sh whsec_...
set -euo pipefail
REF="${SUPABASE_PROJECT_REF:-ldaajbuumgjujfwmlcwm}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN}"
SECRET="${1:?Pass whsec_... as first argument}"

curl -sS -A 'Mozilla/5.0' -X POST "https://api.supabase.com/v1/projects/${REF}/secrets" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "[{\"name\":\"STRIPE_WEBHOOK_SECRET\",\"value\":\"${SECRET}\"}]"
echo
echo "Set STRIPE_WEBHOOK_SECRET on ${REF}. Create a trial subscription to verify."
