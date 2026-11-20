# LinkUp

A mobile-first link-in-bio site with a welcome video, floating offers, five themes, and an editor that previews the actual public-page renderer.

The editable static site lives in `site/`. The original `deploy-6a7266cc5030ed69864a1f9f.zip` is retained unchanged for provenance; it also contains an older React application and database migrations that are **not compatible with this static app's API contract**. They are not deployed.

## Run locally

Use Node.js 24 or newer:

```sh
npm ci
npm run dev
```

Open http://localhost:4173. `/page.html?demo=1` is the example profile; `/build` opens the account editor. The demo never collects emails. Local serving supports the same clean `/:slug` profile addresses as Netlify.

## Verify

```sh
npm run check
npm test
npx playwright install chromium
npm run test:browser
```

Checks validate JavaScript syntax and local asset references. Unit tests cover rendering, URL safety, upload validation, token-refresh concurrency, and storage failures. Browser tests cover mobile and desktop marketing, recovery links, public-page errors, live preview, publishing failures/success, and ordered saves. Account/API browser tests use mocked Supabase responses; they do not verify a live backend or make payments. GitHub Actions runs these checks on pushes and pull requests.

## Deploy

The root `netlify.toml` publishes **only `site/`**, keeping the ZIP, tests, and development files out of the public deployment. `/build` resolves before the public-profile fallback. No frontend build step is needed.

`site/config.js` contains the public Supabase URL and anon key from the export. An anon key is a browser credential, not a server secret. Database access must be enforced with row-level security. Never add a service-role key or Stripe secret to `site/`.

**Backend integration must be verified before charging customers.** The archive does not contain the backend required by the static site. See [docs/backend-contract.md](docs/backend-contract.md) for the exact expected interface and launch blockers. Deploying the frontend does not install database functions, Stripe billing, or email delivery.

## Pages

| Path | Purpose |
| --- | --- |
| `/` | Marketing, pricing, FAQ |
| `/account.html` | Signup, sign-in, password recovery |
| `/build` | Editor with live preview, media uploads, plan controls |
| `/page.html?demo=1` | Fixed example profile |
| `/:slug` | Published profile from the backend |
| `/unsubscribe.html` | Token-based email unsubscribe page |

`site/linkup.js` is the shared renderer. `site/api.js` implements the browser API. `tokens.css` provides shared foundations; marketing and profile styles stay separate so customer themes do not affect the main site.
