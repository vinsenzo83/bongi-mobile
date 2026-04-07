import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const FILTERS = ['전체', '진행중', '완료', '취소'];

const STATUS_MAP = {
  '상담중': { color: '#2563eb', bg: '#eff6ff', filter: '진행중' },
  '검수중': { color: '#2563eb', bg: '#eff6ff', filter: '진행중' },
  '진행중': { color: '#2563eb', bg: '#eff6ff', filter: '진행중' },
  'pending': { color: '#2563eb', bg: '#eff6ff', filter: '진행중' },
  'in_progress': { color: '#2563eb', bg: '#eff6ff', filter: '진행중' },
  '계약완료': { color: '#10b981', bg: '#ecfdf5', filter: '완료' },
  '완료': { color: '#10b981', bg: '#ecfdf5', filter: '완료' },
  'completed': { color: '#10b981', bg: '#ecfdf5', filter: '완료' },
  '취소': { color: '#999', bg: '#f3f4f6', filter: '취소' },
  'cancelled': { color: '#999', bg: '#f3f4f6', filter: '취소' },
};

function getStatusStyle(status) {
  return STATUS_MAP[status] || { color: '#2563eb', bg: '#eff6ff', filter: '진행중' };
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function Applications() {
  const [activeFilter, setActiveFilter] = useState('전체');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getApplications();
        const list = res.data || res.applications || res || [];
        setApplications(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Applications load error:', e);
        setApplications([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = activeFilter === '전체'
    ? applications
    : applications.filter((a) => {
        const style = getStatusStyle(a.status);
        return style.filter === activeFilter;
      });

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744' }}>신청 내역</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                height: 32,
                padding: '0 14px',
                fontSize: 12,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontWeight: activeFilter === f ? 700 : 400,
                background: activeFilter === f ? '#2563eb' : '#f3f4f6',
                color: activeFilter === f ? '#fff' : '#666',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 14 }}>
          신청 내역이 없습니다
        </div>
      )}

      {filtered.map((app, i) => {
        const st = getStatusStyle(app.status);
        const isCancelled = st.filter === '취소';
        const title = app.product_name || app.productName || app.title || '신청 건';
        const date = formatDate(app.created_at || app.createdAt || app.date);
        const type = app.channel || app.type || '신청';
        const agent = app.agent_name || app.agentName;
        const giftAmt = app.gift_amount || app.giftAmount;
        const giftStatus = app.gift_status || app.giftStatus;
        const isBuyback = app.category === 'used_phone' || app.is_buyback || app.isBuyback;
        const buybackPrice = app.buyback_price || app.buybackPrice;
        const buybackStatus = app.buyback_status || app.buybackStatus;
        const step = app.step || 0;
        const steps = app.steps || [];

        return (
          <div
            key={app.id || i}
            style={{
              ...card,
              marginBottom: 10,
              opacity: isCancelled ? 0.6 : 1,
              borderColor: isBuyback ? '#bfdbfe' : '#e5e7eb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: (agent || giftAmt || isBuyback) ? 8 : 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>
                  {isBuyback && <span role="img" aria-label="icon">{'\u{1F4E6}'}</span>}
                  {isBuyback ? ' ' : ''}{title}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  {`신청일 ${date} \u00B7 ${type}`}
                </div>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: st.color,
                background: st.bg,
                padding: '4px 10px',
                borderRadius: 20,
                whiteSpace: 'nowrap',
              }}>
                {app.status}
              </span>
            </div>

            {(agent || giftAmt) && !isBuyback && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />
                <div style={{ display: 'flex', gap: 16 }}>
                  {agent && <div style={{ fontSize: 12, color: '#999' }}>{'담당: '}{agent}</div>}
                  {giftAmt && (
                    <div style={{ fontSize: 12, color: '#999' }}>
                      <span role="img" aria-label="gift">{'\u{1F381}'}</span>
                      {' 사은품 '}
                      {typeof giftAmt === 'number' ? `${giftAmt.toLocaleString()}원` : giftAmt}
                      {giftStatus ? ` ${giftStatus}` : ''}
                    </div>
                  )}
                </div>
              </>
            )}

            {isBuyback && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {buybackPrice && (
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {'매입 예정가: '}<strong style={{ color: '#1a2744' }}>
                        {typeof buybackPrice === 'number' ? `${buybackPrice.toLocaleString()}원` : buybackPrice}
                      </strong>
                    </div>
                  )}
                  {buybackStatus && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '4px 10px', borderRadius: 20 }}>
                      {buybackStatus}
                    </span>
                  )}
                </div>
                {steps.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {steps.map((_, si) => (
                        <div
                          key={si}
                          style={{
                            width: 60,
                            height: 4,
                            background: si < step ? '#2563eb' : '#bfdbfe',
                            borderRadius: 2,
                          }}
                        />
                      ))}
                      <div style={{ fontSize: 10, color: '#999' }}>{`${step}/${steps.length} 단계`}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 10, color: '#999' }}>
                      {steps.map((s, si) => (
                        <span
                          key={si}
                          style={{
                            width: 60,
                            textAlign: 'center',
                            color: si < step ? '#2563eb' : '#999',
                            fontWeight: si < step ? 700 : 400,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
