# 가전렌탈 다채널 추천 엔진 — PRD

> 대상: `rental_products` (company_id) + `rental_product_options` 다채널 그룹
> 상위 PRD: `rental-register-form.md` · `billigo-rental-system.md`
> 작성일: 2026-05-24 · 상태: 초안 (승인 대기)

---

## 0. 요약

같은 모델·약정·케어를 N개 렌탈사가 동시 중개하는 가전렌탈에서, **상담사가 어느 채널로 팔지를 자동 추천**한다. 마진·고객 월부담·편의의 **하이브리드 스코어**로 채널별 순위를 매기고 — TM 계산기 추천 카드에 "🥇 최적 채널" 뱃지 + 대안 채널 표(스코어 순)를 노출. 상담사가 최적값을 보고 빠르게 의사결정.

---

## 1. 배경 · 현황 데이터 (라이브 실측 2026-05-24)

### 1.1 다채널 분포
가전 그룹 product 120개, **unique model 49개**:
| 채널 수 | 모델 수 | 비율 |
|---|---|---|
| 단일 채널 | 21 | 43% |
| 2 채널 | 8 | 16% |
| 3 채널 | 8 | 16% |
| **4+ 채널** | **12** | **24%** |
| 최대 채널 | **6** | (한 모델 최대) |
| **다채널 합계** | **28** | **57%** |

### 1.2 채널별 격차 사례 — 삼성 AF60F17D11_RS (에어컨 60M·셀프)
| 렌탈사 | 수수료율 | 월렌탈료 | 봉이 리베이트 | 봉이 마진 | 고객 6년 총부담 |
|---|---|---|---|---|---|
| LG헬로비전 | 16% | 66,800 | **641,280** | **507,152** | 4,008,000 |
| 스마트렌탈 | 13% | 71,500 | 557,700 | 431,930 | 4,290,000 |
| KT가전구독 | 18% | **50,000** | 540,000 | 416,000 | **3,000,000** |
| 스마트렌탈 (할인) | 13% | 61,500 | 479,700 | 361,730 | 3,690,000 |
| 현대유버스 | 12% | 63,900 | 460,080 | 344,072 | 3,834,000 |

→ **채널 선택만으로 봉이 마진 +163,080 (47%), 고객 부담 −1,008,000 (25%) 차이**. 상담사 수동 선택 비현실적.

### 1.3 영향 범위
- 모델 단위: 다채널 28모델 (가전 unique의 57%)
- product 단위: 가전 120 중 약 99건이 다채널 중복 product (120 − 21 = 99)
- 상담사: 가전 그룹 계약 시 매번 N개 채널 중 선택 결정 필요

---

## 2. 목표

1. 다채널 그룹에서 **단 하나의 "최적 채널"을 자동 식별**
2. 대안 채널도 스코어 순으로 함께 표시 — 상담사 상황 판단(고객 선호·경쟁사·제휴 등) 보장
3. **인센티브 구조·정책값은 무변경** — 추천은 표시 레이어만, DB·계산식 영향 없음
4. 같은 시리즈키(`metadata.series_key`)·model_key 단위로 그룹화

비목표:
- 자동 계약 (추천만, 결정은 상담사)
- 머신러닝/학습 (정해진 가중치 산식)
- 가전렌탈 외 인터넷+TV (인터넷은 통신사 선택이 고객 사전 조건이라 추천 무의미)

---

## 3. 스코어 산식 — 고객 유형 3 프로파일

### 3.1 고객 유형 (상담사가 청취 후 선택)
| 프로파일 | 아이콘 | 우선순위 | 사용 시나리오 |
|---|---|---|---|
| 💰 **월납 최소형** | `customer` | 매월 부담 최소화 | "매달 적게 내고 싶다" 고객 |
| 🎁 **사은품 최대형** | `gift` | 가입 시 메리트 최대 | "처음에 많이 받고 싶다" 고객 (페이백·결합혜택) |
| 🏢 **봉이 마진형** *(default)* | `margin` | 봉이·상담사 수익 최대 | 고객 선호 미정 / 운영자 기본 |

### 3.2 채널별 정규화 지표 (그룹 내 0~1)
| 지표 | 계산 | 의미 |
|---|---|---|
| **margin_score** | margin / max(group.margin) | 봉이 마진 |
| **customer_score** | min(group.monthly_fee) / monthly_fee | 월납 낮을수록 ↑ |
| **gift_score** | (rebate × 0.9) / max(group.rebate × 0.9) | 페이백·할인 여력 (큰 리베 = 페이백 여력 큼) |
| **convenience_score** | company.convenience_score | 운영자 설정 (0~1) |

> **gift_score 근거** — 봉이 페이백은 마진에서 차감되므로 리베이트가 큰 채널일수록 페이백·결합혜택 줄 여력이 큼. `rebate_otherco`(타사보상)·`bundle_rate`(결합지급률) 보유도 부분 가산.

### 3.3 프로파일별 가중치 (D1)
| 지표 | 💰 월납 | 🎁 사은품 | 🏢 마진(default) |
|---|---|---|---|
| margin_score | 0.20 | 0.30 | **0.50** |
| customer_score | **0.60** | 0.15 | 0.35 |
| gift_score | 0.05 | **0.45** | 0.00 |
| convenience_score | 0.15 | 0.10 | 0.15 |

`total_score = Σ(weight_i × score_i)` (0~1, 가중치 합 1.00)

### 3.4 예시 — 삼성 AF60F17D11_RS (60M·셀프)
| 채널 | margin | customer | gift | conv | 💰 월납 | 🎁 사은품 | 🏢 마진 |
|---|---|---|---|---|---|---|---|
| LG헬로비전 (M16%·월66.8k) | 1.00 | 0.75 | 1.00 | 0.80 | 0.77 | **🥇 0.82** | **🥇 0.92** |
| 스마트렌탈 (M13%·월71.5k) | 0.85 | 0.70 | 0.87 | 0.65 | 0.69 | 0.74 | 0.79 |
| KT가전구독 (M18%·월50k) | 0.82 | **1.00** | 0.84 | 0.75 | **🥇 0.91** | 0.74 | 0.86 |
| 현대유버스 (M12%·월63.9k) | 0.68 | 0.78 | 0.72 | 0.60 | 0.74 | 0.65 | 0.69 |

→ **유형 선택만 바꿔도 1위 채널이 KT(월납) ↔ LG헬로(사은품·마진)** 동적 변경

### 3.5 convenience_score 산정 (D2 — 초기 default)
`rental_companies.convenience_score` 컬럼(0~1)로 운영자 설정:
- 기본값: **0.5** (미설정 시)
- §6.2 초기 시드 참조

### 3.6 그룹 키 (D3)
- 1차: `metadata.series_key`
- 2차 fallback: `(category_id, model_key)` (toModelKey 정규화)
- 옵션 그룹: `(months, care_service, inspection_cycle)` 동일

### 3.7 채널별 옵션 선택 (D4)
- 채널 내 **최고 마진 옵션** 1개를 스코어 계산 대상
- multiple variant(프로모션·할인)는 마진 최대값 채택

---

## 4. UI

### 4.1 TM 계산기 추천 카드 (`tm-counselor.html`)
**상단 — 고객 유형 토글 (3 chip)**:
```
🎯 고객 유형:  [ 💰 월납 최소 ]  [ 🎁 사은품 최대 ]  [ 🏢 봉이 마진 ] (default)
```
토글 변경 시 추천 카드 즉시 재정렬·재계산. 선택값은 `localStorage.rental_recommend_profile`에 박제.

**다채널 모델 추천 카드**:
```
🏆 삼성 [B] 🏢 KT가전구독          ← 💰 월납 프로파일 선택 시
   AF60F17D11WRS · 셀프
   60M · 월 50,000원 · 마진 416k
   ┌ 🥇 KT가전구독 (0.91) · 월 50,000 [고객 부담 최저]
   │ 🥈 LG헬로비전 (0.77) · 월 66,800 · 마진 507k [봉이 마진 최고]
   │ 🥉 스마트렌탈 (0.69) · 월 71,500
   └ 보기 ▾ 더 …
```

### 4.1.1 시각 단서
- 메달 🥇🥈🥉 + 스코어 (0.00~1.00) + 프로파일 색
- 카드 좌측 색: 💰 초록(`#22c55e`) / 🎁 보라(`#a855f7`) / 🏢 노랑(`#fbbf24`)
- 각 대안 채널에 강점 태그 ("월납 최저"·"마진 최고"·"사은품 여력 최대")

### 4.2 어드민 옵션 디테일 (`incentive-products.html`)
옵션 카드 상단에 "이 모델 다채널 비교표" 추가 — 같은 모델 N채널의 마진·월납·스코어 표.

### 4.3 시각 단서
- 🥇🥈🥉 메달 + 스코어 (0.00~1.00)
- 색상: 마진 최고 → 노랑(`#fbbf24`), 고객 부담 최저 → 초록(`#22c55e`)
- "최적 채널" 추천 사유 한 줄 (예: "마진 +18만 / 고객 부담 동급")

---

## 5. 구현 — 서버

### 5.1 신규 endpoint
**`GET /api/rental/products/:id/channels?profile=margin|customer|gift`** — 그 product의 다채널 그룹 전체 + 선택 프로파일 스코어:
```json
{
  "group_key": "AF60F17D11_RS",
  "profile": "customer",
  "channels": [
    {
      "product_id": 123,
      "company": {"name":"KT가전구독","commission_rate":0.18,"convenience_score":0.75},
      "best_option": {"id":456,"months":60,"care":"셀프","monthly_fee":50000,"rebate":540000,"margin":416000,"tier":"S"},
      "scores": {
        "margin":0.82, "customer":1.00, "gift":0.84, "convenience":0.75,
        "by_profile": {"customer":0.91, "gift":0.74, "margin":0.86}
      },
      "rank": 1,
      "tags": ["고객 월납 최저"]
    },
    ...
  ]
}
```

> `scores.by_profile`로 3 프로파일 점수 동시 반환 — 클라이언트가 토글만 바꿔도 재호출 없이 정렬 변경 가능.

### 5.2 for-recommend RPC 확장 (D5)
선택지:
- **A. RPC 그대로** — 클라이언트가 product별 채널 endpoint 따로 호출
- **B. RPC에 channel_group 필드 추가** — 한 번에 그룹 정보 동봉

기본안: **A** (lazy load, 카드 호버/펼침 시 호출 — 초기 추천 리스트 가벼움). 추후 캐싱 검토.

### 5.3 스코어 계산 위치
- 서버 측 (Node) — 신규 endpoint 응답 시 실시간 산출. 캐시 X (정책·페이백 즉시 반영)
- 가중치는 `rental_policy.metadata.recommend_weights` jsonb 신규 컬럼으로 (운영자 조정 가능, D6)

---

## 6. DB 변경

### 6.1 신규/보강 컬럼
```sql
-- rental_companies: 편의 점수 (0~1)
ALTER TABLE rental_companies ADD COLUMN IF NOT EXISTS convenience_score numeric DEFAULT 0.5;
COMMENT ON COLUMN rental_companies.convenience_score IS '추천 엔진 편의 가중치 (0~1, 운영자 설정)';

-- rental_policy: 추천 프로파일 가중치 (운영자 조정, 3 프로파일)
ALTER TABLE rental_policy ADD COLUMN IF NOT EXISTS recommend_profiles jsonb
  DEFAULT '{
    "margin":   {"margin":0.50,"customer":0.35,"gift":0.00,"convenience":0.15},
    "customer": {"margin":0.20,"customer":0.60,"gift":0.05,"convenience":0.15},
    "gift":     {"margin":0.30,"customer":0.15,"gift":0.45,"convenience":0.10}
  }'::jsonb;
COMMENT ON COLUMN rental_policy.recommend_profiles IS '다채널 추천 프로파일별 가중치 (margin/customer/gift 합 1.00)';
```

### 6.2 초기 시드 (convenience_score)
| 렌탈사 | 점수 | 근거 |
|---|---|---|
| LG헬로비전 | 0.80 | 대기업·정책 안정 |
| KT가전구독 | 0.75 | 대기업·R상품 정책 명확 |
| LG전자구독 | 0.75 | 대기업 |
| 스마트렌탈 | 0.65 | 중견·운영 경험 |
| 이니렌탈 | 0.65 | 중견 |
| 현대유버스 | 0.60 | 중견 |
| 캐리어 | 0.55 | 단일 브랜드 |
| 그 외 | 0.50 | default |

---

## 7. 단계별 구현

| Phase | 범위 | 산출물 |
|---|---|---|
| **A** | DB 마이그레이션 + endpoint `/products/:id/channels` | SQL + rental.js |
| **B** | 어드민 옵션디테일 다채널 비교표 | incentive-products.html |
| **C** | TM 계산기 추천 카드 — 최적 채널 뱃지 + 대안 펼침 | tm-counselor.html |
| **D** | 정책 화면에 가중치·convenience 편집 UI | incentive-rules.html |

---

## 8. 4 roles 시뮬레이션

| role | 진입 | 영향 |
|---|---|---|
| **admin** | 정책 가중치·convenience 편집 | 추천 산식 직접 조정 |
| **manager** | 어드민 옵션디테일 다채널 비교표 조회 | 팀 영업 가이드 자료 |
| **agent** | TM 계산기에서 추천 카드 + 대안 펼침 | 채널 빠른 결정 |
| **contract** | 접근 불가 | — |

---

## 9. 미해결 결정

| ID | 질문 | 기본안 |
|---|---|---|
| **D1** | 3 프로파일 가중치 — 적정? | 초기 운영 후 데이터로 조정 |
| **D2** | convenience 운영자 설정 vs 평판 알고리즘 | 운영자 수동 (단순) |
| **D3** | 그룹키 — series_key 우선 vs (category, model_key) | series_key 우선, fallback |
| **D4** | 채널별 추천 옵션 — 마진 최고 vs 우수 최고 | 마진 최고 |
| **D5** | 추천 정보 RPC 통합 vs 별도 endpoint | 별도 endpoint (lazy) |
| **D6** | 가중치 정책 컬럼 vs 환경변수 | rental_policy 컬럼 |
| **D7** | KT가전구독·KT가전구독(회선X) 별개 채널 취급? | 별개 (회선 조건 다름) |
| **D8** | 프로파일 default — 운영자 설정 vs 마진형 고정 | 마진형 고정 (운영자 변경 가능) |
| **D9** | gift_score 산식 — rebate 단독 vs +rebate_otherco·bundle_rate | rebate 단독 (단순 시작) |
| **D10** | 프로파일 변경 위치 — 상담사 토글 vs 고객DB 메타 | 상담사 토글 (즉시), 추후 고객DB 자동 연동 검토 |

---

## 10. 5라운드 점검

- **R1 산식 검증**: 28개 다채널 모델 전부 스코어 산출 — NaN·음수·∞ 없음
- **R2 데브↔라이브**: DB 컬럼·시드·endpoint 양쪽 일치
- **R3 보안**: convenience·weights 편집은 admin만, RLS 정책 추가
- **R4 모니터링**: 추천 endpoint Sentry, 응답 시간 측정 (목표 < 200ms)
- **R5 4 roles E2E**: agent 추천 카드 / manager 비교표 / admin 가중치 편집

---

## 11. 라이브·데브 동기화 plan

| 파일 | 라이브 | 데브 |
|---|---|---|
| `2026-05-24-rental-recommend-engine.sql` | mcp 적용 | mcp 적용 |
| `server/routes/rental.js` (`/channels` endpoint) | master push | develop push |
| `docs/incentive-products.html`·`tm-counselor.html` | master | develop |
| convenience_score 초기 시드 (7개사) | SQL UPDATE | SQL UPDATE |

---

## 12. 의존성

- `rental-register-form.md` — 등록폼 적재 (선행, 완료)
- `billigo-rental-system.md` — `model_key`·`company_id` 컬럼 (선행, 완료)
- `for-recommend` RPC company 반환 (선행, 완료 — 2026-05-24)
- recalc RPC margin·tier (선행, 완료)
