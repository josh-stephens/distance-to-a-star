# Review-Driven Improvements — Design

**Date:** 2026-07-02
**Status:** Approved via standing user instruction ("do a thorough review… implement your ideas in a worktree. deploy to the eusd repo.") — autonomous session.
**Inputs:** Four specialist review passes (bug hunt, performance, accessibility/mobile, data accuracy) over `index.html` + `js/app.js` (10,240 lines) + `js/data.js`, plus a hands-on Playwright UX pass and a live-site/deploy-path check.

## Goals

1. Fix every *verified* defect that affects correctness, accessibility, or educational accuracy.
2. Surface the app's existing deep-link capability as a shareable feature for teachers.
3. Add the missing engineering guardrails (data validation script, deploy targeting, dependency hygiene).
4. Keep every change surgical: ES5 only, no innerHTML, no frameworks, no build step, visual character preserved.

## Non-Goals (deferred to recommendations report)

Object-list a11y panel, high-contrast/classroom display modes, px→rem refactor, semantic ul/dl refactor of glossary/info panel, glow-sprite atlas + offscreen starfield compositing, quality auto-scaling tiers, mobile top-bar redesign (#36), command palette (#37), label collision avoidance.

## Approach

Single worktree branch `worktree-review-improvements`, ~10 grouped conventional commits, each mapped to a GitHub issue (project convention). Chosen over (a) one mega-commit — unreviewable; and (b) subagent-parallel implementation — rejected because nearly all edits land in one shared 10k-line file where parallel agents would conflict.

## Design by Group

### A. Correctness fixes (all verified at exact lines)

| # | Fix | Design |
|---|-----|--------|
| A1 | Global keydown swallows typing in feedback `<textarea>` (space toggles pause, letters fire shortcuts) | Extend guard at app.js:9572 to `INPUT || TEXTAREA || isContentEditable` |
| A2 | `vr` used 92 lines before its declaration in `draw2D` → anti-pop-off recenter dead | Declare `var vr = getViewRadius()` at top of draw2D; downgrade line 5666 to assignment |
| A3 | 3D deep links restore state but not chrome (slider/hint/scale-bar linger, camera bar missing) | In `readHash`, enter 3D via `toggle3D()` (single source of chrome truth), then overwrite camera/orbit from params |
| A4 | Tour-dropdown digit hotkeys 1–6 shadowed by zoom presets | Move the open-dropdown digit branch above the `presetKeys` branch |
| A5 | Picking a Scene mid-tour leaves tour timers fighting the scene camera | `if (tourEngine.active) tourEngine.stop()` at top of `applyScenePreset` |
| A6 | `dpr` captured once → blurry after browser zoom / monitor change | Recompute `dpr` first thing in `resize()` |
| A7 | `showWelcome()` at init overwrites the restored last-session selection panel | Skip welcome when a selection was restored (set `welcomeShowing = false`) |
| A8 | `readHash` zoom not clamped to slider range | Clamp to [0,1000] |
| A9 | Lifting one finger mid-pinch leaves touch state stuck (no pan, no pinch) | On `touchend` with 1 remaining touch, re-init pan tracking |
| A10 | `goHome()`/arrow-pan mutate hidden 2D state in 3D mode | Early-return guards in 3D |
| A11 | Dead first `strokeStyle` computation in `drawMissionTrajectories` | Remove dead expression |

### B. Educational accuracy

**B1 — "When this light left" ladder rewrite.** Root cause: every bucket's label describes the *far* edge of its range (548 ly → "Viking Age" though 1478 AD; 30 Mly-scale buckets similarly shifted: 6–66 Mya labeled "dinosaurs" though dinosaurs died at 66 Mya). Redesign: historical eras keyed on **launch year** (2026 − yearsAgo) with each label true across its whole span; geological eras keyed on yearsAgo with corrected boundaries:

- ≥2015 "just a few years ago" · ≥2007 smartphones new · ≥1990 internet young · ≥1957 Space Race · ≥1914 World Wars era · ≥1865 railroads & telegraphs · ≥1776 before the Civil War · ≥1492 before the Revolution · ≥1066 before Columbus · ≥793 Viking Age · ≥476 early Middle Ages · ≥−27 Rome an empire · ≥−3100 ancient Egypt · ≥−8000 dawn of agriculture
- ≤40 ky last Ice Age · ≤100 ky humans leave Africa · ≤300 ky Homo sapiens appears · ≤2.8 My genus Homo · ≤7 My chimp–human split · ≤66 My early primates after the dinosaurs · ≤240 My dinosaurs rule · ≤540 My early life in ancient seas · ≤2.5 Gy single-celled life · ≤4.5 Gy young Earth · ≤13.8 Gy older than Earth itself
- Sub-year buckets (light-hours/days/years) unchanged — they were correct.

**B2 — Docs panel refresh.** "What's ahead" still lists time simulation and glossary imagery as future; both shipped (issues #55/#56/#65). Move to past tense in "How it was built"; keep spectrum view / volumetric rendering / server-backed as future.

**B3 — data.js factual corrections** from the data-accuracy agent (report pending at spec time; apply clear-cut numeric/text errors only, cite each in the commit).

**B4 — Gallery credit** is hardcoded `NASA/ESA/CSA/STScI` for all images; read per-image `credit` with that string as fallback.

### C. Accessibility (WCAG 2.1 AA targeted subset)

- **C1 Contrast:** raise failing tokens computed by the audit — `#3a3a55` count text, key-hint opacity 0.35→0.6, `#5a5a7a` cam-label, `#4a5a78` narration buttons, `#5a5a78` credits, `#5a6a8a` narration-scale, and the `#7a7a96` pairings at 4.27–4.47:1 → `#8a8aa8`+ per background; input/button borders `#4a4a66`→`#6a6a88`, toggle/slider tracks →`#4a4a68` with visible thumb. Verify each ≥4.5:1 (text) / ≥3:1 (UI) at implementation with a ratio script.
- **C2 Dialog semantics:** shared ES5 `trapFocus(container)` helper; feedback popover gets `role=dialog aria-modal=true aria-labelledby`, Esc-close, focus trap, focus-restore; image lightbox gets Esc-close + focus handling.
- **C3:** remove `aria-live` from `#zoom-label`/`#scale-label` (SR chatter); keep `#info-name`.
- **C4:** `aria-label` on glossary search, effects sliders, cam-slot filter input.
- **C5 Reduced motion:** read `prefers-reduced-motion` at init → disable twinkle/ambient defaults and make tour/camera transitions jump-cuts (duration ≈ 0).
- **C6:** Scenes items, glossary category headers, slot-dropdown options become real `<button>`s (keyboard + SR operable).
- **C7:** wheel handler passes `ctrlKey` events through (`if (e.ctrlKey) return;`) so ctrl+wheel/trackpad browser zoom works — the Chromebook magnification path.
- **C8:** Docs section titles become real `<h3>`; feedback fields get `autocomplete="name"/"email"`.
- **C9 Keyboard selection:** `[`/`]` cycle selection through currently visible objects (nearest-first), announcing via the existing `aria-live` info panel; `G` opens glossary (welcome card already promises it); `?` shows the welcome/help card.
- **C10 Copy consistency:** hint "Keys 1-5"→"1-6"; welcome "G" row → "G or /"; hint/docs mention new keys.

### D. Performance quick wins (small, safe subset of the perf report)

- **D1:** Twinkle/ambient dirty-forcing gated to ~22 fps via wall-clock accumulator (idle CPU/battery win; interactions still render at full rate).
- **D2:** Hover handler — coalesce mousemove into rAF, cache `getBoundingClientRect`, set `state.dirty` only when the hovered object actually changes.
- **D3:** Memoize `getViewRadius()`/`getScale()` per (zoom, canvas size) — removes ~1,000 `Math.pow`/frame at particle-heavy scales.
- **D4:** Skip animation-forced redraws while `document.hidden`.
- **D5:** `updatePlanetPositions` Pluto scans → `findObject('Pluto')` (cached index exists).

Deferred: glow-sprite atlas, offscreen starfield, label caches, particle alpha-binning, constellation-focus caching, vignette tiering (recommendations only).

### E. Product features

- **E1 Share:** "Copy link to this view" button in the info panel (per selected object) + `Copy view link` affordance in the top bar; uses the existing hash state; `navigator.clipboard` with `execCommand('copy')` fallback; transient "Copied!" confirmation. No new URL format — the hash already encodes everything.
- **E2 Dynamic title:** `document.title = "<Object> — Cosmic Distance Explorer"` on selection / preset change (WCAG 2.4.2 + share/history legibility).
- **E3 Social metadata:** meta description + Open Graph/Twitter card tags pointing at `https://cosmos.eusd.org` with a JWST image.

### F. Engineering

- **F1 `tests/validate-data.js`:** Node script (vm-loads data.js, regex-extracts `glossaryObjMap` from app.js) automating the CLAUDE.md housekeeping checklist: unique names, per-category required fields, tour-target resolution, glossary sync, catRange coverage, constellation refs, image paths on disk, viewpoint/scene refs, refDistances sanity, region bounds. Exit 1 on failure. Wired into CLAUDE.md.
- **F2 `deploy.sh` targets:** `./deploy.sh [bill|skippy|all]` (default `all`, preserving pre-push hook behavior); sync all of `img/` (not `*.jpg` only) + new `fonts/`.
- **F3 Self-hosted fonts:** download woff2 for Orbitron 400/600/800, Rajdhani 300/400/600, Space Mono 400/700 → `fonts/`; local `@font-face` with `font-display: swap`; drop Google Fonts `<link>`s (removes external dependency, render-blocking CSS, and third-party requests from a school site).
- **F4 Hygiene:** `.playwright-mcp/` gitignored; `AGENTS.md` committed as a pointer to CLAUDE.md (constraints summary, no duplicated body → no drift).
- **F5 CLAUDE.md:** document validation script, fonts dir, deploy targets, corrected file sizes.

## Error handling

- Clipboard: feature-detect `navigator.clipboard`; fall back to a temporary textarea + `execCommand`; on total failure show the URL in a prompt for manual copy.
- Fonts: `@font-face` + system fallbacks already listed in every font stack — missing font files degrade silently to system fonts.
- Validation script: pure Node stdlib; refuses to run (clear message) if data.js fails to parse.
- readHash 3D path: all parsed values `parseFloat` + `isNaN`-guarded (existing pattern preserved).

## Verification

1. `node tests/validate-data.js` green (after B3 data corrections).
2. Playwright against the worktree build: six-preset visual checklist (CLAUDE.md), feedback textarea typing (space works), tour digit hotkeys, 3D deep-link reload chrome, share button copy, era-label spot checks (Betelgeuse → "before Columbus…"), G//?/bracket keys, Esc behavior, zero console errors.
3. Contrast ratios recomputed for every changed token.
4. Live-site check after deploy (bill only — user asked for eusd; skippy deliberately untouched).

## Deploy

`./deploy.sh bill` from the worktree (after F2). Cache-buster stamping retained. Branch left for review; merge/PR decision presented to user at the end (pushing `main` would auto-deploy both hosts via pre-push hook — not done autonomously).
