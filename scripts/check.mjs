import { readdir, readFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const files = (await readdir('site', { withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => entry.name);
const assets = new Set(await readdir('site', { recursive: true }));

function checkAsset(file, url) {
  if (url.includes('${') || /^(https?:|mailto:|tel:|data:)/.test(url)) return;
  const path = url.replace(/^\//, '');
  if (url.startsWith('/') && !path.includes('.')) return; // A routed page.
  if (!assets.has(path)) throw new Error(`${file}: missing asset ${url}`);
}

for (const file of files) {
  const text = await readFile('site/' + file, 'utf8');
  if (file.endsWith('.js')) new Script(text, { filename: file });
  if (file.endsWith('.css') || file.endsWith('.html')) {
    for (const match of text.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]+))\s*\)/g)) {
      checkAsset(file, match[1] ?? match[2] ?? match[3]);
    }
  }
  if (!file.endsWith('.html')) continue;
  for (const [, script] of text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    new Script(script, { filename: file });
  }
  for (const [, url] of text.matchAll(/(?:src|href)="([^"#?]+)[^"]*"/g)) checkAsset(file, url);
}
console.log('All site scripts parse and local assets exist.');
