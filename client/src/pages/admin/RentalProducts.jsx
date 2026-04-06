import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const CATEGORIES = [
  { label: '전체', count: 54 },
  { label: '정수기', count: 11 },
  { label: '공기청정기', count: 5 },
  { label: 'TV', count: 5 },
  { label: '세탁기+건조기', count: 3 },
  { label: '세탁기', count: 3 },
  { label: '건조기', count: 4 },
  { label: '노트북', count: 5 },
  { label: '안마의자', count: 5 },
  { label: '비데', count: 2 },
  { label: '매트리스', count: 3 },
  { label: '로봇청소기', count: 5 },
];

const BRANDS = ['전체', '코웨이', 'LG', '삼성', '쿠쿠', 'SK인텔릭스', '기타'];

const PRODUCTS = [
  ['코웨이', '아이콘3 냉온정 정수기', '14,450원', '3~7년', 'KB카드(40만)', '0원', '반값할인', '-', 'ON'],
  ['쿠쿠', '제로100 슬림 얼음정수기', '20,950원', '3~6년', '우리카드(30만)', '10,950원', '반값할인', '-', 'ON'],
  ['LG', '퓨리케어 오브제 냉온정', '16,450원', '3~5년', '신한카드(30만)', '10,450원', '현금지급', '320,000원', 'ON'],
  ['SK인텔릭스', '초소형 플러스 냉온정', '15,200원', '5~7년', '삼성카드(30만)', '9,200원', '반값할인', '-', 'ON'],
  ['삼성', 'QLED 4K TV 55인치', '34,900원', '3~6년', '하나카드(30만)', '22,900원', '현금지급', '220,000원', 'ON'],
];

const SPECS = [
  ['크기', '160x365x385mm'],
  ['필터종류', '나노필터'],
  ['제품타입', '데스크탑형'],
  ['관리방식', '방문관리/셀프관리'],
  ['출시시기', '2026년 2월'],
  ['출고가(참고)', '미표시'],
];

export default function RentalProducts() {
  const [activeCat, setActiveCat] = useState('전체');
  const [activeBrand, setActiveBrand] = useState('전체');

  return (
    <div>
      {/* Category filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {CATEGORIES.map(c => (
          <div
            key={c.label}
            onClick={() => setActiveCat(c.label)}
            style={filterBtn(activeCat === c.label)}
          >
            {c.label} ({c.count})
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{ height: 34, width: 120, borderRadius: 6, fontSize: 12, border: `1px solid ${theme.borderDark}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#fff' }}>엑셀 업로드</div>
          <div style={{ height: 34, width: 100, borderRadius: 6, fontSize: 12, background: theme.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600 }}>+ 상품 등록</div>
        </div>
      </div>

      {/* Brand filter bar */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 14, padding: '8px 0' }}>
        <input style={{ ...input, width: 180, marginBottom: 0 }} placeholder="상품명 검색" />
        {BRANDS.map(b => (
          <div key={b} onClick={() => setActiveBrand(b)} style={filterBtn(activeBrand === b)}>{b}</div>
        ))}
      </div>

      {/* Product table */}
      <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              {['이미지', '브랜드', '상품명', '월요금', '약정기간', '제휴카드', '카드 후 월요금', '사은품 종류', '사은품 금액', 'AI노출', '관리'].map(h => (
                <th key={h} style={tableStyles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map(([brand, name, price, term, cardInfo, afterCard, giftType, giftAmt, ai], i) => (
              <tr key={i}>
                <td style={tableStyles.td}>
                  <div style={{ width: 44, height: 44, borderRadius: 6, fontSize: 9, border: `1px dashed ${theme.borderDark}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted }}>이미지</div>
                </td>
                <td style={{ ...tableStyles.td, fontWeight: 700 }}>{brand}</td>
                <td style={{ ...tableStyles.td, fontSize: 11, maxWidth: 140 }}>{name}</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.navy }}>{price}</td>
                <td style={tableStyles.td}>{term}</td>
                <td style={{ ...tableStyles.td, fontSize: 11 }}>{cardInfo}</td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: theme.blue }}>{afterCard}</td>
                <td style={tableStyles.td}>
                  <span style={statusStyle(giftType === '현금지급' ? 'orange' : 'blue')}>{giftType}</span>
                </td>
                <td style={{ ...tableStyles.td, fontWeight: 700, color: giftType === '현금지급' ? theme.orange : theme.textMuted }}>{giftAmt}</td>
                <td style={tableStyles.td}>
                  <span style={statusStyle(ai === 'ON' ? 'green' : 'gray')}>{ai}</span>
                </td>
                <td style={{ ...tableStyles.td, display: 'flex', gap: 4 }}>
                  <span style={button.secondary}>수정</span>
                  <span style={button.danger}>삭제</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Registration form */}
      <h2 style={{ fontSize: 15, fontWeight: 800, color: theme.navy, marginBottom: 12 }}>📋 상품 등록 — 렌트리 URL 자동 파싱</h2>
      <div style={{ ...card, borderColor: '#bfdbfe' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 6 }}>렌트리 URL 입력</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ ...input, flex: 1, marginBottom: 0 }}>https://rentre.kr/product/1600006842</div>
          <div style={{ height: 38, width: 100, borderRadius: 6, fontSize: 12, background: theme.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>자동 파싱</div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 6 }}>
              자동완성 항목 <span style={{ color: theme.green, fontSize: 10 }}>✓ 파싱완료</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {[['상품명', '[코웨이] 아이콘3 냉온정 정수기'], ['브랜드', '코웨이'], ['카테고리', '정수기'], ['모델명', 'CHP-7220N']].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>{k}</div>
                  <div style={{ ...input, background: '#f0fdf4', borderColor: '#6ee7b7' }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 6 }}>
              상품 이미지 <span style={{ color: theme.green, fontSize: 10 }}>✓ Supabase 복사완료</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[1, 2, 3].map(n => (
                <div key={n} style={{ position: 'relative' }}>
                  <div style={{ width: 80, height: 80, borderRadius: 8, fontSize: 10, borderColor: '#6ee7b7', background: '#f0fdf4', border: '1px solid #6ee7b7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted }}>이미지{n}</div>
                  <div style={{ position: 'absolute', top: -6, right: -6, background: theme.green, color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>✓</div>
                </div>
              ))}
              <div style={{ width: 80, height: 80, borderRadius: 8, fontSize: 10, border: `1px dashed ${theme.borderDark}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted, cursor: 'pointer' }}>+ 추가</div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 6 }}>
              주요 기능 <span style={{ color: theme.green, fontSize: 10 }}>✓ 파싱완료</span>
            </div>
            <div style={{ ...input, background: '#f0fdf4', borderColor: '#6ee7b7', height: 60 }}>
              스마트 무빙 파우셋, 가로 16cm 초소형, 실시간 UV살균, 고온수, IoT기능, 에너지절약
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 6 }}>
          상세 설명 <span style={{ color: theme.green, fontSize: 10 }}>✓ 자동완성 (수동 편집 가능)</span>
        </div>
        <div style={{ background: '#f0fdf4', border: '1.5px solid #6ee7b7', borderRadius: 8, padding: 12, fontSize: 12, color: theme.textSecondary, lineHeight: 1.8, marginBottom: 16, minHeight: 100 }}>
          코웨이 아이콘3 냉온정 정수기는 가로 16cm의 초슬림 디자인으로 주방 공간을 효율적으로 활용할 수 있습니다. 스마트 무빙 파우셋으로 원하는 방향으로 출수가 가능하며, 실시간 UV 살균으로 항상 깨끗한 물을 제공합니다. IoT 기능을 통해 스마트폰으로 원격 관리가 가능합니다.
          <div style={{ color: theme.textMuted, fontSize: 11, marginTop: 6 }}>※ AI가 파싱 데이터 기반으로 자동 생성. 수정 가능.</div>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 6 }}>
          스펙 <span style={{ color: theme.green, fontSize: 10 }}>✓ 파싱완료</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {SPECS.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, width: 70, flexShrink: 0 }}>{k}</div>
              <div style={{ ...input, marginBottom: 0, background: '#f0fdf4', borderColor: '#6ee7b7', flex: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 14, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 6 }}>
            봉이모바일 등록 정보 <span style={{ color: theme.orange, fontSize: 10 }}>✏️ 직접 입력</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[['월요금', '14,450원'], ['약정기간', '3~7년'], ['제휴카드', 'KB카드 (전월실적 40만원)'], ['카드 후 월요금', '0원']].map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>{k}</div>
                <div style={{ ...input, background: '#fff' }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>사은품 종류</div>
              <div style={{ ...input, background: '#fff' }}>반값할인</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary, marginBottom: 4 }}>사은품 금액 (현금지급 시만 입력)</div>
              <div style={{ ...input, background: '#f8f9fc', color: theme.textMuted }}>반값할인 선택 시 입력불필요</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textSecondary }}>AI 채팅 노출</div>
              <div style={{ width: 44, height: 24, borderRadius: 12, fontSize: 11, background: theme.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>ON</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ height: 36, width: 80, borderRadius: 8, fontSize: 12, border: `1px solid ${theme.borderDark}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>취소</div>
              <div style={{ height: 36, width: 120, borderRadius: 8, fontSize: 13, fontWeight: 700, background: theme.blue, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>저장 + 페이지 생성</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
