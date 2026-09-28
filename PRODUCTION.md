# Production checklist — LinkUp

Live site: https://linkupping.netlify.app

## Done in product

- [x] Legal pages filled with operator details (Paidi Lyons / DocKit, Cappoquin, Waterford)
- [x] Warning banners removed from Privacy / Terms
- [x] Stripe business profile URL → https://linkupping.netlify.app
- [x] Stripe support email → paidilyons6@gmail.com
- [x] Statement descriptor → LINKUPPING
- [x] Prices Launch €9 / Guide €19 / Scale €29
- [x] Scale copy notes broadcasts need sending domain
- [x] Website builds inquiry-only to paidilyons6@gmail.com

## You must do (blocking)

### 1. Paste a fresh Supabase access token
Project **linkup** is online again (Auth health OK). The old `sbp_…` token is **rejected (401)**.

1. Open https://supabase.com/dashboard/account/tokens  
2. Create a token and paste it in the agent chat  
3. Agent will install the new Stripe webhook secret (`STRIPE_WEBHOOK_SECRET`) — without this, **paid plans never activate** after Checkout

A replacement Stripe webhook endpoint is already created and waiting:
`we_1UKaSHFYCRiWqwhQ8DCmQDhm` → `…/functions/v1/stripe-webhook`

### 2. Rotate secrets pasted in chat
- Stripe → Developers → API keys → roll the restricted key, send the new `rk_live_…` (or `sk_live_…`)
- Supabase → Account → Access Tokens → revoke the old `sbp_…`, create a new one

### 3. One paid path test (after Supabase is back)
1. Sign up at /account.html  
2. Buy Guide (€19) with your card  
3. Confirm plan badge shows Guide  
4. Publish → open `https://linkupping.netlify.app/yourslug`  
5. Cancel in Stripe Customer Portal → page should stop resolving  

### 4. Resend (only if selling Scale broadcasts)
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
