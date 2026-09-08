# LinkUp

The link-in-bio that **sells programmes**.

Visitors land on a guided sales quiz (or a simple hub), get matched to the
right offer, and leave to your checkout. You keep **100%** of programme sales.

Static site — no npm build. Open locally or deploy the folder to Netlify.

## Done-for-you websites (agency add-on)

Separate from software. Sold at signup or via `services.html`:

| Package | Setup | Care / mo | Includes |
|---|---|---|---|
| Software only | — | LinkUp plan only | Quiz/hub; client uses own checkout links |
| Sales page | €1,490 | €79 | One offer page, quiz wiring, Stripe link, hosting |
| Site + domain | €2,900 | €129 | Up to 5 pages, domain, hosting, monthly tweaks |

Client uploads videos/content. End users only see the quiz → page → buy path.
Leads are captured in the browser and opened as a mailto until you plug a CRM.

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
