#!/usr/bin/env node
'use strict';
// Temporary one-shot script: patches the 17 new research-queue JSONs before process-queue runs.
// Adds similarProducts, fixes VERIFY_IMAGE_ID, sets newCategoryPage flag where needed.

const fs   = require('fs');
const path = require('path');

const QUEUE = path.resolve(__dirname, '..', 'research-queue');

const patches = {
  'apple-airpods-max-usb-c': {
    similarProducts: ['bose-quietcomfort-ultra', 'sennheiser-momentum-4', 'sony-wh-1000xm6'],
    image: 'https://images-na.ssl-images-amazon.com/images/P/B0DGJC52FP.01._SCLZZZZZZZ_.jpg',
  },
  'bose-quietcomfort-ultra-headphones': {
    similarProducts: ['apple-airpods-max-usb-c', 'sennheiser-momentum-4', 'sony-wh-1000xm6'],
    image: 'https://images-na.ssl-images-amazon.com/images/P/B0CCZ1L489.01._SCLZZZZZZZ_.jpg',
  },
  'breville-barista-express-impress': {
    similarProducts: ['breville-barista-pro', 'delonghi-la-specialista-maestro', 'gaggia-classic-pro'],
    newCategoryPage: true,
  },
  'camp-chef-woodwind-pro-24': {
    similarProducts: ['traeger-pro-575-pellet-grill', 'weber-spirit-ii-e310-gas-grill', 'blackstone-36-inch-griddle'],
    newCategoryPage: true,
  },
  'hydrow-wave-rower': {
    similarProducts: ['concept2-rowerg', 'nordictrack-1750', 'schwinn-ic4'],
    newCategoryPage: true,
  },
  'lg-g4-oled-65-tv': {
    similarProducts: ['lg-c5-oled-65-tv', 'sony-bravia-9-65-mini-led-tv', 'samsung-q80d-65-qled-tv'],
  },
  'ninja-creami-deluxe': {
    similarProducts: ['breville-barista-express-impress', 'ninja-foodi-xl-pro-dt201', 'instant-pot-duo-crisp-11-in-1'],
  },
  'roborock-qrevo-curv': {
    similarProducts: ['roborock-qrevo-s', 'dreame-l10s-ultra', 'eufy-x10-pro-omni'],
  },
  'roborock-qrevo-s-pro': {
    similarProducts: ['roborock-qrevo-curv', 'roborock-qrevo-s', 'dreame-l10s-ultra'],
    image: 'https://images-na.ssl-images-amazon.com/images/P/B0GGRSMXKN.01._SCLZZZZZZZ_.jpg',
  },
  'roborock-qv-35a': {
    similarProducts: ['roborock-qrevo-s-pro', 'roborock-qrevo-s', 'eufy-x10-pro-omni'],
  },
  'samsung-qn90d-neo-qled-65-tv': {
    similarProducts: ['lg-g4-oled-65-tv', 'samsung-q80d-65-qled-tv', 'hisense-u88qg-65-mini-led-tv'],
  },
  'sennheiser-momentum-4-wireless': {
    similarProducts: ['bose-quietcomfort-ultra-headphones', 'apple-airpods-max-usb-c', 'sony-wh-1000xm6'],
    image: 'https://images-na.ssl-images-amazon.com/images/P/B0B6GHW1SX.01._SCLZZZZZZZ_.jpg',
  },
  'sony-bravia-8-oled-65-tv': {
    similarProducts: ['lg-g4-oled-65-tv', 'samsung-qn90d-neo-qled-65-tv', 'sony-bravia-9-65-mini-led-tv'],
  },
  'theragun-prime-5th-gen': {
    similarProducts: ['theragun-mini', 'triggerpoint-grid-foam-roller', 'hydrow-wave-rower'],
  },
  'traeger-woodridge': {
    similarProducts: ['camp-chef-woodwind-pro-24', 'traeger-pro-575-pellet-grill', 'weber-spirit-ii-e310-gas-grill'],
  },
  'vitamix-e310-explorian': {
    similarProducts: ['ninja-creami-deluxe', 'breville-barista-express-impress', 'ninja-foodi-xl-pro-dt201'],
    image: 'https://images-na.ssl-images-amazon.com/images/P/B0758JHZM3.01._SCLZZZZZZZ_.jpg',
  },
  'weber-genesis-e-325s': {
    similarProducts: ['traeger-woodridge', 'camp-chef-woodwind-pro-24', 'weber-spirit-ii-e310-gas-grill'],
  },
};

let patched = 0;
for (const [slug, patch] of Object.entries(patches)) {
  const filePath = path.join(QUEUE, `${slug}.json`);
  if (!fs.existsSync(filePath)) {
    console.warn(`MISSING: ${slug}.json — skipping`);
    continue;
  }
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  const p = JSON.parse(raw);

  p.similarProducts = patch.similarProducts;
  if (patch.image) p.image = patch.image;
  if (patch.newCategoryPage) p.newCategoryPage = true;

  // Strip _imageNote and _priceNote fields so they don't leak into HTML
  delete p._imageNote;
  delete p._priceNote;
  delete p._asinNote;

  fs.writeFileSync(filePath, JSON.stringify(p, null, 2), 'utf8');
  console.log(`✓ Patched ${slug}`);
  patched++;
}
console.log(`\nDone. Patched ${patched}/${Object.keys(patches).length} files.`);
