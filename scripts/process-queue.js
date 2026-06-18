#!/usr/bin/env node
/**
 * process-queue.js
 * Reads all *.json product files from research-queue/ and runs add-product.js on each.
 * Usage: node scripts/process-queue.js [--dry-run]
 *
 * Skips products whose slug already appears in products.json (add-product.js
 * also guards this, but skipping early avoids noisy error output).
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT      = path.resolve(__dirname, '..');
const QUEUE_DIR = path.join(ROOT, 'research-queue');
const DRY_RUN   = process.argv.includes('--dry-run');

function getQueueFiles() {
  if (!fs.existsSync(QUEUE_DIR)) {
    console.error(`research-queue/ directory not found at: ${QUEUE_DIR}`);
    process.exit(1);
  }
  return fs.readdirSync(QUEUE_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => path.join(QUEUE_DIR, f));
}

function loadExistingSlugs() {
  const productsPath = path.join(ROOT, 'products.json');
  const products = JSON.parse(fs.readFileSync(productsPath, 'utf8').replace(/^﻿/, ''));
  return new Set(products.map(p => p.id));
}

function getSlug(jsonPath) {
  return path.basename(jsonPath, '.json');
}

function processProduct(jsonPath, existingSlugs) {
  const slug = getSlug(jsonPath);

  if (existingSlugs.has(slug)) {
    console.log(`  SKIP (already in products.json): ${slug}`);
    return { status: 'skipped', slug };
  }

  console.log(`  Processing: ${slug}`);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would run: node scripts/add-product.js "${jsonPath}"`);
    return { status: 'dry-run', slug };
  }

  try {
    execSync(`node scripts/add-product.js "${jsonPath}"`, {
      stdio: 'inherit',
      cwd: ROOT,
    });
    return { status: 'created', slug };
  } catch (err) {
    console.error(`  ERROR processing ${slug}: exit code ${err.status}`);
    return { status: 'error', slug, error: err.message };
  }
}

function main() {
  const files = getQueueFiles();
  const existingSlugs = loadExistingSlugs();

  console.log(`\nClearPick process-queue.js`);
  console.log(`Queue directory: ${QUEUE_DIR}`);
  console.log(`Found ${files.length} JSON file(s) in research-queue/`);
  if (DRY_RUN) console.log(`[DRY RUN MODE — no files will be written]\n`);
  else console.log('');

  const results = { created: [], skipped: [], dryRun: [], errors: [] };

  for (const f of files) {
    const result = processProduct(f, existingSlugs);
    if (result.status === 'created')  results.created.push(result.slug);
    if (result.status === 'skipped')  results.skipped.push(result.slug);
    if (result.status === 'dry-run')  results.dryRun.push(result.slug);
    if (result.status === 'error')    results.errors.push(result.slug);
  }

  console.log('\n--- Summary ---');
  if (DRY_RUN) {
    console.log(`Would create: ${results.dryRun.length}`);
    results.dryRun.forEach(s => console.log(`  → ${s}`));
    console.log(`Would skip (already exist): ${results.skipped.length}`);
    results.skipped.forEach(s => console.log(`  ⏭ ${s}`));
  } else {
    console.log(`Created: ${results.created.length}`);
    results.created.forEach(s => console.log(`  ✅ ${s}`));
    console.log(`Skipped (already existed): ${results.skipped.length}`);
    results.skipped.forEach(s => console.log(`  ⏭ ${s}`));
    console.log(`Errors: ${results.errors.length}`);
    results.errors.forEach(s => console.log(`  ❌ ${s}`));
  }

  if (results.errors.length > 0) process.exit(1);
}

main();
