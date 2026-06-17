'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Upgrade <span data-successor="slug">...</span> → <a href="/products/slug.html" data-successor="slug">...</a>
 * in every products/*.html file.
 *
 * Returns array of filenames (basename only) that were modified (or would be, in dry-run mode).
 */
function upgradeSuccessorLinks(slug, { dryRun = false, root } = {}) {
  if (!root) throw new Error('upgradeSuccessorLinks: root option is required');

  const productsDir = path.join(root, 'products');
  const files = fs.readdirSync(productsDir).filter(f => f.endsWith('.html'));

  // Escape special regex chars in slug (slugs are kebab-case, but be safe)
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Non-greedy match; [\s\S]*? handles inner HTML spanning lines
  const pattern = new RegExp(
    `<span\\b[^>]*\\bdata-successor="${escapedSlug}"[^>]*>([\\s\\S]*?)<\\/span>`,
    'g'
  );
  const replacement = `<a href="/products/${slug}.html" data-successor="${slug}">$1</a>`;

  const upgraded = [];

  for (const file of files) {
    const filePath = path.join(productsDir, file);
    const original = fs.readFileSync(filePath, 'utf8');
    if (!original.includes(`data-successor="${slug}"`)) continue;

    const updated = original.replace(pattern, replacement);
    if (updated !== original) {
      if (!dryRun) fs.writeFileSync(filePath, updated, 'utf8');
      upgraded.push(file);
    }
  }

  return upgraded;
}

module.exports = { upgradeSuccessorLinks };
