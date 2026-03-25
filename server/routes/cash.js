import { Router } from 'express';
import { supabase } from '../db/supabase.js';

const router = Router();

const WITHDRAWAL_POLICY = {
  minAmount: 30000,
  fee: 0,
  processingDays: '1~2',
};

const BANKS = [
  '신한은행', '국민은행', 'NH농협은행', '우리은행', '하나은행',
  'IBK기업은행', 'SC제일은행', '카카오뱅크', '토스뱅크', '케이뱅크',
  '광주은행', '전북은행', '새마을금고', '신협', '우체국',
];

// GET /api/cash/balance — 내 리턴캐쉬 잔액
router.get('/balance', async (req, res) => {
  try {
    if (!supabase || !req.user) {
      return res.json({ balance: 0 });
    }

    const { data } = await supabase
      .from('bongi_cash_balance')
      .select('balance, updated_at')
      .eq('user_id', req.user.id)
      .single();

    return res.json({
      balance: data?.balance || 0,
      updated_at: data?.updated_at || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cash/history — 적립/출금 내역 (페이징)
router.get('/history', async (req, res) => {
  try {
    if (!supabase || !req.user) {
      return res.json({ history: [], total: 0 });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('bongi_cash_history')
      .select('*', { count: 'exact' })
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      history: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cash/withdraw — 출금 신청
router.post('/withdraw', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: 'DB 연결 필요' });
    }

    if (!req.user) {
      return res.status(401).json({ error: '출금 신청은 로그인이 필요합니다.' });
    }

    const { bank_name, account_number, account_holder, amount } = req.body;

    // 입력 검증
    if (!bank_name || !BANKS.includes(bank_name)) {
      return res.status(400).json({ error: '올바른 은행을 선택해주세요.' });
    }
    if (!account_number || account_number.trim().length < 8) {
      return res.status(400).json({ error: '올바른 계좌번호를 입력해주세요.' });
    }
    if (!account_holder || account_holder.trim().length < 2) {
      return res.status(400).json({ error: '예금주명을 입력해주세요.' });
    }

    const withdrawAmount = parseInt(amount);
    if (!withdrawAmount || withdrawAmount < WITHDRAWAL_POLICY.minAmount) {
      return res.status(400).json({
        error: `최소 출금 금액은 ${WITHDRAWAL_POLICY.minAmount.toLocaleString()}원입니다.`,
      });
    }

    // 출금 자격 확인: 1회 이상 계약 완료 고객만
    const hasContract = await checkWithdrawalEligibility(req.user.id);
    if (!hasContract) {
      return res.status(400).json({
        error: '출금은 1회 이상 계약을 완료한 고객만 가능합니다. 상담을 통해 계약을 진행해주세요!',
      });
    }

    // 잔액 확인
    const { data: balanceData } = await supabase
      .from('bongi_cash_balance')
      .select('balance')
      .eq('user_id', req.user.id)
      .single();

    const currentBalance = balanceData?.balance || 0;
    if (currentBalance < withdrawAmount) {
      return res.status(400).json({ error: '잔액이 부족합니다.' });
    }

    // 출금 신청 생성
    const { data: withdrawal, error: withdrawError } = await supabase
      .from('bongi_withdrawals')
      .insert({
        user_id: req.user.id,
        amount: withdrawAmount,
        bank_name,
        account_number: account_number.trim(),
        account_holder: account_holder.trim(),
        status: 'pending',
      })
      .select()
      .single();

    if (withdrawError) {
      return res.status(500).json({ error: withdrawError.message });
    }

    // 캐쉬 내역에 출금 기록 추가
    await supabase.from('bongi_cash_history').insert({
      user_id: req.user.id,
      type: 'withdraw',
      amount: withdrawAmount,
      description: `출금 신청 (${bank_name} ${account_number.trim().slice(-4)})`,
      status: 'pending',
    });

    // 잔액 차감
    await supabase
      .from('bongi_cash_balance')
      .update({
        balance: currentBalance - withdrawAmount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', req.user.id);

    return res.status(201).json({
      withdrawal_id: withdrawal.id,
      amount: withdrawAmount,
      status: 'pending',
      message: `${withdrawAmount.toLocaleString()}원 출금 신청이 접수되었습니다. 영업일 기준 ${WITHDRAWAL_POLICY.processingDays}일 내 처리됩니다.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cash/banks — 은행 목록
router.get('/banks', (_req, res) => {
  res.json({ banks: BANKS });
});

// GET /api/cash/policy — 출금 정책
router.get('/policy', (_req, res) => {
  res.json(WITHDRAWAL_POLICY);
});

// 출금 자격 확인: referral contracted/rewarded 또는 contracts completed
async function checkWithdrawalEligibility(userId) {
  // 1) bongi_referrals에서 계약 완료 건 확인 (referrer_code 기반)
  const { data: profile } = await supabase
    .from('bongi_user_profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!profile) return false;

  // bongi_referrals: 해당 유저가 추천인으로서 계약 완료 건 확인
  const { data: referrals } = await supabase
    .from('bongi_referrals')
    .select('id')
    .eq('referrer_user_id', userId)
    .in('status', ['contracted', 'rewarded'])
    .limit(1);

  if (referrals && referrals.length > 0) return true;

  // 2) bongi_contracts에서 completed 건 확인 (테이블이 존재하는 경우)
  try {
    const { data: contracts } = await supabase
      .from('bongi_contracts')
      .select('id')
      .eq('customer_id', userId)
      .eq('status', 'completed')
      .limit(1);

    if (contracts && contracts.length > 0) return true;
  } catch {
    // bongi_contracts 테이블이 없을 수 있음
  }

  return false;
}

export default router;
