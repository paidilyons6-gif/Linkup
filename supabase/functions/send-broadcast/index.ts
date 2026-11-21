// Sends one broadcast to a Business-plan customer's email list.

const CORS = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_KEY = Deno.env.get('RESEND_API_KEY');
const FROM = Deno.env.get('BROADCAST_FROM');
const SITE_URL = Deno.env.get('SITE_URL')!;
const MONTHLY_CAP = Number(Deno.env.get('MONTHLY_EMAIL_CAP') ?? '2000');

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const db = (path: string, opts: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

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

  const input = await req.json().catch(() => null);
  if (typeof input?.subject !== 'string' || typeof input?.body !== 'string') {
    return json({ error: 'A subject and a message, please' }, 400);
  }
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) return json({ error: 'A subject and a message, please' }, 400);
  if (subject.length > 200 || /[\r\n]/.test(subject)) return json({ error: 'Use a single-line subject under 200 characters' }, 400);
  if (body.length > 20_000) return json({ error: 'That message is too long' }, 400);

  const planRes = await db('rpc/effective_plan', {
    method: 'POST',
    body: JSON.stringify({ p_user: user.id }),
  });
  const plan = planRes.ok ? await planRes.json() : 'none';
  if (plan !== 'business') {
    return json({ error: 'Sending is part of the Scale plan' }, 403);
  }

  if (!RESEND_KEY || !FROM || !Number.isSafeInteger(MONTHLY_CAP) || MONTHLY_CAP < 1) {
    return json({ error: 'Email sending is not configured yet' }, 503);
  }

  const profRes = await db(`profiles?select=id,name&user_id=eq.${user.id}`);
  const profile = profRes.ok ? (await profRes.json())[0] : null;
  if (!profile) return json({ error: 'No page found' }, 400);

  const usedRes = await db('rpc/sent_this_month', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: '{}',
  });
  if (!usedRes.ok) return json({ error: 'Could not check your sending limit' }, 502);
  const used = await usedRes.json();
  if (!Number.isSafeInteger(used) || used < 0) return json({ error: 'Could not check your sending limit' }, 502);

  const list: { id: string; email: string }[] = [];
  const available = Math.max(0, MONTHLY_CAP - used);
  for (let offset = 0; list.length <= available; offset += 100) {
    const listRes = await db(
      `subscribers?select=id,email&profile_id=eq.${profile.id}&unsubscribed_at=is.null&order=created_at,id&offset=${offset}&limit=100`,
    );
    if (!listRes.ok) return json({ error: 'Could not read your list' }, 502);
    const rows = await listRes.json();
    list.push(...rows);
    if (rows.length < 100) break;
  }
  if (!list.length) return json({ error: 'Nobody on your list yet' }, 400);

  if (used + list.length > MONTHLY_CAP) {
    return json({
      error:
        `That would put you over ${MONTHLY_CAP} emails this month. ` +
        `You've sent ${used}. It resets on the 1st.`,
    }, 429);
  }

  const sender = profile.name || 'LinkUp';
  let sent = 0;
  const failures: string[] = [];

  for (let i = 0; i < list.length; i += 100) {
    const batch = list.slice(i, i + 100).map((s) => {
      const link = `${SITE_URL}/unsubscribe.html?t=${s.id}`;
      return {
        from: FROM,
        to: [s.email],
        reply_to: user.email,
        subject,
        headers: {
          'List-Unsubscribe': `<${link}>`,
        },
        html:
          `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:16px;line-height:1.6;color:#241726;max-width:600px">` +
          `<p style="white-space:pre-wrap;margin:0 0 24px">${esc(body)}</p>` +
          `<hr style="border:0;border-top:1px solid #e6dade;margin:28px 0 14px" />` +
          `<p style="font-size:12.5px;color:#6b5a63;margin:0">` +
          `You're getting this because you joined ${esc(sender)}'s list. ` +
          `<a href="${link}" style="color:#6b5a63">Unsubscribe</a>.</p></div>`,
        text:
          `${body}\n\n---\nYou're getting this because you joined ${sender}'s list.\nUnsubscribe: ${link}`,
      };
    });

    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });
    if (res.ok) sent += batch.length;
    else failures.push(await res.text());
  }

  if (!sent) {
    console.error('every batch failed:', failures[0]);
    return json({ error: 'Nothing sent — check the sending domain is verified' }, 502);
  }

  await db('broadcasts', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      profile_id: profile.id,
      subject,
      body,
      recipients: sent,
    }),
  });

  return json({
    sent,
    failed: list.length - sent,
    remaining: MONTHLY_CAP - used - sent,
  });
});
