/* Talking to Supabase.
 *
 * Written against the REST and Auth endpoints directly rather than pulling the
 * SDK off a CDN. The whole site loads nothing from a third party — that keeps
 * the Content-Security-Policy strict, keeps the page fast on mobile data, and
 * means no visitor's IP is handed to anyone before they've agreed to anything.
 *
 * Only the anon key ever reaches the browser, which is what it is for. Every
 * rule that matters lives in row level security, not in this file. */

const API = (() => {
  const cfg = window.LINKUP_CONFIG || {};
  const URL_ = (cfg.supabaseUrl || '').replace(/\/$/, '');
  const ANON = cfg.supabaseAnonKey || '';
  const STORE = 'linkup.session';

  let session = null;
  try { session = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { session = null; }

  const configured = () => Boolean(URL_ && ANON);
  const signedIn   = () => Boolean(session?.access_token);
  const user       = () => session?.user || null;

  function keep(s) {
    session = s;
    if (s) localStorage.setItem(STORE, JSON.stringify(s));
    else localStorage.removeItem(STORE);
  }

  /* Access tokens last an hour. Refreshing a minute early avoids the request
     that would have failed halfway through someone editing their page. */
  async function fresh() {
    if (!session?.refresh_token) return;
    const dueAt = (session.expires_at || 0) * 1000;
    if (Date.now() < dueAt - 60_000) return;
    const res = await fetch(`${URL_}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (res.ok) keep(await res.json());
    // 400/401 means the refresh token is spent — anything else (a 5xx, a dead
    // connection) is not proof of that, so the session is kept and retried.
    else if (res.status === 400 || res.status === 401) keep(null);
  }

  async function rest(path, opts = {}) {
    await fresh();
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      ...opts,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${session?.access_token || ANON}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (res.status === 204) return null;
    const text = await res.text();
    const body = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(body?.message || body?.error_description || 'Something went wrong');
    return body;
  }

  const rpc = (fn, args = {}) =>
    rest(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

  // ── Accounts ──────────────────────────────────────────────────────────
  async function auth(kind, email, password) {
    const path = kind === 'signup' ? 'signup' : 'token?grant_type=password';
    const res = await fetch(`${URL_}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.msg || body.error_description || body.message || 'Could not sign in');
    // With email confirmation switched on, signup returns a user and no token.
    if (!body.access_token) return { needsConfirmation: true };
    keep(body);
    return { needsConfirmation: false };
  }

  const signUp  = (email, password) => auth('signup', email, password);
  const signIn  = (email, password) => auth('signin', email, password);
  const signOut = () => { keep(null); location.href = 'index.html'; };

  async function resetPassword(email) {
    // redirect_to is read from the query string; putting it in the body is
    // silently ignored and the link lands on the homepage instead.
    const back = encodeURIComponent(location.origin + '/account.html');
    const res = await fetch(`${URL_}/auth/v1/recover?redirect_to=${back}`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Could not send the reset email');
  }

  /* Finishing a password reset. The link Supabase mails back carries a
     one-shot access token in the fragment; that token is what authorises
     setting the new password, and it is not a session. */
  async function setPassword(token, password) {
    const res = await fetch(`${URL_}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.msg || body.message || 'Could not set that password');
  }

  // ── Profile ───────────────────────────────────────────────────────────
  async function myProfile() {
    const rows = await rest('profiles?select=*&limit=1');
    return rows?.[0] || null;
  }

  const saveProfile = (patch) =>
    rest(`profiles?user_id=eq.${user().id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });

  async function myPlan() {
    const rows = await rest('subscriptions?select=plan,status,current_period_end&limit=1');
    const s = rows?.[0];
    if (!s) return { plan: 'none', status: 'inactive' };
    const live = ['active', 'trialing', 'past_due'].includes(s.status);
    return { ...s, plan: live ? s.plan : 'none' };
  }

  const allows = (plan, feature) => ({
    page:          ['basic', 'premium', 'business'],
    welcome_video: ['premium', 'business'],
    quiz:          ['premium', 'business'],
    email_capture: ['business'],
  }[feature] || []).includes(plan);

  // ── Numbers, list, sending ────────────────────────────────────────────
  const tapCounts     = () => rpc('tap_counts');
  const sentThisMonth = () => rpc('sent_this_month');
  const myList = () =>
    rest(`subscribers?select=email,created_at,unsubscribed_at&order=created_at.desc`);

  /* Counted only if the page is published, and only the label — no address, no
     device, nothing that would make it personal data. keepalive so the count
     survives the browser navigating away half a millisecond later. */
  function recordTap(profileId, label) {
    try {
      fetch(`${URL_}/rest/v1/rpc/record_tap`, {
        method: 'POST', keepalive: true,
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}`,
                   'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ p_profile_id: profileId, p_label: label }),
      }).catch(() => {});
    } catch { /* never let counting break a link */ }
  }

  async function callFn(name, body) {
    await fresh();
    const res = await fetch(`${URL_}/functions/v1/${name}`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${session?.access_token || ''}`,
                 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'That did not work');
    return out;
  }

  const sendBroadcast = (subject, body) => callFn('send-broadcast', { subject, body });
  async function billingPortal() { location.href = (await callFn('billing-portal')).url; }
  const deleteAccount = () => rpc('delete_me');

  const slugFree     = (slug) => rpc('slug_available', { p_slug: slug });
  const publicProfile = (slug) => rpc('public_profile', { p_slug: slug });

  // ── Files ─────────────────────────────────────────────────────────────
  /* Straight to Supabase Storage. The bucket caps the size and the mime types,
     so a browser that lies about either is refused there rather than here. */
  async function upload(file, kind) {
    await fresh();
    if (!signedIn()) throw new Error('Please sign in first');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${user().id}/${kind}-${Date.now()}.${ext}`;
    const res = await fetch(`${URL_}/storage/v1/object/media/${path}`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(/exceeded/i.test(t) ? 'That file is too big — 100 MB is the limit.' : 'Upload failed');
    }
    return `${URL_}/storage/v1/object/public/media/${path}`;
  }

  // ── Paying ────────────────────────────────────────────────────────────
  async function checkout(plan) {
    await fresh();
    const res = await fetch(`${URL_}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${session?.access_token || ''}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan }),
    });
    const body = await res.json();
    if (!res.ok || !body.url) throw new Error(body.error || 'Could not start checkout');
    location.href = body.url;
  }

  const joinList = async (profileId, email) => {
    const ok = await rpc('join_list', { p_profile_id: profileId, p_email: email });
    if (!ok) throw new Error('Email signup is not available on this page');
    return ok;
  };

  return {
    configured, signedIn, user, signUp, signIn, signOut, resetPassword, setPassword,
    myProfile, saveProfile, myPlan, allows, slugFree, publicProfile,
    upload, checkout, joinList, rest, rpc,
    tapCounts, sentThisMonth, myList, recordTap, sendBroadcast, billingPortal, deleteAccount,
  };
})();
