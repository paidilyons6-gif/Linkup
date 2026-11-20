import { test, expect } from '@playwright/test';
const session = { access_token: 'test-access', refresh_token: 'test-refresh', expires_at: 9999999999, user: { id: 'test-user', email: 'test@example.com' } };
const profile = { id: 'test-id', user_id: 'test-user', name: 'Test Creator', slug: 'creator', links: [{ label: 'My website', url: 'https://example.com' }], published: false, theme: 'blush' };
async function editor(page, failSave = false) {
  await page.addInitScript(s => localStorage.setItem('linkup.session', JSON.stringify(s)), session);
  await page.route('https://*.supabase.co/**', async route => {
    const url = route.request().url();
    if (route.request().method() === 'PATCH') {
      await new Promise(r => setTimeout(r, 150));
      return route.fulfill({ status: failSave ? 500 : 200, json: failSave ? { message: 'Save failed' } : [{ ...profile, ...route.request().postDataJSON() }] });
    }
    if (url.includes('/profiles?')) await new Promise(r => setTimeout(r, 300));
    const json = url.includes('/subscriptions?') ? [{ plan: 'premium', status: 'active' }] : url.includes('/profiles?') ? [profile] : [];
    await route.fulfill({ json });
  });
  await page.goto('/build');
  await expect(page.locator('#app')).toBeVisible();
}
test('marketing and demo work without console errors or mobile overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.name')).toHaveText('Becca Lyons');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/page.html?demo=1');
  await expect(page.locator('#welcome')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('textbox', { name: 'Your email' }).fill('demo@example.com');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('has not been collected');
  expect(errors).toEqual([]);
});
test('reset links work even with an existing session', async ({ page }) => {
  await page.addInitScript(s => localStorage.setItem('linkup.session', JSON.stringify(s)), session);
  await page.goto('/account.html#access_token=recovery-token&type=recovery');
  await expect(page.locator('#title')).toHaveText('Choose a new password');
  await expect(page.locator('#email')).toBeHidden();
  expect(new URL(page.url()).hash).toBe('');
});
test('public-page network failures offer retry rather than claim address is free', async ({ page }) => {
  await page.route('https://*.supabase.co/**', route => route.abort());
  await page.goto('/creator');
  await expect(page.getByRole('heading', { name: 'Could not load this page' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Try again' })).toBeVisible();
});
test('failed publishing never announces success', async ({ page }) => {
  await editor(page, true);
  await page.locator('#publish').click();
  await expect(page.locator('#saveErr')).toContainText('Save failed');
  await expect(page.locator('#publish')).toHaveText('Publish');
  await expect(page.locator('#viewLive')).toBeHidden();
});
test('editing updates the preview and successful publishing exposes the saved link', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await editor(page);
  await page.locator('#f-name').fill('New Creator');
  await expect(page.frameLocator('#preview').locator('.name')).toHaveText('New Creator');
  await page.locator('#publish').click();
  await expect(page.locator('#publish')).toHaveText('Unpublish');
  await expect(page.locator('#viewLive')).toHaveAttribute('href', 'http://127.0.0.1:4173/creator');
  expect(errors).toEqual([]);
});
test('autosaves run in order while later changes remain unsaved', async ({ page }) => {
  await editor(page);
  const writes = [];
  let active = 0;
  let maximum = 0;
  await page.route('https://*.supabase.co/rest/v1/profiles?**', async route => {
    if (route.request().method() !== 'PATCH') return route.fulfill({ json: [profile] });
    active++; maximum = Math.max(maximum, active);
    const body = route.request().postDataJSON();
    writes.push(body.name);
    await new Promise(r => setTimeout(r, 1000));
    active--;
    await route.fulfill({ json: [{ ...profile, ...body }] });
  });
  await page.locator('#f-name').fill('First change');
  await expect.poll(() => writes.length).toBe(1);
  await page.locator('#f-name').fill('Latest change');
  await expect.poll(() => writes.length).toBe(2);
  await expect(page.locator('#saved')).toHaveText('Unsaved changes');
  await expect(page.locator('#saved')).toHaveText('Saved');
  expect(writes).toEqual(['First change', 'Latest change']);
  expect(maximum).toBe(1);
});
test('marketing copy and pricing stay visible without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL);
  await expect(page.getByRole('heading', { name: 'Basic', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Record a hello', exact: true })).toBeVisible();
  await context.close();
});
