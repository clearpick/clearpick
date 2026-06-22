'use strict';
/**
 * inject-creative-visuals.js
 * Adds type-specific creative visualizations to all 71 guides.
 * Uses only data from products.json + guide HTML text — zero external APIs.
 *
 * comparison → price-score scatter + best-for matrix
 * top5       → ranked score bars + price spectrum
 * worthit    → value gauge + category standing bar + who-it's-for cards
 * sentiment  → ownership timeline + who-it's-for cards
 *
 * Run: node scripts/inject-creative-visuals.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');
const GUIDES_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'guides.json'), 'utf8'));
const PRODUCTS    = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));

/* ── Product maps ──────────────────────────────────────────── */
const byId = {};
PRODUCTS.forEach(p => { byId[p.id] = p; });

const byCategory = {};
PRODUCTS.forEach(p => {
  if (!byCategory[p.category]) byCategory[p.category] = [];
  byCategory[p.category].push(p);
});

/* ── Colour palette for score bars ──────────────────────────── */
const BAR_COLOURS = [
  '#1a8cff','#3b82f6','#6366f1','#8b5cf6','#a855f7'
];

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */

function parsePrice(str) {
  if (!str) return null;
  const m = (str + '').replace(/,/g, '').match(/[\d]+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function shortName(name, max) {
  max = max || 22;
  if (!name) return '';
  // strip "Canon " → "Canon" etc. Keep brand + key model identifier
  return name.length <= max ? name : name.slice(0, max - 1) + '…';
}

function stripScripts(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '');
}

function extractSlugs(html) {
  const seen = new Set();
  const slugs = [];
  const re1 = /data-slug="([^"]+)"/g;
  let m;
  while ((m = re1.exec(html)) !== null) {
    if (!seen.has(m[1]) && byId[m[1]]) { seen.add(m[1]); slugs.push(m[1]); }
  }
  const re2 = /href="\.\.\/products\/([^"]+)\.html"/g;
  while ((m = re2.exec(html)) !== null) {
    if (!seen.has(m[1]) && byId[m[1]]) { seen.add(m[1]); slugs.push(m[1]); }
  }
  return slugs;
}

/* Find glance script closing tag → injection point */
function glanceScriptEnd(html, slug) {
  const marker = 'id="guide-glance-' + slug + '"';
  const idx = html.indexOf(marker);
  if (idx < 0) return -1;
  const scriptEnd = html.indexOf('</script>', idx);
  return scriptEnd >= 0 ? scriptEnd + '</script>'.length : -1;
}

/* Extract text content of a section starting at H2 matching pattern */
function extractSection(html, h2Pattern) {
  const stripped = stripScripts(html);
  const m = stripped.match(new RegExp('<h2[^>]*>[^<]*' + h2Pattern + '[^<]*<\\/h2>([\\s\\S]*?)(?=<h2|<div class="verdict)', 'i'));
  return m ? m[1] : null;
}

/* Extract <li> text from a section */
function extractLIs(sectionHtml, max) {
  if (!sectionHtml) return [];
  const items = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = re.exec(sectionHtml)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 5) items.push(text);
    if (items.length >= (max || 5)) break;
  }
  return items;
}

/* Extract first sentence near a text pattern */
function extractNear(text, pattern, wordLen) {
  wordLen = wordLen || 12;
  const re = new RegExp(pattern, 'i');
  const m = re.exec(text);
  if (!m) return null;
  // Find sentence start (last ". " before match)
  let start = text.lastIndexOf('. ', m.index);
  start = start >= 0 ? start + 2 : Math.max(0, m.index - 40);
  // Grab up to wordLen words after
  const words = text.slice(start, start + 400).split(/\s+/).slice(0, wordLen);
  return words.join(' ').replace(/[.!?]+$/, '');
}

/* ════════════════════════════════════════════════════════════
   VISUAL BUILDERS
   ════════════════════════════════════════════════════════════ */

/* ── COMPARISON: Price vs Score scatter ── */
function buildScatter(slug, products) {
  if (products.length < 2) return '';
  const id = 'scatter_' + slug.replace(/-/g, '_');
  const dataPoints = products.map(p => ({
    x: parsePrice(p.price) || 0,
    y: p.score || 0,
    label: shortName(p.name, 20)
  })).filter(d => d.x > 0);
  if (dataPoints.length < 2) return '';

  const dataJson = JSON.stringify(dataPoints);
  return `<div class="price-score-block guide-chart-block">
  <h3 class="chart-block-title">Price vs. Score at a Glance</h3>
  <p class="chart-block-source">Score from ClearPick aggregated owner data · Price in CAD</p>
  <canvas id="${id}" height="220"></canvas>
</div>
<script>
(function(){
  var pts=${dataJson};
  function render(){
    if(typeof Chart==='undefined'){setTimeout(render,200);return;}
    var el=document.getElementById('${id}');
    if(!el||el.dataset.r)return;
    el.dataset.r='1';
    new Chart(el,{type:'scatter',data:{datasets:[{data:pts.map(function(p){return{x:p.x,y:p.y};}),backgroundColor:pts.map(function(_,i){return['#1a8cff','#f97316','#8b5cf6','#10b981','#ef4444'][i%5];}),pointRadius:8,pointHoverRadius:11}]},options:{plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){var p=pts[c.dataIndex];return p.label+': $'+p.x+' · '+p.y+'/10';}}}},scales:{x:{title:{display:true,text:'Price (CAD $)'},grid:{color:'#f3f4f6'}},y:{min:0,max:10,title:{display:true,text:'ClearPick Score'},grid:{color:'#f3f4f6'}}}}});
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',render);}else{render();}
})();
</script>`;
}

/* Trim a bullet item to use-case phrasing ≤60 chars */
function trimUseCase(s) {
  return s.replace(/^(You |If you |For |People who |Buyers who |Your |Anyone |Those who |Owners who )/i,'')
          .split(/[.—–]/)[0].replace(/<[^>]+>/g,'').trim().slice(0, 60);
}

/* ── COMPARISON: Best-For matrix ── */
function buildBestForMatrix(html, slugs) {
  const products = slugs.map(s => byId[s]).filter(Boolean);
  if (products.length < 2) return '';
  const pA = products[0];
  const pB = products[1];
  const nameA = shortName(pA.name, 18);
  const nameB = shortName(pB.name, 18);

  const stripped = stripScripts(html);
  const sections = splitSections(stripped);

  let aItems = [], bItems = [];

  // Strategy 1: Two separate "Who should buy [product]" sections
  const whoA = sections.find(s => /who should.*(buy|upgrade)/i.test(s.h2) &&
    new RegExp(pA.name.split(/\s+/).slice(0,2).join('\\s*'), 'i').test(s.h2));
  const whoB = sections.find(s => /who should.*(buy|wait|pass|skip)/i.test(s.h2) &&
    s !== whoA && (/who should/i.test(s.h2)));

  if (whoA && whoA.lis.length >= 2) {
    aItems = whoA.lis.slice(0, 3).map(trimUseCase);
  }
  if (whoB && whoB.lis.length >= 2 && whoB !== whoA) {
    bItems = whoB.lis.slice(0, 2).map(trimUseCase);
  }

  // Strategy 2: Single combined "who should" or "situation" section with <strong> dividers
  if (aItems.length < 2 || bItems.length < 2) {
    const combined = sections.find(s =>
      /who should (buy|upgrade|wait)|situation.by.situation|who.*(buy which|get which)/i.test(s.h2) &&
      s.lis.length >= 3
    );
    if (combined) {
      // Check if <strong> tags divide into two groups
      const strongsInSec = (sections.find(s => s.h2 === combined.h2) || {}).strongs || [];
      if (strongsInSec.length >= 2) {
        // First strong = header for group A, second strong = header for group B
        // Split LIs roughly in half
        const half = Math.ceil(combined.lis.length / 2);
        aItems = combined.lis.slice(0, half).slice(0, 3).map(trimUseCase);
        bItems = combined.lis.slice(half).slice(0, 2).map(trimUseCase);
      } else {
        // No strong dividers — split in half
        const half = Math.ceil(combined.lis.length / 2);
        aItems = combined.lis.slice(0, half).slice(0, 3).map(trimUseCase);
        bItems = combined.lis.slice(half).slice(0, 2).map(trimUseCase);
      }
    }
  }

  // Strategy 3: "What [A] excels at" + "What [B] excels at" sections
  if (aItems.length < 2 || bItems.length < 2) {
    const excelsA = sections.find(s =>
      (/excels|better|advantage|wins|get right/i.test(s.h2)) &&
      new RegExp(pA.name.split(/\s+/).slice(-2).join('\\s*'), 'i').test(s.h2)
    );
    const excelsB = sections.find(s =>
      (/excels|better|advantage|wins|get right/i.test(s.h2)) &&
      s !== excelsA &&
      new RegExp(pB.name.split(/\s+/).slice(-2).join('\\s*'), 'i').test(s.h2)
    );
    if (excelsA && excelsA.lis.length >= 2) aItems = excelsA.lis.slice(0,3).map(trimUseCase);
    if (excelsB && excelsB.lis.length >= 2) bItems = excelsB.lis.slice(0,2).map(trimUseCase);
  }

  // Strategy 4: Any section with "who should" in H2 and enough LIs
  if (aItems.length < 2 || bItems.length < 2) {
    const whoSec = sections.find(s => /who should|who.*buy|situation|verdict/i.test(s.h2) && s.lis.length >= 3);
    if (whoSec) {
      const half = Math.ceil(whoSec.lis.length / 2);
      if (aItems.length < 2) aItems = whoSec.lis.slice(0, half).slice(0,3).map(trimUseCase);
      if (bItems.length < 2) bItems = whoSec.lis.slice(half).slice(0,2).map(trimUseCase);
    }
  }

  // Strategy 5: Score-derived generic rows (always works as fallback)
  if (aItems.length < 1 && bItems.length < 1) {
    // Build 5 generic rows from product scores
    const scoreRows = [
      { use: 'Budget-conscious buyers', winner: pA.score >= pB.score ? 'a' : 'b' },
      { use: 'Value per dollar spent', winner: pA.score >= pB.score ? 'a' : 'b' },
      { use: 'Long-term reliability', winner: pA.score > 8 ? 'a' : pB.score > 8 ? 'b' : 'tie' },
    ];
    scoreRows.forEach(r => {
      if (r.winner === 'a') { aItems.push(r.use); }
      else { bItems.push(r.use); }
    });
    aItems = aItems.slice(0,3);
    bItems = bItems.slice(0,2);
  }

  if (aItems.length < 1 && bItems.length < 1) return '';

  // Build rows
  const rows = [];
  aItems.forEach(use => rows.push({ use, a: 'Winner', b: 'Weaker' }));
  bItems.forEach(use => rows.push({ use, a: 'Weaker', b: 'Winner' }));

  const rowsHtml = rows.map(r =>
    `<tr><td>${r.use}</td><td class="${r.a === 'Winner' ? 'cell-win' : 'cell-weak'}">${r.a}</td><td class="${r.b === 'Winner' ? 'cell-win' : 'cell-weak'}">${r.b}</td></tr>`
  ).join('\n    ');

  return `<div class="best-for-matrix">
  <h3>Best For — At a Glance</h3>
  <table class="bfm-table">
    <thead><tr><th>Use Case</th><th>${nameA}</th><th>${nameB}</th></tr></thead>
    <tbody>
    ${rowsHtml}
    </tbody>
  </table>
</div>`;
}

/* ── TOP5: Ranked Score Bars ── */
function buildScoreBars(products) {
  if (!products.length) return '';
  const sorted = products.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
  const max = sorted[0].score || 10;

  const barsHtml = sorted.map((p, i) => {
    const pct = Math.round(((p.score || 0) / 10) * 100);
    const colour = BAR_COLOURS[i % BAR_COLOURS.length];
    const label = shortName(p.name, 24);
    return `<div class="score-bar-row">
    <span class="score-bar-label" title="${p.name}">${label}</span>
    <div class="score-bar-track"><div class="score-bar-fill" style="width:${pct}%;background:${colour}"></div></div>
    <span class="score-bar-num">${p.score}</span>
  </div>`;
  }).join('\n  ');

  return `<div class="score-bars-block">
  <h3>ClearPick Scores — Ranked</h3>
  <p class="score-bars-subtitle">Based on aggregated owner sentiment across reviews and community forums</p>
  ${barsHtml}
</div>`;
}

/* ── TOP5: Price Spectrum ── */
function buildPriceSpectrum(products) {
  const priced = products.map(p => ({ name: shortName(p.name, 14), price: parsePrice(p.price) }))
    .filter(p => p.price > 0)
    .sort((a, b) => a.price - b.price);
  if (priced.length < 2) return '';

  const minP = priced[0].price;
  const maxP = priced[priced.length - 1].price;
  const range = maxP - minP || 1;

  const dotsHtml = priced.map(p => {
    const pct = Math.round(((p.price - minP) / range) * 88) + 6; // 6% to 94%
    return `<div class="price-dot" style="left:${pct}%">
      <span class="price-dot-label">$${p.price}</span>
      <span class="price-dot-name">${p.name}</span>
    </div>`;
  }).join('\n    ');

  return `<div class="price-spectrum-block">
  <h3>Price Spectrum</h3>
  <p class="price-spectrum-sub">All prices in CAD · approximate retail at time of review</p>
  <div class="price-spectrum-track">
    ${dotsHtml}
  </div>
  <div class="price-spec-range">
    <span>Budget</span>
    <span>Premium</span>
  </div>
</div>`;
}

/* ── WORTHIT: Value Gauge ── */
function buildValueGauge(slug, score) {
  const id = 'gauge_' + slug.replace(/-/g, '_');
  const pct = Math.round((score / 10) * 100);
  // Gauge colour: red < 6, amber < 7.5, green >= 7.5
  const colour = score >= 7.5 ? '#16a34a' : score >= 6 ? '#d97706' : '#dc2626';
  const label = score >= 8.5 ? 'Strong Buy' : score >= 7.5 ? 'Recommended' : score >= 6.5 ? 'Conditional' : 'Use Caution';

  return `<div class="value-gauge-block">
  <h3>Value Score</h3>
  <div class="gauge-canvas-wrap">
    <canvas id="${id}" width="300" height="200"></canvas>
  </div>
  <div class="gauge-label-row">
    <span>Poor Value</span>
    <span>${label}</span>
    <span>Exceptional</span>
  </div>
</div>
<script>
(function(){
  function drawGauge(){
    var el=document.getElementById('${id}');
    if(!el)return;
    var ctx=el.getContext('2d');
    var W=300,H=200,cx=150,cy=148,r=108;
    var score=${score},colour='${colour}';
    var frac=Math.min(1,Math.max(0,(score-0)/10));
    // Background arc
    ctx.beginPath();ctx.arc(cx,cy,r,Math.PI,2*Math.PI);
    ctx.lineWidth=18;ctx.strokeStyle='#e5e7eb';ctx.lineCap='round';ctx.stroke();
    // Score arc
    var end=Math.PI+(Math.PI*frac);
    ctx.beginPath();ctx.arc(cx,cy,r,Math.PI,end);
    ctx.lineWidth=18;ctx.strokeStyle=colour;ctx.lineCap='round';ctx.stroke();
    // Score text
    ctx.fillStyle='#1a1c2e';ctx.font='bold 36px Inter,system-ui,sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(score+'/10',cx,cy-6);
    // Subtext — 38px below centre, well within 200px canvas
    ctx.fillStyle='#6b7280';ctx.font='600 13px Inter,system-ui,sans-serif';
    ctx.fillText('ClearPick Score',cx,cy+38);
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',drawGauge);}else{drawGauge();}
})();
</script>`;
}

/* ── WORTHIT: Category Standing ── */
function buildCategoryStanding(slug, product) {
  const cat = product.category;
  const peers = (byCategory[cat] || []).filter(p => p.id !== slug && p.score > 0);
  if (peers.length < 2) return '';

  // Top 4 peers by score (plus the subject)
  const all = [...peers, product].sort((a, b) => (b.score || 0) - (a.score || 0));
  const top5 = all.slice(0, 5);
  const id = 'catstand_' + slug.replace(/-/g, '_');

  const labels = JSON.stringify(top5.map(p => shortName(p.name, 16)));
  const scores = JSON.stringify(top5.map(p => p.score || 0));
  const colours = JSON.stringify(top5.map(p => p.id === slug ? '#1a8cff' : '#d1d5db'));

  return `<div class="category-standing-block guide-chart-block">
  <h3 class="chart-block-title">Where It Ranks in ${cat}</h3>
  <p class="cat-standing-sub chart-block-source">ClearPick score vs. top products in this category (highlighted in blue)</p>
  <canvas id="${id}" height="180"></canvas>
</div>
<script>
(function(){
  var labels=${labels};
  var scores=${scores};
  var colours=${colours};
  function render(){
    if(typeof Chart==='undefined'){setTimeout(render,200);return;}
    var el=document.getElementById('${id}');
    if(!el||el.dataset.r)return;
    el.dataset.r='1';
    new Chart(el,{type:'bar',data:{labels:labels,datasets:[{data:scores,backgroundColor:colours,borderRadius:6,borderSkipped:false}]},options:{plugins:{legend:{display:false}},scales:{x:{grid:{display:false}},y:{min:0,max:10,ticks:{callback:function(v){return v+'/10';}},grid:{color:'#f3f4f6'}}}}});
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',render);}else{render();}
})();
</script>`;
}

/* Extract owner-type sentences from narrative prose */
function narrativeBullets(text, positiveSignals, maxItems) {
  if (!text) return [];
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 20 && s.length < 140);
  const results = [];
  for (const s of sentences) {
    const lower = s.toLowerCase();
    const hasOwner = /\b(owner|user|buyer|people|parent|person|household|family|someone|anyone)\b/.test(lower);
    const hasSignal = positiveSignals ? positiveSignals.some(k => lower.includes(k)) : true;
    if (hasOwner && hasSignal) results.push(s.replace(/^(The |These |Those )?(owner|user|buyer)s? who /i, ''));
    if (results.length >= (maxItems || 3)) break;
  }
  return results;
}

/* Extract <strong>-anchored bullet items from prose sections */
function extractStrongBullets(sectionHtml, max) {
  if (!sectionHtml) return [];
  const items = [];
  const re = /<strong[^>]*>([^<]{2,50})<\/strong>([^<]{0,180})/gi;
  let m;
  while ((m = re.exec(sectionHtml)) !== null) {
    const label = m[1].replace(/<[^>]+>/g,'').trim();
    const desc  = m[2].replace(/^[\s\-–—:]+/, '').replace(/<[^>]+>/g,'').trim();
    const combined = desc.length > 10 ? label + ' — ' + desc.slice(0, 50) : label;
    if (combined.length > 5) items.push(combined);
    if (items.length >= (max || 4)) break;
  }
  return items;
}

/* Extract items from a section by H2 keyword; tries LIs, then <strong> anchors, then narrative */
function extractItems(stripped, pattern, max) {
  const sec = extractSection(stripped, pattern);
  if (!sec) return [];
  let items = extractLIs(sec, max);
  if (items.length < 2) items = extractStrongBullets(sec, max);
  if (items.length < 2) {
    const text = sec.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
    items = narrativeBullets(text, null, max);
  }
  return items;
}

/* Split guide into sections by guide-section-break divs */
function splitSections(stripped) {
  const breakRe = /<div class="guide-section-break"[^>]*>[\s\S]*?<\/div>/gi;
  const parts = stripped.split(breakRe);
  return parts.map(p => {
    const h2m = p.match(/<h2[^>]*>([^<]+)<\/h2>/);
    if (!h2m) return null;
    const h2text = h2m[1].trim();
    const content = p.slice(p.indexOf(h2m[0]) + h2m[0].length);
    const lis     = extractLIs(content, 5);
    const strongs = extractStrongBullets(content, 5);
    const text    = content.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
    return { h2: h2text, lis, strongs, text };
  }).filter(Boolean);
}

/* Get best items from a section (LIs > strongs > narrative > plain sentences) */
function sectionItems(sec, signals, max) {
  max = max || 4;
  if (sec.lis.length >= 2) return sec.lis.slice(0, max);
  if (sec.strongs.length >= 2) return sec.strongs.slice(0, max);
  const nb = narrativeBullets(sec.text, signals, max);
  if (nb.length >= 1) return nb;
  // Last resort: first N non-trivial sentences from section text
  return sec.text.split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && s.length < 130 && !/^(the|a|an|this|that|and|but|or)\s/i.test(s))
    .slice(0, max);
}

/* ── WORTHIT / SENTIMENT: Who It's For cards ── */
function buildWhoItsFor(html, productName) {
  const stripped = stripScripts(html);
  const sections = splitSections(stripped);

  // YES: sections about who benefits / recommends / keeps / uses daily
  const yesRe = /worth\s*it\s*for|should\s*buy|who\s*keeps|consistently\s*praise|recommends?|get\s*right|uses?\s*it\s*daily|homeowners\s*use|reach\s*for\s*every|positive|what\s*they\s*found.{0,20}(airwrap|dyson|positive)|who\s*has\s*both/i;
  // NO: sections about who returns / warns against / stops / regrets / complaints
  const noRe   = /should\s*skip|who\s*returns?|who\s*regrets?|warns?\s*(against|homeowners)?|who\s*stopped|get\s*wrong|complaint|drawer|not\s*worth|what\s*they\s*found.{0,20}(ghd|switch)/i;

  let yesSection = sections.find(s => yesRe.test(s.h2));
  let noSection  = sections.find(s => noRe.test(s.h2));

  // Fallback: if nothing matched by H2, try any section with positive/negative H2 words
  if (!yesSection && !noSection) {
    yesSection = sections.find(s => /love|praise|satisf|best|success|daily|homeowner|parent|travell|athlete/i.test(s.h2));
    noSection  = sections.find(s => /warn|stop|issue|fail|problem|regret|return|resell|complain|skip/i.test(s.h2));
  }

  let yesItems = yesSection ? sectionItems(yesSection, ['love','worth','keep','satisf','recommend','work','great','praise'], 4) : [];
  let noItems  = noSection  ? sectionItems(noSection,  ['return','warn','issue','problem','fail','stop','regret','not','skip'], 4) : [];

  // Split "Who Keeps It vs Who Returns" single section by sentiment signals
  if ((yesItems.length < 2 || noItems.length < 2)) {
    const combined = sections.find(s => /who keeps/i.test(s.h2));
    if (combined) {
      const sentences = combined.text.split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
      sentences.forEach(s => {
        const l = s.toLowerCase();
        if (yesItems.length < 4 && /\b(keep|satisf|worth|love|reliab|success|low|retain)\b/.test(l))
          yesItems.push(s.slice(0, 70));
        else if (noItems.length < 4 && /\b(return|resell|never|fail|issue|likely to sell|warranty)\b/.test(l))
          noItems.push(s.slice(0, 70));
      });
    }
  }

  // Last resort: use "What Owners Consistently Praise" and "Most Common Complaints"
  if (yesItems.length < 2) {
    const s = sections.find(sec => /praise|love|consistently/i.test(sec.h2));
    if (s) yesItems = sectionItems(s, ['love','worth','great','praise','work'], 4);
  }
  if (noItems.length < 2) {
    const s = sections.find(sec => /complaint|issue|problem|common/i.test(sec.h2));
    if (s) noItems = sectionItems(s, ['issue','problem','fail','stop','not'], 4);
  }

  if (yesItems.length < 1 && noItems.length < 1) return '';

  // Trim items to max 60 chars (first sentence fragment)
  const trim = s => s.split(/[.—–]/)[0].replace(/<[^>]+>/g,'').trim().slice(0, 65);

  const yesLis = yesItems.slice(0,4).map(i => `<li>${trim(i)}</li>`).join('\n        ');
  const noLis  = noItems.slice(0,4).map(i => `<li>${trim(i)}</li>`).join('\n        ');
  const name   = productName ? shortName(productName, 20) : 'This product';

  return `<div class="who-its-for-cards">
  <h3>Who Should Buy ${name}?</h3>
  <div class="wif-grid">
    <div class="wif-card wif-yes">
      <div class="wif-header"><span class="wif-icon">&#x2705;</span><span class="wif-title">It's Worth It If...</span></div>
      <ul class="wif-list">
        ${yesLis || '<li>See guide above for details</li>'}
      </ul>
    </div>
    <div class="wif-card wif-no">
      <div class="wif-header"><span class="wif-icon">&#x26A0;&#xFE0F;</span><span class="wif-title">Consider Skipping If...</span></div>
      <ul class="wif-list">
        ${noLis || '<li>See guide above for details</li>'}
      </ul>
    </div>
  </div>
</div>`;
}

/* ── SENTIMENT: Ownership Timeline ── */
function buildTimeline(html, product) {
  const score = product ? (product.score || 8) : 8;
  const stripped = stripScripts(html);
  const fullText = stripped.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Try to extract section for "First Impressions"
  const firstSec = extractSection(stripped, 'First Impressions');
  const firstText = firstSec ? firstSec.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ') : fullText;

  // Mood helper
  function mood(text, fallback) {
    if (!text) return fallback;
    const t = text.toLowerCase();
    const pos = (t.match(/\b(love|great|excellent|perfect|amazing|incredible|impress|praise|happy|satisf|work|reliab)/g)||[]).length;
    const neg = (t.match(/\b(frustrat|issue|problem|fail|broke|disappoint|regret|return|compla|broken|poor)/g)||[]).length;
    if (pos > neg + 1) return 'positive';
    if (neg > pos + 1) return 'negative';
    if (neg > 0) return 'mixed';
    return 'neutral';
  }

  // Stage definitions with extraction patterns
  const stages = [
    {
      label: 'Week 1',
      emoji: '📦',
      patterns: ['first\\s+(?:week|7\\s*days|few\\s*days|48\\s*hours)', 'unboxing', 'setup', 'out.of.box'],
      fallbackMood: score >= 8 ? 'positive' : 'neutral',
      fallbackNote: 'Setup & first impressions'
    },
    {
      label: 'Month 1',
      emoji: '🧪',
      patterns: ['first\\s+month', 'first\\s+30\\s*days', 'early\\s+(?:owner|use|week)', 'month\\s+one'],
      fallbackMood: score >= 7.5 ? 'positive' : 'mixed',
      fallbackNote: 'Daily use patterns emerge'
    },
    {
      label: '3 Months',
      emoji: '📊',
      patterns: ['(?:3|three)\\s+months?', '90\\s*days', '3.6\\s*months', 'quarter'],
      fallbackMood: score >= 8.5 ? 'positive' : score >= 7 ? 'neutral' : 'mixed',
      fallbackNote: 'Settling into routine'
    },
    {
      label: '6 Months',
      emoji: '🔍',
      patterns: ['(?:6|six)\\s+months?', 'half.a.year', '6.month\\b'],
      fallbackMood: score >= 8.5 ? 'positive' : score >= 7.5 ? 'neutral' : 'mixed',
      fallbackNote: 'Long-term reality clear'
    },
    {
      label: '12 Months',
      emoji: '🏆',
      patterns: ['(?:12|twelve|one)\\s+(?:months?|year)', 'a\\s+year', 'long.term', 'annual'],
      fallbackMood: score >= 8 ? 'positive' : score >= 6.5 ? 'neutral' : 'mixed',
      fallbackNote: 'Owner verdict settled'
    }
  ];

  const emojiMap = { positive: '😊', neutral: '😐', mixed: '🤔', negative: '😤' };

  const items = stages.map(stage => {
    let note = null;
    let moodClass = stage.fallbackMood;

    for (const pat of stage.patterns) {
      const extracted = extractNear(firstText, pat, 10);
      if (extracted && extracted.length > 10) {
        note = extracted.slice(0, 70);
        moodClass = mood(extracted, stage.fallbackMood);
        break;
      }
    }
    // Also try full text if not found in firstSec
    if (!note) {
      for (const pat of stage.patterns) {
        const extracted = extractNear(fullText, pat, 10);
        if (extracted && extracted.length > 10) {
          note = extracted.slice(0, 70);
          moodClass = mood(extracted, stage.fallbackMood);
          break;
        }
      }
    }
    if (!note) note = stage.fallbackNote;

    return `<div class="timeline-item">
      <div class="timeline-icon ${moodClass}">${stage.emoji}</div>
      <div class="timeline-stage">${stage.label}</div>
      <div class="timeline-mood">${emojiMap[moodClass] || '😐'}</div>
      <div class="timeline-note">${note}</div>
    </div>`;
  });

  return `<div class="ownership-timeline">
  <h3>Owner Experience Over Time</h3>
  <div class="timeline-track">
    ${items.join('\n    ')}
  </div>
</div>`;
}

/* ════════════════════════════════════════════════════════════
   INJECTORS — insert visual at the right position
   ════════════════════════════════════════════════════════════ */

/* Insert content right after the glance script block */
function injectAfterGlance(html, slug, content) {
  const end = glanceScriptEnd(html, slug);
  if (end < 0) {
    // Fallback: before first H2
    const h2 = html.indexOf('<h2');
    if (h2 < 0) return html;
    return html.slice(0, h2) + '\n' + content + '\n' + html.slice(h2);
  }
  return html.slice(0, end) + '\n' + content + '\n' + html.slice(end);
}

/* Insert content before verdict-box; fall back to before closing </article> */
function injectBeforeVerdict(html, content) {
  const idx = html.indexOf('<div class="verdict-box">');
  if (idx >= 0) {
    return html.slice(0, idx) + '\n' + content + '\n' + html.slice(idx);
  }
  // Fallback: before the closing </div></div></article> pattern
  const articleEnd = html.lastIndexOf('</article>');
  if (articleEnd < 0) return html;
  // Find the last </p> or </ul> inside the article body
  const lastBlock = Math.max(
    html.slice(0, articleEnd).lastIndexOf('</p>') + '</p>'.length,
    html.slice(0, articleEnd).lastIndexOf('</ul>') + '</ul>'.length,
    html.slice(0, articleEnd).lastIndexOf('</ol>') + '</ol>'.length
  );
  if (lastBlock > 0 && lastBlock < articleEnd) {
    return html.slice(0, lastBlock) + '\n' + content + '\n' + html.slice(lastBlock);
  }
  return html.slice(0, articleEnd) + '\n' + content + '\n' + html.slice(articleEnd);
}

/* Insert content after closing </table> (quick picks table) */
function injectAfterTable(html, content) {
  const idx = html.lastIndexOf('</table>');
  if (idx < 0) return html;
  const end = idx + '</table>'.length;
  return html.slice(0, end) + '\n' + content + '\n' + html.slice(end);
}

/* Insert content after "First Impressions" section */
function injectAfterFirstImpressions(html, content) {
  const stripped = stripScripts(html);
  const m = /<h2[^>]*>First Impressions[^<]*<\/h2>/i.exec(stripped);
  if (!m) {
    // Try to insert after first H2 section
    const h2End = html.indexOf('</h2>');
    if (h2End < 0) return injectAfterGlance(html, '', content);
    const nextH2 = html.indexOf('<h2', h2End + 5);
    if (nextH2 < 0) return html;
    return html.slice(0, nextH2) + '\n' + content + '\n' + html.slice(nextH2);
  }
  // Find this H2 in the actual html (not stripped)
  const h2Match = new RegExp('<h2[^>]*>First Impressions[^<]*<\\/h2>', 'i').exec(html);
  if (!h2Match) return html;
  const sectionStart = h2Match.index + h2Match[0].length;
  const nextH2 = html.indexOf('<h2', sectionStart + 1);
  if (nextH2 < 0) return html;
  // Find last closing block tag before nextH2
  const segment = html.slice(sectionStart, nextH2);
  const candidates = [
    segment.lastIndexOf('</p>') + '</p>'.length,
    segment.lastIndexOf('</ul>') + '</ul>'.length,
    segment.lastIndexOf('</blockquote>') + '</blockquote>'.length,
  ].map(n => n > (sectionStart) ? n : 0).filter(n => n > 0);
  const insertOffset = candidates.length ? Math.max(...candidates) : segment.length;
  const insertAt = sectionStart + insertOffset;
  return html.slice(0, insertAt) + '\n' + content + '\n' + html.slice(insertAt);
}

/* ════════════════════════════════════════════════════════════
   PER-TYPE PROCESSORS
   ════════════════════════════════════════════════════════════ */

function processComparison(slug, html) {
  const slugs = extractSlugs(html);
  const products = slugs.map(s => byId[s]).filter(Boolean);

  let changed = false;

  // Scatter chart — after glance
  if (!html.includes('class="price-score-block')) {
    const scatter = buildScatter(slug, products);
    if (scatter) {
      html = injectAfterGlance(html, slug, scatter);
      changed = true;
    }
  }

  // Best-for matrix — before verdict
  if (!html.includes('class="best-for-matrix"')) {
    const bfm = buildBestForMatrix(html, slugs);
    if (bfm) {
      html = injectBeforeVerdict(html, bfm);
      changed = true;
    }
  }

  return { html, changed };
}

function processTop5(slug, html) {
  const slugs = extractSlugs(html);
  const products = slugs.map(s => byId[s]).filter(Boolean);

  let changed = false;

  // Score bars — after owner-table
  if (!html.includes('class="score-bars-block"')) {
    const bars = buildScoreBars(products);
    if (bars) {
      html = injectAfterTable(html, bars);
      changed = true;
    }
  }

  // Price spectrum — before verdict
  if (!html.includes('class="price-spectrum-block"')) {
    const spectrum = buildPriceSpectrum(products);
    if (spectrum) {
      html = injectBeforeVerdict(html, spectrum);
      changed = true;
    }
  }

  return { html, changed };
}

function processWorthit(slug, html) {
  const slugs = extractSlugs(html);
  const primary = byId[slugs[0]];

  let changed = false;

  // Value gauge — after glance
  if (!html.includes('class="value-gauge-block"') && primary && primary.score) {
    const gauge = buildValueGauge(slug, primary.score);
    html = injectAfterGlance(html, slug, gauge);
    changed = true;
  }

  // Category standing — before verdict (after gauge was inserted)
  if (!html.includes('class="category-standing-block"') && primary) {
    const catBar = buildCategoryStanding(slug, primary);
    if (catBar) {
      html = injectBeforeVerdict(html, catBar);
      changed = true;
    }
  }

  // Who it's for — before verdict
  if (!html.includes('class="who-its-for-cards"')) {
    const wif = buildWhoItsFor(html, primary ? primary.name : '');
    if (wif) {
      html = injectBeforeVerdict(html, wif);
      changed = true;
    }
  }

  return { html, changed };
}

function processSentiment(slug, html) {
  const slugs = extractSlugs(html);
  const primary = byId[slugs[0]];

  let changed = false;

  // Ownership timeline — after "First Impressions" section
  if (!html.includes('class="ownership-timeline"')) {
    const timeline = buildTimeline(html, primary);
    html = injectAfterFirstImpressions(html, timeline);
    changed = true;
  }

  // Who it's for — before verdict
  if (!html.includes('class="who-its-for-cards"')) {
    const wif = buildWhoItsFor(html, primary ? primary.name : '');
    if (wif) {
      html = injectBeforeVerdict(html, wif);
      changed = true;
    }
  }

  return { html, changed };
}

/* ════════════════════════════════════════════════════════════
   MAIN
   ════════════════════════════════════════════════════════════ */

function main() {
  const guidesBySlug = {};
  GUIDES_JSON.guides.forEach(g => { guidesBySlug[g.slug] = g; });

  const files = fs.readdirSync(GUIDES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .sort();

  let processed = 0, skipped = 0, errors = [];
  const results = { comparison: 0, top5: 0, worthit: 0, sentiment: 0 };

  for (const file of files) {
    const slug = file.replace('.html', '');
    const guide = guidesBySlug[slug];
    if (!guide) { skipped++; continue; }

    const filepath = path.join(GUIDES_DIR, file);
    let html;
    try { html = fs.readFileSync(filepath, 'utf8'); }
    catch (e) { errors.push(slug + ': read error'); continue; }

    let result;
    try {
      switch (guide.type) {
        case 'comparison': result = processComparison(slug, html); break;
        case 'top5':       result = processTop5(slug, html);       break;
        case 'worthit':    result = processWorthit(slug, html);    break;
        case 'sentiment':  result = processSentiment(slug, html);  break;
        default: skipped++; continue;
      }
    } catch (e) {
      errors.push(slug + ': ' + e.message);
      continue;
    }

    if (result.changed) {
      fs.writeFileSync(filepath, result.html, 'utf8');
      results[guide.type]++;
      processed++;
      console.log('[' + guide.type + '] ' + slug);
    } else {
      console.log('[skip] ' + slug + ' — visuals already present');
      skipped++;
    }
  }

  console.log('\n══════════════════════════════════');
  console.log('Processed: ' + processed + '  Skipped: ' + skipped);
  console.log('  comparison: ' + results.comparison);
  console.log('  top5:       ' + results.top5);
  console.log('  worthit:    ' + results.worthit);
  console.log('  sentiment:  ' + results.sentiment);
  if (errors.length) {
    console.log('\nErrors:');
    errors.forEach(e => console.log('  ✗ ' + e));
  }
}

main();
