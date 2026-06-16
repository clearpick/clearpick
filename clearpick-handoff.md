# ClearPick.ca — Project Handoff Document

**Purpose:** This document captures the full context, decisions, vision, environment setup, lessons learned, and to-do list for the ClearPick.ca project, so a new Cowork session can pick up seamlessly without re-explaining everything from scratch. Read this whole document before starting work.

---

## 0. PROJECT VISION & GUIDING PRINCIPLES (read this first — this shapes everything)

ClearPick's core promise is **genuine, trustworthy aggregation** — "Every Review. One Clear Verdict." This isn't a content-farm SEO play; it's meant to feel like a knowledgeable friend who actually read the reviews so the visitor doesn't have to. That promise shapes almost every decision on this project:

- **Honesty over polish.** If real buyers report a genuine downside that contradicts marketing claims (e.g., a "Quiet"-branded product measured at 69dB), that tension belongs in "Worth Knowing" — not smoothed over. ClearPick's credibility depends on this.
- **Never pad.** "Sources & Further Reading" gets 2-3 links when genuinely warranted, 1 when that's all there is, or omitted entirely if coverage is too thin. Same logic applies to "Real Buyers" quotes — fewer, real, well-attributed quotes beat manufactured filler.
- **SEO and quality are the same goal, not a tradeoff.** The "volume sprint" targets high-search-volume products because that's where the audience is — but every new product still gets the full honest-research treatment. Growth should never cost the trust promise.
- **Canadian-focused, not Canadian-kitsch.** ClearPick serves Canadian shoppers (CAD pricing, amazon.ca links, future Best Buy Canada/Canadian Tire monetization) but deliberately avoids leaning on flag imagery or heavy "Proudly Canadian" branding in the primary identity. A maple leaf accent was actively considered and rejected for the primary logo — this was a deliberate choice, not an oversight. It should feel like a quality site that happens to be Canadian, not a novelty.
- **Don't overclaim features.** The FAQ page deliberately omits "What's Coming" (Verified badges, Awards, AI chatbot) until those are closer to launching. Never describe a feature as live if it isn't.
- **Affiliate transparency is a trust feature, not just legal cover.** The FAQ's "How ClearPick makes money" section is framed to build trust ("doesn't influence our scores"), not buried in fine print.
- **Build for the long game.** Decisions favor what holds up over months (consistent checklists, proper canonical tags, real research standards) over quick wins that could undermine credibility later.

If a future request seems to conflict with these principles (e.g., "just write generic reviews faster" or "add more Canadian flags everywhere"), flag the tension rather than silently complying — these principles reflect deliberate choices made over many sessions, not defaults that haven't been considered.

---

## 1. ENVIRONMENT & SETUP — READ CAREFULLY, DETAILS MATTER

This project spans TWO different working environments that don't share context or capabilities. Understanding this division is critical.

### Environment A: Claude Code (terminal, local PC)
- Runs **locally on the user's Windows PC**, in a terminal (PowerShell), from working directory `C:\clearpick`
- This is where the actual site files live (HTML/CSS/JS/products.json/sitemap.xml etc.), the git repo, and where commits/pushes happen (GitHub → Vercel auto-deploy)
- **Claude Code's network access is RESTRICTED** — it can reach things like npm/pypi/github for package installs, but CANNOT reach reddit.com, amazon.com/amazon.ca, or general websites. **Claude Code cannot do product research or look up Amazon pages.**
- PowerShell-specific gotchas learned the hard way:
  - **Atomic edits rule:** any PowerShell that does `.Replace()` on file content must also call `WriteAllText()` in the SAME script block. Splitting read/modify/write across separate tool calls caused a zero-byte file incident (had to `git checkout` to recover) — root cause was session 1 modified `$content` in memory without saving, session 2 started fresh, hit a null Replace result, and wrote empty content.
  - `pip` is not directly on PATH — use `python -m pip install ...`
  - Python 3.14 was installed mid-project (wasn't there initially) — now available, `python` command works after a terminal restart post-install
  - `products.json` is saved with a **UTF-8 BOM** — any Python script reading it needs `encoding="utf-8-sig"`, not `"utf-8"`, or you get `JSONDecodeError: Unexpected UTF-8 BOM`
  - `products.json` is ~37K tokens — too big for Claude Code's Read tool to load directly; inspect/modify via `node -e` one-liners instead
  - A `.gitignore` entry for `.claude/` was added — Claude Code's own worktree/config dir was getting accidentally staged in commits

### Environment B: This chat (Claude.ai / Cowork) — research + browser automation
- This is where **product research happens** — web_search, web_fetch, and (critically) **Claude in Chrome** browser automation
- **Claude in Chrome**: the user has the Chrome extension installed and signed in. This environment can connect to it (`tabs_context_mcp`) and drive the browser — navigate to amazon.ca pages, run JS to extract data, etc. THIS is how Amazon product images/prices/ASINs get looked up (see Section 9 — "How We Grab Image Links").
- This environment writes up full review content (research + drafted copy), then hands it to Claude Code as a structured instruction to actually implement in the files.

**Division of labor, summarized:** Research, browser automation, and content drafting happen HERE (chat/Cowork). File edits, git operations, and site builds happen in Claude Code (terminal, local PC). A new Cowork session needs to either (a) do both roles itself if it has both browser access and file/terminal access, or (b) replicate this same division — don't assume one environment can do what only the other could.

### Local Python tooling (already set up on the PC)
- Python 3.14 installed, `requests` and `pillow` installed via `python -m pip install requests pillow`
- `C:\clearpick\check_product_images.py` — image health checker. Reads products.json, checks every product image URL concurrently, flags broken/tiny/placeholder images, writes `image_report.csv`. Run via `python check_product_images.py`. Good for periodic/monthly audits.
- `C:\clearpick\test_domain_swap.py` — diagnostic script used once to test a hypothesis (see Section 8, "what didn't work") — not needed for ongoing use, can be deleted or kept for reference

---

## 2. PROJECT OVERVIEW

- **Site:** ClearPick.ca — Canadian product review/affiliate site
- **Brand tagline:** "Every Review. One Clear Verdict." (homepage hero AND header tagline sitewide)
- **Tech stack:** Static HTML/CSS/JS site, GitHub repo, Vercel auto-deploy
- **Current scale:** 151 product pages across 10 categories (Headphones, Kitchen, Camping, Fitness, Smart Home, Robot Vacuums, Gaming, Lawn & Garden, Pet Supplies, Security/Software — verify exact category names against `products.json`)
- **products.json:** Central data file. Contains per product: id, name, category, score, tag (use-case label), image, price, page, amazonUrl, subscores (object), specs (object)

---

## 3. BRAND IDENTITY (finalized)

- **Logo:** Magnifier ring + centered checkmark + handle pointing away from wordmark (135°, bottom-left). Implemented sitewide (169 files, 196 instances).
  ```html
  <svg width="32" height="32" viewBox="0 0 36 36" aria-hidden="true">
    <circle cx="18" cy="18" r="12" fill="none" stroke="#1a8cff" stroke-width="2.5"/>
    <line x1="9.5" y1="26.5" x2="5.3" y2="30.7" stroke="#1a8cff" stroke-width="3.5" stroke-linecap="round"/>
    <polyline points="13,18.5 16.5,22 23.5,13.5" fill="none" stroke="#1a8cff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  ```
- **Favicon:** Simplified version (ring + check only, no handle) — `favicon.svg` at project root, linked sitewide
- **Brand color:** `#1a8cff` (blue). Badge family concept (approved for future use, not yet built): Score=blue, Verified=teal, Awards=amber — same magnifier shape
- **Maple leaf accent:** Considered, deliberately rejected for primary logo (see Vision section). Could revisit as a small "Proudly Canadian" trust badge in footer/About — NOT in primary logo
- **OG image:** `og-image.png` (1200x630, blue bg, white logo + "ClearPick" wordmark + tagline) — fallback og:image for category/root pages; product pages use their own product image as og:image

---

## 4. STANDING CHECKLIST FOR NEW PRODUCTS (currently 24 items)

**⚠️ THIS CHECKLIST IS A LIVING DOCUMENT — KEEP IT CURRENT ⚠️**

Whenever a new standard, fix, or convention is established during work on this project — a new technical requirement (like a canonical tag pattern), a content convention (like "Sources & Further Reading"), or a process rule (like the affiliate link format) — **add it as a new numbered item to this checklist immediately**. Don't let good practices stay "tribal knowledge" from one session — write them down so every future product benefits and no step gets silently skipped. If unsure whether something is "checklist-worthy" vs. a one-off, err on adding it and ask the user to confirm/refine the wording.

1. Full review content (What Works / Worth Knowing / ClearPick Verdict)
2. "What Real Buyers Are Saying" — per-product research (see Section 6 — Research Standard)
3. Meta title `'[Product Name] Review 2026 | ClearPick'` + meta description
4. JSON-LD schema (Product/Review/AggregateRating) matching existing pattern
5. Add to category page grid — image, name, score, label, link, plus `data-score`/`data-price`/`data-brand`/`data-tag` attributes for filter/sort. Add new Brand/Best-For values to filter dropdowns if needed (check for duplicates first)
6. Add to `sitemap.xml`
7. Buying guide intro (only for brand-new categories — all 10 current categories already have these)
8. Affiliate link = `https://www.amazon.ca/dp/{ASIN}/?tag=clearpick06-20` + `rel="nofollow noopener noreferrer" target="_blank"`
9. Product image — fetch real current image URL via Amazon.ca product page (see Section 9 for exact process). Format: `https://m.media-amazon.com/images/I/{image-id}._AC_SX500_.jpg` — NOT the old deprecated `images-na.ssl-images-amazon.com/images/P/{ASIN}...` format, which is completely dead
10. Add/update entry in `products.json`
11. Homepage "Browse by Category" — new card or updated count
12. Top nav "Categories" dropdown count updated
13. If Editor's Pick changes, image/title must link to product page
14. (covered by #5 — filter/sort attributes)
15. Add `subscores` (category-specific, ~5 metrics) + `specs` (key-value) to products.json. Add Compare button + `<div id="compare-section" class="compare-section" hidden></div>` to product page
16. Correct `<link rel="canonical">` pointing to `clearpick.ca/[path]` — verify domain is correct, NOT a placeholder/staging domain
17. Full OG tags (og:title/description/url/type/image) — product image for og:image on product pages, shared `/og-image.png` for root/category pages
18. "Sources & Further Reading" section — 2-3 real links to actual review articles used in research (1 is fine if that's all there is; omit entirely if coverage too thin — NEVER pad)
19. Product page must include a "Sources analyzed" line near the score, populated from the product's `sources_analyzed` field in products.json, with a link to /methodology.html.
20. Research JSON for new products must include a `sources_analyzed` array with the canonical source names used (see /methodology.html for the canonical list).
21. Product page must use the unified "What Real Buyers Are Saying" structure: positive quotes (`.real-buyers-say__card--good`) + common complaints (`.real-buyers-say__card--bad`) in one section, separated by a divider. No standalone `<section class="common-complaints">` blocks.
22. Research JSON for new products must include both `whatBuyersLove` (2-3 paraphrased quotes) and `commonComplaints` (2-4 title+detail+source items), both with named sources.
23. When two products in the same category have meaningful audience demand (e.g., both have ranked well, or both come up in "X vs Y" search queries), create a dedicated `/compare/` page using the comparison template. Every comparison must source real owner sentiment, not generic content.
24. When a new top-level section is added to the site (e.g., /compare/, /methodology.html, future /guides/), it MUST appear in the main nav and footer at the same commit. New sections without nav placement are invisible to users and SEO.

---

## 5. WORKING STYLE — small consistent patterns to follow

- **Check for duplicates before adding anything new.** Use-case labels, brand filter values, and category page entries should all be checked against existing entries (a real bug earlier required fixing 52 duplicate labels).
- **Validate new approaches on ONE example before scaling to a batch.** When a new standard is introduced, do ONE product first, present it for approval, THEN continue with the rest of the batch.
- **Batch size: 5-6 products per Claude Code instruction** is meaningfully more token-efficient than 1-2 (shared-file overhead amortizes better). Don't go so large that context limits get hit mid-batch.

### Token efficiency audit (from the 2-product Theragun Mini + Bodylastics batch)

After that batch used noticeably more tokens than expected, Claude Code was asked directly to audit why. Findings, ranked by impact:

1. **Reading the category page (fitness.html) was the single biggest consumer** — at the time, 327 of its 703 lines were a dead `<script data-pplx-inline-edit>` block (zero runtime effect, pure Perplexity-era leftover). Every touch of that file re-read all 703 lines. This was removed sitewide as a direct result (see Section 8/10) — should no longer be an issue, but if a category page ever feels unusually expensive to read again, check for similar leftover bloat.
2. **Writing each product's HTML file (~26KB output) is the unavoidable per-product cost** — scales linearly with product count, can't be optimized away.
3. **A debug loop wasted 4-5 tool calls** — caused by the split-PowerShell-session issue described in Section 8 (atomic edits rule). Not a token cost inherent to the task, but a real inefficiency from a process mistake.
4. **products.json inspection requires `node -e` every time** (file too large for the Read tool, ~37K tokens) — minor but consistent friction on every batch.

**The batch-size math:** shared overhead (read template once, read category page once, inspect products.json structure once, update index.html once, update sitemap.xml once) is roughly FIXED per batch regardless of size. Per-product cost (write the HTML file, add one category-grid card, add one products.json entry, add one sitemap `<url>`) scales linearly. At 2 products, shared overhead is ~50% of total work; at 6 products, it drops to ~20%. Rough estimate: **6-product batches are ~30-40% cheaper per product than 2-product batches.** This is the basis for the "5-6 products per instruction" guidance above — if token cost ever seems off again, this is the audit framework to re-run (ask Claude Code to break down what consumed the most, the same way).
- **When something is "good enough for now but not perfect," say so explicitly and flag it for later** rather than silently using an imperfect fix or blocking progress on perfection. Example: Big Agnes Copper Spur — used the closest available product image now, explicitly flagged the UL2-vs-UL3 spec/price mismatch for future review.
- **For ambiguous "wrong ASIN" or "discontinued product" situations**, present findings with a clear recommendation and let the user make the final call — especially when price changes significantly (Mammotion LUBA 2→3 was a ~2-3x price jump, required explicit confirmation).
- **Audit before assuming something is broken or fine.** Major wins (canonical tag fix → Search Console 85→169 pages; 44 broken images found via image-health script) came from systematically auditing rather than assuming.
- **Keep a running to-do list organized by category/theme**, and re-share the full list periodically when asked.
- **Push back gently on scope/sequencing when warranted** (e.g., "validate with 2 products before the full batch"), but defer to the user's call once they've heard the tradeoff.
- **Standardize image sizes** — use `_AC_SX500_` as the standard width suffix for all product images (500px), for consistency across cards/compare/thumbnails.

---

## 5A. WORKING WITH NATE — communication style & pacing

This isn't a technical rule, but it matters a lot for how the collaboration actually feels day-to-day. Calibrate to this:

- **Fast rhythm, short confirmations.** Nate tends to respond with brief acknowledgments ("yup", "both done", "okay good", "yes") and expects the next step to be ready immediately — not a recap of what was just said. Keep momentum; don't pad responses with re-explanation once a pattern is established.
- **Periodic "status check-in" recaps are genuinely useful** — especially in long sessions, a short "✅ done / ⬜ pending" list helps Nate track where things stand without him having to ask. Do this naturally at good stopping points (after a big instruction completes, before pivoting to a new area) — but keep it tight, not a full report every message.
- **Don't second-guess momentum or session length.** Nate has explicitly said things like "let's go until we hit limits, stop worrying about how much we've done in a session." Don't proactively suggest wrapping up or worry aloud about token/time usage — focus on the work itself. If something genuinely needs a natural pause (e.g., a big batch finished, decision point reached), that's fine to note, but don't frame it as "we've done so much, maybe we should stop."
- **Log things to the to-do list immediately when they come up**, even mid-conversation and even if tangential to the current task (e.g., a "future idea" mentioned in passing should get a one-line to-do entry on the spot, not just acknowledged and forgotten).
- **Nate is decisive once informed — give him the tradeoffs concisely, then let him choose quickly.** Don't over-deliberate on subjective calls (branding details, content framing, sequencing). Lay out 2-3 options with a brief honest take on each, and move on once he picks.
- **Re-share the full to-do list (sorted/organized) whenever asked**, without complaint — this gets asked periodically and is a genuinely useful checkpoint for Nate, not busywork.
- **When auditing or reporting back on a Claude Code run, make sure EVERY question that was asked gets an answer surfaced** — don't let "Claude Code's report" silently drop a question that was explicitly asked in the instruction (this happened with the >15% price-change question and the Mammotion label/dup-check confirmation — see Section 11, Open Questions).

---

## 6. RESEARCH STANDARD — structure every new product review the SAME way

For every new product, research individually via real web search (not batched across multiple products at once). Each product review must follow this exact structure for consistency with the existing 151 products:

1. **Score** (out of 10) — synthesized from aggregate sentiment, not invented
2. **Use-case label** (e.g., "Best Portable Recovery Tool") — check existing labels in that category for duplicates first
3. **Price estimate (CAD)** — note as "est." if not confirmed via Amazon.ca
4. **What Works** — 3-4 bullet points, genuine strengths backed by sources
5. **Worth Knowing** — 3-4 bullet points, genuine caveats/tensions — INCLUDING any contradictions between marketing claims and real buyer experience
6. **ClearPick Verdict** — a short paragraph synthesizing who this is for / who it isn't for
7. **What Real Buyers Are Saying** — 2-3 paraphrased quotes (under 15 words each, one per source), each with a named source (Reddit community, Tom's Guide, verified buyer review, etc.)
8. **Subscores** — ~5 category-appropriate metrics (e.g., for a massage gun: Power/Portability/Battery Life/Noise Level/Value)
9. **Specs** — key-value pairs of real technical specs
10. **Sources & Further Reading** — 2-3 real links (or fewer/none if coverage thin)

Sources to draw from: Reddit (relevant subreddits), Amazon buyer reviews, RTINGS, Wirecutter, Tom's Guide, Slickdeals, OutdoorGearLab, manufacturer-specific/niche review sites, etc. This structure exists so that every product — old or new — reads with the same voice and rigor, reinforcing the "one clear verdict you can trust" vision. Don't deviate from this structure even for "easy" or "fun" products.

---

## 7. KEY STANDING DECISIONS

- **Amazon Associates tag:** `clearpick06-20` (confirmed, same account as legacy `lifehackfi0fb-20` used on original 149 products — those legacy links are FINE AS-IS, no migration needed, both report to the same account/dashboard)
- **Affiliate link format:** `https://www.amazon.ca/dp/{ASIN}/?tag=clearpick06-20` — this is Amazon's officially documented direct-link format and qualifies for the direct link bonus
- **Image URL format:** `https://m.media-amazon.com/images/I/{image-id}._AC_SX500_.jpg` (see Section 9 for how to get the image-id)

---

## 8. WHAT DIDN'T WORK — lessons learned (don't repeat these)

- **Old Amazon image format is completely dead.** `images-na.ssl-images-amazon.com/images/P/{ASIN}.01._SCLZZZZZZZ_.jpg` returns a 1x1 placeholder pixel for ANY ASIN now — valid or not. This was the root cause of 44/151 broken product images.
- **Domain-swap hypothesis failed.** Tried simply swapping the domain to `m.media-amazon.com` while keeping the same `/images/P/{ASIN}.01._SCLZZZZZZZ_.jpg` path — tested across all 44 broken images, ALL still returned 1x1 placeholders. The entire path FORMAT is deprecated, not just the domain. (Test script `test_domain_swap.py` confirmed this — kept for reference.)
- **web_search + web_fetch couldn't reliably get Amazon product page data.** web_fetch is restricted to URLs that appeared in a prior search/fetch result, and web_search rarely surfaces the actual amazon.ca product detail page with usable image markup. Many attempts returned generic category/search pages, not the specific product.
- **Claude Code cannot do this research itself** — its network allowlist doesn't include amazon.com/amazon.ca or reddit.com. Attempting Amazon lookups from Claude Code will fail.
- **products.json UTF-8 BOM broke Python's default JSON parser** — `json.load()` with default `encoding="utf-8"` threw `JSONDecodeError: Unexpected UTF-8 BOM`. Fixed by using `encoding="utf-8-sig"`.
- **Split PowerShell read/modify/write caused a zero-byte file** — session 1 did `.Replace()` in memory without saving; session 2 started fresh, the replace target wasn't found (null), and it wrote empty content over the file. Required `git checkout` to recover. Now: always read+modify+save in ONE script block.
- **Some product ASINs were simply wrong** (not just stale images) — e.g., eufy BoostIQ RoboVac 11S and PETLIBRO Granary WiFi had ASINs that actually pointed to DIFFERENT products entirely (duplicated from other entries). And Mammotion LUBA 2 AWD 1000 appears fully discontinued on Amazon.ca — only LUBA 3 models exist now. These required individual investigation, not just an image refresh.

---

## 9. WHAT'S WORKING NOW — how we grab Amazon image/price/ASIN data

This is the proven, working process for getting current product images, prices, and verifying ASINs. Use this for EVERY new product (checklist item 9) and any future image-health fixes.

**Tooling:** Claude in Chrome (browser automation), connected via `tabs_context_mcp`. The user has the extension installed and signed in — confirm connection before starting (`tabs_context_mcp` with `createIfEmpty: true`).

**Process (per product):**
1. Navigate to `https://www.amazon.ca/dp/{ASIN}` (if ASIN is known/suspected) or `https://www.amazon.ca/s?k={search terms}` (if searching for the right product)
2. **Wait ~2 seconds** after navigation — the page needs time to render before JS extraction works (an immediate JS call after navigate returns nulls)
3. Run `javascript_exec` to extract:
   ```js
   const img = document.querySelector('#landingImage') || document.querySelector('#imgTagWrapperId img');
   ({
     src: img ? img.src : null,
     dataOldHires: img ? img.getAttribute('data-old-hires') : null,
     title: document.title,
     price: document.querySelector('.a-price .a-offscreen')?.textContent
   })
   ```
4. Extract the **image-id** from `dataOldHires` (the high-res URL) — it's the filename portion before the first underscore, e.g. from `https://m.media-amazon.com/images/I/71YJQc90XRL._AC_SL1500_.jpg` the image-id is `71YJQc90XRL`
5. Build the final image URL as: `https://m.media-amazon.com/images/I/{image-id}._AC_SX500_.jpg`
6. **Verify the title matches the expected product** — this catches wrong-ASIN situations (e.g., title said "HV UL3" when we expected "UL2", or "LUBA 3 AWD 1500H" when we expected "LUBA 2 AWD 1000")

**Efficiency tip:** Use `browser_batch` to chain multiple `[navigate, wait, javascript_exec]` sequences for several products in ONE tool call — processed ~40 products this way across ~8 batched calls. Massively faster than one-at-a-time.

**For finding a product/ASIN via search:** navigate to `https://www.amazon.ca/s?k={search query}`, then extract `data-asin` attributes:
```js
const results = Array.from(document.querySelectorAll('[data-asin]:not([data-asin=""])'));
const seen = new Set(); const out = [];
for (const el of results) {
  const a = el.getAttribute('data-asin');
  const t = el.querySelector('h2 span')?.textContent;
  if (t && !seen.has(a)) { seen.add(a); out.push({asin: a, title: t}); }
}
out.slice(0,8)
```
Then check top candidates individually with the process above to find the right one (watch out for sponsored ads at the top of search results — they're often unrelated products).

**If Claude in Chrome disconnects mid-task:** it's usually transient (service worker restart). Call `tabs_context_mcp` to check/reconnect, then retry. The tab/session generally persists.

---

## 10. MAJOR WORK COMPLETED (this session + prior)

- SEO: Fixed canonical tags sitewide (was pointing to old `toolrank.pplx.app`/`clearpick.pplx.app` domains on ~20 pages) + robots.txt sitemap URL — **resulted in Search Console jumping from 85 → 169 indexed pages** (huge win)
- OG tags added/fixed sitewide (title/description/url/type/image) — 153 pages were missing them entirely
- New logo + favicon implemented sitewide
- Header search bar added to all pages (homepage keeps original hero search too — both coexist)
- Header tagline "Every Review. One Clear Verdict." added sitewide
- FAQ/methodology page (`faq.html`) created — covers what ClearPick is, how scoring works, what "Real Buyers" quotes mean, affiliate disclosure, update frequency. Deliberately OMITS "What's Coming" and "Have a question?" sections for now
- "How It Works" link added to nav/footer sitewide
- Compare feature fully built — button (styled prominently after initial "looks disabled" issue), picker with live search + sort (Score/Name/Price), up to 4 products, same-category only, subscores as bars + specs table
- products.json populated with subscores + specs for all 149 original products
- Filter/sort live on all 10 category pages
- Image health audit — **44/44 broken images fixed** (see Section 8/9 for how). Also caught and fixed:
  - 2 wrong-ASIN duplicates (eufy BoostIQ RoboVac 11S → corrected to "11S MAX" B07R295MLS; PETLIBRO Granary WiFi → corrected to B0F8B11FCP)
  - Mammotion LUBA 2 AWD 1000 → discontinued, fully rewritten as LUBA 3 AWD 1500H (B0GKNYZPC3, $3,399, premium tier label reconsidered)
  - Sony WH-1000XM4 → was "(Renewed)", switched to new unit B0CFSN4VYR (Blue International Version, $373.60)
  - Big Agnes Copper Spur HV UL2 → ASIN actually returns UL3; image used as-is for now, flagged for future content-accuracy review
- Dead Perplexity script (`<script data-pplx-inline-edit>`, 327 lines) removed from category pages sitewide
- Mobile sticky CTA bug fully fixed (root cause: `position:sticky` leaking from desktop breakpoint to mobile — fixed via `@media(min-width:769px)` guard)
- 8 orphaned product pages integrated into category grids/search/sitemap
- Use-case label audit — 52 labels fixed, zero duplicates across all categories
- Local Python tooling set up (`C:\clearpick`, Python 3.14): `check_product_images.py` for periodic image health audits

---

## 11. CURRENT ACTIVE WORK — VOLUME SPRINT

**Strategy:** Focus on high-search-volume "anchor" products for SEO momentum, prioritizing mass-search-volume items over niche ones.

**Fitness category** (currently 12 products, started at 10):
- ✅ Theragun Mini (theragun-mini.html) — Score 8.4, "Best Portable Recovery Tool"
- ✅ Bodylastics PRO Resistance Bands (bodylastics-pro-resistance-bands.html) — Score 8.6, "Best Resistance Bands Set"

**IN PROGRESS — Yoga Mat (Manduka PRO):**
- Consensus "best overall" across OutdoorGearLab 2026, Tom's Guide, Reddit (RedRecs: "Manduka Pro for durability")
- Research gathered: 6mm dense padding, lifetime durability (10-20 year old PROs still mint per teachers), textured surface balances grip/slide for Vinyasa, closed-cell surface seals out moisture, "#1 recommended by fitness instructors and yoga therapists" (Tom's Guide)
- Reddit notes: higher price point is main drawback; eco-friendly materials a selling point
- Price context: ~$138 CAD-equivalent regular, ~$90 USD on Prime Day sales
- **NEXT STEP:** Find Amazon.ca ASIN using the process in Section 9 — search "Manduka PRO Yoga Mat 6mm" returned 8 candidates (B005NZ7PEQ, B08372TF5J, B01I5CFUHM, B08SMDR7QG, B0066T7I54, B09T4GNNKV, B08373YJTB, B07MF8SSQ3) — check each for the correct 6mm/71" PRO variant (titles were generic "Manduka" in search results, need individual page checks), get price + image-id, then write up full review per Section 6 structure + Section 4 checklist

**Remaining Fitness candidates** (high search volume, pick next): kettlebell (set), pull-up bar, foam roller, jump rope, rowing machine, TRX suspension trainer, weight bench. Target: Fitness 12 → ~15-18.

**New categories planned** (after Fitness batch):
- Home Entertainment (TVs) — huge search volume
- Outdoor Cooking (BBQs, Blackstone griddles, pellet smokers)
- Cameras & Content Creation
- Traditional lawn mowers → fold into existing Lawn & Garden (don't make new category)
- Further backlog: Home & Tools, Baby & Kids, Office & Desk Setup, Car Accessories, Health & Personal Care

### ⚠️ OPEN QUESTIONS — asked but never confirmed answered (resolve when convenient, don't let these stay dropped)

These were explicitly asked of Claude Code/the user during the 44-image-fix batch, but the responses were never reported back — the conversation moved on to other things before they were answered. They're not blocking, but should be circled back to:

1. **Did any product prices change significantly (>15%)** during the 44-image-fix batch? Instruction 1 explicitly asked Claude Code to note any such cases in its summary — that summary was never shared.
2. **Mammotion LUBA 3 rewrite** — what use-case label did it land on (instruction suggested "Best Premium Robotic Mower" as a candidate), and was it confirmed duplicate-free against existing labels on lawn-garden.html? Instruction 2 asked for this confirmation explicitly.
3. **Image re-check/spot-check** — Instruction 1 asked Claude Code to re-run the image health-check (or spot-check 5 random products) after the fix, to confirm all images now load. Was this done, and did it pass? (Re-running `check_product_images.py` locally would also answer this directly — should show 151/151 OK now.)

**Also unverified — status unclear, may or may not have been sent/completed:**

4. **OG tags for 153 pages** (og:title/description/url/type for the 149 product pages + faq/about/privacy) — this instruction was drafted and presented, but it's unclear whether it was actually sent to Claude Code or completed. Worth checking: do these pages now have og:title/description/url/type tags?
5. **og-image.png integration** — the generated 1200x630 branded image was presented for download with instructions to (a) save it to the project root and (b) add og:image tags (product pages use own image, root/category pages use og-image.png). Unclear if the file was saved into the project and whether this instruction was sent/completed. Worth checking: does `og-image.png` exist at the project root, and do pages have og:image tags pointing to it correctly?

If any of #4/#5 turn out to be incomplete, they're still valid, ready-to-send instructions — just re-send them (the OG tag audit results and the og-image.png generation don't need to be redone, just the implementation step).

---

## 12. FULL TO-DO LIST BY CATEGORY

### 🚀 Volume Sprint (active)
- Continue Fitness batch (yoga mat in progress, then kettlebell/pull-up bar/foam roller/jump rope/rowing machine/TRX/weight bench)
- New categories: Home Entertainment (TVs), Outdoor Cooking, Cameras & Content Creation
- Fold traditional lawn mowers into Lawn & Garden
- Backlog categories: Home & Tools, Baby & Kids, Office & Desk Setup, Car Accessories, Health & Personal Care

### 📝 Content/Process (ongoing)
- Backfill "Sources & Further Reading" + upgraded Real Buyers research for original 149 products — piggyback on volume sprint (backfill 2-3 existing products per category when adding new ones to that category) and/or monthly audits
- (Future, low priority) Optionally include YouTube review links in Sources & Further Reading when a genuinely good one exists — link only, no embeds

### 🔍 SEO/Technical Remaining
- Reddit-targeted meta descriptions
- Page speed optimization
- Homepage messaging/copy audit (broader splash page beyond hero)
- Continue product-page first-impression audit
- Cosmetic: `k-rcher-k5-premium.html` has a mangled filename slug (ä → hyphen) for the Kärcher K5 Premium product — file works fine, but renaming to something cleaner (e.g. `karcher-k5-premium.html`) would require updating the filename, sitemap entry, and all internal links to it. Low priority.

### 🎨 Rebrand/Design Remaining
- Full visual redesign (typography/spacing/hero visuals — logo/favicon/search/tagline DONE; category dropdown icons/emojis were ALREADY present pre-overhaul, not something that needed building)
- Source breakdown bar (Amazon/Reddit/Wirecutter/RTINGS/Tom's Guide)
- Platform logo quote cards
- Sticky product image on scroll
- Sticky sidebar card desktop (low priority)
- Broader mobile optimization pass

### ❓ FAQ Additions (deferred)
- "What's Coming" section (Verified/Awards/chatbot) — add closer to launch
- "Have a question?" / contact section

### 🤖 Future Features
- AI chatbot (Gemini free tier prototype — paused on usage limit)
- Public Q&A archive
- ClearPick Verified badges
- ClearPick Awards page
- Score history tracking

### 📈 Growth & Marketing (waiting on rebrand)
- Instagram/TikTok setup
- Pinned scoring system explainer
- Reddit community engagement
- Blog series: "What Reddit Says About X" / "X vs Y" / "Best X under $Y Canada"

### 🔧 Maintenance/Lower Priority
- Diversify monetization beyond Amazon (Best Buy Canada, Canadian Tire, Awin/CJ/Impact brand programs)
- Amazon Product Advertising API after 3 affiliate sales (proper image/pricing long-term fix)
- Security headers via vercel.json
- Monthly review audit workflow (sentiment shifts, new versions, re-run image health checker)
- Track Search Console impressions, double down on performing categories

---

## 13. IMMEDIATE NEXT STEP

Resolve the Manduka PRO yoga mat ASIN using the process in Section 9 (8 candidates listed in Section 11 need checking for the correct 6mm/71" PRO variant), get current price + image-id, write full review per the Section 6 structure and Section 4 checklist, then continue the Fitness volume batch (target 5-6 products per Claude Code instruction).
