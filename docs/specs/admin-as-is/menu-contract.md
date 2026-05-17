# 📋 계약 처리

> `menu-key`: **`contract`** · iframe: **`/docs/incentive-contract.html`**

> 라이브 캡쳐: `screens/02-contract.png`


## 1. 접근 권한
| admin | manager | agent | contract |
|---|---|---|---|
| ✓ | ✓ | ✓ | ✓ |

## 2. 화면
![📋 계약 처리](screens/02-contract.png)

## 3. 소스 파일
- `docs/incentive-contract.html` · 2645 lines · `<title>계약부서 어드민 — V5</title>`

## 4. 사용 API endpoint
| endpoint | 매칭된 서버 라우트 |
|---|---|
| `/api/incentive/dealers` | GET incentive.js:/dealers, POST incentive.js:/dealers |
| `/api/incentive/gift-vouchers` | GET incentive.js:/gift-vouchers, POST incentive.js:/gift-vouchers |

## 5. DB 테이블 (추정)
- `incentive_db_sources`
- `incentive_sales`

## 6. localStorage / sessionStorage key
- `incentive-auth-token-v1`
- `incentive-refresh-token-v1`

## 7. 핵심 function (상위 15개)
```js
_peEsc
additional
addr
agent
bank
buildLineRequestMemo
card
carrier
clearToken
closeModal
escHtml
fallbackHint
fetchAgent
fetchContracts
fetchDbSources
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
