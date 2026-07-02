# Review Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline execution — all edits share js/app.js; parallel subagents would conflict). Steps use checkbox syntax.

**Goal:** Implement the verified-defect fixes, accessibility subset, perf quick wins, share feature, and engineering guardrails from `docs/superpowers/specs/2026-07-02-review-improvements-design.md`.

**Architecture:** Surgical edits to the three-file ES5 app (index.html, js/app.js, js/data.js) plus a new `tests/validate-data.js` and self-hosted `fonts/`. No new abstractions beyond three small helpers (`trapFocus`, `copyShareLink`, `cycleSelection`) and two memo caches.

**Tech Stack:** ES5 vanilla JS, Canvas 2D, Node stdlib (validation script only), bash (deploy.sh).

## Global Constraints

- ES5 only: `var`, no arrow functions, no template literals, no let/const (in js/*.js; the Node-only `tests/` script may use modern JS but keep it dependency-free).
- No `innerHTML` anywhere (PreToolUse hook enforces).
- No external runtime dependencies; no build step; files load as plain `<script>`.
- Data lives in js/data.js (pure `var`), logic in js/app.js.
- Conventional commits; every change group references a GitHub issue (create before committing).
- Visual character preserved: muted dark palette may brighten only to the minimum passing contrast.

---

### Task 1: Data validation script (test infrastructure first)

**Files:** Create `tests/validate-data.js`. Modify `CLAUDE.md` (Housekeeping section, add usage) in Task 9.

**Checks contract (each prints PASS/FAIL + details, script exits 1 on any FAIL):**
1. `objects[]` names unique; `glossaryData[]` names unique.
2. Required fields by category: every object has `name,type,category,desc`; numeric `dist,x,y,radius`; color present. Report outliers only.
3. Every `tourDefs[*].steps[*].target` (when set) resolves in objects[] (case-exact). `simTimeJ2000` numeric when present.
4. Glossary sync: every object name appears in glossaryData names, OR in `glossaryObjMap` (regex-extract the literal from js/app.js `buildGlossary`), OR in the script's `GROUP_COVERED` allowlist (spiral arms, Cepheids, per CLAUDE.md).
5. catRanges coverage: objects without `visRange` must have `dist` inside `catRanges[category]` (±1% tolerance); flag never-visible objects.
6. `constellationDefs[*].lines` star names resolve in objects[].
7. Every `images[].src` / `gallery[].src` exists on disk relative to repo root.
8. `cam3dViewpoints`/`cam3dLookTargets`/`scenePresets` object references resolve (lookTargets may also name constellations).
9. `refDistances[]` values sane: each `ly` numeric > 0, sorted ascending.
10. `regions[]`: `minVR < maxVR`, both finite, no negatives.

Load mechanism: `vm.createContext({}); vm.runInContext(fs.readFileSync('js/data.js'), ctx)`.

- [ ] Write script; run `node tests/validate-data.js` → expect it to run and report (failures here feed Task 8 data fixes)
- [ ] Commit: `test: add data integrity validation script (housekeeping checklist automation)`

### Task 2: Correctness fixes (spec A1–A11)

**Files:** Modify `js/app.js` (guard 9572, draw2D ~5570/5666, readHash ~8511, keydown order ~9599/9628, applyScenePreset ~8016, resize ~266, init ~10111/10228, readHash clamp ~8494, touchend ~9772, goHome ~9079 + arrow block ~9660, drawMissionTrajectories ~2388), `index.html:640` (hint 1-6).

Key edits (all others are one-liners described in spec):
- A1: `var tag = e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;`
- A3: in readHash, replace `state.mode3d = true;` with `toggle3D();` (guarded: only when `!state.mode3d`), then apply cx/cy/cz/yaw/pitch/orbit params after, then `orbitToCamera()` when orbit restored.
- A7: in `loadSelectedObject` success path set `window._restoredSelection = true`; at init `if (!_restoredSelection) showWelcome(); else welcomeShowing = false;` — keep call order.

- [ ] Apply edits; reload app in browser: feedback textarea accepts spaces/letters; tour dropdown digit keys start tours; 3D deep-link reload shows 3D chrome; no console errors
- [ ] Commit: `fix: keyboard guard, 3D hash restore, draw2D vr hoisting, tour hotkeys, scene/tour conflict, dpr refresh, init order (+5 small fixes)`

### Task 3: Educational accuracy — era ladder + docs + credits (B1, B2, B4)

**Files:** Modify `js/app.js` `getHistoricalEvent` (~6433–6472), `showDocs` (~10186–10201), gallery credit (~6895).

Era ladder replacement (full logic):

```js
function getHistoricalEvent(distLy) {
  var yearsAgo = distLy;
  var launchYear = 2026 - yearsAgo;
  var yr = Math.round(launchYear);
  if (yearsAgo <= 0.002) return null;
  if (yearsAgo <= 0.01) return "this light was already en route when you woke up today";
  if (yearsAgo <= 0.1) return "this light left about " + (distLy * 365.25).toFixed(0) + " days ago";
  if (yearsAgo <= 1) return "this light left about " + yearsAgo.toFixed(1) + " years ago";
  if (launchYear >= 2015) return "this light left in " + yr + " — just a few years ago";
  if (launchYear >= 2007) return "this light left in " + yr + ", when smartphones were brand new";
  if (launchYear >= 1990) return "this light left in " + yr + ", when the internet was young";
  if (launchYear >= 1957) return "this light left in " + yr + ", during the Space Race";
  if (launchYear >= 1914) return "this light left in " + yr + ", in the era of the World Wars";
  if (launchYear >= 1865) return "this light left in " + yr + ", in the age of railroads and telegraphs";
  if (launchYear >= 1776) return "this light left in " + yr + ", before the American Civil War";
  if (launchYear >= 1492) return "this light left in " + yr + ", before the American Revolution";
  if (launchYear >= 1066) return "this light left in " + yr + " AD, before Columbus sailed to the Americas";
  if (launchYear >= 793) return "this light left in " + yr + " AD, during the Viking Age";
  if (launchYear >= 476) return "this light left in " + yr + " AD, in the early Middle Ages";
  if (launchYear >= -27) return "this light left when Rome was still an empire";
  if (launchYear >= -3100) return "this light left in the age of ancient Egypt";
  if (launchYear >= -8000) return "this light left at the dawn of agriculture and civilization";
  if (yearsAgo <= 40000) return "this light left during the last Ice Age";
  if (yearsAgo <= 100000) return "this light left when humans were first migrating out of Africa";
  if (yearsAgo <= 300000) return "this light left when Homo sapiens first appeared";
  if (yearsAgo <= 2.8e6) return "this light left when the first members of genus Homo appeared";
  if (yearsAgo <= 7e6) return "this light left when humans and chimpanzees last shared a common ancestor";
  if (yearsAgo <= 66e6) return "this light left when early primates evolved, after the dinosaurs";
  if (yearsAgo <= 240e6) return "this light left when dinosaurs ruled the Earth";
  if (yearsAgo <= 540e6) return "this light left when early life filled the ancient seas";
  if (yearsAgo <= 2.5e9) return "this light left when only single-celled life existed on Earth";
  if (yearsAgo <= 4.5e9) return "this light left when the Earth was young";
  if (yearsAgo <= 13.8e9) return "this light is older than the Earth itself";
  return "this light has been traveling for " + (yearsAgo / 1e9).toFixed(1) + " billion years";
}
```

Spot expectations: Betelgeuse 548 → "1478 AD, before Columbus sailed to the Americas"; Sirius 8.6 → "2017 — just a few years ago"; Deneb ~2600 → "when Rome was still an empire"; Andromeda 2.5 Mly → "genus Homo"; Virgo 53.2 Mly → "early primates, after the dinosaurs".

- Docs: rewrite "What's ahead" → keep spectrum view, volumetric rendering, server-backed catalog; move time simulation + glossary imagery into "How it was built" (past tense sentence each).
- Credit: `cred.textContent = item.credit || 'NASA/ESA/CSA/STScI';`

- [ ] Verify in browser (Betelgeuse card text) · Commit: `fix: historically accurate "when this light left" era ladder; refresh stale docs; per-image gallery credits`

### Task 4: Accessibility subset (C1–C10)

**Files:** Modify `index.html` (CSS tokens, aria attrs, autocomplete, hint), `js/app.js` (trapFocus, dialog wiring, buttons, reduced motion, wheel ctrlKey, keys G/?/brackets, docs h3, aria-labels).

New helpers (app.js, near feedback IIFE):

```js
function trapFocus(container, onClose) {
  var prevFocus = document.activeElement;
  function keyHandler(e) {
    if (e.key === 'Escape') { e.stopPropagation(); release(); if (onClose) onClose(); return; }
    if (e.key !== 'Tab') return;
    var els = container.querySelectorAll('button, input, textarea, select, a[href], [tabindex]');
    var list = [];
    for (var i = 0; i < els.length; i++) { if (!els[i].disabled && els[i].offsetParent !== null) list.push(els[i]); }
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function release() {
    document.removeEventListener('keydown', keyHandler, true);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  }
  document.addEventListener('keydown', keyHandler, true);
  return release;
}
```

Reduced motion (top of app.js, after state init): `var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);` — when true: default `effects.twinkling=false`, `effects.ambientParticles=false`, `effects.warpStreaks=false`; in `flyCamera`/`animateToTarget`/tour transitions multiply duration by 0 (jump cut). Keyboard cycle:

```js
function cycleSelection(dir) {
  var list = state.mode3d ? getVisibleObjects3D() : getVisibleObjects();
  if (!list.length) return;
  list = list.slice().sort(function(a, b) { return a.dist - b.dist; });
  var idx = -1;
  for (var i = 0; i < list.length; i++) if (list[i] === state.selected) { idx = i; break; }
  idx = (idx + dir + list.length) % list.length;
  var obj = list[idx];
  state.selected = obj; saveSelectedObject(obj.name); showInfo(obj); updateDocumentTitle(obj);
  if (!state.mode3d) { state.panX = obj.x; state.panY = obj.y; }
  state.dirty = true; updateHash();
}
```

Bindings in keydown: `[` → cycleSelection(-1), `]` → cycleSelection(1), `g`/`G` → same handler as `/` (open glossary + focus search), `?` → showWelcome(). Wheel: first line `if (e.ctrlKey) return;`. Feedback/lightbox wiring: `role="dialog" aria-modal="true"` (feedback: `aria-labelledby` pointing at its h3 — give it `id="fb-title"`), open → `_fbRelease = trapFocus(popover, closeFeedback)`; close → call `_fbRelease()`. Esc branch in global keydown also closes feedback if open. Scenes items/glossary category labels/slot options: `createElement('button')` with `type` unset + CSS `.scene-item { display:block; width:100%; text-align:left; background:none; border:none; font:inherit; }` additions (match for glossary-cat-label, slot-option). Contrast tokens in index.html (verify each with ratio calc): `#3a3a55→#8a8aa8` (cat-count), key-hint opacity `.35→.6`, `#5a5a7a→#8a8aa8` (cam-label), `#4a5a78→#7a8fb5` (narr btns), `#5a5a78→#8888a8` (credits ×2), `#5a6a8a→#7d8db0` (narration-scale), `#7a7a96→#8d8dab` (mode-btn, feedback-btn, tour-item-desc, zoom-control label, scene-item-desc, glossary-entry-cat/short where <4.5), borders `#4a4a66→#6a6a88` (inputs), `#2a2a44→#4a4a68` (preset borders, toggle track, slider track), scale-bar-line `#3a3a55→#5a5a7c`. aria: remove `aria-live` from zoom/scale labels; add `aria-label="Filter glossary"`; autocomplete name/email; docs headings via `document.createElement('h3')` (styled as before). Canvas aria-label + hint updated to mention `[`/`]` cycling and G.

- [ ] Verify: keyboard-only walk (G, ?, brackets select + announce, Esc closes feedback with focus restore, scenes reachable by Tab), ctrl+wheel zooms page; ratio script over changed tokens all ≥4.5/3.0 · Commit: `feat(a11y): dialogs, keyboard object cycling, reduced-motion, contrast, ctrl+wheel passthrough (WCAG 2.1 AA subset)`

### Task 5: Performance quick wins (D1–D5)

**Files:** Modify `js/app.js` (animationLoop ~6408, mousemove ~8709, getViewRadius/getScale ~137/301, updatePlanetPositions ~460–480).

- D1: `var _lastAmbientTick = 0;` guard: `if ((effects.twinkling || effects.ambientParticles) && !document.hidden && ts - _lastAmbientTick > 45) { _lastAmbientTick = ts; state.dirty = true; }` (subsumes D4 for this path).
- D2: cache rect (`var _canvasRect = null;` invalidate in resize/scroll), coalesce: mousemove stores `_pendingHover = {x,y}` and only marks a `_hoverCheck` flag; animationLoop (or a rAF scheduled once) resolves hover; `state.dirty = true` only when `newHover !== state.hoverObj`.
- D3 memoize:

```js
var _vrCacheZoom = NaN, _vrCacheVal = 0;
function getViewRadius() {
  if (state.zoom === _vrCacheZoom) return _vrCacheVal;
  _vrCacheZoom = state.zoom;
  _vrCacheVal = sliderToViewRadius(state.zoom);
  return _vrCacheVal;
}
```
(equivalent pattern for `getScale` keyed on `state.zoom|W|H`; invalidate W/H key via resize()).
- D5: replace the three Pluto/Charon scans with `findObject('Pluto')`/`findObject('Charon')`.

- [ ] Verify: idle CPU drops (observe rAF cadence via console counter before/after), hover still highlights, all presets render identically · Commit: `perf: idle redraw gating, hover coalescing, view-radius/scale memoization, Pluto lookup via index`

### Task 6: Share link + dynamic title + social metadata (E1–E3)

**Files:** Modify `js/app.js` (showInfo button + `updateDocumentTitle` + preset/select call sites + copy helper), `index.html` head (meta description, OG/Twitter tags), top bar (share button `id="share-btn"` styled like docs-btn).

```js
function updateDocumentTitle(obj) {
  document.title = obj && obj.name ? displayName(obj) + ' — Cosmic Distance Explorer' : 'Cosmic Distance Explorer';
}
function copyShareLink(btn) {
  updateHash();
  setTimeout(function() {
    var url = window.location.href;
    function done(ok) {
      var prev = btn.textContent;
      btn.textContent = ok ? 'Link copied!' : 'Copy failed';
      setTimeout(function() { btn.textContent = prev; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function() { done(true); }, function() { done(legacyCopy(url)); });
    } else done(legacyCopy(url));
  }, 350);
}
function legacyCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta); ta.select();
  var ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  return ok;
}
```
(The 350ms wait lets the debounced `updateHash` write the fresh hash first; call `updateHash` implementation's timer at 300ms.) showInfo: add "🔗 Copy link to this object" button below light-pulse (same styling pattern, `aria-label`). Top bar: `Share` button → same helper. Title updates: in showInfo (object), preset click handler (preset label), and on `info-close`/deselect → default title. Meta tags: description ("Interactive map of the universe — zoom from Earth orbit to the Great Attractor. Built for students."), `og:title/description/url/image` (`https://cosmos.eusd.org/img/jwst-pillars.jpg`), `twitter:card=summary_large_image`, `theme-color #0a0a12`.

- [ ] Verify: button copies URL that restores state in a new tab; tab title tracks selection · Commit: `feat: shareable view links, dynamic page title, social metadata`

### Task 7: Self-hosted fonts + deploy targets + hygiene (F2–F4)

**Files:** Create `fonts/*.woff2` (8 files: Orbitron 400/600/800, Rajdhani 300/400/600, Space Mono 400/700 — fetch via Google Fonts API css2 with a woff2 UA, download URLs). Modify `index.html` (replace 3 Google `<link>`s with 8 `@font-face` blocks, `font-display: swap`), `deploy.sh` (target arg + full img/fonts sync), `.gitignore` (+`.playwright-mcp/`), rewrite `AGENTS.md` as pointer.

deploy.sh contract: `./deploy.sh [bill|skippy|all]`, default `all`; per-host functions; sync `index.html js/ img/ fonts/`; keep stamp logic; final message reflects targets.

- [ ] Verify: local serve shows fonts loading from /fonts/ (network panel), HUD renders in Orbitron; `bash -n deploy.sh` · Commit: `chore: self-host webfonts, deploy.sh per-host targets + full asset sync, repo hygiene`

### Task 8: data.js corrections (B3 — from data-checker report)

**Files:** Modify `js/data.js` (+ possibly `js/app.js` glossaryObjMap) per the data-accuracy agent's verified findings; apply only clear-cut errors (>15% numeric error or factually wrong text), cite each in the commit body. Re-run `node tests/validate-data.js` → must be green (fix any structural findings it surfaced in Task 1 here too).

- [ ] Commit: `fix(data): astronomy corrections from accuracy review` (list each correction in body)

### Task 9: CLAUDE.md sync (F5)

**Files:** Modify `CLAUDE.md`: validation script under Housekeeping ("Run `node tests/validate-data.js`"), fonts/ in file structure + deploy list, deploy.sh targets, updated line counts, era-ladder note under patterns, share/title feature mentions in key functions.

- [ ] Commit: `docs: CLAUDE.md — validation script, fonts, deploy targets, new features`

### Task 10: Full verification & deploy (bill)

- [ ] `node tests/validate-data.js` green
- [ ] Playwright sweep: presets 1–6 screenshots vs CLAUDE.md checklist; feedback textarea typing; tour digit keys; 3D deep-link reload; share copy; era labels (Betelgeuse/Sirius/Andromeda cards); G/?/brackets; Esc/focus; console clean
- [ ] `./deploy.sh bill` from worktree; `curl` live site for new cache-buster + fonts path; Playwright against https://cosmos.eusd.org
- [ ] Update tasks; final report

## Self-review notes

Spec coverage: A1–A11→T2, B1/B2/B4→T3, B3→T8, C1–C10→T4, D1–D5→T5, E1–E3→T6, F1→T1, F2–F4→T7, F5→T9, verification/deploy→T10. Type consistency: `trapFocus` returns release fn, stored `_fbRelease`; `cycleSelection` uses existing `getVisibleObjects*`/`saveSelectedObject`/`showInfo`; `updateDocumentTitle` defined T6, referenced T4's cycleSelection — implement stub-safe (T4 guards with `typeof updateDocumentTitle === 'function'` or land T6 helper name early in T4; resolution: define `updateDocumentTitle` in Task 4 and reuse in Task 6).
