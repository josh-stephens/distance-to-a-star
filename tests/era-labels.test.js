#!/usr/bin/env node
// Tests getHistoricalEvent ("when this light left") era labels for historical accuracy.
// Extracts the function from js/app.js and runs it in a sandbox.
// Usage: node tests/era-labels.test.js   (exit 0 = pass, 1 = fail)
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var appSrc = fs.readFileSync(path.resolve(__dirname, '../js/app.js'), 'utf8');
var m = appSrc.match(/function getHistoricalEvent\(distLy\) \{[\s\S]*?\n\}/);
if (!m) { console.error('FATAL: getHistoricalEvent not found in js/app.js'); process.exit(1); }
var ctx = {};
vm.createContext(ctx);
vm.runInContext(m[0], ctx);
var getHistoricalEvent = ctx.getHistoricalEvent;

// [distance ly, required substring, forbidden substring or null, label]
var CASES = [
  [0.05, 'days ago', null, 'light-days scale unchanged'],
  [3, 'just a few years ago', 'COVID', '3 ly left 2023 — not "before the pandemic"'],
  [8.6, 'just a few years ago', null, 'Sirius: 2017 is recent'],
  [25, 'internet', 'Civil War', 'Vega: 2001, internet era'],
  [100, 'World Wars', 'Civil War', '100 ly: 1926 — NOT before the Civil War'],
  [548, 'before Columbus', 'Viking', 'Betelgeuse: 1478 AD is just before Columbus (1492), NOT the Viking Age'],
  [1000, 'Viking', 'Rome', '1000 ly: 1026 AD is late Viking Age (it ends 1066)'],
  [1150, 'Viking', null, '1150 ly: 876 AD is squarely the Viking Age'],
  [1400, 'Middle Ages', 'Viking', '1400 ly: 626 AD is early medieval, pre-Viking'],
  [1800, 'Rome', null, '1800 ly: 226 AD, Roman Empire'],
  [2615, 'ancient Egypt', 'Rome', 'Deneb: 589 BC — ancient Egypt, not imperial Rome'],
  [12000, 'Ice Age', 'pyramids', '12,000 ly: last Ice Age'],
  [50000, 'Africa', null, '50 kly: human migration out of Africa'],
  [250000, 'Homo sapiens', null, '250 kly: early Homo sapiens'],
  [1.5e6, 'genus Homo', null, '1.5 Mly: genus Homo era'],
  [30e6, 'primates', 'dinosaurs ruled', '30 Mly: dinosaurs were EXTINCT 30 Mya — early primates instead'],
  [100e6, 'dinosaurs ruled', null, '100 Mly: dinosaurs actually ruled 100 Mya'],
  [400e6, 'ancient seas', null, '400 Mly: early complex sea life'],
  [1e9, 'single-celled', null, '1 Gly: only microbial life'],
  [3e9, 'Earth was young', 'before the Earth', '3 Gly: Earth existed (formed 4.54 Gya)'],
  [5e9, 'older than the Earth', null, '5 Gly: light older than the planet']
];

var failures = 0;
CASES.forEach(function (c) {
  var out = getHistoricalEvent(c[0]) || '';
  var okReq = out.toLowerCase().indexOf(c[1].toLowerCase()) !== -1;
  var okForb = !c[2] || out.toLowerCase().indexOf(c[2].toLowerCase()) === -1;
  if (okReq && okForb) {
    console.log('  PASS  ' + c[0] + ' ly — "' + out + '"');
  } else {
    failures++;
    console.log('  FAIL  ' + c[0] + ' ly (' + c[3] + ')');
    console.log('        got:      "' + out + '"');
    if (!okReq) console.log('        expected substring: "' + c[1] + '"');
    if (!okForb) console.log('        forbidden substring present: "' + c[2] + '"');
  }
});

console.log('\n' + (CASES.length - failures) + '/' + CASES.length + ' era-label cases passed' + (failures ? ' — ' + failures + ' FAILED' : ''));
process.exit(failures ? 1 : 0);
