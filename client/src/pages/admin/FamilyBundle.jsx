import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

export default function FamilyBundle() {
  const green = theme.green;

  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>

      {/* 안내 배너 */}
      <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe', marginBottom: 14, padding: '10px 16px' }}>
        <div style={{ fontSize: 11, color: theme.navy }}>
          📌 AI가 유저에게 최저가를 보여줄 때 이 결합할인 데이터를 참조합니다. 미결합 요금(상품관리) + 결합할인(여기) + 카드할인 = <strong>최종 최저가</strong>
        </div>
      </div>

      {/* ===== SKT ===== */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ ...statusStyle('red'), fontSize: 12, padding: '4px 10px' }}>SKT</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: theme.text, margin: 0 }}>결합할인</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <span style={{ ...button.success, fontSize: 10, cursor: 'pointer' }}>✏️ 편집</span>
            <span style={{ ...button.primary, fontSize: 10, cursor: 'pointer' }}>+ 등록</span>
          </div>
        </div>

        {/* 요즘가족결합 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 요즘가족결합</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>조건: 같은 명의 인터넷+휴대폰 1대 필수. 동거인 가능. 인터넷 최대 2회선 + 휴대폰 최대 5회선</div>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>인터넷 속도</th>
              <th style={tableStyles.th}>회선수</th>
              <th style={tableStyles.th}>휴대폰할인</th>
              <th style={tableStyles.th}>인터넷할인</th>
              <th style={tableStyles.th}>IPTV할인</th>
              <th style={tableStyles.th}>총할인</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['1G', '5회선', '-24,000', '-13,200', '-1,100', '-38,300'],
              ['1G', '3회선', '-18,000', '-13,200', '-1,100', '-21,300'],
              ['1G', '2회선', '-7,000', '-13,200', '-1,100', '-17,800'],
              ['1G', '1회선', '-3,500', '-13,200', '-1,100', '-7,500'],
              ['500M', '5회선', '-24,000', '-11,000', '-1,100', '-36,100'],
              ['500M', '2회선', '-7,000', '-11,000', '-1,100', '-19,100'],
              ['500M', '1회선', '-3,500', '-11,000', '-1,100', '-15,600'],
              ['100M', '3회선', '-7,000', '-4,400', '-1,100', '-12,500'],
              ['100M', '1회선', '-3,500', '-4,400', '-1,100', '-9,000'],
            ].map(([speed, lines, phone, internet, iptv, total], i) => (
              <tr key={i}>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>{speed}</td>
                <td style={tableStyles.td}>{lines}</td>
                <td style={{ ...tableStyles.td, color: green }}>{phone}</td>
                <td style={{ ...tableStyles.td, color: green }}>{internet}</td>
                <td style={{ ...tableStyles.td, color: green }}>{iptv}</td>
                <td style={{ ...tableStyles.td, color: green, fontWeight: 700 }}>{total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 온가족할인 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8, marginTop: 14 }}>▶ 온가족할인 (2025.8.31~ 현재 적용 중)</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>조건: 가족 가입연수 합산 (미결합 연수만 산정) + 인터넷 실사용연수</div>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 10 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>가입연수 \ 실사용연수</th>
              <th style={tableStyles.th}>1년 미만</th>
              <th style={tableStyles.th}>1~2년</th>
              <th style={tableStyles.th}>2~3년</th>
              <th style={tableStyles.th}>3년 이상</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['10년 미만', '-', '-', '5%', '10%'],
              ['10~20년', '-', '5%', '10%', '20%'],
              ['20~30년', '5%', '10%', '20%', '30%'],
              ['30년 이상', '10%', '20%', '30%', '50%'],
            ].map(([years, y1, y2, y3, y4], i) => (
              <tr key={i}>
                <td style={{ ...tableStyles.td, fontWeight: 600 }}>{years}</td>
                <td style={{ ...tableStyles.td, color: y1 !== '-' ? green : undefined }}>{y1}</td>
                <td style={{ ...tableStyles.td, color: y2 !== '-' ? green : undefined }}>{y2}</td>
                <td style={{ ...tableStyles.td, color: y3 !== '-' ? green : undefined }}>{y3}</td>
                <td style={{ ...tableStyles.td, color: y4 !== '-' ? green : undefined, fontWeight: i === 3 ? 700 : undefined }}>{y4}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: theme.textMuted }}>휴대폰 할인: 30년 미만 10% / 30년 이상 30% &nbsp;|&nbsp; 가족 간 통화료 50% 할인</div>
      </div>

      {/* ===== KT ===== */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ ...statusStyle('blue'), fontSize: 12, padding: '4px 10px' }}>KT</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: theme.text, margin: 0 }}>결합할인</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <span style={{ ...button.success, fontSize: 10, cursor: 'pointer' }}>✏️ 편집</span>
            <span style={{ ...button.primary, fontSize: 10, cursor: 'pointer' }}>+ 등록</span>
          </div>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 프리미엄싱글결합</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>조건: 인터넷 500M 이상 + 휴대폰 77,000원 이상, 각 1대<br />혜택: 휴대폰 25% + 선택약정 25% = 최대 50% + 인터넷 -5,500원</div>

        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 프리미엄가족결합</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>조건: 77,000원 이상 요금제 2~5회선 + 인터넷<br />대표자: 총액할인 -11,000원 / 나머지: 25% 할인 / 인터넷 -5,500원</div>

        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 총액가족결합 (프리미엄/에센스/베이직)</div>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>월요금 합산</th>
              <th style={tableStyles.th}>인터넷할인</th>
              <th style={tableStyles.th}>휴대폰할인</th>
              <th style={tableStyles.th}>총할인</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['22,000원 미만', '-2,200', '0', '-2,200'],
              ['22,000원 이상', '-5,500', '0', '-5,500'],
              ['64,900원 이상', '-5,500', '-5,500', '-11,000'],
              ['108,900원 이상', '-5,500', '-16,610', '-22,110'],
              ['141,900원 이상', '-5,500', '-22,110', '-27,610'],
              ['174,900원 이상', '-5,500', '-27,610', '-33,110'],
            ].map(([sum, inet, phone, total], i) => (
              <tr key={i}>
                <td style={tableStyles.td}>{sum}</td>
                <td style={{ ...tableStyles.td, color: green }}>{inet}</td>
                <td style={{ ...tableStyles.td, color: phone !== '0' ? green : undefined }}>{phone}</td>
                <td style={{ ...tableStyles.td, color: green, fontWeight: 700 }}>{total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 총액가족결합 (인터넷슬림)</div>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>월요금 합산</th>
              <th style={tableStyles.th}>인터넷할인</th>
              <th style={tableStyles.th}>휴대폰할인</th>
              <th style={tableStyles.th}>총할인</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['22,000원 미만', '-1,650', '0', '-1,650'],
              ['22,000원 이상', '-3,300', '0', '-3,300'],
              ['64,900원 이상', '-5,500', '-3,300', '-8,800'],
              ['108,900원 이상', '-5,500', '-14,300', '-19,800'],
              ['174,900원 이상', '-5,500', '-23,100', '-28,600'],
            ].map(([sum, inet, phone, total], i) => (
              <tr key={i}>
                <td style={tableStyles.td}>{sum}</td>
                <td style={{ ...tableStyles.td, color: green }}>{inet}</td>
                <td style={{ ...tableStyles.td, color: phone !== '0' ? green : undefined }}>{phone}</td>
                <td style={{ ...tableStyles.td, color: green, fontWeight: 700 }}>{total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 3G뭉치면올레 / 패밀리결합</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 0 }}>
          3G뭉치면올레: 64,900원 미만 요금제 + 베이직/에센스 인터넷, 최대 5회선. 인터넷 -5,500원 / 휴대폰 최대 -13,200원<br />
          패밀리결합: 인터넷+인터넷 결합 2대까지. 100M: -5,500원 / 500M: -10,000원
        </div>
      </div>

      {/* ===== LG U+ ===== */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ ...statusStyle('green'), fontSize: 12, padding: '4px 10px' }}>LG U+</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: theme.text, margin: 0 }}>결합할인</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <span style={{ ...button.success, fontSize: 10, cursor: 'pointer' }}>✏️ 편집</span>
            <span style={{ ...button.primary, fontSize: 10, cursor: 'pointer' }}>+ 등록</span>
          </div>
        </div>

        {/* 투게더결합 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 투게더결합</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>조건: 5G 85,000원 이상 요금제 + 500M 이상 인터넷. 모바일 5회선, 인터넷 5회선. 선택약정 25% 중복 가능</div>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>회선수</th>
              <th style={tableStyles.th}>휴대폰할인(1인당)</th>
              <th style={tableStyles.th}>인터넷할인(500M+)</th>
              <th style={tableStyles.th}>청소년추가할인</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['2대', '-10,000', '-11,000', '-10,000'],
              ['3대', '-14,000', '-11,000', '-10,000'],
              ['4~5대', '-20,000', '-11,000', '-10,000'],
            ].map(([lines, phone, inet, youth], i) => (
              <tr key={i}>
                <td style={tableStyles.td}>{lines}</td>
                <td style={{ ...tableStyles.td, color: green }}>{phone}</td>
                <td style={{ ...tableStyles.td, color: green }}>{inet}</td>
                <td style={{ ...tableStyles.td, color: green }}>{youth}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 14 }}>추가: 5G 시그니처 가족할인 — 자녀 1대 최대 -33,000원</div>

        {/* 참쉬운가족결합 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 참쉬운가족결합</div>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>조건: 알뜰폰 결합 가능. 휴대폰 10대 + 인터넷 3대까지</div>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 10 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>회선수</th>
              <th style={tableStyles.th}>69,000원 미만</th>
              <th style={tableStyles.th}>69,000원 이상</th>
              <th style={tableStyles.th}>88,000원 이상</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['2대', '-2,200', '-3,300', '-4,400'],
              ['3대', '-3,300', '-5,500', '-6,600'],
              ['4~10대', '-4,400', '-6,600', '-8,800'],
            ].map(([lines, p1, p2, p3], i) => (
              <tr key={i}>
                <td style={tableStyles.td}>{lines}</td>
                <td style={{ ...tableStyles.td, color: green }}>{p1}</td>
                <td style={{ ...tableStyles.td, color: green }}>{p2}</td>
                <td style={{ ...tableStyles.td, color: green }}>{p3}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={tableStyles.th}>인터넷할인(3년약정)</th>
              <th style={tableStyles.th}>할인금액</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['100M', '-5,500원'],
              ['500M', '-9,900원'],
              ['1G', '-13,200원'],
            ].map(([speed, disc], i) => (
              <tr key={i}>
                <td style={tableStyles.td}>{speed}</td>
                <td style={{ ...tableStyles.td, color: green, fontWeight: 700 }}>{disc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 14 }}>알뜰폰 추가할인: 결합한 알뜰폰 대수 x 440원</div>

        {/* 특수 결합 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 특수 결합</div>
        <table style={{ ...tableStyles.table, fontSize: 11, marginBottom: 10 }}>
          <tbody>
            <tr>
              <td style={{ ...tableStyles.td, fontWeight: 600, width: 100 }}>신혼플러스</td>
              <td style={{ ...tableStyles.td, fontSize: 10 }}>예비·신혼부부, 5G 85+/LTE 78+ 요금제</td>
              <td style={{ ...tableStyles.td, color: green, fontWeight: 600 }}>모바일 6개월 무료 + 월 최대 22,850원 할인</td>
            </tr>
            <tr>
              <td style={{ ...tableStyles.td, fontWeight: 600 }}>펫플러스</td>
              <td style={{ ...tableStyles.td, fontSize: 10 }}>스마트홈 결합</td>
              <td style={{ ...tableStyles.td, color: green, fontWeight: 600 }}>공기청정기 렌탈료 최대 21,000원 할인</td>
            </tr>
            <tr>
              <td style={{ ...tableStyles.td, fontWeight: 600 }}>시니어 플러스</td>
              <td style={{ ...tableStyles.td, fontSize: 10 }}>만 65세 이상</td>
              <td style={{ ...tableStyles.td, color: green, fontWeight: 600 }}>인터넷 3,100원 추가 할인</td>
            </tr>
          </tbody>
        </table>

        {/* 패밀리결합 / 알뜰폰 결합 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, marginBottom: 8 }}>▶ 패밀리결합 / 알뜰폰 결합</div>
        <div style={{ fontSize: 11, color: theme.textMuted }}>
          패밀리결합: 인터넷+인터넷 결합 2대까지 / 할인 -5,500원<br />
          알뜰폰 결합: LG망 알뜰폰 36개 통신사, 약 2,200개 요금제. 100M: -5,500 / 500M: -9,900 / 1G: -13,200
        </div>
      </div>
    </div>
  );
}
