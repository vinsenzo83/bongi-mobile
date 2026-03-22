import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../utils/api.js';
import CTIPanel from '../../components/CTIPanel.jsx';

const STATUS_FLOW = ['new', 'waiting', 'consulting', 'contracted', 'aftercare'];
const STATUS_KO = { new: '신규 유입', waiting: '상담 대기', consulting: '상담 중', contracted: '계약 완료', aftercare: '사후 관리', lost: '이탈' };

const DB_TYPE_RECOMMEND = {
  mnp: { label: 'MNP (통신사 변경)', items: ['인터넷+TV 결합', '가족 회선 추가', '중고폰 매입'] },
  device_change: { label: '기변 (같은 통신사)', items: ['인터넷 결합 확인', '가전렌탈', '중고폰 매입'] },
  new: { label: '신규 가입', items: ['전체 상품 안내', '결합할인 안내', '프로모션 안내'] },
};

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [consultations, setConsultations] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [aiRec, setAiRec] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    api.crm.getCustomer(id).then(setCustomer).catch(() => {});
    api.crm.getCustomerConsultations(id).then(setConsultations).catch(() => setConsultations([]));
    api.crm.getCustomerContracts(id).then(setContracts).catch(() => setContracts([]));
    api.crm.getAgents().then(setAgents).catch(() => setAgents([]));
    // AI 추천 로드
    setAiLoading(true);
    api.ai.getRecommendation(id).then(setAiRec).catch(() => {}).finally(() => setAiLoading(false));
  }, [id]);

  const changeStatus = async (status) => {
    const data = await api.crm.updateCustomer(id, { status });
    setCustomer(data);
  };

  const addConsultation = async (type) => {
    await api.crm.createConsultation({
      customer_id: id,
      type,
      notes: newNote,
    });
    setNewNote('');
    const updated = await api.crm.getCustomerConsultations(id);
    setConsultations(updated);
  };

  if (!customer) return <div className="container section"><p>로딩 중...</p></div>;

  const rec = DB_TYPE_RECOMMEND[customer.db_type] || DB_TYPE_RECOMMEND.new;

  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 900 }}>
      <Link to="/admin" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>← 대시보드로</Link>

      {/* 고객 정보 헤더 */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 24, marginBottom: 4 }}>{customer.name}</h2>
            <div style={{ fontSize: 15, color: 'var(--text-secondary)' }}>{customer.phone}</div>
          </div>
          <span className="badge" style={{ padding: '6px 14px', fontSize: 13 , background: '#eff6ff', color: 'var(--primary)', fontWeight: 700 }}>
            {STATUS_KO[customer.status]}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20, padding: '16px 0', borderTop: '1px solid var(--border)' }}>
          <Info label="DB 유형" value={rec.label} />
          <Info label="유입경로" value={customer.source === 'store' ? '매장' : customer.source === 'web' ? '웹' : customer.source} />
          <Info label="생년월일" value={customer.birth_date || '-'} />
          <Info label="성별" value={customer.gender === 'male' ? '남성' : customer.gender === 'female' ? '여성' : '-'} />
        </div>

        {/* 상태 플로우 버튼 */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>상태 변경</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STATUS_FLOW.map(s => (
              <button key={s} onClick={() => changeStatus(s)}
                className={`btn ${customer.status === s ? 'btn-primary' : 'btn-outline'}`}
                style={{ fontSize: 12 }}>
                {STATUS_KO[s]}
              </button>
            ))}
            <button onClick={() => changeStatus('lost')} className="btn btn-outline" style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              이탈
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>

        {/* 왼쪽: AI 추천 + 상담 기록 */}
        <div>
          {/* AI 추천 */}
          <div className="card" style={{ background: '#f0f9ff', borderColor: 'rgba(37,99,235,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>AI 추천 (DB 유형: {rec.label})</div>
              {aiRec?.score && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>계약확률</div>
                  <div style={{
                    width: 60, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${aiRec.score}%`, height: '100%', borderRadius: 4,
                      background: aiRec.score >= 70 ? '#10b981' : aiRec.score >= 40 ? '#f59e0b' : '#ef4444',
                    }} />
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: aiRec.score >= 70 ? '#10b981' : aiRec.score >= 40 ? '#f59e0b' : '#ef4444' }}>
                    {aiRec.score}%
                  </span>
                </div>
              )}
            </div>

            {aiLoading ? (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>AI 분석 중...</div>
            ) : aiRec ? (
              <>
                <div style={{ fontSize: 14, marginBottom: 8 }}>우선 제안 상품:</div>
                {(aiRec.topProducts || rec.items).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontSize: 14 }}>{item}</span>
                  </div>
                ))}
                {aiRec.reason && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>근거: {aiRec.reason}</div>
                )}
                <div style={{ marginTop: 12, padding: '10px 12px', background: '#dbeafe', borderRadius: 8, fontSize: 13 }}>
                  <strong>추천 스크립트:</strong><br />
                  {aiRec.script || ''}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, marginBottom: 8 }}>우선 제안 상품:</div>
                {rec.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontSize: 14 }}>{item}</span>
                  </div>
                ))}
              </>
            )}
            <button onClick={() => { setAiLoading(true); api.ai.getRecommendation(id).then(setAiRec).catch(()=>{}).finally(()=>setAiLoading(false)); }}
              className="btn btn-outline" style={{ fontSize: 12, marginTop: 12, width: '100%', justifyContent: 'center' }}>
              AI 재분석
            </button>
          </div>

          {/* 상담 기록 */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>상담 기록</div>
            {consultations.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>아직 상담 기록이 없습니다</p>}
            {consultations.map(c => (
              <div key={c.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span className="badge badge-blue">{c.type === 'happy_call' ? '해피콜' : c.type === 'inbound' ? '인바운드' : c.type === 'outbound' ? '아웃바운드' : '콜백'}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{new Date(c.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                {c.notes && <p style={{ fontSize: 13, marginTop: 6 }}>{c.notes}</p>}
                {c.bongi_agents && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>담당: {c.bongi_agents.name}</div>}
              </div>
            ))}

            {/* 상담 추가 */}
            <div style={{ marginTop: 12 }}>
              <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="상담 메모 입력..." rows={2} style={{ marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => addConsultation('happy_call')} className="btn btn-outline" style={{ fontSize: 12 }}>해피콜</button>
                <button onClick={() => addConsultation('outbound')} className="btn btn-outline" style={{ fontSize: 12 }}>아웃바운드</button>
                <button onClick={() => addConsultation('inbound')} className="btn btn-outline" style={{ fontSize: 12 }}>인바운드</button>
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: CTI + 계약 + 메모 */}
        <div>
          {/* CTI 전화 컨트롤 */}
          <CTIPanel
            agentId={agents[0]?.id || 'default'}
            customer={customer}
            onCallEnd={(callResult) => {
              // 통화 종료 시 상담 기록 자동 생성
              api.crm.createConsultation({
                customer_id: id,
                agent_id: agents[0]?.id,
                type: callResult.direction === 'inbound' ? 'inbound' : 'outbound',
                notes: `통화 ${callResult.duration}초 / ${callResult.phoneNumber}`,
              }).then(() => {
                api.crm.getCustomerConsultations(id).then(setConsultations);
              });
            }}
          />

          {/* 계약 목록 */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>계약 내역</div>
            {contracts.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>아직 계약이 없습니다</p>}
            {contracts.map(ct => (
              <div key={ct.id} className="card" style={{ padding: 14, marginBottom: 8, background: '#f8fafc' }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{ct.product_name || ct.product_ticket}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {ct.carrier} / {ct.product_category} / {ct.status}
                </div>
                {ct.contract_amount > 0 && <div style={{ fontSize: 13, marginTop: 4 }}>계약금: {ct.contract_amount.toLocaleString()}원</div>}
              </div>
            ))}
          </div>

          {/* 메모 */}
          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>메모</div>
            <textarea
              value={customer.memo || ''}
              onChange={e => setCustomer({ ...customer, memo: e.target.value })}
              onBlur={() => api.crm.updateCustomer(id, { memo: customer.memo })}
              placeholder="고객 메모 입력 (자동 저장)"
              rows={4}
            />
          </div>

          {/* 주소 */}
          {customer.address && (
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>주소</div>
              <div style={{ fontSize: 14 }}>{customer.address} {customer.address_detail}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
