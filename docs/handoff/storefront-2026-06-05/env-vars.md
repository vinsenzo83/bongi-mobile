# 환경 변수 list

> 실제 값은 별도 안전 채널로 전달 (Slack DM·1Password 등 — 이 md에 직접 작성 금지)

---

## 1. backend (Node Express server)

```
# Supabase
SUPABASE_URL=https://dugaqvvnhsgenhmhuyju.supabase.co     # 라이브
SUPABASE_SERVICE_KEY=eyJxxx...                              # service_role (절대 client 노출 X)
SUPABASE_ANON_KEY=eyJxxx...                                 # 클라이언트 사용 가능

# 데브용 (별도)
SUPABASE_URL_DEV=https://sesgdqbmophgmombelmn.supabase.co
SUPABASE_SERVICE_KEY_DEV=eyJxxx...

# 인증
ADMIN_USERNAME=admin                # basic auth (legacy 보조)
ADMIN_PASSWORD=xxx                  # basic auth

# 호스트
PORT=3001                           # 로컬 dev
NODE_ENV=production
RAILWAY_ENVIRONMENT=production      # Railway 빌드 시 자동

# 외부 API (옵션)
ANTHROPIC_API_KEY=sk-ant-xxx        # AI 자동 채움·향후 어시스턴트
CONTIPLE_API_KEY=...                # CTI (미연동 — placeholder)
```

---

## 2. frontend (Vite/React 예시)

```
VITE_API_BASE_URL=https://admin.prexymarket.com/api    # 라이브
VITE_SUPABASE_URL=https://dugaqvvnhsgenhmhuyju.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...                       # 익명 가능 (RLS로 보호)
```

---

## 3. Railway 배포

- master push → 라이브 자동 빌드
- develop push → 데브 자동 빌드
- 환경 변수는 Railway dashboard에서 set (.env 파일은 git에 X)

---

## 4. 보안 룰

- service_role 키는 server only (절대 frontend bundle에 X)
- RLS 활성화된 테이블은 anon으로 직접 접근 차단 (`profiles`·`auth.users` 등)
- 새 테이블 만들 때 RLS 정책 사전 점검 (이전 사고: 2026-05-12 일괄 활성화로 로그인 장애)
- 이메일·전화는 마스킹 (`010-1***-****`) 어드민에서 노출 가능, storefront에서 본인 정보만
