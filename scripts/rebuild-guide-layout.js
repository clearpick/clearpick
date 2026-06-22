'use strict';
/**
 * rebuild-guide-layout.js
 *
 * Structural pass over every guide HTML file. Does NOT rewrite body text.
 * Injects/restructures visual components only.
 *
 * Run: node scripts/rebuild-guide-layout.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');
const PRODUCTS   = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));

const PRODUCT_MAP = {};
PRODUCTS.forEach(p => { PRODUCT_MAP[p.id] = p; });

const CHART_JS_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>';

/* ─── Extract product slugs ─── */
function getProductSlugs(html) {
  const seen = new Set();
  const re = /href="\.\.\/products\/([^"]+)\.html"/g;
  let m;
  while ((m = re.exec(html)) !== null) seen.add(m[1]);
  // Also from data-slug attributes (product-card-inline divs)
  const re2 = /data-slug="([^"]+)"/g;
  while ((m = re2.exec(html)) !== null) seen.add(m[1]);
  return [...seen].filter(s => PRODUCT_MAP[s]);
}

/* ─── Extract complaint data from text ─── */
function extractComplaints(html) {
  // Find the complaint section by H2
  const complaintH2Re = /<h2[^>]*>([^<]*(?:complaint|issue|problem|flag|negative|common|reported)[^<]*)<\/h2>/i;
  const h2Match = html.match(complaintH2Re);
  if (!h2Match) return null;

  // Get content between this H2 and the next H2 (or end of section)
  const startIdx = html.indexOf(h2Match[0]);
  const nextH2Idx = html.indexOf('<h2', startIdx + h2Match[0].length);
  const sectionHtml = nextH2Idx > 0
    ? html.slice(startIdx, nextH2Idx)
    : html.slice(startIdx, startIdx + 3000);

  const text = sectionHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Extract (label, percentage) pairs
  const results = [];
  const patterns = [
    // "roughly 40% of long-term owners mention consumable cost"
    /roughly\s+(\d+)%\s+of\s+[^.]{3,60}/gi,
    // "~40% of long-term..."
    /~(\d+)%\s+of\s+[^.]{3,60}/gi,
    // "approximately 40%"
    /approximately\s+(\d+)%[^.]{3,60}/gi,
    // "about 40%"
    /about\s+(\d+)%[^.]{3,60}/gi,
    // "in roughly 40%"
    /in\s+roughly\s+(\d+)%[^.]{3,60}/gi,
    // "appears in roughly 40% of negative reviews"
    /appears\s+in\s+(?:roughly|about|approximately)?\s*(\d+)%[^.]{3,60}/gi,
  ];

  const seen = new Set();
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const pct = parseInt(m[1], 10);
      if (pct < 2 || pct > 98 || seen.has(pct)) continue;
      seen.add(pct);

      // Get surrounding text for label (up to 60 chars after the match)
      const ctx = m[0].replace(/[~roughly\s]+/i, '').trim().slice(0, 80);
      // Strip the percentage itself for a cleaner label
      const label = ctx.replace(/\d+%\s*(of\s+)?/i, '').trim();
      // Capitalize first letter
      const cleanLabel = label.charAt(0).toUpperCase() + label.slice(1);
      if (cleanLabel.length > 5) results.push({ label: cleanLabel, pct });
    }
  }

  if (results.length < 2) return null;

  // Sort descending by percentage
  results.sort((a, b) => b.pct - a.pct);
  return results.slice(0, 5);
}

/* ─── Extract "would buy again" percentage ─── */
function extractWouldBuyAgain(html) {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Specific patterns
  const patterns = [
    // "approximately 75% of owners say they'd buy it again"
    /approximately\s+(\d+)%\s+(?:of\s+)?(?:long.term\s+)?owners\s+(?:say|would|describe)[^.]{0,60}(?:buy|worth|recommend)/i,
    // "roughly 75% say they'd buy it again"
    /roughly\s+(\d+)%\s+(?:of\s+)?(?:long.term\s+)?owners\s+(?:say|would|describe)[^.]{0,60}(?:buy|worth|recommend)/i,
    // "80/20 in favour of worth-it" → 80
    /(\d+)\/\d+\s+(?:in\s+)?(?:favour\s+of\s+)?(?:worth.it|satisfied|positive)/i,
    // "X% satisfied" near buy again
    /(\d+)%\s+(?:of\s+owners\s+)?(?:would|say|report)[^.]{0,50}(?:worth|buy again|recommend)/i,
    // "owner sentiment [divides] roughly 60/40" (take the first number)
    /owner\s+sentiment[^.]{0,60}?(\d+)\/\d+/i,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const pct = parseInt(m[1], 10);
      if (pct >= 40 && pct <= 97) return pct;
    }
  }
  return null;
}

/* ─── Extract love/flag items from pros-cons-table ─── */
function extractProsCons(html) {
  const tableRe = /<table[^>]*class="(?:pros-cons-table|owner-table)"[^>]*>([\s\S]*?)<\/table>/i;
  const tMatch = html.match(tableRe);
  if (!tMatch) return null;

  const tableHtml = tMatch[1];

  // Check headers to determine column meaning
  const headMatch = tableHtml.match(/<thead>([\s\S]*?)<\/thead>/i);
  if (!headMatch) return null;
  const headers = [...headMatch[1].matchAll(/<th[^>]*>(.*?)<\/th>/gi)].map(m => m[1].toLowerCase().trim());
  if (headers.length < 2) return null;

  const loveIdx = headers.findIndex(h => /love|pro|strength|positive|yes|good/.test(h));
  const flagIdx = headers.findIndex(h => /flag|con|weakness|negative|complaint|watch/.test(h));
  if (loveIdx < 0 || flagIdx < 0) return null;

  const bodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!bodyMatch) return null;

  const rows = [...bodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const love = [], flag = [];

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim());
    if (cells[loveIdx]) love.push(cells[loveIdx]);
    if (cells[flagIdx]) flag.push(cells[flagIdx]);
  }

  if (!love.length && !flag.length) return null;
  return { love: love.slice(0, 5), flag: flag.slice(0, 5) };
}

/* ─── Build At a Glance HTML ─── */
function buildGlanceBlock(slug, score) {
  const scoreDisp = score ? score + '/10' : '—';
  return `<div class="guide-glance-block" id="guide-glance-${slug}">
  <div class="glance-stat" data-source="amazon">
    <span class="glance-number" id="glanceSatisfied">—</span>
    <span class="glance-label">rated 4–5★ on Amazon.ca</span>
    <span class="glance-sub" id="glanceReviewCount"></span>
  </div>
  <div class="glance-divider"></div>
  <div class="glance-stat" data-source="reddit">
    <span class="glance-number" id="glanceReddit">—</span>
    <span class="glance-label">positive Reddit sentiment</span>
    <span class="glance-sub" id="glanceRedditSub"></span>
  </div>
  <div class="glance-divider"></div>
  <div class="glance-stat" data-source="clearpick">
    <span class="glance-number">${scoreDisp}</span>
    <span class="glance-label">ClearPick score</span>
    <span class="glance-sub">based on owner sentiment</span>
  </div>
  <div class="glance-divider"></div>
  <div class="glance-stat" data-source="owners">
    <span class="glance-number" id="glanceBuyAgain">—</span>
    <span class="glance-label">would buy again</span>
    <span class="glance-sub" id="glanceOwnerSub">from owner reports</span>
  </div>
</div>
<script>
(function(){
  var slug="${slug}";
  fetch('/guides/'+slug+'.data.json').then(function(r){return r.json();}).then(function(d){
    var s=d.sources||{};
    if(s.amazon&&s.amazon.satisfiedPct){
      document.getElementById('glanceSatisfied').textContent=s.amazon.satisfiedPct+'%';
      if(s.amazon.reviewCount) document.getElementById('glanceReviewCount').textContent=s.amazon.reviewCount.toLocaleString()+' Amazon.ca ratings';
    }
    if(s.reddit&&s.reddit.positivePct){
      document.getElementById('glanceReddit').textContent=s.reddit.positivePct+'%';
      var subs=(s.reddit.subreddits||[]).slice(0,2).join(', ');
      document.getElementById('glanceRedditSub').textContent=s.reddit.postCount+' posts'+(subs?' · '+subs:'');
    }
    if(d.ownerReport&&d.ownerReport.wouldBuyAgainPct) document.getElementById('glanceBuyAgain').textContent=d.ownerReport.wouldBuyAgainPct+'%';
  }).catch(function(){
    var g=document.getElementById('guide-glance-${slug}');
    if(!g)return;
    g.querySelectorAll('.glance-stat').forEach(function(el){
      var num=el.querySelector('.glance-number');
      if(num&&num.textContent==='—')el.style.display='none';
    });
    g.querySelectorAll('.glance-divider').forEach(function(el,i,arr){
      if(i>0)el.style.display='none';
    });
  });
})();
</script>`;
}

/* ─── Build complaint chart HTML ─── */
function buildComplaintChart(slug, complaints) {
  if (!complaints || complaints.length < 2) return '';
  const labelsJson = JSON.stringify(complaints.map(c => c.label));
  const valuesJson = JSON.stringify(complaints.map(c => c.pct));
  const height = Math.max(180, complaints.length * 44);
  const id = 'complaintChart_' + slug.replace(/-/g, '_');
  return `<div class="guide-chart-block" id="${id}Block">
  <h3 class="chart-block-title">Most Common Complaints — By Frequency</h3>
  <p class="chart-block-source">From owner reviews and community threads</p>
  <canvas id="${id}" height="${height}"></canvas>
</div>
<script>
(function(){
  var labels=${labelsJson};
  var values=${valuesJson};
  function render(){
    if(typeof Chart==='undefined'){setTimeout(render,200);return;}
    var el=document.getElementById('${id}');
    if(!el)return;
    new Chart(el,{type:'bar',data:{labels:labels,datasets:[{data:values,backgroundColor:values.map(function(v,i){return i===0?'#ef4444':i===1?'#f97316':'#fbbf24';}),borderRadius:6,borderSkipped:false}]},options:{indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{max:100,ticks:{callback:function(v){return v+'%';}},grid:{color:'#f3f4f6'}},y:{grid:{display:false}}}}});
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',render);}else{render();}
})();
</script>`;
}

/* ─── Build owners split card HTML ─── */
function buildOwnersSplitCard(prosCons) {
  if (!prosCons) return '';
  const loveItems = prosCons.love.map(l => `<li>${l}</li>`).join('\n      ');
  const flagItems = prosCons.flag.map(f => `<li>${f}</li>`).join('\n      ');
  return `<div class="owners-split-card">
  <div class="owners-col owners-love">
    <div class="owners-col-header">
      <span class="owners-col-icon">&#x2705;</span>
      <span class="owners-col-title">Owners Love</span>
    </div>
    <ul class="owners-list">
      ${loveItems}
    </ul>
  </div>
  <div class="owners-col owners-flag">
    <div class="owners-col-header">
      <span class="owners-col-icon">&#x26A0;&#xFE0F;</span>
      <span class="owners-col-title">Owners Flag</span>
    </div>
    <ul class="owners-list">
      ${flagItems}
    </ul>
  </div>
</div>`;
}

/* ─── Build would-buy-again block ─── */
function buildWouldBuyAgain(pct, contextLine) {
  return `<div class="would-buy-again-block">
  <div class="wba-number">${pct}%</div>
  <div class="wba-label">of long-term owners say they&#x2019;d buy it again</div>
  <div class="wba-context">${contextLine || 'Based on long-term owner reports and community threads'}</div>
</div>`;
}

/* ─── Add section breaks between H2 groups ─── */
function addSectionBreaks(bodyHtml) {
  // Insert a section break before each H2 that comes after some content
  // (not at the very start of the body)
  return bodyHtml.replace(
    /(<\/(?:p|ul|blockquote|div|table)>\s*)\n(\s*<h2)/g,
    '$1\n<div class="guide-section-break"></div>\n$2'
  );
}

/* ─── Process one guide file ─── */
function processGuide(filename) {
  const filepath = path.join(GUIDES_DIR, filename);
  let html = fs.readFileSync(filepath, 'utf8');
  const slug = filename.replace('.html', '');

  const report = {
    slug,
    glance: false,
    complaintChart: false,
    complaintDataPoints: 0,
    ownersSplitCard: false,
    wouldBuyAgain: null,
    sectionBreaks: false,
    chartJs: false,
    skipped: []
  };

  // Skip if already processed
  if (html.includes('guide-glance-block')) {
    return { slug, skipped: ['already rebuilt'] };
  }

  const productSlugs = getProductSlugs(html);
  const primaryProduct = PRODUCT_MAP[productSlugs[0]];
  const score = primaryProduct ? primaryProduct.score : null;

  const bodyOpenTag = '<div class="guide-article__body">';
  const bodyOpen = html.indexOf(bodyOpenTag);
  if (bodyOpen < 0) {
    return { slug, skipped: ['no guide-article__body found'] };
  }

  // ── 1. Add Chart.js before </body> if not present ──────────────────────────
  if (!html.includes('chart.umd.min.js') && !html.includes('chart.js')) {
    html = html.replace('</body>', CHART_JS_TAG + '\n</body>');
    report.chartJs = true;
  }

  // ── 2. Inject At a Glance block after first product-card-inline div ────────
  // or at the start of the body if no product card exists
  const glanceHtml = '\n' + buildGlanceBlock(slug, score) + '\n';
  const firstCardRe = /(<div class="product-card-inline"[^>]*><\/div>)/;
  const firstCardMatch = html.match(firstCardRe);

  if (firstCardMatch) {
    // Find the LAST consecutive product-card-inline block, then insert after it
    // (groups of product cards should be followed by the glance block)
    let pos = bodyOpen;
    let lastCardEnd = -1;
    const cardRe = /<div class="product-card-inline"[^>]*><\/div>\s*\n?/g;
    cardRe.lastIndex = pos;
    let m;
    while ((m = cardRe.exec(html)) !== null) {
      lastCardEnd = m.index + m[0].length;
    }
    if (lastCardEnd > 0) {
      html = html.slice(0, lastCardEnd) + glanceHtml + html.slice(lastCardEnd);
      report.glance = true;
    }
  } else {
    // No product card — insert right after the body opening tag
    const insertAt = bodyOpen + bodyOpenTag.length;
    html = html.slice(0, insertAt) + glanceHtml + html.slice(insertAt);
    report.glance = true;
  }

  // ── 3. Add section breaks between H2 groups ─────────────────────────────
  const bodyStart2 = html.indexOf(bodyOpenTag);
  const bodyEndTag = '</div>\n    </div>\n  </article>';
  const bodyEnd2 = html.lastIndexOf(bodyEndTag);
  if (bodyStart2 >= 0 && bodyEnd2 > bodyStart2) {
    const before = html.slice(0, bodyStart2 + bodyOpenTag.length);
    const body   = html.slice(bodyStart2 + bodyOpenTag.length, bodyEnd2);
    const after  = html.slice(bodyEnd2);
    const bodyWithBreaks = addSectionBreaks(body);
    if (bodyWithBreaks !== body) {
      html = before + bodyWithBreaks + after;
      report.sectionBreaks = true;
    }
  }

  // ── 4. Replace pros-cons-table with owners-split-card ───────────────────
  const prosCons = extractProsCons(html);
  if (prosCons) {
    const splitCard = buildOwnersSplitCard(prosCons);
    // Replace the entire table element
    const tableRe = /<table[^>]*class="(?:pros-cons-table|owner-table)"[^>]*>[\s\S]*?<\/table>/i;
    const tableMatch = html.match(tableRe);
    // Only replace if it looks like a love/flag table (check headers)
    if (tableMatch && /<th[^>]*>(?:Owners\s+Love|Love|Pros?)/i.test(tableMatch[0])) {
      html = html.replace(tableRe, splitCard);
      report.ownersSplitCard = true;
    }
  }

  // ── 5. Inject complaint chart after the complaint section ────────────────
  const complaints = extractComplaints(html);
  if (complaints && complaints.length >= 2) {
    const chartHtml = '\n' + buildComplaintChart(slug, complaints) + '\n';
    // Find the complaint H2 and inject the chart after its section content
    const complaintH2Re = /<h2[^>]*>[^<]*(?:complaint|issue|problem|flag|negative|common|reported)[^<]*<\/h2>/i;
    const h2m = html.match(complaintH2Re);
    if (h2m) {
      const h2End = html.indexOf(h2m[0]) + h2m[0].length;
      // Find the next closing block tag after some content
      const nextH2 = html.indexOf('<h2', h2End);
      const sectionEnd = nextH2 > 0 ? nextH2 : html.indexOf('</div>', h2End + 200);
      if (sectionEnd > h2End) {
        // Find last </p> or </ul> or </blockquote> before sectionEnd
        const segment = html.slice(h2End, sectionEnd);
        const lastCloseRe = /(<\/(?:p|ul|ol|blockquote)>)\s*$/;
        const closeM = segment.match(lastCloseRe);
        if (closeM) {
          const insertAt = h2End + segment.lastIndexOf(closeM[1]) + closeM[1].length;
          html = html.slice(0, insertAt) + chartHtml + html.slice(insertAt);
          report.complaintChart = true;
          report.complaintDataPoints = complaints.length;
        }
      }
    }
  }

  // ── 6. Inject "Would Buy Again" block before verdict-box ─────────────────
  const wbaPct = extractWouldBuyAgain(html);
  if (wbaPct) {
    const wbaHtml = '\n' + buildWouldBuyAgain(wbaPct, '') + '\n';
    const verdictIdx = html.indexOf('<div class="verdict-box">');
    if (verdictIdx >= 0) {
      html = html.slice(0, verdictIdx) + wbaHtml + html.slice(verdictIdx);
      report.wouldBuyAgain = wbaPct;
    }
  }

  // ── 7. Update verdict-box inner structure (add verdict-eyebrow) ──────────
  html = html
    .replace(/<div class="verdict-box__label">Verdict<\/div>/g,
             '<span class="verdict-eyebrow">Bottom Line from Owners</span>')
    .replace(/<div class="verdict-box__label">Bottom Line<\/div>/g,
             '<span class="verdict-eyebrow">Bottom Line from Owners</span>');

  fs.writeFileSync(filepath, html, 'utf8');
  return report;
}

/* ─── Main ─── */
function main() {
  const files = fs.readdirSync(GUIDES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'index.html');

  let rebuilt = 0, chartPoints = 0, ownerCards = 0, wbaFound = 0, noData = [];

  for (const file of files) {
    const report = processGuide(file);

    if (report.skipped && report.skipped.length) {
      if (report.skipped[0] === 'already rebuilt') continue; // silent
      console.log('[' + report.slug + '] skipped: ' + report.skipped.join(', '));
      continue;
    }

    const parts = [];
    if (report.glance)         parts.push('glance');
    if (report.sectionBreaks)  parts.push('breaks');
    if (report.ownersSplitCard){ parts.push('owners-card'); ownerCards++; }
    if (report.complaintChart) { parts.push('complaint-chart(' + report.complaintDataPoints + ')'); chartPoints += report.complaintDataPoints; }
    if (report.wouldBuyAgain)  { parts.push('wba:' + report.wouldBuyAgain + '%'); wbaFound++; }
    if (report.chartJs)         parts.push('chartjs');

    const missing = [];
    if (!report.complaintChart) missing.push('no-complaint-%');
    if (!report.wouldBuyAgain)  missing.push('no-wba-%');
    if (!report.ownersSplitCard) missing.push('no-table');

    console.log('[' + report.slug + '] rebuilt ✓ — ' + (parts.join(', ') || 'glance only') +
      (missing.length ? ' | missing: ' + missing.join(', ') : ''));
    rebuilt++;
  }

  console.log('\n================================');
  console.log('Rebuilt: ' + rebuilt + '/' + files.length + ' guides');
  console.log('Owners split cards injected: ' + ownerCards);
  console.log('Complaint charts injected: ' + ownerCards);
  console.log('Complaint data points extracted: ' + chartPoints);
  console.log('Would-buy-again found: ' + wbaFound);
}

main();
