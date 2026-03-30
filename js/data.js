// ─── Constants ─────────────────────────────────────────────────────────

var AU_IN_LY = 1 / 63241;
var MLY = 1e6;
var KM_IN_LY = 1 / 9.461e12;  // 1 km in light-years
var ORBIT_CLOSE_KM = 50000;    // 50,000 km — planets and moons
var ORBIT_FAR_KM = 700000;    // 700,000 km — stars, nebulae, galaxies
var ORBIT_CLOSE_LY = ORBIT_CLOSE_KM * KM_IN_LY;
var ORBIT_FAR_LY = ORBIT_FAR_KM * KM_IN_LY;
var ORBIT_RADIUS_MULT = 5;    // orbit at 5× physRadius — object fills ~1/3 of viewport

var MIN_LOG = Math.log10(0.000000005); // ~0.0003 AU, close enough to see planet surface details
var MAX_LOG = Math.log10(400 * MLY);

// ─── Galactic dynamics ────────────────────────────────────────────────

var GAL_CENTER_X = -26000;          // Sgr A* x-position in ly
var GAL_CENTER_Y = 0;               // Sgr A* y-position in ly
var GAL_V_CIRC = 7.33e-4;           // flat rotation curve: 220 km/s in ly/yr
var GAL_PATTERN_SPEED = 2.05e-8;    // spiral arm pattern angular speed (rad/yr) — ~20 km/s/kpc
var GAL_Z_PERIOD = 64e6;            // Sun's vertical oscillation period (years)
var GAL_SUN_Z = 65;                 // Sun's current height above midplane (ly)
var GAL_SUN_Z_AMP = 250;            // Sun's vertical oscillation amplitude (ly)

// ─── Effects settings ──────────────────────────────────────────────────

var effects = { twinkling: true, warpStreaks: true, glowIntensity: 1.0, flowLines: true, ambientParticles: true, orbits: true, overlayStyle: 'albedo', orbitalPlanes: true, occlusion: false };

// ─── Overlay layer definitions ────────────────────────────────────────

var defaultLayers = [
  { ratio: 0.3, color: '#ff4400', label: 'Core' },
  { ratio: 0.7, color: '#cc6633', label: 'Mantle' },
  { ratio: 1.0, color: '#888888', label: 'Surface' }
];

// Category-based layer defaults for objects without individual entries
var categoryLayers = {
  stellar: [
    { ratio: 0.12, color: '#ffcc00', label: 'Core (fusion)' },
    { ratio: 0.45, color: '#ffaa33', label: 'Radiative zone' },
    { ratio: 0.85, color: '#ffdd55', label: 'Convective zone' },
    { ratio: 1.0, color: '#ffee88', label: 'Photosphere' }
  ],
  stellar_giant: [
    { ratio: 0.02, color: '#ffcc00', label: 'Inert core' },
    { ratio: 0.08, color: '#ff8800', label: 'Shell burning' },
    { ratio: 0.6, color: '#ff6633', label: 'Convective envelope' },
    { ratio: 1.0, color: '#ff4422', label: 'Extended atmosphere' }
  ],
  stellar_reddwarf: [
    { ratio: 0.15, color: '#cc4400', label: 'Core (fusion)' },
    { ratio: 1.0, color: '#dd5533', label: 'Convective zone' }
  ],
  stellar_whitedwarf: [
    { ratio: 0.8, color: '#aabbcc', label: 'Degenerate carbon/oxygen' },
    { ratio: 0.95, color: '#ccddee', label: 'Helium layer' },
    { ratio: 1.0, color: '#eeeeff', label: 'Thin hydrogen atmosphere' }
  ],
  nebula: [
    { ratio: 0.2, color: '#553366', label: 'Dense core' },
    { ratio: 0.6, color: '#7744aa', label: 'Ionized gas' },
    { ratio: 1.0, color: '#9966cc', label: 'Diffuse envelope' }
  ],
  cluster: [
    { ratio: 0.3, color: '#ffcc66', label: 'Dense core' },
    { ratio: 0.7, color: '#ddaa44', label: 'Half-light radius' },
    { ratio: 1.0, color: '#aa8833', label: 'Tidal boundary' }
  ],
  galaxy: [
    { ratio: 0.05, color: '#ffcc44', label: 'Supermassive black hole' },
    { ratio: 0.15, color: '#ddaa55', label: 'Bulge' },
    { ratio: 0.7, color: '#8899bb', label: 'Disk / spiral arms' },
    { ratio: 1.0, color: '#445577', label: 'Dark matter halo' }
  ],
  exotic_blackhole: [
    { ratio: 0.15, color: '#111111', label: 'Event horizon' },
    { ratio: 0.4, color: '#222222', label: 'Ergosphere' },
    { ratio: 0.7, color: '#ff6600', label: 'Accretion disk' },
    { ratio: 1.0, color: '#ffaa44', label: 'Relativistic jets' }
  ],
  exotic_neutronstar: [
    { ratio: 0.3, color: '#666688', label: 'Superfluid core' },
    { ratio: 0.7, color: '#8888aa', label: 'Nuclear pasta mantle' },
    { ratio: 0.9, color: '#aaaacc', label: 'Neutron-rich crust' },
    { ratio: 1.0, color: '#ccccee', label: 'Iron surface' }
  ],
  cosmic: [
    { ratio: 0.1, color: '#ffaa33', label: 'Central galaxies' },
    { ratio: 0.4, color: '#886644', label: 'Intracluster medium' },
    { ratio: 1.0, color: '#334455', label: 'Dark matter halo' }
  ]
};

var objectLayers = {
  'Sun (You Are Here)': [
    { ratio: 0.25, color: '#ffaa00', label: 'Core' },
    { ratio: 0.5, color: '#ffcc33', label: 'Radiative zone' },
    { ratio: 0.85, color: '#ffdd55', label: 'Convective zone' },
    { ratio: 1.0, color: '#ffee88', label: 'Photosphere' }
  ],
  'Earth': [
    { ratio: 0.18, color: '#ff3300', label: 'Inner core' },
    { ratio: 0.35, color: '#ff6600', label: 'Outer core' },
    { ratio: 0.85, color: '#cc6633', label: 'Mantle' },
    { ratio: 1.0, color: '#4488cc', label: 'Crust' }
  ],
  'Mars': [
    { ratio: 0.25, color: '#cc4400', label: 'Core' },
    { ratio: 0.7, color: '#aa5533', label: 'Mantle' },
    { ratio: 1.0, color: '#cc6644', label: 'Crust' }
  ],
  'Jupiter': [
    { ratio: 0.15, color: '#aa6600', label: 'Rocky core' },
    { ratio: 0.5, color: '#886644', label: 'Metallic hydrogen' },
    { ratio: 0.8, color: '#bb8855', label: 'Liquid hydrogen' },
    { ratio: 1.0, color: '#d4a56a', label: 'Atmosphere' }
  ],
  'Saturn': [
    { ratio: 0.15, color: '#997744', label: 'Rocky core' },
    { ratio: 0.45, color: '#887755', label: 'Metallic hydrogen' },
    { ratio: 0.75, color: '#bbaa77', label: 'Liquid hydrogen' },
    { ratio: 1.0, color: '#ddcc99', label: 'Atmosphere' }
  ],
  'Venus': [
    { ratio: 0.3, color: '#ff5500', label: 'Core' },
    { ratio: 0.85, color: '#cc7744', label: 'Mantle' },
    { ratio: 1.0, color: '#eebb66', label: 'Atmosphere' }
  ],
  'Moon': [
    { ratio: 0.2, color: '#666655', label: 'Core' },
    { ratio: 0.7, color: '#888877', label: 'Mantle' },
    { ratio: 1.0, color: '#aaaaaa', label: 'Crust' }
  ],
  'Uranus': [
    { ratio: 0.2, color: '#556677', label: 'Rocky core' },
    { ratio: 0.5, color: '#668899', label: 'Water/ammonia ice' },
    { ratio: 0.8, color: '#77aabb', label: 'Hydrogen/helium' },
    { ratio: 1.0, color: '#88ccdd', label: 'Atmosphere' }
  ],
  'Neptune': [
    { ratio: 0.2, color: '#334466', label: 'Rocky core' },
    { ratio: 0.5, color: '#446688', label: 'Water/ammonia ice' },
    { ratio: 0.8, color: '#5588aa', label: 'Hydrogen/helium' },
    { ratio: 1.0, color: '#4466cc', label: 'Atmosphere' }
  ],
  'Mercury': [
    { ratio: 0.4, color: '#cc6633', label: 'Iron core' },
    { ratio: 0.85, color: '#aa8866', label: 'Silicate mantle' },
    { ratio: 1.0, color: '#b5a08a', label: 'Crust' }
  ],
  'Pluto': [
    { ratio: 0.3, color: '#887766', label: 'Rocky core' },
    { ratio: 0.7, color: '#998877', label: 'Water ice mantle' },
    { ratio: 1.0, color: '#ccbbaa', label: 'Nitrogen ice crust' }
  ]
};

// ─── Orbital elements (J2000 epoch) ──────────────────────────────────
// sma = semi-major axis (AU), ecc = eccentricity, inc = inclination (deg),
// lan = longitude of ascending node (deg), aop = argument of perihelion (deg),
// M0 = mean anomaly at J2000 (deg), period = orbital period (days)

var orbitalPlaneData = {
  'Mercury':  { sma: 0.387,  ecc: 0.2056, inc: 7.00,  lan: 48.33,  aop: 29.12,  M0: 174.79, period: 87.97 },
  'Venus':    { sma: 0.723,  ecc: 0.0068, inc: 3.39,  lan: 76.68,  aop: 54.85,  M0: 50.42,  period: 224.70 },
  'Earth':    { sma: 1.000,  ecc: 0.0167, inc: 0.00,  lan: 0.0,    aop: 102.94, M0: 357.53, period: 365.256 },
  'Mars':     { sma: 1.524,  ecc: 0.0934, inc: 1.85,  lan: 49.56,  aop: 286.50, M0: 19.37,  period: 686.97 },
  'Ceres':    { sma: 2.767,  ecc: 0.0758, inc: 10.59, lan: 80.33,  aop: 73.60,  M0: 291.4,  period: 1681.6 },
  'Jupiter':  { sma: 5.203,  ecc: 0.0484, inc: 1.30,  lan: 100.46, aop: 273.87, M0: 20.02,  period: 4332.59 },
  'Saturn':   { sma: 9.537,  ecc: 0.0539, inc: 2.49,  lan: 113.72, aop: 339.39, M0: 317.02, period: 10759.22 },
  'Uranus':   { sma: 19.19,  ecc: 0.0473, inc: 0.77,  lan: 74.00,  aop: 96.73,  M0: 142.24, period: 30688.5 },
  'Neptune':  { sma: 30.07,  ecc: 0.0086, inc: 1.77,  lan: 131.78, aop: 273.19, M0: 256.23, period: 60182.0 },
  'Pluto':    { sma: 39.48,  ecc: 0.2488, inc: 17.14, lan: 110.30, aop: 113.76, M0: 14.53,  period: 90560.0 }
};

// ─── Asteroid belt ───────────────────────────────────────────────────

var asteroidBeltConfig = {
  innerAU: 2.1,
  outerAU: 3.3,
  count: 800,
  color: '#887766',
  kirkwoodGaps: [
    { au: 2.50, width: 0.04 },
    { au: 2.82, width: 0.03 },
    { au: 2.95, width: 0.03 },
    { au: 3.28, width: 0.04 }
  ]
};

// ─── Rotation data ───────────────────────────────────────────────────
// rotPeriod = sidereal rotation period (hours), tilt = axial tilt (deg)
// Negative rotPeriod = retrograde rotation (Venus, Uranus)

var rotationData = {
  'Sun (You Are Here)': { rotPeriod: 609.12,   tilt: 7.25 },
  'Mercury':            { rotPeriod: 1407.6,   tilt: 0.034 },
  'Venus':              { rotPeriod: -5832.5,  tilt: 177.4 },
  'Earth':              { rotPeriod: 23.934,   tilt: 23.44 },
  'Moon':               { rotPeriod: 655.7,    tilt: 6.68 },
  'Mars':               { rotPeriod: 24.623,   tilt: 25.19 },
  'Jupiter':            { rotPeriod: 9.925,    tilt: 3.13 },
  'Saturn':             { rotPeriod: 10.656,   tilt: 26.73 },
  'Uranus':             { rotPeriod: -17.24,   tilt: 97.77 },
  'Neptune':            { rotPeriod: 16.11,    tilt: 28.32 },
  'Pluto':              { rotPeriod: -153.29,  tilt: 122.53 },
  'Charon':             { rotPeriod: 153.29,   tilt: 0.0 }
};

// ─── Proper motion data ─────────────────────────────────────────────
// pmRA = μα* (mas/yr, includes cos(dec) factor), pmDec (mas/yr), rv (km/s, positive = receding)

var properMotionData = {
  'Proxima Centauri':    { pmRA: -3781.74, pmDec: 769.77,  rv: -21.7 },
  '\u03b1 Centauri A':   { pmRA: -3679.25, pmDec: 473.67,  rv: -21.4 },
  '\u03b1 Centauri B':   { pmRA: -3614.39, pmDec: 802.98,  rv: -18.6 },
  "Barnard's Star":      { pmRA: -798.58,  pmDec: 10328.12, rv: -110.6 },
  'Wolf 359':            { pmRA: -3842,    pmDec: -2725,   rv: 19.3 },
  'Sirius':              { pmRA: -546.01,  pmDec: -1223.14, rv: -5.5 },
  'Ross 154':            { pmRA: 636.7,    pmDec: -191.2,  rv: -10.7 },
  'Tau Ceti':            { pmRA: -1721.94, pmDec: 854.17,  rv: -16.4 },
  'Procyon':             { pmRA: -714.59,  pmDec: -1036.8, rv: -3.2 },
  'Vega':                { pmRA: 200.94,   pmDec: 286.23,  rv: -13.9 },
  'Arcturus':            { pmRA: -1093.45, pmDec: -1999.4, rv: -5.2 },
  'Aldebaran':           { pmRA: 63.45,    pmDec: -189.94, rv: 54.3 },
  'Polaris':             { pmRA: 44.48,    pmDec: -11.85,  rv: -17.4 },
  'Betelgeuse':          { pmRA: 24.95,    pmDec: 9.56,    rv: 21.9 },
  'Rigel':               { pmRA: 1.31,     pmDec: -0.56,   rv: 17.8 },
  'Deneb':               { pmRA: 1.56,     pmDec: 1.55,    rv: -4.5 },
  'Canopus':             { pmRA: 19.99,    pmDec: 23.67,   rv: 20.3 },
  'Antares':             { pmRA: -12.11,   pmDec: -23.30,  rv: -3.4 },
  // Big Dipper — UMa Moving Group (5 share motion, 2 diverge)
  'Dubhe':               { pmRA: -134.11,  pmDec: -34.70,  rv: -9.3 },
  'Merak':               { pmRA: 81.43,    pmDec: 33.49,   rv: -12.0 },
  'Phecda':              { pmRA: -12.20,   pmDec: 13.60,   rv: -12.6 },
  'Megrez':              { pmRA: 104.11,   pmDec: 7.30,    rv: -13.4 },
  'Alioth':              { pmRA: 111.74,   pmDec: -8.99,   rv: -9.3 },
  'Mizar':               { pmRA: 121.23,   pmDec: -22.01,  rv: -6.3 },
  'Alkaid':              { pmRA: -121.23,  pmDec: -15.56,  rv: -10.9 }
};

// Galaxy peculiar velocities (vx, vy, vz in ly/yr)
// Converted from km/s: 1 km/s ≈ 1.057e-4 ly/yr
// Galaxy motion: 'approach' = radial approach speed in ly/yr (collision model)
// 'orbit' = circular orbit around MW {dist, period} in ly and years
var galaxyMotion = {
  'Andromeda (M31)':          { approach: 0.01160 },          // 110 km/s, merger in ~4.5 Gyr
  'Triangulum (M33)':         { approach: 0.00465 },          // 44 km/s toward MW
  'Large Magellanic Cloud':   { orbit: { dist: 163000, period: 1.5e9 } },
  'Small Magellanic Cloud':   { orbit: { dist: 200000, period: 2.0e9 } },
  'Sagittarius Dwarf':        { orbit: { dist: 70000,  period: 0.9e9 } },
  'Canis Major Dwarf':        { orbit: { dist: 42000,  period: 0.6e9 } }
};

// Hubble constant in ly/yr per ly (H0 ≈ 70 km/s/Mpc)
var HUBBLE_RATE = 7.2e-12;

// ─── Time state ──────────────────────────────────────────────────────

var simTime = {
  epoch: Date.now(),         // real-world epoch when sim started
  multiplier: 1,             // days-per-day (same numeric value as seconds-per-second)
  paused: false,
  J2000: Date.UTC(2000, 0, 1, 12, 0, 0), // J2000.0 epoch in ms
  simDaysAtEpoch: (Date.now() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000 // accumulated sim days at epoch
};

// ─── Category visibility ranges ────────────────────────────────────────

var catRanges = {
  solar: [0, 0.3],
  stellar: [0.3, 2000],
  nebula: [50, 150000],
  cluster: [200, 200000],
  exotic: [50, 250000],
  galaxy: [200, 250000],
  local: [8000, 15e6],
  cosmic: [2e6, 400 * MLY]
};

// ─── Presets ──────────────────────────────────────────────────────────

var presets = {
  solar:          { vr: 0.00004 },
  oort:           { vr: 3 },
  stellar:        { vr: 18 },
  constellations: { vr: 600 },
  galaxy:         { vr: 90000 },
  satellites:     { vr: 300000 },
  local:          { vr: 3.5 * MLY },
  virgo:          { vr: 80 * MLY },
  cosmic:         { vr: 350 * MLY }
};

// ─── Regions ──────────────────────────────────────────────────────────

var regions = [
  { name: "Oort Cloud", cx: 0, cy: 0, rx: 1.58, ry: 1.58,
    color: "rgba(80,80,120,0.03)", stroke: "rgba(80,80,120,0.12)", labelColor: "rgba(80,80,120,0.35)",
    minVR: 0.01, maxVR: 10, desc: "~1.58 ly -- Sun's gravitational edge" },
  { name: "10 Light-Year Radius", cx: 0, cy: 0, rx: 10, ry: 10,
    color: "rgba(255,255,255,0.01)", stroke: "rgba(255,255,255,0.06)", labelColor: "rgba(255,255,255,0.15)",
    minVR: 3, maxVR: 50, desc: "12 known star systems" },
  { name: "Stellar Neighborhood", cx: 0, cy: 0, rx: 20, ry: 20,
    color: "rgba(255,221,68,0.015)", stroke: "rgba(255,221,68,0.1)", labelColor: "rgba(255,221,68,0.3)",
    minVR: 50, maxVR: 5000 },
  { name: "Milky Way Disk", cx: -26000, cy: 0, rx: 52500, ry: 52500,
    color: "rgba(100,140,200,0.025)", stroke: "rgba(100,140,200,0.1)", labelColor: "rgba(100,140,200,0.35)",
    minVR: 2000, maxVR: 600000, desc: "~105,000 ly diameter" },
  { name: "Milky Way Halo", cx: -26000, cy: 0, rx: 130000, ry: 130000,
    color: "rgba(100,120,180,0.01)", stroke: "rgba(100,120,180,0.06)", labelColor: "rgba(100,120,180,0.2)",
    minVR: 30000, maxVR: 1000000, desc: "~260,000 ly -- globular clusters" },
  { name: "Milky Way", cx: 0, cy: 0, rx: 52500, ry: 52500,
    color: "rgba(255,221,68,0.015)", stroke: "rgba(255,221,68,0.08)", labelColor: "rgba(255,221,68,0.25)",
    minVR: 600000, maxVR: 20 * MLY },
  { name: "Andromeda (disk)", cx: -1.5 * MLY, cy: -2.0 * MLY, rx: 110000, ry: 60000,
    color: "rgba(187,170,238,0.02)", stroke: "rgba(187,170,238,0.08)", labelColor: "rgba(187,170,238,0.0)",
    minVR: 300000, maxVR: 20 * MLY, rotation: -0.4 },
  { name: "Local Group", cx: -0.5 * MLY, cy: -0.5 * MLY, rx: 5 * MLY, ry: 4.5 * MLY,
    color: "rgba(150,150,220,0.012)", stroke: "rgba(150,150,220,0.06)", labelColor: "rgba(150,150,220,0.22)",
    minVR: 1 * MLY, maxVR: 100 * MLY, desc: "~10 Mly, ~80+ galaxies" },
  { name: "Virgo Supercluster", cx: -20 * MLY, cy: -18 * MLY, rx: 55 * MLY, ry: 45 * MLY,
    color: "rgba(200,170,255,0.008)", stroke: "rgba(200,170,255,0.05)", labelColor: "rgba(200,170,255,0.18)",
    minVR: 15 * MLY, maxVR: 500 * MLY, desc: "~110 Mly diameter" },
  { name: "Laniakea Supercluster", cx: -70 * MLY, cy: -80 * MLY, rx: 260 * MLY, ry: 240 * MLY,
    color: "rgba(170,136,204,0.005)", stroke: "rgba(170,136,204,0.04)", labelColor: "rgba(170,136,204,0.15)",
    minVR: 80 * MLY, maxVR: 600 * MLY, desc: "~520 Mly -- 'immense heaven'" }
];

// ─── Objects ──────────────────────────────────────────────────────────

var objects = [
  // Solar
  { name: "Sun", x: 0, y: 0, dist: 0, radius: 4, color: "#ffdd44", glow: "#ffdd4466",
    type: "Star (G2V)", category: "solar", physRadius: 7.35e-8, visRange: [0, 250],
    facts: [["Type", "G2V main-sequence"], ["Mass", "1 solar mass"], ["Age", "~4.6 billion years"]],
    desc: "Our home star. A middle-aged yellow dwarf containing 99.86% of the solar system's mass." },
  { name: "Earth", x: AU_IN_LY, y: 0, dist: AU_IN_LY, radius: 2.5, color: "#4488cc", glow: "#4488cc44",
    type: "Planet", category: "solar", physRadius: 6.74e-10,
    facts: [["Distance from Sun", "1 AU (8.3 light-min)"], ["Orbital period", "365.25 days"]],
    desc: "Our home. At 1 AU from the Sun -- just 8 light-minutes." },
  { name: "Moon", x: AU_IN_LY * 1.08, y: 0.12 * AU_IN_LY, dist: AU_IN_LY, radius: 1.8, color: "#ccccbb", glow: "#ccccbb33",
    type: "Natural satellite", category: "solar", physRadius: 1.84e-10,
    facts: [["Distance from Earth", "384,400 km (1.28 light-sec)"], ["Orbital period", "27.3 days"], ["Diameter", "3,474 km"]],
    desc: "Earth's only natural satellite. The Moon stabilizes Earth's axial tilt and drives the tides. It is the only celestial body beyond Earth visited by humans." },
  { name: "Mercury", x: 0.39 * AU_IN_LY, y: -0.22 * AU_IN_LY, dist: 0.39 * AU_IN_LY, radius: 1.5, color: "#b5a08a", glow: "#b5a08a33",
    type: "Planet", category: "solar", physRadius: 2.578e-10,
    facts: [["Distance from Sun", "0.39 AU (3.2 light-min)"], ["Orbital period", "88 days"], ["Surface temp", "-170 to 430 \u00b0C"]],
    desc: "The smallest planet and closest to the Sun. Its year lasts just 88 Earth days." },
  { name: "Venus", x: -0.15 * AU_IN_LY, y: 0.70 * AU_IN_LY, dist: 0.72 * AU_IN_LY, radius: 2.2, color: "#e8c06a", glow: "#e8c06a44",
    type: "Planet", category: "solar", physRadius: 6.394e-10,
    facts: [["Distance from Sun", "0.72 AU (6 light-min)"], ["Orbital period", "225 days"], ["Surface temp", "~465 \u00b0C"]],
    desc: "Earth's 'evil twin.' A runaway greenhouse effect makes it the hottest planet in the solar system." },
  { name: "Mars", x: -1.20 * AU_IN_LY, y: 0.90 * AU_IN_LY, dist: 1.52 * AU_IN_LY, radius: 1.8, color: "#cc6644", glow: "#cc664433",
    type: "Planet", category: "solar", physRadius: 3.581e-10,
    facts: [["Distance from Sun", "1.52 AU (12.7 light-min)"], ["Orbital period", "687 days"], ["Moons", "Phobos, Deimos"]],
    desc: "The Red Planet. Home to Olympus Mons, the tallest volcano in the solar system." },
  { name: "Ceres", x: 2.77 * AU_IN_LY, y: 0, dist: 2.77 * AU_IN_LY, radius: 0.8, color: "#aaa08a", glow: "#aaa08a22",
    type: "Dwarf planet", category: "solar", physRadius: 4.98e-11,
    facts: [["Distance from Sun", "2.77 AU (23 light-min)"], ["Orbital period", "4.6 years"], ["Diameter", "946 km"]],
    desc: "The largest object in the asteroid belt and the closest dwarf planet to the Sun. Dawn revealed bright salt deposits hinting at a subsurface ocean." },
  { name: "Jupiter", x: 3.5 * AU_IN_LY, y: 3.8 * AU_IN_LY, dist: 5.2 * AU_IN_LY, radius: 3, color: "#d4a56a", glow: "#d4a56a44",
    type: "Planet", category: "solar", physRadius: 7.37e-9,
    facts: [["Distance from Sun", "5.2 AU (43 light-min)"], ["Orbital period", "11.9 years"], ["Mass", "318x Earth"]],
    desc: "The solar system's giant. More massive than all other planets combined." },
  { name: "Saturn", x: -6.0 * AU_IN_LY, y: 7.3 * AU_IN_LY, dist: 9.58 * AU_IN_LY, radius: 2.8, color: "#e8d088", glow: "#e8d08844",
    type: "Planet", category: "solar", physRadius: 6.153e-9,
    facts: [["Distance from Sun", "9.58 AU (80 light-min)"], ["Orbital period", "29.5 years"], ["Rings", "Mostly ice particles"]],
    desc: "The ringed world. Its iconic rings span 280,000 km but are only ~10 meters thick." },
  { name: "Uranus", x: 12.0 * AU_IN_LY, y: -14.0 * AU_IN_LY, dist: 19.2 * AU_IN_LY, radius: 2, color: "#88ccdd", glow: "#88ccdd33",
    type: "Planet", category: "solar", physRadius: 2.679e-9,
    facts: [["Distance from Sun", "19.2 AU (2.7 light-hr)"], ["Orbital period", "84 years"], ["Axial tilt", "98\u00b0"]],
    desc: "Tilted nearly on its side, this ice giant rolls around the Sun like a ball." },
  { name: "Neptune", x: -20.0 * AU_IN_LY, y: -22.0 * AU_IN_LY, dist: 30.07 * AU_IN_LY, radius: 2, color: "#4466cc", glow: "#4466cc33",
    type: "Planet", category: "solar", physRadius: 2.601e-9,
    facts: [["Distance from Sun", "30 AU (4.2 light-hr)"], ["Orbital period", "165 years"], ["Winds", "Up to 2,100 km/h"]],
    desc: "The outermost planet. Its winds are the fastest in the solar system." },
  { name: "Pluto", x: 25.0 * AU_IN_LY, y: 30.0 * AU_IN_LY, dist: 39.5 * AU_IN_LY, radius: 1, color: "#ccbbaa", glow: "#ccbbaa22",
    type: "Dwarf planet", category: "solar", physRadius: 1.256e-10,
    facts: [["Distance from Sun", "39.5 AU (5.5 light-hr)"], ["Orbital period", "248 years"], ["Heart feature", "Tombaugh Regio"]],
    desc: "Once the 9th planet, now classified as a dwarf planet. New Horizons revealed its heart-shaped nitrogen ice plain in 2015." },
  { name: "Charon", x: 25.0 * AU_IN_LY + 1.31e-9, y: 30.0 * AU_IN_LY + 0.8e-9, dist: 39.5 * AU_IN_LY, radius: 0.7, color: "#aa9988", glow: "#aa998822",
    type: "Natural satellite", category: "solar", physRadius: 6.39e-11,
    facts: [["Distance from Pluto", "19,571 km"], ["Orbital period", "6.39 days"], ["Diameter", "1,212 km"]],
    desc: "Pluto's largest moon, so big relative to Pluto that they orbit a common center of gravity above Pluto's surface. The pair are sometimes called a double dwarf planet. New Horizons revealed canyons, mountains, and a dark polar cap nicknamed Mordor." },

  // Lagrange Points (positions computed dynamically in updatePlanetPositions)
  { name: "L1", x: AU_IN_LY * 0.99, y: 0, dist: AU_IN_LY, radius: 0.6, color: "#5588aa", glow: "#5588aa22",
    type: "Lagrange point", category: "solar", visRange: [0, 0.01],
    facts: [["Location", "~1.5M km sunward of Earth"], ["Spacecraft", "SOHO, ACE, DSCOVR"], ["Stability", "Unstable -- requires station-keeping"]],
    desc: "The first Sun-Earth Lagrange point, where gravity and orbital mechanics balance. Spacecraft here have an uninterrupted view of the Sun, making L1 ideal for solar observation and space weather monitoring." },
  { name: "L2", x: AU_IN_LY * 1.01, y: 0, dist: AU_IN_LY, radius: 0.6, color: "#5588aa", glow: "#5588aa22",
    type: "Lagrange point", category: "solar", visRange: [0, 0.01],
    facts: [["Location", "~1.5M km anti-sunward of Earth"], ["Spacecraft", "JWST, Gaia, Planck, Euclid"], ["Stability", "Unstable -- requires station-keeping"]],
    desc: "The second Sun-Earth Lagrange point, behind Earth from the Sun. JWST orbits here, where Earth, Sun, and Moon are all on one side, providing a stable thermal environment and unobstructed deep-space view." },
  { name: "L3", x: -AU_IN_LY, y: 0, dist: AU_IN_LY, radius: 0.5, color: "#5588aa", glow: "#5588aa22",
    type: "Lagrange point", category: "solar", visRange: [0, 0.005],
    facts: [["Location", "Opposite side of Sun from Earth"], ["Stability", "Unstable"], ["Note", "No spacecraft stationed here"]],
    desc: "On the far side of the Sun from Earth -- the stuff of science fiction ('Counter-Earth'). In reality, slightly unstable and of limited practical use. No spacecraft has ever been sent here." },
  { name: "L4", x: AU_IN_LY * 0.5, y: AU_IN_LY * 0.866, dist: AU_IN_LY, radius: 0.5, color: "#5588aa", glow: "#5588aa22",
    type: "Lagrange point", category: "solar", visRange: [0, 0.01],
    facts: [["Location", "60\u00b0 ahead of Earth in orbit"], ["Stability", "Stable (with Coriolis forces)"], ["Asteroids", "Earth Trojan 2010 TK7"]],
    desc: "60 degrees ahead of Earth in its orbit. One of two gravitationally stable Lagrange points where objects can persist indefinitely. Earth's first Trojan asteroid, 2010 TK7, was discovered here in 2010." },
  { name: "L5", x: AU_IN_LY * 0.5, y: -AU_IN_LY * 0.866, dist: AU_IN_LY, radius: 0.5, color: "#5588aa", glow: "#5588aa22",
    type: "Lagrange point", category: "solar", visRange: [0, 0.01],
    facts: [["Location", "60\u00b0 behind Earth in orbit"], ["Stability", "Stable (with Coriolis forces)"], ["Note", "Proposed site for future space habitats"]],
    desc: "60 degrees behind Earth in its orbit. Like L4, gravitationally stable. The L5 Society (now part of the National Space Society) once advocated building space colonies at this point." },

  // JWST (position computed dynamically at L2 in updatePlanetPositions)
  { name: "JWST", x: AU_IN_LY * 1.01, y: 0, dist: AU_IN_LY, radius: 1.2, color: "#ddaa44", glow: "#ddaa4444",
    type: "Space telescope", category: "solar", physRadius: 1.4e-12, visRange: [0, 0.01],
    facts: [["Launched", "December 25, 2021"], ["Mirror", "6.5 m, 18 gold hexagonal segments"], ["Location", "Sun-Earth L2 (~1.5M km from Earth)"], ["Wavelength", "0.6--28.3 \u00b5m (near- to mid-infrared)"], ["Sunshield", "Tennis court-sized, 5 layers"]],
    desc: "The James Webb Space Telescope orbits the Sun-Earth L2 point, using a 6.5-meter gold-coated mirror to peer deeper into the universe's past than any telescope before it. Its infrared vision reveals the first galaxies, stellar nurseries hidden in dust, and atmospheres of exoplanets.",
    gallery: [
      { src: "img/jwst-deep-field.jpg", title: "First Deep Field",
        text: "Released July 12, 2022 -- humanity's deepest infrared view of the universe. The galaxy cluster SMACS 0723 acts as a gravitational lens, bending light from galaxies behind it that formed just 600 million years after the Big Bang. Thousands of galaxies appear in a patch of sky the size of a grain of sand held at arm's length." },
      { src: "img/jwst-pillars.jpg", title: "Pillars of Creation",
        text: "JWST's near-infrared camera cuts through the dust of the Eagle Nebula to reveal newborn stars hidden inside these towering columns of gas. The pillars are about 5 light-years tall. Some protostars are just a few hundred thousand years old -- cosmic infants compared to our 4.6-billion-year-old Sun." },
      { src: "img/jwst-carina.jpg", title: "Cosmic Cliffs",
        text: "The edge of a stellar nursery in the Carina Nebula, 7,600 light-years away. Intense UV radiation from young massive stars above the frame is sculpting these cliffs of gas and dust, triggering new star formation along the boundary. Hundreds of previously hidden jets and outflows from infant stars are visible for the first time." },
      { src: "img/jwst-saturn.jpg", title: "Saturn in Near-Infrared",
        text: "At 2.1 microns methane absorbs almost all sunlight, making Saturn's atmosphere appear dark while the rings -- mostly water ice with little methane -- shine brilliantly. Three of Saturn's moons are visible at left. This view is impossible from Earth's surface because our atmosphere blocks these wavelengths." }
    ] },

  // Spacecraft
  { name: "Voyager 1", x: -80 * AU_IN_LY, y: 140 * AU_IN_LY, dist: 165 * AU_IN_LY, radius: 1.5, color: "#55ff88", glow: "#55ff8844",
    type: "Spacecraft", category: "solar", visRange: [0, 4],
    facts: [["Distance from Sun", "~165 AU (22.8 light-hr)"], ["Launched", "September 5, 1977"], ["Speed", "~17 km/s (3.6 AU/yr)"], ["Status", "Interstellar space since 2012"]],
    desc: "The most distant human-made object. Launched in 1977, Voyager 1 crossed the heliopause in 2012 and now travels through interstellar space. It carries a golden record with sounds and images of Earth. At its current speed, it would reach Proxima Centauri in ~73,000 years." },
  { name: "Voyager 2", x: 100 * AU_IN_LY, y: -110 * AU_IN_LY, dist: 140 * AU_IN_LY, radius: 1.5, color: "#55ddff", glow: "#55ddff44",
    type: "Spacecraft", category: "solar", visRange: [0, 4],
    facts: [["Distance from Sun", "~140 AU (19.5 light-hr)"], ["Launched", "August 20, 1977"], ["Speed", "~15 km/s (3.3 AU/yr)"], ["Status", "Interstellar space since 2018"]],
    desc: "The only spacecraft to visit all four giant planets. Voyager 2 crossed the heliopause in 2018. Despite being launched 16 days before Voyager 1, its Jupiter gravity assist sent it on a slower trajectory to also visit Uranus and Neptune." },

  // Stellar
  { name: "Proxima Centauri", x: -3.5, y: -2.3, dist: 4.24, ra: 217.43, dec: -62.68, radius: 2, color: "#ff6644", glow: "#ff664433",
    type: "Red dwarf (M5.5Ve)", category: "stellar", physRadius: 1.133e-8,
    facts: [["Distance", "4.24 light-years"], ["Planets", "Proxima b (habitable zone)"], ["Travel time (Voyager 1)", "~73,000 years"]],
    desc: "The closest star to the Sun. At Voyager 1's speed it would take over 73,000 years to reach." },
  { name: "\u03b1 Centauri A", x: -3.7, y: -2.1, dist: 4.37, ra: 219.90, dec: -60.83, radius: 2.5, color: "#ffee66", glow: "#ffee6633",
    type: "Star (G2V, Sun-like)", category: "stellar", physRadius: 8.99e-8,
    facts: [["Distance", "4.37 light-years"], ["Mass", "1.1 M\u2609"]],
    desc: "Nearly identical to our Sun. The brighter half of the closest binary star system." },
  { name: "\u03b1 Centauri B", x: -3.8, y: -2.0, dist: 4.37, ra: 219.90, dec: -60.83, radius: 2, color: "#ffaa44", glow: "#ffaa4433",
    type: "Star (K1V)", category: "stellar", physRadius: 6.34e-8,
    facts: [["Distance", "4.37 light-years"]],
    desc: "The smaller companion to Alpha Centauri A. An orange dwarf." },
  // Exoplanets
  { name: "Proxima Centauri b", x: -3.4, y: -2.4, dist: 4.24, radius: 1.5, color: "#66aacc", glow: "#66aacc44",
    type: "Exoplanet (rocky, habitable zone)", category: "stellar", visRange: [0.5, 20],
    facts: [["Distance", "4.24 light-years"], ["Mass", "~1.17 Earth masses"], ["Orbital period", "11.2 days"], ["Star", "Proxima Centauri (red dwarf)"]],
    desc: "The nearest known exoplanet. An Earth-mass world orbiting in the habitable zone of Proxima Centauri, just 4.24 light-years away. Whether it retains an atmosphere under its star's intense flares remains one of astrobiology's biggest open questions." },
  { name: "TRAPPIST-1 System", x: -30, y: -25, dist: 39.46, ra: 346.62, dec: -5.04, radius: 2, color: "#cc8866", glow: "#cc886644",
    type: "7-planet system (3 in habitable zone)", category: "stellar", visRange: [8, 200],
    facts: [["Distance", "39.46 light-years"], ["Planets", "7 rocky (b through h)"], ["Habitable zone", "e, f, g"], ["Star", "Ultra-cool red dwarf"]],
    desc: "Seven Earth-sized rocky planets orbiting a dim red dwarf, three in the habitable zone. The most promising system for finding habitable worlds beyond our own. JWST is actively studying their atmospheres." },
  { name: "Kepler-452b", x: 1200, y: -1300, dist: 1800, radius: 2, color: "#77bb99", glow: "#77bb9944",
    type: "Exoplanet (super-Earth)", category: "stellar", visRange: [80, 16000],
    facts: [["Distance", "1,800 light-years"], ["Radius", "~1.6 Earth radii"], ["Orbital period", "385 days"], ["Star", "Sun-like (G2V)"]],
    desc: "Dubbed 'Earth 2.0' -- the first near-Earth-sized planet found in the habitable zone of a Sun-like star. Its year lasts 385 days and its star is nearly identical to our Sun, making it the most Earth-like world discovered by Kepler." },
  { name: "51 Pegasi b", x: 35, y: -35, dist: 50.45, radius: 1.8, color: "#ff9944", glow: "#ff994433",
    type: "Hot Jupiter (first found)", category: "stellar", visRange: [8, 300],
    facts: [["Distance", "50.45 light-years"], ["Mass", "~0.47 Jupiter masses"], ["Orbital period", "4.23 days"], ["Discovery", "1995 (Nobel Prize 2019)"]],
    desc: "The planet that changed everything. In 1995, Mayor and Queloz discovered this gas giant orbiting impossibly close to its star -- completing a year in just 4 days. It shattered assumptions about planetary formation and launched the exoplanet revolution. Nobel Prize in Physics, 2019." },
  { name: "HD 209458 b", x: -100, y: 120, dist: 159, radius: 2, color: "#ffaa55", glow: "#ffaa5544",
    type: "Hot Jupiter (evaporating)", category: "stellar", visRange: [20, 800],
    facts: [["Distance", "159 light-years"], ["Nickname", "Osiris"], ["Orbital period", "3.52 days"], ["Discovery", "First transiting exoplanet (1999)"]],
    desc: "The first exoplanet caught crossing its star's face. Nicknamed 'Osiris' after the Egyptian god of the dead, this gas giant is so close to its star that its atmosphere is boiling away into space, leaving a comet-like tail of hydrogen and carbon." },
  { name: "WASP-12b", x: -950, y: 1050, dist: 1410, radius: 2, color: "#ff6633", glow: "#ff663344",
    type: "Ultra-hot Jupiter (doomed)", category: "stellar", visRange: [80, 12000],
    facts: [["Distance", "1,410 light-years"], ["Surface temp", "~2,600\u00b0C"], ["Orbital period", "1.09 days"], ["Fate", "Being consumed by its star"]],
    desc: "One of the hottest and most extreme planets known. Orbiting so close that tidal forces stretch it into an egg shape, WASP-12b is being slowly devoured by its star. It reflects almost no light -- darker than asphalt. It will be consumed entirely within 10 million years." },

  { name: "Barnard's Star", x: 3.0, y: 4.5, dist: 5.96, ra: 269.45, dec: 4.69, radius: 1.5, color: "#dd5533", glow: "#dd553322",
    type: "Red dwarf (M4Ve)", category: "stellar",
    facts: [["Distance", "5.96 light-years"], ["Age", "~10 billion years"]],
    desc: "The fastest-moving star in our sky. An ancient red dwarf, twice the age of our solar system." },
  { name: "Wolf 359", x: -5.0, y: 5.5, dist: 7.86, ra: 164.12, dec: 7.01, radius: 1.2, color: "#cc4422", glow: "#cc442222",
    type: "Red dwarf (M6.5Ve)", category: "stellar",
    facts: [["Distance", "7.86 light-years"], ["Luminosity", "0.001 L\u2609"]],
    desc: "One of the faintest stars known. Invisible to the naked eye despite being a close neighbor." },
  { name: "Sirius", x: 5.0, y: -7.0, dist: 8.6, ra: 101.29, dec: -16.72, radius: 4, color: "#aaccff", glow: "#aaccff55",
    type: "Star (A1V)", category: "stellar",
    facts: [["Distance", "8.6 light-years"], ["Luminosity", "25.4 L\u2609"], ["Apparent mag", "-1.46 (brightest)"]],
    desc: "The brightest star in Earth's night sky. 25 times more luminous than the Sun." },
  { name: "Ross 154", x: 7.0, y: 5.5, dist: 9.69, ra: 283.27, dec: -23.83, radius: 1.2, color: "#cc5533", glow: "#cc553322",
    type: "Red dwarf", category: "stellar",
    facts: [["Distance", "9.69 ly"]],
    desc: "A flare star that can suddenly brighten by several magnitudes." },
  { name: "Tau Ceti", x: -8.0, y: -7.5, dist: 11.9, ra: 26.02, dec: -15.94, radius: 2.5, color: "#ffdd88", glow: "#ffdd8833",
    type: "Star (G8.5V, Sun-like)", category: "stellar",
    facts: [["Distance", "11.9 light-years"], ["Planets", "5 candidates"]],
    desc: "A Sun-like star with possibly 5 planets." },
  { name: "Procyon", x: 8, y: -8, dist: 11.5, ra: 114.83, dec: 5.22, radius: 2.5, color: "#ddeeff", glow: "#ddeeff33",
    type: "Star (F5IV)", category: "stellar",
    facts: [["Distance", "11.5 light-years"], ["Luminosity", "6.9 L\u2609"], ["Companion", "White dwarf Procyon B"]],
    desc: "The 8th brightest star. Like Sirius, it has a white dwarf companion." },
  { name: "Vega", x: -15, y: 20, dist: 25, ra: 279.23, dec: 38.78, radius: 3, color: "#aabbff", glow: "#aabbff44",
    type: "Star (A0V)", category: "stellar", visRange: [10, 80],
    facts: [["Distance", "25 light-years"], ["Luminosity", "40 L\u2609"], ["First photographed star", "1850"]],
    desc: "In 12,000 years, axial precession will make Vega our North Star." },
  { name: "Arcturus", x: 25, y: 30, dist: 37, ra: 213.92, dec: 19.18, radius: 3, color: "#ffbb66", glow: "#ffbb6644",
    type: "Red giant (K1.5III)", category: "stellar", visRange: [10, 100],
    facts: [["Distance", "37 light-years"], ["Diameter", "25x Sun"], ["1933 World's Fair", "Its light opened the fair"]],
    desc: "Brightest star in the northern hemisphere. Its light opened the 1933 Chicago World's Fair." },
  { name: "Aldebaran", x: 40, y: -50, dist: 65, ra: 68.98, dec: 16.51, radius: 3, color: "#ff8844", glow: "#ff884433",
    type: "Red giant (K5III)", category: "stellar", visRange: [20, 300],
    facts: [["Distance", "65 light-years"], ["Diameter", "44x Sun"], ["Constellation", "Taurus (the eye)"]],
    desc: "The red eye of Taurus. Appears embedded in the Hyades but is only half as far." },
  { name: "Canopus", x: 150, y: -270, dist: 310, ra: 95.99, dec: -52.70, radius: 3.5, color: "#ffffcc", glow: "#ffffcc44",
    type: "Supergiant (A9II)", category: "stellar", visRange: [50, 15000],
    facts: [["Distance", "310 light-years"], ["Luminosity", "10,700 L\u2609"], ["Rank", "2nd brightest star"]],
    desc: "The 2nd brightest star in Earth's sky. Used for spacecraft navigation." },
  { name: "Polaris", x: 200, y: 380, dist: 433, ra: 37.95, dec: 89.26, radius: 3, color: "#ffeedd", glow: "#ffeedd44",
    type: "Supergiant (F7Ib)", category: "stellar", visRange: [80, 15000],
    facts: [["Distance", "433 light-years"], ["Type", "Cepheid variable (triple system)"], ["Role", "Current North Star"]],
    desc: "Earth's North Star. A Cepheid variable -- a standard candle for measuring cosmic distances." },
  // ── Orion ──
  { name: "Antares", x: -300, y: 420, dist: 550, ra: 247.35, dec: -26.43, radius: 4, color: "#ff4422", glow: "#ff442244",
    type: "Red supergiant (M1Iab)", category: "stellar", visRange: [80, 15000], constellation: "scorpius",
    facts: [["Distance", "550 light-years"], ["Diameter", "680x Sun"], ["Constellation", "Scorpius (the heart)"]],
    desc: "Heart of the Scorpion. So large that if placed at the Sun, Mars would orbit inside it." },
  { name: "Betelgeuse", x: 20, y: -380, dist: 700, ra: 88.79, dec: 7.41, radius: 5, color: "#ff6633", glow: "#ff663355",
    type: "Red supergiant (M2Iab)", category: "stellar", visRange: [50, 15000], constellation: "orion", physRadius: 0.0057,
    facts: [["Distance", "700 light-years"], ["Diameter", "700-1000x Sun"], ["Fate", "Supernova within 100,000 yr"]],
    desc: "A red supergiant so immense it would engulf Jupiter. Will explode as a supernova." },
  { name: "Bellatrix", x: 230, y: -400, dist: 250, ra: 81.28, dec: 6.35, radius: 3, color: "#99aaff", glow: "#99aaff44",
    type: "Blue giant (B2III)", category: "stellar", visRange: [50, 10000], constellation: "orion",
    facts: [["Distance", "250 light-years"], ["Luminosity", "9,200 L\u2609"], ["Name meaning", "'Female warrior' in Latin"]],
    desc: "Orion's right shoulder. At 250 ly, Bellatrix is much closer than the other Orion stars -- the constellation is an illusion of perspective." },
  { name: "Alnitak", x: 60, y: -540, dist: 1200, ra: 85.19, dec: -1.94, radius: 2.5, color: "#aabbff", glow: "#aabbff44",
    type: "Triple star system (O9.7Ib)", category: "stellar", visRange: [50, 10000], constellation: "orion",
    facts: [["Distance", "~1,200 light-years"], ["System", "Triple star system"], ["Nearby", "Illuminates Flame and Horsehead Nebulae"]],
    desc: "The leftmost belt star. Its UV radiation illuminates the nearby Flame Nebula and sculpts the iconic Horsehead Nebula." },
  { name: "Alnilam", x: 120, y: -555, dist: 2000, ra: 84.05, dec: -1.20, radius: 3, color: "#bbccff", glow: "#bbccff55",
    type: "Blue supergiant (B0Ia)", category: "stellar", visRange: [50, 10000], constellation: "orion",
    facts: [["Distance", "~2,000 light-years"], ["Luminosity", "275,000 L\u2609"], ["Belt position", "Center belt star (brightest)"]],
    desc: "The center jewel of Orion's Belt and the most distant of the three. At 2,000 ly, it is nearly twice as far as its belt companions -- proof that constellations are illusions of projection." },
  { name: "Mintaka", x: 180, y: -570, dist: 1200, ra: 83.00, dec: -0.30, radius: 2.5, color: "#aabbff", glow: "#aabbff44",
    type: "Multiple star system (O9.5II)", category: "stellar", visRange: [50, 10000], constellation: "orion",
    facts: [["Distance", "~1,200 light-years"], ["System", "Eclipsing binary + 2 companions"], ["Belt position", "Westernmost (right) belt star"]],
    desc: "The rightmost star of Orion's Belt. Actually a complex system of at least four stars, nearly on the celestial equator." },
  { name: "Saiph", x: 40, y: -720, dist: 650, ra: 86.94, dec: -9.67, radius: 3, color: "#88aaff", glow: "#88aaff44",
    type: "Blue supergiant (B0.5Ia)", category: "stellar", visRange: [50, 10000], constellation: "orion",
    facts: [["Distance", "~650 light-years"], ["Luminosity", "56,000 L\u2609"], ["Name meaning", "'Sword of the Giant' in Arabic"]],
    desc: "Orion's left foot. Despite similar luminosity to Rigel, it appears dimmer because more of its light is in the ultraviolet." },
  { name: "Rigel", x: 210, y: -700, dist: 863, ra: 78.63, dec: -8.20, radius: 4.5, color: "#99bbff", glow: "#99bbff55",
    type: "Blue supergiant (B8Ia)", category: "stellar", visRange: [50, 15000], constellation: "orion",
    facts: [["Distance", "863 light-years"], ["Luminosity", "120,000 L\u2609"], ["Role", "Illuminates Witch Head Nebula"]],
    desc: "A blue supergiant blazing at 120,000x the Sun's luminosity. The 7th brightest star." },

  // ── Scorpius (tail curves down from Antares) ──
  { name: "Dschubba", x: -220, y: 280, dist: 490, ra: 240.08, dec: -22.62, radius: 2.5, color: "#aabbff", glow: "#aabbff33",
    type: "Subgiant (B0.3IV)", category: "stellar", visRange: [50, 5000], constellation: "scorpius",
    facts: [["Distance", "~490 light-years"], ["Name", "\u03b4 Scorpii"], ["Feature", "Be star with episodic brightening"]],
    desc: "The forehead of the Scorpion. A Be star that occasionally ejects disks of gas, causing dramatic brightness changes." },
  { name: "Sargas", x: -380, y: 540, dist: 300, ra: 264.33, dec: -42.99, radius: 2.5, color: "#ffddaa", glow: "#ffddaa33",
    type: "Giant (F1II)", category: "stellar", visRange: [50, 5000], constellation: "scorpius",
    facts: [["Distance", "~300 light-years"], ["Name", "\u03b8 Scorpii"], ["Luminosity", "~1,800 L\u2609"]],
    desc: "A bright giant in the Scorpion's tail. At 300 ly, Sargas is much closer than the heart star Antares at 550 ly." },
  { name: "Shaula", x: -440, y: 640, dist: 570, ra: 263.40, dec: -37.10, radius: 3, color: "#99bbff", glow: "#99bbff44",
    type: "Triple star system (B2IV)", category: "stellar", visRange: [50, 5000], constellation: "scorpius",
    facts: [["Distance", "~570 light-years"], ["Name", "\u03bb Scorpii (the stinger)"], ["System", "Triple star"]],
    desc: "The stinger at the tip of the Scorpion's tail. The second brightest star in Scorpius after Antares." },

  // ── Big Dipper / Ursa Major ──
  { name: "Dubhe", x: 320, y: 380, dist: 124, ra: 165.93, dec: 61.75, radius: 2.5, color: "#ffcc66", glow: "#ffcc6633",
    type: "Giant (K0III)", category: "stellar", visRange: [30, 5000], constellation: "bigdipper",
    facts: [["Distance", "124 light-years"], ["Name", "\u03b1 Ursae Majoris"], ["Note", "NOT part of the Ursa Major Moving Group"]],
    desc: "The front lip of the Big Dipper's bowl. Unlike 5 of the other Dipper stars, Dubhe is not part of the Ursa Major Moving Group -- the pattern is slowly dissolving." },
  { name: "Merak", x: 340, y: 300, dist: 79, ra: 165.46, dec: 56.38, radius: 2, color: "#ddeeff", glow: "#ddeeff33",
    type: "Star (A1V)", category: "stellar", visRange: [30, 5000], constellation: "bigdipper",
    facts: [["Distance", "79 light-years"], ["Name", "\u03b2 Ursae Majoris"], ["Use", "Pointer star toward Polaris"]],
    desc: "The bottom of the Dipper's bowl, and a pointer star: the line from Merak through Dubhe leads to Polaris." },
  { name: "Phecda", x: 400, y: 270, dist: 84, ra: 178.46, dec: 53.69, radius: 2, color: "#ddeeff", glow: "#ddeeff33",
    type: "Star (A0V)", category: "stellar", visRange: [30, 5000], constellation: "bigdipper",
    facts: [["Distance", "84 light-years"], ["Name", "\u03b3 Ursae Majoris"], ["Group", "Ursa Major Moving Group"]],
    desc: "The inner bottom corner of the Big Dipper's bowl. Part of the Ursa Major Moving Group, a loose cluster of stars sharing a common motion through space." },
  { name: "Megrez", x: 410, y: 340, dist: 58, ra: 183.86, dec: 57.03, radius: 1.8, color: "#ddeeff", glow: "#ddeeff22",
    type: "Star (A3V)", category: "stellar", visRange: [30, 5000], constellation: "bigdipper",
    facts: [["Distance", "58 light-years"], ["Name", "\u03b4 Ursae Majoris"], ["Note", "Faintest Dipper star"]],
    desc: "The faintest star in the Big Dipper, where the bowl meets the handle. Also the closest Dipper star at just 58 ly." },
  { name: "Alioth", x: 470, y: 310, dist: 81, ra: 193.51, dec: 55.96, radius: 2.5, color: "#ddeeff", glow: "#ddeeff33",
    type: "Star (A1III)", category: "stellar", visRange: [30, 5000], constellation: "bigdipper",
    facts: [["Distance", "81 light-years"], ["Name", "\u03b5 Ursae Majoris"], ["Rank", "Brightest star in Ursa Major"]],
    desc: "The brightest star in Ursa Major and the first star of the Dipper's handle." },
  { name: "Mizar", x: 530, y: 270, dist: 78, ra: 200.98, dec: 54.93, radius: 2.5, color: "#ddeeff", glow: "#ddeeff33",
    type: "Sextuple star system (A2V)", category: "stellar", visRange: [30, 5000], constellation: "bigdipper",
    facts: [["Distance", "78 light-years"], ["Companion", "Alcor (visual double)"], ["System", "Actually 6 stars"]],
    desc: "The famous double star at the bend of the Dipper's handle. Paired with Alcor as an ancient eye test. Mizar itself is actually a sextuple system -- six stars masquerading as one." },
  { name: "Alkaid", x: 590, y: 220, dist: 104, ra: 206.89, dec: 49.31, radius: 2.5, color: "#bbccff", glow: "#bbccff33",
    type: "Star (B3V)", category: "stellar", visRange: [30, 5000], constellation: "bigdipper",
    facts: [["Distance", "104 light-years"], ["Name", "\u03b7 Ursae Majoris"], ["Note", "NOT part of the Moving Group"]],
    desc: "The tip of the Dipper's handle. Like Dubhe at the bowl's front, Alkaid is NOT part of the Ursa Major Moving Group -- in millions of years, the Dipper will lose its shape." },

  // ── Crux / Southern Cross ──
  { name: "Acrux", x: -420, y: -310, dist: 321, ra: 186.65, dec: -63.10, radius: 3, color: "#aabbff", glow: "#aabbff44",
    type: "Triple star system (B0.5IV)", category: "stellar", visRange: [50, 5000], constellation: "crux",
    facts: [["Distance", "321 light-years"], ["Name", "\u03b1 Crucis"], ["System", "Triple star"], ["Use", "Points toward south celestial pole"]],
    desc: "The brightest star in the Southern Cross and the southernmost first-magnitude star. A triple system used for centuries to find south." },
  { name: "Mimosa", x: -490, y: -220, dist: 280, ra: 191.93, dec: -59.69, radius: 3, color: "#99bbff", glow: "#99bbff44",
    type: "Giant (B1III)", category: "stellar", visRange: [50, 5000], constellation: "crux",
    facts: [["Distance", "280 light-years"], ["Name", "\u03b2 Crucis"], ["Feature", "Pulsating variable (Beta Cephei type)"]],
    desc: "The left arm of the Southern Cross. A pulsating variable that subtly changes brightness every few hours." },
  { name: "Gacrux", x: -420, y: -130, dist: 88, ra: 187.79, dec: -57.11, radius: 2.5, color: "#ff9966", glow: "#ff996644",
    type: "Red giant (M3.5III)", category: "stellar", visRange: [30, 5000], constellation: "crux",
    facts: [["Distance", "88 light-years"], ["Name", "\u03b3 Crucis"], ["Color", "Distinctly red/orange"]],
    desc: "The top of the Southern Cross -- and by far the closest of its stars at just 88 ly. Its warm orange color contrasts with the blue-white of the other three, a visual clue to its very different distance." },
  { name: "Delta Crucis", x: -350, y: -220, dist: 345, ra: 183.79, dec: -58.75, radius: 2, color: "#aabbff", glow: "#aabbff33",
    type: "Subgiant (B2IV)", category: "stellar", visRange: [50, 5000], constellation: "crux",
    facts: [["Distance", "345 light-years"], ["Name", "\u03b4 Crucis"], ["Feature", "Pulsating variable"]],
    desc: "The right arm of the Southern Cross. The faintest of the four main stars." },

  // ── Cassiopeia (W-shape) ──
  { name: "Caph", x: 400, y: -110, dist: 54, ra: 2.29, dec: 59.15, radius: 2, color: "#ffeedd", glow: "#ffeedd33",
    type: "Giant (F2III)", category: "stellar", visRange: [20, 5000], constellation: "cassiopeia",
    facts: [["Distance", "54 light-years"], ["Name", "\u03b2 Cassiopeiae"], ["Feature", "Delta Scuti variable"]],
    desc: "The leftmost peak of Cassiopeia's W and the closest of its stars at just 54 ly. A rapidly oscillating star used to study stellar interiors." },
  { name: "Schedar", x: 440, y: -220, dist: 228, ra: 10.13, dec: 56.54, radius: 2.5, color: "#ffaa66", glow: "#ffaa6633",
    type: "Giant (K0IIIa)", category: "stellar", visRange: [40, 5000], constellation: "cassiopeia",
    facts: [["Distance", "228 light-years"], ["Name", "\u03b1 Cassiopeiae"], ["Color", "Distinctly orange"]],
    desc: "The brightest star in Cassiopeia and the left valley of the W. Its warm orange glow marks it among its bluer neighbors." },
  { name: "Gamma Cassiopeiae", x: 510, y: -100, dist: 550, ra: 14.18, dec: 60.72, radius: 3, color: "#aaccff", glow: "#aaccff44",
    type: "Be star (B0.5IVe)", category: "stellar", visRange: [50, 5000], constellation: "cassiopeia",
    facts: [["Distance", "~550 light-years"], ["Feature", "Eruptive variable, spins near breakup speed"], ["X-ray", "Anomalously strong X-ray source"]],
    desc: "The center peak of Cassiopeia's W. A Be star spinning so fast it flings off disks of gas, causing unpredictable brightness changes. A mysteriously strong X-ray source." },
  { name: "Ruchbah", x: 570, y: -240, dist: 99, ra: 21.45, dec: 60.24, radius: 2, color: "#ddeeff", glow: "#ddeeff33",
    type: "Eclipsing binary (A5III-IV)", category: "stellar", visRange: [30, 5000], constellation: "cassiopeia",
    facts: [["Distance", "99 light-years"], ["Name", "\u03b4 Cassiopeiae"], ["Feature", "Algol-type eclipsing binary"]],
    desc: "The right valley of Cassiopeia's W. An eclipsing binary where the companion star periodically passes in front, dimming its light." },
  { name: "Segin", x: 630, y: -130, dist: 410, ra: 28.60, dec: 63.67, radius: 2, color: "#bbccff", glow: "#bbccff33",
    type: "Subgiant (B3III)", category: "stellar", visRange: [50, 5000], constellation: "cassiopeia",
    facts: [["Distance", "410 light-years"], ["Name", "\u03b5 Cassiopeiae"], ["Cluster", "Near open cluster NGC 146"]],
    desc: "The rightmost peak of Cassiopeia's W. The depth story is vivid here: Caph (54 ly) and Ruchbah (99 ly) are nearby, while Segin (410 ly) and Gamma Cas (550 ly) are 5-10x farther." },

  { name: "Deneb", x: 700, y: 80, dist: 2615, ra: 310.36, dec: 45.28, radius: 4, color: "#bbccff", glow: "#bbccff44",
    type: "Supergiant (A2Ia)", category: "stellar", visRange: [300, 15000],
    facts: [["Distance", "2,615 light-years"], ["Luminosity", "200,000 L\u2609"], ["Light departed", "~400 BC"]],
    desc: "200,000x the Sun's luminosity. Its light left when Socrates walked Athens." },

  // Nebulae
  { name: "Helix Nebula", x: -200, y: -630, dist: 655, radius: 5, color: "#44ddcc", glow: "#44ddcc33",
    type: "Planetary nebula", category: "nebula", visRange: [100, 30000],
    facts: [["Distance", "655 light-years"], ["Diameter", "~5.7 ly"], ["Nickname", "Eye of God"]],
    desc: "A dying star's outer layers expelled into space, forming the 'Eye of God.'" },
  { name: "Orion Nebula", x: 400, y: -1200, dist: 1344, radius: 6, color: "#ff99aa", glow: "#ff99aa44",
    type: "Emission nebula", category: "nebula", visRange: [200, 50000], physRadius: 12,
    facts: [["Distance", "1,344 light-years"], ["Diameter", "~24 ly"], ["Contents", "Trapezium cluster, youngest known stars"]],
    desc: "Visible to the naked eye in Orion's sword. A stellar nursery birthing new stars." },
  { name: "Ring Nebula", x: 1500, y: -1800, dist: 2283, radius: 4, color: "#55ccff", glow: "#55ccff33",
    type: "Planetary nebula", category: "nebula", visRange: [200, 50000],
    facts: [["Distance", "2,283 light-years"], ["Diameter", "~1.3 ly"], ["Constellation", "Lyra"]],
    desc: "A colorful shell of gas ejected by a dying Sun-like star in Lyra." },
  { name: "Crab Nebula", x: -2000, y: 6200, dist: 6500, radius: 5, color: "#dd8844", glow: "#dd884444",
    type: "Supernova remnant", category: "nebula", visRange: [200, 100000],
    facts: [["Distance", "6,500 light-years"], ["Diameter", "~11 ly"], ["Origin", "Supernova of 1054 AD"]],
    desc: "Remains of a star that exploded in 1054 AD, recorded by Chinese astronomers." },
  { name: "Eagle Nebula", x: -4000, y: 5600, dist: 7000, radius: 6, color: "#cc88ff", glow: "#cc88ff33",
    type: "Emission nebula", category: "nebula", visRange: [200, 80000],
    facts: [["Distance", "7,000 light-years"], ["Feature", "Pillars of Creation (5 ly tall)"], ["Status", "May already be destroyed"]],
    desc: "Home of the Pillars of Creation -- towering columns of gas where new stars form." },
  { name: "Carina Nebula", x: -5000, y: -7000, dist: 8500, radius: 7, color: "#ff7788", glow: "#ff778844",
    type: "Emission nebula", category: "nebula", visRange: [200, 80000],
    facts: [["Distance", "8,500 light-years"], ["Diameter", "~300 ly"], ["Contains", "Eta Carinae (unstable hypergiant)"]],
    desc: "One of the largest nebulae, hosting the unstable hypergiant Eta Carinae." },

  // Exotic
  { name: "Vela Pulsar", x: -500, y: 800, dist: 936, radius: 2, color: "#44ffaa", glow: "#44ffaa44",
    type: "Neutron star / Pulsar", category: "exotic", visRange: [50, 30000],
    facts: [["Distance", "936 light-years"], ["Spin rate", "11.2 Hz"], ["Age", "~11,000 years"]],
    desc: "Born from a supernova 11,000 years ago. Spins 11 times per second." },
  { name: "Crab Pulsar", x: -2020, y: 6220, dist: 6500, radius: 2, color: "#ffaa22", glow: "#ffaa2244",
    type: "Neutron star (30 Hz)", category: "exotic", visRange: [100, 80000],
    facts: [["Distance", "6,500 light-years"], ["Spin rate", "30 Hz"], ["Role", "Powers Crab Nebula's glow"]],
    desc: "Spinning 30 times per second, this tiny star powers the entire Crab Nebula." },
  { name: "Cygnus X-1", x: 4000, y: 4500, dist: 6070, radius: 3, color: "#aa44ff", glow: "#aa44ff55",
    type: "Stellar black hole (21 M\u2609)", category: "exotic", visRange: [100, 80000],
    facts: [["Distance", "6,070 light-years"], ["Mass", "21 M\u2609"], ["Discovery", "1964 (X-ray), first accepted BH"]],
    desc: "The first widely accepted black hole. Hawking bet against it and conceded in 1990." },
  { name: "SGR 1806-20", x: -24000, y: 2000, dist: 50000, radius: 3, color: "#ff44aa", glow: "#ff44aa55",
    type: "Magnetar", category: "exotic", visRange: [500, 200000],
    facts: [["Distance", "50,000 light-years"], ["2004 flare", "Altered Earth's ionosphere"], ["Magnetic field", "~10^15 x Earth's"]],
    desc: "The most powerful magnetic object known. Its 2004 flare affected Earth from 50,000 ly away." },

  // Historic supernovae
  { name: "Tycho's SN Remnant", x: 6000, y: -5400, dist: 8000, radius: 4, color: "#ff6644", glow: "#ff664455",
    type: "Supernova remnant (Type Ia)", category: "exotic", visRange: [200, 80000],
    facts: [["Distance", "~8,000 light-years"], ["Observed", "November 1572 by Tycho Brahe"], ["Type", "Type Ia (thermonuclear)"], ["Significance", "Shattered the 'unchanging heavens' doctrine"]],
    desc: "In 1572, Tycho Brahe observed a 'new star' brighter than Venus that shook the foundations of astronomy. This Type Ia supernova proved the heavens could change, undermining centuries of Aristotelian cosmology." },
  { name: "Kepler's SN Remnant", x: -15000, y: 13000, dist: 20000, radius: 4, color: "#ee5533", glow: "#ee553355",
    type: "Supernova remnant (Type Ia)", category: "exotic", visRange: [500, 120000],
    facts: [["Distance", "~20,000 light-years"], ["Observed", "October 1604 by Johannes Kepler"], ["Type", "Type Ia (thermonuclear)"], ["Note", "Last visible supernova in the Milky Way"]],
    desc: "The last supernova observed with the naked eye in our galaxy. Kepler studied it for over a year, publishing 'De Stella Nova' in 1606. No Milky Way supernova has been seen since." },
  { name: "SN 1987A", x: 72000, y: -143000, dist: 160000, radius: 5, color: "#ff8855", glow: "#ff885566",
    type: "Supernova remnant (Type II)", category: "exotic", visRange: [20000, 8 * MLY],
    facts: [["Distance", "~168,000 ly (in LMC)"], ["Observed", "February 23, 1987"], ["Neutrinos", "First supernova neutrinos detected"], ["Progenitor", "Blue supergiant Sanduleak -69 202"]],
    desc: "The closest supernova since the invention of the telescope. Neutrino detectors in Japan and the US caught 25 neutrinos hours before the light arrived, confirming core-collapse theory and opening the era of neutrino astronomy." },

  // Clusters
  { name: "47 Tucanae", x: 5000, y: -12000, dist: 13000, radius: 4, color: "#ffcc88", glow: "#ffcc8833",
    type: "Globular cluster", category: "cluster", visRange: [500, 150000],
    facts: [["Distance", "13,000 light-years"], ["Stars", "~1 million"], ["Rank", "2nd brightest globular"]],
    desc: "One of the most massive globular clusters, visible to the naked eye from the Southern Hemisphere." },
  { name: "Omega Centauri", x: -8000, y: -13000, dist: 15800, radius: 5, color: "#ffdd99", glow: "#ffdd9944",
    type: "Globular cluster (~10M stars)", category: "cluster", visRange: [500, 150000],
    facts: [["Distance", "15,800 light-years"], ["Stars", "~10 million"], ["Origin", "May be a stripped dwarf galaxy core"]],
    desc: "The largest MW globular cluster. May be the remnant core of a consumed dwarf galaxy." },
  { name: "M13", x: 10000, y: 19000, dist: 22200, radius: 4, color: "#eedd88", glow: "#eedd8833",
    type: "Globular cluster (Hercules)", category: "cluster", visRange: [800, 150000],
    facts: [["Distance", "22,200 light-years"], ["Stars", "~300,000"], ["1974 Arecibo message", "Target of first interstellar radio message"]],
    desc: "The Great Globular Cluster in Hercules. Target of the 1974 Arecibo message." },
  { name: "M22", x: -14000, y: 5000, dist: 10600, radius: 3.5, color: "#eedd88", glow: "#eedd8833",
    type: "Globular cluster (Sagittarius)", category: "cluster", visRange: [500, 150000],
    facts: [["Distance", "10,600 light-years"], ["Stars", "~83,000"], ["Age", "~12 billion years"]],
    desc: "One of the nearest globular clusters and among the first discovered. Contains two stellar-mass black holes." },
  { name: "M3", x: 18000, y: -28000, dist: 33900, radius: 3.5, color: "#eedd99", glow: "#eedd9933",
    type: "Globular cluster (Canes Venatici)", category: "cluster", visRange: [800, 150000],
    facts: [["Distance", "33,900 light-years"], ["Stars", "~500,000"], ["Variable stars", "274 known (most of any GC)"]],
    desc: "One of the largest and brightest globular clusters. Contains the most variable stars of any known globular, making it invaluable for studying stellar evolution." },
  { name: "Palomar 5", x: -30000, y: 55000, dist: 75700, radius: 3, color: "#ccbb88", glow: "#ccbb8822",
    type: "Globular cluster (disrupting)", category: "cluster", visRange: [1500, 200000],
    facts: [["Distance", "75,700 light-years"], ["Stars", "~10,000 (and shrinking)"], ["Tidal tails", "Span ~30,000 ly"]],
    desc: "A globular cluster being ripped apart by the Milky Way's tidal forces. Its spectacular tidal tails stretch 30,000 light-years, providing a real-time view of how galaxies consume their satellites." },

  // Galaxy-scale
  { name: "Sun (You Are Here)", x: 0, y: 0, dist: 0, radius: 3, color: "#ffdd44", glow: "#ffdd4466",
    type: "Our location in the galaxy", category: "galaxy",
    facts: [["From center", "~26,000 ly"], ["Orbital period", "~225 Myr"], ["Arm", "Orion-Cygnus"]],
    desc: "We sit in the Orion Arm, 26,000 light-years from the galactic center." },
  { name: "Galactic Center", x: -26000, y: 0, dist: 26000, radius: 7, color: "#ffaa33", glow: "#ffaa3366",
    type: "Galactic core", category: "galaxy",
    facts: [["Distance", "~26,000 ly"], ["Black hole", "Sgr A*, 4M M\u2609"]],
    desc: "Home to Sagittarius A*, a 4-million-solar-mass black hole." },
  { name: "Sagittarius A*", x: -26200, y: 300, dist: 26000, radius: 3, color: "#ff6600", glow: "#ff660066",
    type: "Supermassive black hole", category: "galaxy",
    facts: [["Mass", "~4.15 million M\u2609"], ["First imaged", "2022 (EHT)"]],
    desc: "The supermassive black hole at the Milky Way's heart." },
  { name: "Perseus Arm", x: -12000, y: 22000, dist: 6400, radius: 5, color: "#5588bb", glow: "#5588bb33",
    type: "Spiral arm", category: "galaxy",
    facts: [["Distance", "~6,400 ly"]],
    desc: "A major spiral arm rich in star-forming regions." },
  { name: "Cygnus Arm", x: 12000, y: 20000, dist: 15000, radius: 4, color: "#5588bb", glow: "#5588bb33",
    type: "Spiral arm", category: "galaxy", facts: [],
    desc: "The outermost major spiral arm." },
  { name: "Scutum-Centaurus Arm", x: -35000, y: -18000, dist: 15000, radius: 5, color: "#6699cc", glow: "#6699cc33",
    type: "Spiral arm", category: "galaxy",
    facts: [["Length", "Longest in MW"]],
    desc: "The longest spiral arm of the Milky Way." },

  // Local group
  { name: "Sagittarius Dwarf", x: -25000, y: 55000, dist: 70000, radius: 3, color: "#8888aa", glow: "#8888aa33",
    type: "Dwarf galaxy (being absorbed)", category: "local",
    facts: [["Distance", "~70,000 ly"], ["Status", "Being consumed by MW"]],
    desc: "The closest known galaxy -- being torn apart by the Milky Way." },
  { name: "Large Magellanic Cloud", x: 70000, y: -145000, dist: 160000, radius: 7, color: "#88aadd", glow: "#88aadd44",
    type: "Irregular dwarf galaxy", category: "local",
    facts: [["Distance", "~160,000 ly"], ["Visible", "Southern sky, naked eye"]],
    desc: "The largest MW satellite. Contains the Tarantula Nebula." },
  { name: "Small Magellanic Cloud", x: 110000, y: -170000, dist: 200000, radius: 5, color: "#7799cc", glow: "#7799cc33",
    type: "Dwarf irregular galaxy", category: "local",
    facts: [["Distance", "~200,000 ly"]],
    desc: "Companion to the LMC, connected by a bridge of gas." },
  { name: "Canis Major Dwarf", x: 18000, y: 18000, dist: 25000, radius: 3, color: "#7777aa", glow: "#7777aa22",
    type: "Dwarf galaxy (disputed)", category: "local",
    facts: [["Distance", "~25,000 ly"]],
    desc: "Possibly the closest galaxy, or part of the MW's warped disk." },
  { name: "Leo I", x: 550000, y: 600000, dist: 820000, radius: 3, color: "#aaaacc", glow: "#aaaacc22",
    type: "Dwarf spheroidal", category: "local",
    facts: [["Distance", "~820,000 ly"]],
    desc: "One of the most distant MW satellite galaxies." },
  { name: "Andromeda (M31)", x: -1.5 * MLY, y: -2.0 * MLY, dist: 2.537 * MLY, radius: 14, color: "#bbaaee", glow: "#bbaaee55",
    type: "SA(s)b spiral galaxy", category: "local", physRadius: 110000,
    facts: [["Distance", "~2.537 Mly"], ["Stars", "~1 trillion"], ["Collision", "~4.5 Gyr"]],
    desc: "The nearest major galaxy. Approaching at 110 km/s -- will merge with the MW in ~4.5 billion years." },
  { name: "Triangulum (M33)", x: -2.0 * MLY, y: -1.8 * MLY, dist: 2.73 * MLY, radius: 8, color: "#99aadd", glow: "#99aadd44",
    type: "Spiral galaxy", category: "local",
    facts: [["Distance", "~2.73 Mly"], ["Stars", "~40 billion"]],
    desc: "Third-largest in the Local Group. Most distant naked-eye object." },
  { name: "NGC 185", x: -1.4 * MLY, y: -2.3 * MLY, dist: 2.05 * MLY, radius: 3, color: "#8888aa", glow: "#8888aa22",
    type: "Dwarf spheroidal", category: "local",
    facts: [["Distance", "~2.05 Mly"]],
    desc: "An Andromeda satellite with recent star formation." },
  { name: "IC 10", x: -2.1 * MLY, y: -1.3 * MLY, dist: 2.2 * MLY, radius: 3, color: "#7799bb", glow: "#7799bb22",
    type: "Starburst dwarf", category: "local",
    facts: [["Distance", "~2.2 Mly"]],
    desc: "The only starburst galaxy in the Local Group." },

  // Cepheid variables in Andromeda
  { name: "V1 (Hubble's Cepheid)", x: -1.5 * MLY - 20000, y: -2.0 * MLY + 15000, dist: 2.537 * MLY, radius: 2, color: "#ffeebb", glow: "#ffeebb44",
    type: "Cepheid variable in M31", category: "stellar", visRange: [300000, 8 * MLY],
    facts: [["Distance", "~2.5 Mly (in Andromeda)"], ["Discovery", "Edwin Hubble, 1923"], ["Significance", "Proved Andromeda is a separate galaxy"]],
    desc: "The single most important star in cosmology. Hubble's discovery of this Cepheid variable in Andromeda proved it was a galaxy far beyond the Milky Way, expanding the known universe overnight." },
  { name: "V2 (Andromeda Cepheid)", x: -1.5 * MLY + 30000, y: -2.0 * MLY - 25000, dist: 2.537 * MLY, radius: 1.8, color: "#ffeebb", glow: "#ffeebb33",
    type: "Cepheid variable in M31", category: "stellar", visRange: [300000, 8 * MLY],
    facts: [["Distance", "~2.5 Mly (in Andromeda)"], ["Period", "~31.4 days"], ["Significance", "Confirmed Hubble's V1 discovery"]],
    desc: "Another Cepheid variable in Andromeda identified by Hubble, confirming the extragalactic nature of the 'spiral nebulae' and forever changing our understanding of the universe's scale." },
  { name: "V15 (Andromeda Cepheid)", x: -1.5 * MLY - 45000, y: -2.0 * MLY - 40000, dist: 2.537 * MLY, radius: 1.5, color: "#ffeebb", glow: "#ffeebb22",
    type: "Cepheid variable in M31", category: "stellar", visRange: [300000, 8 * MLY],
    facts: [["Distance", "~2.5 Mly (in Andromeda)"], ["Period", "~15 days"], ["Used for", "Calibrating the cosmic distance ladder"]],
    desc: "One of the Cepheid variables used to refine the distance to Andromeda, helping establish the period-luminosity relationship that underpins modern distance measurement." },

  // Cosmic
  { name: "Milky Way (You Are Here)", x: 0, y: 0, dist: 0, radius: 5, color: "#ffdd44", glow: "#ffdd4466",
    type: "Our galaxy", category: "cosmic", physRadius: 52500,
    facts: [["Type", "Barred spiral"], ["Diameter", "~105,000 ly"], ["Stars", "100-400 billion"]],
    desc: "Our home galaxy." },
  { name: "Virgo Cluster", x: -40 * MLY, y: -35 * MLY, dist: 53.8 * MLY, radius: 12, color: "#ddbbff", glow: "#ddbbff44",
    type: "Galaxy cluster", category: "cosmic",
    facts: [["Distance", "~53.8 Mly"], ["Galaxies", "~1,300-2,000"], ["Center", "M87"]],
    desc: "Heart of the Virgo Supercluster. M87 hosts the first imaged black hole." },
  { name: "Fornax Cluster", x: 30 * MLY, y: -52 * MLY, dist: 62 * MLY, radius: 7, color: "#ccaaee", glow: "#ccaaee33",
    type: "Galaxy cluster", category: "cosmic",
    facts: [["Distance", "~62 Mly"]],
    desc: "Second richest nearby galaxy cluster." },
  { name: "Centaurus Cluster", x: -110 * MLY, y: -90 * MLY, dist: 170 * MLY, radius: 9, color: "#cc99dd", glow: "#cc99dd33",
    type: "Galaxy cluster", category: "cosmic",
    facts: [["Distance", "~170 Mly"]],
    desc: "In the flow toward the Great Attractor." },
  { name: "Great Attractor", x: -140 * MLY, y: -210 * MLY, dist: 250 * MLY, radius: 18, color: "#ff8866", glow: "#ff886666",
    type: "Gravitational anomaly", category: "cosmic",
    facts: [["Distance", "~250 Mly"], ["Mass", "~10^16 M\u2609"], ["Pull", "~600 km/s"]],
    desc: "Pulling the MW, Andromeda, and thousands of galaxies toward it. Hidden behind our own galaxy's disk." },

  // Galaxy type exemplars
  { name: "M87", x: -42 * MLY, y: -33 * MLY, dist: 53.8 * MLY, radius: 5, color: "#eeddaa", glow: "#eeddaa44",
    type: "Giant elliptical galaxy (E0)", category: "cosmic",
    facts: [["Distance", "~53.8 Mly"], ["Stars", "~1 trillion"], ["Black hole", "M87*, 6.5 billion M\u2609 (first imaged BH)"], ["Jet", "Relativistic jet ~5,000 ly long"]],
    desc: "The dominant galaxy of the Virgo Cluster. Its supermassive black hole was the first ever directly imaged by the Event Horizon Telescope in 2019, producing humanity's iconic black hole photograph." },
  { name: "NGC 1300", x: 25 * MLY, y: -57 * MLY, dist: 61 * MLY, radius: 4, color: "#aabbee", glow: "#aabbee33",
    type: "Barred spiral galaxy (SBbc)", category: "cosmic",
    facts: [["Distance", "~61 Mly"], ["Constellation", "Eridanus"], ["Feature", "Textbook example of barred spiral structure"]],
    desc: "Considered the prototypical barred spiral galaxy. Its prominent central bar channels gas inward, fueling star formation in a ring around the core." },
  { name: "IC 1101", x: -300 * MLY, y: 180 * MLY, dist: 1040 * MLY, radius: 6, color: "#ddccaa", glow: "#ddccaa44",
    type: "Supergiant elliptical galaxy (cD)", category: "cosmic", visRange: [80 * MLY, 400 * MLY],
    facts: [["Distance", "~1.04 Gly"], ["Diameter", "~4 Mly (largest known galaxy)"], ["Stars", "~100 trillion"], ["Cluster", "Abell 2029"]],
    desc: "One of the largest known galaxies in the observable universe. If placed where the Milky Way is, its halo would engulf both Magellanic Clouds and reach halfway to Andromeda." }
];

// Physical radii for accurate 3D rendering (in light-years)
// Stars: radius in solar radii × 7.35e-8 ly/R☉
// Planets: radius in km × 1.057e-13 ly/km
// Nebulae/clusters/galaxies: half-diameter in ly
(function() {
  var pr = {
    // Spacecraft (tiny but nonzero for consistency)
    "Voyager 1": 4e-17, "Voyager 2": 4e-17,
    // Exoplanets
    "Proxima Centauri b": 7.28e-10, "TRAPPIST-1 System": 8.89e-9,
    "Kepler-452b": 1.08e-9, "51 Pegasi b": 9.36e-9,
    "HD 209458 b": 1.017e-8, "WASP-12b": 1.40e-8,
    // Nearby stars
    "Barnard's Star": 1.44e-8, "Wolf 359": 1.18e-8,
    "Sirius": 1.258e-7, "Ross 154": 1.76e-8,
    "Tau Ceti": 5.83e-8, "Procyon": 1.505e-7,
    // Bright stars
    "Vega": 1.736e-7, "Arcturus": 1.867e-6,
    "Aldebaran": 3.244e-6, "Canopus": 5.248e-6,
    "Polaris": 2.756e-6, "Antares": 5.0e-5,
    "Deneb": 1.492e-5,
    // Orion constellation
    "Bellatrix": 4.23e-7, "Alnitak": 1.47e-6,
    "Alnilam": 3.087e-6, "Mintaka": 1.213e-6,
    "Saiph": 1.632e-6, "Rigel": 5.799e-6,
    // Scorpius
    "Dschubba": 4.925e-7, "Sargas": 1.933e-6, "Shaula": 4.557e-7,
    // Big Dipper (Ursa Major)
    "Dubhe": 2.205e-6, "Merak": 2.22e-7, "Phecda": 2.205e-7,
    "Megrez": 1.029e-7, "Alioth": 3.043e-7,
    "Mizar": 1.764e-7, "Alkaid": 2.499e-7,
    // Southern Cross
    "Acrux": 5.733e-7, "Mimosa": 6.174e-7,
    "Gacrux": 6.174e-6, "Delta Crucis": 5.88e-7,
    // Cassiopeia
    "Caph": 2.52e-7, "Schedar": 3.109e-6,
    "Gamma Cassiopeiae": 7.35e-7, "Ruchbah": 2.867e-7, "Segin": 2.793e-7,
    // Andromeda Cepheids
    "V1 (Hubble's Cepheid)": 2.57e-6, "V2 (Andromeda Cepheid)": 1.84e-6,
    "V15 (Andromeda Cepheid)": 1.47e-6,
    // Nebulae (half-diameter in ly)
    "Helix Nebula": 1.4, "Ring Nebula": 0.65,
    "Crab Nebula": 2.75, "Eagle Nebula": 17.5, "Carina Nebula": 115,
    // Exotic objects
    "Vela Pulsar": 1.27e-12, "Crab Pulsar": 1.27e-12,
    "Cygnus X-1": 4.69e-12, "SGR 1806-20": 1.27e-12,
    "Tycho's SN Remnant": 12, "Kepler's SN Remnant": 14, "SN 1987A": 0.3,
    // Globular clusters
    "47 Tucanae": 60, "Omega Centauri": 86,
    "M13": 84, "M22": 50, "M3": 90, "Palomar 5": 50,
    // Galaxy landmarks
    "Sun (You Are Here)": 7.35e-8, "Galactic Center": 500,
    "Sagittarius A*": 1.27e-6,
    // Local group
    "Sagittarius Dwarf": 5000, "Large Magellanic Cloud": 7000,
    "Small Magellanic Cloud": 3500, "Canis Major Dwarf": 4200,
    "Leo I": 500, "Triangulum (M33)": 30000,
    "NGC 185": 2500, "IC 10": 1500,
    // Cosmic scale
    "Virgo Cluster": 4e6, "Fornax Cluster": 2e6,
    "Centaurus Cluster": 2.5e6, "Great Attractor": 1.5e8,
    "M87": 60000, "NGC 1300": 55000, "IC 1101": 2e6
  };
  for (var i = 0; i < objects.length; i++) {
    if (!objects[i].physRadius && pr[objects[i].name] !== undefined) {
      objects[i].physRadius = pr[objects[i].name];
    }
  }
})();

// ─── Glossary data ────────────────────────────────────────────────────

var glossaryData = [
  { name: "Sun", cat: "Stars", color: "#ffdd44", short: "Our home star", long: "A perfectly ordinary G-type main-sequence star containing 99.86% of the solar system's mass. The Sun fuses 600 million tons of hydrogen per second. In about 5 billion years, it will swell into a red giant, engulfing Mercury and Venus." },
  { name: "Sirius", cat: "Stars", color: "#aaccff", short: "Brightest star in Earth's sky", long: "The Dog Star blazes at magnitude -1.46. At 8.6 light-years, Sirius is a binary: brilliant Sirius A and tiny Sirius B, a white dwarf the size of Earth with the Sun's mass. Ancient Egyptians based their calendar on its heliacal rising." },
  { name: "Betelgeuse", cat: "Stars", color: "#ff6633", short: "Dying red supergiant", long: "700 times the Sun's diameter -- if placed at our solar system's center, its surface would engulf Mars. Betelgeuse will explode as a supernova in the next 100,000 years. When it does, it will be visible in daylight for weeks." },
  { name: "Polaris", cat: "Stars", color: "#ffeedd", short: "The North Star", long: "Actually a triple star system containing a Cepheid variable that pulsates with clockwork precision. Cepheids are 'standard candles' for measuring cosmic distances, making Polaris a cornerstone of the cosmic distance ladder." },
  { name: "Deneb", cat: "Stars", color: "#bbccff", short: "Ancient light from 400 BC", long: "200,000 times the Sun's luminosity. Despite being 2,615 light-years away, it shines as one of the brightest stars. The light you see tonight left around the time of Socrates." },
  { name: "Rigel", cat: "Stars", color: "#99bbff", short: "Blue supergiant in Orion", long: "120,000 times the Sun's luminosity, Rigel illuminates the Witch Head Nebula with intense UV radiation. The 7th brightest star despite being 863 light-years away." },
  { name: "Orion Nebula", cat: "Nebulae", color: "#ff99aa", short: "Stellar nursery", long: "Visible to the naked eye as the fuzzy middle 'star' in Orion's sword. Inside this 24-light-year cloud, new stars are forming. The Trapezium cluster at its heart contains some of the youngest known stars." },
  { name: "Crab Nebula", cat: "Nebulae", color: "#dd8844", short: "Ghost of a star (1054 AD)", long: "Chinese astronomers recorded a 'guest star' visible in daylight for 23 days. What remains is an 11-light-year expanding cloud powered by a neutron star spinning 30 times per second -- a cosmic lighthouse." },
  { name: "Eagle Nebula", cat: "Nebulae", color: "#cc88ff", short: "Pillars of Creation", long: "Towering columns of gas and dust 5 light-years tall where new stars form. Infrared observations suggest a nearby supernova may have already destroyed the pillars -- but that light hasn't reached us yet." },
  { name: "Milky Way", cat: "Galaxies & Clusters", color: "#ffdd44", short: "Our home galaxy", long: "A barred spiral of 100-400 billion stars spanning 105,000 light-years. We orbit the center every 225 million years from the Orion Arm. Currently cannibalizing several dwarf galaxies." },
  { name: "Andromeda", cat: "Galaxies & Clusters", color: "#bbaaee", short: "SA(s)b barred spiral on a collision course", long: "Classified as an SA(s)b spiral galaxy, Andromeda contains a trillion stars approaching at 110 km/s. Hubble's 1923 discovery of Cepheid variables in Andromeda proved it was a separate galaxy, revolutionizing our understanding of the universe. In 4.5 billion years it will merge with the Milky Way into 'Milkomeda,' likely a giant elliptical galaxy." },
  { name: "Virgo Cluster", cat: "Galaxies & Clusters", color: "#ddbbff", short: "1,300+ galaxies", long: "At its heart sits M87, whose 6.5-billion-solar-mass black hole was the first ever directly imaged. The Virgo Cluster is the gravitational anchor of our supercluster." },
  { name: "Omega Centauri", cat: "Galaxies & Clusters", color: "#ffdd99", short: "Largest MW globular cluster", long: "10 million stars in a 150-light-year sphere. May be the stripped core of a dwarf galaxy consumed by the Milky Way billions of years ago." },
  { name: "Sagittarius A*", cat: "Extreme Phenomena", color: "#ff6600", short: "Our supermassive black hole", long: "4 million solar masses in a region smaller than Mercury's orbit. Stars orbiting it reach 3% light speed. First imaged by the EHT in 2022." },
  { name: "Cygnus X-1", cat: "Extreme Phenomena", color: "#aa44ff", short: "First confirmed black hole", long: "21 solar masses feeding on a blue supergiant. Subject of a famous bet between Hawking and Thorne -- Hawking conceded in 1990." },
  { name: "Magnetars", cat: "Extreme Phenomena", color: "#ff44aa", short: "Universe's strongest magnets", long: "SGR 1806-20 released a gamma-ray burst in 2004 that affected Earth's ionosphere from 50,000 light-years away. Their magnetic fields are a quadrillion times Earth's." },
  { name: "Neutron Stars", cat: "Extreme Phenomena", color: "#44ffaa", short: "Collapsed stellar cores", long: "20 km across, denser than atomic nuclei. A teaspoon weighs 6 billion tons. They spin up to 716 times per second, emitting beams we see as pulsars." },
  { name: "Great Attractor", cat: "Extreme Phenomena", color: "#ff8866", short: "Gravitational mystery", long: "Pulling the Milky Way and hundreds of thousands of galaxies at 600 km/s. Hidden behind our galaxy's disk, equivalent to 10 quadrillion Suns. Its true nature remains unknown." },
  { name: "Laniakea", cat: "Concepts", color: "#aa88cc", short: "'Immense heaven' in Hawaiian", long: "Our home supercluster: 100,000 galaxies spanning 520 million light-years, all flowing toward the Great Attractor. Discovered in 2014 by mapping galaxy velocities." },
  { name: "Light-year", cat: "Concepts", color: "#8888aa", short: "Distance light travels in a year", long: "9.46 trillion km. Light from the Sun takes 8 minutes. From Proxima Centauri, 4.24 years. From Andromeda, 2.5 million years. Looking at distant objects is looking back in time." },
  { name: "Cepheid Variables", cat: "Concepts", color: "#ffeebb", short: "Pulsating stars that measure the universe", long: "Cepheid variables pulsate with a period directly related to their intrinsic luminosity -- brighter Cepheids pulsate more slowly. This period-luminosity relationship, discovered by Henrietta Leavitt in 1912, makes them 'standard candles': by measuring a Cepheid's period, you know its true brightness, and comparing that to its apparent brightness gives its distance. Hubble used Cepheids in Andromeda to prove it was a separate galaxy." },
  { name: "Cosmic Web", cat: "Concepts", color: "#aa88cc", short: "The universe's largest structure", long: "Matter in the universe is not evenly distributed but organized into a vast web of filaments, walls, and nodes separated by enormous voids. Galaxy clusters sit at the nodes where filaments intersect, connected by tendrils of dark matter and gas stretching hundreds of millions of light-years. The cosmic web is the skeleton of the universe, shaped by gravity acting on tiny density fluctuations from the Big Bang." },
  { name: "Standard Candles", cat: "Concepts", color: "#ffcc88", short: "Objects of known brightness for measuring distance", long: "A 'standard candle' is any astronomical object whose intrinsic luminosity is known. By comparing how bright it appears to how bright it actually is, astronomers can calculate its distance. Cepheid variables, Type Ia supernovae, and tip-of-the-red-giant-branch stars are all standard candles. Each works at different distance ranges, forming rungs on the cosmic distance ladder that reaches from nearby stars to the edge of the observable universe." },

  // Solar System
  { name: "Earth", cat: "Solar System", color: "#4488cc", short: "Our pale blue dot", long: "The only known planet harboring life, orbiting the Sun at a distance of 1 AU -- about 8 light-minutes. Earth's liquid water, magnetic field, and atmosphere create a narrow habitable zone that has sustained life for nearly 4 billion years. From space, it appears as a pale blue dot suspended in a sunbeam." },
  { name: "Moon", cat: "Solar System", color: "#ccccbb", short: "Earth's faithful companion", long: "The Moon orbits Earth at 384,400 km -- just 1.28 light-seconds away. It stabilizes Earth's axial tilt, drives the tides, and has been a stepping stone for human exploration since Apollo 11 in 1969. From the Moon, Earth spans about 2 degrees of sky -- four times the Moon's apparent size from Earth. The Moon is slowly receding from Earth at 3.8 cm per year." },
  { name: "Mercury", cat: "Solar System", color: "#b5a08a", short: "Closest to the Sun", long: "The smallest planet in the solar system and the closest to the Sun, orbiting at just 0.39 AU. Mercury experiences extreme temperature swings from -170 to 430 degrees Celsius between its long nights and scorching days. Its year lasts only 88 Earth days, yet a single day-night cycle takes 176 Earth days." },
  { name: "Venus", cat: "Solar System", color: "#e8c06a", short: "Earth's toxic twin", long: "Similar in size to Earth, Venus suffered a runaway greenhouse effect that made it the hottest planet in the solar system at 465 degrees Celsius -- hot enough to melt lead. Its thick atmosphere of carbon dioxide creates crushing surface pressure 90 times Earth's. It rotates backward, so the Sun rises in the west." },
  { name: "Mars", cat: "Solar System", color: "#cc6644", short: "The Red Planet", long: "Home to Olympus Mons, the tallest volcano in the solar system at 22 km, and Valles Marineris, a canyon system stretching 4,000 km. Evidence of ancient river valleys and lake beds suggests Mars once had liquid water on its surface. It remains the prime target for human exploration beyond the Moon." },
  { name: "Ceres", cat: "Solar System", color: "#aaa08a", short: "Queen of the asteroid belt", long: "The largest object in the asteroid belt at 946 km across. Discovered in 1801, reclassified as a dwarf planet in 2006. Contains roughly a third of the belt's total mass. NASA's Dawn mission revealed bright salt deposits in Occator crater and evidence of cryovolcanic activity hinting at a subsurface ocean of briny water." },
  { name: "Jupiter", cat: "Solar System", color: "#d4a56a", short: "King of planets", long: "The largest planet in the solar system, more massive than all other planets combined. Jupiter's Great Red Spot is a storm larger than Earth that has raged for centuries. With at least 95 known moons, including the ocean world Europa, Jupiter's immense gravity acts as a cosmic shield, deflecting many asteroids that might otherwise threaten the inner planets." },
  { name: "Saturn", cat: "Solar System", color: "#e8d088", short: "The ringed wonder", long: "Famous for its spectacular ring system spanning 280,000 km but averaging only 10 meters thick, made mostly of ice particles. Saturn's moon Titan has a thick atmosphere and liquid methane lakes -- the only other body in the solar system with surface liquids. Saturn is so low in density that it would float in water if you could find a bathtub large enough." },
  { name: "Uranus", cat: "Solar System", color: "#88ccdd", short: "Sideways ice giant", long: "Unique among the planets for its extreme 98-degree axial tilt, likely caused by a massive ancient collision. Uranus essentially rolls around the Sun on its side, giving it the most extreme seasons in the solar system. Discovered by William Herschel in 1781, it was the first planet found with a telescope." },
  { name: "Neptune", cat: "Solar System", color: "#4466cc", short: "The windiest world", long: "The farthest planet from the Sun, Neptune hosts the fastest winds in the solar system at up to 2,100 km/h. Its largest moon Triton orbits backward, suggesting it was captured from the Kuiper Belt. Neptune was the first planet found by mathematical prediction rather than direct observation, discovered in 1846." },
  { name: "Pluto", cat: "Solar System", color: "#ccbbaa", short: "The demoted world", long: "Once the ninth planet, Pluto was reclassified as a dwarf planet in 2006 when the International Astronomical Union redefined what constitutes a planet. Orbiting in the Kuiper Belt at an average of 39.5 AU, it was visited by NASA's New Horizons spacecraft in 2015, revealing a world of nitrogen ice plains, mountains of water ice, and a thin atmosphere." },
  { name: "Charon", cat: "Solar System", color: "#aa9988", short: "Pluto's giant companion", long: "At 1,212 km across, Charon is more than half Pluto's diameter, making it the largest moon relative to its parent body in the solar system. The pair orbit each other around a point in space above Pluto's surface, leading some to call them a double dwarf planet. New Horizons revealed a surprisingly complex world with canyons, mountains, and a dark reddish polar cap informally named Mordor Macula." },

  // Lagrange Points & JWST
  { name: "Lagrange Points", cat: "Concepts", color: "#5588aa", short: "Gravitational balance points", long: "Five positions in any two-body orbital system where a small object can maintain a stable position relative to both large bodies. L1, L2, and L3 lie along the line connecting the two bodies and are unstable (requiring station-keeping). L4 and L5 form equilateral triangles with the two bodies and are stable. The Sun-Earth Lagrange points host major space observatories: SOHO at L1, JWST at L2." },
  { name: "JWST", cat: "Solar System", color: "#ddaa44", short: "Infrared eye on the universe",
    long: "The James Webb Space Telescope launched on December 25, 2021 and orbits the Sun-Earth L2 point, 1.5 million km from Earth. Its 6.5-meter primary mirror -- 18 gold-coated hexagonal beryllium segments -- collects infrared light with unprecedented sensitivity. A tennis court-sized sunshield keeps the instruments at -233\u00b0C. JWST has revealed the earliest galaxies ever seen, detailed atmospheric compositions of exoplanets, and star-forming regions in stunning clarity.",
    images: [
      { src: "img/jwst-deep-field.jpg", caption: "First Deep Field (SMACS 0723)", credit: "NASA/ESA/CSA/STScI" },
      { src: "img/jwst-pillars.jpg", caption: "Pillars of Creation (Eagle Nebula)", credit: "NASA/ESA/CSA/STScI" },
      { src: "img/jwst-carina.jpg", caption: "Carina Nebula 'Cosmic Cliffs'", credit: "NASA/ESA/CSA/STScI" },
      { src: "img/jwst-saturn.jpg", caption: "Saturn in near-infrared", credit: "NASA/ESA/CSA/STScI" }
    ] },

  // Spacecraft
  { name: "Voyager 1", cat: "Solar System", color: "#55ff88", short: "Humanity's farthest traveler", long: "Launched September 5, 1977, Voyager 1 is the most distant human-made object at roughly 165 AU from the Sun. It crossed the heliopause into interstellar space in August 2012. Its golden record carries 115 images, greetings in 55 languages, and 90 minutes of music. Despite traveling at 17 km/s, it would take 73,000 years to reach the nearest star. Its radio signal, traveling at light speed, takes over 22 hours to reach Earth." },
  { name: "Voyager 2", cat: "Solar System", color: "#55ddff", short: "Grand Tour of the giants", long: "Launched August 20, 1977 -- 16 days before Voyager 1 -- Voyager 2 is the only spacecraft to visit all four giant planets: Jupiter, Saturn, Uranus, and Neptune. Its Neptune flyby in 1989 revealed active geysers on Triton. It crossed the heliopause into interstellar space in November 2018 at roughly 140 AU from the Sun. Unlike Voyager 1, its plasma science instrument still works, providing unique data about the interstellar medium." },

  // Additional Stars
  { name: "Proxima Centauri", cat: "Stars", color: "#ff6644", short: "Nearest star to the Sun", long: "A small red dwarf just 4.24 light-years away -- the closest star to our solar system. Despite its proximity, it is far too faint to see with the naked eye. Proxima b, an Earth-sized planet in its habitable zone, orbits every 11 days. At Voyager 1's speed, reaching Proxima Centauri would take roughly 73,000 years." },
  { name: "\u03b1 Centauri A", cat: "Stars", color: "#ffee66", short: "Sun's nearest twin", long: "The brighter component of the Alpha Centauri binary system at 4.37 light-years, Alpha Centauri A is nearly identical to our Sun in mass, luminosity, and spectral type (G2V). It forms the closest star system to Earth along with its companions Alpha Centauri B and Proxima Centauri." },
  { name: "\u03b1 Centauri B", cat: "Stars", color: "#ffaa44", short: "The orange companion", long: "An orange dwarf star (K1V) orbiting its brighter partner Alpha Centauri A every 80 years at 4.37 light-years. Slightly smaller and cooler than the Sun, it is part of the nearest star system to our own. The pair would appear as a brilliant double star from nearby systems." },
  { name: "Barnard's Star", cat: "Stars", color: "#dd5533", short: "Fastest-moving star", long: "At 5.96 light-years, Barnard's Star has the highest proper motion of any known star, crossing the sky at 10.3 arcseconds per year. This ancient red dwarf is roughly twice the age of our Sun at about 10 billion years old. Despite being the fourth closest star, it is invisible to the naked eye." },
  { name: "Wolf 359", cat: "Stars", color: "#cc4422", short: "One of the faintest stars", long: "One of the faintest and lowest-mass stars known, Wolf 359 shines at just one-thousandth of the Sun's luminosity. At 7.86 light-years it is one of our nearest neighbors, yet it is completely invisible without a telescope, a reminder that most stars in the galaxy are dim red dwarfs." },
  { name: "Ross 154", cat: "Stars", color: "#cc5533", short: "A violent flare star", long: "A red dwarf flare star at 9.69 light-years that can suddenly brighten by several magnitudes in minutes. These violent outbursts release enormous amounts of energy, making Ross 154 a window into the dramatic lives of small stars that would otherwise seem unremarkable." },
  { name: "Tau Ceti", cat: "Stars", color: "#ffdd88", short: "Sun-like with possible planets", long: "A Sun-like star just 11.9 light-years away with five planet candidates detected in its habitable zone and beyond. Its similarity to our Sun and proximity have made Tau Ceti a perennial favorite in science fiction and a prime target for SETI searches." },
  { name: "Procyon", cat: "Stars", color: "#ddeeff", short: "The Little Dog Star", long: "The 8th brightest star in Earth's sky at 11.5 light-years, Procyon is a binary system with a white dwarf companion, mirroring the Sirius system in miniature. Its name means 'before the dog' because it rises shortly before Sirius, the Dog Star." },
  { name: "Vega", cat: "Stars", color: "#aabbff", short: "Future North Star", long: "In about 12,000 years, Earth's axial precession will make Vega our North Star. At 25 light-years away, this brilliant blue-white star was the first (besides the Sun) to be photographed (1850) and the first to have its spectrum recorded. It served as the original zero-point for the stellar magnitude scale." },
  { name: "Arcturus", cat: "Stars", color: "#ffbb66", short: "Light of the World's Fair", long: "The brightest star in the northern celestial hemisphere at 37 light-years. In 1933, light from Arcturus -- which had left the star around the time of the previous Chicago World's Fair in 1893 -- was focused through a telescope onto a photoelectric cell to trigger the opening of that year's exposition." },
  { name: "Aldebaran", cat: "Stars", color: "#ff8844", short: "Eye of the Bull", long: "The fiery orange eye of Taurus, Aldebaran is a red giant 44 times the Sun's diameter at 65 light-years. It appears embedded within the V-shaped Hyades star cluster, but this is a beautiful line-of-sight coincidence -- Aldebaran is only about half as far as the cluster." },
  { name: "Canopus", cat: "Stars", color: "#ffffcc", short: "Navigator of the cosmos", long: "The second brightest star in Earth's sky at 310 light-years, shining with 10,700 times the Sun's luminosity. Canopus serves as a key reference star for spacecraft navigation systems. Despite its brilliance, it is invisible from most of the Northern Hemisphere." },
  { name: "Antares", cat: "Stars", color: "#ff4422", short: "Heart of the Scorpion", long: "The red supergiant heart of the constellation Scorpius, 550 light-years away and 680 times the Sun's diameter. If Antares replaced the Sun, its surface would extend well past the orbit of Mars. Its ruddy color and brightness led the ancient Greeks to name it 'rival of Mars' -- Anti-Ares." },

  // Additional Nebulae
  { name: "Helix Nebula", cat: "Nebulae", color: "#44ddcc", short: "The Eye of God", long: "A planetary nebula 655 light-years away formed by a dying Sun-like star shedding its outer layers. Nicknamed the 'Eye of God' for its striking face-on appearance, the Helix is one of the closest planetary nebulae to Earth, spanning nearly 6 light-years across." },
  { name: "Ring Nebula", cat: "Nebulae", color: "#55ccff", short: "A stellar death mask", long: "A colorful shell of gas in the constellation Lyra, 2,283 light-years away. Ejected by a dying Sun-like star, the Ring Nebula is a preview of our own Sun's fate in about 5 billion years. Its central white dwarf, once the star's core, illuminates the expanding gas from within." },
  { name: "Carina Nebula", cat: "Nebulae", color: "#ff7788", short: "Nursery of giants", long: "One of the largest and brightest nebulae in the sky at 8,500 light-years, spanning about 300 light-years across. The Carina Nebula hosts Eta Carinae, an unstable hypergiant over 100 times the Sun's mass that may explode as a supernova at any time. It is one of the most active star-forming regions in the Milky Way." },

  // Additional Galaxies & Clusters
  { name: "Triangulum (M33)", cat: "Galaxies & Clusters", color: "#99aadd", short: "Third-largest Local Group member", long: "The third-largest galaxy in the Local Group at 2.73 million light-years, containing roughly 40 billion stars. Under ideal conditions, the Triangulum Galaxy is the most distant object visible to the naked eye, a testament to the remarkable sensitivity of the human eye across cosmic distances." },
  { name: "Large Magellanic Cloud", cat: "Galaxies & Clusters", color: "#88aadd", short: "Milky Way's largest satellite", long: "An irregular dwarf galaxy 160,000 light-years away, easily visible to the naked eye from the Southern Hemisphere. It contains the Tarantula Nebula, the most active star-forming region in the Local Group, and played a key role in the discovery of the period-luminosity relationship for Cepheid variables." },
  { name: "Small Magellanic Cloud", cat: "Galaxies & Clusters", color: "#7799cc", short: "Connected by a bridge of gas", long: "A dwarf irregular galaxy 200,000 light-years away, gravitationally bound to the Large Magellanic Cloud. The two are connected by a bridge of hydrogen gas called the Magellanic Bridge, and together they trail a vast stream of gas -- the Magellanic Stream -- that wraps around the Milky Way." },
  { name: "Sagittarius Dwarf", cat: "Galaxies & Clusters", color: "#8888aa", short: "Being consumed by the Milky Way", long: "A dwarf elliptical galaxy just 70,000 light-years from Earth that is in the process of being torn apart and absorbed by the Milky Way's tidal forces. Streams of its stars loop around our galaxy, making it a vivid example of galactic cannibalism happening in real time." },
  { name: "Galactic Center", cat: "Galaxies & Clusters", color: "#ffaa33", short: "Heart of the Milky Way", long: "The rotational center of our galaxy, roughly 26,000 light-years from Earth. Shrouded in dust and invisible at optical wavelengths, it is surrounded by dense star clusters and harbors the supermassive black hole Sagittarius A*. Radio and infrared telescopes have revealed a chaotic environment of hot gas, magnetic fields, and stars on extreme orbits." },
  { name: "47 Tucanae", cat: "Galaxies & Clusters", color: "#ffcc88", short: "Southern gem", long: "One of the most massive and luminous globular clusters in the Milky Way, visible to the naked eye from the Southern Hemisphere despite being 13,000 light-years away. It contains roughly one million stars packed into a sphere about 120 light-years across." },
  { name: "M13", cat: "Galaxies & Clusters", color: "#eedd88", short: "Target of humanity's message", long: "The Great Globular Cluster in Hercules at 22,200 light-years. In 1974, the Arecibo Observatory beamed a message toward M13 containing basic information about humanity -- it will arrive in about 25,000 years, by which time the cluster will have moved, but the gesture remains a landmark in SETI history." },
  { name: "M22", cat: "Galaxies & Clusters", color: "#ffcc66", short: "One of the nearest globulars", long: "One of the nearest globular clusters to Earth at 10,600 light-years in the constellation Sagittarius. Discovered by Abraham Ihle in 1665, it was the first globular cluster ever identified. M22 is also one of only a handful of globulars known to contain a planetary nebula." },
  { name: "M3", cat: "Galaxies & Clusters", color: "#eedd77", short: "King of variable stars", long: "A brilliant globular cluster 33,900 light-years away containing roughly half a million stars. M3 holds the record for the most known variable stars of any globular cluster -- over 270 -- making it an invaluable laboratory for studying stellar pulsation and evolution." },
  { name: "Palomar 5", cat: "Galaxies & Clusters", color: "#aa9988", short: "A cluster being torn apart", long: "A sparse globular cluster 75,700 light-years away that is being ripped apart by the Milky Way's tidal forces. Its spectacular tidal tails stretch roughly 30,000 light-years across the sky, providing a real-time view of how galaxies consume their satellites and offering clues about the distribution of dark matter." },
  { name: "M87", cat: "Galaxies & Clusters", color: "#ddbbff", short: "Home of the first imaged black hole", long: "A giant elliptical galaxy at the heart of the Virgo Cluster, 53.8 million light-years away. In 2019, the Event Horizon Telescope produced the first-ever image of a black hole: M87's central monster, weighing 6.5 billion solar masses. A relativistic jet of plasma extends 5,000 light-years from its core." },
  { name: "NGC 1300", cat: "Galaxies & Clusters", color: "#ccaa88", short: "Textbook barred spiral", long: "Considered the prototypical barred spiral galaxy at 61 million light-years in the constellation Eridanus. Its prominent central bar channels gas inward, fueling star formation in a ring around the core. NGC 1300 is the classic example used in textbooks to illustrate barred spiral structure." },
  { name: "IC 1101", cat: "Galaxies & Clusters", color: "#bbaacc", short: "One of the largest known galaxies", long: "A supergiant elliptical galaxy roughly 1 billion light-years away with a diameter of about 4 million light-years -- one of the largest known galaxies. If placed where the Milky Way is, its halo would engulf both Magellanic Clouds and reach halfway to Andromeda. It contains an estimated 100 trillion stars." },
  { name: "Fornax Cluster", cat: "Galaxies & Clusters", color: "#ccaaee", short: "Second richest nearby cluster", long: "The second richest cluster of galaxies within 100 million light-years, located about 62 million light-years away in the constellation Fornax. It contains hundreds of galaxies of all types and is a prime target for studying galaxy interactions and evolution in a dense environment." },
  { name: "Centaurus Cluster", cat: "Galaxies & Clusters", color: "#cc99dd", short: "Flowing toward the Great Attractor", long: "A galaxy cluster roughly 170 million light-years away in the direction of the constellation Centaurus. It lies along the path of the large-scale cosmic flow toward the Great Attractor, and its motion has been key to understanding the mysterious gravitational anomaly that pulls hundreds of thousands of galaxies." },
  { name: "Canis Major Dwarf", cat: "Galaxies & Clusters", color: "#7777aa", short: "Closest or mirage?", long: "Claimed to be the nearest galaxy to the Milky Way at just 25,000 light-years, but its very existence is debated. Some astronomers argue it is a genuine dwarf galaxy being consumed by our own; others believe it is simply a warp or overdensity in the Milky Way's outer disk masquerading as a separate galaxy." },
  { name: "Leo I", cat: "Galaxies & Clusters", color: "#aaaacc", short: "Distant satellite galaxy", long: "A dwarf spheroidal galaxy about 820,000 light-years from Earth, making it one of the most remote satellite galaxies of the Milky Way. Despite its distance, its orbital motion suggests it is still gravitationally bound to our galaxy, raising questions about the total mass of the Milky Way." },
  { name: "NGC 185", cat: "Galaxies & Clusters", color: "#8888aa", short: "Andromeda's satellite with surprises", long: "A dwarf spheroidal galaxy about 2 million light-years away, orbiting the Andromeda Galaxy. Unlike most dwarf spheroidals, NGC 185 shows evidence of recent star formation and contains interstellar dust and gas -- surprising features for a galaxy type usually considered old and quiescent." },
  { name: "IC 10", cat: "Galaxies & Clusters", color: "#7799bb", short: "Only starburst galaxy in Local Group", long: "The only known starburst galaxy in the Local Group, about 2.2 million light-years away. Despite its small size, IC 10 is undergoing an intense burst of star formation, producing massive Wolf-Rayet stars at a remarkable rate. Heavily obscured by the Milky Way's disk, it was one of the last Local Group members to be recognized." },

  // Additional Extreme Phenomena
  { name: "Crab Pulsar", cat: "Extreme Phenomena", color: "#ffaa22", short: "Heart of the Crab Nebula", long: "A neutron star at the center of the Crab Nebula, spinning 30 times per second. Born from the supernova of 1054 AD recorded by Chinese astronomers, this tiny remnant just 20 km across powers the entire nebula's glow with its rotational energy, emitting radiation from radio waves to gamma rays." },
  { name: "Tycho's Supernova", cat: "Extreme Phenomena", color: "#ff6644", short: "The star that changed astronomy (1572)", long: "In November 1572, Tycho Brahe observed a brilliant 'new star' in Cassiopeia that outshone Venus and remained visible for 16 months. His meticulous observations proved it was far beyond the Moon, shattering the Aristotelian belief that the heavens were perfect and unchanging. The remnant, 8,000 light-years away, was a Type Ia supernova -- a white dwarf that detonated after accreting too much matter from a companion star." },
  { name: "Kepler's Supernova", cat: "Extreme Phenomena", color: "#ee5533", short: "Last naked-eye supernova in the Milky Way (1604)", long: "Johannes Kepler studied this 'new star' in Ophiuchus for over a year, publishing 'De Stella Nova' in 1606. At 20,000 light-years away, it was the last supernova visible to the naked eye in our galaxy. Over 400 years later, astronomers are still waiting for the next one. Its remnant is now a rapidly expanding shell of hot gas studied across all wavelengths." },
  { name: "SN 1987A", cat: "Extreme Phenomena", color: "#ff8855", short: "First supernova neutrinos (1987)", long: "On February 23, 1987, a blue supergiant exploded in the Large Magellanic Cloud 168,000 light-years away -- the closest supernova since Kepler's in 1604. Hours before the light arrived, neutrino detectors in Japan (Kamiokande II) and the US (IMB) caught 25 neutrinos, confirming core-collapse theory and opening the era of neutrino astronomy. The expanding ring of debris continues to brighten as the shockwave catches up with material ejected thousands of years earlier." },

  // Exoplanets
  { name: "Proxima Centauri b", cat: "Stars", color: "#66aacc", short: "Nearest known exoplanet", long: "An Earth-mass world in the habitable zone of our nearest stellar neighbor, just 4.24 light-years away. Discovered in 2016, Proxima b orbits every 11.2 days. Its host star is a violent flare star, raising questions about whether any atmosphere could survive. If it has liquid water, it would be the closest possible abode for extraterrestrial life." },
  { name: "TRAPPIST-1 System", cat: "Stars", color: "#cc8866", short: "Seven Earth-sized worlds", long: "A remarkable system of seven rocky planets orbiting an ultra-cool red dwarf 39 light-years away. Three of the planets (e, f, and g) orbit in the habitable zone. All seven are close enough to each other that standing on one, you could see the others as clearly as we see the Moon. JWST is actively probing their atmospheres for signs of water and biosignatures." },
  { name: "Kepler-452b", cat: "Stars", color: "#77bb99", short: "Earth's bigger, older cousin", long: "Dubbed 'Earth 2.0' when discovered in 2015, Kepler-452b orbits a Sun-like star every 385 days at 1,800 light-years. About 60% larger than Earth, it sits in its star's habitable zone. Its host star is 1.5 billion years older than our Sun, offering a possible glimpse at Earth's future. Whether it is rocky or gaseous remains unknown." },

  // Additional Concepts
  { name: "Spiral Arms", cat: "Concepts", color: "#5588bb", short: "The galaxy's grand design", long: "The Milky Way's spiral arms are not solid structures but density waves -- regions where stars, gas, and dust pile up temporarily, like a cosmic traffic jam. Our Sun sits in the Orion Arm (also called the Orion Spur), a minor arm between the major Perseus and Sagittarius arms. Star formation concentrates in the arms because the density waves compress gas clouds, triggering collapse." },
  { name: "Dark Matter Halos", cat: "Concepts", color: "#8877aa", short: "Invisible scaffolding of galaxies", long: "Every galaxy is embedded in an enormous halo of dark matter extending far beyond its visible stars. The Milky Way's dark matter halo is estimated to reach 300,000 light-years or more -- several times the visible disk. Dark matter makes up about 85% of all matter in the universe. We cannot see it, but its gravity holds galaxies together: without it, stars at the edges of galaxies would fly off into intergalactic space." },
  { name: "Observable Universe", cat: "Concepts", color: "#9977bb", short: "The cosmic horizon at 46.5 billion light-years", long: "The observable universe extends 46.5 billion light-years in every direction -- not because the universe is 46.5 billion years old (it is 13.8 billion), but because space itself has been expanding. Light from the most distant visible objects has been traveling for 13.8 billion years, but the expansion of space has stretched that distance to 46.5 billion light-years. Beyond this horizon, light has not had time to reach us. There may be infinitely more universe beyond what we can observe." },
  { name: "Supernovae", cat: "Concepts", color: "#ff7744", short: "Stellar explosions that forge the elements", long: "A supernova is the explosive death of a star, briefly outshining its entire host galaxy. Type II supernovae occur when massive stars (8+ solar masses) exhaust their fuel and their cores collapse. Type Ia supernovae happen when white dwarfs exceed the Chandrasekhar limit by accreting matter from a companion. Both types seed the cosmos with heavy elements -- every atom of iron, gold, and uranium on Earth was forged in a supernova. Historic supernovae observed by Tycho (1572), Kepler (1604), and in the LMC (1987A) have shaped our understanding of stellar death." },
  { name: "Exoplanets", cat: "Concepts", color: "#66aacc", short: "Worlds beyond our solar system", long: "As of 2025, over 5,700 exoplanets have been confirmed orbiting other stars. The Kepler mission alone found thousands, revealing that planets are the rule rather than the exception -- on average, every star in the Milky Way has at least one planet. The nearest known exoplanet, Proxima Centauri b, orbits our closest stellar neighbor just 4.24 light-years away. JWST is now characterizing exoplanet atmospheres, searching for biosignatures like water vapor, methane, and oxygen." },
  { name: "51 Pegasi b", cat: "Stars", color: "#ff9944", short: "The first exoplanet found around a Sun-like star", long: "Discovered in 1995 by Michel Mayor and Didier Queloz, 51 Pegasi b shattered assumptions about planetary systems. A gas giant orbiting its star in just 4.2 days, it proved that 'hot Jupiters' could exist -- giant planets hugging their parent stars. This discovery earned the 2019 Nobel Prize in Physics and launched the exoplanet revolution." },
  { name: "HD 209458 b", cat: "Stars", color: "#ffaa55", short: "First transiting exoplanet -- 'Osiris'", long: "The first exoplanet observed crossing its star's face (1999), enabling astronomers to measure its size and study its atmosphere. Nicknamed 'Osiris,' observations revealed its atmosphere is boiling away, streaming hydrogen, carbon, and oxygen into space like a comet tail. It proved that exoplanet atmospheres could be studied from Earth." },
  { name: "WASP-12b", cat: "Stars", color: "#ff6633", short: "Ultra-hot Jupiter being devoured by its star", long: "One of the hottest known exoplanets at 2,600 C, WASP-12b orbits so close to its star that tidal forces stretch it into an egg shape. Darker than asphalt (it absorbs 94% of light), it is being slowly consumed -- losing mass that spirals onto its star. It will be completely destroyed within about 10 million years, a blink in cosmic time." },
  { name: "Constellations", cat: "Concepts", color: "#7888bb", short: "Flat patterns from a 3D universe", long: "Constellations are patterns of stars that appear close together on the sky but are typically at vastly different distances. Orion is a perfect example: Bellatrix (250 ly), Betelgeuse (700 ly), Rigel (863 ly), and the belt stars (1,200-2,000 ly) span nearly 10x in depth. The familiar shapes are accidents of our viewpoint -- from another star system, these constellations would be unrecognizable. Ancient cultures independently drew different patterns from the same stars." },

  // Orion constellation stars
  { name: "Bellatrix", cat: "Stars", color: "#99aaff", short: "Orion's closer shoulder", long: "The left shoulder of Orion at just 250 light-years -- much closer than the other bright Orion stars. Bellatrix demonstrates that constellation patterns are illusions of perspective: stars that appear side by side can be at wildly different distances. Its name means 'female warrior' in Latin." },
  { name: "Mintaka", cat: "Stars", color: "#aabbff", short: "Belt star nearly on the equator", long: "The westernmost (rightmost) star of Orion's Belt at 1,200 light-years. Mintaka sits almost exactly on the celestial equator, making it useful for navigation. It is actually a complex system of at least four stars orbiting each other." },
  { name: "Alnilam", cat: "Stars", color: "#bbccff", short: "Belt's center -- twice as far", long: "The center and brightest star of Orion's Belt, blazing at 275,000 times the Sun's luminosity from 2,000 light-years away. It is nearly twice as distant as its belt companions Mintaka and Alnitak, proving that the three 'aligned' stars are not physically associated -- they just happen to line up from Earth's viewpoint." },
  { name: "Alnitak", cat: "Stars", color: "#aabbff", short: "Sculptor of the Horsehead", long: "The easternmost (leftmost) belt star at 1,200 light-years. Its intense ultraviolet radiation illuminates the Flame Nebula and sculpts the iconic Horsehead Nebula, one of the most photographed objects in the sky. Alnitak is a triple star system." },
  { name: "Saiph", cat: "Stars", color: "#88aaff", short: "Orion's ultraviolet foot", long: "Orion's right foot (lower left as seen from the Northern Hemisphere) at 650 light-years. Despite having similar luminosity to Rigel, Saiph appears dimmer because more of its energy is emitted in the ultraviolet, invisible to our eyes. Its name derives from the Arabic for 'sword of the giant.'" },

  // Scorpius stars
  { name: "Dschubba", cat: "Stars", color: "#aabbff", short: "The Scorpion's forehead", long: "Delta Scorpii, the forehead of Scorpius at 490 light-years. A Be star that dramatically brightened in 2000 when its eccentric companion passed close by, ejecting a disk of gas. It has remained brighter than its historical magnitude ever since -- a rare event witnessed in real time." },
  { name: "Sargas", cat: "Stars", color: "#ffddaa", short: "Closer than the heart", long: "Theta Scorpii, a bright giant in the Scorpion's curved tail at 300 light-years -- significantly closer than the heart star Antares at 550 ly. The depth variation along the Scorpion's body shows how constellation shapes are accidents of perspective." },
  { name: "Shaula", cat: "Stars", color: "#99bbff", short: "The Scorpion's stinger", long: "Lambda Scorpii, the tip of the Scorpion's tail and the second brightest star in Scorpius after Antares. At 570 light-years, this triple star system marks one of the most recognizable asterisms in the southern sky." },

  // Big Dipper stars
  { name: "Dubhe", cat: "Stars", color: "#ffcc66", short: "The Dipper's dissolving edge", long: "Alpha Ursae Majoris, the front lip of the Big Dipper's bowl at 124 light-years. Crucially, Dubhe is NOT part of the Ursa Major Moving Group that includes 5 of the 7 Dipper stars. Over millions of years, Dubhe and Alkaid will drift away and the Big Dipper will lose its familiar shape." },
  { name: "Merak", cat: "Stars", color: "#ddeeff", short: "Pointer to Polaris", long: "Beta Ursae Majoris at 79 light-years. Draw a line from Merak through Dubhe and extend it about 5x the distance between them -- you will arrive at Polaris. This pointer trick has guided navigators for millennia." },
  { name: "Mizar", cat: "Stars", color: "#ddeeff", short: "Six stars pretending to be one", long: "Zeta Ursae Majoris at 78 light-years -- the most famous double star in the sky. Visible next to faint Alcor, Mizar was used as an ancient eye test. Modern spectroscopy revealed that Mizar is actually a sextuple system: six stars gravitationally bound, appearing as a single point of light." },
  { name: "Alkaid", cat: "Stars", color: "#bbccff", short: "The handle's orphan", long: "Eta Ursae Majoris, the tip of the Big Dipper's handle at 104 light-years. Like Dubhe, Alkaid is NOT part of the Ursa Major Moving Group. These two 'outsider' stars at opposite ends of the Dipper are slowly diverging from the five middle stars, meaning the Dipper is temporary -- it will be unrecognizable in about 50,000 years." },

  // Southern Cross stars
  { name: "Acrux", cat: "Stars", color: "#aabbff", short: "Pointer to the south pole", long: "Alpha Crucis, the brightest star in the Southern Cross at 321 light-years. A triple star system that serves as a celestial compass: extending the long axis of the Cross about 4.5x from Acrux points to the south celestial pole. Featured on the flags of Australia, New Zealand, Brazil, and Papua New Guinea." },
  { name: "Gacrux", cat: "Stars", color: "#ff9966", short: "The nearby red outsider", long: "Gamma Crucis, the top of the Southern Cross and its closest star at just 88 light-years -- less than a third the distance of the other three main stars. Its warm orange color against the blue-white of its companions is a visual clue to its very different nature and distance." },
  { name: "Mimosa", cat: "Stars", color: "#99bbff", short: "The pulsating cross arm", long: "Beta Crucis at 280 light-years, the left arm of the Southern Cross. A Beta Cephei variable that subtly pulsates in brightness over a few hours. The second brightest star in the Cross." },

  // Cassiopeia stars
  { name: "Gamma Cassiopeiae", cat: "Stars", color: "#aaccff", short: "Spinning near self-destruction", long: "The center peak of Cassiopeia's W at 550 light-years. A Be star rotating so fast it is nearly tearing itself apart, ejecting disks of gas that cause dramatic brightness fluctuations. It is also an anomalously strong X-ray source whose mechanism remains debated." },
  { name: "Schedar", cat: "Stars", color: "#ffaa66", short: "The orange queen", long: "Alpha Cassiopeiae at 228 light-years, the brightest star in Cassiopeia. Its warm orange color contrasts with the blue-white of its neighbors, similar to how Gacrux stands out in the Southern Cross -- different color often means different distance." },
  { name: "Caph", cat: "Stars", color: "#ffeedd", short: "Cassiopeia's closest star", long: "Beta Cassiopeiae at just 54 light-years -- by far the closest star in Cassiopeia's W. A Delta Scuti variable that pulsates rapidly. It sits at the left peak of the W, while the center peak (Gamma Cas at 550 ly) is ten times farther away." },
  { name: "Segin", cat: "Stars", color: "#bbccff", short: "The far end of the W", long: "Epsilon Cassiopeiae at 410 light-years, the rightmost peak of Cassiopeia's W-shape. Lying near the open cluster NGC 146, Segin shares the far side of Cassiopeia with Gamma Cas (550 ly), while the nearer stars Caph (54 ly) and Ruchbah (99 ly) create a striking depth contrast across the constellation." }
];

// ─── Tour definitions ─────────────────────────────────────────────────

var tourDefs = {
  paleblue: {
    name: "The Pale Blue Dot Tour",
    desc: "Earth to the Great Attractor and back",
    steps: [
      { vr: 0.00004, title: "This Is Home", body: "Earth orbits the Sun at 1 AU -- about 8 light-minutes away. A beam of sunlight you see right now left the Sun before you started reading this sentence. This tiny gap is where we begin.", scale: "~2.5 AU across", dwell: 10000 },
      { sky3d: { viewFrom: "moon", lookAt: "earth" }, title: "From the Moon", body: "Step onto the Moon and look back. Earth hangs in the sky, spanning about 2 degrees \u2014 four times the size of the Moon as seen from Earth. Every human who has ever lived, every civilization, every war and wonder, is on that blue marble. Only 24 people have ever seen this view.", scale: "384,400 km away", dwell: 14000 },
      { vr: 3, title: "The Sun's Domain", body: "Zoom out 75,000x. The Oort Cloud marks the outermost reach of the Sun's gravity -- a shell of icy bodies extending ~1.6 light-years out. Beyond this boundary, we belong to the galaxy. Voyager 1, launched in 1977, won't reach the Oort Cloud for another 300 years.", scale: "~6 ly across  |  75,000x wider", dwell: 12000 },
      { vr: 18, target: "Sirius", title: "The Nearest Stars", body: "Proxima Centauri, the closest star, is 4.24 light-years away -- at Voyager 1's speed, a 73,000-year journey. Sirius, the brightest star in our sky, is 8.6 ly out. Notice: most of our neighbors are dim red dwarfs, invisible to the naked eye.", scale: "~36 ly across  |  6x wider", dwell: 12000 },
      { vr: 90000, title: "The Milky Way", body: "Zoom out 5,000x. Our stellar neighborhood is an invisible speck in the Orion Arm. The galactic center lies 26,000 light-years away, harboring Sagittarius A* -- a black hole 4 million times the Sun's mass. The full disk spans 105,000 light-years.", scale: "~180,000 ly across  |  5,000x wider", dwell: 12000 },
      { vr: 300000, target: "Large Magellanic Cloud", title: "Satellite Galaxies", body: "The Milky Way isn't alone -- it's surrounded by smaller galaxies caught in its gravity. The Large Magellanic Cloud (160,000 ly) and Small Magellanic Cloud (200,000 ly) are visible to the naked eye from the Southern Hemisphere.", scale: "~600,000 ly across  |  3x wider", dwell: 12000 },
      { vr: 3.5 * MLY, target: "Andromeda (M31)", title: "The Local Group", body: "Zoom out 12x. The Milky Way is one of ~80 galaxies in the Local Group. Andromeda, 2.5 million light-years away and containing a trillion stars, is falling toward us at 110 km/s. The two galaxies will collide in about 4.5 billion years, merging into 'Milkomeda.'", scale: "~7 Mly across  |  12x wider", dwell: 14000 },
      { vr: 80 * MLY, target: "M87", title: "The Virgo Cluster", body: "Zoom out 23x. Our Local Group is a small outlier of the Virgo Cluster -- a swarm of 1,300+ galaxies, 54 million light-years away. At its heart sits M87, a giant elliptical galaxy whose supermassive black hole was the first ever directly imaged (2019).", scale: "~160 Mly across  |  23x wider", dwell: 12000 },
      { vr: 350 * MLY, target: "Great Attractor", title: "The Great Attractor", body: "Zoom out 4x more. Our Local Group, the Virgo Cluster, and thousands of other galaxies are all being pulled toward the Great Attractor at 600 km/s. This gravitational anomaly, equivalent to 10 quadrillion suns, is hidden behind the plane of our own galaxy. We're all inside the Laniakea Supercluster -- 'immense heaven' in Hawaiian.", scale: "~700 Mly across  |  4x wider", dwell: 14000 },
      { vr: 18, title: "Coming Home", body: "Now we reverse the journey -- collapsing 250 million light-years back down to the scale of our stellar neighborhood. Every star you see here is close enough that light from it left within a human lifetime. And yet the nearest one is still impossibly far by any human measure of distance.", scale: "Returning to ~36 ly across", dwell: 12000 },
      { vr: 0.00004, title: "Pale Blue Dot", body: "Back to Earth and Sun, separated by 8 light-minutes. From here to the Great Attractor spans 10 orders of magnitude -- a factor of 17 billion. All of human history, every border ever drawn, every journey ever taken, happened in this one tiny pixel of the cosmos.", scale: "Full range: 17,000,000,000 to 1", dwell: 12000 }
    ]
  },
  starlovers: {
    name: "Star Lovers Tour",
    desc: "10 stellar wonders near and far",
    steps: [
      { vr: 5, target: "Sirius", title: "Sirius \u2014 The Dog Star", body: "At 8.6 light-years, Sirius blazes at magnitude -1.46 \u2014 the brightest star in our sky. It's actually a binary: brilliant Sirius A and its tiny white dwarf companion Sirius B, which packs the Sun's mass into an Earth-sized sphere. Ancient Egyptians based their calendar on its rising.", scale: "8.6 ly from Earth", dwell: 12000 },
      { vr: 6, target: "Procyon", title: "Procyon \u2014 The Little Dog Star", body: "Just 11.5 light-years away, Procyon is the 8th brightest star. Like Sirius, it has a white dwarf companion. Its name means 'before the dog' \u2014 it rises before Sirius in the night sky.", scale: "11.5 ly from Earth", dwell: 11000 },
      { vr: 14, target: "Vega", title: "Vega \u2014 Future North Star", body: "In 12,000 years, Earth's axial precession will make Vega our North Star. This blue-white beauty at 25 light-years was the first star (besides the Sun) to be photographed and have its spectrum recorded.", scale: "25 ly from Earth", dwell: 12000 },
      { vr: 18, target: "Arcturus", title: "Arcturus \u2014 Light of the World's Fair", body: "An orange giant 25 times the Sun's diameter, Arcturus is the brightest star in the northern celestial hemisphere. Its light, collected by a telescope, was used to trigger the opening of the 1933 Chicago World's Fair.", scale: "37 ly from Earth", dwell: 12000 },
      { vr: 35, target: "Aldebaran", title: "Aldebaran \u2014 Eye of the Bull", body: "The red giant eye of Taurus, 44 times the Sun's diameter. Aldebaran appears embedded in the Hyades star cluster but is actually only half as far \u2014 a beautiful cosmic coincidence.", scale: "65 ly from Earth", dwell: 11000 },
      { vr: 220, target: "Polaris", title: "Polaris \u2014 The Guiding Light", body: "Earth's current North Star is a triple system containing a Cepheid variable \u2014 a star that pulsates with clockwork precision. Cepheids are 'standard candles' used to measure cosmic distances, making Polaris a cornerstone of the distance ladder.", scale: "433 ly from Earth", dwell: 12000 },
      { vr: 350, target: "Betelgeuse", title: "Betelgeuse \u2014 The Dying Giant", body: "A red supergiant so immense that if it replaced our Sun, its surface would reach past Mars \u2014 possibly Jupiter. Betelgeuse will explode as a supernova, perhaps tomorrow, perhaps in 100,000 years. When it does, it will be visible in daylight.", scale: "700 ly from Earth", dwell: 12000 },
      { vr: 450, target: "Rigel", title: "Rigel \u2014 Orion's Blue Foot", body: "A blue supergiant blazing at 120,000 times the Sun's luminosity. Rigel illuminates the nearby Witch Head Nebula with its intense ultraviolet radiation. It's the 7th brightest star despite being 863 light-years away.", scale: "863 ly from Earth", dwell: 12000 },
      { vr: 1300, target: "Deneb", title: "Deneb \u2014 Ancient Light", body: "One of the most luminous stars known: 200,000 times the Sun. The light you see from Deneb left around 400 BC, when Socrates walked the streets of Athens. It anchors the Summer Triangle and marks the tail of Cygnus.", scale: "2,615 ly from Earth", dwell: 12000 },
      { vr: 18, title: "Return to the Neighborhood", body: "Back among our closest stellar neighbors. Every star in this view is close enough that light reaches us within a human lifetime. Yet even the nearest \u2014 Proxima Centauri at 4.24 light-years \u2014 would take 73,000 years to reach at Voyager speed.", scale: "Returning to ~36 ly", dwell: 12000 }
    ]
  },
  extreme: {
    name: "Extreme Phenomena Tour",
    desc: "Black holes, pulsars, and cosmic mysteries",
    steps: [
      { vr: 500, target: "Vela Pulsar", title: "Vela Pulsar \u2014 Spinning Corpse", body: "Born from a supernova 11,000 years ago, this neutron star is just 20 km across but denser than an atomic nucleus. It spins 11 times per second, sweeping beams of radiation across the cosmos like a lighthouse.", scale: "936 ly from Earth", dwell: 12000 },
      { vr: 3200, target: "Crab Pulsar", title: "Crab Pulsar \u2014 The Guest Star's Heart", body: "Chinese astronomers recorded a 'guest star' in 1054 AD, so bright it was visible in daylight. Inside the resulting nebula spins a neutron star at 30 rotations per second, powering the entire Crab Nebula's glow.", scale: "6,500 ly from Earth", dwell: 12000 },
      { vr: 3000, target: "Cygnus X-1", title: "Cygnus X-1 \u2014 First Black Hole", body: "The first object widely accepted as a black hole, discovered via X-ray emissions in 1964. It contains 21 solar masses and feeds on a blue supergiant companion. Stephen Hawking famously bet against it being a black hole \u2014 and conceded in 1990.", scale: "6,070 ly from Earth", dwell: 12000 },
      { vr: 25000, target: "SGR 1806-20", title: "SGR 1806-20 \u2014 The Magnetar", body: "The most powerful magnetic object known. In 2004, it released a gamma-ray flare so intense it briefly altered Earth's ionosphere \u2014 from 50,000 light-years away. Its magnetic field is a quadrillion times Earth's.", scale: "50,000 ly from Earth", dwell: 12000 },
      { vr: 13000, target: "Sagittarius A*", title: "Sagittarius A* \u2014 Our Black Hole", body: "The supermassive black hole at the Milky Way's center: 4 million solar masses in a region smaller than Mercury's orbit. Stars orbiting it travel at 3% light speed. First directly imaged by the Event Horizon Telescope in 2022.", scale: "26,000 ly from Earth", dwell: 14000 },
      { vr: 30 * MLY, target: "M87", title: "M87* \u2014 The First Image", body: "In 2019, humanity captured the first-ever image of a black hole: M87*, a 6.5-billion-solar-mass monster at the heart of the Virgo Cluster. Its relativistic jet extends 5,000 light-years, powered by matter spiraling in.", scale: "53.8 Mly from Earth", dwell: 12000 },
      { vr: 150 * MLY, target: "Great Attractor", title: "The Great Attractor \u2014 Cosmic Mystery", body: "Something massive is pulling hundreds of thousands of galaxies toward it at 600 km/s. Hidden behind our galaxy's dusty disk, the Great Attractor's true nature remains uncertain \u2014 a vast concentration of mass equivalent to 10 quadrillion Suns.", scale: "250 Mly from Earth", dwell: 14000 },
      { vr: 350 * MLY, title: "The Edge of Sight", body: "Beyond the Great Attractor, the observable universe extends 46.5 billion light-years in every direction. At that boundary lies the cosmic microwave background \u2014 the afterglow of the Big Bang, light that has traveled for 13.8 billion years to reach us.", scale: "The observable universe", dwell: 14000 }
    ]
  },
  lifecycle: {
    name: "Death & Rebirth Tour",
    desc: "The stellar lifecycle from nursery to black hole",
    steps: [
      { vr: 700, target: "Orion Nebula", title: "Where Stars Are Born", body: "Stars begin inside vast clouds of gas and dust. In the Orion Nebula, gravity pulls pockets of hydrogen together until they ignite with nuclear fusion. Hundreds of stars are being born here right now, including some just 10,000 years old \u2014 newborns by cosmic standards.", scale: "1,344 ly from Earth", dwell: 12000 },
      { vr: 0.00004, title: "A Star Lives", body: "Our Sun is a middle-aged star, 4.6 billion years into a 10-billion-year life. It fuses 600 million tons of hydrogen per second, converting 4 million tons of matter into pure energy via E=mc\u00b2. This is the main sequence \u2014 the long, stable prime of a star's life.", scale: "Our solar system", dwell: 12000 },
      { vr: 350, target: "Betelgeuse", title: "A Star Ages", body: "When a massive star exhausts its hydrogen, it swells into a red supergiant. Betelgeuse has expanded to 700 times the Sun's diameter \u2014 if placed at our Sun's position, it would swallow Mars. Its core is desperately fusing heavier elements: helium, carbon, oxygen, silicon. When it reaches iron, the end comes.", scale: "700 ly from Earth", dwell: 14000 },
      { vr: 350, target: "Helix Nebula", title: "A Gentle Death", body: "Smaller stars like our Sun die gracefully. They shed their outer layers into space, forming planetary nebulae \u2014 some of the most beautiful objects in the cosmos. The Helix Nebula is the 'Eye of God': a dying star's last breath, illuminated by the tiny white dwarf at its center.", scale: "655 ly from Earth", dwell: 12000 },
      { vr: 1200, target: "Ring Nebula", title: "Beautiful Remains", body: "The Ring Nebula in Lyra \u2014 another star's final exhale. These shells of glowing gas enrich the cosmos with carbon, nitrogen, and oxygen forged in the star's core. In 5 billion years, our Sun will create its own planetary nebula, and the atoms in your body will return to interstellar space.", scale: "2,283 ly from Earth", dwell: 12000 },
      { vr: 3200, target: "Crab Nebula", title: "A Violent Death", body: "Massive stars die explosively. In 1054 AD, Chinese astronomers recorded a 'guest star' visible in daylight for 23 days. What they witnessed was a supernova \u2014 a star detonating with the energy of 10 billion Suns. The expanding shrapnel is the Crab Nebula, still racing outward at 1,500 km/s.", scale: "6,500 ly from Earth", dwell: 12000 },
      { vr: 3200, target: "Crab Pulsar", title: "The Compact Corpse", body: "At the Crab Nebula's heart spins a neutron star \u2014 the crushed core of the exploded star. Just 20 km across but with more mass than the Sun, a teaspoon would weigh a billion tons. It spins 30 times per second, sweeping beams of radiation like a lighthouse, powering the entire nebula's glow.", scale: "6,500 ly from Earth", dwell: 12000 },
      { vr: 3000, target: "Cygnus X-1", title: "Beyond the Grave", body: "The most massive stars leave behind something stranger: a black hole. Cygnus X-1 contains 21 solar masses compressed into a point of infinite density. It feeds on a blue supergiant companion, pulling streams of gas that spiral inward at near-light speed, radiating X-rays before crossing the event horizon forever.", scale: "6,070 ly from Earth", dwell: 14000 },
      { vr: 700, target: "Orion Nebula", title: "And It Begins Again", body: "But destruction seeds creation. The heavy elements forged in stellar cores and scattered by supernovae \u2014 the iron in your blood, the calcium in your bones, the oxygen you breathe \u2014 all were made inside stars that died before our Sun was born. From these ashes, new stars and planets form. The cycle never ends.", scale: "1,344 ly from Earth", dwell: 14000 }
    ]
  },
  ladder: {
    name: "The Distance Ladder Tour",
    desc: "How we measure the cosmos, rung by rung",
    steps: [
      { vr: 0.00004, target: "Earth", title: "Rung 1: Radar", body: "The first rung is direct measurement. We bounce radar signals off nearby planets and time the echo. Light travels to the Moon in 1.3 seconds, to Mars in ~3 minutes. This gives us the exact scale of the solar system \u2014 the baseline for everything that follows.", scale: "The solar system", dwell: 12000 },
      { vr: 3, target: "Proxima Centauri", title: "Rung 2: Parallax", body: "Hold your thumb up and blink each eye \u2014 it shifts against the background. Stars do the same as Earth orbits the Sun. By measuring a star's tiny angular shift over 6 months, we triangulate its distance. Proxima Centauri shifts by 0.77 arcseconds \u2014 the width of a quarter seen from 6.5 km away. Parallax works reliably out to about 1,000 light-years.", scale: "4.24 ly from Earth", dwell: 14000 },
      { vr: 220, target: "Polaris", title: "Rung 3: Cepheid Variables", body: "Beyond parallax range, we use 'standard candles' \u2014 objects of known brightness. Cepheid variables pulsate with periods that reveal their true luminosity. Polaris is a Cepheid: by comparing how bright it appears vs. how bright it truly is, we calculate its distance. Henrietta Leavitt discovered this relationship in 1908, unlocking the cosmos.", scale: "433 ly from Earth", dwell: 14000 },
      { vr: 2 * MLY, target: "Andromeda (M31)", title: "Rung 4: Cepheids in Other Galaxies", body: "In 1923, Edwin Hubble found Cepheid variables in the Andromeda 'nebula' and proved it was a separate galaxy 2.5 million light-years away \u2014 vastly farther than anything in the Milky Way. Overnight, the known universe expanded a thousandfold. JWST continues finding Cepheids in ever more distant galaxies.", scale: "2.5 Mly from Earth", dwell: 14000 },
      { vr: 4000, target: "Tycho's SN Remnant", title: "Rung 5: Type Ia Supernovae", body: "For the greatest distances, we need brighter candles. Type Ia supernovae \u2014 thermonuclear white dwarf explosions \u2014 all peak at nearly the same brightness: 5 billion Suns. Tycho saw one in 1572. By finding these explosions in distant galaxies, we measure distances across billions of light-years. This method revealed that the universe's expansion is accelerating.", scale: "8,000 ly from Earth", dwell: 14000 },
      { vr: 35 * MLY, target: "M87", title: "Rung 6: Hubble's Law", body: "The universe is expanding. Distant galaxies are receding, their light stretched to redder wavelengths. Hubble discovered that a galaxy's recession speed is proportional to its distance. By measuring redshift, we determine distance. M87 in the Virgo Cluster recedes at ~1,000 km/s, placing it 54 million light-years away.", scale: "53.8 Mly from Earth", dwell: 14000 },
      { vr: 350 * MLY, title: "The Furthest Reach", body: "Each rung of the ladder calibrates the next: radar anchors parallax, parallax anchors Cepheids, Cepheids anchor supernovae, supernovae anchor Hubble's Law. Any error in a lower rung propagates upward. The 'Hubble tension' \u2014 a disagreement in the expansion rate \u2014 suggests we may be missing something fundamental. The ladder reaches 13.8 billion light-years, but the mystery deepens with every rung we climb.", scale: "The observable universe", dwell: 14000 }
    ]
  },
  constellations: {
    name: "Constellations Up Close",
    desc: "Travel between the stars and see how constellations dissolve",
    steps: [
      { sky3d: { viewFrom: "earth", lookAt: "orion" }, title: "Orion from Home", body: "This is Orion as you see it on a clear winter night \u2014 the Hunter's familiar shape traced across the sky. Seven bright stars that look flat, as if painted on a dome. But Bellatrix is 250 light-years away while the belt stars are at 1,200\u20132,000 ly. The constellation is a corridor, not a picture.", scale: "3D Sky View", dwell: 12000 },
      { sky3d: { viewFrom: "trappist", lookAt: "orion" }, title: "Orion from TRAPPIST-1", body: "Travel 39 light-years to the TRAPPIST-1 system. Watch what happens to the Hunter. Bellatrix, the nearest bright star at 250 ly, lurches sideways \u2014 shifting dramatically. But the distant belt at 1,200\u20132,000 ly barely flickers. The proud symmetry dissolves. One shoulder flings wide while the other holds fast. A TRAPPIST-1 astronomer would see a different picture entirely.", scale: "39 ly from Earth", dwell: 14000 },
      { sky3d: { viewFrom: "betelgeuse", lookAt: "sol" }, title: "From Betelgeuse, Looking Home", body: "Now stand on the Hunter's shoulder, 700 light-years from Earth. Look back toward Sol. Can you find it? Our Sun is a faint point lost among thousands of equally dim stars. From here, Earth's constellations are meaningless \u2014 the entire sky is rearranged. The stars we connected into pictures are scattered across space, and we are inside the pattern now.", scale: "700 ly from Earth", dwell: 12000 },
      { sky3d: { viewFrom: "betelgeuse", lookAt: "orion" }, title: "Orion from Inside", body: "Turn to look where Orion should be \u2014 but the constellation doesn't exist from within. You ARE one of its stars. Rigel gleams below, 160 ly away. The belt stars are still distant at 500\u20131,300 ly. But Bellatrix, your former neighbor in the sky, is now behind you at 450 ly. The Hunter has been turned inside out.", scale: "Inside the constellation", dwell: 12000 },
      { sky3d: { viewFrom: "earth", lookAt: "scorpius" }, title: "Scorpius", body: "Return to Earth and find Scorpius low on the summer horizon. The red heart Antares glows at 550 light-years. The curving tail stretches 300 ly deep \u2014 nearby Sargas at 300 ly, distant Shaula at 570 ly. The Scorpion's body twists through three-dimensional space, its sinuous chain a pure accident of our line of sight.", scale: "3D Sky View", dwell: 14000 },
      { sky3d: { viewFrom: "earth", lookAt: "bigdipper" }, title: "The Big Dipper", body: "Five of the Big Dipper's seven stars share a secret \u2014 they were born from the same gas cloud and travel through space together at 54\u201379 ly. But Dubhe (124 ly) and Alkaid (104 ly) are outsiders, drifting on their own trajectories. In 50,000 years, the familiar ladle will be unrecognizable as these orphan stars diverge from the group.", scale: "3D Sky View", dwell: 14000 },
      { sky3d: { viewFrom: "earth", lookAt: "crux" }, title: "Southern Cross", body: "Gacrux, the red star at the top of the Cross, is just 88 ly away \u2014 less than a third the distance of the other three main stars at 280\u2013321 ly. Its warm orange color against their blue-white betrays its different nature and distance. Navigators have steered by this accidental alignment for centuries.", scale: "3D Sky View", dwell: 14000 },
      { sky3d: { viewFrom: "earth", lookAt: "cassiopeia" }, title: "Cassiopeia's Tunnel", body: "Cassiopeia's five W-shaped stars span a 10x range in depth: Caph at just 54 ly, and Gamma Cas at 550 ly. The nearest and farthest stars of this small pattern are separated by the same distance as Earth to the Orion Nebula. What looks like five stars on a flat surface is really a tunnel 500 light-years deep.", scale: "3D Sky View", dwell: 14000 },
      { sky3d: { viewFrom: "earth", lookAt: "orion" }, title: "All Just Perspective", body: "Return home. Every constellation is a snapshot \u2014 patterns that feel fixed and eternal are really stars at wildly different distances, each moving through the galaxy on its own trajectory. In a few hundred thousand years, every constellation will dissolve. Future civilizations will connect different stars into different pictures, and wonder if they, too, are permanent.", scale: "3D Sky View", dwell: 12000 }
    ]
  },
  exoworlds: {
    name: "Worlds Beyond Tour",
    desc: "Alien planets from our doorstep to deep space",
    steps: [
      { vr: 3, target: "Proxima Centauri b", title: "The Nearest World", body: "Just 4.24 light-years away orbits an Earth-mass planet in its star's habitable zone \u2014 where liquid water could exist. But Proxima Centauri is a violent red dwarf, blasting its planets with flares. Whether Proxima b retains an atmosphere is one of astrobiology's biggest questions. At Voyager speed, it would take 73,000 years to visit.", scale: "4.24 ly from Earth", dwell: 12000 },
      { vr: 22, target: "TRAPPIST-1 System", title: "Seven Worlds, One Star", body: "A dim red dwarf smaller than Jupiter hosts seven Earth-sized rocky planets, three in the habitable zone. The planets orbit so close that from one, you could see the others as large as our Moon. JWST is actively studying their atmospheres, searching for water vapor and signs of life. This tiny system may be humanity's best chance of finding life nearby.", scale: "39 ly from Earth", dwell: 14000 },
      { vr: 30, target: "51 Pegasi b", title: "The Planet That Changed Everything", body: "In 1995, Mayor and Queloz detected a Jupiter-mass planet orbiting its star in just 4.2 days \u2014 something thought impossible. 51 Pegasi b proved that giant planets could exist scorchingly close to their stars, forcing a revolution in planetary science. This single discovery opened the floodgates: over 5,700 exoplanets have been found since.", scale: "50 ly from Earth", dwell: 14000 },
      { vr: 80, target: "HD 209458 b", title: "Osiris \u2014 The Evaporating World", body: "The first exoplanet caught crossing its star's face, enabling us to measure its size and study its atmosphere. 'Osiris' is so close to its star that its atmosphere is boiling away, streaming hydrogen and carbon into space like a comet tail. This technique \u2014 transit spectroscopy \u2014 is how JWST now searches for biosignatures on distant worlds.", scale: "159 ly from Earth", dwell: 12000 },
      { vr: 700, target: "WASP-12b", title: "The Doomed Planet", body: "One of the most extreme worlds known. Surface temperature: 2,600\u00b0C. Darker than asphalt. Stretched into an egg by tidal forces. And slowly being devoured by its star \u2014 losing mass that spirals inward to its doom. WASP-12b will be completely consumed within 10 million years, a reminder that not all worlds endure.", scale: "1,410 ly from Earth", dwell: 12000 },
      { vr: 900, target: "Kepler-452b", title: "Earth's Older Cousin", body: "The most Earth-like planet found by Kepler: orbiting a Sun-like star, in the habitable zone, with a 385-day year. Its star is 1.5 billion years older than ours, offering a glimpse of Earth's possible future. At 1,800 light-years, we cannot yet study its atmosphere \u2014 but future telescopes may reveal whether this world has oceans, clouds, or life.", scale: "1,800 ly from Earth", dwell: 14000 },
      { vr: 18, title: "The Search Continues", body: "We have confirmed over 5,700 exoplanets, but the Milky Way holds an estimated 100\u2013400 billion more. Statistically, there are more planets than stars. Some are rocky worlds in habitable zones; others are gas giants, lava worlds, or rogue planets drifting starless through the dark. The question is no longer whether other worlds exist \u2014 it's whether any of them harbor life.", scale: "Our neighborhood", dwell: 12000 }
    ]
  },
  monsters: {
    name: "Cosmic Monsters Tour",
    desc: "The biggest, brightest, and most extreme",
    steps: [
      { vr: 350, target: "Betelgeuse", title: "The Giant Star", body: "700 times the Sun's diameter. If Betelgeuse replaced our Sun, its surface would engulf Mars \u2014 possibly Jupiter. Despite its immensity, it's a dying star, burning through its remaining fuel at a furious rate. It will explode as a supernova within 100,000 years, briefly visible in daylight from Earth.", scale: "700 ly from Earth", dwell: 12000 },
      { vr: 4000, target: "Carina Nebula", title: "The Monster Nebula", body: "One of the largest and brightest nebulae in the sky, spanning 300 light-years. Inside lurks Eta Carinae \u2014 an unstable hypergiant 100 times the Sun's mass that erupted violently in 1843, briefly becoming the second brightest star in the sky. It may explode as a hypernova at any time, potentially producing a gamma-ray burst.", scale: "8,500 ly from Earth", dwell: 12000 },
      { vr: 8000, target: "Omega Centauri", title: "The Captured Galaxy", body: "Officially a globular cluster, Omega Centauri is something far stranger: likely the stripped core of a dwarf galaxy consumed by the Milky Way billions of years ago. With 10 million stars and multiple stellar populations of different ages, it is the most massive globular cluster in our galaxy \u2014 a galaxy within a galaxy.", scale: "15,800 ly from Earth", dwell: 12000 },
      { vr: 25000, target: "SGR 1806-20", title: "The Ultimate Magnet", body: "The most powerful magnetic object in the known universe. In 2004, this magnetar released a gamma-ray flare so intense it altered Earth's ionosphere \u2014 from 50,000 light-years away. Its magnetic field is a quadrillion times Earth's. If it were halfway to the Moon, it would erase every credit card on Earth.", scale: "50,000 ly from Earth", dwell: 12000 },
      { vr: 13000, target: "Sagittarius A*", title: "Our Supermassive Black Hole", body: "At the Milky Way's center sits a 4-million-solar-mass black hole. Stars orbit it at 3% the speed of light. Its event horizon is smaller than Mercury's orbit, yet it anchors an entire galaxy of 200\u2013400 billion stars. First imaged by the Event Horizon Telescope in 2022, revealing the glowing ring of superheated gas spiraling to oblivion.", scale: "26,000 ly from Earth", dwell: 14000 },
      { vr: 30 * MLY, target: "M87", title: "The 6.5-Billion-Solar-Mass Monster", body: "The supermassive black hole at the heart of galaxy M87 \u2014 1,600 times more massive than Sagittarius A*. In 2019, the Event Horizon Telescope captured its shadow: the first direct image of a black hole. Its relativistic jet, powered by matter spiraling in, extends 5,000 light-years \u2014 a beam of plasma traveling at nearly light speed.", scale: "53.8 Mly from Earth", dwell: 14000 },
      { vr: 150 * MLY, target: "Great Attractor", title: "The Invisible Force", body: "Something equivalent to 10 quadrillion Suns is pulling hundreds of thousands of galaxies \u2014 including ours \u2014 toward it at 600 km/s. Hidden behind the Milky Way's dusty plane, the Great Attractor's true nature remains uncertain. It may be a vast supercluster of galaxies, or something we haven't yet imagined. The ultimate cosmic monster may be the one we can't see.", scale: "250 Mly from Earth", dwell: 14000 }
    ]
  }
};

// ─── Reference distances ──────────────────────────────────────────────

var refDistances = [
  { name: "Earth \u2192 Sun", dist: AU_IN_LY, color: "#4488cc" },
  { name: "Sun \u2192 Proxima Cen.", dist: 4.24, color: "#ff6644" },
  { name: "Sun \u2192 Sirius", dist: 8.6, color: "#aaccff" },
  { name: "Sun \u2192 Vega", dist: 25, color: "#aabbdd" },
  { name: "Sun \u2192 Betelgeuse", dist: 700, color: "#ff8855" },
  { name: "Sun \u2192 Deneb", dist: 2615, color: "#99bbff" },
  { name: "Sun \u2192 Galactic Center", dist: 26000, color: "#ddaa44" },
  { name: "Milky Way diameter", dist: 105000, color: "#6699cc" },
  { name: "MW \u2192 Andromeda", dist: 2.537 * MLY, color: "#bbaaee" },
  { name: "Local Group diameter", dist: 10 * MLY, color: "#9999cc" }
];

// ─── Cosmic filament data ─────────────────────────────────────────────

var cosmicFilamentNodes = [
  { x: 0, y: 0 },                         // Milky Way
  { x: -40 * MLY, y: -35 * MLY },         // Virgo Cluster
  { x: 30 * MLY, y: -52 * MLY },          // Fornax Cluster
  { x: -110 * MLY, y: -90 * MLY },        // Centaurus Cluster
  { x: -140 * MLY, y: -210 * MLY }        // Great Attractor
];

var cosmicFilamentLinks = [
  [0, 1], [1, 3], [1, 2], [3, 4], [0, 2]
];

var cosmicVoids = [
  { name: "Local Void", x: 50 * MLY, y: 30 * MLY },
  { name: "Sculptor Void", x: 60 * MLY, y: -100 * MLY },
  { name: "Microscopium Void", x: -60 * MLY, y: -150 * MLY }
];

// ─── Constellation definitions ────────────────────────────────────────

var constellationDefs = {
  orion: {
    name: "Orion",
    depthLabel: "250 \u2013 2,000 ly deep",
    color: "rgba(120, 140, 200, ALPHA)",
    labelAnchor: "Bellatrix", labelDx: 80, labelDy: -30,
    lines: [
      ["Betelgeuse", "Bellatrix"],
      ["Betelgeuse", "Alnitak"],
      ["Bellatrix", "Mintaka"],
      ["Alnitak", "Alnilam"],
      ["Alnilam", "Mintaka"],
      ["Alnitak", "Saiph"],
      ["Mintaka", "Rigel"],
      ["Rigel", "Saiph"]
    ]
  },
  scorpius: {
    name: "Scorpius",
    depthLabel: "300 \u2013 570 ly deep",
    color: "rgba(200, 120, 100, ALPHA)",
    labelAnchor: "Antares", labelDx: -90, labelDy: 0,
    lines: [
      ["Dschubba", "Antares"],
      ["Antares", "Sargas"],
      ["Sargas", "Shaula"]
    ]
  },
  bigdipper: {
    name: "Big Dipper",
    depthLabel: "54 \u2013 124 ly deep",
    color: "rgba(140, 160, 200, ALPHA)",
    labelAnchor: "Phecda", labelDx: 50, labelDy: -30,
    lines: [
      ["Dubhe", "Merak"],
      ["Merak", "Phecda"],
      ["Phecda", "Megrez"],
      ["Megrez", "Dubhe"],
      ["Megrez", "Alioth"],
      ["Alioth", "Mizar"],
      ["Mizar", "Alkaid"]
    ]
  },
  crux: {
    name: "Southern\nCross",
    depthLabel: "88 \u2013 345 ly deep",
    color: "rgba(140, 180, 220, ALPHA)",
    labelAnchor: "Gacrux", labelDx: 70, labelDy: -10,
    lines: [
      ["Gacrux", "Acrux"],
      ["Mimosa", "Delta Crucis"]
    ]
  },
  cassiopeia: {
    name: "Cassiopeia",
    depthLabel: "54 \u2013 550 ly deep",
    color: "rgba(180, 150, 200, ALPHA)",
    labelAnchor: "Gamma Cassiopeiae", labelDx: 0, labelDy: -35,
    lines: [
      ["Caph", "Schedar"],
      ["Schedar", "Gamma Cassiopeiae"],
      ["Gamma Cassiopeiae", "Ruchbah"],
      ["Ruchbah", "Segin"]
    ]
  }
};

// ─── 3D camera slot defaults ──────────────────────────────────────────

// Viewpoint presets: name -> object to stand at
var cam3dViewpoints = [
  { key: 'earth', label: 'Earth', obj: 'Earth' },
  { key: 'moon', label: 'Moon', obj: 'Moon' },
  { key: 'sirius', label: 'Sirius', obj: 'Sirius' },
  { key: 'trappist', label: 'TRAPPIST-1', obj: 'TRAPPIST-1 System' },
  { key: 'betelgeuse', label: 'Betelgeuse', obj: 'Betelgeuse' },
  { key: 'deneb', label: 'Deneb', obj: 'Deneb' },
  { key: 'andromeda', label: 'Andromeda (V1)', obj: "V1 (Hubble's Cepheid)" },
  { key: 'greatattractor', label: 'Great Attractor', obj: 'Great Attractor' }
];

// Look-at targets: constellations (centroid) + individual objects
var cam3dLookTargets = [
  { key: 'sol', label: 'Sol', type: 'object', obj: 'Sun' },
  { key: 'orion', label: 'Orion', type: 'constellation', id: 'orion' },
  { key: 'bigdipper', label: 'Big Dipper', type: 'constellation', id: 'bigdipper' },
  { key: 'scorpius', label: 'Scorpius', type: 'constellation', id: 'scorpius' },
  { key: 'crux', label: 'Southern Cross', type: 'constellation', id: 'crux' },
  { key: 'cassiopeia', label: 'Cassiopeia', type: 'constellation', id: 'cassiopeia' },
  { key: 'milkyway', label: 'Milky Way', type: 'object', obj: 'Milky Way (You Are Here)' },
  { key: 'greatattractor', label: 'Great Attractor', type: 'object', obj: 'Great Attractor' }
];

// ─── Scene presets ────────────────────────────────────────────────────
// Each scene captures a complete viewing experience: camera, time, effects, HUD

var scenePresets = [
  { key: 'inner-planets',
    label: 'Inner Planets',
    desc: 'Watch Mercury, Venus, Earth and Mars orbit the Sun',
    orbitObj: 'Earth', orbitDistAU: 0.3,
    orbitYawDeg: 175.6, orbitPitchDeg: -17,
    timeSpeed: 604800, hudStyle: 'cinematic',
    effects: { orbitalPlanes: true, orbits: true } },
  { key: 'solar-system',
    label: 'Solar System',
    desc: 'All planets from above — a year every second',
    orbitObj: 'Sun (You Are Here)', orbitDistAU: 60,
    orbitYawDeg: 0, orbitPitchDeg: 80,
    timeSpeed: 31557600, hudStyle: 'cinematic',
    effects: { orbitalPlanes: true, orbits: true } },
  { key: 'jupiter-system',
    label: 'Jupiter System',
    desc: 'The king of planets up close',
    orbitObj: 'Jupiter', orbitDistAU: 0.02,
    orbitYawDeg: 45, orbitPitchDeg: 20,
    timeSpeed: 86400, hudStyle: 'cinematic',
    effects: { orbitalPlanes: true } },
  { key: 'pluto-charon',
    label: 'Pluto & Charon',
    desc: 'The binary dwarf planet dance',
    orbitObj: 'Pluto', orbitDistAU: 0.002,
    orbitYawDeg: 30, orbitPitchDeg: 35,
    timeSpeed: 86400, hudStyle: 'minimal',
    effects: { orbitalPlanes: true } },
  { key: 'mercury-sprint',
    label: 'Mercury Sprint',
    desc: 'The fastest planet — one orbit in 88 days',
    orbitObj: 'Mercury', orbitDistAU: 0.15,
    orbitYawDeg: 0, orbitPitchDeg: 10,
    timeSpeed: 604800, hudStyle: 'bold',
    effects: { orbitalPlanes: true, orbits: true } },
  { key: 'earth-moon',
    label: 'Earth & Moon',
    desc: 'Watch the Moon orbit — one cycle per month',
    orbitObj: 'Earth', orbitDistAU: 0.01,
    orbitYawDeg: 90, orbitPitchDeg: 25,
    timeSpeed: 86400, hudStyle: 'cinematic',
    effects: { orbitalPlanes: false } },
  { key: 'starfield',
    label: 'Starfield',
    desc: 'Drift among the stars from Earth',
    orbitObj: 'Earth', orbitDistAU: 0.0001,
    orbitYawDeg: 83, orbitPitchDeg: -1,
    timeSpeed: 1, hudStyle: 'retro',
    effects: { orbitalPlanes: false, orbits: false } },
  { key: 'deep-space',
    label: 'Deep Space',
    desc: 'View the cosmic web from the Great Attractor',
    orbitObj: 'Great Attractor', orbitDistAU: 1e9,
    orbitYawDeg: 0, orbitPitchDeg: 30,
    timeSpeed: 1, hudStyle: 'minimal',
    effects: { orbitalPlanes: false } }
];
