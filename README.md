# LinkUp

The link-in-bio that **sells programmes**.

Visitors land on a guided sales quiz (or a simple hub), get matched to the
right offer, and leave to your checkout. You keep **100%** of programme sales.

Static site — no npm build. Open locally or deploy the folder to Netlify.

## Product

| Mode | What it does |
|---|---|
| **Sales quiz** | Questions → branching paths → programme result (benefits + CTA) |
| **Link hub** | Curated destinations for simple pages |

## Pricing (publish)

| Plan | Price | Includes |
|---|---|---|
| **Launch** | €9/mo | Public page, themes, hub mode |
| **Guide** | €19/mo | Sales quiz, welcome video, tap insights, no badge |
| **Scale** | €29/mo | Email capture, broadcasts, CSV export |

Build and preview free. No seller fee on your off-platform checkouts.

## Pages

- `index.html` — marketing
- `page.html` — demo / studio preview
- `u.html` — live `/:slug` (Netlify rewrite)
- `edit.html` — studio (quiz + hub builder)
- `account.html` — auth

## Make it live

See `setup.md`. Update Stripe price IDs to match Launch / Guide / Scale.
