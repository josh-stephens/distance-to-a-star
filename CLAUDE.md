# Cosmic Distance Explorer

## Project Overview
Interactive visualization of cosmic distances from Earth to the Great Attractor. No external dependencies, ES5 only.

## File Structure
```
index.html         # Markup + CSS (~620 lines)
js/data.js         # Pure data declarations (~1300 lines)
js/app.js          # All application logic (~8700 lines)
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
- **Error logging**: `animationLoop` catch block logs errors with `console.error` — never silently swallow rendering errors

## Data Architecture (`js/data.js`)
- `AU_IN_LY`, `MLY`, `KM_IN_LY`, `MIN_LOG`, `MAX_LOG` — Unit constants
- `ORBIT_CLOSE_KM`, `ORBIT_FAR_KM`, `ORBIT_RADIUS_MULT` — 3D orbit distance constants
- `GAL_CENTER_X/Y`, `GAL_V_CIRC`, `GAL_PATTERN_SPEED`, `GAL_Z_PERIOD` — Galactic dynamics constants
- `galaxyMotion{}` — Peculiar velocities (approach/orbit) for Local Group galaxies
- `HUBBLE_RATE` — Hubble constant in ly/yr/ly
- `asteroidBeltConfig` — Belt inner/outer AU, count, color, Kirkwood gap positions
- `orbitalPlaneData{}` — Keplerian elements (sma, ecc, inc, lan, aop, M0, period) for planets + Ceres
- `rotationData{}` — Sidereal rotation periods and axial tilts
- `properMotionData{}` — Proper motions (pmRA, pmDec, rv) for 27 nearby stars
- `artemisIILaunchJ2000`, `artemisIITrajectory[]` — Artemis II mission trajectory data
- `apolloLandingTraj[]`, `apollo8Traj[]`, `apollo13Traj[]` — Shared Apollo trajectory profiles
- `objects[]` — Celestial objects with position, distance, category, visual properties, facts
- `glossaryData[]` — Educational entries with name, category, color, short/long descriptions, optional `images[]`
- `regions[]` — Structural regions (orbits, arms, clusters) with visibility ranges
- `refDistances[]` — Reference distance comparisons (Earth→Sun through Local Group diameter)
- `tourDefs{}` — Guided tour definitions with steps, narration, zoom targets (steps support `simTimeJ2000`, `timeSpeed`)
- `catRanges{}` — Category-level visibility ranges for object filtering
- `effects{}` — Visual effect toggles and settings (includes `galacticParticles`, `missionTrajectories`)
- `constellationDefs{}` — Constellation line patterns and metadata
- `cosmicFilamentNodes[]`, `cosmicFilamentLinks[]`, `cosmicVoids[]` — Large-scale structure
- `cam3dViewpoints[]`, `cam3dLookTargets[]` — 3D camera slot defaults (8+8)
- `categoryLayers{}` — Per-category interior layer definitions for overlay rendering
- `scenePresets[]` — 3D scene configurations (camera, time, effects)
- **Data placement rule**: trajectory/mission `var` declarations MUST go OUTSIDE `objects[]` array (can't have `var` inside array literal)

## Critical Patterns — Read Before Changing

### Visibility System
- Objects filtered by `catRanges[category]` or per-object `visRange: [min, max]` in light-years
- Filter uses 1% tolerance: `vr < range[0] * 0.99 || vr > range[1] * 1.01` (prevents float edge cases)
- **Fade zones**: 15% fade at far edge of visRange; near-edge fade SKIPPED when `range[0] < 0.01` (prevents objects vanishing at close zoom)
- `_visFade` alpha multiplier (0-1) stored per object, applied by `drawObject` and label rendering
- **Selected objects bypass range checks** — always visible regardless of catRange/visRange
- Sun has `visRange: [0, 250]` — must ALWAYS be visible in 2D
- **Dual Sun**: "Sun" (solar) hidden in 3D when camDist > 100 ly; "Sun (You Are Here)" (galaxy) hidden when camDist < 100 ly
- `catRanges.stellar = [0.3, 2000]` — extended to prevent dead zone between stellar and galaxy scales
- **No `Infinity` in visibility ranges** — use `400 * MLY` as upper bound

### Object Sizing (2D)
- `dr = max(cosmetic * solarScale, physRadius * scale)` for solar/stellar only
- Cosmic objects (clusters, Great Attractor) use cosmetic radius only — physRadius = gravitational extent
- `drawObjectDetail` receives `dr` as its `r` parameter (not base radius)
- `detailScale = r / (obj.radius || 1)` — only used for Voyager spacecraft line widths

### Satellite Separation (2D)
- Moon and Charon have separate 2D (`x`, `y`) and 3D (`wx3d`, `wy3d`, `wz3d`) positions
- 2D positions exaggerated via `satMinSep()` to prevent visual overlap at wide zoom
- `satMinSep` mirrors `drawObject` sizing formula to stay in sync

### Pluto-Charon Binary
- Both orbit their shared barycenter (outside Pluto's surface)
- `baryX/baryY/baryZ` from Pluto's Keplerian orbit, then both offset from it
- Period: 6.387 days, `plutoBaryDist = 2.23e-10 ly`, `charonBaryDist = 1.845e-9 ly`

### Sun in 3D
- "Sun" (category solar) is ONLY rendered in 3D when camera < 100 ly from origin
- "Sun (You Are Here)" (category galaxy) takes over at stellar+ distances
- Sun must pass `isStar()` check for proper limb-darkened rendering (not planet terminator)
- Stars keep their glow when physically resolved (`glowFade` exemption)

### Camera-Relative Rendering (3D Precision)
- `worldToScreen3D` uses coordinates relative to `_cam3dOriginX/Y/Z` (set to orbit focal point each frame)
- Camera offset `_cam3dRelX/Y/Z` computed directly from orbit geometry — NEVER from `cam3d.px - focalX` (loses precision)
- `orbitToCamera()` computes look angles from orbit offset directly, not `computeLookAngles` with world coords
- Eliminates catastrophic cancellation when subtracting large nearly-equal coordinates
- Without this, objects vanish below ~10 km orbit distance; with it, visible down to ~9 meters
- `viewZ <= 1e-20` threshold in worldToScreen3D (was 1e-12 which was too aggressive for close orbits)

### Mission Trajectory System
- Time-bounded objects: `_missionActive` flag, hidden outside launch-to-splashdown window
- `missions[]` array in `updatePlanetPositions()` — each entry: `{ name, launchJ2000, traj }`
- Trajectory: array of `[hours, distance_km, angle_offset_rad]` waypoints, 200-point interpolation for rendering
- Uses sim time (`getSimDaysJ2000()`) not wall-clock — plays at user's time speed
- Auto-follow engaged for selected mission spacecraft
- Tour steps support `simTimeJ2000` and `timeSpeed` to control simulation clock
- Selected post-mission objects stay visible at Earth (not hidden off-map)

### Galactic Motion System
- Three tiers: galactic rotation (MW objects), galaxy peculiar velocities (Local Group), Hubble flow (cosmic)
- Galactic params computed at init: `_galR`, `_galAngle0`, `_galPeriod`, `_galBaseX/Y`, `_galBase3dX/Y/Z`
- 2D positions updated from galactic orbit delta; 3D positions rotated around galactic center axis
- `o.dist` computed from 3D positions (`sqrt(wx3d² + wy3d² + wz3d²)`), NOT from 2D map coords
- Satellite galaxies use circular orbits (not linear velocities which cause escape trajectories)
- `GAL_PATTERN_SPEED` — verify unit conversions with dimensional analysis (km/s/kpc → rad/yr)
- Density field: 200 local + 800 galactic particles, cross-fade at 1000-2000 ly zoom
- Per-particle perf reduction (skip every other particle), NOT per-frame (causes synchronized blinking)

### Glossary Image Framework
- `glossaryData` entries support `images: [{ src, caption, credit }]` — rendered as 2x2 grid, lazy-loaded
- `objects[]` entries support `gallery: [{ src, title, text }]` — large stacked cards in info panel
- Both use click-to-lightbox. Images stored in `img/`, deployed via `deploy.sh`

### Shared Helpers
- `isStar(obj)` — returns true for stellar, exotic, Sun, Sun (You Are Here)
- `hash3(i, seed)` — deterministic pseudo-random triple (replaces inline sin-hash)
- `findObject(name)` — O(1) lookup via `_objectByName` index
- `nameHash(name, seed)` — string-to-number hash for procedural features

### Per-Frame Caching
- `_orbitCache` — Keplerian orbit paths pre-computed at init (not per frame)
- `_asteroidCache` — 800 asteroid positions pre-computed at init
- `_cosY`, `_sinY`, `_cosP`, `_sinP` — camera trig cached at top of draw3D
- `_vignetteGradient` — recreated only on canvas resize
- `_objectByName` — name→object map built once at init
- `_presetBtns` — cached querySelectorAll result
- `_lastScaleLabel`, `_lastZoomLabel` — change-detection guards for aria-live elements

### Orbit Rendering
- `drawOrbits()` reads from `_orbitCache` (pre-computed Keplerian paths)
- `drawAsteroidBelt()` reads from `_asteroidCache` (pre-computed positions)
- Both only visible when `vr < 0.003` (solar system scale)

## Housekeeping Checklist
Run this checklist after adding new objects or features:

### Glossary Sync
Every object in the `objects[]` array should have a corresponding entry in `glossaryData[]` (or be covered by a `glossaryObjMap` mapping). To check:
1. List all unique object names from `objects[]`
2. List all glossary entry names from `glossaryData[]`
3. Check `glossaryObjMap` in `buildGlossary()` for indirect mappings
4. Any object not in glossary or mapped should get a glossary entry

Group entries are acceptable for:
- Spiral arms -> "Spiral Arms" concept entry
- Individual Cepheid variables -> "Cepheid Variables" concept entry
- "Sun (You Are Here)" / "Milky Way (You Are Here)" -> mapped via glossaryObjMap

### Category Ranges
When adding objects to a category, verify `catRanges` still covers the new object's distance appropriately. Objects can override with `visRange`.

### Region Boundaries
When adding objects at new distance scales, check if any `regions[]` entry needs its `minVR`/`maxVR` adjusted.

### Object Name Index
After adding objects to `objects[]`, `buildObjectNameIndex()` runs at init and populates `_objectByName`. New objects are automatically indexed. Use `findObject(name)` for lookups.

### Orbit/Asteroid Caches
If modifying `orbitalPlaneData` or `asteroidBeltConfig`, the caches (`buildOrbitCache`, `buildAsteroidCache`) rebuild at init automatically.

### Visual Verification
After changes, verify at each zoom preset:
1. Solar System — planets visible, properly spaced, asteroid belt dots, Ceres labeled
2. Nearest Stars — stellar neighborhood populated, Sun visible
3. Constellations — constellation lines, bright stars labeled
4. Milky Way — spiral arms, clusters, nebulae visible, smooth transition from stellar scale
5. Local Group — satellite galaxies, Andromeda, Triangulum visible
6. Great Attractor — cosmic filaments, voids, galaxy clusters visible, no objects popping out at max zoom

## Deployment
- **Deploy script**: `./deploy.sh` — rsyncs `index.html` + `js/` + `img/` to bill and skippy
- **Cache busting**: deploy.sh auto-stamps `?v=YYYYMMDDHHMMSS` on script tags before upload (Cloudflare 4h cache)
- **Auto-deploy**: `pre-push` git hook runs `deploy.sh` when pushing to `main`
- **bill**: `cosmos.eusd.org` — `/opt/caddy/sites-content/distance-to-a-star/`
- **skippy**: `cosmos.711bf.org` — `/var/www/cosmos/`
- **Cloudflare**: `cf-cache-status: HIT` with 4h TTL — always bump cache-buster on deploy or files won't update

## Key Functions (`js/app.js`)
- `navigateToObject(name)` — Zoom+pan to frame an object (2D animation)
- `navigateToObject3D(name)` — Fly camera to object in 3D
- `updatePlanetPositions()` — Keplerian mechanics + satellite offsets (Moon, Charon, Pluto barycenter)
- `updateStellarPositions()` — Galactic rotation + z-oscillation + proper motion blending
- `updateGalaxyMotion()` — Galaxy peculiar velocities + Hubble flow
- `drawMilkyWayBand3D()` — Luminous galactic band in 3D sky view
- `drawGalacticParticles()` / `drawGalacticParticles3D()` — Density field particles (2D/3D)
- `drawMissionTrajectories()` / `drawMissionTrajectories3D()` — Mission path lines (2D/3D)
- `drawOrbits()` — Cached Keplerian orbit ellipse paths
- `drawAsteroidBelt()` — Cached procedural asteroid dots with Kirkwood gaps
- `drawSpiralArms(...)` — Logarithmic spiral galaxy renderer
- `drawCosmicFilaments()` — Large-scale structure at supercluster scale
- `drawSunIndicator()` — Always-visible Sun position marker (when Sun object not drawn)
- `buildGlossary()` — Constructs glossary panel with search/filter
- `getVisibleObjects()` — Filters objects by zoom level and viewport (with 1% tolerance)
- `flyCamera()` — 3D camera fly animation (scaled by `tourEngine.transitionSpeed`)
- `lookAtTarget()` — 3D camera lock-on with tracking
- `orbitToCamera()` — Computes camera position in orbit mode (respects tracking)
- `isStar(obj)` — Shared star detection predicate
- `hash3(i, seed)` — Deterministic pseudo-random triple
- `findObject(name)` — O(1) name lookup via cached index
- `satMinSep(parentR, parentPhys, satR, satPhys)` — Minimum 2D satellite separation

## Tour Engine
- `tourEngine.transitionSpeed` — Fly speed multiplier (0.5x-3x)
- `tourEngine.autoAdvance` — When false, timer fills but doesn't auto-advance
- `tourEngine.narrationCollapsed` — Persists collapsed card state across steps

## Categories
Objects: solar, stellar, nebula, cluster, exotic, galaxy, local, cosmic
Glossary: Solar System, Stars, Nebulae, Galaxies & Clusters, Extreme Phenomena, Concepts

## 2D Follow Mode
- `state.follow` — object reference, pan continuously updated in draw2D
- Set by double-click, cleared by manual pan/drag
- `navigateToObject` animation tracks live position when follow is set

## 3D Camera Tracking
- `cam3d.trackTarget` — key string for look-at lock-on
- `orbitToCamera()` — free orbit with look-at override (user controls yaw/pitch, camera always faces target)
- Tracking persists across "View from" changes
- Look-at engagement preserves current orbit distance (doesn't yank camera away)
