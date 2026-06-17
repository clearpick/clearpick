'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const [slug, ...rest] = process.argv.slice(2);
const snippetFile = rest[0];
const htmlPath = path.join(ROOT, 'products', `${slug}.html`);
const snippet = fs.readFileSync(snippetFile, 'utf8').trim();
let html = fs.readFileSync(htmlPath, 'utf8');
if (html.includes('real-buyers-say__card--good')) {
  console.log(`✓ ${slug}.html already has good quotes — skipped`);
  process.exit(0);
}
const ANCHOR = '<h3 class="real-buyers-say__half-label">Common complaints</h3>';
if (!html.includes(ANCHOR)) {
  console.error(`✗ ${slug}.html: anchor not found`);
  process.exit(1);
}
html = html.replace(ANCHOR, `${snippet}\n${ANCHOR}`);
fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`✓ ${slug}.html updated`);
