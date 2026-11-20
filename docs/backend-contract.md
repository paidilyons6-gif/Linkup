# Backend integration status

The static files in the original export refer to a backend that is not included. The exported `supabase/migrations` instead describe the older React app: fields such as `display_name`, `is_published`, a `profile-media` bucket, and billing on `profiles`. The static app expects `name`, `published`, a `media` bucket, and a separate `subscriptions` table. **Do not apply those migrations as the backend for this frontend.** The exported setup guide also references absent `backend/` functions.

This change restores the frontend and tests it with mocks. It does not alter a live database, authenticate real customers, send email, or run checkout. The following contract documents what a compatible backend must provide.

## Tables and storage

- `profiles`: `id`, `user_id`, `slug`, `name`, `handle`, `tagline`, `avatar_url`, `theme`, `bubble_style`, `welcome_video_url`, `background_video_url`, `background_image_url`, `links` (JSON array), `capture_enabled`, `capture_heading`, `published`, and optional timestamps. Owners can read/update their own editable fields only. The API requests update representations; an empty update is treated as a failed save.
- `subscriptions`: owner-readable `plan`, `status`, `current_period_end`. Only trusted billing code may write subscription state.
- `subscribers`: `profile_id`, `email`, `created_at`, `unsubscribed_at`. Owner reads and strictly restricted visitor inserts. Consent, duplicate handling, abuse protection, and unsubscribe behavior need verification.
- `taps`: public insert of `profile_id` and `label`, only for published profiles. Apply length limits and abuse protection; counts are advisory.
- Storage bucket `media`: public media URLs; owner-folder uploads, server-enforced file types and 100 MB size limit. Browser validation is only a convenience.

Supabase Auth must provision a profile when an account is created, allow the deployed origin and `/account.html` recovery callback, and enforce email confirmation as configured. The frontend serializes refreshes within a tab; cross-tab refresh-token coordination should also be verified against the deployed Auth settings.

## Database RPCs

| Name | Arguments | Expected result |
| --- | --- | --- |
| `public_profile` | `p_slug` | A renderer-shaped object or null: `id`, `name`, `handle`, `tagline`, `avatar`, `theme`, `bubbleStyle`, `welcomeVideo`, `backgroundVideo`, `backgroundImage`, `links`, `captureEnabled`, `captureHeading`, `badge` |
| `slug_available` | `p_slug` | Boolean; reserve system routes including `build`, `account`, `edit`, `page`, `u`, `privacy`, `terms`, `unsubscribe` |
| `tap_counts` | None | Array of `{label, taps}` for the current owner's last 30 days |
| `sent_this_month` | None | Current owner's monthly email count |
| `unsubscribe` | `p_token` | Boolean; validate an unguessable token and unsubscribe idempotently |
| `delete_me` | None | Delete the authenticated account's data with billing cleanup enforced server-side |

Public profile reads must return only published profiles with eligible subscriptions, filter plan-restricted video/capture features, and omit all billing and account information. Slug uniqueness, reserved routes, ownership and plan checks belong on the server. The frontend's checks cannot enforce entitlement.

## Edge functions

| Function | Input | Output |
| --- | --- | --- |
| `create-checkout` | `{plan}` | `{url}` for a Stripe-hosted checkout; validate plan/price mapping and authenticated customer |
| `billing-portal` | Empty object | `{url}` for that customer's Stripe portal |
| `send-broadcast` | `{subject, body}` | `{sent, remaining}` with server-enforced limits, consent, and suppression |

A verified, idempotent Stripe webhook must be the authority for subscription updates. Ensure upgrade handling cannot create duplicate subscriptions. Email delivery needs an authenticated sending domain, bounce/complaint handling, unsubscribe suppression, and a defined monthly send allowance. The static unsubscribe HTML page handles interactive visits only; RFC 8058 one-click POST requests need an actual server endpoint.

## Remaining launch checks

Verify real signup and recovery, owner isolation with two accounts, anonymous public reads, subscriber insertion restrictions, uploads, Stripe test-mode purchase/upgrade/cancel/webhook retries, broadcast limits, unsubscribe suppression, and account deletion. Confirm the listed prices and claims match the implemented plan entitlements. None of these live-service checks are covered by the frontend mock tests.
