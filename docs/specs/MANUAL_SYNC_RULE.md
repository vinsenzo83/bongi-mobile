# 사용 매뉴얼 동기화 필수 룰

**원칙**: 봉이 어드민 코드/정책/UI 변경 시 사용 매뉴얼(`docs/incentive-manual.html`)과 상담사 가이드(`docs/incentive-guide.html`)를 **같이 변경**한다. 변경 PR/commit은 매뉴얼 동기화가 끝나야 완료.

---

## 동기화 대상 (변경 시 반드시 매뉴얼 갱신)

| 변경 유형 | 매뉴얼 영향 섹션 |
|---|---|
| **DB 스키마** (ADD/DROP 컬럼·테이블) | 해당 메뉴 섹션 + (정책이면) `id: 'rules'` |
| **신규 RPC / endpoint** | 해당 기능 섹션 + 운영 절차 |
| **신규 페이지·메뉴** | `sections` 배열에 새 entry 추가 + 좌측 menus index |
| **정책 공식 변경** | `id: 'rules'` + `incentive-guide.html` 가전·인터넷 표 모두 |
| **컬럼 추가** (listCols 4곳 동기화 시) | 상품/정책/계약 모달 섹션에 컬럼 의미 추가 |
| **UI 흐름 변경** (탭·모달·버튼) | 해당 메뉴 섹션 step 갱신 |
| **권한 매트릭스 변경** | role-tag 표 + 권한 관리 섹션 |
| **신규 자동화** (cron·BroadcastChannel·polling) | 해당 섹션 "자동 동기화" 안내 |
| **용어 변경** (예: "가중치" → "상담사 포인트") | 전체 grep + 일괄 치환 |

---

## 매뉴얼 2종

| 파일 | 대상 | 용도 |
|---|---|---|
| `docs/incentive-manual.html` | admin·manager·contract·agent (전체) | 메뉴별 사용법·운영 절차 |
| `docs/incentive-guide.html` | agent (상담사) | 인센티브·정책 직관 설명 (수식·표·예시) |

---

## 작업 절차 (필수 — 변경 시 같이 진행)

1. **코드 변경** (DB·API·UI) — 본 작업
2. **매뉴얼 grep** — 영향 받는 섹션 ID 식별
   ```bash
   grep -n "id: '" docs/incentive-manual.html
   ```
3. **manual.html 갱신** — 해당 섹션 `html: \`...\`` 본문 수정
   - 신규 페이지면 `sections` 배열에 entry 추가 + `group` 분류
   - 폐기 컬럼·기능은 명시적으로 "DROP" 또는 "폐기" 표기 (옛 스크립트 혼동 방지)
4. **guide.html 갱신** — 정책·공식·수치 변경이면 표·계산식 갱신
5. **SW_VERSION 증가** (`docs/sw.js`) — 캐시 즉시 갱신
6. **commit 메시지에 매뉴얼 갱신 명시** — 예: `docs(manual): rules·products 섹션 V5 통일 반영`

---

## 자동 체크리스트

변경 PR 머지 전 확인:
- [ ] `incentive-manual.html` 해당 섹션 갱신
- [ ] `incentive-guide.html` 정책 표 갱신 (정책 변경 시)
- [ ] `sections` 인덱스 (신규 메뉴 시)
- [ ] 폐기 컬럼·기능 명시 (옛 표현 혼선 방지)
- [ ] SW_VERSION 증가
- [ ] commit 메시지 "docs(manual)" 또는 "docs(guide)" 포함

---

## 관련 파일

- `/docs/incentive-manual.html` — 24 섹션 (line 92~)
- `/docs/incentive-guide.html` — 인센티브 가이드 (line 1~)
- `/docs/sw.js` — SW_VERSION
- `/CLAUDE.md` — 프로젝트 룰
- `~/.claude/projects/-Users-vinsenzo/memory/feedback_manual_sync_required.md` — 메모리 룰
