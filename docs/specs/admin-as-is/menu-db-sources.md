# 🗂️ DB 출처

> `menu-key`: **`db-sources`** · iframe: **`/docs/incentive-db-sources.html`**

> 라이브 캡쳐: `screens/06-db-sources.png`


## 1. 접근 권한
| admin | manager | agent | contract |
|---|---|---|---|
| ✓ | · | · | · |

## 2. 화면
![🗂️ DB 출처](screens/06-db-sources.png)

## 3. 소스 파일
- `docs/incentive-db-sources.html` · 452 lines · `<title>DB 출처 관리 (admin)</title>`

## 4. 사용 API endpoint
_API 호출 미검출 (정적 HTML이거나 외부 lib 사용)_

## 5. DB 테이블 (추정)
_incentive_* 테이블 참조 미검출_

## 6. localStorage / sessionStorage key
_(공통 incentive-auth-token-v1만 사용)_

## 7. 핵심 function (상위 15개)
```js
clearToken
closeModal
deactivate
escapeHtml
fetchAgent
fetchAll
getToken
init
loadAll
login
onLoggedIn
openEdit
openNew
reactivate
renderTable
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
