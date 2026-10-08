# Production checklist — LinkUp

Live site: https://linkupping.netlify.app

## BusinessByBecca — go / no-go

**Verdict (re-checked): READY for client signups — with hygiene still open.**

Becca’s loop (clients sign up → build a page → pay → publish a bio link) is working again:

| Check | Result |
|-------|--------|
| Auth health | **200** (earlier 502 was transient; project responds) |
| Signup → profile | **OK** |
| Live Checkout (Guide/premium) | **OK** — returns `checkout.stripe.com` |
| Unpaid publish blocked | **OK** |
| Public demo | **OK** (`public_profile('demo')`) |
| Marketing site polish | **Live** on Netlify |
| Paid path (trial → plan → publish) | Verified previously with live webhook; re-run needs Stripe key in this environment |

**Do send clients to** https://linkupping.netlify.app/account.html  
**Keep Supabase project Active** (do not pause) or Auth will 502 again and onboarding dies.

Website builds and Scale email broadcasts are **not** required for that core loop.

## Done in product

- [x] Legal pages filled with operator details (Paidi Lyons / DocKit, Cappoquin, Waterford)
- [x] Warning banners removed from Privacy / Terms
- [x] Stripe business profile URL → https://linkupping.netlify.app
- [x] Stripe support email → paidilyons6@gmail.com
- [x] Statement descriptor → LINKUPPING
- [x] Prices Launch €9 / Guide €19 / Scale €29
- [x] Scale copy notes broadcasts need sending domain
- [x] Website builds inquiry-only to paidilyons6@gmail.com
- [x] `STRIPE_WEBHOOK_SECRET` installed; live Stripe → `stripe-webhook` activates plans
- [x] Webhook handler supports Stripe API `2026-03-25.dahlia` (`current_period_end` on items)

## Verified (live)

- Auth health OK; signup → profile OK
- `create-checkout` returns live Stripe Checkout URL
- Unpaid publish blocked (`Publish requires an active Launch, Guide, or Scale plan`)
- Trial subscription via Stripe → webhook sets `subscriptions.plan=premium` within seconds (prior session)
- Paid publish → `public_profile` + `https://linkupping.netlify.app/<slug>` OK (prior session)
- Live site `/`, `/privacy.html`, `/terms.html`, `/demo` OK

Active Stripe webhook: `we_1UKbVsFYCRiWqwhQFNZFfoyY` →  
`https://ldaajbuumgjujfwmlcwm.supabase.co/functions/v1/stripe-webhook`

## You should still do

### 1. Rotate secrets pasted in chat (hygiene — do soon)
- Stripe → Developers → API keys → roll the restricted/secret key; update Edge Function `STRIPE_SECRET_KEY`
- Supabase → Account → Access Tokens → revoke old `sbp_…` tokens
- Paste new tokens in the agent chat if you want a fresh paid-path re-verify after rotation

### 2. Optional smoke test with a real card
1. Sign up at /account.html  
2. Buy Guide (€19)  
3. Confirm plan badge shows Guide  
4. Publish → open `https://linkupping.netlify.app/yourslug`  
5. Cancel in Stripe Customer Portal → page should stop resolving  

### 3. Resend (only if selling Scale broadcasts)
Add Edge Function secrets:
- `RESEND_API_KEY`
- `BROADCAST_FROM` (e.g. `LinkUp <hello@yourdomain.com>`)
Verify the domain in Resend (SPF/DKIM/DMARC).  
Optional: use the same SMTP in Supabase Auth, then turn **Confirm email** back on.

## Operator details used on legal pages

```
Paidi Lyons trading as LinkUp (DocKit)
Kilbree, Cappoquin, Co. Waterford, P51 P403, Ireland
paidilyons6@gmail.com
```
