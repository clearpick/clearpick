'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');

// ── 1. Fix jbl-flip-6-vs-jbl-flip-7.html ─────────────────────────────────────
{
  const file = path.join(GUIDES_DIR, 'jbl-flip-6-vs-jbl-flip-7.html');
  let html = fs.readFileSync(file, 'utf8');

  // The corrupted div+close strings come from $1 and $3 capture-group substitution:
  //   $1  = '<div class="guide-article__body">'  (group 1)
  //   $3  = '</div>\n    </div>\n  </article>'   (group 3)
  // So "$149" → "$1" + "49" → '<div class="guide-article__body">49'
  //    "$179" → '<div class="guide-article__body">79'
  //    "$30"  → '$3' + '0' → '</div>\n    </div>\n  </article>0'

  const close3 = '</div>\n    </div>\n  </article>';
  const open1  = '<div class="guide-article__body">';

  html = html
    // Prices with $1XX → open1 + digits
    .replace(open1 + '49 CAD. The <a href="../products/jbl-flip-7.html">JBL Flip 7</a> is approximately ' + open1 + '79 CAD — a ' + close3 + '0 difference.',
             '$149 CAD. The <a href="../products/jbl-flip-7.html">JBL Flip 7</a> is approximately $179 CAD — a $30 difference.')
    .replace('that ' + close3 + '0 premium for',
             'that $30 premium for')
    .replace('At ' + close3 + '0 more, the improvements',
             'At $30 more, the improvements')
    .replace('The Flip 6 at ' + open1 + '49 is only',
             'The Flip 6 at $149 is only')
    .replace('at ' + open1 + '79 CAD vs ' + open1 + '49 for',
             'at $179 CAD vs $149 for');

  fs.writeFileSync(file, html, 'utf8');
  console.log('Fixed: jbl-flip-6-vs-jbl-flip-7.html');
}

// ── 2. Fix ecoflow-delta-2-vs-jackery-explorer-1000-plus.html ─────────────────
{
  const file = path.join(GUIDES_DIR, 'ecoflow-delta-2-vs-jackery-explorer-1000-plus.html');
  let html = fs.readFileSync(file, 'utf8');

  const close3 = '</div>\n    </div>\n  </article>';
  const open1  = '<div class="guide-article__body">';

  // Nested anchor bug: <a href="X"><a href="X">Name</a> Plus</a>
  // Replace all doubled anchors for Jackery Explorer 1000 Plus
  const badJackery = '<a href="../products/jackery-explorer-1000-plus.html"><a href="../products/jackery-explorer-1000-plus.html">Jackery Explorer 1000</a> Plus</a>';
  const goodJackery = '<a href="../products/jackery-explorer-1000-plus.html">Jackery Explorer 1000 Plus</a>';
  while (html.includes(badJackery)) {
    html = html.split(badJackery).join(goodJackery);
  }

  // Price corruptions:
  // "$1,299" → open1 + ",299"
  // "$1,399" → open1 + ",399"
  // "$300–400" → close3 + "00–400" (from $3 + "00–400")
  // "$400"     → close3 + "00" (appears in list item and verdict)
  html = html
    .replace('$999–' + open1 + ',399 CAD range',
             '$999–$1,399 CAD range')
    .replace('approximately ' + open1 + ',299–1,399 CAD depending',
             'approximately $1,299–1,399 CAD depending')
    .replace('The ~' + close3 + '00–400 gap is significant',
             'The ~$300–400 gap is significant')
    .replace('Budget is a priority — ' + close3 + '00–400 less',
             'Budget is a priority — $300–400 less')
    .replace('(~' + open1 + ',299 CAD) if:',
             '(~$1,299 CAD) if:')
    .replace('more ports, and ~' + close3 + '00–400 less',
             'more ports, and ~$300–400 less');

  fs.writeFileSync(file, html, 'utf8');
  console.log('Fixed: ecoflow-delta-2-vs-jackery-explorer-1000-plus.html');
}

// ── 3. Fix sony-wh-1000xm4-vs-xm6-upgrade.html ───────────────────────────────
{
  const file = path.join(GUIDES_DIR, 'sony-wh-1000xm4-vs-xm6-upgrade.html');
  let html = fs.readFileSync(file, 'utf8');

  // Replace everything between the opening guide-article__body div and the
  // final </article> closer with clean, single-copy, fully-linked content.
  const bodyOpen  = '      <div class="guide-article__body">';
  const bodyClose = '      </div>\n    </div>\n  </article>';

  const cleanBody = `

<div class="product-card-inline" data-slug="sony-wh-1000xm4"></div>
<div class="product-card-inline" data-slug="sony-wh-1000xm6"></div>

<h2>What <a href="../products/sony-wh-1000xm4.html">XM4</a> owners actually complained about</h2>
<p>Before evaluating whether the <a href="../products/sony-wh-1000xm6.html">XM6</a> is worth the jump, it's worth establishing why <a href="../products/sony-wh-1000xm4.html">XM4</a> owners would want to leave. The <a href="../products/sony-wh-1000xm4.html">XM4</a>'s complaint data reveals three consistent issues that appear across multiple ownership cycles.</p>
<p>The single most-reported hardware complaint in r/headphones and Amazon reviews is the right ear cup structural cracking — documented failures between 18–30 months of use where the plastic housing near the hinge snaps. Multiple Reddit threads and Amazon 1–2 star reviews report this. Some Sony support contacts resulted in free replacements; many did not. This is not a rare defect — it's a documented design weakness that owners account for when deciding on a replacement.</p>
<p>The second most-reported issue is Bluetooth multipoint performance. Switching between laptop and phone on the <a href="../products/sony-wh-1000xm4.html">XM4</a> requires manual reconnection more often than automatic switching. Owners coming from AirPods specifically call this out — the <a href="../products/sony-wh-1000xm4.html">XM4</a>'s multipoint exists in spec but is unreliable in practice.</p>
<p>Third: ANC performance on human speech. The <a href="../products/sony-wh-1000xm4.html">XM4</a>'s ANC is widely praised for low-frequency noise (planes, HVAC, traffic) but passes human speech through at a level that frustrated open-office users. This is a Sony ANC design pattern consistent across generations.</p>

<h2>What the <a href="../products/sony-wh-1000xm6.html">XM6</a> fixed (according to owners who switched)</h2>
<p>The hinge is the most clearly fixed complaint. Sony replaced the plastic fold mechanism with metal-reinforced hinges on the <a href="../products/sony-wh-1000xm6.html">XM6</a> — and upgraders in r/headphones specifically call this out as a tangible change they noticed immediately. "Feels completely different — the fold is so much more confidence-inspiring for travel" is representative language from early <a href="../products/sony-wh-1000xm6.html">XM6</a> owners.</p>
<p>ANC performance is the second most-mentioned improvement from upgraders. The <a href="../products/sony-wh-1000xm6.html">XM6</a> uses a new QN3 HD noise-cancelling processor with 12 microphones versus 5 on the <a href="../products/sony-wh-1000xm4.html">XM4</a>. Reviewers at SoundGuys and TechRadar tested both side-by-side and found <a href="../products/sony-wh-1000xm6.html">XM6</a> ANC noticeably stronger in noisy environments — underground trains, loud cafes, and areas with mid-frequency ambient sound where the <a href="../products/sony-wh-1000xm4.html">XM4</a> showed gaps.</p>
<p>Battery life is a genuine upgrade: <a href="../products/sony-wh-1000xm6.html">XM6</a> tests at 37+ hours with ANC on versus approximately 20 hours on the <a href="../products/sony-wh-1000xm4.html">XM4</a>. For owners who routinely forgot to charge before long trips, this is meaningful. The <a href="../products/sony-wh-1000xm6.html">XM6</a> also adds Bluetooth 5.3 and LC3 codec support alongside LDAC — upgraders with newer Android devices report improved wireless audio quality.</p>
<p>Sound quality improvement gets mixed owner reports — the <a href="../products/sony-wh-1000xm4.html">XM4</a>'s tuning is considered excellent by most owners, and the <a href="../products/sony-wh-1000xm6.html">XM6</a>'s improvement is described as refinement rather than transformation. The <a href="../products/sony-wh-1000xm4.html">XM4</a>'s mids are frequently praised; the <a href="../products/sony-wh-1000xm6.html">XM6</a> is described as smoother overall with better treble extension and less harsh high-end.</p>

<h2>What the <a href="../products/sony-wh-1000xm6.html">XM6</a> didn't fix or made worse</h2>
<p>The speech-pass-through ANC limitation is not resolved in the <a href="../products/sony-wh-1000xm6.html">XM6</a> — the same pattern reported on the <a href="../products/sony-wh-1000xm4.html">XM4</a> (ANC effective against low-frequency ambient noise, less effective against human speech) persists. Office workers who struggled with <a href="../products/sony-wh-1000xm4.html">XM4</a> ANC in open offices should not expect the <a href="../products/sony-wh-1000xm6.html">XM6</a> to solve this use case.</p>
<p>Ear pad comfort is a net regression for some owners. The <a href="../products/sony-wh-1000xm6.html">XM6</a> ships with thinner ear pads than the XM5, and owners with larger ears report the internal ANC microphone protruding and causing rubbing over extended sessions. The <a href="../products/sony-wh-1000xm4.html">XM4</a>'s ear cups received very few comfort complaints — the <a href="../products/sony-wh-1000xm6.html">XM6</a>'s are more polarizing in early ownership data.</p>
<p>Multi-device switching is improved but still manual. The <a href="../products/sony-wh-1000xm6.html">XM6</a> requires a tap in the Sony app to switch active devices — automatic handoff the way AirPods handle it is still absent. Upgraders from AirPods Pro who expected this fixed report disappointment.</p>
<p>The 3.5mm analog cable is gone. Sony removed it from the <a href="../products/sony-wh-1000xm6.html">XM6</a> box — this appears in a substantial share of Amazon reviews from frequent flyers who used the wired connection for airline entertainment systems. The <a href="../products/sony-wh-1000xm4.html">XM4</a> included it.</p>

<h2>The honest cost-benefit from owners</h2>
<p>Reviewers at TechRadar who tested both side-by-side landed here: "The <a href="../products/sony-wh-1000xm6.html">XM6</a> is about $200 more expensive than the <a href="../products/sony-wh-1000xm4.html">XM4</a> at current prices. For most people, the <a href="../products/sony-wh-1000xm4.html">XM4</a> still has everything you'd need." SoundGuys reached the same conclusion in their direct comparison: the <a href="../products/sony-wh-1000xm6.html">XM6</a> is meaningfully better, but the <a href="../products/sony-wh-1000xm4.html">XM4</a> at its current Canadian street price (~$374 CAD) is still the value benchmark in premium ANC.</p>
<p>Owner consensus from r/headphones threads on this specific question tends to split on one factor: hinge damage. <a href="../products/sony-wh-1000xm4.html">XM4</a> owners who experienced or worried about the hinge cracking consistently say the <a href="../products/sony-wh-1000xm6.html">XM6</a> upgrade is worth it. <a href="../products/sony-wh-1000xm4.html">XM4</a> owners whose headphones are intact and under 18 months old more often say hold — or replace the <a href="../products/sony-wh-1000xm4.html">XM4</a> when it shows wear rather than pre-emptively spending $550 CAD now.</p>

<h2>Who should upgrade / who should wait</h2>
<p><strong>Upgrade now if:</strong></p>
<ul>
  <li>Your <a href="../products/sony-wh-1000xm4.html">XM4</a> has hinge cracking or it concerns you — the <a href="../products/sony-wh-1000xm6.html">XM6</a> metal hinge fix is real and owners notice it immediately</li>
  <li>Your <a href="../products/sony-wh-1000xm4.html">XM4</a> is over 2 years old and battery capacity has dropped noticeably</li>
  <li>You regularly travel on flights of 4+ hours and the <a href="../products/sony-wh-1000xm4.html">XM4</a>'s 20-hour battery creates scheduling pressure</li>
  <li>You use an Android device with LDAC and want the added benefit of Bluetooth 5.3 and LC3</li>
</ul>
<p><strong>Wait if:</strong></p>
<ul>
  <li>Your <a href="../products/sony-wh-1000xm4.html">XM4</a> is under 18 months old, hinge is intact, and battery is holding — the performance gap doesn't justify $200+ CAD in this window</li>
  <li>You primarily use these for calls in open offices — neither generation solves voice pass-through well</li>
  <li>Long-session comfort is your primary concern — early <a href="../products/sony-wh-1000xm6.html">XM6</a> ear pad data shows more complaints than the <a href="../products/sony-wh-1000xm4.html">XM4</a></li>
</ul>

<div class="verdict-box">
  <div class="verdict-box__label">Verdict</div>
  <p>The <a href="../products/sony-wh-1000xm6.html">WH-1000XM6</a> is a real upgrade from the <a href="../products/sony-wh-1000xm4.html">XM4</a> — not a spec-sheet refresh. The hinge is fixed, ANC is stronger in difficult environments, and battery life nearly doubles. For owners whose <a href="../products/sony-wh-1000xm4.html">XM4</a> is showing wear or damage, the upgrade is clearly justified. For owners with an intact <a href="../products/sony-wh-1000xm4.html">XM4</a> under 18 months old, the gap is meaningful but the value math doesn't clearly favour buying now. Hold, watch for promotional pricing on the <a href="../products/sony-wh-1000xm6.html">XM6</a>, and reassess when the <a href="../products/sony-wh-1000xm4.html">XM4</a> shows the first sign of failure.</p>
</div>

`;

  // Find the body open and the LAST </article> (which is the real one)
  const bodyOpenIdx = html.indexOf(bodyOpen);
  if (bodyOpenIdx === -1) {
    console.error('ERROR: could not find body open in sony file');
    process.exit(1);
  }

  const lastArticleClose = html.lastIndexOf(bodyClose);
  if (lastArticleClose === -1) {
    console.error('ERROR: could not find body close in sony file');
    process.exit(1);
  }

  html =
    html.slice(0, bodyOpenIdx + bodyOpen.length) +
    cleanBody +
    '      ' +
    html.slice(lastArticleClose + '      '.length);

  fs.writeFileSync(file, html, 'utf8');
  console.log('Fixed: sony-wh-1000xm4-vs-xm6-upgrade.html');
}

// ── 4. Add guide-product-cards.js to all guide pages ─────────────────────────
{
  const SCRIPT_TAG  = '<script src="../js/guide-product-cards.js"></script>';
  const NAV_SCRIPT  = '<script src="../js/nav-inject.js"></script>';
  let added = 0;
  let skipped = 0;

  for (const name of fs.readdirSync(GUIDES_DIR)) {
    if (!name.endsWith('.html')) continue;
    const file = path.join(GUIDES_DIR, name);
    let html = fs.readFileSync(file, 'utf8');

    if (html.includes('guide-product-cards.js')) { skipped++; continue; }
    if (!html.includes(NAV_SCRIPT)) {
      console.warn('  [warn] nav-inject script not found in', name);
      continue;
    }

    html = html.replace(NAV_SCRIPT, SCRIPT_TAG + '\n  ' + NAV_SCRIPT);
    fs.writeFileSync(file, html, 'utf8');
    added++;
  }

  console.log(`\nProduct cards script: added to ${added} guides, ${skipped} already had it`);
}

console.log('\nDone.');
