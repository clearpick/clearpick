'use strict';

/*
  batch-puppeteer-mfr.js  —  Puppeteer fallback for JS-rendered brand sites

  For each remaining VERIFY_IMAGE_ID product:
    1. Open brand search URL in Puppeteer (waits for JS render)
    2. Extract og:image from the rendered page
    3. If search page yields nothing, try constructed product page URLs
    4. Hard 20s per-page timeout — never hangs

  Usage:
    node scripts/batch-puppeteer-mfr.js [--limit N] [--slug x]
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

const PAGE_TIMEOUT  = 20000;   // hard per-page limit
const NAV_WAIT      = 8000;    // networkidle2 wait budget

const args      = process.argv.slice(2);
const limitArg  = args.indexOf('--limit');
const limit     = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;
const slugArg   = args.indexOf('--slug');
const onlySlug  = slugArg !== -1 ? args[slugArg + 1] : null;

// ── Brand URL config ──────────────────────────────────────────────────────────
// Each brand: array of URL templates, tried in order
// {q} = encodeURIComponent(model name)   {m} = model slug   {M} = MODEL SLUG uppercase

const BRAND_URLS = {
  'DEWALT':          ['https://www.dewalt.com/product/{M}/'],
  'Logitech':        ['https://www.logitech.com/en-ca/products/{m}.html',
                      'https://www.logitech.com/search?q={q}'],
  'Cuisinart':       ['https://www.cuisinart.com/search/?query={q}'],
  'JBL':             ['https://www.jbl.com/search?q={q}'],
  'LG':              ['https://www.lg.com/ca_en/search?search={q}'],
  'Anker':           ['https://www.anker.com/search?q={q}'],
  'RYOBI':           ['https://ryobitools.com/products/content/details/{M}/',
                      'https://ryobitools.com/power-tools/products/details/{M}/'],
  'Ryobi':           ['https://ryobitools.com/products/content/details/{M}/'],
  'Google':          ['https://store.google.com/ca/product/{m}',
                      'https://store.google.com/ca/search?q={q}'],
  'Milwaukee':       ['https://www.milwaukeetool.com/Products/{M}',
                      'https://www.milwaukeetool.com/search?q={q}'],
  'De\'Longhi':      ['https://www.delonghi.com/en-ca/search?q={q}'],
  'Hamilton Beach':  ['https://www.hamiltonbeach.com/search?q={q}'],
  'Jabra':           ['https://www.jabra.com/headphones/{m}.aspx',
                      'https://www.jabra.com/search#/?query={q}'],
  'EGO':             ['https://egopowerplus.com/product/{m}/',
                      'https://egopowerplus.com/search?q={q}'],
  'Makita':          ['https://www.makita.ca/products/{m}.html'],
  'Sony':            ['https://www.sony.ca/en/products/{m}',
                      'https://www.sony.ca/en/search/?q={q}'],
  'Hisense':         ['https://www.hisense.ca/search/?q={q}'],
  'Schwinn':         ['https://www.schwinnfitness.com/{m}/',
                      'https://www.schwinnfitness.com/search?q={q}'],
  'NordicTrack':     ['https://www.nordictrack.com/treadmills/{m}',
                      'https://www.nordictrack.com/search?q={q}'],
  'Bosch':           ['https://www.boschtools.com/products/{m}'],
  'BLACK+DECKER':    ['https://www.blackanddecker.ca/en-ca/products/{m}'],
  'BISSELL':         ['https://www.bissell.com/search?q={q}'],
  'Camp Chef':       ['https://www.campchef.com/search?q={q}'],
  'Weber':           ['https://www.weber.com/CA/en/search?q={q}'],
  'Ninja':           ['https://www.ninjakitchen.com/search/?q={q}'],
  'Cosori':          ['https://www.cosori.com/search?type=product&q={q}'],
  'Vitamix':         ['https://www.vitamix.com/us/en_us/shop/{m}'],
  'Breville':        ['https://www.breville.com/us/en/products/food-processors/{m}.html',
                      'https://www.breville.com/us/en/search?q={q}'],
  'Dyson':           ['https://www.dyson.ca/fans-and-heaters/{m}',
                      'https://www.dyson.ca/air-purifiers/{m}',
                      'https://www.dyson.ca/vacuums/{m}',
                      'https://www.dyson.ca/search?q={q}'],
  'Oster':           ['https://www.oster.com/search?q={q}'],
  'Wahl':            ['https://www.wahlclippers.com/search?q={q}'],
  'Braun':           ['https://www.braun.com/en-ca/search?query={q}'],
  'Oral-B':          ['https://www.oralb.ca/en-ca/search?q={q}'],
  'Philips':         ['https://www.philips.ca/en/search?q={q}'],
  'Panasonic':       ['https://www.panasonic.com/ca/en/search.html?q={q}'],
  'Nespresso':       ['https://www.nespresso.com/ca/en/search?q={q}'],
  'Keurig':          ['https://www.keurig.ca/search?q={q}'],
  'Conair':          ['https://www.conair.com/search?q={q}'],
  'GrillGrates':     ['https://www.grillgrate.com/search?q={q}'],
  'Schlage':         ['https://www.schlage.com/en/home/search.html?q={q}'],
  'Yale':            ['https://www.yalehome.com/en/en/products/{m}'],
  'Wyze':            ['https://www.wyze.com/products/{m}'],
  'Arlo':            ['https://www.arlo.com/en-ca/cameras/{m}.html'],
  'Kasa (TP-Link)':  ['https://www.kasasmart.com/us/products/{m}'],
  'T3':              ['https://www.t3micro.com/collections/hair-dryers/{m}'],
  'ASUS':            ['https://www.asus.com/ca-en/search.aspx/?query={q}'],
  'Astro':           ['https://www.astrogaming.com/headsets/{m}.html'],
  'Razer':           ['https://www.razer.com/gaming-mice/{m}',
                      'https://www.razer.com/search?q={q}'],
  'Corsair':         ['https://www.corsair.com/search#{q}'],
  'SteelSeries':     ['https://steelseries.com/gaming-headsets/{m}',
                      'https://steelseries.com/search?q={q}'],
  '8BitDo':          ['https://www.8bitdo.com/search/?q={q}'],
  'Elgato':          ['https://www.elgato.com/en/search?q={q}'],
  'Microsoft':       ['https://www.microsoft.com/en-ca/p/{m}'],
  'Apple':           ['https://www.apple.com/ca/{m}/'],
  'TCL':             ['https://www.tcl.com/ca/en/search.html?q={q}'],
  'Roku':            ['https://www.roku.com/en-ca/products/{m}'],
  'Philips Hue':     ['https://www.philips-hue.com/en-ca/search?q={q}'],
  'BaBylissPRO':     ['https://www.babylisspro.com/search?q={q}'],
  'Revlon':          ['https://www.revlon.com/search?q={q}'],
  'PetSafe':         ['https://www.petsafe.net/search?q={q}'],
  'PetFusion':       ['https://www.petfusion.com/search?q={q}'],
  'MidWest Homes for Pets': ['https://www.midwestpets.com/search?q={q}'],
  'Chuckit!':        ['https://www.chuckitpets.com/search?q={q}'],
  'ThermoPro':       ['https://buythermopro.com/search?q={q}'],
  'Camp Chef':       ['https://www.campchef.com/search?q={q}'],
  'Broil King':      ['https://www.broilkingbbq.com/search?q={q}'],
  'Kamado Joe':      ['https://www.kamadojoe.com/search?q={q}'],
  'Z Grills':        ['https://zgrills.com/search?q={q}'],
  'Traeger':         ['https://www.traeger.com/search?q={q}'],
  'Napoleon':        ['https://www.napoleonproducts.com/search?q={q}'],
  'Husqvarna':       ['https://www.husqvarna.com/ca/search/?q={q}'],
  'Honda':           ['https://powerequipment.honda.com/search?q={q}'],
  'FIXD':            ['https://www.fixdapp.com/search?q={q}'],
  'VIOFO':           ['https://www.viofo.com/search?q={q}'],
  'Uniden':          ['https://www.uniden.com/search?q={q}'],
  'Thinkware':       ['https://www.thinkwareusa.com/search?q={q}'],
  'Garmin':          ['https://www.garmin.com/en-CA/search/?q={q}'],
  'Graco':           ['https://www.gracobaby.com/en_US/search?q={q}'],
  'Osprey':          ['https://www.ospreypacks.com/us/en_US/search?q={q}'],
  'Peak Design':     ['https://www.peakdesign.com/search?type=product&q={q}'],
  'Stokke':          ['https://www.stokke.com/en-gb/highchairs/{m}.html'],
  'The North Face':  ['https://www.thenorthface.com/en-us/search?q={q}'],
  'Baby Jogger':     ['https://www.babyjogger.com/search?q={q}'],
  'Maxi-Cosi':       ['https://www.maxi-cosi.com/en-us/search?q={q}'],
  'Chicco':          ['https://www.chiccousa.com/search?q={q}'],
  'Britax':          ['https://us.britax.com/search?q={q}'],
  'Skip Hop':        ['https://www.skiphop.com/search?q={q}'],
  'Hatch':           ['https://www.hatch.co/search?q={q}'],
  'Happiest Baby':   ['https://www.happiestbaby.com/search?q={q}'],
  'Brooks':          ['https://www.brooksrunning.com/en_ca/search?q={q}'],
  'HOKA':            ['https://www.hoka.com/en-ca/search/?q={q}'],
  'Salomon':         ['https://www.salomon.com/en-us/search?q={q}'],
  'CamelBak':        ['https://www.camelbak.com/en/search?q={q}'],
  'Gregory':         ['https://www.gregorypacks.com/search?q={q}'],
  'Hydro Flask':     ['https://www.hydroflask.com/search?q={q}'],
  'MEATER':          ['https://www.meater.com/search?q={q}'],
  'Litter-Robot':    ['https://www.litter-robot.com/search?q={q}'],
  'Tractive':        ['https://tractive.com/shop/search?q={q}'],
  'WiZ (Signify)':   ['https://www.wizconnected.com/en-ca/search?q={q}'],
  'iOttie':          ['https://www.iottie.com/search?q={q}'],
  'MATEIN':          ['https://mateintravelbag.com/search?q={q}'],
  "Meguiar's":       ['https://www.meguiars.com/en/us/search?q={q}'],
  'NOCO':            ['https://no.co/search?q={q}'],
  'WOPET':           ['https://www.wopet.com/search?q={q}'],
  'Autel':           ['https://www.auteltech.com/search?q={q}'],
  'eufy':            ['https://www.eufylife.com/search?q={q}'],
  'Vantrue':         ['https://vantrue.net/search?q={q}'],
  'NuFACE':          ['https://www.nufacebeauty.com/search?q={q}'],
  'FOREO':           ['https://www.foreo.com/search?q={q}'],
  'ghd':             ['https://www.ghdhair.com/search?q={q}'],
  'Fitbit (Google)': ['https://www.fitbit.com/global/us/products/search?q={q}'],
  'American Tourister': ['https://www.americantourister.com/search?q={q}'],
  'Infant Optics':   ['https://www.infantoptics.com/search?q={q}'],

  // ── Cameras & Photography (Sprint 8) ─────────────────────────────────────────
  'Canon':           ['https://www.canon.ca/en/search?q={q}'],
  'Fujifilm':        ['https://www.fujifilm.com/ca/en/search?q={q}',
                      'https://fujifilm-x.com/en-us/search/?q={q}'],
  'Nikon':           ['https://www.nikon.ca/en/search?q={q}'],
  'DJI':             ['https://www.dji.com/ca/search?q={q}',
                      'https://store.dji.com/ca/search?q={q}'],
  'Insta360':        ['https://www.insta360.com/search?q={q}'],
  'Joby':            ['https://joby.com/search?q={q}'],
  'Lowepro':         ['https://www.lowepro.com/us-en/search/?q={q}'],
  'Manfrotto':       ['https://www.manfrotto.com/us-en/search/?q={q}'],
  'SanDisk':         ['https://www.westerndigital.com/search?q={q}'],
  'OM System':       ['https://omsystem.com/en-us/search/?q={q}'],
  'Peak Design':     ['https://www.peakdesign.com/search?type=product&q={q}'],

  // ── Music & Instruments (Sprint 8) ───────────────────────────────────────────
  'Arturia':         ['https://www.arturia.com/search?q={q}'],
  'Audio-Technica':  ['https://www.audio-technica.com/en-us/search?q={q}'],
  'Boss':            ['https://www.boss.info/ca/search/?q={q}'],
  'Casio':           ['https://www.casiomusicgear.com/search?q={q}'],
  'Epiphone':        ['https://www.epiphone.com/search?q={q}'],
  'Fender':          ['https://www.fender.com/en-CA/search?q={q}'],
  'Focusrite':       ['https://focusrite.com/en/search?q={q}'],
  'Kala':            ['https://www.kalabrand.com/search?q={q}'],
  'Rode':            ['https://rode.com/en/search?q={q}'],
  'Roland':          ['https://www.roland.com/ca/search/?q={q}'],
  'Seagull':         ['https://www.seagullguitars.com/en/search?q={q}'],
  'Shure':           ['https://www.shure.com/en-CA/search?q={q}'],
  'Squier':          ['https://www.fender.com/en-CA/search?q={q}'],
  'Taylor':          ['https://www.taylorguitars.com/guitars/search?q={q}'],
  'Universal Audio': ['https://www.uaudio.com/search?q={q}'],
  'Yamaha':          ['https://ca.yamaha.com/en/search/?q={q}'],

  // ── Home Comfort (Sprint 8) ───────────────────────────────────────────────────
  'Blueair':         ['https://www.blueair.com/us/en/search?q={q}'],
  'Coway':           ['https://www.cowaymega.com/search?q={q}'],
  'Frigidaire':      ['https://www.frigidaire.com/search?q={q}'],
  'hOmeLabs':        ['https://www.homelabsproduct.com/search?q={q}'],
  'Honeywell':       ['https://www.honeywellhome.com/search?q={q}'],
  'Lasko':           ['https://lasko.com/search?q={q}'],
  'Levoit':          ['https://levoit.com/search?type=product&q={q}'],
  'Pelonis':         ['https://pelonicorp.com/search?q={q}'],
  'Vornado':         ['https://www.vornado.com/search?q={q}'],
  'Winix':           ['https://winixamerica.com/search?q={q}'],

  // ── Remaining no-config brands ────────────────────────────────────────────────
  'BenQ':            ['https://www.benq.com/en-ca/search?q={q}'],
  'Dell':            ['https://www.dell.com/en-ca/search/results?q={q}'],
  'FlexiSpot':       ['https://www.flexispot.ca/search?q={q}'],
  'Sole':            ['https://www.soletreadmills.com/search?q={q}'],
  'NutriBullet':     ['https://www.nutribullet.com/search?q={q}'],
  'OXO':             ['https://www.oxo.com/search?q={q}'],
  'Marshall':        ['https://www.marshallheadphones.com/search?q={q}'],
  'Ultimate Ears':   ['https://www.ultimateears.com/en-us/search?q={q}'],
  'Stanley':         ['https://www.stanley1913.com/search?q={q}'],
  'Shark':           ['https://www.sharkclean.ca/search?q={q}'],
  'Waterpik':        ['https://www.waterpik.com/oral-health/search/?q={q}'],
  'Instant':         ['https://www.instantpot.com/search?q={q}'],
  'Nike':            ['https://www.nike.com/ca/search?q={q}'],
  '4moms':           ['https://www.4moms.com/search?q={q}'],
  'BabyBjörn':       ['https://www.babybjorn.com/en/search?q={q}'],
  'LIFX':            ['https://www.lifx.com/search?q={q}'],
  'KONG':            ['https://www.kongcompany.com/search?q={q}'],
  'Orbit':           ['https://www.orbitonline.com/search?q={q}'],
  'FurHaven':        ['https://www.furhaven.com/search?q={q}'],
  'Bonavita':        ['https://bonavitaworld.com/search?q={q}'],
  'T-fal':           ['https://www.t-falusa.com/search?q={q}'],
  'Crock-Pot':       ['https://www.crock-pot.com/search?q={q}'],
  'Flexi':           ['https://www.flexi.de/en/search?q={q}'],
  'Regalo':          ['https://www.regalobaby.com/search?q={q}'],
  'Kasa (TP-Link)':  ['https://www.kasasmart.com/us/products/search?q={q}'],
  'De\'Longhi':      ['https://www.delonghi.com/en-ca/search?q={q}'],
};

// ── helpers ───────────────────────────────────────────────────────────────────
function extractOgFromHtml(html, base) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1] && isGoodImage(m[1])) return abs(m[1], base);
  }
  const jld = html.match(/"@type"\s*:\s*"Product"[\s\S]{0,3000}?"image"\s*:\s*(?:"([^"]{20,}?)"|(\[[^\]]+?\]))/);
  if (jld) {
    try {
      const img = jld[1] || JSON.parse(jld[2])[0];
      if (img) return abs(typeof img === 'string' ? img : img.url, base);
    } catch(_) {}
  }
  return null;
}

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

// ── Extract og:image from rendered page ───────────────────────────────────────
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

    // Pull og:image from rendered DOM
    const imageUrl = await pg.evaluate(() => {
      const ogMeta = document.querySelector('meta[property="og:image"]') ||
                     document.querySelector('meta[name="og:image"]') ||
                     document.querySelector('meta[name="twitter:image"]');
      if (ogMeta) return ogMeta.getAttribute('content');

      // JSON-LD
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

      // Hero product image element
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

  let targets = products.filter(p =>
    !p.image || p.image.includes('VERIFY_IMAGE_ID') || p.image.includes('images-na.ssl')
  );
  if (onlySlug) targets = targets.filter(p => p.id === onlySlug);
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
    const prod = targets[i];
    const slug = prod.id;
    process.stdout.write(`[${String(i+1).padStart(3)}/${targets.length}] ${slug.padEnd(52)} `);

    const destPath = path.join(IMG_DIR, slug, 'hero.jpg');
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10000) {
      console.log('—  skip (have file)');
      results.skip.push(slug);
      continue;
    }

    let brand = null, productName = prod.name;
    const queuePath = path.join(QUEUE_DIR, slug + '.json');
    if (fs.existsSync(queuePath)) {
      try {
        const q = JSON.parse(fs.readFileSync(queuePath, 'utf8').replace(/^﻿/, ''));
        brand = q.brand; if (q.name) productName = q.name;
      } catch(_) {}
    }

    const urlTemplates = brand ? BRAND_URLS[brand] : null;
    if (!urlTemplates) {
      console.log(`—  no config (${brand || 'unknown'})`);
      results.skip.push(slug);
      continue;
    }

    // Build substitution values
    const brandSlug = (brand || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const modelSlug = slug.replace(new RegExp('^' + brandSlug + '-?'), '');
    const modelName = productName.replace(new RegExp('^' + brand + '\\s*', 'i'), '').trim() || productName;
    const modelUpper = modelSlug.toUpperCase();

    // Try to extract manufacturer model number for CDN patterns
    const modelMatch = productName.match(/\b([A-Z]{2,}[0-9][A-Z0-9]{1,})\b/) ||
                       slug.match(/-([a-z]{2,}\d[a-z0-9]{1,})/i);
    const modelNum = modelMatch ? modelMatch[1].toUpperCase() : modelUpper;

    const q = encodeURIComponent(modelName);

    let imageUrl = null;

    for (const tpl of urlTemplates) {
      const pageUrl = tpl
        .replace('{q}', q)
        .replace('{m}', modelSlug)
        .replace('{M}', modelNum);

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
