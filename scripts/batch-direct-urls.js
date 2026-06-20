'use strict';

/*
  batch-direct-urls.js  —  Fetch product images using known direct product page URLs

  Unlike batch-puppeteer-mfr.js (which uses brand search pages), this script
  hits the exact product page for each slug — better for brands that don't
  surface og:image on search results.

  Usage:
    node scripts/batch-direct-urls.js [--limit N] [--slug x]
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

const PAGE_TIMEOUT = 20000;
const NAV_WAIT     = 8000;

const args     = process.argv.slice(2);
const limitArg = args.indexOf('--limit');
const limit    = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;
const slugArg  = args.indexOf('--slug');
const onlySlug = slugArg !== -1 ? args[slugArg + 1] : null;

// ── Direct product page URLs, tried in order ──────────────────────────────────
const DIRECT_URLS = {
  // Sony cameras
  'sony-a6700-mirrorless-camera':    ['https://www.sony.ca/en/products/ilce-6700', 'https://electronics.sony.com/imaging/interchangeable-lens-cameras/aps-c/p/ilce6700-b'],
  'sony-e-55-210mm-lens':            ['https://www.sony.ca/en/products/sel55210', 'https://electronics.sony.com/imaging/lenses/aps-c-e-mount/p/sel55210-2'],
  'sony-rx100-vii-point-shoot':      ['https://www.sony.ca/en/products/dsc-rx100m7', 'https://electronics.sony.com/imaging/compact-cameras/p/dscrx100m7-b'],
  'sony-zv-e10-ii-vlog-camera':      ['https://www.sony.ca/en/products/zv-e10m2', 'https://www.sony.ca/en/search/?q=ZV-E10+II'],

  // Canon cameras
  'canon-eos-r10-camera':            ['https://www.canon.ca/en/product?name=EOS_R10_Body', 'https://www.usa.canon.com/shop/p/eos-r10'],
  'canon-powershot-v10':             ['https://www.canon.ca/en/product?name=PowerShot_V10', 'https://www.usa.canon.com/shop/p/powershot-v10'],

  // Nikon
  'nikon-z50-ii-camera':             ['https://www.nikon.ca/en/nikon-products/product/mirrorless-cameras/z-50-ii-body.html', 'https://www.nikonusa.com/nikon-products/product/mirrorless-cameras/z-50-ii-body.html'],

  // Fujifilm
  'fujifilm-x-t30-ii-camera':        ['https://fujifilm-x.com/en-us/products/cameras/x-t30-ii/', 'https://www.fujifilm.com/us/en/consumer/cameras/x/fujifilm-x-t30-ii'],

  // OM System
  'om-system-om-5-camera':           ['https://omsystem.com/en-us/site/om5.html', 'https://getolympus.com/us/en/cameras/om-5.html'],

  // Insta360
  'insta360-x4-360-camera':          ['https://www.insta360.com/product/insta360-x4', 'https://store.insta360.com/product/x4'],

  // Fender & Squier
  'fender-player-stratocaster':      ['https://www.fender.com/en-CA/guitars/stratocaster/player-stratocaster/0144502500.html', 'https://www.fender.com/en-CA/guitars/stratocaster/player-stratocaster/'],
  'fender-cd-60s-acoustic-guitar':   ['https://www.fender.com/en-CA/guitars/acoustic-guitars/cd-60s/0970110021.html', 'https://www.fender.com/en-CA/guitars/acoustic-guitars/cd-60s/'],
  'fender-frontman-10g-amp':         ['https://www.fender.com/en-CA/guitar-amplifiers/frontman-series/frontman-10g/2311000000.html', 'https://www.fender.com/en-CA/guitar-amplifiers/frontman-series/frontman-10g/'],
  'squier-classic-vibe-50s-strat':   ['https://www.fender.com/en-CA/guitars/stratocaster/classic-vibe-50s-stratocaster/0374005500.html', 'https://www.fender.com/en-CA/guitars/stratocaster/classic-vibe-50s-stratocaster/'],

  // Epiphone
  'epiphone-les-paul-standard-50s':  ['https://www.epiphone.com/en-US/Guitar/Les-Paul/Les-Paul-Standard-50s', 'https://www.epiphone.com/en-US/Guitars/Les-Paul/Les-Paul-Standard-50s'],

  // Taylor Guitars
  'taylor-114ce-acoustic-electric':  ['https://www.taylorguitars.com/guitars/acoustic/114ce', 'https://www.taylorguitars.com/guitars/acoustic/category/grand-auditorium/114ce'],

  // Seagull Guitars
  'seagull-s6-original-acoustic':    ['https://www.seagullguitars.com/en/products/s6-original-qit.html', 'https://www.seagullguitars.com/en/products/s6-original.html'],

  // Shure
  'shure-sm7db-dynamic-mic':         ['https://www.shure.com/en-CA/microphones/sm/sm7db', 'https://www.shure.com/en-CA/search?q=SM7dB'],

  // Rode
  'rode-nt-usb-mini-microphone':     ['https://rode.com/en/microphones/usb/nt-usb-mini', 'https://rode.com/en/products/list?q=NT-USB+Mini'],

  // Audio-Technica
  'audio-technica-at2020-condenser': ['https://www.audio-technica.com/en-us/at2020', 'https://www.audio-technica.com/en-ca/microphones/at2020'],

  // Focusrite
  'focusrite-scarlett-solo-4th-gen': ['https://focusrite.com/en/usb-audio-interface/scarlett/scarlett-solo', 'https://focusrite.com/en/downloads/scarlett-solo'],
  'focusrite-scarlett-2i2-4th-gen':  ['https://focusrite.com/en/usb-audio-interface/scarlett/scarlett-2i2', 'https://focusrite.com/en/downloads/scarlett-2i2'],

  // Arturia
  'arturia-minilab-3-midi-controller': ['https://www.arturia.com/products/minilab-3/overview', 'https://www.arturia.com/minilab3/overview'],

  // Casio music
  'casio-px-s3100-digital-piano':    ['https://www.casiomusicgear.com/products/privia/px-s3100/', 'https://www.casiomusicgear.com/products/px-s3100/'],

  // Roland
  'roland-fp-30x-digital-piano':     ['https://www.roland.com/ca/products/fp-30x/', 'https://www.roland.com/ca/products/fp_30x/'],

  // Kala Ukulele
  'kala-ka-c-concert-ukulele':       ['https://www.kalabrand.com/products/ka-c', 'https://www.kalabrand.com/collections/concert-ukuleles'],

  // Yamaha Music
  'yamaha-fg800-acoustic-guitar':    ['https://ca.yamaha.com/en/products/musical_instruments/guitars_basses/fg_series/fg800/index.html', 'https://usa.yamaha.com/products/musical_instruments/guitars_basses/fg_series/fg800/'],
  'yamaha-p125a-digital-piano':      ['https://ca.yamaha.com/en/products/musical_instruments/pianos/p_series/p-125a/index.html', 'https://usa.yamaha.com/products/musical_instruments/pianos/p_series/p-125a/'],

  // Universal Audio
  'universal-audio-volt-276':        ['https://www.uaudio.com/audio-interfaces/volt-276-usb-audio-interface.html', 'https://www.uaudio.com/usb-audio-interfaces/volt-276.html'],

  // Manfrotto
  'manfrotto-compact-action-tripod': ['https://www.manfrotto.com/us-en/compact-action-aluminum-tripod-with-pan-head-black-mkcompactacn-bk/', 'https://www.manfrotto.com/us-en/tripods/compact-tripods/'],

  // Lowepro
  'lowepro-protactic-bp-350-backpack': ['https://www.lowepro.com/us-en/bags/backpacks/protactic-bp-350-aw-ii-lp37176-pww/', 'https://www.lowepro.com/us-en/bags/backpacks/'],

  // Peak Design
  'peak-design-everyday-backpack-20l': ['https://www.peakdesign.com/products/everyday-backpack', 'https://www.peakdesign.com/products/everyday-backpack?variant=20083694338124'],

  // Winix
  'winix-5500-2-air-purifier':       ['https://winixamerica.com/product/5500-2/', 'https://winixamerica.com/product/winix-5500-2-air-purifier-with-true-hepa-carbon-filter-plasmawave-technology/'],

  // Coway
  'coway-ap-1512hh-air-purifier':    ['https://www.cowaymega.com/products/ap-1512hh', 'https://www.cowaymega.com/collections/air-purifiers/products/ap-1512hh'],

  // Frigidaire dehumidifier
  'frigidaire-ffad5033w1-dehumidifier': ['https://www.frigidaire.com/Home-Comfort/Dehumidifiers/FFAD5033W1/', 'https://www.frigidaire.com/Home-Comfort/Dehumidifiers/'],

  // hOmeLabs dehumidifier
  'homelabs-4500-sqft-dehumidifier': ['https://www.homelabsproduct.com/products/dehumidifier-for-spaces-up-to-4-500-sq-ft', 'https://www.homelabsproduct.com/collections/all'],

  // Pelonis fan
  'pelonis-40-inch-tower-fan':       ['https://pelonicorp.com/products/tower-fans', 'https://pelonicorp.com/'],

  // SanDisk
  'sandisk-extreme-pro-128gb-sdxc':  ['https://www.westerndigital.com/en-ca/products/memory-cards/sandisk-extreme-pro-uhs-i-sd#SDSDXXD-128G-GN4IN', 'https://www.westerndigital.com/products/memory-cards/sandisk-extreme-pro-uhs-i-sd'],

  // Dyson fans & purifiers
  'dyson-hp09-purifier-heater-fan':  ['https://www.dyson.ca/fans-and-heaters/purifier-hot-cool/dyson-purifier-hot-cool-hp09-nickel-gold-394285-01.html', 'https://www.dyson.ca/fans-and-heaters'],
  'dyson-pure-cool-dp04-desk-fan':   ['https://www.dyson.ca/fans-and-heaters/purifier-cool-desk/dyson-purifier-cool-desk-dp04-white-silver-310124-01.html', 'https://www.dyson.ca/fans-and-heaters'],
  'dyson-purifier-cool-tp09':        ['https://www.dyson.ca/fans-and-heaters/purifier-cool/dyson-purifier-cool-tp09-nickel-gold-394285-01.html', 'https://www.dyson.ca/fans-and-heaters'],

  // DeLonghi panel heater
  'delonghi-hmp1500-panel-heater':   ['https://www.delonghi.com/en-ca/space-heaters/convector-panel-heater-hmp1500/p/HMP1500', 'https://www.delonghi.com/en-ca/search?q=HMP1500'],
};

// ── helpers ───────────────────────────────────────────────────────────────────
function isGoodImage(u) {
  if (!u || u.length < 20) return false;
  const bad = ['logo', 'favicon', 'placeholder', 'transparent', 'default', 'no-image', 'noimage', 'missing', 'icon', '1x1'];
  return !bad.some(b => u.toLowerCase().includes(b));
}

function abs(imgUrl, base) {
  if (!imgUrl) return null;
  if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
  if (imgUrl.startsWith('http')) return imgUrl;
  try { return new urlMod.URL(imgUrl, base).href; } catch(_) { return null; }
}

function downloadBinary(reqUrl, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    let redirects = 0;
    function doReq(u) {
      if (++redirects > 5) return reject(new Error('Too many redirects'));
      const parsed = new urlMod.URL(u);
      const mod = parsed.protocol === 'http:' ? http : https;
      mod.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }, res => {
        if ([301,302,303].includes(res.statusCode) && res.headers.location)
          return doReq(new urlMod.URL(res.headers.location, u).href);
        if (res.statusCode !== 200) {
          file.close(); try { fs.unlinkSync(destPath); } catch(_) {}
          return reject(new Error('HTTP ' + res.statusCode));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', err => { file.close(); try { fs.unlinkSync(destPath); } catch(_) {} reject(err); });
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

async function extractFromPage(browser, pageUrl) {
  let pg = null;
  try {
    pg = await browser.newPage();
    await pg.setRequestInterception(true);
    pg.on('request', req => {
      if (['stylesheet', 'font', 'media', 'websocket'].includes(req.resourceType())) req.abort();
      else req.continue();
    });
    await pg.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await pg.setViewport({ width: 1280, height: 900 });

    await Promise.race([
      pg.goto(pageUrl, { waitUntil: 'networkidle2', timeout: NAV_WAIT }).catch(() => {}),
      new Promise(r => setTimeout(r, PAGE_TIMEOUT)),
    ]);

    const imageUrl = await pg.evaluate(() => {
      const ogMeta = document.querySelector('meta[property="og:image"]') ||
                     document.querySelector('meta[name="og:image"]') ||
                     document.querySelector('meta[name="twitter:image"]');
      if (ogMeta) return ogMeta.getAttribute('content');

      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        try {
          const d = JSON.parse(s.textContent);
          const items = Array.isArray(d) ? d : [d];
          for (const item of items) {
            if (item['@type'] === 'Product' && item.image) {
              const img = Array.isArray(item.image) ? item.image[0] : item.image;
              return typeof img === 'string' ? img : img?.url;
            }
          }
        } catch(_) {}
      }

      const selectors = [
        'img[class*="product"][class*="hero"]',
        'img[class*="hero-image"]',
        'img[class*="main-image"]',
        'img[class*="pdp-image"]',
        'img[class*="product-image"][src*="http"]',
        '.product-image img',
        '#product-hero img',
        '[data-testid*="product-image"] img',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.src && el.src.startsWith('http') && !el.src.includes('placeholder')) return el.src;
      }
      return null;
    }).catch(() => null);

    const finalUrl = pg.url();
    await pg.close(); pg = null;

    if (!imageUrl || !isGoodImage(imageUrl)) return null;
    return abs(imageUrl, finalUrl);
  } catch(err) {
    if (pg) try { await pg.close(); } catch(_) {}
    return null;
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  let products = JSON.parse(fs.readFileSync(PRODUCTS_JS, 'utf8').replace(/^﻿/, ''));

  let targets;
  if (onlySlug) {
    targets = [{ id: onlySlug }];
    // Check if slug has URLs configured
    if (!DIRECT_URLS[onlySlug]) {
      console.log(`No direct URLs configured for slug: ${onlySlug}`);
      return;
    }
  } else {
    // Only process slugs that have DIRECT_URLS entries AND still need an image
    const needsImage = new Set(
      products
        .filter(p => !p.image || p.image.includes('VERIFY_IMAGE_ID') || p.image.includes('images-na.ssl'))
        .map(p => p.id)
    );
    targets = Object.keys(DIRECT_URLS)
      .filter(slug => needsImage.has(slug))
      .map(slug => ({ id: slug }));
  }

  if (isFinite(limit)) targets = targets.slice(0, limit);
  if (!targets.length) { console.log('Nothing to do.'); return; }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  console.log(`\nProcessing ${targets.length} product(s)…\n`);
  const results = { ok: [], skip: [], fail: [] };

  for (let i = 0; i < targets.length; i++) {
    const slug = targets[i].id;
    process.stdout.write(`[${String(i+1).padStart(3)}/${targets.length}] ${slug.padEnd(52)} `);

    const destPath = path.join(IMG_DIR, slug, 'hero.jpg');
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10000) {
      console.log('—  skip (have file)');
      results.skip.push(slug);
      continue;
    }

    const urls = DIRECT_URLS[slug];
    let imageUrl = null;

    for (const pageUrl of urls) {
      imageUrl = await extractFromPage(browser, pageUrl);
      if (imageUrl) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (!imageUrl) {
      console.log('✗  not found');
      results.fail.push({ slug, reason: 'not found' });
      continue;
    }

    try {
      await downloadBinary(imageUrl, destPath);
    } catch(err) {
      console.log('✗  download: ' + err.message);
      results.fail.push({ slug, reason: 'download: ' + err.message });
      continue;
    }

    const stat = fs.statSync(destPath);
    if (stat.size < 8000) {
      fs.unlinkSync(destPath);
      console.log('✗  too small (' + stat.size + ' B)');
      results.fail.push({ slug, reason: 'too small' });
      continue;
    }

    const kb = Math.round(stat.size / 1024);
    const heroUrl = '/images/products/' + slug + '/hero.jpg';
    const idx = products.findIndex(p => p.id === slug);
    if (idx !== -1) products[idx].image = heroUrl;
    updateProductHtml(slug, heroUrl);

    const queuePath = path.join(QUEUE_DIR, slug + '.json');
    if (fs.existsSync(queuePath)) {
      try {
        const q2 = JSON.parse(fs.readFileSync(queuePath, 'utf8').replace(/^﻿/, ''));
        q2.image = imageUrl;
        q2.images = { hero: heroUrl, lifestyle: '', detail: '' };
        fs.writeFileSync(queuePath, JSON.stringify(q2, null, 2), 'utf8');
      } catch(_) {}
    }

    console.log('✓  ' + kb + ' KB');
    results.ok.push({ slug, kb });
  }

  try { await browser.close(); } catch(_) {}
  fs.writeFileSync(PRODUCTS_JS, JSON.stringify(products, null, 2), 'utf8');

  console.log('\n── Summary ──────────────────────────────────────────────────────────');
  console.log('  ✓ ' + results.ok.length + '  skipped: ' + results.skip.length + '  failed: ' + results.fail.length);
  if (results.fail.length) {
    const byR = {};
    results.fail.forEach(r => { byR[r.reason] = (byR[r.reason]||0)+1; });
    Object.entries(byR).slice(0,8).forEach(([k,v]) => console.log('    ' + k + ': ' + v));
  }
  console.log('');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
