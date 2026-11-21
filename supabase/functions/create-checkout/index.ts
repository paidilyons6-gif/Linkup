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

const stripeHeaders = { Authorization: `Bearer ${STRIPE_KEY}` };
const studio = `${SITE_URL}/edit.html`;

async function upgrade(customer: string, subscription: string, price: string) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscription)}`, {
    headers: stripeHeaders,
  });
  if (!res.ok) return json({ error: 'Could not load your existing subscription' }, 502);
  const sub = await res.json();
  const [item] = sub.items?.data || [];
  if (sub.customer !== customer || !item?.id || sub.items.data.length !== 1) {
    return json({ error: 'Open Manage billing to change this subscription' }, 409);
  }
  if (item.price?.id === price) return json({ error: 'You already have this plan' }, 409);

  const form = new URLSearchParams({
    customer,
    return_url: studio,
    'flow_data[type]': 'subscription_update_confirm',
    'flow_data[subscription_update_confirm][subscription]': subscription,
    'flow_data[subscription_update_confirm][items][0][id]': item.id,
    'flow_data[subscription_update_confirm][items][0][price]': price,
    'flow_data[subscription_update_confirm][items][0][quantity]': String(item.quantity ?? 1),
    'flow_data[after_completion][type]': 'redirect',
    'flow_data[after_completion][redirect][return_url]': `${studio}?paid=1`,
  });
  const portal = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: { ...stripeHeaders, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const session = await portal.json().catch(() => ({}));
  if (!portal.ok || !session.url) {
    console.error('stripe plan change failed:', session?.error?.code ?? portal.status);
    return json({ error: 'Could not start this plan change. Try Manage billing or contact LinkUp.' }, 502);
  }
  return json({ url: session.url });
}

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

  const input = await req.json().catch(() => null);
  const plan = input?.plan;
  const price = typeof plan === 'string' && Object.hasOwn(PRICES, plan) ? PRICES[plan] : undefined;
  if (!price) return json({ error: 'Unknown plan' }, 400);

  const subRes = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?select=plan,status,stripe_customer_id,stripe_subscription_id&user_id=eq.${user.id}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!subRes.ok) return json({ error: 'Could not check your current plan. Try again shortly.' }, 502);
  const [existing] = await subRes.json();
  if (existing?.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(existing.status)) {
    if (!existing.stripe_customer_id) return json({ error: 'Contact LinkUp to update your plan' }, 409);
    return upgrade(existing.stripe_customer_id, existing.stripe_subscription_id, price);
  }
  if (existing?.plan !== 'none' && ['active', 'trialing', 'past_due'].includes(existing?.status)) {
    return json({ error: 'Contact LinkUp to change your existing plan' }, 409);
  }

  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', price);
  form.set('line_items[0][quantity]', '1');
  form.set('success_url', `${studio}?paid=1`);
  form.set('cancel_url', studio);
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

  // Repeated clicks for the same price share a Checkout Session for a short window.
  const attempt = Math.floor(Date.now() / (5 * 60_000));
  const post = (body: URLSearchParams, method = 'default') =>
    fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        ...stripeHeaders,
        'Idempotency-Key': `linkup-${user.id}-${price}-${attempt}-${method}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

  let stripeRes = await post(form);
  let session = await stripeRes.json();

  if (!stripeRes.ok && /payment method types/i.test(session?.error?.message ?? '')) {
    form.set('payment_method_types[0]', 'card');
    stripeRes = await post(form, 'card');
    session = await stripeRes.json();
  }

  if (!stripeRes.ok || !session.url) {
    console.error('stripe checkout failed:', session?.error?.message);
    return json({ error: 'Could not start checkout' }, 502);
  }
  return json({ url: session.url });
});
