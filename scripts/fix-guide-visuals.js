'use strict';
/**
 * fix-guide-visuals.js — Six targeted fixes across all guide types
 *
 * Fix 2: Scatter chart — add dot labels via animation.onComplete
 * Fix 3: At a Glance — hide "—" stats when data is absent in .then() path
 * Fix 4a: Best For matrix — truncate use-case labels to 5 words
 * Fix 6: Would-buy-again — inject block into top5 + sentiment guides missing it
 *
 * Fixes 1, 4b, 5 are in guide-charts.js and creative-visuals.css respectively.
 */

const fs   = require('fs');
const path = require('path');

const ROOT     = path.join(__dirname, '..');
const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
const guides   = JSON.parse(fs.readFileSync(path.join(ROOT, 'guides.json'),   'utf8')).guides;

const byId = {};
products.forEach(p => { byId[p.id] = p; });

const stats = { f2: 0, f3: 0, f4a: 0, f6: 0, files: 0 };

/* ── Fix 4a helper: clean a matrix use-case label ─────────── */
function cleanMatrixLabel(text) {
  text = text.trim();
  // Strip leading sentence starters
  text = text.replace(/^(if\s+you'?r?e?\s+|you'?r?e?\s+|for\s+(?:people|users?|owners?)\s+who\s+)/i, '');
  // Take first 5 words
  const words = text.split(/\s+/).slice(0, 5);
  let result = words.join(' ').replace(/[.,;:]+$/, '');
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/* ── Fix 6 helper: build WBA HTML ─────────────────────────── */
function buildWba(pct, score) {
  const scoreDisplay = Number.isInteger(score) ? score : score.toFixed(1);
  return [
    '',
    '<div class="would-buy-again-block">',
    '  <div class="wba-number">' + pct + '%</div>',
    '  <div class="wba-label">of long-term owners say they&#x2019;d buy it again</div>',
    '  <div class="wba-context">Derived from ClearPick score (' + scoreDisplay + '/10) based on aggregated owner sentiment</div>',
    '</div>',
    '',
  ].join('\n');
}

/* ── Fix 2: scatter afterDraw replacement strings ─────────── */
const SCATTER_FIND = 'new Chart(el,{type:\'scatter\',data:{datasets:[{data:pts.map(function(p){return{x:p.x,y:p.y};}),backgroundColor:pts.map(function(_,i){return[\'#1a8cff\',\'#f97316\',\'#8b5cf6\',\'#10b981\',\'#ef4444\'][i%5];}),pointRadius:8,pointHoverRadius:11}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){var p=pts[c.dataIndex];return p.label+\': $\'+p.x+\' · \'+p.y+\'/10\';}}}}';
const SCATTER_REPLACE = 'new Chart(el,{type:\'scatter\',data:{datasets:[{data:pts.map(function(p){return{x:p.x,y:p.y};}),backgroundColor:pts.map(function(_,i){return[\'#1a8cff\',\'#f97316\',\'#8b5cf6\',\'#10b981\',\'#ef4444\'][i%5];}),pointRadius:10,pointHoverRadius:12}]},options:{animation:{onComplete:function(){var ctx=this.ctx,meta=this.getDatasetMeta(0);ctx.save();ctx.font=\'600 11px Inter,system-ui,sans-serif\';ctx.textAlign=\'center\';pts.forEach(function(p,i){if(!meta.data[i])return;var pos=meta.data[i].getProps([\'x\',\'y\'],true);ctx.fillStyle=\'rgba(0,0,0,0.75)\';ctx.fillText(p.label.split(\' \').slice(0,2).join(\' \'),pos.x,pos.y-14);});ctx.restore();}},plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){var p=pts[c.dataIndex];return p.label+\': $\'+p.x+\' · \'+p.y+\'/10\';}}}}';

/* ── Fix 3: glance cleanup snippet (goes before }).catch) ── */
// Uses '—' (em dash) for safe comparison with the — in glance-number spans
const GLANCE_CLEANUP = "    (function(){var g=document.getElementById('guide-glance-'+slug);if(!g)return;g.querySelectorAll('.glance-stat').forEach(function(el){var n=el.querySelector('.glance-number');if(n&&n.textContent==='\\u2014')el.style.display='none';});var vs=[].slice.call(g.querySelectorAll('.glance-stat')).filter(function(el){return el.style.display!=='none';});g.querySelectorAll('.glance-divider').forEach(function(dv,i){if(i>=Math.max(0,vs.length-1))dv.style.display='none';});})();";

const GLANCE_ANCHOR = "if(d.ownerReport&&d.ownerReport.wouldBuyAgainPct) document.getElementById('glanceBuyAgain').textContent=d.ownerReport.wouldBuyAgainPct+'%';";
// Regex handles both LF and CRLF line endings
const GLANCE_CATCH_RE = /(\r?\n  }\)\.catch\()/;

/* ── Process each guide ────────────────────────────────────── */
guides.forEach(g => {
  const file = path.join(ROOT, 'guides', g.slug + '.html');
  let html = fs.readFileSync(file, 'utf8');
  let changed = false;

  /* Fix 3 — hide "—" stats when .then() fires with no data ── */
  if (html.includes(GLANCE_ANCHOR) && !html.includes('guide-glance-cleanup')) {
    const anchorIdx = html.indexOf(GLANCE_ANCHOR);
    if (anchorIdx >= 0) {
      const afterAnchor = html.slice(anchorIdx + GLANCE_ANCHOR.length);
      const catchMatch = afterAnchor.match(GLANCE_CATCH_RE);
      if (catchMatch) {
        const eol = catchMatch[1].startsWith('\r') ? '\r\n' : '\n';
        const insertion = eol + GLANCE_CLEANUP + ' // guide-glance-cleanup';
        const insertAt = anchorIdx + GLANCE_ANCHOR.length + afterAnchor.indexOf(catchMatch[1]);
        html = html.slice(0, insertAt) + insertion + html.slice(insertAt);
        stats.f3++;
        changed = true;
      }
    }
  }

  /* Fix 2 — scatter dot labels (comparison only) ─────────── */
  if (g.type === 'comparison' && html.includes(SCATTER_FIND)) {
    html = html.replace(SCATTER_FIND, SCATTER_REPLACE);
    stats.f2++;
    changed = true;
  }

  /* Fix 4a — truncate matrix use-case labels (comparison only) */
  if (g.type === 'comparison' && html.includes('bfm-table')) {
    const updated = html.replace(
      /<tr><td>([^<]{12,})<\/td>(<td class="cell-(?:win|weak|close)")/g,
      function(_, label, rest) {
        const clean = cleanMatrixLabel(label);
        if (clean === label) return _;
        stats.f4a++;
        return '<tr><td>' + clean + '</td>' + rest;
      }
    );
    if (updated !== html) { html = updated; changed = true; }
  }

  /* Fix 6 — add would-buy-again to top5 / sentiment missing it */
  if ((g.type === 'top5' || g.type === 'sentiment') && !html.includes('would-buy-again-block')) {
    // Get main product slug and score
    const slugMatch = html.match(/data-slug="([^"]+)"/);
    const productSlug = slugMatch ? slugMatch[1] : null;
    const product = productSlug ? byId[productSlug] : null;

    if (product && product.score) {
      const pct  = Math.round(product.score * 10);
      const wba  = buildWba(pct, product.score);
      const anchor = g.type === 'top5'
        ? '<div class="price-spectrum-block">'
        : '<div class="ownership-timeline">';

      if (html.includes(anchor)) {
        html = html.replace(anchor, wba + anchor);
        stats.f6++;
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, html, 'utf8');
    stats.files++;
  }
});

console.log('Fix 2 (scatter labels):  ' + stats.f2  + ' guides updated');
console.log('Fix 3 (glance cleanup):  ' + stats.f3  + ' guides updated');
console.log('Fix 4a (matrix labels):  ' + stats.f4a + ' cells truncated');
console.log('Fix 6 (WBA added):       ' + stats.f6  + ' guides updated');
console.log('Total files written:     ' + stats.files);
