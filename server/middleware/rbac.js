// 역할 계층 (높을수록 더 많은 권한)
const ROLE_HIERARCHY = {
  customer: 0,
  agent: 1,
  manager: 2,
  owner: 3,
  ops: 3,
  super: 4,
};

// 특정 역할 필요
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `접근 권한이 없습니다 (필요: ${roles.join('/')})` });
    }
    next();
  };
}

// 최소 역할 레벨 필요
export function requireMinRole(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '인증이 필요합니다' });
    }
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: `접근 권한이 없습니다 (최소: ${minRole})` });
    }
    next();
  };
}
