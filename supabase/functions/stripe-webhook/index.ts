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
  const ended = row.status === 'canceled' || row.status === 'incomplete_expired';
  // A late cancellation for an older subscription must leave its replacement alone.
  const query = ended
    ? new URLSearchParams({
      user_id: `eq.${row.user_id}`,
      stripe_subscription_id: `eq.${row.stripe_subscription_id}`,
    })
    : new URLSearchParams({ on_conflict: 'user_id' });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?${query}`, {
    method: ended ? 'PATCH' : 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: ended ? 'return=minimal' : 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Subscription write failed (${res.status})`);
}

function periodEndUnix(sub: Stripe.Subscription): number | null {
  // Stripe API 2025+ moved current_period_end onto subscription items.
  const fromItem = (sub.items?.data?.[0] as { current_period_end?: number } | undefined)
    ?.current_period_end;
  const fromSub = (sub as { current_period_end?: number }).current_period_end;
  return fromItem ?? fromSub ?? sub.trial_end ?? null;
}

async function fromSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.user_id;
  if (!userId) {
    console.error('subscription without user_id:', sub.id);
    return;
  }
  const item = sub.items.data[0];
  const priceId = item?.price?.id ?? (item as { plan?: { id?: string } } | undefined)?.plan?.id ?? '';
  const plan = PLAN_BY_PRICE[priceId];
  if (!plan) console.error('unmapped price:', priceId);
  const endUnix = periodEndUnix(sub);
  await saveSubscription({
    user_id: userId,
    plan: sub.status === 'canceled' ? 'none' : plan ?? 'none',
    status: sub.status,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
    current_period_end: endUnix ? new Date(endUnix * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
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
      case 'customer.subscription.deleted': {
        const delivered = event.data.object as Stripe.Subscription;
        // Stripe may deliver older events after newer ones. Fetch the current state.
        await fromSubscription(await stripe.subscriptions.retrieve(delivered.id));
        break;
      }
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
