# Galactic Orbital Motion — Design Spec

## Overview
Replace linear proper motion extrapolation with physically accurate galactic orbital motion for all objects. Add a background stellar density field that visualizes billions of stars as flowing particles through spiral arm density waves.

## Motion Systems (by scale)

### 1. Milky Way objects (stars, nebulae, clusters, exotics)
**Galactic rotation** around the galactic center (Sgr A* at x=-26000, y=0).

Each object gets orbital parameters derived from its position:
- `galR` — galactocentric radius (distance from Sgr A*)
- `galAngle0` — initial galactic azimuthal angle at J2000
- `galZ0` — initial height above/below galactic midplane
- `galPeriod` — orbital period from rotation curve: `T = 2π × galR / V(galR)` where V ≈ 220 km/s ≈ 7.14e-6 ly/s (flat rotation curve)
- `zPeriod` — vertical oscillation period (~64 Myr, scales weakly with galR)
- `zAmp` — vertical oscillation amplitude (derived from current galZ0, assuming currently near max displacement)

**Position update each frame:**
```
years = getSimDaysJ2000() / 365.25
galAngle = galAngle0 + (years / galPeriod) * 2π
x = galCenterX + galR * cos(galAngle)
y = galCenterY + galR * sin(galAngle)
z = zAmp * sin(2π * years / zPeriod + zPhase0)
```

**Proper motion blending:** For timescales < 10,000 years, add the linear proper motion delta on top of galactic rotation. This preserves accurate short-term stellar motion (relevant for real-time or low speed). Beyond 10,000 years, galactic rotation alone drives position (proper motion clamping already in place).

### 2. Local Group galaxies
Known peculiar velocities applied as linear motion vectors (accurate over ~1 Gyr timescales):
- Andromeda: -110 km/s radial approach (collision in ~4.5 Gyr)
- LMC: ~320 km/s orbital motion around MW
- SMC: ~300 km/s orbital motion around MW
- Triangulum (M33): approaching MW at ~44 km/s
- Satellite dwarfs: simplified orbital motion around host galaxy

Data format per galaxy: `{ vx, vy, vz }` in ly/yr, applied linearly. For satellite galaxies, circular orbit around host at current separation distance.

### 3. Cosmic scale
- **Hubble flow**: recession velocity `v = H₀ × d` where H₀ ≈ 70 km/s/Mpc ≈ 7.2e-12 ly/yr/ly. Objects move radially away from observer at this rate.
- **Great Attractor infall**: Local Group peculiar velocity of ~600 km/s toward Great Attractor, applied as bulk flow to all Local Group+ objects.
- Applied only at timescales > 1 Myr (irrelevant at human timescales).

## Density Field Particle System

### Purpose
Visualize the ~200-400 billion Milky Way stars as a flowing particle field. Shows differential rotation, density wave bunching in spiral arms, and gives a populated sky at all zoom levels.

### Particle generation (at init)
Two separate populations that cross-fade by zoom level (avoids unnatural clumping at galaxy scale):

**Local particles (200)** — stellar neighborhood:
- galR: Sun's galactocentric radius ± 500 ly
- galAngle0: Sun's galactic angle ± spread for 500 ly arc
- Visible at vr < 2000 ly, fade out 1000-2000
- Gives a populated sky at stellar/constellation zoom

**Galactic particles (800)** — full disk:
- galR: uniform across 0-50,000 ly galactocentric radius
- galAngle0: uniform random [0, 2π]
- Visible at vr > 1000 ly, fade in 1000-2000
- Even distribution — no clump at Sun's position

Both populations share the same properties per particle:
- `{ galR, galAngle0, galZ, brightness, size }`
- galZ: gaussian, σ ≈ 500 ly (thin disk)
- brightness: 0.1-0.5 (dimmer than named objects)
- size: 0.3-0.8 px (clearly smaller than real objects)

### Per-frame update
Same galactic rotation formula as real objects:
```
galAngle = galAngle0 + (years / period(galR)) * 2π
wx = galCenterX + galR * cos(galAngle)
wy = galCenterY + galR * sin(galAngle)
```

### Density wave interaction
Spiral arm pattern speed: Ωp ≈ 28 km/s/kpc ≈ 9.1e-7 rad/yr.
Arm positions at time t:
```
armAngle(R, t) = ln(R/a)/b + armOffset + Ωp * years
```
where a, b are the same logarithmic spiral parameters from `drawSpiralArms`.

A particle's angular distance from the nearest arm center determines its brightness boost:
- Inside arm (within 15° of arm center): brightness × 2.5, size × 1.5
- Arm edge (15°-25°): brightness × 1.5
- Inter-arm: base brightness

This creates the visual effect of stars bunching in arms and thinning between them, all while orbiting independently.

### Rendering
- **2D**: `worldToScreen()` → `fillRect()` (same as asteroid belt)
- **3D**: `worldToScreen3D()` → `fillRect()` (same as 3D asteroid belt)
- **Visibility**: Always visible from stellar scale through galaxy scale. Fade out beyond 250,000 ly (extragalactic zoom).
- **Non-interactive**: No hover, no click, no label. Purely ambient.
- **Performance gate**: Skip if `_perfReduced` is true and frame count is odd (draw every other frame on slow devices).

### Caching
Build particle array once at init (`buildGalacticParticleCache()`). Per-frame update is just angle increment + trig — no allocation, no cache rebuild.

## Data Changes (data.js)

### New constants
```javascript
var GAL_CENTER_X = -26000;  // Sgr A* position in ly
var GAL_CENTER_Y = 0;
var GAL_V_CIRC = 7.33e-4;  // 220 km/s in ly/yr
var GAL_PATTERN_SPEED = 9.1e-7; // spiral arm pattern angular speed (rad/yr)
var GAL_Z_PERIOD = 64e6;    // vertical oscillation period (years)
```

### Per-object data
No new data arrays needed. Galactic orbital parameters are computed at init from each object's existing (x, y) position relative to the galactic center. Stored as `_galR`, `_galAngle0`, `_galPeriod`, `_galZ0`, `_zAmp`, `_zPhase0` on each object during `initObjects3D()`.

### Galaxy peculiar velocities
New data declaration in data.js:
```javascript
var galaxyMotion = {
  'Andromeda (M31)': { vx: 0.0116, vy: -0.0058, vz: 0 },  // ~110 km/s approach
  'Large Magellanic Cloud': { vx: -0.020, vy: 0.025, vz: 0.012 },
  'Small Magellanic Cloud': { vx: -0.015, vy: 0.020, vz: 0.010 },
  'Triangulum (M33)': { vx: 0.003, vy: -0.004, vz: 0 }
  // etc.
};
```

## Code Changes (app.js)

### Modified functions
- `updateStellarPositions()` → rewritten to use galactic rotation + z-oscillation + proper motion blending
- `initObjects3D()` → compute galactic orbital parameters from initial positions

### New functions
- `buildGalacticParticleCache()` — generate 1000 background particles at init
- `updateGalacticParticles(years)` — update particle positions per frame
- `drawGalacticParticles()` — render in 2D (called from draw2D after drawSpiralArms)
- `drawGalacticParticles3D()` — render in 3D (called from draw3D after drawSpiralArms3D)
- `updateGalaxyMotion(years)` — apply peculiar velocities + Hubble flow to extragalactic objects
- `galacticPeriod(galR)` — orbital period from rotation curve

### Spiral arm changes
- `drawSpiralArms()` rotation parameter becomes time-dependent: `rotation = 0.82 + GAL_PATTERN_SPEED * years`
- Spiral arms now rotate at the pattern speed, not fixed. Stars orbit faster, flowing through the arms.

## Performance
- 1000 particles × 1 cos + 1 sin per frame = trivial
- Same rendering cost as asteroid belt (fillRect per particle)
- Density wave brightness check: 1 comparison per particle per frame
- Galactic rotation for ~100 real objects: same cost as current proper motion
- Total additional per-frame cost: ~2000 trig operations + 1000 fillRect — well within budget

## Verification
1. **Solar System zoom, real-time**: planets orbit normally, nearby stars show subtle proper motion
2. **Nearest Stars zoom, 1 yr/sec**: proper motion visible for high-PM stars (Barnard's)
3. **Constellations zoom, 100 yr/sec**: constellation shapes distort as stars move independently
4. **Milky Way zoom, 1 Myr/sec**: stars visibly orbit galactic center, differential rotation visible (inner faster), z-oscillation visible as vertical bobbing
5. **Milky Way zoom, 100 Myr/sec**: full galactic orbits visible, stars flow through spiral arms (density enhancement visible), arms rotate slowly
6. **Local Group zoom, 100 Myr/sec**: Andromeda visibly approaches
7. **Great Attractor zoom, 1 Gyr/sec**: Hubble flow visible — distant objects recede
