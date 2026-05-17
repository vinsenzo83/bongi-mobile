# 알려진 함정 · 사고 이력

> 봉이 운영 중 실제 발생한 사고 + 회피 패턴. **새 코드 작성 전 필독.**
> 출처: memory의 `feedback_*` 시리즈 (`~/.claude/projects/-Users-vinsenzo/memory/`)

## 1. listCols 누락 (2026-05-15 사고)

**증상**: 새 컬럼 추가했는데 UI에 안 보임.
**원인**: HTML·destructure·update까지는 했는데 SELECT의 `listCols`에 컬럼 누락.
**규칙**: 신규 컬럼 = 4곳 모두 동기화 (HTML/destructure/update/listCols).
**검증**: `curl /api/incentive/{table} | jq '.[] | keys' | head -1`로 응답 키 확인.
**메모리**: `feedback_listcols_pitfall.md`

## 2. 인라인 const SyntaxError (2026-05-15 사고)

**증상**: 페이지 빈 화면, 콘솔 SyntaxError.
**원인**: 외부 로드 + 동일 식별자 inline const 동시 선언 (`const TOKEN_KEY = ...` 중복).
**규칙**: incentive-auth.js를 외부 로드하면 페이지 inline의 `const TOKEN_KEY/API` 등 제거.
**검증**: `probe-syntax` skill로 5 admin 페이지 콘솔 에러 자동 체크.
**메모리**: `project_bongi_inline_const_collision.md`

## 3. RLS 일괄 활성화 금지 (2026-05-12 로그인 장애)

**증상**: 로그인 직후 incentive_agents 조회 실패 → 사용자 로그인 화면 무한 루프.
**원인**: 새 테이블에 RLS 일괄 활성화. 정책 expression 검증 누락.
**규칙**: RLS 활성화는 **1 테이블씩**. 각 정책 `auth.uid()` wrap 형태로 (initplan 최적화), env·client 흐름 사전 점검.
**메모리**: `feedback_rls_enable_caution.md`

## 4. Supabase 3대 함정 (2026-05-15 운영 점검)

### 4-1. RLS initplan 미적용
- 나쁜 예: `USING (user_id = auth.uid())` → 매 row마다 auth.uid() 재호출
- 좋은 예: `USING (user_id = (select auth.uid()))` → initplan으로 1회 평가

### 4-2. Cloudflare 24h 캐시
- 정적 + 일부 동적 응답까지 24h 캐시
- 변경 시 cache-buster (`?v=N`) 필수
- 또는 응답 헤더 `Cache-Control: no-cache` 명시

### 4-3. auth.getUser() rate-limit
- `/api/auth/me` 같은 endpoint를 SPA에서 매 fetch마다 호출 X
- localStorage에 user 저장하고 `/auth/me`는 초기 1회만

메모리: `feedback_supabase_perf_patterns.md`

## 5. 데브 캐시 우회 3중 (2026-05-08 사고)

**증상**: 데브 배포했는데 사용자 화면이 옛 코드.
**원인**: SW + 브라우저 + iframe pool 3중 캐시 미해결.
**규칙**:
1. **SW_VERSION 증가** (`docs/_shared/sw.js`)
2. **`?v=YYYYMMDD` cache-buster** (HTML link/script)
3. **iframe pool 재구성** (incentive-admin top-frame `Cmd+Shift+R`)
**메모리**: `feedback_dev_cache_busting.md`

## 6. 마감원장 import 5대 함정 (2026-05-12 검증 완료)

1. **UPSERT 충돌** — UNIQUE 키 중복 시 INSERT 실패 → UPSERT로 변경
2. **newRows=0 update 누락** — 새 row 0개여도 기존 row update는 진행
3. **file reset 누락** — input[type=file] 다시 선택 안 됨 → reset 필요
4. **cross-source dedup** — 같은 전화번호 다른 source에서 중복
5. **chunk RPC** — 1000건 이상은 분할 RPC

메모리: `feedback_import_robustness.md`

## 7. carrier 매핑 (필수)

| layer | 표기 |
|---|---|
| DB (`incentive_products.carrier`) | `SK` / `KT` / `LG` (대문자) |
| Client UI | `skt` / `kt` / `lgu` |

```js
const carrierMap = { skt: 'SK', kt: 'KT', lgu: 'LG' };
```

⚠️ 매핑 누락 시 DB 매칭 실패. 메모리: `project_bongi_carrier_mapping.md`

## 8. R 등급 분류 단순화 규칙

**R 등급은 `단말.인+TV` 또는 `단말.인터넷` 두 값만 봄.**
- 메모 자동 매칭 X
- prefix 매칭 X
- 유형 추정 X

사용자가 강력 거부 (false positive 위험). 메모리: `feedback_grade_classify_simple.md`

## 9. SK 인터넷 기변 불가 규칙

**기준은 "현재 인터넷 통신사"이지 휴대폰 carrier 아님.**
- SK 인터넷 사용자 → SK 인+TV 기변 X (3사 공통)
- 콜에서 "현재 인터넷 어디 쓰세요?" 청취 후 분기

메모리: `project_bongi_sk_internet_rule.md`

## 10. 매장 ≠ 콜센터 (조직 분리)

| 조직 | 인원 | 역할 |
|---|---|---|
| 8 매장 직영 | 매장 판매자 | 매장 방문 고객 응대 |
| 광주센터 | TM 상담사 | 콜DB 기반 전화 영업 |

매장 매칭 분배 **불가능**. 메모리: `project_bongi_org_separation.md`

## 11. CTI/녹음 미연동

봉이 TM은 CTI 연동 X, 녹음 X. 상담사 직접 발신/수신.
→ **통화 요약 텍스트가 유일 증거**. 영업/분쟁 시 텍스트 기반 판단.
메모리: `project_bongi_no_call_recording.md`

## 12. snapshot 박제 정책

**가격·정책 변경 시 기존 영업 row 보존**:
- `incentive_sales_history` / `incentive_product_history` / `rental_sales_history`
- 변경 시점에 snapshot 자동 저장
- 변경 전 영업 정산은 snapshot 기준

⚠️ 박제 누락 시 정산 분쟁 발생.

## 13. 빈 값 PATCH 함정

PATCH 요청 시 빈 문자열 `""`을 NULL로 잘못 저장 가능:
```js
// 나쁜 예
if (val) update.col = val;  // ""도 truthy 아님 (JS 빈 문자열은 falsy)

// 좋은 예
if (val !== undefined && val !== '') update.col = val;
```

## 14. 로그인 후 admin 화면 진입점

직접 URL **금지**. 항상 admin 메인:
- 로컬: `http://localhost:3001/` (= incentive-admin.html)
- 데브: `https://dev-admin.prexymarket.com/`
- 라이브: `https://admin.prexymarket.com/`

좌측 메뉴에서 iframe 임베드. 직접 `?docs/foo.html` URL은 메뉴/콜큐/토큰 헬스체크 누락.

메모리: `feedback_local_entry_point.md`

## 15. master push에 hook 확인

`.claude/settings.json`에 PreToolUse hook:
- `git push origin master` 발견 시 자동 차단 + 사용자 확인 요구.
- 라이브 배포는 의식적인 행동이어야 함.

## 16. 배포 7단계 (큰 릴리즈)

1. 로컬 배포 → 로컬 검증
2. 데브 배포 → 데브 검증
3. 라이브 배포 → 라이브 검증
4. 데브 ↔ 라이브 교차 검증

각 단계마다 `probe-syntax` + `check-live` + `bongi-deploy-verifier` skill 활용.

메모리: `feedback_local_dev_live.md`, `feedback_release_audit.md`
