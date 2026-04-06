import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const tabs = ['전체', 'AI 운영 가이드', '유선 가입 가이드', '무선 가입 가이드', '사기방지 & 꿀팁'];

export default function GuideManage() {
  const [activeTab, setActiveTab] = useState('전체');

  const showSection = (section) => activeTab === '전체' || activeTab === section;

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>

      {/* 탭 + 액션 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <span key={t} style={filterBtn(activeTab === t)} onClick={() => setActiveTab(t)}>{t}</span>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <span style={{ ...button.success, fontSize: 11, cursor: 'pointer' }}>✏️ 편집</span>
          <span style={{ ...button.primary, fontSize: 11, cursor: 'pointer' }}>+ 항목 추가</span>
        </div>
      </div>

      {/* AI 운영 가이드 */}
      {showSection('AI 운영 가이드') && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ ...statusStyle('blue'), fontSize: 12, padding: '4px 10px' }}>AI 운영 가이드</span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>3개 카테고리 · AI 채팅 흐름 정의</span>
          </div>
          <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={tableStyles.th}>카테고리</th>
                <th style={tableStyles.th}>목적</th>
                <th style={tableStyles.th}>AI 흐름</th>
                <th style={tableStyles.th}>참조 시트</th>
                <th style={tableStyles.th}>AI노출</th>
                <th style={tableStyles.th}>관리</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>🏠 인터넷+TV</td>
                <td style={tableStyles.td}>온라인 상담→CRM→TM</td>
                <td style={tableStyles.td}>AI가 요금제/결합할인 안내→상담신청→TM팀 연락</td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>유선가입가이드 / SKT·KT·LGU+ 유선 / 사기방지</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                <td style={tableStyles.td}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px' }}>수정</span>
                    <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px' }}>삭제</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>📱 휴대폰</td>
                <td style={tableStyles.td}>시세안내+매장유도</td>
                <td style={tableStyles.td}>AI가 기기가격/요금제 안내→"가까운 매장 방문하세요"</td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>모바일요금제 / 무선가이드 / 제휴카드 / 매장정보</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                <td style={tableStyles.td}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px' }}>수정</span>
                    <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px' }}>삭제</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>♻️ 중고폰</td>
                <td style={tableStyles.td}>봉이 자체 페이지에서 매입</td>
                <td style={tableStyles.td}>AI가 등급별 시세 안내(Tredit API)→봉이 자체 신청폼→고객정보 수집→Tredit API로 전달</td>
                <td style={{ ...tableStyles.td, fontSize: 10 }}>중고폰시세(Tredit API) / 매장정보</td>
                <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                <td style={tableStyles.td}>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px' }}>수정</span>
                    <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px' }}>삭제</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div style={{ marginTop: 8, padding: 8, background: '#eff6ff', borderRadius: 6, fontSize: 10, color: theme.navy }}>
            <strong>운영 규칙:</strong> 인터넷+TV=온라인가입 가능 / 휴대폰=매장만(온라인판매X) / 중고폰=봉이 자체 페이지(고객정보 직접 수집→Tredit API 전달, 시세는 Tredit API 수신) / 지원기기: 스마트폰·태블릿·워치·노트북·무선이어폰
          </div>
        </div>
      )}

      {/* 유선 가입 가이드 */}
      {showSection('유선 가입 가이드') && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ ...statusStyle('green'), fontSize: 12, padding: '4px 10px' }}>유선 가입 가이드</span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>13개 주제 · 79행 데이터</span>
          </div>
          <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={tableStyles.th}>주제</th>
                <th style={tableStyles.th}>핵심 내용</th>
                <th style={tableStyles.th}>AI노출</th>
                <th style={tableStyles.th}>관리</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['가입 유형', '신규가입(사은품 최대) / 재약정(사은품 적음) / 통신사변경(신규동일) / 이전설치(사은품 없음)'],
                ['약정 기간', '3년약정 권장(최저가). 100M 22,000/500M 33,000/1G 38,500. 2년=30%↑, 1년=55%↑'],
                ['위약금', '월정액×잔여개월×40%. 예: 1G 1년사용후 해지=369,600원. 만료후=위약금없음'],
                ['속도 가이드', '100M=1~2인(대부분충분) / 500M=3~5인(재택) / 1G=10인+(매장). 체감차이 거의 없음'],
                ['TV 선택', '기본형 추천. OTT는 개별가입이 저렴. KT 238ch>SK 184ch>LG 219ch. 96% 기본형 선택'],
                ['대칭vs비대칭', 'KT 100%대칭 / LGU+ 95% / SK 85%. 업로드속도·Ping 차이. 광케이블=대칭'],
                ['셋톱박스', '기본형 추천(3,300~8,800원). 유튜브/넷플릭스 대부분 지원. 사운드바형은 음질 중시'],
                ['와이파이', 'LGU+ 기본무료(가장유리) / KT 1G무료 / SK 1,100원~. 넓은 집=메시 추천'],
                ['설치비', '평일 인터넷 36,000원 / 인터넷+TV 56,100원. 주말 25%할증. 3년신규 면제 가능'],
                ['가입경로 비교', '본사(상품권10~20만) / 오프라인(상품권10~20만) / 온라인대리점(현금 최대49만)'],
                ['SKT vs SKB', '요금·품질 동일. SKT휴대폰+SKB인터넷 결합 가능. 사은품·제휴카드 차이'],
                ['약정기간 조회', 'KT=kt.com챗봇 / SK=bworld.co.kr챗봇 / LGU+=앱에서 조회'],
              ].map(([topic, content], i) => (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontWeight: 700 }}>{topic}</td>
                  <td style={tableStyles.td}>{content}</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                  <td style={tableStyles.td}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px' }}>수정</span>
                      <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px' }}>삭제</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 무선 가입 가이드 */}
      {showSection('무선 가입 가이드') && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ ...statusStyle('red'), fontSize: 12, padding: '4px 10px' }}>무선 가입 가이드</span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>7개 주제 · 88행 데이터</span>
          </div>
          <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={tableStyles.th}>주제</th>
                <th style={tableStyles.th}>핵심 내용</th>
                <th style={tableStyles.th}>AI노출</th>
                <th style={tableStyles.th}>관리</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['공시지원금', '통신사가 기기값에서 차감. 24개월약정. 고가요금제=높은지원금. 추가15%지원. 월요금=정가'],
                ['선택약정', '월정액 25%할인. 24개월약정. 기기값 전액부담. 유심개통 가능. 결합할인·카드 중복가능'],
                ['공시 vs 선택약정', '기기비쌈+저가요금제=공시 / 기기저렴+고가요금제=선택약정. 유심개통=선택약정만'],
                ['위약금 계산', '공시: (지원금+추가)×잔여/730일. 선택약정: 할인합계×잔여/사용일(사용길수록↑)'],
                ['위약금 면제', '24개월만료 / 군입대(일시정지) / 해외이주 / 사망 / 동일통신사 번호이동'],
                ['요금제 유지의무', '공시=6개월 / 선택약정=4개월 하향변경 불가. 미준수시 사은품환수+페널티. 상향은 자유'],
                ['부가서비스 유지', '3~4개월 의무. T우주패스/필수팩/유플레이 등. 미유지시 사은품환수. 만료후 즉시 해지 권장'],
              ].map(([topic, content], i) => (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontWeight: 700 }}>{topic}</td>
                  <td style={tableStyles.td}>{content}</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                  <td style={tableStyles.td}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px' }}>수정</span>
                      <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px' }}>삭제</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 사기방지 & 꿀팁 */}
      {showSection('사기방지 & 꿀팁') && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ ...statusStyle('orange'), fontSize: 12, padding: '4px 10px' }}>사기방지 & 꿀팁</span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>6개 주제 · 55행 데이터</span>
          </div>
          <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 0 }}>
            <thead>
              <tr>
                <th style={tableStyles.th}>주제</th>
                <th style={tableStyles.th}>핵심 내용</th>
                <th style={tableStyles.th}>AI노출</th>
                <th style={tableStyles.th}>관리</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['인터넷 피싱 5유형', '①위약금대납 ②허위설치업체 ③사기후역협박 ④허위기관사칭 ⑤단기갈아타기. 의지무관 연락=사기'],
                ['비교사이트 선택', '①상담 진정성 ②가입후 책임감 ③소비자 존중. 사은품만 비교X, 전후 태도 관찰'],
                ['대칭vs비대칭', 'KT100%/LGU+95%/SK85% 대칭형. 확인: 속도측정·모뎀케이블·FTTH여부'],
                ['약정조회 방법', 'KT=kt.com챗봇 / SK=bworld.co.kr챗봇 / LGU+=앱. 만료후 재약정or신규 선택'],
                ['결합할인 꿀팁', '가족아니어도 가능(친구/동거인/사실혼). 알뜰폰도 가능. 1대만해도 할인. 선택약정25%중복'],
                ['휴대폰 사기방지', '카드할인/선택약정=통신사·카드사 제도(매장X). 순수 매장지원금(현금)만 비교. 완납이 깔끔'],
              ].map(([topic, content], i) => (
                <tr key={i}>
                  <td style={{ ...tableStyles.td, fontWeight: 700 }}>{topic}</td>
                  <td style={tableStyles.td}>{content}</td>
                  <td style={tableStyles.td}><span style={statusStyle('green')}>ON</span></td>
                  <td style={tableStyles.td}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      <span style={{ ...button.secondary, fontSize: 10, padding: '3px 8px' }}>수정</span>
                      <span style={{ ...button.danger, fontSize: 10, padding: '3px 8px' }}>삭제</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
