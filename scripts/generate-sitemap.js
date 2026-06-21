'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const BASE_URL = 'https://clearpick.ca';
const today    = new Date().toISOString().split('T')[0];

const urls = [];

const add = (loc, priority, changefreq) => urls.push({ loc, priority, changefreq });

// Homepage
add(`${BASE_URL}/`, '1.0', 'daily');

// Root static/category pages (exclude index.html, 404.html)
const EXCLUDE_ROOT = new Set(['index.html', '404.html']);
fs.readdirSync(ROOT)
  .filter(f => f.endsWith('.html') && !EXCLUDE_ROOT.has(f))
  .sort()
  .forEach(f => add(`${BASE_URL}/${f}`, '0.8', 'weekly'));

// Product pages
fs.readdirSync(path.join(ROOT, 'products'))
  .filter(f => f.endsWith('.html'))
  .sort()
  .forEach(f => add(`${BASE_URL}/products/${f}`, '0.7', 'monthly'));

// Blog posts
const blogDir = path.join(ROOT, 'blog');
if (fs.existsSync(blogDir)) {
  fs.readdirSync(blogDir)
    .filter(f => f.endsWith('.html'))
    .sort()
    .forEach(f => add(`${BASE_URL}/blog/${f}`, '0.6', 'monthly'));
}

// Compare pages
const compareDir = path.join(ROOT, 'compare');
if (fs.existsSync(compareDir)) {
  fs.readdirSync(compareDir)
    .filter(f => f.endsWith('.html'))
    .sort()
    .forEach(f => add(`${BASE_URL}/compare/${f}`, '0.6', 'monthly'));
}

// Guides
const guidesDir = path.join(ROOT, 'guides');
if (fs.existsSync(guidesDir)) {
  fs.readdirSync(guidesDir)
    .filter(f => f.endsWith('.html'))
    .sort()
    .forEach(f => add(`${BASE_URL}/guides/${f}`, '0.8', 'weekly'));
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u =>
  `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
).join('\n')}
</urlset>`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');

const rootCount    = urls.filter(u => !u.loc.includes('/products/') && !u.loc.includes('/blog/') && !u.loc.includes('/compare/')).length;
const productCount = urls.filter(u => u.loc.includes('/products/')).length;
const blogCount    = urls.filter(u => u.loc.includes('/blog/')).length;
const compareCount = urls.filter(u => u.loc.includes('/compare/')).length;

console.log(`Sitemap written: ${urls.length} URLs`);
console.log(`  ${rootCount} homepage + category/static pages`);
console.log(`  ${productCount} product pages`);
console.log(`  ${blogCount} blog posts`);
console.log(`  ${compareCount} compare pages`);
