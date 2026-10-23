# Production checklist — LinkUp

Live site: https://linkupping.netlify.app

## BusinessByBecca — go / no-go

**Verdict (2026-10-23): READY for client signups — not “absolutely” perfect.**

- **Yes** for the core loop Becca needs: clients sign up → build a quiz → pay Launch/Guide/Scale → publish a bio link.
- **No** if “absolutely” means every marketed feature and zero ops debt. Scale *broadcasts*, reliable password-reset email, and secret rotation are still open.

| Check (re-run 2026-10-23) | Result |
|---------------------------|--------|
| Auth health | **200** |
| Netlify matches repo | **OK** — royal red `#9b1c2e`, `[hidden]` veil fix, assets `?v=20261008b`, CSS/JS `must-revalidate` |
| Checkout without session | **401** `Not signed in` (expected) |
| Legal pages | **OK** — Paidi Lyons / DocKit details; no warning banners |
| Becca account | **OK** — `r.lyons1@icloud.com`, plan `business` / `active` to 2027-10-08 |
| Becca public page | **OK** — https://linkupping.netlify.app/bybecca (`public_profile('bybecca')` returns quiz) |
| Marketing demo | **OK** via `page.html` / hero iframe (`LinkUp.DEMO`). There is **no** seeded DB slug `demo` (`public_profile('demo')` → null) |
| Paid path (trial → webhook → publish) | Verified previously with live webhook; re-run needs a Stripe key in this environment |
| Scale broadcasts | **Not configured** — `send-broadcast` needs Resend secrets |
| Auth confirm / reset email | **Weak** — Confirm email OFF; no custom SMTP yet |

**Do send clients to** https://linkupping.netlify.app/account.html  
**Keep Supabase project Active** (do not pause) or Auth will 502 and onboarding dies.

Website builds and Scale email broadcasts are **not** required for that core loop.

### What to tell Becca / clients

- Safe signup URL: https://linkupping.netlify.app/account.html
- Pitch: bio quiz → match → their checkout (Stripe/Kajabi/etc.); software from €9/mo; website builds quoted by email.
- Do **not** promise yet: “email your whole list from LinkUp”, or bulletproof password-reset email.
- If Becca’s phone still shows the **old green** editor or “Upgrade to Guide”, close the tab and reopen (or clear site data). Live site is royal red with veils fixed; that screenshot was a stale phone cache.

### Becca’s live page

- Slug: **`bybecca`** (not `businessbybecca`)
- Public: https://linkupping.netlify.app/bybecca
- Comped Scale (`business` / `active`) so welcome video, quiz, and email capture are unlocked in the studio once the fresh CSS is loaded.

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
- [x] Royal red marketing + editor; website prices only at end of `services.html`
- [x] Editor upgrade veils respect `[hidden]` (paid users no longer see Guide overlays)
- [x] Asset cache-bust (`?v=`) + CSS/JS `max-age=0, must-revalidate`

## Verified (live)

- Auth health OK
- Marketing `/`, `/services.html`, `/privacy.html`, `/terms.html`, `/page.html` OK
- Becca signed in OK; subscription `business`/`active`; public slug `/bybecca` OK
- `create-checkout` rejects anonymous callers
- Unpaid publish blocked (prior session: `Publish requires an active Launch, Guide, or Scale plan`)
- Trial → webhook → `subscriptions.plan=premium` → publish (prior session)

Active Stripe webhook: `we_1UKbVsFYCRiWqwhQFNZFfoyY` →  
`https://ldaajbuumgjujfwmlcwm.supabase.co/functions/v1/stripe-webhook`

## You should still do (operator — needs your credentials)

These are **not** code tasks. Paste new keys in chat only if you want the agent to apply Edge Function secrets.

### 1. Rotate secrets pasted in chat (hygiene — do soon)
- Stripe → Developers → API keys → roll the restricted/secret key; update Edge Function `STRIPE_SECRET_KEY`
- Supabase → Account → Access Tokens → revoke old `sbp_…` tokens
- Core loop works today; this closes the leaked-in-chat risk

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

Until step 3 is done: email *capture* on Scale works; *sending* broadcasts returns “not configured”.

## Known product gaps (documented, not day-one blockers)

- **Video transcoding** — uploads capped at 100 MB, served as-is (heavy on mobile data).
- **Bounce / complaint webhooks** — Resend bounce handling not wired; dead addresses stay on lists until then.
- **`public_profile('demo')`** — no seeded demo profile in Supabase; the site demo is the client-side `LinkUp.DEMO` on `page.html`.

## Operator details used on legal pages

```
Paidi Lyons trading as LinkUp (DocKit)
Kilbree, Cappoquin, Co. Waterford, P51 P403, Ireland
paidilyons6@gmail.com
```
