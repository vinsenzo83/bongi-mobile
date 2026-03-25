import { theme } from '../../styles/admin-theme.js';

const colorMap = {
  // 상태
  new: { bg: '#1a3a5c', color: theme.blue },
  pending: { bg: '#3d2e0a', color: theme.yellow },
  active: { bg: '#0f2d1a', color: theme.green },
  completed: { bg: '#0f2d1a', color: theme.greenDim },
  cancelled: { bg: '#3d1a1a', color: theme.red },
  hold: { bg: '#3d2a0a', color: theme.orange },
  // 역할
  super: { bg: '#2d1a3d', color: theme.purple },
  owner: { bg: '#2d1a3d', color: theme.purple },
  ops: { bg: '#1a3a5c', color: theme.blue },
  manager: { bg: '#1a3a5c', color: theme.blue },
  agent: { bg: '#0f2d1a', color: theme.green },
  customer: { bg: '#252525', color: theme.textMuted },
  // 기본
  default: { bg: '#252525', color: theme.textMuted },
};

export default function Badge({ label, variant = 'default', size = 'sm' }) {
  const colors = colorMap[variant] || colorMap.default;
  const fontSize = size === 'sm' ? 11 : 13;
  const padding = size === 'sm' ? '2px 8px' : '4px 12px';

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      background: colors.bg,
      color: colors.color,
      fontSize,
      fontWeight: 600,
      padding,
      borderRadius: 10,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
