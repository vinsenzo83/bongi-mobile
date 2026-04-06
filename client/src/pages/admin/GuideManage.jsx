import { useState } from 'react';
import { theme, card, button, statusStyle, input } from '../../styles/admin-theme.js';

const tabDefs = ['무선가이드', '유선가이드', 'AI운영가이드', '사기방지'];

const initialGuides = {
  '무선가이드': [
    { id: 1, title: '번호이동 절차 안내', content: '번호이동 시 필요한 서류 및 절차를 안내합니다. 1) 신분증 준비 2) 기존 통신사 해지 불필요 3) 인증번호 수신 가능해야 함...' },
    { id: 2, title: '5G vs LTE 요금제 비교', content: '5G 요금제는 기본적으로 데이터 제공량이 많으며, LTE 대비 월 1~2만원 비쌉니다. 고객 사용 패턴에 따라 추천...' },
    { id: 3, title: '약정 할인 vs 공시지원금', content: '약정 할인: 24개월간 요금 25% 할인. 공시지원금: 단말기 구매 시 즉시 할인. 월 요금이 높을수록 약정 할인 유리...' },
    { id: 4, title: '유심 변경 가이드', content: '유심 변경 시 기존 번호 유지 가능. 대리점 방문 또는 온라인 신청. 유심비 7,700원 별도...' },
  ],
  '유선가이드': [
    { id: 5, title: '인터넷 결합 할인 안내', content: '인터넷+TV+모바일 결합 시 최대 월 3만원 할인. 통신사별 결합 조건이 상이하므로 확인 필요...' },
    { id: 6, title: 'TV 상품 비교', content: 'IPTV 3사 비교: SKT BTV, KT Genie TV, LGU+ U+tv. 채널 수, VOD, OTT 연동 등 차이점 안내...' },
    { id: 7, title: '설치 일정 안내', content: '신규 개통 시 설치 기사 방문 필요. 평균 2~3영업일 소요. 주말 설치 불가...' },
  ],
  'AI운영가이드': [
    { id: 8, title: 'AI 챗봇 응대 기본 원칙', content: '1) 고객에게 항상 존댓말 사용 2) 불확실한 정보 제공 금지 3) 상담사 연결 안내 필수 4) 개인정보 요청 금지...' },
    { id: 9, title: '요금제 추천 로직', content: '고객 데이터 사용량 기반 추천. 월 10GB 미만: LTE 요금제, 10~50GB: 5G 베이직, 50GB 이상: 5G 프리미엄...' },
    { id: 10, title: '에스컬레이션 규칙', content: '다음 경우 상담사 연결: 1) 요금 분쟁 2) 해지 요청 3) 3회 이상 동일 질문 4) 고객 불만 표현...' },
  ],
  '사기방지': [
    { id: 11, title: '보이스피싱 대응', content: '의심 통화 패턴: 경찰/검찰 사칭, 계좌 이체 요구, 앱 설치 유도. 즉시 상담 중단 후 112 안내...' },
    { id: 12, title: '명의도용 방지', content: '본인 인증 필수 확인. PASS 인증 또는 신분증 사본 필수. 대리인 신청 시 위임장 + 양측 신분증...' },
    { id: 13, title: '불법 보조금 주의', content: '법정 한도 초과 보조금 제공 시 불법. 신고 대상. 고객에게 적법한 지원금 범위 안내...' },
    { id: 14, title: '스미싱 문자 대응', content: '출처 불명 링크 클릭 금지. 택배/은행 사칭 문자 주의. 의심 문자 수신 시 118 신고 안내...' },
  ],
};

const overlay = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal = {
  background: '#fff', borderRadius: 12, padding: 24, width: 560,
  boxShadow: '0 8px 32px rgba(0,0,0,0.18)', maxHeight: '80vh', overflowY: 'auto',
};

export default function GuideManage() {
  const [activeTab, setActiveTab] = useState('무선가이드');
  const [guides, setGuides] = useState(initialGuides);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ title: '', content: '' });

  const currentGuides = guides[activeTab] || [];

  const openAdd = () => {
    setEditItem(null);
    setForm({ title: '', content: '' });
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ title: item.title, content: item.content });
    setShowModal(true);
  };

  const save = () => {
    if (editItem) {
      setGuides({
        ...guides,
        [activeTab]: currentGuides.map(g => g.id === editItem.id ? { ...g, ...form } : g),
      });
    } else {
      setGuides({
        ...guides,
        [activeTab]: [...currentGuides, { id: Date.now(), ...form }],
      });
    }
    setShowModal(false);
  };

  const remove = (id) => {
    setGuides({ ...guides, [activeTab]: currentGuides.filter(g => g.id !== id) });
  };

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.text, marginBottom: 20 }}>
        가이드 (AI 학습 데이터)
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: `2px solid ${theme.border}` }}>
        {tabDefs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? theme.navy : theme.textSecondary,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? `2px solid ${theme.navy}` : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -2,
              fontFamily: theme.sans,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button style={button.primary} onClick={openAdd}>+ 가이드 추가</button>
      </div>

      {/* Guide list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {currentGuides.map(g => (
          <div key={g.id} style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.text, marginBottom: 6 }}>{g.title}</div>
              <div style={{ fontSize: 12, color: theme.textSecondary, lineHeight: 1.6 }}>
                {g.content.length > 120 ? g.content.slice(0, 120) + '...' : g.content}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button style={{ ...button.secondary, padding: '4px 10px', fontSize: 11 }} onClick={() => openEdit(g)}>수정</button>
              <button style={{ ...button.danger, padding: '4px 10px' }} onClick={() => remove(g.id)}>삭제</button>
            </div>
          </div>
        ))}
        {currentGuides.length === 0 && (
          <div style={{ ...card, textAlign: 'center', color: theme.textMuted, padding: 40 }}>등록된 가이드가 없습니다.</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={overlay} onClick={() => setShowModal(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: theme.text }}>
              {editItem ? '가이드 수정' : '가이드 추가'}
            </h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: 4 }}>제목</label>
              <input style={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: theme.textSecondary, display: 'block', marginBottom: 4 }}>내용</label>
              <textarea
                style={{ ...input, minHeight: 200, resize: 'vertical' }}
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={button.secondary} onClick={() => setShowModal(false)}>취소</button>
              <button style={button.primary} onClick={save}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
