'use strict';

/*
  batch-mfr-img.js  —  Manufacturer source image fetcher (no Puppeteer)

  Strategy per product:
    1. Shopify brands  →  /products.json?q={model}  (no browser, pure API)
    2. DEWALT          →  resources.dewalt.com CDN pattern
    3. All others      →  HTTPS fetch of brand search page → og:image from raw HTML
                          + fallback: try /products/{slug} and /{slug} patterns

  Usage:
    node scripts/batch-mfr-img.js [--limit N] [--slug x] [--brand "Garmin"]
*/

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

const ROOT        = path.resolve(__dirname, '..');
const PRODUCTS_JS = path.join(ROOT, 'products.json');
const QUEUE_DIR   = path.join(ROOT, 'research-queue');
const IMG_DIR     = path.join(ROOT, 'public', 'images', 'products');

// ── args ─────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const limitArg  = args.indexOf('--limit');
const limit     = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;
const slugArg   = args.indexOf('--slug');
const onlySlug  = slugArg !== -1 ? args[slugArg + 1] : null;
const brandArg  = args.indexOf('--brand');
const onlyBrand = brandArg !== -1 ? args[brandArg + 1] : null;

// ── brand config ──────────────────────────────────────────────────────────────
// type 'shopify': uses /products.json API
// type 'cdn':     uses brand-specific CDN URL constructor (fn provided)
// type 'http':    plain HTTPS fetch of search page + common product URL patterns

const BRANDS = {
  // ── Shopify ───────────────────────────────────────────────────────────────
  'Hydro Flask':       { d: 'www.hydroflask.com',           t: 'shopify' },
  'CamelBak':          { d: 'www.camelbak.com',             t: 'shopify' },
  'Crossrope':         { d: 'www.crossrope.com',            t: 'shopify' },
  'Keychron':          { d: 'www.keychron.com',             t: 'shopify' },
  'REP Fitness':       { d: 'www.repfitness.com',           t: 'shopify' },
  'Fellow':            { d: 'fellowproducts.com',           t: 'shopify' },
  'NOMATIC':           { d: 'www.nomatic.com',              t: 'shopify' },
  'Peak Design':       { d: 'www.peakdesign.com',           t: 'shopify' },
  'Leatherman':        { d: 'www.leatherman.com',           t: 'shopify' },
  'Shokz':             { d: 'shokz.com',                    t: 'shopify' },
  'Black Diamond':     { d: 'www.blackdiamondequipment.com', t: 'shopify' },
  'Secretlab':         { d: 'secretlab.co',                 t: 'shopify' },
  'MEATER':            { d: 'www.meater.com',               t: 'shopify' },
  'Tractive':          { d: 'tractive.com',                 t: 'shopify' },
  'WiZ (Signify)':     { d: 'www.wizconnected.com',         t: 'shopify' },
  'NuFACE':            { d: 'www.nufacebeauty.com',         t: 'shopify' },
  'FOREO':             { d: 'www.foreo.com',                t: 'shopify' },
  'Litter-Robot':      { d: 'www.litter-robot.com',         t: 'shopify' },
  'WOPET':             { d: 'www.wopet.com',                t: 'shopify' },
  'ghd':               { d: 'www.ghdhair.com',              t: 'shopify' },
  'Fitbit (Google)':   { d: 'www.fitbit.com',               t: 'shopify' },
  'Eagle Creek':       { d: 'www.eaglecreek.com',           t: 'shopify' },
  'Pacsafe':           { d: 'www.pacsafe.com',              t: 'shopify' },
  'Gregory':           { d: 'www.gregorypacks.com',         t: 'shopify' },
  'Osprey':            { d: 'www.ospreypacks.com',          t: 'shopify' },
  'Brooks':            { d: 'www.brooksrunning.com',        t: 'shopify' },
  'HOKA':              { d: 'www.hoka.com',                 t: 'shopify' },
  'Salomon':           { d: 'www.salomon.com',              t: 'shopify' },
  'The North Face':    { d: 'www.thenorthface.com',         t: 'shopify' },
  'Ergobaby':          { d: 'ergobaby.com',                 t: 'shopify' },
  'Hatch':             { d: 'www.hatch.co',                 t: 'shopify' },
  'Skip Hop':          { d: 'www.skiphop.com',              t: 'shopify' },
  'Happiest Baby':     { d: 'www.happiestbaby.com',         t: 'shopify' },
  'Stokke':            { d: 'www.stokke.com',               t: 'shopify' },
  'UPPAbaby':          { d: 'www.uppababy.com',             t: 'shopify' },
  'Baby Jogger':       { d: 'www.babyjogger.com',           t: 'shopify' },
  'Britax':            { d: 'us.britax.com',                t: 'shopify' },
  'Maxi-Cosi':         { d: 'www.maxi-cosi.com',            t: 'shopify' },
  'Chicco':            { d: 'www.chiccousa.com',            t: 'shopify' },
  'Infant Optics':     { d: 'www.infantoptics.com',         t: 'shopify' },
  'Nanit':             { d: 'www.nanit.com',                t: 'shopify' },
  'Samsonite':         { d: 'www.samsonite.com',            t: 'shopify' },
  'DELSEY Paris':      { d: 'www.delsey.com',               t: 'shopify' },
  'Travelpro':         { d: 'www.travelpro.com',            t: 'shopify' },
  'American Tourister':{ d: 'www.americantourister.com',    t: 'shopify' },
  'Trtl':              { d: 'www.trtltravel.com',           t: 'shopify' },
  'Hyperice':          { d: 'www.hyperice.com',             t: 'shopify' },
  'Therabody':         { d: 'www.therabody.com',            t: 'shopify' },
  'Gaiam':             { d: 'www.gaiam.com',                t: 'shopify' },
  'Vantrue':           { d: 'vantrue.net',                  t: 'shopify' },
  'BlackVue':          { d: 'www.blackvue.com',             t: 'shopify' },
  'Autel':             { d: 'www.auteltech.com',            t: 'shopify' },
  'eufy':              { d: 'www.eufylife.com',             t: 'shopify' },
  'NOCO':              { d: 'no.co',                        t: 'shopify' },
  "Meguiar's":         { d: 'www.meguiars.com',             t: 'shopify' },
  'MATEIN':            { d: 'mateintravelbag.com',          t: 'shopify' },
  'ZOPPEN':            { d: 'www.zoppen.com',               t: 'shopify' },
  'Graco':             { d: 'www.gracobaby.com',            t: 'shopify' },
  'Furbo':             { d: 'shopus.furbo.com',             t: 'shopify' },
  'Greenworks':        { d: 'www.greenworkstools.com',      t: 'shopify' },
  'Thinkware':         { d: 'www.thinkwareusa.com',         t: 'shopify' },
  'iOttie':            { d: 'www.iottie.com',               t: 'shopify' },
  'Spigen':            { d: 'www.spigen.com',               t: 'shopify' },

  // ── Known CDN ─────────────────────────────────────────────────────────────
  'DEWALT': {
    t: 'cdn',
    fn: (slug, name) => {
      // extract model number from product name (e.g. "DEWALT DCBL722B Leaf Blower" → DCBL722B)
      const fromName = (name || '').match(/\b([A-Z]{2,}[0-9][A-Z0-9]{2,})\b/);
      const model = fromName ? fromName[1] : slug.replace(/^dewalt-/, '').split('-').find(t => /^[a-z]{2,}\d/.test(t) || /^\d{2,}v/.test(t) || t.length >= 6) || '';
      const M = model.toUpperCase();
      return [
        `https://resources.dewalt.com/Products/Images/${M}/${M}T4.jpg`,
        `https://resources.dewalt.com/Products/Images/${M}/${M}.jpg`,
        `https://www.dewalt.com/globalassets/product-images/${M.toLowerCase()}/${M.toLowerCase()}_t4.jpg`,
      ].filter(u => M.length >= 4);
    },
  },

  // ── HTTP fetch (plain HTTPS, no browser) ──────────────────────────────────
  'Sonos':       { d: 'www.sonos.com',           t: 'http', path: '/en-ca/shop/{model}' },
  'Garmin':      { d: 'www.garmin.com',           t: 'http', search: '/en-CA/search/?q={q}' },
  'Logitech':    { d: 'www.logitech.com',         t: 'http', search: '/en-ca/search?q={q}' },
  'Blue (Logitech)': { d: 'www.bluemic.com',      t: 'http', search: '/en-us/search/?q={q}' },
  'Cuisinart':   { d: 'www.cuisinart.com',        t: 'http', search: '/search/?query={q}' },
  'JBL':         { d: 'www.jbl.com',              t: 'http', search: '/search?q={q}' },
  'LG':          { d: 'www.lg.com',               t: 'http', search: '/ca_en/search?search={q}' },
  'Sony':        { d: 'www.sony.ca',              t: 'http', search: '/en/search/?q={q}' },
  'Anker':       { d: 'www.anker.com',            t: 'http', search: '/search?q={q}' },
  'RYOBI':       { d: 'ryobitools.com',           t: 'http', search: '/search/?q={q}' },
  'Ryobi':       { d: 'ryobitools.com',           t: 'http', search: '/search/?q={q}' },
  'Makita':      { d: 'www.makita.ca',            t: 'http', search: '/products/?searchTerm={q}' },
  'Milwaukee':   { d: 'www.milwaukeetool.com',    t: 'http', search: '/search#{q}' },
  'EGO':         { d: 'egopowerplus.com',         t: 'http', search: '/search?q={q}' },
  'Dyson':       { d: 'www.dyson.ca',             t: 'http', search: '/search?q={q}' },
  'Vitamix':     { d: 'www.vitamix.com',          t: 'http', search: '/us/en_us/search.aspx#q={q}' },
  'Breville':    { d: 'www.breville.com',         t: 'http', search: '/us/en/search?q={q}' },
  "De'Longhi":   { d: 'www.delonghi.com',        t: 'http', search: '/en-ca/search?q={q}' },
  'Nespresso':   { d: 'www.nespresso.com',        t: 'http', search: '/ca/en/search?q={q}' },
  'Ninja':       { d: 'www.ninjakitchen.com',     t: 'http', search: '/search/?q={q}' },
  'Cosori':      { d: 'www.cosori.com',           t: 'http', search: '/search?type=product&q={q}' },
  'Hamilton Beach': { d: 'www.hamiltonbeach.com', t: 'http', search: '/search?q={q}' },
  'Oster':       { d: 'www.oster.com',            t: 'http', search: '/search?q={q}' },
  'OXO':         { d: 'www.oxo.com',              t: 'http', search: '/search?q={q}' },
  'NutriBullet': { d: 'www.nutribullet.com',      t: 'http', search: '/search?q={q}' },
  'Dash':        { d: 'www.bydash.com',           t: 'http', search: '/search?q={q}' },
  'Crock-Pot':   { d: 'www.crock-pot.com',        t: 'http', search: '/search?q={q}' },
  'Instant':     { d: 'www.instantpot.com',       t: 'http', search: '/search?q={q}' },
  'Schwinn':     { d: 'www.schwinnfitness.com',   t: 'http', search: '/search?q={q}' },
  'NordicTrack': { d: 'www.nordictrack.com',      t: 'http', search: '/search?q={q}' },
  'Sole':        { d: 'www.soletreadmills.com',   t: 'http', search: '/search?q={q}' },
  'WalkingPad':  { d: 'www.walkingpad.com',       t: 'http', search: '/search?q={q}' },
  'Jabra':       { d: 'www.jabra.com',            t: 'http', search: '/search#/?query={q}' },
  'Marshall':    { d: 'www.marshallheadphones.com', t: 'http', search: '/search?q={q}' },
  'Nothing':     { d: 'nothing.tech',             t: 'http', search: '/search?q={q}' },
  'Edifier':     { d: 'www.edifier.com',          t: 'http', search: '/search?q={q}' },
  'Beats':       { d: 'www.beatsbydre.com',       t: 'http', search: '/search?q={q}' },
  'ASUS':        { d: 'www.asus.com',             t: 'http', search: '/ca-en/search.aspx?query={q}' },
  'BenQ':        { d: 'www.benq.com',             t: 'http', search: '/en-ca/search/{q}.html' },
  'Dell':        { d: 'www.dell.com',             t: 'http', search: '/en-ca/search/{q}' },
  'Ergotron':    { d: 'www.ergotron.com',         t: 'http', search: '/en-ca/search#q={q}' },
  'FlexiSpot':   { d: 'www.flexispot.ca',         t: 'http', search: '/search?q={q}' },
  'Google':      { d: 'store.google.com',         t: 'http', search: '/ca/search?q={q}' },
  'Apple':       { d: 'www.apple.com',            t: 'http', search: '/ca/search/{q}?src=globalnav' },
  'TCL':         { d: 'www.tcl.com',              t: 'http', search: '/ca/en/search.html?q={q}' },
  'Hisense':     { d: 'www.hisense.ca',           t: 'http', search: '/search/?q={q}' },
  'Roku':        { d: 'www.roku.com',             t: 'http', search: '/en-ca/search?q={q}' },
  'Philips':     { d: 'www.philips.ca',           t: 'http', search: '/en/search?q={q}' },
  'Philips Hue': { d: 'www.philips-hue.com',      t: 'http', search: '/en-ca/search?q={q}' },
  'Braun':       { d: 'www.braun.com',            t: 'http', search: '/en-ca/search?query={q}' },
  'Oral-B':      { d: 'www.oralb.ca',             t: 'http', search: '/en-ca/search?q={q}' },
  'Waterpik':    { d: 'www.waterpik.com',         t: 'http', search: '/search?q={q}' },
  'Panasonic':   { d: 'www.panasonic.com',        t: 'http', search: '/ca/en/search.html?q={q}' },
  'Conair':      { d: 'www.conair.com',           t: 'http', search: '/search?q={q}' },
  'BaBylissPRO': { d: 'www.babyliss.com',         t: 'http', search: '/search?q={q}' },
  'Revlon':      { d: 'www.revlon.com',           t: 'http', search: '/search?q={q}' },
  'Wahl':        { d: 'www.wahlclippers.com',     t: 'http', search: '/search?q={q}' },
  'T3':          { d: 'www.t3micro.com',          t: 'http', search: '/search?q={q}' },
  'Shark':       { d: 'www.sharkclean.ca',        t: 'http', search: '/search?q={q}' },
  'PetSafe':     { d: 'www.petsafe.net',          t: 'http', search: '/search?q={q}' },
  'PetFusion':   { d: 'www.petfusion.com',        t: 'http', search: '/search?q={q}' },
  'KONG':        { d: 'www.kongcompany.com',      t: 'http', search: '/search?q={q}' },
  'FurHaven':    { d: 'www.furhaven.com',         t: 'http', search: '/search?q={q}' },
  'MidWest Homes for Pets': { d: 'www.midwestindustries.com', t: 'http', search: '/search?q={q}' },
  'Camp Chef':   { d: 'www.campchef.com',         t: 'http', search: '/search?q={q}' },
  'Weber':       { d: 'www.weber.com',            t: 'http', search: '/en-CA/search?q={q}' },
  'Traeger':     { d: 'www.traeger.com',          t: 'http', search: '/search?q={q}' },
  'Napoleon':    { d: 'www.napoleonproducts.com', t: 'http', search: '/search?q={q}' },
  'Kamado Joe':  { d: 'www.kamadojoe.com',        t: 'http', search: '/search?q={q}' },
  'Broil King':  { d: 'www.broilkingbbq.com',    t: 'http', search: '/search?q={q}' },
  'Pit Boss':    { d: 'www.pitboss-grills.com',  t: 'http', search: '/search?q={q}' },
  'Masterbuilt': { d: 'www.masterbuilt.com',      t: 'http', search: '/search?q={q}' },
  'Char-Griller':{ d: 'www.chargriller.com',      t: 'http', search: '/search?q={q}' },
  'Blackstone':  { d: 'www.blackstoneproducts.com', t: 'http', search: '/search?q={q}' },
  'GrillGrates': { d: 'www.grillgrate.com',       t: 'http', search: '/search?q={q}' },
  'Z Grills':    { d: 'zgrills.com',              t: 'http', search: '/search?q={q}' },
  'Uniden':      { d: 'www.uniden.com',           t: 'http', search: '/search?q={q}' },
  'VIOFO':       { d: 'www.viofo.com',            t: 'http', search: '/search?q={q}' },
  'BISSELL':     { d: 'www.bissell.com',          t: 'http', search: '/search?q={q}' },
  'BLACK+DECKER':{ d: 'www.blackanddecker.ca',    t: 'http', search: '/search?q={q}' },
  'ThermoPro':   { d: 'buythermopro.com',         t: 'http', search: '/search?q={q}' },
  'ThermoWorks': { d: 'www.thermoworks.com',      t: 'http', search: '/search?q={q}' },
  'Astro':       { d: 'www.astrogaming.com',      t: 'http', search: '/search?q={q}' },
  'FIXD':        { d: 'www.fixdapp.com',          t: 'http', search: '/search?q={q}' },
  'Clore':       { d: 'www.cloreautomotive.com',  t: 'http', search: '/search?q={q}' },
  'Avid Power':  { d: 'www.avidpower.com',        t: 'http', search: '/search?q={q}' },
  'Honda':       { d: 'powerequipment.honda.com', t: 'http', search: '/search?q={q}' },
  'BabyBjörn':   { d: 'www.babybjorn.com',        t: 'http', search: '/en-ca/search?q={q}' },
  'CAP Barbell': { d: 'www.capbarbell.com',       t: 'http', search: '/search?q={q}' },
  'Yes4All':     { d: 'www.yes4all.com',          t: 'http', search: '/search?q={q}' },
  'Marcy':       { d: 'www.marcypro.com',         t: 'http', search: '/search?q={q}' },
  'Sunny Health & Fitness': { d: 'www.sunnyhealthfitness.com', t: 'http', search: '/search?q={q}' },
  'Fitness Reality': { d: 'www.fitnessrealityusa.com', t: 'http', search: '/search?q={q}' },
  'Chuckit!':    { d: 'www.chuckitpets.com',      t: 'http', search: '/search?q={q}' },
  'Technivorm':  { d: 'www.technivorm.com',       t: 'http', search: '/?s={q}' },
  'Bonavita':    { d: 'bonavitaworld.com',         t: 'http', search: '/?s={q}' },
  'Bosch':       { d: 'www.boschtools.com',        t: 'http', search: '/us/en/boschtools-ocs/full-text-search-page-1-1.html?term={q}' },
  'Schlage':     { d: 'www.schlage.com',           t: 'http', search: '/en/home/search.html#{q}' },
  'Yale':        { d: 'www.yalehome.com',          t: 'http', search: '/en/en/search/?q={q}' },
  'Wyze':        { d: 'www.wyze.com',              t: 'http', search: '/search?q={q}' },
  'Arlo':        { d: 'www.arlo.com',              t: 'http', search: '/en-ca/search?q={q}' },
  'LIFX':        { d: 'www.lifx.com',              t: 'http', search: '/search?q={q}' },
  'Orbit':       { d: 'www.orbitonline.com',       t: 'http', search: '/search?q={q}' },
  'Kasa (TP-Link)': { d: 'www.kasasmart.com',      t: 'http', search: '/us/search?q={q}' },
  'Tapo (TP-Link)': { d: 'www.tp-link.com',        t: 'http', search: '/en/search.html?q={q}' },
  'Corsair':     { d: 'www.corsair.com',           t: 'http', search: '/search#{q}' },
  'HyperX':      { d: 'www.hyperx.com',            t: 'http', search: '/search?q={q}' },
  'Razer':       { d: 'www.razer.com',             t: 'http', search: '/search?q={q}' },
  'SteelSeries': { d: 'steelseries.com',           t: 'http', search: '/search?q={q}' },
  '8BitDo':      { d: 'www.8bitdo.com',            t: 'http', search: '/search?q={q}' },
  'Elgato':      { d: 'www.elgato.com',            t: 'http', search: '/en/search?q={q}' },
  'Microsoft':   { d: 'www.microsoft.com',         t: 'http', search: '/en-ca/search?q={q}' },
  'Rockland':    { d: 'www.rocklandbaggage.com',   t: 'http', search: '/search?q={q}' },
  'T-fal':       { d: 'www.t-falusa.com',          t: 'http', search: '/search?q={q}' },
  'Zojirushi':   { d: 'www.zojirushi.com',         t: 'http', search: '/app/category/rice-cookers' },
  'Amazon Essentials': { t: 'skip' },
};

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function fetch(reqUrl, extraHeaders) {
  return new Promise((resolve, reject) => {
    let redirects = 0;
    function doReq(u) {
      if (++redirects > 5) return reject(new Error('Too many redirects'));
      const parsed = new url.URL(u);
      const mod    = parsed.protocol === 'http:' ? http : https;
      const req = mod.request({
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers:  Object.assign({
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept':          'text/html,application/json,*/*',
          'Accept-Language': 'en-CA,en;q=0.9',
        }, extraHeaders || {}),
        timeout: 10000,
      }, res => {
        if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
          return doReq(new url.URL(res.headers.location, u).href);
        }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), finalUrl: u }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    }
    doReq(reqUrl);
  });
}

function downloadBinary(reqUrl, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    let redirects = 0;
    function doReq(u) {
      if (++redirects > 5) return reject(new Error('Too many redirects'));
      const parsed = new url.URL(u);
      const mod    = parsed.protocol === 'http:' ? http : https;
      mod.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }, res => {
        if ([301,302,303].includes(res.statusCode) && res.headers.location) {
          return doReq(new url.URL(res.headers.location, u).href);
        }
        if (res.statusCode !== 200) {
          file.close(); try { fs.unlinkSync(destPath); } catch(_){}
          return reject(new Error('HTTP ' + res.statusCode));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', err => { file.close(); try { fs.unlinkSync(destPath); } catch(_){} reject(err); });
    }
    doReq(reqUrl);
  });
}

// ── Shopify products.json search ──────────────────────────────────────────────
async function tryShopify(domain, modelName) {
  const q = encodeURIComponent(modelName);
  try {
    const { status, body } = await fetch(`https://${domain}/products.json?q=${q}&limit=5`);
    if (status !== 200) return null;
    const data = JSON.parse(body);
    for (const p of (data.products || [])) {
      for (const img of (p.images || [])) {
        const src = img.src || '';
        if (src) return src.replace(/(_\d+x\d*)(\.(?:jpg|png|webp))/i, '$2');
      }
    }
  } catch(_) {}
  return null;
}

// ── Extract og:image from raw HTML ────────────────────────────────────────────
function extractOg(html, base) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1] && !m[1].includes('logo') && !m[1].includes('favicon') && !m[1].includes('placeholder') && m[1].length > 20) {
      return abs(m[1], base);
    }
  }
  // JSON-LD Product image
  const m = html.match(/"@type"\s*:\s*"Product"[\s\S]{0,3000}?"image"\s*:\s*(?:"([^"]{20,}?)"|(\[[^\]]+?\]))/);
  if (m) {
    try {
      const img = m[1] || JSON.parse(m[2])[0];
      if (img) return abs(typeof img === 'string' ? img : img.url, base);
    } catch(_) {}
  }
  return null;
}

function abs(imgUrl, base) {
  if (!imgUrl) return null;
  if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
  if (imgUrl.startsWith('http')) return imgUrl;
  try { return new url.URL(imgUrl, base).href; } catch(_) { return null; }
}

// Strip Shopify resize params for max resolution
function shopifyMaxRes(imgUrl) {
  return imgUrl.replace(/(_\d+x\d*)(\.(?:jpg|jpeg|png|webp))/i, '$2');
}

function updateProductHtml(slug, heroUrl) {
  const p = path.join(ROOT, 'products', slug + '.html');
  if (!fs.existsSync(p)) return;
  let html = fs.readFileSync(p, 'utf8');
  html = html.replace(/(<img[^>]+class="[^"]*product-hero[^"]*"[^>]*src=")[^"]*(")/g, `$1${heroUrl}$2`);
  html = html.replace(/(<meta property="og:image"[^>]+content=")[^"]*(")/g, `$1${heroUrl}$2`);
  fs.writeFileSync(p, html, 'utf8');
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
      try {
        const q = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, p.id + '.json'), 'utf8').replace(/^﻿/, ''));
        return (q.brand || '').toLowerCase() === onlyBrand.toLowerCase();
      } catch(_) { return false; }
    });
  }
  if (isFinite(limit)) targets = targets.slice(0, limit);
  if (!targets.length) { console.log('Nothing to do.'); return; }

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

    const cfg = brand ? BRANDS[brand] : null;
    if (!cfg || cfg.t === 'skip') {
      console.log(`—  no config (${brand || 'unknown'})`);
      results.skip.push(slug);
      continue;
    }

    // model name = product name minus brand, or slug minus brand prefix
    const brandSlug = (brand || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const modelSlug = slug.replace(new RegExp('^' + brandSlug + '-?'), '');
    const modelName = productName.replace(new RegExp('^' + brand + '\\s*', 'i'), '').trim() || productName;
    const q         = encodeURIComponent(modelName);

    let imageUrl = null;

    try {
      if (cfg.t === 'shopify') {
        // Try with model name first, then full product name
        imageUrl = await tryShopify(cfg.d, modelName);
        if (!imageUrl) imageUrl = await tryShopify(cfg.d, productName);
      }

      else if (cfg.t === 'cdn') {
        const candidates = cfg.fn(slug, productName);
        for (const candidate of candidates) {
          try {
            const { status } = await fetch(candidate);
            if (status === 200) { imageUrl = candidate; break; }
          } catch(_) {}
        }
      }

      else if (cfg.t === 'http') {
        const urlsToTry = [];

        // Brand-specific product path pattern
        if (cfg.path) {
          urlsToTry.push('https://' + cfg.d + cfg.path.replace('{model}', modelSlug));
        }

        // Search page
        if (cfg.search) {
          urlsToTry.push('https://' + cfg.d + cfg.search.replace('{q}', q));
          // Also try with just the model slug words
          urlsToTry.push('https://' + cfg.d + cfg.search.replace('{q}', encodeURIComponent(modelSlug.replace(/-/g, ' '))));
        }

        // Common product page patterns
        urlsToTry.push('https://' + cfg.d + '/products/' + modelSlug);
        urlsToTry.push('https://' + cfg.d + '/' + modelSlug);

        for (const u of urlsToTry) {
          try {
            const { status, body, finalUrl } = await fetch(u);
            if (status !== 200) continue;
            const og = extractOg(body, finalUrl);
            if (og) { imageUrl = og; break; }
          } catch(_) {}
        }
      }
    } catch (err) {
      console.log('✗  error: ' + err.message);
      results.fail.push({ slug, reason: err.message });
      continue;
    }

    if (!imageUrl) {
      console.log('✗  not found');
      results.fail.push({ slug, reason: 'not found' });
      continue;
    }

    // Make absolute
    if (!imageUrl.startsWith('http')) imageUrl = 'https://' + cfg.d + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
    imageUrl = shopifyMaxRes(imageUrl);

    try {
      await downloadBinary(imageUrl, destPath);
    } catch (err) {
      console.log('✗  download: ' + err.message);
      results.fail.push({ slug, reason: 'download: ' + err.message });
      continue;
    }

    const stat = fs.statSync(destPath);
    if (stat.size < 5000) {
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

    console.log('✓  ' + kb + ' KB  [' + cfg.t + ']');
    results.ok.push({ slug, kb, t: cfg.t });
  }

  fs.writeFileSync(PRODUCTS_JS, JSON.stringify(products, null, 2), 'utf8');

  console.log('\n── Summary ──────────────────────────────────────────────────────────');
  console.log('  ✓ ' + results.ok.length + '  skipped: ' + results.skip.length + '  failed: ' + results.fail.length);
  if (results.ok.length) {
    const byType = {};
    results.ok.forEach(r => { byType[r.t] = (byType[r.t]||0) + 1; });
    Object.entries(byType).forEach(([k,v]) => console.log('    ' + k + ': ' + v));
  }
  if (results.fail.length) {
    const byR = {};
    results.fail.forEach(r => { byR[r.reason] = (byR[r.reason]||0)+1; });
    Object.entries(byR).slice(0,8).forEach(([k,v]) => console.log('    fail/' + k + ': ' + v));
  }
  console.log('');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
