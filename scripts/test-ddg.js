'use strict';
const https = require('https');
const zlib  = require('zlib');
const urlMod = require('url');

function httpGet(url, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new urlMod.URL(url);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
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
      stream.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  const q = 'Sony WH-1000XM4 headphones product photo';
  console.log('Step 1: DDG search page...');
  const r = await httpGet('https://duckduckgo.com/?q=' + encodeURIComponent(q) + '&iax=images&ia=images');
  console.log('Status:', r.status);
  console.log('Content-Type:', r.headers['content-type']);
  console.log('Body length:', r.body.length);

  const p1 = r.body.match(/vqd=([\d-]+)/);
  const p2 = r.body.match(/vqd="([^"]+)"/);
  const p3 = r.body.match(/"vqd":"([^"]+)"/);
  const p4 = (r.body.match(/vqd=[^&"'\s<>]+/g) || []).slice(0, 5);
  console.log('vqd match 1:', p1 && p1[1]);
  console.log('vqd match 2:', p2 && p2[1]);
  console.log('vqd match 3:', p3 && p3[1]);
  console.log('vqd matches:', p4);

  if (r.status !== 200 || r.body.length < 100) {
    console.log('Body:', r.body.slice(0, 500));
    return;
  }

  // Try token extraction
  const vqd = (p1 && p1[1]) || (p2 && p2[1]) || (p3 && p3[1]);
  if (!vqd) {
    console.log('No vqd found! Body snippet:', r.body.slice(0, 2000));
    return;
  }

  console.log('\nStep 2: Image results with vqd=' + vqd);
  const imgUrl = 'https://duckduckgo.com/i.js?q=' + encodeURIComponent(q) + '&vqd=' + encodeURIComponent(vqd) + '&p=1&o=json&l=us-en&s=0';
  const r2 = await httpGet(imgUrl, { 'Referer': 'https://duckduckgo.com/' });
  console.log('Status:', r2.status);
  console.log('Body:', r2.body.slice(0, 1000));

  try {
    const data = JSON.parse(r2.body);
    console.log('\nResults count:', (data.results || []).length);
    if (data.results && data.results[0]) {
      console.log('First result image:', data.results[0].image);
    }
  } catch(e) {
    console.log('JSON parse error:', e.message);
  }
}
main().catch(console.error);
