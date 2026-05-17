# 📖 급여 안내

> `menu-key`: **`guide`** · iframe: **`/docs/incentive-guide.html`**

> 라이브 캡쳐: `screens/17-guide.png`


## 1. 접근 권한
| admin | manager | agent | contract |
|---|---|---|---|
| ✓ | ✓ | ✓ | ✓ |

## 2. 화면
![📖 급여 안내](screens/17-guide.png)

## 3. 소스 파일
- `docs/incentive-guide.html` · 465 lines · `<title>💵 인센티브 급여 안내</title>`

## 4. 사용 API endpoint
_API 호출 미검출 (정적 HTML이거나 외부 lib 사용)_

## 5. DB 테이블 (추정)
- `incentive_agents`

## 6. localStorage / sessionStorage key
_(공통 incentive-auth-token-v1만 사용)_

## 7. 핵심 function (상위 15개)
```js
loadRules
oblig
ovPct
ovRate
partial
prMin
prPct
setText
```

## 8. 알려진 함정 / 주의
- `listCols` 4곳 동기화 (memory: `feedback_listcols_pitfall.md`)
- 빈 값 PATCH 함정 (`val !== ''` 체크)
- snapshot 박제: 가격·정책 변경 시 기존 row 보존
- Cloudflare 24h 캐시 → 변경 시 `?v=N` cache-buster

## 9. 개발자 체크리스트 (이 메뉴 수정 시)
- [ ] HTML input `data-field` 추가
- [ ] 서버 destructure에 컬럼 추가
- [ ] update 할당에 컬럼 추가
- [ ] `listCols` SELECT에 컬럼 추가 (가장 자주 누락)
- [ ] 데브 검증 후 라이브 머지
- [ ] SW_VERSION 증가 + `?v=YYYYMMDD`
