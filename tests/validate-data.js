#!/usr/bin/env node
// Data integrity validator — automates the CLAUDE.md housekeeping checklist.
// Usage: node tests/validate-data.js   (exit 0 = all pass, 1 = failures)
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.resolve(__dirname, '..');
var failures = 0;
var checks = 0;

function pass(name, note) { checks++; console.log('  PASS  ' + name + (note ? ' — ' + note : '')); }
function fail(name, details) {
  checks++; failures++;
  console.log('  FAIL  ' + name);
  (Array.isArray(details) ? details : [details]).forEach(function (d) { console.log('        - ' + d); });
}

// ── Load data.js in a sandbox ────────────────────────────────────────────
var ctx = {};
vm.createContext(ctx);
try {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/data.js'), 'utf8'), ctx, { filename: 'data.js' });
} catch (e) {
  console.error('FATAL: js/data.js failed to parse: ' + e.message);
  process.exit(1);
}

// ── Extract glossaryObjMap literal from app.js ───────────────────────────
var appSrc = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
var mapMatch = appSrc.match(/var glossaryObjMap = \{[\s\S]*?\n\};/);
var glossaryObjMap = {};
if (mapMatch) {
  var mctx = {};
  vm.createContext(mctx);
  vm.runInContext(mapMatch[0], mctx);
  glossaryObjMap = mctx.glossaryObjMap;
}

var objects = ctx.objects || [];
var glossaryData = ctx.glossaryData || [];
var objByName = {};
objects.forEach(function (o) { objByName[o.name] = o; });

console.log('validate-data: ' + objects.length + ' objects, ' + glossaryData.length + ' glossary entries\n');

// 1. Unique names
(function () {
  function dupes(arr) {
    var seen = {}, d = [];
    arr.forEach(function (n) { if (seen[n]) d.push(n); seen[n] = 1; });
    return d;
  }
  var d1 = dupes(objects.map(function (o) { return o.name; }));
  var d2 = dupes(glossaryData.map(function (g) { return g.name; }));
  if (d1.length || d2.length) fail('unique names', d1.concat(d2).map(function (n) { return 'duplicate: ' + n; }));
  else pass('unique names');
})();

// 2. Required fields (hard) + per-category majority fields (soft outliers)
(function () {
  var problems = [];
  objects.forEach(function (o) {
    if (typeof o.name !== 'string' || !o.name) problems.push('object without name near index ' + objects.indexOf(o));
    if (typeof o.category !== 'string') problems.push(o.name + ': missing category');
    if (typeof o.dist !== 'number' || isNaN(o.dist)) problems.push(o.name + ': dist not a number');
    if (typeof o.x !== 'number' || typeof o.y !== 'number') problems.push(o.name + ': x/y not numeric');
    if (typeof o.desc !== 'string' || !o.desc) problems.push(o.name + ': missing desc');
    if (typeof o.type !== 'string' || !o.type) problems.push(o.name + ': missing type');
  });
  if (problems.length) fail('required fields', problems); else pass('required fields');
})();

// 3. Tour step targets resolve
(function () {
  var problems = [];
  var tours = ctx.tourDefs || {};
  Object.keys(tours).forEach(function (tid) {
    (tours[tid].steps || []).forEach(function (s, i) {
      if (s.target && !objByName[s.target]) problems.push(tid + ' step ' + i + ': unknown target "' + s.target + '"');
      if (s.simTimeJ2000 !== undefined && typeof s.simTimeJ2000 !== 'number') problems.push(tid + ' step ' + i + ': simTimeJ2000 not numeric');
    });
  });
  if (problems.length) fail('tour targets', problems); else pass('tour targets');
})();

// 4. Glossary sync (objects covered by glossary directly, via glossaryObjMap, or group rules)
(function () {
  var glossaryNames = {};
  glossaryData.forEach(function (g) { glossaryNames[g.name] = 1; });
  var mapped = {};
  Object.keys(glossaryObjMap).forEach(function (k) { mapped[glossaryObjMap[k]] = 1; });
  // Group-entry coverage per CLAUDE.md housekeeping rules
  var GROUP_RULES = [
    { test: function (o) { return / Arm$/.test(o.name); }, entry: 'Spiral Arms' },
    { test: function (o) { return /Cephei/.test(o.name) || o.type === 'Cepheid Variable'; }, entry: 'Cepheid Variables' },
    { test: function (o) { return /^L[1-5]$/.test(o.name); }, entry: 'Lagrange Points' },
    { test: function (o) { return /^Apollo \d+$/.test(o.name); }, entry: 'Apollo Program' },
    { test: function (o) { return /\(You Are Here\)/.test(o.name); }, entry: null }
  ];
  var problems = [];
  objects.forEach(function (o) {
    if (glossaryNames[o.name] || mapped[o.name]) return;
    for (var i = 0; i < GROUP_RULES.length; i++) {
      if (GROUP_RULES[i].test(o)) {
        if (GROUP_RULES[i].entry === null || glossaryNames[GROUP_RULES[i].entry]) return;
      }
    }
    problems.push(o.name + ' (' + o.category + ') has no glossary entry, mapping, or group rule');
  });
  if (problems.length) fail('glossary sync', problems); else pass('glossary sync', 'map has ' + Object.keys(glossaryObjMap).length + ' indirect entries');
})();

// 5. catRanges coverage (objects without visRange must sit inside their category range)
(function () {
  var catRanges = ctx.catRanges || {};
  var problems = [];
  objects.forEach(function (o) {
    if (o.visRange) {
      if (!(o.visRange.length === 2 && o.visRange[0] < o.visRange[1])) problems.push(o.name + ': malformed visRange');
      return;
    }
    var r = catRanges[o.category];
    if (!r) { problems.push(o.name + ': category "' + o.category + '" has no catRange'); return; }
    if (o.dist > 0 && (o.dist < r[0] * 0.99 || o.dist > r[1] * 1.01)) {
      problems.push(o.name + ': dist ' + o.dist + ' ly outside catRange [' + r[0] + ', ' + r[1] + '] for ' + o.category);
    }
  });
  if (problems.length) fail('catRange coverage', problems); else pass('catRange coverage');
})();

// 6. Constellation star references
(function () {
  var problems = [];
  var defs = ctx.constellationDefs || {};
  Object.keys(defs).forEach(function (cid) {
    var c = defs[cid];
    if (c.labelAnchor && !objByName[c.labelAnchor]) problems.push(cid + ': labelAnchor "' + c.labelAnchor + '" unknown');
    (c.lines || []).forEach(function (line) {
      (Array.isArray(line) ? line : [line]).forEach(function (star) {
        if (typeof star === 'string' && !objByName[star]) problems.push(cid + ': star "' + star + '" unknown');
      });
    });
  });
  if (problems.length) fail('constellation refs', problems); else pass('constellation refs');
})();

// 7. Image paths exist on disk
(function () {
  var problems = [];
  function checkSrc(owner, src) {
    if (typeof src !== 'string') { problems.push(owner + ': non-string src'); return; }
    if (!fs.existsSync(path.join(ROOT, src))) problems.push(owner + ': missing file ' + src);
  }
  glossaryData.forEach(function (g) {
    (g.images || []).forEach(function (im) { checkSrc('glossary "' + g.name + '"', im.src); });
  });
  objects.forEach(function (o) {
    (o.gallery || []).forEach(function (im) { checkSrc('object "' + o.name + '"', im.src); });
  });
  if (problems.length) fail('image paths', problems); else pass('image paths');
})();

// 8. Viewpoints / look targets / scene presets resolve
(function () {
  var problems = [];
  (ctx.cam3dViewpoints || []).forEach(function (v) {
    if (v.obj && !objByName[v.obj]) problems.push('viewpoint ' + v.key + ': unknown obj "' + v.obj + '"');
  });
  var defs = ctx.constellationDefs || {};
  (ctx.cam3dLookTargets || []).forEach(function (t) {
    if (t.type === 'object' && t.obj && !objByName[t.obj]) problems.push('lookTarget ' + t.key + ': unknown obj "' + t.obj + '"');
    if (t.type === 'constellation' && t.id && !defs[t.id]) problems.push('lookTarget ' + t.key + ': unknown constellation "' + t.id + '"');
  });
  (ctx.scenePresets || []).forEach(function (p) {
    if (p.orbitObj && !objByName[p.orbitObj]) problems.push('scene ' + p.key + ': unknown orbitObj "' + p.orbitObj + '"');
  });
  if (problems.length) fail('viewpoint/scene refs', problems); else pass('viewpoint/scene refs');
})();

// 9. refDistances sane and ascending
(function () {
  var problems = [];
  var prev = 0;
  (ctx.refDistances || []).forEach(function (r) {
    if (typeof r.dist !== 'number' || r.dist <= 0) problems.push(r.name + ': non-positive dist');
    else if (r.dist < prev) problems.push(r.name + ': not ascending (' + r.dist + ' after ' + prev + ')');
    else prev = r.dist;
  });
  if (problems.length) fail('refDistances', problems); else pass('refDistances', (ctx.refDistances || []).length + ' entries ascending');
})();

// 10. Regions bounds
(function () {
  var problems = [];
  (ctx.regions || []).forEach(function (r) {
    if (!(r.minVR < r.maxVR)) problems.push(r.name + ': minVR >= maxVR');
    if (r.minVR < 0 || !isFinite(r.maxVR)) problems.push(r.name + ': bad bounds');
  });
  if (problems.length) fail('region bounds', problems); else pass('region bounds');
})();

console.log('\n' + (checks - failures) + '/' + checks + ' checks passed' + (failures ? ' — ' + failures + ' FAILED' : ''));
process.exit(failures ? 1 : 0);
