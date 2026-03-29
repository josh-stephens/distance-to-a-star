// ─── Moved from data.js (pure var declarations only in data.js) ─────
function standardOrbitDist(obj) {
  var physR = (obj && obj.physRadius) || 0;
  var minDist = (obj && obj.category === 'solar') ? ORBIT_CLOSE_LY : ORBIT_FAR_LY;
  return Math.max(minDist, physR * ORBIT_RADIUS_MULT);
}

// ─── Shared helpers ──────────────────────────────────────────────────

function isStar(obj) {
  return obj.category === 'stellar' || obj.category === 'exotic' ||
         obj.name === 'Sun' || obj.name === 'Sun (You Are Here)';
}

function hash3(i, seed) {
  var h1 = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; h1 -= Math.floor(h1);
  var h2 = Math.sin(i * 269.5 + seed * 183.3) * 43758.5453; h2 -= Math.floor(h2);
  var h3 = Math.sin(i * 419.2 + seed * 77.9) * 43758.5453; h3 -= Math.floor(h3);
  return { a: h1, b: h2, c: h3 };
}

// ─── Object name index ──────────────────────────────────────────────

var _objectByName = {};

function buildObjectNameIndex() {
  _objectByName = {};
  for (var i = 0; i < objects.length; i++) {
    _objectByName[objects[i].name] = objects[i];
  }
}

function findObject(name) {
  return _objectByName[name] || null;
}

// ─── Caches ─────────────────────────────────────────────────────────

var _orbitCache = {};
var _asteroidCache = [];
var _cosY = 1, _sinY = 0, _cosP = 1, _sinP = 0;
var _vignetteW = 0, _vignetteH = 0, _vignetteGrad = null;
var _presetBtns = null;

function buildOrbitCache() {
  _orbitCache = {};
  var STEPS = 90;
  for (var name in orbitalPlaneData) {
    var elem = orbitalPlaneData[name];
    var points = [];
    for (var si = 0; si <= STEPS; si++) {
      var fakeDays = si * elem.period / STEPS;
      var pos = keplerPosition(elem, fakeDays - elem.M0 * elem.period / 360);
      points.push({ x: pos.x * AU_IN_LY, y: pos.y * AU_IN_LY });
    }
    _orbitCache[name] = points;
  }
}

function buildAsteroidCache() {
  _asteroidCache = [];
  var belt = asteroidBeltConfig;
  var range = belt.outerAU - belt.innerAU;
  var gaps = belt.kirkwoodGaps;

  for (var i = 0; i < belt.count; i++) {
    var h = hash3(i, 1);
    var h1 = h.a, h2 = h.b, h3 = h.c;

    var t = (h1 + h2) * 0.5;
    var rAU = belt.innerAU + t * range;

    var inGap = false;
    for (var g = 0; g < gaps.length; g++) {
      if (Math.abs(rAU - gaps[g].au) < gaps[g].width) { inGap = true; break; }
    }
    if (inGap) continue;

    var angle = h3 * Math.PI * 2;
    var rLY = rAU * AU_IN_LY;
    var wx = rLY * Math.cos(angle);
    var wy = rLY * Math.sin(angle);
    var sz = 0.5 + h1 * 1.0;
    _asteroidCache.push({ wx: wx, wy: wy, rLY: rLY, sz: sz });
  }
}

// ─── Slider / View helpers ──────────────────────────────────────────

function viewRadiusToSlider(vr) {
  return ((Math.log10(vr) - MIN_LOG) / (MAX_LOG - MIN_LOG)) * 1000;
}
function sliderToViewRadius(s) {
  return Math.pow(10, MIN_LOG + (s / 1000) * (MAX_LOG - MIN_LOG));
}

for (var k in presets) presets[k].slider = Math.round(viewRadiusToSlider(presets[k].vr));

// ─── State ─────────────────────────────────────────────────────────────

var state = {
  zoom: 0,
  panX: 0, panY: 0,       // world-coordinate center of viewport
  selected: null,
  activePreset: null,
  warpIntensity: 0,
  dirty: true,
  hoverObj: null,
  hoverIconPos: null,
  mode3d: false,
  follow: null,             // 2D: object to keep centered (set by dbl-click)
  lastPanX: 0, lastPanY: 0, lastZoom: 0  // saved 2D state when entering 3D
};

// ─── 3D Camera ──────────────────────────────────────────────────────────

var cam3d = {
  px: 0, py: 0, pz: 0,    // position in light-years (0,0,0 = Sun/Earth)
  yaw: 0, pitch: 0,       // look direction in radians
  fov: 60,                 // field of view in degrees
  trackTarget: null        // key from cam3dLookTargets, or null
};

var cam3dAnim = { active: false, startTime: 0, duration: 0, from: null, to: null };

var orbitMode = {
  active: false,
  focalX: 0, focalY: 0, focalZ: 0,
  focalName: 'Sol',
  orbitYaw: 0, orbitPitch: 0, orbitDist: 10,
  focalAnim: { active: false, startTime: 0, duration: 0,
               fromX: 0, fromY: 0, fromZ: 0,
               toX: 0, toY: 0, toZ: 0, toName: '' }
};

var hudStyle = 'cinematic';
var hudStyles = {
  cinematic: { nameFont: '600 88px Orbitron, -apple-system, system-ui, sans-serif',
               nameColor: 'rgba(200, 210, 230, 0.85)',
               distFont: '12px Space Mono, Space Mono, SF Mono, Menlo, monospace',
               distColor: 'rgba(140, 170, 140, 0.7)' },
  minimal: { nameFont: '300 64px Rajdhani, -apple-system, system-ui, sans-serif',
             nameColor: 'rgba(180, 190, 200, 0.5)',
             distFont: '10px Space Mono, Space Mono, SF Mono, Menlo, monospace',
             distColor: 'rgba(120, 140, 120, 0.4)' },
  bold: { nameFont: '800 112px Orbitron, -apple-system, system-ui, sans-serif',
          nameColor: 'rgba(255, 255, 255, 0.95)',
          distFont: '14px Space Mono, Space Mono, SF Mono, Menlo, monospace',
          distColor: 'rgba(100, 200, 255, 0.8)' },
  retro: { nameFont: '56px Space Mono, SF Mono, Menlo, Courier, monospace',
           nameColor: 'rgba(0, 255, 100, 0.8)',
           distFont: '12px Space Mono, SF Mono, Menlo, Courier, monospace',
           distColor: 'rgba(0, 200, 80, 0.6)' },
  'retro-sm': { nameFont: '14px Space Mono, SF Mono, Menlo, Courier, monospace',
                nameColor: 'rgba(0, 255, 100, 0.8)',
                distFont: '12px Space Mono, SF Mono, Menlo, Courier, monospace',
                distColor: 'rgba(0, 200, 80, 0.6)' }
};

var frameFlash = { active: false, x: 0, y: 0, startTime: 0, color: '#ffffff' };
var pendingLabels = [];
var parallaxState = { active: false, progress: 0, constellation: null, shiftK: 0, shiftAngle: 0, animId: null, label: '', flashAlpha: 0 };

// ─── Particle systems ──────────────────────────────────────────────────

var twinkleStars = [];
var warpParticles = [];
var flowParticles = [];
var ambientParticles = [];

function initParticles() {
  var i;
  for (i = 0; i < 200; i++) {
    twinkleStars.push({
      x: Math.random(), y: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 2.0,
      baseAlpha: 0.1 + Math.random() * 0.5,
      size: 0.5 + Math.random() * 1.8,
      bright: Math.random() > 0.8
    });
  }
  for (i = 0; i < 80; i++) {
    warpParticles.push({
      angle: Math.random() * Math.PI * 2,
      baseRadius: 0.1 + Math.random() * 0.4,
      speed: 0.3 + Math.random() * 1.5,
      length: 0.05 + Math.random() * 0.15,
      brightness: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2
    });
  }
  for (i = 0; i < 120; i++) {
    flowParticles.push({
      sourceIdx: Math.floor(Math.random() * 5),
      t: Math.random(),
      speed: 0.0003 + Math.random() * 0.0007,
      offset: (Math.random() - 0.5) * 0.15
    });
  }
  for (i = 0; i < 50; i++) {
    ambientParticles.push({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00005,
      vy: (Math.random() - 0.5) * 0.00005,
      alpha: 0.03 + Math.random() * 0.08,
      size: 0.5 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2
    });
  }
}

// ─── Canvas setup ──────────────────────────────────────────────────────

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var W, H;

// Adaptive performance: cap DPR and monitor FPS
var dpr = Math.min(devicePixelRatio || 1, 2);
var _perfFps = 60, _perfFrameCount = 0, _perfLastCheck = 0, _perfReduced = false;

function resize() {
  var rect = canvas.getBoundingClientRect();
  W = rect.width * dpr;
  H = rect.height * dpr;
  canvas.width = W;
  canvas.height = H;
  ctx.scale(dpr, dpr);
  state.dirty = true;
}
window.addEventListener('resize', resize);

// ─── Coordinate helpers ───────────────────────────────────────────────

function getViewRadius() { return sliderToViewRadius(state.zoom); }

function displayName(obj) {
  if (obj.name === 'Sun (You Are Here)') {
    if (state.mode3d) {
      var cd = Math.sqrt(cam3d.px * cam3d.px + cam3d.py * cam3d.py + cam3d.pz * cam3d.pz);
      if (cd < 100) return 'Sun';
    } else if (getViewRadius() < 10) {
      return 'Sun';
    }
  }
  if (obj.name === 'Milky Way (You Are Here)') {
    if (state.mode3d) {
      var cd2 = Math.sqrt(cam3d.px * cam3d.px + cam3d.py * cam3d.py + cam3d.pz * cam3d.pz);
      if (cd2 < 100000) return 'Milky Way';
    } else if (getViewRadius() < 100000) {
      return 'Milky Way';
    }
  }
  return obj.name;
}

function getScale() {
  var vr = getViewRadius();
  var sw = W / dpr;
  var sh = H / dpr;
  return Math.min(sw, sh) / (2 * vr);
}

function worldToScreen(wx, wy) {
  var sw = W / dpr;
  var sh = H / dpr;
  var scale = getScale();
  return { x: sw / 2 + (wx - state.panX) * scale, y: sh / 2 + (wy - state.panY) * scale };
}

function formatDistance(ly) {
  if (ly < 0.01) return (ly * 63241).toFixed(1) + " AU";
  if (ly < 1000) return ly.toFixed(2) + " ly";
  if (ly < 1e6) return (ly / 1000).toFixed(1) + "k ly";
  return (ly / 1e6).toFixed(1) + " Mly";
}

function formatViewRadius(vr) {
  if (vr < 0.001) return (vr * 63241).toFixed(1) + " AU";
  if (vr < 100) return vr.toFixed(1) + " ly";
  if (vr < 100000) return (vr / 1000).toFixed(1) + "k ly";
  if (vr < 1e8) return (vr / 1e6).toFixed(1) + " Mly";
  return (vr / 1e9).toFixed(1) + " Gly";
}

function lightTravelTime(ly) {
  var s = ly * 365.25 * 24 * 3600;
  if (s < 120) return s.toFixed(0) + " light-seconds";
  var m = s / 60;
  if (m < 120) return m.toFixed(0) + " light-minutes";
  var h = m / 60;
  if (h < 48) return h.toFixed(1) + " light-hours";
  var d = h / 24;
  if (d < 365) return d.toFixed(0) + " light-days";
  if (ly < 1000) return ly.toFixed(1) + " light-years";
  if (ly < 1e6) return (ly / 1000).toFixed(1) + "k light-years";
  if (ly < 1e9) return (ly / 1e6).toFixed(1) + "M light-years";
  return (ly / 1e9).toFixed(1) + "G light-years";
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ─── Color utilities for overlay styles ──────────────────────────────

function darkenHex(hex, factor) {
  var r = Math.round(parseInt(hex.substr(1, 2), 16) * factor);
  var g = Math.round(parseInt(hex.substr(3, 2), 16) * factor);
  var b = Math.round(parseInt(hex.substr(5, 2), 16) * factor);
  return '#' + ('0' + r.toString(16)).slice(-2)
             + ('0' + g.toString(16)).slice(-2)
             + ('0' + b.toString(16)).slice(-2);
}

function lightenHex(hex, factor) {
  var r = Math.min(255, Math.round(parseInt(hex.substr(1, 2), 16) * factor));
  var g = Math.min(255, Math.round(parseInt(hex.substr(3, 2), 16) * factor));
  var b = Math.min(255, Math.round(parseInt(hex.substr(5, 2), 16) * factor));
  return '#' + ('0' + r.toString(16)).slice(-2)
             + ('0' + g.toString(16)).slice(-2)
             + ('0' + b.toString(16)).slice(-2);
}

// ─── Keplerian orbital mechanics ─────────────────────────────────────

// Returns simulation time in days since J2000
// Uses simDaysAtEpoch to avoid overflow at extreme multipliers (>3e12)
function getSimDaysJ2000() {
  var elapsedRealDays = (Date.now() - simTime.epoch) / 86400000;
  return simTime.simDaysAtEpoch + elapsedRealDays * simTime.multiplier;
}

// Solve Kepler's equation M = E - e*sin(E) via Newton-Raphson
function solveKepler(M, e) {
  var E = M;
  for (var i = 0; i < 15; i++) {
    var dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

// Compute planet position in ecliptic coordinates (AU), returns {x, y, z}
function keplerPosition(elem, daysJ2000) {
  var DEG = Math.PI / 180;
  var M = (elem.M0 + 360 * daysJ2000 / elem.period) % 360;
  if (M < 0) M += 360;
  var Mrad = M * DEG;
  var E = solveKepler(Mrad, elem.ecc);
  // True anomaly
  var cosE = Math.cos(E);
  var sinE = Math.sin(E);
  var nu = Math.atan2(Math.sqrt(1 - elem.ecc * elem.ecc) * sinE, cosE - elem.ecc);
  // Distance from focus
  var rDist = elem.sma * (1 - elem.ecc * cosE);
  // Position in orbital plane
  var xOrb = rDist * Math.cos(nu);
  var yOrb = rDist * Math.sin(nu);
  // Rotate by argument of perihelion, inclination, longitude of ascending node
  var w = elem.aop * DEG;
  var I = elem.inc * DEG;
  var O = elem.lan * DEG;
  var cosW = Math.cos(w), sinW = Math.sin(w);
  var cosI = Math.cos(I), sinI = Math.sin(I);
  var cosO = Math.cos(O), sinO = Math.sin(O);
  var xEcl = (cosO * cosW - sinO * sinW * cosI) * xOrb +
             (-cosO * sinW - sinO * cosW * cosI) * yOrb;
  var yEcl = (sinO * cosW + cosO * sinW * cosI) * xOrb +
             (-sinO * sinW + cosO * cosW * cosI) * yOrb;
  var zEcl = (sinW * sinI) * xOrb + (cosW * sinI) * yOrb;
  return { x: xEcl, y: yEcl, z: zEcl };
}

// Update planet positions in-place based on current sim time
// Minimum 2D separation for satellite–parent pairs (in world ly).
// Mirrors drawObject sizing: max(cosmetic * solarScale, physical).
function satMinSep(parentR, parentPhys, satR, satPhys) {
  var scale = getScale();
  var vr = getViewRadius();
  var ss = Math.max(1, Math.min(4, 0.00004 / Math.max(vr, 0.000000005)));
  var pDr = parentPhys ? Math.max(parentR * ss, parentPhys * scale) : parentR * ss;
  var sDr = satPhys ? Math.max(satR * ss, satPhys * scale) : satR * ss;
  return (pDr + sDr) * 2.5 / scale;
}

function updatePlanetPositions() {
  var days = getSimDaysJ2000();
  var earthX = 0, earthY = 0, earthZ = 0;
  // First pass: compute planet positions
  for (var i = 0; i < objects.length; i++) {
    var obj = objects[i];
    var elem = orbitalPlaneData[obj.name];
    if (!elem) continue;
    var pos = keplerPosition(elem, days);
    // Convert AU to light-years and store for 2D map
    obj.x = pos.x * AU_IN_LY;
    obj.y = pos.y * AU_IN_LY;
    obj.orbZ = pos.z * AU_IN_LY;
    obj.dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z) * AU_IN_LY;
    // Also update 3D world coords
    obj.wx3d = obj.x;
    obj.wy3d = obj.y;
    obj.wz3d = obj.orbZ;
    if (obj.name === 'Earth') {
      earthX = obj.x; earthY = obj.y; earthZ = obj.orbZ;
    }
  }
  // Second pass: place satellites relative to their parent
  // Pluto-Charon: binary system. Keplerian orbit gives the barycenter position.
  // Barycenter is ~2,110 km from Pluto's center (outside Pluto, radius 1,188 km).
  // Pluto orbits barycenter at 2,110 km, Charon at 17,461 km. Period: 6.387 days.
  var baryX = 0, baryY = 0, baryZ = 0;
  for (var j = 0; j < objects.length; j++) {
    if (objects[j].name === 'Pluto') {
      baryX = objects[j].x; baryY = objects[j].y; baryZ = objects[j].orbZ || 0;
    }
  }
  var pcPeriod = 6.387;
  var pcAngle = (days / pcPeriod) * Math.PI * 2;
  var plutoBaryDist = 2.23e-10;   // 2,110 km in ly
  var charonBaryDist = 1.845e-9;  // 17,461 km in ly
  // Offset Pluto from barycenter (Pluto is opposite side from Charon)
  for (var j = 0; j < objects.length; j++) {
    if (objects[j].name === 'Pluto') {
      var po = objects[j];
      po.wx3d = baryX - plutoBaryDist * Math.cos(pcAngle);
      po.wy3d = baryY - plutoBaryDist * Math.sin(pcAngle);
      po.wz3d = baryZ;
      po.x = baryX - plutoBaryDist * Math.cos(pcAngle);
      po.y = baryY - plutoBaryDist * Math.sin(pcAngle);
    }
  }
  for (var j = 0; j < objects.length; j++) {
    var sat = objects[j];
    if (sat.name === 'Moon') {
      // Moon: ~384,400 km = ~4.06e-8 ly from Earth
      var moonPeriod = 27.322;
      var moonAngle = (days / moonPeriod) * Math.PI * 2;
      var moonDist = 4.06e-8;
      // 3D: real orbital distance
      sat.wx3d = earthX + moonDist * Math.cos(moonAngle);
      sat.wy3d = earthY + moonDist * Math.sin(moonAngle);
      sat.wz3d = earthZ + moonDist * Math.sin(moonAngle) * Math.sin(5.145 * Math.PI / 180);
      // 2D: keep Moon visually separated from Earth at all zoom levels
      var moonVisualDist = Math.max(moonDist, satMinSep(2.5, 6.74e-10, 1.8, 1.84e-10));
      sat.x = earthX + moonVisualDist * Math.cos(moonAngle);
      sat.y = earthY + moonVisualDist * Math.sin(moonAngle);
      sat.orbZ = sat.wz3d;
    } else if (sat.name === 'Charon') {
      // Charon orbits the Pluto-Charon barycenter at 17,461 km
      sat.wx3d = baryX + charonBaryDist * Math.cos(pcAngle);
      sat.wy3d = baryY + charonBaryDist * Math.sin(pcAngle);
      sat.wz3d = baryZ;
      // 2D: keep Charon visually separated from Pluto
      var pcSep = plutoBaryDist + charonBaryDist;  // total separation
      var charonVisualDist = Math.max(pcSep, satMinSep(1, 1.256e-10, 0.7, 6.39e-11));
      // Offset from barycenter (same direction as 3D, but exaggerated)
      sat.x = baryX + charonVisualDist * Math.cos(pcAngle);
      sat.y = baryY + charonVisualDist * Math.sin(pcAngle);
      sat.orbZ = baryZ;
    } else {
      continue;
    }
    sat.dist = Math.sqrt(sat.wx3d * sat.wx3d + sat.wy3d * sat.wy3d);
  }

  // Lagrange points: compute from Earth's current position
  var earthAngle = Math.atan2(earthY, earthX);
  var earthR = Math.sqrt(earthX * earthX + earthY * earthY);
  var l2Offset = 1.59e-8; // ~1.5M km in light-years

  var lp1 = findObject('L1');
  if (lp1) {
    var l1R = earthR - l2Offset;
    lp1.x = l1R * Math.cos(earthAngle);
    lp1.y = l1R * Math.sin(earthAngle);
    lp1.wx3d = lp1.x; lp1.wy3d = lp1.y; lp1.wz3d = earthZ;
    lp1.dist = l1R;
  }
  var lp2 = findObject('L2');
  if (lp2) {
    var l2R = earthR + l2Offset;
    lp2.x = l2R * Math.cos(earthAngle);
    lp2.y = l2R * Math.sin(earthAngle);
    lp2.wx3d = lp2.x; lp2.wy3d = lp2.y; lp2.wz3d = earthZ;
    lp2.dist = l2R;
  }
  var lp3 = findObject('L3');
  if (lp3) {
    lp3.x = -earthR * Math.cos(earthAngle);
    lp3.y = -earthR * Math.sin(earthAngle);
    lp3.wx3d = lp3.x; lp3.wy3d = lp3.y; lp3.wz3d = earthZ;
    lp3.dist = earthR;
  }
  var lp4 = findObject('L4');
  if (lp4) {
    lp4.x = earthR * Math.cos(earthAngle + Math.PI / 3);
    lp4.y = earthR * Math.sin(earthAngle + Math.PI / 3);
    lp4.wx3d = lp4.x; lp4.wy3d = lp4.y; lp4.wz3d = earthZ;
    lp4.dist = earthR;
  }
  var lp5 = findObject('L5');
  if (lp5) {
    lp5.x = earthR * Math.cos(earthAngle - Math.PI / 3);
    lp5.y = earthR * Math.sin(earthAngle - Math.PI / 3);
    lp5.wx3d = lp5.x; lp5.wy3d = lp5.y; lp5.wz3d = earthZ;
    lp5.dist = earthR;
  }
  // JWST: halo orbit around L2 (~6 month period, ~800,000 km radius)
  var jwst = findObject('JWST');
  if (jwst && lp2) {
    var jwstPeriod = 182.5;
    var jwstHaloR = 8.5e-11; // ~800,000 km in ly
    var jwstAngle = (days / jwstPeriod) * Math.PI * 2;
    // Visual minimum separation so JWST is always clickable apart from L2
    var jwstVisR = Math.max(jwstHaloR, satMinSep(0.6, 0, 1.2, 1.4e-12));
    jwst.x = lp2.x + jwstVisR * Math.cos(jwstAngle);
    jwst.y = lp2.y + jwstVisR * Math.sin(jwstAngle);
    jwst.wx3d = lp2.wx3d + jwstHaloR * Math.cos(jwstAngle);
    jwst.wy3d = lp2.wy3d + jwstHaloR * Math.sin(jwstAngle);
    jwst.wz3d = lp2.wz3d;
    jwst.dist = lp2.dist;
  }
}

// Get current rotation angle (radians) for an object
function getRotationAngle(name) {
  var rd = rotationData[name];
  if (!rd) return 0;
  var days = getSimDaysJ2000();
  var hours = days * 24;
  var rotations = hours / Math.abs(rd.rotPeriod);
  var sign = rd.rotPeriod < 0 ? -1 : 1;
  return (sign * rotations * Math.PI * 2) % (Math.PI * 2);
}

// ─── Object overlay styles ───────────────────────────────────────────
// Each receives: { ctx, x, y, r, color, lightOffX, lightOffY, alpha, obj, isPhysical }

function drawOverlay_flat(d) {
  d.ctx.fillStyle = d.color;
  d.ctx.beginPath();
  d.ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
  d.ctx.fill();
}

function drawOverlay_albedo(d) {
  var ctx = d.ctx;
  var x = d.x;
  var y = d.y;
  var r = d.r;
  var color = d.color;
  var name = d.obj.name;
  var PI = Math.PI;
  var TWO_PI = PI * 2;

  var _isStar = isStar(d.obj);

  if (_isStar) {
    // Realistic limb darkening with many gradient stops
    // Stars are brighter at center, darker at limb following I(r) ~ (1 - u*(1 - sqrt(1 - r^2)))
    var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0,    lightenHex(color, 1.35));
    grad.addColorStop(0.1,  lightenHex(color, 1.3));
    grad.addColorStop(0.2,  lightenHex(color, 1.22));
    grad.addColorStop(0.3,  lightenHex(color, 1.14));
    grad.addColorStop(0.4,  lightenHex(color, 1.06));
    grad.addColorStop(0.5,  color);
    grad.addColorStop(0.6,  darkenHex(color, 0.88));
    grad.addColorStop(0.7,  darkenHex(color, 0.72));
    grad.addColorStop(0.8,  darkenHex(color, 0.52));
    grad.addColorStop(0.88, darkenHex(color, 0.35));
    grad.addColorStop(0.94, darkenHex(color, 0.2));
    grad.addColorStop(1,    darkenHex(color, 0.08));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
    return;
  }

  // --- Reflective bodies (planets, moons) ---
  // Compute 3D-aware light direction for proper terminator placement
  var lx3 = -(d.obj.wx3d || 0), ly3 = -(d.obj.wy3d || 0), lz3 = -(d.obj.wz3d || 0);
  var lLen3 = Math.sqrt(lx3 * lx3 + ly3 * ly3 + lz3 * lz3);
  if (lLen3 > 1e-12) { lx3 /= lLen3; ly3 /= lLen3; lz3 /= lLen3; }

  var cosY3 = Math.cos(cam3d.yaw), sinY3 = Math.sin(cam3d.yaw);
  var cosP3 = Math.cos(cam3d.pitch), sinP3 = Math.sin(cam3d.pitch);
  var lightRight = lx3 * (-sinY3) + ly3 * cosY3;
  var lightUp = -(lx3 * (-sinP3 * cosY3) + ly3 * (-sinP3 * sinY3) + lz3 * cosP3);
  var lightFwd = lx3 * (cosP3 * cosY3) + ly3 * (cosP3 * sinY3) + lz3 * sinP3;

  var lateralMag = Math.sqrt(lightRight * lightRight + lightUp * lightUp);
  var lightAngle = lateralMag > 0.001 ? Math.atan2(lightUp, lightRight) : 0;
  // lightFwd > 0: Sun behind camera → mostly lit face visible
  // lightFwd < 0: Sun in front → mostly dark face visible
  var termOffset = lightFwd * r;

  var cosL = Math.cos(lightAngle);
  var sinL = Math.sin(lightAngle);

  // Identify body types
  var isGasGiant = (name === 'Jupiter' || name === 'Saturn' ||
                    name === 'Uranus' || name === 'Neptune');
  var hasAtmosphere = (name === 'Earth' || name === 'Venus' ||
                       name === 'Jupiter' || name === 'Saturn');

  ctx.save();

  // Axial tilt
  var tiltDeg = d.tilt || 0;
  var tiltRad = tiltDeg * PI / 180;
  var visTilt = Math.sin(tiltRad) * (PI / 4);
  var rotOff = d.rotAngle || 0;

  // 1) Base sphere fill
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.fill();

  // 1b) Rotating surface features for rocky bodies
  if (!isGasGiant && r > 6) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TWO_PI); ctx.clip();
    ctx.translate(x, y); ctx.rotate(visTilt); ctx.translate(-x, -y);

    var seed = nameHash(name, 42);
    var isDark = (name === 'Moon' || name === 'Mercury' || name === 'Charon');
    var isEarthy = (name === 'Earth');
    var isMartian = (name === 'Mars');
    var isVenus = (name === 'Venus');

    // Generate continent-like clusters: each "continent" is 3-5 overlapping blobs
    var continentCount = isEarthy ? 7 : (isDark ? 8 : 5);
    for (var ci = 0; ci < continentCount; ci++) {
      var ch1 = Math.sin(ci * 173.7 + seed * 271.3) * 43758.5453; ch1 -= Math.floor(ch1);
      var ch2 = Math.sin(ci * 337.1 + seed * 149.7) * 43758.5453; ch2 -= Math.floor(ch2);
      var ch3 = Math.sin(ci * 51.3 + seed * 433.1) * 43758.5453; ch3 -= Math.floor(ch3);

      var cLon = ch1 * TWO_PI + rotOff;
      var cLat = (ch2 - 0.5) * PI * 0.75;

      // Each continent = cluster of 3-5 overlapping irregular blobs
      var blobCount = 3 + Math.floor(ch3 * 3);
      for (var bi = 0; bi < blobCount; bi++) {
        var bh = hash3(ci * 7 + bi, seed);
        var bh1 = bh.a, bh2 = bh.b, bh3 = bh.c;

        // Offset blob from continent center
        var bLon = cLon + (bh1 - 0.5) * 0.5;
        var bLat = cLat + (bh2 - 0.5) * 0.35;
        bLat = Math.max(-PI * 0.42, Math.min(PI * 0.42, bLat));

        var projX = Math.sin(bLon) * Math.cos(bLat);
        var projY = Math.sin(bLat);
        var projZ = Math.cos(bLon) * Math.cos(bLat);
        if (projZ < -0.05) continue;

        var bx = x + projX * r * 0.85;
        var by = y + projY * r * 0.85;
        // Irregular size: elongated ellipses at varying angles
        var bRx = r * (0.08 + bh3 * 0.14);
        var bRy = bRx * (0.3 + bh1 * 0.7);
        var bAngle = bh2 * PI;
        var bAlpha = Math.max(0, Math.min(0.7, projZ * 0.9));

        var bColor;
        if (isEarthy) {
          var greens = ['#2d6a2d', '#3a7a35', '#4a8a40', '#357030', '#558a45'];
          bColor = greens[Math.floor(bh3 * greens.length)];
        } else if (isMartian) {
          var rusts = ['#7a3a1a', '#8a4422', '#6a3015', '#9a5030', '#5a2810'];
          bColor = rusts[Math.floor(bh3 * rusts.length)];
        } else if (isVenus) {
          bColor = bh3 > 0.5 ? '#c8a850' : '#b09040';
        } else if (isDark) {
          bColor = 'rgba(40,40,50,' + (0.25 + bh3 * 0.15).toFixed(2) + ')';
        } else {
          bColor = bh3 > 0.5 ? lightenHex(color, 1.15) : darkenHex(color, 0.8);
        }

        ctx.globalAlpha = bAlpha;
        ctx.fillStyle = bColor;
        ctx.beginPath();
        ctx.ellipse(bx, by, bRx, bRy, bAngle, 0, TWO_PI);
        ctx.fill();
      }
    }

    // Small polar caps
    if (isEarthy || isMartian) {
      var capA = isEarthy ? 0.4 : 0.3;
      var capH = r * (isEarthy ? 0.1 : 0.07);
      ctx.globalAlpha = capA;
      ctx.fillStyle = '#e8eeff';
      ctx.beginPath(); ctx.ellipse(x, y - r + capH * 0.6, r * 0.4, capH, 0, 0, TWO_PI); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y + r - capH * 0.6, r * (isEarthy ? 0.35 : 0.25), capH * 0.8, 0, 0, TWO_PI); ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // 2) Gas giant horizontal banding with tilt and rotation-driven turbulence
  if (isGasGiant && r > 3) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.clip();
    ctx.translate(x, y); ctx.rotate(visTilt); ctx.translate(-x, -y);
    var bandCount = (name === 'Jupiter') ? 14 : (name === 'Saturn') ? 10 : 6;
    var bandAlpha = (name === 'Jupiter') ? 0.2 : 0.12;
    for (var bi = 0; bi < bandCount; bi++) {
      var bandFrac = (bi + 0.5) / bandCount;
      var bandLat = bandFrac * 2 - 1;
      var bandY = y + bandLat * r;
      var bandH = (2 * r / bandCount) * 0.7;
      // Subtle horizontal shift from rotation
      var turbShift = Math.sin(bi * 3.7 + rotOff * (1 + bi * 0.08)) * r * 0.02;
      var bandColor = (bi % 2 === 0)
        ? 'rgba(255,255,255,' + bandAlpha + ')'
        : 'rgba(0,0,0,' + (bandAlpha * 0.8) + ')';
      ctx.fillStyle = bandColor;
      ctx.fillRect(x - r + turbShift, bandY - bandH * 0.5, r * 2, bandH);
    }
    ctx.restore();
  }

  // 3) Lit-side radial gradient
  var litCX = x + cosL * r * 0.35;
  var litCY = y + sinL * r * 0.35;
  var litGrad = ctx.createRadialGradient(litCX, litCY, 0, litCX, litCY, r * 1.1);
  litGrad.addColorStop(0, lightenHex(color, 1.25));
  litGrad.addColorStop(0.4, 'rgba(255,255,255,0.06)');
  litGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.clip();
  ctx.fillStyle = litGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.fill();
  ctx.restore();

  // 4) Terminator shadow — 3D-aware: offset based on forward light component
  if (termOffset < r * 0.92) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(lightAngle);

    // Shadow from terminator to dark limb
    var shadowEdge = termOffset;
    ctx.beginPath();
    ctx.rect(-r * 1.5, -r * 1.5, r * 1.5 + shadowEdge, r * 3);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fill();

    // Soft terminator gradient
    var gradW = r * 0.3;
    var termGrad = ctx.createLinearGradient(shadowEdge - gradW, 0, shadowEdge + gradW, 0);
    termGrad.addColorStop(0, 'rgba(0,0,0,0.4)');
    termGrad.addColorStop(0.5, 'rgba(0,0,0,0.15)');
    termGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = termGrad;
    ctx.fillRect(shadowEdge - gradW, -r * 1.5, gradW * 2, r * 3);

    // Ambient on dark side
    ctx.fillStyle = 'rgba(40,50,70,0.12)';
    ctx.fillRect(-r * 1.5, -r * 1.5, r * 1.5 + shadowEdge, r * 3);

    ctx.restore();
  }

  // 5) Specular highlight
  if (r > 2) {
    var specDist = r * 0.38;
    var specX = x + cosL * specDist;
    var specY = y + sinL * specDist;
    var specR = r * 0.22;
    var specGrad = ctx.createRadialGradient(specX, specY, 0, specX, specY, specR);
    specGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
    specGrad.addColorStop(0.4, 'rgba(255,255,255,0.2)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.clip();
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(specX, specY, specR, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  // 6) Atmospheric limb glow
  if (hasAtmosphere && r > 3) {
    var limbColor;
    if (name === 'Earth') limbColor = '100,180,255';
    else if (name === 'Venus') limbColor = '240,220,160';
    else if (name === 'Jupiter') limbColor = '220,180,120';
    else limbColor = '230,210,150';
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r + r * 0.06, 0, TWO_PI);
    ctx.arc(x, y, r * 0.92, 0, TWO_PI, true);
    ctx.clip();
    var limbGrad = ctx.createRadialGradient(
      x + cosL * r * 0.3, y + sinL * r * 0.3, r * 0.7,
      x, y, r + r * 0.06
    );
    limbGrad.addColorStop(0, 'rgba(' + limbColor + ',0)');
    limbGrad.addColorStop(0.5, 'rgba(' + limbColor + ',0.15)');
    limbGrad.addColorStop(0.8, 'rgba(' + limbColor + ',0.35)');
    limbGrad.addColorStop(1, 'rgba(' + limbColor + ',0.08)');
    ctx.fillStyle = limbGrad;
    ctx.beginPath();
    ctx.arc(x, y, r + r * 0.06, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawOverlay_wireframe(d) {
  var ctx = d.ctx;
  var x = d.x, y = d.y, r = d.r;

  // Subtle dark fill so wireframe reads as a shape against space
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  var _isStar = isStar(d.obj);

  // Light direction angle and magnitude
  var lMag = Math.sqrt(d.lightOffX * d.lightOffX + d.lightOffY * d.lightOffY);
  var lightAngle = lMag > 0.01 ? Math.atan2(d.lightOffY, d.lightOffX) : 0;
  var hasLight = lMag > 0.01 && !_isStar;

  // Scale line count with radius, capped for performance
  var latCount = Math.min(12, Math.max(4, Math.round(r / 12)));
  var lonCount = Math.min(14, Math.max(4, Math.round(r / 10)));

  // Base line width
  var baseWidth = Math.max(0.5, r / 100);

  // Grid color: warm for stars, cool white for others
  var gridR, gridG, gridB;
  if (_isStar) {
    gridR = 255; gridG = 220; gridB = 160;
  } else {
    gridR = 200; gridG = 220; gridB = 255;
  }

  // Axial tilt angle (convert to screen tilt — foreshortened projection)
  var tiltDeg = d.tilt || 0;
  var tiltRad = tiltDeg * Math.PI / 180;
  // Clamp to ±90° visual tilt for rendering
  var visTilt = Math.sin(tiltRad) * (Math.PI / 4);

  ctx.save();

  // Clip to sphere (untilted — sphere shape doesn't change)
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  // Apply tilt rotation for grid lines
  ctx.translate(x, y);
  ctx.rotate(visTilt);
  ctx.translate(-x, -y);

  // Normalized light direction for dot-product shading
  var lnx = hasLight ? d.lightOffX / lMag : 0;
  var lny = hasLight ? d.lightOffY / lMag : 0;

  // --- Latitude lines ---
  for (var i = 1; i < latCount; i++) {
    var frac = i / latCount;
    var yOff = r * (2 * frac - 1);
    var rAtLat = Math.sqrt(Math.max(0, r * r - yOff * yOff));
    if (rAtLat < 1) continue;

    var isEquator = (i === Math.floor(latCount / 2));

    // Shading: fade lines on the dark hemisphere
    var lineAlpha;
    if (hasLight) {
      // Dot product of line center direction with light direction
      var dot = lny * (yOff / r);
      // Bias toward light side: bright = 0.6, dark = 0.12
      lineAlpha = 0.12 + 0.48 * Math.max(0, 0.5 + 0.5 * dot);
    } else {
      lineAlpha = _isStar ? 0.45 : 0.35;
    }

    if (isEquator) {
      lineAlpha = Math.min(1, lineAlpha * 1.8);
      ctx.lineWidth = baseWidth * 2;
    } else {
      ctx.lineWidth = baseWidth;
    }

    ctx.strokeStyle = 'rgba(' + gridR + ',' + gridG + ',' + gridB + ',' + lineAlpha.toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(x, y + yOff, rAtLat, rAtLat * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Longitude lines (rotated by light direction + rotation) ---
  var rotOff = d.rotAngle || 0;
  for (var j = 0; j < lonCount; j++) {
    var lonAngle = j * Math.PI / lonCount + lightAngle + rotOff;
    var cosA = Math.cos(lonAngle);
    var sinA = Math.sin(lonAngle);
    var rX = r * Math.abs(cosA);
    if (rX < 1) rX = 1;

    // Shading: lines facing the light are brighter
    var lineAlpha2;
    if (hasLight) {
      // Direction the line faces (its normal) is perpendicular to its plane
      var nrmX = cosA;
      var nrmY = sinA;
      var dot2 = nrmX * lnx + nrmY * lny;
      lineAlpha2 = 0.1 + 0.5 * Math.max(0, 0.5 + 0.5 * Math.abs(dot2));
    } else {
      lineAlpha2 = _isStar ? 0.45 : 0.35;
    }

    ctx.lineWidth = baseWidth;
    ctx.strokeStyle = 'rgba(' + gridR + ',' + gridG + ',' + gridB + ',' + lineAlpha2.toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(x, y, rX, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Terminator line (day/night boundary) for non-stars ---
  if (hasLight && r > 6) {
    // Terminator is the great circle perpendicular to the light direction
    var termAngle = lightAngle + Math.PI / 2;
    ctx.lineWidth = baseWidth * 2.5;
    ctx.strokeStyle = 'rgba(' + gridR + ',' + gridG + ',' + gridB + ',0.65)';
    ctx.beginPath();
    // Draw as an ellipse: full height, narrow width to look like a great circle edge-on
    ctx.ellipse(x, y, r * 0.12, r, termAngle, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawOverlay_depth(d) {
  var ctx = d.ctx;
  var x = d.x;
  var y = d.y;
  var r = d.r;
  var color = d.color;
  var lx = d.lightOffX;
  var ly = d.lightOffY;

  // Parse base color into RGB components
  var bR = parseInt(color.substr(1, 2), 16);
  var bG = parseInt(color.substr(3, 2), 16);
  var bB = parseInt(color.substr(5, 2), 16);

  // Determine if this is a star (warm topo palette) or planet/other (base color palette)
  var _isStar = isStar(d.obj);

  // Detect gas giants for volumetric cloud rendering
  var objName = d.obj ? d.obj.name : '';
  var isGasGiant = (objName === 'Jupiter' || objName === 'Saturn' ||
                    objName === 'Uranus' || objName === 'Neptune');

  // Ring count scales with screen radius, capped at 12
  var ringCount = Math.min(12, Math.max(4, Math.round(r / 8)));

  // Axial tilt for depth view
  var depthTiltDeg = d.tilt || 0;
  var depthTiltRad = depthTiltDeg * Math.PI / 180;
  var depthVisTilt = Math.sin(depthTiltRad) * (Math.PI / 4);

  ctx.save();

  // Clip to circle so nothing bleeds out
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  var i, t, cr, cg, cb, s;

  if (isGasGiant) {
    // Apply axial tilt for cloud bands
    ctx.translate(x, y);
    ctx.rotate(depthVisTilt);
    ctx.translate(-x, -y);
    // --- Gas giant volumetric cloud bands ---
    var bandCount = Math.min(20, Math.max(8, Math.round(r / 6)));
    var bandPalettes = {
      'Jupiter': [
        [212, 165, 106], [190, 140, 85], [230, 200, 150], [180, 120, 70],
        [220, 180, 130], [160, 110, 65], [240, 210, 170], [170, 125, 75],
        [200, 150, 95], [225, 190, 140], [185, 130, 80], [210, 170, 120]
      ],
      'Saturn': [
        [232, 208, 136], [220, 195, 120], [240, 220, 160], [210, 185, 110],
        [225, 200, 140], [215, 190, 125], [235, 215, 150], [205, 180, 115],
        [228, 205, 135], [218, 192, 128], [238, 218, 155], [208, 183, 118]
      ],
      'Uranus': [
        [136, 204, 221], [120, 190, 210], [150, 215, 230], [110, 180, 200],
        [140, 208, 225], [125, 195, 215], [145, 210, 228], [115, 185, 205],
        [130, 200, 218], [138, 206, 222], [128, 196, 212], [142, 210, 226]
      ],
      'Neptune': [
        [68, 102, 204], [55, 88, 190], [80, 115, 215], [48, 78, 175],
        [72, 108, 210], [60, 95, 195], [85, 120, 220], [50, 82, 180],
        [65, 100, 200], [75, 110, 212], [58, 90, 188], [78, 112, 208]
      ]
    };
    var palette = bandPalettes[objName];

    // Fill base color first
    ctx.fillStyle = 'rgb(' + palette[0][0] + ',' + palette[0][1] + ',' + palette[0][2] + ')';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Draw horizontal cloud bands with perspective (narrower at poles)
    for (i = 0; i < bandCount; i++) {
      var bandFrac = (i + 0.5) / bandCount; // 0 = top, 1 = bottom
      var lat = bandFrac * 2 - 1; // -1 to +1
      var bandY = y + lat * r;
      // Band width varies: wider at equator, narrower at poles
      var bandH = (r * 2 / bandCount) * Math.sqrt(1 - lat * lat) * 1.2 + 1;
      var pIdx = i % palette.length;
      var bc = palette[pIdx];

      // Slight color variation for atmospheric turbulence (shifts with rotation)
      var dRot = d.rotAngle || 0;
      var turb = Math.sin(i * 3.7 + bandFrac * 12 + dRot * (1 + i * 0.15)) * 8;
      var br2 = Math.min(255, Math.max(0, bc[0] + Math.round(turb)));
      var bg2 = Math.min(255, Math.max(0, bc[1] + Math.round(turb * 0.7)));
      var bb2 = Math.min(255, Math.max(0, bc[2] + Math.round(turb * 0.4)));

      ctx.fillStyle = 'rgb(' + br2 + ',' + bg2 + ',' + bb2 + ')';
      ctx.fillRect(x - r, bandY - bandH * 0.5, r * 2, bandH);
    }

    // Atmospheric haze layers — semi-transparent bands for depth
    for (i = 0; i < 5; i++) {
      var hazeFrac = (i + 1) / 6;
      var hazeY = y + (hazeFrac * 2 - 1) * r * 0.8;
      var hazeH = r * 0.15;
      var hazeAlpha = 0.03 + Math.sin(i * 2.1) * 0.02;
      ctx.fillStyle = 'rgba(255,255,255,' + Math.abs(hazeAlpha).toFixed(3) + ')';
      ctx.fillRect(x - r, hazeY - hazeH * 0.5, r * 2, hazeH);
    }

    // Subtle swirl/storm spots for Jupiter and Neptune
    var stormRot = d.rotAngle || 0;
    if (objName === 'Jupiter' && r > 20) {
      // Great Red Spot approximation — moves with rotation
      ctx.save();
      ctx.globalAlpha = 0.4;
      var grsLon = Math.cos(stormRot + 1.2);
      var spotX = x + grsLon * r * 0.3;
      var spotY = y + r * 0.22;
      var spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, r * 0.12);
      spotGrad.addColorStop(0, 'rgb(180,80,40)');
      spotGrad.addColorStop(0.6, 'rgb(200,100,50)');
      spotGrad.addColorStop(1, 'rgba(200,120,60,0)');
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.ellipse(spotX, spotY, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (objName === 'Neptune' && r > 20) {
      // Great Dark Spot approximation — moves with rotation
      ctx.save();
      ctx.globalAlpha = 0.3;
      var gdsLon = Math.cos(stormRot + 2.5);
      var dspotX = x + gdsLon * r * 0.2;
      var dspotY = y - r * 0.2;
      var dspotGrad = ctx.createRadialGradient(dspotX, dspotY, 0, dspotX, dspotY, r * 0.1);
      dspotGrad.addColorStop(0, 'rgb(30,50,120)');
      dspotGrad.addColorStop(1, 'rgba(40,60,140,0)');
      ctx.fillStyle = dspotGrad;
      ctx.beginPath();
      ctx.ellipse(dspotX, dspotY, r * 0.12, r * 0.07, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

  } else if (_isStar) {
    // --- Stars: warm concentric topo rings (static) ---
    var topoColors = [];
    for (i = 0; i < ringCount; i++) {
      t = i / (ringCount - 1);
      if (t < 0.25) {
        s = t / 0.25; cr = 255; cg = Math.round(255 - s * 30); cb = Math.round(220 - s * 150);
      } else if (t < 0.5) {
        s = (t - 0.25) / 0.25; cr = 255; cg = Math.round(225 - s * 90); cb = Math.round(70 - s * 50);
      } else if (t < 0.75) {
        s = (t - 0.5) / 0.25; cr = Math.round(255 - s * 40); cg = Math.round(135 - s * 85); cb = Math.round(20 - s * 10);
      } else {
        s = (t - 0.75) / 0.25; cr = Math.round(215 - s * 100); cg = Math.round(50 - s * 40); cb = Math.round(10 + s * 15);
      }
      topoColors.push({ r: cr, g: cg, b: cb });
    }
    for (i = ringCount - 1; i >= 0; i--) {
      var ringT = (i + 1) / ringCount;
      var ringR = r * ringT;
      var tc = topoColors[i];
      ctx.fillStyle = 'rgb(' + tc.r + ',' + tc.g + ',' + tc.b + ')';
      ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.fill();
      if (i < ringCount - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.4, 0.15 + (ringCount - i) * 0.02).toFixed(2) + ')';
        ctx.lineWidth = Math.max(0.5, r / 150);
        ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2); ctx.stroke();
      }
    }
  } else {
    // --- Rocky bodies: procedural surface features that rotate ---
    var rotOff = d.rotAngle || 0;
    var isDarkBody = (objName === 'Moon' || objName === 'Mercury' || objName === 'Charon');
    var isEarthD = (objName === 'Earth');
    var isMarsD = (objName === 'Mars');

    // Base fill
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    // Apply tilt
    ctx.translate(x, y);
    ctx.rotate(depthVisTilt);
    ctx.translate(-x, -y);

    // Continent clusters: each is 3-5 overlapping irregular blobs
    var dSeed = nameHash(objName, 0);
    var dContCount = isEarthD ? 7 : (isDarkBody ? 8 : 5);
    for (i = 0; i < dContCount; i++) {
      var dc1 = Math.sin(i * 173.7 + dSeed * 271.3) * 43758.5453; dc1 -= Math.floor(dc1);
      var dc2 = Math.sin(i * 337.1 + dSeed * 149.7) * 43758.5453; dc2 -= Math.floor(dc2);
      var dc3 = Math.sin(i * 51.3 + dSeed * 433.1) * 43758.5453; dc3 -= Math.floor(dc3);
      var dcLon = dc1 * Math.PI * 2 + rotOff;
      var dcLat = (dc2 - 0.5) * Math.PI * 0.75;
      var dcBlobs = 3 + Math.floor(dc3 * 3);
      for (var dbi = 0; dbi < dcBlobs; dbi++) {
        var dbh = hash3(i * 7 + dbi, dSeed);
        var db1 = dbh.a, db2 = dbh.b, db3 = dbh.c;
        var dbLon = dcLon + (db1 - 0.5) * 0.5;
        var dbLat = Math.max(-Math.PI * 0.42, Math.min(Math.PI * 0.42, dcLat + (db2 - 0.5) * 0.35));
        var dpX = Math.sin(dbLon) * Math.cos(dbLat);
        var dpY = Math.sin(dbLat);
        var dpZ = Math.cos(dbLon) * Math.cos(dbLat);
        if (dpZ < -0.05) continue;
        var dbx = x + dpX * r * 0.85;
        var dby = y + dpY * r * 0.85;
        var dbRx = r * (0.08 + db3 * 0.14);
        var dbRy = dbRx * (0.3 + db1 * 0.7);
        var dbA = Math.max(0, Math.min(0.6, dpZ * 0.8));
        var lumShift = (db3 - 0.5) * 0.5;
        var pcr = Math.min(255, Math.max(0, Math.round(bR * (1 + lumShift))));
        var pcg = Math.min(255, Math.max(0, Math.round(bG * (1 + lumShift))));
        var pcb = Math.min(255, Math.max(0, Math.round(bB * (1 + lumShift))));
        ctx.globalAlpha = dbA;
        ctx.fillStyle = 'rgb(' + pcr + ',' + pcg + ',' + pcb + ')';
        ctx.beginPath();
        ctx.ellipse(dbx, dby, dbRx, dbRy, db2 * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Small polar caps
    if (isEarthD || isMarsD) {
      var dcapA = isEarthD ? 0.35 : 0.25;
      var dcapH = r * (isEarthD ? 0.1 : 0.07);
      ctx.globalAlpha = dcapA;
      ctx.fillStyle = '#e8eeff';
      ctx.beginPath(); ctx.ellipse(x, y - r + dcapH * 0.6, r * 0.4, dcapH, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y + r - dcapH * 0.6, r * (isEarthD ? 0.35 : 0.25), dcapH * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Spherical shading: limb darkening via radial gradient overlay
  var limbGrad = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
  limbGrad.addColorStop(0, 'rgba(0,0,0,0)');
  limbGrad.addColorStop(0.6, 'rgba(0,0,0,0.05)');
  limbGrad.addColorStop(0.85, 'rgba(0,0,0,0.15)');
  limbGrad.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = limbGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Directional shadow on the side opposite the light source
  var shadowX = x - lx * 0.5;
  var shadowY = y - ly * 0.5;
  var shadowGrad = ctx.createRadialGradient(shadowX, shadowY, r * 0.2, shadowX, shadowY, r * 1.1);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.35)');
  shadowGrad.addColorStop(0.5, 'rgba(0,0,0,0.15)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Specular highlight toward light source for gloss
  var hlX = x + lx * 0.35;
  var hlY = y + ly * 0.35;
  var hlR = r * 0.35;
  var specGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
  specGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
  specGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  specGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = specGrad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function getLayerDef(obj) {
  if (objectLayers[obj.name]) return objectLayers[obj.name];
  var cat = obj.category;
  var typ = (obj.type || '').toLowerCase();
  if (cat === 'stellar' || obj.name === 'Sun (You Are Here)') {
    if (typ.indexOf('white dwarf') >= 0) return categoryLayers.stellar_whitedwarf;
    if (typ.indexOf('red dwarf') >= 0 || typ.indexOf('m ') >= 0 || typ.indexOf('m-type') >= 0 || typ.indexOf('m5') >= 0 || typ.indexOf('m6') >= 0) return categoryLayers.stellar_reddwarf;
    if (typ.indexOf('giant') >= 0 || typ.indexOf('supergiant') >= 0) return categoryLayers.stellar_giant;
    return categoryLayers.stellar;
  }
  if (cat === 'exotic') {
    if (typ.indexOf('black hole') >= 0) return categoryLayers.exotic_blackhole;
    if (typ.indexOf('neutron') >= 0 || typ.indexOf('pulsar') >= 0 || typ.indexOf('magnetar') >= 0) return categoryLayers.exotic_neutronstar;
    return defaultLayers;
  }
  if (categoryLayers[cat]) return categoryLayers[cat];
  return defaultLayers;
}

function drawOverlay_layers(d) {
  var ctx = d.ctx;
  var x = d.x, y = d.y, r = d.r;
  var layerDef = getLayerDef(d.obj);
  var _isStar = isStar(d.obj);
  var hasConvective = false;
  var convIdx = -1;
  var PI = Math.PI;

  // Detect convective zone for stars
  if (_isStar) {
    for (var ci = 0; ci < layerDef.length; ci++) {
      if (layerDef[ci].label.toLowerCase().indexOf('convect') >= 0) {
        hasConvective = true;
        convIdx = ci;
        break;
      }
    }
  }

  ctx.save();

  // ── Right half: surface with lit gradient ──────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.arc(x, y, r, -PI / 2, PI / 2, false);
  ctx.closePath();
  ctx.clip();

  var outerColor = layerDef[layerDef.length - 1].color;
  if (_isStar) {
    var surfGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    surfGrad.addColorStop(0, lightenHex(outerColor, 1.3));
    surfGrad.addColorStop(0.5, outerColor);
    surfGrad.addColorStop(0.85, darkenHex(outerColor, 0.6));
    surfGrad.addColorStop(1, darkenHex(outerColor, 0.3));
    ctx.fillStyle = surfGrad;
  } else {
    var lx = d.lightOffX * 0.3;
    var ly = d.lightOffY * 0.3;
    var surfGrad = ctx.createRadialGradient(x + lx, y + ly, 0, x - lx * 0.5, y - ly * 0.5, r);
    surfGrad.addColorStop(0, lightenHex(outerColor, 1.3));
    surfGrad.addColorStop(0.5, outerColor);
    surfGrad.addColorStop(0.85, darkenHex(outerColor, 0.4));
    surfGrad.addColorStop(1, darkenHex(outerColor, 0.15));
    ctx.fillStyle = surfGrad;
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Left half: cross-section layers ────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.arc(x, y, r, -PI / 2, PI / 2, true);
  ctx.closePath();
  ctx.clip();

  // Draw layers from outermost to innermost
  for (var i = layerDef.length - 1; i >= 0; i--) {
    var layer = layerDef[i];
    var lr = r * layer.ratio;
    var prevR = i > 0 ? r * layerDef[i - 1].ratio : 0;

    // Radial gradient within each layer for depth
    var innerC = darkenHex(layer.color, 0.55);
    var outerC = lightenHex(layer.color, 1.15);

    var lg = ctx.createRadialGradient(x, y, prevR, x, y, lr);
    lg.addColorStop(0, innerC);
    lg.addColorStop(0.4, layer.color);
    lg.addColorStop(0.85, layer.color);
    lg.addColorStop(1, outerC);
    ctx.fillStyle = lg;

    ctx.beginPath();
    ctx.arc(x, y, lr, 0, PI * 2);
    ctx.fill();

    // Convection streaks for convective zone in stars
    if (hasConvective && i === convIdx && r > 25) {
      var streakCount = Math.min(18, Math.max(6, Math.round(r / 8)));
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, lr, 0, PI * 2);
      if (prevR > 0) {
        ctx.arc(x, y, prevR, 0, PI * 2, true);
      }
      ctx.clip();

      for (var si = 0; si < streakCount; si++) {
        var angle = (si / streakCount) * PI * 2 + 0.3;
        var midAngle = angle + 0.08;
        var startR = prevR + (lr - prevR) * 0.1;
        var endR = prevR + (lr - prevR) * (0.7 + Math.sin(si * 2.7) * 0.25);
        var sx = x + Math.cos(angle) * startR;
        var sy = y + Math.sin(angle) * startR;
        var ex = x + Math.cos(midAngle) * endR;
        var ey = y + Math.sin(midAngle) * endR;

        ctx.strokeStyle = 'rgba(255,255,200,' + (0.12 + Math.sin(si * 1.9) * 0.06).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.5, r / 60);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        var cx1 = x + Math.cos(angle + 0.04) * (startR + endR) * 0.55;
        var cy1 = y + Math.sin(angle + 0.04) * (startR + endR) * 0.55;
        ctx.quadraticCurveTo(cx1, cy1, ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Bright boundary line between layers
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(0.5, r / 120);
      ctx.beginPath();
      ctx.arc(x, y, lr, 0, PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();

  // ── Cutaway edge: vertical line with highlight ─────────────────────
  // Broad soft highlight behind the cut
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = Math.max(3, r / 20);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();

  // Sharp cut edge
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, r / 60);
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();

  // Outer rim
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = Math.max(0.5, r / 100);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.stroke();

  // ── Labels with leader lines (left side only) ─────────────────────
  if (r > 40) {
    var fontSize = Math.max(9, Math.min(14, r / 10));
    ctx.font = fontSize + 'px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (var li = 0; li < layerDef.length; li++) {
      var lyr = layerDef[li];
      var layerR = r * lyr.ratio;
      var prevLR = li > 0 ? r * layerDef[li - 1].ratio : 0;
      var midR = (layerR + prevLR) / 2;

      // Place anchor at midpoint of the layer band, on the left
      var labelAngle = PI + (PI * 0.6) * ((li + 0.5) / layerDef.length - 0.5);
      var anchorX = x + Math.cos(labelAngle) * midR;
      var anchorY = y + Math.sin(labelAngle) * midR;

      // Leader line endpoint — extend left of the sphere
      var leaderEndX = x - r - fontSize * 0.8 - 8;
      var leaderMidX = x - r - 4;
      var leaderY = anchorY;

      // Clamp label Y so it stays within the sphere bounds
      if (leaderY < y - r + fontSize * 0.5) leaderY = y - r + fontSize * 0.5;
      if (leaderY > y + r - fontSize * 0.5) leaderY = y + r - fontSize * 0.5;

      if (r > 60) {
        // Leader line
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = Math.max(0.5, r / 200);
        ctx.beginPath();
        ctx.moveTo(anchorX, anchorY);
        ctx.lineTo(leaderMidX, leaderY);
        ctx.lineTo(leaderEndX, leaderY);
        ctx.stroke();

        // Small dot at anchor point
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(anchorX, anchorY, Math.max(1.5, r / 80), 0, PI * 2);
        ctx.fill();

        // Label text
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(lyr.label, leaderEndX - 3, leaderY);
      } else {
        // Simpler labels without leader lines when 40 < r <= 60
        var simpleX = x - midR * 0.7;
        var simpleY = y + (li - (layerDef.length - 1) / 2) * (fontSize + 2);
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillText(lyr.label, simpleX, simpleY);
      }
    }
  }

  ctx.restore();
}

var overlayRenderers = {
  flat: drawOverlay_flat,
  albedo: drawOverlay_albedo,
  wireframe: drawOverlay_wireframe,
  depth: drawOverlay_depth,
  layers: drawOverlay_layers
};

// ─── Orbital plane rendering ─────────────────────────────────────────

function drawOrbitalPlanes3D() {
  if (!effects.orbitalPlanes) return;
  var camDist = Math.sqrt(cam3d.px * cam3d.px + cam3d.py * cam3d.py + cam3d.pz * cam3d.pz);
  if (camDist > 0.01) return;

  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.3;

  for (var name in orbitalPlaneData) {
    var op = orbitalPlaneData[name];
    var smaLy = op.sma * AU_IN_LY;
    var incRad = op.inc * DEG2RAD;
    var lanRad = op.lan * DEG2RAD;
    var cosI = Math.cos(incRad), sinI = Math.sin(incRad);
    var cosL = Math.cos(lanRad), sinL = Math.sin(lanRad);

    var ecc = op.ecc || 0;
    var aopRad = (op.aop || 0) * DEG2RAD;
    var cosW = Math.cos(aopRad), sinW = Math.sin(aopRad);
    var semiMinor = smaLy * Math.sqrt(1 - ecc * ecc);
    // Focus offset from center
    var focusOff = smaLy * ecc;

    var pts = [];
    for (var step = 0; step <= 72; step++) {
      var angle = step / 72 * Math.PI * 2;
      // Ellipse in orbital plane (centered on focus)
      var ex = smaLy * Math.cos(angle) - focusOff;
      var ey = semiMinor * Math.sin(angle);
      // Rotate by argument of perihelion
      var ox = ex * cosW - ey * sinW;
      var oy = ex * sinW + ey * cosW;
      // Rotate by inclination and LAN into ecliptic
      var rx = ox * cosL - oy * sinL * cosI;
      var ry = ox * sinL + oy * cosL * cosI;
      var rz = oy * sinI;
      var sp = worldToScreen3D(rx, ry, rz);
      if (sp) pts.push(sp);
      else pts.push(null);
    }

    // Find object color
    var col = '#6a6a8a';
    for (var oi = 0; oi < objects.length; oi++) {
      if (objects[oi].name === name) { col = objects[oi].color; break; }
    }
    ctx.strokeStyle = col;

    // Draw segments, skipping nulls (behind camera)
    var drawing = false;
    for (var pi = 0; pi < pts.length; pi++) {
      if (pts[pi]) {
        if (!drawing) { ctx.beginPath(); ctx.moveTo(pts[pi].x, pts[pi].y); drawing = true; }
        else ctx.lineTo(pts[pi].x, pts[pi].y);
      } else {
        if (drawing) { ctx.stroke(); drawing = false; }
      }
    }
    if (drawing) ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── Occlusion / shadow rendering ────────────────────────────────────

function drawOcclusion(disks) {
  if (!effects.occlusion || disks.length < 2) return;
  // Sort front-to-back (smaller depth = closer to camera)
  var sorted = disks.slice().sort(function(a, b) { return a.depth - b.depth; });

  for (var i = 0; i < sorted.length; i++) {
    var front = sorted[i];
    if (front.r < 3) continue;
    for (var j = i + 1; j < sorted.length; j++) {
      var behind = sorted[j];
      if (behind.r < 3) continue;
      var dx = front.x - behind.x;
      var dy = front.y - behind.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > front.r + behind.r) continue;
      if (dist + behind.r < front.r) continue;

      // Partial occlusion: dark shadow on the behind object
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#000008';
      ctx.beginPath();
      ctx.arc(behind.x, behind.y, behind.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(front.x, front.y, front.r * 1.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

// ─── 3D Coordinate Conversion ─────────────────────────────────────────

var DEG2RAD = Math.PI / 180;

function formatAngularSize(radians) {
  var deg = radians / DEG2RAD;
  if (deg >= 1) return deg.toFixed(1) + '\u00b0';
  var arcmin = deg * 60;
  if (arcmin >= 1) return arcmin.toFixed(1) + "'";
  var arcsec = deg * 3600;
  return arcsec.toFixed(1) + '"';
}

function raDecToXYZ(raDeg, decDeg, dist) {
  var ra = raDeg * DEG2RAD;
  var dec = decDeg * DEG2RAD;
  return {
    x: dist * Math.cos(dec) * Math.cos(ra),
    y: dist * Math.cos(dec) * Math.sin(ra),
    z: dist * Math.sin(dec)
  };
}

function galacticPeriod(galR) {
  if (galR < 100) return 1e12; // effectively stationary for objects near galactic center
  return (2 * Math.PI * galR) / GAL_V_CIRC; // years
}

function initObjects3D() {
  // Compute initial Keplerian positions for planets
  updatePlanetPositions();
  for (var i = 0; i < objects.length; i++) {
    var o = objects[i];
    // Skip objects already positioned by Keplerian mechanics
    if (orbitalPlaneData[o.name] || o.name === 'Moon') continue;
    if (o.ra !== undefined && o.dec !== undefined) {
      var c = raDecToXYZ(o.ra, o.dec, o.dist || 0.0001);
      o.wx3d = c.x;
      o.wy3d = c.y;
      o.wz3d = c.z;
    } else if (o.name === 'Sun (You Are Here)') {
      o.wx3d = 0; o.wy3d = 0; o.wz3d = 0;
    } else if (o.category === 'solar') {
      o.wx3d = o.x;
      o.wy3d = o.y;
      o.wz3d = o.orbZ || 0;
    } else {
      o.wx3d = o.x;
      o.wy3d = o.y;
      o.wz3d = 0;
    }
    // Store base positions for proper motion
    if (properMotionData[o.name] && o.ra !== undefined) {
      o._baseRA = o.ra;
      o._baseDec = o.dec;
      o._baseDist = o.dist;
      o._baseX = o.x;
      o._baseY = o.y;
    }
  }
  // Compute galactic orbital parameters for all non-solar objects
  for (var gi = 0; gi < objects.length; gi++) {
    var go = objects[gi];
    if (go.category === 'solar') continue; // planets use Keplerian
    var gdx = go.x - GAL_CENTER_X;
    var gdy = go.y - GAL_CENTER_Y;
    go._galR = Math.sqrt(gdx * gdx + gdy * gdy);
    go._galAngle0 = Math.atan2(gdy, gdx);
    go._galPeriod = galacticPeriod(go._galR);
    go._galBaseX = go.x;
    go._galBaseY = go.y;
    // Vertical oscillation: derive amplitude from current z-position
    go._galZ0 = go.wz3d || 0;
    go._zAmp = Math.max(Math.abs(go._galZ0), 50);
    go._zPeriod = GAL_Z_PERIOD * Math.sqrt(go._galR / 26000);
    go._zPhase0 = go._galZ0 >= 0 ? Math.asin(Math.min(1, go._galZ0 / go._zAmp)) : Math.asin(Math.max(-1, go._galZ0 / go._zAmp));
  }
}

// Update stellar positions based on proper motion and radial velocity
function updateStellarPositions() {
  var years = getSimDaysJ2000() / 365.25;
  var absYears = Math.abs(years);

  for (var i = 0; i < objects.length; i++) {
    var o = objects[i];
    if (o.category === 'solar') continue;
    if (o._galR === undefined) continue;

    // Galactic rotation: circular orbit around galactic center
    var galAngle = o._galAngle0 + (years / o._galPeriod) * Math.PI * 2;
    var gx = GAL_CENTER_X + o._galR * Math.cos(galAngle);
    var gy = GAL_CENTER_Y + o._galR * Math.sin(galAngle);

    // Vertical oscillation
    var gz = o._zAmp * Math.sin(Math.PI * 2 * years / o._zPeriod + o._zPhase0);

    // Proper motion blending: add linear PM delta for short timescales
    var pmDx = 0, pmDy = 0, pmDz = 0;
    var pm = properMotionData[o.name];
    if (pm && o._baseRA !== undefined && absYears < 50000) {
      var blend = absYears < 10000 ? 1.0 : (50000 - absYears) / 40000;
      var newRA = o._baseRA + (pm.pmRA / 3600000 / Math.cos(o._baseDec * DEG2RAD)) * years;
      var newDec = o._baseDec + (pm.pmDec / 3600000) * years;
      var rvLyPerYr = pm.rv * 3.156e7 / 9.461e12;
      var newDist = Math.max(0.01, o._baseDist + rvLyPerYr * years);
      var cPM = raDecToXYZ(newRA, newDec, newDist);
      var c0 = raDecToXYZ(o._baseRA, o._baseDec, o._baseDist);
      pmDx = (cPM.x - c0.x) * blend;
      pmDy = (cPM.y - c0.y) * blend;
      pmDz = (cPM.z - c0.z) * blend;
    }

    // Combine: galactic orbit delta from baseline + PM blend
    var baseDx = gx - o._galBaseX;
    var baseDy = gy - o._galBaseY;
    o.x = o._galBaseX + baseDx + pmDx;
    o.y = o._galBaseY + baseDy + pmDy;
    o.wx3d = o.x;
    o.wy3d = o.y;
    o.wz3d = gz + pmDz;
    o.dist = Math.sqrt(o.x * o.x + o.y * o.y);
  }
}

function updateGalaxyMotion() {
  var years = getSimDaysJ2000() / 365.25;
  if (Math.abs(years) < 1000) return;

  for (var i = 0; i < objects.length; i++) {
    var o = objects[i];
    var gm = galaxyMotion[o.name];
    if (gm) {
      o.x = (o._galBaseX || o.x) + gm.vx * years;
      o.y = (o._galBaseY || o.y) + gm.vy * years;
      o.wx3d = o.x;
      o.wy3d = o.y;
      o.wz3d = (o._galZ0 || 0) + gm.vz * years;
      o.dist = Math.sqrt(o.x * o.x + o.y * o.y);
      continue;
    }
    if ((o.category === 'cosmic' || o.category === 'local') && o.dist > 5e6) {
      var dx = o._galBaseX || o.x;
      var dy = o._galBaseY || o.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        var hubbleV = HUBBLE_RATE * d;
        var expansion = hubbleV * years;
        var scale = 1 + expansion / d;
        o.x = dx * scale;
        o.y = dy * scale;
        o.wx3d = o.x;
        o.wy3d = o.y;
        o.dist = d * scale;
      }
    }
  }
}

function worldToScreen3D(wx, wy, wz) {
  var dx = wx - cam3d.px;
  var dy = wy - cam3d.py;
  var dz = wz - cam3d.pz;

  // Right vector: (-sinY, cosY, 0)
  var viewX = dx * (-_sinY) + dy * _cosY;
  // Up vector: (-sinP*cosY, -sinP*sinY, cosP)
  var viewY = dx * (-_sinP * _cosY) + dy * (-_sinP * _sinY) + dz * _cosP;
  // Forward vector: (cosP*cosY, cosP*sinY, sinP)
  var viewZ = dx * (_cosP * _cosY) + dy * (_cosP * _sinY) + dz * _sinP;

  if (viewZ <= 1e-12) return null; // behind camera

  var sw = W / dpr;
  var sh = H / dpr;
  var focalLen = 1 / Math.tan(cam3d.fov * DEG2RAD / 2);
  var halfW = sw / 2;

  return {
    x: halfW + (viewX / viewZ) * focalLen * halfW,
    y: sh / 2 - (viewY / viewZ) * focalLen * halfW,
    depth: viewZ,
    scale: focalLen / viewZ  // for sizing objects
  };
}

function getVisibleObjects3D() {
  var sw = W / dpr;
  var sh = H / dpr;
  var m = 80;
  var result = [];
  updateFocusedConstellationStars();
  for (var i = 0; i < objects.length; i++) {
    var o = objects[i];
    var sp = worldToScreen3D(o.wx3d, o.wy3d, o.wz3d);
    if (!sp) continue;
    if (sp.x > -m && sp.x < sw + m && sp.y > -m && sp.y < sh + m) {
      var distToCam = sp.depth;
      var score = computeVisibilityScore(o, distToCam);
      if (score < 0.01) continue;
      o._sp3d = sp;
      o._vis3dScore = score;
      o._vis3dAlpha = Math.min(1.0, score * 2);
      result.push(o);
    }
  }
  // Cull overlapping objects, then depth sort
  result = cullOverlapping(result);
  return result;
}

// ─── 3D Visibility Scoring ────────────────────────────────────────────

// Build set of star names belonging to constellations the camera faces
var _focusedConStars = {};
function updateFocusedConstellationStars() {
  _focusedConStars = {};
  if (typeof constellationDefs === 'undefined') return;
  // Camera forward vector
  var cosP = Math.cos(cam3d.pitch), sinP = Math.sin(cam3d.pitch);
  var cosY = Math.cos(cam3d.yaw), sinY = Math.sin(cam3d.yaw);
  var fwdX = cosP * cosY, fwdY = cosP * sinY, fwdZ = sinP;

  for (var cId in constellationDefs) {
    var cDef = constellationDefs[cId];
    // Find centroid of constellation stars
    var cx = 0, cy = 0, cz = 0, cnt = 0;
    var seen = {};
    var memberNames = [];
    for (var li = 0; li < cDef.lines.length; li++) {
      for (var si = 0; si < 2; si++) {
        var sn = cDef.lines[li][si];
        if (seen[sn]) continue;
        seen[sn] = true;
        memberNames.push(sn);
        var _sobj = findObject(sn);
        if (_sobj) {
          cx += _sobj.wx3d; cy += _sobj.wy3d; cz += _sobj.wz3d;
          cnt++;
        }
      }
    }
    if (cnt === 0) continue;
    cx /= cnt; cy /= cnt; cz /= cnt;
    // Direction from camera to centroid
    var dx = cx - cam3d.px, dy = cy - cam3d.py, dz = cz - cam3d.pz;
    var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 1e-12) continue;
    var dot = (dx * fwdX + dy * fwdY + dz * fwdZ) / d;
    // If constellation centroid is within ~60 degrees of camera forward, boost members
    if (dot > 0.5) {
      for (var mi = 0; mi < memberNames.length; mi++) {
        _focusedConStars[memberNames[mi]] = true;
      }
    }
  }
}

function computeVisibilityScore(obj, camDist) {
  // camDist = distance from camera to object in ly
  // Returns 0-1 score; 0 = invisible, 1 = fully visible

  // Sol is ALWAYS the anchor — max score, always visible from anywhere
  if (obj.name === 'Sun (You Are Here)') return 1.0;

  // Selected or hovered objects always fully visible
  if (state.selected === obj || state.hoverObj === obj) return 1.0;

  // Constellation members in camera's field of view always visible
  if (_focusedConStars[obj.name]) return 1.0;

  var baseMag = obj.radius || 3;
  var camFromOrigin = Math.sqrt(cam3d.px * cam3d.px + cam3d.py * cam3d.py + cam3d.pz * cam3d.pz);

  // Solar-system objects (except Sol) only visible near origin
  if (obj.category === 'solar' && camFromOrigin > 0.01) return 0;

  // Milky Way always visible as the halo around Sol
  if (obj.name === 'Milky Way (You Are Here)') return 1.0;

  // Large-scale objects use logarithmic falloff — visible across the universe
  if (obj.category === 'galaxy' || obj.category === 'cosmic' || obj.category === 'local' || obj.category === 'cluster') {
    var logDist = Math.log10(camDist + 1);
    return Math.min(1.0, baseMag / (logDist * logDist + 1) * 0.5);
  }

  // Stellar/nebula/exotic use inverse square with category weighting
  var apparentBrightness = baseMag / (camDist * camDist + 1);
  var catWeight = 1.0;

  if (camFromOrigin > 1000) {
    if (obj.category === 'stellar') catWeight = 0.15;
    if (obj.category === 'nebula') catWeight = 0.3;
  }

  // Named/important stars get a floor (constellation members, major stars)
  if (obj.constellation) catWeight = Math.max(catWeight, 0.5);

  return Math.min(1.0, apparentBrightness * catWeight * 1000);
}

function cullOverlapping(visibleList) {
  // Remove objects within 5px of a brighter/higher-scored neighbor
  // Sol and Milky Way are NEVER culled — they are anchors
  var byScore = visibleList.slice().sort(function(a, b) {
    return (b._vis3dScore || 0) - (a._vis3dScore || 0);
  });
  var kept = [];
  for (var i = 0; i < byScore.length; i++) {
    var obj = byScore[i];
    // Anchor and selected objects are never culled
    if (obj.name === 'Sun (You Are Here)' || obj.name === 'Milky Way (You Are Here)' || obj === state.selected) {
      kept.push(obj); continue;
    }
    var dominated = false;
    for (var j = 0; j < kept.length; j++) {
      var dx = obj._sp3d.x - kept[j]._sp3d.x;
      var dy = obj._sp3d.y - kept[j]._sp3d.y;
      // Only cull if overlapping AND behind the dominator (closer objects stay visible)
      if (dx * dx + dy * dy < 25 && obj._sp3d.depth >= kept[j]._sp3d.depth) {
        dominated = true;
        break;
      }
    }
    if (!dominated) kept.push(obj);
  }
  // Re-sort by depth for proper back-to-front rendering
  kept.sort(function(a, b) { return b._sp3d.depth - a._sp3d.depth; });
  return kept;
}

// ─── Parallax ─────────────────────────────────────────────────────────

function getParallaxOffset(obj) {
  if (!parallaxState.active || !obj.constellation || obj.constellation !== parallaxState.constellation) return null;
  var shift = parallaxState.shiftK / obj.dist * parallaxState.progress;
  return { dx: shift * Math.cos(parallaxState.shiftAngle), dy: shift * Math.sin(parallaxState.shiftAngle) };
}

function startParallax(opts) {
  resetParallax();
  var delay = opts.delay || 2000;
  var duration = opts.duration || 4000;
  parallaxState.constellation = opts.constellation;
  parallaxState.shiftK = opts.shiftK || 28000;
  parallaxState.shiftAngle = opts.shiftAngle || 0;
  parallaxState.label = opts.label || '';
  parallaxState.progress = 0;
  parallaxState.active = true;
  parallaxState.flashAlpha = 0;

  var delayTimer = setTimeout(function() {
    // Flash effect when shift begins
    parallaxState.flashAlpha = 1;
    var accumulated = 0;
    var lastTime = performance.now();
    function tick() {
      if (!parallaxState.active) return;
      var now = performance.now();
      if (!tourEngine.paused) {
        accumulated += now - lastTime;
      }
      lastTime = now;
      var t = Math.min(1, accumulated / duration);
      parallaxState.progress = easeInOutCubic(t);
      parallaxState.flashAlpha = Math.max(0, 1 - accumulated / 800);
      state.dirty = true;
      if (t < 1) {
        parallaxState.animId = requestAnimationFrame(tick);
      } else {
        parallaxState.animId = null;
      }
    }
    parallaxState.animId = requestAnimationFrame(tick);
  }, delay);
  parallaxState.animId = delayTimer;
}

function resetParallax() {
  if (parallaxState.animId) {
    cancelAnimationFrame(parallaxState.animId);
    clearTimeout(parallaxState.animId);
    parallaxState.animId = null;
  }
  if (parallaxState.active) {
    parallaxState.active = false;
    parallaxState.progress = 0;
    state.dirty = true;
  }
}

// ─── Visibility ───────────────────────────────────────────────────────

function getVisibleObjects() {
  var vr = getViewRadius();
  var sw = W / dpr;
  var sh = H / dpr;
  var m = 80;
  return objects.filter(function(o) {
    // Always show the selected/navigated-to object
    if (state.selected === o) {
      var sp2 = worldToScreen(o.x, o.y);
      return sp2.x > -m && sp2.x < sw + m && sp2.y > -m && sp2.y < sh + m;
    }
    var range = o.visRange || catRanges[o.category];
    if (!range) return false;
    if (vr < range[0] * 0.99 || vr > range[1] * 1.01) return false;
    var sp = worldToScreen(o.x, o.y);
    return sp.x > -m && sp.x < sw + m && sp.y > -m && sp.y < sh + m;
  });
}

// ─── Draw: starfield + twinkling ──────────────────────────────────────

function drawStarfield(ts) {
  var sw = W / dpr;
  var sh = H / dpr;
  var vr = getViewRadius();
  var logVR = Math.log10(vr);

  var layers = [
    { count: 100, seedMult: 2.0, alpha: 0.08, sizeMax: 1.0 },
    { count: 80, seedMult: 3.0, alpha: 0.18, sizeMax: 1.5 },
    { count: 40, seedMult: 5.0, alpha: 0.35, sizeMax: 2.0 }
  ];

  layers.forEach(function(layer) {
    var seed = Math.floor(logVR * layer.seedMult);
    for (var i = 0; i < layer.count; i++) {
      var h = hash3(i, seed);
      var x = h.a * sw;
      var y = h.b * sh;
      var b = h.c;
      ctx.fillStyle = "rgba(200, 200, 240, " + (layer.alpha * (0.3 + b * 0.7)) + ")";
      var s = b > 0.6 ? layer.sizeMax : layer.sizeMax * 0.6;
      ctx.fillRect(x, y, s, s);
    }
  });

  // Animated twinkling overlay
  if (effects.twinkling && ts !== undefined) {
    var tSec = ts / 1000;
    for (var i = 0; i < twinkleStars.length; i++) {
      var star = twinkleStars[i];
      var alpha = star.baseAlpha * (0.4 + 0.6 * Math.sin(tSec * star.speed + star.phase));
      if (alpha < 0.02) continue;
      var sx = star.x * sw;
      var sy = star.y * sh;
      ctx.fillStyle = "rgba(220, 220, 255, " + alpha + ")";
      ctx.fillRect(sx, sy, star.size, star.size);

      if (star.bright && alpha > 0.3) {
        var fl = star.size * 2.5 * alpha;
        ctx.strokeStyle = "rgba(220, 220, 255, " + (alpha * 0.3) + ")";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(sx - fl, sy + star.size / 2);
        ctx.lineTo(sx + fl + star.size, sy + star.size / 2);
        ctx.moveTo(sx + star.size / 2, sy - fl);
        ctx.lineTo(sx + star.size / 2, sy + fl + star.size);
        ctx.stroke();
      }
    }
  }
}

// ─── Draw: warp streaks ───────────────────────────────────────────────

function drawWarpStreaks(ts) {
  if (!effects.warpStreaks) return;
  if (state.warpIntensity < 0.01) return;

  var sw = W / dpr;
  var sh = H / dpr;
  var cx = sw / 2;
  var cy = sh / 2;
  var intensity = state.warpIntensity;
  var tSec = (ts || 0) / 1000;
  var maxDim = Math.min(sw, sh);

  ctx.save();
  ctx.globalAlpha = intensity * 0.6;

  for (var i = 0; i < warpParticles.length; i++) {
    var p = warpParticles[i];
    var osc = Math.sin(tSec * p.speed * 2 + p.phase) * 0.05;
    var angle = p.angle + osc;
    var innerR = (p.baseRadius + osc * 0.1) * maxDim * 0.5;
    var outerR = innerR + (p.length * maxDim * 0.5) * intensity + 10;

    var x1 = cx + Math.cos(angle) * innerR;
    var y1 = cy + Math.sin(angle) * innerR;
    var x2 = cx + Math.cos(angle) * outerR;
    var y2 = cy + Math.sin(angle) * outerR;

    ctx.strokeStyle = "rgba(180, 190, 230, " + (p.brightness * 0.4) + ")";
    ctx.lineWidth = 0.5 + p.brightness * 1.5 * intensity;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Draw: ambient particles ──────────────────────────────────────────

function drawAmbientParticles(ts) {
  if (!effects.ambientParticles) return;
  var sw = W / dpr;
  var sh = H / dpr;
  var tSec = (ts || 0) / 1000;

  for (var i = 0; i < ambientParticles.length; i++) {
    var p = ambientParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = 1;
    if (p.x > 1) p.x = 0;
    if (p.y < 0) p.y = 1;
    if (p.y > 1) p.y = 0;
    var a = p.alpha * (0.5 + 0.5 * Math.sin(tSec * 0.3 + p.phase));
    ctx.fillStyle = "rgba(160, 160, 200, " + a + ")";
    ctx.beginPath();
    ctx.arc(p.x * sw, p.y * sh, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Draw: vignette ───────────────────────────────────────────────────

function drawVignette() {
  var sw = W / dpr;
  var sh = H / dpr;
  if (sw !== _vignetteW || sh !== _vignetteH) {
    _vignetteW = sw;
    _vignetteH = sh;
    var cx = sw / 2;
    var cy = sh / 2;
    var r = Math.max(sw, sh) * 0.7;
    _vignetteGrad = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r);
    _vignetteGrad.addColorStop(0, 'rgba(10, 10, 18, 0)');
    _vignetteGrad.addColorStop(1, 'rgba(10, 10, 18, 0.5)');
  }
  ctx.fillStyle = _vignetteGrad;
  ctx.fillRect(0, 0, sw, sh);
}

// ─── Draw: regions ────────────────────────────────────────────────────

function drawOrbits() {
  if (!effects.orbits) return;
  var vr = getViewRadius();
  if (vr > 0.003) return;          // only at solar system scale
  var scale = getScale();

  // Fade in below vr 0.003, full below 0.001
  var alpha = vr > 0.001 ? 1.0 - (vr - 0.001) / 0.002 : 1.0;
  alpha = Math.max(0, Math.min(1, alpha)) * 0.35;

  // Collect orbit color from objects array
  var orbitColors = {};
  for (var i = 0; i < objects.length; i++) {
    if (orbitalPlaneData[objects[i].name]) orbitColors[objects[i].name] = objects[i].color;
  }

  ctx.save();
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 0.8;
  for (var name in _orbitCache) {
    var elem = orbitalPlaneData[name];
    var color = orbitColors[name];
    if (!color) continue;
    var rCheck = elem.sma * AU_IN_LY * scale;
    if (rCheck < 3 || rCheck > W * 4) continue;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    var pts = _orbitCache[name];
    for (var si = 0; si < pts.length; si++) {
      var sp = worldToScreen(pts[si].x, pts[si].y);
      if (si === 0) ctx.moveTo(sp.x, sp.y);
      else ctx.lineTo(sp.x, sp.y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawAsteroidBelt() {
  if (!effects.orbits) return;
  var vr = getViewRadius();
  if (vr > 0.003) return;
  var scale = getScale();

  var alpha = vr > 0.001 ? 1.0 - (vr - 0.001) / 0.002 : 1.0;
  alpha = Math.max(0, Math.min(1, alpha)) * 0.3;
  if (alpha < 0.01) return;

  ctx.save();
  ctx.fillStyle = asteroidBeltConfig.color;
  ctx.globalAlpha = alpha;

  for (var i = 0; i < _asteroidCache.length; i++) {
    var ast = _asteroidCache[i];
    var rPx = ast.rLY * scale;
    if (rPx < 2 || rPx > W * 3) continue;
    var sp = worldToScreen(ast.wx, ast.wy);
    ctx.fillRect(sp.x - ast.sz * 0.5, sp.y - ast.sz * 0.5, ast.sz, ast.sz);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawRegions() {
  var vr = getViewRadius();
  var scale = getScale();

  regions.forEach(function(r) {
    if (vr < r.minVR || vr > r.maxVR) return;
    var sp = worldToScreen(r.cx, r.cy);
    var rxPx = r.rx * scale;
    var ryPx = r.ry * scale;
    if (rxPx < 4 || ryPx < 4) return;
    var sw = W / dpr;
    var sh = H / dpr;
    if (rxPx > sw * 6 && ryPx > sh * 6) return;

    ctx.save();
    ctx.translate(sp.x, sp.y);
    if (r.rotation) ctx.rotate(r.rotation);

    ctx.fillStyle = r.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, rxPx, ryPx, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = r.stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.ellipse(0, 0, rxPx, ryPx, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (r.labelColor && rxPx > 25) {
      ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
      ctx.fillStyle = r.labelColor;
      ctx.textAlign = 'center';
      ctx.fillText(r.name, 0, -ryPx - 8);
      if (r.desc && rxPx > 60) {
        ctx.font = '9px Space Mono, SF Mono, Menlo, monospace';
        ctx.fillText(r.desc, 0, -ryPx + 6);
      }
    }
    ctx.restore();
  });
}

// ─── Draw: spiral galaxy ──────────────────────────────────────────────

function drawSpiralArms(cx, cy, scale, numArms, armRadius, rotation, alpha, tiltX, tiltY) {
  // Logarithmic spiral: r = a * e^(b*theta)
  // Milky Way pitch angle ~12-14 degrees → b ≈ 0.21-0.25
  var sp = worldToScreen(cx, cy);
  var rPx = armRadius * scale;
  if (rPx < 15) return;

  var b = 0.22; // pitch angle parameter (tighter = more realistic)
  // a chosen so spiral reaches armRadius at max theta
  var maxTheta = 3.0 * Math.PI; // ~1.5 full turns per arm
  var a = armRadius / Math.exp(b * maxTheta);
  var tX = tiltX || 1, tY = tiltY || 1; // elliptical tilt for inclination

  ctx.save();

  for (var arm = 0; arm < numArms; arm++) {
    var angleOff = (arm / numArms) * Math.PI * 2 + rotation;
    var steps = Math.min(300, Math.max(80, Math.round(rPx * 0.8)));

    // Draw each arm with multiple passes (wide+dim → narrow+bright) for glow
    var passes = [
      { wMul: 0.10, a: alpha * 0.10 },
      { wMul: 0.05, a: alpha * 0.22 },
      { wMul: 0.020, a: alpha * 0.40 },
      { wMul: 0.008, a: alpha * 0.55 }
    ];

    passes.forEach(function(pass) {
      ctx.strokeStyle = "rgba(180, 200, 255, " + pass.a + ")";
      ctx.lineWidth = Math.max(0.5, rPx * pass.wMul);
      ctx.lineCap = 'round';
      ctx.beginPath();
      var started = false;

      for (var i = 0; i <= steps; i++) {
        var frac = i / steps;
        var theta = frac * maxTheta;
        var r = a * Math.exp(b * theta) * scale;

        // Taper alpha at start and end for soft tips
        var taper = 1;
        if (frac < 0.08) taper = frac / 0.08; // fade in from center
        if (frac > 0.85) taper = (1 - frac) / 0.15; // fade out at tips
        taper = taper * taper; // quadratic for smoother fade

        var angle = theta + angleOff;
        var px = sp.x + Math.cos(angle) * r * tX;
        var py = sp.y + Math.sin(angle) * r * tY;

        if (!started) { ctx.moveTo(px, py); started = true; }
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      // Draw tapered tips by redrawing the end section with decreasing alpha
      // (The lineCap: round handles the very tip naturally)
    });

    // Add knots/clumps along the arm (star-forming regions)
    if (rPx > 60) {
      for (var k = 0; k < 8; k++) {
        var kFrac = 0.15 + k * 0.10;
        var kTheta = kFrac * maxTheta;
        var kR = a * Math.exp(b * kTheta) * scale;
        var kAngle = kTheta + angleOff;
        var kx = sp.x + Math.cos(kAngle) * kR * tX;
        var ky = sp.y + Math.sin(kAngle) * kR * tY;
        var kSize = rPx * (0.008 + Math.sin(k * 2.7) * 0.004);

        // Vary brightness/color for each knot
        var kAlpha = alpha * (0.15 + Math.sin(k * 3.1) * 0.08);
        ctx.fillStyle = "rgba(200, 220, 255, " + kAlpha + ")";
        ctx.beginPath();
        ctx.arc(kx, ky, Math.max(1, kSize), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Central bar (barred spiral — Milky Way has a bar ~27,000 ly long)
  if (numArms >= 4) {
    var barLen = armRadius * 0.27 * scale;
    var barW = armRadius * 0.06 * scale;
    if (barLen > 4) {
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(rotation + 0.47); // bar angle ~27° to our line of sight

      var barGrad = ctx.createLinearGradient(-barLen, 0, barLen, 0);
      barGrad.addColorStop(0, "rgba(255, 220, 160, 0)");
      barGrad.addColorStop(0.2, "rgba(255, 220, 160, " + (alpha * 0.25) + ")");
      barGrad.addColorStop(0.5, "rgba(255, 230, 180, " + (alpha * 0.35) + ")");
      barGrad.addColorStop(0.8, "rgba(255, 220, 160, " + (alpha * 0.25) + ")");
      barGrad.addColorStop(1, "rgba(255, 220, 160, 0)");
      ctx.fillStyle = barGrad;

      // Rounded bar shape
      ctx.beginPath();
      ctx.ellipse(0, 0, barLen, Math.max(1, barW), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Central bulge glow
  var bulgeR = armRadius * scale * 0.12;
  if (bulgeR > 2) {
    var bg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, bulgeR);
    bg.addColorStop(0, "rgba(255, 235, 190, " + (alpha * 0.55) + ")");
    bg.addColorStop(0.3, "rgba(255, 220, 160, " + (alpha * 0.25) + ")");
    bg.addColorStop(0.7, "rgba(200, 180, 140, " + (alpha * 0.08) + ")");
    bg.addColorStop(1, "rgba(180, 160, 120, 0)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, bulgeR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Diffuse disk glow behind everything
  var diskR = armRadius * scale * 0.6;
  if (diskR > 10) {
    var dg = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, diskR);
    dg.addColorStop(0, "rgba(150, 170, 220, " + (alpha * 0.06) + ")");
    dg.addColorStop(0.5, "rgba(130, 150, 200, " + (alpha * 0.03) + ")");
    dg.addColorStop(1, "rgba(100, 120, 180, 0)");
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.ellipse(sp.x, sp.y, diskR * tX, diskR * tY, rotation, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGalaxies() {
  var vr = getViewRadius();
  var scale = getScale();

  // Milky Way spiral at galaxy scale (4 arms, face-on since we're inside it)
  if (vr >= 2000 && vr <= 250000) {
    var fade = 1;
    if (vr < 5000) fade = (vr - 2000) / 3000;
    if (vr > 200000) fade = (250000 - vr) / 50000;
    drawSpiralArms(-26000, 0, scale, 4, 52500, 0.82, Math.min(1, fade) * 0.4);
  }

  // Andromeda spiral at local/cosmic scale (2 major arms, tilted ~77° to us)
  if (vr >= 300000 && vr <= 20e6) {
    var fade2 = 1;
    if (vr < 600000) fade2 = (vr - 300000) / 300000;
    if (vr > 15e6) fade2 = (20e6 - vr) / 5e6;
    drawSpiralArms(-1.5e6, -2.0e6, scale, 2, 110000, -0.4, Math.min(1, fade2) * 0.3, 1.0, 0.4);
  }
}

// ─── Draw: 3D spiral arms ──────────────────────────────────────────────

function drawSpiralArms3D() {
  var camDist = Math.sqrt(cam3d.px * cam3d.px + cam3d.py * cam3d.py + cam3d.pz * cam3d.pz);
  // Visible at galaxy scale: fade in 2000-5000 ly, fade out 200k-250k ly
  if (camDist < 2000 || camDist > 250000) return;
  var fade = 1;
  if (camDist < 5000) fade = (camDist - 2000) / 3000;
  if (camDist > 200000) fade = (250000 - camDist) / 50000;
  var alpha = Math.max(0, Math.min(1, fade)) * 0.35;
  if (alpha < 0.01) return;

  var galCX = -26000, galCY = 0, galCZ = 0;
  var numArms = 4, armRadius = 52500, rotation = 0.82;
  var b = 0.22;
  var maxTheta = 3.0 * Math.PI;
  var a = armRadius / Math.exp(b * maxTheta);
  var steps = 120;

  ctx.save();
  ctx.lineCap = 'round';

  for (var arm = 0; arm < numArms; arm++) {
    var angleOff = (arm / numArms) * Math.PI * 2 + rotation;

    // Two passes: wide dim glow, narrow bright core
    var passes = [
      { wMul: 3.0, al: alpha * 0.12 },
      { wMul: 1.0, al: alpha * 0.35 }
    ];

    for (var pi = 0; pi < passes.length; pi++) {
      var pass = passes[pi];
      ctx.strokeStyle = 'rgba(180, 200, 255, ' + pass.al + ')';
      ctx.beginPath();
      var started = false;
      var lastSP = null;

      for (var si = 0; si <= steps; si++) {
        var frac = si / steps;
        var theta = frac * maxTheta;
        var r3 = a * Math.exp(b * theta);
        var angle = theta + angleOff;
        // Spiral in galactic plane (z=0)
        var wx = galCX + Math.cos(angle) * r3;
        var wy = galCY + Math.sin(angle) * r3;
        var sp = worldToScreen3D(wx, wy, galCZ);
        if (!sp) { started = false; lastSP = null; continue; }
        // Set line width based on perspective scale
        if (!started) {
          ctx.lineWidth = Math.max(0.5, pass.wMul * Math.min(8, sp.scale * 500));
          ctx.moveTo(sp.x, sp.y);
          started = true;
        } else {
          ctx.lineTo(sp.x, sp.y);
        }
        lastSP = sp;
      }
      ctx.stroke();
    }

    // Star-forming knots along arm
    if (camDist < 100000) {
      ctx.fillStyle = 'rgba(200, 220, 255, ' + (alpha * 0.3) + ')';
      for (var k = 0; k < 8; k++) {
        var kFrac = 0.15 + k * 0.10;
        var kTheta = kFrac * maxTheta;
        var kR = a * Math.exp(b * kTheta);
        var kAngle = kTheta + angleOff;
        var ksp = worldToScreen3D(galCX + Math.cos(kAngle) * kR, galCY + Math.sin(kAngle) * kR, galCZ);
        if (!ksp) continue;
        var kSize = Math.max(1, 2 * ksp.scale * 500);
        ctx.beginPath();
        ctx.arc(ksp.x, ksp.y, Math.min(kSize, 6), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Central bar
  var barLen = armRadius * 0.27;
  var barSp1 = worldToScreen3D(
    galCX + Math.cos(rotation + 0.47) * barLen,
    galCY + Math.sin(rotation + 0.47) * barLen, galCZ);
  var barSp2 = worldToScreen3D(
    galCX - Math.cos(rotation + 0.47) * barLen,
    galCY - Math.sin(rotation + 0.47) * barLen, galCZ);
  if (barSp1 && barSp2) {
    ctx.strokeStyle = 'rgba(255, 220, 160, ' + (alpha * 0.25) + ')';
    ctx.lineWidth = Math.max(1, Math.min(12, barSp1.scale * 2000));
    ctx.beginPath();
    ctx.moveTo(barSp1.x, barSp1.y);
    ctx.lineTo(barSp2.x, barSp2.y);
    ctx.stroke();
  }

  ctx.restore();
}

// ─── Draw: flow particles ─────────────────────────────────────────────

var flowSources = [
  [0, 0], [-40 * MLY, -35 * MLY], [30 * MLY, -52 * MLY],
  [-80 * MLY, 20 * MLY], [50 * MLY, 30 * MLY]
];
var flowTarget = [-140 * MLY, -210 * MLY];

function drawFlowParticles(ts) {
  if (!effects.flowLines) return;
  var vr = getViewRadius();
  if (vr < 40 * MLY || vr > 500 * MLY) return;

  for (var i = 0; i < flowParticles.length; i++) {
    var p = flowParticles[i];
    p.t += p.speed;
    if (p.t > 1) { p.t = 0; p.sourceIdx = Math.floor(Math.random() * 5); }

    var src = flowSources[p.sourceIdx];
    var t = p.t;

    // Quadratic bezier: source -> midpoint -> attractor
    var mx = (src[0] + flowTarget[0]) / 2 + p.offset * (flowTarget[1] - src[1]);
    var my = (src[1] + flowTarget[1]) / 2 - p.offset * (flowTarget[0] - src[0]);
    var omt = 1 - t;
    var wx = omt * omt * src[0] + 2 * omt * t * mx + t * t * flowTarget[0];
    var wy = omt * omt * src[1] + 2 * omt * t * my + t * t * flowTarget[1];

    var sp = worldToScreen(wx, wy);
    var sw = W / dpr;
    var sh = H / dpr;
    if (sp.x < -10 || sp.x > sw + 10 || sp.y < -10 || sp.y > sh + 10) continue;

    // Color gradient: cool blue -> warm orange
    var r = Math.round(80 + t * 175);
    var g = Math.round(120 + t * 60 - t * t * 80);
    var b = Math.round(200 - t * 150);
    var a = 0.15 * Math.sin(t * Math.PI);

    ctx.fillStyle = "rgba(" + r + "," + g + "," + b + "," + a + ")";
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Draw: object detail renderers ───────────────────────────────────

function nameHash(name, seed) {
  var h = 0;
  for (var i = 0; i < name.length; i++) {
    h = ((h << 5) - h) + name.charCodeAt(i) + seed;
    h = h & h;
  }
  return (Math.abs(h) % 10000) / 10000;
}

function drawObjectDetail(obj, cx, cy, r, ts) {
  var tSec = (ts || 0) / 1000;
  var name = obj.name;
  var color = obj.color;
  var type = obj.type || '';
  var cat = obj.category || '';

  // Detail scale derived from display radius (r is already dr from drawObject)
  var detailScale = r / (obj.radius || 1);

  // ──── SPACECRAFT ────

  if (name === 'Voyager 1' || name === 'Voyager 2') {
    var vsc = Math.max(detailScale * 0.8, 1);
    var isV1 = name === 'Voyager 1';
    var vColor = isV1 ? '#55ff88' : '#55ddff';
    // Dish body (small triangle)
    ctx.save();
    ctx.translate(cx, cy);
    var vAngle = isV1 ? -0.6 : 0.8;
    ctx.rotate(vAngle);
    var ds = 3 * vsc;
    // Antenna dish
    ctx.strokeStyle = vColor;
    ctx.lineWidth = 1.2 * vsc;
    ctx.beginPath();
    ctx.arc(0, -ds * 0.5, ds * 1.2, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    // Boom
    ctx.beginPath();
    ctx.moveTo(0, -ds * 0.3);
    ctx.lineTo(0, ds * 1.5);
    ctx.stroke();
    // RTG arms
    ctx.lineWidth = 0.8 * vsc;
    ctx.beginPath();
    ctx.moveTo(-ds * 1.2, ds * 0.8);
    ctx.lineTo(ds * 1.2, ds * 0.8);
    ctx.stroke();
    // RTG tips
    ctx.fillStyle = vColor;
    ctx.fillRect(-ds * 1.5, ds * 0.6, ds * 0.6, ds * 0.4);
    ctx.fillRect(ds * 0.9, ds * 0.6, ds * 0.6, ds * 0.4);
    ctx.restore();
    // Trajectory trail
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = vColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    var sunSp = worldToScreen(0, 0);
    ctx.beginPath();
    ctx.moveTo(sunSp.x, sunSp.y);
    ctx.lineTo(cx, cy);
    // Extend trail beyond current position
    var tdx = cx - sunSp.x, tdy = cy - sunSp.y;
    var tLen = Math.sqrt(tdx * tdx + tdy * tdy);
    if (tLen > 1) {
      ctx.lineTo(cx + tdx / tLen * 30, cy + tdy / tLen * 30);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  // ──── LAGRANGE POINTS ────

  if (type === 'Lagrange point') {
    var lps = Math.max(detailScale * 2.5, 3);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.7;
    // Crosshair lines
    ctx.beginPath();
    ctx.moveTo(cx - lps, cy); ctx.lineTo(cx + lps, cy);
    ctx.moveTo(cx, cy - lps); ctx.lineTo(cx, cy + lps);
    ctx.stroke();
    // Diamond outline
    var ld = lps * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ld);
    ctx.lineTo(cx + ld, cy);
    ctx.lineTo(cx, cy + ld);
    ctx.lineTo(cx - ld, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  // ──── JWST ────

  if (name === 'JWST') {
    var jsc = Math.max(detailScale * 1.5, 2);
    ctx.save();
    ctx.translate(cx, cy);
    // Sunshield (kite shape behind mirror)
    ctx.fillStyle = '#444455';
    ctx.beginPath();
    ctx.moveTo(-jsc * 2.5, jsc * 1);
    ctx.lineTo(0, -jsc * 0.3);
    ctx.lineTo(jsc * 2.5, jsc * 1);
    ctx.lineTo(0, jsc * 3.5);
    ctx.closePath();
    ctx.fill();
    // Primary mirror: gold hexagon with segment lines
    var hexR = jsc * 1.4;
    ctx.fillStyle = '#ddaa44';
    ctx.strokeStyle = '#886622';
    ctx.lineWidth = Math.max(0.5, jsc * 0.15);
    ctx.beginPath();
    var hi;
    for (hi = 0; hi < 6; hi++) {
      var ha = hi * Math.PI / 3 - Math.PI / 6;
      var hx = hexR * Math.cos(ha);
      var hy = -hexR * Math.sin(ha) - jsc * 0.2;
      if (hi === 0) ctx.moveTo(hx, hy);
      else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Segment lines (3 axes through center of hex)
    ctx.beginPath();
    for (hi = 0; hi < 3; hi++) {
      var sa = hi * Math.PI / 3 - Math.PI / 6;
      ctx.moveTo(hexR * Math.cos(sa), -hexR * Math.sin(sa) - jsc * 0.2);
      ctx.lineTo(hexR * Math.cos(sa + Math.PI), -hexR * Math.sin(sa + Math.PI) - jsc * 0.2);
    }
    ctx.stroke();
    // Secondary mirror support struts
    ctx.strokeStyle = '#888899';
    ctx.lineWidth = Math.max(0.3, jsc * 0.1);
    ctx.beginPath();
    ctx.moveTo(0, -jsc * 0.2);
    ctx.lineTo(0, -hexR * 1.5 - jsc * 0.2);
    ctx.moveTo(-hexR * 0.5, -jsc * 0.2);
    ctx.lineTo(hexR * 0.3, -hexR * 1.5 - jsc * 0.2);
    ctx.moveTo(hexR * 0.5, -jsc * 0.2);
    ctx.lineTo(-hexR * 0.3, -hexR * 1.5 - jsc * 0.2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // ──── SUPERNOVA REMNANTS ────

  if (name === "Tycho's SN Remnant" || name === "Kepler's SN Remnant" || name === 'SN 1987A') {
    var snr = Math.max(r, 3);
    var snColor = color;
    // Expanding shell effect
    var shellPhase = (tSec * 0.3) % (Math.PI * 2);
    var shellR = snr * (1.5 + Math.sin(shellPhase) * 0.2);
    // Outer shock wave ring
    ctx.save();
    ctx.strokeStyle = snColor;
    ctx.globalAlpha = 0.3 + Math.sin(shellPhase) * 0.1;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, shellR * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Inner bright shell
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, shellR, 0, Math.PI * 2);
    ctx.stroke();
    // Hot filaments radiating out
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 0.8;
    for (var fi = 0; fi < 8; fi++) {
      var fAngle = fi * Math.PI / 4 + shellPhase * 0.1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(fAngle) * snr * 0.5, cy + Math.sin(fAngle) * snr * 0.5);
      ctx.lineTo(cx + Math.cos(fAngle) * shellR * 1.6, cy + Math.sin(fAngle) * shellR * 1.6);
      ctx.stroke();
    }
    // Central remnant glow
    var snGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, snr);
    snGrad.addColorStop(0, snColor);
    snGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = snGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, snr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    state.dirty = true;
    return;
  }

  // ──── EXOPLANETS ────

  // Hot Jupiters
  if (name === '51 Pegasi b' || name === 'HD 209458 b' || name === 'WASP-12b') {
    var hjr = Math.max(r, 2.5);
    // Glowing body (overheated)
    var hjGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, hjr * 2);
    hjGrad.addColorStop(0, color);
    hjGrad.addColorStop(0.5, color);
    hjGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = hjGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, hjr * 2, 0, Math.PI * 2);
    ctx.fill();
    // Core
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, hjr, 0, Math.PI * 2);
    ctx.fill();
    // Heat shimmer ring
    ctx.save();
    ctx.strokeStyle = '#ff4422';
    ctx.globalAlpha = 0.15 + Math.sin(tSec * 2.5) * 0.08;
    ctx.lineWidth = hjr * 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, hjr * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Evaporation tail for HD 209458 b
    if (name === 'HD 209458 b' || name === 'WASP-12b') {
      ctx.save();
      var tailAngle = tSec * 0.3;
      ctx.globalAlpha = 0.12 + Math.sin(tSec * 1.8) * 0.05;
      ctx.strokeStyle = '#ff884466';
      ctx.lineWidth = hjr * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(tailAngle) * hjr, cy + Math.sin(tailAngle) * hjr);
      ctx.lineTo(cx + Math.cos(tailAngle) * hjr * 5, cy + Math.sin(tailAngle) * hjr * 5);
      ctx.stroke();
      ctx.restore();
    }
    state.dirty = true;
    return;
  }

  if (name === 'Proxima Centauri b' || name === 'Kepler-452b') {
    var epr = Math.max(r, 2.5);
    // Planet body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, epr, 0, Math.PI * 2);
    ctx.fill();
    // Habitable zone glow ring
    ctx.save();
    ctx.strokeStyle = '#44aaff';
    ctx.globalAlpha = 0.2 + Math.sin(tSec * 1.5) * 0.08;
    ctx.lineWidth = epr * 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, epr * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    state.dirty = true;
    return;
  }

  if (name === 'TRAPPIST-1 System') {
    // Draw 7 small dots in a line representing the compact system
    var tpr = Math.max(r, 2);
    // Central star (dim red dwarf)
    ctx.fillStyle = '#cc6644';
    ctx.beginPath();
    ctx.arc(cx, cy, tpr * 0.8, 0, Math.PI * 2);
    ctx.fill();
    // 7 planets orbiting close
    var planetColors = ['#888899', '#7788aa', '#8899aa', '#66aacc', '#77bbaa', '#88ccaa', '#6699aa'];
    for (var tp = 0; tp < 7; tp++) {
      var tAngle = tSec * (0.3 + tp * 0.08) + tp * Math.PI / 3.5;
      var tDist = tpr * (1.4 + tp * 0.45);
      var tpx = cx + Math.cos(tAngle) * tDist;
      var tpy = cy + Math.sin(tAngle) * tDist;
      ctx.fillStyle = planetColors[tp];
      ctx.beginPath();
      ctx.arc(tpx, tpy, Math.max(1, tpr * 0.25), 0, Math.PI * 2);
      ctx.fill();
    }
    // Habitable zone band
    ctx.save();
    ctx.strokeStyle = '#44aaff';
    ctx.globalAlpha = 0.12;
    ctx.lineWidth = tpr * 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, tpr * (1.4 + 3 * 0.45 + 1.1), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    state.dirty = true;
    return;
  }

  // ──── PLANETS ────

  // Mercury
  if (name === 'Mercury') {
    var mr = Math.max(r, 3);
    ctx.fillStyle = '#b5a08a';
    ctx.beginPath();
    ctx.arc(cx, cy, mr, 0, Math.PI * 2);
    ctx.fill();
    // craters
    ctx.fillStyle = 'rgba(80, 60, 50, 0.4)';
    for (var ci = 0; ci < 5; ci++) {
      var ca = nameHash(name, ci * 7) * Math.PI * 2;
      var cd = nameHash(name, ci * 13 + 3) * mr * 0.6;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ca) * cd, cy + Math.sin(ca) * cd, mr * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Venus
  if (name === 'Venus') {
    var vr = Math.max(r, 3);
    ctx.fillStyle = '#d8b060';
    ctx.beginPath();
    ctx.arc(cx, cy, vr, 0, Math.PI * 2);
    ctx.fill();
    // thick haze ring
    ctx.strokeStyle = 'rgba(230, 200, 120, 0.35)';
    ctx.lineWidth = vr * 0.5;
    ctx.beginPath();
    ctx.arc(cx, cy, vr + vr * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 220, 140, 0.15)';
    ctx.lineWidth = vr * 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, vr + vr * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  // Earth
  if (name === 'Earth') {
    var er = Math.max(r, 3);
    // blue body
    ctx.fillStyle = '#3377bb';
    ctx.beginPath();
    ctx.arc(cx, cy, er, 0, Math.PI * 2);
    ctx.fill();
    // continent patch
    ctx.fillStyle = '#44aa55';
    ctx.beginPath();
    ctx.arc(cx - er * 0.2, cy - er * 0.1, er * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#55bb66';
    ctx.beginPath();
    ctx.arc(cx + er * 0.3, cy + er * 0.2, er * 0.25, 0, Math.PI * 2);
    ctx.fill();
    // atmosphere halo
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.35)';
    ctx.lineWidth = er * 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, er + er * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  // Mars
  if (name === 'Mars') {
    var msr = Math.max(r, 3);
    ctx.fillStyle = '#cc6644';
    ctx.beginPath();
    ctx.arc(cx, cy, msr, 0, Math.PI * 2);
    ctx.fill();
    // Syrtis Major dark patch
    ctx.fillStyle = 'rgba(100, 40, 25, 0.45)';
    ctx.beginPath();
    ctx.arc(cx + msr * 0.15, cy - msr * 0.1, msr * 0.35, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Jupiter
  if (name === 'Jupiter') {
    var jr = Math.max(r, 4);
    // base
    ctx.fillStyle = '#d4a56a';
    ctx.beginPath();
    ctx.arc(cx, cy, jr, 0, Math.PI * 2);
    ctx.fill();
    // clip to planet circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, jr, 0, Math.PI * 2);
    ctx.clip();
    // horizontal bands
    var bandColors = ['#c89050', '#e8c080', '#b07040', '#d4a060', '#c08848'];
    for (var bi = 0; bi < bandColors.length; bi++) {
      var by = cy - jr + (bi * 2 * jr / bandColors.length);
      var bh = 2 * jr / bandColors.length;
      ctx.fillStyle = bandColors[bi];
      ctx.fillRect(cx - jr, by, jr * 2, bh);
    }
    // Great Red Spot
    ctx.fillStyle = '#cc5533';
    ctx.beginPath();
    ctx.ellipse(cx + jr * 0.3, cy + jr * 0.2, jr * 0.25, jr * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Saturn
  if (name === 'Saturn') {
    var sr = Math.max(r, 4);
    // base body
    ctx.fillStyle = '#e8d088';
    ctx.beginPath();
    ctx.arc(cx, cy, sr, 0, Math.PI * 2);
    ctx.fill();
    // clip bands to body
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, sr, 0, Math.PI * 2);
    ctx.clip();
    var sbColors = ['#d4b870', '#e8d898', '#c8a858', '#dcc880'];
    for (var sbi = 0; sbi < sbColors.length; sbi++) {
      var sby = cy - sr + (sbi * 2 * sr / sbColors.length);
      var sbh = 2 * sr / sbColors.length;
      ctx.fillStyle = sbColors[sbi];
      ctx.fillRect(cx - sr, sby, sr * 2, sbh);
    }
    ctx.restore();
    // ring (drawn ON TOP of planet - tilted ellipse)
    var ringW = sr * 2.2;
    var ringH = sr * 0.6;
    ctx.strokeStyle = 'rgba(210, 190, 140, 0.7)';
    ctx.lineWidth = sr * 0.35;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ringW, ringH, -0.15, 0, Math.PI * 2);
    ctx.stroke();
    // inner ring gap
    ctx.strokeStyle = 'rgba(180, 160, 110, 0.5)';
    ctx.lineWidth = sr * 0.15;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ringW * 0.75, ringH * 0.75, -0.15, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  // Uranus
  if (name === 'Uranus') {
    var ur = Math.max(r, 3);
    ctx.fillStyle = '#88ccdd';
    ctx.beginPath();
    ctx.arc(cx, cy, ur, 0, Math.PI * 2);
    ctx.fill();
    // nearly vertical ring (tilted sideways)
    ctx.strokeStyle = 'rgba(150, 200, 220, 0.5)';
    ctx.lineWidth = ur * 0.15;
    ctx.beginPath();
    ctx.ellipse(cx, cy, ur * 0.3, ur * 1.8, 0, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  // Neptune
  if (name === 'Neptune') {
    var nr = Math.max(r, 3);
    ctx.fillStyle = '#3355bb';
    ctx.beginPath();
    ctx.arc(cx, cy, nr, 0, Math.PI * 2);
    ctx.fill();
    // white cloud streak
    ctx.strokeStyle = 'rgba(220, 230, 255, 0.45)';
    ctx.lineWidth = nr * 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy, nr * 0.6, -0.6, 0.6);
    ctx.stroke();
    return;
  }

  // Pluto
  if (name === 'Pluto') {
    var pr = Math.max(r, 2);
    ctx.fillStyle = '#ccbbaa';
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // ──── STARS ────

  // Sun / Sun-like
  if (name === 'Sun' || name === '\u03b1 Centauri A' || name === 'Tau Ceti' || name === 'Sun (You Are Here)') {
    var sunR = Math.max(r, 3);
    // Limb-darkened solar disc
    var sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR);
    sunGrad.addColorStop(0, '#fff8e0');
    sunGrad.addColorStop(0.3, '#ffee88');
    sunGrad.addColorStop(0.6, color);
    sunGrad.addColorStop(0.85, '#cc8800');
    sunGrad.addColorStop(0.95, '#aa5500');
    sunGrad.addColorStop(1, '#662200');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
    ctx.fill();
    // Granulation texture at larger sizes
    if (sunR > 15) {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, sunR * 0.92, 0, Math.PI * 2); ctx.clip();
      var granCount = Math.min(40, Math.round(sunR / 4));
      for (var gi = 0; gi < granCount; gi++) {
        var gh1 = Math.sin(gi * 127.1 + 311.7) * 43758.5453; gh1 -= Math.floor(gh1);
        var gh2 = Math.sin(gi * 269.5 + 183.3) * 43758.5453; gh2 -= Math.floor(gh2);
        var gh3 = Math.sin(gi * 419.2 + 77.9) * 43758.5453; gh3 -= Math.floor(gh3);
        var gx = cx + (gh1 - 0.5) * sunR * 1.6;
        var gy = cy + (gh2 - 0.5) * sunR * 1.6;
        var gr = sunR * (0.04 + gh3 * 0.06);
        ctx.globalAlpha = 0.08 + gh3 * 0.06;
        ctx.fillStyle = gh3 > 0.5 ? '#ffeeaa' : '#ddaa44';
        ctx.beginPath(); ctx.arc(gx, gy, gr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // Corona rays (shorter and softer at large sizes)
    var numRays = sunR > 20 ? 12 : 6;
    var rayLen = sunR < 20 ? sunR * 2.5 : sunR * 1.3;
    var rayWidth = sunR < 20 ? 1 : Math.max(1, sunR * 0.03);
    for (var ri = 0; ri < numRays; ri++) {
      var ra = (ri / numRays) * Math.PI * 2;
      var shimmer = 0.7 + 0.3 * Math.sin(tSec * 2.5 + ri * 1.3);
      ctx.strokeStyle = 'rgba(255, 200, 80, ' + (0.3 * shimmer) + ')';
      ctx.lineWidth = rayWidth;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ra) * sunR * 1.02, cy + Math.sin(ra) * sunR * 1.02);
      ctx.lineTo(cx + Math.cos(ra) * rayLen * shimmer, cy + Math.sin(ra) * rayLen * shimmer);
      ctx.stroke();
    }
    return;
  }

  // Red dwarfs (with flare)
  if (name === 'Proxima Centauri' || name === "Barnard's Star" || name === 'Wolf 359' || name === 'Ross 154') {
    var rdR = Math.max(r, 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, rdR, 0, Math.PI * 2);
    ctx.fill();
    // flare at semi-random intervals (~every 5s based on name hash)
    var flarePhase = nameHash(name, 42) * 5;
    var flareCycle = ((tSec + flarePhase) % 5.0);
    if (flareCycle < 0.3) {
      var flareIntensity = 1.0 - (flareCycle / 0.3);
      var flareAngle = nameHash(name, 17) * Math.PI * 2;
      ctx.strokeStyle = 'rgba(255, 120, 60, ' + (0.8 * flareIntensity) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(flareAngle) * rdR, cy + Math.sin(flareAngle) * rdR);
      ctx.lineTo(cx + Math.cos(flareAngle) * (rdR + 12 * flareIntensity), cy + Math.sin(flareAngle) * (rdR + 12 * flareIntensity));
      ctx.stroke();
      // flare glow
      var fg = ctx.createRadialGradient(
        cx + Math.cos(flareAngle) * rdR, cy + Math.sin(flareAngle) * rdR, 0,
        cx + Math.cos(flareAngle) * rdR, cy + Math.sin(flareAngle) * rdR, 8
      );
      fg.addColorStop(0, 'rgba(255, 150, 80, ' + (0.5 * flareIntensity) + ')');
      fg.addColorStop(1, 'rgba(255, 100, 50, 0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(flareAngle) * rdR, cy + Math.sin(flareAngle) * rdR, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Orange K-type (Alpha Centauri B, Procyon)
  if (name === '\u03b1 Centauri B' || name === 'Procyon') {
    var okR = Math.max(r, 3);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, okR, 0, Math.PI * 2);
    ctx.fill();
    // warm glow
    var warmG = ctx.createRadialGradient(cx, cy, okR * 0.5, cx, cy, okR * 2.5);
    warmG.addColorStop(0, 'rgba(255, 180, 80, 0.25)');
    warmG.addColorStop(1, 'rgba(255, 150, 60, 0)');
    ctx.fillStyle = warmG;
    ctx.beginPath();
    ctx.arc(cx, cy, okR * 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Procyon B: white dwarf companion
    if (name === 'Procyon') {
      var pcAngle = tSec * 0.15 + 1.2;
      var pcDist = okR + 10;
      var pcX = cx + Math.cos(pcAngle) * pcDist;
      var pcY = cy + Math.sin(pcAngle) * pcDist;
      ctx.fillStyle = '#eeeeff';
      ctx.beginPath();
      ctx.arc(pcX, pcY, 1.2, 0, Math.PI * 2);
      ctx.fill();
      // tiny glow around companion
      ctx.fillStyle = 'rgba(238, 238, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(pcX, pcY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Hot blue-white stars (Sirius, Vega, Rigel)
  if (name === 'Sirius' || name === 'Vega' || name === 'Rigel') {
    var bwR = Math.max(r, 4);
    // intense bloom glow
    var bloomG = ctx.createRadialGradient(cx, cy, 0, cx, cy, bwR * 4);
    bloomG.addColorStop(0, 'rgba(200, 220, 255, 0.5)');
    bloomG.addColorStop(0.3, 'rgba(170, 200, 255, 0.2)');
    bloomG.addColorStop(1, 'rgba(150, 180, 255, 0)');
    ctx.fillStyle = bloomG;
    ctx.beginPath();
    ctx.arc(cx, cy, bwR * 4, 0, Math.PI * 2);
    ctx.fill();
    // bright center
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, bwR, 0, Math.PI * 2);
    ctx.fill();
    // 4 prominent diffraction spikes (cross)
    var spikeLen = bwR * 6;
    ctx.strokeStyle = 'rgba(200, 220, 255, 0.55)';
    ctx.lineWidth = 1.2;
    for (var si = 0; si < 4; si++) {
      var sAngle = si * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sAngle) * spikeLen, cy + Math.sin(sAngle) * spikeLen);
      ctx.stroke();
    }
    // thinner inner spikes
    ctx.strokeStyle = 'rgba(220, 235, 255, 0.3)';
    ctx.lineWidth = 0.5;
    for (var si2 = 0; si2 < 4; si2++) {
      var sAngle2 = si2 * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sAngle2) * spikeLen * 1.3, cy + Math.sin(sAngle2) * spikeLen * 1.3);
      ctx.stroke();
    }
    // Sirius B: white dwarf companion
    if (name === 'Sirius') {
      var sbAngle = tSec * 0.1 + 0.8;
      var sbDist = bwR + 9;
      var sbX = cx + Math.cos(sbAngle) * sbDist;
      var sbY = cy + Math.sin(sbAngle) * sbDist;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(sbX, sbY, 1.0, 0, Math.PI * 2);
      ctx.fill();
      // tiny glow around companion
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.beginPath();
      ctx.arc(sbX, sbY, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Red giants (Arcturus, Aldebaran)
  if (name === 'Arcturus' || name === 'Aldebaran') {
    var rgR = Math.max(r, 4) * 1.5;
    // fuzzy outer layer
    var rgG = ctx.createRadialGradient(cx, cy, 0, cx, cy, rgR);
    rgG.addColorStop(0, color);
    rgG.addColorStop(0.5, 'rgba(255, 140, 60, 0.4)');
    rgG.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = rgG;
    ctx.beginPath();
    ctx.arc(cx, cy, rgR, 0, Math.PI * 2);
    ctx.fill();
    // solid inner core
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, rgR * 0.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Red supergiants (Betelgeuse, Antares)
  if (name === 'Betelgeuse' || name === 'Antares') {
    var rsgBase = Math.max(r, 5) * 2;
    // pulsating radius
    var rsgPulse = 1.0 + 0.12 * Math.sin(tSec * (Math.PI * 2 / 3));
    var rsgR = rsgBase * rsgPulse;
    // fuzzy disk
    var rsgG = ctx.createRadialGradient(cx, cy, 0, cx, cy, rsgR);
    rsgG.addColorStop(0, color);
    rsgG.addColorStop(0.3, 'rgba(255, 80, 40, 0.5)');
    rsgG.addColorStop(0.7, 'rgba(255, 60, 30, 0.15)');
    rsgG.addColorStop(1, 'rgba(255, 40, 20, 0)');
    ctx.fillStyle = rsgG;
    ctx.beginPath();
    ctx.arc(cx, cy, rsgR, 0, Math.PI * 2);
    ctx.fill();
    // mottled surface patches
    for (var mp = 0; mp < 3; mp++) {
      var mAngle = nameHash(name, mp * 11) * Math.PI * 2;
      var mDist = nameHash(name, mp * 23) * rsgR * 0.35;
      var mBright = nameHash(name, mp * 37) > 0.5;
      ctx.fillStyle = mBright ? 'rgba(255, 130, 70, 0.3)' : 'rgba(180, 40, 20, 0.25)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(mAngle) * mDist, cy + Math.sin(mAngle) * mDist, rsgR * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Luminous supergiants (Canopus, Polaris, Deneb)
  if (name === 'Canopus' || name === 'Polaris' || name === 'Deneb') {
    var lsgR = Math.max(r, 4);
    // Polaris brightness pulsation (Cepheid)
    var lsgAlpha = 1.0;
    if (name === 'Polaris') {
      lsgAlpha = 0.7 + 0.3 * Math.sin(tSec * 1.5);
    }
    // strong halo
    var lsgG = ctx.createRadialGradient(cx, cy, 0, cx, cy, lsgR * 4);
    lsgG.addColorStop(0, 'rgba(255, 250, 230, ' + (0.5 * lsgAlpha) + ')');
    lsgG.addColorStop(0.3, 'rgba(255, 240, 210, ' + (0.2 * lsgAlpha) + ')');
    lsgG.addColorStop(1, 'rgba(255, 230, 200, 0)');
    ctx.fillStyle = lsgG;
    ctx.beginPath();
    ctx.arc(cx, cy, lsgR * 4, 0, Math.PI * 2);
    ctx.fill();
    // bright center
    ctx.save();
    ctx.globalAlpha = lsgAlpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, lsgR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 6-8 thin rays
    var lsgRays = name === 'Deneb' ? 8 : 6;
    var lsgRayLen = lsgR * 3.5;
    ctx.strokeStyle = 'rgba(255, 245, 220, ' + (0.25 * lsgAlpha) + ')';
    ctx.lineWidth = 0.7;
    for (var lri = 0; lri < lsgRays; lri++) {
      var lra = (lri / lsgRays) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(lra) * lsgR * 1.1, cy + Math.sin(lra) * lsgR * 1.1);
      ctx.lineTo(cx + Math.cos(lra) * lsgRayLen, cy + Math.sin(lra) * lsgRayLen);
      ctx.stroke();
    }
    // Polaris: triple system companions (Polaris Ab close, Polaris B farther)
    if (name === 'Polaris') {
      // Polaris Ab -- close companion
      var pAbAngle = tSec * 0.2 + 0.5;
      var pAbX = cx + Math.cos(pAbAngle) * (lsgR + 6);
      var pAbY = cy + Math.sin(pAbAngle) * (lsgR + 6);
      ctx.fillStyle = 'rgba(255, 238, 200, 0.55)';
      ctx.beginPath();
      ctx.arc(pAbX, pAbY, 1.0, 0, Math.PI * 2);
      ctx.fill();
      // Polaris B -- wider companion
      var pBAngle = tSec * 0.05 + 3.8;
      var pBX = cx + Math.cos(pBAngle) * (lsgR + 12);
      var pBY = cy + Math.sin(pBAngle) * (lsgR + 12);
      ctx.fillStyle = 'rgba(255, 238, 200, 0.45)';
      ctx.beginPath();
      ctx.arc(pBX, pBY, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // ──── NEBULAE ────

  // Planetary nebulae (Helix, Ring) — shell structure with central white dwarf
  if (name === 'Helix Nebula' || name === 'Ring Nebula') {
    var pnR = Math.max(r, 5);
    // Structure scales naturally with physRadius at appropriate zoom
    var pnOuter = name === 'Helix Nebula' ? pnR * 1.3 : pnR;
    // Outer diffuse shell
    var pnOG = ctx.createRadialGradient(cx, cy, pnOuter * 0.5, cx, cy, pnOuter * 1.4);
    pnOG.addColorStop(0, 'rgba(0, 0, 0, 0)');
    pnOG.addColorStop(0.3, color.replace(')', ', 0.06)').replace('rgb', 'rgba'));
    pnOG.addColorStop(0.6, color.replace(')', ', 0.12)').replace('rgb', 'rgba'));
    pnOG.addColorStop(0.85, color.replace(')', ', 0.04)').replace('rgb', 'rgba'));
    pnOG.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pnOG;
    ctx.beginPath();
    ctx.arc(cx, cy, pnOuter * 1.4, 0, Math.PI * 2);
    ctx.fill();
    // Bright ring structure
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = Math.max(1, pnOuter * 0.25);
    ctx.beginPath();
    ctx.arc(cx, cy, pnOuter * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = Math.max(2, pnOuter * 0.45);
    ctx.beginPath();
    ctx.arc(cx, cy, pnOuter * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Central white dwarf
    var wdR = Math.max(1.5, pnR * 0.04);
    var wdG = ctx.createRadialGradient(cx, cy, 0, cx, cy, wdR * 4);
    wdG.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    wdG.addColorStop(0.3, 'rgba(200, 220, 255, 0.3)');
    wdG.addColorStop(1, 'rgba(180, 200, 255, 0)');
    ctx.fillStyle = wdG;
    ctx.beginPath();
    ctx.arc(cx, cy, wdR * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ddeeff';
    ctx.beginPath();
    ctx.arc(cx, cy, wdR, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Emission nebulae (Orion, Eagle, Carina) — gas clouds with embedded stars
  if (name === 'Orion Nebula' || name === 'Eagle Nebula' || name === 'Carina Nebula') {
    var enR = Math.max(r, 5);
    // Structure scales naturally with physRadius at appropriate zoom
    // Multiple overlapping gas clouds with varying opacity for volume
    var enCount = name === 'Carina Nebula' ? 7 : (name === 'Orion Nebula' ? 6 : 5);
    for (var eni = 0; eni < enCount; eni++) {
      var enAngle = nameHash(name, eni * 7) * Math.PI * 2;
      var enDist = nameHash(name, eni * 13) * enR * 0.5;
      var enSize = enR * (0.5 + nameHash(name, eni * 19) * 0.6);
      var enCx = cx + Math.cos(enAngle) * enDist;
      var enCy = cy + Math.sin(enAngle) * enDist;
      var enG = ctx.createRadialGradient(enCx, enCy, 0, enCx, enCy, enSize);
      enG.addColorStop(0, color.replace(')', ', 0.25)').replace('rgb', 'rgba'));
      enG.addColorStop(0.5, color.replace(')', ', 0.08)').replace('rgb', 'rgba'));
      enG.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = enG;
      ctx.beginPath();
      ctx.arc(enCx, enCy, enSize, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dark dust lanes
    if (enR > 20) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      for (var dli = 0; dli < 3; dli++) {
        var dlA = nameHash(name, dli * 47 + 100) * Math.PI * 2;
        var dlD = nameHash(name, dli * 53 + 100) * enR * 0.4;
        var dlS = enR * (0.3 + nameHash(name, dli * 59 + 100) * 0.3);
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(dlA) * dlD, cy + Math.sin(dlA) * dlD, dlS, dlS * 0.3, dlA, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Embedded young stars
    if (enR > 15) {
      var starCount = Math.min(30, Math.round(enR * 0.4));
      for (var esi = 0; esi < starCount; esi++) {
        var esA = nameHash(name, esi * 67) * Math.PI * 2;
        var esD = nameHash(name, esi * 71) * enR * 0.8;
        var esSize = 0.5 + nameHash(name, esi * 73) * 1.0;
        var esBright = 0.4 + nameHash(name, esi * 79) * 0.5;
        ctx.fillStyle = 'rgba(255, 255, 240, ' + esBright + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(esA) * esD, cy + Math.sin(esA) * esD, esSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  // Supernova remnant (Crab Nebula)
  if (name === 'Crab Nebula') {
    var cnR = Math.max(r, 6);
    // Soft inner glow to ensure visibility
    var cnGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cnR * 1.8);
    cnGlow.addColorStop(0, 'rgba(221, 136, 68, 0.35)');
    cnGlow.addColorStop(0.6, 'rgba(221, 136, 68, 0.12)');
    cnGlow.addColorStop(1, 'rgba(221, 136, 68, 0)');
    ctx.fillStyle = cnGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, cnR * 1.8, 0, Math.PI * 2);
    ctx.fill();
    // filamentary lines radiating outward
    var cnLines = 10;
    for (var cli = 0; cli < cnLines; cli++) {
      var clAngle = (cli / cnLines) * Math.PI * 2 + nameHash(name, cli) * 0.5;
      var clLen = cnR * (1.2 + nameHash(name, cli * 3) * 1.4);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.5 + nameHash(name, cli * 5) * 0.35;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(clAngle) * cnR * 0.2, cy + Math.sin(clAngle) * cnR * 0.2);
      ctx.lineTo(cx + Math.cos(clAngle) * clLen, cy + Math.sin(clAngle) * clLen);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // pulsating bright center (pulsar)
    var cnPulse = 0.5 + 0.5 * Math.sin(tSec * 8);
    ctx.fillStyle = 'rgba(255, 200, 100, ' + (0.5 + 0.4 * cnPulse) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // ──── EXOTIC OBJECTS ────

  // Pulsars / Neutron stars
  if (type.indexOf('Neutron star') >= 0 || type.indexOf('Pulsar') >= 0) {
    // Scale up when selected for structural detail
    var pulsR = Math.max(r, 2);
    // Structure scales naturally with physRadius at appropriate zoom
    // Magnetosphere glow
    if (pulsR > 8) {
      var pmG = ctx.createRadialGradient(cx, cy, pulsR * 0.3, cx, cy, pulsR * 2.5);
      pmG.addColorStop(0, 'rgba(68, 255, 170, 0.15)');
      pmG.addColorStop(0.5, 'rgba(68, 255, 170, 0.05)');
      pmG.addColorStop(1, 'rgba(68, 255, 170, 0)');
      ctx.fillStyle = pmG;
      ctx.beginPath();
      ctx.arc(cx, cy, pulsR * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Neutron star surface
    var nsGrad = ctx.createRadialGradient(cx - pulsR * 0.2, cy - pulsR * 0.2, 0, cx, cy, pulsR);
    nsGrad.addColorStop(0, '#ccffee');
    nsGrad.addColorStop(0.6, color);
    nsGrad.addColorStop(1, 'rgba(30, 80, 60, 0.8)');
    ctx.fillStyle = nsGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, pulsR, 0, Math.PI * 2);
    ctx.fill();
    // Rotating beam cones (two opposing beams with sweep glow)
    var beamAngle = tSec * Math.PI * 4;
    var beamLen = pulsR * 4;
    var beamW = pulsR * 0.6;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(beamAngle);
    // Beam 1
    ctx.fillStyle = 'rgba(68, 255, 170, 0.25)';
    ctx.beginPath();
    ctx.moveTo(-beamW * 0.3, 0);
    ctx.lineTo(-beamW, beamLen);
    ctx.lineTo(beamW, beamLen);
    ctx.lineTo(beamW * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    // Beam 2 (opposite)
    ctx.beginPath();
    ctx.moveTo(-beamW * 0.3, 0);
    ctx.lineTo(-beamW, -beamLen);
    ctx.lineTo(beamW, -beamLen);
    ctx.lineTo(beamW * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    // Bright beam cores
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = Math.max(1, pulsR * 0.15);
    ctx.beginPath();
    ctx.moveTo(0, pulsR); ctx.lineTo(0, beamLen);
    ctx.moveTo(0, -pulsR); ctx.lineTo(0, -beamLen);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  // Black holes
  if (type.indexOf('black hole') >= 0 || type.indexOf('Black hole') >= 0) {
    var bhR = Math.max(r, 3);
    // Structure scales naturally with physRadius at appropriate zoom
    var bhScale2 = type.indexOf('Supermassive') >= 0 ? 1.3 : 1.0;
    bhR = bhR * bhScale2;
    // Gravitational lensing glow (photon sphere)
    if (bhR > 10) {
      var lensG = ctx.createRadialGradient(cx, cy, bhR * 0.8, cx, cy, bhR * 3.5);
      lensG.addColorStop(0, 'rgba(255, 140, 40, 0.12)');
      lensG.addColorStop(0.4, 'rgba(255, 100, 20, 0.04)');
      lensG.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = lensG;
      ctx.beginPath();
      ctx.arc(cx, cy, bhR * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Accretion disk — outer diffuse ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.4);
    var diskG = ctx.createRadialGradient(0, 0, bhR * 0.9, 0, 0, bhR * 2.8);
    diskG.addColorStop(0, 'rgba(255, 180, 80, 0)');
    diskG.addColorStop(0.3, 'rgba(255, 140, 40, 0.2)');
    diskG.addColorStop(0.6, 'rgba(200, 80, 20, 0.12)');
    diskG.addColorStop(1, 'rgba(100, 30, 10, 0)');
    ctx.fillStyle = diskG;
    ctx.scale(1, 0.32);
    ctx.beginPath();
    ctx.arc(0, 0, bhR * 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Inner accretion ring (bright)
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, bhR * 0.2);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, cy, bhR * 2.2, bhR * 0.7, 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 200, 100, 0.5)';
    ctx.lineWidth = Math.max(0.5, bhR * 0.1);
    ctx.beginPath();
    ctx.ellipse(cx, cy, bhR * 1.6, bhR * 0.5, 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Dark event horizon
    ctx.fillStyle = '#040408';
    ctx.beginPath();
    ctx.arc(cx, cy, bhR, 0, Math.PI * 2);
    ctx.fill();
    // Photon ring (thin bright edge)
    ctx.strokeStyle = 'rgba(255, 200, 120, 0.4)';
    ctx.lineWidth = Math.max(0.5, bhR * 0.08);
    ctx.beginPath();
    ctx.arc(cx, cy, bhR * 1.05, 0, Math.PI * 2);
    ctx.stroke();
    // Relativistic jets (when large enough)
    if (bhR > 15) {
      var jetLen = bhR * 5;
      var jetW = bhR * 0.3;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(0.4 + Math.PI / 2); // perpendicular to disk
      // Top jet
      var jetG = ctx.createLinearGradient(0, 0, 0, -jetLen);
      jetG.addColorStop(0, 'rgba(150, 100, 255, 0.25)');
      jetG.addColorStop(0.3, 'rgba(100, 80, 200, 0.12)');
      jetG.addColorStop(1, 'rgba(80, 60, 160, 0)');
      ctx.fillStyle = jetG;
      ctx.beginPath();
      ctx.moveTo(-jetW, 0); ctx.lineTo(-jetW * 0.2, -jetLen);
      ctx.lineTo(jetW * 0.2, -jetLen); ctx.lineTo(jetW, 0);
      ctx.closePath();
      ctx.fill();
      // Bottom jet
      var jetG2 = ctx.createLinearGradient(0, 0, 0, jetLen);
      jetG2.addColorStop(0, 'rgba(150, 100, 255, 0.25)');
      jetG2.addColorStop(0.3, 'rgba(100, 80, 200, 0.12)');
      jetG2.addColorStop(1, 'rgba(80, 60, 160, 0)');
      ctx.fillStyle = jetG2;
      ctx.beginPath();
      ctx.moveTo(-jetW, 0); ctx.lineTo(-jetW * 0.2, jetLen);
      ctx.lineTo(jetW * 0.2, jetLen); ctx.lineTo(jetW, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Cygnus X-1: blue supergiant companion HDE 226868
    if (name === 'Cygnus X-1') {
      var compAngle = tSec * 0.08 + 2.0;
      var compDist = bhR * 1.8 + 10;
      var compX = cx + Math.cos(compAngle) * compDist;
      var compY = cy + Math.sin(compAngle) * compDist;
      var compR = Math.max(2, bhR * 0.12);
      ctx.fillStyle = '#6688cc';
      ctx.beginPath();
      ctx.arc(compX, compY, compR, 0, Math.PI * 2);
      ctx.fill();
      var compGlow = ctx.createRadialGradient(compX, compY, 0, compX, compY, compR * 3);
      compGlow.addColorStop(0, 'rgba(102, 136, 204, 0.35)');
      compGlow.addColorStop(1, 'rgba(102, 136, 204, 0)');
      ctx.fillStyle = compGlow;
      ctx.beginPath();
      ctx.arc(compX, compY, compR * 3, 0, Math.PI * 2);
      ctx.fill();
      // Material stream spiraling from companion
      ctx.strokeStyle = 'rgba(102, 136, 204, 0.2)';
      ctx.lineWidth = Math.max(0.8, bhR * 0.04);
      ctx.beginPath();
      for (var sti = 0; sti <= 20; sti++) {
        var stFrac = sti / 20;
        var stX = compX + (cx - compX) * stFrac;
        var stY = compY + (cy - compY) * stFrac;
        var curveMag = Math.sin(stFrac * Math.PI) * compDist * 0.3;
        var pdx = -(cy - compY) / compDist;
        var pdy = (cx - compX) / compDist;
        stX += pdx * curveMag;
        stY += pdy * curveMag;
        if (sti === 0) ctx.moveTo(stX, stY);
        else ctx.lineTo(stX, stY);
      }
      ctx.stroke();
    }
    return;
  }

  // Magnetars
  if (type === 'Magnetar') {
    var magR = Math.max(r, 3);
    // Structure scales naturally with physRadius at appropriate zoom
    // Intense magnetosphere glow
    var magG = ctx.createRadialGradient(cx, cy, 0, cx, cy, magR * 5);
    magG.addColorStop(0, 'rgba(255, 100, 180, 0.5)');
    magG.addColorStop(0.2, 'rgba(255, 68, 170, 0.2)');
    magG.addColorStop(0.5, 'rgba(255, 40, 140, 0.06)');
    magG.addColorStop(1, 'rgba(255, 68, 170, 0)');
    ctx.fillStyle = magG;
    ctx.beginPath();
    ctx.arc(cx, cy, magR * 5, 0, Math.PI * 2);
    ctx.fill();
    // Neutron star surface with hot spots
    var magSG = ctx.createRadialGradient(cx - magR * 0.15, cy - magR * 0.15, 0, cx, cy, magR);
    magSG.addColorStop(0, '#ffbbdd');
    magSG.addColorStop(0.5, color);
    magSG.addColorStop(1, 'rgba(120, 30, 60, 0.8)');
    ctx.fillStyle = magSG;
    ctx.beginPath();
    ctx.arc(cx, cy, magR, 0, Math.PI * 2);
    ctx.fill();
    // Magnetic dipole field lines (8 lines arcing from pole to pole)
    ctx.strokeStyle = 'rgba(255, 130, 200, 0.35)';
    ctx.lineWidth = Math.max(0.8, magR * 0.06);
    for (var mfi = 0; mfi < 8; mfi++) {
      var mfSpread = (mfi / 8) * Math.PI * 2;
      var mfHeight = magR * (2.5 + Math.sin(mfi * 1.7) * 0.8);
      ctx.beginPath();
      for (var mft = 0; mft <= 24; mft++) {
        var mfFrac = mft / 24;
        // Dipole: field lines emerge from north pole, arc outward, return to south
        var mfTheta = mfFrac * Math.PI;
        var mfRad = magR + mfHeight * Math.sin(mfTheta);
        var mfx = cx + Math.cos(mfSpread) * mfRad * Math.sin(mfTheta);
        var mfy = cy - mfHeight * Math.cos(mfTheta) + Math.sin(mfSpread) * mfRad * 0.15;
        if (mft === 0) ctx.moveTo(mfx, mfy);
        else ctx.lineTo(mfx, mfy);
      }
      ctx.stroke();
    }
    // Flare burst (animated pulsing)
    var flarePhase = Math.sin(tSec * 1.5) * 0.5 + 0.5;
    if (flarePhase > 0.7) {
      var flareAlpha = (flarePhase - 0.7) / 0.3 * 0.3;
      var flareG = ctx.createRadialGradient(cx, cy, magR, cx, cy, magR * (4 + flarePhase * 3));
      flareG.addColorStop(0, 'rgba(255, 200, 255, ' + flareAlpha + ')');
      flareG.addColorStop(1, 'rgba(255, 100, 200, 0)');
      ctx.fillStyle = flareG;
      ctx.beginPath();
      ctx.arc(cx, cy, magR * (4 + flarePhase * 3), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // ──── CLUSTERS ────

  // Globular clusters — scaled star distribution
  if (type.indexOf('Globular cluster') !== -1) {
    var gcR = Math.max(r, 4);
    // Structure scales naturally with physRadius at appropriate zoom
    // Core glow (unresolved stars)
    var gcCoreG = ctx.createRadialGradient(cx, cy, 0, cx, cy, gcR * 1.2);
    gcCoreG.addColorStop(0, 'rgba(255, 240, 200, 0.4)');
    gcCoreG.addColorStop(0.3, 'rgba(255, 230, 180, 0.15)');
    gcCoreG.addColorStop(0.7, 'rgba(255, 220, 160, 0.04)');
    gcCoreG.addColorStop(1, 'rgba(255, 220, 160, 0)');
    ctx.fillStyle = gcCoreG;
    ctx.beginPath();
    ctx.arc(cx, cy, gcR * 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Individual stars — more when larger, King profile distribution
    var gcCount = gcR < 10 ? 20 : Math.min(200, Math.round(gcR * 3));
    for (var gci = 0; gci < gcCount; gci++) {
      var gcAngle = nameHash(name, gci * 7) * Math.PI * 2;
      // King profile: square of random gives strong center concentration
      var gcU = nameHash(name, gci * 13);
      var gcDist = gcU * gcU * gcR * 1.5;
      var gcSize = gcR > 30 ? (0.4 + nameHash(name, gci * 31) * 1.2) : (0.3 + nameHash(name, gci * 31) * 0.7);
      // Color variation: mostly yellow-white, some orange giants
      var gcHue = nameHash(name, gci * 43);
      var gcCol = gcHue > 0.85 ? 'rgba(255, 180, 100, ' : (gcHue > 0.7 ? 'rgba(255, 220, 150, ' : 'rgba(255, 245, 220, ');
      var gcBright = 0.3 + (1 - gcU) * 0.5; // brighter toward center
      ctx.fillStyle = gcCol + gcBright + ')';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(gcAngle) * gcDist, cy + Math.sin(gcAngle) * gcDist, gcSize, 0, Math.PI * 2);
      ctx.fill();
    }
    // Palomar 5 tidal tails
    if (name === 'Palomar 5') {
      for (var pti = 0; pti < 8; pti++) {
        var ptDist = gcR * 1.5 + pti * gcR * 0.4;
        var ptAngle = 0.3 + nameHash(name, pti * 41) * 0.3;
        ctx.fillStyle = 'rgba(200, 190, 150, 0.2)';
        ctx.beginPath();
        ctx.arc(cx + ptDist, cy + Math.sin(ptAngle) * gcR * 0.3, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  // ──── CEPHEID VARIABLES ────
  if (name === 'V1 (Hubble\'s Cepheid)' || name === 'V2 (Andromeda Cepheid)' || name === 'V15 (Andromeda Cepheid)') {
    var cepR = Math.max(r, 2);
    // each at slightly different phase
    var cepPhase = name === 'V1 (Hubble\'s Cepheid)' ? 0 : (name === 'V2 (Andromeda Cepheid)' ? 2.1 : 4.2);
    var cepAlpha = 0.4 + 0.6 * Math.abs(Math.sin(tSec * (Math.PI / 1.0) + cepPhase));
    // yellow-ish star with pulsation
    ctx.save();
    ctx.globalAlpha = cepAlpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, cepR, 0, Math.PI * 2);
    ctx.fill();
    // glow
    var cepG = ctx.createRadialGradient(cx, cy, 0, cx, cy, cepR * 3);
    cepG.addColorStop(0, 'rgba(255, 238, 187, 0.4)');
    cepG.addColorStop(1, 'rgba(255, 238, 187, 0)');
    ctx.fillStyle = cepG;
    ctx.beginPath();
    ctx.arc(cx, cy, cepR * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // ──── GALAXY-SCALE ────

  // Spiral arms (Perseus, Cygnus, Scutum-Centaurus)
  if (type.indexOf('Spiral arm') !== -1) {
    var saR = Math.max(r, 4);
    // arc of tiny dots
    var saCount = 8;
    ctx.fillStyle = color;
    for (var sai = 0; sai < saCount; sai++) {
      var saAngle = -0.8 + (sai / saCount) * 1.6;
      var saDist = saR * (1.5 + nameHash(name, sai * 7) * 0.5);
      ctx.globalAlpha = 0.3 + nameHash(name, sai * 11) * 0.3;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(saAngle) * saDist, cy + Math.sin(saAngle) * saDist, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }

  // Galactic Center
  if (name === 'Galactic Center') {
    var gctrR = Math.max(r, 6);
    // bright central glow
    var gctrG = ctx.createRadialGradient(cx, cy, 0, cx, cy, gctrR * 2);
    gctrG.addColorStop(0, 'rgba(255, 180, 60, 0.6)');
    gctrG.addColorStop(0.4, 'rgba(255, 160, 40, 0.25)');
    gctrG.addColorStop(1, 'rgba(255, 140, 30, 0)');
    ctx.fillStyle = gctrG;
    ctx.beginPath();
    ctx.arc(cx, cy, gctrR * 2, 0, Math.PI * 2);
    ctx.fill();
    // concentrated dots
    for (var gdi = 0; gdi < 12; gdi++) {
      var gdAngle = nameHash('galctr', gdi * 7) * Math.PI * 2;
      var gdDist = nameHash('galctr', gdi * 13) * gctrR * 1.2;
      ctx.fillStyle = 'rgba(255, 220, 140, 0.5)';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(gdAngle) * gdDist, cy + Math.sin(gdAngle) * gdDist, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Dwarf galaxies (Sagittarius Dwarf, Canis Major Dwarf, Leo I, NGC 185, IC 10)
  if (type.indexOf('Dwarf') !== -1 || type.indexOf('dwarf') !== -1) {
    var dwR = Math.max(r, 3);
    // soft fuzzy elliptical glow
    var dwG = ctx.createRadialGradient(cx, cy, 0, cx, cy, dwR * 2.5);
    dwG.addColorStop(0, color);
    dwG.addColorStop(0.3, 'rgba(150, 150, 190, 0.3)');
    dwG.addColorStop(1, 'rgba(130, 130, 170, 0)');
    ctx.fillStyle = dwG;
    ctx.beginPath();
    ctx.ellipse(cx, cy, dwR * 2.5, dwR * 1.8, nameHash(name, 1) * 0.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Large/Small Magellanic Cloud
  if (name === 'Large Magellanic Cloud' || name === 'Small Magellanic Cloud') {
    var lmcR = Math.max(r, 5);
    // irregular shape: 2-3 overlapping soft circles
    var lmcCount = name === 'Large Magellanic Cloud' ? 3 : 2;
    for (var lmci = 0; lmci < lmcCount; lmci++) {
      var lmcAngle = nameHash(name, lmci * 7) * Math.PI * 2;
      var lmcDist = nameHash(name, lmci * 13) * lmcR * 0.5;
      var lmcSize = lmcR * (1.0 + nameHash(name, lmci * 19) * 0.5);
      var lmcG = ctx.createRadialGradient(
        cx + Math.cos(lmcAngle) * lmcDist, cy + Math.sin(lmcAngle) * lmcDist, 0,
        cx + Math.cos(lmcAngle) * lmcDist, cy + Math.sin(lmcAngle) * lmcDist, lmcSize
      );
      lmcG.addColorStop(0, 'rgba(140, 170, 220, 0.3)');
      lmcG.addColorStop(1, 'rgba(120, 150, 200, 0)');
      ctx.fillStyle = lmcG;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(lmcAngle) * lmcDist, cy + Math.sin(lmcAngle) * lmcDist, lmcSize, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // ──── COSMIC SCALE ────

  // Galaxy clusters (Virgo, Fornax, Centaurus)
  if (type.indexOf('Galaxy cluster') !== -1) {
    var clR = Math.max(r, 6);
    var clCount = name === 'Virgo Cluster' ? 15 : (name === 'Centaurus Cluster' ? 12 : 10);
    for (var cli2 = 0; cli2 < clCount; cli2++) {
      var clAngle = nameHash(name, cli2 * 7) * Math.PI * 2;
      var clDist = nameHash(name, cli2 * 13) * clR * 2;
      var clSize = 0.6 + nameHash(name, cli2 * 19) * 1.0;
      var clBright = 0.2 + nameHash(name, cli2 * 23) * 0.4;
      ctx.fillStyle = 'rgba(220, 200, 255, ' + clBright + ')';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(clAngle) * clDist, cy + Math.sin(clAngle) * clDist, clSize, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // Elliptical galaxies (M87, IC 1101) — structural with stellar haze
  if (type.indexOf('elliptical') !== -1 || type.indexOf('Elliptical') !== -1) {
    var elR = Math.max(r, 5);
    // Structure scales naturally with physRadius at appropriate zoom
    var elScale3 = name === 'IC 1101' ? 1.4 : 1.0;
    elR = elR * elScale3;
    var elAxis = 0.2 + nameHash(name, 1) * 0.3;
    // Outer halo
    var elG = ctx.createRadialGradient(cx, cy, 0, cx, cy, elR * 2.2);
    elG.addColorStop(0, 'rgba(240, 220, 180, 0.45)');
    elG.addColorStop(0.15, 'rgba(230, 210, 170, 0.3)');
    elG.addColorStop(0.4, 'rgba(210, 190, 150, 0.12)');
    elG.addColorStop(0.7, 'rgba(190, 170, 130, 0.03)');
    elG.addColorStop(1, 'rgba(170, 150, 110, 0)');
    ctx.fillStyle = elG;
    ctx.beginPath();
    ctx.ellipse(cx, cy, elR * 2.2, elR * 2.2 * (0.6 + nameHash(name, 3) * 0.3), elAxis, 0, Math.PI * 2);
    ctx.fill();
    // Resolved stars when large enough
    if (elR > 20) {
      var elStars = Math.min(120, Math.round(elR * 1.5));
      for (var eli = 0; eli < elStars; eli++) {
        var elSA = nameHash(name, eli * 7 + 200) * Math.PI * 2;
        var elSU = nameHash(name, eli * 11 + 200);
        var elSD = elSU * elSU * elR * 1.8;
        var elSB = 0.15 + (1 - elSU) * 0.3;
        ctx.fillStyle = 'rgba(255, 240, 200, ' + elSB + ')';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(elSA) * elSD, cy + Math.sin(elSA) * elSD * 0.7, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // M87 jet
    if (name === 'M87' && elR > 15) {
      var jetA = 0.6;
      ctx.strokeStyle = 'rgba(150, 120, 255, 0.35)';
      ctx.lineWidth = Math.max(1, elR * 0.04);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(jetA) * elR * 2.5, cy + Math.sin(jetA) * elR * 2.5);
      ctx.stroke();
    }
    return;
  }

  // Spiral galaxies (barred and unbarred) — volumetric arms with dust lanes
  if (type.indexOf('spiral') !== -1 || type.indexOf('Spiral') !== -1 || type.indexOf('SA(') !== -1 || type.indexOf('SB(') !== -1) {
    var sgR = Math.max(r, 5);
    // Structure scales naturally with physRadius at appropriate zoom
    var sgBarred = type.indexOf('arred') !== -1 || type.indexOf('SB') !== -1;
    var sgInc = nameHash(name, 1) * 0.5 + 0.15; // inclination: 0.15-0.65 (ratio)
    var sgRot = nameHash(name, 3) * Math.PI * 2;
    var sgArms = sgBarred ? 2 : (nameHash(name, 5) > 0.5 ? 4 : 2);
    // Disk halo glow
    var sgDG = ctx.createRadialGradient(cx, cy, 0, cx, cy, sgR * 2);
    sgDG.addColorStop(0, 'rgba(200, 190, 240, 0.2)');
    sgDG.addColorStop(0.5, 'rgba(180, 170, 220, 0.06)');
    sgDG.addColorStop(1, 'rgba(160, 150, 200, 0)');
    ctx.fillStyle = sgDG;
    ctx.beginPath();
    ctx.ellipse(cx, cy, sgR * 2, sgR * 2 * sgInc, sgRot * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Central bulge (yellow-warm)
    var sgBG = ctx.createRadialGradient(cx, cy, 0, cx, cy, sgR * 0.35);
    sgBG.addColorStop(0, 'rgba(255, 230, 170, 0.5)');
    sgBG.addColorStop(0.6, 'rgba(240, 210, 150, 0.2)');
    sgBG.addColorStop(1, 'rgba(220, 190, 130, 0)');
    ctx.fillStyle = sgBG;
    ctx.beginPath();
    ctx.ellipse(cx, cy, sgR * 0.35, sgR * 0.35 * sgInc, sgRot * 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Bar (if barred spiral)
    if (sgBarred) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sgRot);
      ctx.scale(1, sgInc);
      ctx.fillStyle = 'rgba(240, 210, 150, 0.25)';
      ctx.fillRect(-sgR * 0.5, -sgR * 0.08, sgR, sgR * 0.16);
      ctx.restore();
    }
    // Volumetric spiral arms: wide diffuse + narrow bright + dust lane
    var sgB = 0.25;
    var sgMaxT = 2.5 * Math.PI;
    var sgA = sgR * 1.5 / Math.exp(sgB * sgMaxT);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sgRot * 0.3);
    ctx.scale(1, sgInc);
    for (var sgArm = 0; sgArm < sgArms; sgArm++) {
      var sgAOff = (sgArm / sgArms) * Math.PI * 2;
      var sgSteps = sgR > 30 ? 60 : 30;
      // Wide diffuse arm (volume)
      ctx.strokeStyle = 'rgba(170, 180, 240, 0.08)';
      ctx.lineWidth = Math.max(2, sgR * 0.12);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (var sgi = 0; sgi <= sgSteps; sgi++) {
        var sgF = sgi / sgSteps;
        var sgT = sgF * sgMaxT;
        var sgRR = sgA * Math.exp(sgB * sgT);
        var sgAA = sgT + sgAOff;
        var sgX = Math.cos(sgAA) * sgRR;
        var sgY = Math.sin(sgAA) * sgRR;
        if (sgi === 0) ctx.moveTo(sgX, sgY);
        else ctx.lineTo(sgX, sgY);
      }
      ctx.stroke();
      // Bright arm core (blue-white star formation)
      ctx.strokeStyle = 'rgba(190, 200, 255, 0.18)';
      ctx.lineWidth = Math.max(1, sgR * 0.04);
      ctx.beginPath();
      for (var sgi2 = 0; sgi2 <= sgSteps; sgi2++) {
        var sgF2 = sgi2 / sgSteps;
        var sgT2 = sgF2 * sgMaxT;
        var sgRR2 = sgA * Math.exp(sgB * sgT2);
        var sgAA2 = sgT2 + sgAOff;
        if (sgi2 === 0) ctx.moveTo(Math.cos(sgAA2) * sgRR2, Math.sin(sgAA2) * sgRR2);
        else ctx.lineTo(Math.cos(sgAA2) * sgRR2, Math.sin(sgAA2) * sgRR2);
      }
      ctx.stroke();
      // Dust lane (dark band along inner edge of arm)
      if (sgR > 20) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = Math.max(0.5, sgR * 0.025);
        ctx.beginPath();
        for (var sgi3 = 0; sgi3 <= sgSteps; sgi3++) {
          var sgF3 = sgi3 / sgSteps;
          var sgT3 = sgF3 * sgMaxT;
          var sgRR3 = sgA * Math.exp(sgB * sgT3) * 0.92; // inner edge offset
          var sgAA3 = sgT3 + sgAOff;
          if (sgi3 === 0) ctx.moveTo(Math.cos(sgAA3) * sgRR3, Math.sin(sgAA3) * sgRR3);
          else ctx.lineTo(Math.cos(sgAA3) * sgRR3, Math.sin(sgAA3) * sgRR3);
        }
        ctx.stroke();
      }
      // Star-forming knots
      if (sgR > 15) {
        for (var sgK = 0; sgK < 5; sgK++) {
          var sgKF = 0.2 + sgK * 0.15;
          var sgKT = sgKF * sgMaxT;
          var sgKR = sgA * Math.exp(sgB * sgKT);
          var sgKA = sgKT + sgAOff;
          var sgKS = Math.max(1, sgR * 0.02);
          ctx.fillStyle = 'rgba(200, 220, 255, 0.25)';
          ctx.beginPath();
          ctx.arc(Math.cos(sgKA) * sgKR, Math.sin(sgKA) * sgKR, sgKS, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
    return;
  }

  // Great Attractor
  if (name === 'Great Attractor') {
    var gaR = Math.max(r, 8);
    // pulsating glow
    var gaPulse = 0.7 + 0.3 * Math.sin(tSec * 1.2);
    var gaG = ctx.createRadialGradient(cx, cy, 0, cx, cy, gaR * 3 * gaPulse);
    gaG.addColorStop(0, 'rgba(255, 140, 100, 0.5)');
    gaG.addColorStop(0.4, 'rgba(255, 120, 80, 0.2)');
    gaG.addColorStop(1, 'rgba(255, 100, 60, 0)');
    ctx.fillStyle = gaG;
    ctx.beginPath();
    ctx.arc(cx, cy, gaR * 3 * gaPulse, 0, Math.PI * 2);
    ctx.fill();
    // concentric rings (gravitational lensing suggestion)
    for (var gri = 1; gri <= 3; gri++) {
      var grRad = gaR * gri * 0.9;
      ctx.strokeStyle = 'rgba(255, 136, 102, ' + (0.15 / gri) + ')';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(cx, cy, grRad, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }

  // Milky Way (You Are Here) and Andromeda and Triangulum at cosmic scale
  if (name === 'Milky Way (You Are Here)') {
    var mwR = Math.max(r, 4);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, mwR, 0, Math.PI * 2);
    ctx.fill();
    // corona rays like the Sun
    var mwRays = 4;
    for (var mri = 0; mri < mwRays; mri++) {
      var mra = (mri / mwRays) * Math.PI * 2;
      var mShim = 0.7 + 0.3 * Math.sin(tSec * 2.0 + mri);
      ctx.strokeStyle = 'rgba(255, 230, 100, ' + (0.3 * mShim) + ')';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(mra) * mwR * 1.1, cy + Math.sin(mra) * mwR * 1.1);
      ctx.lineTo(cx + Math.cos(mra) * mwR * 2.5, cy + Math.sin(mra) * mwR * 2.5);
      ctx.stroke();
    }
    return;
  }

  // Andromeda (M31) and Triangulum (M33) at local scale - spiral hint
  if (name === 'Andromeda (M31)' || name === 'Triangulum (M33)') {
    var spgR = Math.max(r, 6);
    // soft glow
    var spgG = ctx.createRadialGradient(cx, cy, 0, cx, cy, spgR * 2);
    spgG.addColorStop(0, color);
    spgG.addColorStop(0.3, 'rgba(180, 170, 230, 0.25)');
    spgG.addColorStop(1, 'rgba(160, 150, 210, 0)');
    ctx.fillStyle = spgG;
    ctx.beginPath();
    ctx.ellipse(cx, cy, spgR * 2, spgR * 1.2, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // two tiny spiral arms
    ctx.strokeStyle = 'rgba(190, 180, 240, 0.3)';
    ctx.lineWidth = 0.8;
    for (var sga = 0; sga < 2; sga++) {
      var sgOff = sga * Math.PI;
      ctx.beginPath();
      for (var sgt = 0; sgt <= 15; sgt++) {
        var sgFrac = sgt / 15;
        var sgTheta = sgFrac * Math.PI * 1.5 + sgOff;
        var sgRad = spgR * 0.3 * Math.exp(0.3 * sgFrac * Math.PI * 1.5);
        var sgx = cx + Math.cos(sgTheta) * sgRad;
        var sgy = cy + Math.sin(sgTheta) * sgRad * 0.5;
        if (sgt === 0) ctx.moveTo(sgx, sgy);
        else ctx.lineTo(sgx, sgy);
      }
      ctx.stroke();
    }
    return;
  }

  // ──── FALLBACK: type-based rendering ────

  // Any remaining star types
  if (cat === 'stellar' || cat === 'solar') {
    var fR = Math.max(r, 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, fR, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Any remaining galaxy/local/cosmic objects
  if (cat === 'galaxy' || cat === 'local' || cat === 'cosmic') {
    var fgR = Math.max(r, 3);
    var fgG = ctx.createRadialGradient(cx, cy, 0, cx, cy, fgR * 2);
    fgG.addColorStop(0, color);
    fgG.addColorStop(0.5, 'rgba(160, 160, 200, 0.2)');
    fgG.addColorStop(1, 'rgba(140, 140, 180, 0)');
    ctx.fillStyle = fgG;
    ctx.beginPath();
    ctx.arc(cx, cy, fgR * 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
}

// ─── Draw: objects ────────────────────────────────────────────────────

function drawObject(obj, sp, ts) {
  var sel = state.selected === obj;
  var r = obj.radius;
  var gi = effects.glowIntensity;

  // Display radius: modest cosmetic scaling for visibility at wide zoom,
  // transitioning to accurate physical size as you zoom in.
  var dr = r;
  if (obj.category === 'solar') {
    var vrNow = getViewRadius();
    var solarScale = Math.max(1, Math.min(4, 0.00004 / Math.max(vrNow, 0.000000005)));
    dr = r * solarScale;
  }
  if (obj.physRadius && (obj.category === 'solar' || obj.category === 'stellar')) {
    var physR = obj.physRadius * getScale();
    if (physR > dr) dr = physR;  // physical takes over → accurate ratios
  }

  // Nebulae: draw as soft colored glows
  if (obj.category === 'nebula') {
    var nebulaR = r * (sel ? 8 : 6);
    var ng = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, nebulaR);
    ng.addColorStop(0, obj.glow.replace(/[\d.]+\)$/, (0.5 * gi) + ")"));
    ng.addColorStop(0.4, obj.glow.replace(/[\d.]+\)$/, (0.25 * gi) + ")"));
    ng.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, nebulaR, 0, Math.PI * 2);
    ctx.fill();
    // Inner bright core
    var ng2 = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r * 2);
    ng2.addColorStop(0, obj.color);
    ng2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ng2;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, r * 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Standard object glow
    var glowR = dr * (sel ? 5 : 3) * gi;
    var g = ctx.createRadialGradient(sp.x, sp.y, dr * 0.3, sp.x, sp.y, glowR);
    g.addColorStop(0, obj.glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = obj.color;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, dr, 0, Math.PI * 2);
    ctx.fill();
  }

  if (sel) {
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, dr + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Labels are drawn in a separate pass (drawLabels) for collision avoidance.
  // Store label info for deferred rendering.
  var labelOffset = Math.max(r, dr);
  pendingLabels.push({
    name: displayName(obj),
    dist: obj.dist,
    x: sp.x,
    y: sp.y + labelOffset + 16,
    sel: sel,
    priority: (sel ? 10000 : 0) + obj.radius + (obj.dist === 0 ? 100 : 0)
  });

  // Draw type-specific visual detail on top of the base glow
  drawObjectDetail(obj, sp.x, sp.y, dr, ts);
}

function drawLabels() {
  // Sort by priority descending — highest priority labels get placed first
  pendingLabels.sort(function(a, b) { return b.priority - a.priority; });

  var placed = []; // array of { x, y, w, h } bounding boxes

  for (var i = 0; i < pendingLabels.length; i++) {
    var lb = pendingLabels[i];
    var fontSize = lb.sel ? 12 : 11;
    var font = lb.sel ? 'bold 12px Rajdhani, -apple-system, system-ui, sans-serif' : '11px Rajdhani, -apple-system, system-ui, sans-serif';
    ctx.font = font;
    var nameW = ctx.measureText(lb.name).width;
    var labelH = 14;
    var distH = lb.dist > 0 ? 14 : 0;

    // Try positions: below (default), above, right, left
    var candidates = [
      { x: lb.x, y: lb.y },                            // below
      { x: lb.x, y: lb.y - 32 - labelH },              // above
      { x: lb.x + nameW * 0.5 + 16, y: lb.y - 8 },    // right
      { x: lb.x - nameW * 0.5 - 16, y: lb.y - 8 }     // left
    ];

    var bestPos = null;
    var bestOverlap = Infinity;

    for (var c = 0; c < candidates.length; c++) {
      var cx = candidates[c].x;
      var cy = candidates[c].y;
      var box = { x: cx - nameW / 2 - 2, y: cy - labelH, w: nameW + 4, h: labelH + distH + 2 };
      var overlap = 0;
      for (var j = 0; j < placed.length; j++) {
        var p = placed[j];
        var ox = Math.max(0, Math.min(box.x + box.w, p.x + p.w) - Math.max(box.x, p.x));
        var oy = Math.max(0, Math.min(box.y + box.h, p.y + p.h) - Math.max(box.y, p.y));
        overlap += ox * oy;
      }
      if (overlap === 0) { bestPos = candidates[c]; bestOverlap = 0; break; }
      if (overlap < bestOverlap) { bestOverlap = overlap; bestPos = candidates[c]; }
    }

    // Determine opacity: full if no overlap, reduced if some
    var alpha = bestOverlap === 0 ? 1.0 : Math.max(0.45, 1.0 - bestOverlap / (nameW * labelH));
    if (lb.sel) alpha = 1.0; // selected always full opacity
    // Apply 3D visibility alpha
    if (lb.alpha !== undefined) alpha *= lb.alpha;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = font;
    ctx.fillStyle = lb.sel ? '#e8e8f0' : '#a8a8c0';
    ctx.textAlign = 'center';
    ctx.fillText(lb.name, bestPos.x, bestPos.y);

    if (lb.dist > 0 && alpha > 0.3) {
      ctx.font = '9px Space Mono, SF Mono, Menlo, monospace';
      ctx.fillStyle = '#5a5a78';
      ctx.fillText(formatDistance(lb.dist), bestPos.x, bestPos.y + 12);
    }
    ctx.restore();

    // Register this label's bounding box
    placed.push({ x: bestPos.x - nameW / 2 - 2, y: bestPos.y - labelH, w: nameW + 4, h: labelH + distH + 2 });
  }

  pendingLabels = [];
}

function drawDistanceLine(o1, o2) {
  var s1 = worldToScreen(o1.x, o1.y), s2 = worldToScreen(o2.x, o2.y);
  var dx = s2.x - s1.x, dy = s2.y - s1.y;
  if (Math.sqrt(dx * dx + dy * dy) < 30) return;

  ctx.strokeStyle = 'rgba(100, 100, 160, 0.18)';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(s1.x, s1.y);
  ctx.lineTo(s2.x, s2.y);
  ctx.stroke();
  ctx.setLineDash([]);

  var wd = Math.sqrt(Math.pow(o2.x - o1.x, 2) + Math.pow(o2.y - o1.y, 2));
  ctx.font = '9px Space Mono, SF Mono, Menlo, monospace';
  ctx.fillStyle = 'rgba(120, 120, 170, 0.5)';
  ctx.textAlign = 'center';
  ctx.fillText(formatDistance(wd), (s1.x + s2.x) / 2, (s1.y + s2.y) / 2 - 4);
}

// ─── Draw: hover info icon ────────────────────────────────────────────

// ─── Sun indicator (always visible) ──────────────────────────────────

function drawSunIndicator() {
  var vr = getViewRadius();
  // Skip when the solar-category Sun object is visible (it has its own label)
  if (vr < 250) return;

  var sp = worldToScreen(0, 0);
  var sw = W / dpr;
  var sh = H / dpr;
  var margin = 40;
  var onScreen = sp.x > margin && sp.x < sw - margin && sp.y > margin && sp.y < sh - margin;

  if (onScreen) {
    // Sun is on screen but may not have an object dot at this scale.
    // Draw a small subtle crosshair + ☉ label to mark home.
    var hasGalaxyObj = vr > 200 && vr < 250000; // "Sun (You Are Here)" visible
    var hasCosmicObj = vr > 2e6; // "Milky Way (You Are Here)" visible
    if (hasGalaxyObj || hasCosmicObj) return; // already drawn as an object

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 221, 68, 0.2)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(sp.x - 10, sp.y); ctx.lineTo(sp.x + 10, sp.y);
    ctx.moveTo(sp.x, sp.y - 10); ctx.lineTo(sp.x, sp.y + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 221, 68, 0.3)';
    ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u2609 Sun', sp.x, sp.y - 14);
    ctx.restore();
  } else {
    // Sun is off-screen: draw an arrow on the edge pointing toward it
    var cx = sw / 2, cy = sh / 2;
    var angle = Math.atan2(sp.y - cy, sp.x - cx);
    // Clamp to edge with margin
    var edgeMargin = 50;
    var edgeX, edgeY;

    // Find intersection with viewport edge
    var t1 = Infinity, t2 = Infinity;
    if (Math.cos(angle) !== 0) t1 = ((Math.cos(angle) > 0 ? sw - edgeMargin : edgeMargin) - cx) / Math.cos(angle);
    if (Math.sin(angle) !== 0) t2 = ((Math.sin(angle) > 0 ? sh - edgeMargin : edgeMargin) - cy) / Math.sin(angle);
    var t = Math.min(Math.abs(t1), Math.abs(t2));
    edgeX = cx + Math.cos(angle) * t;
    edgeY = cy + Math.sin(angle) * t;

    // Clamp within bounds
    edgeX = Math.max(edgeMargin, Math.min(sw - edgeMargin, edgeX));
    edgeY = Math.max(edgeMargin, Math.min(sh - edgeMargin, edgeY));

    ctx.save();
    // Arrow
    ctx.translate(edgeX, edgeY);
    ctx.rotate(angle);

    // Glow behind arrow
    ctx.fillStyle = 'rgba(255, 221, 68, 0.08)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    // Arrow shape
    ctx.fillStyle = 'rgba(255, 221, 68, 0.5)';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-4, -5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();

    // Sun symbol
    ctx.rotate(-angle); // undo rotation for upright text
    ctx.fillStyle = 'rgba(255, 221, 68, 0.6)';
    ctx.font = '12px Rajdhani, -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u2609', 0, -20);
    ctx.font = '9px Rajdhani, -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 221, 68, 0.35)';
    ctx.fillText('Sun', 0, -10);
    ctx.restore();
  }
}

function drawHoverIcon() {
  if (!state.hoverIconPos) return;
  var hp = state.hoverIconPos;
  ctx.save();
  ctx.fillStyle = 'rgba(100, 140, 200, 0.35)';
  ctx.beginPath();
  ctx.arc(hp.x, hp.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 11px Rajdhani, -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(180, 200, 240, 0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('i', hp.x, hp.y);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ─── Draw: reference distances ────────────────────────────────────────

function drawReferenceDistances() {
  if (state.mode3d) return;
  var vr = getViewRadius();
  var scale = getScale();
  var sw = W / dpr;
  var sh = H / dpr;

  var toShow = [];
  refDistances.forEach(function(ref) {
    var px = ref.dist * scale;
    if (px < sw * 0.25 && ref.dist < vr * 1.5) {
      toShow.push({ name: ref.name, dist: ref.dist, px: px, color: ref.color });
    }
  });

  toShow.sort(function(a, b) { return b.px - a.px; });
  toShow = toShow.slice(0, 3);
  if (toShow.length === 0) return;

  // Pre-compute display strings and measure max text width
  var displayStrs = [];
  toShow.forEach(function(ref) {
    var pxStr;
    if (ref.px >= 1.5) {
      pxStr = ref.px.toFixed(ref.px < 10 ? 1 : 0) + " px";
    } else if (ref.px >= 0.01) {
      pxStr = ref.px.toFixed(3) + " px";
    } else if (ref.px >= 1e-6) {
      var inv = 1 / ref.px;
      if (inv >= 1e9) pxStr = "1/" + (inv / 1e9).toFixed(1) + " billionth px";
      else if (inv >= 1e6) pxStr = "1/" + (inv / 1e6).toFixed(0) + " millionth px";
      else if (inv >= 1e3) pxStr = "1/" + (inv / 1e3).toFixed(0) + " thousandth px";
      else pxStr = "1/" + Math.round(inv) + " px";
    } else {
      var inv2 = 1 / ref.px;
      if (inv2 >= 1e12) pxStr = "1/" + (inv2 / 1e12).toFixed(1) + " trillionth px";
      else if (inv2 >= 1e9) pxStr = "1/" + (inv2 / 1e9).toFixed(1) + " billionth px";
      else pxStr = "1/" + (inv2 / 1e6).toFixed(0) + " millionth px";
    }
    displayStrs.push(ref.name + "  =  " + pxStr);
  });

  ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
  var maxTextW = 0;
  displayStrs.forEach(function(str) {
    var tw = ctx.measureText(str).width;
    if (tw > maxTextW) maxTextW = tw;
  });
  ctx.font = '9px Rajdhani, -apple-system, system-ui, sans-serif';
  var headerW = ctx.measureText('REFERENCE DISTANCES AT THIS SCALE').width;
  maxTextW = Math.max(maxTextW, headerW);

  var boxX = sw - 20;
  var lineH = 22;
  var startY = sh - 70 - toShow.length * lineH;

  var boxW = Math.max(280, maxTextW + 50);
  var boxH = toShow.length * lineH + 26;
  ctx.fillStyle = 'rgba(10, 10, 20, 0.65)';
  ctx.beginPath();
  var bx = boxX - boxW, by = startY - 20;
  ctx.moveTo(bx + 6, by);
  ctx.lineTo(bx + boxW + 4 - 6, by);
  ctx.quadraticCurveTo(bx + boxW + 4, by, bx + boxW + 4, by + 6);
  ctx.lineTo(bx + boxW + 4, by + boxH - 6);
  ctx.quadraticCurveTo(bx + boxW + 4, by + boxH, bx + boxW + 4 - 6, by + boxH);
  ctx.lineTo(bx + 6, by + boxH);
  ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - 6);
  ctx.lineTo(bx, by + 6);
  ctx.quadraticCurveTo(bx, by, bx + 6, by);
  ctx.fill();

  ctx.strokeStyle = 'rgba(60, 60, 90, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = '9px Rajdhani, -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#4a4a66';
  ctx.textAlign = 'right';
  ctx.fillText('REFERENCE DISTANCES AT THIS SCALE', boxX, startY - 6);

  toShow.forEach(function(ref, i) {
    var y = startY + 14 + i * lineH;

    if (ref.px >= 1.5) {
      var barW = Math.min(ref.px, 130);
      var barX = boxX - barW;
      var barY = y - 2;

      ctx.fillStyle = ref.color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(barX, barY, barW, 3);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = ref.color;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(barX, barY - 3); ctx.lineTo(barX, barY + 6);
      ctx.moveTo(barX + barW, barY - 3); ctx.lineTo(barX + barW, barY + 6);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#8888a8';
      ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(ref.name + "  =  " + ref.px.toFixed(ref.px < 10 ? 1 : 0) + " px", barX - 6, y + 2);
    } else {
      var pxStr;
      if (ref.px >= 0.01) {
        pxStr = ref.px.toFixed(3) + " px";
      } else if (ref.px >= 1e-6) {
        var inv = 1 / ref.px;
        if (inv >= 1e9) pxStr = "1/" + (inv / 1e9).toFixed(1) + " billionth px";
        else if (inv >= 1e6) pxStr = "1/" + (inv / 1e6).toFixed(0) + " millionth px";
        else if (inv >= 1e3) pxStr = "1/" + (inv / 1e3).toFixed(0) + " thousandth px";
        else pxStr = "1/" + Math.round(inv) + " px";
      } else {
        var inv2 = 1 / ref.px;
        if (inv2 >= 1e12) pxStr = "1/" + (inv2 / 1e12).toFixed(1) + " trillionth px";
        else if (inv2 >= 1e9) pxStr = "1/" + (inv2 / 1e9).toFixed(1) + " billionth px";
        else pxStr = "1/" + (inv2 / 1e6).toFixed(0) + " millionth px";
      }

      ctx.fillStyle = ref.color;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(boxX - 1, y - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#6a6a88';
      ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(ref.name + "  =  " + pxStr, boxX - 8, y + 2);
    }
  });
}

// ─── Draw: cosmic filaments (large-scale structure) ──────────────────


function drawCosmicFilaments() {
  var vr = getViewRadius();
  if (vr < 50 * MLY) return;

  var scale = getScale();
  var sw = W / dpr;
  var sh = H / dpr;

  // Fade in between 50 Mly and 100 Mly
  var fade = 1;
  if (vr < 100 * MLY) fade = (vr - 50 * MLY) / (50 * MLY);

  ctx.save();

  // Draw filament connections as curved, wispy lines
  for (var i = 0; i < cosmicFilamentLinks.length; i++) {
    var link = cosmicFilamentLinks[i];
    var n1 = cosmicFilamentNodes[link[0]];
    var n2 = cosmicFilamentNodes[link[1]];
    var s1 = worldToScreen(n1.x, n1.y);
    var s2 = worldToScreen(n2.x, n2.y);

    // Skip if both endpoints are far off-screen
    if ((s1.x < -200 && s2.x < -200) || (s1.x > sw + 200 && s2.x > sw + 200)) continue;
    if ((s1.y < -200 && s2.y < -200) || (s1.y > sh + 200 && s2.y > sh + 200)) continue;

    // Bezier control point offset perpendicular to the line
    var mx = (s1.x + s2.x) / 2;
    var my = (s1.y + s2.y) / 2;
    var dx = s2.x - s1.x;
    var dy = s2.y - s1.y;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) continue;
    // Offset control point to create a gentle curve
    var perpX = -dy / len * len * 0.12;
    var perpY = dx / len * len * 0.12;
    var cx1 = mx + perpX;
    var cy1 = my + perpY;

    // Draw multiple passes for a wispy effect
    var passes = [
      { w: 12, a: 0.015 * fade },
      { w: 5, a: 0.03 * fade },
      { w: 2, a: 0.05 * fade },
      { w: 0.8, a: 0.08 * fade }
    ];

    for (var p = 0; p < passes.length; p++) {
      ctx.strokeStyle = "rgba(140, 130, 200, " + passes[p].a + ")";
      ctx.lineWidth = passes[p].w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.quadraticCurveTo(cx1, cy1, s2.x, s2.y);
      ctx.stroke();
    }
  }

  // Draw filament node glows
  for (var j = 0; j < cosmicFilamentNodes.length; j++) {
    var node = cosmicFilamentNodes[j];
    var sp = worldToScreen(node.x, node.y);
    if (sp.x < -100 || sp.x > sw + 100 || sp.y < -100 || sp.y > sh + 100) continue;
    var ng = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 20);
    ng.addColorStop(0, "rgba(160, 150, 220, " + (0.06 * fade) + ")");
    ng.addColorStop(1, "rgba(160, 150, 220, 0)");
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw void labels
  ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (var v = 0; v < cosmicVoids.length; v++) {
    var voidInfo = cosmicVoids[v];
    var vsp = worldToScreen(voidInfo.x, voidInfo.y);
    if (vsp.x < -50 || vsp.x > sw + 50 || vsp.y < -50 || vsp.y > sh + 50) continue;
    ctx.fillStyle = "rgba(80, 70, 100, " + (0.25 * fade) + ")";
    ctx.fillText(voidInfo.name, vsp.x, vsp.y);
    ctx.font = '8px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = "rgba(80, 70, 100, " + (0.15 * fade) + ")";
    ctx.fillText("(void)", vsp.x, vsp.y + 14);
    ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
  }

  ctx.restore();
}

// ─── Draw: constellation lines ────────────────────────────────────────


function drawConstellationLines() {
  var vr = getViewRadius();
  if (vr < 80 || vr > 4000) return;

  // Fade in 80-150, full 150-2500, fade out 2500-4000
  var alpha = 1;
  if (vr < 150) alpha = (vr - 80) / 70;
  if (vr > 2500) alpha = (4000 - vr) / 1500;
  alpha = Math.max(0, Math.min(1, alpha));

  // Use name index for lookups (constellation membership checked inline)
  var objByName = _objectByName;

  ctx.save();

  for (var cId in constellationDefs) {
    var cDef = constellationDefs[cId];
    var lines = cDef.lines;
    var isParallax = parallaxState.active && parallaxState.constellation === cId && parallaxState.progress > 0.005;

    // During parallax: draw ghost lines, motion trails, flash effect
    if (isParallax) {
      var pp = parallaxState.progress;
      var fa = parallaxState.flashAlpha || 0;

      // Flash pulse when parallax begins
      if (fa > 0.01) {
        for (var fi = 0; fi < objects.length; fi++) {
          var fo = objects[fi];
          if (!fo.constellation || fo.constellation !== cId) continue;
          var fsp = worldToScreen(fo.x, fo.y);
          var fr = fo.radius * (3 + fa * 8);
          var fg = ctx.createRadialGradient(fsp.x, fsp.y, 0, fsp.x, fsp.y, fr);
          fg.addColorStop(0, 'rgba(122, 170, 238, ' + (0.4 * fa * alpha).toFixed(3) + ')');
          fg.addColorStop(1, 'rgba(122, 170, 238, 0)');
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(fsp.x, fsp.y, fr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Ghost constellation lines at original positions
      ctx.strokeStyle = cDef.color.replace('ALPHA', (0.2 * alpha).toFixed(3));
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      for (var gli = 0; gli < lines.length; gli++) {
        var ga = objByName[lines[gli][0]];
        var gb = objByName[lines[gli][1]];
        if (!ga || !gb) continue;
        var gsa = worldToScreen(ga.x, ga.y);
        var gsb = worldToScreen(gb.x, gb.y);
        ctx.beginPath();
        ctx.moveTo(gsa.x, gsa.y);
        ctx.lineTo(gsb.x, gsb.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Ghost star dots + motion trail arrows
      for (var gi = 0; gi < objects.length; gi++) {
        var go = objects[gi];
        if (!go.constellation || go.constellation !== cId) continue;
        var gsp = worldToScreen(go.x, go.y);
        var gpx = getParallaxOffset(go);
        // Ghost dot at original position
        ctx.fillStyle = 'rgba(150, 170, 220, ' + (0.3 * pp * alpha).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(gsp.x, gsp.y, go.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        // Ring around ghost
        ctx.strokeStyle = 'rgba(150, 170, 220, ' + (0.15 * pp * alpha).toFixed(3) + ')';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(gsp.x, gsp.y, go.radius * 2, 0, Math.PI * 2);
        ctx.stroke();
        // Motion trail with arrowhead
        if (gpx) {
          var gspS = worldToScreen(go.x + gpx.dx, go.y + gpx.dy);
          var dx = gspS.x - gsp.x;
          var dy = gspS.y - gsp.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 3) {
            // Trail line — thicker for closer stars (bigger shift)
            var trailW = Math.min(2.5, dist / 30);
            ctx.strokeStyle = 'rgba(122, 170, 238, ' + (0.25 * pp * alpha).toFixed(3) + ')';
            ctx.lineWidth = trailW;
            ctx.beginPath();
            ctx.moveTo(gsp.x, gsp.y);
            ctx.lineTo(gspS.x, gspS.y);
            ctx.stroke();
            // Arrowhead
            var angle = Math.atan2(dy, dx);
            var aLen = Math.min(8, dist * 0.2);
            ctx.fillStyle = 'rgba(122, 170, 238, ' + (0.3 * pp * alpha).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(gspS.x, gspS.y);
            ctx.lineTo(gspS.x - aLen * Math.cos(angle - 0.4), gspS.y - aLen * Math.sin(angle - 0.4));
            ctx.lineTo(gspS.x - aLen * Math.cos(angle + 0.4), gspS.y - aLen * Math.sin(angle + 0.4));
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    // Draw constellation lines (shifted if parallax active)
    ctx.strokeStyle = cDef.color.replace('ALPHA', (0.18 * alpha).toFixed(3));
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);

    for (var li = 0; li < lines.length; li++) {
      var a = objByName[lines[li][0]];
      var b = objByName[lines[li][1]];
      if (!a || !b) continue;
      var pxA = isParallax ? getParallaxOffset(a) : null;
      var pxB = isParallax ? getParallaxOffset(b) : null;
      var sa = worldToScreen(pxA ? a.x + pxA.dx : a.x, pxA ? a.y + pxA.dy : a.y);
      var sb = worldToScreen(pxB ? b.x + pxB.dx : b.x, pxB ? b.y + pxB.dy : b.y);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Label the constellation — anchored to a specific star + offset
    if (alpha > 0.3) {
      var anchor = cDef.labelAnchor ? objByName[cDef.labelAnchor] : null;
      var lx, ly;
      if (anchor) {
        var aPx = isParallax ? getParallaxOffset(anchor) : null;
        var anchorSp = worldToScreen(aPx ? anchor.x + aPx.dx : anchor.x, aPx ? anchor.y + aPx.dy : anchor.y);
        lx = anchorSp.x + (cDef.labelDx || 0);
        ly = anchorSp.y + (cDef.labelDy || 0);
      } else {
        // Fallback to centroid
        lx = 0; ly = 0; var count = 0;
        for (var ni = 0; ni < lines.length; ni++) {
          var na = objByName[lines[ni][0]];
          var nb = objByName[lines[ni][1]];
          if (na) { var spa = worldToScreen(na.x, na.y); lx += spa.x; ly += spa.y; count++; }
          if (nb) { var spb = worldToScreen(nb.x, nb.y); lx += spb.x; ly += spb.y; count++; }
        }
        if (count > 0) { lx /= count; ly /= count; }
      }
      ctx.font = '12px Rajdhani, -apple-system, system-ui, sans-serif';
      ctx.fillStyle = cDef.color.replace('ALPHA', (0.35 * alpha).toFixed(3));
      ctx.textAlign = 'center';
      var nameLines = cDef.name.split('\n');
      for (var nl = 0; nl < nameLines.length; nl++) {
        ctx.fillText(nameLines[nl], lx, ly + nl * 14);
      }
      var labelBottom = ly + (nameLines.length - 1) * 14;

      if (cDef.depthLabel && !isParallax) {
        ctx.font = '9px Space Mono, SF Mono, Menlo, monospace';
        ctx.fillStyle = cDef.color.replace('ALPHA', (0.2 * alpha).toFixed(3));
        ctx.fillText(cDef.depthLabel, lx, labelBottom + 14);
      }
      // Parallax viewpoint label
      if (isParallax && parallaxState.label) {
        ctx.font = '10px Space Mono, SF Mono, Menlo, monospace';
        ctx.fillStyle = 'rgba(122, 170, 238, ' + (0.5 * parallaxState.progress * alpha).toFixed(3) + ')';
        ctx.fillText(parallaxState.label, lx, labelBottom + 14);
      }
    }
  }

  ctx.restore();
}

// ─── Draw: observable universe boundary ───────────────────────────────

function drawObservableUniverse() {
  var vr = getViewRadius();
  // Only visible at extreme cosmic scale
  if (vr < 200 * MLY) return;

  var scale = getScale();
  var OBSERVABLE_RADIUS = 46.5e9; // 46.5 billion light-years comoving distance
  var rPx = OBSERVABLE_RADIUS * scale;

  // Too small or too large to be useful
  if (rPx < 30) return;

  var sp = worldToScreen(0, 0);
  var sw = W / dpr;
  var sh = H / dpr;

  // Fade in between 200 Mly and 400 Mly
  var fade = 1;
  if (vr < 400 * MLY) fade = (vr - 200 * MLY) / (200 * MLY);

  ctx.save();

  // Outer dashed boundary
  ctx.strokeStyle = "rgba(100, 80, 140, " + (0.15 * fade) + ")";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([12, 8]);
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, rPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Soft inner glow at the edge
  if (rPx > 80 && rPx < sw * 4) {
    ctx.strokeStyle = "rgba(100, 80, 140, " + (0.06 * fade) + ")";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, rPx, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Label
  if (rPx > 60) {
    ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
    ctx.fillStyle = "rgba(140, 120, 180, " + (0.3 * fade) + ")";
    ctx.textAlign = 'center';
    ctx.fillText("Observable Universe (46.5 Gly)", sp.x, sp.y - rPx - 12);
  }

  ctx.restore();
}

// ─── Draw: dark matter halos ──────────────────────────────────────────

function drawDarkMatterHalos() {
  var vr = getViewRadius();
  // Only visible at local group / cosmic scale where galaxies are dots
  if (vr < 200000 || vr > 30 * MLY) return;

  var scale = getScale();
  var sw = W / dpr;
  var sh = H / dpr;

  // Fade in from 200,000 to 400,000; fade out from 20 Mly to 30 Mly
  var fade = 1;
  if (vr < 400000) fade = (vr - 200000) / 200000;
  if (vr > 20 * MLY) fade = (30 * MLY - vr) / (10 * MLY);
  fade = Math.max(0, Math.min(1, fade));

  // Galaxies that should have visible dark matter halos
  var haloTargets = [
    { x: 0, y: 0, haloR: 300000, color: [255, 221, 68] },                          // Milky Way
    { x: -1.5 * MLY, y: -2.0 * MLY, haloR: 400000, color: [187, 170, 238] },       // Andromeda
    { x: -2.0 * MLY, y: -1.8 * MLY, haloR: 150000, color: [153, 170, 221] },       // Triangulum
    { x: 70000, y: -145000, haloR: 80000, color: [136, 170, 221] },                 // LMC
    { x: 110000, y: -170000, haloR: 50000, color: [119, 153, 204] }                 // SMC
  ];

  ctx.save();
  for (var i = 0; i < haloTargets.length; i++) {
    var ht = haloTargets[i];
    var sp = worldToScreen(ht.x, ht.y);
    var rPx = ht.haloR * scale;

    if (rPx < 8 || rPx > sw * 3) continue;
    if (sp.x < -rPx || sp.x > sw + rPx || sp.y < -rPx || sp.y > sh + rPx) continue;

    var hGrad = ctx.createRadialGradient(sp.x, sp.y, rPx * 0.2, sp.x, sp.y, rPx);
    var c = ht.color;
    hGrad.addColorStop(0, "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (0.04 * fade) + ")");
    hGrad.addColorStop(0.5, "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (0.02 * fade) + ")");
    hGrad.addColorStop(1, "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0)");
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, rPx, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── Main draw ────────────────────────────────────────────────────────

function draw(ts) {
  if (state.mode3d) { draw3D(ts); return; }
  draw2D(ts);
}

function draw2D(ts) {
  // Update planet positions from Keplerian elements
  if (!simTime.paused && simTime.multiplier !== 0) {
    updatePlanetPositions();
    updateStellarPositions();
    updateGalaxyMotion();
  }
  // 2D follow: keep pan centered on the followed object
  if (state.follow) {
    state.panX = state.follow.x;
    state.panY = state.follow.y;
    state.dirty = true;
  }

  var sw = W / dpr;
  var sh = H / dpr;

  ctx.clearRect(0, 0, sw, sh);
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, sw, sh);

  drawStarfield(ts);
  drawAmbientParticles(ts);
  drawWarpStreaks(ts);
  drawRegions();
  drawOrbits();
  drawAsteroidBelt();
  drawConstellationLines();
  drawGalaxies();
  drawCosmicFilaments();
  drawObservableUniverse();
  drawDarkMatterHalos();
  drawFlowParticles(ts);

  // Center marker
  var sp0 = worldToScreen(0, 0);
  ctx.strokeStyle = 'rgba(255, 221, 68, 0.06)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(sp0.x - 6, sp0.y);
  ctx.lineTo(sp0.x + 6, sp0.y);
  ctx.moveTo(sp0.x, sp0.y - 6);
  ctx.lineTo(sp0.x, sp0.y + 6);
  ctx.stroke();

  var visible = getVisibleObjects();

  if (state.selected) {
    visible.forEach(function(o) {
      if (o !== state.selected && o.category === state.selected.category) drawDistanceLine(state.selected, o);
    });
  }

  pendingLabels = [];
  visible.forEach(function(o) {
    var px = getParallaxOffset(o);
    drawObject(o, worldToScreen(px ? o.x + px.dx : o.x, px ? o.y + px.dy : o.y), ts);
  });
  drawLabels();

  drawSunIndicator();
  drawLightPulse(ts);
  drawHoverIcon();
  drawVignette();
  drawReferenceDistances();

  // Frame flash effect (double-click navigation ring)
  if (frameFlash.active && ts) {
    var flashElapsed = ts - frameFlash.startTime;
    var flashDuration = 800;
    if (flashElapsed < flashDuration) {
      var flashProgress = flashElapsed / flashDuration;
      var flashRadius = 10 + flashProgress * 60;
      var flashAlpha = (1 - flashProgress) * 0.6;
      var flashSp = worldToScreen(frameFlash.x, frameFlash.y);
      ctx.save();
      ctx.strokeStyle = frameFlash.color;
      ctx.globalAlpha = flashAlpha;
      ctx.lineWidth = 2 * (1 - flashProgress) + 0.5;
      ctx.beginPath();
      ctx.arc(flashSp.x, flashSp.y, flashRadius, 0, Math.PI * 2);
      ctx.stroke();
      // Inner ring
      if (flashProgress < 0.5) {
        ctx.globalAlpha = flashAlpha * 0.5;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(flashSp.x, flashSp.y, flashRadius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      state.dirty = true;
    } else {
      frameFlash.active = false;
    }
  }

  // Scale label
  var vr = getViewRadius();
  var sd = vr < 0.001 ? 'Solar System' : vr < 50 ? 'Stellar Neighborhood' : vr < 3000 ? 'Constellations' : vr < 250000 ? 'Milky Way' : vr < 10 * MLY ? 'Local Group' : 'Cosmic Scale';
  ctx.font = '11px Rajdhani, -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#3a3a55';
  ctx.textAlign = 'right';
  ctx.fillText(sd, sw - 16, 20);
  var hudRightY = 34;
  if (simTime.paused) {
    ctx.fillStyle = '#9a6a5a';
    ctx.fillText('\u23f8 Paused', sw - 16, hudRightY);
    hudRightY += 14;
  }
  if (state.follow) {
    ctx.fillStyle = '#7a9a7a';
    ctx.fillText('Following ' + displayName(state.follow), sw - 16, hudRightY);
  }

  updateUI();
}

// ─── 3D Draw ──────────────────────────────────────────────────────────

function drawConstellationLines3D(projected) {
  // projected: { name: screenPos } map
  var objByName = {};
  for (var i = 0; i < objects.length; i++) {
    if (objects[i].constellation) objByName[objects[i].name] = objects[i];
  }

  ctx.save();
  for (var cId in constellationDefs) {
    var cDef = constellationDefs[cId];
    var lines = cDef.lines;

    // Check if any stars are visible
    var anyVisible = false;
    for (var ci = 0; ci < lines.length; ci++) {
      if (projected[lines[ci][0]] && projected[lines[ci][1]]) { anyVisible = true; break; }
    }
    if (!anyVisible) continue;

    ctx.strokeStyle = cDef.color.replace('ALPHA', '0.25');
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);

    for (var li = 0; li < lines.length; li++) {
      var spA = projected[lines[li][0]];
      var spB = projected[lines[li][1]];
      if (!spA || !spB) continue;
      ctx.beginPath();
      ctx.moveTo(spA.x, spA.y);
      ctx.lineTo(spB.x, spB.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Label — find centroid of visible stars
    var cx = 0, cy = 0, count = 0;
    for (var ni = 0; ni < lines.length; ni++) {
      var sa = projected[lines[ni][0]];
      var sb = projected[lines[ni][1]];
      if (sa) { cx += sa.x; cy += sa.y; count++; }
      if (sb) { cx += sb.x; cy += sb.y; count++; }
    }
    if (count > 0) {
      cx /= count; cy /= count;
      ctx.font = '12px Rajdhani, -apple-system, system-ui, sans-serif';
      ctx.fillStyle = cDef.color.replace('ALPHA', '0.35');
      ctx.textAlign = 'center';
      var nameLines = cDef.name.split('\n');
      for (var nl = 0; nl < nameLines.length; nl++) {
        ctx.fillText(nameLines[nl], cx, cy - 20 + nl * 14);
      }
    }
  }
  ctx.restore();
}

function drawDiffractionSpikes(x, y, r, color, brightness) {
  if (r < 2) return;
  var spikeLen = r * 3 * brightness;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.4 * brightness;
  ctx.beginPath();
  ctx.moveTo(x, y - spikeLen); ctx.lineTo(x, y + spikeLen);
  ctx.moveTo(x - spikeLen, y); ctx.lineTo(x + spikeLen, y);
  ctx.stroke();
  var diagLen = spikeLen * 0.5;
  ctx.globalAlpha = 0.2 * brightness;
  ctx.beginPath();
  ctx.moveTo(x - diagLen, y - diagLen); ctx.lineTo(x + diagLen, y + diagLen);
  ctx.moveTo(x + diagLen, y - diagLen); ctx.lineTo(x - diagLen, y + diagLen);
  ctx.stroke();
  ctx.restore();
}

function drawNebula3D(x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = 0.08 * alpha;
  for (var layer = 0; layer < 3; layer++) {
    var offsetX = Math.sin(layer * 2.1) * r * 0.3;
    var offsetY = Math.cos(layer * 2.1) * r * 0.3;
    var layerR = r * (1.5 + layer * 0.5);
    var grad = ctx.createRadialGradient(x + offsetX, y + offsetY, 0, x + offsetX, y + offsetY, layerR);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + offsetX, y + offsetY, layerR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGalaxy3D(x, y, r, color, alpha) {
  ctx.save();
  ctx.globalAlpha = 0.12 * alpha;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 3, r * 1.2, Math.PI * 0.2, 0, Math.PI * 2);
  var grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

function draw3D(ts) {
  var sw = W / dpr;
  var sh = H / dpr;

  // Animate camera if flying
  if (cam3dAnim.active) {
    var elapsed = ts - cam3dAnim.startTime;
    var t = Math.min(1, elapsed / cam3dAnim.duration);
    var e = easeInOutCubic(t);
    var from = cam3dAnim.from, to = cam3dAnim.to;
    cam3d.px = from.px + (to.px - from.px) * e;
    cam3d.py = from.py + (to.py - from.py) * e;
    cam3d.pz = from.pz + (to.pz - from.pz) * e;
    cam3d.fov = from.fov + (to.fov - from.fov) * e;
    // Interpolate yaw with shortest path
    var dyaw = to.yaw - from.yaw;
    while (dyaw > Math.PI) dyaw -= 2 * Math.PI;
    while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    cam3d.yaw = from.yaw + dyaw * e;
    cam3d.pitch = from.pitch + (to.pitch - from.pitch) * e;
    if (t >= 1) {
      cam3dAnim.active = false;
      // Sync orbit mode to final camera position
      if (orbitMode.active) {
        orbitToCamera();
      }
    }
    state.dirty = true;
  }

  // Keep redrawing while orbit mode is active (camera may need updates)
  if (orbitMode.active) state.dirty = true;

  // Orbit focal point animation
  if (orbitMode.active && orbitMode.focalAnim.active) {
    var fa = orbitMode.focalAnim;
    var elapsed = ts - fa.startTime;
    var t2 = Math.min(1, elapsed / fa.duration);
    var e2 = easeInOutCubic(t2);
    orbitMode.focalX = fa.fromX + (fa.toX - fa.fromX) * e2;
    orbitMode.focalY = fa.fromY + (fa.toY - fa.fromY) * e2;
    orbitMode.focalZ = fa.fromZ + (fa.toZ - fa.fromZ) * e2;
    orbitToCamera();
    if (t2 >= 1) {
      fa.active = false;
      orbitMode.focalName = fa.toName;
    }
    state.dirty = true;
  }

  // Update planet positions from Keplerian elements
  if (!simTime.paused && simTime.multiplier !== 0) {
    updatePlanetPositions();
    updateStellarPositions();
    updateGalaxyMotion();
    // Track orbit focal point to moving object
    if (orbitMode.active && !orbitMode.focalAnim.active) {
      var _fobj = findObject(orbitMode.focalName);
      // displayName may shorten "Sun (You Are Here)" to "Sun"
      if (!_fobj && orbitMode.focalName === 'Sun') _fobj = findObject('Sun (You Are Here)');
      if (!_fobj && orbitMode.focalName === 'Milky Way') _fobj = findObject('Milky Way (You Are Here)');
      if (_fobj) {
        orbitMode.focalX = _fobj.wx3d;
        orbitMode.focalY = _fobj.wy3d;
        orbitMode.focalZ = _fobj.wz3d;
        orbitToCamera();
      }
    }
    state.dirty = true;
  }

  // Camera tracking — continuously look at tracked target
  if (cam3d.trackTarget && !cam3dAnim.active && !orbitMode.active) {
    var trackPos = getLookTarget(cam3d.trackTarget);
    if (!trackPos) {
      var _tobj = findObject(cam3d.trackTarget);
      if (_tobj && _tobj.wx3d !== undefined) {
        trackPos = { x: _tobj.wx3d, y: _tobj.wy3d, z: _tobj.wz3d };
      }
    }
    if (trackPos) {
      var tdx = trackPos.x - cam3d.px, tdy = trackPos.y - cam3d.py, tdz = trackPos.z - cam3d.pz;
      var tDist = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
      if (tDist > 1e-8) {
        var ta = computeLookAngles(cam3d.px, cam3d.py, cam3d.pz, trackPos.x, trackPos.y, trackPos.z);
        cam3d.yaw = ta.yaw;
        cam3d.pitch = ta.pitch;
      }
      state.dirty = true;
    }
  }

  // Cache camera trig for worldToScreen3D
  _cosY = Math.cos(cam3d.yaw); _sinY = Math.sin(cam3d.yaw);
  _cosP = Math.cos(cam3d.pitch); _sinP = Math.sin(cam3d.pitch);

  ctx.clearRect(0, 0, sw, sh);
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, sw, sh);

  // Background starfield (reuse 2D)
  drawStarfield(ts);

  // Get visible objects and their projections
  var visible = getVisibleObjects3D();
  var projected = {}; // name -> screen pos, for constellation lines

  for (var i = 0; i < visible.length; i++) {
    var o = visible[i];
    if (o.constellation && o._sp3d) {
      projected[o.name] = o._sp3d;
    }
  }

  // Draw constellation lines behind objects
  drawConstellationLines3D(projected);

  // Draw Milky Way spiral arms in 3D
  drawSpiralArms3D();

  // Draw orbital planes behind objects
  drawOrbitalPlanes3D();

  // Draw asteroid belt particles in 3D
  (function() {
    var camDist = Math.sqrt(cam3d.px * cam3d.px + cam3d.py * cam3d.py + cam3d.pz * cam3d.pz);
    if (camDist > 0.01) return;
    var alpha = camDist > 0.005 ? 1.0 - (camDist - 0.005) / 0.005 : 1.0;
    alpha = Math.max(0, Math.min(1, alpha)) * 0.4;
    if (alpha < 0.01) return;

    ctx.save();
    ctx.fillStyle = asteroidBeltConfig.color;
    ctx.globalAlpha = alpha;
    for (var ai = 0; ai < _asteroidCache.length; ai++) {
      var ast = _asteroidCache[ai];
      var sp = worldToScreen3D(ast.wx, ast.wy, 0);
      if (!sp) continue;
      if (sp.x < -50 || sp.x > sw + 50 || sp.y < -50 || sp.y > sh + 50) continue;
      ctx.fillRect(sp.x - ast.sz * 0.5, sp.y - ast.sz * 0.5, ast.sz, ast.sz);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  })();

  // Draw objects (already depth sorted far→near)
  pendingLabels = [];
  var renderedDisks = [];
  var tSec3d = ts / 1000;
  for (var j = 0; j < visible.length; j++) {
    var obj = visible[j];
    // Skip solar-category "Sun" only when "Sun (You Are Here)" galaxy marker is visible
    if (obj.name === 'Sun' && obj.category === 'solar') {
      var camDist = Math.sqrt(cam3d.px * cam3d.px + cam3d.py * cam3d.py + cam3d.pz * cam3d.pz);
      if (camDist > 100) continue; // galaxy marker takes over at stellar+ distances
    }
    var sp = obj._sp3d;
    if (!sp) continue;

    var objAlpha = obj._vis3dAlpha !== undefined ? obj._vis3dAlpha : 1.0;

    // Per-object twinkling
    var twinkle = 1.0;
    if (effects.twinkling && obj.category === 'stellar') {
      twinkle = 0.85 + 0.15 * Math.sin(tSec3d * (1.5 + (j % 7) * 0.3) + j * 2.1);
    }

    // Scale radius by perspective
    var appMag = Math.max(0.5, Math.min(4, 1 + Math.log10(Math.max(1, 50 / sp.depth))));
    var r3d = Math.max(1.5, obj.radius * appMag);
    var isPhysical = false; // true when object appears as a resolved disk

    // Physical radius projection — when close enough, object fills real angular size
    if (obj.physRadius) {
      var halfW3d = sw / 2;
      var physScreenR = obj.physRadius * sp.scale * halfW3d;
      if (physScreenR > r3d) {
        r3d = Math.min(physScreenR, sw * 2); // cap to prevent insane sizes
        isPhysical = true;
      }
    }

    ctx.globalAlpha = objAlpha * twinkle;

    // Diffuse objects (nebulae, galaxies) become more transparent when resolved
    var isDiffuse = obj.category === 'nebula' || obj.category === 'galaxy' ||
                    obj.category === 'local' || obj.category === 'cosmic' ||
                    obj.category === 'cluster';
    if (isDiffuse && isPhysical) {
      // Fade transparency as object grows beyond ~50px to simulate diffuse structure
      var diffuseAlpha = Math.max(0.08, Math.min(1, 50 / r3d));
      ctx.globalAlpha = objAlpha * twinkle * diffuseAlpha;
    }

    // Category-specific rendering
    if (obj.category === 'nebula') {
      drawNebula3D(sp.x, sp.y, r3d, obj.color, objAlpha * twinkle * (isDiffuse && isPhysical ? Math.max(0.08, 50 / r3d) : 1));
    } else if (obj.category === 'galaxy' || obj.category === 'local') {
      drawGalaxy3D(sp.x, sp.y, r3d, obj.color, objAlpha * (isDiffuse && isPhysical ? Math.max(0.08, 50 / r3d) : 1));
    }

    // Directional lighting — offset glow toward the sun
    var lightOffX = 0, lightOffY = 0;
    if (obj.wx3d !== undefined && obj.name !== 'Sun (You Are Here)') {
      // Light direction: from object toward Sun (0,0,0)
      var lx = -obj.wx3d, ly = -obj.wy3d, lz = -obj.wz3d;
      var ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
      if (ll > 0.001) {
        lx /= ll; ly /= ll; lz /= ll;
        // Project light direction to screen space
        var fwdX = Math.cos(cam3d.pitch) * Math.cos(cam3d.yaw);
        var fwdY = Math.cos(cam3d.pitch) * Math.sin(cam3d.yaw);
        var fwdZ = Math.sin(cam3d.pitch);
        var rightX = -Math.sin(cam3d.yaw), rightY = Math.cos(cam3d.yaw);
        var upX = -Math.sin(cam3d.pitch) * Math.cos(cam3d.yaw);
        var upY = -Math.sin(cam3d.pitch) * Math.sin(cam3d.yaw);
        var upZ = Math.cos(cam3d.pitch);
        var screenLX = lx * rightX + ly * rightY;
        var screenLY = -(lx * upX + ly * upY + lz * upZ);
        var sll = Math.sqrt(screenLX * screenLX + screenLY * screenLY);
        if (sll > 0.01) {
          screenLX /= sll; screenLY /= sll;
          lightOffX = screenLX * r3d * 0.6;
          lightOffY = screenLY * r3d * 0.6;
        }
      }
    }

    // Draw glow (offset toward light source)
    // Resolved disks: reduce glow proportionally — no bloom on a planet from ISS
    var gi = effects.glowIntensity;
    var isSunOrStar = obj.category === 'stellar' || obj.category === 'exotic' || obj.name === 'Sun';
    var glowFade = (isPhysical && !isSunOrStar) ? Math.max(0, 1 - (r3d - 8) / 40) : 1;
    if (glowFade > 0.01) {
      var glowR = r3d * 3 * gi;
      var savedAlpha = ctx.globalAlpha;
      ctx.globalAlpha = savedAlpha * glowFade;
      var g = ctx.createRadialGradient(sp.x + lightOffX, sp.y + lightOffY, r3d * 0.3, sp.x, sp.y, glowR);
      g.addColorStop(0, obj.glow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Extended halo for bright stars
      if ((obj.category === 'stellar' || obj.category === 'exotic') && r3d > 2) {
        var glowR2 = r3d * 6 * gi;
        var haloColor = obj.color.length === 7 ? obj.color + '0d' : obj.color.substring(0, 7) + '0d';
        var g2 = ctx.createRadialGradient(sp.x, sp.y, glowR, sp.x, sp.y, glowR2);
        g2.addColorStop(0, haloColor);
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, glowR2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = savedAlpha;
    }

    // Draw core — dispatch to active overlay style
    if (!isDiffuse || !isPhysical) {
      var rotAngle = getRotationAngle(obj.name);
      var rd = rotationData[obj.name];
      var overlayCtx = {
        ctx: ctx, x: sp.x, y: sp.y, r: r3d, color: obj.color,
        lightOffX: lightOffX, lightOffY: lightOffY,
        alpha: ctx.globalAlpha, obj: obj, isPhysical: isPhysical,
        rotAngle: rotAngle, tilt: rd ? rd.tilt : 0
      };
      if (isPhysical && r3d > 4) {
        var styleFn = overlayRenderers[effects.overlayStyle] || drawOverlay_flat;
        styleFn(overlayCtx);
      } else {
        drawOverlay_flat(overlayCtx);
      }
    }

    // Collect disk for occlusion pass
    if (isPhysical && r3d > 3) {
      renderedDisks.push({ x: sp.x, y: sp.y, r: r3d, depth: sp.depth, obj: obj });
    }

    // Diffraction spikes — only for unresolved point sources
    if (!isPhysical && (obj.category === 'stellar' || obj.category === 'exotic') && r3d >= 2) {
      drawDiffractionSpikes(sp.x, sp.y, r3d, obj.color, objAlpha * twinkle);
    }

    ctx.globalAlpha = objAlpha;

    // Selection ring
    if (state.selected === obj) {
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = isPhysical && r3d > 20 ? 2 : 1;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, r3d + (isPhysical ? Math.max(5, r3d * 0.05) : 5), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;

    // Label — skip for selected object since cinematic HUD shows it bottom-right
    if (state.selected !== obj) {
      pendingLabels.push({
        name: displayName(obj),
        dist: obj.dist,
        x: sp.x,
        y: sp.y + r3d + 16,
        sel: false,
        priority: obj.radius,
        alpha: objAlpha
      });
    }
  }

  // Occlusion shadows (after all objects, before labels)
  drawOcclusion(renderedDisks);

  drawLabels();

  // Draw apparent size brackets — on selected, hovered, or Sol from distance
  var camFromOriginB = Math.sqrt(cam3d.px * cam3d.px + cam3d.py * cam3d.py + cam3d.pz * cam3d.pz);
  for (var bi = 0; bi < visible.length; bi++) {
    var bObj = visible[bi];
    if (!bObj._sp3d) continue;
    var isSelected = state.selected === bObj;
    var isHovered = state.hoverObj === bObj;
    var isSolAnchor = (bObj.name === 'Sun (You Are Here)') && camFromOriginB > 100;
    if (!isSelected && !isHovered && !isSolAnchor) continue;
    if (!bObj.physRadius && !isSolAnchor) continue;
    var bSp = bObj._sp3d;
    // For Sol anchor brackets, use a fixed bracket size if no physRadius
    var physR = bObj.physRadius || 0.0000046491; // Sun's radius in ly
    var angRad = 2 * Math.atan(physR / bSp.depth);
    if (angRad < 0.1 / 3600 * DEG2RAD && !isSolAnchor) continue;
    var focalLen3 = 1 / Math.tan(cam3d.fov * DEG2RAD / 2);
    var halfW3 = sw / 2;
    var angPx = angRad * focalLen3 * halfW3;
    // For Sol anchor, use minimum visible bracket size
    if (isSolAnchor && angPx < 20) angPx = 20;
    if (angPx < 8 || angPx > 800) continue;
    // Suppress brackets when the physical disk is plainly visible — brackets are
    // for revealing invisible angular extents, not boxing obvious objects
    if (!isSolAnchor && angPx > 30) continue;
    var half = angPx / 2;
    var bcx = bSp.x, bcy = bSp.y;
    var corner = Math.min(half * 0.3, 14);
    ctx.save();
    ctx.strokeStyle = isSolAnchor ? '#ffcc44' : bObj.color;
    ctx.globalAlpha = isSolAnchor ? 0.6 : (isSelected ? 0.7 : 0.4);
    ctx.lineWidth = isSolAnchor ? 1.5 : (isSelected ? 1.5 : 1);
    ctx.setLineDash([]);
    // Four L-shaped corner brackets
    ctx.beginPath();
    ctx.moveTo(bcx - half, bcy - half + corner); ctx.lineTo(bcx - half, bcy - half); ctx.lineTo(bcx - half + corner, bcy - half);
    ctx.moveTo(bcx + half - corner, bcy - half); ctx.lineTo(bcx + half, bcy - half); ctx.lineTo(bcx + half, bcy - half + corner);
    ctx.moveTo(bcx - half, bcy + half - corner); ctx.lineTo(bcx - half, bcy + half); ctx.lineTo(bcx - half + corner, bcy + half);
    ctx.moveTo(bcx + half - corner, bcy + half); ctx.lineTo(bcx + half, bcy + half); ctx.lineTo(bcx + half, bcy + half - corner);
    ctx.stroke();
    // Label
    ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isSolAnchor ? '#ffcc44' : bObj.color;
    ctx.globalAlpha = isSolAnchor ? 0.7 : (isSelected ? 0.8 : 0.5);
    if (!isSolAnchor || isSelected) {
      ctx.fillText('Apparent size: ' + formatAngularSize(angRad), bcx, bcy + half + 14);
    }
    ctx.restore();
  }

  // Light pulse in 3D
  drawLightPulse3D(ts);

  drawVignette();

  // Draw 3D HUD (after vignette so text isn't darkened)
  draw3DHUD(sw, sh);
}

function draw3DHUD(sw, sh) {
  ctx.save();

  // Camera position label
  var posLabel = 'Earth';
  var camFromOrigin = Math.sqrt(cam3d.px * cam3d.px + cam3d.py * cam3d.py + cam3d.pz * cam3d.pz);
  if (camFromOrigin > 1e-6) {
    // Check if near a known object
    var nearest = null, nearDist = Infinity;
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      if (o.wx3d === undefined) continue;
      var dx = cam3d.px - o.wx3d, dy = cam3d.py - o.wy3d, dz = cam3d.pz - o.wz3d;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < nearDist) { nearDist = d; nearest = o; }
    }
    if (nearest && nearDist < 1e-6) {
      posLabel = nearest.name;
    } else if (nearest && nearest.dist > 0 && nearDist < nearest.dist * 0.1) {
      posLabel = nearest.name;
    } else {
      posLabel = 'Custom';
    }
  }

  // ── Top-left camera info ──
  ctx.font = '11px Rajdhani, -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#5a5a7a';

  var tlY = 20;
  ctx.fillText('Viewing from ' + posLabel, 16, tlY);
  tlY += 16;

  var lookRA = cam3d.yaw / DEG2RAD;
  while (lookRA < 0) lookRA += 360;
  while (lookRA >= 360) lookRA -= 360;
  var lookDec = cam3d.pitch / DEG2RAD;
  ctx.fillText('RA ' + lookRA.toFixed(1) + '\u00b0  Dec ' + (lookDec >= 0 ? '+' : '') + lookDec.toFixed(1) + '\u00b0', 16, tlY);
  tlY += 16;

  if (!orbitMode.active) {
    ctx.fillText('FOV: ' + cam3d.fov.toFixed(0) + '\u00b0', 16, tlY);
    tlY += 16;
  }

  // Facing direction / tracking indicator
  if (cam3d.trackTarget) {
    var trackLabel = cam3d.trackTarget;
    for (var tli = 0; tli < cam3dLookTargets.length; tli++) {
      if (cam3dLookTargets[tli].key === cam3d.trackTarget) { trackLabel = cam3dLookTargets[tli].label; break; }
    }
    ctx.fillStyle = '#7a9a7a';
    ctx.fillText('Tracking ' + trackLabel, 16, tlY);
  } else {
    var fwd = { x: Math.cos(cam3d.pitch) * Math.cos(cam3d.yaw),
      y: Math.cos(cam3d.pitch) * Math.sin(cam3d.yaw), z: Math.sin(cam3d.pitch) };
    var bestDot = -1, facingLabel = '';
    for (var ci = 0; ci < cam3dLookTargets.length; ci++) {
      var tgt = getLookTarget(cam3dLookTargets[ci].key);
      if (!tgt) continue;
      var dx2 = tgt.x - cam3d.px, dy2 = tgt.y - cam3d.py, dz2 = tgt.z - cam3d.pz;
      var len = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
      if (len < 0.001) continue;
      var dot = (dx2 * fwd.x + dy2 * fwd.y + dz2 * fwd.z) / len;
      if (dot > bestDot) { bestDot = dot; facingLabel = cam3dLookTargets[ci].label; }
    }
    if (bestDot > 0.85 && facingLabel) {
      ctx.fillStyle = '#6a6a8a';
      ctx.fillText('Facing ' + facingLabel, 16, tlY);
    }
  }

  // ── Bottom-right cinematic HUD ──
  if (state.selected && state.selected.wx3d !== undefined) {
    var sdx = cam3d.px - state.selected.wx3d;
    var sdy = cam3d.py - state.selected.wy3d;
    var sdz = cam3d.pz - state.selected.wz3d;
    var selDist = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);
    var sdAU = selDist / AU_IN_LY;
    var sdLabel;
    if (sdAU < 0.01) sdLabel = (sdAU * 1.496e8).toFixed(0) + ' km';
    else if (selDist < 0.001) sdLabel = sdAU.toFixed(1) + ' AU';
    else if (selDist < 1000) sdLabel = selDist.toFixed(2) + ' ly';
    else if (selDist < 1e6) sdLabel = (selDist / 1000).toFixed(1) + ' kly';
    else sdLabel = (selDist / 1e6).toFixed(1) + ' Mly';
    var hs = hudStyles[hudStyle] || hudStyles.cinematic;
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = hs.distFont;
    ctx.fillStyle = hs.distColor;
    ctx.fillText(sdLabel, sw - 24, sh - 20);
    ctx.font = hs.nameFont;
    ctx.fillStyle = hs.nameColor;
    var distH = parseInt(hs.distFont) || 12;
    ctx.fillText(displayName(state.selected), sw - 24, sh - 20 - distH - 8);
    ctx.restore();
  }

  // Mode label
  ctx.textAlign = 'right';
  ctx.fillStyle = '#3a3a55';
  ctx.fillText(orbitMode.active ? '3D Orbit Mode' : '3D Sky View', sw - 16, 20);

  // Time speed indicator + sim date
  var trY = 36;
  var absMul = Math.abs(simTime.multiplier);
  if (absMul > 1) {
    var tsMul = absMul;
    var tsLabel;
    if (tsMul >= 31557600000000) tsLabel = '1 Myr/s';
    else if (tsMul >= 3155760000000) tsLabel = '100 kyr/s';
    else if (tsMul >= 31557600000) tsLabel = '1 kyr/s';
    else if (tsMul >= 31557600) tsLabel = (tsMul / 31557600).toFixed(0) + ' yr/s';
    else if (tsMul >= 2592000) tsLabel = (tsMul / 2592000).toFixed(0) + ' mo/s';
    else if (tsMul >= 604800) tsLabel = (tsMul / 604800).toFixed(0) + ' wk/s';
    else if (tsMul >= 86400) tsLabel = (tsMul / 86400).toFixed(0) + ' day/s';
    else if (tsMul >= 3600) tsLabel = (tsMul / 3600).toFixed(0) + ' hr/s';
    else tsLabel = tsMul.toFixed(0) + 'x';
    if (simTime.multiplier < 0) tsLabel = '\u25c0 ' + tsLabel;
    ctx.fillStyle = simTime.multiplier < 0 ? '#7a4a3a' : '#7a6a3a';
    ctx.fillText('Time: ' + tsLabel, sw - 16, trY);
    trY += 14;
  }
  // Show current sim date (adaptive format for extreme time scales)
  if (absMul > 1) {
    var simDays = getSimDaysJ2000();
    var ceYear = 2000 + simDays / 365.25;
    var absYear = Math.abs(ceYear);
    var dateStr;
    if (absYear >= 1e6) {
      dateStr = (ceYear / 1e6).toFixed(1) + ' Myr';
    } else if (absYear >= 10000) {
      dateStr = (ceYear / 1000).toFixed(1) + ' kyr';
    } else {
      var curSimMs = simTime.J2000 + simDays * 86400000;
      var simDate = new Date(curSimMs);
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      dateStr = simDate.getUTCFullYear() + ' ' + months[simDate.getUTCMonth()] + ' ' + simDate.getUTCDate();
    }
    ctx.fillStyle = '#5a5a6a';
    ctx.fillText(dateStr, sw - 16, trY);
    trY += 14;
  }
  if (simTime.paused) {
    ctx.fillStyle = '#9a6a5a';
    ctx.fillText('\u23f8 Paused', sw - 16, trY);
    trY += 14;
  }

  // Orbit info
  if (orbitMode.active) {
    var od = orbitMode.orbitDist;
    var odLabel;
    var odAU = od / AU_IN_LY;
    if (odAU < 0.01) odLabel = (odAU * 1.496e8).toFixed(0) + ' km';
    else if (od < 0.001) odLabel = odAU.toFixed(1) + ' AU';
    else if (od < 1000) odLabel = od.toFixed(2) + ' ly';
    else if (od < 1e6) odLabel = (od / 1000).toFixed(1) + ' kly';
    else odLabel = (od / 1e6).toFixed(1) + ' Mly';
    ctx.fillStyle = '#5a7a5a';
    ctx.fillText('Orbiting: ' + orbitMode.focalName, sw - 16, trY);
    ctx.fillText('Distance: ' + odLabel, sw - 16, trY + 14);
    trY += 28;
    if (cam3d.trackTarget) {
      var orbitTrackLabel = cam3d.trackTarget;
      for (var otli = 0; otli < cam3dLookTargets.length; otli++) {
        if (cam3dLookTargets[otli].key === cam3d.trackTarget) { orbitTrackLabel = cam3dLookTargets[otli].label; break; }
      }
      ctx.fillStyle = '#7a9a7a';
      ctx.fillText('Tracking: ' + orbitTrackLabel, sw - 16, trY);
    }
  }

  ctx.restore();
}

// ─── Animation loop ───────────────────────────────────────────────────

var lastFrameTime = 0;
function animationLoop(ts) {
  requestAnimationFrame(animationLoop);

  // Adaptive FPS monitoring — check every 30 frames
  _perfFrameCount++;
  if (ts - _perfLastCheck > 1000) {
    _perfFps = _perfFrameCount * 1000 / (ts - _perfLastCheck);
    _perfFrameCount = 0;
    _perfLastCheck = ts;
    if (_perfFps < 28 && !_perfReduced) {
      _perfReduced = true;
    } else if (_perfFps > 45 && _perfReduced) {
      _perfReduced = false;
    }
  }

  // Guard against corrupted zoom state
  if (!isFinite(state.zoom)) state.zoom = Math.max(0, Math.min(1000, state.zoom || 0));

  // Warp decay
  if (!tourEngine.active && state.warpIntensity > 0.01) {
    state.warpIntensity *= 0.92;
    state.dirty = true;
  }
  if (state.warpIntensity > 0.01) state.dirty = true;

  // Twinkling/ambient: throttle to every other frame when performance is reduced
  if (effects.twinkling || effects.ambientParticles) {
    if (!_perfReduced || (_perfFrameCount & 1) === 0) state.dirty = true;
  }

  // Flow particles always animate when visible
  var vr = getViewRadius();
  if (effects.flowLines && vr >= 40 * MLY && vr <= 500 * MLY) state.dirty = true;

  // Light pulse animation
  if (lightPulse.active) state.dirty = true;

  // 2D follow / 3D camera animation / tracking
  if (state.follow && !state.mode3d) state.dirty = true;
  if (cam3dAnim.active) state.dirty = true;
  if (cam3d.trackTarget && state.mode3d) state.dirty = true;

  if (state.dirty) {
    state.dirty = false;
    try { draw(ts); } catch(e) { console.error('[draw error]', e.message, e.stack); }
  }
  lastFrameTime = ts;
}

// ─── "When this light left" ───────────────────────────────────────────

function getHistoricalEvent(distLy) {
  var yearsAgo = distLy; // 1 ly = light traveling 1 year
  var launchYear = 2026 - yearsAgo;

  // Historical timeline (most recent first for matching)
  var events = [
    [0.002, null], // less than ~17 hours, skip
    [0.01, "this light was already en route when you woke up today"],
    [0.1, "this light left about " + (distLy * 365.25).toFixed(0) + " days ago"],
    [1, "this light left about " + yearsAgo.toFixed(1) + " years ago"],
    [4.3, "the light you see now left before the COVID-19 pandemic"],
    [10, "the light you see now left when " + Math.round(2026 - yearsAgo) + " was a new year"],
    [30, "this light left around " + Math.round(launchYear) + ", when the internet was just emerging"],
    [65, "this light left around " + Math.round(launchYear) + ", during the Space Race era"],
    [150, "this light left around " + Math.round(launchYear) + ", before the American Civil War"],
    [250, "this light left around " + Math.round(launchYear) + ", before the American Revolution"],
    [500, "this light departed around " + Math.round(launchYear) + ", when Columbus sailed"],
    [1000, "this light left around " + Math.round(launchYear) + " AD, during the Viking Age"],
    [2100, "this light left when Rome was still an empire"],
    [5000, "this light left when the Egyptian pyramids were being built"],
    [10000, "this light left at the dawn of agriculture and civilization"],
    [40000, "this light left when Neanderthals still walked the Earth"],
    [200000, "this light left when Homo sapiens first appeared"],
    [2e6, "this light left when the first members of genus Homo appeared"],
    [6e6, "this light left when humans and chimpanzees last shared a common ancestor"],
    [66e6, "this light left when dinosaurs still ruled the Earth"],
    [250e6, "this light left during the Permian period, before the Great Dying"],
    [540e6, "this light left during the Cambrian explosion of complex life"],
    [2e9, "this light left when only single-celled life existed on Earth"],
    [4.5e9, "this light left before the Earth itself had formed"],
    [13.8e9, "this light has been traveling since near the beginning of the universe"]
  ];

  for (var i = 0; i < events.length; i++) {
    if (yearsAgo <= events[i][0]) {
      return events[i][1];
    }
  }
  return "this light has been traveling for " + (yearsAgo / 1e9).toFixed(1) + " billion years";
}

// ─── Light pulse animation ───────────────────────────────────────────

var lightPulse = {
  active: false,
  targetObj: null,
  startTime: 0,
  duration: 0,     // animation duration in ms
  travelTimeLy: 0, // actual light travel time in years
  arrived: false
};

function startLightPulse(obj) {
  if (!obj || obj.dist <= 0) return;

  // In 3D mode, skip zoom-to-fit (camera handles it)
  if (state.mode3d) {
    lightPulse.active = true;
    lightPulse.targetObj = obj;
    lightPulse.startTime = performance.now() + 200;
    lightPulse.travelTimeLy = obj.dist;
    lightPulse.arrived = false;
    var logD = Math.log10(Math.max(obj.dist, 0.0001));
    lightPulse.duration = Math.max(3000, Math.min(8000, 3000 + logD * 600));
    state.dirty = true;
    return;
  }

  // Zoom to a level where both Sun and target are visible on screen
  var vr = getViewRadius();
  var neededVR = obj.dist * 1.5;
  if (vr > neededVR * 3 || vr < neededVR * 0.05) {
    var targetSlider = Math.max(0, Math.min(1000, Math.round(viewRadiusToSlider(neededVR))));
    var startZoom = state.zoom;
    var startPanX = state.panX, startPanY = state.panY;
    var zDuration = 800;
    var zStart = performance.now();
    function animateToFit(t) {
      var zElapsed = t - zStart;
      var zProgress = Math.min(1, zElapsed / zDuration);
      var zEase = easeInOutCubic(zProgress);
      state.zoom = startZoom + (targetSlider - startZoom) * zEase;
      state.panX = startPanX * (1 - zEase);
      state.panY = startPanY * (1 - zEase);
      slider.value = Math.round(state.zoom);
      state.dirty = true;
      if (zProgress < 1) requestAnimationFrame(animateToFit);
    }
    requestAnimationFrame(animateToFit);
  }

  lightPulse.active = true;
  lightPulse.targetObj = obj;
  lightPulse.startTime = performance.now() + 400;
  lightPulse.travelTimeLy = obj.dist;
  lightPulse.arrived = false;
  // Scale animation: min 3s, max 8s, log-scaled by distance
  var logDist = Math.log10(Math.max(obj.dist, 0.0001));
  lightPulse.duration = Math.max(3000, Math.min(8000, 3000 + logDist * 600));
  state.dirty = true;
}

function drawLightPulse(ts) {
  if (!lightPulse.active) return;
  var elapsed = ts - lightPulse.startTime;
  var progress = Math.min(1, elapsed / lightPulse.duration);
  var obj = lightPulse.targetObj;
  if (!obj) { lightPulse.active = false; return; }

  var sunSp = worldToScreen(0, 0);
  var objSp = worldToScreen(obj.x, obj.y);

  // Pulse position along the path
  var ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
  var px = sunSp.x + (objSp.x - sunSp.x) * ease;
  var py = sunSp.y + (objSp.y - sunSp.y) * ease;

  // Draw the light beam trail
  ctx.save();
  var trailGrad = ctx.createLinearGradient(sunSp.x, sunSp.y, px, py);
  trailGrad.addColorStop(0, 'rgba(255, 221, 68, 0)');
  trailGrad.addColorStop(Math.max(0, ease - 0.3), 'rgba(255, 221, 68, 0.05)');
  trailGrad.addColorStop(1, 'rgba(255, 221, 68, 0.2)');
  ctx.strokeStyle = trailGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sunSp.x, sunSp.y);
  ctx.lineTo(px, py);
  ctx.stroke();

  // Draw the pulse dot
  var pulseR = 4 + Math.sin(elapsed * 0.008) * 1.5;
  var pg = ctx.createRadialGradient(px, py, 0, px, py, pulseR * 3);
  pg.addColorStop(0, 'rgba(255, 238, 100, 0.9)');
  pg.addColorStop(0.3, 'rgba(255, 221, 68, 0.4)');
  pg.addColorStop(1, 'rgba(255, 221, 68, 0)');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(px, py, pulseR * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffee66';
  ctx.beginPath();
  ctx.arc(px, py, pulseR, 0, Math.PI * 2);
  ctx.fill();

  // Draw elapsed time counter with opaque background
  var travelYears = lightPulse.travelTimeLy * ease;
  var timeStr = formatLightTravelElapsed(travelYears);
  var sw = W / dpr;
  var labelText = 'Light travel time to ' + obj.name;
  ctx.font = 'bold 12px Space Mono, SF Mono, Menlo, monospace';
  var timeW = ctx.measureText(timeStr).width;
  ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
  var nameW = ctx.measureText(labelText).width;
  var boxW = Math.max(timeW, nameW) + 24;
  var boxH = 36;
  var boxX = sw / 2 - boxW / 2;
  var boxY = 52;
  ctx.fillStyle = 'rgba(10, 10, 18, 0.85)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 221, 68, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.stroke();
  ctx.font = 'bold 12px Space Mono, SF Mono, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffdd44';
  ctx.fillText(timeStr, sw / 2, boxY + 15);
  ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#8888aa';
  ctx.fillText(labelText, sw / 2, boxY + 29);

  // Arrival flash
  if (progress >= 1 && !lightPulse.arrived) {
    lightPulse.arrived = true;
    frameFlash.active = true;
    frameFlash.x = obj.x;
    frameFlash.y = obj.y;
    frameFlash.startTime = ts;
    frameFlash.color = '#ffee66';
  }

  // Auto-stop after arrival + 2s
  if (progress >= 1 && elapsed > lightPulse.duration + 2000) {
    lightPulse.active = false;
  }

  ctx.restore();
  state.dirty = true;
}

function drawLightPulse3D(ts) {
  if (!lightPulse.active) return;
  var elapsed = ts - lightPulse.startTime;
  var progress = Math.min(1, elapsed / lightPulse.duration);
  var obj = lightPulse.targetObj;
  if (!obj) { lightPulse.active = false; return; }

  // Project Sun (origin) and target
  var sunSp = worldToScreen3D(0, 0, 0);
  var objSp = worldToScreen3D(obj.wx3d, obj.wy3d, obj.wz3d);

  var ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

  // Interpolate pulse position in 3D world space, then project
  var pw = {
    x: (1 - ease) * 0 + ease * obj.wx3d,
    y: (1 - ease) * 0 + ease * obj.wy3d,
    z: (1 - ease) * 0 + ease * obj.wz3d
  };
  var pulseSp = worldToScreen3D(pw.x, pw.y, pw.z);

  ctx.save();

  // Draw trail from Sun to pulse if both visible
  if (sunSp && pulseSp) {
    var trailGrad = ctx.createLinearGradient(sunSp.x, sunSp.y, pulseSp.x, pulseSp.y);
    trailGrad.addColorStop(0, 'rgba(255, 221, 68, 0)');
    trailGrad.addColorStop(Math.max(0, ease - 0.3), 'rgba(255, 221, 68, 0.05)');
    trailGrad.addColorStop(1, 'rgba(255, 221, 68, 0.2)');
    ctx.strokeStyle = trailGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sunSp.x, sunSp.y);
    ctx.lineTo(pulseSp.x, pulseSp.y);
    ctx.stroke();
  }

  // Draw pulse dot
  if (pulseSp) {
    var pulseR = 4 + Math.sin(elapsed * 0.008) * 1.5;
    var pg = ctx.createRadialGradient(pulseSp.x, pulseSp.y, 0, pulseSp.x, pulseSp.y, pulseR * 3);
    pg.addColorStop(0, 'rgba(255, 238, 100, 0.9)');
    pg.addColorStop(0.3, 'rgba(255, 221, 68, 0.4)');
    pg.addColorStop(1, 'rgba(255, 221, 68, 0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(pulseSp.x, pulseSp.y, pulseR * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffee66';
    ctx.beginPath();
    ctx.arc(pulseSp.x, pulseSp.y, pulseR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Info box
  var sw = W / dpr;
  var travelYears = lightPulse.travelTimeLy * ease;
  var timeStr = formatLightTravelElapsed(travelYears);
  var labelText = 'Light travel time to ' + obj.name;
  ctx.font = 'bold 12px Space Mono, SF Mono, Menlo, monospace';
  var timeW = ctx.measureText(timeStr).width;
  ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
  var nameW = ctx.measureText(labelText).width;
  var boxW = Math.max(timeW, nameW) + 24;
  var boxH = 36;
  var boxX = sw / 2 - boxW / 2;
  var boxY = 52;
  ctx.fillStyle = 'rgba(10, 10, 18, 0.85)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 221, 68, 0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 6);
  ctx.stroke();
  ctx.font = 'bold 12px Space Mono, SF Mono, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffdd44';
  ctx.fillText(timeStr, sw / 2, boxY + 15);
  ctx.font = '10px Rajdhani, -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#8888aa';
  ctx.fillText(labelText, sw / 2, boxY + 29);

  // Arrival
  if (progress >= 1 && !lightPulse.arrived) {
    lightPulse.arrived = true;
  }
  if (progress >= 1 && elapsed > lightPulse.duration + 2000) {
    lightPulse.active = false;
  }

  ctx.restore();
  state.dirty = true;
}

function formatLightTravelElapsed(years) {
  var seconds = years * 365.25 * 24 * 3600;
  if (seconds < 60) return seconds.toFixed(1) + 's';
  var minutes = seconds / 60;
  if (minutes < 60) return minutes.toFixed(1) + ' min';
  var hours = minutes / 60;
  if (hours < 24) return hours.toFixed(1) + ' hr';
  var days = hours / 24;
  if (days < 365.25) return days.toFixed(0) + ' days';
  if (years < 1000) return years.toFixed(1) + ' years';
  if (years < 1e6) return (years / 1000).toFixed(1) + 'k years';
  if (years < 1e9) return (years / 1e6).toFixed(1) + 'M years';
  return (years / 1e9).toFixed(1) + 'B years';
}

// ─── Info panel ───────────────────────────────────────────────────────

function showInfo(obj) {
  var infoPanel = document.getElementById('info-panel');
  infoPanel.classList.remove('hidden');
  document.getElementById('info-name').textContent = displayName(obj);
  document.getElementById('info-type').textContent = obj.type;
  var body = document.getElementById('info-body');
  while (body.firstChild) body.removeChild(body.firstChild);

  var p = document.createElement('p');
  p.textContent = obj.desc;
  body.appendChild(p);

  if (obj.facts) obj.facts.forEach(function(pair) {
    var row = document.createElement('div');
    row.className = 'info-stat';
    var l = document.createElement('span');
    l.className = 'label';
    l.textContent = pair[0];
    var v = document.createElement('span');
    v.className = 'value';
    v.textContent = pair[1];
    row.appendChild(l);
    row.appendChild(v);
    body.appendChild(row);
  });

  if (obj.dist > 0) {
    var c = document.createElement('p');
    c.style.cssText = 'margin-top:16px;font-size:11px;color:#7a7a96';
    if (obj.dist < 0.01) c.textContent = "Light takes " + (obj.dist * 365.25 * 24 * 60).toFixed(1) + " minutes to reach us.";
    else if (obj.dist < 100) c.textContent = "If the Sun were a grain of sand, " + obj.name + " would be ~" + (obj.dist * 4.8).toFixed(0) + " miles away.";
    else if (obj.dist < 1e6) c.textContent = (obj.dist / 4.24).toFixed(0) + "x farther than Proxima Centauri.";
    else c.textContent = "Light from here left " + (obj.dist / 1e6).toFixed(1) + " million years ago.";
    body.appendChild(c);

    // "When this light left" historical context
    var histEvent = getHistoricalEvent(obj.dist);
    if (histEvent) {
      var hDiv = document.createElement('div');
      hDiv.style.cssText = 'margin-top:12px;padding:10px 12px;background:rgba(255,255,255,0.02);border-left:2px solid #3a4a6a;border-radius:0 4px 4px 0';
      var hLabel = document.createElement('div');
      hLabel.style.cssText = 'font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#7a8a9a;margin-bottom:4px';
      hLabel.textContent = 'When this light left';
      var hText = document.createElement('div');
      hText.style.cssText = 'font-size:12px;color:#9898b8;line-height:1.5';
      hText.textContent = histEvent;
      hDiv.appendChild(hLabel);
      hDiv.appendChild(hText);
      body.appendChild(hDiv);
    }

    // Light pulse button
    var pulseBtn = document.createElement('button');
    pulseBtn.style.cssText = 'margin-top:12px;padding:6px 14px;background:#16162a;border:1px solid #2a3a4a;border-radius:4px;color:#88aabb;font-size:11px;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:6px';
    var pulseIcon = document.createElement('span');
    pulseIcon.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;background:#ffdd44;box-shadow:0 0 6px #ffdd44';
    pulseBtn.appendChild(pulseIcon);
    var pulseTxt = document.createElement('span');
    pulseTxt.textContent = 'Send light pulse from Sun';
    pulseBtn.appendChild(pulseTxt);
    pulseBtn.addEventListener('mouseover', function() { this.style.background = '#1e2a3a'; this.style.color = '#aaccdd'; });
    pulseBtn.addEventListener('mouseout', function() { this.style.background = '#16162a'; this.style.color = '#88aabb'; });
    pulseBtn.addEventListener('click', function() { startLightPulse(obj); });
    body.appendChild(pulseBtn);
  }

  // Gallery: large stacked images with detailed captions
  if (obj.gallery && obj.gallery.length) {
    var galDiv = document.createElement('div');
    galDiv.style.cssText = 'margin-top:20px;border-top:1px solid #1e1e30;padding-top:16px';
    for (var gi = 0; gi < obj.gallery.length; gi++) {
      (function(item) {
        var card = document.createElement('div');
        card.style.cssText = 'margin-bottom:16px';
        var img = document.createElement('img');
        img.src = item.src;
        img.alt = item.title;
        img.style.cssText = 'width:100%;border-radius:6px;border:1px solid #2a2a44;display:block;cursor:pointer';
        img.addEventListener('click', function(e) {
          e.stopPropagation();
          var overlay = document.createElement('div');
          overlay.className = 'img-lightbox';
          var fullImg = document.createElement('img');
          fullImg.src = item.src;
          fullImg.alt = item.title;
          overlay.appendChild(fullImg);
          var lbCap = document.createElement('div');
          lbCap.className = 'img-lightbox-caption';
          lbCap.textContent = item.title;
          overlay.appendChild(lbCap);
          overlay.addEventListener('click', function() { document.body.removeChild(overlay); });
          document.body.appendChild(overlay);
        });
        card.appendChild(img);
        var title = document.createElement('div');
        title.style.cssText = 'font-size:12px;font-weight:600;color:#b8c8e0;margin-top:6px';
        title.textContent = item.title;
        card.appendChild(title);
        var txt = document.createElement('div');
        txt.style.cssText = 'font-size:11px;line-height:1.6;color:#8898b0;margin-top:4px';
        txt.textContent = item.text;
        card.appendChild(txt);
        var cred = document.createElement('div');
        cred.style.cssText = 'font-size:9px;color:#5a5a78;font-style:italic;margin-top:2px';
        cred.textContent = 'NASA/ESA/CSA/STScI';
        card.appendChild(cred);
        galDiv.appendChild(card);
      })(obj.gallery[gi]);
    }
    body.appendChild(galDiv);
  }
}

function showRegionInfo(r) {
  var infoPanel = document.getElementById('info-panel');
  infoPanel.classList.remove('hidden');
  document.getElementById('info-name').textContent = r.name;
  document.getElementById('info-type').textContent = 'STRUCTURE';
  var body = document.getElementById('info-body');
  while (body.firstChild) body.removeChild(body.firstChild);
  if (r.desc) {
    var p = document.createElement('p');
    p.textContent = r.desc;
    body.appendChild(p);
  }
}

// ─── UI updates ───────────────────────────────────────────────────────

var _lastScaleLabel = '', _lastScaleTime = '', _lastZoomLabel = '';
function updateUI() {
  var vr = getViewRadius();
  var sw = W / dpr, sh = H / dpr;
  var scaleBarLy = (120 / Math.min(sw, sh)) * 2 * vr;
  var newScale = formatViewRadius(scaleBarLy);
  var newTime = lightTravelTime(scaleBarLy);
  var newZoom = "\u00b1" + formatViewRadius(vr);
  // Guard against no-op writes — aria-live elements fire on every textContent set
  if (newScale !== _lastScaleLabel) { document.getElementById('scale-label').textContent = newScale; _lastScaleLabel = newScale; }
  if (newTime !== _lastScaleTime) { document.getElementById('scale-time').textContent = newTime; _lastScaleTime = newTime; }
  if (newZoom !== _lastZoomLabel) { document.getElementById('zoom-label').textContent = newZoom; _lastZoomLabel = newZoom; }

  if (!_presetBtns) _presetBtns = document.querySelectorAll('.preset-btn');
  _presetBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.preset === state.activePreset);
  });

}

// ─── Tour engine ──────────────────────────────────────────────────────

var tourEngine = {
  active: false,
  paused: false,
  narrationCollapsed: false,
  transitionSpeed: 1,
  autoAdvance: true,
  tourId: null,
  stepIndex: -1,
  dwellTimeout: null,
  zoomAnimId: null,
  timerAnimId: null,
  transitTimeout: null,
  dwellStart: 0,
  dwellDuration: 0,
  dwellElapsed: 0,
  startedAt: 0,
  userDwellMs: 0,

  start: function(id) {
    dismissWelcome();
    orbitMode.active = false;
    if (this.active) this.stop();
    if (!tourDefs[id]) return;
    this.active = true;
    this.paused = false;
    this.tourId = id;
    this.stepIndex = -1;
    this.startedAt = performance.now();
    var tourBtn = document.getElementById('tour-btn');
    tourBtn.textContent = tourDefs[id].name;
    tourBtn.classList.add('running');
    document.getElementById('hint').style.opacity = '0';
    closeTourDropdown();
    this.nextStep();
  },

  stop: function() {
    this.active = false;
    this.paused = false;
    this.tourId = null;
    this.stepIndex = -1;
    if (this.dwellTimeout) { clearTimeout(this.dwellTimeout); this.dwellTimeout = null; }
    if (this.transitTimeout) { clearTimeout(this.transitTimeout); this.transitTimeout = null; }
    if (this.zoomAnimId) { cancelAnimationFrame(this.zoomAnimId); this.zoomAnimId = null; }
    if (this.timerAnimId) { cancelAnimationFrame(this.timerAnimId); this.timerAnimId = null; }
    var tf = document.getElementById('tour-timer-fill'); tf.style.width = '0%'; tf.classList.remove('sparking');
    resetParallax();
    if (state.mode3d) toggle3D();
    state.warpIntensity = 0;
    var tourBtn = document.getElementById('tour-btn');
    tourBtn.textContent = 'Tours \u25be';
    tourBtn.classList.remove('running');
    var narrEl = document.getElementById('narration');
    narrEl.classList.remove('visible');
    narrEl.classList.remove('flipped');
    narrEl.classList.remove('collapsed');
    this.narrationCollapsed = false;
    document.getElementById('narr-collapse-btn').textContent = '\u25BE';
    document.getElementById('narr-pause').textContent = 'Pause';
    state.dirty = true;
  },

  togglePause: function() {
    if (!this.active) return;
    this.paused = !this.paused;
    var fillEl = document.getElementById('tour-timer-fill');
    document.getElementById('narr-pause').textContent = this.paused ? 'Resume' : 'Pause';
    if (this.paused) {
      // Freeze timer
      this.dwellElapsed += performance.now() - this.dwellStart;
      if (this.dwellTimeout) { clearTimeout(this.dwellTimeout); this.dwellTimeout = null; }
      if (this.timerAnimId) { cancelAnimationFrame(this.timerAnimId); this.timerAnimId = null; }
      fillEl.classList.add('paused');
    } else {
      fillEl.classList.remove('paused');
      if (this.dwellDuration > 0) {
        var remaining = Math.max(0, this.dwellDuration - this.dwellElapsed);
        this.dwellStart = performance.now();
        this.startTimerBar();
        if (this.autoAdvance) {
          var self = this;
          this.dwellTimeout = setTimeout(function() {
            self.dwellTimeout = null;
            self.nextStep();
          }, remaining);
        }
      } else if (this.autoAdvance) {
        this.nextStep();
      }
    }
  },

  goToStep: function(idx) {
    if (!this.active) return;
    var steps = tourDefs[this.tourId].steps;
    if (idx < 0 || idx >= steps.length) return;
    if (this.dwellTimeout) { clearTimeout(this.dwellTimeout); this.dwellTimeout = null; }
    if (this.transitTimeout) { clearTimeout(this.transitTimeout); this.transitTimeout = null; }
    if (this.zoomAnimId) { cancelAnimationFrame(this.zoomAnimId); this.zoomAnimId = null; }
    if (this.timerAnimId) { cancelAnimationFrame(this.timerAnimId); this.timerAnimId = null; }
    var tf = document.getElementById('tour-timer-fill'); tf.style.width = '0%'; tf.classList.remove('sparking');
    this.stepIndex = idx - 1;
    this.nextStep();
  },

  startTimerBar: function() {
    var self = this;
    var fillEl = document.getElementById('tour-timer-fill');
    if (this.timerAnimId) { cancelAnimationFrame(this.timerAnimId); this.timerAnimId = null; }
    fillEl.classList.add('sparking');
    function tick() {
      if (!self.active || self.paused) return;
      var elapsed = self.dwellElapsed + (performance.now() - self.dwellStart);
      var pct = Math.min(100, (elapsed / self.dwellDuration) * 100);
      fillEl.style.width = pct + '%';
      // Spark flicker — vary the glow intensity
      var flicker = 0.6 + 0.4 * Math.sin(performance.now() * 0.008);
      fillEl.style.setProperty('--spark-opacity', flicker);
      if (pct < 100) {
        self.timerAnimId = requestAnimationFrame(tick);
      } else {
        fillEl.classList.remove('sparking');
      }
    }
    this.timerAnimId = requestAnimationFrame(tick);
  },

  resolveTarget: function(name) {
    if (!name) return null;
    return findObject(name);
  },

  nextStep: function() {
    if (!this.active) return;
    if (this.dwellTimeout) { clearTimeout(this.dwellTimeout); this.dwellTimeout = null; }
    if (this.transitTimeout) { clearTimeout(this.transitTimeout); this.transitTimeout = null; }
    if (this.zoomAnimId) { cancelAnimationFrame(this.zoomAnimId); this.zoomAnimId = null; }
    if (this.timerAnimId) { cancelAnimationFrame(this.timerAnimId); this.timerAnimId = null; }
    var tf = document.getElementById('tour-timer-fill'); tf.style.width = '0%'; tf.classList.remove('sparking');
    resetParallax();

    this.stepIndex++;
    var steps = tourDefs[this.tourId].steps;
    if (this.stepIndex >= steps.length) { this.stop(); return; }

    var wp = steps[this.stepIndex];
    var narrationEl = document.getElementById('narration');
    narrationEl.classList.remove('visible');

    // Handle 3D sky view steps
    if (wp.sky3d) {
      var self = this;
      // Switch to 3D mode if not already
      if (!state.mode3d) toggle3D();
      // Fly to viewpoint
      var vpKey = wp.sky3d.viewFrom || 'earth';
      if (!cam3dPresets[vpKey]) {
        // Dynamic viewpoint from object name
        var vpObj = this.resolveTarget(wp.sky3d.viewFrom);
        if (vpObj) {
          cam3dPresets[vpKey] = { px: vpObj.wx3d, py: vpObj.wy3d, pz: vpObj.wz3d,
            yaw: 83 * DEG2RAD, pitch: -1 * DEG2RAD, fov: 60, label: vpObj.name,
            physRadius: vpObj.physRadius || 0, category: vpObj.category };
        }
      }
      var lookKey = wp.sky3d.lookAt || null;
      // Ensure look target exists
      if (lookKey && lookKey.indexOf(':') < 0) {
        var ltExists = false;
        for (var lti = 0; lti < cam3dLookTargets.length; lti++) {
          if (cam3dLookTargets[lti].key === lookKey) { ltExists = true; break; }
        }
        if (!ltExists) {
          // Try as object name
          var ltObj = this.resolveTarget(lookKey);
          if (ltObj) {
            cam3dLookTargets.push({ key: lookKey, label: ltObj.name, type: 'object', obj: ltObj.name });
          }
        }
      }

      self.transitTimeout = setTimeout(function() {
        self.transitTimeout = null;
        if (!self.active) return;

        // Over-the-shoulder camera: object in bottom-left, constellation fills view
        var vpPreset = cam3dPresets[vpKey];
        if (vpPreset && lookKey) {
          var lookPos = getLookTarget(lookKey);
          if (lookPos) {
            var vx = vpPreset.px, vy = vpPreset.py, vz = vpPreset.pz;
            // Forward: from star toward constellation
            var fwX = lookPos.x - vx, fwY = lookPos.y - vy, fwZ = lookPos.z - vz;
            var fwLen = Math.sqrt(fwX * fwX + fwY * fwY + fwZ * fwZ);
            if (fwLen > 1e-12) {
              fwX /= fwLen; fwY /= fwLen; fwZ /= fwLen;
              // Right vector (cross forward with world up [0,0,1])
              var rxR = fwY, ryR = -fwX, rzR = 0;
              var rLen = Math.sqrt(rxR * rxR + ryR * ryR);
              if (rLen < 1e-6) { rxR = 1; ryR = 0; rLen = 1; }
              rxR /= rLen; ryR /= rLen;
              // Up vector (cross right with forward)
              var uxR = ryR * fwZ - rzR * fwY;
              var uyR = rzR * fwX - rxR * fwZ;
              var uzR = rxR * fwY - ryR * fwX;
              // 50k km orbit above viewpoint object's surface, slight offset to frame constellation
              // rxR/ryR is actually LEFT in this coord system, so negate for rightward offset
              var back = standardOrbitDist(vpPreset);
              var side = back * 0.15;
              var up = back * 0.1;
              var camX = vx - fwX * back - rxR * side + uxR * up;
              var camY = vy - fwY * back - ryR * side + uyR * up;
              var camZ = vz - fwZ * back - rzR * 0 + uzR * up;
              var la = computeLookAngles(camX, camY, camZ, lookPos.x, lookPos.y, lookPos.z);
              cam3dAnim.from = { px: cam3d.px, py: cam3d.py, pz: cam3d.pz,
                yaw: cam3d.yaw, pitch: cam3d.pitch, fov: cam3d.fov };
              cam3dAnim.to = { px: camX, py: camY, pz: camZ,
                yaw: la.yaw, pitch: la.pitch, fov: 60 };
              cam3dAnim.duration = 1500 / self.transitionSpeed;
              cam3dAnim.startTime = performance.now();
              cam3dAnim.active = true;
              // Enter orbit mode around the viewFrom object (star, planet, etc.)
              var orbDx = camX - vx, orbDy = camY - vy, orbDz = camZ - vz;
              var orbDist = Math.sqrt(orbDx * orbDx + orbDy * orbDy + orbDz * orbDz);
              orbitMode.focalX = vx; orbitMode.focalY = vy; orbitMode.focalZ = vz;
              orbitMode.focalName = vpPreset.label || vpKey;
              orbitMode.orbitDist = orbDist;
              orbitMode.orbitYaw = Math.atan2(orbDy, orbDx);
              orbitMode.orbitPitch = Math.atan2(orbDz, Math.sqrt(orbDx * orbDx + orbDy * orbDy));
              orbitMode.active = true;
              orbitMode.focalAnim.active = false;
              state.dirty = true;
            } else {
              flyCamera(vpKey, 1500, lookKey);
            }
          } else {
            flyCamera(vpKey, 1500, lookKey);
          }
        } else {
          flyCamera(vpKey, 1500, lookKey);
        }

        setTimeout(function() {
          if (!self.active) return;
          self.showNarration(wp);
          self.dwellDuration = self.userDwellMs > 0 ? self.userDwellMs : wp.dwell;
          self.dwellElapsed = 0;
          self.dwellStart = performance.now();
          self.startTimerBar();
          if (!self.paused && self.autoAdvance) {
            self.dwellTimeout = setTimeout(function() {
              self.dwellTimeout = null;
              self.nextStep();
            }, self.dwellDuration);
          }
        }, 1800 / self.transitionSpeed);
      }, 300 / self.transitionSpeed);
      return;
    }

    // Exit 3D if we were in it for a previous step
    if (state.mode3d) toggle3D();

    // Resolve target object for panning
    var tObj = this.resolveTarget(wp.target);
    var targetPanX = tObj ? tObj.x : 0;
    var targetPanY = tObj ? tObj.y : 0;
    var targetSlider = Math.round(viewRadiusToSlider(wp.vr));

    // Check if we should do a two-phase transit (zoom out, then in)
    var prevStep = this.stepIndex > 0 ? steps[this.stepIndex - 1] : null;
    var prevObj = prevStep ? this.resolveTarget(prevStep.target) : null;
    var doTransit = tObj && prevObj && tObj.name !== prevObj.name;

    var self = this;

    if (doTransit) {
      // Phase 1: zoom out to show both stars, centered between them
      var midX = (prevObj.x + tObj.x) / 2;
      var midY = (prevObj.y + tObj.y) / 2;
      var separation = Math.sqrt(Math.pow(tObj.x - prevObj.x, 2) + Math.pow(tObj.y - prevObj.y, 2));
      var transitVR = Math.max(separation * 0.8, wp.vr * 1.5, prevStep.vr * 1.5);
      var transitSlider = Math.round(viewRadiusToSlider(transitVR));

      var startZoom1, startPanX1, startPanY1, zoomDist1, dur1, startTime1;

      function animateOut(t) {
        if (!self.active) return;
        if (!startTime1) {
          startZoom1 = state.zoom;
          startPanX1 = state.panX;
          startPanY1 = state.panY;
          zoomDist1 = Math.abs(transitSlider - startZoom1);
          dur1 = Math.max(800, Math.min(2000, zoomDist1 * 3)) / self.transitionSpeed;
          startTime1 = t;
        }
        var progress = Math.min(1, (t - startTime1) / dur1);
        var ease = easeInOutCubic(progress);
        state.zoom = startZoom1 + (transitSlider - startZoom1) * ease;
        state.panX = startPanX1 + (midX - startPanX1) * ease;
        state.panY = startPanY1 + (midY - startPanY1) * ease;
        slider.value = Math.round(state.zoom);
        updateRecenterBtn();
        state.warpIntensity = Math.pow(Math.sin(progress * Math.PI), 2) * Math.min(0.6, zoomDist1 / 300);
        state.dirty = true;
        if (progress < 1) {
          self.zoomAnimId = requestAnimationFrame(animateOut);
        } else {
          self.zoomAnimId = null;
          // Brief pause at wide view, then phase 2
          self.transitTimeout = setTimeout(function() {
            self.transitTimeout = null;
            if (!self.active) return;
            self.animateToTarget(wp, targetPanX, targetPanY, targetSlider);
          }, 600 / self.transitionSpeed);
        }
      }

      self.transitTimeout = setTimeout(function() {
        self.transitTimeout = null;
        if (!self.active) return;
        self.zoomAnimId = requestAnimationFrame(animateOut);
      }, 400 / self.transitionSpeed);
    } else {
      // Simple single-phase animation (first step, or no target)
      self.transitTimeout = setTimeout(function() {
        self.transitTimeout = null;
        if (!self.active) return;
        self.animateToTarget(wp, targetPanX, targetPanY, targetSlider);
      }, (self.stepIndex === 0 ? 200 : 600) / self.transitionSpeed);
    }
  },

  animateToTarget: function(wp, targetPanX, targetPanY, targetSlider) {
    var self = this;
    var startZoom = state.zoom;
    var startPanX = state.panX, startPanY = state.panY;
    var zoomDist = Math.abs(targetSlider - startZoom);
    var duration = Math.max(1200, Math.min(3000, zoomDist * 4)) / this.transitionSpeed;
    var startTime = performance.now();

    function animateZoom(t) {
      if (!self.active) return;
      var elapsed = t - startTime;
      var progress = Math.min(1, elapsed / duration);
      var ease = easeInOutCubic(progress);

      state.zoom = startZoom + (targetSlider - startZoom) * ease;
      state.panX = startPanX + (targetPanX - startPanX) * ease;
      state.panY = startPanY + (targetPanY - startPanY) * ease;
      slider.value = Math.round(state.zoom);
      updateRecenterBtn();

      state.warpIntensity = Math.pow(Math.sin(progress * Math.PI), 2) * Math.min(1, zoomDist / 200);
      state.dirty = true;

      if (progress < 1) {
        self.zoomAnimId = requestAnimationFrame(animateZoom);
      } else {
        self.zoomAnimId = null;
        self.showNarration(wp);
        self.dwellDuration = self.userDwellMs > 0 ? self.userDwellMs : wp.dwell;
        self.dwellElapsed = 0;
        self.dwellStart = performance.now();
        self.startTimerBar();
        if (wp.parallax) startParallax(wp.parallax);
        if (!self.paused && self.autoAdvance) {
          self.dwellTimeout = setTimeout(function() {
            self.dwellTimeout = null;
            self.nextStep();
          }, self.dwellDuration);
        }
      }
    }

    self.zoomAnimId = requestAnimationFrame(animateZoom);
  },

  prevStep: function() {
    if (!this.active) return;
    var target = Math.max(0, this.stepIndex - 1);
    if (this.dwellTimeout) { clearTimeout(this.dwellTimeout); this.dwellTimeout = null; }
    if (this.transitTimeout) { clearTimeout(this.transitTimeout); this.transitTimeout = null; }
    if (this.zoomAnimId) { cancelAnimationFrame(this.zoomAnimId); this.zoomAnimId = null; }
    if (this.timerAnimId) { cancelAnimationFrame(this.timerAnimId); this.timerAnimId = null; }
    var tf = document.getElementById('tour-timer-fill'); tf.style.width = '0%'; tf.classList.remove('sparking');
    this.stepIndex = target - 1;
    this.nextStep();
  },

  showNarration: function(wp) {
    if (!this.active) return;
    var steps = tourDefs[this.tourId].steps;
    var stepNum = this.stepIndex + 1;
    var total = steps.length;

    document.getElementById('narr-step').textContent = stepNum + " of " + total;
    document.getElementById('narr-title').textContent = wp.title;
    document.getElementById('narr-body').textContent = wp.body;
    document.getElementById('narr-scale').textContent = wp.scale;

    var dotsEl = document.getElementById('tour-progress');
    while (dotsEl.firstChild) dotsEl.removeChild(dotsEl.firstChild);
    for (var i = 0; i < total; i++) {
      var dot = document.createElement('div');
      dot.className = 'tour-dot';
      if (i === this.stepIndex) dot.classList.add('active');
      else if (i < this.stepIndex) dot.classList.add('visited');
      (function(idx) {
        dot.addEventListener('click', function() { tourEngine.goToStep(idx); });
      })(i);
      dotsEl.appendChild(dot);
    }

    var narrEl = document.getElementById('narration');
    narrEl.classList.remove('flipped');
    narrEl.classList.add('visible');
    narrEl.classList.toggle('collapsed', this.narrationCollapsed);
    var dwellSec = Math.round((this.userDwellMs > 0 ? this.userDwellMs : wp.dwell) / 1000);
    document.getElementById('narr-dwell-slider').value = dwellSec;
    document.getElementById('narr-dwell-input').value = dwellSec;
  }
};

// ─── Tour dropdown ────────────────────────────────────────────────────

var tourIds = ['paleblue', 'starlovers', 'extreme', 'lifecycle', 'ladder', 'constellations', 'exoworlds', 'monsters'];

function buildTourDropdown() {
  var dd = document.getElementById('tour-dropdown');
  while (dd.firstChild) dd.removeChild(dd.firstChild);
  tourIds.forEach(function(id, idx) {
    var item = document.createElement('div');
    item.className = 'tour-dropdown-item';
    var nameSpan = document.createElement('div');
    nameSpan.className = 'tour-item-name';
    nameSpan.textContent = tourDefs[id].name;
    var hint = document.createElement('span');
    hint.className = 'tour-key-hint';
    hint.textContent = String(idx + 1);
    nameSpan.appendChild(hint);
    var descSpan = document.createElement('div');
    descSpan.className = 'tour-item-desc';
    descSpan.textContent = tourDefs[id].desc;
    item.appendChild(nameSpan);
    item.appendChild(descSpan);
    item.addEventListener('click', function(e) {
      e.stopPropagation();
      tourEngine.start(id);
    });
    dd.appendChild(item);
  });
}

function closeTourDropdown() {
  document.getElementById('tour-dropdown').classList.remove('open');
}

document.getElementById('tour-btn').addEventListener('click', function(e) {
  e.stopPropagation();
  if (tourEngine.active) {
    tourEngine.stop();
    return;
  }
  document.getElementById('tour-dropdown').classList.toggle('open');
});

document.addEventListener('click', function() { closeTourDropdown(); });

// ─── Narration controls ──────────────────────────────────────────────

document.getElementById('narr-prev').addEventListener('click', function() { tourEngine.prevStep(); });
document.getElementById('narr-pause').addEventListener('click', function() { tourEngine.togglePause(); });
document.getElementById('narr-next').addEventListener('click', function() { tourEngine.nextStep(); });

// ─── Narration card flip & dwell settings ─────────────────────────────

(function() {
  var narration = document.getElementById('narration');
  var settingsBtn = document.getElementById('narr-settings-btn');
  var collapseBtn = document.getElementById('narr-collapse-btn');
  var dwellSlider = document.getElementById('narr-dwell-slider');
  var dwellInput = document.getElementById('narr-dwell-input');

  settingsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    narration.classList.toggle('flipped');
  });

  collapseBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    tourEngine.narrationCollapsed = !tourEngine.narrationCollapsed;
    narration.classList.toggle('collapsed', tourEngine.narrationCollapsed);
    collapseBtn.textContent = tourEngine.narrationCollapsed ? '\u25B8' : '\u25BE';
  });

  function syncDwell(seconds) {
    seconds = Math.max(3, Math.min(30, Math.round(seconds)));
    dwellSlider.value = seconds;
    dwellInput.value = seconds;
    tourEngine.userDwellMs = seconds * 1000;
    if (tourEngine.active && !tourEngine.paused && tourEngine.dwellDuration > 0) {
      var elapsed = tourEngine.dwellElapsed + (performance.now() - tourEngine.dwellStart);
      var newDwell = seconds * 1000;
      tourEngine.dwellDuration = newDwell;
      if (tourEngine.dwellTimeout) {
        clearTimeout(tourEngine.dwellTimeout);
        tourEngine.dwellTimeout = null;
      }
      var remaining = Math.max(0, newDwell - elapsed);
      if (remaining > 0) {
        tourEngine.dwellTimeout = setTimeout(function() {
          tourEngine.dwellTimeout = null;
          tourEngine.nextStep();
        }, remaining);
      } else {
        tourEngine.nextStep();
      }
    }
  }

  dwellSlider.addEventListener('input', function() { syncDwell(Number(this.value)); });
  dwellInput.addEventListener('change', function() { syncDwell(Number(this.value)); });
  dwellInput.addEventListener('click', function(e) { e.stopPropagation(); });
  dwellSlider.addEventListener('click', function(e) { e.stopPropagation(); });

  var speedSlider = document.getElementById('narr-speed-slider');
  var speedInput = document.getElementById('narr-speed-input');
  function syncSpeed(val) {
    val = Math.max(0.5, Math.min(3, Math.round(val * 4) / 4));
    speedSlider.value = val;
    speedInput.value = val;
    tourEngine.transitionSpeed = val;
  }
  speedSlider.addEventListener('input', function() { syncSpeed(Number(this.value)); });
  speedInput.addEventListener('change', function() { syncSpeed(Number(this.value)); });
  speedInput.addEventListener('click', function(e) { e.stopPropagation(); });
  speedSlider.addEventListener('click', function(e) { e.stopPropagation(); });

  var opacitySlider = document.getElementById('narr-opacity-slider');
  var opacityInput = document.getElementById('narr-opacity-input');
  function syncOpacity(val) {
    val = Math.max(0.2, Math.min(1, Math.round(val * 20) / 20));
    opacitySlider.value = val;
    opacityInput.value = val;
    narration.style.setProperty('--narr-opacity', val);
  }
  opacitySlider.addEventListener('input', function() { syncOpacity(Number(this.value)); });
  opacityInput.addEventListener('change', function() { syncOpacity(Number(this.value)); });
  opacityInput.addEventListener('click', function(e) { e.stopPropagation(); });
  opacitySlider.addEventListener('click', function(e) { e.stopPropagation(); });

  var autoAdvanceChk = document.getElementById('narr-auto-advance');
  autoAdvanceChk.addEventListener('change', function() {
    tourEngine.autoAdvance = this.checked;
    if (this.checked && tourEngine.active && !tourEngine.paused && tourEngine.dwellDuration > 0 && !tourEngine.dwellTimeout) {
      var elapsed = tourEngine.dwellElapsed + (performance.now() - tourEngine.dwellStart);
      var remaining = Math.max(0, tourEngine.dwellDuration - elapsed);
      if (remaining > 0) {
        tourEngine.dwellTimeout = setTimeout(function() {
          tourEngine.dwellTimeout = null;
          tourEngine.nextStep();
        }, remaining);
      } else {
        tourEngine.nextStep();
      }
    } else if (!this.checked && tourEngine.dwellTimeout) {
      clearTimeout(tourEngine.dwellTimeout);
      tourEngine.dwellTimeout = null;
    }
  });
  autoAdvanceChk.addEventListener('click', function(e) { e.stopPropagation(); });
})();

// ─── Glossary panel ───────────────────────────────────────────────────

var glossaryObjMap = {
  "Magnetars": "SGR 1806-20", "Neutron Stars": "Vela Pulsar",
  "Milky Way": "Sun (You Are Here)", "Laniakea": "Great Attractor",
  "Spiral Arms": "Perseus Arm",
  "Tycho's Supernova": "Tycho's SN Remnant",
  "Kepler's Supernova": "Kepler's SN Remnant",
  "Supernovae": "Tycho's SN Remnant",
  "Exoplanets": "Proxima Centauri b",
  "Dark Matter Halos": "Andromeda (M31)",
  "Observable Universe": "Great Attractor",
  "Constellations": "Betelgeuse",
  "Lagrange Points": "L2"
};

function makeGotoButton(objName) {
  var gotoBtn = document.createElement('button');
  gotoBtn.className = 'glossary-goto';
  gotoBtn.title = 'Take me there';
  var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  var c1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c1.setAttribute('cx', '12'); c1.setAttribute('cy', '12'); c1.setAttribute('r', '10');
  c1.setAttribute('fill', 'none'); c1.setAttribute('stroke', 'currentColor'); c1.setAttribute('stroke-width', '2');
  var c2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c2.setAttribute('cx', '12'); c2.setAttribute('cy', '12'); c2.setAttribute('r', '6');
  c2.setAttribute('fill', 'none'); c2.setAttribute('stroke', 'currentColor'); c2.setAttribute('stroke-width', '2');
  var c3 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c3.setAttribute('cx', '12'); c3.setAttribute('cy', '12'); c3.setAttribute('r', '2');
  c3.setAttribute('fill', 'currentColor');
  svg.appendChild(c1); svg.appendChild(c2); svg.appendChild(c3);
  gotoBtn.appendChild(svg);
  gotoBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (state.mode3d) { navigateToObject3D(objName); }
    else { navigateToObject(objName); }
  });
  return gotoBtn;
}

function makeEntryEl(entry, idx) {
  var el = document.createElement('div');
  el.className = 'glossary-entry';
  el.dataset.glossaryIdx = idx;
  el.dataset.cat = entry.cat;
  el.dataset.searchName = entry.name.toLowerCase();
  el.dataset.searchShort = entry.short.toLowerCase();
  el.dataset.searchLong = entry.long.toLowerCase();

  var header = document.createElement('div');
  header.className = 'glossary-entry-header';

  var accent = document.createElement('div');
  accent.className = 'glossary-accent';
  accent.style.backgroundColor = entry.color;

  var info = document.createElement('div');
  info.className = 'glossary-entry-info';

  var nameEl = document.createElement('span');
  nameEl.className = 'glossary-entry-name';
  nameEl.textContent = entry.name;

  var catTag = document.createElement('span');
  catTag.className = 'glossary-entry-cat';
  catTag.textContent = entry.cat;

  var shortEl = document.createElement('div');
  shortEl.className = 'glossary-entry-short';
  shortEl.textContent = entry.short;

  info.appendChild(nameEl);
  info.appendChild(catTag);
  info.appendChild(shortEl);
  header.appendChild(accent);
  header.appendChild(info);

  var lookupName = glossaryObjMap[entry.name] || entry.name;
  var matchObj = null;
  for (var oi = 0; oi < objects.length; oi++) {
    if (objects[oi].name === lookupName || objects[oi].name.indexOf(lookupName) === 0) {
      matchObj = objects[oi]; break;
    }
  }
  if (matchObj) {
    header.appendChild(makeGotoButton(matchObj.name));
  }

  el.appendChild(header);

  var longWrap = document.createElement('div');
  longWrap.className = 'glossary-entry-long';
  var longText = document.createElement('div');
  longText.className = 'glossary-entry-long-text';
  longText.textContent = entry.long;
  longWrap.appendChild(longText);

  // Image strip (lazy-loaded on expand)
  if (entry.images && entry.images.length) {
    var strip = document.createElement('div');
    strip.className = 'glossary-img-strip';
    for (var ii = 0; ii < entry.images.length; ii++) {
      (function(imgData) {
        var thumb = document.createElement('div');
        thumb.className = 'glossary-img-thumb';
        var img = document.createElement('img');
        img.className = 'glossary-img';
        img.alt = imgData.caption;
        img.dataset.src = imgData.src;
        thumb.appendChild(img);
        var cap = document.createElement('div');
        cap.className = 'glossary-img-caption';
        cap.textContent = imgData.caption;
        thumb.appendChild(cap);
        if (imgData.credit) {
          var cred = document.createElement('div');
          cred.className = 'glossary-img-credit';
          cred.textContent = imgData.credit;
          thumb.appendChild(cred);
        }
        thumb.addEventListener('click', function(e) {
          e.stopPropagation();
          var overlay = document.createElement('div');
          overlay.className = 'img-lightbox';
          var fullImg = document.createElement('img');
          fullImg.src = imgData.src;
          fullImg.alt = imgData.caption;
          overlay.appendChild(fullImg);
          var lbCap = document.createElement('div');
          lbCap.className = 'img-lightbox-caption';
          lbCap.textContent = imgData.caption;
          overlay.appendChild(lbCap);
          if (imgData.credit) {
            var lbCred = document.createElement('div');
            lbCred.className = 'img-lightbox-credit';
            lbCred.textContent = imgData.credit;
            overlay.appendChild(lbCred);
          }
          overlay.addEventListener('click', function() {
            document.body.removeChild(overlay);
          });
          document.body.appendChild(overlay);
        });
        strip.appendChild(thumb);
      })(entry.images[ii]);
    }
    longWrap.appendChild(strip);
  }

  el.appendChild(longWrap);

  header.addEventListener('click', function() {
    var wasExpanded = el.classList.contains('expanded');
    el.classList.toggle('expanded');
    if (!wasExpanded) {
      var imgs = el.querySelectorAll('img[data-src]');
      for (var li = 0; li < imgs.length; li++) {
        imgs[li].src = imgs[li].dataset.src;
        imgs[li].removeAttribute('data-src');
      }
    }
  });

  return el;
}

var glossaryMode = 'categories'; // 'categories' or 'single'

function buildGlossary() {
  var body = document.getElementById('glossary-body');
  while (body.firstChild) body.removeChild(body.firstChild);

  var cats = ["Solar System", "Stars", "Nebulae", "Galaxies & Clusters", "Extreme Phenomena", "Concepts"];
  cats.forEach(function(cat) {
    // Category header with collapse arrow
    var catLabel = document.createElement('div');
    catLabel.className = 'glossary-cat-label collapsed';
    catLabel.dataset.cat = cat;

    var arrow = document.createElement('span');
    arrow.className = 'glossary-cat-arrow';
    arrow.textContent = '>';

    var catText = document.createElement('span');
    catText.textContent = cat;

    // Count entries in this category
    var count = 0;
    for (var ci = 0; ci < glossaryData.length; ci++) {
      if (glossaryData[ci].cat === cat) count++;
    }
    var countEl = document.createElement('span');
    countEl.className = 'glossary-cat-count';
    countEl.textContent = count;

    catLabel.appendChild(arrow);
    catLabel.appendChild(catText);
    catLabel.appendChild(countEl);
    body.appendChild(catLabel);

    // Toggle collapse on click (only when not filtering — filter handler takes over)
    catLabel.addEventListener('click', (function(label, arrowEl) {
      return function() {
        var searchVal = document.getElementById('glossary-search-input').value.trim();
        if (searchVal) return; // Filtered state handled by filter click handler
        var wasCollapsed = label.classList.contains('collapsed');
        label.classList.toggle('collapsed');
        arrowEl.textContent = wasCollapsed ? 'v' : '>';
        // Show/hide entries belonging to this category
        var next = label.nextElementSibling;
        while (next && !next.classList.contains('glossary-cat-label')) {
          next.style.display = wasCollapsed ? '' : 'none';
          next = next.nextElementSibling;
        }
      };
    })(catLabel, arrow));

    glossaryData.forEach(function(entry, idx) {
      if (entry.cat !== cat) return;
      var el = makeEntryEl(entry, idx);
      // Start collapsed — hide entries
      el.style.display = 'none';
      body.appendChild(el);
    });
  });
}

function openGlossaryToEntry(name) {
  var panel = document.getElementById('glossary-panel');
  panel.classList.add('open');
  document.getElementById('glossary-toggle-btn').classList.add('active');

  var entries = panel.querySelectorAll('.glossary-entry');
  for (var i = 0; i < entries.length; i++) {
    var idx = parseInt(entries[i].dataset.glossaryIdx);
    if (glossaryData[idx] && glossaryData[idx].name === name) {
      // Expand the parent category if collapsed
      var catEl = entries[i].previousElementSibling;
      while (catEl && !catEl.classList.contains('glossary-cat-label')) {
        catEl = catEl.previousElementSibling;
      }
      if (catEl && catEl.classList.contains('collapsed')) {
        catEl.classList.remove('collapsed');
        var arrowEl = catEl.querySelector('.glossary-cat-arrow');
        if (arrowEl) arrowEl.textContent = 'v';
        // Show all entries in this category
        var next = catEl.nextElementSibling;
        while (next && !next.classList.contains('glossary-cat-label')) {
          next.style.display = '';
          next = next.nextElementSibling;
        }
      }
      entries[i].classList.add('expanded');
      entries[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
      break;
    }
  }
}

document.getElementById('glossary-toggle-btn').addEventListener('click', function() {
  dismissWelcome();
  var panel = document.getElementById('glossary-panel');
  panel.classList.toggle('open');
  this.classList.toggle('active');
});

document.getElementById('glossary-close').addEventListener('click', function() {
  document.getElementById('glossary-panel').classList.remove('open');
  document.getElementById('glossary-toggle-btn').classList.remove('active');
});

// ─── Glossary search/filter ──────────────────────────────────────────

(function() {
  var searchInput = document.getElementById('glossary-search-input');
  var clearBtn = document.getElementById('glossary-search-clear');

  searchInput.addEventListener('input', function() {
    // Clear arrow-nav highlight when typing
    var navH = document.querySelector('.glossary-entry.nav-highlight');
    if (navH) navH.classList.remove('nav-highlight');
    var query = searchInput.value.toLowerCase().trim();
    clearBtn.classList.toggle('visible', query.length > 0);
    filterGlossaryEntries(query);
  });

  clearBtn.addEventListener('click', function() {
    searchInput.value = '';
    clearBtn.classList.remove('visible');
    filterGlossaryEntries('');
    searchInput.focus();
  });

  // Mode toggle buttons
  var modeToggle = document.getElementById('glossary-mode-toggle');
  var modeBtns = modeToggle.querySelectorAll('.glossary-mode-btn');
  for (var mi = 0; mi < modeBtns.length; mi++) {
    (function(btn) {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        for (var mj = 0; mj < modeBtns.length; mj++) modeBtns[mj].classList.remove('active');
        btn.classList.add('active');
        glossaryMode = btn.dataset.mode;
        filterGlossaryEntries(searchInput.value.toLowerCase().trim());
      });
    })(modeBtns[mi]);
  }

  function expandCategory(catLabel) {
    catLabel.classList.remove('collapsed');
    var arrowEl = catLabel.querySelector('.glossary-cat-arrow');
    if (arrowEl) arrowEl.textContent = 'v';
  }

  function collapseCategory(catLabel) {
    catLabel.classList.add('collapsed');
    var arrowEl = catLabel.querySelector('.glossary-cat-arrow');
    if (arrowEl) arrowEl.textContent = '>';
  }

  function filterGlossaryEntries(query) {
    var glossaryBody = document.getElementById('glossary-body');
    var entries = glossaryBody.querySelectorAll('.glossary-entry');
    var catLabels = glossaryBody.querySelectorAll('.glossary-cat-label');

    if (!query) {
      // No query: show all category headers, restore collapsed state and counts
      for (var i = 0; i < catLabels.length; i++) {
        catLabels[i].style.display = '';
        // Restore total count
        var totalCat = catLabels[i].dataset.cat;
        var totalCount = 0;
        for (var ti = 0; ti < glossaryData.length; ti++) {
          if (glossaryData[ti].cat === totalCat) totalCount++;
        }
        var countEl = catLabels[i].querySelector('.glossary-cat-count');
        if (countEl) countEl.textContent = totalCount;
      }
      for (var j = 0; j < entries.length; j++) {
        entries[j].dataset.filterMatch = '';
        // Respect current collapse state of parent category
        var prev = entries[j].previousElementSibling;
        while (prev && !prev.classList.contains('glossary-cat-label')) {
          prev = prev.previousElementSibling;
        }
        entries[j].style.display = (prev && prev.classList.contains('collapsed')) ? 'none' : '';
      }
      return;
    }

    if (glossaryMode === 'single') {
      // Single mode: hide all category labels, show flat matching entries
      for (var si = 0; si < catLabels.length; si++) {
        catLabels[si].style.display = 'none';
      }
      for (var sj = 0; sj < entries.length; sj++) {
        var e = entries[sj];
        var match = e.dataset.searchName.indexOf(query) !== -1 ||
                    e.dataset.searchShort.indexOf(query) !== -1 ||
                    e.dataset.searchLong.indexOf(query) !== -1;
        e.style.display = match ? '' : 'none';
      }
      return;
    }

    // Categories mode: show only category headers that have matches,
    // entries stay hidden until the category is expanded by clicking
    var catHasVisible = {};
    var catMatchCounts = {};
    for (var ci = 0; ci < entries.length; ci++) {
      var entry = entries[ci];
      var matchName = entry.dataset.searchName.indexOf(query) !== -1;
      var matchShort = entry.dataset.searchShort.indexOf(query) !== -1;
      var matchLong = entry.dataset.searchLong.indexOf(query) !== -1;
      var vis = matchName || matchShort || matchLong;
      // Mark entry with filter match but keep hidden — category click reveals
      entry.dataset.filterMatch = vis ? '1' : '0';
      entry.style.display = 'none';

      if (vis) {
        var pc = entry.dataset.cat;
        if (pc) {
          catHasVisible[pc] = true;
          catMatchCounts[pc] = (catMatchCounts[pc] || 0) + 1;
        }
      }
    }

    for (var ck = 0; ck < catLabels.length; ck++) {
      var catName = catLabels[ck].dataset.cat;
      if (catHasVisible[catName]) {
        catLabels[ck].style.display = '';
        // Show match count instead of total
        var countEl = catLabels[ck].querySelector('.glossary-cat-count');
        if (countEl) countEl.textContent = catMatchCounts[catName];
        // Collapse so user clicks to see matches
        collapseCategory(catLabels[ck]);
      } else {
        catLabels[ck].style.display = 'none';
      }
    }
  }

  // Handle category click during filtered state — show matching entries
  document.getElementById('glossary-body').addEventListener('click', function(ev) {
    var glossaryBody = document.getElementById('glossary-body');
    var target = ev.target;

    // Walk up to find the category label click
    while (target && !target.classList.contains('glossary-cat-label')) {
      if (target === glossaryBody) return;
      target = target.parentElement;
    }
    if (!target || !target.classList.contains('glossary-cat-label')) return;

    var query = searchInput.value.toLowerCase().trim();
    if (!query) return; // Normal collapse/expand handled by buildGlossary listeners

    // During filter: toggle showing matched entries under this category
    var wasCollapsed = target.classList.contains('collapsed');
    if (wasCollapsed) {
      expandCategory(target);
      var next = target.nextElementSibling;
      while (next && !next.classList.contains('glossary-cat-label')) {
        if (next.dataset.filterMatch === '1') {
          next.style.display = '';
        }
        next = next.nextElementSibling;
      }
    } else {
      collapseCategory(target);
      var next2 = target.nextElementSibling;
      while (next2 && !next2.classList.contains('glossary-cat-label')) {
        next2.style.display = 'none';
        next2 = next2.nextElementSibling;
      }
    }
  });

  // Handle single-mode click: reveal category context
  document.getElementById('glossary-body').addEventListener('click', function(ev) {
    if (glossaryMode !== 'single') return;
    var query = searchInput.value.toLowerCase().trim();
    if (!query) return;

    var glossaryBody = document.getElementById('glossary-body');
    var target = ev.target;
    // Walk up to find the entry header click
    while (target && !target.classList.contains('glossary-entry-header')) {
      if (target === glossaryBody) return;
      target = target.parentElement;
    }
    if (!target) return;

    var entryEl = target.parentElement;
    if (!entryEl || !entryEl.classList.contains('glossary-entry')) return;

    var clickedCat = entryEl.dataset.cat;
    if (!clickedCat) return;

    // Switch to categories view showing just this category
    var catLabels2 = glossaryBody.querySelectorAll('.glossary-cat-label');
    var entries2 = glossaryBody.querySelectorAll('.glossary-entry');

    for (var li = 0; li < catLabels2.length; li++) {
      if (catLabels2[li].dataset.cat === clickedCat) {
        catLabels2[li].style.display = '';
        expandCategory(catLabels2[li]);
      } else {
        catLabels2[li].style.display = 'none';
      }
    }

    for (var ei = 0; ei < entries2.length; ei++) {
      entries2[ei].style.display = entries2[ei].dataset.cat === clickedCat ? '' : 'none';
    }

    // Expand the clicked entry
    entryEl.classList.add('expanded');
    entryEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();

// ─── Scene presets ────────────────────────────────────────────────────

function applyScenePreset(preset) {
  // Enter 3D mode if not already
  if (!state.mode3d) {
    toggle3D();
  }

  // Find the orbit target object
  var targetObj = findObject(preset.orbitObj);
  if (!targetObj) return;

  // Select the object
  state.selected = targetObj;

  // Set up orbit mode
  var fx = targetObj.wx3d || 0;
  var fy = targetObj.wy3d || 0;
  var fz = targetObj.wz3d || 0;
  orbitMode.focalX = fx;
  orbitMode.focalY = fy;
  orbitMode.focalZ = fz;
  orbitMode.focalName = displayName(targetObj);
  orbitMode.orbitDist = preset.orbitDistAU * AU_IN_LY;
  orbitMode.orbitYaw = (preset.orbitYawDeg || 0) * DEG2RAD;
  orbitMode.orbitPitch = (preset.orbitPitchDeg || 0) * DEG2RAD;
  orbitMode.active = true;
  orbitMode.focalAnim.active = false;
  cam3d.fov = 60;
  orbitToCamera();

  // Set time speed
  simTime.simDaysAtEpoch = getSimDaysJ2000();
  simTime.epoch = Date.now();
  simTime.multiplier = preset.timeSpeed || 1;

  // Set HUD style
  if (preset.hudStyle && hudStyles[preset.hudStyle]) {
    hudStyle = preset.hudStyle;
    try { localStorage.setItem('cosmos_hud_style', hudStyle); } catch(e) {}
  }

  // Apply effects overrides
  if (preset.effects) {
    for (var ek in preset.effects) {
      if (preset.effects.hasOwnProperty(ek)) {
        effects[ek] = preset.effects[ek];
      }
    }
  }

  // Rebuild effects panel to reflect changes
  buildEffectsPanel();
  state.dirty = true;
}

(function() {
  var btn = document.getElementById('scenes-btn');
  var dropdown = document.getElementById('scenes-dropdown');

  // Build dropdown items
  for (var i = 0; i < scenePresets.length; i++) {
    var item = document.createElement('div');
    item.className = 'scene-item';
    item.dataset.sceneIdx = i;

    var label = document.createElement('div');
    label.className = 'scene-item-label';
    label.textContent = scenePresets[i].label;

    var desc = document.createElement('div');
    desc.className = 'scene-item-desc';
    desc.textContent = scenePresets[i].desc;

    item.appendChild(label);
    item.appendChild(desc);
    dropdown.appendChild(item);

    item.addEventListener('click', (function(idx) {
      return function() {
        applyScenePreset(scenePresets[idx]);
        dropdown.classList.remove('open');
        btn.classList.remove('active');
      };
    })(i));
  }

  // Toggle dropdown
  btn.addEventListener('click', function() {
    dismissWelcome();
    var isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open');
    btn.classList.toggle('active');
    if (!isOpen) {
      // Position dropdown below button
      var rect = btn.getBoundingClientRect();
      dropdown.style.top = (rect.bottom + 4) + 'px';
      dropdown.style.left = rect.left + 'px';
    }
  });

  // Close on outside click
  document.addEventListener('click', function(e) {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
      btn.classList.remove('active');
    }
  });
})();

// ─── Effects panel ────────────────────────────────────────────────────

function buildEffectsPanel() {
  var panel = document.getElementById('effects-panel');
  while (panel.firstChild) panel.removeChild(panel.firstChild);

  var checks = [
    { key: 'twinkling', label: 'Star twinkling' },
    { key: 'warpStreaks', label: 'Warp streaks' },
    { key: 'flowLines', label: 'Gravity flow' },
    { key: 'ambientParticles', label: 'Ambient particles' },
    { key: 'orbits', label: 'Orbit lines' },
    { key: 'orbitalPlanes', label: 'Orbital planes (3D)' },
    { key: 'occlusion', label: 'Shadows/occlusion' }
  ];

  checks.forEach(function(c) {
    var lbl = document.createElement('label');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = effects[c.key];
    cb.addEventListener('change', function() {
      effects[c.key] = cb.checked;
      state.dirty = true;
    });
    lbl.appendChild(cb);
    var span = document.createElement('span');
    span.textContent = c.label;
    lbl.appendChild(span);
    panel.appendChild(lbl);
  });

  var sliderRow = document.createElement('div');
  sliderRow.className = 'slider-row';
  var sliderLabel = document.createElement('span');
  sliderLabel.textContent = 'Glow';
  var sliderInput = document.createElement('input');
  sliderInput.type = 'range';
  sliderInput.min = '0';
  sliderInput.max = '200';
  sliderInput.value = String(Math.round(effects.glowIntensity * 100));
  var sliderVal = document.createElement('span');
  sliderVal.textContent = Math.round(effects.glowIntensity * 100) + '%';
  sliderInput.addEventListener('input', function() {
    effects.glowIntensity = parseInt(sliderInput.value) / 100;
    sliderVal.textContent = sliderInput.value + '%';
    state.dirty = true;
  });
  sliderRow.appendChild(sliderLabel);
  sliderRow.appendChild(sliderInput);
  sliderRow.appendChild(sliderVal);
  panel.appendChild(sliderRow);

  // HUD style selector
  var styleRow = document.createElement('div');
  styleRow.className = 'slider-row';
  var styleLabel = document.createElement('span');
  styleLabel.textContent = 'HUD Style';
  var styleSelect = document.createElement('select');
  styleSelect.style.cssText = 'background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:4px;padding:2px 6px;font-size:11px;';
  var styleNames = { cinematic: 'Cinematic', minimal: 'Minimal', bold: 'Bold', retro: 'Retro', 'retro-sm': 'Retro Small' };
  Object.keys(styleNames).forEach(function(key) {
    var opt = document.createElement('option');
    opt.value = key;
    opt.textContent = styleNames[key];
    if (key === hudStyle) opt.selected = true;
    styleSelect.appendChild(opt);
  });
  styleSelect.addEventListener('change', function() {
    hudStyle = styleSelect.value;
    try { localStorage.setItem('cosmos_hud_style', hudStyle); } catch(e) {}
    state.dirty = true;
  });
  // Load saved style
  try {
    var saved = localStorage.getItem('cosmos_hud_style');
    if (saved && hudStyles[saved]) { hudStyle = saved; styleSelect.value = saved; }
  } catch(e) {}
  styleRow.appendChild(styleLabel);
  styleRow.appendChild(styleSelect);
  panel.appendChild(styleRow);

  // Object overlay style selector
  var overlayRow = document.createElement('div');
  overlayRow.className = 'slider-row';
  var overlayLabel = document.createElement('span');
  overlayLabel.textContent = 'Object Style';
  var overlaySelect = document.createElement('select');
  overlaySelect.style.cssText = 'background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:4px;padding:2px 6px;font-size:11px;';
  var overlayNames = { flat: 'Flat', albedo: 'Albedo', wireframe: 'Wireframe', depth: 'Depth', layers: 'Layers' };
  Object.keys(overlayNames).forEach(function(key) {
    var opt = document.createElement('option');
    opt.value = key;
    opt.textContent = overlayNames[key];
    if (key === effects.overlayStyle) opt.selected = true;
    overlaySelect.appendChild(opt);
  });
  overlaySelect.addEventListener('change', function() {
    effects.overlayStyle = overlaySelect.value;
    try { localStorage.setItem('cosmos_overlay_style', effects.overlayStyle); } catch(e) {}
    state.dirty = true;
  });
  try {
    var savedOverlay = localStorage.getItem('cosmos_overlay_style');
    if (savedOverlay && overlayRenderers[savedOverlay]) {
      effects.overlayStyle = savedOverlay;
      overlaySelect.value = savedOverlay;
    }
  } catch(e) {}
  overlayRow.appendChild(overlayLabel);
  overlayRow.appendChild(overlaySelect);
  panel.appendChild(overlayRow);

  // Time multiplier controls
  var timeRow = document.createElement('div');
  timeRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:4px;';
  var timeLabel = document.createElement('span');
  timeLabel.style.cssText = 'color:#aaa;font-size:11px;white-space:nowrap;';
  timeLabel.textContent = 'Time Speed';
  var timeSelect = document.createElement('select');
  timeSelect.style.cssText = 'background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:4px;padding:2px 6px;font-size:11px;';
  var timeSpeeds = [
    { label: 'Real-time', val: 1 },
    { label: '1 hr/sec', val: 3600 },
    { label: '1 day/sec', val: 86400 },
    { label: '1 wk/sec', val: 604800 },
    { label: '1 mo/sec', val: 2592000 },
    { label: '1 yr/sec', val: 31557600 },
    { label: '10 yr/sec', val: 315576000 },
    { label: '100 yr/sec', val: 3155760000 },
    { label: '1 kyr/sec', val: 31557600000 },
    { label: '100 kyr/sec', val: 3155760000000 },
    { label: '1 Myr/sec', val: 31557600000000 }
  ];
  for (var ti = 0; ti < timeSpeeds.length; ti++) {
    var topt = document.createElement('option');
    topt.value = timeSpeeds[ti].val;
    topt.textContent = timeSpeeds[ti].label;
    var absCurMul = Math.abs(simTime.multiplier);
    if (timeSpeeds[ti].val === absCurMul) topt.selected = true;
    timeSelect.appendChild(topt);
  }
  // Default on first build only
  if (simTime.multiplier === 1 && !simTime._initialized) {
    simTime.simDaysAtEpoch = getSimDaysJ2000();
    simTime.epoch = Date.now();
    simTime.multiplier = 86400;
    simTime._initialized = true;
  }
  // Sync select to current multiplier
  timeSelect.value = Math.abs(simTime.multiplier);
  timeSelect.addEventListener('change', function() {
    var absVal = parseFloat(timeSelect.value);
    var wasReverse = simTime.multiplier < 0;
    // Snapshot current sim days before changing speed
    simTime.simDaysAtEpoch = getSimDaysJ2000();
    simTime.epoch = Date.now();
    simTime.multiplier = wasReverse ? -absVal : absVal;
    state.dirty = true;
  });
  timeRow.appendChild(timeLabel);
  timeRow.appendChild(timeSelect);
  panel.appendChild(timeRow);

  // Reverse time toggle
  var revRow = document.createElement('div');
  revRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:2px;';
  var revLabel = document.createElement('label');
  revLabel.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;color:#9898b0;cursor:pointer;';
  var revCb = document.createElement('input');
  revCb.type = 'checkbox';
  revCb.checked = simTime.multiplier < 0;
  revCb.style.accentColor = '#4a6a9a';
  revCb.addEventListener('change', function() {
    simTime.simDaysAtEpoch = getSimDaysJ2000();
    simTime.epoch = Date.now();
    simTime.multiplier = -simTime.multiplier;
    state.dirty = true;
  });
  var revText = document.createElement('span');
  revText.textContent = 'Reverse time';
  revLabel.appendChild(revCb);
  revLabel.appendChild(revText);
  revRow.appendChild(revLabel);
  panel.appendChild(revRow);

  // Start date/time input
  var dateRow = document.createElement('div');
  dateRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;';
  var dateLbl = document.createElement('span');
  dateLbl.style.cssText = 'color:#aaa;font-size:11px;white-space:nowrap;';
  dateLbl.textContent = 'Date';
  var dateInput = document.createElement('input');
  dateInput.type = 'datetime-local';
  dateInput.step = '1';
  dateInput.style.cssText = 'background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:4px;padding:2px 6px;font-size:10px;width:175px;';
  // Set initial value and keep in sync with sim time
  var dateInputEditing = false;
  var lastDateStr = '';
  function syncDateInput() {
    if (dateInputEditing) return;
    var simDays = getSimDaysJ2000();
    var simMs = simTime.J2000 + simDays * 86400000;
    var d = new Date(simMs);
    // Only update if the displayed value actually changed (avoid cursor flicker)
    var str = d.toISOString().slice(0, 19);
    if (str !== lastDateStr) {
      dateInput.value = str;
      lastDateStr = str;
    }
  }
  syncDateInput();
  // Update every 500ms during animation
  setInterval(syncDateInput, 500);
  dateInput.addEventListener('focus', function() { dateInputEditing = true; });
  dateInput.addEventListener('blur', function() { dateInputEditing = false; });
  dateInput.addEventListener('change', function() {
    var d = new Date(dateInput.value);
    if (!isNaN(d.getTime())) {
      simTime.simDaysAtEpoch = (d.getTime() - simTime.J2000) / 86400000;
      simTime.epoch = Date.now();
      state.dirty = true;
    }
    dateInputEditing = false;
  });
  var nowBtn = document.createElement('button');
  nowBtn.style.cssText = 'background:#1a1a2e;color:#7a9aba;border:1px solid #333;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;';
  nowBtn.textContent = 'Now';
  nowBtn.addEventListener('click', function() {
    simTime.simDaysAtEpoch = (Date.now() - simTime.J2000) / 86400000;
    simTime.epoch = Date.now();
    simTime.multiplier = 1;
    simTime.paused = false;
    if (revCb) revCb.checked = false;
    syncDateInput();
    state.dirty = true;
  });
  dateRow.appendChild(dateLbl);
  dateRow.appendChild(dateInput);
  dateRow.appendChild(nowBtn);
  panel.appendChild(dateRow);
}

document.getElementById('effects-toggle').addEventListener('click', function() {
  document.getElementById('effects-panel').classList.toggle('open');
});

// ─── Docs button ─────────────────────────────────────────────────────

document.getElementById('docs-btn').addEventListener('click', function() {
  showDocs();
});

// ─── Feedback form ───────────────────────────────────────────────────

(function() {
  var btn = document.getElementById('feedback-btn');
  var popover = document.getElementById('feedback-popover');
  var overlay = document.getElementById('feedback-overlay');
  var cancelBtn = document.getElementById('fb-cancel');
  var sendBtn = document.getElementById('fb-send');
  var nameInput = document.getElementById('fb-name');
  var contactInput = document.getElementById('fb-contact');
  var msgInput = document.getElementById('fb-msg');
  var statusEl = document.getElementById('fb-status');

  function openFeedback() {
    popover.classList.add('open');
    overlay.classList.add('open');
    msgInput.focus();
  }

  function closeFeedback() {
    popover.classList.remove('open');
    overlay.classList.remove('open');
    nameInput.value = '';
    contactInput.value = '';
    msgInput.value = '';
    statusEl.textContent = '';
    sendBtn.disabled = false;
  }

  btn.addEventListener('click', openFeedback);
  cancelBtn.addEventListener('click', closeFeedback);
  overlay.addEventListener('click', closeFeedback);

  sendBtn.addEventListener('click', function() {
    var msg = msgInput.value.trim();
    if (!msg) { statusEl.style.color = '#cc6644'; statusEl.textContent = 'Please enter a message.'; return; }

    sendBtn.disabled = true;
    statusEl.style.color = '#7a7a96';
    statusEl.textContent = 'Sending...';

    var contact = contactInput.value.trim();
    var payload = { name: nameInput.value.trim() || 'Anonymous', message: msg };
    if (contact) payload.contact = contact;

    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function(r) {
      if (r.ok) {
        statusEl.style.color = '#88cc88';
        statusEl.textContent = 'Sent! Thank you for your feedback.';
        setTimeout(closeFeedback, 2000);
      } else {
        throw new Error('Server error');
      }
    }).catch(function() {
      statusEl.style.color = '#cc6644';
      statusEl.textContent = 'Could not send. Try again later.';
      sendBtn.disabled = false;
    });
  });
})();

// ─── URL hash state ───────────────────────────────────────────────────

var hashUpdateTimer = null;

function updateHash() {
  if (hashUpdateTimer) clearTimeout(hashUpdateTimer);
  hashUpdateTimer = setTimeout(function() {
    var vr = getViewRadius();
    var hash = 'vr=' + vr.toPrecision(4);
    if (Math.abs(state.panX) > 1e-10 || Math.abs(state.panY) > 1e-10) {
      hash += '&px=' + state.panX.toExponential(6) + '&py=' + state.panY.toExponential(6);
    }
    if (state.selected) hash += '&obj=' + encodeURIComponent(state.selected.name);
    if (state.mode3d) {
      hash += '&m=3d';
      hash += '&cx=' + cam3d.px.toExponential(6) + '&cy=' + cam3d.py.toExponential(6) + '&cz=' + cam3d.pz.toExponential(6);
      hash += '&cyw=' + cam3d.yaw.toFixed(4) + '&cpt=' + cam3d.pitch.toFixed(4);
      if (orbitMode.active) {
        hash += '&orb=1&od=' + orbitMode.orbitDist.toExponential(4) + '&fn=' + encodeURIComponent(orbitMode.focalName);
      }
    }
    // Time state
    if (simTime.multiplier !== 86400) hash += '&ts=' + simTime.multiplier;
    var simDays = getSimDaysJ2000();
    hash += '&td=' + simDays.toFixed(2);
    // Visible card
    var ip = document.getElementById('info-panel');
    if (ip && !ip.classList.contains('hidden') && state.selected) hash += '&card=info';
    if (window.location.hash !== '#' + hash) {
      history.replaceState(null, '', '#' + hash);
    }
  }, 300);
}

function readHash() {
  var hash = window.location.hash.replace(/^#/, '');
  if (!hash) return;
  var params = {};
  hash.split('&').forEach(function(p) {
    var kv = p.split('=');
    if (kv.length === 2) params[kv[0]] = decodeURIComponent(kv[1]);
  });
  if (params.px) { var px = parseFloat(params.px); if (!isNaN(px)) state.panX = px; }
  if (params.py) { var py = parseFloat(params.py); if (!isNaN(py)) state.panY = py; }
  updateRecenterBtn();
  if (params.vr) {
    var vr = parseFloat(params.vr);
    if (!isNaN(vr) && vr > 0) {
      state.zoom = viewRadiusToSlider(vr);
      slider.value = Math.round(state.zoom);
    }
  }
  if (params.obj) {
    var _hashObj = findObject(params.obj);
    if (_hashObj) {
        state.selected = _hashObj;
        saveSelectedObject(_hashObj.name);
        showInfo(_hashObj);
        // Auto-center on object if pan wasn't specified in hash
        if (!params.px && !params.py) {
          state.panX = _hashObj.x;
          state.panY = _hashObj.y;
        }
    }
  }
  if (params.m === '3d' && !state.mode3d) {
    state.mode3d = true;
    if (params.cx) cam3d.px = parseFloat(params.cx) || 0;
    if (params.cy) cam3d.py = parseFloat(params.cy) || 0;
    if (params.cz) cam3d.pz = parseFloat(params.cz) || 0;
    if (params.cyw) cam3d.yaw = parseFloat(params.cyw) || 0;
    if (params.cpt) cam3d.pitch = parseFloat(params.cpt) || 0;
    if (params.orb === '1') {
      orbitMode.active = true;
      if (params.od) orbitMode.orbitDist = parseFloat(params.od) || 0.01;
      if (params.fn) orbitMode.focalName = params.fn;
      var fObj = findObject(params.fn);
      if (fObj) {
        orbitMode.focalX = fObj.wx3d || fObj.x || 0;
        orbitMode.focalY = fObj.wy3d || fObj.y || 0;
        orbitMode.focalZ = fObj.wz3d || 0;
      }
    }
  }
  // Restore time state
  if (params.ts) {
    var ts = parseFloat(params.ts);
    if (!isNaN(ts)) {
      simTime.simDaysAtEpoch = getSimDaysJ2000();
      simTime.epoch = Date.now();
      simTime.multiplier = ts;
    }
  }
  if (params.td) {
    var td = parseFloat(params.td);
    if (!isNaN(td)) {
      simTime.simDaysAtEpoch = td;
      simTime.epoch = Date.now();
    }
  }
  // Restore card visibility
  if (params.card === 'info' && state.selected) {
    showInfo(state.selected);
  }
  state.dirty = true;
}

window.addEventListener('hashchange', readHash);

// ─── Interaction ───────────────────────────────────────────────────────

var slider = document.getElementById('zoom-slider');

// When zooming in, pull the view toward the selected object (or Sol if nothing selected).
function panTowardTargetOnZoomIn(prevZoom, newZoom) {
  if (newZoom >= prevZoom) return;
  var targetX = 0, targetY = 0;
  if (state.selected) {
    targetX = state.selected.x;
    targetY = state.selected.y;
  }
  var dx = state.panX - targetX;
  var dy = state.panY - targetY;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return;
  var vr = sliderToViewRadius(newZoom);
  var ratio = dist / vr;
  if (ratio < 0.1) return;
  var zoomDelta = prevZoom - newZoom;
  var pull = Math.min(0.15, zoomDelta * 0.006) * Math.min(1, ratio * 0.3);
  state.panX -= dx * pull;
  state.panY -= dy * pull;
  updateRecenterBtn();
}

slider.addEventListener('input', function() {
  dismissWelcome();
  if (tourEngine.active) tourEngine.stop();
  var prevZoom = state.zoom;
  state.zoom = parseInt(slider.value);
  panTowardTargetOnZoomIn(prevZoom, state.zoom);
  state.activePreset = null;
  state.dirty = true;
  updateHash();
});

canvas.addEventListener('wheel', function(e) {
  e.preventDefault();
  dismissWelcome();
  if (state.mode3d) {
    if (orbitMode.active) {
      // Orbit mode: multiplicative zoom on distance
      orbitMode.orbitDist *= (1 + e.deltaY * 0.003);
      orbitMode.orbitDist = Math.max(1e-14, Math.min(1e8, orbitMode.orbitDist));
      orbitToCamera();
    } else {
      // 3D: scroll changes FOV
      cam3d.fov = Math.max(5, Math.min(120, cam3d.fov + e.deltaY * 0.05));
    }
    state.dirty = true;
    updateHash();
    return;
  }
  if (tourEngine.active) tourEngine.stop();
  var prevZoom = state.zoom;
  state.zoom = Math.max(0, Math.min(1000, state.zoom - e.deltaY * 0.15));
  panTowardTargetOnZoomIn(prevZoom, state.zoom);
  slider.value = Math.round(state.zoom);
  state.activePreset = null;
  state.dirty = true;
  document.getElementById('hint').style.opacity = '0';
  updateHash();
}, { passive: false });

// Glossary name lookup for hover icons
var glossaryNames = {};
glossaryData.forEach(function(g) { glossaryNames[g.name] = true; });
// Also match partial names (e.g. "Sagittarius A*" in glossary matches object)
function hasGlossaryEntry(name) {
  if (glossaryNames[name]) return true;
  // Check if object name starts with a glossary name
  for (var i = 0; i < glossaryData.length; i++) {
    if (name.indexOf(glossaryData[i].name) === 0) return glossaryData[i].name;
  }
  return false;
}

// ─── Mouse drag panning ─────────────────────────────────────────────

var dragState = { dragging: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false,
  startYaw: 0, startPitch: 0 };

canvas.addEventListener('mousedown', function(e) {
  if (e.button !== 0) return;
  dismissWelcome();
  dragState.dragging = true;
  dragState.moved = false;
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  if (state.mode3d) {
    if (orbitMode.active) {
      dragState.startYaw = orbitMode.orbitYaw;
      dragState.startPitch = orbitMode.orbitPitch;
    } else {
      dragState.startYaw = cam3d.yaw;
      dragState.startPitch = cam3d.pitch;
    }
  } else {
    dragState.startPanX = state.panX;
    dragState.startPanY = state.panY;
  }
  canvas.classList.add('grabbing');
});

window.addEventListener('mousemove', function(e) {
  if (dragState.dragging) {
    var dx = e.clientX - dragState.startX;
    var dy = e.clientY - dragState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
    if (dragState.moved) {
      if (state.mode3d) {
        if (orbitMode.active) {
          var sens = cam3d.fov / 300;
          orbitMode.orbitYaw = dragState.startYaw - dx * sens * DEG2RAD;
          orbitMode.orbitPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01,
            dragState.startPitch + dy * sens * DEG2RAD));
          orbitToCamera();
        } else {
          var sens = cam3d.fov / 1000;
          cam3d.yaw = dragState.startYaw - dx * sens * DEG2RAD;
          cam3d.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01,
            dragState.startPitch + dy * sens * DEG2RAD));
          stopTracking();
        }
        state.dirty = true;
      } else {
        var scale = getScale();
        state.panX = dragState.startPanX - dx / scale;
        state.panY = dragState.startPanY - dy / scale;
        state.follow = null;
        state.dirty = true;
        updateRecenterBtn();
      }
    }
    return;
  }
});

window.addEventListener('mouseup', function() {
  if (dragState.dragging) {
    dragState.dragging = false;
    canvas.classList.remove('grabbing');
    if (dragState.moved) updateHash();
  }
});

canvas.addEventListener('mousemove', function(e) {
  if (dragState.dragging) return; // skip hover logic while dragging

  var rect = canvas.getBoundingClientRect();
  var sx = e.clientX - rect.left, sy = e.clientY - rect.top;

  var visible = state.mode3d ? getVisibleObjects3D() : getVisibleObjects();
  var hover = null, minD = 25;
  state.hoverIconPos = null;

  visible.forEach(function(o) {
    var sp = state.mode3d ? o._sp3d : worldToScreen(o.x, o.y);
    if (!sp) return;
    var d = Math.sqrt(Math.pow(sp.x - sx, 2) + Math.pow(sp.y - sy, 2));
    if (d < minD) { minD = d; hover = o; }
  });

  state.hoverObj = hover;

  if (hover) {
    var gName = hasGlossaryEntry(hover.name);
    if (gName) {
      var hsp = state.mode3d ? hover._sp3d : worldToScreen(hover.x, hover.y);
      if (hsp) {
        state.hoverIconPos = { x: hsp.x + hover.radius + 12, y: hsp.y - hover.radius - 6, name: typeof gName === 'string' ? gName : hover.name };
        state.dirty = true;
      }
    }
  }

  canvas.style.cursor = hover ? 'pointer' : 'grab';
  canvas.title = hover ? hover.name + (hover.dist > 0 ? ' \u2014 ' + formatDistance(hover.dist) : '') : '';
  state.dirty = true;
});

canvas.addEventListener('click', function(e) {
  // If we just finished a drag, suppress the click
  if (dragState.moved) { dragState.moved = false; return; }

  var rect = canvas.getBoundingClientRect();
  var sx = e.clientX - rect.left, sy = e.clientY - rect.top;

  // Check if clicking hover icon
  if (state.hoverIconPos) {
    var hp = state.hoverIconPos;
    var hd = Math.sqrt(Math.pow(hp.x - sx, 2) + Math.pow(hp.y - sy, 2));
    if (hd < 12) {
      openGlossaryToEntry(hp.name);
      return;
    }
  }

  if (tourEngine.active) {
    // Ignore clicks within 1s of tour start (prevents dropdown click-through)
    if (performance.now() - tourEngine.startedAt < 1000) return;
    tourEngine.stop(); return;
  }

  var visible = state.mode3d ? getVisibleObjects3D() : getVisibleObjects();
  var hit = null, minD = 25;
  visible.forEach(function(o) {
    var sp = state.mode3d ? o._sp3d : worldToScreen(o.x, o.y);
    if (!sp) return;
    var d = Math.sqrt(Math.pow(sp.x - sx, 2) + Math.pow(sp.y - sy, 2));
    if (d < minD) { minD = d; hit = o; }
  });

  if (hit) {
    state.selected = hit;
    saveSelectedObject(hit.name);
    showInfo(hit);
    state.dirty = true;
    updateHash();
    // Orbit mode: animate focal point to new selection
    if (orbitMode.active && hit.wx3d !== undefined) {
      animateOrbitFocal(hit.wx3d, hit.wy3d, hit.wz3d, displayName(hit));
    }
    // Also jump glossary to this entry if glossary is open
    var gPanel = document.getElementById('glossary-panel');
    if (gPanel.classList.contains('open')) {
      var gName = hasGlossaryEntry(hit.name);
      if (gName) openGlossaryToEntry(typeof gName === 'string' ? gName : hit.name);
    }
    return;
  }

  var vr = getViewRadius(), scale = getScale();
  var hitR = null;
  regions.forEach(function(r) {
    if (vr < r.minVR || vr > r.maxVR) return;
    var sp = worldToScreen(r.cx, r.cy);
    var rx = r.rx * scale, ry = r.ry * scale;
    if (rx < 10) return;
    var dx = (sx - sp.x) / rx, dy = (sy - sp.y) / ry;
    if (dx * dx + dy * dy <= 1.05) hitR = r;
  });

  if (hitR) { state.selected = null; saveSelectedObject(''); showRegionInfo(hitR); state.dirty = true; return; }
  state.selected = null; saveSelectedObject('');
  state.dirty = true;
});

// ─── Double-click to frame object ────────────────────────────────────

canvas.addEventListener('dblclick', function(e) {
  e.preventDefault();
  if (tourEngine.active) return;

  var rect = canvas.getBoundingClientRect();
  var sx = e.clientX - rect.left, sy = e.clientY - rect.top;

  if (state.mode3d) {
    // 3D: double-click to fly to an object
    var visible = getVisibleObjects3D();
    var hit = null, minD = 40;
    visible.forEach(function(o) {
      var sp = o._sp3d;
      if (!sp) return;
      var d = Math.sqrt(Math.pow(sp.x - sx, 2) + Math.pow(sp.y - sy, 2));
      if (d < minD) { minD = d; hit = o; }
    });
    if (hit) {
      state.selected = hit;
      saveSelectedObject(hit.name);
      showInfo(hit);
      // Fly to standard orbit around this object
      var orbD = standardOrbitDist(hit);
      var fx = hit.wx3d, fy = hit.wy3d, fz = hit.wz3d;
      var toX = fx + orbD, toY = fy, toZ = fz;
      var angles = computeLookAngles(toX, toY, toZ, fx, fy, fz);
      cam3dAnim.from = { px: cam3d.px, py: cam3d.py, pz: cam3d.pz,
        yaw: cam3d.yaw, pitch: cam3d.pitch, fov: cam3d.fov };
      cam3dAnim.to = { px: toX, py: toY, pz: toZ,
        yaw: angles.yaw, pitch: angles.pitch, fov: 60 };
      cam3dAnim.duration = 2000;
      cam3dAnim.startTime = performance.now();
      cam3dAnim.active = true;
      orbitMode.focalX = fx;
      orbitMode.focalY = fy;
      orbitMode.focalZ = fz;
      orbitMode.focalName = displayName(hit);
      orbitMode.orbitDist = orbD;
      orbitMode.orbitYaw = 0;
      orbitMode.orbitPitch = 0;
      orbitMode.active = true;
      orbitMode.focalAnim.active = false;
      state.dirty = true;
    }
    return;
  }

  var visible = getVisibleObjects();
  var hit = null, minD = 40;
  visible.forEach(function(o) {
    var sp = worldToScreen(o.x, o.y);
    var d = Math.sqrt(Math.pow(sp.x - sx, 2) + Math.pow(sp.y - sy, 2));
    if (d < minD) { minD = d; hit = o; }
  });

  if (hit) {
    navigateToObject(hit.name);
    state.follow = hit;
    // Trigger flash effect after a short delay for the navigation to start
    setTimeout(function() {
      frameFlash.active = true;
      frameFlash.x = hit.x;
      frameFlash.y = hit.y;
      frameFlash.startTime = performance.now();
      frameFlash.color = hit.color || '#ffffff';
      state.dirty = true;
    }, 600);
  }
});

// ─── Preset buttons ───────────────────────────────────────────────────

document.querySelectorAll('.preset-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    dismissWelcome();
    if (tourEngine.active) tourEngine.stop();
    var p = presets[btn.dataset.preset];
    if (!p) return;
    state.activePreset = btn.dataset.preset;

    var startZoom = state.zoom;
    var startPanX = state.panX, startPanY = state.panY;
    var target = p.slider;
    var zoomDist = Math.abs(target - startZoom);
    var duration = Math.max(600, Math.min(1800, zoomDist * 3));
    var startTime = performance.now();

    function animate(t) {
      var elapsed = t - startTime;
      var progress = Math.min(1, elapsed / duration);
      var ease = easeInOutCubic(progress);
      state.zoom = startZoom + (target - startZoom) * ease;
      state.panX = startPanX * (1 - ease);
      state.panY = startPanY * (1 - ease);
      state.warpIntensity = Math.pow(Math.sin(progress * Math.PI), 2) * Math.min(0.6, zoomDist / 300);
      slider.value = Math.round(state.zoom);
      state.dirty = true;
      updateRecenterBtn();
      if (progress < 1) requestAnimationFrame(animate);
      else { state.panX = 0; state.panY = 0; updateRecenterBtn(); updateHash(); }
    }
    requestAnimationFrame(animate);
  });
});

// ─── Navigate to object ─────────────────────────────────────────────

function navigateToObject(objName) {
  var obj = findObject(objName);
  if (!obj) {
    for (var i = 0; i < objects.length; i++) {
      if (objects[i].name.indexOf(objName) === 0) { obj = objects[i]; break; }
    }
  }
  if (!obj) return;

  var range = obj.visRange || catRanges[obj.category];
  if (!range) return;
  var rangeLo = range[0], rangeHi = Math.min(range[1], 400 * MLY);
  var targetVR = Math.sqrt(rangeLo * rangeHi);
  if (obj.dist === 0 && obj.category === 'solar') targetVR = 0.00004;

  // If geometric mean is zero or nonsensical, compute from object distance
  if (targetVR < 0.000001 || isNaN(targetVR)) {
    if (obj.dist > 0) {
      targetVR = obj.dist * 4; // frame with object at ~quarter of view
    } else {
      targetVR = 0.00004; // default solar system view
    }
  }
  // Clamp solar system objects to reasonable minimum
  if (obj.category === 'solar' && obj.dist > 0) {
    // Inner planets (Mercury, Venus, Earth, Mars): zoom in close to show just that region
    var innerPlanets = ['Mercury', 'Venus', 'Earth', 'Mars'];
    var isInner = false;
    for (var ip = 0; ip < innerPlanets.length; ip++) {
      if (obj.name === innerPlanets[ip]) { isInner = true; break; }
    }
    if (isInner) {
      targetVR = obj.dist * 1.5; // tight framing around the planet
    } else {
      targetVR = Math.max(targetVR, obj.dist * 3);
    }
    targetVR = Math.min(targetVR, 0.002); // don't zoom out too far
  }

  if (tourEngine.active) tourEngine.stop();

  // Animate zoom + pan simultaneously to center on the object
  var targetSlider = Math.max(0, Math.min(1000, Math.round(viewRadiusToSlider(targetVR))));
  var startZoom = state.zoom;
  var startPanX = state.panX, startPanY = state.panY;
  var targetPanX = obj.x, targetPanY = obj.y;
  var zoomDist = Math.abs(targetSlider - startZoom);
  var panDist = Math.sqrt(Math.pow(targetPanX - startPanX, 2) + Math.pow(targetPanY - startPanY, 2));
  var duration = Math.max(800, Math.min(2500, Math.max(zoomDist * 3.5, 1200)));
  var startTime = performance.now();

  state.selected = obj;
  saveSelectedObject(obj.name);
  showInfo(obj);
  document.getElementById('info-panel').classList.remove('hidden');

  function animate(t) {
    var elapsed = t - startTime;
    var progress = Math.min(1, elapsed / duration);
    var ease = easeInOutCubic(progress);
    // Track live position if following a moving object
    if (state.follow) { targetPanX = state.follow.x; targetPanY = state.follow.y; }
    state.zoom = startZoom + (targetSlider - startZoom) * ease;
    state.panX = startPanX + (targetPanX - startPanX) * ease;
    state.panY = startPanY + (targetPanY - startPanY) * ease;
    state.warpIntensity = Math.pow(Math.sin(progress * Math.PI), 2) * Math.min(0.6, zoomDist / 300);
    slider.value = Math.round(state.zoom);
    state.dirty = true;
    state.activePreset = null;
    updateRecenterBtn();
    if (progress < 1) requestAnimationFrame(animate);
    else { updateHash(); }
  }
  requestAnimationFrame(animate);
}

function navigateToObject3D(objName) {
  var obj = findObject(objName);
  if (!obj) {
    for (var i = 0; i < objects.length; i++) {
      if (objects[i].name.indexOf(objName) === 0) { obj = objects[i]; break; }
    }
  }
  if (!obj) return;
  if (tourEngine.active) tourEngine.stop();

  state.selected = obj;
  showInfo(obj);
  document.getElementById('info-panel').classList.remove('hidden');
  saveSelectedObject(obj.name);

  // Need 3D world coords — compute them if not yet available
  if (obj.wx3d === undefined) {
    var angle = obj.angle || 0;
    var elev = obj.elevation || 0;
    var d = obj.dist || 0.0001;
    var cosE = Math.cos(elev);
    obj.wx3d = d * cosE * Math.cos(angle);
    obj.wy3d = d * cosE * Math.sin(angle);
    obj.wz3d = d * Math.sin(elev);
  }

  var fx = obj.wx3d, fy = obj.wy3d, fz = obj.wz3d;

  // Standard orbit: planets 50k km, stars 700k km, or 3× physRadius
  var orbDist = standardOrbitDist(obj);

  // Fly camera to an orbit position around the object
  var toX = fx + orbDist;
  var toY = fy;
  var toZ = fz;
  var angles = computeLookAngles(toX, toY, toZ, fx, fy, fz);

  cam3dAnim.from = { px: cam3d.px, py: cam3d.py, pz: cam3d.pz,
    yaw: cam3d.yaw, pitch: cam3d.pitch, fov: cam3d.fov };
  cam3dAnim.to = { px: toX, py: toY, pz: toZ,
    yaw: angles.yaw, pitch: angles.pitch, fov: cam3d.fov };
  cam3dAnim.duration = 2000;
  cam3dAnim.startTime = performance.now();
  cam3dAnim.active = true;

  // Enter orbit mode once animation completes — set up orbit state now
  orbitMode.focalX = fx;
  orbitMode.focalY = fy;
  orbitMode.focalZ = fz;
  orbitMode.focalName = displayName(obj);
  orbitMode.orbitDist = orbDist;
  orbitMode.orbitYaw = 0;
  orbitMode.orbitPitch = 0;
  orbitMode.active = true;
  orbitMode.focalAnim.active = false;

  state.dirty = true;
  updateHash();
}

function animatePanToSun() {
  if (tourEngine.active) tourEngine.stop();
  var startPanX = state.panX, startPanY = state.panY;
  if (Math.abs(startPanX) < 0.001 && Math.abs(startPanY) < 0.001) return;
  var duration = 1200;
  var startTime = performance.now();

  function animate(t) {
    var elapsed = t - startTime;
    var progress = Math.min(1, elapsed / duration);
    var ease = easeInOutCubic(progress);
    state.panX = startPanX * (1 - ease);
    state.panY = startPanY * (1 - ease);
    state.dirty = true;
    updateRecenterBtn();
    if (progress < 1) requestAnimationFrame(animate);
    else { state.panX = 0; state.panY = 0; updateHash(); }
  }
  requestAnimationFrame(animate);
}

function goHome() {
  if (tourEngine.active) tourEngine.stop();
  var targetSlider = presets.solar.slider;
  var startZoom = state.zoom;
  var startPanX = state.panX, startPanY = state.panY;
  var zoomDist = Math.abs(targetSlider - startZoom);
  var duration = Math.max(800, Math.min(2000, zoomDist * 3));
  var startTime = performance.now();

  function animate(t) {
    var elapsed = t - startTime;
    var progress = Math.min(1, elapsed / duration);
    var ease = easeInOutCubic(progress);
    state.zoom = startZoom + (targetSlider - startZoom) * ease;
    state.panX = startPanX * (1 - ease);
    state.panY = startPanY * (1 - ease);
    state.warpIntensity = Math.pow(Math.sin(progress * Math.PI), 2) * Math.min(0.5, zoomDist / 300);
    slider.value = Math.round(state.zoom);
    state.dirty = true;
    state.activePreset = 'solar';
    updateRecenterBtn();
    if (progress < 1) requestAnimationFrame(animate);
    else { state.panX = 0; state.panY = 0; updateHash(); }
  }
  requestAnimationFrame(animate);
}

function updateRecenterBtn() {
  var btn = document.getElementById('recenter-btn');
  var panned = Math.abs(state.panX) > 0.001 || Math.abs(state.panY) > 0.001;
  if (panned) btn.classList.add('visible');
  else btn.classList.remove('visible');
}

// ─── Re-center on Sun ───────────────────────────────────────────────

document.getElementById('recenter-btn').addEventListener('click', animatePanToSun);

// ─── Info panel toggle ──────────────────────────────────────────────

document.getElementById('info-close').addEventListener('click', function() {
  document.getElementById('info-panel').classList.add('hidden');
});


// ─── 3D Mode Toggle ─────────────────────────────────────────────────


var cam3dPresets = {};

// Resolve presets from object data after initObjects3D
function initCam3dPresets() {
  for (var i = 0; i < cam3dViewpoints.length; i++) {
    var vp = cam3dViewpoints[i];
    var px = 0, py = 0, pz = 0, vpPhysR = 0, vpCat = '';
    if (vp.obj) {
      for (var j = 0; j < objects.length; j++) {
        if (objects[j].name === vp.obj) {
          px = objects[j].wx3d; py = objects[j].wy3d; pz = objects[j].wz3d;
          vpPhysR = objects[j].physRadius || 0;
          vpCat = objects[j].category || '';
          break;
        }
      }
    }
    // Default look toward Orion; Moon looks at Earth
    var defYaw = 83 * DEG2RAD, defPitch = -1 * DEG2RAD;
    if (vp.key === 'moon') {
      // Look toward Earth from the Moon
      for (var ei = 0; ei < objects.length; ei++) {
        if (objects[ei].name === 'Earth') {
          var eaAngles = computeLookAngles(px, py, pz, objects[ei].wx3d, objects[ei].wy3d, objects[ei].wz3d);
          defYaw = eaAngles.yaw;
          defPitch = eaAngles.pitch;
          break;
        }
      }
    } else if (vp.key === 'greatattractor' || vp.key === 'andromeda') {
      // Look toward the Milky Way
      var mwAngles = computeLookAngles(px, py, pz, 0, 0, 0);
      defYaw = mwAngles.yaw;
      defPitch = mwAngles.pitch;
    }
    cam3dPresets[vp.key] = { px: px, py: py, pz: pz, yaw: defYaw, pitch: defPitch, fov: 60, label: vp.label, physRadius: vpPhysR, category: vpCat };
  }
}

function updateTrackingUI() {
  var bar = document.getElementById('cam3d-presets');
  if (!bar) return;
  var btns = bar.querySelectorAll('.cam-preset-btn[data-look-target]');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].getAttribute('data-look-target') === cam3d.trackTarget) {
      btns[i].classList.add('tracking');
    } else {
      btns[i].classList.remove('tracking');
    }
  }
}

function stopTracking() {
  if (cam3d.trackTarget) {
    cam3d.trackTarget = null;
    updateTrackingUI();
  }
}

function resolveLookTargetPos(target) {
  if (target.type === 'object') {
    for (var j = 0; j < objects.length; j++) {
      if (objects[j].name === target.obj && objects[j].wx3d !== undefined) {
        return { x: objects[j].wx3d, y: objects[j].wy3d, z: objects[j].wz3d };
      }
    }
    // Sun fallback (may not have wx3d if not yet initialized)
    if (target.obj === 'Sun' || target.obj === 'Sun (You Are Here)') return { x: 0, y: 0, z: 0 };
  } else if (target.type === 'constellation') {
    var cDef = constellationDefs[target.id];
    if (!cDef) return null;
    var tx = 0, ty = 0, tz = 0, count = 0, seen = {};
    for (var li = 0; li < cDef.lines.length; li++) {
      for (var si = 0; si < 2; si++) {
        var sName = cDef.lines[li][si];
        if (seen[sName]) continue;
        seen[sName] = true;
        for (var oi = 0; oi < objects.length; oi++) {
          if (objects[oi].name === sName) {
            tx += objects[oi].wx3d; ty += objects[oi].wy3d; tz += objects[oi].wz3d;
            count++;
            break;
          }
        }
      }
    }
    if (count > 0) return { x: tx / count, y: ty / count, z: tz / count };
  }
  return null;
}

function getLookTarget(targetKey) {
  // 1. Try registered lookup
  var target = null;
  for (var i = 0; i < cam3dLookTargets.length; i++) {
    if (cam3dLookTargets[i].key === targetKey) { target = cam3dLookTargets[i]; break; }
  }
  if (target) {
    var pos = resolveLookTargetPos(target);
    if (pos) return pos;
  }

  // 2. Self-resolve: parse dynamic keys (dyn_objectslug or dyn_constellationid)
  if (targetKey.indexOf('dyn_') === 0) {
    var slug = targetKey.substring(4);
    // Try constellation IDs
    if (constellationDefs[slug]) {
      cam3dLookTargets.push({ key: targetKey, label: constellationDefs[slug].name, type: 'constellation', id: slug });
      return resolveLookTargetPos({ type: 'constellation', id: slug });
    }
    // Try object name slugs
    for (var oi = 0; oi < objects.length; oi++) {
      if (objects[oi].wx3d === undefined) continue;
      var nameSlug = objects[oi].name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (nameSlug === slug) {
        cam3dLookTargets.push({ key: targetKey, label: objects[oi].name, type: 'object', obj: objects[oi].name });
        return resolveLookTargetPos({ type: 'object', obj: objects[oi].name });
      }
    }
  }

  // 3. Try direct object name match
  for (var oi2 = 0; oi2 < objects.length; oi2++) {
    if (objects[oi2].name === targetKey && objects[oi2].wx3d !== undefined) {
      return { x: objects[oi2].wx3d, y: objects[oi2].wy3d, z: objects[oi2].wz3d };
    }
  }

  return null;
}

function computeLookAngles(px, py, pz, tx, ty, tz) {
  var dx = tx - px, dy = ty - py, dz = tz - pz;
  var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (dist < 1e-12) return { yaw: 0, pitch: 0 };
  return {
    yaw: Math.atan2(dy, dx),
    pitch: Math.atan2(dz, Math.sqrt(dx * dx + dy * dy))
  };
}

// ─── Orbit mode helpers ──────────────────────────────────────────────

function orbitToCamera() {
  var fx = orbitMode.focalX, fy = orbitMode.focalY, fz = orbitMode.focalZ;

  if (cam3d.trackTarget) {
    // When tracking, orbit freely around focal point but always look at the target.
    // User controls orbit yaw/pitch via drag; camera always points at track target.
    var tp = getLookTarget(cam3d.trackTarget);
    if (tp) {
      // Position: free orbit around focal point (same as non-tracking)
      cam3d.px = fx + orbitMode.orbitDist * Math.cos(orbitMode.orbitPitch) * Math.cos(orbitMode.orbitYaw);
      cam3d.py = fy + orbitMode.orbitDist * Math.cos(orbitMode.orbitPitch) * Math.sin(orbitMode.orbitYaw);
      cam3d.pz = fz + orbitMode.orbitDist * Math.sin(orbitMode.orbitPitch);
      // Look direction: always face the track target
      var angles = computeLookAngles(cam3d.px, cam3d.py, cam3d.pz, tp.x, tp.y, tp.z);
      cam3d.yaw = angles.yaw;
      cam3d.pitch = angles.pitch;
      return;
    }
  }

  // Default: orbit around focal point using orbit yaw/pitch
  cam3d.px = fx + orbitMode.orbitDist * Math.cos(orbitMode.orbitPitch) * Math.cos(orbitMode.orbitYaw);
  cam3d.py = fy + orbitMode.orbitDist * Math.cos(orbitMode.orbitPitch) * Math.sin(orbitMode.orbitYaw);
  cam3d.pz = fz + orbitMode.orbitDist * Math.sin(orbitMode.orbitPitch);
  var angles = computeLookAngles(cam3d.px, cam3d.py, cam3d.pz, fx, fy, fz);
  cam3d.yaw = angles.yaw;
  cam3d.pitch = angles.pitch;
}

function cameraToOrbit(fx, fy, fz) {
  orbitMode.focalX = fx;
  orbitMode.focalY = fy;
  orbitMode.focalZ = fz;
  var dx = cam3d.px - fx, dy = cam3d.py - fy, dz = cam3d.pz - fz;
  var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 0.001) {
    // Camera is at focal point — push out to a sensible default
    var defaultDist = 0.01;
    if (state.selected && state.selected.dist > 0) {
      defaultDist = state.selected.dist * 0.002;
    }
    d = Math.max(0.0001, Math.min(1000, defaultDist));
  }
  orbitMode.orbitDist = d;
  orbitMode.orbitYaw = Math.atan2(dy, dx);
  orbitMode.orbitPitch = Math.atan2(dz, Math.sqrt(dx * dx + dy * dy));
}

function toggleOrbitMode() {
  if (!state.mode3d) return;
  if (orbitMode.active) {
    orbitMode.active = false;
    state.dirty = true;
    return;
  }
  // Enter orbit mode — focal point is selected object or Sol
  var fx = 0, fy = 0, fz = 0, fname = 'Sol';
  if (state.selected && state.selected.wx3d !== undefined) {
    fx = state.selected.wx3d;
    fy = state.selected.wy3d;
    fz = state.selected.wz3d;
    fname = displayName(state.selected);
  }
  orbitMode.focalName = fname;
  cameraToOrbit(fx, fy, fz);
  orbitMode.active = true;
  orbitMode.focalAnim.active = false;
  state.dirty = true;
}

function animateOrbitFocal(tx, ty, tz, tname) {
  orbitMode.focalAnim.fromX = orbitMode.focalX;
  orbitMode.focalAnim.fromY = orbitMode.focalY;
  orbitMode.focalAnim.fromZ = orbitMode.focalZ;
  orbitMode.focalAnim.toX = tx;
  orbitMode.focalAnim.toY = ty;
  orbitMode.focalAnim.toZ = tz;
  orbitMode.focalAnim.toName = tname;
  orbitMode.focalAnim.duration = 1200;
  orbitMode.focalAnim.startTime = performance.now();
  orbitMode.focalAnim.active = true;
}

function lookAtTarget(targetKey, duration) {
  // Toggle tracking: click same target = stop tracking
  if (cam3d.trackTarget === targetKey) {
    cam3d.trackTarget = null;
    updateTrackingUI();
    return;
  }

  var pos = getLookTarget(targetKey);
  if (!pos) return;

  // Enable tracking — works in both orbit mode and free-fly
  cam3d.trackTarget = targetKey;
  updateTrackingUI();

  if (orbitMode.active) {
    // Keep current orbit distance — just rotate to look past focal toward target
    var fdx = pos.x - orbitMode.focalX, fdy = pos.y - orbitMode.focalY, fdz = pos.z - orbitMode.focalZ;
    var focalToTarget = Math.sqrt(fdx * fdx + fdy * fdy + fdz * fdz);
    if (focalToTarget > 1e-12) {
      // Position camera on opposite side of focal from target (focal between camera and target)
      orbitMode.orbitYaw = Math.atan2(-fdy, -fdx);
      orbitMode.orbitPitch = 0.14; // slight elevation
    }
    orbitToCamera();
    state.dirty = true;
    return;
  }

  // Free fly: just rotate in place to face the target
  var angles = computeLookAngles(cam3d.px, cam3d.py, cam3d.pz, pos.x, pos.y, pos.z);
  cam3dAnim.from = { px: cam3d.px, py: cam3d.py, pz: cam3d.pz,
    yaw: cam3d.yaw, pitch: cam3d.pitch, fov: cam3d.fov };
  cam3dAnim.to = { px: cam3d.px, py: cam3d.py, pz: cam3d.pz,
    yaw: angles.yaw, pitch: angles.pitch, fov: cam3d.fov };
  cam3dAnim.duration = duration || 1200;
  cam3dAnim.startTime = performance.now();
  cam3dAnim.active = true;
  state.dirty = true;
}

function toggle3D() {
  state.mode3d = !state.mode3d;
  var btn3d = document.getElementById('mode3d-btn');
  var presetBar = document.getElementById('cam3d-presets');

  if (state.mode3d) {
    // Save 2D state
    state.lastPanX = state.panX;
    state.lastPanY = state.panY;
    state.lastZoom = state.zoom;
    // Initialize camera: orbit selected object, or default to Earth
    if (state.selected && state.selected.wx3d !== undefined) {
      // Auto-enter orbit mode around selected object
      var sel = state.selected;
      var od = sel.dist > 0 ? sel.dist * 0.002 : 0.0001;
      od = Math.max(0.0001, Math.min(1000, od));
      orbitMode.focalX = sel.wx3d;
      orbitMode.focalY = sel.wy3d;
      orbitMode.focalZ = sel.wz3d;
      orbitMode.focalName = displayName(sel);
      orbitMode.orbitDist = od;
      orbitMode.orbitYaw = 0;
      orbitMode.orbitPitch = 0.3;
      orbitMode.active = true;
      orbitMode.focalAnim.active = false;
      cam3d.fov = 60;
      orbitToCamera();
    } else {
      var preset = cam3dPresets.earth;
      cam3d.px = preset.px; cam3d.py = preset.py; cam3d.pz = preset.pz;
      cam3d.yaw = preset.yaw; cam3d.pitch = preset.pitch; cam3d.fov = preset.fov;
    }
    btn3d.classList.add('active');
    presetBar.style.display = 'flex';
    // Hide 2D-only controls
    document.querySelector('.zoom-control').style.display = 'none';
    document.getElementById('hint').style.display = 'none';
    document.querySelector('.scale-bar').style.display = 'none';
  } else {
    // Restore 2D state
    state.panX = state.lastPanX;
    state.panY = state.lastPanY;
    state.zoom = state.lastZoom;
    slider.value = Math.round(state.zoom);
    btn3d.classList.remove('active');
    presetBar.style.display = 'none';
    cam3dAnim.active = false;
    orbitMode.active = false;
    stopTracking();
    document.querySelector('.zoom-control').style.display = '';
    document.getElementById('hint').style.display = '';
    document.querySelector('.scale-bar').style.display = '';
  }
  state.dirty = true;
  updateHash();
}

function flyCamera(presetName, duration, lookTarget) {
  var preset = cam3dPresets[presetName];
  if (!preset) return;

  // Compute orbit position around the viewpoint object
  var fx = preset.px, fy = preset.py, fz = preset.pz;
  var orbDist = standardOrbitDist(preset);

  var toX = fx + orbDist, toY = fy, toZ = fz;
  var toYaw, toPitch;

  // If a look target is specified, compute angles from the orbit position
  if (lookTarget) {
    var pos = getLookTarget(lookTarget);
    if (pos) {
      var angles = computeLookAngles(toX, toY, toZ, pos.x, pos.y, pos.z);
      toYaw = angles.yaw;
      toPitch = angles.pitch;
    } else {
      var la = computeLookAngles(toX, toY, toZ, fx, fy, fz);
      toYaw = la.yaw; toPitch = la.pitch;
    }
  } else if (cam3d.trackTarget) {
    // Look at the tracked target from new orbit position
    var tp = getLookTarget(cam3d.trackTarget);
    if (tp) {
      var la = computeLookAngles(toX, toY, toZ, tp.x, tp.y, tp.z);
      toYaw = la.yaw; toPitch = la.pitch;
    } else {
      var la = computeLookAngles(toX, toY, toZ, fx, fy, fz);
      toYaw = la.yaw; toPitch = la.pitch;
    }
  } else {
    // Look at the object we're orbiting
    var la = computeLookAngles(toX, toY, toZ, fx, fy, fz);
    toYaw = la.yaw; toPitch = la.pitch;
  }

  cam3dAnim.from = { px: cam3d.px, py: cam3d.py, pz: cam3d.pz,
    yaw: cam3d.yaw, pitch: cam3d.pitch, fov: cam3d.fov };
  cam3dAnim.to = { px: toX, py: toY, pz: toZ,
    yaw: toYaw, pitch: toPitch, fov: preset.fov };
  cam3dAnim.duration = (duration || 2000) / tourEngine.transitionSpeed;
  cam3dAnim.startTime = performance.now();
  cam3dAnim.active = true;

  // Enter orbit mode around the viewpoint
  orbitMode.focalX = fx; orbitMode.focalY = fy; orbitMode.focalZ = fz;
  orbitMode.focalName = preset.label || presetName;
  orbitMode.orbitDist = orbDist;
  orbitMode.orbitYaw = 0;
  orbitMode.orbitPitch = 0;
  orbitMode.active = true;
  orbitMode.focalAnim.active = false;
  state.dirty = true;
}

// ─── Keyboard shortcuts ─────────────────────────────────────────────

var presetKeys = { '1': 'solar', '2': 'stellar', '3': 'constellations', '4': 'galaxy', '5': 'local', '6': 'cosmic' };
document.addEventListener('keydown', function(e) {
  // Escape closes glossary even from search input
  if (e.key === 'Escape' && e.target.id === 'glossary-search-input') {
    e.preventDefault();
    e.target.blur();
    document.getElementById('glossary-panel').classList.remove('open');
    document.getElementById('glossary-toggle-btn').classList.remove('active');
    return;
  }

  // Arrow navigation in glossary search results
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.id === 'glossary-search-input') {
    e.preventDefault();
    var gBody = document.getElementById('glossary-body');
    var allEntries = gBody.querySelectorAll('.glossary-entry');
    var visibleEntries = [];
    for (var ei = 0; ei < allEntries.length; ei++) {
      if (allEntries[ei].style.display !== 'none') visibleEntries.push(allEntries[ei]);
    }
    if (visibleEntries.length === 0) return;

    // Find currently highlighted entry
    var curIdx = -1;
    for (var vi = 0; vi < visibleEntries.length; vi++) {
      if (visibleEntries[vi].classList.contains('nav-highlight')) { curIdx = vi; break; }
    }

    // Move selection
    var newIdx;
    if (e.key === 'ArrowDown') {
      newIdx = curIdx < 0 ? 0 : Math.min(curIdx + 1, visibleEntries.length - 1);
    } else {
      newIdx = curIdx <= 0 ? 0 : curIdx - 1;
    }

    // Clear old highlight, set new
    if (curIdx >= 0) {
      visibleEntries[curIdx].classList.remove('nav-highlight');
      visibleEntries[curIdx].classList.remove('expanded');
    }
    visibleEntries[newIdx].classList.add('nav-highlight');
    visibleEntries[newIdx].classList.add('expanded');
    visibleEntries[newIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Enter in glossary search: navigate to highlighted entry
  if (e.key === 'Enter' && e.target.id === 'glossary-search-input') {
    e.preventDefault();
    var highlighted = document.querySelector('.glossary-entry.nav-highlight');
    if (highlighted) {
      var gotoBtn = highlighted.querySelector('.glossary-goto');
      if (gotoBtn) gotoBtn.click();
    }
    return;
  }

  if (e.target.tagName === 'INPUT') return;

  if (e.key === '/') {
    e.preventDefault();
    var gPanel = document.getElementById('glossary-panel');
    if (!gPanel.classList.contains('open')) {
      gPanel.classList.add('open');
      document.getElementById('glossary-toggle-btn').classList.add('active');
    }
    var searchInput = document.getElementById('glossary-search-input');
    searchInput.focus();
    searchInput.select();
    return;
  }

  // Space: pause tour (if active) or toggle sim time pause
  if (e.key === ' ') {
    e.preventDefault();
    if (tourEngine.active) {
      tourEngine.togglePause();
    } else {
      simTime.paused = !simTime.paused;
      state.dirty = true;
    }
    return;
  }

  if (presetKeys[e.key]) {
    var btn = document.querySelector('.preset-btn[data-preset="' + presetKeys[e.key] + '"]');
    if (btn) btn.click();
    return;
  }

  if (e.key === 'h' || e.key === 'H') { goHome(); return; }
  if (e.key === 'v' || e.key === 'V') { toggle3D(); return; }
  if (e.key === 'o' || e.key === 'O') { toggleOrbitMode(); return; }
  if (e.key === 's' || e.key === 'S') {
    document.getElementById('scenes-btn').click(); return;
  }
  if (e.key === 'w' || e.key === 'W') { showWelcome(); return; }
  if (e.key === 'd' || e.key === 'D') { showDocs(); return; }
  if (e.key === 'l' || e.key === 'L') {
    if (state.selected && state.selected.dist > 0) startLightPulse(state.selected);
    return;
  }

  if (e.key === 't' || e.key === 'T') {
    if (tourEngine.active) {
      tourEngine.stop();
    } else {
      document.getElementById('tour-dropdown').classList.toggle('open');
    }
    return;
  }

  // Tour hotkeys when dropdown is open
  var tourDD = document.getElementById('tour-dropdown');
  if (tourDD.classList.contains('open') && e.key >= '1' && e.key <= String(tourIds.length)) {
    var tourIdx = parseInt(e.key) - 1;
    if (tourIds[tourIdx]) tourEngine.start(tourIds[tourIdx]);
    return;
  }

  if (e.key === 'Escape') {
    if (tourEngine.active) tourEngine.stop();
    else {
      document.getElementById('info-panel').classList.add('hidden');
      document.getElementById('glossary-panel').classList.remove('open');
      document.getElementById('glossary-toggle-btn').classList.remove('active');
      document.getElementById('effects-panel').classList.remove('open');
      closeTourDropdown();
    }
    return;
  }

  if (e.key === 'ArrowLeft' && tourEngine.active) {
    e.preventDefault();
    tourEngine.prevStep();
    return;
  }

  if (e.key === 'ArrowRight' && tourEngine.active) {
    e.preventDefault();
    tourEngine.nextStep();
    return;
  }

  // Arrow key panning (when not in tour)
  if (!tourEngine.active && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    var vr = getViewRadius();
    var panStep = vr * 0.15; // pan 15% of view radius per keypress
    if (e.key === 'ArrowLeft') state.panX -= panStep;
    if (e.key === 'ArrowRight') state.panX += panStep;
    if (e.key === 'ArrowUp') state.panY -= panStep;
    if (e.key === 'ArrowDown') state.panY += panStep;
    state.dirty = true;
    updateRecenterBtn();
    updateHash();
    return;
  }
});

// ─── Mobile touch ───────────────────────────────────────────────────

var touchState = { startDist: 0, startZoom: 0, pinching: false, panning: false, startX: 0, startY: 0, startPanX: 0, startPanY: 0, moved: false, startYaw: 0, startPitch: 0 };

function getTouchDist(touches) {
  var dx = touches[0].clientX - touches[1].clientX;
  var dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

canvas.addEventListener('touchstart', function(e) {
  e.preventDefault();
  dismissWelcome();
  if (e.touches.length === 2) {
    touchState.startDist = getTouchDist(e.touches);
    if (state.mode3d && orbitMode.active) {
      touchState.startZoom = orbitMode.orbitDist;
    } else {
      touchState.startZoom = state.mode3d ? cam3d.fov : state.zoom;
    }
    touchState.pinching = true;
    touchState.panning = false;
  } else if (e.touches.length === 1) {
    touchState.pinching = false;
    touchState.panning = true;
    touchState.moved = false;
    touchState.startX = e.touches[0].clientX;
    touchState.startY = e.touches[0].clientY;
    if (state.mode3d) {
      if (orbitMode.active) {
        touchState.startYaw = orbitMode.orbitYaw;
        touchState.startPitch = orbitMode.orbitPitch;
      } else {
        touchState.startYaw = cam3d.yaw;
        touchState.startPitch = cam3d.pitch;
      }
    } else {
      touchState.startPanX = state.panX;
      touchState.startPanY = state.panY;
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
  e.preventDefault();
  if (e.touches.length === 2 && touchState.pinching) {
    var dist = getTouchDist(e.touches);
    var ratio = touchState.startDist / dist;
    if (state.mode3d && orbitMode.active) {
      orbitMode.orbitDist = Math.max(1e-14, Math.min(1e8, touchState.startZoom * ratio));
      orbitToCamera();
      state.dirty = true;
    } else if (state.mode3d) {
      cam3d.fov = Math.max(5, Math.min(120, touchState.startZoom * ratio));
      state.dirty = true;
    } else {
      var logRatio = Math.log(ratio) / Math.log(2);
      var newZoom = touchState.startZoom + logRatio * 100;
      var prevZoom = state.zoom;
      state.zoom = Math.max(0, Math.min(1000, newZoom));
      panTowardTargetOnZoomIn(prevZoom, state.zoom);
      slider.value = Math.round(state.zoom);
      state.activePreset = null;
      state.dirty = true;
      if (tourEngine.active) tourEngine.stop();
    }
  } else if (e.touches.length === 1 && touchState.panning) {
    var dx = e.touches[0].clientX - touchState.startX;
    var dy = e.touches[0].clientY - touchState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) touchState.moved = true;
    if (touchState.moved) {
      if (state.mode3d && orbitMode.active) {
        var sens = cam3d.fov / 300;
        orbitMode.orbitYaw = touchState.startYaw - dx * sens * DEG2RAD;
        orbitMode.orbitPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01,
          touchState.startPitch + dy * sens * DEG2RAD));
        orbitToCamera();
        state.dirty = true;
      } else if (state.mode3d) {
        var sens = cam3d.fov / 1000;
        cam3d.yaw = touchState.startYaw - dx * sens * DEG2RAD;
        cam3d.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01,
          touchState.startPitch + dy * sens * DEG2RAD));
        stopTracking();
        state.dirty = true;
      } else {
        var scale = getScale();
        state.panX = touchState.startPanX - dx / scale;
        state.panY = touchState.startPanY - dy / scale;
        state.follow = null;
        state.dirty = true;
        updateRecenterBtn();
      }
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
  e.preventDefault();
  if (e.touches.length === 0 && touchState.panning && !touchState.moved) {
    // Single tap (no drag) — simulate click
    var touch = e.changedTouches[0];
    var clickEvent = new MouseEvent('click', {
      clientX: touch.clientX,
      clientY: touch.clientY,
      bubbles: true
    });
    canvas.dispatchEvent(clickEvent);
  }
  if (touchState.moved) updateHash();
  touchState.pinching = false;
  touchState.panning = false;
  touchState.moved = false;
}, { passive: false });

// ─── Init ──────────────────────────────────────────────────────────────

initParticles();
buildObjectNameIndex();
initObjects3D();
buildOrbitCache();
buildAsteroidCache();
initCam3dPresets();
buildTourDropdown();
buildGlossary();
buildEffectsPanel();

// 3D mode button
document.getElementById('mode3d-btn').addEventListener('click', toggle3D);

// Build 3D camera presets bar with editable slots
var activeSlotDropdown = null;

function closeSlotDropdown() {
  if (activeSlotDropdown) {
    if (activeSlotDropdown.parentNode) activeSlotDropdown.parentNode.removeChild(activeSlotDropdown);
    activeSlotDropdown = null;
  }
}

function openSlotDropdown(btn, type) {
  closeSlotDropdown();
  var dd = document.createElement('div');
  dd.className = 'cam-slot-dropdown';
  var inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = type === 'viewfrom' ? 'Search objects...' : 'Search objects/constellations...';
  dd.appendChild(inp);
  var listEl = document.createElement('div');
  dd.appendChild(listEl);

  // Build candidate list
  var candidates = [];
  if (type === 'viewfrom') {
    for (var i = 0; i < objects.length; i++) {
      if (objects[i].wx3d !== undefined) {
        candidates.push({ key: objects[i].name, label: objects[i].name, objName: objects[i].name });
      }
    }
  } else {
    // Objects
    for (var j = 0; j < objects.length; j++) {
      if (objects[j].wx3d !== undefined) {
        candidates.push({ key: 'obj:' + objects[j].name, label: objects[j].name, type: 'object', obj: objects[j].name });
      }
    }
    // Constellations
    var cKeys = Object.keys(constellationDefs);
    for (var k = 0; k < cKeys.length; k++) {
      candidates.push({ key: 'con:' + cKeys[k], label: constellationDefs[cKeys[k]].name, type: 'constellation', id: cKeys[k] });
    }
  }

  function renderList(filter) {
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    var f = (filter || '').toLowerCase();
    var shown = 0;
    for (var ci = 0; ci < candidates.length; ci++) {
      if (f && candidates[ci].label.toLowerCase().indexOf(f) < 0) continue;
      if (shown >= 20) break;
      shown++;
      var opt = document.createElement('div');
      opt.className = 'slot-option';
      opt.textContent = candidates[ci].label;
      (function(c) {
        opt.addEventListener('click', function(ev) {
          ev.stopPropagation();
          if (type === 'viewfrom') {
            // Find or create viewpoint preset
            var vpKey = c.objName.toLowerCase().replace(/[^a-z0-9]/g, '');
            // Add to cam3dPresets if needed
            var obj = null;
            for (var oi = 0; oi < objects.length; oi++) {
              if (objects[oi].name === c.objName) { obj = objects[oi]; break; }
            }
            if (obj) {
              var lookAngles2 = computeLookAngles(obj.wx3d, obj.wy3d, obj.wz3d, 0, 0, 0);
              cam3dPresets[vpKey] = { px: obj.wx3d, py: obj.wy3d, pz: obj.wz3d,
                yaw: lookAngles2.yaw, pitch: lookAngles2.pitch, fov: 60, label: c.label,
                physRadius: obj.physRadius || 0, category: obj.category };
              btn.childNodes[0].textContent = c.label;
              btn.setAttribute('data-cam-preset', vpKey);
              flyCamera(vpKey, 2000);
            }
          } else {
            // Look-at: resolve position and look
            var lookPos = null;
            if (c.type === 'constellation') {
              // Add dynamic look target
              var ltKey = 'dyn_' + c.id;
              var found = false;
              for (var li = 0; li < cam3dLookTargets.length; li++) {
                if (cam3dLookTargets[li].key === ltKey) { found = true; break; }
              }
              if (!found) {
                cam3dLookTargets.push({ key: ltKey, label: c.label, type: 'constellation', id: c.id });
              }
              btn.childNodes[0].textContent = c.label;
              btn.setAttribute('data-look-target', ltKey);
              lookAtTarget(ltKey, 1200);
            } else {
              var ltKey2 = 'dyn_' + c.obj.toLowerCase().replace(/[^a-z0-9]/g, '');
              var found2 = false;
              for (var li2 = 0; li2 < cam3dLookTargets.length; li2++) {
                if (cam3dLookTargets[li2].key === ltKey2) { found2 = true; break; }
              }
              if (!found2) {
                cam3dLookTargets.push({ key: ltKey2, label: c.label, type: 'object', obj: c.obj });
              }
              btn.childNodes[0].textContent = c.label;
              btn.setAttribute('data-look-target', ltKey2);
              lookAtTarget(ltKey2, 1200);
            }
          }
          closeSlotDropdown();
          saveSlotConfig();
        });
      })(candidates[ci]);
      listEl.appendChild(opt);
    }
    if (shown === 0) {
      var noR = document.createElement('div');
      noR.className = 'slot-option';
      noR.textContent = 'No matches';
      noR.style.color = '#555';
      listEl.appendChild(noR);
    }
  }

  renderList('');
  inp.addEventListener('input', function() { renderList(this.value); });
  inp.addEventListener('click', function(ev) { ev.stopPropagation(); });

  btn.style.position = 'relative';
  btn.appendChild(dd);
  activeSlotDropdown = dd;
  setTimeout(function() { inp.focus(); }, 50);

  // Close on outside click
  function onOutside(ev) {
    if (!dd.contains(ev.target) && ev.target !== btn) {
      closeSlotDropdown();
      document.removeEventListener('click', onOutside, true);
    }
  }
  setTimeout(function() { document.addEventListener('click', onOutside, true); }, 10);
}

function makeSlotBtn(label, type, actionAttr, actionValue) {
  var btn = document.createElement('button');
  btn.className = 'cam-preset-btn' + (type === 'lookat' ? ' cam-look-btn' : '');
  btn.textContent = label;
  btn.setAttribute(actionAttr, actionValue);

  var editCorner = document.createElement('span');
  editCorner.className = 'slot-edit';
  editCorner.textContent = '\u25bf';
  btn.appendChild(editCorner);

  editCorner.addEventListener('click', function(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    openSlotDropdown(btn, type === 'lookat' ? 'lookat' : 'viewfrom');
  });

  btn.addEventListener('click', function(ev) {
    if (ev.target === editCorner) return;
    if (type === 'lookat') {
      lookAtTarget(this.getAttribute('data-look-target'), 1200);
    } else {
      flyCamera(this.getAttribute('data-cam-preset'), 2000);
    }
  });
  return btn;
}

(function() {
  var bar = document.getElementById('cam3d-presets');

  var vpLabel = document.createElement('span');
  vpLabel.className = 'cam-label';
  vpLabel.textContent = 'View from:';
  bar.appendChild(vpLabel);

  for (var i = 0; i < cam3dViewpoints.length; i++) {
    bar.appendChild(makeSlotBtn(cam3dViewpoints[i].label, 'viewfrom', 'data-cam-preset', cam3dViewpoints[i].key));
  }

  var sep = document.createElement('span');
  sep.className = 'cam-sep';
  sep.textContent = '\u2502';
  bar.appendChild(sep);

  var laLabel = document.createElement('span');
  laLabel.className = 'cam-label';
  laLabel.textContent = 'Look at:';
  bar.appendChild(laLabel);

  for (var j = 0; j < cam3dLookTargets.length; j++) {
    bar.appendChild(makeSlotBtn(cam3dLookTargets[j].label, 'lookat', 'data-look-target', cam3dLookTargets[j].key));
  }

  var exportBtn = document.createElement('button');
  exportBtn.className = 'cam-preset-btn';
  exportBtn.textContent = '\u2B07';
  exportBtn.title = 'Export slot config to clipboard';
  exportBtn.style.cssText = 'font-size:10px;padding:4px 6px;margin-left:auto;';
  exportBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    var config = getSlotConfig();
    var json = JSON.stringify(config, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(json);
      exportBtn.textContent = '\u2713';
      setTimeout(function() { exportBtn.textContent = '\u2B07'; }, 1500);
    }
  });
  bar.appendChild(exportBtn);
})();

function getSlotConfig() {
  var bar = document.getElementById('cam3d-presets');
  var vpBtns = bar.querySelectorAll('[data-cam-preset]');
  var laBtns = bar.querySelectorAll('[data-look-target]');
  var vps = [];
  for (var i = 0; i < vpBtns.length; i++) {
    vps.push({ key: vpBtns[i].getAttribute('data-cam-preset'), label: vpBtns[i].textContent.replace('\u25BF', '').trim() });
  }
  var las = [];
  for (var j = 0; j < laBtns.length; j++) {
    las.push({ key: laBtns[j].getAttribute('data-look-target'), label: laBtns[j].textContent.replace('\u25BF', '').trim() });
  }
  return { viewpoints: vps, lookTargets: las };
}

function saveSelectedObject(name) {
  try { localStorage.setItem('cosmos_selected', name); } catch(e) {}
}

function loadSelectedObject() {
  try {
    var name = localStorage.getItem('cosmos_selected');
    if (!name) return;
    var obj = findObject(name);
    if (obj) {
      state.selected = obj;
      showInfo(obj);
      document.getElementById('info-panel').classList.remove('hidden');
    }
  } catch(e) {}
}

function saveSlotConfig() {
  try { localStorage.setItem('cosmos_cam_slots', JSON.stringify(getSlotConfig())); } catch(e) {}
}

function loadSlotConfig() {
  try {
    var raw = localStorage.getItem('cosmos_cam_slots');
    if (!raw) return;
    var config = JSON.parse(raw);
    if (!config.viewpoints || !config.lookTargets) return;
    var bar = document.getElementById('cam3d-presets');
    var vpBtns = bar.querySelectorAll('[data-cam-preset]');
    var laBtns = bar.querySelectorAll('[data-look-target]');
    for (var i = 0; i < vpBtns.length && i < config.viewpoints.length; i++) {
      var vp = config.viewpoints[i];
      vpBtns[i].setAttribute('data-cam-preset', vp.key);
      vpBtns[i].childNodes[0].textContent = vp.label;
      // Ensure preset exists
      if (!cam3dPresets[vp.key]) {
        for (var oi = 0; oi < objects.length; oi++) {
          if (objects[oi].name === vp.label && objects[oi].wx3d !== undefined) {
            var la = computeLookAngles(objects[oi].wx3d, objects[oi].wy3d, objects[oi].wz3d, 0, 0, 0);
            cam3dPresets[vp.key] = { px: objects[oi].wx3d, py: objects[oi].wy3d, pz: objects[oi].wz3d,
              yaw: la.yaw, pitch: la.pitch, fov: 60, label: vp.label,
              physRadius: objects[oi].physRadius || 0, category: objects[oi].category };
            break;
          }
        }
      }
    }
    for (var j = 0; j < laBtns.length && j < config.lookTargets.length; j++) {
      var lt = config.lookTargets[j];
      laBtns[j].setAttribute('data-look-target', lt.key);
      laBtns[j].childNodes[0].textContent = lt.label;
      // Ensure cam3dLookTargets entry exists for this key
      var ltExists = false;
      for (var lk = 0; lk < cam3dLookTargets.length; lk++) {
        if (cam3dLookTargets[lk].key === lt.key) { ltExists = true; break; }
      }
      if (!ltExists) {
        var resolved = false;
        // Try to resolve as an object name
        for (var oi2 = 0; oi2 < objects.length; oi2++) {
          if (objects[oi2].name === lt.label) {
            cam3dLookTargets.push({ key: lt.key, label: lt.label, type: 'object', obj: lt.label });
            resolved = true;
            break;
          }
        }
        // Try as constellation
        if (!resolved && constellationDefs) {
          for (var cId in constellationDefs) {
            if (constellationDefs[cId].name === lt.label) {
              cam3dLookTargets.push({ key: lt.key, label: lt.label, type: 'constellation', id: cId });
              break;
            }
          }
        }
      }
    }
  } catch(e) {}
}

loadSlotConfig();
loadSelectedObject();

// Welcome screen
var welcomeShowing = true;

function buildFeatureList(body) {
  var featTitle = document.createElement('div');
  featTitle.textContent = 'Features to try';
  featTitle.style.cssText = 'font-size:13px;font-weight:600;color:#aabbcc;margin:14px 0 8px;';
  body.appendChild(featTitle);

  var features = [
    ['V', '3D Sky View \u2014 fly to any star and see the sky from there'],
    ['O', 'Orbit Mode \u2014 in 3D, orbit around the selected object'],
    ['T', 'Guided Tours \u2014 constellation corridors, scale of the universe'],
    ['Dbl-click', 'In 3D, double-click any object to fly there'],
    ['G', 'Glossary \u2014 searchable encyclopedia of every object'],
    ['L', 'Light Pulse \u2014 watch light travel from the Sun'],
    ['D', 'How this was built \u2014 the story behind the project'],
    ['1-6', 'Zoom presets from Solar System to Great Attractor'],
    ['Scroll', 'Zoom in/out; in 3D, changes field of view'],
    ['W', 'Show this welcome screen again']
  ];

  for (var i = 0; i < features.length; i++) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin:4px 0;font-size:11px;';
    var key = document.createElement('span');
    key.textContent = features[i][0];
    key.style.cssText = 'color:#7aaaee;min-width:55px;font-weight:600;text-align:right;flex-shrink:0;';
    var desc = document.createElement('span');
    desc.textContent = features[i][1];
    desc.style.cssText = 'color:#9898b0;';
    row.appendChild(key);
    row.appendChild(desc);
    body.appendChild(row);
  }
}

function showWelcome() {
  var ip = document.getElementById('info-panel');
  var nameEl = document.getElementById('info-name');
  var typeEl = document.getElementById('info-type');
  nameEl.textContent = 'Cosmic Distance Explorer';
  typeEl.textContent = 'Click any object to learn more';

  var body = document.getElementById('info-body');
  while (body.firstChild) body.removeChild(body.firstChild);

  var intro = document.createElement('p');
  intro.textContent = 'Everything in the observable universe, plotted on a single logarithmic map centered on the Sun. From the Moon at 1.3 light-seconds to the Great Attractor at 250 million light-years.';
  body.appendChild(intro);

  var intro2 = document.createElement('p');
  intro2.style.cssText = 'margin-top:8px;color:#9898b0;font-size:11px;';
  intro2.textContent = 'Use the zoom slider, scroll wheel, or preset buttons to explore. Dashed outlines show the extent of large structures at every scale. Or select a Tour for a guided flythrough with narration.';
  body.appendChild(intro2);

  buildFeatureList(body);

  ip.classList.remove('hidden');
  welcomeShowing = true;
}

function showDocs() {
  var ip = document.getElementById('info-panel');
  var nameEl = document.getElementById('info-name');
  var typeEl = document.getElementById('info-type');
  nameEl.textContent = 'Why & How';
  typeEl.textContent = 'Press W to return to welcome';

  var body = document.getElementById('info-body');
  while (body.firstChild) body.removeChild(body.firstChild);

  var sections = [
    { title: 'Why this exists', lines: [
      'This started as a question: how do you feel the difference between 4 light-years and 4 million? Numbers alone fail \u2014 our brains flatten anything past a few thousand. A logarithmic scale compresses the incompressible, letting one scroll carry you from Earth orbit to the edge of the observable universe.',
      'The deeper motive is perspective. Standing on Betelgeuse looking back at an invisible Sun, or watching Orion dissolve from TRAPPIST-1 \u2014 these are experiences that reframe what "here" means. Every civilization in the cosmos sees different constellations. The sky is not a ceiling; it is a point of view.'
    ]},
    { title: 'How it was built', lines: [
      'It began as a single-file HTML playground \u2014 a few dozen objects on a 2D logarithmic canvas. No frameworks, no build tools, just vanilla JS in a <script> tag. That constraint turned out to be a strength: everything is inspectable, forkable, and runs anywhere.',
      'Objects accumulated in layers: solar system first, then nearby stars with real coordinates, then nebulae, clusters, and galaxies out to the Great Attractor. Each object carries its real distance and position in 3D space.',
      'The 3D Sky View came next \u2014 a perspective camera that can be placed at any object and pointed at any constellation. This revealed that constellations are corridors of unrelated stars, not flat patterns. Diffraction spikes, twinkling, nebula clouds, and galaxy disks give the 3D scene visual depth.',
      'Guided tours narrate the journey: the distance ladder explains how we measure the cosmos rung by rung; the constellations tour flies between stars to shatter the flat-sky illusion; the stellar neighborhood tour introduces the Sun\'s nearest neighbors.',
      'Smart filtering keeps the scene readable \u2014 objects are scored by apparent brightness and category, overlapping dots are culled, and constellation members are boosted when the camera faces them. Sol stays bracketed in gold as an anchor from any distance.'
    ]},
    { title: 'What\'s ahead', lines: [
      'Time simulation \u2014 wind the clock forward and backward to see stars move, constellations dissolve, and galaxies collide. Spectrum view \u2014 toggle between visible light, infrared, and other bands. Volumetric 3D rendering \u2014 objects with actual shape and structure instead of point-like dots. Real imagery in the glossary for famous objects. And eventually, a server-backed version for thousands of objects with live data.'
    ]}
  ];

  for (var s = 0; s < sections.length; s++) {
    var sec = sections[s];
    var heading = document.createElement('div');
    heading.textContent = sec.title;
    heading.style.cssText = 'font-size:13px;font-weight:600;color:#aabbcc;margin:' + (s === 0 ? '4' : '14') + 'px 0 6px;';
    body.appendChild(heading);

    for (var p = 0; p < sec.lines.length; p++) {
      var para = document.createElement('p');
      para.textContent = sec.lines[p];
      para.style.cssText = 'font-size:11px;color:#9898b0;margin:4px 0;line-height:1.5;';
      body.appendChild(para);
    }
  }

  ip.classList.remove('hidden');
  welcomeShowing = true;
}

function dismissWelcome() {
  if (!welcomeShowing) return;
  welcomeShowing = false;
  document.getElementById('info-panel').classList.add('hidden');
}

showWelcome();

resize();
state.zoom = presets.solar.slider;
slider.value = state.zoom;
state.activePreset = 'solar';

// Read URL hash if present
readHash();

// Start animation loop
requestAnimationFrame(animationLoop);

