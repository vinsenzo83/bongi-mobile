# 모빙(mobing.co.kr) 가입 form 분석 — 봉이 매핑

> 참고 URL: https://www.mobing.co.kr/service-join/receipt?planID=LPZ0018905&promoSeq=8826
> 분석 목적: 봉이 알뜰폰 가입 form (#2)에서 사용할 step 흐름·필드·동의 패턴 표준화

---

## 1. URL 파라미터

| 파라미터 | 의미 | 봉이 매핑 |
|---|---|---|
| `planID=LPZ0018905` | 요금제 고유 코드 | `bongi_mvno_plans.plan_code` |
| `promoSeq=8826` | 적용된 프로모션 일련번호 | `bongi_mvno_promos.id` 또는 promo_code |

→ 봉이 URL 패턴: `/storefront/mvno/signup?plan=BONGI-LTE-7GB-19900&promo=24` 형식.

---

## 2. 가입 form step (추정 — 일반적인 알뜰폰 패턴)

### Step 1 — 요금제 + 프로모션 확인
- 표시: 요금제명·월정액·데이터·약정·적용 프로모션
- 버튼: "다음"

### Step 2 — 가입 유형 (chip 3개)
- 🆕 신규 가입 (`signup_type='new'`)
- 🔄 번호이동 (MNP) (`signup_type='mnp'`)
- 📱 유심만 변경 (`signup_type='usim_only'`)

→ MNP 선택 시 추가 입력:
- 이전 통신사 (KT/SKT/LGU+/알뜰폰)
- 이전 번호

→ 유심만 선택 시:
- nano vs esim chip

### Step 3 — 가입자 정보
필수 필드:
- 가입자 유형 chip — 개인 / 개인사업자 / 법인사업자 / 외국인
- 이름
- 생년월일 (YYYY-MM-DD)
- 성별
- 본인 연락처 (상담용)
- 주소 (우편번호 검색 — Kakao Postcode API)
- 이메일

본인 vs 대리인:
- modal "본인 / 다른 사람 대신" 선택
- 대리인 시 → 가입자·대리인 정보 분리

### Step 4 — 약관 동의 (chip 그리드)

| 필수 | 약관 | snapshot 박제 |
|---|---|---|
| ✅ | 봉이 알뜰폰 이용 약관 | 약관 전문 |
| ✅ | 개인정보 수집·이용 동의 | |
| ✅ | 제3자 정보 제공 동의 | |
| ✅ | 통신사 망 임대 약관 | |
| 선택 | 마케팅·광고 수신 동의 | |

→ 동의 chip 클릭 시점·snapshot_text 모두 `agreements` jsonb에 박제.

### 완료 — 신청 접수 (M00042)
- 화면: 접수 완료 + ticket_number + 예상 처리 시간 + 고객센터
- SMS 자동: "M00042 신청 접수. 24시간 내 연락드립니다"

---

## 3. 모빙 특이 패턴 (봉이 적용)

### 3-1. 사은품·쿠폰
- 모빙: 가입 1건당 쿠폰 / 사은품 자동 지급
- 봉이: `bongi_mvno_promos.type='cashback'` 또는 'gift' 활용

### 3-2. 통신사망 chip
- 모빙: 가입 step 1에서 망(KT/SKT/LGU+) 시각화
- 봉이: 요금제 카드에 망 로고 chip

### 3-3. 약정·약정없음 분리
- 모빙: 약정없음 chip = 자유 해지 가능
- 봉이: `contract_months=0` = "약정없음" 표시

### 3-4. 사용량 비교
- 모빙: 데이터/통화/문자 시각화 chip
- 봉이: `data_gb`·`voice_minutes`·`sms_count` chip

### 3-5. 본인 인증
- 모빙: PASS·간편본인인증 외부 API
- 봉이: POC는 SMS 인증 → 정식은 PASS 연동 (P6 이후)

---

## 4. 봉이 신규 spec — 모빙 안 따라가는 부분

1. **셀프 가입 + 상담원 가입 듀얼 CTA** — 봉이 storefront 패턴 그대로
2. **콜DB 연결** — 상담원 가입 시 incentive_customer_db로 자동 ingest
3. **8 직영 매장 안내** — 가입 후 매장 방문도 가능 옵션 (incentive_centers)
4. **rental_sales 패턴 박제** — snapshot + promo_snapshot 박제 (가격 변경 후에도 약속 유지)
5. **R번호 발급** — M00001 패턴 (가전 R0001과 분리)

---

## 5. 가입 후 후속 flow (운영자 측 #4)

1. 신청 → status=`pending` (M00042 발급)
2. 상담사 통화 검증 → status=`verified`
3. MNP 진행 (외부 API) → status=`processing`
4. 개통 완료 → status=`activated` + `activated_at`
5. 14일 청약 철회 가능 → status=`cancelled` (옵션)
