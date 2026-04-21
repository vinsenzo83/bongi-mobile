# 🧑‍💻 개발자 인수 가이드 — 봉이모바일 요금 계산기

**대상**: 백엔드 / 프론트엔드 / DB 개발자
**버전**: 2026-04-21
**스펙 상태**: ✅ 1,434 케이스 검증 완료 · 바로 구현 가능

---

## 🎯 한눈에 보는 구조

```
📊 단일 진실 소스 (SSOT)
  └── docs/calculator.html  (D 객체 · 데이터 + 계산 로직 원본)

📥 개발 참고 자료 (파생)
  ├── docs/bongi-calculator-data.xlsx  (20 시트 · 데이터/공식/검증)
  └── docs/calculator-v2.html          (UX 참고 · 데이터 검증용)

📜 자동화
  └── scripts/gen-calculator-data.py  (Excel 재생성 스크립트)
```

변경 흐름: `calculator.html` D 객체 수정 → `python3 scripts/gen-calculator-data.py` → Excel 재생성 → 개발팀 공유

---

## 📋 개발 체크리스트

### 백엔드
- [ ] 3사 데이터 모델 (SKT / KT / LG U+) → `docs/bongi-calculator-data.xlsx` **20_Schema 시트 참조**
- [ ] 결합할인 계산 엔진 구현 (REPLACE vs STACK 로직)
- [ ] API 엔드포인트:
  - `GET /api/carriers/:carrier/data` — 통신사별 요금·TV·셋톱 조회
  - `POST /api/calc/quote` — 견적 계산 (입력: carrier, speed, tvIdx, wifi, bundle, lines)
  - `GET /api/cards/:carrier` — 제휴카드 조회
- [ ] DB 스키마 설계 (Supabase)
- [ ] 테스트: Excel 🧮 시트 값과 동일 결과 검증 (1,434 케이스 기준)

### 프론트엔드
- [ ] 통신사 선택 → TV/WiFi/결합 드롭다운 (의존성 있음)
- [ ] 실시간 계산 UI — `docs/calculator-v2.html` 참고 (카드형 UI)
- [ ] 결합할인 자격 체크 (프리미엄 77K+ 2회선, 투게더 85K+ 등)
- [ ] 경로 A (결합없음) vs 경로 B (결합적용) 비교 표시

### DevOps
- [ ] CI: `calculator.html` 변경 시 `gen-calculator-data.py` 자동 실행
- [ ] 배포: Excel 파일 서빙 경로 유지 (`/docs/bongi-calculator-data.xlsx`)

---

## ⚠️ 3사 결합할인 계산 방식 — **매우 중요**

| 통신사 | 결합 종류 | 적용 방식 | 공식 |
|---|---|---|---|
| **SKT** | 요즘가족결합 | **REPLACE** | 단독가 - famInet (요즘우리집 대체) |
| **KT** | 총액/정액 | **STACK** | 기본 TV결합가 - 추가할인 (중복 적용) |
| **KT** | 💎 프리미엄 가족결합 | **별도** | 대표자 총액 + 77K+ 구성원 프리미엄 |
| **LG U+** | 참쉬운/투게더 | **REPLACE** | 단독가 - 결합할인 |

🔴 **절대 하지 말 것**: SKT 계산에 `tvInternetNoWifi`를 쓰는 것 (REPLACE 방식이라 단독가에서 시작해야 함)

**상세 로직**: Excel `30_Formula` · `13_KT_Premium` · `10_SKT_Bundle` 시트 참조

---

## 🧮 계산 예시 (검증된 값)

```javascript
// 예시 1: SKT 500M + B tv 올 + WiFi X + 요즘가족 3회선
input: { carrier: 'skt', speed: '500M', tv: 3, wifi: false, bundle: 'family', lines: 3 }
expected: {
  bundleFee: 41800,       // 인터넷+TV 월 실납부
  mobileDiscount: 18000,   // 휴대폰 고지서 별도 차감
  finalFee: 23800          // 혜택가
}

// 예시 2: KT 프리미엄 가족결합 (자료 원본)
input: { carrier: 'kt', speed: '100M', tv: 0, bundle: 'premium',
         members: [{rep:true, plan:89000}, {plan:89000, usePrem:true}, {plan:89000, usePrem:true}] }
expected: { totalDiscount: -53300 }  // 인터넷 5500 + 대표자 총액 3300 + 프리미엄 22250×2
```

---

## 📚 참고 자료 (링크)

### 내부 문서
- 🧮 **통합 계산기 (상담원용)** — [calculator.html](https://bongi-mobile-production.up.railway.app/docs/calculator.html)
- 🧮 **v2 (데이터 검증용)** — [calculator-v2.html](https://bongi-mobile-production.up.railway.app/docs/calculator-v2.html)
- 📊 **개발자용 Excel** — [bongi-calculator-data.xlsx](https://bongi-mobile-production.up.railway.app/docs/bongi-calculator-data.xlsx)
- 📋 **전체 플로우** — [flow-internet-tv.html](https://bongi-mobile-production.up.railway.app/docs/flow-internet-tv.html)

### 원본 공식 자료 (검증용)
- 🔗 [SK 상품 전체 안내](https://www.100mb.kr/01_product/sk.php) (요즘가족결합)
- 🔗 [KT 💎 프리미엄 가족결합](https://www.100mb.kr/bbs/board.php?bo_table=information&wr_id=11986)
- 🔗 [LG U+ 상품 전체 안내](https://www.100mb.kr/01_product/lg.php) (참쉬운/투게더)

---

## 🔧 변경 관리

### 데이터 변경 시 (요금/상품 업데이트)
```bash
# 1. docs/calculator.html의 D 객체 수정
vi docs/calculator.html

# 2. Excel 재생성
python3 scripts/gen-calculator-data.py

# 3. 커밋·푸시
git add docs/ && git commit -m "data: KT 프리미엄 요금제 추가" && git push

# 4. 백엔드: DB 데이터도 동기화 (별도 마이그레이션 스크립트 필요)
```

### 계산 로직 변경 시
1. `calculator.html`의 `calc()` 함수 수정
2. Excel 수식(🧮 시트)도 동일하게 반영
3. 검증 테스트 재실행 (`/tmp/skt_family_test.py` · `/tmp/kt_verify.js` · `/tmp/lgu_verify.py`)

---

## ❓ 질문/피드백

- 데이터 오류 발견 시 → 이슈 등록 또는 대표 직통
- 로직 미구현 케이스 (KT 정액결합 Excel 미지원 등) → Excel `30_Formula` 시트 확인
- 새 통신사/결합 추가 → `calculator.html` D 객체 확장 후 스크립트 재실행

---

**Last updated**: 2026-04-21 · 봉이모바일 팀
