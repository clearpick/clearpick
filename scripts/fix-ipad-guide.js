'use strict';
const fs = require('fs');
const p = 'guides/ipad-pro-m4-vs-macbook-air-m4.html';
const raw = fs.readFileSync(p, 'utf8');

const footerIdx = raw.indexOf('<footer class="site-footer"');
const bodyStart = raw.indexOf('<div class="guide-article__body">');
const header = raw.substring(0, bodyStart);
const footer = raw.substring(footerIdx);

// Correct body — written from the first complete occurrence in the file (lines 126-217)
// The MacBook Air paragraph at line 186-188 is the only complete version
const body = `
<div class="product-card-inline" data-slug="apple-ipad-pro-13-m4"></div>
<div class="product-card-inline" data-slug="apple-macbook-air-13-m4"></div>

<h2>Same price, same chip, opposite use cases</h2>
<p>At $1,599 CAD, the <a href="../products/apple-ipad-pro-13-m4.html">Apple iPad Pro</a> 13-inch M4 and the <a href="../products/apple-macbook-air-13-m4.html">Apple MacBook Air</a> 13-inch M4 (at $1,299 for the base model) overlap in price and share the same Apple M4 silicon. This creates genuine comparison confusion for buyers upgrading or consolidating devices. But the overlap ends there. The iPad Pro 13 M4 scores 9.4 on ClearPick. The MacBook Air 13 M4 scores 9.3. The scores are nearly identical; the products are not.</p>
<p>The core question: do your daily workflows live in iPad apps, or do they require a file system, a desktop browser, and full macOS software? That question — not price or performance — determines the right device. This guide maps out how owners of each are using them and where each falls short.</p>

<h2>What the iPad Pro 13 M4 excels at</h2>
<p>The iPad Pro 13 M4's display is the best screen on any consumer device Apple has ever built — a tandem OLED that stacks two panels to achieve 1,000 nits sustained brightness without traditional OLED brightness trade-offs. Owners who use the iPad Pro for creative work are specific and consistent: "Professional illustrator — the ProMotion display and Apple Pencil Pro make this my primary work device. Nothing competes." Drawing, design, architectural sketching, video annotation, and digital illustration in Procreate or Adobe Fresco are the workflows where the iPad Pro has no peer.</p>
<p>Media consumption is exceptional. The iPad Pro 13 M4's OLED display for HDR video — Netflix, Disney+, AppleTV — produces results owners describe as better than many TVs. As a high-end media device, it competes with dedicated monitors. Reading, presentation review, and musical scoring (with apps like Notion and GoodNotes) also map naturally to the iPad form factor.</p>
<p>The Apple Pencil Pro interaction is the strongest use case argument. Touch + stylus input on a 13-inch OLED display running ProMotion at 120Hz is a different kind of computer than a laptop. For buyers whose work genuinely benefits from direct stylus-on-screen input, the MacBook Air cannot substitute for this — there is no equivalent.</p>

<h2>What the MacBook Air 13 M4 excels at</h2>
<p>The MacBook Air 13 M4 is a complete computer with macOS. Full-screen desktop applications, multi-tab browser sessions with 20+ tabs, local file system management, terminal access, IDE-based development, video editing in Final Cut or Premiere, and professional audio production in Logic Pro — all run on macOS without constraint. Owners consistently identify the MacBook Air as the right device when their work requires software that runs on a full OS: "Switched from a <a href="../products/dell-xps-13-plus-9320.html">Dell XPS 13</a> — battery life alone makes it worth it."</p>
<p>For anyone whose daily workflow involves extensive typing — writing, coding, accounting, project management — the MacBook Air's keyboard is a meaningful advantage over any tablet keyboard. The MacBook Air's built-in keyboard is excellent. The iPad's Magic Keyboard is also good but adds $479 to the purchase price, pushing the iPad Pro setup well past $2,000 for a comparable typing experience.</p>

<h2>The real-world accessory cost problem</h2>
<p>This is the iPad Pro's honest friction point. The base iPad Pro 13 M4 is $1,599 CAD. To use it as a laptop-like productivity device, you'll want: Apple Pencil Pro ($149) and the Magic Keyboard for iPad Pro ($479). Total: $2,227 CAD. At that total, you are in MacBook Pro 14 M4 territory — a full macOS machine with a physical keyboard, fans for sustained performance, and three Thunderbolt ports.</p>
<p>Owners who note this in review threads are specific: "Without the Apple Pencil and Magic Keyboard, the iPad Pro is essentially an expensive media consumption device." For buyers who genuinely use the Pencil for their primary work, the accessory cost is justified — the workflow is unique. For buyers who thought they wanted a "creative device" but mostly browse, email, and watch video, the accessory spend is hard to justify versus a MacBook Air at $1,299.</p>

<h2>iPadOS limitations in 2025</h2>
<p>Despite running the same M4 chip, the iPad Pro operates under iPadOS constraints that macOS does not have. File management is limited to the Files app — there is no Finder equivalent with full local file access. Multi-window management in iPadOS remains less capable than macOS: split-screen works but lacks the free-form windowing and complex multitasking that desktop professionals rely on. Browser-based work is limited to mobile browser versions of sites that often lack desktop functionality.</p>
<p>Owners in r/ipad who describe switching from a MacBook to an iPad Pro report that 80-90% of their daily tasks work seamlessly — and 10-20% require workarounds or substitutions. Whether that 10-20% is a dealbreaker depends entirely on which workflows fall in it. Professional app-based creative work rarely encounters the limitation; professional office-productivity work encounters it often.</p>

<h2>Who should buy which</h2>
<p><strong>Buy the <a href="../products/apple-ipad-pro-13-m4.html">Apple iPad Pro</a> 13 M4 ($1,599+ CAD) if:</strong></p>
<ul>
  <li>Your work or hobby involves drawing, illustration, or design with a stylus — this is the device's strongest use case</li>
  <li>You primarily consume media — the OLED display is exceptional for video, reading, and visual content</li>
  <li>You already own a Mac and want a complementary device for mobility and creative input</li>
  <li>Your most-used apps have excellent iPadOS versions (GoodNotes, Procreate, Notability, LumaFusion)</li>
</ul>
<p><strong>Buy the <a href="../products/apple-macbook-air-13-m4.html">MacBook Air</a> 13 M4 ($1,299 CAD) if:</strong></p>
<ul>
  <li>Your daily work involves typing, coding, file management, or full-desktop applications</li>
  <li>You use professional software with no iPadOS equivalent (Xcode, full Photoshop, Premiere, Logic Pro with full plugin access)</li>
  <li>You want one device that handles everything without accessory add-ons</li>
  <li>Budget matters — the MacBook Air costs $300 less before accessories, much less after</li>
</ul>

<div class="verdict-box">
  <div class="verdict-box__label">Verdict</div>
  <p>If you use a stylus for creative work, the <a href="../products/apple-ipad-pro-13-m4.html">Apple iPad Pro</a> 13 M4 is the best device Apple makes for that use case — the display and Pencil Pro experience is unmatched. If your work lives in macOS applications, file systems, and a keyboard, the <a href="../products/apple-macbook-air-13-m4.html">MacBook Air</a> 13 M4 is the better device at a lower price. Choosing between them is a question of workflows, not which is more powerful — both run the same chip. Don't buy the iPad Pro assuming iPadOS can replace macOS without verifying your specific apps are available and capable on iPad.</p>
</div>
`;

const fixed = header +
  '<div class="guide-article__body">' + body +
  '\n      </div>\n    </div>\n  </article>\n\n  ' + footer;

fs.writeFileSync(p, fixed, 'utf8');
console.log('ipad-pro-m4-vs-macbook-air-m4: fixed');
