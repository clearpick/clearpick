'use strict';
const fs = require('fs');
const p = 'guides/roborock-qrevo-s-vs-qrevo-curv.html';
let s = fs.readFileSync(p, 'utf8');

// $3 → closeTag corruptions (closeTag = </div>\n    </div>\n  </article>)
const closeTag = '</div>\n    </div>\n  </article>';
s = s.split(closeTag + '00 difference is real').join('$300 difference is real');
s = s.split('The ' + closeTag + '00 difference matters').join('The $300 difference matters');
s = s.split('worth the extra ' + closeTag + '00 for').join('worth the extra $300 for');
s = s.split('keeps ' + closeTag + '00 in your pocket').join('keeps $300 in your pocket');

// $1 → openTag corruptions (openTag = <div class="guide-article__body">)
const openTag = '<div class="guide-article__body">';
s = s.split('approximately ' + openTag + ',299 CAD').join('approximately $1,299 CAD');
s = s.split('~' + openTag + ',299 CAD)').join('~$1,299 CAD)');

fs.writeFileSync(p, s, 'utf8');
console.log('roborock-qrevo-s-vs-qrevo-curv: fixed');
