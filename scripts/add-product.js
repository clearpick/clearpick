#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');
const { renderProductPage, CAT_ALIASES, CAT_ICONS, esc, truncate } = require('./lib/render-product-page');

// ── CLI arg ───────────────────────────────────────────────────────────────────
const [,, jsonArg] = process.argv;
if (!jsonArg) {
  console.error('Usage: node scripts/add-product.js <path-to-research-json>');
  process.exit(1);
}

const ROOT      = path.resolve(__dirname, '..');
const jsonPath  = path.resolve(jsonArg);
const p         = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^﻿/, ''));

// Resolve alias before anything else
p.category = CAT_ALIASES[p.category] || p.category;

const catIcon = CAT_ICONS[p.category] || '📦';
const catPage = p.categoryPage;

// ── Load products.json ────────────────────────────────────────────────────────
const productsPath = path.join(ROOT, 'products.json');
const products     = JSON.parse(fs.readFileSync(productsPath, 'utf8').replace(/^﻿/, ''));

// Guard: no duplicate slugs
if (products.find(x => x.id === p.slug)) {
  console.error(`✗ "${p.slug}" already exists in products.json — aborting.`);
  process.exit(1);
}

// ── Guard: product page must not exist ───────────────────────────────────────
const outPath = path.join(ROOT, 'products', `${p.slug}.html`);
if (fs.existsSync(outPath)) {
  console.error(`✗ products/${p.slug}.html already exists — aborting.`);
  process.exit(1);
}

// ── Similar products — must be provided in input JSON (3 hand-picked slugs) ────
if (!Array.isArray(p.similarProducts) || p.similarProducts.length !== 3) {
  console.error('✗ "similarProducts" must be an array of exactly 3 product slugs.');
  process.exit(1);
}
{
  const errs = [];
  for (const s of p.similarProducts) {
    if (s === p.slug)               errs.push(`"${s}" is the same as the new product slug`);
    else if (!products.find(x => x.id === s)) errs.push(`"${s}" not found in products.json`);
  }
  if (errs.length) {
    console.error('✗ Invalid similarProducts:\n' + errs.map(e => '  · ' + e).join('\n'));
    process.exit(1);
  }
  const crossCat = p.similarProducts.filter(s => {
    const prod = products.find(x => x.id === s);
    return prod && prod.category !== p.category;
  });
  if (crossCat.length) {
    console.warn(`⚠ Cross-category similar products (intentional?): ${crossCat.join(', ')}`);
  }
}
const similar = p.similarProducts.map(s => products.find(x => x.id === s));


// ── commonComplaints validation ──────────────────────────────────────────────
if (!Array.isArray(p.commonComplaints)) {
  console.error('✗ "commonComplaints" must be an array — missing or wrong type.');
  process.exit(1);
}
{
  const bad = p.commonComplaints.filter(
    c => !c || typeof c.title !== 'string' || typeof c.body !== 'string' || typeof c.source !== 'string'
  );
  if (bad.length) {
    console.error('✗ Each commonComplaints entry must have string fields: title, body, source.');
    process.exit(1);
  }
  const n = p.commonComplaints.length;
  if (n < 2) console.warn(`commonComplaints has only ${n} entry — consider adding more.`);
  if (n > 4) console.warn(`commonComplaints has ${n} entries — more than 4 is unusual.`);
}

// ── Render product page ───────────────────────────────────────────────────────
const html = renderProductPage(p, products);

// ── 0. New category page (if needed) ─────────────────────────────────────────
if (p.newCategoryPage) {
  const catPagePath2 = path.join(ROOT, catPage);
  if (fs.existsSync(catPagePath2)) {
    console.log(`  (category page ${catPage} already exists — skipping creation)`);
  } else {
    const catDisplayName  = p.category;          // e.g. "Cameras & Content Creation"
    const catIconHtml     = catIcon;              // e.g. "📷"
    const catSlug         = catPage.replace('.html', '');  // e.g. "cameras"
    const catPageHtml = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Best ${esc(catDisplayName)} 2026 | ClearPick Reviews</title>
  <meta name="description" content="ClearPick's top picks for ${esc(catDisplayName.toLowerCase())} — tested and ranked. Real scores from Amazon, Reddit, and expert reviews. One clear verdict per product." />
  <meta property="og:title" content="Best ${esc(catDisplayName)} 2026 | ClearPick Reviews" />
  <meta property="og:description" content="ClearPick's top picks for ${esc(catDisplayName.toLowerCase())}. Real scores from Amazon, Reddit, and expert reviews — one clear verdict per product." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://clearpick.ca/${catPage}" />
  <meta property="og:image" content="https://clearpick.ca/og-image.png" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://clearpick.ca/${catPage}" />
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="site-header" id="site-header">
    <div class="container">
      <div class="header-inner">
        <a href="index.html" class="logo">
          <svg class="logo-mark" width="32" height="32" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="12" fill="none" stroke="#1a8cff" stroke-width="2.5"/><line x1="9.5" y1="26.5" x2="5.3" y2="30.7" stroke="#1a8cff" stroke-width="3.5" stroke-linecap="round"/><polyline points="13,18.5 16.5,22 23.5,13.5" fill="none" stroke="#1a8cff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="logo__wordmark">ClearPick<span class="logo__tagline">Every Review. One Clear Verdict.</span></span>
        </a>
        <nav class="nav" aria-label="Main">
          <a href="index.html" class="nav__link">Home</a>
          <details class="nav__dropdown">
            <summary class="nav__link nav__dropdown-trigger">
              Categories
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="dropdown-chevron"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="dropdown__menu" role="menu">
              <a href="headphones.html" class="dropdown__item"><span class="dropdown__icon">🎧</span><span class="dropdown__text"><span class="dropdown__label">Headphones</span><span class="dropdown__count">19 products</span></span></a>
              <a href="kitchen.html" class="dropdown__item"><span class="dropdown__icon">🍳</span><span class="dropdown__text"><span class="dropdown__label">Kitchen Appliances</span><span class="dropdown__count">24 products</span></span></a>
              <a href="camping.html" class="dropdown__item"><span class="dropdown__icon">⛺</span><span class="dropdown__text"><span class="dropdown__label">Outdoor &amp; Camping</span><span class="dropdown__count">17 products</span></span></a>
              <a href="software.html" class="dropdown__item"><span class="dropdown__icon">💻</span><span class="dropdown__text"><span class="dropdown__label">Software</span><span class="dropdown__count">13 products</span></span></a>
              <a href="smart-home.html" class="dropdown__item"><span class="dropdown__icon">🏠</span><span class="dropdown__text"><span class="dropdown__label">Smart Home</span><span class="dropdown__count">11 products</span></span></a>
              <a href="robot-vacuums.html" class="dropdown__item"><span class="dropdown__icon">🤖</span><span class="dropdown__text"><span class="dropdown__label">Robot Vacuums</span><span class="dropdown__count">12 products</span></span></a>
              <a href="fitness.html" class="dropdown__item"><span class="dropdown__icon">💪</span><span class="dropdown__text"><span class="dropdown__label">Fitness Equipment</span><span class="dropdown__count">13 products</span></span></a>
              <a href="pet-supplies.html" class="dropdown__item"><span class="dropdown__icon">🐾</span><span class="dropdown__text"><span class="dropdown__label">Pet Supplies</span><span class="dropdown__count">13 products</span></span></a>
              <a href="gaming.html" class="dropdown__item"><span class="dropdown__icon">🎮</span><span class="dropdown__text"><span class="dropdown__label">Gaming</span><span class="dropdown__count">16 products</span></span></a>
              <a href="lawn-garden.html" class="dropdown__item"><span class="dropdown__icon">🌿</span><span class="dropdown__text"><span class="dropdown__label">Lawn &amp; Garden</span><span class="dropdown__count">14 products</span></span></a>
              <a href="home-entertainment.html" class="dropdown__item"><span class="dropdown__icon">📺</span><span class="dropdown__text"><span class="dropdown__label">Home Entertainment</span><span class="dropdown__count">2 products</span></span></a>
              <a href="outdoor-cooking.html" class="dropdown__item"><span class="dropdown__icon">🔥</span><span class="dropdown__text"><span class="dropdown__label">Outdoor Cooking</span><span class="dropdown__count">3 products</span></span></a>
              <a href="${catPage}" class="dropdown__item dropdown__item--active"><span class="dropdown__icon">${catIconHtml}</span><span class="dropdown__text"><span class="dropdown__label">${esc(catDisplayName)}</span><span class="dropdown__count">1 products</span></span></a>
            </div>
          </details>
          <a href="blog/index.html" class="nav__link">Blog</a>
          <a href="about.html" class="nav__link">About</a>
          <a href="faq.html" class="nav__link">How It Works</a>
        </nav>
        <div class="header-search-wrap" id="header-search-wrap">
          <div class="search-box">
            <svg class="search-box__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="search" id="header-search-input" class="search-box__input" placeholder="Search products&#8230;" autocomplete="off" aria-label="Search products" aria-autocomplete="list" aria-controls="header-search-results" aria-expanded="false" />
            <button class="search-box__clear" id="header-search-clear" aria-label="Clear search" hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
          </div>
          <ul class="search-results" id="header-search-results" role="listbox" aria-label="Search suggestions" hidden></ul>
        </div>
        <div class="header-actions">
          <button class="theme-toggle" data-theme-toggle aria-label="Toggle theme">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
      </div>
    </div>
  </header>

  <section class="page-hero">
    <div class="container">
      <div class="page-hero__icon">${catIconHtml}</div>
      <h1 class="page-hero__title">Best ${esc(catDisplayName)}</h1>
      <p class="page-hero__subtitle">ClearPick's top picks — real scores from Amazon reviews, Reddit, and expert sources. One honest verdict per product.</p>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="filter-bar" id="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Brand</span>
          <button class="filter-pill filter-pill--active" data-filter-brand="all">All</button>
          <button class="filter-pill" data-filter-brand="${esc(p.brand)}">${esc(p.brand)}</button>
        </div>
        <div class="filter-group">
          <span class="filter-label">Best For</span>
          <button class="filter-pill filter-pill--active" data-filter-tag="all">All</button>
          <button class="filter-pill" data-filter-tag="${esc(p.filterTag)}">${esc(p.filterTag)}</button>
        </div>
      </div>
      <div class="gear-grid" id="gear-grid">
        <!-- PRODUCTS_END -->
      </div>
      <div class="gear-disclosure">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        As an Amazon Associate, ClearPick earns from qualifying purchases. Rankings are based on genuine performance, not commission rates.
      </div>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-inner">
        <div class="footer-brand">
          <a href="index.html" class="logo">
            <svg class="logo-mark" width="32" height="32" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="12" fill="none" stroke="#1a8cff" stroke-width="2.5"/><line x1="9.5" y1="26.5" x2="5.3" y2="30.7" stroke="#1a8cff" stroke-width="3.5" stroke-linecap="round"/><polyline points="13,18.5 16.5,22 23.5,13.5" fill="none" stroke="#1a8cff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ClearPick
          </a>
          <p class="footer-brand__tagline">Honest product reviews for people who want to buy right the first time.</p>
        </div>
        <div class="footer-col">
          <div class="footer-col__heading">Categories</div>
          <ul class="footer-links">
            <li><a href="headphones.html">Headphones</a></li>
            <li><a href="kitchen.html">Kitchen Appliances</a></li>
            <li><a href="camping.html">Outdoor &amp; Camping</a></li>
            <li><a href="software.html">Software</a></li>
            <li><a href="smart-home.html">Smart Home</a></li>
            <li><a href="robot-vacuums.html">Robot Vacuums</a></li>
            <li><a href="fitness.html">Fitness Equipment</a></li>
            <li><a href="pet-supplies.html">Pet Supplies</a></li>
            <li><a href="gaming.html">Gaming</a></li>
            <li><a href="lawn-garden.html">Lawn &amp; Garden</a></li>
            <li><a href="home-entertainment.html">Home Entertainment</a></li>
            <li><a href="outdoor-cooking.html">Outdoor Cooking</a></li>
            <li><a href="${catPage}">${esc(catDisplayName)}</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <div class="footer-col__heading">Site</div>
          <ul class="footer-links">
            <li><a href="blog/index.html">Blog</a></li>
            <li><a href="about.html">About</a></li>
            <li><a href="faq.html">How It Works</a></li>
            <li><a href="privacy.html">Privacy Policy</a></li>
            <li><a href="privacy.html">Affiliate Disclosure</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="footer-bottom__copy">© 2026 ClearPick. <a href="about.html">About</a> · <a href="faq.html">How It Works</a> · <a href="privacy.html">Privacy Policy</a></p>
        <p class="footer-bottom__disclaimer">Some links on this site are affiliate links. We may earn a commission if you purchase through them, at no extra cost to you. Rankings are based solely on product quality.</p>
      </div>
    </div>
  </footer>
  <script>
    const themeBtn = document.querySelector('[data-theme-toggle]');
    if (themeBtn) { const html = document.documentElement; themeBtn.addEventListener('click', () => { html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }); }
    document.addEventListener('click', function(e) { const dd = document.querySelector('.nav__dropdown'); if (dd && dd.open && !dd.contains(e.target)) dd.removeAttribute('open'); });
  </script>
  <script src="js/filter-sort.js"></script>
  <script src="js/nav-inject.js"></script>
  <script src="js/search.js"></script>
  <script src="js/compare.js"></script>
</body>
</html>`;
    fs.writeFileSync(catPagePath2, catPageHtml, 'utf8');
    console.log(`✓ Created category page ${catPage}`);

    // ── Add to index.html nav + category card + footer ──────────────────────
    let idxHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    // Nav: insert new category after outdoor-cooking item
    const lastItemPat = /(href="outdoor-cooking\.html" class="dropdown__item">[\s\S]*?<\/a>)(\s*\n\s*<\/div>)/;
    idxHtml = idxHtml.replace(lastItemPat,
      `$1\n              <a href="${catPage}" class="dropdown__item">\n                <span class="dropdown__icon">${catIconHtml}</span>\n                <span class="dropdown__text">\n                  <span class="dropdown__label">${esc(catDisplayName)}</span>\n                  <span class="dropdown__count">1 products</span>\n                </span>\n              </a>$2`
    );

    // Category card
    const newCard = `          <a href="${catPage}" class="category-card">\n            <div class="category-card__icon">${catIconHtml}</div>\n            <div><div class="category-card__name">${esc(catDisplayName)}</div><div class="category-card__count">1 products ranked</div></div>\n            <div class="category-card__arrow">→</div>\n          </a>`;
    idxHtml = idxHtml.replace('        </div>\n      </div>\n    </div>\n  </section>\n\n  <section class="stats-section"',
      `${newCard}\n        </div>\n      </div>\n    </div>\n  </section>\n\n  <section class="stats-section"`);

    // Footer
    idxHtml = idxHtml.replace(
      '<li><a href="outdoor-cooking.html">Outdoor Cooking</a></li>',
      `<li><a href="outdoor-cooking.html">Outdoor Cooking</a></li>\n            <li><a href="${catPage}">${esc(catDisplayName)}</a></li>`
    );

    fs.writeFileSync(path.join(ROOT, 'index.html'), idxHtml, 'utf8');
    console.log(`✓ index.html updated with new category nav + card + footer`);

    // ── Update nav-inject.js CATEGORIES array (all pages pick this up via JS) ──
    const navInjectPath2 = path.join(ROOT, 'js', 'nav-inject.js');
    let navJs2 = fs.readFileSync(navInjectPath2, 'utf8');
    navJs2 = navJs2.replace(
      /(\n  \];)/,
      `\n    { slug: '${catSlug}', icon: '${catIconHtml}', label: '${catDisplayName}', count: 1  },$1`
    );
    fs.writeFileSync(navInjectPath2, navJs2, 'utf8');
    console.log(`✓ nav-inject.js updated with new category: ${catDisplayName}`);

    // ── Sitemap entry for category page ──────────────────────────────────────
    let sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8').replace(/^﻿/, '');
    sm = sm.replace('</urlset>',
      `  <url>\n    <loc>https://clearpick.ca/${catPage}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>`);
    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sm, 'utf8');
    console.log(`✓ sitemap.xml updated with ${catPage}`);
  }
}

// ── 1. Write product page ─────────────────────────────────────────────────────
fs.writeFileSync(outPath, html, 'utf8');
console.log(`✓ Created products/${p.slug}.html`);

// ── 2. Update products.json ───────────────────────────────────────────────────
const newEntry = {
  id:         p.slug,
  name:       p.name,
  category:   p.category,
  score:      p.score,
  tag:        p.tag,
  icon:       catIcon,
  image:      p.image,
  price:      `~$${p.price} CAD`,
  page:       `products/${p.slug}.html`,
  amazonUrl:  p.affiliateUrl,
  subscores:  p.subscores,
  specs:      p.specs,
};
products.push(newEntry);
fs.writeFileSync(productsPath, JSON.stringify(products, null, 2), 'utf8');
console.log(`✓ products.json updated (${products.length} total)`);

// ── 3. Insert card into category page ────────────────────────────────────────
const catPagePath = path.join(ROOT, catPage);
if (!fs.existsSync(catPagePath)) {
  console.error(`✗ Category page not found: ${catPage}`);
  process.exit(1);
}
let catHtml = fs.readFileSync(catPagePath, 'utf8');
const MARKER = '<!-- PRODUCTS_END -->';
if (!catHtml.includes(MARKER)) {
  console.error(`✗ No ${MARKER} marker in ${catPage}\n  Add it inside the gear-grid div, after the last product card.`);
  process.exit(1);
}
const cardHtml =
`          <a class="product-card" href="products/${p.slug}.html" data-score="${p.score}" data-price="${p.price}" data-brand="${esc(p.brand)}" data-tag="${esc(p.filterTag)}">
            <div class="product-card__badge">${esc(p.tag)}</div>
            <div class="product-card__img-wrap">
              <img src="${esc(p.image)}" alt="${esc(p.name)}" class="product-card__img" loading="lazy"
                onerror="this.style.display='none';this.parentElement.classList.add('no-img')" />
            </div>
            <div class="product-card__body">
              <h3 class="product-card__name">${esc(p.name)}</h3>
              <p class="product-card__desc">${esc(truncate(p.introText, 220))}</p>
            </div>
          </a>`;
catHtml = catHtml.replace(MARKER, cardHtml + '\n        ' + MARKER);
fs.writeFileSync(catPagePath, catHtml, 'utf8');
console.log(`✓ Card inserted into ${catPage}`);

// ── 4. Sitemap entry ──────────────────────────────────────────────────────────
const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sitemap = fs.readFileSync(sitemapPath, 'utf8').replace(/^﻿/, '');
const sitemapEntry =
`  <url>
    <loc>https://clearpick.ca/products/${p.slug}.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
sitemap = sitemap.replace('</urlset>', sitemapEntry + '\n</urlset>');
fs.writeFileSync(sitemapPath, sitemap, 'utf8');
console.log(`✓ sitemap.xml updated`);

// ── 5. index.html — nav count + category card count + total stat ──────────────
const indexPath = path.join(ROOT, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
const newCatCount = products.filter(x => x.category === p.category).length;

// Nav dropdown count (pattern: href="catPage" class="dropdown__item">...dropdown__count">N products)
indexHtml = indexHtml.replace(
  new RegExp(
    `(href="${catPage.replace('.', '\\.')}" class="dropdown__item">[\\s\\S]*?<span class="dropdown__count">)\\d+ products`
  ),
  `$1${newCatCount} products`
);

// Category card count (pattern: href="catPage" class="category-card">...category-card__count">N products ranked)
indexHtml = indexHtml.replace(
  new RegExp(
    `(href="${catPage.replace('.', '\\.')}" class="category-card">[\\s\\S]*?<div class="category-card__count">)\\d+ products ranked`
  ),
  `$1${newCatCount} products ranked`
);

// Total stat
indexHtml = indexHtml.replace(
  /<div class="stat__number">(\d+)<\/div><div class="stat__label">Products Ranked<\/div>/,
  `<div class="stat__number">${products.length}</div><div class="stat__label">Products Ranked</div>`
);

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log(`✓ index.html updated — ${p.category}: ${newCatCount}, total: ${products.length}`);

// ── 6. nav-inject.js — keep category count in sync ───────────────────────────
const navInjectPath = path.join(ROOT, 'js', 'nav-inject.js');
const catSlugForNav = catPage.replace('.html', '');
let navJs = fs.readFileSync(navInjectPath, 'utf8');
navJs = navJs.replace(
  new RegExp(`(slug: '${catSlugForNav}'[^}]*count: )\\d+`),
  `$1${newCatCount} `
);
fs.writeFileSync(navInjectPath, navJs, 'utf8');
console.log(`✓ nav-inject.js updated — ${p.category}: ${newCatCount}`);

// ── 7. Upgrade any data-successor placeholders pointing at this new slug ──────
const { upgradeSuccessorLinks } = require('./lib/successor-sweep');
const upgraded = upgradeSuccessorLinks(p.slug, { root: ROOT });
if (upgraded.length > 0) {
  console.log(`✓ Upgraded ${upgraded.length} data-successor placeholder(s):`);
  upgraded.forEach(f => console.log(`  · ${f}`));
} else {
  console.log(`  (no data-successor placeholders found for "${p.slug}")`);
}

console.log(`\n✅ Done! ${p.name} added in ${products.length - 1} → ${products.length} products.`);
