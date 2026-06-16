#!/usr/bin/env node
/**
 * ClearPick Step 4A — Mechanical Audit
 * Reads products.json + each product HTML, outputs audit-report.md
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Load products.json ──────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));

// ── Category pages for Editor's Pick / homepage check ──────────────────────
const homepageHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// Extract the single Editor's Pick product href from the featured-review section
const editorPickMatch = homepageHtml.match(/class="featured-review"[\s\S]*?href="products\/([^"]+)"/);
const editorPickSlug = editorPickMatch ? editorPickMatch[1].replace(/\.html$/, '') : null;

// ── Helpers ─────────────────────────────────────────────────────────────────
const DEAD_IMG = /images-na\.ssl-images-amazon\.com/;
const LIVE_IMG = /m\.media-amazon\.com\/images\/I\//;
const DEAD_IMG_FORMAT_P = /\/images\/P\//; // even older format
const CLEARPICK_TAG = /tag=clearpick06-20/;
const LEGACY_TAG = /tag=lifehackfi0fb-20/;
const AMZN_SHORT = /amzn\.to/;

const SLOP_PHRASES = [
  /perfect for (anyone|everyone|those|people|you|canadians)/i,
  /ideal for (anyone|everyone|those|people|you|canadians)/i,
  /great choice for/i,
  /you can'?t go wrong/i,
  /hard to go wrong/i,
  /excellent (choice|option|pick) for/i,
  /a must.have/i,
  /look no further/i,
  /hands.?down the best/i,
  /simply the best/i,
  /without a doubt/i,
];

// Categories where model refresh risk is high (release annually or biannually)
const REFRESH_RISK_CATEGORIES = new Set([
  'Headphones', 'Robot Vacuums', 'Home Entertainment',
  'Smart Home', 'Cameras & Content Creation', 'Gaming',
]);

// Required JSON fields
const REQUIRED_JSON_FIELDS = [
  'name', 'category', 'score', 'tag', 'image', 'price',
  'page', 'amazonUrl', 'subscores', 'specs', 'sources_analyzed',
];

// ── Issue buckets ────────────────────────────────────────────────────────────
const issues = {
  // Structural
  missingCanonical: [],
  wrongCanonical: [],   // staging domain or wrong URL
  missingOgTitle: [],
  missingOgDescription: [],
  missingOgUrl: [],
  missingOgType: [],
  missingOgImage: [],
  missingJsonLd: [],
  incompleteJsonLd: [],  // missing AggregateRating
  standaloneComplaints: [], // old <section class="common-complaints">
  missingRealBuyersSay: [],
  complaintsOnlyRbs: [],   // no --good cards (the 12)
  missingSourcesPill: [],
  missingSourcesFurther: [],
  missingCompareJs: [],
  missingScoreSection: [], // no .clearpick-score-section (compare.js won't inject)
  legacyFooter: [],        // 10 old camping pages

  // Data integrity
  missingJsonField: [],    // [{slug, fields:[]}]
  deadImageFormat: [],
  noStandardTag: [],       // neither clearpick06-20 nor lifehackfi0fb-20
  asinMismatch: [],
  slugMismatch: [],        // page field doesn't match products.json id
  h1Mismatch: [],

  // Content quality
  slopVerdict: [],         // [{slug, phrases:[]}]
  genericRbsAttribution: [], // "Source: Amazon reviews" without name
  missingComplaints: [],   // real-buyers-say with no --bad cards
  sourcesOnlyGeneric: [],  // sources section with only generic Amazon/Reddit
  highScoreComplaints: [], // score ≥9.0 but has ≥3 complaint cards
  lowScorePromoted: [],    // score <6.5 (all are promoted since they're on the site)

  // Freshness
  refreshRisk: [],         // high-refresh-risk category
  editorPickNotTop: null,  // { slug, score, topScore, topSlug }

  // Known issues
  knownIssues: [],
};

// ── Per-product audit ────────────────────────────────────────────────────────
for (const prod of products) {
  const slug = prod.id || prod.page?.replace('products/', '').replace('.html', '');
  const htmlPath = path.join(ROOT, prod.page || `products/${slug}.html`);

  // ── JSON field check ──────────────────────────────────────────────────────
  const missingFields = REQUIRED_JSON_FIELDS.filter(f => {
    const v = prod[f];
    return v === undefined || v === null || v === '' ||
      (Array.isArray(v) && v.length === 0) ||
      (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
  });
  if (missingFields.length) {
    issues.missingJsonField.push({ slug, fields: missingFields });
  }

  // ── Slug/page consistency ─────────────────────────────────────────────────
  const expectedPage = `products/${slug}.html`;
  if (prod.page && prod.page !== expectedPage) {
    issues.slugMismatch.push({ slug, expected: expectedPage, actual: prod.page });
  }

  // ── Image format ─────────────────────────────────────────────────────────
  if (prod.image && DEAD_IMG.test(prod.image)) {
    issues.deadImageFormat.push({ slug, image: prod.image });
  }

  // ── Affiliate tag ─────────────────────────────────────────────────────────
  if (prod.amazonUrl) {
    const hasTag = CLEARPICK_TAG.test(prod.amazonUrl) || LEGACY_TAG.test(prod.amazonUrl) || AMZN_SHORT.test(prod.amazonUrl);
    if (!hasTag) {
      issues.noStandardTag.push({ slug, url: prod.amazonUrl });
    }
  }

  // ── Score checks ─────────────────────────────────────────────────────────
  if (typeof prod.score === 'number' && prod.score < 6.5) {
    issues.lowScorePromoted.push({ slug, score: prod.score });
  }

  // ── Refresh risk ─────────────────────────────────────────────────────────
  if (REFRESH_RISK_CATEGORIES.has(prod.category)) {
    issues.refreshRisk.push({ slug, category: prod.category, score: prod.score });
  }

  // ── HTML checks ──────────────────────────────────────────────────────────
  if (!fs.existsSync(htmlPath)) {
    issues.knownIssues.push({ slug, note: `HTML file missing: ${htmlPath}` });
    continue;
  }
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Canonical — match the whole <link .../> tag first, then extract href
  const canonTagMatch = html.match(/<link[^>]+rel="canonical"[^>]*>/);
  if (!canonTagMatch) {
    issues.missingCanonical.push(slug);
  } else {
    const hrefMatch = canonTagMatch[0].match(/href="([^"]+)"/);
    const url = hrefMatch ? hrefMatch[1] : '';
    const expectedUrl = `https://clearpick.ca/products/${slug}.html`;
    if (!url.startsWith('https://clearpick.ca') ||
        url.includes('.pplx.app') ||
        url.includes('staging') ||
        url !== expectedUrl) {
      issues.wrongCanonical.push({ slug, url: url || '(empty)', expected: expectedUrl });
    }
  }

  // OG tags
  if (!html.includes('property="og:title"') && !html.includes("property='og:title'")) issues.missingOgTitle.push(slug);
  if (!html.includes('property="og:description"') && !html.includes("property='og:description'")) issues.missingOgDescription.push(slug);
  if (!html.includes('property="og:url"') && !html.includes("property='og:url'")) issues.missingOgUrl.push(slug);
  if (!html.includes('property="og:type"') && !html.includes("property='og:type'")) issues.missingOgType.push(slug);
  if (!html.includes('property="og:image"') && !html.includes("property='og:image'")) issues.missingOgImage.push(slug);

  // JSON-LD
  if (!html.includes('application/ld+json')) {
    issues.missingJsonLd.push(slug);
  } else if (!html.includes('AggregateRating')) {
    issues.incompleteJsonLd.push(slug);
  }

  // What Real Buyers Are Saying section
  if (!html.includes('real-buyers-say')) {
    if (html.includes('class="common-complaints"')) {
      issues.standaloneComplaints.push(slug);
    } else {
      issues.missingRealBuyersSay.push(slug);
    }
  } else {
    if (!html.includes('real-buyers-say__card--bad')) {
      issues.missingComplaints.push(slug);
    }
    if (!html.includes('real-buyers-say__card--good')) {
      issues.complaintsOnlyRbs.push(slug);
    }
  }

  // Sources pill
  if (!html.includes('score-sources') && !html.includes('source-pill')) {
    issues.missingSourcesPill.push(slug);
  }

  // Sources & Further Reading section — present if has the div class or heading text
  const hasSourcesSection = html.includes('<div class="sources-section"') || html.includes('Further Reading');
  if (!hasSourcesSection) {
    issues.missingSourcesFurther.push(slug);
  }

  // Compare.js loaded
  if (!html.includes('compare.js')) {
    issues.missingCompareJs.push(slug);
  }

  // .clearpick-score-section (needed for compare.js inject point)
  if (!html.includes('clearpick-score-section')) {
    issues.missingScoreSection.push(slug);
  }

  // Legacy footer (no footer-bottom__copy, has footer-inner)
  if (html.includes('footer-inner') && !html.includes('footer-bottom__copy')) {
    issues.legacyFooter.push(slug);
  }

  // ASIN mismatch: extract ASIN from amazonUrl (for non-shortlinks) and image
  const asinFromUrl = prod.amazonUrl?.match(/\/dp\/([A-Z0-9]{10})\//)?.[1] ||
                      prod.amazonUrl?.match(/amazon\.ca\/dp\/([A-Z0-9]{10})/)?.[1];
  const asinFromImage = prod.image?.match(/\/I\/([A-Z0-9]{10})\./)?.[1] ||
                        prod.image?.match(/\/P\/([A-Z0-9]{10})\./)?.[1];
  if (asinFromUrl && asinFromImage && asinFromUrl !== asinFromImage) {
    issues.asinMismatch.push({ slug, urlAsin: asinFromUrl, imageAsin: asinFromImage });
  }

  // H1 vs products.json name (decode basic HTML entities before comparing)
  const h1Match = html.match(/<h1[^>]*class="product-hero__title"[^>]*>([^<]+)<\/h1>/);
  if (h1Match) {
    const h1Text = h1Match[1].trim()
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");
    if (h1Text && prod.name && h1Text !== prod.name) {
      issues.h1Mismatch.push({ slug, h1: h1Text, jsonName: prod.name });
    }
  }

  // ── Content quality ───────────────────────────────────────────────────────
  // Verdict text
  const verdictMatch = html.match(/class="product-review__verdict-text"[^>]*>([\s\S]*?)<\/p>/);
  if (verdictMatch) {
    const verdictText = verdictMatch[1];
    const foundPhrases = SLOP_PHRASES
      .map(rx => { const m = verdictText.match(rx); return m ? m[0] : null; })
      .filter(Boolean);
    if (foundPhrases.length) {
      issues.slopVerdict.push({ slug, phrases: foundPhrases });
    }
  }

  // Generic RBS attributions
  const rbsSection = html.match(/class="real-buyers-say"[\s\S]*?(?=<section|<footer)/);
  if (rbsSection) {
    const sourceMatches = rbsSection[0].matchAll(/class="real-buyers-say__source"[^>]*>([^<]+)<\/cite>/g);
    const genericSources = [];
    for (const m of sourceMatches) {
      const src = m[1].trim();
      // flag if exactly "Source: Amazon reviews" or "Source: Amazon" with no specific detail
      if (/^Source:\s*(Amazon reviews?|Amazon\.ca reviews?|Reddit)\s*$/i.test(src)) {
        genericSources.push(src);
      }
    }
    if (genericSources.length) {
      issues.genericRbsAttribution.push({ slug, sources: [...new Set(genericSources)] });
    }
  }

  // Sources & Further Reading — only generic entries
  // Match the actual div element (not the CSS class definition in <style>)
  const sourcesDivMatch = html.match(/<div class="sources-section">([\s\S]*?)<\/div>\s*<\/div>/);
  if (sourcesDivMatch) {
    const links = [...sourcesDivMatch[1].matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const hasRealLinks = links.some(l =>
      l.startsWith('http') &&
      !l.includes('amazon.ca/dp/') &&
      !l.includes('reddit.com/search')
    );
    if (links.length < 2 || !hasRealLinks) {
      issues.sourcesOnlyGeneric.push({ slug, linkCount: links.length });
    }
  }

  // High score with many complaints
  if (typeof prod.score === 'number' && prod.score >= 9.0) {
    const badCardCount = (html.match(/real-buyers-say__card--bad/g) || []).length;
    if (badCardCount >= 3) {
      issues.highScoreComplaints.push({ slug, score: prod.score, complaints: badCardCount });
    }
  }

  // ── Known issues ──────────────────────────────────────────────────────────
  // mammotion: match by page field (products.json id is still old slug)
  if (slug === 'mammotion-luba-3-awd-1500h' || prod.page === 'products/mammotion-luba-3-awd-1500h.html') {
    const hasOldRef = html.includes('mammotion-luba-2') || html.includes('luba-2-awd');
    const checkSlug = 'mammotion-luba-3-awd-1500h (products.json id: ' + slug + ')';
    issues.knownIssues.push({
      slug: checkSlug,
      note: hasOldRef
        ? 'KNOWN: HTML file still contains references to old slug mammotion-luba-2-awd-1000'
        : 'KNOWN: HTML file is clean — no references to old slug. But products.json `id` field is still the old slug `' + slug + '` and should be updated to `mammotion-luba-3-awd-1500h`.',
    });
    const sitemapHtml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    if (sitemapHtml.includes('luba-2-awd')) {
      issues.knownIssues.push({ slug: checkSlug, note: 'KNOWN: sitemap.xml still contains old luba-2-awd URL' });
    }
    if (sitemapHtml.includes('mammotion-luba-3-awd-1500h')) {
      issues.knownIssues.push({ slug: checkSlug, note: 'KNOWN: sitemap.xml correctly has new luba-3-awd-1500h URL ✅' });
    }
  }

  if (slug === 'big-agnes-copper-spur-hv-ul2') {
    issues.knownIssues.push({
      slug,
      note: 'KNOWN: ASIN may return UL3 variant on Amazon. Verify product page returns correct UL2 before next price/image update.',
    });
  }

  if (slug === 'k-rcher-k5-premium') {
    issues.knownIssues.push({
      slug,
      note: "KNOWN: Mangled slug (ä → '-'). File is k-rcher-k5-premium.html. Consider renaming to karcher-k5-premium.html if a 301 redirect can be put in place.",
    });
  }
}

// ── Editor's Pick check ──────────────────────────────────────────────────────
if (editorPickSlug) {
  const epProd = products.find(p => p.id === editorPickSlug || p.page === `products/${editorPickSlug}.html`);
  if (epProd) {
    const categoryProducts = products.filter(p => p.category === epProd.category);
    const maxScore = Math.max(...categoryProducts.map(p => p.score));
    const topProd = categoryProducts.find(p => p.score === maxScore);
    if (epProd.score < maxScore) {
      issues.editorPickNotTop = {
        slug: editorPickSlug,
        score: epProd.score,
        topScore: maxScore,
        topSlug: topProd?.id || topProd?.page,
      };
    }
  }
}

// ── 12 known complaints-only pages cross-reference ───────────────────────────
const complaintsOnlySlugs = new Set(issues.complaintsOnlyRbs.map(s => s));
const KNOWN_12 = [
  'dewalt-2100-psi-pressure-washer', 'dewalt-60v-flexvolt-leaf-blower',
  'greenworks-80v-leaf-blower', 'husqvarna-350ib', 'k-rcher-k5-premium',
  'mammotion-luba-3-awd-1500h', 'ryobi-40v-whisper', 'segway-navimow-i110n',
  'sun-joe-spx3000', 'westinghouse-epx3500', 'worx-landroid-wr165',
  'coleman-north-rim-mummy-bag',
];

// ── Build report ─────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const lines = [];

function h2(t) { lines.push('', `## ${t}`); }
function h3(t) { lines.push('', `### ${t}`); }
function li(t) { lines.push(`- ${t}`); }
function p(t) { lines.push('', t); }

lines.push(`# ClearPick Audit Report (Step 4A)`);
lines.push('');
lines.push(`Date: ${today}`);
lines.push(`Products audited: ${products.length}`);

// ── Summary ──────────────────────────────────────────────────────────────────
const structuralCount = new Set([
  ...issues.missingCanonical,
  ...issues.wrongCanonical.map(x => x.slug),
  ...issues.missingOgTitle, ...issues.missingOgDescription,
  ...issues.missingOgUrl, ...issues.missingOgType, ...issues.missingOgImage,
  ...issues.missingJsonLd, ...issues.incompleteJsonLd,
  ...issues.standaloneComplaints, ...issues.missingRealBuyersSay,
  ...issues.missingSourcesPill,
  ...issues.missingCompareJs, ...issues.missingScoreSection,
  ...issues.legacyFooter,
]).size;

const dataCount = new Set([
  ...issues.missingJsonField.map(x => x.slug),
  ...issues.deadImageFormat.map(x => x.slug),
  ...issues.noStandardTag.map(x => x.slug),
  ...issues.asinMismatch.map(x => x.slug),
  ...issues.slugMismatch.map(x => x.slug),
  ...issues.h1Mismatch.map(x => x.slug),
]).size;

const contentCount = new Set([
  ...issues.slopVerdict.map(x => x.slug),
  ...issues.genericRbsAttribution.map(x => x.slug),
  ...issues.missingComplaints,
  ...issues.complaintsOnlyRbs,
  ...issues.sourcesOnlyGeneric.map(x => x.slug),
  ...issues.highScoreComplaints.map(x => x.slug),
  ...issues.lowScorePromoted.map(x => x.slug),
]).size;

lines.push('');
lines.push('## Summary counts');
lines.push(`- Structural issues: ${structuralCount} products affected`);
lines.push(`- Data integrity issues: ${dataCount} products affected`);
lines.push(`- Content quality red flags: ${contentCount} products affected`);
lines.push(`- Catalog freshness flags (need newer-model check): ${issues.refreshRisk.length} products`);
lines.push(`- Known-issue verifications: ${issues.knownIssues.length} entries`);
lines.push(`- Missing "Sources & Further Reading": ${issues.missingSourcesFurther.length} products`);

// ── Section 1: Structural ────────────────────────────────────────────────────
h2('1. Structural Issues');

h3('Missing canonical tag');
if (issues.missingCanonical.length) {
  lines.push(`Total: ${issues.missingCanonical.length}`);
  issues.missingCanonical.forEach(s => li(`products/${s}.html`));
} else p('None.');

h3('Wrong/staging canonical URL');
if (issues.wrongCanonical.length) {
  lines.push(`Total: ${issues.wrongCanonical.length}`);
  issues.wrongCanonical.forEach(x => li(`products/${x.slug}.html — got \`${x.url}\`, expected \`${x.expected}\``));
} else p('None.');

h3('Missing OG tags');
const ogIssues = [
  ['og:title', issues.missingOgTitle],
  ['og:description', issues.missingOgDescription],
  ['og:url', issues.missingOgUrl],
  ['og:type', issues.missingOgType],
  ['og:image', issues.missingOgImage],
];
let anyOg = false;
for (const [tag, list] of ogIssues) {
  if (list.length) {
    anyOg = true;
    h3(`Missing ${tag} (${list.length} products)`);
    list.forEach(s => li(`products/${s}.html`));
  }
}
if (!anyOg) p('None.');

h3('Missing JSON-LD schema');
if (issues.missingJsonLd.length) {
  lines.push(`Total: ${issues.missingJsonLd.length}`);
  issues.missingJsonLd.forEach(s => li(`products/${s}.html`));
} else p('None.');

h3('Incomplete JSON-LD (missing AggregateRating)');
if (issues.incompleteJsonLd.length) {
  lines.push(`Total: ${issues.incompleteJsonLd.length}`);
  issues.incompleteJsonLd.forEach(s => li(`products/${s}.html`));
} else p('None.');

h3('Standalone <section class="common-complaints"> (legacy, must be replaced)');
if (issues.standaloneComplaints.length) {
  lines.push(`Total: ${issues.standaloneComplaints.length}`);
  issues.standaloneComplaints.forEach(s => li(`products/${s}.html`));
} else p('None.');

h3('Missing "What Real Buyers Are Saying" section entirely');
if (issues.missingRealBuyersSay.length) {
  lines.push(`Total: ${issues.missingRealBuyersSay.length}`);
  issues.missingRealBuyersSay.forEach(s => li(`products/${s}.html`));
} else p('None.');

h3('Complaints-only "Real Buyers" section (no positive quotes — the 12)');
lines.push(`Total: ${issues.complaintsOnlyRbs.length}`);
lines.push('');
lines.push('These pages deliberately have only the complaints half (no `--good` cards) because positive sentiment was unavailable at Step 2. Positive quotes need to be researched and added in Step 4B.');
lines.push('');
issues.complaintsOnlyRbs.forEach(s => li(`products/${s}.html`));

h3('"Real Buyers" section missing complaint cards entirely');
if (issues.missingComplaints.length) {
  lines.push(`Total: ${issues.missingComplaints.length}`);
  issues.missingComplaints.forEach(s => li(`products/${s}.html`));
} else p('None.');

h3('Missing "Sources analyzed" pill line');
if (issues.missingSourcesPill.length) {
  lines.push(`Total: ${issues.missingSourcesPill.length}`);
  issues.missingSourcesPill.forEach(s => li(`products/${s}.html`));
} else p('None.');

h3('Missing "Sources & Further Reading" section');
lines.push(`Total: ${issues.missingSourcesFurther.length}`);
if (issues.missingSourcesFurther.length) {
  issues.missingSourcesFurther.forEach(s => li(`products/${s}.html`));
} else p('None found — all products have sources section.');

h3('Missing compare.js script tag');
if (issues.missingCompareJs.length) {
  lines.push(`Total: ${issues.missingCompareJs.length}`);
  issues.missingCompareJs.forEach(s => li(`products/${s}.html`));
} else p('None.');

h3('Missing .clearpick-score-section (compare.js inject point)');
if (issues.missingScoreSection.length) {
  lines.push(`Total: ${issues.missingScoreSection.length}`);
  issues.missingScoreSection.forEach(s => li(`products/${s}.html`));
} else p('None.');

h3('Legacy footer template (10 old camping pages)');
lines.push(`Total: ${issues.legacyFooter.length}`);
if (issues.legacyFooter.length) {
  lines.push('');
  lines.push('These pages use the old `.footer-inner`/`.footer-col` footer structure rather than the standard `footer-bottom__copy` pattern. They received a Compare link in Step 3.5 but still differ structurally from the rest of the site.');
  lines.push('');
  issues.legacyFooter.forEach(s => li(`products/${s}.html`));
} else p('None — all pages use standard footer.');

// ── Section 2: Data Integrity ─────────────────────────────────────────────────
h2('2. Data Integrity Issues');

h3('Missing required JSON fields');
if (issues.missingJsonField.length) {
  lines.push(`Total products affected: ${issues.missingJsonField.length}`);
  issues.missingJsonField.forEach(x => li(`**${x.slug}** — missing: ${x.fields.join(', ')}`));
} else p('None.');

h3('Dead image URL format (images-na.ssl-images-amazon.com)');
lines.push(`Total: ${issues.deadImageFormat.length}`);
lines.push('');
lines.push('These entries in products.json use the dead `images-na.ssl-images-amazon.com` format. Images will likely fail to load. Each needs a fresh `m.media-amazon.com/images/I/{id}._AC_SX500_.jpg` URL.');
lines.push('');
if (issues.deadImageFormat.length) {
  issues.deadImageFormat.forEach(x => li(`**${x.slug}** — \`${x.image}\``));
} else p('None.');

h3('Non-standard affiliate tag');
if (issues.noStandardTag.length) {
  lines.push(`Total: ${issues.noStandardTag.length}`);
  lines.push('');
  lines.push('These have neither `tag=clearpick06-20` nor `tag=lifehackfi0fb-20` nor an `amzn.to` shortlink. Affiliate commissions are not being captured.');
  lines.push('');
  issues.noStandardTag.forEach(x => li(`**${x.slug}** — \`${x.url}\``));
} else p('None — all affiliate links use a recognized tag or shortlink.');

h3('ASIN mismatch (amazonUrl ASIN ≠ image ASIN)');
if (issues.asinMismatch.length) {
  lines.push(`Total: ${issues.asinMismatch.length}`);
  issues.asinMismatch.forEach(x => li(`**${x.slug}** — URL ASIN: \`${x.urlAsin}\`, image ASIN: \`${x.imageAsin}\``));
} else p('None (note: shortlinks cannot be ASIN-checked).');

h3('Slug / page field mismatch');
if (issues.slugMismatch.length) {
  lines.push(`Total: ${issues.slugMismatch.length}`);
  issues.slugMismatch.forEach(x => li(`**${x.slug}** — \`page\` field is \`${x.actual}\`, expected \`${x.expected}\``));
} else p('None.');

h3('H1 title ≠ products.json name');
if (issues.h1Mismatch.length) {
  lines.push(`Total: ${issues.h1Mismatch.length}`);
  issues.h1Mismatch.forEach(x => li(`**${x.slug}** — H1: "${x.h1}" / JSON: "${x.jsonName}"`));
} else p('None.');

// ── Section 3: Content Quality ───────────────────────────────────────────────
h2('3. Content Quality Red Flags');

h3('Verdict contains AI-slop phrases (needs rewrite in Step 4B)');
lines.push(`Total: ${issues.slopVerdict.length}`);
if (issues.slopVerdict.length) {
  lines.push('');
  issues.slopVerdict.forEach(x => {
    li(`**products/${x.slug}.html** — "${x.phrases[0]}"${x.phrases.length > 1 ? ` (+${x.phrases.length - 1} more)` : ''}`);
  });
}

h3('Generic "Real Buyers" attributions (no specific source name)');
if (issues.genericRbsAttribution.length) {
  lines.push(`Total: ${issues.genericRbsAttribution.length}`);
  issues.genericRbsAttribution.forEach(x => li(`**products/${x.slug}.html** — ${x.sources.join('; ')}`));
} else p('None flagged by exact pattern. Manual spot-check still recommended.');

h3('"Sources & Further Reading" weak or generic links');
if (issues.sourcesOnlyGeneric.length) {
  lines.push(`Total: ${issues.sourcesOnlyGeneric.length}`);
  issues.sourcesOnlyGeneric.forEach(x => li(`**products/${x.slug}.html** — only ${x.linkCount} link(s), possibly generic`));
} else p('None.');

h3('Score ≥9.0 with 3+ complaint cards (potential overscore)');
if (issues.highScoreComplaints.length) {
  lines.push(`Total: ${issues.highScoreComplaints.length}`);
  issues.highScoreComplaints.forEach(x => li(`**products/${x.slug}.html** — score ${x.score}, ${x.complaints} complaint cards`));
} else p('None.');

h3('Score <6.5 and still promoted on site (potential underscore)');
if (issues.lowScorePromoted.length) {
  lines.push(`Total: ${issues.lowScorePromoted.length}`);
  lines.push('');
  lines.push('These products score below 6.5 but are still listed on category pages. Either the score needs review (fresh research may raise it) or the product should be considered for delisting.');
  lines.push('');
  issues.lowScorePromoted.forEach(x => li(`**products/${x.slug}.html** — score ${x.score}`));
} else p('None.');

// ── Section 4: Freshness ─────────────────────────────────────────────────────
h2('4. Catalog Freshness Flags');

h3('High-refresh-risk products (annual-release categories — check for newer models)');
lines.push(`Total: ${issues.refreshRisk.length} across categories: ${[...REFRESH_RISK_CATEGORIES].join(', ')}`);
lines.push('');
lines.push('These categories release new flagship models annually or biannually. Each should be checked to confirm no successor has launched that would displace this listing.');
lines.push('');

// Group by category for readability
const byCat = {};
for (const x of issues.refreshRisk) {
  if (!byCat[x.category]) byCat[x.category] = [];
  byCat[x.category].push(x);
}
for (const [cat, prods] of Object.entries(byCat).sort()) {
  lines.push(`**${cat}** (${prods.length})`);
  prods.sort((a, b) => b.score - a.score).forEach(x => li(`products/${x.slug}.html — score ${x.score}`));
  lines.push('');
}

h3("Editor's Pick vs. category top score");
if (issues.editorPickNotTop) {
  const x = issues.editorPickNotTop;
  li(`Homepage Editor's Pick is **${x.slug}** (score ${x.score}) but highest scorer in its category is **${x.topSlug}** (score ${x.topScore}). Consider updating the featured pick.`);
} else if (editorPickSlug) {
  p(`Editor's Pick (**${editorPickSlug}**) is confirmed as top scorer in its category. No inconsistency.`);
} else {
  p('Could not detect Editor\'s Pick product from homepage HTML.');
}

// ── Section 5: Known Issues ───────────────────────────────────────────────────
h2('5. Specific Known-Issue Verifications');

// Known 12 complaints-only (cross-ref)
h3('The 12 complaints-only pages (missing positive sentiment)');
lines.push('These pages were identified in Step 2 as having zero positive quotes. Confirmed still in complaints-only state. Step 4B should research and add positive buyer sentiment.');
lines.push('');
const foundIn12 = KNOWN_12.filter(s => issues.complaintsOnlyRbs.includes(s));
const notIn12 = KNOWN_12.filter(s => !issues.complaintsOnlyRbs.includes(s));
foundIn12.forEach(s => li(`products/${s}.html — ✅ confirmed complaints-only`));
if (notIn12.length) {
  notIn12.forEach(s => li(`products/${s}.html — ⚠️ NOT found in complaints-only list (may have been updated, or slug changed)`));
}

h3('Specific flagged products');
if (issues.knownIssues.length) {
  issues.knownIssues.forEach(x => li(`**${x.slug}** — ${x.note}`));
} else p('None.');

// ── Write file ────────────────────────────────────────────────────────────────
const report = lines.join('\n');
const outPath = path.join(ROOT, 'audit-report.md');
fs.writeFileSync(outPath, report, 'utf8');
console.log(`audit-report.md written (${report.split('\n').length} lines)`);
