'use strict';
/**
 * collect-guide-data.js
 *
 * Collects real data for each guide from Reddit (unauthenticated) and Best Buy
 * Canada (scraped) and writes guides/{slug}.data.json consumed by guide-charts.js.
 *
 * Amazon PA-API still requires credentials — set AMAZON_ACCESS_KEY,
 * AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG in .env to enable it.
 *
 * Run: node scripts/collect-guide-data.js
 */

const fs   = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch(e) {}

const ROOT       = path.join(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');
const PRODUCTS   = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
const GUIDES     = JSON.parse(fs.readFileSync(path.join(ROOT, 'guides.json'), 'utf8')).guides || [];

const PRODUCT_MAP = {};
PRODUCTS.forEach(p => { PRODUCT_MAP[p.id] = p; });

const REDDIT_UA = 'ClearPick/1.0 (clearpick.ca; data aggregation for product guides)';

/* ─── Subreddit map (slug-keyword based) ─── */
const SUBREDDIT_MAP = {
  headphones:      ['headphones', 'audiophile', 'SonyHeadphones', 'bose'],
  earbuds:         ['headphones', 'audiophile', 'airpods'],
  speakers:        ['audiophile', 'hometheater', 'Sonos'],
  'robot-vacuum':  ['robotvacuums', 'Roomba', 'Roborock'],
  vacuum:          ['HomeImprovement', 'Dyson'],
  espresso:        ['espresso', 'Coffee'],
  'coffee-maker':  ['Coffee', 'cafe'],
  blender:         ['Cooking', 'PlantBasedDiet', 'Fitness'],
  'air-fryer':     ['airfryer', 'Cooking'],
  'instant-pot':   ['instantpot', 'Cooking'],
  'standing-desk': ['StandingDesk', 'WorkFromHome', 'battlestations', 'HomeImprovement'],
  chair:           ['StandingDesk', 'WorkFromHome', 'officechairs'],
  laptop:          ['SuggestALaptop', 'MacBook', 'laptops'],
  monitor:         ['Monitors', 'buildapc', 'battlestations'],
  tv:              ['4kTV', 'hometheater', 'Televisions', 'Hisense', 'OLED'],
  camera:          ['photography', 'mirrorless', 'SonyAlpha', 'Nikon', 'canon'],
  drone:           ['dji', 'drones', 'videography'],
  massage:         ['massage', 'physicaltherapy', 'weightlifting', 'running'],
  fitness:         ['Fitness', 'running', 'weightlifting'],
  watch:           ['AppleWatch', 'Garmin', 'Fitness', 'running'],
  baby:            ['beyondthebump', 'NewParents', 'BabyBumpsCanada', 'Parenting'],
  'power-tool':    ['Tools', 'DIY', 'HomeImprovement', 'woodworking'],
  mower:           ['lawncare', 'landscaping', 'Tools'],
  grill:           ['grilling', 'BBQ', 'smoking'],
  smoker:          ['smoking', 'grilling', 'BBQ', 'pelletgrills'],
  pet:             ['dogs', 'cats', 'Pets', 'DogCare'],
  'smart-home':    ['smarthome', 'homeautomation', 'GoogleHome', 'amazonecho'],
  mattress:        ['Mattress', 'BuyItForLife', 'PersonalFinanceCanada', 'Sleep'],
  camping:         ['CampingGear', 'camping', 'ultralight', 'hiking'],
  backpack:        ['CampingGear', 'ultralight', 'hiking', 'Mountaineering'],
  beauty:          ['femalehairadvice', 'beauty', 'HaircareScience', 'SkincareAddiction'],
  'power-station': ['solar', 'preppers', 'vandwellers', 'overlanding'],
  default:         ['PersonalFinanceCanada', 'canada', 'BuyItForLife']
};

function getSubreddits(slug) {
  // Direct key match
  for (const [key, subs] of Object.entries(SUBREDDIT_MAP)) {
    if (key === 'default') continue;
    if (slug.includes(key)) return subs;
  }
  // Keyword fallbacks
  if (/roborock|roomba|eufy.*vac|vacuum/.test(slug)) return SUBREDDIT_MAP['robot-vacuum'];
  if (/sony.*(wh|xm)|bose.*quiet|airpods|jabra|headphone/.test(slug)) return SUBREDDIT_MAP['headphones'];
  if (/breville|nespresso|espresso|barista|magnifica|delonghi/.test(slug)) return SUBREDDIT_MAP['espresso'];
  if (/coffee/.test(slug)) return SUBREDDIT_MAP['coffee-maker'];
  if (/dyson.*hair|airwrap|ghd/.test(slug)) return SUBREDDIT_MAP['beauty'];
  if (/dyson/.test(slug)) return ['Dyson', 'HomeImprovement', 'femalehairadvice'];
  if (/ego|mower|lawn/.test(slug)) return SUBREDDIT_MAP['mower'];
  if (/dewalt|milwaukee|makita|noco/.test(slug)) return SUBREDDIT_MAP['power-tool'];
  if (/hisense|tcl|samsung.*tv|lg.*tv|oled|qled/.test(slug)) return SUBREDDIT_MAP['tv'];
  if (/endy|casper|douglas|mattress/.test(slug)) return SUBREDDIT_MAP['mattress'];
  if (/theragun|hyperice|massage/.test(slug)) return SUBREDDIT_MAP['massage'];
  if (/nanit|stokke|baby|monitor.*baby/.test(slug)) return SUBREDDIT_MAP['baby'];
  if (/garmin|apple.?watch|fitbit/.test(slug)) return SUBREDDIT_MAP['watch'];
  if (/sony.?a\d|nikon|fujifilm|canon.*eos|mirrorless|camera/.test(slug)) return SUBREDDIT_MAP['camera'];
  if (/macbook|laptop|ipad/.test(slug)) return SUBREDDIT_MAP['laptop'];
  if (/ecoflow|jackery|power.station|bluetti/.test(slug)) return SUBREDDIT_MAP['power-station'];
  if (/weber|traeger|napoleon.*grill|grill|smoker|bbq/.test(slug)) return SUBREDDIT_MAP['grill'];
  if (/herman.miller|steelcase|flexispot|standing.desk/.test(slug)) return SUBREDDIT_MAP['standing-desk'];
  if (/litter.robot|cat|dog|pet/.test(slug)) return SUBREDDIT_MAP['pet'];
  if (/vitamix|blender/.test(slug)) return SUBREDDIT_MAP['blender'];
  if (/osprey|backpack|hiking/.test(slug)) return SUBREDDIT_MAP['backpack'];
  return SUBREDDIT_MAP['default'];
}

/* ─── Reddit (unauthenticated) ─── */
async function fetchRedditSentiment(productName, subreddits) {
  const allPosts = [];
  const hitSubs = [];

  // Global search first
  const globalUrl = 'https://www.reddit.com/search.json?q=' +
    encodeURIComponent(productName) + '&sort=top&t=year&limit=50';
  try {
    const res = await fetch(globalUrl, { headers: { 'User-Agent': REDDIT_UA } });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.children) allPosts.push(...json.data.children.map(c => c.data));
    }
  } catch(e) {
    console.warn(`  Reddit global search failed for "${productName}": ${e.message}`);
  }

  // Per-subreddit
  for (const sub of subreddits.slice(0, 3)) {
    await new Promise(r => setTimeout(r, 1000));
    const subUrl = 'https://www.reddit.com/r/' + sub + '/search.json?q=' +
      encodeURIComponent(productName) + '&sort=top&restrict_sr=1&t=year&limit=25';
    try {
      const res = await fetch(subUrl, { headers: { 'User-Agent': REDDIT_UA } });
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.children?.length) {
          allPosts.push(...json.data.children.map(c => c.data));
          hitSubs.push('r/' + sub);
        }
      }
    } catch(e) {
      console.warn(`  Reddit r/${sub} failed: ${e.message}`);
    }
  }

  if (!allPosts.length) return null;

  // Deduplicate
  const seen = new Set();
  const posts = allPosts.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const POSITIVE_WORDS = ['recommend','love','great','best','worth it','bought','happy',
    'perfect','excellent','impressed','amazing','solid'];
  const NEGATIVE_WORDS = ['avoid','returned','return','regret','terrible','broken','fails',
    'disappointed','waste','garbage','bad','worst','not worth'];

  let positive = 0, negative = 0, mixed = 0;
  const themeCounts = {};

  for (const post of posts) {
    const title = (post.title || '').toLowerCase();
    const ratio = post.upvote_ratio || 0.5;

    const hasPos = POSITIVE_WORDS.some(w => title.includes(w));
    const hasNeg = NEGATIVE_WORDS.some(w => title.includes(w));

    if (hasNeg && !hasPos)               negative++;
    else if (hasPos && !hasNeg && ratio > 0.7) positive++;
    else if (ratio > 0.8 && !hasNeg)    positive++;
    else if (ratio < 0.45)              negative++;
    else                                 mixed++;

    [...POSITIVE_WORDS, ...NEGATIVE_WORDS].forEach(word => {
      if (title.includes(word)) themeCounts[word] = (themeCounts[word] || 0) + 1;
    });
  }

  const total = positive + negative + mixed || 1;
  const positivePct = Math.round(positive / total * 100);
  const negativePct = Math.round(negative / total * 100);

  return {
    postCount: posts.length,
    positivePct,
    negativePct,
    mixedPct: 100 - positivePct - negativePct,
    subreddits: hitSubs,
    positiveThemes: Object.entries(themeCounts)
      .filter(([w]) => POSITIVE_WORDS.includes(w))
      .sort((a,b) => b[1]-a[1]).slice(0,3).map(([w]) => w),
    negativeThemes: Object.entries(themeCounts)
      .filter(([w]) => NEGATIVE_WORDS.includes(w))
      .sort((a,b) => b[1]-a[1]).slice(0,3).map(([w]) => w)
  };
}

/* ─── Best Buy Canada (scrape — no API key needed) ─── */
async function fetchBestBuyCanada(productName) {
  // Try the internal search API first (no key required, same as the website)
  try {
    const searchUrl = 'https://www.bestbuy.ca/api/2.0/json/search?query=' +
      encodeURIComponent(productName) + '&lang=en-CA&page=1&pageSize=5';
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClearPick/1.0)',
        'Accept': 'application/json'
      }
    });
    if (res.ok) {
      const json = await res.json();
      const products = json?.products || [];
      if (products.length) {
        const p = products[0];
        if (p.customerRating) {
          return {
            rating: p.customerRating,
            reviewCount: p.customerRatingCount || null,
            productName: p.name || null
          };
        }
      }
    }
  } catch(e) {
    // fall through to scrape
  }

  // Fallback: scrape search results page
  return await scrapeBestBuySearch(productName);
}

async function scrapeBestBuySearch(productName) {
  try {
    const url = 'https://www.bestbuy.ca/en-ca/search?query=' + encodeURIComponent(productName);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ClearPick/1.0)' }
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Try JSON-LD structured data
    const jsonLdRe = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
    let m;
    while ((m = jsonLdRe.exec(html)) !== null) {
      try {
        const obj = JSON.parse(m[1]);
        const items = Array.isArray(obj) ? obj : [obj];
        for (const item of items) {
          if (item?.aggregateRating?.ratingValue) {
            return {
              rating: parseFloat(item.aggregateRating.ratingValue),
              reviewCount: parseInt(item.aggregateRating.reviewCount) || null,
              productName: item.name || null
            };
          }
        }
      } catch(e) {}
    }

    // Regex fallback on page source
    const ratingM = html.match(/customerRating['":\s]+([0-9.]+)/);
    const countM  = html.match(/customerRatingCount['":\s]+([0-9]+)/);
    if (ratingM) {
      return {
        rating: parseFloat(ratingM[1]),
        reviewCount: countM ? parseInt(countM[1]) : null
      };
    }

    return null;
  } catch(e) {
    console.warn(`  Best Buy scrape failed for "${productName}": ${e.message}`);
    return null;
  }
}

/* ─── Amazon PA-API (requires credentials) ─── */
async function fetchAmazon(asin) {
  if (!process.env.AMAZON_ACCESS_KEY) return null;
  // amazon-paapi npm package required; skipped until credentials available
  return null;
}

function extractAsin(productSlug) {
  const htmlPath = path.join(ROOT, 'products', productSlug + '.html');
  if (!fs.existsSync(htmlPath)) return null;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/amazon\.ca\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? m[1] : null;
}

/* ─── Extract product slugs from guide HTML ─── */
function getProductSlugs(html) {
  const seen = new Set();
  const re = /href="\.\.\/products\/([^"]+)\.html"/g;
  let m;
  while ((m = re.exec(html)) !== null) seen.add(m[1]);
  return [...seen];
}

/* ─── Process one guide ─── */
async function processGuide(guide) {
  const htmlPath = path.join(GUIDES_DIR, guide.slug + '.html');
  if (!fs.existsSync(htmlPath)) return null;

  const html = fs.readFileSync(htmlPath, 'utf8');
  const productSlugs = getProductSlugs(html);
  const primarySlug = productSlugs[0];
  if (!primarySlug) return null;

  const primaryProduct = PRODUCT_MAP[primarySlug];
  const productName = primaryProduct ? primaryProduct.name
    : primarySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const subreddits = getSubreddits(guide.slug);

  const data = {
    slug: guide.slug,
    guideType: guide.type,
    collectedAt: new Date().toISOString(),
    sources: {},
    complaintsData: [],
    complaintSources: ''
  };

  // Reddit
  try {
    const redditData = await fetchRedditSentiment(productName, subreddits);
    if (redditData) data.sources.reddit = redditData;
  } catch(e) {
    console.warn(`  [warn] Reddit failed for ${guide.slug}: ${e.message}`);
  }

  // Best Buy Canada
  await new Promise(r => setTimeout(r, 500));
  try {
    const bbData = await fetchBestBuyCanada(productName);
    if (bbData && bbData.rating) data.sources.bestbuy = bbData;
  } catch(e) {
    console.warn(`  [warn] Best Buy failed for ${guide.slug}: ${e.message}`);
  }

  // Amazon (no-op unless credentials present)
  const asin = extractAsin(primarySlug);
  if (asin) {
    const amazonData = await fetchAmazon(asin);
    if (amazonData) data.sources.amazon = amazonData;
  }

  // Comparison: build head-to-head from ClearPick scores
  if (guide.type === 'comparison' && productSlugs.length >= 2) {
    const prodA = PRODUCT_MAP[primarySlug];
    const prodB = PRODUCT_MAP[productSlugs[1]];
    if (prodA && prodB) {
      const redditA = data.sources.reddit?.positivePct || null;
      const bbA = data.sources.bestbuy?.rating || null;

      data.headToHead = {
        productA: {
          name: prodA.name,
          amazonRating: null, amazonCount: null,
          satisfiedPct: null, criticalPct: null,
          redditPct: redditA, bestbuyRating: bbA,
          radarData: [
            (prodA.score || 0) * 10,
            null,
            redditA,
            bbA ? bbA / 5 * 100 : null,
            null
          ]
        },
        productB: {
          name: prodB.name,
          amazonRating: null, amazonCount: null,
          satisfiedPct: null, criticalPct: null,
          redditPct: null, bestbuyRating: null,
          radarData: [(prodB.score || 0) * 10, null, null, null, null]
        }
      };
    }
  }

  if (!Object.keys(data.sources).length && !data.headToHead) return null;
  return data;
}

/* ─── Main ─── */
async function main() {
  console.log('ClearPick Guide Data Collector');
  console.log('================================');
  console.log('Reddit: unauthenticated (no credentials needed)');
  console.log('Best Buy Canada: scraped (no API key needed)');
  console.log('Amazon: ' + (process.env.AMAZON_ACCESS_KEY ? 'credentials found' : 'skipped (no AMAZON_ACCESS_KEY)'));
  console.log('');

  let redditOk = 0, bbOk = 0, success = 0, skipped = 0, failed = 0;
  const nullSlugs = [];

  for (const guide of GUIDES) {
    process.stdout.write('[' + guide.slug + '] ... ');
    try {
      const data = await processGuide(guide);
      if (!data) {
        console.log('skipped (no product slugs or no data)');
        skipped++;
        nullSlugs.push(guide.slug);
        continue;
      }

      const outPath = path.join(GUIDES_DIR, guide.slug + '.data.json');
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');

      const parts = [];
      if (data.sources.reddit)  { parts.push('reddit(' + data.sources.reddit.postCount + ')');  redditOk++; }
      if (data.sources.bestbuy) { parts.push('bestbuy(' + data.sources.bestbuy.rating + ')'); bbOk++; }
      if (data.sources.amazon)  { parts.push('amazon'); }
      if (data.headToHead)      { parts.push('h2h'); }
      console.log('OK — ' + (parts.join(', ') || 'comparison only'));
      success++;

    } catch(e) {
      console.log('FAILED — ' + e.message);
      failed++;
    }
  }

  console.log('\n================================');
  console.log('Results:');
  console.log('  Guides with data written: ' + success);
  console.log('  Reddit data:              ' + redditOk + '/' + GUIDES.length);
  console.log('  Best Buy data:            ' + bbOk + '/' + GUIDES.length);
  console.log('  Skipped (no data):        ' + skipped);
  console.log('  Failed:                   ' + failed);
  if (nullSlugs.length) {
    console.log('\nSlugs with no data (may need subreddit mapping):');
    nullSlugs.forEach(s => console.log('  - ' + s));
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
