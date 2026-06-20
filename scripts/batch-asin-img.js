'use strict';

/*
  batch-asin-img.js  —  Fetch product images from Amazon via Puppeteer + real Chrome

  Standard fallback for products where manufacturer-site scraping fails.
  Uses the ASIN from each research-queue JSON to visit amazon.ca, extract
  the hi-res image URL, download to public/images/products/{slug}/hero.jpg,
  and update products.json + products/{slug}.html.

  Pure HTTPS cannot beat Amazon's session/TLS fingerprint checks — real Chrome
  via Puppeteer is required. This script restarts the browser every 25 products
  to rotate cookies and reduce bot-detection risk.

  Usage:
    node scripts/batch-asin-img.js [--limit N] [--slug x] [--brand "X"]
*/

const puppeteer = require('puppeteer-core');
const https     = require('https');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const urlMod    = require('url');

const ROOT        = path.resolve(__dirname, '..');
const PRODUCTS_JS = path.join(ROOT, 'products.json');
const QUEUE_DIR   = path.join(ROOT, 'research-queue');
const IMG_DIR     = path.join(ROOT, 'public', 'images', 'products');
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const DELAY_MS      = 2000;   // between Amazon page requests
const NAV_TIMEOUT   = 25000;
const RESTART_EVERY = 25;     // fresh browser + cookies every N products

// ── CLI args ──────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const limitArg  = args.indexOf('--limit');
const limit     = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;
const slugArg   = args.indexOf('--slug');
const onlySlug  = slugArg !== -1 ? args[slugArg + 1] : null;
const brandArg  = args.indexOf('--brand');
const onlyBrand = brandArg !== -1 ? args[brandArg + 1].toLowerCase() : null;

// ── Helpers ───────────────────────────────────────────────────────────────────
function downloadBinary(reqUrl, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    let redirects = 0;
    function doReq(u) {
      if (++redirects > 5) return reject(new Error('Too many redirects'));
      const parsed = new urlMod.URL(u);
      const mod = parsed.protocol === 'http:' ? http : https;
      mod.get({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 20000,
      }, res => {
        if ([301, 302, 303].includes(res.statusCode) && res.headers.location)
          return doReq(new urlMod.URL(res.headers.location, u).href);
        if (res.statusCode !== 200) {
          file.close(); try { fs.unlinkSync(destPath); } catch (_) {}
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', err => {
        file.close(); try { fs.unlinkSync(destPath); } catch (_) {}
        reject(err);
      });
    }
    doReq(reqUrl);
  });
}

function updateProductHtml(slug, heroUrl) {
  const p = path.join(ROOT, 'products', slug + '.html');
  if (!fs.existsSync(p)) return;
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace(/(<img[^>]+class="[^"]*product-hero[^"]*"[^>]*src=")[^"]*(")/g, `$1${heroUrl}$2`);
  html = html.replace(/(<meta property="og:image"[^>]+content=")[^"]*(")/g, `$1${heroUrl}$2`);
  fs.writeFileSync(p, html, 'utf8');
}

// Strip Amazon resize suffixes to maximise resolution
// e.g. 71abc123._AC_SL1500_.jpg  →  71abc123.jpg
function maxResUrl(url) {
  return url.replace(/(\._[A-Z]{2,}[^.]*)+(\.[a-z]+)$/, '$2');
}

function extractIdFromUrl(url) {
  const m = url.match(/\/images\/I\/([A-Za-z0-9%._-]+?)(?:\._[A-Z]|\.jpg|\.png)/);
  return m ? m[1] : null;
}

// ── Extract image from rendered Amazon page ───────────────────────────────────
async function extractImageUrl(page, asin) {
  // Try amazon.ca first, fall back to amazon.com (ASINs are often .com-first)
  const urls = [`https://www.amazon.ca/dp/${asin}`, `https://www.amazon.com/dp/${asin}`];
  let loaded = false;
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
      const title = await page.title();
      if (!title.toLowerCase().includes('page not found') && !title.toLowerCase().includes('404')) {
        loaded = true;
        break;
      }
    } catch (_) { /* timeout — try extracting anyway */ loaded = true; break; }
  }
  if (!loaded) return null;

  await new Promise(r => setTimeout(r, 1500));

  return page.evaluate(() => {
    // Priority 1: colorImages hiRes field
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const t = s.textContent || '';
      const hiRes = t.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.(?:jpg|jpeg|png))"/);
      if (hiRes) return hiRes[1];
      const large = t.match(/"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.(?:jpg|jpeg|png))"/);
      if (large) return large[1];
      const mainUrl = t.match(/"mainUrl"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.(?:jpg|jpeg|png))"/);
      if (mainUrl) return mainUrl[1];
    }

    // Priority 2: landingImage data attributes
    const img = document.getElementById('landingImage') ||
                document.getElementById('imgBlkFront') ||
                document.querySelector('#main-image-container img') ||
                document.querySelector('.a-dynamic-image');
    if (img) {
      const src = img.getAttribute('data-old-hires') ||
                  img.getAttribute('data-a-hires') ||
                  img.getAttribute('src') || '';
      if (src && src.includes('m.media-amazon.com')) return src;
    }

    // Priority 3: data-a-dynamic-image JSON (pick largest)
    const dyn = document.querySelector('[data-a-dynamic-image]');
    if (dyn) {
      try {
        const map = JSON.parse(dyn.getAttribute('data-a-dynamic-image'));
        const urls = Object.keys(map);
        if (urls.length) {
          let best = urls[0], bestArea = 0;
          for (const u of urls) {
            const dims = map[u];
            const area = dims[0] * dims[1];
            if (area > bestArea) { bestArea = area; best = u; }
          }
          return best;
        }
      } catch (_) {}
    }

    return null;
  });
}

// ── Browser lifecycle ─────────────────────────────────────────────────────────
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];
let uaIdx = 0;

async function launchBrowser() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  const page = await browser.newPage();
  await page.setUserAgent(UAS[uaIdx++ % UAS.length]);
  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
    else req.continue();
  });
  // Warm-up visit to get session cookies
  try { await page.goto('https://www.amazon.ca', { waitUntil: 'domcontentloaded', timeout: 15000 }); } catch (_) {}
  await new Promise(r => setTimeout(r, 1500));
  return { browser, page };
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  let products = JSON.parse(fs.readFileSync(PRODUCTS_JS, 'utf8').replace(/^﻿/, ''));

  let targets = products.filter(p =>
    !p.image || p.image.includes('VERIFY_IMAGE_ID') || p.image.includes('images-na.ssl')
  );

  if (onlySlug)  targets = targets.filter(p => p.id === onlySlug);
  if (onlyBrand) {
    targets = targets.filter(p => {
      const qp = path.join(QUEUE_DIR, p.id + '.json');
      if (!fs.existsSync(qp)) return false;
      try {
        const q = JSON.parse(fs.readFileSync(qp, 'utf8').replace(/^﻿/, ''));
        return (q.brand || '').toLowerCase() === onlyBrand;
      } catch (_) { return false; }
    });
  }
  if (isFinite(limit)) targets = targets.slice(0, limit);
  if (!targets.length) { console.log('Nothing to do.'); return; }

  console.log(`\nProcessing ${targets.length} product(s)…\n`);

  let { browser, page } = await launchBrowser();
  const results = { ok: 0, skip: 0, fail: {} };

  for (let i = 0; i < targets.length; i++) {
    if (i > 0 && i % RESTART_EVERY === 0) {
      console.log(`\n  ── restarting browser (session ${Math.floor(i / RESTART_EVERY)}) ──\n`);
      try { await browser.close(); } catch (_) {}
      ({ browser, page } = await launchBrowser());
    }

    const prod = targets[i];
    const slug = prod.id;
    process.stdout.write(`[${String(i + 1).padStart(3)}/${targets.length}] ${slug.padEnd(52)} `);

    // Skip if we already have a good file
    const destPath = path.join(IMG_DIR, slug, 'hero.jpg');
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10000) {
      console.log('—  skip (have file)');
      results.skip++;
      continue;
    }

    // Get ASIN
    let asin = null;
    const queuePath = path.join(QUEUE_DIR, slug + '.json');
    if (fs.existsSync(queuePath)) {
      try {
        const q = JSON.parse(fs.readFileSync(queuePath, 'utf8').replace(/^﻿/, ''));
        if (q.asin && q.asin !== 'VERIFY_ASIN') asin = q.asin;
      } catch (_) {}
    }
    if (!asin && prod.amazonUrl) {
      const m = prod.amazonUrl.match(/\/dp\/([A-Z0-9]{10})/);
      if (m) asin = m[1];
    }
    if (!asin) {
      console.log('—  no ASIN');
      results.skip++;
      continue;
    }

    // Extract image URL from rendered page
    let rawUrl;
    try {
      rawUrl = await extractImageUrl(page, asin);
    } catch (err) {
      const reason = `page error: ${err.message.slice(0, 50)}`;
      console.log(`✗  ${reason}`);
      results.fail[reason] = (results.fail[reason] || 0) + 1;
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    if (!rawUrl || !rawUrl.includes('amazon.com/images')) {
      console.log('✗  not found');
      results.fail['not found'] = (results.fail['not found'] || 0) + 1;
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    // Build max-res URL
    const imageId = extractIdFromUrl(rawUrl);
    let imageUrl = imageId
      ? `https://m.media-amazon.com/images/I/${imageId}._AC_SL1500_.jpg`
      : maxResUrl(rawUrl);

    // Download
    try {
      await downloadBinary(imageUrl, destPath);
    } catch (_) {
      // Try original URL if SL1500 build fails
      if (imageId) {
        try {
          imageUrl = rawUrl;
          await downloadBinary(imageUrl, destPath);
        } catch (err2) {
          const reason = `download: ${err2.message}`;
          console.log(`✗  ${reason}`);
          results.fail[reason] = (results.fail[reason] || 0) + 1;
          try { fs.unlinkSync(destPath); } catch (_2) {}
          await new Promise(r => setTimeout(r, DELAY_MS));
          continue;
        }
      } else {
        const reason = 'download failed';
        console.log(`✗  ${reason}`);
        results.fail[reason] = (results.fail[reason] || 0) + 1;
        try { fs.unlinkSync(destPath); } catch (_2) {}
        await new Promise(r => setTimeout(r, DELAY_MS));
        continue;
      }
    }

    const sizeKb = Math.round(fs.statSync(destPath).size / 1024);
    if (sizeKb < 5) {
      console.log(`✗  too small (${fs.statSync(destPath).size} B)`);
      results.fail['too small'] = (results.fail['too small'] || 0) + 1;
      try { fs.unlinkSync(destPath); } catch (_) {}
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    const heroUrl = `/images/products/${slug}/hero.jpg`;
    const idx = products.findIndex(p => p.id === slug);
    if (idx !== -1) products[idx].image = heroUrl;
    updateProductHtml(slug, heroUrl);
    if (fs.existsSync(queuePath)) {
      try {
        const q = JSON.parse(fs.readFileSync(queuePath, 'utf8').replace(/^﻿/, ''));
        q.image = heroUrl;
        fs.writeFileSync(queuePath, JSON.stringify(q, null, 2), 'utf8');
      } catch (_) {}
    }

    console.log(`✓  ${sizeKb} KB`);
    results.ok++;

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  try { await browser.close(); } catch (_) {}
  fs.writeFileSync(PRODUCTS_JS, JSON.stringify(products, null, 2), 'utf8');

  const totalFail = Object.values(results.fail).reduce((a, b) => a + b, 0);
  console.log('\n── Summary ──────────────────────────────────────────────────────────');
  console.log(`  ✓ ${results.ok}  skipped: ${results.skip}  failed: ${totalFail}`);
  for (const [reason, count] of Object.entries(results.fail)) {
    console.log(`    ${reason}: ${count}`);
  }
  console.log('');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
