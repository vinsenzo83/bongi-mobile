import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard } from '../../styles/admin-theme.js';

const periodOptions = ['오늘', '이번주', '이번달', '전체'];

export default function Statistics() {
  const [period, setPeriod] = useState('오늘');

  const chartBox = {
    background: '#f8fafc',
    border: `1px dashed ${theme.border}`,
    borderRadius: 8,
    position: 'relative',
  };

  return (
    <div>
      {/* 기간 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {periodOptions.map(p => (
          <div key={p} style={filterBtn(period === p)} onClick={() => setPeriod(p)}>{p}</div>
        ))}
        <input type="date" defaultValue="2026-04-04" style={{ marginLeft: 8, padding: '4px 8px', border: `1px solid ${theme.border}`, borderRadius: 6, fontSize: 12 }} />
        <span style={{ fontSize: 12 }}>~</span>
        <input type="date" defaultValue="2026-04-06" style={{ padding: '4px 8px', border: `1px solid ${theme.border}`, borderRadius: 6, fontSize: 12 }} />
        <div style={{ ...button.primary, height: 28, width: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, borderRadius: 6, cursor: 'pointer' }}>조회</div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: theme.textMuted }}>기준: 2026.04.06 14:30</div>
      </div>

      {/* 핵심 KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 }}>
        <div style={kpiCard}>
          <div style={{ fontSize: 22, fontWeight: 900, color: theme.blue }}>9</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>총 회원</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>앱 5 / 비회원 4</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 22, fontWeight: 900, color: theme.navy }}>10</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>총 신청</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>04.04~04.06</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 22, fontWeight: 900, color: theme.green }}>3</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>계약 완료</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>전환율 30%</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 22, fontWeight: 900, color: theme.orange }}>162만</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>총 사은품</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>지급완료 97만</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 22, fontWeight: 900, color: theme.red }}>68,000</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>포인트 발행(P)</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>출금 90,000P</div>
        </div>
        <div style={kpiCard}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#8b5cf6' }}>6</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>후기</div>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>평균 4.7점</div>
        </div>
      </div>

      {/* 차트 Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>일별 신청·계약 추이</div>
          <div style={{ ...chartBox, height: 180 }}>
            <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: theme.textMuted }}>
              <span>04.04</span><span>04.05</span><span>04.06</span>
            </div>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, display: 'flex', gap: 12 }}>
              <span style={{ color: theme.blue }}>● 신청</span>
              <span style={{ color: theme.green }}>● 계약</span>
            </div>
            <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', fontSize: 11, color: theme.textMuted }}>
              04.04: 신청 1건 / 계약 0건<br />
              04.05: 신청 4건 / 계약 2건<br />
              04.06: 신청 5건 / 계약 1건
            </div>
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>채널별 신청 비율</div>
          <div style={{ ...chartBox, height: 180 }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: theme.textMuted }}>도넛 차트</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: theme.navy, margin: '4px 0' }}>10건</div>
            </div>
            <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', justifyContent: 'center', gap: 16, fontSize: 11 }}>
              <span style={{ color: theme.blue }}>● 셀프신청 4건 (40%)</span>
              <span style={{ color: theme.green }}>● 티켓 2건 (20%)</span>
              <span style={{ color: theme.orange }}>● CRM등록 4건 (40%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 상품별 계약 현황 + 통신사별 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>상품 카테고리별 현황</div>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>카테고리</th>
                <th style={tableStyles.th}>신청</th>
                <th style={tableStyles.th}>계약완료</th>
                <th style={tableStyles.th}>상담중</th>
                <th style={tableStyles.th}>신청완료</th>
                <th style={tableStyles.th}>취소</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>인터넷+TV (SKT)</td>
                <td style={tableStyles.td}>2</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>0</td>
                <td style={{ ...tableStyles.td, color: theme.orange }}>0</td>
                <td style={{ ...tableStyles.td, color: theme.blue }}>1</td>
                <td style={{ ...tableStyles.td, color: theme.red }}>1</td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>인터넷+TV (KT)</td>
                <td style={tableStyles.td}>3</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>0</td>
                <td style={{ ...tableStyles.td, color: theme.orange }}>2</td>
                <td style={{ ...tableStyles.td, color: theme.blue }}>1</td>
                <td style={tableStyles.td}>0</td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>인터넷+TV (LG U+)</td>
                <td style={tableStyles.td}>2</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>1</td>
                <td style={{ ...tableStyles.td, color: theme.orange }}>1</td>
                <td style={tableStyles.td}>0</td>
                <td style={tableStyles.td}>0</td>
              </tr>
              <tr style={{ background: '#f1f5f9' }}>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>인터넷+TV 소계</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>7</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>1</td>
                <td style={{ ...tableStyles.td, color: theme.orange, fontWeight: 700 }}>3</td>
                <td style={{ ...tableStyles.td, color: theme.blue, fontWeight: 700 }}>2</td>
                <td style={{ ...tableStyles.td, color: theme.red, fontWeight: 700 }}>1</td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>인터넷 (SKT)</td>
                <td style={tableStyles.td}>1</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>0</td>
                <td style={tableStyles.td}>0</td>
                <td style={{ ...tableStyles.td, color: theme.blue }}>1</td>
                <td style={tableStyles.td}>0</td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>인터넷 (KT)</td>
                <td style={tableStyles.td}>0</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>0</td>
                <td style={tableStyles.td}>0</td>
                <td style={tableStyles.td}>0</td>
                <td style={tableStyles.td}>0</td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>인터넷 (LG U+)</td>
                <td style={tableStyles.td}>0</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>0</td>
                <td style={tableStyles.td}>0</td>
                <td style={tableStyles.td}>0</td>
                <td style={tableStyles.td}>0</td>
              </tr>
              <tr style={{ background: '#f1f5f9' }}>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>인터넷 소계</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>1</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>0</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>0</td>
                <td style={{ ...tableStyles.td, color: theme.blue, fontWeight: 700 }}>1</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>0</td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>렌탈</td>
                <td style={tableStyles.td}>2</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>2</td>
                <td style={tableStyles.td}>0</td>
                <td style={tableStyles.td}>0</td>
                <td style={tableStyles.td}>0</td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>중고폰 매입</td>
                <td style={tableStyles.td}>0</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>0</td>
                <td style={tableStyles.td}>0</td>
                <td style={tableStyles.td}>0</td>
                <td style={tableStyles.td}>0</td>
              </tr>
              <tr style={{ background: '#dbeafe' }}>
                <td style={{ ...tableStyles.td, fontWeight: 900 }}>전체 합계</td>
                <td style={{ ...tableStyles.td, fontWeight: 900 }}>10</td>
                <td style={{ ...tableStyles.td, fontWeight: 900, color: theme.green }}>3</td>
                <td style={{ ...tableStyles.td, fontWeight: 900, color: theme.orange }}>3</td>
                <td style={{ ...tableStyles.td, fontWeight: 900, color: theme.blue }}>3</td>
                <td style={{ ...tableStyles.td, fontWeight: 900, color: theme.red }}>1</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>통신사별 점유율 (인터넷+TV+인터넷)</div>
          <div style={{ ...chartBox, height: 120 }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '80%', gap: 30, padding: '10px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 50, background: theme.red, borderRadius: '4px 4px 0 0', height: 55 }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>SKT 3건 (38%)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 50, background: theme.blue, borderRadius: '4px 4px 0 0', height: 55 }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>KT 3건 (38%)</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 50, background: '#e11d48', borderRadius: '4px 4px 0 0', height: 40 }}></div>
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>LG U+ 2건 (24%)</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>채널별 전환율</div>
            <table style={{ ...tableStyles.table, marginBottom: 0 }}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>채널</th>
                  <th style={tableStyles.th}>신청</th>
                  <th style={tableStyles.th}>계약</th>
                  <th style={tableStyles.th}>전환율</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tableStyles.td}>셀프신청</td>
                  <td style={tableStyles.td}>4</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.green }}>1</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.navy }}>25.0%</td>
                </tr>
                <tr>
                  <td style={tableStyles.td}>티켓</td>
                  <td style={tableStyles.td}>2</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.green }}>0</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.navy }}>0%</td>
                </tr>
                <tr>
                  <td style={tableStyles.td}>CRM등록</td>
                  <td style={tableStyles.td}>4</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.green }}>2</td>
                  <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.navy }}>50.0%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 3: 포인트 + 사은품 + 회원 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>포인트 현황</div>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>구분</th>
                <th style={tableStyles.th}>건수</th>
                <th style={tableStyles.th}>금액</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableStyles.td}>발행(적립)</td>
                <td style={tableStyles.td}>17건</td>
                <td style={{ ...tableStyles.td, color: theme.blue, fontWeight: 700 }}>68,000P</td>
              </tr>
              <tr>
                <td style={tableStyles.td}>출금(승인)</td>
                <td style={tableStyles.td}>3건</td>
                <td style={{ ...tableStyles.td, color: theme.orange, fontWeight: 700 }}>90,000P</td>
              </tr>
              <tr>
                <td style={tableStyles.td}>출금(반려)</td>
                <td style={tableStyles.td}>1건</td>
                <td style={{ ...tableStyles.td, color: theme.red, fontWeight: 700 }}>5,000P</td>
              </tr>
              <tr>
                <td style={tableStyles.td}>차감(만료)</td>
                <td style={tableStyles.td}>1건</td>
                <td style={{ ...tableStyles.td, color: theme.textMuted, fontWeight: 700 }}>1,000P</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6 }}>
            현재 잔여: 홍길동 52KP / 김철수 7KP / 최지은 1KP / 윤서연 2KP<br />
            적립 단가: 가입 5,000P / 초대가입 3,000P / 초대계약 최대 20,000P / 후기 15,000P
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>사은품 지급 현황</div>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>상태</th>
                <th style={tableStyles.th}>건수</th>
                <th style={tableStyles.th}>금액</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableStyles.td}><span style={statusStyle('green')}>지급완료</span></td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>3건</td>
                <td style={tableStyles.td}>970,000원</td>
              </tr>
              <tr>
                <td style={tableStyles.td}><span style={statusStyle('orange')}>지급대기</span></td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>2건</td>
                <td style={tableStyles.td}>650,000원</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>
            지급완료: 홍길동 KT 37만 / 홍길동 렌탈 15만 / 강민준 KT 45만<br />
            지급대기: 이영희 LGU+ 40만(앱가입필요) / 박민수 KT 25만(계좌미등록)
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>회원 현황</div>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>구분</th>
                <th style={tableStyles.th}>인원</th>
                <th style={tableStyles.th}>비율</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableStyles.td}>앱회원</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.blue }}>5명</td>
                <td style={tableStyles.td}>55.6%</td>
              </tr>
              <tr>
                <td style={tableStyles.td}>비회원</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.textMuted }}>4명</td>
                <td style={tableStyles.td}>44.4%</td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>전체</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>9명</td>
                <td style={tableStyles.td}>100%</td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 8, fontSize: 10, color: theme.textMuted }}>
            PASS인증 완료: 5명 / 계좌등록: 4명 / 주소등록: 3명
          </div>
          <div style={{ marginTop: 4, padding: 6, background: theme.orangeBg, borderRadius: 6, fontSize: 11 }}>
            사은품 대기 중 비회원: <strong style={{ color: theme.orange }}>2명</strong> (이영희, 박민수)
          </div>
        </div>
      </div>

      {/* Row 4: 알림 + 돈지키미 + 후기 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>알림 발송 통계</div>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>채널</th>
                <th style={tableStyles.th}>발송</th>
                <th style={tableStyles.th}>성공</th>
                <th style={tableStyles.th}>실패</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableStyles.td}>앱 푸시</td>
                <td style={tableStyles.td}>4</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>4</td>
                <td style={{ ...tableStyles.td, color: theme.textMuted }}>0</td>
              </tr>
              <tr>
                <td style={tableStyles.td}>카카오톡</td>
                <td style={tableStyles.td}>4</td>
                <td style={{ ...tableStyles.td, color: theme.green, fontWeight: 700 }}>3</td>
                <td style={{ ...tableStyles.td, color: theme.red, fontWeight: 700 }}>1</td>
              </tr>
              <tr style={{ background: '#f1f5f9' }}>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>합계</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>8</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.green }}>7</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.red }}>1</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>
            카카오: 비회원 가입유도 3건 + 사은품 지급완료 1건<br />
            앱푸시: 상태변경 1 / 포인트 1 / 돈지키미 1 / 후기유도 1<br />
            실패: 한지민 (비회원 가입유도 3차)
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>돈지키미 현황</div>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>회원</th>
                <th style={tableStyles.th}>항목</th>
                <th style={tableStyles.th}>D-day</th>
                <th style={tableStyles.th}>알림</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableStyles.td}>홍길동</td>
                <td style={tableStyles.td}>인터넷 약정</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>D-363</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
              </tr>
              <tr>
                <td style={tableStyles.td}>홍길동</td>
                <td style={tableStyles.td}>정수기 렌탈</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>D-1071</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
              </tr>
              <tr>
                <td style={tableStyles.td}>이영희</td>
                <td style={tableStyles.td}>인터넷 약정</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>D-1094</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
              </tr>
              <tr>
                <td style={tableStyles.td}>이영희</td>
                <td style={tableStyles.td}>공기청정기 렌탈</td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>D-1077</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>
            총 4건 활성 / D-90 이내 0건 / D-30 이내 0건
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>후기 통계</div>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>작성자</th>
                <th style={tableStyles.th}>상품</th>
                <th style={tableStyles.th}>별점</th>
                <th style={tableStyles.th}>사진</th>
                <th style={tableStyles.th}>AI노출</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableStyles.td}>홍길동</td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>KT 인터넷+TV</td>
                <td style={tableStyles.td}>⭐5</td>
                <td style={tableStyles.td}>2장</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
              </tr>
              <tr>
                <td style={tableStyles.td}>김철수</td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>SKT 인터넷+TV</td>
                <td style={tableStyles.td}>⭐4</td>
                <td style={tableStyles.td}>1장</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
              </tr>
              <tr>
                <td style={tableStyles.td}>강민준</td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>KT 인터넷+TV</td>
                <td style={tableStyles.td}>⭐5</td>
                <td style={tableStyles.td}>3장</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
              </tr>
              <tr>
                <td style={tableStyles.td}>홍길동</td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>렌탈 공기청정기</td>
                <td style={tableStyles.td}>⭐4</td>
                <td style={tableStyles.td}>-</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
              </tr>
              <tr>
                <td style={tableStyles.td}>이영희</td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>LGU+ 인터넷+TV</td>
                <td style={tableStyles.td}>⭐5</td>
                <td style={tableStyles.td}>1장</td>
                <td style={tableStyles.td}><span style={statusStyle('gray')}>OFF</span></td>
              </tr>
              <tr>
                <td style={tableStyles.td}>권홍석</td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>중고폰 매입</td>
                <td style={tableStyles.td}>⭐5</td>
                <td style={tableStyles.td}>-</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>
            총 6건 / 평균 <strong>4.7</strong>점 / AI노출 ON 5건 / 사진첨부 4건
          </div>
        </div>
      </div>

      {/* Row 5: 회원 가입 추이 + 매장 현황 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>회원 가입 추이</div>
          <div style={{ ...chartBox, height: 140 }}>
            <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: theme.textMuted }}>
              <span>01월</span><span>02월</span><span>03월</span><span>04월</span>
            </div>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, display: 'flex', gap: 12 }}>
              <span style={{ color: theme.blue }}>● 앱회원</span>
              <span style={{ color: theme.textMuted }}>● 비회원</span>
            </div>
            <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', fontSize: 11, color: theme.textMuted }}>
              1월: 강민준(앱)<br />2월: 최지은(앱), 윤서연(앱), 박민수(비)<br />
              3월: 김철수(앱), 이영희(비), 한지민(비)<br />4월: 홍길동(앱), 권홍석(비)
            </div>
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>매장 현황</div>
          <table style={{ ...tableStyles.table, marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={tableStyles.th}>매장</th>
                <th style={tableStyles.th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {['봉이모바일 상무점','봉이모바일 익산점','봉이모바일 전대점','봉이모바일 신창점','봉이모바일 첨단점','봉이모바일 순천점','봉이모바일 남악점','봉이모바일 여수점'].map((store, i) => (
                <tr key={i}>
                  <td style={tableStyles.td}>{store}</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>운영중</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 6 }}>총 8개 직영매장 운영</div>
        </div>
      </div>
    </div>
  );
}
