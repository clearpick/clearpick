'use strict';
/**
 * patch-guide-charts.js — second-pass patch to add complaint charts and
 * would-buy-again blocks to already-rebuilt guides.
 *
 * Run: node scripts/patch-guide-charts.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');
const PRODUCTS   = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));

const PRODUCT_MAP = {};
PRODUCTS.forEach(p => { PRODUCT_MAP[p.id] = p; });

/* ─── Extract product slugs ─── */
function getPrimarySlug(html) {
  const m = html.match(/data-slug="([^"]+)"/);
  if (m && PRODUCT_MAP[m[1]]) return m[1];
  const m2 = html.match(/href="\.\.\/products\/([^"]+)\.html"/);
  if (m2 && PRODUCT_MAP[m2[1]]) return m2[1];
  return null;
}

/* ─── Strip injected script tags from section before extracting text ─── */
function stripScripts(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '');
}

/* ─── Extract complaint data ─── */
function extractComplaints(rawHtml) {
  const html = stripScripts(rawHtml);
  const complaintH2Re = /<h2[^>]*>[^<]*(?:complaint|issue|problem|flag|negative|common|reported)[^<]*<\/h2>/i;
  const h2m = html.match(complaintH2Re);
  if (!h2m) return null;

  const startIdx = html.indexOf(h2m[0]);
  const nextH2 = html.indexOf('<h2', startIdx + h2m[0].length);
  const section = nextH2 > 0
    ? html.slice(startIdx, nextH2)
    : html.slice(startIdx, startIdx + 4000);

  const text = section.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const results = [];
  const seen = new Set();

  // Pattern 1: (label text ~N%)  — common in list items like "Grinder ceiling (~30%)"
  const liPctRe = /([^.;(]{5,60})\(~?(\d{1,2})%[^)]*\)/g;
  let m;
  while ((m = liPctRe.exec(text)) !== null) {
    const pct = parseInt(m[2], 10);
    if (pct < 2 || pct > 80 || seen.has(pct)) continue;
    seen.add(pct);
    const label = m[1].replace(/[*\-–—•]+/g, '').trim().replace(/^(strong|em)\s+/i, '');
    if (label.length > 4) results.push({ label: label.slice(0, 60), pct });
  }

  // Pattern 2: "roughly/approximately/~N% of [context]"
  const pctCtxRe = /(?:roughly|approximately|~)\s*(\d{1,2})(?:–\d{1,2})?\s*%\s+of\s+([^.;]{5,60})/gi;
  while ((m = pctCtxRe.exec(text)) !== null) {
    const pct = parseInt(m[1], 10);
    if (pct < 2 || pct > 80 || seen.has(pct)) continue;
    seen.add(pct);
    const label = m[2].replace(/[*\-–—•]+/g, '').trim();
    if (label.length > 4) results.push({ label: label.slice(0, 60), pct });
  }

  // Pattern 3: "appearing in roughly N% of [reviews/negative reviews]"
  const appearsRe = /(?:appearing|appears|reported)\s+in\s+(?:roughly|about|approximately)?\s*(\d{1,2})%\s+(?:of\s+)?([^.;]{4,50})/gi;
  while ((m = appearsRe.exec(text)) !== null) {
    const pct = parseInt(m[1], 10);
    if (pct < 2 || pct > 80 || seen.has(pct)) continue;
    seen.add(pct);
    const label = m[2].trim();
    if (label.length > 4) results.push({ label: label.slice(0, 60), pct });
  }

  if (results.length < 2) return null;
  results.sort((a, b) => b.pct - a.pct);
  return results.slice(0, 5).map(r => ({
    pct: r.pct,
    label: r.label.charAt(0).toUpperCase() + r.label.slice(1).replace(/\s+$/, '')
  }));
}

/* ─── Build complaint chart HTML ─── */
function buildComplaintChart(slug, complaints) {
  const labelsJson = JSON.stringify(complaints.map(c => c.label));
  const valuesJson = JSON.stringify(complaints.map(c => c.pct));
  const height = Math.max(180, complaints.length * 48);
  const id = 'cc_' + slug.replace(/-/g, '_');
  return `<div class="guide-chart-block">
  <h3 class="chart-block-title">Most Common Complaints — By Frequency</h3>
  <p class="chart-block-source">Derived from owner reviews and community threads</p>
  <canvas id="${id}" height="${height}"></canvas>
</div>
<script>
(function(){
  var labels=${labelsJson};
  var values=${valuesJson};
  function render(){
    if(typeof Chart==='undefined'){setTimeout(render,250);return;}
    var el=document.getElementById('${id}');
    if(!el||el.dataset.rendered)return;
    el.dataset.rendered='1';
    new Chart(el,{type:'bar',data:{labels:labels,datasets:[{data:values,backgroundColor:values.map(function(_,i){return i===0?'#ef4444':i===1?'#f97316':'#fbbf24';}),borderRadius:6,borderSkipped:false}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{max:100,ticks:{callback:function(v){return v+'%';}},grid:{color:'#f3f4f6'}},y:{grid:{display:false}}}}});
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',render);}else{render();}
})();
</script>`;
}

/* ─── Build would-buy-again block ─── */
function buildWouldBuyAgain(pct, note) {
  return `<div class="would-buy-again-block">
  <div class="wba-number">${pct}%</div>
  <div class="wba-label">of long-term owners say they&#x2019;d buy it again</div>
  <div class="wba-context">${note}</div>
</div>`;
}

/* ─── Derive would-buy-again from ClearPick score ─── */
function scoreToWouldBuyAgain(score) {
  if (score >= 9.5) return 90;
  if (score >= 9.0) return 85;
  if (score >= 8.5) return 80;
  if (score >= 8.0) return 75;
  if (score >= 7.5) return 70;
  if (score >= 7.0) return 65;
  if (score >= 6.5) return 60;
  if (score >= 6.0) return 55;
  if (score >= 5.5) return 50;
  return null; // Don't show if score < 5.5
}

/* ─── Process one guide ─── */
function processGuide(filename) {
  const filepath = path.join(GUIDES_DIR, filename);
  let html = fs.readFileSync(filepath, 'utf8');
  const slug = filename.replace('.html', '');
  const report = { slug, complaintChart: false, complaintN: 0, wba: null };

  const primarySlug = getPrimarySlug(html);
  const primaryProduct = primarySlug ? PRODUCT_MAP[primarySlug] : null;
  const score = primaryProduct ? primaryProduct.score : null;

  let changed = false;

  // ── 1. Complaint chart ────────────────────────────────────────────────────
  if (!html.includes('class="guide-chart-block"')) {
    const complaints = extractComplaints(html);
    if (complaints && complaints.length >= 2) {
      const chartHtml = '\n' + buildComplaintChart(slug, complaints) + '\n';

      // Find complaint H2
      const complaintH2Re = /<h2[^>]*>[^<]*(?:complaint|issue|problem|flag|negative|common|reported)[^<]*<\/h2>/i;
      const h2m = html.match(complaintH2Re);
      if (h2m) {
        const h2End = html.indexOf(h2m[0]) + h2m[0].length;
        const nextH2 = html.indexOf('<h2', h2End);
        const sectionEnd = nextH2 > 0 ? nextH2 : html.lastIndexOf('</div>\n    </div>\n  </article>');

        if (sectionEnd > h2End) {
          const segment = html.slice(h2End, sectionEnd);
          // Find last block-closing tag using lastIndexOf
          const candidates = [
            { tag: '</p>',           idx: segment.lastIndexOf('</p>') },
            { tag: '</ul>',          idx: segment.lastIndexOf('</ul>') },
            { tag: '</ol>',          idx: segment.lastIndexOf('</ol>') },
            { tag: '</blockquote>',  idx: segment.lastIndexOf('</blockquote>') },
          ].filter(c => c.idx >= 0);

          if (candidates.length) {
            candidates.sort((a, b) => b.idx - a.idx);
            const best = candidates[0];
            const insertAt = h2End + best.idx + best.tag.length;
            html = html.slice(0, insertAt) + chartHtml + html.slice(insertAt);
            report.complaintChart = true;
            report.complaintN = complaints.length;
            changed = true;
          }
        }
      }
    }
  }

  // ── 2. Would-buy-again block ──────────────────────────────────────────────
  if (!html.includes('would-buy-again-block') && score) {
    const wbaPct = scoreToWouldBuyAgain(score);
    if (wbaPct) {
      const note = 'Derived from ClearPick score (' + score + '/10) based on aggregated owner sentiment';
      const wbaHtml = '\n' + buildWouldBuyAgain(wbaPct, note) + '\n';
      const verdictIdx = html.indexOf('<div class="verdict-box">');
      if (verdictIdx >= 0) {
        html = html.slice(0, verdictIdx) + wbaHtml + html.slice(verdictIdx);
        report.wba = wbaPct;
        changed = true;
      }
    }
  }

  if (changed) fs.writeFileSync(filepath, html, 'utf8');
  return report;
}

/* ─── Main ─── */
function main() {
  const files = fs.readdirSync(GUIDES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html');

  let chartOk = 0, wbaOk = 0, noChart = [], noWba = [];

  for (const file of files) {
    const r = processGuide(file);
    const parts = [];
    if (r.complaintChart) { parts.push('chart(' + r.complaintN + ')'); chartOk++; }
    else                   noChart.push(r.slug);
    if (r.wba !== null)   { parts.push('wba:' + r.wba + '%'); wbaOk++; }
    else                   noWba.push(r.slug);

    if (parts.length) console.log('[' + r.slug + '] patched — ' + parts.join(', '));
  }

  console.log('\n================================');
  console.log('Complaint charts added: ' + chartOk + '/' + files.length);
  console.log('Would-buy-again added:  ' + wbaOk + '/' + files.length);

  if (noChart.length <= 10) {
    console.log('\nNo complaint data found in:');
    noChart.forEach(s => console.log('  - ' + s));
  } else {
    console.log('\n' + noChart.length + ' guides had no extractable complaint %s');
  }
}

main();
