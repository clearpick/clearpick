'use strict';
/**
 * collect-guide-data.js
 *
 * Collects real data for each guide from Amazon, Reddit, Best Buy Canada, etc.
 * and writes guides/{slug}.data.json files consumed by js/guide-charts.js.
 *
 * STATUS: Blocked on API credentials.
 *   ─ Reddit:     Requires OAuth app (https://www.reddit.com/prefs/apps).
 *                 Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env.
 *                 Reddit's public JSON API (no-auth) is blocked as of 2023.
 *   ─ Amazon.ca:  Requires Amazon Product Advertising API 5.0 credentials.
 *                 Set AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_PARTNER_TAG in .env.
 *   ─ Best Buy CA: Requires Best Buy Canada developer API key.
 *                 Set BESTBUY_CA_API_KEY in .env.
 *
 * Once credentials are set, run:  node scripts/collect-guide-data.js
 *
 * Output: guides/{slug}.data.json for each guide
 *
 * DATA SCHEMA (see js/guide-charts.js renderAll() for consumption):
 *
 * {
 *   slug: string,
 *   collectedAt: ISO timestamp,
 *   sources: {
 *     amazon: {
 *       asin: string,
 *       rating: number,           // e.g. 4.3
 *       reviewCount: number,
 *       satisfiedPct: number,     // % rated 4-5 stars
 *       neutralPct: number,       // % rated 3 stars
 *       criticalPct: number,      // % rated 1-2 stars
 *       starBreakdown: number[]   // [5star%, 4star%, 3star%, 2star%, 1star%]
 *     },
 *     reddit: {
 *       postCount: number,
 *       positivePct: number,
 *       mixedPct: number,
 *       negativePct: number,
 *       subreddits: string[],
 *       positiveThemes: string[],
 *       negativeThemes: string[]
 *     },
 *     bestbuy: {
 *       rating: number,
 *       reviewCount: number
 *     },
 *     forum: {
 *       source: string,           // e.g. "Head-Fi", "r/espresso wiki"
 *       postCount: number,
 *       sentiment: string         // "positive" | "mixed" | "negative"
 *     }
 *   },
 *   complaintsData: [
 *     { label: string, pct: number }   // % of critical reviews mentioning this
 *   ],
 *   complaintSources: string,          // e.g. "Amazon.ca, Reddit"
 *   headToHead: {                      // COMPARISON guides only
 *     productA: { name, amazonRating, amazonCount, satisfiedPct, criticalPct, redditPct, bestbuyRating, radarData },
 *     productB: { name, ... }
 *   },
 *   timeline: {                        // SENTIMENT / OWNER-REPORT guides only
 *     labels: string[],
 *     values: number[]                 // estimated satisfaction % at each stage
 *   }
 * }
 */

const fs   = require('fs');
const path = require('path');

// Load .env if present
try {
  require('dotenv').config();
} catch(e) {
  // dotenv optional
}

const ROOT       = path.join(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guides');
const PRODUCTS   = JSON.parse(fs.readFileSync(path.join(ROOT, 'products.json'), 'utf8'));
const GUIDES     = JSON.parse(fs.readFileSync(path.join(ROOT, 'guides.json'), 'utf8')).guides || [];

const PRODUCT_MAP = {};
PRODUCTS.forEach(function(p) { PRODUCT_MAP[p.id] = p; });

/* ─── Subreddit mapping by product category ─── */
const SUBREDDIT_MAP = {
  'Headphones':           ['headphones', 'audiophile', 'SonyHeadphones'],
  'Robot Vacuums':        ['robotvacuums', 'Roomba'],
  'Coffee':               ['espresso', 'Coffee', 'cafe'],
  'Kitchen Appliances':   ['instantpot', 'airfryer', 'Cooking'],
  'Baby & Kids':          ['beyondthebump', 'NewParents'],
  'Cameras':              ['photography', 'mirrorless', 'SonyAlpha'],
  'Fitness Equipment':    ['Garmin', 'AppleWatch', 'running', 'Fitness'],
  'Tools':                ['DIY', 'Tools', 'HomeImprovement'],
  'Lawn & Garden':        ['lawncare', 'landscaping'],
  'Home Entertainment':   ['4kTV', 'hometheater', 'Televisions'],
  'Office & Work':        ['StandingDesk', 'WorkFromHome', 'battlestations'],
  'Pet Supplies':         ['dogs', 'cats', 'Pets'],
  'Smart Home':           ['smarthome', 'homeautomation'],
  'Mattresses & Sleep':   ['Mattress', 'BuyItForLife'],
  'Power Stations':       ['camping', 'preppers', 'DIY'],
  'BBQ & Outdoor Cooking':['grilling', 'BBQ', 'smoking'],
  'Laptops':              ['laptops', 'mac', 'SuggestALaptop'],
  'Tablets':              ['ipad', 'AndroidTablets'],
};

/* ─── Extract product slugs referenced in a guide HTML file ─── */
function getProductSlugs(guideHtml) {
  const seen = new Set();
  const re = /href="\.\.\/products\/([^"]+)\.html"/g;
  let m;
  while ((m = re.exec(guideHtml)) !== null) seen.add(m[1]);
  return [...seen];
}

/* ─── Reddit OAuth token ─── */
async function getRedditToken() {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
    throw new Error('REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set in .env');
  }
  const resp = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(
        process.env.REDDIT_CLIENT_ID + ':' + process.env.REDDIT_CLIENT_SECRET
      ).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ClearPickBot/1.0 by clearpick'
    },
    body: 'grant_type=client_credentials'
  });
  const json = await resp.json();
  return json.access_token;
}

/* ─── Reddit: fetch posts mentioning a product ─── */
async function fetchReddit(productName, subreddits, token) {
  const headers = {
    'Authorization': 'Bearer ' + token,
    'User-Agent': 'ClearPickBot/1.0 by clearpick'
  };

  const allPosts = [];

  for (const sub of subreddits.slice(0, 3)) {
    try {
      const url = 'https://oauth.reddit.com/r/' + sub + '/search.json' +
        '?q=' + encodeURIComponent(productName) +
        '&sort=top&t=year&limit=25&restrict_sr=1';
      const r = await fetch(url, { headers });
      if (!r.ok) continue;
      const j = await r.json();
      const posts = (j.data?.children || []).map(c => c.data);
      allPosts.push(...posts);
      await new Promise(res => setTimeout(res, 1100)); // ~55 req/min
    } catch(e) {
      // skip this subreddit
    }
  }

  if (!allPosts.length) return null;

  const POSITIVE_WORDS = /\b(recommend|love|worth|great|excellent|best|amazing|impressed|happy|perfect|solid|buy)\b/i;
  const NEGATIVE_WORDS = /\b(avoid|return|regret|disappoint|broken|fail|waste|poor|issue|problem|defect|bad|worst)\b/i;

  let positive = 0, negative = 0, mixed = 0;
  const posThemes = {}, negThemes = {};

  allPosts.forEach(post => {
    const ratio = post.upvote_ratio || 0.5;
    const title = post.title || '';
    if (ratio >= 0.75 || POSITIVE_WORDS.test(title)) {
      positive++;
      extractTopics(title).forEach(t => { posThemes[t] = (posThemes[t] || 0) + 1; });
    } else if (ratio < 0.45 || NEGATIVE_WORDS.test(title)) {
      negative++;
      extractTopics(title).forEach(t => { negThemes[t] = (negThemes[t] || 0) + 1; });
    } else {
      mixed++;
    }
  });

  const total = positive + negative + mixed || 1;
  return {
    postCount: allPosts.length,
    positivePct: Math.round(positive / total * 100),
    mixedPct:    Math.round(mixed    / total * 100),
    negativePct: Math.round(negative / total * 100),
    subreddits: subreddits.slice(0, 3).map(s => 'r/' + s),
    positiveThemes: topN(posThemes, 3),
    negativeThemes: topN(negThemes, 3)
  };
}

function extractTopics(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4 && !/^(this|that|they|with|from|have|been|what|when|will|your|just|like|really|about|after)$/.test(w));
}

function topN(obj, n) {
  return Object.entries(obj).sort((a,b) => b[1]-a[1]).slice(0,n).map(e => e[0]);
}

/* ─── Amazon PA-API (placeholder — requires SDK) ─── */
async function fetchAmazon(asin) {
  if (!process.env.AMAZON_ACCESS_KEY) {
    throw new Error('AMAZON_ACCESS_KEY not set in .env — Amazon PA-API 5.0 required');
  }
  // Amazon PA-API 5.0 requires signed AWS-style requests.
  // Use: https://webservices.amazon.com/paapi5/documentation/
  // or the npm package: amazon-paapi
  throw new Error('Amazon PA-API integration not yet implemented — add using amazon-paapi npm package');
}

/* ─── Extract ASIN from product page HTML ─── */
function extractAsin(productSlug) {
  const htmlPath = path.join(ROOT, 'products', productSlug + '.html');
  if (!fs.existsSync(htmlPath)) return null;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const m = html.match(/amazon\.ca\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? m[1] : null;
}

/* ─── Build data object for one guide ─── */
async function processGuide(guide, redditToken) {
  const htmlPath = path.join(GUIDES_DIR, guide.slug + '.html');
  if (!fs.existsSync(htmlPath)) return null;

  const html = fs.readFileSync(htmlPath, 'utf8');
  const productSlugs = getProductSlugs(html);

  const data = {
    slug: guide.slug,
    guideType: guide.type,
    collectedAt: new Date().toISOString(),
    sources: {},
    complaintsData: [],
    complaintSources: ''
  };

  // Use the first product as the primary (for sentiment/worthit/owner-report)
  // For comparisons, use first two
  const primarySlug = productSlugs[0];
  if (!primarySlug) {
    console.log('  [skip] no product slugs found in', guide.slug);
    return null;
  }

  const primaryProduct = PRODUCT_MAP[primarySlug];
  const productName = primaryProduct ? primaryProduct.name : primarySlug.replace(/-/g, ' ');
  const category = primaryProduct ? primaryProduct.category : '';
  const subreddits = SUBREDDIT_MAP[category] || ['PersonalFinanceCanada'];

  // Reddit
  if (redditToken) {
    try {
      const redditData = await fetchReddit(productName, subreddits, redditToken);
      if (redditData) data.sources.reddit = redditData;
    } catch(e) {
      console.warn('  [warn] Reddit failed for', guide.slug, ':', e.message);
    }
  }

  // Amazon — try to extract ASIN
  const asin = extractAsin(primarySlug);
  if (asin && process.env.AMAZON_ACCESS_KEY) {
    try {
      data.sources.amazon = await fetchAmazon(asin);
    } catch(e) {
      console.warn('  [warn] Amazon failed for', guide.slug, ':', e.message);
    }
  }

  // Comparison guides: build head-to-head
  if (guide.type === 'comparison' && productSlugs.length >= 2) {
    const slugB = productSlugs[1];
    const prodA = PRODUCT_MAP[primarySlug];
    const prodB = PRODUCT_MAP[slugB];
    if (prodA && prodB) {
      // Basic head-to-head from ClearPick scores (real data we have)
      const scoreA = prodA.score || 0;
      const scoreB = prodB.score || 0;
      data.headToHead = {
        productA: {
          name: prodA.name,
          amazonRating: null, amazonCount: null,
          satisfiedPct: null, criticalPct: null,
          redditPct: null, bestbuyRating: null,
          radarData: [scoreA*10, null, null, null, null] // ClearPick score as first radar axis
        },
        productB: {
          name: prodB.name,
          amazonRating: null, amazonCount: null,
          satisfiedPct: null, criticalPct: null,
          redditPct: null, bestbuyRating: null,
          radarData: [scoreB*10, null, null, null, null]
        }
      };
    }
  }

  // Check if we got any source data at all
  if (!Object.keys(data.sources).length && !data.headToHead) return null;

  return data;
}

/* ─── Main ─── */
async function main() {
  console.log('ClearPick Guide Data Collector');
  console.log('================================');

  // Check credentials
  const hasReddit = !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET);
  const hasAmazon = !!process.env.AMAZON_ACCESS_KEY;
  const hasBestBuy = !!process.env.BESTBUY_CA_API_KEY;

  console.log('Credentials status:');
  console.log('  Reddit:', hasReddit ? 'OK' : 'MISSING (set REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET in .env)');
  console.log('  Amazon:', hasAmazon ? 'OK' : 'MISSING (set AMAZON_ACCESS_KEY + AMAZON_SECRET_KEY + AMAZON_PARTNER_TAG in .env)');
  console.log('  Best Buy CA:', hasBestBuy ? 'OK' : 'MISSING (set BESTBUY_CA_API_KEY in .env)');

  if (!hasReddit && !hasAmazon) {
    console.log('\nNo API credentials configured. Nothing to collect.');
    console.log('See comments at top of this file for setup instructions.');
    process.exit(0);
  }

  let redditToken = null;
  if (hasReddit) {
    try {
      redditToken = await getRedditToken();
      console.log('\nReddit: authenticated OK');
    } catch(e) {
      console.warn('\nReddit: auth failed —', e.message);
    }
  }

  let success = 0, skipped = 0, failed = 0;

  for (const guide of GUIDES) {
    process.stdout.write('[' + guide.slug + '] collecting... ');
    try {
      const data = await processGuide(guide, redditToken);
      if (!data) {
        console.log('skipped (no data)');
        skipped++;
        continue;
      }
      const outPath = path.join(GUIDES_DIR, guide.slug + '.data.json');
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
      const sources = Object.keys(data.sources).join(', ') || 'none';
      console.log('OK — sources: ' + sources);
      success++;
    } catch(e) {
      console.log('FAILED — ' + e.message);
      failed++;
    }
  }

  console.log('\nDone: ' + success + ' collected, ' + skipped + ' skipped, ' + failed + ' failed');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
