# scripts/

리포지토리 유지보수용 스크립트 모음.

## gen-calculator-data.py

**목적**: 통합 요금계산기(docs/calculator.html)의 D 객체 데이터를 개발자용 Excel로 변환.

**출력**: `docs/bongi-calculator-data.xlsx` (19 시트)
- `INDEX` — 전체 시트 안내
- `01~08` — 필수 데이터 (인터넷/TV/셋톱/WiFi/설치비/사은품/제휴카드)
- `10~15` — 결합할인 테이블 (3사별)
- `20_Schema` — TypeScript 인터페이스 정의
- `30_CALC_Formula` — 계산 공식 (3사 공통 + 결합할인 분기)
- `31~32_CALC_Example_*` — 실제 계산 예시 (단계별)

## 실행

```bash
python3 scripts/gen-calculator-data.py
```

의존성: `openpyxl` (`pip3 install openpyxl`)

## 데이터 업데이트 흐름

1. `docs/calculator.html`의 `D` 객체 수정 (단일 진실 소스)
2. 이 스크립트 실행 → Excel 재생성
3. 백엔드에서 JSON 추출이 필요하면 `extract-to-json.py` 추가 예정

## 백엔드 통합 제안

- ETL 자동화: CI/CD에서 calculator.html 변경 감지 시 이 스크립트 자동 실행
- API 통합: 생성된 JSON을 `/api/carriers/data` 엔드포인트로 제공 가능
- 백엔드 서비스에서 가격 조회할 때 이 데이터 소스를 import
