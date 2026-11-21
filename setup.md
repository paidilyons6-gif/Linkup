# LinkUp setup

## Frontend

The Netlify project publishes the `site/` directory from the repository root. The root `netlify.toml` rewrites `/build` to the studio before applying the public profile fallback. Keep the deployed origin and the allowed Auth callbacks aligned, including `/account.html` for recovery. A frontend deploy leaves the Supabase project and Stripe settings as configured.

## Supabase

The connected project is `ldaajbuumgjujfwmlcwm`. Its public URL and anon key appear in `site/config.js`. Keep the service-role key in the server's secret store.

The two checked-in migrations depend on the deployed static application's baseline schema. Export the baseline from the existing project to provision a clean staging instance. The older React schema in the original ZIP uses a different data model. See [the backend contract](docs/backend-contract.md) before applying schema updates.

Deploy the functions from the repository root after linking to the intended staging project. The operations below use the Supabase CLI's configured credentials.

```sh
supabase functions deploy create-checkout --project-ref <project-ref>
supabase functions deploy billing-portal --project-ref <project-ref>
supabase functions deploy send-broadcast --project-ref <project-ref>
supabase functions deploy stripe-webhook --project-ref <project-ref>
```

The webhook uses its Stripe signature, and its JWT gateway setting is in `supabase/config.toml`.

## Stripe test mode

Set these Edge Function secrets in the intended Supabase project.

| Secret | Purpose |
| --- | --- |
| `SITE_URL` | Netlify origin used for CORS and return URLs |
| `STRIPE_SECRET_KEY` | Stripe key for this environment |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this environment's webhook endpoint |
| `STRIPE_PRICE_BASIC` | Monthly EUR Launch price (€9) |
| `STRIPE_PRICE_PREMIUM` | Monthly EUR Guide price (€19) |
| `STRIPE_PRICE_BUSINESS` | Monthly EUR Scale price (€29) |

Configure Stripe Tax and enable the Customer Portal, including cancellation, payment method changes and plan changes for the three LinkUp prices. Subscribe the webhook endpoint at `/functions/v1/stripe-webhook` to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`.

Use a test account to subscribe to Launch, publish a hub, change the existing subscription to Guide, publish a quiz and cancel. Confirm the same Stripe subscription ID survives the upgrade and that subscription state changes reach Supabase. Repeat a webhook delivery to verify the final state. See [Stripe's portal flow documentation](https://docs.stripe.com/customer-management/portal-deep-links).

## Email

Configure a verified Resend domain before enabling broadcasts. Set `RESEND_API_KEY`, `BROADCAST_FROM`, and optionally `MONTHLY_EMAIL_CAP` (default 2000 recipients per month) as Edge Function secrets. Test unsubscribe, suppressions and quota enforcement with a staging list. Configure Supabase Auth SMTP separately and test a complete password reset with the deployed callback.
