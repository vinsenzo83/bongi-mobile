import { useState } from 'react';

const mockBuyback = [
  { id: 'BP001', model: 'iPhone 16 Pro 256GB', grade: 'A', price: 940000, status: 'inspecting', date: '2026.04.05', steps: ['receipt', 'inspecting'] },
  { id: 'BP002', model: 'Galaxy S25 Ultra 512GB', grade: 'B', price: 680000, status: 'complete', date: '2026.03.20', steps: ['receipt', 'inspecting', 'inspected', 'paid'] },
];

const statusMap = {
  receipt: { label: '\uC2E0\uCCAD\uC644\uB8CC', color: '#2563eb', bg: '#dbeafe' },
  inspecting: { label: '\uAC80\uC218\uC911', color: '#d97706', bg: '#fef3c7' },
  inspected: { label: '\uAC80\uC218\uC644\uB8CC', color: '#10b981', bg: '#d1fae5' },
  paid: { label: '\uC785\uAE08\uC644\uB8CC', color: '#10b981', bg: '#d1fae5' },
  cancelled: { label: '\uCDE8\uC18C', color: '#ef4444', bg: '#fee2e2' },
};

const stepLabels = ['신청완료', '검수중', '검수완료', '대금입금'];

export default function UsedPhone() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={h2}>{'📱'} {' '}중고폰 매입</div>
          <div style={p}>중고폰을 판매하고 현금을 받으세요</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none' }}>
          {'📦'} {' '}매입 신청
        </button>
      </div>

      {/* 신청 폼 */}
      {showForm && (
        <div style={{ ...card, borderColor: '#bfdbfe', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 12 }}>중고폰 매입 신청</div>
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 12, color: '#92400e' }}>
            {'⚠️'} {' '}본인인증(PASS)이 필요합니다. 미인증 시 본인인증 페이지로 이동합니다.
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={label}>제조사</div>
            <select style={input}><option>삼성</option><option>Apple</option><option>LG</option></select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={label}>모델명</div>
            <select style={input}><option>Galaxy S25 Ultra 256GB</option><option>Galaxy S25+ 256GB</option><option>iPhone 16 Pro 256GB</option></select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={label}>셀프 등급 선정</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['A (외관깨끗)', 'B (미세기스)', 'C (눈에보이는기스)', 'D (파손/깨짐)', 'E (심각손상)'].map(g => (
                <button key={g} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d0d0d0', background: '#fff', fontSize: 11, cursor: 'pointer' }}>{g}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={label}>수거 주소</div>
            <select style={input}><option>집 - 광주시 서구 상무대로 123</option><option>직장 - 광주시 동구 금남로 456</option></select>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={label}>사진 첨부 (전면/후면/측면)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['전면', '후면', '측면'].map(s => (
                <div key={s} style={{ flex: 1, border: '1.5px dashed #d0d0d0', borderRadius: 8, padding: 16, textAlign: 'center', color: '#999', fontSize: 11, cursor: 'pointer' }}>
                  {'📷'} {s}
                </div>
              ))}
            </div>
          </div>
          <button style={{ ...btn, background: '#2563eb', color: '#fff', border: 'none', width: '100%' }}>매입 신청하기</button>
        </div>
      )}

      {/* 매입 현황 */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744', marginBottom: 12 }}>매입 현황</div>
      {mockBuyback.map(item => {
        const st = statusMap[item.status] || statusMap.receipt;
        const currentStep = item.steps.length;
        return (
          <div key={item.id} style={{ ...card, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a2744' }}>{item.model}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{item.id} | {item.date} | 셀프등급 {item.grade}</div>
              </div>
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#2563eb', marginBottom: 12 }}>{item.price.toLocaleString()}원</div>
            {/* 진행 바 */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {stepLabels.map((s, i) => (
                <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: i < currentStep ? '#2563eb' : '#e8e8e8' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {stepLabels.map((s, i) => (
                <div key={s} style={{ fontSize: 9, color: i < currentStep ? '#2563eb' : '#999', fontWeight: i < currentStep ? 600 : 400 }}>{s}</div>
              ))}
            </div>
          </div>
        );
      })}

      {mockBuyback.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: '#999', padding: 40 }}>매입 신청 내역이 없습니다</div>
      )}
    </div>
  );
}

const h2 = { fontSize: 16, fontWeight: 700, color: '#1a2744', marginBottom: 4 };
const p = { fontSize: 12, color: '#999', marginBottom: 0 };
const card = { background: '#fff', border: '1px solid #e8e8e8', borderRadius: 10, padding: 16 };
const label = { fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 6 };
const input = { width: '100%', border: '1.5px solid #d0d0d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#555', background: '#fafafa', fontFamily: 'inherit' };
const btn = { padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
