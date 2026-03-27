// 회원 등급 서비스
import { supabase } from '../db/supabase.js';

const MEMBER_TIERS = [
  { id: 'normal', label: '일반',   min: 0, max: 0 },
  { id: 'bronze', label: '브론즈', min: 1, max: 2 },
  { id: 'silver', label: '실버',   min: 3, max: 9 },
  { id: 'gold',   label: '골드',   min: 10, max: 999 },
];

// 계약 건수 기반 등급 계산
export function computeTier(totalConversions) {
  const tier = MEMBER_TIERS.find(t => totalConversions >= t.min && totalConversions <= t.max);
  return tier ? tier.id : 'normal';
}

export function getTierLabel(tierId) {
  const tier = MEMBER_TIERS.find(t => t.id === tierId);
  return tier ? tier.label : '일반';
}

export { MEMBER_TIERS };

// 등급별 보상 금액 조회
export async function getRewardAmount(tier, rewardType, recipientType) {
  if (!supabase) return 0;

  const { data } = await supabase
    .from('bongi_reward_policy')
    .select('amount')
    .eq('tier', tier)
    .eq('reward_type', rewardType)
    .eq('recipient_type', recipientType)
    .single();

  return data?.amount || 0;
}

// 등급별 전체 보상 정책 조회
export async function getTierRewardPolicy(tier) {
  if (!supabase) return null;

  const { data } = await supabase
    .from('bongi_reward_policy')
    .select('reward_type, recipient_type, amount')
    .eq('tier', tier);

  if (!data) return null;

  return {
    signup: {
      referrer: data.find(d => d.reward_type === 'signup' && d.recipient_type === 'referrer')?.amount || 0,
    },
    contract: {
      referrer: data.find(d => d.reward_type === 'contract' && d.recipient_type === 'referrer')?.amount || 0,
      referred: data.find(d => d.reward_type === 'contract' && d.recipient_type === 'referred')?.amount || 0,
    },
  };
}

// 자동 승급: total_conversions 증가 + 등급 재계산
export async function incrementConversions(userId) {
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from('bongi_user_profiles')
    .select('member_tier, total_conversions')
    .eq('id', userId)
    .single();

  if (!profile) return null;

  const newCount = profile.total_conversions + 1;
  const newTier = computeTier(newCount);
  const promoted = newTier !== profile.member_tier;

  await supabase
    .from('bongi_user_profiles')
    .update({
      total_conversions: newCount,
      member_tier: newTier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return { newCount, newTier, promoted, previousTier: profile.member_tier };
}
