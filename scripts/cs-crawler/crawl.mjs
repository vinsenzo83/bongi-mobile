#!/usr/bin/env node
// cs-crawler CLI 오케스트레이터
// 사용: node crawl.mjs --carrier KT|SKT|LGU --type plans|bundles|faqs [--out file.json]
// 예:  cd /Users/vinsenzo/bongi-mobile && node scripts/cs-crawler/crawl.mjs --carrier LGU --type plans --out /tmp/lgu.json
import { launch } from './lib/browser.mjs';
import { KT } from './sites/kt.mjs';
import { SKT } from './sites/skt.mjs';
import { LGU } from './sites/lgu.mjs';
import { writeFileSync } from 'fs';

const SITES = { KT, SKT, LGU };
const args = process.argv.slice(2);
const get = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };

const carrier = get('carrier');
const type = get('type', 'plans');     // plans | bundles | faqs
const out = get('out');
const opts = {};
if (get('idxFrom')) opts.idxFrom = +get('idxFrom');
if (get('idxTo')) opts.idxTo = +get('idxTo');

if (!carrier || !SITES[carrier]) { console.error('--carrier KT|SKT|LGU 필요'); process.exit(1); }
if (!SITES[carrier][type]) { console.error(`${carrier}에 ${type} 파서 없음`); process.exit(1); }

const t0 = Date.now();
const browser = await launch();
let data = [];
try {
  data = await SITES[carrier][type](browser, opts);
} catch (e) {
  console.error('크롤 오류:', e.message);
} finally {
  await browser.close();
}

const ok = data.filter(d => !d._note && !d._empty);
const failed = data.filter(d => d._note || d._empty);
console.error(`\n=== ${carrier} ${type}: 총 ${data.length}건 (정상 ${ok.length} / 실패·빈값 ${failed.length}) · ${((Date.now() - t0) / 1000).toFixed(0)}s ===`);
if (type === 'plans') {
  const fees = ok.map(d => d.monthly_fee).filter(Boolean);
  if (fees.length) console.error(`  요금 ${Math.min(...fees).toLocaleString()}~${Math.max(...fees).toLocaleString()}원`);
}
ok.slice(0, 8).forEach(d => console.error(`  · ${d.plan_name || d.bundle_name || d.question || ''} ${d.monthly_fee ? d.monthly_fee.toLocaleString() + '원' : ''}`));
if (failed.length) console.error(`  ⚠️ 실패: ${failed.map(f => f.plan_name || f.bundle_name || f.source_url).slice(0, 5).join(', ')}`);

if (out) { writeFileSync(out, JSON.stringify(data, null, 2)); console.error(`\n📄 ${out}`); }
else console.log(JSON.stringify(data, null, 2));
