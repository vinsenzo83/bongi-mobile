# 📚 사용 매뉴얼

> `menu-key`: **`manual`** · iframe: **`/docs/incentive-manual.html`**

> 라이브 캡쳐: `screens/18-manual.png`


## 1. 접근 권한
| admin | manager | agent | contract |
|---|---|---|---|
| ✓ | ✓ | ✓ | ✓ |

## 2. 화면
![📚 사용 매뉴얼](screens/18-manual.png)

## 3. 소스 파일
- `docs/incentive-manual.html` · 927 lines · `<title>봉이 운영 매뉴얼</title>`

## 4. 사용 API endpoint
| endpoint | 매칭된 서버 라우트 |
|---|---|
| `/api/incentive/agents/me` | GET incentive.js:/agents/me |

## 5. DB 테이블 (추정)
- `incentive_agents`
- `incentive_calc_monthly_settlement`
- `incentive_calculator_history`
- `incentive_calculator_overrides`
- `incentive_customer_call_log`
- `incentive_customer_db_access_log`
- `incentive_role_permissions`
- `incentive_sales`
- `incentive_sales_history`
- `incentive_settlements`

## 6. localStorage / sessionStorage key
- `incentive-auth-token-v1`

## 7. 핵심 function (상위 15개)
```js
detectRole
filterMatch
haystack
navigate
renderMain
renderTOC
updateActiveLink
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
