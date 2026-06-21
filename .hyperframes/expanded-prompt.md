# ClearPick "How It Works" Reel — Production Spec

## Title + Style Block

**Brand:** ClearPick — light canvas UI mockup. The video LOOKS like a zoomed-in screen recording of the ClearPick website UI, then transitions to cinematic title cards.

**Palette (all exact):**
- `#F8F9FC` — background (all scenes)
- `#14162A` — primary text, product names, card titles
- `#5C6080` — secondary text, sources, subtext, labels
- `#1A8CFF` — score blue, category labels, source callouts, progress bars
- `#16A34A` — green left border on buyer quote card
- `#DC2626` — red left border on complaint card
- `#EEF0F6` — card backgrounds
- `#E2E4EE` — progress bar tracks, borders
- `#FFFFFF` — score card background

**Font:** system-ui / Inter, weight 700 for hero display, 500 for UI labels, 400 for body text.

**Mood:** Clean, honest, editorial. Not flashy. Feels like a well-designed fintech or product review app — credible, direct.

---

## Rhythm Declaration

`HOOK — PUNCH — bridge — evidence-BUILD — evidence-BUILD — REVEAL — exhale — CTA`

- S1 (0–2s): HOOK — bold statement, cinematic entrance
- S2 (2–4s): PUNCH — hard snap cut, single big word moment
- S3 (4–5.5s): bridge — secondary voice sets up the demo
- S4–S6 (5.5–14s): evidence BUILD — product header → quote → complaint accumulate on screen
- S7 (14–17s): REVEAL — score card, counter animation, bars fill
- S8 (17–17.5s): exhale — simple tagline
- S9 (17.5–18s): CTA — logo + URL

---

## Global Rules

- **Transitions:** Primary = blur crossfade 0.35–0.4s power2.inOut. Exception: S1→S2 is a hard cut (snap). S7→S8 and S8→S9 are simple crossfades.
- **Hard-kill after every exit:** `tl.set(scene, { opacity: 0, filter: "blur(0px)", scale: 1 }, T+duration+0.05)` after each outgoing crossfade.
- **All tweens on `tl`**, never standalone `gsap.to()`.
- **`fromTo` everywhere** — no bare `tl.from()` except where element has a single transform in one tween.
- **Density:** 8–10 visual elements per scene. Ghost text and bg glows count.
- **Animations start at t+0.1** minimum, never at t=0.

---

## Per-Scene Beats

### Scene 1 (0–2s) — "Most review sites are paid to be nice."

**Concept:** The frame opens dark with a bold claim. The typography IS the content — wide, self-assured. This isn't a slide deck. It's a verdict.

**Mood:** Editorial confidence. Clean WSJ headline energy, not tech-ad energy.

**Depth layers:**
- BG: `#F8F9FC` solid + blue radial glow (#1A8CFF at 4% opacity, 900px diameter, centered)
- BG ghost text: "REDDIT • AMAZON • FORUMS • RTINGS" — 80px, #5C6080 at 4% opacity, rotated -6°, wide, bleeding off left edge
- MG: Step indicator "01" top-left corner in small monospace
- MG: Headline text "Most review sites are paid to be nice." — 68px, weight 700, #14162A, max-width 860px, natural wrap
- FG: Hairline rule 2px, #E2E4EE, 520px wide, below headline, scaleX 0→1 on enter
- FG: Bottom step attribution micro-text "01 / 09  ·  clearpick.ca" at 14px, #5C6080

**Animation choreography:**
- Ghost text DRIFTS in from left, settling slowly (2s ease)
- Headline FADES + SCALES UP (0.97→1.0), ease power3.out, 0.8s
- Step indicator SLIDES from x:-20, 0.5s expo.out
- Rule DRAWS right scaleX 0→1, 0.6s power2.out
- Bg glow slowly BREATHES (scale 1→1.08, sine.inOut, 1.8s)

**Transition out:** Hard cut at t=2.0 (no exit animation). Scene 2 snaps over.

---

### Scene 2 (2–4s) — "We're not."

**Concept:** The counter-argument lands like a door slamming. Biggest text in the video. Feels disproportionately large — that's the point. The size IS the emphasis.

**Mood:** Direct confrontation. No decoration. The text is the whole scene.

**Depth layers:**
- BG: `#F8F9FC` + blue radial glow (larger, 800px, center)
- MG: Pre-rule — 3px solid #1A8CFF, 120px wide, centered above text
- MG: Headline "We're not." — 100px, weight 700, #14162A, centered
- MG: Post-rule — 3px solid #1A8CFF, 120px wide, centered below text
- FG: Step "02" bottom-left, 14px monospace, #5C6080 at 70%
- FG: Ghost "2/9" watermark top-right, large, 5% opacity

**Animation choreography:**
- Pre-rule SNAPS in scaleX 0→1, 0.2s power4.out at t=2.05
- Headline SLAMS from scale 1.08→1.0, opacity 0→1, y -15→0, 0.15s power4.out at t=2.08
- Post-rule SNAPS in, 0.2s power4.out at t=2.15
- Step indicator FADES in, 0.3s at t=2.2

**Transition out:** Blur crossfade 0.35s at t=4.0.

---

### Scene 3 (4–5.5s) — "Here's how we actually score a product."

**Concept:** Tone shift — we move from confrontation to demonstration. Secondary voice, calmer energy. Prepares the viewer for the evidence.

**Depth layers:**
- BG: `#F8F9FC` + radial glow subtle
- BG ghost: "SOURCE CHECK" oversized text, 6% opacity, #1A8CFF tint
- MG: Three source icons (📱 💬 🎯) in a row, centered
- MG: Body text "Here's how we actually score a product." — 40px, weight 400, #5C6080, centered, max-width 800px
- FG: Step indicator "03" micro-text, bottom

**Animation choreography:**
- Icons FLOAT up from y:20, 0.5s power3.out, slight stagger
- Body text FADES + SLIDES from y:30, 0.6s power2.out at t+0.1 after icons

**Transition out:** Blur crossfade 0.4s at t=5.5.

---

### Scene 4–6 (5.5–14s) — Product header accumulates cards

**Concept:** The camera holds while evidence materializes. First the product card. Then real buyer sentiment — the good and the ugly — slide up from below. By the end, three items are stacked on screen: the product being reviewed, a glowing endorsement, and a real complaint. ClearPick shows both.

**Depth layers:**
- BG: `#F8F9FC` + blue radial glow top-center, 500px, 5% opacity
- BG: subtle horizontal hairlines, 1px, #E2E4EE, at 30% and 70% height, full-width, 3% opacity
- MG: Product header card (white bg, 2px #E2E4EE border, 12px radius):
  - Category label: "KITCHEN & DINING" — 18px, weight 500, #1A8CFF, uppercase, letter-spacing 0.15em
  - Product name: "Ninja Air Fryer Max XL AF161" — 34px, weight 700, #14162A
  - Pill badge: "Best Air Fryer for Crispy Results" — 18px, #1A8CFF on #E8F0FE bg, 6px radius, 10px/20px padding
- MG (at t=8): Quote card (#EEF0F6 bg, 4px left border #16A34A, 10px radius):
  - Quote: italic 22px, weight 400, #14162A
  - Source: "Amazon reviewer" 17px, #1A8CFF
- MG (at t=11.5): Complaint card (#EEF0F6 bg, 4px left border #DC2626, 10px radius):
  - Title: 22px, weight 500, #14162A
  - Body: 20px, weight 400, #5C6080
  - Source: 17px, #1A8CFF
- FG: Step "04" micro-text, fades out when cards appear

**Animation choreography:**
- Header slides up from y:40, opacity 0→1, 0.6s power3.out at t=5.8
- Category label SLIDES from x:-20, expo.out, 0.5s
- Product name SLIDES from y:20, power3.out, 0.6s  
- Pill badge SCALES from 0.9, back.out(1.4), 0.4s
- Divider rule DRAWS right at t=7.8
- Quote card SLIDES UP from y:100, 0.7s power3.out at t=8.0
- Complaint card SLIDES UP from y:100, 0.7s power3.out at t=11.5

**Transition out:** Blur crossfade 0.5s at t=14.0.

---

### Scene 7 (14–17s) — ClearPick Score card

**Concept:** The verdict. After seeing both sides of buyer sentiment, the camera reveals the score. The number counting up is the payoff — it earns the "8.4" through accumulation of evidence.

**Depth layers:**
- BG: `#F8F9FC` + blue glow behind card (larger, 600px, #1A8CFF at 6%)
- MG: Score card (white bg, 1px #E2E4EE border, 16px radius, generous padding):
  - Header: ✓ checkmark in #1A8CFF 20px circle, "CLEARPICK SCORE" 14px caps #5C6080
  - Score number: counts 0.0→8.4 over 1.5s, 100px weight 700, #1A8CFF
  - "/10" 36px #5C6080, "Very Good" 22px #5C6080
  - 4 progress bars (label, fill, number) staggered 150ms
- FG: Ambient glow pulse on the card shadow

**Animation choreography:**
- Card SCALES + FADES in (0.96→1, opacity 0→1), 0.6s power3.out at t=14.4
- Header fades in from y:-10, 0.4s power2.out
- Score number SCALES from 0.8, back.out(1.2), 0.4s
- Counter COUNTS UP from 0.0→8.4 via onUpdate, 1.5s power2.out starting t=14.7
- Progress bars fill LEFT→RIGHT, staggered 150ms, 0.6s power3.out each, starting t=14.8
- "Very Good" fades in last at t=15.5

**Transition out:** Crossfade 0.35s at t=17.0.

---

### Scene 8 (17–17.5s) — "No sponsors. No fluff."

**Concept:** Clean exhale. The promise in two short phrases.

**Depth layers:**
- BG: `#F8F9FC`
- MG: "No sponsors. No fluff." — 32px, weight 400, #5C6080, centered

**Animation choreography:**
- Tagline FADES + SLIDES from y:15, 0.3s power2.out

**Transition out:** Crossfade 0.25s at t=17.5.

---

### Scene 9 (17.5–18s) — ClearPick Logo

**Concept:** Brand mark lands clean. No animation excess — just the logo, then the URL.

**Depth layers:**
- BG: `#F8F9FC` (fades from scene 8)
- MG: Blue circle (48px diameter, #1A8CFF) with white ✓ checkmark, "ClearPick" 48px weight 700 #14162A — inline flex row
- FG: "clearpick.ca" 24px weight 400 #5C6080 below logo row

**Animation choreography:**
- Circle SCALES from 0.7, back.out(1.4), 0.4s
- Wordmark FADES + SLIDES from x:-10, 0.35s power2.out
- URL FADES in, 0.3s power1.out, slight delay

---

## Recurring Motifs

- Blue radial glow: present in every scene at varying opacity/size
- Horizontal hairlines: scene 1, 4-6 (structural elements)
- Step indicator micro-text: scenes 1-4 (bottom corner)
- Source citation in blue (#1A8CFF): ties quote cards and website labels to the brand color

---

## Negative Prompt

- No dark backgrounds — stay on #F8F9FC throughout
- No exit animations on elements BEFORE transitions (transition IS the exit)
- No `repeat: -1` on any tween
- No `gsap.to()` outside of `tl` (ambient animations must be on the timeline)
- No `<br>` in text content — use max-width for wrapping
- No absolute-positioned content containers
- No hard-coded pixel heights on flex children
