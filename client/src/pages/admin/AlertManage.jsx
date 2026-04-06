import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const HISTORY_DATA = [
  ['2026.04.06 14:30', '카카오', '비회원 가입유도 1차', '이영희', '010-3456-7890', '앱 가입 + 계좌 등록 시 사은품 즉시 지급', '성공'],
  ['2026.04.06 14:00', '앱 푸시', '신청 상태 변경', '홍길동', '010-1234-5678', '신청이 접수되었습니다 (KT0311)', '성공'],
  ['2026.04.06 10:00', '앱 푸시', '포인트 적립', '강민준', '010-0123-4567', '친구초대 가입으로 5,000P 적립!', '성공'],
  ['2026.04.05 16:00', '카카오', '사은품 지급완료', '강민준', '010-0123-4567', '사은품 45만원 입금 완료', '성공'],
  ['2026.04.05 15:00', '앱 푸시', '돈지키미 D-7', '김철수', '010-2345-6789', '렌탈 약정 종료 7일 전입니다', '성공'],
  ['2026.04.05 09:00', '카카오', '비회원 가입유도 2차', '박민수', '010-4567-8901', '사은품 37만원 준비됨 → 앱 가입 → 즉시 입금', '성공'],
  ['2026.04.04 14:00', '앱 푸시', '후기 작성 유도', '홍길동', '010-1234-5678', '계약 완료! 후기 작성하고 15,000P 받으세요', '성공'],
  ['2026.04.04 10:00', '카카오', '비회원 가입유도 3차', '한지민', '010-7890-1234', '사은품이 아직 대기 중이에요', '실패'],
];

const KAKAO_TEMPLATES = [
  {
    title: '비회원 가입유도 1차 — 신청 완료 즉시',
    body: '[봉이모바일] 신청이 완료됐어요!\n앱 가입 + 계좌 등록하면 사은품 즉시 지급됩니다.\n지금 가입하면 5,000P도 드려요!\n→ 지금 가입하기 [링크]',
  },
  {
    title: '비회원 가입유도 2차 — 계약 완료 시',
    body: '[봉이모바일] 계약이 완료됐어요!\n사은품 OO만원이 준비됐어요.\n앱 가입 → 계좌 등록 → 즉시 입금\n→ 지금 받으러 가기 [링크]',
  },
  {
    title: '비회원 가입유도 3차 — D+7 미가입',
    body: '[봉이모바일] 사은품 OO만원이 아직 대기 중이에요!\n계좌 등록 즉시 입금해드려요\n→ 지금 받아가세요! [링크]',
  },
  {
    title: '사은품 지급 완료',
    body: '[봉이모바일] 사은품 OO만원이 입금 완료됐어요!\n입금 계좌: OO은행 ****-****\n봉이모바일을 이용해주셔서 감사합니다',
  },
];

const PUSH_TEMPLATES = [
  '신청 상태 변경',
  '포인트 적립',
  '포인트 출금 완료',
  '돈지키미 알림 (D-90/D-30/D-7/D-1)',
  '후기 작성 유도',
  '사은품 지급 완료',
];

export default function AlertManage() {
  const [activeTab, setActiveTab] = useState('history');
  const [channelFilter, setChannelFilter] = useState('전체');

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={kpiCard}><div style={{ fontSize: 24, fontWeight: 900, color: theme.navy }}>1,248</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>이번달 발송</div></div>
        <div style={kpiCard}><div style={{ fontSize: 24, fontWeight: 900, color: theme.green }}>98.2%</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>성공률</div></div>
        <div style={kpiCard}><div style={{ fontSize: 24, fontWeight: 900, color: theme.orange }}>156</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>카카오 알림톡</div></div>
        <div style={kpiCard}><div style={{ fontSize: 24, fontWeight: 900, color: theme.blue }}>1,092</div><div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>앱 푸시</div></div>
      </div>

      {/* Channel policy info */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14, padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: theme.navy, fontWeight: 600, marginBottom: 6 }}>📌 알림 채널 정책</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11 }}>
          <div>
            <div style={{ fontWeight: 700, color: theme.orange, marginBottom: 4 }}>카카오 알림톡 (유료) — 2가지만</div>
            <div style={{ color: theme.textSecondary, lineHeight: 1.6 }}>
              ① 비회원 가입 유도 (3단계)<br />② 사은품 지급 완료 알림
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: theme.blue, marginBottom: 4 }}>앱 푸시 (무료) — 나머지 전부</div>
            <div style={{ color: theme.textSecondary, lineHeight: 1.6 }}>
              신청 상태 변경 / 포인트 적립·출금 / 돈지키미 (D-90/D-30/D-7/D-1) / 후기 작성 유도
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['history', '발송 이력'], ['template', '템플릿 관리'], ['manual', '수동 발송']].map(([key, label]) => (
          <div key={key} onClick={() => setActiveTab(key)} style={filterBtn(activeTab === key)}>{label}</div>
        ))}
      </div>

      {/* History tab */}
      {activeTab === 'history' && (
        <div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, padding: '8px 0' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: theme.textMuted, width: 40 }}>채널</span>
            {['전체', '카카오 알림톡', '앱 푸시'].map(f => (
              <div key={f} onClick={() => setChannelFilter(f)} style={filterBtn(channelFilter === f)}>{f}</div>
            ))}
            <input style={{ ...input, marginLeft: 'auto', width: 200, marginBottom: 0 }} placeholder="이름 / 전화번호 검색" />
          </div>
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ ...tableStyles.table, fontSize: 11, minWidth: 900 }}>
              <thead>
                <tr>
                  {['발송일시', '채널', '유형', '수신자', '연락처', '내용', '상태', '관리'].map(h => (
                    <th key={h} style={tableStyles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HISTORY_DATA.map(([time, channel, type, name, phone, content, status], i) => (
                  <tr key={i}>
                    <td style={{ ...tableStyles.td, fontSize: 10 }}>{time}</td>
                    <td style={tableStyles.td}>
                      <span style={statusStyle(channel === '카카오' ? 'orange' : 'blue')}>{channel}</span>
                    </td>
                    <td style={{ ...tableStyles.td, fontSize: 10 }}>{type}</td>
                    <td style={{ ...tableStyles.td, fontWeight: 600, color: theme.blue, cursor: 'pointer', textDecoration: 'underline' }}>{name}</td>
                    <td style={{ ...tableStyles.td, fontSize: 10 }}>{phone}</td>
                    <td style={{ ...tableStyles.td, fontSize: 10, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={content}>{content}</td>
                    <td style={tableStyles.td}>
                      <span style={statusStyle(status === '성공' ? 'green' : 'red')}>{status}</span>
                    </td>
                    <td style={tableStyles.td}>
                      {status === '실패' ? (
                        <span style={{ ...button.danger, cursor: 'pointer', fontSize: 10 }} onClick={e => { e.target.textContent = '✅ 재발송완료'; }}>재발송</span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Template tab */}
      {activeTab === 'template' && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.navy, marginBottom: 12, marginTop: 0 }}>카카오 알림톡 템플릿</h3>
          {KAKAO_TEMPLATES.map((t, i) => (
            <div key={i} style={{ ...card, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, color: theme.navy }}>{t.title}</div>
                <span style={{ ...button.secondary, cursor: 'pointer', fontSize: 10 }}>편집</span>
              </div>
              <div style={{ background: theme.bg, borderRadius: 8, padding: 12, fontSize: 12, color: theme.textSecondary, lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {t.body}
              </div>
            </div>
          ))}

          <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.navy, marginBottom: 12, marginTop: 20 }}>앱 푸시 템플릿</h3>
          {PUSH_TEMPLATES.map((t, i) => (
            <div key={i} style={{ ...card, marginBottom: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ ...statusStyle('blue'), fontSize: 10 }}>푸시</span>
                  <strong style={{ marginLeft: 6 }}>{t}</strong>
                </div>
                <span style={{ ...button.secondary, cursor: 'pointer', fontSize: 10 }}>편집</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual send tab */}
      {activeTab === 'manual' && (
        <div>
          <div style={{ ...card, marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.navy, marginBottom: 12, marginTop: 0 }}>📤 수동 발송</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>발송 채널</div>
                <select style={{ ...input, marginBottom: 0 }}>
                  <option>앱 푸시 (무료)</option>
                  <option>카카오 알림톡 (유료)</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>발송 유형</div>
                <select style={{ ...input, marginBottom: 0 }}>
                  <option>실패 건 재발송</option>
                  <option>마케팅/이벤트 공지</option>
                  <option>휴대폰 시세 업데이트</option>
                  <option>긴급 공지</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>발송 대상</div>
                <select style={{ ...input, marginBottom: 0 }}>
                  <option>전체 회원</option>
                  <option>앱회원만</option>
                  <option>특정 조건 (아래 선택)</option>
                  <option>개별 선택</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>타겟 조건 (선택)</div>
                <select style={{ ...input, marginBottom: 0 }}>
                  <option>조건 없음</option>
                  <option>SKT 고객만</option>
                  <option>KT 고객만</option>
                  <option>LG U+ 고객만</option>
                  <option>인터넷+TV 계약자</option>
                  <option>렌탈 계약자</option>
                  <option>중고폰 매입 고객</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>메시지 내용</div>
            <textarea style={{ ...input, height: 80, resize: 'vertical', marginBottom: 12 }} placeholder="발송할 메시지를 입력하세요..." />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: theme.textMuted }}>
                예상 발송 대상: <strong style={{ color: theme.navy }}>1,248명</strong>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ ...button.secondary, cursor: 'pointer', padding: '8px 16px' }}>미리보기</span>
                <span style={{ ...button.primary, cursor: 'pointer', padding: '8px 20px', fontSize: 13 }} onClick={e => { e.target.textContent = '✅ 발송완료'; }}>📤 발송</span>
              </div>
            </div>
          </div>

          <div style={card}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: theme.navy, marginBottom: 10, marginTop: 0 }}>📱 휴대폰 시세 알림 빠른 발송</h3>
            <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>매장별 시세 업데이트 후 관심 고객에게 앱 푸시 발송 (무료)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['📱 전체 회원', 'SKT 고객만', 'KT 고객만', 'LG U+ 고객만'].map((label, i) => (
                <span
                  key={label}
                  style={{ ...(i === 0 ? button.primary : button.secondary), cursor: 'pointer', fontSize: 11 }}
                  onClick={e => { e.target.textContent = '✅ 발송완료'; }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
