'use strict';
/**
 * Usage:
 *   node scripts/build-guide.js --slug <slug> --title "Title" --description "Desc" --type buying-guide
 *
 * Types: buying-guide | comparison | how-to | roundup
 *
 * Creates:
 *   guides/<slug>.html  — full guide page with SEO meta, OG tags, Article + BreadcrumbList schema
 *   Updates guides.json — adds entry if slug not already present
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');
const GUIDES_JSON = path.join(ROOT, 'guides.json');

const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf('--' + name);
  return i !== -1 ? args[i + 1] : null;
}

const slug        = getArg('slug');
const title       = getArg('title');
const description = getArg('description');
const type        = getArg('type') || 'buying-guide';

if (!slug || !title || !description) {
  console.error('Usage: node scripts/build-guide.js --slug <slug> --title "Title" --description "Desc" [--type buying-guide]');
  process.exit(1);
}

const TYPE_LABELS = {
  'buying-guide': 'Buying Guide',
  'comparison':   'Comparison',
  'how-to':       'How-To',
  'roundup':      'Roundup',
};
const typeLabel = TYPE_LABELS[type] || 'Buying Guide';

const today = new Date().toISOString().split('T')[0];
const BASE_URL = 'https://clearpick.ca';

const schema = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Article',
      'headline': title,
      'description': description,
      'datePublished': today,
      'dateModified': today,
      'author': { '@type': 'Organization', 'name': 'ClearPick', 'url': BASE_URL },
      'publisher': { '@type': 'Organization', 'name': 'ClearPick', 'logo': { '@type': 'ImageObject', 'url': BASE_URL + '/og-image.png' } },
      'mainEntityOfPage': { '@type': 'WebPage', '@id': BASE_URL + '/guides/' + slug + '.html' },
    },
    {
      '@type': 'BreadcrumbList',
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': BASE_URL + '/' },
        { '@type': 'ListItem', 'position': 2, 'name': 'Guides', 'item': BASE_URL + '/guides.html' },
        { '@type': 'ListItem', 'position': 3, 'name': title, 'item': BASE_URL + '/guides/' + slug + '.html' },
      ],
    },
  ],
}, null, 2);

const html = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="../favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} | ClearPick</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title} | ClearPick" />
  <meta property="og:description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${BASE_URL}/guides/${slug}.html" />
  <meta property="og:image" content="${BASE_URL}/og-image.png" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${BASE_URL}/guides/${slug}.html" />
  <link rel="stylesheet" href="../css/style.css" />
  <script type="application/ld+json">
${schema}
  </script>
</head>
<body>
  <header class="site-header" id="site-header">
    <div class="container">
      <div class="header-inner">
        <a href="../index.html" class="logo">
          <svg class="logo-mark" width="32" height="32" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="12" fill="none" stroke="#1a8cff" stroke-width="2.5"/><line x1="9.5" y1="26.5" x2="5.3" y2="30.7" stroke="#1a8cff" stroke-width="3.5" stroke-linecap="round"/><polyline points="13,18.5 16.5,22 23.5,13.5" fill="none" stroke="#1a8cff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="logo__wordmark">ClearPick<span class="logo__tagline">Every Review. One Clear Verdict.</span></span>
        </a>
        <nav class="nav" aria-label="Main">
          <a href="../index.html" class="nav__link">Home</a>
          <details class="nav__dropdown">
            <summary class="nav__link nav__dropdown-trigger">
              Categories
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="dropdown-chevron"><path d="m6 9 6 6 6-6"/></svg>
            </summary>
            <div class="dropdown__menu" role="menu"></div>
          </details>
          <a href="../guides.html" class="nav__link">Guides</a>
          <a href="../blog/index.html" class="nav__link">Blog</a>
          <a href="../about.html" class="nav__link">About</a>
          <a href="../faq.html" class="nav__link">How It Works</a>
        </nav>
        <div class="header-actions">
          <button class="theme-toggle" data-theme-toggle aria-label="Toggle theme">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>
        </div>
      </div>
    </div>
  </header>

  <nav class="breadcrumb" aria-label="Breadcrumb">
    <div class="container">
      <ol class="breadcrumb__list">
        <li class="breadcrumb__item"><a href="../index.html">Home</a></li>
        <li class="breadcrumb__item"><a href="../guides.html">Guides</a></li>
        <li class="breadcrumb__item" aria-current="page">${title}</li>
      </ol>
    </div>
  </nav>

  <article class="guide-article">
    <div class="container">
      <header class="guide-article__header">
        <div class="guide-article__type">${typeLabel}</div>
        <h1 class="guide-article__title">${title}</h1>
        <p class="guide-article__lead">${description}</p>
        <div class="guide-article__meta">
          <time datetime="${today}">Published ${today}</time>
          <span class="guide-article__author">by ClearPick</span>
        </div>
      </header>
      <div class="guide-article__body">
        <!-- Guide content goes here -->
        <p>This guide is coming soon. Check back for the full article.</p>
      </div>
    </div>
  </article>

  <footer class="site-footer">
    <div class="container">
      <div class="footer-inner">
        <div class="footer-brand">
          <a href="../index.html" class="logo">
            <svg class="logo-mark" width="32" height="32" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="12" fill="none" stroke="#1a8cff" stroke-width="2.5"/><line x1="9.5" y1="26.5" x2="5.3" y2="30.7" stroke="#1a8cff" stroke-width="3.5" stroke-linecap="round"/><polyline points="13,18.5 16.5,22 23.5,13.5" fill="none" stroke="#1a8cff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ClearPick
          </a>
          <p class="footer-brand__tagline">Honest product reviews for people who want to buy right the first time.</p>
        </div>
        <div class="footer-col">
          <div class="footer-col__heading">Site</div>
          <ul class="footer-links">
            <li><a href="../guides.html">Buying Guides</a></li>
            <li><a href="../blog/index.html">Blog</a></li>
            <li><a href="../about.html">About</a></li>
            <li><a href="../faq.html">How It Works</a></li>
            <li><a href="../privacy.html">Privacy Policy</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p class="footer-bottom__copy">© 2026 ClearPick. <a href="../about.html">About</a> · <a href="../faq.html">How It Works</a> · <a href="../privacy.html">Privacy Policy</a></p>
      </div>
    </div>
  </footer>
  <script>
    const themeBtn = document.querySelector('[data-theme-toggle]');
    if (themeBtn) { const html = document.documentElement; themeBtn.addEventListener('click', () => { html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }); }
    document.addEventListener('click', function(e) { const dd = document.querySelector('.nav__dropdown'); if (dd && dd.open && !dd.contains(e.target)) dd.removeAttribute('open'); });
  </script>
  <script src="../js/nav-inject.js"></script>
</body>
</html>`;

if (!fs.existsSync(GUIDES_DIR)) fs.mkdirSync(GUIDES_DIR, { recursive: true });

const outPath = path.join(GUIDES_DIR, slug + '.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('Created: guides/' + slug + '.html');

// Update guides.json
let data = { guides: [] };
try { data = JSON.parse(fs.readFileSync(GUIDES_JSON, 'utf8')); } catch (_) {}
if (!data.guides.find(g => g.slug === slug)) {
  data.guides.push({ slug, title, description, type, typeLabel, publishedAt: today });
  fs.writeFileSync(GUIDES_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Updated guides.json');
} else {
  console.log('guides.json: slug already exists, skipped');
}
