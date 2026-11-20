import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function api(fetch, initial = null, storage = {}) {
  const ctx = vm.createContext({
    window: { LINKUP_CONFIG: { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public' } },
    localStorage: { getItem: () => JSON.stringify(initial), setItem() {}, removeItem() {}, ...storage },
    fetch, addEventListener() {}, location: { origin: 'https://linkup.test' },
  });
  vm.runInContext(readFileSync('site/api.js', 'utf8') + '\nglobalThis.api = API;', ctx);
  return ctx.api;
}
test('concurrent calls share a single token refresh', async () => {
  let refreshes = 0;
  const app = api(async url => {
    if (url.includes('/auth/')) { refreshes++; await new Promise(r => setTimeout(r, 20)); return Response.json({ access_token: 'new', refresh_token: 'next', expires_at: 9999999999 }); }
    return Response.json([]);
  }, { access_token: 'old', refresh_token: 'refresh', expires_at: 0 });
  await Promise.all([app.myProfile(), app.myPlan(), app.myList()]);
  assert.equal(refreshes, 1);
});
test('storage denial still allows signing into the current tab', async () => {
  const app = api(async () => Response.json({ access_token: 'new', user: { id: 'user' } }), null, { setItem() { throw new Error('denied'); } });
  await app.signIn('user@example.com', 'password');
  assert.equal(app.signedIn(), true);
});
test('non-JSON server errors are explained', async () => {
  const app = api(async () => new Response('upstream unavailable', { status: 502 }));
  await assert.rejects(app.myProfile(), /unexpected response/);
});
test('oversized or unsupported uploads never hit storage', async () => {
  let calls = 0;
  const app = api(async () => { calls++; return Response.json({}); }, { access_token: 'token', expires_at: 9999999999, user: { id: 'user' } });
  await assert.rejects(app.upload({ size: 101 * 1024 * 1024, type: 'video/mp4' }, 'video'), /too big/);
  await assert.rejects(app.upload({ size: 5, type: 'text/html' }, 'avatar'), /Choose a/);
  assert.equal(calls, 0);
});
