'use strict';
const fs   = require('fs');
const path = require('path');

const GUIDES_DIR = path.join(__dirname, '..', 'guides');

const CHARTS_TAG = '<script src="../js/guide-charts.js"></script>';
const SUB_TAG    = '<script src="../js/guide-submission.js"></script>';
const NAV_SCRIPT = '<script src="../js/nav-inject.js"></script>';

let added = 0, skipped = 0;

for (const name of fs.readdirSync(GUIDES_DIR)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(GUIDES_DIR, name);
  let html = fs.readFileSync(file, 'utf8');

  const alreadyHas = html.includes('guide-charts.js') || html.includes('guide-submission.js');
  if (alreadyHas) { skipped++; continue; }

  if (!html.includes(NAV_SCRIPT)) {
    console.warn('[warn] nav-inject.js not found in', name, '— skipping');
    continue;
  }

  html = html.replace(NAV_SCRIPT, CHARTS_TAG + '\n  ' + SUB_TAG + '\n  ' + NAV_SCRIPT);
  fs.writeFileSync(file, html, 'utf8');
  added++;
}

console.log('inject-guide-viz: added to ' + added + ' guides, ' + skipped + ' already patched');
