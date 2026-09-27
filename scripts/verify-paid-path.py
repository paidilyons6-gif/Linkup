#!/usr/bin/env python3
"""Verify signup → checkout → (after webhook) publish → public page.

Requires env:
  LINKUP_ANON_KEY   (or reads config.js)
  LINKUP_URL        default https://ldaajbuumgjujfwmlcwm.supabase.co
  LINKUP_SITE       default https://linkupping.netlify.app

Optional after you pay in the browser:
  LINKUP_ACCESS_TOKEN  session from the paid account
  LINKUP_SLUG          slug to publish
"""
from __future__ import annotations

import json, os, re, sys, uuid, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.environ.get('LINKUP_SITE', 'https://linkupping.netlify.app')
URL = os.environ.get('LINKUP_URL', 'https://ldaajbuumgjujfwmlcwm.supabase.co').rstrip('/')


def anon_key() -> str:
  if os.environ.get('LINKUP_ANON_KEY'):
    return os.environ['LINKUP_ANON_KEY']
  cfg = open(os.path.join(ROOT, 'config.js')).read()
  m = re.search(r"supabaseAnonKey:\s*'([^']+)'", cfg)
  if not m:
    raise SystemExit('No anon key')
  return m.group(1)


def call(method, path, token=None, body=None):
  anon = anon_key()
  headers = {
    'apikey': anon,
    'Authorization': f'Bearer {token or anon}',
    'Content-Type': 'application/json',
  }
  data = None if body is None else json.dumps(body).encode()
  req = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
  try:
    with urllib.request.urlopen(req) as resp:
      return resp.status, resp.read().decode()
  except urllib.error.HTTPError as e:
    return e.code, e.read().decode()
  except urllib.error.URLError as e:
    return 0, str(e)


def main():
  print('URL', URL)
  st, body = call('GET', '/auth/v1/health')
  print('health', st, body[:120])
  if st == 0:
    print('FAIL: Supabase unreachable (restore/unpause the project first)')
    return 1

  email = f'verify.{uuid.uuid4().hex[:8]}@example.com'
  password = 'VerifyPath123!'
  st, body = call('POST', '/auth/v1/signup', body={'email': email, 'password': password})
  print('signup', st)
  sess = json.loads(body)
  tok = sess.get('access_token')
  if not tok:
    print(body[:300])
    return 1
  uid = sess['user']['id']

  st, body = call('GET', '/rest/v1/profiles?select=id,slug,published', token=tok)
  prof = json.loads(body)[0]
  print('profile', prof)

  st, body = call('POST', '/functions/v1/create-checkout', token=tok, body={'plan': 'premium'})
  print('checkout', st, body[:160])
  if '"url"' not in body:
    return 1

  st, body = call(
    'PATCH', f'/rest/v1/profiles?user_id=eq.{uid}', token=tok,
    body={'published': True},
  )
  print('publish unpaid (expect 400)', st, body[:160])

  print('\nNext: open the checkout URL, pay with your card, then re-run with:')
  print(f'  LINKUP_ACCESS_TOKEN=<token from localStorage linkup.session>')
  print(f'  LINKUP_SLUG=your-slug')
  print('to confirm publish + public page.')

  paid_tok = os.environ.get('LINKUP_ACCESS_TOKEN')
  slug = os.environ.get('LINKUP_SLUG')
  if paid_tok and slug:
    st, body = call(
      'PATCH', f'/rest/v1/profiles?select=*', token=paid_tok,
      body={'published': True, 'slug': slug, 'name': 'Live check', 'mode': 'quiz'},
    )
    print('publish paid', st, body[:200])
    st, body = call('POST', '/rest/v1/rpc/public_profile', body={'p_slug': slug})
    print('public_profile', st, body[:200])
    st, _ = call('GET', f'/{slug}')  # may 404 against API host
    print('site page check:', f'{SITE}/{slug}')
  return 0


if __name__ == '__main__':
  sys.exit(main())
