'use strict';
const https = require('https');

function get(u, extra) {
  return new Promise((res, rej) => {
    const req = https.get(u, {
      headers: Object.assign({ 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html', 'Accept-Language': 'en-CA,en;q=0.9' }, extra || {}),
    }, r => {
      const ch = [];
      r.on('data', c => ch.push(c));
      r.on('end', () => res({ s: r.statusCode, b: Buffer.concat(ch).toString('utf8') }));
    });
    req.on('error', rej);
    req.setTimeout(10000, () => { req.destroy(); rej(new Error('timeout')); });
  });
}

(async () => {
  // Bing — look at actual HTML structure for result links
  const q = encodeURIComponent('garmin fenix 7 solar site:garmin.com');
  const r = await get('https://www.bing.com/search?q=' + q);
  console.log('Bing status:', r.s, 'len:', r.b.length);
  // Bing results are in <li class="b_algo"><h2><a href="URL">
  const bLinks = Array.from(r.b.matchAll(/<h2><a href="(https?:\/\/[^"]+)"/gi)).map(m => m[1]).slice(0, 5);
  console.log('Bing h2 links:', bLinks);
  // Also try cite tags
  const cites = Array.from(r.b.matchAll(/<cite[^>]*>([^<]+)<\/cite>/gi)).map(m => m[1]).slice(0, 5);
  console.log('Bing cites:', cites);
  // Show first 200 chars of first result block
  const first = r.b.match(/class="b_algo"([\s\S]{0,400})/);
  if (first) console.log('First result block:', first[0].slice(0,300));

  // Test Logitech — known working URL
  const r2 = await get('https://www.logitech.com/en-ca/products/mice/mx-master-3s.910-006556.html');
  const og2 = r2.b.match(/<meta[^>]+og:image[^>]+content="([^"]+)"/i)
           || r2.b.match(/<meta[^>]+content="([^"]+)"[^>]+og:image/i);
  console.log('\nLogitech MX Master 3S og:image:', og2 ? og2[1] : 'NONE (status:' + r2.s + ')');

  // Test Logitech search
  const r3 = await get('https://www.logitech.com/en-ca/search?q=mx+master+3s');
  console.log('Logitech search status:', r3.s, 'len:', r3.b.length);
  const logLinks = Array.from(r3.b.matchAll(/href="(\/en-ca\/products\/[^"]+)"/gi)).map(m => m[1]).slice(0, 3);
  console.log('Logitech product links:', logLinks);
})().catch(console.error);
