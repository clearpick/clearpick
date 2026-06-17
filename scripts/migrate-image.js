#!/usr/bin/env node
/**
 * ClearPick — migrate-image.js
 * Updates a product's image URL from the dead images-na format to the current
 * m.media-amazon.com format, in products.json AND across ALL products/*.html
 * files (catches Similar Products cross-references in addition to the own page).
 *
 * Usage:
 *   node scripts/migrate-image.js <slug> <image-id>
 *
 * Example:
 *   node scripts/migrate-image.js sony-wh-1000xm5 61cR8j0NXML
 *
 * The image-id comes from the live Amazon.ca product page URL:
 *   https://m.media-amazon.com/images/I/{image-id}._AC_SX500_.jpg
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const [slug, imageId] = process.argv.slice(2);

if (!slug || !imageId) {
  console.error('Usage: node scripts/migrate-image.js <slug> <image-id>');
  console.error('Example: node scripts/migrate-image.js sony-wh-1000xm5 61cR8j0NXML');
  process.exit(1);
}

const newImageUrl = `https://m.media-amazon.com/images/I/${imageId}._AC_SX500_.jpg`;

// ── Update products.json ──────────────────────────────────────────────────────
const jsonPath = path.join(ROOT, 'products.json');
const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const product = products.find(p => p.id === slug);
if (!product) {
  console.error(`Error: no product with id "${slug}" found in products.json`);
  console.error('Available slugs:', products.map(p => p.id).join(', '));
  process.exit(1);
}

const oldImageUrl = product.image;
if (!oldImageUrl.includes('images-na.ssl-images-amazon.com')) {
  console.warn(`Warning: ${slug} image URL doesn't look like the dead format:`);
  console.warn('  ', oldImageUrl);
  console.warn('Proceeding anyway...');
}

product.image = newImageUrl;
fs.writeFileSync(jsonPath, JSON.stringify(products, null, 2) + '\n', 'utf8');
console.log(`✓ products.json updated`);
console.log(`  Old: ${oldImageUrl}`);
console.log(`  New: ${newImageUrl}`);

// ── Sweep ALL product HTML files (own page + Similar Products cross-refs) ─────
const productsDir = path.join(ROOT, 'products');
const htmlFiles   = fs.readdirSync(productsDir).filter(f => f.endsWith('.html'));
const pagesUpdated = [];

for (const file of htmlFiles) {
  const filePath = path.join(productsDir, file);
  const html     = fs.readFileSync(filePath, 'utf8');
  if (!html.includes(oldImageUrl)) continue;
  const count = html.split(oldImageUrl).length - 1;
  fs.writeFileSync(filePath, html.split(oldImageUrl).join(newImageUrl), 'utf8');
  pagesUpdated.push({ file, count });
}

if (pagesUpdated.length === 0) {
  console.warn(`Warning: old image URL not found in any products/*.html`);
  console.warn('The HTML files may already be updated, or may use a different URL.');
} else {
  console.log(`✓ Swept ${pagesUpdated.length} product page(s):`);
  pagesUpdated.forEach(({ file, count }) =>
    console.log(`    ${file} (${count} occurrence${count > 1 ? 's' : ''})`)
  );
}

console.log(`\nDone. Verify the image loads at: ${newImageUrl}`);
