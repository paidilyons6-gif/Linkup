# LinkUp

LinkUp is a link-in-bio site for coaches and programme sellers. Visitors can take a guided sales quiz or browse a hub, then continue to the creator's checkout.

| Plan | Monthly price | Features |
| --- | --- | --- |
| Launch | €9 | Public hub, themes and media |
| Guide | €19 | Sales quiz, welcome video, tap analytics and no LinkUp badge |
| Scale | €29 | Email capture and CSV export. Broadcasts require a configured sending domain. |

Building and previewing are free. Website builds are handled separately through the inquiry form at `/services.html`.

## Run and verify

Use Node.js 24 or newer.

```sh
npm ci
npm run dev
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

The local site opens at http://localhost:4173. `/page.html?demo=1` shows the marketing quiz. `/build` opens the studio. `/:slug` renders an eligible public page. The browser suite uses mocked Supabase responses, and the billing suite uses mocked Stripe and Supabase responses.

## Deploy

Netlify publishes only `site/`. That directory contains `_redirects` and `_headers`, so it also works as a manual deploy. Download the `LinkUp-Netlify` artifact from a passing GitHub Actions push run, unzip it and upload the folder containing `index.html` to the existing Netlify project. The archived original export is retained for reference.

The hosted Supabase project is configured in `site/config.js` using its public URL and anon key. `supabase/functions/` contains the Edge Function source and `supabase/migrations/` contains schema updates for the existing backend. See [setup.md](setup.md), [PRODUCTION.md](PRODUCTION.md) and [the backend contract](docs/backend-contract.md).
