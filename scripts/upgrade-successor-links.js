#!/usr/bin/env node
'use strict';

/**
 * Standalone utility: upgrade <span data-successor="slug"> placeholders to real <a> links.
 *
 * Usage:
 *   node scripts/upgrade-successor-links.js <slug> [--dry-run]
 *
 * --dry-run  Print what would be changed without writing any files.
 */

const path = require('path');
const { upgradeSuccessorLinks } = require('./lib/successor-sweep');

const rawArgs  = process.argv.slice(2);
const dryRun   = rawArgs.includes('--dry-run');
const slug     = rawArgs.filter(a => a !== '--dry-run')[0];

if (!slug) {
  console.error('Usage: node scripts/upgrade-successor-links.js <slug> [--dry-run]');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const upgraded = upgradeSuccessorLinks(slug, { dryRun, root: ROOT });

if (upgraded.length === 0) {
  console.log(`No placeholders found for "${slug}"`);
} else {
  const verb = dryRun ? '[DRY RUN] Would upgrade' : 'Upgraded';
  console.log(`${verb} ${upgraded.length} page(s):`);
  upgraded.forEach(f => console.log(`  · ${f}`));
}
