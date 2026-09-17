import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, normalizeParams, ruleGuideMax, rateFor } from '../../server/services/rental-margin-engine.js';

const ds = { rows: [
  { rebate: 1100000, supplier_id: 'a', category: 'water-purifier', guide_payout: 670000, max_payout: 900000, sales: 0 },
  { rebate: 550000, supplier_id: 'b', category: 'bidet', guide_payout: 330000, max_payout: 450000, sales: 0 },
], benchmarks: [] };

test('가이드·MAX 규칙 = DB 함수와 같은 반올림', () => {
  const r = ruleGuideMax({ rebate: 668331 }, { basis: 'supply', max_margin: 0.10, guide_margin: 0.33 });
  assert.equal(r.max, 546000); assert.equal(r.guide, 400000);
});

test('건당: 공급가 − 고객지급 − 인센티브 = 회사', () => {
  const o = simulate(ds, { max_margin: 0.1, guide_margin: 0.33, discretion: 0, rate_tiers: [{ min: 0, rate: 0.2 }], productivity: 50, base_salary: 2300000 });
  assert.ok(o.ok);
  const s = o.proposed.per_sale;
  // 행1: 공급가 1,000,000 가이드 670,000 MAX 900,000 → 인센 46,000 회사 284,000 / 행2: 500,000 330,000 450,000 → 24,000 146,000
  assert.equal(Math.round(s.company), (284000 + 146000) / 2);
  assert.equal(Math.round(s.counselor_incentive), (46000 + 24000) / 2);
});

test('MAX 까지 쓰면 인센티브 0, 회사는 MAX 마진만', () => {
  const o = simulate(ds, { max_margin: 0.1, guide_margin: 0.33, discretion: 1, rate_tiers: [{ min: 0, rate: 0.3 }] });
  assert.equal(Math.round(o.proposed.per_sale.counselor_incentive), 0);
  assert.equal(Math.round(o.proposed.per_sale.company), (100000 + 50000) / 2);
});

test('판매량: 인원 = ceil(판매/생산성), 회사 = 건당×판매 − 기본급×인원', () => {
  const o = simulate(ds, { max_margin: 0.1, guide_margin: 0.33, discretion: 0, rate_tiers: [{ min: 0, rate: 0.2 }], productivity: 50, base_salary: 2300000, volumes: [120] });
  const v = o.proposed.volumes[0];
  assert.equal(v.heads, 3);
  assert.equal(Math.round(v.company), Math.round(o.proposed.per_sale.company * 120 - 2300000 * 3));
});

test('누진 배분율 구간', () => {
  const tiers = [{ min: 0, rate: 0.2 }, { min: 40, rate: 0.3 }, { min: 80, rate: 0.4 }];
  assert.equal(rateFor(tiers, 10), 0.2); assert.equal(rateFor(tiers, 40), 0.3); assert.equal(rateFor(tiers, 99), 0.4);
});

test('손익분기: 회사 몫 × 건수 ≥ 기본급 되는 최소 건수', () => {
  const o = simulate(ds, { max_margin: 0.1, guide_margin: 0.33, discretion: 1, rate_tiers: [{ min: 0, rate: 0.2 }], base_salary: 750000 });
  assert.equal(o.proposed.break_even.at_max, 10);   // 건당 75,000
});

test('잘못된 입력은 에러로 돌려준다', () => {
  assert.ok(normalizeParams({ max_margin: 0.4, guide_margin: 0.3 }).errors.length);
  assert.ok(normalizeParams({ discretion: 2 }).errors.length);
  assert.equal(simulate(ds, { productivity: 0 }).ok, false);
});

test('live 시나리오는 DB 가이드·MAX 그대로', () => {
  const o = simulate(ds, { discretion: 0, rate_tiers: [{ min: 0, rate: 0 }] });
  assert.equal(Math.round(o.live.per_sale.guide), (670000 + 330000) / 2);
});

test('금액 하한: 리베이트가 작으면 하한만큼 남긴다 (DB 함수 드라이런과 같은 값)', () => {
  const p = { basis: 'supply', max_margin: 0.14, guide_margin: 0.31, max_floor: 66000, guide_floor: 0 };
  assert.deepEqual([ruleGuideMax({ rebate: 217776 }, p).guide, ruleGuideMax({ rebate: 217776 }, p).max], [130000, 131000]);
  assert.deepEqual([ruleGuideMax({ rebate: 96960 }, p).guide, ruleGuideMax({ rebate: 96960 }, p).max], [20000, 22000]);
  assert.deepEqual([ruleGuideMax({ rebate: 1092672 }, p).guide, ruleGuideMax({ rebate: 1092672 }, p).max], [680000, 854000]);
});

test('지금 시나리오는 current_rate 로 인센티브 계산', () => {
  const o = simulate(ds, { discretion: 0, rate_tiers: [{ min: 0, rate: 0.4 }], current_rate: 0.2 });
  assert.equal(Math.round(o.live.per_sale.counselor_incentive), Math.round(((900000 - 670000) * 0.2 + (450000 - 330000) * 0.2) / 2));
});

test('최적화: 제약을 지키는 규칙 중 1인당 회사 이익 최대', async () => {
  const { optimize } = await import('../../server/services/rental-margin-engine.js');
  const rows = [];
  for (let i = 0; i < 40; i++) rows.push({ rebate: 150000 + i * 20000, supplier_id: 'a', category: 'x', guide_payout: null, max_payout: null });
  const o = optimize({ rows, benchmarks: [] }, { productivity: 50, discretion: 0.3, rate_tiers: [{ min: 0, rate: 0.3 }], salary_min: 2500000, guide_avg_min: 300000 });
  assert.ok(o.ok, JSON.stringify(o.errors));
  assert.ok(o.best.salary >= 2500000 && o.best.guide_avg >= 300000);
  assert.ok(o.best.max_floor >= 46000);          // 인건비 ÷ 건수
  for (const a of o.alternatives) assert.ok(a.company_per_head <= o.best.company_per_head);
});
