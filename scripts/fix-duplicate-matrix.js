'use strict';
const fs   = require('fs');
const path = require('path');

const GUIDES_DIR = path.join(__dirname, '..', 'guides');
const files = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');

// Find the position just after the closing </div> of the outermost div
// that starts at `openTagStart` in `html`.
function findBlockEnd(html, openTagStart) {
  let depth = 0;
  let i = openTagStart;
  while (i < html.length) {
    const nextOpen  = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose < 0) break; // malformed
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      if (depth === 0) return nextClose + 6; // end of this </div>
      depth--;
      i = nextClose + 6;
    }
  }
  return -1;
}

const MATRIX_CLASS = 'class="best-for-matrix"';

let fixed = 0;
files.forEach(file => {
  const fp = path.join(GUIDES_DIR, file);
  let html = fs.readFileSync(fp, 'utf8');

  const count = (html.match(/class="best-for-matrix"/g) || []).length;
  if (count <= 1) return;

  // Remove all occurrences after the first
  let firstEnd = -1;
  let pos = 0;
  let kept = 0;

  // Find the first matrix block end so we can search after it
  const firstIdx = html.indexOf(MATRIX_CLASS);
  if (firstIdx < 0) return;
  // Walk back to the opening <div
  const openTag = html.lastIndexOf('<div', firstIdx);
  if (openTag < 0) return;
  firstEnd = findBlockEnd(html, openTag);
  if (firstEnd < 0) return;

  // Now remove all subsequent matrix blocks
  let result = html.slice(0, firstEnd);
  let remainder = html.slice(firstEnd);
  let removedCount = 0;

  while (true) {
    const nextIdx = remainder.indexOf(MATRIX_CLASS);
    if (nextIdx < 0) break;
    const nextOpen = remainder.lastIndexOf('<div', nextIdx);
    if (nextOpen < 0) break;
    const nextEnd = findBlockEnd(remainder, nextOpen);
    if (nextEnd < 0) break;
    result += remainder.slice(0, nextOpen);
    remainder = remainder.slice(nextEnd);
    removedCount++;
  }

  result += remainder;
  fs.writeFileSync(fp, result, 'utf8');
  console.log('[fixed] ' + file + ' (' + (count - 1) + ' extra matrix removed)');
  fixed++;
});

console.log('\nFixed ' + fixed + ' guides.');
