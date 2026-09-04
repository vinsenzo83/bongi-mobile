import { Router } from 'express';
import { supabase, authClient } from '../db/supabase.js';
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
    const { data, error } = await authClient().auth.signUp({
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
  const { email, password, totp_code } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요' });
  }

  try {
    const { data, error } = await authClient().auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });

    // 🆕 2FA — incentive_agents에 totp_enabled=true면 totp_code 검증
    {
      const { data: agentRow } = await supabase
        .from('incentive_agents')
        .select('totp_enabled, totp_secret')
        .eq('user_id', data.user.id).single();
      if (agentRow?.totp_enabled && agentRow?.totp_secret) {
        if (!totp_code) {
          // 토큰 발급 X — 클라이언트가 totp_code 입력 받아 다시 호출하도록 신호
          await supabase.auth.signOut();
          return res.status(202).json({ totp_required: true });
        }
        const { authenticator } = await import('otplib');
        authenticator.options = { window: 1 }; // 30초 슬롯 ±1
        if (!authenticator.check(String(totp_code).trim(), agentRow.totp_secret)) {
          await supabase.auth.signOut();
          return res.status(401).json({ error: '2FA 코드가 올바르지 않습니다' });
        }
      }
    }

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

    // 🚀 incentive_agents 정보까지 포함 — 클라이언트가 GET /agents/me 호출 생략 가능 (-0.5~1초)
    const { data: incentiveAgent } = await supabase
      .from('incentive_agents')
      .select('*')
      .eq('user_id', data.user.id)
      .single();

    // 🚀 role_permissions menus도 동봉 — 통합 어드민 사이드바 fetch 1회 생략 (-300~400ms)
    let menus = null;
    if (incentiveAgent && incentiveAgent.active && incentiveAgent.role) {
      const { data: perm } = await supabase
        .from('incentive_role_permissions')
        .select('menus')
        .eq('role', incentiveAgent.role)
        .single();
      menus = perm?.menus || [];
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
      incentive_agent: (incentiveAgent && incentiveAgent.active) ? incentiveAgent : null,
      role_menus: menus,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// refresh_token으로 access_token 재발급 (세션 자동 연장)
router.post('/refresh', async (req, res) => {
  const { refresh_token } = req.body || {};
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token 필수' });
  try {
    const { data, error } = await authClient().auth.refreshSession({ refresh_token });
    if (error || !data?.session) {
      return res.status(401).json({ error: '세션 만료. 다시 로그인하세요.' });
    }
    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (e) {
    res.status(401).json({ error: '세션 갱신 실패: ' + e.message });
  }
});

// 소셜 로그인 후 프로필 확인/생성
router.post('/social-profile', authenticateJWT, async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: '이름과 전화번호는 필수입니다' });
    }

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
          display_name: name,
          phone: phone || null,
          avatar_url: avatar || null,
        });

      if (insertError) {
        console.error('소셜 프로필 생성 실패:', insertError.message);
        return res.status(500).json({ error: '프로필 생성 실패' });
      }
    } else {
      // 기존 프로필 업데이트
      const updates = {};
      if (name) updates.display_name = name;
      if (phone) updates.phone = phone;
      if (avatar) updates.avatar_url = avatar;
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('bongi_user_profiles')
          .update(updates)
          .eq('id', req.user.id);
      }
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

// 본인 비밀번호 변경 — 현재 비번 검증 후 새 비번으로 업데이트
router.post('/change-password', authenticateJWT, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: '현재/새 비밀번호 필수' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: '새 비밀번호는 8자 이상' });
    }
    if (current_password === new_password) {
      return res.status(400).json({ error: '새 비밀번호가 현재와 동일' });
    }

    // 현재 비번 검증 — 본인 이메일로 재로그인 시도
    const email = req.user.email;
    const { error: signinErr } = await authClient().auth.signInWithPassword({ email, password: current_password });
    if (signinErr) return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다' });

    // 새 비번으로 업데이트
    const { error: updErr } = await supabase.auth.admin.updateUserById(req.user.id, { password: new_password });
    if (updErr) throw updErr;

    res.json({ ok: true, message: '비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.' });
  } catch (e) {
    console.error('[change-password]', e);
    res.status(500).json({ error: e.message || '변경 실패' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2FA (TOTP) — 활성화 흐름: setup → verify → enabled
// ═══════════════════════════════════════════════════════════════
router.post('/2fa/setup', authenticateJWT, async (req, res) => {
  try {
    const { authenticator } = await import('otplib');
    const QRCode = (await import('qrcode')).default;
    const { data: agent } = await supabase.from('incentive_agents')
      .select('id, name, totp_enabled').eq('user_id', req.user.id).single();
    if (!agent) return res.status(403).json({ error: 'incentive_agent 미등록' });
    if (agent.totp_enabled) return res.status(400).json({ error: '이미 2FA 활성화됨' });

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(agent.name || req.user.email, '봉이모바일', secret);
    const qr = await QRCode.toDataURL(otpauth);

    // 임시 저장 — verify 통과 시 totp_enabled=true 처리 (verify에서 함께 update)
    await supabase.from('incentive_agents').update({ totp_secret: secret }).eq('id', agent.id);
    res.json({ secret, qr_data_url: qr, otpauth });
  } catch (e) { console.error('[2fa setup]', e); res.status(500).json({ error: '2FA 설정 실패' }); }
});

router.post('/2fa/verify', authenticateJWT, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: '코드 입력' });
    const { authenticator } = await import('otplib');
    authenticator.options = { window: 1 };
    const { data: agent } = await supabase.from('incentive_agents')
      .select('id, totp_secret, totp_enabled').eq('user_id', req.user.id).single();
    if (!agent?.totp_secret) return res.status(400).json({ error: 'setup 먼저 실행' });
    if (!authenticator.check(String(code).trim(), agent.totp_secret))
      return res.status(401).json({ error: '코드 불일치' });
    await supabase.from('incentive_agents').update({
      totp_enabled: true, totp_enabled_at: new Date().toISOString(),
    }).eq('id', agent.id);
    res.json({ ok: true });
  } catch (e) { console.error('[2fa verify]', e); res.status(500).json({ error: '검증 실패' }); }
});

router.post('/2fa/disable', authenticateJWT, async (req, res) => {
  try {
    const { code } = req.body || {};
    const { authenticator } = await import('otplib');
    authenticator.options = { window: 1 };
    const { data: agent } = await supabase.from('incentive_agents')
      .select('id, totp_secret, totp_enabled').eq('user_id', req.user.id).single();
    if (!agent?.totp_enabled) return res.status(400).json({ error: '2FA 비활성 상태' });
    if (!code || !authenticator.check(String(code).trim(), agent.totp_secret))
      return res.status(401).json({ error: '코드 검증 필요' });
    await supabase.from('incentive_agents').update({
      totp_enabled: false, totp_secret: null, totp_enabled_at: null,
    }).eq('id', agent.id);
    res.json({ ok: true });
  } catch (e) { console.error('[2fa disable]', e); res.status(500).json({ error: '해제 실패' }); }
});

router.get('/2fa/status', authenticateJWT, async (req, res) => {
  try {
    const { data: agent } = await supabase.from('incentive_agents')
      .select('totp_enabled, totp_enabled_at, role').eq('user_id', req.user.id).single();
    res.json({
      enabled: !!agent?.totp_enabled,
      enabled_at: agent?.totp_enabled_at || null,
      role: agent?.role,
      recommended: agent?.role === 'admin',
    });
  } catch (_e) { res.status(500).json({ error: '조회 실패' }); }
});

export default router;
