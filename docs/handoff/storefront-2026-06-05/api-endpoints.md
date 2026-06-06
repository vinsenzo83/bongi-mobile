# API 엔드포인트 (storefront 4 화면에서 사용)

> base: `https://admin.prexymarket.com/api`
> 인증: `Authorization: Bearer {token}` (localStorage `incentive-auth-token-v1`)
> 단, 일부 endpoint는 익명 가능 (optionalAuth)

---

## 1. 계산기 (#1 고객용)

### 카테고리·제품·옵션 조회

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/rental/categories` | 카테고리 list (slug·name·extra_fields·metadata) | optional |
| GET | `/rental/products?category={slug}` | **slug**! water-purifier·aircon·tv 등 | optional |
| GET | `/rental/products?category={slug}&brand={brand}` | brand 필터 (server alias 자동) | optional |
| GET | `/rental/products/{id}/options` | 약정·관리·옵션 list + product detail | optional |
| GET | `/rental/products/for-recommend` | 추천용 (option_count + meta 포함) | optional |

### 카드·견적

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/rental/partner-cards?active=1&category={name}&brand={brand}` | **한글 name**! 정수기·공청 등. brand alias 자동 | 필요 |
| POST | `/rental/quote` body=`{option_id, promo_type, half_period_override?}` | 가격 계산 (rental_policy V2 적용) | optional |
| GET | `/rental/brand-policies` | 브랜드 정책 (결합·타사보상·반값·환수) | optional |

### 신청 (셀프/상담원)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/rental/sales` body=`{product_id, option_id, customer_*, snapshot, card_snapshot, source}` | 셀프 신청 박제 | 필요 |
| POST | `/incentive/customer-db` body=`{phone, name, source='storefront_chat'}` | 상담원 연결 → 콜DB ingest | 필요 (또는 신규 익명 endpoint 생성) |

---

## 2. 어드민 상품 등록 (#2)

| Method | Path | 설명 |
|---|---|---|
| GET | `/rental/products?active_only=1` | 전체 상품 list |
| POST | `/rental/products` | 신규 등록 |
| PATCH | `/rental/products/{id}` | 수정 |
| DELETE | `/rental/products/{id}` | soft delete |
| GET | `/rental/products/{id}/options` | 옵션 list |
| POST | `/rental/products/{id}/options` | 옵션 추가 |
| POST | `/rental/products/import` (또는 client side parsing) | 엑셀 일괄 import |
| POST | `/rental/products/{id}/auto-fill` | AI 8 컬럼 자동 채움 |

업로드:
- Supabase Storage bucket: `product-images`
- path: `{category-slug}/{product_id}.{ext}`
- public URL → `rental_products.image_url` update

---

## 3. 어드민 카드 등록 (#3)

| Method | Path | 설명 |
|---|---|---|
| GET | `/rental/partner-cards?active=1` | 카드 list |
| POST | `/rental/partner-cards` | 신규 (brand·card_name·categories[]·tier1/2/3) |
| PATCH | `/rental/partner-cards/{id}` | 수정 |
| DELETE | `/rental/partner-cards/{id}` | 비활성 |
| GET | `/rental/partner-cards/brands` | 등록 가능 brand list |

---

## 4. 어드민 신청서 (#4)

| Method | Path | 설명 |
|---|---|---|
| GET | `/rental/sales?status={pending/confirmed/done}` | 신청 list |
| GET | `/rental/sales?source={storefront_self/storefront_consult}` | source 필터 |
| GET | `/rental/sales/{id}` | 상세 (snapshot + card_snapshot) |
| PATCH | `/rental/sales/{id}` | status 변경·메모 |
| DELETE | `/rental/sales/{id}` | 취소 |

---

## 5. 공통

| Method | Path | 설명 |
|---|---|---|
| POST | `/auth/login` body=`{email, password}` | Supabase auth (token 발급) |
| GET | `/incentive/agents/me` | 본인 정보 (role·center) |
| GET | `/incentive/agents/all` | 상담사 list (admin 전용) |
| POST | `/incentive/agents/{id}/reset-password` | 비번 reset |
| GET | `/health` | uptime·DB 연결 확인 |

---

## 6. 응답 포맷

```json
// 성공
{ "products": [...], "count": 107 }
{ "agents": [...], "count": 14 }
{ "agent": {...} }
{ "ok": true }

// 에러
{ "error": "메시지" }     // 400/401/403/404/500
```

---

## 7. 자주 쓰는 alias·매핑 (server에 이미 적용)

### brand alias (partner_cards.brand)
- 청호 ↔ 청호나이스
- 웰스 ↔ 교원웰스
- BS ON ↔ 삼성전자(BS ON) ↔ 삼성전자 ↔ 삼성
- LG ↔ LG전자 ↔ LG전자구독 ↔ LG헬로비전
- 현대유버스 ↔ 현대큐밍

### company_id alias (renta_companies)
- 4 ↔ 16 (LG전자 ↔ LG전자구독)
- 19 ↔ 7  (청호 ↔ 청호나이스)
- 20 ↔ 8  (웰스 ↔ 교원웰스)

### carrier 매핑 (DB ↔ client)
- DB: 'SK' / 'KT' / 'LG'
- client: 'skt' / 'kt' / 'lgu'
