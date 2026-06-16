#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const [slug, ...rest] = process.argv.slice(2);

if (!slug) {
  console.error('Usage: node scripts/insert-sources.js <slug> <html-snippet-file>');
  process.exit(1);
}

// Read snippet from a temp file passed as second arg, or from stdin-style heredoc file
const snippetFile = rest[0];
if (!snippetFile) {
  console.error('Usage: node scripts/insert-sources.js <slug> <html-snippet-file>');
  process.exit(1);
}

const htmlPath = path.join(ROOT, 'products', `${slug}.html`);
if (!fs.existsSync(htmlPath)) {
  console.error(`Error: file not found: ${htmlPath}`);
  process.exit(1);
}

const snippet = fs.readFileSync(snippetFile, 'utf8').trim();
let html = fs.readFileSync(htmlPath, 'utf8');

// Remove existing sources-further-reading section if present (idempotent)
html = html.replace(
  /<section class="sources-further-reading">[\s\S]*?<\/section>\s*/,
  ''
);

// Insert before the site footer
const ANCHOR = '<footer class="site-footer">';
if (!html.includes(ANCHOR)) {
  console.error(`Error: no footer anchor found in ${htmlPath}`);
  process.exit(1);
}

html = html.replace(ANCHOR, `\n${snippet}\n${ANCHOR}`);
fs.writeFileSync(htmlPath, html, 'utf8');
console.log(`✓ ${slug}.html updated`);
