// node --test tests/unit/rental-import-diff.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDiff, displayFee, summarize } from '../../server/services/rental-import/commit.js';

const base = { supplier: '코웨이', condition_key: 'k1', monthly_fee: 31900, price_phases: [{ from: 1, to: 18, fee: 15950 }], rebate: 579150, status: 'active', source_status: 'active', source: { sheet: '코웨이(9월)', row: 639, file_kind: 'water' } };

test('display_fee 는 1개월차 할인요금, 할인 없으면 기준요금', () => {
  assert.equal(displayFee(base), 15950);
  assert.equal(displayFee({ monthly_fee: 22900, price_phases: [] }), 22900);
});

test('신규·변경·유지·단종 분류, 리베이트 변동 집계', () => {
  const existing = new Map([
    ['k1', { ...base, display_fee: 15950, id: 'a', guide_payout: 300000 }],
    ['k2', { ...base, condition_key: 'k2', display_fee: 15950, id: 'b' }],
    ['k3', { ...base, condition_key: 'k3', display_fee: 15950, id: 'c', source: { sheet: '쿠쿠(8월)', row: 3, file_kind: 'water' } }],
  ]);
  const offers = [
    { ...base, rebate: 600000 },                 // 변경(리베이트)
    { ...base, condition_key: 'k4' },            // 신규
  ];
  const d = computeDiff(existing, offers, new Set(['water|코웨이']));
  const s = summarize(d);
  assert.equal(s.new, 1);
  assert.equal(s.changed, 1);
  assert.deepEqual(d.changed[0].fields, ['rebate']);
  assert.equal(s.rebate_changed, 1);
  assert.equal(s.removed, 1, '코웨이 시트의 k2 만 단종 — 이번에 안 올린 쿠쿠(k3)는 건드리지 않는다');
  assert.equal(d.removed[0].id, 'b');
});

test('다른 파일의 같은 시트명(유버스)은 단종하지 않는다', () => {
  const existing = new Map([['u1', { ...base, condition_key: 'u1', id: 'w', source: { sheet: '유버스(9월)', row: 10, file_kind: 'water' } }]]);
  const d = computeDiff(existing, [], new Set(['appliance|유버스']));
  assert.equal(d.removed.length, 0);
});

test('단종됐던 조건이 다시 나오면 reappeared', () => {
  const existing = new Map([['k1', { ...base, display_fee: 15950, id: 'a', status: 'discontinued' }]]);
  const d = computeDiff(existing, [base], new Set(['water|코웨이']));
  assert.equal(d.reappeared.length, 1);
});

test('jsonb 키 순서가 달라도 변경 아님', () => {
  const existing = new Map([['k1', { ...base, id: 'a', display_fee: 15950, price_phases: [{ to: 18, fee: 15950, from: 1 }], rebate_detail: { b: 1, a: 2 } }]]);
  const d = computeDiff(existing, [{ ...base, rebate_detail: { a: 2, b: 1 } }], new Set());
  assert.equal(d.changed.length, 0);
});

test('관리자가 고정한 판매종료(status_locked)는 엑셀에 다시 나와도 재판매로 되살리지 않는다', () => {
  const existing = new Map([['k1', { ...base, id: 'a', display_fee: 15950, status: 'discontinued', status_locked: true }]]);
  const d = computeDiff(existing, [base], new Set(['water|코웨이']));
  assert.equal(d.reappeared.length, 0);
});

test('엑셀 원본 상태가 바뀌면 source_status 변경으로 잡힌다', () => {
  const existing = new Map([['k1', { ...base, id: 'a', display_fee: 15950 }]]);
  const d = computeDiff(existing, [{ ...base, status: 'paused' }], new Set());
  assert.deepEqual(d.changed[0].fields, ['source_status']);
});

test('상품명 칸이 없는 시트는 브랜드+품목으로 이름을 만든다', async () => {
  const { isCodeName, composeProductName } = await import('../../server/services/rental-import/core.js');
  assert.equal(isCodeName('W2420WHNR.AKOR', 'W2420WHNR.AKOR'), true);
  assert.equal(isCodeName('WHP-3020', 'WHP-3020'), true);
  assert.equal(isCodeName('아이콘3.0', 'CHP-7220N'), false);
  assert.equal(isCodeName('eversys legacy L2c', 'X1'), false);
  assert.equal(composeProductName({ product_name: 'W2420WHNR.AKOR', model_code: 'W2420WHNR.AKOR', brand: 'LG전자', category_raw: '워시타워' }), 'LG전자 워시타워');
  assert.equal(composeProductName({ product_name: 'WHP-3020', model_code: 'WHP-3020', brand: '루헨스', category_raw: '정수기', spec_name: '직수형 냉온정수기' }), '루헨스 직수형 냉온정수기');
  assert.equal(composeProductName({ product_name: 'CP-QN3002S', model_code: 'CP-QN3002S', brand: '쿠쿠', category_raw: '쿠쿠 스탠드형  정수기' }), '쿠쿠 스탠드형 정수기');
  assert.equal(composeProductName({ product_name: '아이콘3.0', model_code: 'CHP-7220N', brand: '코웨이' }), '아이콘3.0');
  assert.equal(composeProductName({ product_name: '● 미니100', model_code: 'CP-AMS100EWH', brand: '쿠쿠' }), '미니100');
});

test('LG구독 이름 = 제품군 + 인치/평형 + 구분', async () => {
  const { lgSubscribeName } = await import('../../server/services/rental-import/adapters/appliance-lg.js');
  assert.equal(lgSubscribeName({ category: 'OLED', div1: 'OLED97G6KNA.AKR', div2: '벽걸이', model: 'OLED97G6KW.AKR' }), 'LG OLED 97형 벽걸이');
  assert.equal(lgSubscribeName({ category: 'TV+스바미2', div2: '벽걸이', model: '100MRGB96WP.AKRG' }), 'LG TV+스바미2 100형 벽걸이');
  assert.equal(lgSubscribeName({ category: '에어컨', div1: '쿨 1시리즈', model: 'FQ18GC1EA2M.AKOR' }), 'LG 에어컨 18평 쿨 1시리즈');
  assert.equal(lgSubscribeName({ category: '식기세척기', div1: 'DUE5BGE.AKOR', div2: '빌트인', model: 'DUE5BGE.AKOR' }), 'LG 식기세척기 빌트인');
  assert.equal(lgSubscribeName({ category: '스타일러', div1: '5벌', div2: '26년', model: 'SC5GMR81H.AKOR' }), 'LG 스타일러 5벌');
});

test('LG 하이드로타워·하이드로에센셜은 렌탈사 표기와 무관하게 가습기', async () => {
  const { categorize } = await import('../../server/services/rental-import/core.js');
  assert.equal(categorize('하이드로타워', 'LG 하이드로타워 25년형 하이드로타워'), 'humidifier');
  assert.equal(categorize('하이드로에센셜', 'LG 하이드로에센셜 25년형 하이드로타워 에센셜'), 'humidifier');
  assert.equal(categorize('공기청정기', 'LG 에어케어 하이드로타워 HY705RSUAB (36개월)'), 'humidifier');
  assert.equal(categorize('선풍기', '[특가]샤크_무선 미스트 플렉스브리즈 하이드로고_FA050KR'), 'facility');
});
