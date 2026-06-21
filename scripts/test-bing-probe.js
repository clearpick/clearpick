'use strict';
const https  = require('https');
const zlib   = require('zlib');
const fs     = require('fs');
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

async function main() {
  const q = 'Sony WH-1000XM4 headphones product photo white background';
  const url = 'https://www.bing.com/images/search?q=' + encodeURIComponent(q) + '&form=HDRSC2&first=1';
  const r = await httpGet(url, { 'Referer': 'https://www.bing.com/' });
  const body = r.body;

  // Save for inspection
  fs.writeFileSync('C:/clearpick/scripts/bing-debug.html', body, 'utf8');
  console.log('Saved bing-debug.html (' + body.length + ' bytes)');

  // Look for image URLs in various forms
  const httpsImgs = (body.match(/https:\/\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp)/gi) || [])
    .filter(u => !u.includes('bing.com') && !u.includes('microsoft.com'))
    .slice(0, 10);
  console.log('\nHTTPS image URLs found:', httpsImgs.length);
  httpsImgs.forEach((u, i) => console.log(i + ':', u));

  // Look for mediaurl, imgurl, etc.
  const patterns = [
    [/"mediaUrl":"([^"]+)"/, 'mediaUrl'],
    [/"imgUrl":"([^"]+)"/, 'imgUrl'],
    [/mediaUrl:"([^"]+)"/, 'mediaUrl (unquoted)'],
    [/"contentUrl":"([^"]+)"/, 'contentUrl'],
    [/data-src="(https:[^"]+\.jpg)"/, 'data-src jpg'],
    [/"src":"(https:[^"]+\.jpg)"/, 'src jpg'],
    [/iu=([^&"]+)/, 'iu param'],
    [/imgurl=([^&"]+)/, 'imgurl param'],
  ];
  for (const [p, label] of patterns) {
    const m = body.match(p);
    if (m) console.log('\nPattern [' + label + ']:', m[1].slice(0, 120));
  }

  // Check for JSON blobs
  const jsonBlobs = body.match(/\{[^{}]{200,}\}/g) || [];
  console.log('\nJSON blobs found:', jsonBlobs.length);
  // Look for ones containing image URLs
  for (const blob of jsonBlobs.slice(0, 20)) {
    if (blob.includes('.jpg') || blob.includes('.png')) {
      console.log('Blob with img:', blob.slice(0, 200));
      break;
    }
  }
}
main().catch(console.error);
