import { supabase } from '../db/supabase.js';

// JWT 인증 미들웨어
export async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '인증이 필요합니다' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: '유효하지 않은 토큰입니다' });
    }

    // 사용자 프로필에서 역할 조회
    const { data: profile } = await supabase
      .from('bongi_user_profiles')
      .select('role, agent_id, store_id, display_name, member_tier, total_conversions')
      .eq('id', user.id)
      .single();

    req.user = {
      id: user.id,
      email: user.email,
      role: profile?.role || 'customer',
      agentId: profile?.agent_id || null,
      storeId: profile?.store_id || null,
      displayName: profile?.display_name || user.email,
      memberTier: profile?.member_tier || 'normal',
      totalConversions: profile?.total_conversions || 0,
    };

    next();
  } catch (e) {
    return res.status(401).json({ error: '인증 처리 실패' });
  }
}

// 선택적 인증 (비회원도 접근 가능)
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) {
      const { data: profile } = await supabase
        .from('bongi_user_profiles')
        .select('role, agent_id, store_id, display_name, member_tier, total_conversions')
        .eq('id', user.id)
        .single();

      req.user = {
        id: user.id,
        email: user.email,
        role: profile?.role || 'customer',
        agentId: profile?.agent_id || null,
        storeId: profile?.store_id || null,
        displayName: profile?.display_name || user.email,
        memberTier: profile?.member_tier || 'normal',
        totalConversions: profile?.total_conversions || 0,
      };
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
}
