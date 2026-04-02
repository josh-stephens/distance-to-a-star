# Milky Way Band + Smooth Visibility Transitions — Design Spec

## Overview
Two related changes: (1) render the Milky Way as a luminous band across the 3D sky when viewing from within the galaxy, and (2) replace hard visibility cutoffs with smooth alpha fades for all objects in both 2D and 3D.

## Part 1: Milky Way Band in 3D

### Rendering
- Project ~60 sample points along the galactic plane great circle at ~100,000 ly from camera
- Draw as overlapping gradient-filled strips between consecutive projected points
- Apparent width: ~15 degrees, gaussian falloff at edges
- Brightness varies with galactic longitude: brightest toward Sgr A* (galactic center), ~3x dimmer toward anticenter
- Dark dust lane: narrow darker stripe down the center
- Color: warm white-blue (#c8c0d8) with yellowish brightening toward center

### Visibility
- Full opacity when camera < 20,000 ly from galactic plane
- Smooth fade to zero by 50,000 ly
- Not rendered when camera > 50,000 ly (outside galaxy)

### Rendering order
After starfield background, before constellation lines and all objects. The band is the most distant visual element.

### Settings
- `effects.galacticParticles` (default true) — toggles the density field particles from #70. The glow band itself is always on when inside the galaxy (controlled by camera distance only).

### New code
- `drawMilkyWayBand3D()` function in app.js
- Called from `draw3D()` after `drawStarfield(ts)`, before `drawConstellationLines3D()`

## Part 2: Smooth Visibility Transitions

### Current behavior
Objects use hard cutoffs with 1% tolerance:
```
if (vr < range[0] * 0.99 || vr > range[1] * 1.01) return false;
```
Objects pop in/out abruptly at visibility range boundaries.

### New behavior
Add a 15% fade zone at both edges of each object's visibility range. When an object is within the fade zone, compute an alpha multiplier (0-1) that ramps linearly:

```
fadeZone = (range[1] - range[0]) * 0.15
if vr < range[0] + fadeZone: alpha = (vr - range[0]) / fadeZone
if vr > range[1] - fadeZone: alpha = (range[1] - vr) / fadeZone
otherwise: alpha = 1.0
```

Store as `obj._visFade` on each visible object. Draw functions multiply this into their rendering alpha.

### Files modified
- `getVisibleObjects()` — compute `_visFade` for each object that passes range check
- `computeVisibilityScore()` (3D) — incorporate fade into visibility score
- `drawObject()` — multiply `_visFade` into glow and detail rendering alpha
- Object labels — fade label alpha with `_visFade`

### Edge cases
- Objects with `visRange: [0, ...]` — no fade at the near edge (always visible at closest zoom)
- The Sun (`visRange: [0, 250]`) — fades at 250 ly boundary, no pop
- Regions — same fade treatment for their `minVR`/`maxVR` boundaries

## Performance
- Milky Way band: ~60 worldToScreen3D projections + ~30 gradient fills per frame. Similar cost to drawSpiralArms3D.
- Visibility fade: one extra comparison per object per frame (negligible).
- Particle toggle: saves ~1000 fillRect calls when disabled.
