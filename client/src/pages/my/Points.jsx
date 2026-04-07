import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const WITHDRAW_THRESHOLD = 50000;

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export default function Points() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [balRes, histRes] = await Promise.all([
          api.cash.getBalance().catch(() => ({ balance: 0 })),
          api.cash.getHistory().catch(() => ({ data: [] })),
        ]);

        const bal = balRes.balance ?? balRes.data?.balance ?? 0;
        setBalance(typeof bal === 'number' ? bal : parseInt(String(bal).replace(/[^0-9]/g, ''), 10) || 0);

        const list = histRes.data || histRes.history || histRes || [];
        setHistory(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Points load error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fmt = (n) => (n || 0).toLocaleString();
  const canWithdraw = balance >= WITHDRAW_THRESHOLD;
  const remaining = WITHDRAW_THRESHOLD - balance;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
        불러오는 중...
      </div>
    );
  }

  return (
    <div>
      {/* 보유 포인트 */}
      <div style={{ ...card, background: '#1a2744', color: '#fff', textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>보유 포인트</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: '#fbbf24', marginBottom: 4 }}>{fmt(balance)} P</div>
        {!canWithdraw && (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {`현금 출금까지 ${fmt(remaining)}P 더 필요해요`}
          </div>
        )}
      </div>

      {/* 출금 조건 */}
      <div style={{ ...card, background: '#fef3c7', borderColor: '#fcd34d', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 8 }}>
              <span role="img" aria-label="money">{'\u{1F4B0}'}</span> 현금 출금 조건
            </div>
            <div style={{ fontSize: 12, color: '#78350f', lineHeight: 2 }}>
              <div>{canWithdraw ? '\u2705' : '\u2B1C'} 5만 포인트 이상 보유 (현재 {fmt(balance)}P)</div>
              <div>{'\u2705'} 1회 이상 계약 완료</div>
              <div>{'\u2705'} 본인인증 완료</div>
              <div>{'\u2705'} 계좌 등록 완료</div>
            </div>
          </div>
          <button
            disabled={!canWithdraw}
            style={{
              height: 36,
              width: 90,
              borderRadius: 8,
              fontSize: 12,
              background: canWithdraw ? '#2563eb' : '#f3f4f6',
              color: canWithdraw ? '#fff' : '#999',
              border: 'none',
              opacity: canWithdraw ? 1 : 0.4,
              cursor: canWithdraw ? 'pointer' : 'not-allowed',
              flexShrink: 0,
            }}
          >
            출금 신청
          </button>
        </div>
        <div style={{ fontSize: 11, color: '#92400e', marginTop: 10, paddingTop: 10, borderTop: '1px solid #fcd34d' }}>
          {'※ 5만 포인트 달성 시 출금 신청 버튼이 활성화됩니다'}
        </div>
      </div>

      {/* 포인트 내역 */}
      <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2744', marginBottom: 12 }}>포인트 내역</div>

      {history.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 14 }}>
          포인트 내역이 없습니다
        </div>
      )}

      {history.map((item, i) => {
        const amount = item.amount || item.point || 0;
        const isPositive = typeof amount === 'number' ? amount > 0 : String(amount).startsWith('+');
        const color = isPositive ? '#10b981' : '#ef4444';
        const displayPoint = typeof amount === 'number'
          ? `${isPositive ? '+' : ''}${amount.toLocaleString()}P`
          : amount;
        const title = item.title || item.description || item.type || '';
        const desc = item.desc || item.detail || item.memo || '';
        const date = formatDate(item.date || item.created_at || item.createdAt);

        return (
          <div key={item.id || i} style={{ ...card, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  {desc && date ? `${desc} \u00B7 ${date}` : desc || date}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color }}>{displayPoint}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
