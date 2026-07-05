# cs-crawler — 통신3사 고객센터 데이터 크롤 파이프라인

봉이 무인 AI 고객센터(`cs` 스키마)용 통신3사(KT·SKT·LG U+) 요금제·결합·FAQ 크롤러.
일회성 스크립트를 모듈화·견고화한 production 파이프라인. 이번 검증 라운드에서 거미(QC)가 학습한 함정을 라이브러리에 집약.

## 구조
```
scripts/cs-crawler/
  lib/
    browser.mjs   — Playwright 런처 + 함정 대응 유틸(gotoRetry·removePopups·mainText)
    util.mjs      — 파싱 유틸(won·ott·ageTarget·detectSalesStatus·stripCarrierPrefix·5년 isStale)
  sites/
    kt.mjs        — KT  (요금제 table.pduct-tbl-plan + 더보기, 결합 6027, FAQ ServiceTipInfo idx)
    skt.mjs       — SKT (요금제 callplan, 결합 prod_id, FAQ faq_Id) · throttle 재시도 내장
    lgu.mjs       — LGU (요금제 SPA 가격추출, 결합 팝업제거, FAQ 아코디언 클릭)
  crawl.mjs       — CLI 오케스트레이터
```

## 사용
```bash
cd /Users/vinsenzo/bongi-mobile
node scripts/cs-crawler/crawl.mjs --carrier LGU --type plans --out /tmp/lgu-plans.json
node scripts/cs-crawler/crawl.mjs --carrier KT  --type bundles
node scripts/cs-crawler/crawl.mjs --carrier KT  --type faqs --idxFrom 980 --idxTo 1045
```
- `--carrier` KT|SKT|LGU · `--type` plans|bundles|faqs · `--out` 파일(없으면 stdout)
- 출력: `{carrier, plan_name/bundle_name/question, monthly_fee, ...}` 배열. `_note`/`_empty`는 크롤 실패 표식.

## 학습된 함정 (라이브러리에 내장)
| 함정 | 증상 | 대응 (lib) |
|---|---|---|
| SKT 봇 throttle | callplan bodyLen 0 간헐 | `gotoRetry` minLen 검사 + 재시도(대기 증가) |
| LGU SPA 팝업 | 본문이 "오늘하루그만보기"만 | `removePopups` ([class*=popup/layer/dim] 제거) |
| 메뉴/푸터 노이즈 | "전체메뉴…ZEM" prefix, 약관 푸터 | `mainText({after,before})` 마커 컷 |
| LGU 이름 prefix | "유플러스 데이터플랜MAX" (공식명 무) | `stripCarrierPrefix` |
| KT 숨은 요금제 | 5G 초이스 군 더보기 뒤 숨음 | `collectItemCodes` 더보기 반복 클릭 |
| 결합 종료일 | "온가족" 계열 신규중단 | `detectSalesStatus` + 5년 `isStale` |

## 적재 (DB)
크롤 결과 JSON → 검수 후 `cs.*_staging` 적재 → diff 검수 → `cs.*` publish.
⚠️ `.env`는 라이브를 가리키므로 dev(`sesgdqbmophgmombelmn`)는 Supabase MCP `execute_sql`로만 적재.

## 확장
- 새 통신사/카테고리: `sites/`에 모듈 추가, `crawl.mjs` SITES에 등록.
- 정기 크롤: cron + `--out` → staging 적재 → diff 알림.

---

# 자동 감지 크론 (MVP) — 감지 + 알림 + 승인게이트

수동 `crawl.mjs`(전량 크롤·적재)와 별개로, **매일 저비용으로 "달라졌는가"만 판정**하는 파이프라인.
화려한 완전자율이 아니라 견고·단순: **변경 감지 → staging 적재 → 로그/알림**까지. **published(cs.plans/bundles/faqs) 자동 반영은 절대 없음(사람 승인).**

## 구조 (신규 파일)
```
scripts/cs-crawler/
  cron.mjs            — 오케스트레이터 (probe 순회 → 감지 → sink 기록 → 요약/알림)
  lib/
    fingerprint.mjs   — 목록 fingerprint(해시=상품코드 우선) + 변경 판정(detect)
    probes.mjs        — 6영역×3사 probe 정의 (BFF/DOM 목록 수집기)
    notify.mjs        — 콘솔 알림 + 일일 요약 + 외부채널 후크(Slack/email TODO)
    sink.mjs          — 기록 대상 추상화 (pg 직결 / SQL emit / dry)
.github/workflows/cs-cron.yml  — 매일 KST 03:00 스케줄
```
DB(신설, `cs` 스키마):
- `cs.crawl_meta` — probe별 마지막 fingerprint(변경 비교 기준). PK (carrier, area).
- `cs.crawl_log`  — 매 실행 감지 결과(승인 근거·알림 원장). outcome/added/removed/staged.

## 감지 로직 (하이브리드)
1. 각 probe 가 **목록**(이름·요금·상품코드)을 BFF(JSON)/DOM 으로 수집. HTML 셀렉터 의존 최소화.
2. `fingerprint` = 상품코드(없으면 이름)+요금 정렬 해시. `crawl_meta` 이전 해시와 비교.
3. 판정(`outcome`): `new`(첫 기준선) · `unchanged`(무변경) · `changed`(delta) · `empty`(0건=구조변화/차단 **경보**) · `suspicious`(개수 급감 **경보**) · `error`(크롤실패 **경보**).
   - **크롤 성공 ≠ 데이터 정상**: 0건·급감(기본 50%↓)은 성공 응답이어도 경보.
4. `changed` 시 → **상세수집 재크롤**(`lib/detail.mjs`) → `cs.*_staging` **전량**(요금·조건·혜택·`detail` jsonb) 적재. `[auto-detect]` 마커 유지, `ON CONFLICT` UPSERT. `new`/무변경/경보는 적재 안 함(첫 실행 폭주 방지, `--detail-on-new` 로 new 도 상세수집).
5. 알림: 콘솔 + `crawl_log`. 일일 요약("N 무변경 · M 변경 · K 경보"). Slack/email 은 `notify.mjs` 후크만(TODO).

### 상세수집 연결 (`lib/detail.mjs`) — 신규
`changed` 감지 시 probe 가 준 목록 항목(이름·요금·**상품코드/href**)으로 상세 페이지를 재크롤해 staging 전량 컬럼을 채운다.
- **KT**(plans/bundles): ItemCode 상세페이지 navigate → 요금표(plans, 다중행) / 본문(bundles) 파싱. `detail` jsonb 에 원자료(group·cells·item_code).
- **LGU**(plans/bundles): 상세 URL navigate → 본문 파싱(요금·약정할인·OTT·연령·data). `detail` jsonb(body_excerpt·code).
- **SKT**(plans/bundles): 목록 카드에 href/prod_id 없어 **목록레벨로 우아하게 강등**(name·fee + `detail._note`). ledger BFF prod_id 매핑은 TODO.
- sink `replaceStaging`: 이전 `[auto-detect]` 스냅샷 delete → 상세 rows UPSERT(`carrier,plan_name`/`carrier,bundle_name`; faqs 는 unique 없어 delete+insert). **published 는 절대 미접촉.**
- 마커: 감지 텍스트 앞 `[auto-detect] ` prefix(실제 상세 보존 + 식별). `plans_staging.detail` jsonb 컬럼 신설(migration).

## probe 매트릭스 (6영역 × 3사)
| 영역 | KT | SKT | LG U+ |
|---|---|---|---|
| plans(요금제) | ✅ 6002 ItemCode | ✅ 5탭 카드 | ✅ plan-all 앵커 |
| bundles(결합) | ✅ 6027 | ✅ combinedList | ✅ combined-discount |
| vas(부가) | ✅ 6003 (주1) | ✅ mobileplan-add BFF (주1) | ✅ spps-exhi BFF 직결 (주1) |
| wired(인터넷/TV) | ⬜ 스텁 | ⬜ 스텁 | ⬜ 스텁 |
| faqs(FAQ) | ⬜ 스텁 | ⬜ 스텁 | ⬜ 스텁 |
- ✅ = 구현·기본 활성 / ⬜ = `enabled:false` 스텁(상세수집 연결 TODO). `freq:weekly`(부가/FAQ)는 `--weekly` 또는 월요일 자동.

## 사용
```bash
# 프로덕션(서버/CI): pg 직결 — cs 스키마는 anon API 미노출이라 직접 Postgres 필요
CS_DATABASE_URL='postgresql://…' node scripts/cs-crawler/cron.mjs           # daily 전체
CS_DATABASE_URL='postgresql://…' node scripts/cs-crawler/cron.mjs --weekly  # 부가/FAQ 포함

# 옵션
node scripts/cs-crawler/cron.mjs --only skt:plans,lgu:vas   # 일부 probe
node scripts/cs-crawler/cron.mjs --all                       # 스텁 포함(경보 확인)
node scripts/cs-crawler/cron.mjs --dry                       # 기록 없이 콘솔만

# dev 검증(MCP): pg 자격 없이 SQL 파일 생성 → Supabase MCP execute_sql 로 적용
#   1) 현재 meta export → meta.json  (select … from cs.crawl_meta)
#   2) cron 실행
node scripts/cs-crawler/cron.mjs --only lgu:vas --emit-sql out.sql --meta-in meta.json
#   3) out.sql 을 MCP execute_sql 로 dev(sesgd…)에 적용
```

## cron 스케줄 설정법 (GitHub Actions)
`.github/workflows/cs-cron.yml` — 매일 UTC 18:00(=KST 03:00) + `workflow_dispatch`. 월요일엔 `--weekly` 자동.
필요 secret (repo Settings → Secrets):
- `CS_SUPABASE_DB_URL` (필수) — 직접 Postgres URL. **롤아웃 초기엔 dev(sesgdqbmophgmombelmn), 검증 후 live**. Supabase → Project Settings → Database → Connection string(session/pooler).
- `CS_SLACK_WEBHOOK` / `CS_ALERT_EMAIL` (선택) — 설정 시 외부 알림 후크 활성(발송 로직은 TODO).
> Railway cron 을 쓸 경우: `node scripts/cs-crawler/cron.mjs` 를 cron 서비스로 등록하고 위 env 주입. 봉이 기존 백업/모니터가 GitHub Actions 크론이라 여기에 맞춤.

## 승인 게이트 (자동 반영 안 함 — 확인됨)
- 코드에 `cs.plans/bundles/faqs`(published) **INSERT/UPDATE 경로 없음**. 오직 `*_staging` + `crawl_log` + `crawl_meta` 만 기록.
- 운영자는 `crawl_log`(outcome=changed/경보)를 확인 → `*_staging` 검수 → 수동 publish.

## dev 실행 검증 결과 (sesgd…)
- `lgu:vas` 1회차 → `new` 198건, 기준선 생성 · 2회차(실데이터 재수집) → **`unchanged`(hash 동일)**.
- `kt:bundles` 기준선 강제 불일치 → **`changed` +9 → 상세수집 재크롤 → `bundles_staging` 9행 전량 적재**: 실제 상품명(따로 살아도 가족결합·프리미엄 가족결합…)·`discount_rule` 상세(>60자)·`conditions`·source_url(실 ItemCode) 채움. **published `cs.bundles` 자동행 0(승인게이트 유지, 28행 무변경)**. (검증 후 아티팩트 정리)
- plans 상세경로 `detail` jsonb 컬럼 적재 확인(단위검증: ott_benefits/detail jsonb·monthly_fee int·UPSERT).
- 경보 경로: `empty`(0건)·`suspicious`(260→2 급감)·`error`(크롤실패/스텁) 모두 `alert=true` + exit 2.

## 미구현 (TODO)
- **SKT 상세**: 목록 카드에 prod_id 없어 목록레벨 강등. ledger BFF(`ledger/{prodid}/summaries`) prod_id 매핑 필요(skt-detail-crawl 파서 재사용 가능).
- **wired/faqs probe**: `enabled:false` 스텁(list collector 미구현). sites/*.faqs·skb 크롤러 연결 시 활성화.
- **실제 알림 채널**: `notify.mjs` 의 Slack/email 은 후크만. 발송 로직 미구현.
- **collector 이름 품질(목록레벨)**: KT 목록 앵커 표시명이 "상세보기"라 fingerprint 는 상품코드 식별(로그 `상세보기 [ItemCode]`). 단, **상세수집 rows 는 실제 상품명** 사용(해소).
- **RLS**: `cs.*` 테이블 RLS 비활성(anon 노출). 정책 설계 필요(별도 라운드). 그래서 cron 은 API 대신 pg 직결.
- **부가 전량**: SKT vas 는 대표 카테고리(F01231)만. 전체 필터 순회는 추후.
