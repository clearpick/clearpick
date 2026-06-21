'use strict';
const fs = require('fs');

// ── Nespresso guide fix ──────────────────────────────────────────────────────
// The correct body content is the second (complete) occurrence, starting at the
// second <h2>These aren't competing for the same buyer</h2>
const nespPath = 'guides/nespresso-vertuo-plus-vs-delonghi-magnifica-evo.html';
const nespRaw = fs.readFileSync(nespPath, 'utf8');
const nespFooterIdx = nespRaw.indexOf('<footer class="site-footer"');
const nespBodyStart = nespRaw.indexOf('<div class="guide-article__body">');

// Find the second occurrence of the opening H2 (the complete one)
const firstH2 = nespRaw.indexOf('<h2>These aren’t competing for the same buyer</h2>');
const secondH2 = nespRaw.indexOf('<h2>These aren’t competing for the same buyer</h2>', firstH2 + 1);

// Find the verdict box close after the second H2
const verdictClose = nespRaw.indexOf('</div>\n\n      ', secondH2);
const verdictCloseAlt = nespRaw.indexOf('</div>\n\n        <h2>', secondH2);
// Use the verdict box close that comes before the next repetition
const correctBodyEnd = nespRaw.indexOf('\n\n      29–', secondH2);

let correctBody;
if (correctBodyEnd > secondH2) {
  correctBody = nespRaw.substring(secondH2, correctBodyEnd).trim();
} else {
  // Fallback: find the verdict-box closing div
  const vbEnd = nespRaw.indexOf('</div>\n\n      ', secondH2);
  correctBody = nespRaw.substring(secondH2, vbEnd + 6).trim();
}

const nespHeader = nespRaw.substring(0, nespBodyStart);
const nespFooter = nespRaw.substring(nespFooterIdx);
const nespFixed = nespHeader +
  '<div class="guide-article__body">\n\n        ' + correctBody +
  '\n\n      </div>\n    </div>\n  </article>\n\n  ' + nespFooter;

fs.writeFileSync(nespPath, nespFixed, 'utf8');
console.log('nespresso: fixed, body length:', correctBody.length);

// ── Roborock vs Eufy guide fix ────────────────────────────────────────────────
// The correct body starts at line 147 (last H2 repetition with the complete paragraph)
const robotPath = 'guides/roborock-vs-eufy-robot-vacuum.html';
const robotRaw = fs.readFileSync(robotPath, 'utf8');
const robotFooterIdx = robotRaw.indexOf('<footer class="site-footer"');
const robotBodyStart = robotRaw.indexOf('<div class="guide-article__body">');

// Find the last occurrence of the repeated H2 before the verdict box
const h2Text = '<h2>The real question buyers are asking</h2>';
let lastH2 = robotRaw.indexOf(h2Text);
let pos = lastH2;
while (true) {
  const next = robotRaw.indexOf(h2Text, pos + 1);
  if (next === -1) break;
  pos = next;
}
lastH2 = pos;

// Find the verdict box close after the correct content
// The correct content ends with </div>\n\n (the verdict box close)
const robotVerdictClose = robotRaw.indexOf('        </div>\n\n      00 CAD', lastH2);
let correctRobotBody;
if (robotVerdictClose > lastH2) {
  correctRobotBody = robotRaw.substring(lastH2, robotVerdictClose + '        </div>'.length).trim();
} else {
  // Find </div> after the verdict-box
  const vbStart = robotRaw.indexOf('<div class="verdict-box">', lastH2);
  const vbClose = robotRaw.indexOf('</div>', robotRaw.indexOf('</div>', vbStart) + 1);
  correctRobotBody = robotRaw.substring(lastH2, vbClose + 6).trim();
}

const robotHeader = robotRaw.substring(0, robotBodyStart);
const robotFooter = robotRaw.substring(robotFooterIdx);
const robotFixed = robotHeader +
  '<div class="guide-article__body">\n\n        ' + correctRobotBody +
  '\n\n      </div>\n    </div>\n  </article>\n\n  ' + robotFooter;

fs.writeFileSync(robotPath, robotFixed, 'utf8');
console.log('roborock-vs-eufy: fixed, body length:', correctRobotBody.length);

console.log('Done.');
