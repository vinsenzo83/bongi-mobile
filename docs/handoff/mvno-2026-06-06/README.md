# 봉이 알뜰폰 (MVNO 대리점) 개발 핸드오프 패키지

> 작성일: 2026-06-06
> 대상: 앞서 storefront 핸드오프(2026-06-05) 받은 개발자
> **사업 모델: MVNO 대리점 — 봉이가 KT엠모바일·미디어로그·SK텔링크 등 기존 MVNO 사업자와 제휴해 봉이 전용 요금제 출시·판매**
> 참고 사이트: https://www.mobing.co.kr/service-join/receipt?planID=LPZ0018905&promoSeq=8826

---

## 0. 한 줄 요약

> **봉이는 MVNO 대리점**으로 등록 → 기존 MVNO 사업자(KT엠모바일·미디어로그/LG·SK텔링크 등)와 제휴 → **봉이 전용 요금제(브랜드·혜택 패키지)** 출시 → 고객이 storefront에서 비교·가입 → 운영자가 신청서 처리 → MVNO 사업자에게 가입 신청 전달 → 가입 1건당 수수료 수익.

❌ 사업자 면허(별정통신사)는 가지지 않음. 통신망·요금 청구·고객 응대는 MVNO 본사가 담당.

---

## 1. 작업 범위 — 4 화면

| # | 화면 | 사용자 | 목적 |
|---|---|---|---|
| **1** | 봉이 알뜰폰 요금제 비교 (고객) | 고객 | 망/데이터/약정/가격 chip 필터 → 비교 → 가입 진입 |
| **2** | 가입 신청 form (고객) | 고객 | 4 step (요금제 확인 → 가입유형 → 가입자정보 → 약관) → 신청 박제 → MVNO 사업자에게 전달 |
| **3** | 어드민 요금제 등록 | 운영자 | 봉이 전용 요금제(MVNO 제휴 + 봉이 단독 혜택) 등록 |
| **4** | 어드민 신청서 처리 | 운영자 | 신청 list·필터·status·MVNO 본사 전달 |

❌ 이번 범위 아님: 본인 인증 외부 API·MNP 검증·요금 청구·CS 시스템 — MVNO 본사 또는 별도 단계.

---

## 2. 봉이 비즈니스 모델 핵심

```
고객                        봉이 (대리점)                    MVNO 사업자 (KT엠모바일 등)        망 임대 (KT/SKT/LGU+)
 │                            │                                    │                                  │
 │ storefront 가입 신청        │                                    │                                  │
 ├───────────────────────────►│                                    │                                  │
 │                            │ 신청서 처리 + 봉이 전용 요금제 매핑   │                                  │
 │                            ├───────────────────────────────────►│                                  │
 │                            │                                    │ 실제 개통 (망 임차)                │
 │                            │                                    ├─────────────────────────────────►│
 │                            │◄──────── 가입 수수료 ────────────────│                                  │
 │ MVNO 본사 명의로 청구       │                                    │                                  │
 │◄─────────────────────────────────────────────────────────────────│                                  │
```

### 수익 구조
- 가입 1건당 수수료 (대리점 fee, 일반적으로 1.5만~5만원/건)
- 봉이 전용 요금제는 MVNO와 협상한 도매단가 기반 마진 형성
- 부가 매출: 단말기 동시 판매·부가 서비스 매도

---

## 3. 첨부 파일 (zip 안 11개)

### spec md
- `README.md` — 본 문서
- `scope.md` — 4 화면 범위
- `market-research.md` — 한국 알뜰폰 시장 조사 (점유율·주요 사업자)
- `bongi-mvno-product-plan.md` — 봉이 전용 요금제 기획 (예시 8종)
- `data.md` — DB 모델 (providers·plans·promos·subscriptions·devices)
- `db-schema.md` — ERD + 신규 5 테이블 + RLS
- `api-endpoints.md` — `/api/mvno/*` 신규 endpoint
- `mobing-reference.md` — 가입 form 4 step 분석
- `env-vars.md` — 환경 변수

### wireframe HTML
- `01-customer-plan-list.html` — 요금제 비교 list
- `02-customer-signup-form.html` — 가입 4 step form
- `03-admin-plan-form.html` — 어드민 요금제 등록
- `04-admin-subscriptions.html` — 어드민 신청서 처리

---

## 4. 핵심 결정사항 (사용자 확정)

1. **MVNO 사업자 X · 대리점 ✅** — 봉이는 판매 대리점·중개자 (별정통신 면허 미보유)
2. **봉이 전용 요금제 출시** — KT엠모바일·미디어로그 등과 제휴 → 봉이 단독 패키지
3. **휴대폰·중고폰과 같은 별도 새 영역** — 도메인 분리 (`bongi_mvno_*` 신규 prefix)
4. **mobing.co.kr 가입 form 패턴 참고** — step 4 분할 (요금제 → 유형 → 정보 → 약관)
5. **신규 카테고리 ⑤** — `master-map.html`의 5번째 카테고리 (알뜰폰)

---

## 5. 작업 순서 (권장 P1~P5)

| Phase | 작업 | 산출물 | 예상 |
|---|---|---|---|
| **P1** | DB 마이그레이션 (5 신규 테이블) | mvno_providers·plans·promos·subscriptions·devices | 1d |
| **P2** | 어드민 요금제 등록 폼 (#3) | 봉이 전용 요금제 운영자 입력 | 3d |
| **P3** | 어드민 신청서 처리 (#4) | list·필터·status·MVNO 본사 전달 모달 | 3d |
| **P4** | 고객 요금제 비교 list (#1) | chip 필터·정렬·card grid | 4d |
| **P5** | 고객 가입 form (#2) — 모빙 패턴 | 4 step wizard·약관 박제 | 5d |

**합계: 약 16일** (1인 풀타임)

---

## 6. 기술 스택 — storefront 핸드오프 동일

- frontend: 동일 `client/src/pages/mvno/` 또는 storefront 모노레포
- 인증: localStorage `incentive-auth-token-v1` (admin) / Supabase auth (고객)
- 통신: `/api/mvno/*` 신규
- DB: 동일 Supabase

---

## 7. 봉이 보유 인프라 — 재사용 가능

| 영역 | 재사용 |
|---|---|
| 매장 directory | 8 직영 매장 — 알뜰폰도 매장 가입 가능 |
| 콜DB · TM 큐콜 | 가입 후 상담사 연결 |
| 권한·역할 | admin/manager/agent/contract |
| 정산 | 가입 1건당 인센티브 → incentive_sales 패턴 확장 |
| 엑셀 import | xlsx 패턴 — MVNO와 협상한 요금제 일괄 등록 |

→ 신규 = MVNO 도메인 UI + DB·API.

---

## 8. 주의 사항 (사업·법적)

1. **MVNO 대리점 등록**: 봉이 ↔ MVNO 본사 사업 계약 (개별 협상). 시스템 가동은 그것 후.
2. **요금 청구**: 봉이가 청구하지 않음 — **MVNO 본사가 직접 청구**. 봉이는 신청 전달·수수료 정산만.
3. **번호이동·본인 인증**: MVNO 본사 시스템이 처리. 봉이는 신청 정보 전달만 (혹은 본사 API 연동).
4. **CS 의무**: 가입 후 14일 청약철회·요금제 변경은 MVNO 본사가 처리. 봉이는 1차 안내만.
5. **개인정보 동의·전자서명**: 봉이 + MVNO 본사 양쪽 약관 동의 박제 필요.

→ 이번 핸드오프 = **UI 4 화면 + DB·API**. MVNO 본사 연동·법적 의무는 별도.

---

## 9. master-map 위치

봉이 전체 연결 맵에 ⑤ 알뜰폰 카테고리 추가됨:
- https://admin.prexymarket.com/docs/master-map.html
- 4 카테고리(인터넷+TV·휴대폰·렌탈·중고폰) → **5 카테고리 (+ 알뜰폰)**
- 티켓 prefix `M00001~`
- SelectCard: MvnoSelectCard (망→데이터→타겟 3단계)
- 상품카드: MvnoPlanCard (라이트테마)

---

## 10. 환경 (storefront 핸드오프 동일)

- 라이브: https://admin.prexymarket.com
- 데브: https://dev-admin.prexymarket.com
- Supabase: dugaqvvnhsgenhmhuyju (라이브) / sesgdqbmophgmombelmn (데브)
- GitHub: github.com/vinsenzo83/bongi-mobile
- Branch: master / develop sync
