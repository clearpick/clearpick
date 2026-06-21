'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const URLS_FILE  = path.join(ROOT, 'IMAGE_URLS.json');
const PRODUCTS   = path.join(ROOT, 'products');
const PRODUCTS_JSON = path.join(ROOT, 'products.json');

const imageUrls = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));
const productsData = JSON.parse(fs.readFileSync(PRODUCTS_JSON, 'utf8').replace(/^﻿/, ''));

// Replace the src attribute value in an img tag string, leaving everything else intact
function replaceSrc(imgTag, newSrc) {
  // Handle src="..." and src='...'
  if (imgTag.includes('src="')) {
    return imgTag.replace(/src="[^"]*"/, `src="${newSrc}"`);
  }
  if (imgTag.includes("src='")) {
    return imgTag.replace(/src='[^']*'/, `src='${newSrc}'`);
  }
  return imgTag;
}

// Find and replace the target img's src in an HTML string, using priority rules
function updateHtml(html, newSrc) {
  // Priority 1: known hero img classes/ids
  for (const pat of [
    /(<img\b[^>]*\bid="product-image"[^>]*>)/,
    /(<img\b[^>]*\bclass="[^"]*\bproduct-image\b[^"]*"[^>]*>)/,
    /(<img\b[^>]*\bclass="[^"]*\bproduct-cta-box__img\b[^"]*"[^>]*>)/,
  ]) {
    let updated = html.replace(pat, (match) => replaceSrc(match, newSrc));
    if (updated !== html) return updated;
  }

  // Priority 2: first <img> inside element with class product-hero or product-main
  // Match the container, then replace only the first img inside it
  for (const cls of ['product-hero', 'product-main']) {
    const containerRe = new RegExp(
      `(<(?:div|section|figure)\\b[^>]*\\bclass="[^"]*\\b${cls}\\b[^"]*"[^>]*>[\\s\\S]*?</(?:div|section|figure)>)`
    );
    const containerMatch = html.match(containerRe);
    if (containerMatch) {
      const container = containerMatch[1];
      const imgRe = /(<img\b[^>]*>)/;
      const imgMatch = container.match(imgRe);
      if (imgMatch) {
        const newContainer = container.replace(imgRe, replaceSrc(imgMatch[1], newSrc));
        return html.replace(container, newContainer);
      }
    }
  }

  // Priority 3: first <img> whose src contains media-amazon.com
  let updated = html.replace(
    /(<img\b[^>]*\bsrc="[^"]*media-amazon\.com[^"]*"[^>]*>)/,
    (match) => replaceSrc(match, newSrc)
  );
  if (updated !== html) return updated;

  return null; // no target found
}

let updated = 0, skipped = [], notFound = [], noTarget = [];

for (const [slug, newSrc] of Object.entries(imageUrls)) {
  const htmlPath = path.join(PRODUCTS, slug + '.html');

  if (!fs.existsSync(htmlPath)) {
    skipped.push(slug);
    continue;
  }

  const original = fs.readFileSync(htmlPath, 'utf8');

  // Already done if the exact URL is already in the file
  if (original.includes(newSrc)) {
    updated++;
    continue;
  }

  const result = updateHtml(original, newSrc);

  if (result === null) {
    noTarget.push(slug);
    continue;
  }

  fs.writeFileSync(htmlPath, result, 'utf8');

  // Also update products.json image field
  const idx = productsData.findIndex(p => p.id === slug);
  if (idx !== -1) productsData[idx].image = newSrc;

  updated++;
}

fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(productsData, null, 2), 'utf8');

console.log(`\n── apply-image-urls summary ──────────────────────────`);
console.log(`  Updated:   ${updated}`);
console.log(`  Not found: ${skipped.length}${skipped.length ? ' — ' + skipped.join(', ') : ''}`);
if (noTarget.length) console.log(`  No target img found: ${noTarget.length} — ${noTarget.join(', ')}`);
console.log('');
