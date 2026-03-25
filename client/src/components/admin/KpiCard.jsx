import { theme, card as cardStyle } from '../../styles/admin-theme.js';

export default function KpiCard({ label, value, sub, icon, trend, color }) {
  const trendColor = trend > 0 ? theme.green : trend < 0 ? theme.red : theme.textMuted;
  const trendText = trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : '';

  return (
    <div style={{
      ...cardStyle,
      minWidth: 160,
      flex: 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: theme.textMuted }}>{label}</span>
        {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || theme.textWhite, lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        {sub && <span style={{ fontSize: 12, color: theme.textMuted }}>{sub}</span>}
        {trendText && <span style={{ fontSize: 12, color: trendColor, fontWeight: 600 }}>{trendText}</span>}
      </div>
    </div>
  );
}
