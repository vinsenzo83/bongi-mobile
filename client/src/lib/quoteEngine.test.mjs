/**
 * quoteEngine.test.mjs — Sanity tests
 *
 * Run with: node client/src/lib/quoteEngine.test.mjs
 *
 * These tests check structural invariants and a handful of well-known
 * combinations. They mirror what the vanilla calc() produces so that the
 * Phase B React UI can trust the new engine.
 */

import { calc, D, generateTickets, findTicket, getGiftAmount } from './quoteEngine.js';

let pass = 0;
let fail = 0;
const failures = [];

function assertEq(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    failures.push({ label, actual, expected });
    console.log(`  ✗ ${label} — expected ${expected}, got ${actual}`);
  }
}

function assertTrue(label, actual) {
  if (actual) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; failures.push({ label, actual, expected: 'truthy' }); console.log(`  ✗ ${label} — expected truthy, got ${actual}`); }
}

console.log('\n── D object structure ──');
assertTrue('D.skt exists', !!D.skt);
assertTrue('D.kt exists', !!D.kt);
assertTrue('D.lgu exists', !!D.lgu);
assertEq('SKT internet 500M', D.skt.internet['500M'], 33000);
assertEq('KT internet 1G', D.kt.internet['1G'], 38500);
assertEq('LGU+ wifi cost (default)', D.lgu.wifiCost, 0);
assertEq('SKT setTop default fee', D.skt.setTop, 4400);
assertEq('SKT setTop name', D.skt.setTopName, 'Smart3');

console.log('\n── Tickets ──');
const tickets = generateTickets();
assertTrue('tickets generated', tickets.length > 0);
const sktSample = findTicket('skt', '500M', 1, true);
assertTrue('SKT 500M B tv 이코노미 wifi=true ticket exists', !!sktSample);

console.log('\n── SKT 500M + B tv 이코노미 + wifi (single, no bundle) ──');
{
  const r = calc({ carrier: 'skt', speed: '500M', tv: 1, wifi: true });
  assertTrue('isValid', r.isValid);
  assertEq('carrierKey', r.carrierKey, 'skt');
  assertEq('hasTv', r.hasTv, true);
  // Sector1 main bundle:
  // netCombo (tvInternetWithWifi 500M) = 28600
  // tvBase = 12100, tvDc = 2200 → tvFinal = 9900
  // setTop = 4400 (Smart3, no rules match Eco)
  // total = 28600 + 9900 + 4400 = 42900
  assertEq('sectorMain.netCombo', r.sectorMain.netCombo, 28600);
  assertEq('sectorMain.tvFinal', r.sectorMain.tvFinal, 9900);
  assertEq('sectorMain.setTopFee', r.sectorMain.setTopFee, 4400);
  assertEq('sectorMain.settopDiscount', r.sectorMain.settopDiscount, 0);
  assertEq('sectorMain.total', r.sectorMain.total, 42900);
  // Solo install for hasTv=true uses combo
  assertEq('install.weekday', r.install.weekday, 56100);
}

console.log('\n── SKT 500M solo internet (no TV) ──');
{
  const r = calc({ carrier: 'skt', speed: '500M', tv: 0, wifi: true });
  assertEq('netBase', r.sectorMain.netBase, 33000);
  // wifi cost on SKT 500M = 1100; subtotal = 33000 + 1100 = 34100
  assertEq('subTotal', r.sectorMain.subTotal, 34100);
  assertEq('total', r.sectorMain.total, 34100);
  assertEq('install (solo)', r.install.weekday, 36300);
}

console.log('\n── LGU+ 가족결합 (chweyswun) — 500M, 2회선, 69K↑ ──');
{
  const r = calc({
    carrier: 'lgu', speed: '500M', tv: 0, wifi: true,
    bundle: 'lgu-chweyswun', lines: 2, range: 1
  });
  assertTrue('sectorFamily exists', !!r.sectorFamily);
  // chweyswun.internet[500M] = 9900
  assertEq('lguInetDc', r.sectorFamily.lguInetDc, 9900);
  // mobile[planIdx=1][lines-2=0] = 3300
  assertEq('lguMobDc (mobile discount)', r.sectorFamily.lguMobDc, 3300);
  assertEq('mobileDiscount (top-level)', r.mobileDiscount, 3300);
  // LGU+ wifi is 0 → netSingleWithWifi = 33000
  assertEq('netSingleWithWifi', r.sectorFamily.netSingleWithWifi, 33000);
  assertEq('inetAfter (33000 - 9900)', r.sectorFamily.inetAfter, 23100);
}

console.log('\n── SKT 가족결합 (family) — 500M, 3 lines, B tv 이코노미 ──');
{
  const r = calc({
    carrier: 'skt', speed: '500M', tv: 1, wifi: true,
    bundle: 'family', lines: 3
  });
  assertTrue('sectorFamily exists', !!r.sectorFamily);
  // family.internet[500M] = 11000
  assertEq('famInetDc', r.sectorFamily.famInetDc, 11000);
  // perPerson 500M with 3 lines = 6000 → 6000 * 3 = 18000
  assertEq('mobile discount (3 lines)', r.mobileDiscount, 18000);
  assertEq('perPerson', r.sectorFamily.perPerson, 6000);
}

console.log('\n── KT 총액결합 — 500M, 64,900원↑ 구간, with TV ──');
{
  const r = calc({
    carrier: 'kt', speed: '500M', tv: 1, wifi: true,
    bundle: 'kt-total', range: 2
  });
  assertTrue('sectorFamily exists', !!r.sectorFamily);
  // kt total internet[500M][2] = 5500
  assertEq('inetDc', r.sectorFamily.inetDc, 5500);
  // kt total mobile[500M][2] = 5500
  assertEq('mobileDiscount', r.mobileDiscount, 5500);
}

console.log('\n── Gift amounts ──');
{
  // SKT 500M with TV → combo bucket
  assertEq('SKT 500M combo gift', getGiftAmount(D.skt, '500M', 1), 430000);
  // SKT 500M no TV → solo bucket
  assertEq('SKT 500M solo gift', getGiftAmount(D.skt, '500M', 0), 170000);
}

console.log('\n── Invalid input handling ──');
{
  const r1 = calc({ carrier: 'unknown', speed: '500M' });
  assertEq('unknown carrier → isValid=false', r1.isValid, false);
  const r2 = calc({ carrier: 'skt', speed: '999G' });
  assertEq('unknown speed → isValid=false', r2.isValid, false);
}

console.log(`\n──────────────────────────────────────`);
console.log(`  Pass: ${pass}    Fail: ${fail}`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log('  -', f.label, '| got', f.actual, '| expected', f.expected));
  process.exit(1);
}
console.log('  All sanity tests passed.\n');
