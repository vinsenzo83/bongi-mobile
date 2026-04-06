import { useState } from 'react';
import { theme, card, button, tableStyles, statusStyle, input } from '../../styles/admin-theme.js';

const kpiCard = {
  background: '#fff', border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16, textAlign: 'center',
};

const initialCrawlers = [
  { id: 1, name: '스마트초이스', target: '공시지원금', schedule: '매일 09:00', status: '정상', lastRun: '2026-04-06 09:00', dataCount: 1245, running: false },
  { id: 2, name: '렌트리', target: '렌탈상품', schedule: '매주 월요일', status: '정상', lastRun: '2026-04-01 06:00', dataCount: 387, running: false },
  { id: 3, name: '아정당', target: '유선상품', schedule: '수동', status: '대기', lastRun: '2026-03-28 14:30', dataCount: 156, running: false },
];

const initialHistory = [
  { id: 1, crawler: '스마트초이스', time: '2026-04-06 09:00', duration: '3분 24초', result: '성공', dataCount: 1245, status: 'green' },
  { id: 2, crawler: '스마트초이스', time: '2026-04-05 09:00', duration: '3분 18초', result: '성공', dataCount: 1240, status: 'green' },
  { id: 3, crawler: '렌트리', time: '2026-04-01 06:00', duration: '1분 52초', result: '성공', dataCount: 387, status: 'green' },
  { id: 4, crawler: '스마트초이스', time: '2026-04-04 09:00', duration: '5분 01초', result: '부분 성공', dataCount: 1180, status: 'orange' },
  { id: 5, crawler: '아정당', time: '2026-03-28 14:30', duration: '2분 10초', result: '성공', dataCount: 156, status: 'green' },
  { id: 6, crawler: '렌트리', time: '2026-03-25 06:00', duration: '-', result: '실패', dataCount: 0, status: 'red' },
];

const initialPending = [
  { id: 1, crawler: '스마트초이스', date: '2026-04-06', newCount: 5, desc: '신규 공시지원금 5건 (갤럭시 S25 시리즈)', status: '검토대기' },
  { id: 2, crawler: '렌트리', date: '2026-04-01', newCount: 12, desc: '신규 렌탈상품 12건', status: '검토대기' },
];

export default function CrawlManage() {
  const [crawlers, setCrawlers] = useState(initialCrawlers);
  const [history] = useState(initialHistory);
  const [pending, setPending] = useState(initialPending);

  const successCount = history.filter(h => h.result === '성공').length;
  const totalCount = history.length;
  const successRate = Math.round((successCount / totalCount) * 100);

  const runCrawler = (id) => {
    setCrawlers(crawlers.map(c => c.id === id ? { ...c, running: true } : c));
    setTimeout(() => {
      setCrawlers(prev => prev.map(c => c.id === id ? { ...c, running: false, lastRun: '2026-04-06 ' + new Date().toTimeString().slice(0, 5) } : c));
    }, 2500);
  };

  const approve = (id) => setPending(pending.map(p => p.id === id ? { ...p, status: '승인' } : p));
  const reject = (id) => setPending(pending.map(p => p.id === id ? { ...p, status: '반려' } : p));

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 20 }}>크롤링 관리</h1>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>등록 크롤러</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: theme.navy, fontFamily: 'monospace' }}>3</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>마지막 실행</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>2026-04-06 09:00</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 6 }}>성공률</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: theme.green, fontFamily: 'monospace' }}>{successRate}%</div>
        </div>
      </div>

      {/* Crawler cards */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.text, marginBottom: 12 }}>크롤러 목록</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {crawlers.map(c => (
          <div key={c.id} style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{c.name}</div>
              <span style={statusStyle(c.status === '정상' ? 'green' : 'gray')}>{c.running ? '실행중' : c.status}</span>
            </div>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>대상: {c.target}</div>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>스케줄: {c.schedule}</div>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 4 }}>마지막 실행: {c.lastRun}</div>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 12 }}>데이터 건수: <strong style={{ color: theme.blue }}>{c.dataCount.toLocaleString()}</strong></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                style={{ ...button.primary, flex: 1, opacity: c.running ? 0.5 : 1 }}
                onClick={() => runCrawler(c.id)}
                disabled={c.running}
              >
                {c.running ? '실행중...' : '실행'}
              </button>
              <button style={{ ...button.secondary, flex: 1 }}>중지</button>
            </div>
          </div>
        ))}
      </div>

      {/* Approval workflow */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.text, marginBottom: 12 }}>신규 데이터 승인</h2>
      <div style={{ ...card, padding: 0, overflow: 'auto', marginBottom: 24 }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['크롤러', '수집일', '신규건수', '설명', '상태', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pending.map(p => (
              <tr key={p.id}>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{p.crawler}</td>
                <td style={tableStyles.td}>{p.date}</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.blue }}>{p.newCount}건</td>
                <td style={tableStyles.td}>{p.desc}</td>
                <td style={tableStyles.td}>
                  <span style={statusStyle(
                    p.status === '승인' ? 'green' : p.status === '반려' ? 'red' : 'orange'
                  )}>{p.status}</span>
                </td>
                <td style={tableStyles.td}>
                  {p.status === '검토대기' ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ ...button.success, padding: '4px 10px' }} onClick={() => approve(p.id)}>승인</button>
                      <button style={{ ...button.danger, padding: '4px 10px' }} onClick={() => reject(p.id)}>반려</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: theme.textMuted }}>처리완료</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* History table */}
      <h2 style={{ fontSize: 15, fontWeight: 700, color: theme.text, marginBottom: 12 }}>크롤링 이력</h2>
      <div style={{ ...card, padding: 0, overflow: 'auto' }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['크롤러', '실행시간', '소요시간', '결과', '데이터건수', '상태'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map(h => (
              <tr key={h.id}>
                <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.text }}>{h.crawler}</td>
                <td style={tableStyles.td}>{h.time}</td>
                <td style={tableStyles.td}>{h.duration}</td>
                <td style={tableStyles.td}>{h.result}</td>
                <td style={tableStyles.td}>{h.dataCount.toLocaleString()}</td>
                <td style={tableStyles.td}>
                  <span style={statusStyle(h.status)}>{h.result}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
