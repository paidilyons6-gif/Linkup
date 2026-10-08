// Opens Stripe Customer Portal for the signed-in user.

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL')!;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
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

  const subRes = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?select=stripe_customer_id&user_id=eq.${user.id}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  const customer = subRes.ok ? (await subRes.json())[0]?.stripe_customer_id : null;
  if (!customer) return json({ error: 'No subscription to manage yet' }, 400);

  const form = new URLSearchParams();
  form.set('customer', customer);
  form.set('return_url', `${SITE_URL}/edit.html`);

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const session = await res.json();
  if (!res.ok) {
    console.error('portal failed:', session?.error?.message);
    return json({ error: 'Could not open billing' }, 502);
  }
  return json({ url: session.url });
});
