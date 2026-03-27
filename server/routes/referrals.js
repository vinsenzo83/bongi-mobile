import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { optionalAuth } from '../middleware/auth.js';
import { getTierRewardPolicy, incrementConversions } from '../services/dealer-tier.js';

const router = Router();

// 폴백: DB 조회 실패 시 기본 보상 (normal/bronze 기준)
const FALLBACK_POLICY = {
  signup: { referrer: 3000 },
  contract: { referrer: 12000, referred: 5000 },
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `RETURN_${code}`;
}

// 추천인의 등급별 보상 정책 조회
async function getReferrerRewardPolicy(referrerCode) {
  if (!supabase) return { policy: FALLBACK_POLICY, tier: 'normal' };

  // 추천 코드로 추천인 user_id 찾기
  const { data: referral } = await supabase
    .from('bongi_referrals')
    .select('referrer_user_id')
    .eq('referrer_code', referrerCode)
    .limit(1)
    .maybeSingle();

  if (!referral?.referrer_user_id) {
    return { policy: FALLBACK_POLICY, tier: 'normal' };
  }

  // 추천인 등급 조회
  const { data: profile } = await supabase
    .from('bongi_user_profiles')
    .select('member_tier')
    .eq('id', referral.referrer_user_id)
    .single();

  const tier = profile?.member_tier || 'normal';
  const policy = await getTierRewardPolicy(tier);

  return { policy: policy || FALLBACK_POLICY, tier };
}

// GET /api/referrals/my-code — 내 추천 코드 생성/조회
router.get('/my-code', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'DB 연결 필요' });

    const { code } = req.query;

    if (code) {
      const { data } = await supabase
        .from('bongi_referrals')
        .select('referrer_code')
        .eq('referrer_code', code)
        .limit(1);

      if (data && data.length > 0) {
        return res.json({ code });
      }
    }

    let newCode = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const { data: existing } = await supabase
        .from('bongi_referrals')
        .select('referrer_code')
        .eq('referrer_code', newCode)
        .limit(1);

      if (!existing || existing.length === 0) break;
      newCode = generateCode();
      attempts++;
    }

    return res.json({ code: newCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referrals/stats — 내 추천 실적 (보상 + 등급 포함)
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'DB 연결 필요' });

    const { code } = req.query;
    if (!code) return res.status(400).json({ error: '추천 코드가 필요합니다.' });

    const { data: referrals, error } = await supabase
      .from('bongi_referrals')
      .select('*')
      .eq('referrer_code', code)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const list = referrals || [];
    const referralIds = list.map(r => r.id);

    let rewards = [];
    if (referralIds.length > 0) {
      const { data: rewardData } = await supabase
        .from('bongi_rewards')
        .select('*')
        .in('referral_id', referralIds);
      rewards = rewardData || [];
    }

    const total_invited = list.length;
    const registered = list.filter(r => r.status === 'registered').length;
    const contracted = list.filter(r =>
      r.status === 'contracted' || r.status === 'rewarded'
    ).length;

    const paidRewards = rewards.filter(r => r.status === 'paid' && r.recipient_type === 'referrer');
    const pendingRewards = rewards.filter(r => r.status === 'pending' && r.recipient_type === 'referrer');

    const total_earned = paidRewards.reduce((s, r) => s + r.amount, 0);
    const pending = pendingRewards.reduce((s, r) => s + r.amount, 0);

    // 추천인 등급 정보
    const { tier } = await getReferrerRewardPolicy(code);

    res.json({
      code,
      tier,
      total_invited,
      registered,
      contracted,
      total_earned,
      pending,
      referrals: list,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrals/register — 추천 코드로 친구 등록 (가입 보상)
router.post('/register', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'DB 연결 필요' });

    const { referrer_code, referred_name, referred_phone } = req.body;

    if (!referrer_code) {
      return res.status(400).json({ error: '추천 코드가 필요합니다.' });
    }
    if (!referred_name || !referred_phone) {
      return res.status(400).json({ error: '이름과 연락처를 입력해주세요.' });
    }

    // 사기 방지: 동일 전화번호 중복 등록 방지
    const { data: existing } = await supabase
      .from('bongi_referrals')
      .select('id')
      .eq('referred_phone', referred_phone)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({ error: '이미 등록된 번호입니다.' });
    }

    // 사기 방지: 자가추천 방지
    const { data: referrerRows } = await supabase
      .from('bongi_referrals')
      .select('referrer_phone')
      .eq('referrer_code', referrer_code)
      .limit(1);

    if (referrerRows && referrerRows.length > 0) {
      const referrerPhone = referrerRows[0].referrer_phone;
      if (referrerPhone && referrerPhone === referred_phone) {
        return res.status(400).json({ error: '본인 추천은 불가합니다.' });
      }
    }

    // 추천인 등급별 보상 정책 조회
    const { policy, tier } = await getReferrerRewardPolicy(referrer_code);

    // referral 레코드 생성
    const { data: referral, error } = await supabase
      .from('bongi_referrals')
      .insert({
        referrer_code,
        referred_name,
        referred_phone,
        status: 'registered',
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // 가입 보상: 추천인에게 즉시 지급
    const signupAmount = policy.signup.referrer;
    const { error: rewardErr } = await supabase
      .from('bongi_rewards')
      .insert({
        referral_id: referral.id,
        recipient_type: 'referrer',
        reward_type: 'signup',
        amount: signupAmount,
        status: 'pending',
      });

    if (rewardErr) {
      console.error('Reward insert error:', rewardErr.message);
    }

    res.status(201).json({
      referral_id: referral.id,
      status: referral.status,
      tier,
      rewards: {
        referrer_signup_bonus: signupAmount,
        referrer_contract_bonus: policy.contract.referrer,
        referred_contract_bonus: policy.contract.referred,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/referrals/convert — 계약 완료 처리 (계약 보상 + 자동 승급)
router.post('/convert', optionalAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'DB 연결 필요' });

    const { referral_id } = req.body;
    if (!referral_id) {
      return res.status(400).json({ error: 'referral_id가 필요합니다.' });
    }

    const { data: referral } = await supabase
      .from('bongi_referrals')
      .select('*')
      .eq('id', referral_id)
      .single();

    if (!referral) {
      return res.status(404).json({ error: '추천 기록을 찾을 수 없습니다.' });
    }

    if (referral.status === 'contracted' || referral.status === 'rewarded') {
      return res.status(409).json({ error: '이미 계약 완료 처리된 건입니다.' });
    }

    // 추천인 등급별 보상 정책 조회
    const { policy, tier } = await getReferrerRewardPolicy(referral.referrer_code);

    // 상태 변경
    await supabase
      .from('bongi_referrals')
      .update({ status: 'contracted' })
      .eq('id', referral_id);

    // 계약 보상: 추천인 + 피추천인
    const { error: rewardErr } = await supabase
      .from('bongi_rewards')
      .insert([
        {
          referral_id,
          recipient_type: 'referrer',
          reward_type: 'contract',
          amount: policy.contract.referrer,
          status: 'pending',
        },
        {
          referral_id,
          recipient_type: 'referred',
          reward_type: 'contract',
          amount: policy.contract.referred,
          status: 'pending',
        },
      ]);

    if (rewardErr) {
      console.error('Contract reward insert error:', rewardErr.message);
    }

    // 자동 승급: 추천인의 계약 건수 증가 + 등급 재계산
    let promotion = null;
    const { data: refRow } = await supabase
      .from('bongi_referrals')
      .select('referrer_user_id')
      .eq('referrer_code', referral.referrer_code)
      .limit(1)
      .maybeSingle();

    if (refRow?.referrer_user_id) {
      promotion = await incrementConversions(refRow.referrer_user_id);
    }

    res.json({
      referral_id,
      status: 'contracted',
      tier,
      rewards: {
        referrer_contract_bonus: policy.contract.referrer,
        referred_contract_bonus: policy.contract.referred,
      },
      promotion,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/referrals/reward-policy — 전체 등급별 보상 정책 조회
router.get('/reward-policy', async (_req, res) => {
  try {
    if (!supabase) return res.status(503).json({ error: 'DB 연결 필요' });

    const { data, error } = await supabase
      .from('bongi_reward_policy')
      .select('tier, reward_type, recipient_type, amount')
      .order('tier');

    if (error) return res.status(500).json({ error: error.message });

    const tiers = ['normal', 'bronze', 'silver', 'gold'];
    const labels = { normal: '일반', bronze: '브론즈', silver: '실버', gold: '골드' };
    const ranges = { normal: '0건', bronze: '1-2건', silver: '3-9건', gold: '10건+' };

    const policy = tiers.map(tier => {
      const rows = (data || []).filter(d => d.tier === tier);
      return {
        tier,
        label: labels[tier],
        range: ranges[tier],
        signup_referrer: rows.find(r => r.reward_type === 'signup' && r.recipient_type === 'referrer')?.amount || 0,
        contract_referrer: rows.find(r => r.reward_type === 'contract' && r.recipient_type === 'referrer')?.amount || 0,
        contract_referred: rows.find(r => r.reward_type === 'contract' && r.recipient_type === 'referred')?.amount || 0,
      };
    });

    res.json({ policy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
