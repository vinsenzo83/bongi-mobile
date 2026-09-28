// 렌탈 색상 선택지 — 출처 우선순위·오탐 차단·접수 폼 노출 규칙
// 실측 근거: 라이브 색상 그룹 409개 전수 검증에서 색상이 요금·리베이트를 가르는 건 0건 (2026-09-28)
import test from 'node:test';
import assert from 'node:assert/strict';
import { colorOptions, buildApplicationForm } from '../../server/services/rental-application.js';

const spec = (color) => ({ specs: { specifications: { color } } });

test('공식몰 스펙 색상: 쉼표로 나눠 선택지가 된다', () => {
  assert.deepEqual(colorOptions(spec('포슬린 화이트, 샌드 베이지, 임페리얼 브라운')),
    ['포슬린 화이트', '샌드 베이지', '임페리얼 브라운']);
});

test('색상 심도(10bit)는 색상이 아니다 — 걸러내고 모델 색상으로 내려간다', () => {
  assert.deepEqual(colorOptions(spec('10bit (8 bit + FRC)')), []);
  assert.deepEqual(colorOptions({ ...spec('10bit (8 bit + FRC)'), color_names: ['블랙'] }), ['블랙']);
});

test('부위별로 길게 적힌 값은 쓰지 않는다 (잘못 쪼개면 엉뚱한 색이 나온다)', () => {
  const m = spec('프레임 : 차콜그레이 헤드(모던라운드) : 차콜그레이하운드투스 헤드(볼륨) : 차콜그레이');
  assert.deepEqual(colorOptions(m), []);
});

test('스펙에 색상이 없으면 상품명에서 뽑아 둔 color_names 를 쓴다', () => {
  assert.deepEqual(colorOptions({ color_names: ['올스텐'], color_source: '상품명(빌리고 엑셀)' }), ['올스텐']);
  assert.deepEqual(colorOptions({}), []);
  assert.deepEqual(colorOptions(null), []);
});

test('스펙 색상이 있으면 그것이 먼저다 (공식몰 > 상품명 추출)', () => {
  assert.deepEqual(colorOptions({ ...spec('퓨어 화이트'), color_names: ['블랙'] }), ['퓨어 화이트']);
});

const supplier = { id: 'coway', name: '코웨이', file_kind: 'water', signup_policy: null };
const sections = (form) => form.sections.map((s) => s.id);
const colorField = (form) => form.sections.find((s) => s.id === 'product')?.fields[0];

test('색상이 둘 이상이면 접수 폼에 필수 선택 필드가 생긴다', () => {
  const form = buildApplicationForm({ supplier, offer: { offer_type: 'normal' }, model: spec('화이트, 블랙') });
  const f = colorField(form);
  assert.equal(f.key, 'product_color');
  assert.equal(f.required, true);
  assert.deepEqual(f.options, ['화이트', '블랙']);
});

test('색상이 하나면 고를 게 없으므로 폼에 넣지 않는다 (표기만)', () => {
  const form = buildApplicationForm({ supplier, offer: { offer_type: 'normal' }, model: spec('화이트') });
  assert.equal(sections(form).includes('product'), false);
});

test('티켓이 색상을 확정한 조건(청호)은 폼에서 다시 묻지 않는다', () => {
  const form = buildApplicationForm({ supplier, offer: { offer_type: 'normal', color_name: '블루블랙' }, model: spec('화이트, 블랙') });
  assert.equal(sections(form).includes('product'), false);
});

test('색상 섹션은 계약자 다음에 온다 (섹션 순서에 의존하는 화면·테스트 보호)', () => {
  const form = buildApplicationForm({ supplier, offer: { offer_type: 'normal' }, model: spec('화이트, 블랙') });
  const ids = sections(form);
  assert.equal(ids[0], 'customer');
  assert.ok(ids.indexOf('product') > ids.indexOf('customer'));
  assert.ok(ids.indexOf('product') < ids.indexOf('install'));
});
