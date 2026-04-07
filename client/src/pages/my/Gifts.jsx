import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const STATUS_STYLES = {
  '지급대기': { color: '#d97706', bg: '#fffbeb', amountColor: '#d97706', cardBg: '#fef3c7', cardBorder: '#fcd34d' },
  '지급 대기': { color: '#d97706', bg: '#fffbeb', amountColor: '#d97706', cardBg: '#fef3c7', cardBorder: '#fcd34d' },
  '대기': { color: '#d97706', bg: '#fffbeb', amountColor: '#d97706', cardBg: '#fef3c7', cardBorder: '#fcd34d' },
  'pending': { color: '#d97706', bg: '#fffbeb', amountColor: '#d97706', cardBg: '#fef3c7', cardBorder: '#fcd34d' },
  '지급완료': { color: '#10b981', bg: '#ecfdf5', amountColor: '#059669', cardBg: '#fff', cardBorder: '#e5e7eb' },
  '지급 완료': { color: '#10b981', bg: '#ecfdf5', amountColor: '#059669', cardBg: '#fff', cardBorder: '#e5e7eb' },
  '완료': { color: '#10b981', bg: '#ecfdf5', amountColor: '#059669', cardBg: '#fff', cardBorder: '#e5e7eb' },
  'completed': { color: '#10b981', bg: '#ecfdf5', amountColor: '#059669', cardBg: '#fff', cardBorder: '#e5e7eb' },
};

function getStyle(status) {
  return STATUS_STYLES[status] || STATUS_STYLES['대기'];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function Gifts() {
  const [loading, setLoading] = useState(true);
  const [gifts, setGifts] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.admin.getGifts();
        const list = res.data || res.gifts || res || [];
        setGifts(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Gifts load error:', e);
        setGifts([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 8 }}>사은품 현황</div>
      <div style={{ fontSize: 13, color: '#999', marginBottom: 16 }}>설치 완료 후 현금으로 지급됩니다</div>

      {gifts.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 14 }}>
          사은품 내역이 없습니다
        </div>
      )}

      {gifts.map((gift, i) => {
        const status = gift.status || '대기';
        const st = getStyle(status);
        const title = gift.product_name || gift.productName || gift.title || '상품';
        const amount = gift.amount || gift.gift_amount || gift.giftAmount || 0;
        const displayAmount = typeof amount === 'number' ? `${amount.toLocaleString()}원` : amount;
        const isCompleted = ['지급완료', '지급 완료', '완료', 'completed'].includes(status);
        const dateLabel = isCompleted
          ? `지급 완료 ${formatDate(gift.paid_at || gift.paidAt || gift.completed_at || gift.completedAt)}`
          : `지급 예정일 ${formatDate(gift.expected_date || gift.expectedDate || gift.scheduled_at || gift.scheduledAt)}`;

        return (
          <div
            key={gift.id || i}
            style={{
              ...card,
              background: st.cardBg,
              borderColor: st.cardBorder,
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{dateLabel}</div>
              </div>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: st.color,
                background: st.bg,
                padding: '4px 10px',
                borderRadius: 20,
              }}>
                {status}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: st.amountColor }}>{displayAmount}</div>
          </div>
        );
      })}
    </div>
  );
}
