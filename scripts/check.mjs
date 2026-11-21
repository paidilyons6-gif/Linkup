import { readdir, readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
const files = (await readdir('site', { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name);
const assets = new Set(await readdir('site', { recursive: true }));
for (const file of files) {
  const text = await readFile('site/' + file, 'utf8');
  if (file.endsWith('.js')) new Script(text, { filename: file });
  if (!file.endsWith('.html')) continue;
  for (const [, script] of text.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new Script(script, { filename: file });
  for (const [, url] of text.matchAll(/(?:src|href)="([^"#?]+)[^"]*"/g)) {
    if (url.includes('${')) continue;
    if (/^(https?:|mailto:|tel:|\/|data:)/.test(url)) continue;
    if (!assets.has(url)) throw new Error(`${file}: missing asset ${url}`);
  }
}
console.log('All site scripts parse and local assets exist.');
