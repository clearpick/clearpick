#!/usr/bin/env node
'use strict';

/*
  batch-amz-img4.js

  Uses Puppeteer + system Chrome to visit each Amazon.ca product page,
  extract the real image ID, download the SL1500 version, update
  products.json and the product HTML.

  Usage:
    node scripts/batch-amz-img4.js [--limit N] [--slug some-slug]

  Options:
    --limit N    Process at most N products (default: all)
    --slug <s>   Process only this slug
    --dry-run    Print what would be fetched, don't download
*/

const puppeteer = require('puppeteer-core');
const https     = require('https');
const fs        = require('fs');
const path      = require('path');

const ROOT         = path.resolve(__dirname, '..');
const PRODUCTS_JS  = path.join(ROOT, 'products.json');
const QUEUE_DIR    = path.join(ROOT, 'research-queue');
const IMG_DIR      = path.join(ROOT, 'public', 'images', 'products');

const CHROME_PATH  =
  process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

const DELAY_MS     = 6000;   // longer delay — reduces bot detection risk
const NAV_TIMEOUT  = 25000;

// ── args ──────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const dryRun    = args.includes('--dry-run');
const limitArg  = args.indexOf('--limit');
const limit     = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;
const slugArg   = args.indexOf('--slug');
const onlySlug  = slugArg !== -1 ? args[slugArg + 1] : null;

// ── helpers ───────────────────────────────────────────────────────────────────
function downloadBinary(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    const req  = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    }, res => {
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(destPath); } catch (_) {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', err => { file.close(); try { fs.unlinkSync(destPath); } catch (_) {} reject(err); });
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function probeUrl(url) {
  return new Promise(resolve => {
    const req = https.request(url, { method: 'HEAD' }, res => resolve(res.statusCode === 200));
    req.on('error', () => resolve(false));
    req.setTimeout(6000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function extractImageId(page, asin) {
  const url = `https://www.amazon.ca/dp/${asin}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  } catch (_) {
    // timeout on load — try extracting anyway
  }

  // Wait briefly for dynamic content
  await new Promise(r => setTimeout(r, 1500));

  const result = await page.evaluate(() => {
    // Method 1: colorImages JSON in page data
    const scripts = document.querySelectorAll('script');
    for (let i = 0; i < scripts.length; i++) {
      const t = scripts[i].textContent || '';
      // Look for hiRes or large image in colorImages data
      const hiRes = t.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.jpg)"/);
      if (hiRes) return hiRes[1];
      const large = t.match(/"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.jpg)"/);
      if (large) return large[1];
    }

    // Method 2: main product image element
    const mainImg = document.getElementById('landingImage') ||
                    document.getElementById('imgBlkFront') ||
                    document.querySelector('#main-image-container img') ||
                    document.querySelector('.a-dynamic-image');
    if (mainImg) {
      const src = mainImg.getAttribute('data-old-hires') ||
                  mainImg.getAttribute('data-a-hires') ||
                  mainImg.getAttribute('src') || '';
      const m = src.match(/\/images\/I\/([A-Za-z0-9%._-]+)\./);
      if (m) return 'https://m.media-amazon.com/images/I/' + m[1] + '.jpg';
    }

    // Method 3: dynamic-images JSON attribute
    const dynImg = document.querySelector('[data-a-dynamic-image]');
    if (dynImg) {
      try {
        const keys = Object.keys(JSON.parse(dynImg.getAttribute('data-a-dynamic-image')));
        if (keys.length) return keys[0];
      } catch (_) {}
    }

    return null;
  });

  return result;
}

function extractIdFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/images\/I\/([A-Za-z0-9%._-]+?)(?:\._|\.jpg)/);
  return m ? m[1] : null;
}

function buildSL1500(imageId) {
  return `https://m.media-amazon.com/images/I/${imageId}._AC_SL1500_.jpg`;
}
function buildSX500(imageId) {
  return `https://m.media-amazon.com/images/I/${imageId}._AC_SX500_.jpg`;
}

function updateProductHtml(slug, heroUrl) {
  const htmlPath = path.join(ROOT, 'products', `${slug}.html`);
  if (!fs.existsSync(htmlPath)) return false;
  let html = fs.readFileSync(htmlPath, 'utf8');
  // Update hero img src (product page hero section)
  html = html.replace(
    /(<img[^>]+class="[^"]*product-hero[^"]*"[^>]*src=")[^"]*(")/,
    `$1${heroUrl}$2`
  );
  // Also update og:image if present
  html = html.replace(
    /(<meta property="og:image"[^>]+content=")[^"]*(")/,
    `$1${heroUrl}$2`
  );
  fs.writeFileSync(htmlPath, html, 'utf8');
  return true;
}

async function main() {
  // Load products
  let products = JSON.parse(fs.readFileSync(PRODUCTS_JS, 'utf8').replace(/^﻿/, ''));

  // Determine slugs to process
  let targets = products.filter(p =>
    !p.image ||
    p.image.includes('VERIFY_IMAGE_ID') ||
    p.image.includes('images-na.ssl-images-amazon.com')
  );

  if (onlySlug) {
    targets = targets.filter(p => p.id === onlySlug);
  }

  if (!targets.length) {
    console.log('No products need image fix.');
    return;
  }

  if (isFinite(limit)) targets = targets.slice(0, limit);

  console.log(`\nProcessing ${targets.length} product(s) with bad images…\n`);

  if (dryRun) {
    targets.forEach(p => console.log(' would fetch:', p.id, '(ASIN needed from research-queue)'));
    return;
  }

  const RESTART_EVERY = 25; // fresh browser + cookies every N products

  let browser = null;
  let page    = null;

  async function launchBrowser() {
    if (browser) { try { await browser.close(); } catch (_) {} }
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    page = await browser.newPage();
    // Randomise UA slightly each session
    const builds = ['124.0.0.0', '123.0.0.0', '122.0.6261.128'];
    const build  = builds[Math.floor(Math.random() * builds.length)];
    await page.setUserAgent(`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${build} Safari/537.36`);
    await page.setViewport({ width: 1280, height: 900 });
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });
    // Brief warm-up visit so cookies are set before product pages
    try { await page.goto('https://www.amazon.ca', { waitUntil: 'domcontentloaded', timeout: 15000 }); } catch (_) {}
    await new Promise(r => setTimeout(r, 2000));
  }

  await launchBrowser();

  const results = { ok: [], skip: [], fail: [] };

  for (let i = 0; i < targets.length; i++) {
    // Restart browser every N products for fresh cookies/session
    if (i > 0 && i % RESTART_EVERY === 0) {
      console.log(`\n  ── restarting browser (batch ${Math.floor(i / RESTART_EVERY)}) ──\n`);
      await launchBrowser();
    }
    const prod = targets[i];
    const slug = prod.id;
    process.stdout.write(`[${String(i + 1).padStart(3)}/${targets.length}] ${slug.padEnd(50)} `);

    // Get ASIN — check research-queue JSON first, then products.json amazonUrl, then image URL
    const queuePath = path.join(QUEUE_DIR, `${slug}.json`);
    let asin = null;

    if (fs.existsSync(queuePath)) {
      try {
        const q = JSON.parse(fs.readFileSync(queuePath, 'utf8').replace(/^﻿/, ''));
        if (q.asin && q.asin !== 'VERIFY_ASIN') asin = q.asin;
        else if (q.verifiedAsin && q.verifiedAsin !== 'VERIFY_ASIN') asin = q.verifiedAsin;
      } catch (_) {}
    }

    // Fall back: extract from amazonUrl in products.json (e.g. /dp/B09B8V1LZ3/)
    if (!asin && prod.amazonUrl) {
      const m = prod.amazonUrl.match(/\/dp\/([A-Z0-9]{10})/);
      if (m) asin = m[1];
    }

    // Fall back: extract from images-na ASIN thumbnail URL (e.g. /images/P/B09B8V1LZ3.01.)
    if (!asin && prod.image && prod.image.includes('images-na.ssl-images-amazon.com')) {
      const m = prod.image.match(/\/images\/P\/([A-Z0-9]{10})\./);
      if (m) asin = m[1];
    }

    if (!asin) {
      console.log(`—  no ASIN found`);
      results.skip.push({ slug, reason: 'no ASIN' });
      continue;
    }

    // Already have a good local image?
    const destPath = path.join(IMG_DIR, slug, 'hero.jpg');
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10000) {
      console.log(`—  already fetched`);
      results.skip.push({ slug, reason: 'already fetched' });
      continue;
    }

    // Fetch page and extract image
    let imageUrl = null;
    try {
      const extracted = await extractImageId(page, asin);
      if (extracted) {
        const imageId = extractIdFromUrl(extracted) || extracted.split('/').pop().split('.')[0];
        // Try SL1500 first
        const sl1500 = buildSL1500(imageId);
        const has1500 = await probeUrl(sl1500);
        imageUrl = has1500 ? sl1500 : buildSX500(imageId);
      }
    } catch (err) {
      console.log(`✗  page error: ${err.message}`);
      results.fail.push({ slug, reason: err.message });
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    if (!imageUrl) {
      console.log(`✗  image not found on page`);
      results.fail.push({ slug, reason: 'not found on page' });
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    // Download
    try {
      await downloadBinary(imageUrl, destPath);
    } catch (err) {
      console.log(`✗  download failed: ${err.message}`);
      results.fail.push({ slug, reason: `download: ${err.message}` });
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    const sizeKb = Math.round(fs.statSync(destPath).size / 1024);
    const heroUrl = `/images/products/${slug}/hero.jpg`;
    const src = imageUrl.includes('SL1500') ? '1500px' : '500px';

    // Update products.json in memory
    const idx = products.findIndex(p => p.id === slug);
    if (idx !== -1) products[idx].image = heroUrl;

    // Update product HTML
    updateProductHtml(slug, heroUrl);

    // Update research-queue JSON image field
    if (fs.existsSync(queuePath)) {
      try {
        const q = JSON.parse(fs.readFileSync(queuePath, 'utf8').replace(/^﻿/, ''));
        q.image = imageUrl;
        q.images = { hero: heroUrl, lifestyle: '', detail: '' };
        fs.writeFileSync(queuePath, JSON.stringify(q, null, 2), 'utf8');
      } catch (_) {}
    }

    console.log(`✓  ${src} (${sizeKb} KB)`);
    results.ok.push({ slug, src, sizeKb });

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  try { await browser.close(); } catch (_) {}

  // Save updated products.json
  fs.writeFileSync(PRODUCTS_JS, JSON.stringify(products, null, 2), 'utf8');
  console.log(`\n✓ products.json saved`);

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n── Summary ─────────────────────────────────────────────────────────');
  console.log(`  ✓ Downloaded : ${results.ok.length}`);
  console.log(`  — Skipped   : ${results.skip.length}`);
  console.log(`  ✗ Failed    : ${results.fail.length}`);

  if (results.ok.length) {
    const by1500 = results.ok.filter(r => r.src === '1500px').length;
    const by500  = results.ok.filter(r => r.src === '500px').length;
    console.log(`\n  Resolution: ${by1500} × 1500px,  ${by500} × 500px`);
    const totalKb = results.ok.reduce((a, r) => a + r.sizeKb, 0);
    console.log(`  Total downloaded: ~${totalKb} KB`);
  }

  if (results.fail.length) {
    console.log('\n  Failures:');
    const byReason = {};
    results.fail.forEach(r => { byReason[r.reason] = (byReason[r.reason] || 0) + 1; });
    Object.entries(byReason).forEach(([k, v]) => console.log(`    ${k}: ${v}`));
  }

  console.log('');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
