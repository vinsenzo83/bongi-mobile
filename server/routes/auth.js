import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = Router();

// 회원가입
router.post('/signup', authLimiter, async (req, res) => {
  const { email, password, name, phone, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호는 필수입니다' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name || email.split('@')[0], role: role || 'customer' },
      },
    });

    if (error) return res.status(400).json({ error: error.message });
    if (!data.user) return res.status(400).json({ error: '회원가입 실패' });

    // FIX #2: 프로필 생성 에러 핸들링
    const { error: profileError } = await supabase.from('bongi_user_profiles').insert({
      id: data.user.id,
      role: role || 'customer',
      display_name: name || email.split('@')[0],
      phone: phone || null,
    });

    if (profileError) {
      console.error('프로필 생성 실패:', profileError.message);
      // 사용자는 생성됐으나 프로필 실패 — 다음 로그인 시 자동 생성 필요
    }

    res.status(201).json({
      user: { id: data.user.id, email: data.user.email, role: role || 'customer' },
      session: data.session ? { access_token: data.session.access_token } : null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 로그인
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });

    // FIX #5: 프로필 존재 확인 + 자동 생성
    let { data: profile } = await supabase
      .from('bongi_user_profiles')
      .select('role, display_name, agent_id, store_id')
      .eq('id', data.user.id)
      .single();

    if (!profile) {
      // 프로필 없으면 자동 생성 (signup에서 실패했을 경우 복구)
      const meta = data.user.user_metadata || {};
      await supabase.from('bongi_user_profiles').insert({
        id: data.user.id,
        role: meta.role || 'customer',
        display_name: meta.display_name || data.user.email.split('@')[0],
      });
      profile = { role: meta.role || 'customer', display_name: meta.display_name, agent_id: null, store_id: null };
    }

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profile.role,
        displayName: profile.display_name,
        agentId: profile.agent_id,
        storeId: profile.store_id,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 소셜 로그인 후 프로필 확인/생성
router.post('/social-profile', authenticateJWT, async (req, res) => {
  try {
    const { name, avatar } = req.body;

    // 프로필 존재 확인
    const { data: existing } = await supabase
      .from('bongi_user_profiles')
      .select('id')
      .eq('id', req.user.id)
      .single();

    if (!existing) {
      // 프로필 생성
      const { error: insertError } = await supabase
        .from('bongi_user_profiles')
        .insert({
          id: req.user.id,
          role: 'customer',
          display_name: name || req.user.email?.split('@')[0] || 'User',
          avatar_url: avatar || null,
        });

      if (insertError) {
        console.error('소셜 프로필 생성 실패:', insertError.message);
        return res.status(500).json({ error: '프로필 생성 실패' });
      }
    } else if (avatar) {
      // 기존 프로필에 아바타 업데이트 (없는 경우만)
      await supabase
        .from('bongi_user_profiles')
        .update({ avatar_url: avatar })
        .eq('id', req.user.id)
        .is('avatar_url', null);
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FIX #1: /me 엔드포인트 — authenticateJWT 미들웨어 사용
router.get('/me', authenticateJWT, (req, res) => {
  res.json({ user: req.user });
});

export default router;
