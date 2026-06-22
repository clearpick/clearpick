'use strict';
/**
 * add-internal-links.js
 * For every HTML page on the site, find the first unlinked mention of any
 * product name (from products.json) in body content and wrap it in a link.
 *
 * Rules:
 *  - First mention per page only
 *  - Skip if already inside <a>
 *  - Skip self-links (product page linking to itself)
 *  - Skip nav, header, footer, script, style, code, pre
 *  - Root-relative paths: /products/{slug}.html
 *  - Min match length: 5 chars for full names, 3 chars for model numbers
 *  - Sort by length descending so longer matches take priority
 *
 * Run: node scripts/add-internal-links.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const PRODUCTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));

/* ── Build link map ──────────────────────────────────────── */
const linkMap  = [];   // { text, slug, isModel }
const slugSet  = new Set();

function escapeRe(s) {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Known technical standards / spec terms that should NOT be treated as model numbers
const MODEL_BLOCKLIST = new Set([
  'A19',                                 // light bulb base type (E26/A19)
  'HDR10', 'HDR12',                      // video standards
  'IP67', 'IP68', 'IP65', 'IP66', 'IP55', 'IP44', 'IP53', 'IP54', // ingress protection ratings
  'E10',                                 // ethanol fuel blend (appears in gas tool content)
  'HDMI', 'USB2', 'USB3', 'USB4',
]);

PRODUCTS.forEach(p => {
  const id   = p.id;
  const name = p.name;

  // Full name (≥ 5 chars)
  if (name.length >= 5) {
    linkMap.push({ text: name, slug: id });
    slugSet.add(id);
  }

  // For model extraction: strip spec suffixes that appear after " — " or " with "
  // e.g. "Elgato HD60 X ... — 4K30 / 1080p60 HDR10+" → "Elgato HD60 X ..."
  // e.g. "JBL Charge 5 ... with IP67 ..." → "JBL Charge 5 ..."
  const nameForModels = name.split(' — ')[0].split(/ with /i)[0];

  // Model numbers: letter-digits pattern, e.g. WH-1000XM6, BES870XL, L60, K70
  const modelRe = /\b([A-Z]{1,5}[-]?[0-9]{2,5}[A-Z0-9]*)\b/g;
  let mm;
  while ((mm = modelRe.exec(nameForModels)) !== null) {
    const model = mm[1];
    if (model.length >= 3 && !MODEL_BLOCKLIST.has(model)) {
      linkMap.push({ text: model, slug: id, isModel: true });
    }
  }

  // "Brand + Model" short form: e.g. "Sony WH-1000XM6" from "Sony WH-1000XM6 Wireless Headphones"
  const modelMatch = nameForModels.match(/\b([A-Z]{1,5}[-]?[0-9]{2,5}[A-Z0-9]*)\b/);
  if (modelMatch && !MODEL_BLOCKLIST.has(modelMatch[1])) {
    const modelEnd = name.indexOf(modelMatch[0]) + modelMatch[0].length;
    const shortForm = name.slice(0, modelEnd).trim();
    if (shortForm !== name && shortForm.length >= 5) {
      linkMap.push({ text: shortForm, slug: id });
    }
  }

  // "Brand + Key words" — strip generic category suffixes to get a natural short name
  // e.g. "Roborock Qrevo S Robot Vacuum" → "Roborock Qrevo S"
  // Require result to contain a space (≥ 2 words) to avoid stripping down to bare brand names
  const SUFFIXES = /\s+(Robot Vacuum(?:\s+and\s+Mop)?|Wireless Headphones?|Noise.Cancell?ing|Smart Watch|Smartwatch|Standing Desk|Dog Bed|Cat Litter Box|Automatic.*|Self.Cleaning.*|Espresso Machine.*|Coffee Maker.*|Air Fryer.*|Toaster Oven.*|Blender.*|4th Gen(?:eration)?|5th Gen(?:eration)?|2nd Gen(?:eration)?|3rd Gen(?:eration)?|Gen \d|with USB.C.*|Over.Ear.*|In.Ear.*|True Wireless.*|Laser Printer.*|Inkjet.*|\(.*\))\s*$/i;
  const stripped = name.replace(SUFFIXES, '').trim();
  if (stripped !== name && stripped.includes(' ') && stripped.length >= 8 && stripped.length < name.length - 2) {
    linkMap.push({ text: stripped, slug: id });
  }
});

// Deduplicate: remove entries where the same text maps to multiple products
// Keep only the first occurrence (products.json ordering)
const seen = new Map();
const dedupedMap = [];
linkMap.forEach(pl => {
  const key = pl.text.toLowerCase();
  if (!seen.has(key)) {
    seen.set(key, pl.slug);
    dedupedMap.push(pl);
  }
});

// Sort by text length descending — longer matches take priority in alternation
dedupedMap.sort((a, b) => b.text.length - a.text.length);

// Build lookup map: lowercase text → slug
const byText = new Map();
dedupedMap.forEach(pl => byText.set(pl.text.toLowerCase(), pl));

// Build the single combined regex (alternation, longest first)
const escapedParts = dedupedMap.map(pl => escapeRe(pl.text));
const BIG_RE = new RegExp('(?<![\\w])((?:' + escapedParts.join('|') + '))(?![\\w-])', 'gi');

console.log('Link variants built:', dedupedMap.length);

/* ── HTML processor ──────────────────────────────────────── */

// Elements whose content we skip entirely
const SKIP_TAGS = new Set(['nav','header','footer','script','style','code','pre','noscript','svg','template']);

function processHtml(html, selfSlug) {
  const linked = new Set();

  // Pre-seed linked with any products already linked on this page
  // (catches existing relative-path links too)
  const existingLinks = html.match(/href="(?:\.\.\/)*products\/([^"]+)\.html"/gi) || [];
  existingLinks.forEach(m => {
    const sm = m.match(/products\/([^"]+)\.html/i);
    if (sm) linked.add(sm[1]);
  });

  // Self-slug: don't link this page's own product
  if (selfSlug) linked.add(selfSlug);

  // Tokenise by HTML tags — alternates between text and tag tokens
  const tokens = html.split(/(<[^>]*>)/);
  const result  = [];
  const skipStack = [];
  let inA = false;

  for (const tok of tokens) {
    if (!tok.startsWith('<')) {
      // Text node
      if (skipStack.length === 0 && !inA && tok.trim()) {
        result.push(replaceNames(tok, linked));
      } else {
        result.push(tok);
      }
      continue;
    }

    // HTML tag — update state
    const openM  = tok.match(/^<([a-z][a-z0-9]*)/i);
    const closeM = tok.match(/^<\/([a-z][a-z0-9]*)/i);
    const isSelf = tok.endsWith('/>');

    if (openM && !isSelf) {
      const tag = openM[1].toLowerCase();
      if (SKIP_TAGS.has(tag)) skipStack.push(tag);
      if (tag === 'a') {
        inA = true;
        // Mark product if this anchor points to a product page
        const hrefM = tok.match(/href="(?:\.\.\/)*(?:\/)?products\/([^"]+)\.html"/i);
        if (hrefM) linked.add(hrefM[1]);
      }
    } else if (closeM) {
      const tag = closeM[1].toLowerCase();
      if (SKIP_TAGS.has(tag)) {
        // pop most recent matching tag
        for (let i = skipStack.length - 1; i >= 0; i--) {
          if (skipStack[i] === tag) { skipStack.splice(i, 1); break; }
        }
      }
      if (tag === 'a') inA = false;
    }

    result.push(tok);
  }

  return result.join('');
}

function replaceNames(text, linked) {
  // Clone regex to reset lastIndex (needed when reusing across calls)
  BIG_RE.lastIndex = 0;
  return text.replace(BIG_RE, (match) => {
    const pl = byText.get(match.toLowerCase());
    if (!pl) return match;
    if (linked.has(pl.slug)) return match;
    linked.add(pl.slug);
    return `<a href="/products/${pl.slug}.html">${match}</a>`;
  });
}

/* ── File collection ─────────────────────────────────────── */

function collectHtmlFiles() {
  const files = [];
  const dirs  = [
    { dir: ROOT,                  sub: false }, // root .html files only
    { dir: path.join(ROOT, 'guides'),   sub: false },
    { dir: path.join(ROOT, 'products'), sub: false },
    { dir: path.join(ROOT, 'blog'),     sub: false },
    { dir: path.join(ROOT, 'compare'),  sub: false },
  ];

  // Root: just *.html files directly in root (not subdirectories)
  try {
    fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && f !== 'google490b2d51ae757074.html').forEach(f => {
      files.push(path.join(ROOT, f));
    });
  } catch (e) {}

  // Subdirectories
  ['guides', 'products', 'blog', 'compare'].forEach(sub => {
    const d = path.join(ROOT, sub);
    try {
      fs.readdirSync(d).filter(f => f.endsWith('.html')).forEach(f => {
        files.push(path.join(d, f));
      });
    } catch (e) {}
  });

  return files;
}

/* ── Main ────────────────────────────────────────────────── */
function main() {
  const files = collectHtmlFiles();
  console.log('Processing', files.length, 'HTML files…\n');

  let totalLinks = 0;
  const pageStats  = [];   // { file, added }
  const productHits = {}; // slug → count

  for (const filepath of files) {
    const slug = filepath.includes(path.sep + 'products' + path.sep)
      ? path.basename(filepath, '.html')
      : null;

    let html;
    try { html = fs.readFileSync(filepath, 'utf8'); }
    catch (e) { continue; }

    // Quick skip: if there are fewer than 2 product entries in the link map present
    // (most files won't reference any products by name; this is an optimisation)

    const before  = html;
    const processed = processHtml(html, slug);

    if (processed === before) continue;

    // Count links added
    const beforeCount = (before.match(/href="\/products\//g) || []).length;
    const afterCount  = (processed.match(/href="\/products\//g) || []).length;
    const added = afterCount - beforeCount;

    if (added > 0) {
      fs.writeFileSync(filepath, processed, 'utf8');
      totalLinks += added;
      pageStats.push({ file: filepath.replace(ROOT + path.sep, ''), added });

      // Track only the newly added links (root-relative paths added this run)
      const beforeSlugs = new Set((before.match(/href="\/products\/([^"]+)\.html"/g) || [])
        .map(m => m.match(/\/products\/([^"]+)\.html/)[1]));
      const afterLinks = (processed.match(/href="\/products\/([^"]+)\.html"/g) || [])
        .map(m => m.match(/\/products\/([^"]+)\.html/)[1]);
      afterLinks.forEach(s => {
        if (!beforeSlugs.has(s)) productHits[s] = (productHits[s] || 0) + 1;
      });
    }
  }

  // Report
  console.log('═══════════════════════════════════════');
  console.log('Total internal links added:', totalLinks);
  console.log('Files modified:', pageStats.length);

  console.log('\nTop 10 pages by links added:');
  pageStats.sort((a, b) => b.added - a.added).slice(0, 10).forEach(p => {
    console.log(`  ${p.added.toString().padStart(3)}  ${p.file}`);
  });

  const topProducts = Object.entries(productHits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  console.log('\nTop 10 most-linked product pages (new links this run):');
  topProducts.forEach(([slug, count]) => {
    const p = PRODUCTS.find(x => x.id === slug);
    console.log(`  ${count.toString().padStart(3)}  /products/${slug}.html  (${p ? p.name : slug})`);
  });
}

main();
