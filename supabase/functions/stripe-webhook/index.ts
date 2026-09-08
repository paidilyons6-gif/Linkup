// Stripe webhook — updates subscriptions from Stripe events only.

import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const PLAN_BY_PRICE: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_BASIC') ?? '_b']: 'basic',
  [Deno.env.get('STRIPE_PRICE_PREMIUM') ?? '_p']: 'premium',
  [Deno.env.get('STRIPE_PRICE_BUSINESS') ?? '_u']: 'business',
};

async function saveSubscription(row: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) console.error('subscription write failed:', await res.text());
}

async function fromSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (!userId) {
    console.error('subscription without user_id:', sub.id);
    return;
  }
  const priceId = sub.items.data[0]?.price?.id ?? '';
  const plan = PLAN_BY_PRICE[priceId];
  if (!plan) console.error('unmapped price:', priceId);
  await saveSubscription({
    user_id: userId,
    plan: sub.status === 'canceled' ? 'none' : plan ?? 'none',
    status: sub.status,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature || !SECRET) return new Response('Missing signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (err) {
    console.error('signature check failed:', (err as Error).message);
    return new Response('Bad signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          if (!sub.metadata?.user_id) {
            const userId = session.metadata?.user_id ?? session.client_reference_id;
            if (userId) {
              await stripe.subscriptions.update(sub.id, { metadata: { user_id: userId } });
              sub.metadata = { ...sub.metadata, user_id: userId };
            }
          }
          await fromSubscription(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await fromSubscription(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('handler failed:', (err as Error).message);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
