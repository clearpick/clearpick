'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const GUIDES_DIR  = path.join(ROOT, 'guides');
const PRODUCTS_DIR = path.join(ROOT, 'products');

// ── helpers ──────────────────────────────────────────────────────────────────

function findHtml(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const skip = ['node_modules', '.git', '.agents', '.claude', '.hyperframes', 'public', 'research', 'research-queue', 'blog'];
      if (!skip.includes(entry.name)) findHtml(full, files);
    } else if (entry.name.endsWith('.html')) {
      files.push(full);
    }
  }
  return files;
}

// ── Step 1: add Guides nav link to pages that are missing it ─────────────────

const allHtml = findHtml(ROOT);
let navUpdated = 0;

// Patterns: [searchString, insertBefore]
// Two variants per depth: class-first and href-first attribute order
const NAV_PATTERNS = [
  // depth > 0 pages (products/, guides/, compare/, etc.)
  [
    '<a class="nav__link" href="../blog/index.html">Blog</a>',
    '<a class="nav__link" href="../guides.html">Guides</a>\n          '
  ],
  [
    '<a href="../blog/index.html" class="nav__link">Blog</a>',
    '<a href="../guides.html" class="nav__link">Guides</a>\n          '
  ],
  // root-level pages
  [
    '<a class="nav__link" href="blog/index.html">Blog</a>',
    '<a class="nav__link" href="guides.html">Guides</a>\n          '
  ],
  [
    '<a href="blog/index.html" class="nav__link">Blog</a>',
    '<a href="guides.html" class="nav__link">Guides</a>\n          '
  ],
];

const GUIDES_MARKER_VARIANTS = [
  'href="../guides.html"',
  'href="guides.html"',
  'aria-current="page">Guides',
];

for (const filePath of allHtml) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already has a Guides nav link
  if (GUIDES_MARKER_VARIANTS.some(m => content.includes(m))) continue;

  let updated = false;
  for (const [find, insert] of NAV_PATTERNS) {
    if (content.includes(find)) {
      content = content.replace(find, insert + find);
      updated = true;
      break;
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    navUpdated++;
  }
}

console.log(`Step 1 — Nav links added: ${navUpdated} files`);

// ── Step 2: scan guide HTML files for product links ──────────────────────────

const guidesJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'guides.json'), 'utf8'));
const guides = guidesJson.guides || [];

const productToGuides = {}; // productSlug → [{slug, title}]

for (const guide of guides) {
  const htmlPath = path.join(GUIDES_DIR, guide.slug + '.html');
  if (!fs.existsSync(htmlPath)) {
    console.warn(`  [warn] guide HTML missing: ${guide.slug}.html`);
    continue;
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const regex = /href="\.\.\/products\/([^".]+)\.html"/g;
  let match;
  const seen = new Set();

  while ((match = regex.exec(html)) !== null) {
    const slug = match[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    if (!productToGuides[slug]) productToGuides[slug] = [];
    productToGuides[slug].push({ slug: guide.slug, title: guide.title });
  }
}

const linkedProducts = Object.keys(productToGuides).length;
const totalLinks     = Object.values(productToGuides).reduce((s, arr) => s + arr.length, 0);
console.log(`Step 2 — Product→guide links found: ${totalLinks} across ${linkedProducts} products`);

// ── Step 3: inject guide callouts into product pages ─────────────────────────

const REVIEW_SECTION_MARKER = '<section class="product-review section">';
let calloutsAdded = 0;
let calloutsSkipped = 0;

for (const [productSlug, guideList] of Object.entries(productToGuides)) {
  const productPath = path.join(PRODUCTS_DIR, productSlug + '.html');
  if (!fs.existsSync(productPath)) {
    console.warn(`  [warn] product page missing: ${productSlug}.html`);
    continue;
  }

  let html = fs.readFileSync(productPath, 'utf8');

  if (html.includes('guide-callout')) {
    calloutsSkipped++;
    continue;
  }

  if (!html.includes(REVIEW_SECTION_MARKER)) {
    console.warn(`  [warn] injection marker not found in: ${productSlug}.html`);
    continue;
  }

  const calloutItems = guideList.map(g =>
    `  <div class="guide-callout"><span class="guide-callout-label">📖 See our guide</span><a href="/guides/${g.slug}.html">${g.title}</a></div>`
  ).join('\n');

  const block = `<div class="container guide-callouts">\n${calloutItems}\n</div>\n`;

  html = html.replace(REVIEW_SECTION_MARKER, block + REVIEW_SECTION_MARKER);
  fs.writeFileSync(productPath, html, 'utf8');
  calloutsAdded++;
}

console.log(`Step 3 — Callouts added: ${calloutsAdded} pages (${calloutsSkipped} already had one)`);
console.log('\nDone.');
