# 봉이 storefront 한 장 요약

> 2026-06-03 · 복잡한 5개 spec은 reference, 본 문서가 **핵심 결정문**.

---

## 한 줄 정의

> **봉이 storefront = 가전 렌탈 AI 채팅 + 계산기 + 매장 직결.**
> 자유 채팅으로 추천받고, 계산기로 비교하고, 가입은 셀프 or 매장 방문.
> 결국 모두 `rental_sales` 1건으로 박제.

---

## 한 장 와이어프레임

```
┌─────────────┬──────────────────────────┬──────────────────┐
│ 좌 사이드바 │ 메인                      │ 우 결과 panel    │
│             │                            │                  │
│ + 새로 시작 │ ① 카테고리 chip 6개       │ 🏪 매장 방문 ⚫  │
│ 🏠 홈        │  (정수기/공청/비데/      │     온라인 신청 ◯│
│ 📺 가전렌탈*│   매트리스/에어컨/TV)   │                  │
│ 🪙 이벤트   │                            │ 📍 봉이 익산점  │
│             │ ② 상품 카드 list          │  ▼ 변경         │
│ 최근 상담   │  (이미지·BEST 배지·       │                  │
│             │   가격·자연어 chip)       │ 코웨이 아이콘3  │
│             │                            │ 약정 60M·셀프 4M│
│             │ ③ 약정 chip [84][72][60]  │ KB 카드 1구간   │
│             │ ④ 관리 chip [방문][셀프] │                  │
│             │ ⑤ 카드 chip (옵션)        │ 정상 35,900원   │
│             │                            │ 카드 17,900원   │
│             │ 💬 또는 자유 채팅          │ ────────       │
│             │  "정수기 추천해줘"        │ ✨ 17,900원/월  │
│             │                            │                  │
│             │                            │ [매장 방문 신청] │
│             │                            │ [온라인 셀프 가입]│
└─────────────┴──────────────────────────┴──────────────────┘
```

---

## 데이터 흐름 한 장

```
운영자 ── 어드민 ──> rental_products (이미 435개 + AI 8컬럼 완비)
                    rental_partner_cards (1·2·3 구간)
                    rental_policy V2

고객 ──> storefront ──> 채팅 or 계산기 ──> 견적 ──> rental_sales 박제
                                          │
                              ┌───────────┴───────────┐
                              │                       │
                       셀프 가입                상담사 연결
                  (auto rental_sales)      (콜DB → TM 큐콜 → 통화 → sales)

                              │
                       매장 방문 신청 ──> 매장 영업담당자 알림 ──> 매장에서 계약
                       (store_offline)                            (오프라인 sales 박제)
```

---

## 3가지 가입 경로 (모두 결과는 `rental_sales` 1건)

| 경로 | 트리거 | 후처리 | source |
|---|---|---|---|
| 🏪 매장 방문 | 매장 방문 신청 클릭 | 매장 영업담당자 알림·고객 직접 방문 | `store_offline` |
| 💻 온라인 셀프 | 셀프 가입 form 3 step | 자동 박제·R번호 부여·SMS | `storefront_self` |
| 📞 상담사 연결 | 간단 form 제출 | 콜DB insert → TM 큐콜 → 통화 후 박제 | `storefront_consult` |

---

## 어드민 신규 메뉴 6개 (storefront 운영 카테고리)

```
🆕 storefront 운영
├─ 💬 상담 대화 보기   (TM이 채팅 history 확인)
├─ 🪪 storefront 회원  (카카오 로그인 고객)
├─ 🎉 이벤트 캐러셀    (홈 banner 관리)
├─ 🪙 포인트·적립       (정책·내역)
├─ 🤝 친구 초대         (코드·보상·사기 방지)
└─ 📨 CS 인박스         (AI 미응답·1차 검수)
```

기존 23 메뉴 그대로 + 6 신규 = 29 메뉴.

---

## 5 phase로 끝 (다른 건 보조)

| Phase | 작업 | 산출물 |
|---|---|---|
| **P1** | DB 마이그레이션 (5 신규 테이블 + rental_sales 4컬럼) | 백엔드 준비 |
| **P2** | storefront 계산기 (카테고리·약정·관리·카드 chip + 우 panel) | 계산기 작동 |
| **P3** | 매장 방문 / 온라인 셀프 / 상담사 연결 3 CTA backend | 가입 3경로 작동 |
| **P4** | AI 채팅 UI + Claude API tool use | 채팅 작동 |
| **P5** | 어드민 신규 6 메뉴 | 운영자 보강 |

→ P1~P3 = MVP. P4·P5는 후속.

---

## 핵심 결정 3가지

1. **렌트리 X · 아정당 ✅** — chip 직노출 + step wizard + 우 panel = 직관적
2. **계산기가 메인 UI** — 자유 채팅은 보조 (AI 추천 받고 싶을 때만)
3. **매장 영업 직결** — 봉이 8 직영 매장 매출과 시너지

---

## 우리가 이미 갖고 있는 것 (95%)

- 상품 435개 + AI 자동 채움 8컬럼 (description·tags·specs·size·weight·care)
- 제휴카드 brand·company alias + 1·2·3 구간 + card_snapshot 박제
- rental_policy V2 (margin 자동 계산)
- 콜DB + round-robin TM 분배
- 8 직영 매장 directory (`incentive_centers`)

→ **storefront UI만 신규.** backend는 다 있다.

---

## 모르겠으면 이것만 본다

- 본 문서 = 결정문 ⭐
- `rental-calculator-2026-06-03.md` = 계산기 UI 상세
- `crm-storefront-rental-mapping-2026-06-03.md` = 어드민↔storefront 매핑
- `admin-restructure-for-storefront-2026-06-03.md` = 어드민 신규 메뉴 spec
- `storefront-plan-2026-06-03.md` = 전체 분석 (rentre·아정당 비교 포함, 가장 두꺼움)
- `flow-rental.html` = 옛날 기획 (렌트리 참고 시점 — 일부 deprecated)
