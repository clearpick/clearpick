# ClearPick.ca — Origin & Evolution History

**Purpose:** This document explains HOW ClearPick got to its current state — the project's history, the platforms/tools used at each stage, and why certain "weird" leftover artifacts exist in the codebase. Understanding this history helps explain things that otherwise look like bugs or mistakes, and helps avoid mistaking old-era leftovers for current standards.

This document is partly reconstructed from technical evidence found in the codebase during multiple overhaul sessions, combined with what the project owner has confirmed directly. Where something is inferred from evidence rather than directly confirmed, it's noted as such — if anything here is inaccurate or incomplete, the project owner can correct/expand it.

---

## STAGE 1: "ToolRank" — built on Perplexity's "Computer" tool

The project originally started as a site called **ToolRank**, built using **Perplexity's "Computer" agentic tool** (an AI agent that can browse/build/edit, similar in spirit to Claude Code or Cowork, but Perplexity's version).

**Evidence of this era found in the codebase:**
- Old canonical tags and robots.txt sitemap references pointed to `toolrank.pplx.app` — a Perplexity-hosted app subdomain, confirming both the original site name ("ToolRank") and the original hosting/dev platform (Perplexity's `.pplx.app` infrastructure)
- Large dead `<script data-pplx-inline-edit>` blocks (327 lines each) were found embedded in category page HTML files — these appear to be artifacts of Perplexity's in-browser editing tooling that got baked into the shipped HTML and had zero effect on the live site, but bloated every file read/edit during later development. These were removed sitewide during the overhaul.
- The original Amazon Associates tag `lifehackfi0fb-20` is still used on all 149 original products' affiliate links — the "lifehack" naming suggests this tag may predate even "ToolRank," possibly from an earlier/different project using the same Associates account. These legacy links still work fine (same account as the current `clearpick06-20` tag) and were NOT migrated — no need to.
- The original 149 product pages were built during this era, including their image URLs in the format `https://images-na.ssl-images-amazon.com/images/P/{ASIN}.01._SCLZZZZZZZ_.jpg` — this format has since been completely deprecated by Amazon (returns 1x1 placeholder pixels for any ASIN now) and required a full image-health audit + fix during this overhaul (44/151 images were broken by the time it was caught).

**What "ToolRank" was as a concept:** (inferred from current positioning) likely a general product-recommendation/review aggregation site, later rebranded with a more specific identity and visual direction as "ClearPick."

---

## STAGE 2: Rebrand — ToolRank → ClearPick (still on Perplexity infrastructure)

At some point, the site was rebranded from "ToolRank" to **"ClearPick"** — adopting the "Every Review. One Clear Verdict." positioning. This rebrand initially happened while STILL on Perplexity's hosting infrastructure.

**Evidence of this era:**
- `index.html` and `faq.html` canonical tags pointed to `https://clearpick.pplx.app/...` — an intermediate domain showing the new "ClearPick" name was adopted, but the site was still on Perplexity's `.pplx.app` hosting before the final domain migration
- This means there were effectively THREE domain names in the codebase's history by the time of the big SEO audit: `toolrank.pplx.app` (oldest, on category/blog pages), `clearpick.pplx.app` (intermediate, on index/faq), and `clearpick.ca` (current/correct, already present on the 149 product pages' canonicals)

---

## STAGE 3: Migration to clearpick.ca (GitHub + Vercel)

The site was migrated to its current production setup: **custom domain clearpick.ca, GitHub repository, Vercel for hosting/auto-deploy**. The 149 product pages had already been updated to use `clearpick.ca` canonicals by this point, but category pages, blog pages, index.html, faq.html, about.html, and privacy.html were NOT all updated — they retained the stale `toolrank.pplx.app` / `clearpick.pplx.app` references from the earlier eras.

**This mismatch went undetected for some time** and had a real, measurable SEO cost: Google Search Console showed only **85 of 170 sitemap pages discovered/indexed**. When the stale canonical tags (telling Google "the authoritative version of this page lives at toolrank.pplx.app") were finally found and fixed across all remaining pages — plus fixing robots.txt's sitemap reference (also pointing to `clearpick.pplx.app`) — and the sitemap was resubmitted, **discovered pages jumped from 85 to 169 almost immediately**. This was one of the single highest-impact fixes of the entire overhaul, hiding in plain sight for an unknown period.

---

## STAGE 4: Transition to Claude Code for active local development

At some point, active development moved from Perplexity's Computer tool to **Claude Code**, running locally in a PowerShell terminal on the project owner's Windows PC, working directory `C:\clearpick`. This is the current and ongoing development model — see the main operational handoff document (`clearpick-handoff.md`) for full details on this setup, its constraints (restricted network access — can't reach Amazon/Reddit, etc.), and the working patterns established.

---

## STAGE 5: The Overhaul — multiple sessions of modernization (current, ongoing)

Once on Claude Code, a series of overhaul sessions began systematically modernizing the inherited Perplexity-era site. This has spanned **at least 3 major sessions** (this document is being written during session 3 of this effort, referred to internally as "session3-volume-push"). Major threads of work across these sessions:

- **Search overhaul** — built products.json-driven search across all pages, fixed broken navigation
- **Use-case label deduplication** — 52 labels fixed across categories (leftover inconsistencies from earlier content generation)
- **Homepage/nav fixes** — category cards, counts, hero copy
- **Mobile bug fixes** — a persistent sticky-CTA bug took 3 attempts to root-cause (turned out to be a desktop-only `position:sticky` leaking to mobile via a missing media query — likely an artifact of how the original Perplexity-built CSS was structured)
- **The canonical/robots SEO fix** (Stage 3 above) — arguably the highest-impact single fix, undoing years of accumulated domain-migration debt
- **Full rebrand of visual identity** — new logo (magnifier + checkmark), favicon, tagline, replacing whatever the ToolRank/early-ClearPick visual identity had been
- **New features built on top of the inherited base** — Compare feature, filter/sort, FAQ/methodology page, OG tags, header search
- **The image-health audit** — discovered and fixed 44/151 broken product images, all dating back to the original Stage 1 Amazon image URL format that Amazon has since deprecated. Also caught 2-3 products where the underlying product had been discontinued or the ASIN was simply wrong since the original Perplexity-era content creation
- **Establishing NEW standards going forward** — the 18-item standing checklist, per-product research standard, and Canadian-not-kitsch / honesty-first vision are all NEW conventions established during these overhaul sessions, representing a deliberate step up in rigor from however the original 149 products were created

---

## WHY THIS HISTORY MATTERS GOING FORWARD

1. **Not everything inherited from the Perplexity era meets current standards.** The original 149 products were built under different (less rigorous, less-documented) processes. The "backfill Sources & Further Reading + upgraded Real Buyers research for the original 149" to-do item exists specifically because of this gap — see main handoff doc.
2. **If something looks broken/weird and traces back to a `.pplx.app` reference, an `images-na.ssl-images-amazon.com` URL, or a `data-pplx-inline-edit` script — it's Stage 1/2 legacy, not a recent mistake.** These are known categories of "old era debt," most already cleaned up, but if more turn up, treat them the same way (audit, fix, document).
3. **The `lifehackfi0fb-20` vs `clearpick06-20` affiliate tags are BOTH valid** — different eras, same Associates account, no action needed.
4. **The current standards (18-item checklist, research structure, vision/principles in the main handoff doc) represent the "post-overhaul" bar.** Anything built going forward should meet this bar — it's a deliberate improvement over what came before, not just "how things have always been done."

For current operational details (environment setup, standing checklist, research process, active to-do list), see the companion document `clearpick-handoff.md`.
