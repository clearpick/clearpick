'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');
const GUIDES_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'guides.json'), 'utf8'));
const PRODUCTS   = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));

const byId = {};
PRODUCTS.forEach(p => { byId[p.id] = p; });

function parsePrice(str) {
  if (!str) return null;
  const m = (str + '').replace(/,/g, '').match(/[\d]+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function shortLabel(name, max) {
  max = max || 22;
  return name && name.length > max ? name.slice(0, max - 1) + '…' : (name || '');
}

function extractSlugs(html) {
  const seen = new Set();
  const slugs = [];
  // data-slug attributes (product cards)
  const re1 = /data-slug="([^"]+)"/g;
  let m;
  while ((m = re1.exec(html)) !== null) {
    if (!seen.has(m[1]) && byId[m[1]]) { seen.add(m[1]); slugs.push(m[1]); }
  }
  // href product links
  const re2 = /href="(?:\.\.\/)?products\/([^"]+)\.html"/g;
  while ((m = re2.exec(html)) !== null) {
    if (!seen.has(m[1]) && byId[m[1]]) { seen.add(m[1]); slugs.push(m[1]); }
  }
  return slugs;
}

function buildScatter(slug, products) {
  if (products.length < 2) return '';
  const id = 'scatter_' + slug.replace(/-/g, '_');

  // Only include products with valid prices
  const pts = products
    .map(p => ({ x: parsePrice(p.price), y: p.score || 0, label: shortLabel(p.name, 22) }))
    .filter(d => d.x && d.x > 0);

  if (pts.length < 2) return '';

  const ptsJson = JSON.stringify(pts);
  const colors  = JSON.stringify(pts.map((_, i) => ['#1a8cff','#f97316','#8b5cf6','#10b981','#ef4444'][i % 5]));

  return `<div class="price-score-block guide-chart-block">
  <h3 class="chart-block-title">Price vs. Score at a Glance</h3>
  <p class="chart-block-source">Score from ClearPick aggregated owner data \xb7 Price in CAD</p>
  <canvas id="${id}" height="220"></canvas>
</div>
<script>
(function(){
  var pts=${ptsJson};
  var clrs=${colors};
  function render(){
    if(typeof Chart==='undefined'){setTimeout(render,200);return;}
    var el=document.getElementById('${id}');
    if(!el||el.dataset.r)return;
    el.dataset.r='1';
    var dark=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;
    var gridClr=dark?'rgba(255,255,255,0.08)':'#f3f4f6';
    var labelClr=dark?'#94a3b8':'#5c6080';
    new Chart(el,{
      type:'scatter',
      data:{datasets:[{
        data:pts.map(function(p){return{x:p.x,y:p.y};}),
        backgroundColor:clrs,
        pointRadius:10,
        pointHoverRadius:13
      }]},
      options:{
        animation:{
          onComplete:function(){
            var chart=this;
            var ctx=chart.ctx;
            var meta=chart.getDatasetMeta(0);
            ctx.save();
            ctx.font='600 11px Inter,system-ui,sans-serif';
            ctx.textAlign='center';
            pts.forEach(function(p,i){
              var pt=meta.data[i];
              if(!pt)return;
              var pos=pt.getProps(['x','y'],true);
              ctx.fillStyle=dark?'#e2e8f0':'rgba(0,0,0,0.75)';
              ctx.fillText(p.label.split(' ').slice(0,2).join(' '),pos.x,pos.y-14);
            });
            ctx.restore();
          }
        },
        plugins:{
          legend:{display:false},
          tooltip:{callbacks:{label:function(c){
            var p=pts[c.dataIndex];
            return p.label+': $'+p.x+' | '+p.y+'/10';
          }}}
        },
        scales:{
          x:{title:{display:true,text:'Price (CAD)',color:labelClr},grid:{color:gridClr},ticks:{color:labelClr}},
          y:{min:0,max:10,title:{display:true,text:'ClearPick Score',color:labelClr},grid:{color:gridClr},ticks:{color:labelClr}}
        }
      }
    });
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',render);}else{render();}
})();
<\/script>`;
}

// Strip existing scatter block (div + following script tag)
function stripScatter(html) {
  // Match from <div class="price-score-block ... to end of next </script>
  return html.replace(/<div class="price-score-block[\s\S]*?<\/script>/g, '');
}

// Find injection point: right after the glance script block
function injectAfterGlance(html, slug, content) {
  const marker = 'id="guide-glance-' + slug + '"';
  const idx = html.indexOf(marker);
  if (idx >= 0) {
    const scriptEnd = html.indexOf('</script>', idx);
    if (scriptEnd >= 0) {
      const pos = scriptEnd + '</script>'.length;
      return html.slice(0, pos) + '\n' + content + '\n' + html.slice(pos);
    }
  }
  // Fallback: before first H2
  const h2 = html.indexOf('<h2');
  if (h2 >= 0) return html.slice(0, h2) + '\n' + content + '\n' + html.slice(h2);
  return html;
}

const guidesBySlug = {};
GUIDES_JSON.guides.forEach(g => { guidesBySlug[g.slug] = g; });

const files = fs.readdirSync(GUIDES_DIR)
  .filter(f => f.endsWith('.html') && f !== 'index.html');

let fixed = 0;
files.forEach(file => {
  const slug = file.replace('.html', '');
  const guide = guidesBySlug[slug];
  if (!guide || guide.type !== 'comparison') return;

  const fp = path.join(GUIDES_DIR, file);
  let html = fs.readFileSync(fp, 'utf8');

  // Strip old (possibly broken) scatter
  const stripped = stripScatter(html);

  // Get products for this guide
  const slugs = extractSlugs(stripped);
  const products = slugs.map(s => byId[s]).filter(Boolean);

  // Rebuild
  const scatter = buildScatter(slug, products);
  if (!scatter) { console.log('[skip] ' + slug + ' — no priced products'); return; }

  const result = injectAfterGlance(stripped, slug, scatter);
  fs.writeFileSync(fp, result, 'utf8');
  console.log('[fixed] ' + slug);
  fixed++;
});

console.log('\nFixed ' + fixed + ' comparison guides.');
