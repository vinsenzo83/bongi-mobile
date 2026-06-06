# 알뜰폰 API endpoint (신규)

> base: `https://admin.prexymarket.com/api/mvno`
> 인증: 동일 패턴 (`Authorization: Bearer {token}`)

---

## 1. 요금제 (#1 비교 list)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/plans?carrier=KT&network=5G&active=1` | 요금제 list (필터) | optional |
| GET | `/plans/:id` | 단일 요금제 (프로모션 join) | optional |
| GET | `/plans/compare?ids=1,2,3` | 비교 view (최대 4개) | optional |

### 응답 예시
```json
{
  "plans": [
    {
      "id": 1,
      "plan_code": "BONGI-LTE-7GB-19900",
      "name": "봉이 음성 LTE 7GB",
      "carrier": "KT",
      "network_type": "LTE",
      "monthly_fee": 19900,
      "promo_fee": 9900,
      "promo_period_months": 3,
      "data_gb": 7,
      "voice_minutes": null,
      "feature_tags": ["데이터7GB","약정없음"],
      "promo_tags_list": ["첫3개월50%"],
      "promos": [
        { "type": "discount", "title": "첫 3개월 50% 할인", "value": 10000, "duration_months": 3 }
      ]
    }
  ]
}
```

---

## 2. 가입 신청 (#2 form)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/subscriptions` | 신청 박제 (snapshot + promo_snapshot + agreements) | optional (익명 신청) |
| GET | `/subscriptions/:ticketNumber` | 신청 확인 (M00001 등) | optional |
| POST | `/subscriptions/:id/verify-phone` | 본인 연락처 인증 (옵션) | optional |

### POST body
```json
{
  "plan_id": 1,
  "signup_type": "mnp",
  "sim_type": "nano",
  "customer_name": "김봉이",
  "birth_date": "1990-01-01",
  "gender": "male",
  "customer_type": "personal",
  "phone_for_contact": "01012345678",
  "from_carrier": "SKT",
  "from_phone": "01098765432",
  "desired_number": "01098765432",
  "address": "서울시 강남구 ...",
  "email": "kim@example.com",
  "agreements": {
    "service_terms": true,
    "privacy": true,
    "third_party": true,
    "marketing": false,
    "agreed_at": "2026-06-06T10:00:00Z",
    "snapshot_text": "... 약관 전문 박제"
  }
}
```

### 응답
```json
{
  "ok": true,
  "subscription": {
    "id": 42,
    "ticket_number": "M00042",
    "status": "pending"
  }
}
```

---

## 3. 어드민 요금제 등록 (#3)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | `/plans` | 신규 등록 | admin |
| PATCH | `/plans/:id` | 수정 | admin |
| DELETE | `/plans/:id` | soft delete (is_active=false) | admin |
| POST | `/plans/import` | 엑셀 일괄 (xlsx) | admin |
| POST | `/plans/:id/promos` | 프로모션 추가 | admin |
| PATCH | `/promos/:id` | 프로모션 수정 | admin |
| DELETE | `/promos/:id` | 프로모션 삭제 | admin |

---

## 4. 어드민 신청서 처리 (#4)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/subscriptions?status=pending&plan_id=1` | list (필터) | admin/manager |
| GET | `/subscriptions/:id` | 디테일 (snapshot 포함) | admin/manager |
| PATCH | `/subscriptions/:id` | status 변경·메모 | admin/manager |
| POST | `/subscriptions/:id/activate` | 개통 완료 처리 (activated_at = now) | admin/manager |
| POST | `/subscriptions/:id/cancel` | 취소 | admin/manager |
| GET | `/subscriptions/stats?ym=2026-06` | 월별 통계 | admin/manager |

---

## 5. 망 임대 사업자 참조 (보조)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/carriers` | KT/SKT/LGU+ list | optional |

---

## 6. 단말기 (옵션)

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| GET | `/devices?brand=Apple` | 단말기 list | optional |
| POST | `/devices` | 등록 | admin |
| PATCH | `/devices/:id` | 수정 | admin |

---

## 7. 에러 표준

| status | error 메시지 예시 |
|---|---|
| 400 | "필수 필드 누락: customer_name" |
| 401 | "인증 필요" |
| 403 | "admin 권한 필요" |
| 404 | "요금제 없음" |
| 409 | "이미 가입된 번호" |
| 500 | "서버 오류 — 잠시 후" |
