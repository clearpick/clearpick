'use strict';
/**
 * add-product-links.js
 * Wraps every inline product name mention in guide HTML with
 * <a href="../products/{slug}.html">{matched text}</a>
 *
 * Matches both:
 *   1. Full product name from products.json (case-insensitive)
 *   2. N-word prefixes (3 and 4 words) as short-form aliases
 *
 * Only operates on guide-article__body content. Does not double-wrap.
 * Sorts patterns by length descending to handle overlapping names.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');
const PRODUCTS   = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8').replace(/^﻿/, ''));

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build match set: { pattern: string, slug: string }
// For each product, emit the full name + 3-word and 4-word prefixes
const seen = new Set();
const patterns = [];

for (const prod of PRODUCTS) {
  if (!prod.name || !prod.id) continue;
  const words = prod.name.trim().split(/\s+/);

  const candidates = [
    prod.name.trim(),
    words.slice(0, 4).join(' '),
    words.slice(0, 3).join(' '),
  ].filter(s => s.length >= 10 && !seen.has(s.toLowerCase()));

  for (const c of candidates) {
    seen.add(c.toLowerCase());
    patterns.push({ pattern: c, slug: prod.id });
  }
}

// Sort by pattern length descending to avoid partial-match clobber
patterns.sort((a, b) => b.pattern.length - a.pattern.length);

function addLinks(bodyHtml) {
  // Tokenize: split into tag tokens and text tokens
  const tokens = bodyHtml.split(/(<[^>]+>)/);
  let insideAnchor = 0;
  const result = [];

  for (const tok of tokens) {
    if (tok.startsWith('<')) {
      if (/^<a[\s>]/i.test(tok))  insideAnchor++;
      if (/^<\/a>/i.test(tok))    insideAnchor = Math.max(0, insideAnchor - 1);
      result.push(tok);
    } else if (insideAnchor > 0) {
      result.push(tok);  // inside existing <a> — don't touch
    } else {
      let text = tok;
      for (const { pattern, slug } of patterns) {
        const re = new RegExp(`(?<![\\w'-])${escapeRegex(pattern)}(?![\\w'-])`, 'gi');
        text = text.replace(re, m => `<a href="../products/${slug}.html">${m}</a>`);
      }
      result.push(text);
    }
  }
  return result.join('');
}

const guideFiles = fs.readdirSync(GUIDES_DIR)
  .filter(f => f.endsWith('.html'))
  .map(f => path.join(GUIDES_DIR, f));

let totalAdded = 0, filesChanged = 0;

for (const filePath of guideFiles) {
  const original = fs.readFileSync(filePath, 'utf8');

  // Find the body div — it's the last div before </article>
  const bodyRe = /(<div class="guide-article__body">)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/article>)/;
  const m = original.match(bodyRe);
  if (!m) { console.log(`  SKIP: ${path.basename(filePath)}`); continue; }

  const [, openTag, bodyContent, closeTag] = m;
  const linkedBody = addLinks(bodyContent);

  if (linkedBody === bodyContent) {
    console.log(`  UNCHANGED: ${path.basename(filePath)}`);
    continue;
  }

  const before = (bodyContent.match(/<a\s/g)  || []).length;
  const after  = (linkedBody.match(/<a\s/g)   || []).length;
  const added  = after - before;
  totalAdded  += added;
  filesChanged++;

  const updated = original.replace(bodyRe, () => openTag + linkedBody + closeTag);
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`  +${added} links: ${path.basename(filePath)}`);
}

console.log(`\nDone. ${filesChanged} files changed, ${totalAdded} product links added.`);
