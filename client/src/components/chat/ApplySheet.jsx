import { useState } from 'react';
import BottomSheet from './BottomSheet.jsx';

// 카테고리별 설정
const CATEGORY_CONFIG = {
  rental: {
    title: '렌탈 셀프 신청',
    extraFields: ['region', 'contactTime', 'memo'],
    cta: '신청 완료하기',
    completionTitle: '신청이 완료됐어요!',
    completionSub: '전문 상담사가 확인 후 연락드릴게요',
    completionNext: '1~2시간 내 상담사 연락 예정',
  },
  usedphone: {
    title: '중고폰 매입 접수',
    extraFields: ['grade', 'damage', 'address', 'photo'],
    cta: '접수 신청하기',
    completionTitle: '접수가 완료됐어요!',
    completionSub: '검수 후 최종 매입가를 안내드릴게요',
    completionNext: '수거 일정 안내 문자 발송 예정',
  },
  internet: {
    title: '인터넷 신청',
    extraFields: ['applyType', 'currentCarrier', 'address', 'installDate'],
    cta: '신청 완료하기',
    completionTitle: '신청이 완료됐어요!',
    completionSub: '전문 상담사가 확인 후 연락드릴게요',
    completionNext: '1~2시간 내 상담사 연락 예정',
  },
};

const GRADES = [
  { key: 'A', label: 'A등급', desc: '외관 깨끗' },
  { key: 'B', label: 'B등급', desc: '미세 기스' },
  { key: 'C', label: 'C등급', desc: '눈에 보이는 기스' },
  { key: 'D', label: 'D등급', desc: '파손/깨짐' },
  { key: 'E', label: 'E등급', desc: '심각 손상' },
];

const DAMAGE_OPTIONS = ['없음', '미세기스', '화면깨��', '기타'];
const REGIONS = ['광주', '전남', '전북', '서울', '경기', '기타'];
const CONTACT_TIMES = ['오전 (9~12시)', '오후 (12~18시)', '저녁 (18~21시)', '상관없음'];
const APPLY_TYPES = ['신규가입', '이전설치', '재약정'];
const CARRIERS = ['SKT', 'KT', 'LG U+', '없음'];

export default function ApplySheet({ open, onClose, category, product }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.internet;
  const [step, setStep] = useState('form'); // form | complete
  const [form, setForm] = useState({
    name: '', phone: '',
    region: '', contactTime: '', memo: '',
    grade: '', damage: '', address: '', addressDetail: '',
    applyType: '', currentCarrier: '', installDate: '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const isValid = () => {
    if (!form.name.trim() || !form.phone.trim()) return false;
    if (category === 'usedphone' && (!form.grade || !form.damage)) return false;
    if (category === 'internet' && !form.applyType) return false;
    return true;
  };

  const handleSubmit = () => {
    if (!isValid()) return;
    setStep('complete');
  };

  const handleClose = () => {
    setStep('form');
    setForm({ name: '', phone: '', region: '', contactTime: '', memo: '', grade: '', damage: '', address: '', addressDetail: '', applyType: '', currentCarrier: '', installDate: '' });
    onClose();
  };

  if (!open) return null;

  return (
    <BottomSheet open={open} onClose={handleClose} title={config.title}>
      {step === 'form' ? (
        <div>
          {/* 선택된 상품 표시 */}
          {product && (
            <div style={s.productBanner}>
              <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 600, marginBottom: 2 }}>{'📦'} 선택 상품</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2744' }}>{product.name || product.model || '상품'}</div>
              {product.gift && <div style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>{'🎁'} {product.gift}</div>}
              {product.price && <div style={{ fontSize: 12, color: '#2563eb', marginTop: 2 }}>{'💰'} 예상 {product.price}</div>}
            </div>
          )}

          {/* 공통 필드: 이름 + 전화번호 */}
          <div style={s.section}>
            <div style={s.sectionTitle}>기본 정보</div>
            <div style={s.fieldGroup}>
              <label style={s.label}>이름 <span style={s.required}>*</span></label>
              <input style={s.input} placeholder="이름을 입력하세요" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>전화번호 <span style={s.required}>*</span></label>
              <input style={s.input} type="tel" placeholder="010-0000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
          </div>

          {/* 렌탈 추가 필드 */}
          {category === 'rental' && (
            <div style={s.section}>
              <div style={s.sectionTitle}>신청 정보</div>
              <div style={s.fieldGroup}>
                <label style={s.label}>설치 지역 <span style={s.required}>*</span></label>
                <div style={s.chipGroup}>
                  {REGIONS.map(r => (
                    <button key={r} onClick={() => set('region', r)} style={{ ...s.chip, ...(form.region === r ? s.chipActive : {}) }}>{r}</button>
                  ))}
                </div>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>희망 연락 시간</label>
                <div style={s.chipGroup}>
                  {CONTACT_TIMES.map(t => (
                    <button key={t} onClick={() => set('contactTime', t)} style={{ ...s.chip, ...(form.contactTime === t ? s.chipActive : {}) }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>메모 (선택)</label>
                <textarea style={{ ...s.input, height: 60, resize: 'none' }} placeholder="추가 요청사항 (최대 100자)" maxLength={100} value={form.memo} onChange={e => set('memo', e.target.value)} />
              </div>
            </div>
          )}

          {/* 중고폰 추가 필드 */}
          {category === 'usedphone' && (
            <div style={s.section}>
              <div style={s.sectionTitle}>폰 상태</div>
              <div style={s.fieldGroup}>
                <label style={s.label}>셀프 등급 <span style={s.required}>*</span></label>
                <div style={s.chipGroup}>
                  {GRADES.map(g => (
                    <button key={g.key} onClick={() => set('grade', g.key)} style={{ ...s.chip, ...(form.grade === g.key ? s.chipActive : {}), flexDirection: 'column', padding: '8px 12px' }}>
                      <span style={{ fontWeight: 700 }}>{g.key}</span>
                      <span style={{ fontSize: 9, marginTop: 2 }}>{g.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>파손 여부 <span style={s.required}>*</span></label>
                <div style={s.chipGroup}>
                  {DAMAGE_OPTIONS.map(d => (
                    <button key={d} onClick={() => set('damage', d)} style={{ ...s.chip, ...(form.damage === d ? s.chipActive : {}) }}>{d}</button>
                  ))}
                </div>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>수거 주소 <span style={s.required}>*</span></label>
                <input style={s.input} placeholder="주소를 입력하세요" value={form.address} onChange={e => set('address', e.target.value)} />
                <input style={{ ...s.input, marginTop: 8 }} placeholder="상세 주소 (동/호수)" value={form.addressDetail} onChange={e => set('addressDetail', e.target.value)} />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>사진 첨부 (선택)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['전면', '후면', '측면'].map(side => (
                    <div key={side} style={s.photoBox}>{'📷'} {side}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 인터넷 추가 필드 */}
          {category === 'internet' && (
            <div style={s.section}>
              <div style={s.sectionTitle}>신청 정보</div>
              <div style={s.fieldGroup}>
                <label style={s.label}>신청 유형 <span style={s.required}>*</span></label>
                <div style={s.chipGroup}>
                  {APPLY_TYPES.map(t => (
                    <button key={t} onClick={() => set('applyType', t)} style={{ ...s.chip, ...(form.applyType === t ? s.chipActive : {}) }}>{t}</button>
                  ))}
                </div>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>현재 통신사</label>
                <div style={s.chipGroup}>
                  {CARRIERS.map(c => (
                    <button key={c} onClick={() => set('currentCarrier', c)} style={{ ...s.chip, ...(form.currentCarrier === c ? s.chipActive : {}) }}>{c}</button>
                  ))}
                </div>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>설치 주소 <span style={s.required}>*</span></label>
                <input style={s.input} placeholder="주소를 입력하세요" value={form.address} onChange={e => set('address', e.target.value)} />
                <input style={{ ...s.input, marginTop: 8 }} placeholder="상세 주소 (동/호수)" value={form.addressDetail} onChange={e => set('addressDetail', e.target.value)} />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>희망 설치일 (선택)</label>
                <input style={s.input} type="date" value={form.installDate} onChange={e => set('installDate', e.target.value)} />
              </div>
            </div>
          )}

          {/* 동의 */}
          <div style={s.agreeBox}>
            <div style={{ fontSize: 11, color: '#555', lineHeight: 1.8 }}>
              <div>{'✅'} 개인정보 수집 및 이용에 동��합니다 (필수)</div>
              <div>{'✅'} ���케팅 정보 수신에 동의합니다 (필수)</div>
            </div>
          </div>

          {/* CTA */}
          <button onClick={handleSubmit} disabled={!isValid()} style={{ ...s.cta, opacity: isValid() ? 1 : 0.4 }}>
            {config.cta}
          </button>
        </div>
      ) : (
        /* 완료 화면 */
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'🎉'}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a2744', marginBottom: 8 }}>{config.completionTitle}</div>
          <div style={{ fontSize: 14, color: '#555', marginBottom: 24 }}>{config.completionSub}</div>

          {/* 요약 */}
          <div style={s.summaryCard}>
            {product?.name && <div style={s.summaryRow}><span>상품</span><strong>{product.name}</strong></div>}
            {product?.model && <div style={s.summaryRow}><span>모델</span><strong>{product.model}</strong></div>}
            <div style={s.summaryRow}><span>이름</span><strong>{form.name}</strong></div>
            <div style={s.summaryRow}><span>연락처</span><strong>{form.phone}</strong></div>
            {form.grade && <div style={s.summaryRow}><span>등급</span><strong>{form.grade}등급</strong></div>}
            {form.applyType && <div style={s.summaryRow}><span>유형</span><strong>{form.applyType}</strong></div>}
            {form.address && <div style={s.summaryRow}><span>주소</span><strong>{form.address}</strong></div>}
          </div>

          {/* 진행 바 (중고폰) */}
          {category === 'usedphone' && (
            <div style={{ margin: '20px 0' }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {['신청완료', '검수중', '검수완료', '입금완료'].map((st, i) => (
                  <div key={st} style={{ flex: 1, height: 4, borderRadius: 2, background: i === 0 ? '#2563eb' : '#e8e8e8' }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {['신청완료', '검수중', '검수완료', '입금완료'].map((st, i) => (
                  <span key={st} style={{ fontSize: 9, color: i === 0 ? '#2563eb' : '#999' }}>{st}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600, marginBottom: 24 }}>
            {'📞'} {config.completionNext}
          </div>

          <button onClick={handleClose} style={{ ...s.cta, background: '#1a2744' }}>
            {'💬'} 채팅으로 돌아가기
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

const s = {
  productBanner: {
    background: '#dbeafe', border: '1px solid #bfdbfe', borderRadius: 10,
    padding: 14, marginBottom: 16,
  },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: '#1a2744', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #e8e8e8' },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6, display: 'block' },
  required: { color: '#ef4444' },
  input: {
    width: '100%', height: 48, border: '1.5px solid #d0d0d0', borderRadius: 10,
    padding: '0 14px', fontSize: 14, color: '#1a1a1a', background: '#fafafa',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  },
  chipGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: {
    padding: '8px 14px', borderRadius: 20, border: '1.5px solid #d0d0d0',
    background: '#fff', color: '#555', fontSize: 12, cursor: 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
  },
  chipActive: { background: '#2563eb', color: '#fff', borderColor: '#2563eb', fontWeight: 600 },
  photoBox: {
    flex: 1, height: 60, border: '1.5px dashed #d0d0d0', borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, color: '#999', cursor: 'pointer',
  },
  agreeBox: {
    background: '#f8f9fc', border: '1px solid #e8e8e8', borderRadius: 10,
    padding: 12, marginBottom: 16,
  },
  cta: {
    width: '100%', height: 52, borderRadius: 12, border: 'none',
    background: '#2563eb', color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  summaryCard: {
    background: '#f8f9fc', border: '1px solid #e8e8e8', borderRadius: 10,
    padding: 16, textAlign: 'left', marginBottom: 16,
  },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between', padding: '6px 0',
    fontSize: 13, color: '#555', borderBottom: '1px solid #f0f0f0',
  },
};
