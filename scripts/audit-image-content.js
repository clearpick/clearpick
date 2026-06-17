#!/usr/bin/env node
'use strict';

/**
 * Silent-image audit: detect 1×1 placeholder images among products on the
 * deprecated images-na.ssl-images-amazon.com / _SCLZZZZZZZ_ URL format.
 *
 * HTTP HEAD is tried first; falls back to a partial GET if Content-Length
 * is absent. Images under THRESHOLD bytes are flagged as silently broken.
 *
 * Usage: node scripts/audit-image-content.js
 */

const fs    = require('fs');
const https = require('https');
const path  = require('path');

const ROOT     = path.resolve(__dirname, '..');
const products = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8').replace(/^﻿/, '')
);

const DEPRECATED = products.filter(p =>
  p.image && (
    p.image.includes('images-na.ssl-images-amazon.com') ||
    p.image.includes('_SCLZZZZZZZ_')
  )
);

const THRESHOLD = 1000; // bytes — 1×1 GIF/PNG placeholders are ~150–300B

function headRequest(url) {
  return new Promise(resolve => {
    try {
      const req = https.request(url, { method: 'HEAD', headers: { 'Referer': 'https://clearpick.ca/' } }, res => {
        const cl = parseInt(res.headers['content-length'] || '0', 10);
        const has = 'content-length' in res.headers;
        res.resume();
        resolve({ statusCode: res.statusCode, contentLength: cl, hasLength: has });
      });
      req.on('error', err =>
        resolve({ statusCode: 0, contentLength: 0, hasLength: false, error: err.message })
      );
      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ statusCode: 0, contentLength: 0, hasLength: false, error: 'timeout' });
      });
      req.end();
    } catch (e) {
      resolve({ statusCode: 0, contentLength: 0, hasLength: false, error: e.message });
    }
  });
}

function fetchSize(url) {
  return new Promise(resolve => {
    try {
      let size = 0;
      const req = https.request(url, { method: 'GET', headers: { 'Referer': 'https://clearpick.ca/' } }, res => {
        res.on('data', chunk => {
          size += chunk.length;
          if (size > THRESHOLD * 20) req.destroy(); // bail once clearly a real image
        });
        res.on('end',  () => resolve({ statusCode: res.statusCode, contentLength: size }));
        res.on('error', () => resolve({ statusCode: res.statusCode, contentLength: size }));
      });
      req.on('error', err =>
        resolve({ statusCode: 0, contentLength: 0, error: err.message })
      );
      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ statusCode: 0, contentLength: size, error: 'timeout' });
      });
      req.end();
    } catch (e) {
      resolve({ statusCode: 0, contentLength: 0, error: e.message });
    }
  });
}

async function checkImage(p) {
  let result = await headRequest(p.image);
  if (!result.hasLength || result.contentLength === 0) {
    result = await fetchSize(p.image);
  }
  const broken = result.statusCode === 200 &&
                 result.contentLength > 0 &&
                 result.contentLength < THRESHOLD;
  return {
    id:          p.id,
    name:        p.name,
    image:       p.image,
    statusCode:  result.statusCode,
    bytes:       result.contentLength,
    broken,
    error:       result.error || null,
  };
}

async function runAudit() {
  console.log(`Total products:              ${products.length}`);
  console.log(`On deprecated URL format:    ${DEPRECATED.length}`);
  console.log(`Broken threshold:            < ${THRESHOLD} bytes`);
  console.log(`Concurrency:                 5 at a time\n`);

  const BATCH    = 5;
  const results  = [];

  for (let i = 0; i < DEPRECATED.length; i += BATCH) {
    const batch        = DEPRECATED.slice(i, i + BATCH);
    const batchResults = await Promise.all(batch.map(checkImage));
    results.push(...batchResults);
    process.stdout.write(`  ${Math.min(i + BATCH, DEPRECATED.length)}/${DEPRECATED.length} checked...\r`);
  }
  process.stdout.write(`  ${DEPRECATED.length}/${DEPRECATED.length} checked.   \n`);

  const broken  = results.filter(r => r.broken);
  const errored = results.filter(r => r.error && !r.broken);
  const healthy = results.filter(r => !r.broken && !r.error);

  console.log('\n── SUMMARY ──────────────────────────────────────────────');
  console.log(`Deprecated-URL products:   ${DEPRECATED.length}`);
  console.log(`Silently broken (< ${THRESHOLD}B): ${broken.length}`);
  console.log(`Request errors / timeouts: ${errored.length}`);
  console.log(`Healthy (>= ${THRESHOLD}B):       ${healthy.length}`);

  if (broken.length > 0) {
    console.log('\n── BROKEN IMAGES ────────────────────────────────────────');
    broken.forEach(r => {
      const asinMatch = r.image.match(/\/P\/([A-Z0-9]{10})\./);
      const asin      = asinMatch ? asinMatch[1] : '???';
      console.log(`\n  ${r.id}`);
      console.log(`  ${r.name}`);
      console.log(`  Size: ${r.bytes}B  |  Status: ${r.statusCode}  |  ASIN: ${asin}`);
      console.log(`  Fix:  node scripts/migrate-image.js ${r.id} ${asin}`);
    });
  }

  if (errored.length > 0) {
    console.log('\n── ERRORS ───────────────────────────────────────────────');
    errored.forEach(r =>
      console.log(`  ${r.id} (${r.bytes}B, status ${r.statusCode}): ${r.error}`)
    );
  }

  if (broken.length === 0 && errored.length === 0) {
    console.log('\nAll deprecated-URL images appear to be serving real content.');
  }
}

runAudit().catch(err => { console.error(err); process.exit(1); });
