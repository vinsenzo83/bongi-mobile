import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

if (!supabase) {
  console.warn('⚠ Supabase 미설정 — 로컬 데이터로 동작합니다');
} else {
  console.log('✅ Supabase 연결됨');
}

// ── 사용자 로그인 전용 일회용 클라이언트 ─────────────────────────────
//   supabase.auth.signInWithPassword() 를 위 공유 클라이언트에서 호출하면
//   그 세션이 클라이언트에 눌러붙어, 이후 서버의 모든 DB 질의가
//   service_role 이 아니라 "마지막에 로그인한 사람" 자격으로 나간다.
//   → RLS 가 그 사람 기준으로 걸려 다른 사람 데이터가 통째로 안 보인다.
//   로그인·가입·세션갱신은 반드시 이 일회용 클라이언트로 한다.
export function authClient() {
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !key) return null;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
