# Making LinkUp live

About an hour, mostly waiting on other people's dashboards. Do it in this
order — each step depends on the one before.

This repo is a **static site** (HTML/CSS/JS). There is no Vite, npm, or Lovable
build. Deploy the folder as-is to Netlify.

What's left is creating the accounts and pasting keys, which only you can do.

---

## 1. Supabase — DONE

Project `linkup`, ref **`ldaajbuumgjujfwmlcwm`**, eu-west-1 (Ireland), in the
free `Linkup` organisation. €0/month. It is deliberately NOT in the Bodies by
Becca organisation — that would have shared one `auth.users` table between two
unrelated businesses, so a LinkUp signup would have been a valid login to the
fitness app.

Both schema files are run. `config.js` already has the URL and anon key in it.

**Quiz columns (add if missing):** the studio saves `mode` and `quiz` on
`profiles`. Run this once on the Supabase SQL editor if those columns are absent:

```sql
alter table public.profiles
  add column if not exists mode text not null default 'quiz',
  add column if not exists quiz jsonb not null default '{}'::jsonb;
-- Ensure public_profile() (or your public read path) returns mode + quiz.
```

Verified against the live project:

| check | result |
|---|---|
| new signup gets a page automatically | yes |
| published page, no plan | refused |
| Basic | page served, welcome video withheld, badge shown |
| Premium | welcome video unlocked, badge gone |
| Business | email capture unlocked |
| subscription cancelled | page stops resolving |
| stranger reads `profiles` directly | blocked |
| customer sets their own plan to business | blocked |
| customer takes a reserved address like `admin` | blocked |

**One thing left here:** Authentication → Providers → Email → turn
**"Confirm email" OFF** until you've added real SMTP. Supabase's built-in mail
is rate-limited to a few an hour and lands in spam, so with confirmation on
most signups stall on day one.

> The **service_role** key must never go in `config.js` or anywhere in this
> folder. It bypasses row-level security entirely and belongs only in the Edge
> Function secrets.

---

## 2. Netlify

1. Drag this folder onto netlify.com, or connect the repo.
2. Add your domain. `netlify.toml` already routes `/anything` to a customer's
   page, keeps the real pages working, and sets the security headers.
3. Note the live URL — you need it in the next step as `SITE_URL`.

Check: visiting `yoursite.com/notarealname` should show "Nothing here yet".

---

## 3. Stripe

1. Create three **recurring** products, monthly, in EUR: **€9 Launch**, **€19 Guide**,
   **€29 Scale**. Copy each **price ID** (`price_...`, not the product id).
   Map them to secrets `STRIPE_PRICE_BASIC` (Launch), `STRIPE_PRICE_PREMIUM` (Guide),
   `STRIPE_PRICE_BUSINESS` (Scale).
2. **Stripe Tax → enable.** These are digital services sold across the EU, so
   VAT is charged where the customer is. `create-checkout` already asks Stripe
   to work it out; without Tax enabled that request fails.
3. Deploy the functions (from `backend/`, with the Supabase CLI logged in):

```
supabase functions deploy create-checkout --project-ref <your-ref>
supabase functions deploy billing-portal  --project-ref <your-ref>
supabase functions deploy send-broadcast  --project-ref <your-ref>
supabase functions deploy stripe-webhook  --project-ref <your-ref> --no-verify-jwt
```

**`--no-verify-jwt` on the webhook is not optional.** Stripe sends its own
signature header, not a Supabase token. Deploy it without that flag and the
gateway rejects every call with a 401 the function never sees — payments
succeed, nobody gets a plan, and there is nothing in the function logs to
explain it.

4. Stripe → **Developers → Webhooks → Add endpoint**:
   `https://<your-ref>.supabase.co/functions/v1/stripe-webhook`
   Events: `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the **signing secret** (`whsec_...`).
5. Supabase → **Edge Functions → Secrets**, add:

```
STRIPE_SECRET_KEY       sk_live_… (or sk_test_… while you're testing)
STRIPE_WEBHOOK_SECRET   whsec_…
STRIPE_PRICE_BASIC      price_…
STRIPE_PRICE_PREMIUM    price_…
STRIPE_PRICE_BUSINESS   price_…
SITE_URL                https://yoursite.com
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

6. In Stripe, turn on the **Customer Portal**
   (Settings → Billing → Customer portal) and allow cancelling and updating
   the card. That's what the "Manage billing" button opens. In the EU
   cancelling has to be as easy as subscribing, so this isn't optional.

---

## 3b. Resend — for emailing lists (Business plan)

Skip this if you're not selling Business yet; everything else works without it.

1. resend.com → add your domain → add the DNS records it gives you
   (SPF, DKIM, and DMARC). **Do not send from an unverified domain** — it goes
   straight to spam and damages the domain for good.
2. Add to the Supabase Edge Function secrets:

```
RESEND_API_KEY      re_…
BROADCAST_FROM      Your Name <hello@yourdomain.com>
MONTHLY_EMAIL_CAP   2000
```

`MONTHLY_EMAIL_CAP` is per account, per calendar month, counted in recipients.
Set it deliberately: "unlimited" against a fixed €15 is unbounded cost, and one
customer mailing a list they bought will burn your sending reputation for
everybody else.

---

## 4. Test it end to end, in Stripe test mode

Use `sk_test_…` and a test webhook secret first. Card `4242 4242 4242 4242`,
any future expiry, any CVC.

1. Sign up at `/account.html`.
2. Pick an address. It should say it's yours as you type.
3. Try **Publish** — it should be refused with no plan.
4. Buy **Basic**. You come back and the badge says Basic.
5. Publish. Open `yoursite.com/youraddress` in a private window — the page
   should be there, with the "Made with LinkUp" badge.
6. Check the welcome video is still locked. Upgrade to **Premium**; it unlocks
   and the badge disappears from the public page.
7. Cancel the subscription in Stripe. Within a moment the plan drops to none
   and the public page stops resolving.

**If step 4 doesn't change the badge**, the webhook isn't landing: check
Stripe → Webhooks for a 200, and that you deployed with `--no-verify-jwt`.

Then swap the secrets to live keys and repeat step 4 once with a real card.

---

## 5. Before you take real money

- **Sign-in email.** Supabase's built-in mail is rate-limited and lands in spam.
  Put your Resend credentials into Authentication → SMTP Settings as well, then
  turn "Confirm email" back on. Without this, password resets don't arrive.
- **Fill in the legal pages.** `terms.html` and `privacy.html` are written and
  linked, and they describe accurately what the software does — but the company
  name, address and contact email are placeholders, and neither has been read by
  a solicitor. Both carry a visible warning banner until you remove it. Stripe
  will ask for these URLs.
- **Decide what "your own web address" means.** It's promised on Premium.
  Everyone currently gets `yoursite.com/theirname`, which is honest for that
  wording. A real custom domain per customer (`beccalyons.com`) means
  provisioning a certificate each time — a different amount of work.

---

## Still not built

- **Video transcoding.** Uploads are capped at 100 MB and served as-is. Someone
  who uploads a 90 MB clip serves 90 MB to every visitor on mobile data. The
  editor asks for short files; nothing enforces it beyond the cap.
- **Bounce and complaint handling.** Resend will tell you about bounces via its
  own webhook, but nothing here listens yet. Until it does, a dead address stays
  on a list forever and counts against the monthly ceiling.

## How the pieces fit

```
Netlify (static)                  Supabase                     Stripe
  index.html   marketing            profiles      ← editor
  account.html sign in/up           subscriptions ← webhook only
  edit.html    editor               subscribers   ← capture form
  u.html       /:slug  ────────────► public_profile()  ← the only public read
  page.html    the demo             storage/media ← uploads
```

`public_profile()` is the whole gate: it returns nothing for an unpublished
page or an unpaid account, and it nulls the welcome video and the capture form
unless the plan covers them. Downgrading takes features away on its own, with
no cleanup job to forget.
