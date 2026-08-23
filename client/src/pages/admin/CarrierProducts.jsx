import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { theme, statusStyle, tableStyles, card, button, filterBtn } from '../../styles/admin-theme.js';

/* ─── 통신사별 데이터 (wireframe 그대로) ─── */
const carrierConfig = {
  skt: {
    key: 'SKT', label: 'SKT', color: 'red', statusBg: '#fee2e2',
    internet: [
      { name: '인터넷', m100: '22,000', m500: '33,000', g1: '38,500' },
    ],
    tv: [
      { name: 'Btv 이코노미', ch: '184', alone: '12,100', bundle: '9,900' },
      { name: 'Btv 스탠다드', ch: '236', alone: '15,400', bundle: '13,200' },
      { name: 'Btv 올', ch: '252', alone: '18,700', bundle: '16,500' },
      { name: 'Btv 올+', ch: '252+', alone: '24,200', bundle: '22,000' },
      { name: 'Btv 올 넷플릭스 프리미엄', ch: '252+', alone: '33,200', bundle: '31,000' },
    ],
    tvHeader: { col3: 'TV 단독', col4: '인터넷 결합 시' },
    tvSubtitle: '📺 TV 요금 (부가세 포함, 셋톱 별도)',
    gifts: [
      { name: '인터넷', m100: '11만', m500: '17만', g1: '17만' },
      { name: '인터넷+Btv 이코노미', m100: '40만', m500: '43만', g1: '49만' },
      { name: '인터넷+Btv 스탠다드', m100: '40만', m500: '43만', g1: '49만' },
      { name: '인터넷+Btv 올', m100: '40만', m500: '43만', g1: '49만' },
      { name: '인터넷+Btv 올 넷플릭스', m100: '40만', m500: '43만', g1: '49만' },
    ],
    giftTitle: '🎁 SKT 사은품 (현금)',
    cards: {
      title: '💳 SKT/SKB 유선 제휴카드',
      headers: ['카드명', '발급사', '적용', '1구간', '1구간 할인', '2구간', '2구간 할인', '3구간', '3구간 할인', '연회비'],
      rows: [
        ['더 심플 하나카드', '하나카드', 'SKT·SKB 공통', '30만↑', '10,000', '80만↑', '15,000', '-', '-', '25,000원'],
        ['T나는혜택 삼성카드', '삼성카드', 'SKT·SKB 공통', '30만↑', '7~10,000', '70만↑', '10~13,000', '120만↑', '13~16,000', '20,000원'],
        ['SK브로드밴드 B롯데카드', '롯데카드', 'SKB 전용', '30만↑', '11,000', '50만↑', '13,000', '100만↑', '20,000', '5~10,000원'],
      ],
    },
    settop: {
      title: '📦 SKT 셋톱박스 + OTT 지원',
      headers: ['셋톱박스명', '월 임대료', '특징', '유튜브', '넷플릭스', '디즈니+', '웨이브', '왓챠', '티빙', '애플TV'],
      rows: [
        ['스마트3 미니', '4,400원', '기본형', 'O', 'X', 'O', 'O', 'O', 'O', 'X'],
        ['AI NUGU', '6,600원', 'AI 음성인식', 'O', 'X', 'O', 'O', 'O', 'O', 'O'],
        ['사운드 맥스', '8,800원', '사운드바형', 'O', 'X', 'X', 'X', 'X', 'X', 'X'],
        ['애플TV', '6,600원', '앱설치, 아이폰호환', 'O', 'O', 'O', 'O', 'O', 'O', 'O'],
      ],
    },
    wifi: {
      title: '📡 SKT 와이파이',
      headers: ['와이파이명', '특징', '100M', '500M', '1G'],
      rows: [
        ['GIGA WiFi', '기본형', '기본제공', '기본제공', '기본제공'],
        ['GIGA WiFi 6', 'WiFi-6 적용', '1,100원', '1,100원', '1,100원'],
        ['GIGA WiFi 프리미엄', '고급형 최대 1.7Gbps', { colSpan: 3, text: '인터넷 결합 5,500원 / 인터넷+TV 3,300원' }],
        ['윙즈', '와이파이 증폭기기', '1,650원', '1,650원', '1,650원'],
      ],
    },
    install: {
      title: '🔧 SKT 설치비',
      headers: ['항목', '평일', '주말'],
      rows: [
        ['인터넷 단독', '36,000원', '45,000원'],
        ['인터넷 (TV 동시)', '34,100원', '42,620원'],
        ['IPTV', '22,000원', '27,500원'],
        ['인터넷+TV', '56,100원', '70,120원'],
        ['TV추가 (1대당)', '+17,600원', '+22,000원'],
        ['인터넷전화 (동시)', '+13,200원', '+13,200원'],
      ],
    },
    phone: {
      title: '📞 SKT 집전화',
      headers: ['요금제', '월요금', '비고'],
      rows: [
        ['집전화 프리 5000', '전화단독 7,700 / 인터넷결합 4,400 / 인터넷+TV 2,200', '발신자 번호표시(CID)'],
        ['전화기본 요금제', '3년 약정 2,200원', '-'],
        ['무료100 (정액형)', '3년 약정 6,600원', '무료통화 최대 100분'],
      ],
    },
  },
  kt: {
    key: 'KT', label: 'KT', color: 'blue', statusBg: '#dbeafe',
    internet: [
      { name: '인터넷', m100: '22,000', m500: '33,000', g1: '38,500' },
    ],
    tv: [
      { name: '지니TV 베이직', ch: '238', alone: '18,150', bundle: '16,500' },
      { name: '지니TV 라이트', ch: '240', alone: '19,250', bundle: '17,600' },
      { name: '지니TV 모든G', ch: '250', alone: '23,650', bundle: '22,000' },
      { name: '지니TV 디즈니+모든G', ch: '250', alone: '25,950', bundle: '24,300' },
      { name: '지니TV+넷플릭스 초이스HD', ch: '266', alone: '33,850', bundle: '32,200' },
    ],
    tvHeader: { col3: 'TV 단독', col4: '인터넷 결합 시' },
    tvSubtitle: '📺 TV 요금 (부가세 포함, 셋톱 별도)',
    gifts: [
      { name: '인터넷', m100: '9만', m500: '14만', g1: '14만' },
      { name: '인터넷 + 지니TV 베이직', m100: '37만', m500: '45만', g1: '45만' },
      { name: '인터넷 + 지니TV 라이트', m100: '37만', m500: '45만', g1: '45만' },
      { name: '인터넷 + 지니TV 모든G', m100: '37만', m500: '45만', g1: '45만' },
      { name: '인터넷 + 지니TV 디즈니+ 모든G', m100: '37만', m500: '45만', g1: '45만' },
      { name: '인터넷 + 지니TV+넷플릭스 초이스HD', m100: '37만', m500: '45만', g1: '45만' },
    ],
    giftTitle: '🎁 사은품',
    cards: {
      title: '💳 KT 유선 제휴카드',
      headers: ['카드명', '발급사', '최소실적', '할인금액', '기간'],
      rows: [
        ['KT DC Plus 국민카드', 'KB국민', '30만↑', '7,000원', '-'],
        ['KT-현대카드M Edition3', '현대카드', '30만↑', '13,000원', '1~24개월'],
        ['KT-현대카드M Edition3(2.0)', '현대카드', '100만↑', '22,000원', '1~36개월'],
        ['KT 신한 체크카드', '신한카드', '30만↑', '3,000원 캐쉬백', '-'],
        ['KT 가족만족 DC 신한카드', '신한카드', '30만↑', '7,000원', '-'],
        ['KT 으랏차차 신한카드', '신한카드', '50만↑', '12,000원', '-'],
        ['olleh super DC IBK카드', 'IBK', '30만↑', '7,000원', '-'],
        ['KT 으랏차차 IBK카드', 'IBK', '자동납부', '5% 청구할인', '-'],
        ['KT 삼성카드', '삼성카드', '30만↑', '7,000원', '-'],
        ['KT Plus 우리카드', '우리카드', '40만↑', '10,000원', '1~24개월'],
        ['KT 36 Plus 우리카드', '우리카드', '40만↑', '8,000원', '1~24개월'],
        ['더 심플 하나카드', '하나카드', '30만↑', '10,000원', '-'],
        ['KT 할부Plus NH농협카드', 'NH농협', '40만↑', '5,000원', '할부중복불가'],
        ['KT DC Plus 롯데카드', '롯데카드', '40만↑', '10,000원', '-'],
        ['KT SUPER DC BC바로카드', '비씨카드', '40만↑', '5,000원', '-'],
        ['KT DC Plus BC바로카드', '비씨카드', '30만↑', '7,000원', '-'],
        ['KT멤버십x케이뱅크 체크카드', '케이뱅크', '20만↑', '5% 캐시백(최대5천)', '-'],
      ],
    },
    settop: {
      title: '📦 KT 셋톱박스 + OTT 지원',
      headers: ['셋톱박스명', '월 임대료', '특징', '유튜브', '넷플릭스', '디즈니+', '웨이브', '왓챠', '티빙'],
      rows: [
        ['기가지니A', '3,300원', '가장 저렴한 일반형', 'O', 'O', 'O', 'O', 'O', 'O'],
        ['기가지니3', '4,400원', 'AI 블루투스 스피커형', 'O', 'O', 'O', 'O', 'O', 'O'],
        ['지니TV 올인원 사운드바', '8,800원', '사운드바+공유기 일체', 'O', 'O', 'O', 'O', 'O', 'O'],
      ],
    },
    wifi: {
      title: '📡 KT 와이파이',
      headers: ['와이파이명', '특징', '100M', '500M', '1G'],
      rows: [
        ['KT GIGA WAVE2', '기본형', '1,100원', '1,100원', '무료'],
        ['GIGA WIFI 홈AX', 'WiFi-6', '2,200원', '2,200원', '무료'],
        ['GIGA WIFIBUDDY', '증폭기, 홈AX 호환', '1,650원', '1,650원', '1,650원'],
        ['GIGA WIFI프리미엄 2.4', '고급형 최대 10Gbps', '4,400원', '4,400원', '4,400원'],
      ],
    },
    install: {
      title: '🔧 KT 설치비',
      headers: ['항목', '평일', '주말'],
      rows: [
        ['인터넷 단독', '36,000원', '45,000원'],
        ['인터넷 (TV 동시)', '34,100원', '42,620원'],
        ['IPTV', '22,000원', '27,500원'],
        ['인터넷+TV', '56,200원', '71,250원'],
        ['TV추가 (1대당)', '+15,400원', '+19,250원'],
        ['인터넷전화 (동시)', '—', '+33,000원'],
        ['일반전화 (동시)', '신규 +32,000원 / 번호이동 +36,000원', '신규 +41,000원 / 번호이동 +45,000원'],
      ],
    },
    phone: {
      title: '📞 KT 집전화',
      headers: ['요금제', '월요금', '비고'],
      rows: [],
    },
  },
  lgu: {
    key: 'LGU', label: 'LG U+', color: 'green', statusBg: '#d1fae5',
    internet: [
      { name: '인터넷', m100: '22,000', m500: '33,000', g1: '38,500' },
    ],
    tv: [
      { name: '실속형', ch: '217', price: '14,630' },
      { name: '기본형', ch: '223', price: '15,730' },
      { name: '프리미엄', ch: '257', price: '17,600' },
      { name: '프리미엄 디즈니+ 스탠다드', ch: '257+', price: '26,950' },
      { name: '프리미엄 넷플릭스 HD', ch: '258+', price: '30,550' },
      { name: '프리미엄 티빙', ch: '257+', price: '30,550' },
      { name: '프리미엄 넷플릭스 UHD', ch: '258+', price: '34,050' },
    ],
    tvHeader: null, // LGU+ has different TV table
    tvSubtitle: '📺 TV 요금 (인터넷에 추가)',
    gifts: [
      { name: '인터넷', m100: '20만', m500: '23만', g1: '23만' },
      { name: '인터넷 + 실속형', m100: '40만', m500: '47만', g1: '47만' },
      { name: '인터넷 + 기본형', m100: '40만', m500: '47만', g1: '47만' },
      { name: '인터넷 + 프리미엄', m100: '40만', m500: '47만', g1: '47만' },
      { name: '인터넷 + 프리미엄 디즈니(스탠다드)', m100: '40만', m500: '47만', g1: '47만' },
      { name: '인터넷 + 프리미엄 넷플릭스 HD', m100: '40만', m500: '47만', g1: '47만' },
    ],
    giftTitle: '🎁 사은품',
    cards: {
      title: '💳 LG U+ 유선 제휴카드',
      headers: ['카드명', '발급사', '혜택', '할인금액'],
      rows: [
        ['LG U+ 삼성카드', '삼성카드', '30만원↑ 실적', '7,000원'],
        ['LG U+ 현대카드M Edition3(2.0)', '현대카드', '50만원↑ (1~24개월)', '15,000원'],
        ['더 심플 하나카드', '하나카드', '30만원↑ 실적', '10,000원'],
        ['LG U+x LOCA 롯데카드', '롯데카드', '30만원↑ 실적', '10,000원'],
        ['NH올원 LG U+ 카드', 'NH카드', '30만원↑ 실적', '9,000원'],
        ['LG U+ 사장님 통할인 신한카드', '신한카드', '70만원↑ 실적', '10,000원'],
        ['LG U+Family 하나카드', '하나카드', '30만원↑ 통신료 25% 청구할인', '25%'],
      ],
    },
    settop: {
      title: '📦 LG U+ 셋톱박스 + OTT 지원',
      headers: ['셋톱박스명', '월 임대료', '특징', '유튜브', '넷플릭스', '디즈니+', '웨이브', '왓챠', '티빙'],
      rows: [
        ['U+tv 사운드바 블랙', '6,600원', '돌비비전 탑재', 'O', 'O', 'O', 'O', 'O', 'O'],
        ['U+tv UHD4', '4,400원', 'AI음향 기술', 'O', 'O', 'O', 'O', 'O', 'O'],
      ],
    },
    wifi: {
      title: '📡 LG U+ 와이파이',
      headers: ['와이파이명', '특징', '100M', '500M', '1G'],
      rows: [
        ['기가와이파이', '100M 시 1대 의무', '기본제공', '추가 2,200원', '추가 2,200원'],
        ['기가와이파이6', '500M 시 1대 의무', '추가 2,200원', '기본제공', '기본제공'],
        ['기가와이파이메쉬', '500M+ 선택/추가', 'X', '프리미엄안심 선택가능', '프리미엄안심 선택가능'],
      ],
    },
    install: {
      title: '🔧 LG U+ 설치비',
      headers: ['항목', '평일', '주말'],
      rows: [
        ['인터넷 단독', '36,300원', '45,375원'],
        ['TV 단독', '34,100원', '—'],
        ['인터넷+TV', '56,100원', '70,120원'],
        ['TV추가 (1대당)', '+22,000원', '+27,500원'],
        ['인터넷전화 (동시)', '+11,000원', '+11,000원'],
        ['일반전화 (동시)', '+11,000원', '+11,000원'],
      ],
    },
    phone: {
      title: '📞 LG U+ 집전화',
      headers: ['요금제', '월요금', '비고'],
      rows: [
        ['표준형+', '1,100원', '국내 음성 3분당 41.8원 / 휴대폰 10초당 12.87원'],
        ['이동할인형', '2,200원', '국내 음성 3분당 41.8원 / 휴대폰 10초당 7.98원'],
      ],
    },
  },
};

const tbl = {
  width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 0,
};
const th = {
  ...tableStyles.th, fontSize: 11,
};
const td = {
  ...tableStyles.td, fontSize: 11,
};

function OttCell({ val }) {
  const isO = val === 'O';
  return <td style={{ ...td, color: isO ? theme.green : theme.red }}>{val}</td>;
}

export default function CarrierProducts() {
  const { carrier: carrierParam } = useParams();
  const cfg = carrierConfig[carrierParam] || carrierConfig.skt;
  const [giftValues, setGiftValues] = useState(() =>
    cfg.gifts.map(g => ({ m100: g.m100, m500: g.m500, g1: g.g1 }))
  );

  const handleGiftChange = (idx, field, val) => {
    setGiftValues(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const isLgu = carrierParam === 'lgu';

  return (
    <div>
      {/* 메인 카드 */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ ...statusStyle(cfg.color), fontSize: 12, padding: '4px 10px' }}>{cfg.label}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: theme.navy, margin: 0 }}>인터넷 · TV 요금표</span>
          <span style={{ ...button.success, fontSize: 10, marginLeft: 'auto' }}>✏️ 편집</span>
          <span style={{ ...button.primary, fontSize: 10 }}>+ 상품 추가</span>
        </div>

        {/* 인터넷 요금 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, marginBottom: 8 }}>📡 인터넷 요금</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ ...tbl, marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={th}>상품명</th>
                <th style={th}>100M</th>
                <th style={th}>500M</th>
                <th style={th}>1G</th>
                <th style={th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {cfg.internet.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                  <td style={{ ...td, fontWeight: 700, color: theme.navy }}>{r.m100}</td>
                  <td style={{ ...td, fontWeight: 700, color: theme.navy }}>{r.m500}</td>
                  <td style={{ ...td, fontWeight: 700, color: theme.navy }}>{r.g1}</td>
                  <td style={td}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* TV 요금 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, marginBottom: 8 }}>{cfg.tvSubtitle}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>TV 상품</th>
                <th style={th}>채널수</th>
                {isLgu ? (
                  <>
                    <th style={th}>월요금</th>
                    <th style={th}>상태</th>
                  </>
                ) : (
                  <>
                    <th style={th}>{cfg.tvHeader.col3}</th>
                    <th style={th}>{cfg.tvHeader.col4}</th>
                    <th style={th}>상태</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {cfg.tv.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                  <td style={td}>{r.ch}</td>
                  {isLgu ? (
                    <td style={{ ...td, fontWeight: 700, color: theme.navy }}>{r.price}</td>
                  ) : (
                    <>
                      <td style={{ ...td, fontWeight: 700, color: theme.navy }}>{r.alone}</td>
                      <td style={{ ...td, color: theme.blue, fontWeight: 600 }}>{r.bundle}</td>
                    </>
                  )}
                  <td style={td}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 사은품 */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, margin: 0 }}>{cfg.giftTitle}</div>
            <span style={{ ...button.success, fontSize: 11, padding: '5px 14px' }}>💾 저장</span>
          </div>
          <table style={tbl}>
            <thead>
              <tr>
                <th style={th}>상품명</th>
                <th style={th}>100M</th>
                <th style={th}>500M</th>
                <th style={th}>1G</th>
              </tr>
            </thead>
            <tbody>
              {cfg.gifts.map((g, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 600 }}>{g.name}</td>
                  {['m100', 'm500', 'g1'].map(f => (
                    <td key={f} style={td}>
                      <input
                        value={giftValues[i]?.[f] || ''}
                        onChange={e => handleGiftChange(i, f, e.target.value)}
                        style={{
                          width: 70, textAlign: 'center', margin: 0, padding: 4,
                          fontSize: 11, fontWeight: 600, color: theme.orange,
                          border: `1.5px solid ${theme.borderDark}`, borderRadius: 4,
                          background: '#fafafa', outline: 'none',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 제휴카드 */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, margin: 0 }}>{cfg.cards.title}</div>
            <span style={{ ...button.primary, fontSize: 10 }}>+ 카드 추가</span>
          </div>
          <table style={tbl}>
            <thead>
              <tr>
                {cfg.cards.headers.map((h, i) => <th key={i} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {cfg.cards.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => {
                    let cellStyle = { ...td };
                    if (j === 0) cellStyle.fontWeight = 600;
                    // SKT 3rd col "SKB 전용" highlight
                    if (carrierParam === 'skt' && j === 2 && cell === 'SKB 전용') {
                      cellStyle = { ...cellStyle, fontSize: 10, color: theme.orange };
                    } else if (j === 2 && carrierParam === 'skt' && cell !== 'SKB 전용') {
                      cellStyle = { ...cellStyle, fontSize: 10 };
                    }
                    // 할인금액 column
                    const isDiscountCol = (carrierParam === 'skt' && (j === 4 || j === 6 || j === 8)) ||
                      (carrierParam === 'kt' && j === 3) ||
                      (carrierParam === 'lgu' && j === 3);
                    if (isDiscountCol) {
                      cellStyle = { ...cellStyle, color: theme.blue, fontWeight: 600 };
                    }
                    // 연회비/기간 cols
                    if (carrierParam === 'skt' && j === 9) cellStyle = { ...cellStyle, fontSize: 10 };
                    return <td key={j} style={cellStyle}>{cell}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 셋톱박스 */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, margin: 0 }}>{cfg.settop.title}</div>
            <span style={{ ...button.primary, fontSize: 10 }}>+ 추가</span>
          </div>
          <table style={tbl}>
            <thead>
              <tr>
                {cfg.settop.headers.map((h, i) => <th key={i} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {cfg.settop.rows.map((row, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 600 }}>{row[0]}</td>
                  <td style={{ ...td, color: theme.navy, fontWeight: 600 }}>{row[1]}</td>
                  <td style={{ ...td, fontSize: 10 }}>{row[2]}</td>
                  {row.slice(3).map((v, j) => <OttCell key={j} val={v} />)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 와이파이 */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, margin: 0 }}>{cfg.wifi.title}</div>
            <span style={{ ...button.primary, fontSize: 10 }}>+ 추가</span>
          </div>
          <table style={tbl}>
            <thead>
              <tr>
                {cfg.wifi.headers.map((h, i) => <th key={i} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {cfg.wifi.rows.map((row, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 600 }}>{row[0]}</td>
                  <td style={{ ...td, fontSize: 10 }}>{row[1]}</td>
                  {typeof row[2] === 'object' && row[2].colSpan ? (
                    <td colSpan={row[2].colSpan} style={{ ...td, fontSize: 10 }}>{row[2].text}</td>
                  ) : (
                    <>
                      <td style={td}>{row[2]}</td>
                      <td style={td}>{row[3]}</td>
                      <td style={td}>{row[4]}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 설치비 */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, margin: 0 }}>{cfg.install.title}</div>
            <span style={{ ...button.primary, fontSize: 10 }}>+ 추가</span>
          </div>
          <table style={tbl}>
            <thead>
              <tr>
                {cfg.install.headers.map((h, i) => <th key={i} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {cfg.install.rows.map((row, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight: 600 }}>{row[0]}</td>
                  <td style={{ ...td, color: theme.navy, fontWeight: 600 }}>{row[1]}</td>
                  <td style={{ ...td, color: theme.navy, fontWeight: 600 }}>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 집전화 */}
        {cfg.phone.rows.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.navy, margin: 0 }}>{cfg.phone.title}</div>
              <span style={{ ...button.primary, fontSize: 10 }}>+ 추가</span>
            </div>
            <table style={tbl}>
              <thead>
                <tr>
                  {cfg.phone.headers.map((h, i) => <th key={i} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {cfg.phone.rows.map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...td, fontWeight: 600 }}>{row[0]}</td>
                    <td style={{ ...td, color: theme.navy, fontWeight: 600 }}>{row[1]}</td>
                    <td style={{ ...td, fontSize: 10 }}>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
