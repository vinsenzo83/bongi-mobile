import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard } from '../../styles/admin-theme.js';

export default function Dashboard() {
  // findAndOpenMember placeholder — navigates to Members page in real app
  const handleMemberClick = (name) => {
    alert(`회원 상세: ${name} — 회원 관리 페이지에서 확인하세요`);
  };

  const [resendDone, setResendDone] = useState(false);

  const nameLink = { fontWeight: 600, color: theme.blue, cursor: 'pointer', textDecoration: 'underline' };

  return (
    <div>
      {/* KPI Cards - 5개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={{ ...kpiCard }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: theme.navy }}>5</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginTop: 4 }}>오늘 신규 신청</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>04.06 기준</div>
        </div>
        <div style={{ ...kpiCard }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: theme.navy }}>10</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginTop: 4 }}>총 신청</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>계약3 / 상담3 / 대기3 / 취소1</div>
        </div>
        <div style={{ ...kpiCard }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: theme.orange }}>3</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginTop: 4 }}>상담중 (CRM)</div>
          <div style={{ fontSize: 10, color: theme.orange, marginTop: 2 }}>김철수 · 박민수 · 한지민</div>
        </div>
        <div style={{ ...kpiCard }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: theme.navy }}>9</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginTop: 4 }}>총 회원</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>앱 5 / 비회원 4</div>
        </div>
        <div style={{ ...kpiCard }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: theme.green }}>0</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginTop: 4 }}>돈지키미 임박</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>D-30 이내 없음</div>
        </div>
      </div>

      {/* CRM 동기화 상태 */}
      <div style={{ ...card, background: theme.greenBg, borderColor: '#6ee7b7', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46' }}>CRM 동기화 상태</div>
            <div style={{ fontSize: 11, color: '#065f46', marginTop: 2 }}>마지막 동기화: 방금 전 · 모든 채널 정상</div>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#065f46' }}>
            <span>어드민→CRM: <strong>6건</strong></span>
            <span>CRM→어드민: <strong>4건</strong></span>
            <span style={statusStyle('green')}>정상</span>
          </div>
        </div>
      </div>

      {/* 액션 필요 알림 — 3열 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        {/* 사은품 지급 현황 */}
        <div style={{ ...card, borderLeft: `3px solid ${theme.orange}`, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.orange, marginBottom: 6 }}>사은품 지급 현황</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>지급완료</span><strong style={{ color: theme.green }}>3건 (97만)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span>지급대기</span><strong style={{ color: theme.orange }}>2건 (65만)</strong>
          </div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4 }}>이영희 40만 · 박민수 25만</div>
        </div>

        {/* 포인트 출금 */}
        <div style={{ ...card, borderLeft: `3px solid ${theme.blue}`, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.blue, marginBottom: 6 }}>포인트 출금</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>승인완료</span><strong style={{ color: theme.green }}>3건 (90,000P)</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span>반려</span><strong style={{ color: theme.red }}>1건 (5,000P)</strong>
          </div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4 }}>박민수 — 본인인증 미완료</div>
        </div>

        {/* 알림 실패 */}
        <div style={{ ...card, borderLeft: `3px solid ${theme.red}`, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.red, marginBottom: 6 }}>알림 실패</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: theme.red, marginBottom: 4 }}>1건</div>
          <div style={{ fontSize: 10, color: theme.textMuted }}>한지민 · 카카오톡<br />비회원 가입유도 3차</div>
          <span
            onClick={() => setResendDone(true)}
            style={{ ...button.danger, fontSize: 10, marginTop: 4, display: 'inline-block', cursor: 'pointer' }}
          >
            {resendDone ? '✅ 재발송완료' : '재발송'}
          </span>
        </div>
      </div>

      {/* 2열 레이아웃: 최근 신청 + 우측 카드들 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* 좌측: 최근 신청 현황 */}
        <div style={{ ...card }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>최근 신청 현황 (전 채널 통합)</div>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>시간</th>
                <th style={tableStyles.th}>이름</th>
                <th style={tableStyles.th}>유형</th>
                <th style={tableStyles.th}>채널</th>
                <th style={tableStyles.th}>상품</th>
                <th style={tableStyles.th}>상태</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>04.06 14:23</td>
                <td style={{ ...tableStyles.td, ...nameLink }} onClick={() => handleMemberClick('홍길동')}>홍길동</td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('green'), fontSize: 10 }}>앱회원</span></td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('blue'), fontSize: 10 }}>셀프신청</span></td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>SKT 500M+Btv이코노미</td>
                <td style={tableStyles.td}><span style={statusStyle('blue')}>신청완료</span></td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>04.06 13:55</td>
                <td style={{ ...tableStyles.td, ...nameLink }} onClick={() => handleMemberClick('김철수')}>김철수</td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('green'), fontSize: 10 }}>앱회원</span></td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('navy'), fontSize: 10 }}>티켓</span></td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>KT 1G+지니TV모든G</td>
                <td style={tableStyles.td}><span style={statusStyle('orange')}>상담중</span></td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>04.06 13:12</td>
                <td style={{ ...tableStyles.td, ...nameLink }} onClick={() => handleMemberClick('이영희')}>이영희</td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('orange'), fontSize: 10 }}>비회원</span></td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('blue'), fontSize: 10 }}>셀프신청</span></td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>LG U+ 500M+프리미엄</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>계약완료</span></td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>04.06 12:40</td>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>박민수</td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('orange'), fontSize: 10 }}>비회원</span></td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('orange'), fontSize: 10 }}>CRM등록</span></td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>KT 인터넷+TV (미정)</td>
                <td style={tableStyles.td}><span style={statusStyle('orange')}>상담중</span></td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>04.06 11:30</td>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>최지은</td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('green'), fontSize: 10 }}>앱회원</span></td>
                <td style={tableStyles.td}><span style={{ ...statusStyle('orange'), fontSize: 10 }}>CRM등록</span></td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>SKT 인터넷 (미정)</td>
                <td style={tableStyles.td}><span style={statusStyle('blue')}>신청완료</span></td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>오늘 5건 / 어제 4건 (정수민·한지민·윤서연·임도현) / 그저께 1건 (강민준)</div>
        </div>

        {/* 우측 */}
        <div>
          {/* 비회원 → 앱가입 유도 */}
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 0 }}>비회원 → 앱가입 유도 (사은품 대기)</div>
              <span style={{ ...button.primary, cursor: 'pointer' }}>알림톡 일괄</span>
            </div>
            <table style={{ ...tableStyles.table, marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>이름</th>
                  <th style={tableStyles.th}>채널</th>
                  <th style={tableStyles.th}>사은품</th>
                  <th style={tableStyles.th}>사유</th>
                  <th style={tableStyles.th}>알림</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tableStyles.td, ...nameLink }} onClick={() => handleMemberClick('이영희')}>이영희</td>
                  <td style={tableStyles.td}>셀프신청</td>
                  <td style={tableStyles.td}>40만</td>
                  <td style={{ ...tableStyles.td, color: theme.red, fontSize: 10 }}>앱가입 필요 + 계좌 미등록</td>
                  <td style={tableStyles.td}><span style={statusStyle('orange')}>1차 발송</span></td>
                </tr>
                <tr>
                  <td style={{ ...tableStyles.td, fontWeight: 600 }}>박민수</td>
                  <td style={tableStyles.td}>CRM등록</td>
                  <td style={tableStyles.td}>25만</td>
                  <td style={{ ...tableStyles.td, color: theme.red, fontSize: 10 }}>계좌 미등록</td>
                  <td style={tableStyles.td}><span style={statusStyle('orange')}>2차 발송</span></td>
                </tr>
                <tr>
                  <td style={{ ...tableStyles.td, fontWeight: 600 }}>한지민</td>
                  <td style={tableStyles.td}>CRM등록</td>
                  <td style={tableStyles.td}>-</td>
                  <td style={{ ...tableStyles.td, color: theme.textMuted, fontSize: 10 }}>상담중 (미확정)</td>
                  <td style={tableStyles.td}><span style={statusStyle('red')}>실패</span></td>
                </tr>
                <tr>
                  <td style={{ ...tableStyles.td, fontWeight: 600 }}>권홍석</td>
                  <td style={tableStyles.td}>중고폰</td>
                  <td style={tableStyles.td}>-</td>
                  <td style={{ ...tableStyles.td, color: theme.textMuted, fontSize: 10 }}>앱 미가입</td>
                  <td style={tableStyles.td}><span style={{ ...statusStyle('gray') }}>미발송</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 돈지키미 약정 현황 */}
          <div style={{ ...card }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: theme.navy, marginBottom: 10 }}>돈지키미 약정 현황</div>
            <table style={{ ...tableStyles.table, marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>고객</th>
                  <th style={tableStyles.th}>항목</th>
                  <th style={tableStyles.th}>D-day</th>
                  <th style={tableStyles.th}>알림</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...tableStyles.td, ...nameLink }} onClick={() => handleMemberClick('홍길동')}>홍길동</td>
                  <td style={tableStyles.td}>인터넷 약정</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700 }}>D-363</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                </tr>
                <tr>
                  <td style={{ ...tableStyles.td, ...nameLink }} onClick={() => handleMemberClick('홍길동')}>홍길동</td>
                  <td style={tableStyles.td}>정수기 렌탈</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700 }}>D-1071</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                </tr>
                <tr>
                  <td style={{ ...tableStyles.td, ...nameLink }} onClick={() => handleMemberClick('이영희')}>이영희</td>
                  <td style={tableStyles.td}>인터넷 약정</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700 }}>D-1094</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                </tr>
                <tr>
                  <td style={{ ...tableStyles.td, ...nameLink }} onClick={() => handleMemberClick('이영희')}>이영희</td>
                  <td style={tableStyles.td}>공기청정기 렌탈</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700 }}>D-1077</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                </tr>
              </tbody>
            </table>
            <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>총 4건 활성 · D-90 이내 0건 · 임박 고객 없음</div>
          </div>
        </div>
      </div>
    </div>
  );
}
