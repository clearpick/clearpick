#!/usr/bin/env node
'use strict';

/*
  batch-press-img.js

  Fetches press-quality images from manufacturer websites for products
  that still have VERIFY_IMAGE_ID or images-na.ssl-images-amazon.com URLs.

  Strategy:
    1. Shopify brands  → /products.json API (no Puppeteer, full-res)
    2. Other brands    → Puppeteer scrape: search page → first result → og:image

  Usage:
    node scripts/batch-press-img.js [--limit N] [--slug some-slug] [--brand "Garmin"]
*/

const puppeteer = require('puppeteer-core');
const https     = require('https');
const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const url       = require('url');

const ROOT        = path.resolve(__dirname, '..');
const PRODUCTS_JS = path.join(ROOT, 'products.json');
const QUEUE_DIR   = path.join(ROOT, 'research-queue');
const IMG_DIR     = path.join(ROOT, 'public', 'images', 'products');

const CHROME_PATH = process.env.CHROME_PATH ||
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

const DELAY_MS    = 1500;
const NAV_TIMEOUT = 12000;  // hard cap per page
const EVAL_WAIT   = 1200;   // post-load settle time

// ── args ──────────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const limitArg  = args.indexOf('--limit');
const limit     = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;
const slugArg   = args.indexOf('--slug');
const onlySlug  = slugArg !== -1 ? args[slugArg + 1] : null;
const brandArg  = args.indexOf('--brand');
const onlyBrand = brandArg !== -1 ? args[brandArg + 1] : null;

// ── Brand map ─────────────────────────────────────────────────────────────────
// type: 'shopify'  → hits /products.json?q={name}&limit=3
// type: 'scrape'   → Puppeteer: visits searchUrl, extracts og:image or JSON-LD
// searchUrl uses {q} as placeholder for URL-encoded product name

const BRAND_MAP = {
  // ── Shopify stores ────────────────────────────────────────────────────────
  'Hydro Flask':            { domain: 'www.hydroflask.com',           type: 'shopify' },
  'CamelBak':               { domain: 'www.camelbak.com',             type: 'shopify' },
  'Crossrope':              { domain: 'www.crossrope.com',            type: 'shopify' },
  'Keychron':               { domain: 'www.keychron.com',             type: 'shopify' },
  'REP Fitness':            { domain: 'www.repfitness.com',           type: 'shopify' },
  'Fellow':                 { domain: 'fellowproducts.com',           type: 'shopify' },
  'NOMATIC':                { domain: 'www.nomatic.com',              type: 'shopify' },
  'Peak Design':            { domain: 'www.peakdesign.com',           type: 'shopify' },
  'Leatherman':             { domain: 'www.leatherman.com',           type: 'shopify' },
  'Shokz':                  { domain: 'shokz.com',                    type: 'shopify' },
  'Black Diamond':          { domain: 'www.blackdiamondequipment.com', type: 'shopify' },
  'Secretlab':              { domain: 'secretlab.co',                 type: 'shopify' },
  'MEATER':                 { domain: 'www.meater.com',               type: 'shopify' },
  'Tractive':               { domain: 'tractive.com',                 type: 'shopify' },
  'WiZ (Signify)':          { domain: 'www.wizconnected.com',         type: 'shopify' },
  'NuFACE':                 { domain: 'www.nufacebeauty.com',         type: 'shopify' },
  'FOREO':                  { domain: 'www.foreo.com',                type: 'shopify' },
  'Litter-Robot':           { domain: 'www.litter-robot.com',         type: 'shopify' },
  'WOPET':                  { domain: 'www.wopet.com',                type: 'shopify' },
  'ghd':                    { domain: 'www.ghdhair.com',              type: 'shopify' },
  'Furbo':                  { domain: 'shopus.furbo.com',             type: 'shopify' },
  'Fitbit (Google)':        { domain: 'www.fitbit.com',               type: 'shopify' },
  'Eagle Creek':            { domain: 'www.eaglecreek.com',           type: 'shopify' },
  'Pacsafe':                { domain: 'www.pacsafe.com',              type: 'shopify' },
  'Gregory':                { domain: 'www.gregorypacks.com',         type: 'shopify' },
  'Osprey':                 { domain: 'www.ospreypacks.com',          type: 'shopify' },
  'Brooks':                 { domain: 'www.brooksrunning.com',        type: 'shopify' },
  'HOKA':                   { domain: 'www.hoka.com',                 type: 'shopify' },
  'Salomon':                { domain: 'www.salomon.com',              type: 'shopify' },
  'The North Face':         { domain: 'www.thenorthface.com',         type: 'shopify' },
  'Ergobaby':               { domain: 'ergobaby.com',                 type: 'shopify' },
  'Hatch':                  { domain: 'www.hatch.co',                 type: 'shopify' },
  'Skip Hop':               { domain: 'www.skiphop.com',              type: 'shopify' },
  'Happiest Baby':          { domain: 'www.happiestbaby.com',         type: 'shopify' },
  'Stokke':                 { domain: 'www.stokke.com',               type: 'shopify' },
  'UPPAbaby':               { domain: 'www.uppababy.com',             type: 'shopify' },
  'Baby Jogger':            { domain: 'www.babyjogger.com',           type: 'shopify' },
  'Bugaboo':                { domain: 'www.bugaboo.com',              type: 'shopify' },
  'Britax':                 { domain: 'us.britax.com',                type: 'shopify' },
  'Maxi-Cosi':              { domain: 'www.maxi-cosi.com',            type: 'shopify' },
  'Chicco':                 { domain: 'www.chiccousa.com',            type: 'shopify' },
  'Infant Optics':          { domain: 'www.infantoptics.com',         type: 'shopify' },
  'Nanit':                  { domain: 'www.nanit.com',                type: 'shopify' },
  'Samsonite':              { domain: 'www.samsonite.com',            type: 'shopify' },
  'DELSEY Paris':           { domain: 'www.delsey.com',               type: 'shopify' },
  'Travelpro':              { domain: 'www.travelpro.com',            type: 'shopify' },
  'American Tourister':     { domain: 'www.americantourister.com',    type: 'shopify' },
  'Trtl':                   { domain: 'www.trtltravel.com',           type: 'shopify' },
  'Hyperice':               { domain: 'www.hyperice.com',             type: 'shopify' },
  'Therabody':              { domain: 'www.therabody.com',            type: 'shopify' },
  'Gaiam':                  { domain: 'www.gaiam.com',                type: 'shopify' },
  'Vantrue':                { domain: 'vantrue.net',                  type: 'shopify' },
  'Thinkware':              { domain: 'www.thinkwareusa.com',         type: 'shopify' },
  'BlackVue':               { domain: 'www.blackvue.com',             type: 'shopify' },
  'Autel':                  { domain: 'www.auteltech.com',            type: 'shopify' },
  'eufy':                   { domain: 'www.eufylife.com',             type: 'shopify' },
  'NOCO':                   { domain: 'no.co',                        type: 'shopify' },
  'Meguiar\'s':             { domain: 'www.meguiars.com',             type: 'shopify' },

  // ── Scrape brands ─────────────────────────────────────────────────────────
  'Garmin':      { domain: 'www.garmin.com', type: 'scrape',
                   searchUrl: 'https://www.garmin.com/en-CA/search/?q={q}' },
  'Logitech':    { domain: 'www.logitech.com', type: 'scrape',
                   searchUrl: 'https://www.logitech.com/en-ca/search?q={q}' },
  'Blue (Logitech)': { domain: 'www.bluemic.com', type: 'scrape',
                   searchUrl: 'https://www.bluemic.com/en-us/search/?q={q}' },
  'DEWALT':      { domain: 'www.dewalt.com', type: 'scrape',
                   searchUrl: 'https://www.dewalt.com/search?searchTerm={q}' },
  'Milwaukee':   { domain: 'www.milwaukeetool.com', type: 'scrape',
                   searchUrl: 'https://www.milwaukeetool.com/search#{q}' },
  'RYOBI':       { domain: 'ryobitools.com', type: 'scrape',
                   searchUrl: 'https://www.ryobitools.com/search/?q={q}' },
  'Ryobi':       { domain: 'ryobitools.com', type: 'scrape',
                   searchUrl: 'https://www.ryobitools.com/search/?q={q}' },
  'Makita':      { domain: 'www.makita.ca', type: 'scrape',
                   searchUrl: 'https://www.makita.ca/products/?searchTerm={q}' },
  'Greenworks':  { domain: 'www.greenworkstools.com', type: 'scrape',
                   searchUrl: 'https://www.greenworkstools.com/search?q={q}' },
  'EGO':         { domain: 'egopowerplus.com', type: 'scrape',
                   searchUrl: 'https://egopowerplus.com/search?q={q}' },
  'Dyson':       { domain: 'www.dyson.ca', type: 'scrape',
                   searchUrl: 'https://www.dyson.ca/search?q={q}' },
  'Vitamix':     { domain: 'www.vitamix.com', type: 'scrape',
                   searchUrl: 'https://www.vitamix.com/us/en_us/search.aspx#q={q}' },
  'Cuisinart':   { domain: 'www.cuisinart.com', type: 'scrape',
                   searchUrl: 'https://www.cuisinart.com/search/?query={q}' },
  'Breville':    { domain: 'www.breville.com', type: 'scrape',
                   searchUrl: 'https://www.breville.com/us/en/search?q={q}' },
  'De\'Longhi':  { domain: 'www.delonghi.com', type: 'scrape',
                   searchUrl: 'https://www.delonghi.com/en-ca/search?q={q}' },
  'Nespresso':   { domain: 'www.nespresso.com', type: 'scrape',
                   searchUrl: 'https://www.nespresso.com/ca/en/search?q={q}' },
  'Technivorm':  { domain: 'www.technivorm.com', type: 'scrape',
                   searchUrl: 'https://www.technivorm.com/?s={q}' },
  'Bonavita':    { domain: 'bonavitaworld.com', type: 'scrape',
                   searchUrl: 'https://bonavitaworld.com/?s={q}' },
  'Hamilton Beach': { domain: 'www.hamiltonbeach.com', type: 'scrape',
                   searchUrl: 'https://www.hamiltonbeach.com/search?q={q}' },
  'Ninja':       { domain: 'www.ninjakitchen.com', type: 'scrape',
                   searchUrl: 'https://www.ninjakitchen.com/search/?q={q}' },
  'Cosori':      { domain: 'www.cosori.com', type: 'scrape',
                   searchUrl: 'https://www.cosori.com/search?type=product&q={q}' },
  'Instant':     { domain: 'www.instantpot.com', type: 'scrape',
                   searchUrl: 'https://www.instantpot.com/search?q={q}' },
  'Crock-Pot':   { domain: 'www.crock-pot.com', type: 'scrape',
                   searchUrl: 'https://www.crock-pot.com/search?q={q}' },
  'Oster':       { domain: 'www.oster.com', type: 'scrape',
                   searchUrl: 'https://www.oster.com/search?q={q}' },
  'OXO':         { domain: 'www.oxo.com', type: 'scrape',
                   searchUrl: 'https://www.oxo.com/search?q={q}' },
  'NutriBullet': { domain: 'www.nutribullet.com', type: 'scrape',
                   searchUrl: 'https://www.nutribullet.com/search?q={q}' },
  'T-fal':       { domain: 'www.t-falusa.com', type: 'scrape',
                   searchUrl: 'https://www.t-falusa.com/search?q={q}' },
  'Zojirushi':   { domain: 'www.zojirushi.com', type: 'scrape',
                   searchUrl: 'https://www.zojirushi.com/app/category/rice-cookers' },
  'JBL':         { domain: 'www.jbl.com', type: 'scrape',
                   searchUrl: 'https://www.jbl.com/search?q={q}' },
  'Jabra':       { domain: 'www.jabra.com', type: 'scrape',
                   searchUrl: 'https://www.jabra.com/search#/?query={q}' },
  'Sonos':       { domain: 'www.sonos.com', type: 'scrape',
                   searchUrl: 'https://www.sonos.com/en-ca/search?q={q}' },
  'Marshall':    { domain: 'www.marshallheadphones.com', type: 'scrape',
                   searchUrl: 'https://www.marshallheadphones.com/search?q={q}' },
  'Nothing':     { domain: 'nothing.tech', type: 'scrape',
                   searchUrl: 'https://nothing.tech/search?q={q}' },
  'Edifier':     { domain: 'www.edifier.com', type: 'scrape',
                   searchUrl: 'https://www.edifier.com/search?q={q}' },
  'Ultimate Ears': { domain: 'www.ultimateears.com', type: 'scrape',
                   searchUrl: 'https://www.ultimateears.com/en-ca/search?q={q}' },
  'LG':          { domain: 'www.lg.com', type: 'scrape',
                   searchUrl: 'https://www.lg.com/ca_en/search?search={q}' },
  'Sony':        { domain: 'www.sony.ca', type: 'scrape',
                   searchUrl: 'https://www.sony.ca/en/search/?q={q}' },
  'Anker':       { domain: 'www.anker.com', type: 'scrape',
                   searchUrl: 'https://www.anker.com/search?q={q}' },
  'Elgato':      { domain: 'www.elgato.com', type: 'scrape',
                   searchUrl: 'https://www.elgato.com/en/search?q={q}' },
  'Corsair':     { domain: 'www.corsair.com', type: 'scrape',
                   searchUrl: 'https://www.corsair.com/search#{q}' },
  'Razer':       { domain: 'www.razer.com', type: 'scrape',
                   searchUrl: 'https://www.razer.com/search?q={q}' },
  'HyperX':      { domain: 'www.hyperx.com', type: 'scrape',
                   searchUrl: 'https://www.hyperx.com/search?q={q}' },
  'SteelSeries': { domain: 'steelseries.com', type: 'scrape',
                   searchUrl: 'https://steelseries.com/search?q={q}' },
  '8BitDo':      { domain: 'www.8bitdo.com', type: 'scrape',
                   searchUrl: 'https://www.8bitdo.com/search?q={q}' },
  'ASUS':        { domain: 'www.asus.com', type: 'scrape',
                   searchUrl: 'https://www.asus.com/ca-en/search.aspx?query={q}' },
  'BenQ':        { domain: 'www.benq.com', type: 'scrape',
                   searchUrl: 'https://www.benq.com/en-ca/search/{q}.html' },
  'Dell':        { domain: 'www.dell.com', type: 'scrape',
                   searchUrl: 'https://www.dell.com/en-ca/search/{q}' },
  'Ergotron':    { domain: 'www.ergotron.com', type: 'scrape',
                   searchUrl: 'https://www.ergotron.com/en-ca/search#q={q}' },
  'FlexiSpot':   { domain: 'www.flexispot.ca', type: 'scrape',
                   searchUrl: 'https://www.flexispot.ca/search?q={q}' },
  'Google':      { domain: 'store.google.com', type: 'scrape',
                   searchUrl: 'https://store.google.com/ca/search?q={q}' },
  'Apple':       { domain: 'www.apple.com', type: 'scrape',
                   searchUrl: 'https://www.apple.com/ca/search/{q}?src=globalnav' },
  'Microsoft':   { domain: 'www.microsoft.com', type: 'scrape',
                   searchUrl: 'https://www.microsoft.com/en-ca/search?q={q}' },
  'Beats':       { domain: 'www.beatsbydre.com', type: 'scrape',
                   searchUrl: 'https://www.beatsbydre.com/search?q={q}' },
  'Logitech':    { domain: 'www.logitech.com', type: 'scrape',
                   searchUrl: 'https://www.logitech.com/en-ca/search?q={q}' },
  'TCL':         { domain: 'www.tcl.com', type: 'scrape',
                   searchUrl: 'https://www.tcl.com/ca/en/search.html?q={q}' },
  'Hisense':     { domain: 'www.hisense.ca', type: 'scrape',
                   searchUrl: 'https://www.hisense.ca/search/?q={q}' },
  'Roku':        { domain: 'www.roku.com', type: 'scrape',
                   searchUrl: 'https://www.roku.com/en-ca/search?q={q}' },
  'Philips':     { domain: 'www.philips.ca', type: 'scrape',
                   searchUrl: 'https://www.philips.ca/en/search?q={q}' },
  'Philips Hue': { domain: 'www.philips-hue.com', type: 'scrape',
                   searchUrl: 'https://www.philips-hue.com/en-ca/search?q={q}' },
  'Kasa (TP-Link)': { domain: 'www.kasasmart.com', type: 'scrape',
                   searchUrl: 'https://www.kasasmart.com/us/search?q={q}' },
  'Tapo (TP-Link)': { domain: 'www.tp-link.com', type: 'scrape',
                   searchUrl: 'https://www.tp-link.com/en/search.html?q={q}' },
  'LIFX':        { domain: 'www.lifx.com', type: 'scrape',
                   searchUrl: 'https://www.lifx.com/search?q={q}' },
  'Schlage':     { domain: 'www.schlage.com', type: 'scrape',
                   searchUrl: 'https://www.schlage.com/en/home/search.html#{q}' },
  'Yale':        { domain: 'www.yalehome.com', type: 'scrape',
                   searchUrl: 'https://www.yalehome.com/en/en/search/?q={q}' },
  'Wyze':        { domain: 'www.wyze.com', type: 'scrape',
                   searchUrl: 'https://www.wyze.com/search?q={q}' },
  'Arlo':        { domain: 'www.arlo.com', type: 'scrape',
                   searchUrl: 'https://www.arlo.com/en-ca/search?q={q}' },
  'Graco':       { domain: 'www.gracobaby.com', type: 'scrape',
                   searchUrl: 'https://www.gracobaby.com/search?q={q}' },
  'Regalo':      { domain: 'www.regalo-baby.com', type: 'scrape',
                   searchUrl: 'https://www.regalo-baby.com/search?q={q}' },
  '4moms':       { domain: 'www.4moms.com', type: 'scrape',
                   searchUrl: 'https://www.4moms.com/search?q={q}' },
  'Orbit':       { domain: 'www.orbitonline.com', type: 'scrape',
                   searchUrl: 'https://www.orbitonline.com/search?q={q}' },
  'Schwinn':     { domain: 'www.schwinnfitness.com', type: 'scrape',
                   searchUrl: 'https://www.schwinnfitness.com/search?q={q}' },
  'NordicTrack': { domain: 'www.nordictrack.com', type: 'scrape',
                   searchUrl: 'https://www.nordictrack.com/search?q={q}' },
  'Sole':        { domain: 'www.soletreadmills.com', type: 'scrape',
                   searchUrl: 'https://www.soletreadmills.com/search?q={q}' },
  'WalkingPad':  { domain: 'www.walkingpad.com', type: 'scrape',
                   searchUrl: 'https://www.walkingpad.com/search?q={q}' },
  'Marcy':       { domain: 'www.marcypro.com', type: 'scrape',
                   searchUrl: 'https://www.marcypro.com/search?q={q}' },
  'Fitness Reality': { domain: 'www.fitnessrealityusa.com', type: 'scrape',
                   searchUrl: 'https://www.fitnessrealityusa.com/search?q={q}' },
  'Sunny Health & Fitness': { domain: 'www.sunnyhealthfitness.com', type: 'scrape',
                   searchUrl: 'https://www.sunnyhealthfitness.com/search?q={q}' },
  'CAP Barbell': { domain: 'www.capbarbell.com', type: 'scrape',
                   searchUrl: 'https://www.capbarbell.com/search?q={q}' },
  'Yes4All':     { domain: 'www.yes4all.com', type: 'scrape',
                   searchUrl: 'https://www.yes4all.com/search?q={q}' },
  'Braun':       { domain: 'www.braun.com', type: 'scrape',
                   searchUrl: 'https://www.braun.com/en-ca/search?query={q}' },
  'Oral-B':      { domain: 'www.oralb.ca', type: 'scrape',
                   searchUrl: 'https://www.oralb.ca/en-ca/search?q={q}' },
  'Waterpik':    { domain: 'www.waterpik.com', type: 'scrape',
                   searchUrl: 'https://www.waterpik.com/search?q={q}' },
  'Panasonic':   { domain: 'www.panasonic.com', type: 'scrape',
                   searchUrl: 'https://www.panasonic.com/ca/en/search.html?q={q}' },
  'Philips Norelco': { domain: 'www.philipsnorelco.com', type: 'scrape',
                   searchUrl: 'https://www.philipsnorelco.com/search?q={q}' },
  'Conair':      { domain: 'www.conair.com', type: 'scrape',
                   searchUrl: 'https://www.conair.com/search?q={q}' },
  'BaBylissPRO': { domain: 'www.babyliss.com', type: 'scrape',
                   searchUrl: 'https://www.babyliss.com/search?q={q}' },
  'Revlon':      { domain: 'www.revlon.com', type: 'scrape',
                   searchUrl: 'https://www.revlon.com/search?q={q}' },
  'Wahl':        { domain: 'www.wahlclippers.com', type: 'scrape',
                   searchUrl: 'https://www.wahlclippers.com/search?q={q}' },
  'T3':          { domain: 'www.t3micro.com', type: 'scrape',
                   searchUrl: 'https://www.t3micro.com/search?q={q}' },
  'Shark':       { domain: 'www.sharkclean.ca', type: 'scrape',
                   searchUrl: 'https://www.sharkclean.ca/search?q={q}' },
  'PetSafe':     { domain: 'www.petsafe.net', type: 'scrape',
                   searchUrl: 'https://www.petsafe.net/search?q={q}' },
  'PetFusion':   { domain: 'www.petfusion.com', type: 'scrape',
                   searchUrl: 'https://www.petfusion.com/search?q={q}' },
  'KONG':        { domain: 'www.kongcompany.com', type: 'scrape',
                   searchUrl: 'https://www.kongcompany.com/search?q={q}' },
  'Chuckit!':    { domain: 'www.chuckitpets.com', type: 'scrape',
                   searchUrl: 'https://www.chuckitpets.com/search?q={q}' },
  'FurHaven':    { domain: 'www.furhaven.com', type: 'scrape',
                   searchUrl: 'https://www.furhaven.com/search?q={q}' },
  'MidWest Homes for Pets': { domain: 'www.midwestindustries.com', type: 'scrape',
                   searchUrl: 'https://www.midwestindustries.com/search?q={q}' },
  'Bosch':       { domain: 'www.boschtools.com', type: 'scrape',
                   searchUrl: 'https://www.boschtools.com/us/en/boschtools-ocs/full-text-search-page-1-1.html?term={q}' },
  'Honda':       { domain: 'powerequipment.honda.com', type: 'scrape',
                   searchUrl: 'https://powerequipment.honda.com/search?q={q}' },
  'Camp Chef':   { domain: 'www.campchef.com', type: 'scrape',
                   searchUrl: 'https://www.campchef.com/search?q={q}' },
  'Blackstone':  { domain: 'www.blackstoneproducts.com', type: 'scrape',
                   searchUrl: 'https://www.blackstoneproducts.com/search?q={q}' },
  'Kamado Joe':  { domain: 'www.kamadojoe.com', type: 'scrape',
                   searchUrl: 'https://www.kamadojoe.com/search?q={q}' },
  'Broil King':  { domain: 'www.broilkingbbq.com', type: 'scrape',
                   searchUrl: 'https://www.broilkingbbq.com/search?q={q}' },
  'Napoleon':    { domain: 'www.napoleonproducts.com', type: 'scrape',
                   searchUrl: 'https://www.napoleonproducts.com/search?q={q}' },
  'Masterbuilt': { domain: 'www.masterbuilt.com', type: 'scrape',
                   searchUrl: 'https://www.masterbuilt.com/search?q={q}' },
  'Pit Boss':    { domain: 'www.pitboss-grills.com', type: 'scrape',
                   searchUrl: 'https://www.pitboss-grills.com/search?q={q}' },
  'Char-Griller':{ domain: 'www.chargriller.com', type: 'scrape',
                   searchUrl: 'https://www.chargriller.com/search?q={q}' },
  'GrillGrates': { domain: 'www.grillgrate.com', type: 'scrape',
                   searchUrl: 'https://www.grillgrate.com/search?q={q}' },
  'Weber':       { domain: 'www.weber.com', type: 'scrape',
                   searchUrl: 'https://www.weber.com/en-CA/search?q={q}' },
  'Traeger':     { domain: 'www.traeger.com', type: 'scrape',
                   searchUrl: 'https://www.traeger.com/search?q={q}' },
  'Z Grills':    { domain: 'zgrills.com', type: 'scrape',
                   searchUrl: 'https://zgrills.com/search?q={q}' },
  'iOttie':      { domain: 'www.iottie.com', type: 'scrape',
                   searchUrl: 'https://www.iottie.com/search?q={q}' },
  'Spigen':      { domain: 'www.spigen.com', type: 'scrape',
                   searchUrl: 'https://www.spigen.com/search?q={q}' },
  'FIXD':        { domain: 'www.fixdapp.com', type: 'scrape',
                   searchUrl: 'https://www.fixdapp.com/search?q={q}' },
  'Uniden':      { domain: 'www.uniden.com', type: 'scrape',
                   searchUrl: 'https://www.uniden.com/search?q={q}' },
  'VIOFO':       { domain: 'www.viofo.com', type: 'scrape',
                   searchUrl: 'https://www.viofo.com/search?q={q}' },
  'Avid Power':  { domain: 'www.avidpower.com', type: 'scrape',
                   searchUrl: 'https://www.avidpower.com/search?q={q}' },
  'BISSELL':     { domain: 'www.bissell.com', type: 'scrape',
                   searchUrl: 'https://www.bissell.com/search?q={q}' },
  'BLACK+DECKER':{ domain: 'www.blackanddecker.ca', type: 'scrape',
                   searchUrl: 'https://www.blackanddecker.ca/search?q={q}' },
  'Clore':       { domain: 'www.cloreautomotive.com', type: 'scrape',
                   searchUrl: 'https://www.cloreautomotive.com/search?q={q}' },
  'ThermoPro':   { domain: 'buythermopro.com', type: 'scrape',
                   searchUrl: 'https://buythermopro.com/search?q={q}' },
  'ThermoWorks': { domain: 'www.thermoworks.com', type: 'scrape',
                   searchUrl: 'https://www.thermoworks.com/search?q={q}' },
  'MATEIN':      { domain: 'mateintravelbag.com', type: 'shopify' },
  'ZOPPEN':      { domain: 'www.zoppen.com', type: 'shopify' },
  'Rockland':    { domain: 'www.rocklandbaggage.com', type: 'scrape',
                   searchUrl: 'https://www.rocklandbaggage.com/search?q={q}' },
  'Astro':       { domain: 'www.astrogaming.com', type: 'scrape',
                   searchUrl: 'https://www.astrogaming.com/search?q={q}' },
  'Amazon Essentials': { domain: 'www.amazon.ca', type: 'skip' },
  'Dash':        { domain: 'www.bydash.com', type: 'scrape',
                   searchUrl: 'https://www.bydash.com/search?q={q}' },
};

// ── helpers ───────────────────────────────────────────────────────────────────
function httpsGet(reqUrl, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed   = new url.URL(reqUrl);
    const mod      = parsed.protocol === 'http:' ? http : https;
    const options  = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/html, */*',
        ...opts.headers,
      },
      timeout: 12000,
    };
    const req = mod.request(options, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new url.URL(res.headers.location, reqUrl).href;
        return httpsGet(next, opts).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function downloadBinary(reqUrl, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file   = fs.createWriteStream(destPath);
    const parsed = new url.URL(reqUrl);
    const mod    = parsed.protocol === 'http:' ? http : https;
    const doReq  = (u) => {
      const p = new url.URL(u);
      mod.get({ hostname: p.hostname, path: p.pathname + p.search,
        headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 }, res => {
        if ([301, 302, 303].includes(res.statusCode) && res.headers.location) {
          return doReq(new url.URL(res.headers.location, u).href);
        }
        if (res.statusCode !== 200) {
          file.close(); try { fs.unlinkSync(destPath); } catch (_) {}
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', err => { file.close(); try { fs.unlinkSync(destPath); } catch (_) {} reject(err); });
    };
    doReq(reqUrl);
  });
}

// Try Shopify products JSON API
async function tryShopify(domain, productName) {
  const q   = encodeURIComponent(productName);
  const u   = `https://${domain}/products.json?q=${q}&limit=5`;
  try {
    const { status, body } = await httpsGet(u);
    if (status !== 200) return null;
    const data = JSON.parse(body);
    const products = data.products || [];
    for (const p of products) {
      const images = p.images || [];
      for (const img of images) {
        const src = img.src || '';
        if (src && (src.includes('.jpg') || src.includes('.png') || src.includes('.webp'))) {
          // Remove Shopify resize suffix for max resolution: remove _{w}x, _{w}x{h}
          return src.replace(/(_\d+x\d*)(\.(?:jpg|png|webp))/i, '$2');
        }
      }
    }
  } catch (_) {}
  return null;
}

function makeAbsolute(imgUrl, baseUrl) {
  if (!imgUrl) return null;
  if (imgUrl.startsWith('//')) return 'https:' + imgUrl;
  if (imgUrl.startsWith('http')) return imgUrl;
  try { return new url.URL(imgUrl, baseUrl).href; } catch (_) { return null; }
}

// Extract og:image / twitter:image / JSON-LD from raw HTML string
function extractOgImage(html, pageUrl) {
  let m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (m && m[1] && !m[1].includes('logo') && !m[1].includes('favicon') && !m[1].includes('placeholder')) {
    return makeAbsolute(m[1], pageUrl);
  }
  m = html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i);
  if (m && m[1] && !m[1].includes('logo')) return makeAbsolute(m[1], pageUrl);
  // JSON-LD Product schema
  m = html.match(/"@type"\s*:\s*"Product"[\s\S]{0,3000}?"image"\s*:\s*(?:"([^"]{10,}?)"|(\[[\s\S]*?\]))/);
  if (m) {
    try {
      const img = m[1] || (m[2] ? JSON.parse(m[2])[0] : null);
      if (img) return makeAbsolute(typeof img === 'string' ? img : img.url || img.contentUrl, pageUrl);
    } catch (_) {}
  }
  return null;
}

// Search DuckDuckGo HTML (no JS required) → return first result URL for site:domain
async function ddgFindUrl(domain, productName) {
  const q = encodeURIComponent(`site:${domain} "${productName}"`);
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${q}`;
  try {
    const { status, body } = await httpsGet(ddgUrl, {
      headers: { 'Accept': 'text/html', 'Accept-Language': 'en-CA,en;q=0.9' },
    });
    if (status !== 200) return null;
    // Extract first result URL from DDG's /l/?uddg= redirect links
    const m = body.match(/href="\/l\/\?uddg=([^"&]+)/);
    if (m) return decodeURIComponent(m[1]);
    // Fallback: direct href on the domain
    const m2 = body.match(new RegExp(`href="(https?://${domain.replace(/\./g, '\\.')}[^"]*)"`, 'i'));
    if (m2) return m2[1];
  } catch (_) {}
  return null;
}

// Fetch a URL with plain HTTPS and extract og:image from raw HTML
async function fetchOgImage(pageUrl) {
  try {
    const { status, body } = await httpsGet(pageUrl, {
      headers: { 'Accept': 'text/html', 'Accept-Language': 'en-CA,en;q=0.9' },
    });
    if (status !== 200 && status !== 203) return null;
    return extractOgImage(body, pageUrl);
  } catch (_) { return null; }
}

// Puppeteer fallback — only used when HTTP fetch produces nothing (JS-rendered og:image)
async function puppeteerOgImage(page, pageUrl) {
  try {
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  } catch (_) {}
  await new Promise(r => setTimeout(r, EVAL_WAIT));
  return page.evaluate(() => {
    const og = document.querySelector('meta[property="og:image"]');
    if (og && og.content && !og.content.includes('logo')) return og.content;
    const tw = document.querySelector('meta[name="twitter:image"]');
    if (tw && tw.content) return tw.content;
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const items = [].concat(JSON.parse(s.textContent));
        for (const item of items) {
          if (item['@type'] === 'Product' && item.image) {
            const img = Array.isArray(item.image) ? item.image[0] : item.image;
            return typeof img === 'string' ? img : (img.url || img.contentUrl || null);
          }
        }
      } catch (_) {}
    }
    return null;
  });
}

function updateProductHtml(slug, heroUrl) {
  const htmlPath = path.join(ROOT, 'products', `${slug}.html`);
  if (!fs.existsSync(htmlPath)) return;
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html.replace(/(<img[^>]+class="[^"]*product-hero[^"]*"[^>]*src=")[^"]*(")/,
    `$1${heroUrl}$2`);
  html = html.replace(/(<meta property="og:image"[^>]+content=")[^"]*(")/,
    `$1${heroUrl}$2`);
  fs.writeFileSync(htmlPath, html, 'utf8');
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  let products = JSON.parse(fs.readFileSync(PRODUCTS_JS, 'utf8').replace(/^﻿/, ''));

  let targets = products.filter(p =>
    !p.image || p.image.includes('VERIFY_IMAGE_ID') || p.image.includes('images-na.ssl')
  );

  if (onlySlug)  targets = targets.filter(p => p.id === onlySlug);
  if (onlyBrand) targets = targets.filter(p => {
    try {
      const q = JSON.parse(fs.readFileSync(path.join(QUEUE_DIR, `${p.id}.json`), 'utf8').replace(/^﻿/, ''));
      return (q.brand || '').toLowerCase() === onlyBrand.toLowerCase();
    } catch (_) { return false; }
  });
  if (isFinite(limit)) targets = targets.slice(0, limit);

  if (!targets.length) { console.log('Nothing to do.'); return; }
  console.log(`\nProcessing ${targets.length} product(s)…\n`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  // Fresh page per product — prevents a hung page from blocking the next one
  async function freshPage() {
    const p = await browser.newPage();
    p.setDefaultNavigationTimeout(NAV_TIMEOUT);
    p.setDefaultTimeout(NAV_TIMEOUT);
    await p.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await p.setViewport({ width: 1280, height: 800 });
    await p.setRequestInterception(true);
    p.on('request', req => {
      if (['media', 'font', 'stylesheet'].includes(req.resourceType())) req.abort();
      else req.continue();
    });
    return p;
  }

  const results = { ok: [], skip: [], fail: [] };

  for (let i = 0; i < targets.length; i++) {
    const prod = targets[i];
    const slug = prod.id;
    process.stdout.write(`[${String(i + 1).padStart(3)}/${targets.length}] ${slug.padEnd(50)} `);

    // Skip if already downloaded
    const destPath = path.join(IMG_DIR, slug, 'hero.jpg');
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 10000) {
      console.log(`—  already have image`);
      results.skip.push({ slug, reason: 'already downloaded' });
      continue;
    }

    // Get brand from research-queue
    let brand = null;
    let productName = prod.name;
    const queuePath = path.join(QUEUE_DIR, `${slug}.json`);
    if (fs.existsSync(queuePath)) {
      try {
        const q = JSON.parse(fs.readFileSync(queuePath, 'utf8').replace(/^﻿/, ''));
        brand = q.brand;
        if (q.name) productName = q.name;
      } catch (_) {}
    }

    const config = brand ? BRAND_MAP[brand] : null;
    if (!config || config.type === 'skip') {
      console.log(`—  no brand config (${brand || 'unknown'})`);
      results.skip.push({ slug, reason: `no config: ${brand}` });
      continue;
    }

    let imageUrl = null;
    const nameForSearch = productName.replace(/[^\w\s]/g, ' ').trim();
    const q = encodeURIComponent(nameForSearch);

    let page = null;
    try {
      if (config.type === 'shopify') {
        // Step 1: Shopify products.json API — no browser needed
        imageUrl = await tryShopify(config.domain, nameForSearch);
      }

      if (!imageUrl) {
        // Step 2: HTTP fetch of search page → extract og:image from raw HTML
        const searchUrl = (config.searchUrl || `https://${config.domain}/search?q={q}`).replace('{q}', q);
        imageUrl = await fetchOgImage(searchUrl);
      }

      if (!imageUrl) {
        // Step 3: Puppeteer on the search page (JS-rendered results)
        page = await freshPage();
        imageUrl = await puppeteerOgImage(page, (config.searchUrl || `https://${config.domain}/search?q={q}`).replace('{q}', q));
        if (imageUrl) imageUrl = makeAbsolute(imageUrl, `https://${config.domain}/`);
      }
    } catch (err) {
      console.log(`✗  error: ${err.message}`);
      results.fail.push({ slug, reason: err.message });
      if (page) { try { await page.close(); } catch (_) {} }
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }
    if (page) { try { await page.close(); } catch (_) {} }

    if (!imageUrl) {
      console.log(`✗  image not found`);
      results.fail.push({ slug, reason: 'not found' });
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    // Ensure absolute URL
    if (!imageUrl.startsWith('http')) {
      imageUrl = `https://${config.domain}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
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

    const stat = fs.statSync(destPath);
    if (stat.size < 5000) {
      fs.unlinkSync(destPath);
      console.log(`✗  image too small (${stat.size} bytes)`);
      results.fail.push({ slug, reason: 'too small' });
      await new Promise(r => setTimeout(r, DELAY_MS));
      continue;
    }

    const sizeKb  = Math.round(stat.size / 1024);
    const heroUrl = `/images/products/${slug}/hero.jpg`;

    // Update products.json in memory
    const idx = products.findIndex(p => p.id === slug);
    if (idx !== -1) products[idx].image = heroUrl;

    // Update product HTML
    updateProductHtml(slug, heroUrl);

    // Update research-queue
    if (fs.existsSync(queuePath)) {
      try {
        const q2 = JSON.parse(fs.readFileSync(queuePath, 'utf8').replace(/^﻿/, ''));
        q2.image = imageUrl;
        q2.images = { hero: heroUrl, lifestyle: '', detail: '' };
        fs.writeFileSync(queuePath, JSON.stringify(q2, null, 2), 'utf8');
      } catch (_) {}
    }

    console.log(`✓  ${sizeKb} KB  (${config.type})`);
    results.ok.push({ slug, sizeKb, type: config.type });

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await browser.close();

  fs.writeFileSync(PRODUCTS_JS, JSON.stringify(products, null, 2), 'utf8');
  console.log(`\n✓ products.json saved`);

  console.log('\n── Summary ─────────────────────────────────────────────────────────');
  console.log(`  ✓ Downloaded : ${results.ok.length}`);
  console.log(`  — Skipped   : ${results.skip.length}`);
  console.log(`  ✗ Failed    : ${results.fail.length}`);

  if (results.ok.length) {
    const shopify = results.ok.filter(r => r.type === 'shopify').length;
    const scrape  = results.ok.filter(r => r.type === 'scrape').length;
    console.log(`\n  Source: ${shopify} × Shopify API,  ${scrape} × manufacturer scrape`);
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
