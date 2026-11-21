# LinkUp production status

Live site: https://linkupping.netlify.app

## Read-only checks on November 21, 2026

- The homepage, signup, public profile, services and legal routes returned HTTP 200.
- Supabase Auth health and public RPCs responded. The API returned a published profile for `bybecca`, rejected `build` as a reserved slug and returned null for a new slug.
- All four Supabase Edge Function routes responded. The three account routes rejected GET, and the webhook rejected the unsigned check.
- The live `/build` route returned the public profile template. The live public renderer also expected legacy field names for fields that the API supplies in camelCase, including capture and welcome video. The repository fixes both and requires a frontend deploy to take effect.

## Deployment and verification

1. Deploy the combined release to a Netlify preview using the root configuration. Confirm `/build` reaches the studio and `/bybecca` still uses the public renderer. Check the live project mapping before promoting the preview.
2. In an isolated Supabase and Stripe test environment, verify signup, password recovery, the first purchase, an upgrade of that subscription, publish, cancellation and webhook retry. Enable price changes in the Stripe Customer Portal for the configured LinkUp prices.
3. Deploy the updated backend functions after the Stripe test succeeds. Monitor webhook delivery and confirm that billing updates reach the editor. Keep the live and test Stripe keys and webhook secrets separate.

Earlier production notes recorded a successful paid path in October 2026. This release did not repeat that live purchase or modify any production account, payment, email settings or deployment.

## Email and operator access

- Password recovery needs a tested Supabase Auth SMTP setup. The prior production notes recorded no custom SMTP.
- Scale email capture and CSV export are distinct from broadcasts. The prior production notes recorded broadcasts as unconfigured. Before enabling them, verify the Resend sending domain, quota handling, recipient suppression and unsubscribe behavior in staging.
- Manage credentials in the service dashboards or the environment's secret manager. Rotate any credentials previously shared in chat.
