'use strict';
const fs = require('fs');

// ── Osprey guide fix ────────────────────────────────────────────────────────
const ospreyPath = 'guides/osprey-atmos-ag-65-vs-osprey-farpoint-40.html';
const ospreyRaw = fs.readFileSync(ospreyPath, 'utf8');
const ospreyFooterIdx = ospreyRaw.indexOf('<footer class="site-footer"');
const ospreyBodyStart = ospreyRaw.indexOf('<div class="guide-article__body">');

const ospreyBody = `
<div class="product-card-inline" data-slug="osprey-atmos-ag-65"></div>
<div class="product-card-inline" data-slug="osprey-farpoint-40-backpack"></div>

<h2>These aren't competing products — they solve different problems</h2>
<p>Buyers sometimes compare the <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a> and <a href="../products/osprey-farpoint-40-backpack.html">Osprey Farpoint 40</a> because both are Osprey backpacks and appear in similar search results. They are completely different packs built for completely different trips. The <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a> is a backpacking pack for multi-day wilderness trips — sleeping bag compartment, integrated rain cover, suspended ventilated back panel for trail comfort at full load. The <a href="../products/osprey-farpoint-40-backpack.html">Osprey Farpoint 40</a> is a travel backpack for airport-to-city travel — clamshell opening, stowable harness and hip belt for overhead bin and hotel rack presentation, international carry-on dimensions.</p>
<p>If you're planning a camping or hiking trip with multiple nights in the backcountry: <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a>. If you're planning travel — flying to a destination and moving between cities and hostels or hotels: <a href="../products/osprey-farpoint-40-backpack.html">Osprey Farpoint 40</a>. The comparison below helps buyers who are genuinely unsure which category their trip falls into.</p>

<h2>The Osprey Atmos AG 65: built for the trail</h2>
<p>The <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a>'s signature feature is its Anti-Gravity suspended back panel — a tensioned trampoline mesh that holds the pack body completely off your back, with air circulating freely through the gap. Owners consistently report this as a meaningful difference on warm-day climbs: "My shirt wasn't soaked after a 10km approach" is representative of the feedback pattern. For three-season backpacking where back temperature and sweat are real discomforts, the ventilation system is the Atmos AG's primary selling point and it works as advertised.</p>
<p>At 65 litres, the <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a> is sized for 3–5 night backpacking trips. It fits a sleeping bag (bottom compartment), camp kit (main body), daily access items (top lid), a hydration reservoir (dedicated sleeve), and water bottles (side pockets). The integrated rain cover lives in a bottom pocket and deploys quickly. For trail use, this is a complete system.</p>
<p>The Fit-on-the-Fly hip belt adjusts while the pack is on and loaded — owners mention using this mid-trail when contents shift or when transitioning from morning cold to afternoon warm. The hip belt transfers load from shoulders to hips, which is how heavy packs become comfortable over long distances. The <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a> is men's-specific — women should look at the Osprey Ariel AG 65, which has a different hip geometry.</p>

<h2>The Osprey Farpoint 40: built for the airport</h2>
<p>The <a href="../products/osprey-farpoint-40-backpack.html">Osprey Farpoint 40</a>'s design priority is travel convenience. The clamshell zip opening gives full-panel suitcase-style access to the main compartment — you pack it like a suitcase rather than stuffing items down a top-loading tube, and access is equally easy anywhere in the pack. The shoulder harness and hip belt zip away completely into a dedicated back panel pocket, leaving a clean rectangular bag profile for overhead bins and hotel luggage racks. Owners report this matters in professional travel contexts: "No one knows it's a backpack until I flip it around at the gate."</p>
<p>At 40 litres, the <a href="../products/osprey-farpoint-40-backpack.html">Osprey Farpoint 40</a> is designed to meet international carry-on dimensions (56 x 36 x 23 cm). Most major airlines accept it as carry-on; some budget carriers and regional aircraft have stricter limits where it may be gate-checked. Owners traveling internationally on full-size aircraft report no problems; those on small regional jets note occasionally tighter overhead bins. Checking your specific airline's policy before booking remains advisable.</p>
<p>The <a href="../products/osprey-farpoint-40-backpack.html">Osprey Farpoint 40</a> is not a trail pack. The suspension handles loaded city walking and airport terminal walking well. For short nature walks with a light load, it's fine. For a multi-day hike with a full camp kit, it lacks the frame, hip belt transfer, and back ventilation that trail packs require.</p>

<h2>Where confusion happens: &ldquo;adventure travel&rdquo;</h2>
<p>The most common buyer who genuinely struggles with this choice is planning adventure travel — a trip that includes both hiking and city/transport segments. Backpacking in Southeast Asia, a Patagonia trip, or an itinerary mixing Airbnbs with trail days. Owners who've done both with each pack have clear opinions:</p>
<p>If your trip is primarily trail-based (multiple nights camping, heavy loads, extended climbs), the <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a> is the right call even if you spend time in cities. The discomfort of carrying a 65L backpacking pack through airports is a minor inconvenience compared to the discomfort of carrying an underprepared travel pack on a real trail.</p>
<p>If your trip is primarily city/travel-based with occasional day hiking, the <a href="../products/osprey-farpoint-40-backpack.html">Osprey Farpoint 40</a> is the right call. It handles a day's hiking gear fine and its carry-on dimensions mean you never check luggage. Trying to do a PCT section with a Farpoint 40 would be a mistake; doing a day hike from a city base would not.</p>

<h2>Shared DNA: the Osprey warranty</h2>
<p>Both packs carry Osprey's All Mighty Guarantee — lifetime warranty covering manufacturing defects, with repair or replacement at no charge. Osprey's repair service is genuinely capable and responsive. Owners on both products report successful warranty claims years after purchase: worn hip belt foam replaced, broken buckles repaired, damaged zippers resolved. The All Mighty Guarantee changes the value calculation for both packs — both are designed to be bought once.</p>

<h2>Price comparison in Canada</h2>
<p>The <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a> retails at approximately $449 CAD. The <a href="../products/osprey-farpoint-40-backpack.html">Osprey Farpoint 40</a> retails at approximately $249 CAD. The <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a> costs more because it's a technically complex pack — the Anti-Gravity suspension system, integrated rain cover, Fit-on-the-Fly hip belt, and larger frame add cost. For a pack that will see 10+ years of use under the All Mighty Guarantee, both represent good long-term value in their respective categories.</p>

<div class="verdict-box">
  <div class="verdict-box__label">Verdict</div>
  <p>Choose the <a href="../products/osprey-atmos-ag-65.html">Osprey Atmos AG 65</a> if your trip involves multi-night wilderness camping — it's the benchmark ventilated backpacking pack for three-season hiking. Choose the <a href="../products/osprey-farpoint-40-backpack.html">Osprey Farpoint 40</a> if your trip involves airports, city movement, and hotels — it's the most consistently recommended carry-on travel backpack for good reason. Both carry Osprey's lifetime warranty. Don't try to make one pack do both jobs at full load; the design compromises are too significant.</p>
</div>
`;

const ospreyHeader = ospreyRaw.substring(0, ospreyBodyStart);
const ospreyFooter = ospreyRaw.substring(ospreyFooterIdx);
const ospreyFixed = ospreyHeader +
  '<div class="guide-article__body">' + ospreyBody +
  '\n      </div>\n    </div>\n  </article>\n\n  ' + ospreyFooter;
fs.writeFileSync(ospreyPath, ospreyFixed, 'utf8');
console.log('osprey: fixed');

// ── iPad Pro guide fix ────────────────────────────────────────────────────────
const ipadPath = 'guides/ipad-pro-m4-vs-macbook-air-m4.html';
let ipadRaw = fs.readFileSync(ipadPath, 'utf8');

// Fix title (build-guide.js PowerShell variable substitution stripped $1)
ipadRaw = ipadRaw.replace(
  /iPad Pro M4 vs MacBook Air M4: ,599/g,
  'iPad Pro M4 vs MacBook Air M4: $1,599'
);

// Fix body corruption: <div class="guide-article__body">,599 → $1,599
// and <div class="guide-article__body">,299 → $1,299
ipadRaw = ipadRaw.replace(
  /<div class="guide-article__body">,599/g,
  '$1,599'
);
ipadRaw = ipadRaw.replace(
  /<div class="guide-article__body">,299/g,
  '$1,299'
);

fs.writeFileSync(ipadPath, ipadRaw, 'utf8');
console.log('ipad: fixed');

console.log('Done.');
