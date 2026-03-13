# Cosmic Distance Explorer

## Project Overview
Single-file HTML playground (`cosmic-distances.html`) — interactive visualization of cosmic distances from Earth to the Great Attractor. All CSS/JS inline, no external dependencies.

## Code Conventions
- **ES5 only**: `var` declarations, no arrow functions, no template literals, no `let`/`const`
- **No innerHTML**: All DOM manipulation uses `createElement()`/`textContent` (enforced by PreToolUse hook)
- **Single file**: Everything in `cosmic-distances.html` — CSS in `<style>`, JS in `<script>`
- **State pattern**: Single `state` object, `updateAll`-style rendering
- **Canvas rendering**: 2D context with `devicePixelRatio` scaling

## Data Architecture
- `objects[]` — Celestial objects with position, distance, category, visual properties, facts
- `glossaryData[]` — Educational entries with name, category, color, short/long descriptions
- `regions[]` — Structural regions (orbits, arms, clusters) with visibility ranges
- `refDistances[]` — Reference distance comparisons shown in bottom-right
- `tourDefs{}` — Guided tour definitions with steps, narration, zoom targets
- `catRanges{}` — Category-level visibility ranges for object filtering
- `effects{}` — Visual effect toggles and settings

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
- **Deploy script**: `./deploy.sh` — copies `cosmic-distances.html` to bill and skippy
- **Auto-deploy**: `pre-push` git hook runs `deploy.sh` when pushing to `main`
- **bill**: `cosmos.eusd.org` — `/opt/caddy/sites-content/distance-to-a-star/index.html`
- **skippy**: `cosmos.711bf.org` — `/var/www/cosmos/index.html`
- **No `Infinity` in visibility ranges** — use `400 * MLY` as upper bound (matches MAX_LOG). Infinity corrupts `navigateToObject` via `Math.sqrt(lo * Infinity) = Infinity`.

## Key Functions
- `navigateToObject(name)` — Zoom+pan to frame an object
- `drawSpiralArms(...)` — Logarithmic spiral galaxy renderer
- `drawCosmicFilaments()` — Large-scale structure at supercluster scale
- `drawSunIndicator()` — Always-visible Sun position marker
- `buildGlossary()` — Constructs glossary panel with search/filter
- `getVisibleObjects()` — Filters objects by zoom level and viewport

## Categories
Objects: solar, stellar, nebula, cluster, exotic, galaxy, local, cosmic
Glossary: Solar System, Stars, Nebulae, Galaxies & Clusters, Extreme Phenomena, Concepts
