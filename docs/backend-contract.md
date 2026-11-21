# Backend contract

The hosted Supabase project implements the original static backend. The checked-in migrations add quiz fields, plan gating and permission hardening to that baseline. A fresh environment requires the baseline schema from the existing project.

## Browser API

| Operation | Contract |
| --- | --- |
| `profiles` | Owner's editable profile fields, including `mode`, `quiz`, `links` and `published`. The Studio saves through PATCH with a returned representation. |
| `subscriptions` | Owner-readable plan, status and current period end. Only trusted billing code writes subscription state. |
| `subscribers` | Owner reads and exports their list. Anonymous signup uses `join_list`, with server-side checks for publication, capture and Scale eligibility. |
| `media` bucket | Public media URLs and uploads within the authenticated user's folder. Enforce file types and size in Storage. |
| `public_profile(p_slug)` | Published and eligible profiles only. Returns renderer keys such as `welcomeVideo`, `captureEnabled`, `mode` and `quiz`. Restricted fields depend on the subscription plan. |
| `slug_available(p_slug)` | Boolean. Enforce uniqueness and reserve system routes in the database. |
| `record_tap(p_profile_id, p_label)` | Bounded anonymous analytics event for a live profile. |
| `tap_counts()`, `sent_this_month()` | Current owner's analytics and sending usage. |
| `unsubscribe(p_token)` | Idempotent token-based unsubscribe. |
| `delete_me()` | Authenticated account deletion with billing safeguards. |

Auth provisions a profile on signup. Supabase RLS and storage policies enforce owner isolation.

## Server endpoints

- `create-checkout` maps the requested plan to a server-configured Stripe price. A known Stripe subscription goes through a Customer Portal plan change. First purchases use hosted Checkout.
- `billing-portal` opens the authenticated customer's Stripe portal.
- `stripe-webhook` verifies the signature and synchronises subscriptions. Failed database writes return an error for Stripe retry.
- `send-broadcast` requires Scale and configured Resend secrets. Before enabling it, verify atomic quota handling under concurrent sends, reliable delivery accounting and bounce/complaint suppression. The interactive unsubscribe page accepts a browser visit. An RFC 8058 one-click POST flow would require a server endpoint.

See [setup.md](../setup.md) for staging verification and [PRODUCTION.md](../PRODUCTION.md) for the live check results.
