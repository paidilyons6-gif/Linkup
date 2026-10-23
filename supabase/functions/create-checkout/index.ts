// Starts a Stripe Checkout session for one plan.
// Price IDs come from secrets — never from the browser.

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL')!;

const PRICES: Record<string, string | undefined> = {
  basic: Deno.env.get('STRIPE_PRICE_BASIC'),
  premium: Deno.env.get('STRIPE_PRICE_PREMIUM'),
  business: Deno.env.get('STRIPE_PRICE_BUSINESS'),
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '').trim();
  if (!jwt) return json({ error: 'Not signed in' }, 401);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${jwt}` },
  });
  if (!userRes.ok) return json({ error: 'Not signed in' }, 401);
  const user = await userRes.json();
  if (!user?.id) return json({ error: 'Not signed in' }, 401);

  const { plan } = await req.json().catch(() => ({ plan: '' }));
  const price = PRICES[plan];
  if (!price) return json({ error: 'Unknown plan' }, 400);

  const subRes = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?select=stripe_customer_id&user_id=eq.${user.id}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  const existing = subRes.ok ? (await subRes.json())[0] : null;

  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', price);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', `${SITE_URL}/edit.html?paid=1`);
  form.set('cancel_url', `${SITE_URL}/edit.html`);
  form.set('client_reference_id', user.id);
  form.set('metadata[user_id]', user.id);
  form.set('subscription_data[metadata][user_id]', user.id);
  form.set('allow_promotion_codes', 'true');
  form.set('automatic_tax[enabled]', 'true');
  if (existing?.stripe_customer_id) {
    form.set('customer', existing.stripe_customer_id);
    form.set('customer_update[address]', 'auto');
  } else {
    form.set('customer_email', user.email ?? '');
  }

  const post = (body: URLSearchParams) =>
    fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

  let stripeRes = await post(form);
  let session = await stripeRes.json();

  if (!stripeRes.ok && /payment method types/i.test(session?.error?.message ?? '')) {
    form.set('payment_method_types[0]', 'card');
    stripeRes = await post(form);
    session = await stripeRes.json();
  }

  if (!stripeRes.ok) {
    console.error('stripe checkout failed:', session?.error?.message);
    return json({ error: 'Could not start checkout' }, 502);
  }
  return json({ url: session.url });
});
