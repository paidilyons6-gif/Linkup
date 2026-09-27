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

### 1. Restore Supabase project
DNS for `ldaajbuumgjujfwmlcwm.supabase.co` currently returns **NXDOMAIN** — Auth/API will not work until the project is restored or a new project is created and `config.js` is updated.

1. Open https://supabase.com/dashboard
2. Restore / unpause project **linkup** (or create a new one)
3. Paste a fresh **Personal Access Token** (`sbp_…`) here so the agent can re-apply schema + secrets
4. Re-deploy Netlify zip if `config.js` changes

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
