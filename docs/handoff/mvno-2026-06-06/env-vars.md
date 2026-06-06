# 환경 변수 (알뜰폰 추가)

> 기본 환경 변수는 storefront 핸드오프(2026-06-05)와 동일.
> 알뜰폰만 추가로 필요한 항목.

---

## 1. 본인 인증·외부 API (POC 단계는 mock 가능)

```
# PASS / 통합 본인인증
PASS_CLIENT_ID=xxx
PASS_CLIENT_SECRET=xxx
PASS_RETURN_URL=https://admin.prexymarket.com/api/mvno/auth/pass-callback

# SMS 인증 (POC 또는 SUB)
SMS_VENDOR=naver-cloud-sms / aligo / coolsms
SMS_API_KEY=xxx
SMS_API_SECRET=xxx
SMS_FROM=15990000

# Kakao 주소 검색 (이미 봉이 가전렌탈에 사용 중 — 동일 키)
KAKAO_REST_API_KEY=xxx
```

---

## 2. MNP (번호이동) 외부 API — P6 이후

```
# 망 임대 사업자별 MNP API (POC는 미사용)
KT_MNP_ENDPOINT=...
KT_MNP_KEY=...

SKT_MNP_ENDPOINT=...
SKT_MNP_KEY=...

LGU_MNP_ENDPOINT=...
LGU_MNP_KEY=...
```

---

## 3. 결제 PG (옵션)

```
# 가입비·유심비 즉시 결제 (옵션 — POC는 후불·계좌이체)
TOSSPAYMENTS_SECRET_KEY=xxx
PORTONE_API_KEY=xxx
```

---

## 4. 보안

- 외부 API 키는 절대 frontend bundle에 X (`VITE_` prefix 금지)
- `service_role` key는 server only
- SMS 인증 코드는 6자리 numeric, 5분 TTL (Redis 또는 in-memory)
