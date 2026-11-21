import { test, expect } from '@playwright/test';
const session = { access_token: 'test-access', refresh_token: 'test-refresh', expires_at: 9999999999, user: { id: 'test-user', email: 'test@example.com' } };
const profile = { id: 'test-id', user_id: 'test-user', name: 'Test Creator', slug: 'creator', links: [{ label: 'My website', url: 'https://example.com' }], published: false, theme: 'blush', mode: 'hub', quiz: {} };
async function editor(page, failSave = false, initialProfile = profile, initialPlan = 'premium') {
  let stored = structuredClone(initialProfile);
  await page.addInitScript(s => localStorage.setItem('linkup.session', JSON.stringify(s)), session);
  await page.route('https://*.supabase.co/**', async route => {
    const url = route.request().url();
    if (route.request().method() === 'PATCH') {
      await new Promise(r => setTimeout(r, 150));
      if (failSave) return route.fulfill({ status: 500, json: { message: 'Save failed' } });
      stored = { ...stored, ...route.request().postDataJSON() };
      return route.fulfill({ json: [stored] });
    }
    if (url.includes('/profiles?')) await new Promise(r => setTimeout(r, 300));
    const json = url.includes('/subscriptions?') ? [{ plan: initialPlan, status: 'active' }] :
      url.includes('/profiles?') ? [stored] :
      url.includes('/rpc/public_profile') && stored.published ? stored : null;
    await route.fulfill({ json });
  });
  await page.goto('/build');
  await expect(page.locator('#app')).toBeVisible();
}
test('marketing and demo work without console errors or mobile overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible();
  if (await menu.isVisible()) await page.keyboard.press('Escape');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.quiz-kicker')).toHaveText('Maya Chen');
  await frame.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(frame.getByRole('heading', { name: 'Where are you right now?' })).toBeVisible();
  await frame.getByRole('button', { name: 'Pregnant', exact: false }).first().click();
  await expect(frame.getByRole('heading', { name: 'Which trimester?' })).toBeVisible();
  await frame.getByRole('button', { name: /First/ }).click();
  await expect(frame.getByRole('heading', { name: 'Trimester 1 Studio' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/page.html?demo=1');
  await expect(page.locator('#welcome')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  const previewButton = page.getByRole('button', { name: 'Preview', exact: true });
  if (await previewButton.isVisible()) await previewButton.click();
  await expect(page.frameLocator('#preview').locator('.name')).toHaveText('New Creator');
  const closePreview = page.getByRole('button', { name: 'Close preview', exact: true });
  if (await closePreview.isVisible()) {
    await page.frameLocator('#preview').getByRole('link', { name: 'My website' }).press('Escape');
    await expect(previewButton).toBeFocused();
    await expect(previewButton).toHaveAttribute('aria-expanded', 'false');
  }
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
  await expect(page.getByRole('heading', { name: 'Launch', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guide', exact: true })).toBeVisible();
  await context.close();
});

test('published renderer fields expose video, capture, and plan badge as returned by the API', async ({ page }) => {
  let joined;
  await page.route('https://*.supabase.co/**', async route => {
    const url = route.request().url();
    if (url.includes('/rpc/public_profile')) {
      return route.fulfill({ json: {
        id: 'test-id', name: 'Public Creator', mode: 'hub', links: [], badge: false,
        avatar: '/favicon.svg', backgroundImage: '/favicon.svg', welcomeVideo: '/sample.mp4',
        captureEnabled: true, captureHeading: 'Get updates',
      } });
    }
    if (url.includes('/rpc/join_list')) {
      joined = route.request().postDataJSON();
      return route.fulfill({ json: true });
    }
    return route.fulfill({ status: 404 });
  });
  await page.route('**/sample.mp4', () => {});
  await page.goto('/creator', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#welcomeVideo')).toHaveAttribute('src', '/sample.mp4');
  await expect(page.locator('.avatar')).toHaveAttribute('src', '/favicon.svg');
  await expect(page.locator('.bg img')).toHaveAttribute('src', '/favicon.svg');
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.locator('.foot')).toHaveCount(0);
  await expect(page.getByText('Get updates')).toBeVisible();
  await page.getByRole('textbox', { name: 'Your email' }).fill('reader@example.com');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('status').filter({ visible: true })).toContainText("you're on the list");
  expect(joined).toEqual({ p_profile_id: 'test-id', p_email: 'reader@example.com' });
});

test('preview capture gives feedback without saving an email', async ({ page }) => {
  await page.goto('/page.html?preview=1');
  await page.evaluate(() => window.postMessage({
    type: 'linkup:profile', profile: { mode: 'hub', name: 'Preview Creator', captureEnabled: true },
  }, location.origin));
  await page.getByRole('textbox', { name: 'Your email' }).fill('preview@example.com');
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('has not been collected');
  expect(await page.evaluate(() => localStorage.getItem('linkup.emails'))).toBeNull();
});

test('multiple Instagram destinations survive publishing and can be browsed from a quiz or hub', async ({ page }) => {
  await editor(page, false, {
    ...profile, mode: 'quiz',
    quiz: { questions: [{ id: 'q1', text: 'Find a programme', options: [] }] },
  });
  const destinations = page.getByRole('region', { name: 'Destinations' });
  const links = [
    { label: 'Coaching Instagram', entered: 'www.instagram.com/example_coaching/', url: 'https://www.instagram.com/example_coaching/' },
    { label: 'Studio Instagram', entered: 'https://www.instagram.com/example_studio/', url: 'https://www.instagram.com/example_studio/' },
  ];
  for (const link of links) {
    await destinations.getByRole('button', { name: 'Add link' }).click();
    const card = destinations.locator('.hub-card').last();
    await expect(card.getByLabel('Label')).toBeFocused();
    await card.getByLabel('Label').fill(link.label);
    await card.getByLabel('URL').fill(link.entered);
  }

  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible();
  await page.reload();
  for (const [i, link] of links.entries()) {
    await expect(destinations.locator('.hub-card').nth(i + 1).getByLabel('URL')).toHaveValue(link.entered);
  }

  await page.goto('/creator');
  await page.getByRole('button', { name: 'Browse all links' }).click();
  for (const link of links) {
    await expect(page.getByRole('link', { name: link.label })).toHaveAttribute('href', link.url);
  }

  await page.goto('/build');
  await page.locator('#modeToggle [data-mode="hub"]').click();
  await expect(page.locator('#saved')).toHaveText('Saved');
  await page.goto('/creator');
  for (const link of links) {
    await expect(page.getByRole('link', { name: link.label })).toHaveAttribute('href', link.url);
  }
});

test('the demo ignores a previous draft and supports keyboard backtracking and the example checkout', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('linkup.profile', JSON.stringify({ name: 'Old draft', mode: 'hub' })));
  await page.goto('/page.html');
  await expect(page.locator('.quiz-kicker')).toHaveText('Maya Chen');
  await page.getByRole('button', { name: 'Start', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Where are you right now?' })).toBeFocused();
  await page.getByRole('button', { name: 'Pregnant', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Which trimester?' })).toBeFocused();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Where are you right now?' })).toBeFocused();
  await page.getByRole('button', { name: 'Trying to conceive' }).click();
  await page.getByRole('button', { name: 'See the programme' }).click();
  await expect(page.getByRole('heading', { name: 'This is where your checkout opens.' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Build my own quiz' })).toHaveAttribute('href', '/account.html');
});

test('the reset request works as a separate form and an expired link can be replaced', async ({ page }) => {
  let submitted;
  await page.route('https://*.supabase.co/auth/v1/recover?**', async route => {
    submitted = route.request().postDataJSON();
    expect(new URL(route.request().url()).searchParams.get('redirect_to')).toMatch(/\/account\.html$/);
    await route.fulfill({ json: {} });
  });
  await page.goto('/account.html?mode=signin');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Forgotten your password?' }).click();
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeHidden();
  await page.getByLabel('Email', { exact: true }).fill('creator@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toContainText('a reset link is on its way');
  expect(submitted).toEqual({ email: 'creator@example.com' });
  await page.goto('/account.html#error_code=otp_expired');
  await expect(page.getByRole('status')).toContainText('expired');
});

test('publish waits for a brand-new address to be checked', async ({ page }) => {
  await editor(page);
  await page.route('https://*.supabase.co/rest/v1/rpc/slug_available', async route => {
    await new Promise(resolve => setTimeout(resolve, 450));
    await route.fulfill({ json: route.request().postDataJSON().p_slug === 'new-address' });
  });
  await page.getByLabel('Page address').fill('new-address');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('link', { name: 'View live page' })).toHaveAttribute('href', /\/new-address$/);
  await expect(page.locator('#pageStatus')).toHaveText('Live');
});

test('creators can build a draft quiz before subscribing', async ({ page }) => {
  await editor(page, false, { ...profile, mode: 'quiz' }, 'none');
  await expect(page.getByText('Guide publishes the quiz.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Add question' }).click();
  await page.getByRole('textbox', { name: 'Question 1 prompt' }).fill('What are you working towards?');
  await expect(page.getByText('Choose a destination for every answer', { exact: false })).toBeVisible();
  await expect(page.locator('#saved')).toHaveText('Saved');
  await expect(page.getByRole('button', { name: 'Pick a plan to publish' })).toBeDisabled();
});

test('services preselect the requested package and provide an email draft fallback', async ({ page }) => {
  await page.goto('/services.html');
  await page.getByRole('link', { name: 'Request a full site' }).click();
  await expect(page.getByRole('combobox')).toHaveValue('site');
  await page.getByLabel('Name', { exact: true }).fill('Demo Creator');
  await page.getByLabel('Email', { exact: true }).fill('creator@example.com');
  await page.getByRole('button', { name: 'Open email draft' }).click();
  await expect(page.getByRole('status')).toContainText('Send the draft');
  await page.getByText('Copy the request to email it yourself').click();
  await expect(page.getByLabel('Your website request')).toHaveValue(/Demo Creator/);
});

test('unsubscribe works without signing in and gives feedback', async ({ page }) => {
  const token = '12345678-abcd-1234-abcd-123456789abc';
  await page.route('https://*.supabase.co/rest/v1/rpc/unsubscribe', async route => {
    expect(route.request().postDataJSON()).toEqual({ p_token: token });
    await route.fulfill({ json: true });
  });
  await page.goto('/unsubscribe.html?t=' + token);
  await expect(page.getByRole('heading', { name: "You're unsubscribed" })).toBeVisible();
});

test('signup can carry an optional website inquiry to the services page', async ({ page }) => {
  await page.route('https://*.supabase.co/auth/v1/signup', async route => {
    const input = route.request().postDataJSON();
    expect(input.email).toBe('creator@example.com');
    await route.fulfill({ json: { ...session, user: { ...session.user, email: input.email } } });
  });
  await page.goto('/account.html');
  await page.getByText('Need a website as well?', { exact: true }).click();
  await page.getByLabel('Website package').selectOption('site');
  await page.getByLabel('I want my own custom domain').check();
  await page.getByLabel('Email', { exact: true }).fill('creator@example.com');
  await page.getByLabel('Password', { exact: true }).fill('demo-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/services\.html\?package=site#intake$/);
  await expect(page.getByRole('combobox')).toHaveValue('site');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('creator@example.com');
  await expect(page.getByLabel('My own custom domain')).toBeChecked();
});
