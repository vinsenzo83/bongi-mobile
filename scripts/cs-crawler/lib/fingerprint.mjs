// cs-crawler 변경 감지(fingerprint) 유틸
// 목록(items) → 안정 해시. 이전 상태와 비교해 outcome/delta 산출.
// MVP 원칙: 이름·요금·개수만으로 "달라졌는가"를 저비용 판정. 상세수집은 이후 단계.
import { createHash } from 'crypto';

// item: { name, fee, code? }  (fee/code 는 null 가능)
const norm = s => (s || '').replace(/\s+/g, ' ').trim();

// 안정 식별자: code 우선(상품코드 = 표시명이 "상세보기" 같은 generic 라도 불변),
// 없으면 이름. fingerprint 는 이 식별자 기준으로 계산해야 정확.
const idOf = x => norm(x.code ? String(x.code) : x.name);
// 사람이 읽는 라벨(로그/staging 표시용) — 이름+코드
const labelOf = x => {
  const n = norm(x.name), c = x.code ? String(x.code) : '';
  if (c && (!n || n === c)) return `#${c}`;
  return c ? `${n} [${c}]` : n;
};

// 목록 → 정렬된 canonical 라인 배열 (id|fee)
export function canonical(items) {
  return (items || [])
    .map(x => `${idOf(x)}|${x.fee == null || x.fee === '' ? '' : x.fee}`)
    .filter(l => l !== '|')
    .sort();
}

export function fingerprint(items) {
  const lines = canonical(items);
  const hash = createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16);
  return { hash, count: lines.length, names: (items || []).map(labelOf).filter(Boolean) };
}

// 이전(prev: crawl_meta row 또는 null)과 현재(items) 비교 → 판정
// opts.dropRatio: 개수 급감 경보 임계(기본 0.5 = 50% 이상 감소 시 의심)
export function detect(items, prev, { dropRatio = 0.5, ok = true, note = '' } = {}) {
  const fp = fingerprint(items);
  const prevNames = prev?.sample_names || [];
  const prevCount = prev?.item_count ?? null;
  const base = {
    fingerprint: fp.hash, item_count: fp.count, prev_fingerprint: prev?.fingerprint || null,
    prev_count: prevCount, added: [], removed: [], names_full: fp.names, note,
  };

  // 1) 크롤 자체 실패 → 경보
  if (!ok) return { ...base, outcome: 'error', ok: false, alert: true,
    summary: `크롤 실패: ${note || 'BFF 응답 없음/오류'}` };

  // 2) 0건 → 구조 변화/차단 경보 (크롤 성공 ≠ 데이터 정상)
  if (fp.count === 0) return { ...base, outcome: 'empty', ok: true, alert: true,
    summary: `0건 반환 — 셀렉터/BFF 구조 변화 또는 차단 의심${prevCount ? ` (이전 ${prevCount}건)` : ''}` };

  // 3) 첫 실행(비교 기준 없음)
  if (!prev || prev.fingerprint == null) return { ...base, outcome: 'new', ok: true, alert: false,
    added: fp.names, summary: `첫 수집 ${fp.count}건 (비교 기준 생성)` };

  // 4) 무변경
  if (fp.hash === prev.fingerprint) return { ...base, outcome: 'unchanged', ok: true, alert: false,
    summary: `무변경 (${fp.count}건)` };

  // 5) 변경 — delta 계산
  const cur = new Set(fp.names);
  const old = new Set(prevNames);
  const added = fp.names.filter(n => !old.has(n));
  const removed = prevNames.filter(n => !cur.has(n));
  // 이름은 같은데 해시가 달라짐 = 요금 등 값 변경
  const valueChanged = added.length === 0 && removed.length === 0;
  // 개수 급감 = 개편/부분로드 실패 의심 → 경보 (자동반영 절대 금지 근거)
  const suspicious = prevCount && fp.count < prevCount * (1 - dropRatio);

  return {
    ...base,
    outcome: suspicious ? 'suspicious' : 'changed',
    ok: true,
    alert: suspicious,
    added, removed,
    summary: suspicious
      ? `개수 급감 경보: ${prevCount}→${fp.count}건 (개편/로드실패 의심, 사람 확인 필요)`
      : valueChanged
        ? `값 변경 (요금/내용) — 이름 목록 동일 ${fp.count}건, 해시 상이`
        : `변경 +${added.length}/-${removed.length} (총 ${fp.count}건)`,
  };
}
