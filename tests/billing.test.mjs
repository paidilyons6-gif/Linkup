import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const env = {
  SITE_URL: 'https://linkup.test',
  SUPABASE_URL: 'https://supabase.test',
  STRIPE_PRICE_BASIC: 'price_launch',
  STRIPE_PRICE_PREMIUM: 'price_guide',
  STRIPE_WEBHOOK_SECRET: 'test-signing-secret',
};

function edge(name, fetch, globals = {}) {
  let handler;
  const context = {
    ...globals, fetch, Request, Response, URLSearchParams,
    console: { error() {} },
    Deno: { env: { get: key => env[key] }, serve: callback => { handler = callback; } },
  };
  const source = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
  vm.runInNewContext(stripTypeScriptTypes(source).replace(/^import Stripe .*\n/m, ''), context);
  return handler;
}

const pay = (plan = 'premium') => new Request('https://supabase.test/create-checkout', {
  method: 'POST',
  headers: { Authorization: 'Bearer test-session' },
  body: JSON.stringify({ plan }),
});

test('a billing lookup error stops checkout before contacting Stripe', async () => {
  const urls = [];
  const handler = edge('create-checkout', url => {
    urls.push(url);
    return url.includes('/auth/') ? Response.json({ id: 'user' }) : new Response(null, { status: 503 });
  });
  assert.equal((await handler(pay())).status, 502);
  assert.ok(urls.every(url => !url.includes('stripe.com')));
});

test('upgrades confirm a change to the existing Stripe subscription', async () => {
  const handler = edge('create-checkout', (url, options) => {
    if (url.includes('/auth/')) return Response.json({ id: 'user' });
    if (url.includes('/rest/')) return Response.json([{
      plan: 'basic', status: 'active', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1',
    }]);
    if (url.endsWith('/subscriptions/sub_1')) {
      return Response.json({ customer: 'cus_1', items: { data: [{ id: 'si_1', price: { id: 'price_launch' } }] } });
    }
    assert.ok(url.endsWith('/billing_portal/sessions'));
    assert.equal(options.body.get('flow_data[type]'), 'subscription_update_confirm');
    assert.equal(options.body.get('flow_data[subscription_update_confirm][subscription]'), 'sub_1');
    assert.equal(options.body.get('flow_data[subscription_update_confirm][items][0][price]'), 'price_guide');
    return Response.json({ url: 'https://billing.stripe.com/session' });
  });
  assert.equal((await handler(pay())).status, 200);
});

test('first purchases use the configured price and reject prototype property names', async () => {
  const handler = edge('create-checkout', (url, options) => {
    if (url.includes('/auth/')) return Response.json({ id: 'user', email: 'buyer@example.com' });
    if (url.includes('/rest/')) return Response.json([]);
    assert.ok(url.endsWith('/checkout/sessions'));
    assert.equal(options.body.get('line_items[0][price]'), 'price_guide');
    assert.ok(options.headers['Idempotency-Key'].startsWith('linkup-user-price_guide-'));
    return Response.json({ url: 'https://checkout.stripe.com/session' });
  });
  assert.equal((await handler(pay())).status, 200);
  assert.equal((await handler(pay('constructor'))).status, 400);
});

function stripeWebhook(fetch) {
  const subscription = {
    id: 'sub_old', status: 'canceled', metadata: { user_id: 'creator' },
    customer: 'cus_1', items: { data: [{ price: { id: 'price_guide' } }] },
  };
  class Stripe {
    static createFetchHttpClient() {}
    static createSubtleCryptoProvider() {}
    subscriptions = { retrieve: id => { assert.equal(id, subscription.id); return subscription; } };
    webhooks = { constructEventAsync: () => ({
      type: 'customer.subscription.updated',
      data: { object: { ...subscription, status: 'active' } },
    }) };
  }
  const handler = edge('stripe-webhook', fetch, { Stripe });
  return () => handler(new Request('https://supabase.test/stripe-webhook', {
    method: 'POST', headers: { 'stripe-signature': 'test' }, body: '{}',
  }));
}

test('late cancellation only updates the matching subscription and failed writes ask Stripe to retry', async () => {
  const writes = [];
  const send = stripeWebhook((url, options) => {
    writes.push({ url, options });
    return new Response(null, { status: writes.length === 1 ? 503 : 204 });
  });
  assert.equal((await send()).status, 500);
  assert.equal((await send()).status, 200);
  assert.equal(writes.length, 2);
  for (const { url, options } of writes) {
    assert.equal(new URL(url).searchParams.get('stripe_subscription_id'), 'eq.sub_old');
    assert.equal(options.method, 'PATCH');
    assert.equal(JSON.parse(options.body).status, 'canceled');
  }
});
