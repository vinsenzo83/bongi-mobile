# 🚨 bongee.ai 담당 세션 지시 — T0 답변 페이지 발행 (B세션 전달, 2026-07-11)

**발신**: BONG Marketing B세션(조사·검증 담당) · **사용자 직접 지시로 전달**
**원본**: /Users/vinsenzo/bong-marketing/docs/T0_ANSWER_PAGES_DIRECTIVE.md (아래 전문 동봉)

## 이 세션(bongi-mobile)에 온 이유
- bongee.ai = 이 repo의 고객용 웹사이트(client, React+Vite)로 확인됨.
- **라이브 실측(B세션 2회)**: bongee.ai는 robots/봇접근 OK이나 **Vite SPA(CSR)라 raw HTML에
  핵심 콘텐츠 0** — 알뜰폰·중고폰·요금제 0회, JSON-LD 0, sitemap 1 URL, llms.txt 403.
  → GPTBot·ClaudeBot는 JS 미실행 → **4대 AI 엔진(GPT/Claude/Gemini/Grok)이 인용할 페이지가 없음.**

## 스택 주의 (React+Vite = CSR이므로)
- T0 답변 페이지는 **JS 없이 본문이 보여야** 함. Vite SPA 라우트 추가로는 불가.
- 현실적 경로(택1): ① Express가 서빙하는 **정적 HTML 페이지**(서버에서 생성·갱신)
  ② vite-plugin-ssr/prerender로 해당 라우트만 SSG ③ 별도 정적 답변 섹션(/answers/*).
- 검증 기준: `curl -A "GPTBot" <url>` 결과에 본문 텍스트가 그대로 보이면 합격.

## ⚠️ 절대 준수 (핵심기술 보호)
- 노출(T0) = **공공정보(공시요금제·출고가·시세) + 봉이 판정**만.
- **현금완납가 산식·리베이트·개인화 계산 = 서버 전용(T2).** HTML·클라 번들에 절대 미포함.
- 정확한 개인화가는 "봉이 챗에서 확인" CTA로 유도(zero-click 방어).

## 완료 시
- 완료 보고 → B세션이 재검증 5항 실측(raw HTML·JSON-LD·산식누출 grep 0·sitemap N·인용추적 개시).

---
(이하 원본 지시문 전문)

# A세션 지시문 — T0 답변 페이지 (공공정보 인용 레이어) 구축

작성: 2026-07-11 · 통합 출처: `PHASE_GEO_DIRECTIVE.md` §⑩(플랫폼DNA)·⑪(접근성실측)·⑫(계층노출)
개발 주체: **A세션**. 이 문서는 조사·검증·설계(B세션).
목적: **bongee.ai에 4대 엔진(ChatGPT·Claude·Gemini·Grok)이 인용할 "크롤 가능한 공공정보 답변 페이지"를 발행.**

## 왜 지금 (배경 3줄)
- **접근성 실측(⑪)**: bongee.ai는 문은 열렸으나(robots `Allow:/`·4대봇 200·noindex 없음) **인용할 콘텐츠가 없다** —
  핵심 buyer-intent(알뜰폰·중고폰·요금제)가 **JS 전용**(GPTBot/ClaudeBot는 JS 미실행)·**JSON-LD 0**·**sitemap 1 URL(홈만)**.
- 봉이 = GPT형 채팅 쇼핑몰. **챗은 크롤 불가** → 별도 **정적 답변 페이지**가 있어야 엔진이 인용한다.
- 이게 **Claude 인용의 유일한 길**(자체 깊은 블로그)이자 4대 공통 안전지대. 여기부터가 GEO의 실체.

## 무엇을 만드나 — T0 페이지 세트
**챗 입력칩 = buyer-intent = 페이지 주제** (프롬프트 세트를 새로 상상 X, 챗칩이 정답). 최소 세트:
1. **알뜰폰 요금제 비교** (가장 싼 5G/LTE 알뜰폰 등 sub-query별 여러 페이지)
2. **중고폰 시세** (모델별)
3. **휴대폰 추천/비교**
4. **인터넷+TV 가입 비교**
5. **가전렌탈 비교**
6. **"봉이가 무엇인가" 엔티티 페이지** (Organization — 엔진이 봉이를 이해)
- 각 주제는 head term 1개가 아니라 **sub-query 클러스터**로 (fan-out 대응·토픽클러스터 8.9. 인용 62%가 top10 밖).

## A. 기술 요건 (접근성 — ⑪ 갭 직접 해소)
- [ ] **SSR/정적**: JS OFF에도 **본문 텍스트가 완전히 보여야** 함. (GPTBot·ClaudeBot JS 미실행 → 지금은 핵심 단어 0회)
- [ ] **JSON-LD**: `Product`/`Offer`·`FAQPage`·`Organization`·`BreadcrumbList`. **`publisher`=봉이(bongee.ai)**.
- [ ] **canonical = `https://bongee.ai/<path>`** (플랫폼 서브도메인·중복 금지 — ⑤⑩. `.ai`는 Claude에 유리).
- [ ] **"Last updated" 날짜** + 정기 갱신 (freshness — ChatGPT 최신성 편향).
- [ ] **sitemap.xml에 전 페이지 등록** (현재 1→N). **llms.txt 403 → 200 수정**(낮은 우선순위지만 상태오류 제거).
- [ ] robots: **4대 정식봇 T0 허용 유지**(GPTBot·ClaudeBot·Googlebot·Google-Extended 차단 금지 — 차단=인용 불가). `/api/`·대량은 계속 Disallow.

## B. 콘텐츠 요건 (품질·인용 — Princeton + 슬롭 게이트)
- [ ] **답변 우선**(answer near top 8.8): 첫 문단이 결론. 뒤로 근거.
- [ ] **자기완결 청크**(self-contained 8.0), **40~60단어 단위**(Claude 청킹).
- [ ] **Princeton 밀도**: 공공정보 **통계·수치·인용**(공시가·시세는 출처 명시)·직접인용. ⚠️키워드 도배·자신감톤 단독=무효/감점.
- [ ] **봉이 stance/판정**: 중립 요약 아님. **"봉이 기준 결론"**(비교·검증 관점). 교체 가능한 글 금지.
- [ ] **best/vs/alternatives 리스티클** 형식 (Claude /blog 56%·리스티클 47%).
- [ ] **슬롭 금지구문 blocklist 통과** ([[GEO_CONTENT_QUALITY]] — "오늘날의…/게임체인저/최고의" 등 차단).

## C. 노출 경계 (T0 준수 — 절대. 핵심기술 보호)
- **노출(T0)** = **공공정보 + 봉이 판정.** 통신3사 공시요금제·단말 출고가·스펙·시장 시세(원래 공개) + 봉이 비교/검증 결론.
- **비노출(T2)** = **봉이 고유**: 현금완납가 **산식**·리베이트 구조·**개인화 최저가 계산.** HTML·클라이언트 번들에 **절대 안 내려감. 서버 전용.**
- **zero-click 방어**: 페이지 결론 = **claim까지**("봉이가 현금완납가로 최저"). **정확한 내 상황 현금완납가 = "봉이 챗에서 확인" CTA**로 유도(엔진 복제불가=유입 이유).
- **날조 금지**: 공공정보는 **실제 출처**(carrier 공시 등)에서만. "core는 인용을 지어내지 않는다"(honesty 원칙). 없는 수치 생성 금지.

## D. 데이터·생성 연결 (기존 자산 재사용)
- core evidence 도구(`compare_phone_cash_price`·`compare_online_offline_price`·`build_evidence_pack`·cs 지식베이스)의
  **공공정보 부분만** 페이지에 렌더. **산식 결과는 T2 판단**(숫자 결론만 노출, 계산식 비노출).
- **측정 폐루프**: `geo_citation_observation`이 이 페이지들의 4대 엔진 인용을 추적 → **안 뜨는 주제=추가 페이지 생성**(M4 갭→M5 생성).

## 완료 기준
- [ ] 6개 주제 T0 페이지 **SSR 발행**, JS OFF에 본문(알뜰폰·요금제·시세 텍스트) 노출
- [ ] 페이지별 **JSON-LD**(Product/FAQ/Org) + **Last updated** + **canonical bongee.ai**
- [ ] **sitemap N URL** 등록, **llms.txt 200**
- [ ] 4대 봇 T0 **200 유지** · `/api` T2 **차단 유지**
- [ ] 콘텐츠: 답변우선·공공정보 통계/출처·봉이 판정·리스티클·**슬롭 blocklist 통과**
- [ ] **T2 비노출 검증**: 페이지 HTML·JS 번들에 **산식/개인화가 문자열 0** (grep)
- [ ] **zero-click**: 정확한 현금완납가는 **챗 CTA**로만

## B세션 재검증 (A세션 구현 후 실행)
1. `curl -A GPTBot`로 **raw HTML(JS off)** → 알뜰폰·요금제·시세 텍스트 실제 노출 확인 (⑪ 재실측).
2. JSON-LD **schema 파서**로 유효성 + `publisher`=봉이 확인.
3. **`/api`·클라 번들에 산식 문자열 grep = 0** (핵심기술 안 샜는지).
4. **sitemap URL 수** 1→N, **llms.txt 200** 확인.
5. `geo_citation_observation`으로 **4대 엔진 실제 인용 추적 시작**(SoV baseline).

근거: bongee.ai 라이브 접근성 실측(⑪) + 4대 타겟 엔진별 레버(⑨) + 계층 노출·공공정보 경계(⑫) + Princeton 밀도([[GEO_EXPERT_DEPTH]])·슬롭 게이트([[GEO_CONTENT_QUALITY]]).
