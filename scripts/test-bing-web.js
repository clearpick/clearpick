'use strict';
const https  = require('https');
const zlib   = require('zlib');
const urlMod = require('url');

function httpGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new urlMod.URL(url);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      ...extraHeaders,
    };
    https.get({ hostname: parsed.hostname, path: parsed.pathname + parsed.search, headers, timeout: 15000 }, res => {
      const chunks = [];
      let stream = res;
      const enc = res.headers['content-encoding'];
      if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (enc === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      stream.on('data', c => chunks.push(c));
      stream.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      stream.on('error', reject);
    }).on('error', reject);
  });
}

function isGoodImage(u) {
  if (!u || u.length < 20) return false;
  const bad = ['logo', 'favicon', 'placeholder', 'transparent', 'default', 'no-image',
               'noimage', 'missing', 'icon', '1x1', 'spinner', 'loading', 'freepik', 'shutterstock', 'dreamstime', 'alamy', 'gettyimages', 'istockphoto'];
  return !bad.some(b => u.toLowerCase().includes(b));
}

async function bingImageSearch(query) {
  const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(query) + '&form=HDRSC2&first=1&tsc=ImageHoverTitle';
  const r = await httpGet(url, { 'Referer': 'https://www.bing.com/' });
  const body = r.body;

  // Bing HTML-encodes the JSON: &quot;murl&quot;:&quot;URL&quot;
  const murls = [];
  let m;
  const re = /&quot;murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g;
  while ((m = re.exec(body)) !== null) {
    const u = m[1].replace(/&amp;/g, '&');
    murls.push(u);
  }

  for (const u of murls.slice(0, 15)) {
    if (isGoodImage(u)) return u;
  }
  return null;
}

async function main() {
  const queries = [
    'Sony WH-1000XM4 headphones product photo',
    'Fender Player Stratocaster guitar product photo',
    'Canon EOS R10 mirrorless camera product photo',
    'Dyson HP09 purifier heater fan product photo',
    'JBL Charge 5 bluetooth speaker product photo',
    'Shure SM7dB dynamic microphone product photo',
  ];
  for (const q of queries) {
    process.stdout.write(q.slice(0, 50).padEnd(52) + ' => ');
    const img = await bingImageSearch(q).catch(e => null);
    console.log(img ? img.slice(0, 90) : 'NONE');
    await new Promise(r => setTimeout(r, 800));
  }
}
main().catch(console.error);
