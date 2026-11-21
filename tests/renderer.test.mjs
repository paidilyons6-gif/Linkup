import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function renderer(storage = {}) {
  const ctx = vm.createContext({ localStorage: { getItem: () => null, setItem() {}, ...storage }, URL, Intl });
  vm.runInContext(readFileSync('site/linkup.js', 'utf8') + '\nglobalThis.app = LinkUp;', ctx);
  return ctx.app;
}
test('unsafe protocols and control-character links never navigate', () => {
  const app = renderer();
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://', 'https://safe.test/\nfoo']) assert.equal(app.safeUrl(url), '#');
  assert.equal(app.safeUrl('example.com'), 'https://example.com');
  assert.equal(app.safeUrl('mailto:hello@example.com'), 'mailto:hello@example.com');
});
test('render escapes labels and preserves source indices with blank links', () => {
  let html;
  const root = { documentElement: { style: { setProperty() {} }, setAttribute() {}, ownerDocument: { querySelector() {} } }, querySelector: s => s === '.page' ? { set innerHTML(v) { html = v; } } : null };
  renderer().render({ name: '<script>alert(1)</script>', links: [{ label: '' }, { label: 'Call <me>', emoji: '☎️', url: 'tel:123' }] }, { root });
  assert.ok(html.includes('data-i="1"'));
  assert.ok(html.includes('☎️'));
  assert.ok(html.includes('Call &lt;me&gt;'));
  assert.ok(!html.includes('<script>'));
});
test('preview storage failures do not stop editing', () => {
  assert.equal(renderer({ setItem() { throw new Error('quota'); } }).save({ name: 'Test' }), false);
});

test('incomplete public profiles do not inherit the marketing demo', () => {
  const app = renderer();
  const profile = app.mergeProfile({ name: 'Customer', mode: 'quiz', quiz: {} });
  assert.equal(profile.avatar, undefined);
  assert.equal(profile.quiz.questions.length, 0);
  assert.equal(Object.keys(profile.quiz.results).length, 0);
  assert.equal(profile.links.length, 0);
});
