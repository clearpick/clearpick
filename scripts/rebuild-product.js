#!/usr/bin/env node
'use strict';

/**
 * Regenerate a single product HTML file from its research JSON.
 * Touches ONLY products/{slug}.html — does not modify products.json,
 * category pages, sitemap, nav-inject.js, or successor links.
 *
 * Usage:
 *   node scripts/rebuild-product.js <path-to-research-json>
 */

const fs   = require('fs');
const path = require('path');
const { renderProductPage, CAT_ALIASES } = require('./lib/render-product-page');

const [,, jsonArg] = process.argv;
if (!jsonArg) {
  console.error('Usage: node scripts/rebuild-product.js <path-to-research-json>');
  process.exit(1);
}

const ROOT      = path.resolve(__dirname, '..');
const jsonPath  = path.resolve(jsonArg);
const p         = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^﻿/, ''));

if (!p.slug) {
  console.error('✗ Research JSON must have a "slug" field.');
  process.exit(1);
}

p.category = CAT_ALIASES[p.category] || p.category;

const products = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8').replace(/^﻿/, '')
);

const html    = renderProductPage(p, products);
const outPath = path.join(ROOT, 'products', `${p.slug}.html`);

fs.writeFileSync(outPath, html, 'utf8');
console.log(`Rebuilt products/${p.slug}.html`);
