# LinkUp

A link-in-bio with a welcome video and your offers as a **composed pinboard** —
not another grey list of buttons.

Static site. No build step, no npm, no framework. Open `index.html` locally or
drag the folder onto Netlify.

## Pages

| | |
|---|---|
| `index.html` | Marketing — hero stage, how it works, pricing, FAQ |
| `page.html` | Demo / preview of a customer page |
| `u.html` | Public customer page (`/:slug` via Netlify rewrite) |
| `edit.html` | Studio editor with live phone preview |
| `account.html` | Sign up / sign in |

`tokens.css` is shared foundations. `site.css` styles marketing. `editor.css`
styles the studio. `linkup.css` styles a customer page — kept separate so a
customer theme never reaches the marketing site.

`linkup.js` is the profile shape, themes, shapes, and renderer shared by the
live page and the editor preview. `api.js` talks to Supabase. `config.js` holds
the two public keys.

## Working now

- Welcome video with play, skip, and hand-off when it ends
- Background video (silent, looping) or still image
- Pinboard objects: bubble, polaroid, sticker, ticket, note, pill — place, size, reorder
- Five themes + glass / solid / outline looks
- Email capture (Business)
- Live preview that updates as you type

## Make it live

See **`setup.md`** — Supabase, Netlify, Stripe. About an hour of keys and
dashboards.

## Still not built

- Sending email to a list at scale (Resend + caps) — capture and export work
- Real analytics beyond tap counts
- Video transcoding (uploads capped and served as-is)
