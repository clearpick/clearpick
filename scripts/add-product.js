#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

// ── CLI arg ───────────────────────────────────────────────────────────────────
const [,, jsonArg] = process.argv;
if (!jsonArg) {
  console.error('Usage: node scripts/add-product.js <path-to-research-json>');
  process.exit(1);
}

const ROOT      = path.resolve(__dirname, '..');
const jsonPath  = path.resolve(jsonArg);
const p         = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^﻿/, ''));

// ── Helpers ───────────────────────────────────────────────────────────────────
const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const escJson = s => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const truncate = (s, n) => {
  if (s.length <= n) return s;
  const cut = s.lastIndexOf(' ', n);
  return s.slice(0, cut > 0 ? cut : n) + '…';
};

// ── Category aliases (normalise JSON shorthand → canonical name in products.json) ──
const CAT_ALIASES = {
  'Fitness': 'Fitness Equipment',
};

// ── Category config ───────────────────────────────────────────────────────────
const CAT_ICONS = {
  'Headphones':                    '🎧',
  'Kitchen Appliances':            '🍳',
  'Outdoor & Camping':             '⛺',
  'Software':                      '💻',
  'Smart Home':                    '🏠',
  'Robot Vacuums':                 '🤖',
  'Fitness Equipment':             '💪',
  'Pet Supplies':                  '🐾',
  'Gaming':                        '🎮',
  'Lawn & Garden':                 '🌿',
  'Home Entertainment':            '📺',
  'Outdoor Cooking':               '🔥',
  'Cameras & Content Creation':    '📷',
};

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

// ── Similar products (from existing list, same category, last 3) ──────────────
const similar = products.filter(x => x.category === p.category).slice(-3);

// ── Score bars ────────────────────────────────────────────────────────────────
const scoreBarsHtml = Object.entries(p.subscores).map(([label, score]) =>
  `<div class="clearpick-score-bar">
<span class="clearpick-score-bar__label">${esc(label)}</span>
<div class="clearpick-score-bar__track">
<div class="clearpick-score-bar__fill" style="width:${(score * 10).toFixed(0)}%"></div>
</div>
<span class="clearpick-score-bar__value">${Number(score).toFixed(1)}</span>
</div>`
).join('\n');

// ── Spec table ────────────────────────────────────────────────────────────────
const specsHtml = Object.entries(p.specs).map(([k, v]) =>
  `<tr><td class="spec-table__label">${esc(k)}</td><td class="spec-table__value">${esc(v)}</td></tr>`
).join('');

// ── Pros / cons ───────────────────────────────────────────────────────────────
const prosHtml  = p.whatWorks.map(item => `<li>${esc(item)}</li>`).join('\n');
const consHtml  = p.worthKnowing.map(item => `<li>${esc(item)}</li>`).join('\n');

// ── Real buyers ───────────────────────────────────────────────────────────────
const buyersHtml = p.realBuyers.map(b =>
  `<blockquote class="real-buyers-say__quote">
<p class="real-buyers-say__text">"${esc(b.quote)}"</p>
<cite class="real-buyers-say__source">— ${esc(b.source)}</cite>
</blockquote>`
).join('\n');

// ── Sources line (for score attribution) ─────────────────────────────────────
const sourcesAttr = p.sources.map(s => s.title.split(':')[0].trim()).join(', ');
const sourcesReview = p.sources.map(s => s.title.split(':')[0].trim()).join(', ');

// ── Similar products section ──────────────────────────────────────────────────
const similarSection = similar.length ? `<section class="section--similar">
<div class="container">
<div class="section__header">
<span class="section__label">You Might Also Like</span>
<h2 class="section__title">Similar Products</h2>
</div>
<div class="gear-grid">
${similar.map(s => {
  const slug = s.page.replace('products/', '');
  return `<a class="product-card product-card--related" href="${slug}">
<div class="product-card__inner">
<div class="product-card__img-wrap"><img alt="${esc(s.name)}" class="product-card__img" loading="lazy" src="${esc(s.image)}"/></div>
<div class="product-card__body">
<span class="product-card__tag">${esc(s.tag)}</span>
<h3 class="product-card__name">${esc(s.name)}</h3>
<span class="product-card__cta product-card__cta--inline">View Review →</span>
</div>
</div>
</a>`;
}).join('\n')}
</div>
</div>
</section>` : '';

// ── Full product page ─────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8" />
<link rel="icon" type="image/svg+xml" href="../favicon.svg" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(p.name)} Review 2026 | ClearPick</title>
<meta name="description" content="${esc(p.metaDescription)}" />
<meta property="og:title" content="${esc(p.name)} Review 2026 | ClearPick" />
<meta property="og:description" content="${esc(p.metaDescription)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="https://clearpick.ca/products/${p.slug}.html" />
<meta property="og:image" content="${esc(p.image)}" />
<link rel="canonical" href="https://clearpick.ca/products/${p.slug}.html" />
<meta name="robots" content="index, follow" />
<link rel="stylesheet" href="../css/style.css" />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "${escJson(p.name)}",
  "review": {
    "@type": "Review",
    "reviewRating": { "@type": "Rating", "ratingValue": "${p.score}", "bestRating": "10" },
    "author": { "@type": "Organization", "name": "ClearPick" },
    "reviewBody": "${escJson(p.verdict)}"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "${p.score}",
    "bestRating": "10",
    "worstRating": "1",
    "reviewCount": "1"
  }
}
</script>
<script>
window.addEventListener('load', () => {
  document.querySelectorAll('.clearpick-score-bar__fill').forEach(el => {
    const w = el.style.width; el.style.width = '0%';
    requestAnimationFrame(() => { requestAnimationFrame(() => { el.style.width = w; }); });
  });
});
</script>
<style>
.product-hero { padding: var(--space-12) 0 var(--space-8); }
.product-hero__inner { display: grid; grid-template-columns: 1fr 360px; gap: var(--space-12); align-items: start; }
@media(max-width:768px){ .product-hero__inner { grid-template-columns:1fr; } .product-cta-box { order:-1; } }
.product-hero__category { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--color-accent); margin-bottom:var(--space-3); }
.product-hero__title { font-size:clamp(1.6rem, 2.5vw + 1rem, 2.6rem); font-weight:800; line-height:1.15; color:var(--color-text-primary); margin-bottom:var(--space-4); }
.product-hero__tag { display:inline-block; background:rgba(26,140,255,.12); color:var(--color-accent); padding:4px 14px; border-radius:99px; font-size:var(--text-sm); font-weight:700; margin-bottom:var(--space-5); }
.product-hero__desc { font-size:var(--text-base); line-height:1.75; color:var(--color-text-secondary); margin-bottom:var(--space-6); }
.product-hero__specs { background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-xl); overflow:hidden; }
.product-hero__specs summary { padding:var(--space-4) var(--space-5); font-weight:700; font-size:var(--text-sm); cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; color:var(--color-text-primary); }
.product-hero__specs summary::after { content:"▾"; }
.product-hero__specs[open] summary::after { content:"▴"; }
.product-cta-box { background:var(--color-surface); border:1px solid var(--color-border); border-radius:var(--radius-2xl); padding:var(--space-8); }
@media(min-width:769px){ .product-cta-box { position:sticky; top:calc(64px + var(--space-6)); } }
.product-cta-box__badge { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; color:var(--color-accent); margin-bottom:var(--space-3); }
.product-cta-box__name { font-size:var(--text-lg); font-weight:800; color:var(--color-text-primary); margin-bottom:var(--space-2); line-height:1.3; }
.product-cta-box__price { font-size:var(--text-xl); font-weight:800; color:var(--color-text-primary); margin-bottom:var(--space-6); }
.product-cta-box__price span { font-size:var(--text-sm); font-weight:400; color:var(--color-text-muted); }
.product-cta-main { display:block; background:var(--color-accent); color:#fff; text-align:center; padding:var(--space-4) var(--space-6); border-radius:var(--radius-lg); font-weight:800; font-size:var(--text-base); text-decoration:none; transition:background .15s, transform .15s; margin-bottom:var(--space-3); }
.product-cta-main:hover { background:#0070e0; transform:translateY(-1px); }
.product-cta-sub { display:block; text-align:center; font-size:var(--text-xs); color:var(--color-text-muted); margin-bottom:var(--space-5); }
.product-cta-trust { display:flex; flex-direction:column; gap:var(--space-2); }
.product-cta-trust__item { font-size:12px; color:var(--color-text-muted); display:flex; align-items:center; gap:var(--space-2); }
.section--similar { padding:var(--space-12) 0; background:var(--color-surface-offset); border-top:1px solid var(--color-border); }
.product-card--related { cursor:pointer; text-decoration:none; display:block; }
.product-card__cta--inline { display:inline-block; margin-top:var(--space-3); font-size:var(--text-sm); font-weight:700; }
.breadcrumb { padding:var(--space-3) 0; border-bottom:1px solid var(--color-border); font-size:var(--text-sm); color:var(--color-text-muted); }
.breadcrumb a { color:var(--color-text-muted); text-decoration:none; }
.breadcrumb a:hover { color:var(--color-accent); }
.breadcrumb span { margin:0 var(--space-2); }
.product-cta-box__img { width:100%; border-radius:var(--radius-lg); margin-bottom:var(--space-4); display:block; height:180px; object-fit:contain; background:#fff; padding:var(--space-3); }
</style>
</head>
<body>
<header class="site-header" id="site-header">
<div class="container">
<div class="header-inner">
<a class="logo" href="../index.html">
<svg class="logo-mark" width="32" height="32" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="12" fill="none" stroke="#1a8cff" stroke-width="2.5"/><line x1="9.5" y1="26.5" x2="5.3" y2="30.7" stroke="#1a8cff" stroke-width="3.5" stroke-linecap="round"/><polyline points="13,18.5 16.5,22 23.5,13.5" fill="none" stroke="#1a8cff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
<span class="logo__wordmark">ClearPick<span class="logo__tagline">Every Review. One Clear Verdict.</span></span>
</a>
<nav aria-label="Main" class="nav">
<a class="nav__link" href="../index.html">Home</a>
<details class="nav__dropdown">
<summary class="nav__link nav__dropdown-trigger">Categories <svg class="dropdown-chevron" fill="none" height="12" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" width="12"><path d="m6 9 6 6 6-6"></path></svg></summary>
<div class="dropdown__menu" role="menu">
<a class="dropdown__item" href="../headphones.html"><span class="dropdown__icon">🎧</span><span class="dropdown__text"><span class="dropdown__label">Headphones</span></span></a>
<a class="dropdown__item" href="../kitchen.html"><span class="dropdown__icon">🍳</span><span class="dropdown__text"><span class="dropdown__label">Kitchen Appliances</span></span></a>
<a class="dropdown__item" href="../camping.html"><span class="dropdown__icon">⛺</span><span class="dropdown__text"><span class="dropdown__label">Outdoor &amp; Camping</span></span></a>
<a class="dropdown__item" href="../software.html"><span class="dropdown__icon">💻</span><span class="dropdown__text"><span class="dropdown__label">Software</span></span></a>
<a class="dropdown__item" href="../smart-home.html"><span class="dropdown__icon">🏠</span><span class="dropdown__text"><span class="dropdown__label">Smart Home</span></span></a>
<a class="dropdown__item" href="../robot-vacuums.html"><span class="dropdown__icon">🤖</span><span class="dropdown__text"><span class="dropdown__label">Robot Vacuums</span></span></a>
<a class="dropdown__item" href="../fitness.html"><span class="dropdown__icon">💪</span><span class="dropdown__text"><span class="dropdown__label">Fitness Equipment</span></span></a>
<a class="dropdown__item" href="../pet-supplies.html"><span class="dropdown__icon">🐾</span><span class="dropdown__text"><span class="dropdown__label">Pet Supplies</span></span></a>
<a class="dropdown__item" href="../gaming.html"><span class="dropdown__icon">🎮</span><span class="dropdown__text"><span class="dropdown__label">Gaming</span></span></a>
<a class="dropdown__item" href="../lawn-garden.html"><span class="dropdown__icon">🌿</span><span class="dropdown__text"><span class="dropdown__label">Lawn &amp; Garden</span></span></a>
<a class="dropdown__item" href="../home-entertainment.html"><span class="dropdown__icon">📺</span><span class="dropdown__text"><span class="dropdown__label">Home Entertainment</span></span></a>
<a class="dropdown__item" href="../outdoor-cooking.html"><span class="dropdown__icon">🔥</span><span class="dropdown__text"><span class="dropdown__label">Outdoor Cooking</span></span></a>
<a class="dropdown__item" href="../cameras.html"><span class="dropdown__icon">📷</span><span class="dropdown__text"><span class="dropdown__label">Cameras &amp; Content Creation</span></span></a>
</div>
</details>
<a class="nav__link" href="../blog/index.html">Blog</a>
<a class="nav__link" href="../about.html">About</a>
<a class="nav__link" href="../faq.html">How It Works</a>
</nav>
<div class="header-search-wrap" id="header-search-wrap">
<div class="search-box">
<svg class="search-box__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
<input type="search" id="header-search-input" class="search-box__input" placeholder="Search products…" autocomplete="off" aria-label="Search products" aria-autocomplete="list" aria-controls="header-search-results" aria-expanded="false" />
<button class="search-box__clear" id="header-search-clear" aria-label="Clear search" hidden><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
</div>
<ul class="search-results" id="header-search-results" role="listbox" aria-label="Search suggestions" hidden></ul>
</div>
<div class="header-actions">
<button class="header-search-btn" id="header-search-btn" aria-label="Open search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></button>
<button aria-label="Toggle theme" class="theme-toggle" data-theme-toggle="">
<svg fill="none" height="18" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
</button>
</div>
</div>
</div>
</header>
<div class="breadcrumb">
<div class="container">
<a href="../index.html">Home</a> <span>›</span>
<a href="../${catPage}">${esc(p.category)}</a> <span>›</span>
<span>${esc(p.name)}</span>
</div>
</div>
<section class="product-hero section">
<div class="container">
<div class="product-hero__inner">
<div class="product-hero__content">
<div class="product-hero__category">${esc(p.category)}</div>
<h1 class="product-hero__title">${esc(p.name)}</h1>
<div class="product-hero__tag">${esc(p.tag)}</div>
<p class="product-hero__desc">${esc(p.introText)}</p>
<div class="clearpick-score-section">
<div class="clearpick-score-header">
<span class="clearpick-score-title">ClearPick Score</span>
<span class="clearpick-score-overall">${p.score} <span>/ 10</span></span>
</div>
<div class="clearpick-score-bars">
${scoreBarsHtml}
</div>
<p class="clearpick-score-source">Scores based on aggregated Amazon reviews, Reddit community consensus, and expert roundups (${sourcesAttr}). Updated June 2026.</p>
</div>
<details class="product-hero__specs">
<summary>Full Specs</summary>
<table class="spec-table"><tbody>${specsHtml}</tbody></table>
</details>
<div class="gear-disclosure" style="margin-top:var(--space-6)">
<svg fill="none" height="14" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="8" y2="12"></line><line x1="12" x2="12.01" y1="16" y2="16"></line></svg>
As an Amazon Associate, ClearPick earns from qualifying purchases at no extra cost to you.
</div>
</div>
<div class="product-cta-box">
<img alt="${esc(p.name)} product photo" class="product-cta-box__img" loading="lazy" src="${esc(p.image)}" />
<div class="product-cta-box__badge">🏆 ${esc(p.tag)}</div>
<div class="product-cta-box__name">${esc(p.name)}</div>
<div class="product-cta-box__price">~${esc(p.priceDisplay)} <span>est. on Amazon.ca</span></div>
<a class="product-cta-main" href="${esc(p.affiliateUrl)}" rel="nofollow noopener noreferrer sponsored" target="_blank">
View on Amazon.ca →
</a>
<span class="product-cta-sub">Opens Amazon.ca · Affiliate link</span>
<div class="product-cta-trust">
<div class="product-cta-trust__item">✅ Ships to Canada</div>
<div class="product-cta-trust__item">✅ Prime eligible (most orders)</div>
<div class="product-cta-trust__item">✅ 30-day Amazon returns</div>
<div class="product-cta-trust__item">✅ No extra cost to you</div>
</div>
</div>
</div>
</div>
</section>
<section class="product-review section">
<div class="container product-review__inner">
<h2 class="product-review__heading">What Buyers Say</h2>
<div class="product-review__cols">
<div class="product-review__col">
<h3 class="product-review__col-title product-review__col-title--pros">✅ What Works</h3>
<ul class="product-review__list product-review__list--pros">
${prosHtml}
</ul>
</div>
<div class="product-review__col">
<h3 class="product-review__col-title product-review__col-title--cons">⚠️ Worth Knowing</h3>
<ul class="product-review__list product-review__list--cons">
${consHtml}
</ul>
</div>
</div>
<section class="real-buyers-say">
<div class="container">
<h2 class="real-buyers-say__title">What Real Buyers Are Saying</h2>
<div class="real-buyers-say__grid">
${buyersHtml}
</div>
</div>
</section>
<div class="product-review__verdict">
<span class="product-review__verdict-label">ClearPick Verdict</span>
<p class="product-review__verdict-text">${esc(p.verdict)}</p>
</div>
<p class="product-review__source">Review synthesis based on aggregated Amazon.ca customer reviews, Reddit community discussions, and expert evaluations from ${sourcesReview}. Updated June 2026.</p>
</div>
</section>
${similarSection}
<footer class="site-footer">
<div class="container">
<div class="footer-bottom">
<p class="footer-bottom__copy">© 2026 ClearPick. <a href="../about.html">About</a> · <a href="../privacy.html">Privacy Policy</a></p>
<p class="footer-bottom__disclaimer">Some links on this site are affiliate links. We may earn a commission if you purchase through them, at no extra cost to you.</p>
</div>
</div>
</footer>
<script>
const themeBtn = document.querySelector('[data-theme-toggle]');
if (themeBtn) { const html = document.documentElement; themeBtn.addEventListener('click', () => { html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }); }
document.addEventListener('click', e => { const dd = document.querySelector('.nav__dropdown'); if (dd && dd.open && !dd.contains(e.target)) dd.removeAttribute('open'); });
</script>
<script src="../js/nav-inject.js"></script>
<script src="../js/search.js"></script>
<script src="../js/compare.js"></script>
</body>
</html>`;

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
    let sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
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
let sitemap = fs.readFileSync(sitemapPath, 'utf8');
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

console.log(`\n✅ Done! ${p.name} added in ${products.length - 1} → ${products.length} products.`);
