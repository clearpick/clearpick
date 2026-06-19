#!/usr/bin/env node
'use strict';

/*
  fetch-press-images.js

  Downloads high-quality product images and self-hosts them in /public/images/.

  Image acquisition strategy (in priority order):
    1. Brand press kit CDN (add known URLs to PRESS_KIT_PATTERNS)
    2. Amazon SL1500 upgrade — for products where the image field is a real
       m.media-amazon.com/images/I/{id} URL; upgrades 500px → 1500px
    3. Amazon product page — fetches the product page HTML to extract the
       hiRes image URL (blocked by Amazon's JS challenge — kept as fallback)

  SKIP cases (reported honestly):
    - VERIFY_IMAGE_ID with no press kit pattern: Amazon pages need JS rendering
    - images-na.ssl-images-amazon.com ASIN thumbnails: these are ~80px and not
      worth self-hosting; the Amazon CDN serves them fine as-is

  Saves to:   public/images/products/{slug}/hero.jpg
  Updates:    research-queue/{slug}.json  →  images.hero (+ empty lifestyle/detail)
              products.json               →  image field → local path
  Rebuilds:   products/{slug}.html

  Usage:
    node scripts/fetch-press-images.js <slug>
    node scripts/fetch-press-images.js --brand Dyson
    node scripts/fetch-press-images.js --brand Weber --brand Garmin
    node scripts/fetch-press-images.js --all
*/

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { renderProductPage, CAT_ALIASES } = require('./lib/render-product-page');

const ROOT        = path.resolve(__dirname, '..');
const QUEUE_DIR   = path.join(ROOT, 'research-queue');
const IMG_DIR     = path.join(ROOT, 'public', 'images', 'products');
const PRODUCTS_JS = path.join(ROOT, 'products.json');

/* ── Brand press kit patterns ───────────────────────────────────────────────
   Add working URLs here as they're discovered. Patterns are tried before the
   Amazon fallback. Each array entry is a full image URL to try.             */
const PRESS_KIT_PATTERNS = {
  // 'Dyson':    ['https://media.dyson.com/{model}/hero.jpg'],
  // 'Garmin':   ['https://static.garmin.com/pumac/{model}/hero.jpg'],
};

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-CA,en;q=0.9',
  'Accept-Encoding': 'identity',
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: BROWSER_HEADERS }, res => {
      if (res.statusCode >= 301 && res.statusCode <= 303 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchText(loc).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function downloadBinary(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const mod = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    const req = mod.get(url, { headers: BROWSER_HEADERS }, res => {
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const len = parseInt(res.headers['content-length'] || '0', 10);
      if (len > 0 && len < 1000) {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        return reject(new Error(`Response too small (${len} bytes) — likely a placeholder`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', err => { try { fs.unlinkSync(destPath); } catch (_) {} reject(err); });
    });
    req.on('error', err => { file.close(); try { fs.unlinkSync(destPath); } catch (_) {} reject(err); });
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

function probeUrl(url) {
  return new Promise(resolve => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'HEAD', headers: BROWSER_HEADERS }, res => {
      const len = parseInt(res.headers['content-length'] || '0', 10);
      resolve(res.statusCode === 200 && len > 1000);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(6000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/* Returns the best resolution URL for m.media-amazon.com/images/I/ URLs only.
   The _SL1500_ suffix is supported for real image IDs on this CDN.         */
function upgradeAmazonSL1500(url) {
  if (!url || !url.includes('m.media-amazon.com/images/I/')) return null;
  return url.replace(/\._[A-Z_0-9,]+_\.jpg$/i, '._AC_SL1500_.jpg');
}

/* Extract hiRes image URL from Amazon product page HTML (JS-rendered pages
   return empty — Amazon blocks server-side scraping via Cloudfront.)       */
function extractHiResFromPage(html) {
  const m = html.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.jpg)"/);
  return m ? m[1] : null;
}

async function fetchForSlug(slug) {
  const jsonPath = path.join(QUEUE_DIR, `${slug}.json`);
  if (!fs.existsSync(jsonPath)) {
    return { slug, status: 'skip', reason: 'No research-queue JSON' };
  }

  const p    = JSON.parse(fs.readFileSync(jsonPath, 'utf8').replace(/^﻿/, ''));
  const asin = p.asin || p.verifiedAsin;
  const brand = p.brand || '';

  const destPath = path.join(IMG_DIR, slug, 'hero.jpg');
  const heroUrl  = `/images/products/${slug}/hero.jpg`;

  // Skip if already fetched and non-trivial
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 5000) {
    return { slug, status: 'skip', reason: 'Already fetched' };
  }

  let downloadUrl = null;
  let source = null;

  /* 1. Brand press kit ─────────────────────────────────────────────────── */
  for (const url of (PRESS_KIT_PATTERNS[brand] || [])) {
    if (await probeUrl(url)) { downloadUrl = url; source = 'press-kit'; break; }
  }

  /* 2. Amazon SL1500 upgrade (requires real image ID, not VERIFY_IMAGE_ID).
        Skip the HEAD probe — Amazon CDN may redirect HEAD but not GET.
        Download directly; downloadBinary() rejects tiny/broken responses. */
  if (!downloadUrl && p.image && p.image.includes('m.media-amazon.com/images/I/')) {
    const upgraded = upgradeAmazonSL1500(p.image);
    downloadUrl = upgraded || p.image;
    source = upgraded ? 'amazon-sl1500' : 'amazon-original';
  }

  /* 3. Amazon product page — last resort (usually blocked by JS challenge) */
  if (!downloadUrl && asin) {
    try {
      const r = await fetchText(`https://www.amazon.ca/dp/${asin}`);
      if (r.statusCode === 200 && r.body.length > 10000) {
        const hiRes = extractHiResFromPage(r.body);
        if (hiRes) { downloadUrl = hiRes; source = 'amazon-page-ca'; }
      }
    } catch (_) {}
  }

  if (!downloadUrl) {
    // Give a specific reason based on image field type
    let reason = 'No press kit URL configured';
    if (p.image === 'VERIFY_IMAGE_ID') {
      reason = 'VERIFY_IMAGE_ID — Amazon pages require JS rendering; add press kit URL or fix image ID';
    } else if (p.image && p.image.includes('images-na.ssl-images-amazon.com')) {
      reason = 'ASIN thumbnail URL — too low-res to self-host; needs real image ID';
    }
    return { slug, status: 'fail', reason };
  }

  /* Download ────────────────────────────────────────────────────────────── */
  try {
    await downloadBinary(downloadUrl, destPath);
  } catch (err) {
    return { slug, status: 'fail', reason: `Download failed: ${err.message}` };
  }

  const sizeMb = (fs.statSync(destPath).size / 1024).toFixed(0);

  /* Update research-queue JSON ─────────────────────────────────────────── */
  p.images = { hero: heroUrl, lifestyle: (p.images && p.images.lifestyle) || '', detail: (p.images && p.images.detail) || '' };
  fs.writeFileSync(jsonPath, JSON.stringify(p, null, 2), 'utf8');

  /* Update products.json image field ─────────────────────────────────────── */
  const products = JSON.parse(fs.readFileSync(PRODUCTS_JS, 'utf8').replace(/^﻿/, ''));
  const idx = products.findIndex(x => x.id === slug);
  if (idx !== -1) {
    products[idx].image = heroUrl;
    fs.writeFileSync(PRODUCTS_JS, JSON.stringify(products, null, 2), 'utf8');
  }

  /* Rebuild product HTML ──────────────────────────────────────────────── */
  try {
    const pR = { ...p, category: CAT_ALIASES[p.category] || p.category };
    const html = renderProductPage(pR, products);
    fs.writeFileSync(path.join(ROOT, 'products', `${slug}.html`), html, 'utf8');
  } catch (err) {
    return { slug, status: 'ok-no-rebuild', source, sizeMb, reason: `Image saved; rebuild failed: ${err.message}` };
  }

  return { slug, status: 'ok', source, sizeMb };
}

function resolveSlugs(args) {
  const allFiles = fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json'));
  if (args.includes('--all')) return allFiles.map(f => f.replace(/\.json$/, ''));

  const brands = [];
  const explicit = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--brand' && args[i + 1]) { brands.push(args[++i].toLowerCase()); }
    else if (!args[i].startsWith('--'))         { explicit.push(args[i]); }
  }

  const fromBrands = brands.length
    ? allFiles.flatMap(f => {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, f), 'utf8').replace(/^﻿/, ''));
          return (d.brand && brands.includes(d.brand.toLowerCase())) ? [f.replace(/\.json$/, '')] : [];
        } catch (_) { return []; }
      })
    : [];

  return [...new Set([...explicit, ...fromBrands])];
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage:\n  node scripts/fetch-press-images.js <slug>\n  node scripts/fetch-press-images.js --brand Dyson\n  node scripts/fetch-press-images.js --all');
    process.exit(1);
  }

  const slugs = resolveSlugs(args);
  if (!slugs.length) { console.error('No matching slugs.'); process.exit(1); }

  console.log(`\nProcessing ${slugs.length} slug(s)…\n`);

  const results = [];
  for (const slug of slugs) {
    process.stdout.write(`  ${slug.padEnd(45)} `);
    const r = await fetchForSlug(slug);
    results.push(r);
    if (r.status === 'ok')         console.log(`✓  ${r.source} (${r.sizeMb} KB)`);
    else if (r.status === 'skip')  console.log(`—  ${r.reason}`);
    else                            console.log(`✗  ${r.reason}`);
    await new Promise(res => setTimeout(res, 300));
  }

  const ok    = results.filter(r => r.status === 'ok');
  const skip  = results.filter(r => r.status === 'skip');
  const fail  = results.filter(r => r.status === 'fail' || r.status === 'ok-no-rebuild');

  console.log(`\n── Summary ────────────────────────────────────────────────────`);
  console.log(`  ✓ Downloaded & rebuilt : ${ok.length}`);
  console.log(`  — Skipped              : ${skip.length}`);
  console.log(`  ✗ Failed / no image    : ${fail.length}`);

  if (ok.length) {
    const bySrc = {};
    ok.forEach(r => { bySrc[r.source] = (bySrc[r.source] || 0) + 1; });
    console.log('\n  Sources:');
    Object.entries(bySrc).forEach(([s, n]) => console.log(`    ${s}: ${n}`));
    const totalKb = ok.reduce((a, r) => a + Number(r.sizeMb), 0);
    console.log(`\n  Total downloaded: ~${totalKb} KB`);
  }

  if (fail.length) {
    const byReason = {};
    fail.forEach(r => {
      const key = r.reason.split('—')[0].trim();
      byReason[key] = (byReason[key] || []);
      byReason[key].push(r.slug);
    });
    console.log('\n  Failures by reason:');
    Object.entries(byReason).forEach(([reason, slugs]) => {
      console.log(`    ${reason} (${slugs.length})`);
    });
  }
  console.log('');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
