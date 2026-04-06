import React, { useState } from 'react';

const card = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: 18,
};

const FILTERS = ['전체', '진행중', '완료', '취소'];

const APPLICATIONS = [
  {
    title: 'KT 인터넷+TV 500Mbps',
    date: '2026.04.01',
    type: '셀프 신청',
    status: '상담중',
    statusColor: '#2563eb',
    statusBg: '#eff6ff',
    filter: '진행중',
    extra: '담당: 김상담',
    gift: '사은품 37만원',
  },
  {
    title: 'LG 정수기 렌탈',
    date: '2026.02.15',
    type: 'AI 채팅',
    status: '계약완료',
    statusColor: '#10b981',
    statusBg: '#ecfdf5',
    filter: '완료',
    gift: '사은품 15만원 지급완료',
  },
  {
    title: 'LG 정수기 렌탈 신청',
    date: '2026.01.10',
    type: '티켓 K227',
    status: '취소',
    statusColor: '#999',
    statusBg: '#f3f4f6',
    filter: '취소',
    opacity: 0.6,
  },
  {
    title: '중고폰 매입 \u2014 갤럭시 S24 256GB',
    titleIcon: '\u{1F4E6}',
    date: '2026.04.02',
    type: 'AI 채팅',
    status: '검수중',
    statusColor: '#2563eb',
    statusBg: '#eff6ff',
    filter: '진행중',
    buyback: true,
    buybackPrice: '420,000원',
    buybackStatus: '매입가 확정 대기',
    step: 1,
    steps: ['신청완료', '검수중', '매입확정', '완료'],
  },
];

export default function Applications() {
  const [activeFilter, setActiveFilter] = useState('전체');

  const filtered = activeFilter === '전체'
    ? APPLICATIONS
    : APPLICATIONS.filter((a) => a.filter === activeFilter);

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

      {filtered.map((app, i) => (
        <div
          key={i}
          style={{
            ...card,
            marginBottom: 10,
            opacity: app.opacity || 1,
            borderColor: app.buyback ? '#bfdbfe' : '#e5e7eb',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: app.extra || app.gift || app.buyback ? 8 : 0 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>
                {app.titleIcon && <span role="img" aria-label="icon">{app.titleIcon}</span>}
                {app.titleIcon ? ' ' : ''}{app.title}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {`신청일 ${app.date} \u00B7 ${app.type}`}
              </div>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: app.statusColor,
              background: app.statusBg,
              padding: '4px 10px',
              borderRadius: 20,
              whiteSpace: 'nowrap',
            }}>
              {app.status}
            </span>
          </div>

          {(app.extra || app.gift) && !app.buyback && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />
              <div style={{ display: 'flex', gap: 16 }}>
                {app.extra && <div style={{ fontSize: 12, color: '#999' }}>{app.extra}</div>}
                {app.gift && (
                  <div style={{ fontSize: 12, color: '#999' }}>
                    <span role="img" aria-label="gift">{'\u{1F381}'}</span> {app.gift}
                  </div>
                )}
              </div>
            </>
          )}

          {app.buyback && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '10px 0' }} />
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#999' }}>
                  {'매입 예정가: '}<strong style={{ color: '#1a2744' }}>{app.buybackPrice}</strong>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '4px 10px', borderRadius: 20 }}>
                  {app.buybackStatus}
                </span>
              </div>
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {app.steps.map((_, si) => (
                    <div
                      key={si}
                      style={{
                        width: 60,
                        height: 4,
                        background: si < app.step ? '#2563eb' : '#bfdbfe',
                        borderRadius: 2,
                      }}
                    />
                  ))}
                  <div style={{ fontSize: 10, color: '#999' }}>{`${app.step}/${app.steps.length} 단계`}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 10, color: '#999' }}>
                  {app.steps.map((s, si) => (
                    <span
                      key={si}
                      style={{
                        width: 60,
                        textAlign: 'center',
                        color: si < app.step ? '#2563eb' : '#999',
                        fontWeight: si < app.step ? 700 : 400,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
