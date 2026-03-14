# Cosmic Distance Explorer

## Project Overview
Interactive visualization of cosmic distances from Earth to the Great Attractor. No external dependencies, ES5 only.

## File Structure
```
index.html         # Markup + CSS (~490 lines)
js/data.js         # Pure data declarations (~920 lines)
js/app.js          # All application logic (~5900 lines)
deploy.sh          # rsync-based deploy to bill + skippy
```
Files load via `<script>` tags in order, sharing globals. No modules (ES5 constraint).

## Code Conventions
- **ES5 only**: `var` declarations, no arrow functions, no template literals, no `let`/`const`
- **No innerHTML**: All DOM manipulation uses `createElement()`/`textContent` (enforced by PreToolUse hook)
- **Data in `js/data.js`**: Pure `var` declarations only — no functions, no DOM access
- **Logic in `js/app.js`**: All functions, state, rendering, interaction, initialization
- **State pattern**: Single `state` object, `updateAll`-style rendering
- **Canvas rendering**: 2D context with `devicePixelRatio` scaling

## Data Architecture (`js/data.js`)
- `AU_IN_LY`, `MLY`, `MIN_LOG`, `MAX_LOG` — Unit constants
- `objects[]` — Celestial objects with position, distance, category, visual properties, facts
- `glossaryData[]` — Educational entries with name, category, color, short/long descriptions
- `regions[]` — Structural regions (orbits, arms, clusters) with visibility ranges
- `refDistances[]` — Reference distance comparisons shown in bottom-right
- `tourDefs{}` — Guided tour definitions with steps, narration, zoom targets
- `catRanges{}` — Category-level visibility ranges for object filtering
- `effects{}` — Visual effect toggles and settings
- `constellationDefs{}` — Constellation line patterns and metadata
- `cosmicFilamentNodes[]`, `cosmicFilamentLinks[]`, `cosmicVoids[]` — Large-scale structure
- `cam3dViewpoints[]`, `cam3dLookTargets[]` — 3D camera slot defaults (8+8)

## Housekeeping Checklist
Run this checklist after adding new objects or features:

### Glossary Sync
Every object in the `objects[]` array should have a corresponding entry in `glossaryData[]` (or be covered by a `glossaryObjMap` mapping). To check:
1. List all unique object names from `objects[]`
2. List all glossary entry names from `glossaryData[]`
3. Check `glossaryObjMap` in `buildGlossary()` for indirect mappings
4. Any object not in glossary or mapped should get a glossary entry

Group entries are acceptable for:
- Spiral arms → "Spiral Arms" concept entry
- Individual Cepheid variables → "Cepheid Variables" concept entry
- "Sun (You Are Here)" / "Milky Way (You Are Here)" → mapped via glossaryObjMap

### Tour Coverage
Tours should reference objects that exist in the data. When adding new notable objects, consider if they should appear in an existing tour or warrant a new tour.

### Category Ranges
When adding objects to a category, verify `catRanges` still covers the new object's distance appropriately. Objects can override with `visRange`.

### Region Boundaries
When adding objects at new distance scales, check if any `regions[]` entry needs its `minVR`/`maxVR` adjusted.

### Visual Verification
After changes, verify at each zoom preset:
1. Solar System — planets visible, properly spaced
2. Nearest Stars — stellar neighborhood populated
3. Milky Way — spiral arms, clusters, nebulae visible
4. Local Group — satellite galaxies, Andromeda, Triangulum visible
5. Great Attractor — cosmic filaments, voids, galaxy clusters visible

## Deployment
- **Deploy script**: `./deploy.sh` — rsyncs `index.html` + `js/` to bill and skippy
- **Auto-deploy**: `pre-push` git hook runs `deploy.sh` when pushing to `main`
- **bill**: `cosmos.eusd.org` — `/opt/caddy/sites-content/distance-to-a-star/`
- **skippy**: `cosmos.711bf.org` — `/var/www/cosmos/`
- **No `Infinity` in visibility ranges** — use `400 * MLY` as upper bound (matches MAX_LOG). Infinity corrupts `navigateToObject` via `Math.sqrt(lo * Infinity) = Infinity`.

## Key Functions (`js/app.js`)
- `navigateToObject(name)` — Zoom+pan to frame an object
- `panTowardTargetOnZoomIn()` — Zoom pulls toward selected object (or Sol)
- `drawSpiralArms(...)` — Logarithmic spiral galaxy renderer
- `drawCosmicFilaments()` — Large-scale structure at supercluster scale
- `drawSunIndicator()` — Always-visible Sun position marker
- `buildGlossary()` — Constructs glossary panel with search/filter
- `getVisibleObjects()` — Filters objects by zoom level and viewport
- `flyCamera()` — 3D camera fly animation (scaled by `tourEngine.transitionSpeed`)
- `saveSlotConfig()` / `loadSlotConfig()` — 3D camera slot persistence via localStorage

## Tour Engine
- `tourEngine.transitionSpeed` — Fly speed multiplier (0.5x–3x)
- `tourEngine.autoAdvance` — When false, timer fills but doesn't auto-advance
- `tourEngine.narrationCollapsed` — Persists collapsed card state across steps

## Categories
Objects: solar, stellar, nebula, cluster, exotic, galaxy, local, cosmic
Glossary: Solar System, Stars, Nebulae, Galaxies & Clusters, Extreme Phenomena, Concepts
