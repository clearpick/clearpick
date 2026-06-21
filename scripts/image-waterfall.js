'use strict';

/*
  image-waterfall.js — Multi-source image pipeline for ClearPick

  For every product with a broken/missing image, tries each source in order
  until one yields a good hero image. Downloads and self-hosts the result.

  Usage:
    node scripts/image-waterfall.js              -- all broken products
    node scripts/image-waterfall.js --audit      -- count broken, don't fix
    node scripts/image-waterfall.js --slug x     -- single product
    node scripts/image-waterfall.js --limit N    -- first N broken products

  Sources (tried in order):
    1. Amazon PA API        (requires AWS_ACCESS_KEY + AWS_SECRET_KEY + PA_API_ASSOCIATE_TAG)
    2. Amazon Puppeteer     (headless Chrome → amazon.ca/dp/{ASIN})
    3. Manufacturer og:image(pure HTTP, brand domain map)
    4. Google Custom Search (requires GOOGLE_CSE_KEY + GOOGLE_CSE_CX)
    5. DuckDuckGo images    (unofficial API, no key needed, 1 req/sec)
    6. Wayback Machine      (last resort archive snapshot)
*/

const puppeteer = require('puppeteer-core');
const https     = require('https');
const http      = require('http');
const zlib      = require('zlib');
const fs        = require('fs');
const path      = require('path');
const urlMod    = require('url');

const ROOT        = path.resolve(__dirname, '..');
const PRODUCTS_JS = path.join(ROOT, 'products.json');
const QUEUE_DIR   = path.join(ROOT, 'research-queue');
const IMG_DIR     = path.join(ROOT, 'public', 'images', 'products');
const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const AMZ_TIMEOUT   = 20000;
const PAGE_TIMEOUT  = 15000;
const MIN_FILE_SIZE = 10000; // 10KB

// ── CLI args ──────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const auditOnly = args.includes('--audit');
const limitArg  = args.indexOf('--limit');
const limit     = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;
const slugArg   = args.indexOf('--slug');
const onlySlug  = slugArg !== -1 ? args[slugArg + 1] : null;

// ── Credentials check ─────────────────────────────────────────────────────────
const PA_API_OK   = !!(process.env.AWS_ACCESS_KEY && process.env.AWS_SECRET_KEY && process.env.PA_API_ASSOCIATE_TAG);
const GOOGLE_OK   = !!(process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX);

// ── Brand URL map (for Source 6 manufacturer og:image) ────────────────────────
const BRAND_URLS = {
  'DEWALT':          ['https://www.dewalt.com/product/{M}/'],
  'Logitech':        ['https://www.logitech.com/en-ca/products/{m}.html', 'https://www.logitech.com/search?q={q}'],
  'Cuisinart':       ['https://www.cuisinart.com/search/?query={q}'],
  'JBL':             ['https://www.jbl.com/search?q={q}'],
  'LG':              ['https://www.lg.com/ca_en/search?search={q}'],
  'Anker':           ['https://www.anker.com/search?q={q}'],
  'RYOBI':           ['https://ryobitools.com/products/content/details/{M}/', 'https://ryobitools.com/power-tools/products/details/{M}/'],
  'Google':          ['https://store.google.com/ca/product/{m}', 'https://store.google.com/ca/search?q={q}'],
  'Milwaukee':       ['https://www.milwaukeetool.com/Products/{M}', 'https://www.milwaukeetool.com/search?q={q}'],
  "De'Longhi":       ['https://www.delonghi.com/en-ca/search?q={q}'],
  'Hamilton Beach':  ['https://www.hamiltonbeach.com/search?q={q}'],
  'Jabra':           ['https://www.jabra.com/headphones/{m}.aspx', 'https://www.jabra.com/search#/?query={q}'],
  'EGO':             ['https://egopowerplus.com/product/{m}/', 'https://egopowerplus.com/search?q={q}'],
  'Makita':          ['https://www.makita.ca/products/{m}.html'],
  'Sony':            ['https://www.sony.ca/en/products/{m}', 'https://www.sony.ca/en/search/?q={q}'],
  'Hisense':         ['https://www.hisense.ca/search/?q={q}'],
  'NordicTrack':     ['https://www.nordictrack.com/treadmills/{m}', 'https://www.nordictrack.com/search?q={q}'],
  'Bosch':           ['https://www.boschtools.com/products/{m}'],
  'BISSELL':         ['https://www.bissell.com/search?q={q}'],
  'Camp Chef':       ['https://www.campchef.com/search?q={q}'],
  'Weber':           ['https://www.weber.com/CA/en/search?q={q}'],
  'Ninja':           ['https://www.ninjakitchen.com/search/?q={q}'],
  'Cosori':          ['https://www.cosori.com/search?type=product&q={q}'],
  'Vitamix':         ['https://www.vitamix.com/us/en_us/shop/{m}'],
  'Breville':        ['https://www.breville.com/us/en/products/food-processors/{m}.html', 'https://www.breville.com/us/en/search?q={q}'],
  'Dyson':           ['https://www.dyson.ca/fans-and-heaters/{m}', 'https://www.dyson.ca/air-purifiers/{m}', 'https://www.dyson.ca/vacuums/{m}', 'https://www.dyson.ca/search?q={q}'],
  'Oster':           ['https://www.oster.com/search?q={q}'],
  'Wahl':            ['https://www.wahlclippers.com/search?q={q}'],
  'Braun':           ['https://www.braun.com/en-ca/search?query={q}'],
  'Oral-B':          ['https://www.oralb.ca/en-ca/search?q={q}'],
  'Philips':         ['https://www.philips.ca/en/search?q={q}'],
  'Panasonic':       ['https://www.panasonic.com/ca/en/search.html?q={q}'],
  'Nespresso':       ['https://www.nespresso.com/ca/en/search?q={q}'],
  'Keurig':          ['https://www.keurig.ca/search?q={q}'],
  'GrillGrates':     ['https://www.grillgrate.com/search?q={q}'],
  'Schlage':         ['https://www.schlage.com/en/home/search.html?q={q}'],
  'Yale':            ['https://www.yalehome.com/en/en/products/{m}'],
  'Wyze':            ['https://www.wyze.com/products/{m}'],
  'Arlo':            ['https://www.arlo.com/en-ca/cameras/{m}.html'],
  'T3':              ['https://www.t3micro.com/collections/hair-dryers/{m}'],
  'ASUS':            ['https://www.asus.com/ca-en/search.aspx/?query={q}'],
  'Astro':           ['https://www.astrogaming.com/headsets/{m}.html'],
  'Razer':           ['https://www.razer.com/gaming-mice/{m}', 'https://www.razer.com/search?q={q}'],
  'Corsair':         ['https://www.corsair.com/search#{q}'],
  'SteelSeries':     ['https://steelseries.com/gaming-headsets/{m}', 'https://steelseries.com/search?q={q}'],
  '8BitDo':          ['https://www.8bitdo.com/search/?q={q}'],
  'Elgato':          ['https://www.elgato.com/en/search?q={q}'],
  'Microsoft':       ['https://www.microsoft.com/en-ca/p/{m}'],
  'Apple':           ['https://www.apple.com/ca/{m}/'],
  'TCL':             ['https://www.tcl.com/ca/en/search.html?q={q}'],
  'Roku':            ['https://www.roku.com/en-ca/products/{m}'],
  'BaBylissPRO':     ['https://www.babylisspro.com/search?q={q}'],
  'Revlon':          ['https://www.revlon.com/search?q={q}'],
  'PetSafe':         ['https://www.petsafe.net/search?q={q}'],
  'PetFusion':       ['https://www.petfusion.com/search?q={q}'],
  'MidWest Homes for Pets': ['https://www.midwestpets.com/search?q={q}'],
  'Chuckit!':        ['https://www.chuckitpets.com/search?q={q}'],
  'ThermoPro':       ['https://buythermopro.com/search?q={q}'],
  'Broil King':      ['https://www.broilkingbbq.com/search?q={q}'],
  'Kamado Joe':      ['https://www.kamadojoe.com/search?q={q}'],
  'Z Grills':        ['https://zgrills.com/search?q={q}'],
  'Traeger':         ['https://www.traeger.com/search?q={q}'],
  'Napoleon':        ['https://www.napoleonproducts.com/search?q={q}'],
  'Husqvarna':       ['https://www.husqvarna.com/ca/search/?q={q}'],
  'Honda':           ['https://powerequipment.honda.com/search?q={q}'],
  'FIXD':            ['https://www.fixdapp.com/search?q={q}'],
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
  'iOttie':          ['https://www.iottie.com/search?q={q}'],
  "Meguiar's":       ['https://www.meguiars.com/en/us/search?q={q}'],
  'NOCO':            ['https://no.co/search?q={q}'],
  'Autel':           ['https://www.auteltech.com/search?q={q}'],
  'eufy':            ['https://www.eufylife.com/search?q={q}'],
  'Vantrue':         ['https://vantrue.net/search?q={q}'],
  'NuFACE':          ['https://www.nufacebeauty.com/search?q={q}'],
  'FOREO':           ['https://www.foreo.com/search?q={q}'],
  'ghd':             ['https://www.ghdhair.com/search?q={q}'],
  'Fitbit (Google)': ['https://www.fitbit.com/global/us/products/search?q={q}'],
  'American Tourister': ['https://www.americantourister.com/search?q={q}'],
  'Infant Optics':   ['https://www.infantoptics.com/search?q={q}'],
  'Canon':           ['https://www.canon.ca/en/search?q={q}'],
  'Fujifilm':        ['https://www.fujifilm.com/ca/en/search?q={q}', 'https://fujifilm-x.com/en-us/search/?q={q}'],
  'Nikon':           ['https://www.nikon.ca/en/search?q={q}'],
  'DJI':             ['https://www.dji.com/ca/search?q={q}', 'https://store.dji.com/ca/search?q={q}'],
  'Insta360':        ['https://www.insta360.com/search?q={q}'],
  'Joby':            ['https://joby.com/search?q={q}'],
  'Lowepro':         ['https://www.lowepro.com/us-en/search/?q={q}'],
  'Manfrotto':       ['https://www.manfrotto.com/us-en/search/?q={q}'],
  'SanDisk':         ['https://www.westerndigital.com/search?q={q}'],
  'OM System':       ['https://omsystem.com/en-us/search/?q={q}'],
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
  'Winix':           ['https://winixamerica.com/search?q={q}'],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isGoodImage(u) {
  if (!u || u.length < 20) return false;
  const bad = ['logo', 'favicon', 'placeholder', 'transparent', 'default', 'no-image',
               'noimage', 'missing', 'icon', '1x1', 'spinner', 'loading'];
  return !bad.some(b => u.toLowerCase().includes(b));
}

function absUrl(imgUrl, base) {
  if (!imgUrl) return null;
  if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
  if (imgUrl.startsWith('http')) return imgUrl;
  try { return new urlMod.URL(imgUrl, base).href; } catch(_) { return null; }
}

function httpGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new urlMod.URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      ...extraHeaders,
    };
    const req = mod.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers, timeout: PAGE_TIMEOUT }, res => {
      const chunks = [];
      let stream = res;
      const enc = res.headers['content-encoding'];
      if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      stream.on('data', c => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function httpGetJson(url) {
  return httpGet(url).then(t => JSON.parse(t)).catch(() => null);
}

function downloadBinary(reqUrl, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    let redirects = 0;
    function doReq(u) {
      if (++redirects > 6) return reject(new Error('too many redirects'));
      const parsed = new urlMod.URL(u);
      const mod = parsed.protocol === 'http:' ? http : https;
      mod.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }, res => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location)
          return doReq(new urlMod.URL(res.headers.location, u).href);
        if (res.statusCode !== 200) {
          file.close(); try { fs.unlinkSync(destPath); } catch(_) {}
          return reject(new Error('HTTP ' + res.statusCode));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', err => {
        file.close(); try { fs.unlinkSync(destPath); } catch(_) {}
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

function extractOgFromHtml(html, base) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1] && isGoodImage(m[1])) return absUrl(m[1], base);
  }
  // JSON-LD Product schema
  const jld = html.match(/"@type"\s*:\s*"Product"[\s\S]{0,4000}?"image"\s*:\s*(?:"([^"]{20,}?)"|(\[[^\]]+?\]))/);
  if (jld) {
    try {
      const img = jld[1] || JSON.parse(jld[2])[0];
      if (img) return absUrl(typeof img === 'string' ? img : img.url, base);
    } catch(_) {}
  }
  return null;
}

// ── Source 1: Amazon PA API ───────────────────────────────────────────────────
async function sourcePA(asin) {
  if (!PA_API_OK) return null;
  try {
    const paapi = require('./paapi5-nodejs-sdk');
    // GetItems call — returns Images.Primary.Large.URL
    const api = new paapi.DefaultApi();
    const req = paapi.GetItemsRequest.constructFromObject({
      PartnerTag: process.env.PA_API_ASSOCIATE_TAG,
      PartnerType: 'Associates',
      Marketplace: 'www.amazon.ca',
      ItemIds: [asin],
      Resources: ['Images.Primary.Large', 'Images.Variants.Large'],
    });
    const result = await new Promise((res, rej) => api.getItems(req, (err, data) => err ? rej(err) : res(data)));
    const item = result?.ItemsResult?.Items?.[0];
    return item?.Images?.Primary?.Large?.URL || null;
  } catch(_) {
    return null;
  }
}

// ── Source 2: Amazon Puppeteer ────────────────────────────────────────────────
let _amzBrowser = null;
async function getAmzBrowser() {
  if (!_amzBrowser) {
    _amzBrowser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  }
  return _amzBrowser;
}
async function closeAmzBrowser() {
  if (_amzBrowser) { try { await _amzBrowser.close(); } catch(_) {} _amzBrowser = null; }
}

async function sourceAmazonPuppeteer(asin) {
  if (!asin) return null;
  let browser, page;
  try {
    browser = await getAmzBrowser();
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (['stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
      else req.continue();
    });
    await Promise.race([
      page.goto(`https://www.amazon.ca/dp/${asin}`, { waitUntil: 'domcontentloaded', timeout: AMZ_TIMEOUT }),
      sleep(AMZ_TIMEOUT),
    ]).catch(() => {});
    await sleep(2000);

    const imgUrl = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      for (const s of scripts) {
        const t = s.textContent || '';
        const hiRes = t.match(/"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.jpg)"/);
        if (hiRes) return hiRes[1];
        const large = t.match(/"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\.jpg)"/);
        if (large) return large[1];
      }
      const el = document.getElementById('landingImage') ||
                 document.getElementById('imgBlkFront') ||
                 document.querySelector('#main-image-container img');
      if (el) {
        const src = el.getAttribute('data-old-hires') || el.getAttribute('data-a-hires') || el.getAttribute('src') || '';
        const m = src.match(/m\.media-amazon\.com\/images\/I\/([A-Za-z0-9%._-]+?)(?:\._|\.jpg)/);
        if (m) return 'https://m.media-amazon.com/images/I/' + m[1] + '._SL1500_.jpg';
      }
      return null;
    }).catch(() => null);

    await page.close();
    return (imgUrl && isGoodImage(imgUrl)) ? imgUrl : null;
  } catch(_) {
    if (page) try { await page.close(); } catch(__) {}
    // Restart browser on failure to clear state
    await closeAmzBrowser();
    return null;
  }
}

// ── Source 3: DuckDuckGo image search ────────────────────────────────────────
const ddgCache = new Map(); // vqd cache per session
async function sourceDDG(query) {
  try {
    await sleep(1500);
    // Step 1: get vqd token
    const searchHtml = await httpGet(`https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`);
    const vqd = searchHtml.match(/vqd=([\d-]+)/)?.[1] ||
                searchHtml.match(/vqd="([^"]+)"/)?.[1] ||
                searchHtml.match(/vqd=([^&"'\s]+)/)?.[1];
    if (!vqd) return null;

    // Step 2: image results
    const imgUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${encodeURIComponent(vqd)}&p=1&o=json&l=us-en&s=0&f=,,,,,&b=ff`;
    const raw = await httpGet(imgUrl, { 'Referer': 'https://duckduckgo.com/' });
    const data = JSON.parse(raw);
    const results = data.results || [];
    for (const r of results.slice(0, 5)) {
      const url = r.image || r.thumbnail;
      if (url && isGoodImage(url)) return url;
    }
    return null;
  } catch(_) {
    return null;
  }
}

// ── Source 4: Google Custom Search ───────────────────────────────────────────
async function sourceGoogle(query) {
  if (!GOOGLE_OK) return null;
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_CSE_KEY}&cx=${process.env.GOOGLE_CSE_CX}&q=${encodeURIComponent(query)}&searchType=image&num=5&imgType=photo&imgSize=large`;
    const data = await httpGetJson(url);
    for (const item of (data?.items || []).slice(0, 5)) {
      const u = item.link;
      if (u && isGoodImage(u)) return u;
    }
    return null;
  } catch(_) {
    return null;
  }
}

// ── Source 6: Manufacturer og:image (pure HTTP) ───────────────────────────────
async function sourceManufacturer(brand, productName, slug) {
  const urlTemplates = BRAND_URLS[brand];
  if (!urlTemplates) return null;

  const brandSlug = (brand || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const modelSlug = slug.replace(new RegExp('^' + brandSlug + '-?'), '');
  const modelName = productName.replace(new RegExp('^' + brand + '\\s*', 'i'), '').trim() || productName;
  const modelUpper = modelSlug.toUpperCase();
  const q = encodeURIComponent(modelName);

  for (const tpl of urlTemplates) {
    const pageUrl = tpl.replace('{q}', q).replace('{m}', modelSlug).replace('{M}', modelUpper);
    try {
      const html = await httpGet(pageUrl);
      const img = extractOgFromHtml(html, pageUrl);
      if (img && isGoodImage(img)) return img;
    } catch(_) {}
    await sleep(300);
  }
  return null;
}

// ── Source 7: Wayback Machine ─────────────────────────────────────────────────
async function sourceWayback(asin) {
  if (!asin) return null;
  try {
    const apiUrl = `https://archive.org/wayback/available?url=amazon.ca/dp/${asin}`;
    const data = await httpGetJson(apiUrl);
    const snapUrl = data?.archived_snapshots?.closest?.url;
    if (!snapUrl) return null;
    const html = await httpGet(snapUrl);
    // Look for Amazon image patterns in archived page
    const m = html.match(/https:\/\/m\.media-amazon\.com\/images\/I\/([A-Za-z0-9%._-]+?)(?:\._[A-Z]|\.jpg)/);
    if (m) return `https://m.media-amazon.com/images/I/${m[1]}._SL1500_.jpg`;
    return extractOgFromHtml(html, snapUrl);
  } catch(_) {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_JS, 'utf8').replace(/^﻿/, ''));

  // Determine which products need images — check disk, not just JSON field
  const broken = [];
  for (const p of products) {
    const heroPath = path.join(IMG_DIR, p.id, 'hero.jpg');
    const hasFile = fs.existsSync(heroPath);
    const fileOk = hasFile && fs.statSync(heroPath).size > MIN_FILE_SIZE;
    if (!fileOk) broken.push(p);
  }

  console.log(`\n── ClearPick Image Waterfall ─────────────────────────────────────`);
  console.log(`  Total products: ${products.length}`);
  console.log(`  Broken images:  ${broken.length}`);
  console.log(`  PA API:         ${PA_API_OK ? '✓ configured' : '✗ not configured (set AWS_ACCESS_KEY + AWS_SECRET_KEY + PA_API_ASSOCIATE_TAG)'}`);
  console.log(`  Google CSE:     ${GOOGLE_OK ? '✓ configured' : '✗ not configured (set GOOGLE_CSE_KEY + GOOGLE_CSE_CX)'}`);
  console.log(`─────────────────────────────────────────────────────────────────\n`);

  if (auditOnly) return;

  let targets = broken;
  if (onlySlug) targets = targets.filter(p => p.id === onlySlug);
  if (isFinite(limit)) targets = targets.slice(0, limit);
  if (!targets.length) { console.log('Nothing to process.'); return; }

  console.log(`Processing ${targets.length} product(s)…\n`);

  const tally = { 'pa-api': 0, 'amazon': 0, 'manufacturer': 0, 'google': 0, 'ddg': 0, 'wayback': 0 };
  let fixed = 0, failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const prod = targets[i];
    const slug = prod.id;
    const label = `[${String(i + 1).padStart(3)}/${targets.length}] ${slug.padEnd(52)}`;

    // Read ASIN and brand from research-queue
    let asin = null, brand = prod.brand || null, productName = prod.name;
    const qPath = path.join(QUEUE_DIR, slug + '.json');
    if (fs.existsSync(qPath)) {
      try {
        const q = JSON.parse(fs.readFileSync(qPath, 'utf8').replace(/^﻿/, ''));
        asin = q.asin || null;
        brand = q.brand || brand;
        productName = q.name || productName;
      } catch(_) {}
    }

    const destPath = path.join(IMG_DIR, slug, 'hero.jpg');
    const heroUrl = `/images/products/${slug}/hero.jpg`;
    const searchQuery = `${brand || ''} ${productName} product photo white background`.trim();

    let found = null, source = null;

    // Source 1: PA API
    if (!found && PA_API_OK) {
      const u = await sourcePA(asin).catch(() => null);
      if (u) { found = u; source = 'pa-api'; }
    }

    // Source 2: Amazon Puppeteer
    if (!found) {
      const u = await sourceAmazonPuppeteer(asin).catch(() => null);
      if (u) { found = u; source = 'amazon'; }
      await sleep(2000);
    }

    // Source 3: Manufacturer og:image
    if (!found) {
      const u = await sourceManufacturer(brand, productName, slug).catch(() => null);
      if (u) { found = u; source = 'manufacturer'; }
    }

    // Source 4: Google CSE
    if (!found && GOOGLE_OK) {
      const u = await sourceGoogle(searchQuery).catch(() => null);
      if (u) { found = u; source = 'google'; }
    }

    // Source 5: DuckDuckGo
    if (!found) {
      const u = await sourceDDG(searchQuery).catch(() => null);
      if (u) { found = u; source = 'ddg'; }
    }

    // Source 6: Wayback Machine
    if (!found) {
      const u = await sourceWayback(asin).catch(() => null);
      if (u) { found = u; source = 'wayback'; }
    }

    if (!found) {
      process.stdout.write(`${label}✗  no source found\n`);
      failed++;
      continue;
    }

    // Download and verify
    try {
      await downloadBinary(found, destPath);
      const size = fs.statSync(destPath).size;
      if (size < MIN_FILE_SIZE) {
        fs.unlinkSync(destPath);
        process.stdout.write(`${label}✗  too small (${size}B) via ${source}\n`);
        failed++;
        continue;
      }

      // Update products.json
      const idx = products.findIndex(p => p.id === slug);
      if (idx !== -1) products[idx].image = heroUrl;

      // Update product HTML
      updateProductHtml(slug, heroUrl);

      tally[source]++;
      fixed++;
      process.stdout.write(`${label}✓  ${Math.round(size / 1024)}KB via ${source}\n`);
    } catch(err) {
      try { fs.unlinkSync(destPath); } catch(_) {}
      process.stdout.write(`${label}✗  download failed: ${err.message}\n`);
      failed++;
    }
  }

  // Save updated products.json
  if (fixed > 0) {
    fs.writeFileSync(PRODUCTS_JS, JSON.stringify(products, null, 2), 'utf8');
  }

  await closeAmzBrowser();

  console.log(`\n── Summary ──────────────────────────────────────────────────────────`);
  console.log(`  Fixed: ${fixed}  Failed: ${failed}  (of ${targets.length} processed)`);
  console.log(`  By source:`);
  for (const [src, n] of Object.entries(tally)) {
    if (n > 0) console.log(`    ${src.padEnd(14)}: ${n}`);
  }
  if (!PA_API_OK)  console.log(`\n  ⚠  PA API not configured — apply at advertising.amazon.com for best results`);
  if (!GOOGLE_OK)  console.log(`  ⚠  Google CSE not configured — set GOOGLE_CSE_KEY + GOOGLE_CSE_CX (programmablesearchengine.google.com)`);
  console.log(`─────────────────────────────────────────────────────────────────\n`);
}

main().catch(console.error);
