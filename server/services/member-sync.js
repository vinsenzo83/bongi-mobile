/**
 * 회원 데이터 동기화 서비스
 * 전화번호 = 핵심 키로 모든 테이블 동기화
 *
 * 동기화 대상:
 * - bongi_user_profiles (마스터)
 * - bongi_applications (신청)
 * - bongi_gifts (사은품)
 * - bongi_withdrawals (출금)
 * - bongi_reviews (후기)
 * - bongi_notifications (알림)
 */

import { supabase } from '../db/supabase.js';

/**
 * 회원 프로필 변경 시 관련 테이블 동기화
 * @param {string} phone - 전화번호 (핵심 키)
 * @param {object} updates - 변경된 필드 { user_type, display_name, ... }
 */
export async function syncMemberData(phone, updates) {
  if (!phone || !supabase) return;

  const tasks = [];

  // 1. 신청현황 동기화 (user_type, name)
  if (updates.user_type || updates.display_name) {
    const appUpdate = {};
    if (updates.user_type) appUpdate.user_type = updates.user_type;
    if (updates.display_name) appUpdate.name = updates.display_name;
    tasks.push(
      supabase.from('bongi_applications').update(appUpdate).eq('phone', phone)
        .then(() => console.log(`✅ 신청현황 동기화: ${phone}`))
        .catch(e => console.warn(`⚠️ 신청현황 동기화 실패: ${e.message}`))
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * 비회원 → 앱회원 전환 시 전체 동기화
 * @param {string} phone - 전화번호
 * @param {string} userId - 신규 user_id (소셜 로그인 후)
 */
export async function syncMemberConversion(phone, userId) {
  if (!phone || !supabase) return;

  console.log(`🔄 비회원→앱회원 전환 동기화: ${phone} → ${userId}`);

  // 1. 신청현황 user_type 업데이트
  await supabase.from('bongi_applications')
    .update({ user_type: '앱회원' })
    .eq('phone', phone);

  // 2. 사은품 customer_id 연결
  await supabase.from('bongi_gifts')
    .update({ customer_id: userId })
    .eq('customer_id', null)
    .then(() => {})
    .catch(() => {});

  console.log(`✅ 전환 동기화 완료: ${phone}`);
}

/**
 * PASS 인증 완료 시 이름 자동 수정 동기화
 * 우선순위: PASS 실명 > 카카오 실명 > 구글 입력 > 셀프신청 > CRM
 * @param {string} phone - 전화번호
 * @param {object} passData - { name, birth, gender, carrier, ci }
 */
export async function syncPassVerification(phone, passData) {
  if (!phone || !supabase) return;

  console.log(`🔐 PASS 인증 동기화: ${phone} → ${passData.name}`);

  // 1. user_profiles 업데이트
  const profileUpdate = {
    verified_at: new Date().toISOString(),
    carrier: passData.carrier,
  };
  if (passData.name) profileUpdate.display_name = passData.name;
  if (passData.birth) profileUpdate.birth_date = passData.birth;
  if (passData.gender) profileUpdate.gender = passData.gender;
  if (passData.ci) profileUpdate.ci = passData.ci;

  await supabase.from('bongi_user_profiles')
    .update(profileUpdate)
    .eq('phone', phone);

  // 2. 신청현황 이름 동기화
  if (passData.name) {
    await supabase.from('bongi_applications')
      .update({ name: passData.name })
      .eq('phone', phone);
  }

  console.log(`✅ PASS 인증 동기화 완료: ${phone}`);
}

/**
 * 전체 회원 데이터 일괄 동기화 (어드민에서 수동 실행)
 */
export async function syncAllMembers() {
  if (!supabase) return { error: 'DB 연결 없음' };

  const { data: profiles } = await supabase.from('bongi_user_profiles').select('phone, user_type, display_name');
  if (!profiles) return { synced: 0 };

  let synced = 0;
  for (const p of profiles) {
    if (!p.phone) continue;
    await supabase.from('bongi_applications')
      .update({ user_type: p.user_type, name: p.display_name })
      .eq('phone', p.phone);
    synced++;
  }

  return { synced, total: profiles.length };
}
