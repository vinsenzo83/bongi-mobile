import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { optionalAuth } from '../middleware/auth.js';

const router = Router();

const REWARD_POLICY = {
  signup: { referrer: 2000 },
  contract: { referrer: 20000, referred: 10000 },
};

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `RETURN_${code}`;
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

// GET /api/referrals/stats — 내 추천 실적 (보상 포함)
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

    res.json({
      code,
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

// POST /api/referrals/register — 추천 코드로 친구 등록 (1단계 보상)
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

    // 사기 방지: 자가추천 방지 (추천인 코드의 phone과 비교)
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

    // 1단계 보상: 추천인 가입 보너스
    const { error: rewardErr } = await supabase
      .from('bongi_rewards')
      .insert({
        referral_id: referral.id,
        recipient_type: 'referrer',
        reward_type: 'signup',
        amount: REWARD_POLICY.signup.referrer,
        status: 'pending',
      });

    if (rewardErr) {
      console.error('Reward insert error:', rewardErr.message);
    }

    res.status(201).json({
      referral_id: referral.id,
      status: referral.status,
      rewards: {
        referrer_signup_bonus: REWARD_POLICY.signup.referrer,
        referrer_contract_bonus: REWARD_POLICY.contract.referrer,
        referred_contract_bonus: REWARD_POLICY.contract.referred,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
