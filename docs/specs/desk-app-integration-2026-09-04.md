# 상담 데스크 ↔ 고객앱 연동 규격서

> **앱팀이 이 문서만 보고 붙일 수 있도록** 쓴다.
> 작성 2026-09-04 · dev 검증 완료(왕복 9단계 PASS) · live 미적용

---

## 1. 역할 분담

| | 만드는 쪽 | 내용 |
|---|---|---|
| 고객 앱 화면 | **앱팀** | 채팅 UI, 푸시 알림 |
| **AI 1차 상담** | **앱팀** | 봇이 답할 수 있는 것은 앱에서 끝낸다 |
| **상담 데스크** | **봉이(우리)** | 사람이 개입해 이어받는 채팅. 우리 제품의 사용자는 **상담사**다 |
| 라우팅·CRM 연결 | 봉이 | 문의 성격×상품 2축 배정, 콜DB 통합, 상담이력 기록 |
| 연결 API | 봉이 | 아래 4개 |

> **우리는 고객앱을 만들지 않는다.** 고객 화면에 무엇을 어떻게 그릴지는 앱팀이 정한다.
> 우리는 "사람이 이어받았다 / 사람이 이렇게 답했다 / 이렇게 종결됐다"를 알려줄 뿐이다.

---

## 2. 전체 흐름

```
[앱]  고객 문의 → 앱 AI 1차 응대
        │
        │  ① 앱 AI 가 못 풀 때  (근거없음 / 고객이 사람 요청 / 구매의사 / 클레임)
        ▼
      POST desk_import          ← AI 대화 전문 + 핸드오프 패키지
        │
[데스크] 2축 라우팅 → 담당 부서 대기열 → 상담사 인계
        │                                   상담사가 앞 대화 전문을 그대로 본다
        │  ② 앱은 주기적으로
        ▼
      GET  desk_app_sync         ← mode + 상담사 답변만 내려감
        │
        │  ③ 사람 응대 중 고객이 앱에서 계속 말하면
        ▼
      POST desk_app_customer_say ← 데스크로 들어옴
        │
[데스크] 상담사가 종결 → CRM 상담이력 자동 기록
        │
        ▼
      GET  desk_app_sync         ← mode=closed, outcome, callback_at
```

---

## 2.5 스택 · 호출 위치 (앱팀 = FastAPI + Next.js/React)

```
[브라우저]  Next.js / React        ← 고객 화면. 앱팀 소유
    │  (자체 프로토콜)
[앱 서버]   FastAPI                ← AI 1차 상담. 앱팀 소유
    │  ★ 여기서만 우리를 호출한다 (x-desk-app-key)
[봉이]      Express /api/desk/app/*
    │
            Postgres (desk 스키마)
```

### ⚠ Next.js 브라우저에서 직접 호출하지 말 것

`x-desk-app-key` 는 **서버 전용 키**다. Next.js 클라이언트 번들이나 `NEXT_PUBLIC_*` 에 넣으면
브라우저 개발자도구에서 그대로 노출되고, 그 키로 **아무 대화나 조회·주입**할 수 있다.
반드시 FastAPI 가 중계한다. Next.js 라우트 핸들러(`app/api/...`)에서 부르는 것도 서버측이면 허용.

| 위치 | 우리 API 직접 호출 | 이유 |
|---|---|---|
| FastAPI (앱 서버) | ✅ | 키가 서버에만 있다 |
| Next.js Route Handler / Server Action | ✅ | 서버 실행 |
| Next.js 클라이언트 컴포넌트 | ❌ | 키 노출 |

### 폴링은 FastAPI 가 한다

```
Next.js  ──(기존 방식 그대로: WS/SSE/폴링)──▶  FastAPI
                                              │  3초마다
                                              ▼
                                        GET /api/desk/app/sync
```
FastAPI 가 `mode` 를 보고 **자기 AI 호출 여부를 결정**한다. 이 판단을 브라우저로 내리면
탭이 여러 개일 때 어긋난다.

### FastAPI 예제 (httpx)

```python
import httpx, os
DESK = os.environ["DESK_BASE_URL"]          # https://admin.prexymarket.com
HDR  = {"x-desk-app-key": os.environ["DESK_APP_KEY"]}

async def handoff_to_desk(session_id: str, msgs: list, meta: dict) -> dict:
    """앱 AI 가 못 풀 때 호출. 재시도해도 안전(멱등)."""
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{DESK}/api/desk/app/import", headers=HDR, json={
            "external_id": session_id,                  # ★ 세션당 고정
            "entry_slug": "app-product",
            "intent": meta["intent"],                   # presale | cs | claim | etc
            "topic":  meta["topic"],                    # GET /api/desk/topics 로 받은 slug
            "phone":  meta.get("phone"),
            "name":   meta.get("name"),
            "messages": [                               # ★ 원본 시각 그대로
                {"sender_type": m.role, "body": m.text,
                 "created_at": m.created_at.isoformat(),
                 "bot_sources": m.sources or None}
                for m in msgs
            ],
            "handoff": {
                "reason": meta["reason"],               # T1 | T2 | T3 | T4
                "summary": meta["summary"],
                "collected": meta.get("collected", {}),
                "unanswered": meta["unanswered"],       # ★ 비우지 말 것
                "confidence": meta.get("confidence"),
            },
            "context": {"utm_source": meta.get("utm"), "ref": meta.get("bref")},
        })
        r.raise_for_status()
        return r.json()

async def sync(session_id: str, since_seq: int) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.get(f"{DESK}/api/desk/app/sync", headers=HDR,
                        params={"external_id": session_id, "since_seq": since_seq})
        r.raise_for_status()
        return r.json()

async def push_customer_message(session_id: str, text: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as c:
        r = await c.post(f"{DESK}/api/desk/app/say", headers=HDR,
                         json={"external_id": session_id, "body": text})
        return r.json()
```

### AI 호출을 막는 지점 (가장 중요)

```python
state = await sync(session_id, cursor)
cursor = state.get("last_seq") or cursor

if state["mode"] == "agent":
    # ★ 사람이 응대 중 — 우리 AI 를 절대 호출하지 않는다
    await deliver_to_browser(state["messages"])     # 상담사 답변만 전달
    return
elif state["mode"] == "queued":
    await deliver_to_browser([{"system": "상담사 연결 중입니다"}])
    return
elif state["mode"] == "closed":
    await show_outcome(state["outcome"], state.get("callback_at"))
    return
# mode == "ai" 일 때만
answer = await our_ai.respond(text)
```

> 이 분기를 빠뜨리면 고객 화면에서 **AI 와 상담사가 동시에 말한다.**
> 우리 쪽은 DB(`desk.bot_say`)로 막아뒀지만, 앱 AI 는 앱팀만 막을 수 있다.

### 타임아웃 · 재시도

| 호출 | 타임아웃 | 실패 시 |
|---|---|---|
| `import` | 10초 | **재시도해도 안전**(멱등). 3회 지수백오프 후 실패 시 고객에게 "상담사 연결 지연" 안내 |
| `sync` | 10초 | 다음 주기에 재시도. `since_seq` 는 성공했을 때만 전진시킨다 |
| `say` | 10초 | 실패 시 큐에 쌓았다가 재전송. 중복은 우리가 걸러낸다 |

---

## 3. API 4개

Express 가 감싸 제공한다. 내부는 Postgres RPC. **메서드는 아래 각 절 표기를 따른다** — `import`·`say` 는 POST, `sync`·`topics` 는 GET.
**인증**: 앱↔서버 전용 키(`x-desk-app-key`). SHA-256 해시 후 상수시간 비교. 고객 단말이 직접 호출하지 않는다 — 앱 서버가 중계한다.

> **키가 없으면 앱 연동만 잠긴다** (2026-09-04 확정). 운영 환경에서 `DESK_APP_KEY` 가 비어 있으면
> `/api/desk/app/*` 이 **503** `{ok:false,reason:"앱 연동 키가 설정되지 않았습니다"}` 을 반환한다.
> 서버는 정상 부팅하고 CRM·상담사 데스크는 영향받지 않는다.
> → **`DESK_APP_KEY` 는 배포 차단 요소가 아니라 앱 연동의 활성화 조건이다.**

### 3.1 이관 · `desk_import` ★ 가장 중요

앱 AI 가 못 푼 시점에 호출한다.

```jsonc
POST /api/desk/app/import
{
  "external_id": "app-sess-8831",        // ★ 필수. 앱의 세션 ID. 멱등키
  "entry_slug":  "app-product",          // 퍼널. 미지정 시 app-home
  "intent":      "presale",              // presale | cs | claim | etc
  "topic":       "water-purifier",       // 상품 카테고리 slug (§4)
  "phone":       "010-1234-5678",        // CRM 매칭 키
  "name":        "김영수",
  "messages": [                          // AI 대화 전문
    {"sender_type":"customer","body":"정수기 문의","created_at":"2026-09-04T05:18:00Z"},
    {"sender_type":"bot","body":"가구원 수를 알려주세요","created_at":"2026-09-04T05:18:20Z",
     "bot_sources":["cs.faqs#183"]}      // 봇 답변 근거 (있으면 보낸다)
  ],
  "handoff": {
    "reason":     "T1",                  // T1 근거없음 · T2 고객요청 · T3 구매의사 · T4 클레임
    "summary":    "4인 직수형 정수기, 결합할인 문의",
    "collected":  {"가구원":"4인","예산":"월 3만원대"},
    "unanswered": ["기존 KT 인터넷 결합 할인 가능 여부"],   // ★ 이게 사람이 할 일
    "confidence": 0.91
  },
  "context": {"utm_source":"app","ref":"bref-xyz"}   // 유입 추적 (GEO bref 등)
}
→ 200 {"ok":true,"conversation_id":"...","created":true,"messages_added":5,
        "status":"waiting","department":"가전팀","queue_position":1,"crm_matched":true}
```

**규칙**

| # | 규칙 | 이유 |
|---|---|---|
| 1 | `external_id` 는 앱 세션당 고정 | 재전송해도 대화가 늘지 않는다(멱등). 검증: 재전송 시 `created:false, messages_added:0` |
| 2 | `created_at` 은 **원본 시각**을 보낸다 | 이관 시각으로 덮으면 대화 순서가 뭉개진다. 우리는 받은 시각을 그대로 저장한다 |
| 3 | 이미 보낸 메시지를 다시 보내도 된다 | 중복은 우리가 걸러낸다. 증분만 보내도 되고 전체를 보내도 된다 |
| 4 | `bot_sources` 를 보내면 상담사가 근거를 본다 | 봇 환각 사후 추적 |
| 5 | `unanswered` 를 반드시 채운다 | 상담사 화면 최상단에 노란 박스로 뜬다. **비면 사람이 뭘 해야 할지 모른다** |
| 6 | `handoff` 없이 보내면 인계되지 않는다 | 대기열에 안 올라간다. 이력만 쌓고 싶을 때 쓴다 |

**에러**
```
{"ok":false,"reason":"external_id 는 필수입니다 (멱등키)"}
{"ok":false,"reason":"topic 을 정할 수 없습니다. topic 을 보내거나 default_topic 이 있는 entry_slug 를 쓰세요"}
{"ok":false,"reason":"존재하지 않는 topic: xxx"}
```

### 3.2 동기화 · `desk_app_sync`

앱이 주기적으로 호출한다. **권장 주기 3초** (사람 응대 중), 그 외 15초.

```jsonc
GET /api/desk/app/sync?external_id=app-sess-8831&since_seq=0
→ 200 {
  "ok": true,
  "mode": "agent",                  // ★ 아래 표 참조
  "agent_name": "박상담",
  "queue_position": null,
  "outcome": null,
  "callback_at": null,
  "last_seq": 7,                    // 다음 호출에 since_seq 로 넣는다
  "messages": [
    {"seq":5,"sender":"system","body":"상담사 박상담 님이 참여했습니다","at":"..."},
    {"seq":6,"sender":"agent","agent_name":"박상담","body":"결합하시면 월 5,500원 추가 할인됩니다","at":"..."}
  ]
}
```

이관되지 않은 `external_id` 로 조회하면 **404** + `{"ok":false,"reason":"이관되지 않은 대화입니다"}`.

**★ `mode` 가 이 연동의 핵심이다**

| mode | 뜻 | **앱이 해야 할 일** |
|---|---|---|
| `ai` | 아직 앱 AI 담당 | 평소대로 AI 응대 |
| `queued` | 상담사 연결 중 | "상담사 연결 중입니다" 표시. **AI 응대 중지** |
| `agent` | **사람이 응대 중** | **앱 AI 는 절대 말하면 안 된다.** 상담사 답변만 표시 |
| `closed` | 종결됨 | `outcome`·`callback_at` 표시 후 AI 모드 복귀 |

> `mode=agent` 인데 앱 AI 가 말하면 고객 화면에 두 사람이 동시에 말한다.
> 데스크 쪽은 이미 DB 로 막아뒀지만(`desk.bot_say`), **앱 AI 는 앱팀이 막아야 한다.**

**내려가지 않는 것** (우리가 걸러서 보낸다)
- `is_private` 내부 메모 — 상담사끼리만 본다. 검증 완료
- `sender_type='bot'` 메시지 — 앱이 이미 갖고 있으므로 되돌려 보내지 않는다. 검증 완료

### 3.3 고객 발화 전달 · `desk_app_customer_say`

`mode` 가 `queued`·`agent` 일 때 고객이 앱에서 말하면 데스크로 넘긴다.

```jsonc
POST /api/desk/app/say
{"external_id":"app-sess-8831","body":"네 그럼 진행할게요","at":"2026-09-04T05:25:00Z"}
→ 200 {"ok":true,"seq":7,"pii_blocked":false,"mode":"agent"}
```

- `pii_blocked: true` 면 주민번호·카드번호가 감지되어 **저장이 차단**된 것이다.
  앱은 고객에게 "주민번호는 채팅으로 받지 않습니다. 통화에서 확인드립니다" 를 표시한다.
- 종결된 대화에 다시 말하면 **자동으로 재개**된다(`mode` 가 `ai` 로 돌아온다).

### 3.4 토픽 목록 · `desk_topics`

앱이 문의 유형 선택 화면을 그릴 때. 카테고리는 DB 에서 늘어나므로 **하드코딩하지 말 것**.

```jsonc
GET /api/desk/topics?entry=app-home
→ {"entry":{...퍼널 설정...},
   "topics":[{"slug":"water-purifier","name":"정수기","icon":"💧","group":"가전렌탈"}, ...]}
```

---

## 4. 값 정의

**intent (문의 성격) — 고정 4종**

| 값 | 뜻 | 앱 AI 판별 힌트 |
|---|---|---|
| `presale` | 상품문의(구매 전) | 가격·비교·견적·가입 |
| `cs` | 고객센터(개통 후) | 개통현황·배송·설치·청구·해지·AS |
| `claim` | 불만·클레임 | 부정 감정어·환불·반복 문의 → 즉시 이관 |
| `etc` | 미분류 | 신뢰도 미달 시 |

**topic (상품 카테고리) — 가변. `GET /topics` 로 받아 쓴다**
현재 활성 9종: `mobile` `internet_tv` `usedphone` `water-purifier` `air-purifier` `bidet` `mattress` `aircon` `tv`
※ 앞으로 늘어난다(대기 34종). **하드코딩 금지.**

**outcome (종결)**

| 값 | 뜻 | 앱 표시 |
|---|---|---|
| `resolved_chat` | 채팅에서 해결 | "상담이 완료되었습니다" |
| `booked_call` | 통화 예약 | "**{callback_at}** 에 전화드립니다" |
| `booked_visit` | 매장 방문 예약 | 매장 안내 |
| `ticket` | 접수 후 회신 | "접수되었습니다" |

---

## 5. 앱팀 체크리스트

- [ ] `external_id` 를 앱 세션 ID 로 고정했는가 (재시도해도 같은 값)
- [ ] `created_at` 에 **원본 시각**을 넣었는가
- [ ] `handoff.unanswered` 를 채웠는가 — 비면 상담사가 뭘 해야 할지 모른다
- [ ] **`mode=agent` 일 때 앱 AI 응대를 중지**했는가 ← 가장 중요
- [ ] `since_seq` 로 증분만 받는가 (전체 재수신 금지)
- [ ] `pii_blocked` 응답을 고객에게 안내하는가
- [ ] `mode=closed` 후 고객이 다시 말하면 재개되는 것을 처리했는가
- [ ] 토픽 목록을 API 로 받는가 (하드코딩 금지)
- [ ] 앱이 꺼진 상태에서 상담사 답변이 오면 **푸시 알림**을 보내는가 (앱팀 몫)

## 6. 우리 쪽 체크리스트

- [x] 이관 멱등 (재전송 시 대화 안 늘어남)
- [x] 원본 시각·근거 보존
- [x] 내부 메모 앱 미노출
- [x] 봇 메시지 되돌림 방지
- [x] PII(주민번호·카드) 저장 차단
- [x] 종결 → CRM 상담이력 자동 기록
- [x] 콜 예약은 시각 없으면 거부(무단 발신 방지)
- [ ] Express 라우트 래핑 (`server/routes/desk.js`) — 진행 중
- [x] 앱 전용 인증키 게이트 (SHA-256 + 상수시간 비교 · 운영 미설정 시 503)
- [ ] `DESK_APP_KEY` 값 발급 + 앱팀 전달 — **사람이 할 일**
- [x] 이관·보류 (`desk_transfer` 사유 필수 · `desk_snooze` 미래시각 필수) — dev 11/11 검증
- [ ] Express↔RPC 왕복 검증 — **live 적용 또는 dev 키 확보 후 가능**
- [ ] Push 웹훅 (앱이 폴링 못 하는 경우) — 2단계로 미룸

---

## 6.5 배포 순서

| 순서 | 작업 | 담당 | 없으면 |
|---|---|---|---|
| 1 | 마이그레이션 2개를 live 에 적용<br>`2026-09-03-desk-chat.sql` → `2026-09-04-desk-rpc-gateway.sql` | 봉이 (대표 승인 후) | RPC 없음 → 500 |
| 2 | 코드 배포 (`server/routes/desk.js`, `docs/desk.html`) | 봉이 | — |
| 3 | `DESK_APP_KEY` 를 Railway 환경변수에 등록 + 앱팀에 전달 | 봉이 ↔ 앱팀 | 앱 연동만 503. **CRM·데스크는 정상** |
| 4 | 상담사를 부서에 배치 (`incentive_agents.department_id`) | 봉이 운영 | `agent`·`contract` 인박스가 빈다 |
| 5 | 앱팀 FastAPI 연동 | 앱팀 | — |

1↔2 는 순서를 지켜야 하지만, **3 은 나중에 해도 안전하다.**

---

## 7. dev 검증 결과 (2026-09-04)

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | 앱 AI 이력 5건 이관 | 대기열 등록·가전팀 배정·CRM 매칭 ✅ |
| 2 | 동일 `external_id` 재전송 | 대화 1개 유지, 추가 0 ✅ |
| 3 | 증분 이관 | 새 1건만 추가 ✅ |
| 4 | 원본 시각 보존 | 입력 시각과 일치 ✅ |
| 5 | 봇 근거 보존 | `bot_sources` 2건 ✅ |
| 6 | 상담사 답변 → 앱 전달 | `mode=agent` + 답변 수신 ✅ |
| 7 | 내부 메모 앱 미노출 | 차단 ✅ |
| 8 | 사람 응대 중 고객 발화 | 데스크 수신 ✅ |
| 9 | 종결 → CRM 기록 | `outcome`·`callback_at`·상담이력 ✅ |

RPC: `desk_import` · `desk_app_sync` · `desk_app_customer_say` · `desk_topics`
