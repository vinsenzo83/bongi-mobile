# P1 — 데이터 leak·권한 우회 runbook

> **목표 회복 시간: 30분**
> 사용 시점: PII 노출 의심, 권한 외 데이터 접근, RLS bypass 발견

## 1. 인지 (~5분)

다음 패턴 발견 시 P1:
- agent가 본인 분배 외 콜DB 조회 가능
- contract가 콜DB 보임 (5/30 차단된 상태인데 우회)
- 인증 없이 (anon) PII 데이터 노출
- Sentry log에 의심 패턴 (`SELECT * FROM ... WHERE 1=1` 같은 SQL injection 흔적)

```bash
# 즉시 확인 — anon으로 핵심 테이블 read 가능한지
ANON="<라이브 anon JWT>"  # MCP get_publishable_keys에서
curl -s "https://dugaqvvnhsgenhmhuyju.supabase.co/rest/v1/incentive_customer_db?select=phone&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# expect: [] (빈 배열) 또는 401
# 실제 row 보이면 → P1 확정
```

## 2. 격리 (~5분)

피해 즉시 차단 — 진단보다 우선:

### A. RLS 임시 강화
```sql
-- 라이브 + 데브 양쪽
ALTER TABLE <노출_테이블> ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "<기존_읽기_정책>" ON <노출_테이블>;
-- 가장 보수적: service_role만 허용
CREATE POLICY "emergency_lockdown" ON <노출_테이블> FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
NOTIFY pgrst, 'reload schema';
```

### B. server endpoint 즉시 차단
```js
// 해당 endpoint 맨 위에 추가
router.get('/leaky-endpoint', authenticateJWT, async (req, res) => {
  return res.status(503).json({ error: '점검 중 — 잠시 후 다시 시도하세요' });
  // ... 기존 코드 ...
});
```
→ `git commit && git push origin master` → 1분 내 적용

## 3. 진단 (~10분)

### A. 노출 범위 식별
```sql
-- 어느 row가 노출 가능했는지 (RLS 우회 가정 시)
SELECT count(*) FROM <테이블>;        -- 전체
SELECT count(*) FROM <테이블> WHERE archived = false;  -- active만
-- PII가 포함된 컬럼 (phone·name·이메일·주소 등) 식별
```

### B. 노출 기간 산정
```bash
# 문제 정책·endpoint 도입 commit 시점
git log --all --oneline -- server/routes/<해당>.js | head -10
# 그 commit 부터 격리 시점까지가 노출 기간
```

### C. 실제 접근 로그 (가능 시)
```sql
-- incentive_customer_db_access_log 등 access log 활용
SELECT user_id, count(*), max(accessed_at) FROM incentive_customer_db_access_log
WHERE accessed_at > '<문제_commit_시점>'
GROUP BY user_id ORDER BY count(*) DESC;
```

## 4. 복구 (~10분)

### A. 정상 정책 적용 (R5 패턴 참고)
```sql
-- 임시 lockdown 해제 + 정상 정책
DROP POLICY IF EXISTS "emergency_lockdown" ON <테이블>;
CREATE POLICY "<정상_정책>" ON <테이블> FOR SELECT
  USING ((select auth.role()) IN ('authenticated','service_role'));
-- write는 더 엄격
CREATE POLICY "<write_정책>" ON <테이블> FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
NOTIFY pgrst, 'reload schema';
```

### B. server endpoint 권한 강화 (R5 `requireRole` 패턴)
```js
async function requireRole(req, res, allowed) {
  const { data: agent } = await supabase
    .from('incentive_agents').select('role,id,center')
    .eq('user_id', req.user.id).maybeSingle();
  if (!agent || !allowed.includes(agent.role)) {
    res.status(403).json({ error: allowed.join('/') + ' 권한 필요' });
    return null;
  }
  return agent;
}

router.get('/leaky-endpoint', authenticateJWT, async (req, res) => {
  if (!await requireRole(req, res, ['admin','manager'])) return;
  // ... 정상 처리 ...
});
```

### C. SW v 증가 (캐시 무효화)
`docs/sw.js` SW_VERSION bump → 모든 client 강제 갱신

## 5. 검증 (~5분)

```bash
# 1. anon 직접 호출 차단 확인
ANON="<anon>"
curl -s "https://dugaqvvnhsgenhmhuyju.supabase.co/rest/v1/<테이블>?select=id&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# expect: [] 또는 401

# 2. server endpoint 정상 (인증 후)
# (admin JWT 로그인 후) — 401·403만 차단되고 200 정상

# 3. 각 role 별 권한 매트릭스 재확인
# bongi-deploy-verifier agent (R5 패턴) 사용
```

## 6. PII 노출 시 추가 의무 (PIPA)

한국 개인정보보호법 (PIPA):
- 1,000건 이상 노출 시 **72시간 내 KISA·해당 사용자 통보**
- 노출 데이터 종류 (이름·주민번호·연락처·금융정보 등) 명시
- 재발 방지 조치 보고

```
관련 양식: KISA 개인정보침해 신고센터
https://privacy.kisa.or.kr/
```

## 7. Post-mortem (~24시간 안)

memory에 추가:
```markdown
---
name: feedback_<incident-slug>
description: <2026-MM-DD> P1 — <노출 영역>
metadata: { type: feedback }
---

<재발 방지 룰>

**Why:** <어떤 정책·endpoint 누락이 원인>
**How to apply:** <향후 점검 시 이 영역 우선 검증>
```

추가:
- bongi-deploy-verifier R5 시나리오에 해당 leak 추가 (자동 검증)
- 매뉴얼 권한 매트릭스 업데이트
- 사용자 통보 (PIPA 필수 시)

## 자주 발생하는 P1 원인

| 원인 | 격리 | 예방 |
|---|---|---|
| RLS 끄고 잊음 (정책 wrapping 사고) | emergency lockdown 정책 | `feedback_rls_enable_caution.md` 준수 |
| `optionalAuth` 남용 | endpoint에 `authenticateJWT` 적용 | R5 verifier 정기 실행 |
| role check 누락 (write endpoint) | `requireRole` 헬퍼 추가 | code review 시 role 매트릭스 확인 |
| RLS 정책 `auth.role()` 빈 결과 | wrapping `(select auth.role())` | R6 패턴 |
| PII 마스킹 누락 (CSV·logs) | export 함수에 마스킹 적용 | review에 PII 체크리스트 |
