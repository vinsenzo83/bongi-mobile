import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

// 청호 반값 규칙표 — 시트에 개월이 없을 때 쓰는 공식몰 규칙 (출처·수집일 포함)
const data = JSON.parse(fs.readFileSync(new URL('../../server/services/rental-import/data/chungho-half-rules.json', import.meta.url), 'utf8'));

test('규칙표 형식과 출처', () => {
  assert.match(data.source, /chungho\.com/);
  assert.match(data.collected_at, /^\d{4}-\d{2}-\d{2}$/);
  const keys = Object.keys(data.rules);
  assert.ok(keys.length >= 100, `규칙 ${keys.length}개`);
  for (const k of keys) {
    assert.match(k, /^Z\d+\|[A-Z]\d+$/, `키 형식 ${k}`);                 // zCode|RULE_CODE
    const r = data.rules[k];
    assert.ok(Number.isInteger(r.months) && r.months > 0 && r.months <= 24, `${k} 개월 ${r.months}`);
    if (r.fee != null) assert.ok(Number.isInteger(r.fee) && r.fee > 0);
    if (r.standard_fee != null) assert.ok(r.fee == null || r.fee <= r.standard_fee, `${k} 반값요금이 기준가보다 큼`);   // 기준가(STAN)는 정가라 반값×2 와 다를 수 있다
  }
});

test('알려진 규칙 값', () => {
  assert.equal(data.rules['Z24252|P0602'].months, 12);
  assert.equal(data.rules['Z24252|P0602'].fee, 12950);
});
