import { useState } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const storeData = [
  { name: '봉이모바일 상무점', addr: '광주 서구 상무대로 826 1층', sub: '(상무역 6번출구, 운천저수지방향 도보 5분)', tel: '010-9442-8528 / 010-8347-8528', naver: 'naver.me/xE6givX0', kakao: '카카오 채널 연결', hasImage: true },
  { name: '봉이모바일 익산점', addr: '전북 익산시 무왕로 1031 1층', sub: '(홈플러스 옆)', tel: '010-5190-0383', naver: 'naver.me/52RGm8ku', kakao: '카카오 채널 연결', hasImage: true },
  { name: '봉이모바일 전대점', addr: '광주 북구 호동로 4-1', sub: '(전대후문 복개도로)', tel: '010-4453-7172 외 3개', naver: 'naver.me/xmfplm4j', kakao: '카카오 채널 연결', hasImage: true },
  { name: '봉이모바일 신창점', addr: '광주 광산구 신창로 36', sub: '(신가중사거리)', tel: '010-5755-2650 외 2개', naver: 'naver.me/F8RA3chE', kakao: '카카오 채널 연결', hasImage: true },
  { name: '봉이모바일 첨단점', addr: '광주 북구 첨단연신로 261 1층 105호', sub: '(첨단2지구 휴먼시아 2차 건너편)', tel: '010-8300-4947 / 010-9947-8820', naver: 'naver.me/5tLYmLMB', kakao: '카카오 채널 연결', hasImage: true },
  { name: '봉이모바일 순천점', addr: '순천시 충효로 109', sub: '(용전갈치 입구)', tel: '010-4758-5135 / 010-9623-1002', naver: 'naver.me/Gz5fsv7p', kakao: '카카오 채널 연결', hasImage: true },
  { name: '봉이모바일 남악점', addr: '전남 무안군 삼향읍 후광대로274', sub: '(도청프라자 108호, 버스정류장 앞)', tel: '010-2554-8245 / 010-6347-8245', naver: 'naver.me/5FlawB5V', kakao: '카카오 채널 연결', hasImage: true },
  { name: '봉이모바일 여수점', addr: '여수시 문수로 62 1층', sub: '', tel: '010-2789-5135', naver: '', kakao: '카카오 채널 연결', hasImage: true },
];

export default function StoreManage() {
  return (
    <div style={{ padding: 24, fontFamily: theme.sans, background: theme.bg, minHeight: '100vh' }}>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: theme.textMuted }}>
          총 <strong style={{ color: theme.navy }}>8개</strong> 직영점 &nbsp;|&nbsp; 매장별 휴대폰 시세 개별 관리 &nbsp;|&nbsp; (주)파이어니컴퍼니
        </div>
        <span
          style={{ ...button.primary, fontSize: 12, padding: '7px 16px', cursor: 'pointer' }}
        >
          + 매장 추가
        </span>
      </div>

      {/* 매장 카드 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {storeData.map((store, i) => (
          <div key={i} style={{ ...card }}>
            {/* 매장명 + 상태 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{store.name}</div>
              <span style={statusStyle('green')}>운영중</span>
            </div>

            {/* 주소 */}
            <div style={{ fontSize: 12, color: theme.textSecondary, fontWeight: 600, marginBottom: 4 }}>📍 {store.addr}</div>
            {store.sub && (
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: -2, marginBottom: 4 }}>{store.sub}</div>
            )}

            {/* 전화 */}
            <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4 }}>📞 {store.tel}</div>

            {/* 네이버/카카오 뱃지 */}
            <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
              {store.naver ? (
                <span style={{ ...statusStyle('blue'), fontSize: 10, cursor: 'pointer' }}>📍 네이버지도</span>
              ) : (
                <span style={{ ...statusStyle('gray'), fontSize: 10 }}>네이버 미등록</span>
              )}
              <span style={{ ...statusStyle('green'), fontSize: 10, cursor: 'pointer' }}>💬 {store.kakao}</span>
            </div>

            {/* 이미지 영역 */}
            {store.hasImage ? (
              <div style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', height: 120, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: theme.textMuted }}>매장 사진</span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <div style={{
                  flex: 1, height: 60, borderRadius: 6, fontSize: 9, borderStyle: 'dashed', cursor: 'pointer',
                  border: `1.5px dashed ${theme.borderDark}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: theme.textMuted, background: '#fafafa'
                }}>
                  + 매장 사진 추가
                </div>
              </div>
            )}

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ ...button.primary, flex: 2, display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>📊 시세 관리</span>
              <span style={{ ...button.secondary, flex: 1, display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>수정</span>
              <span style={{ ...button.danger, flex: 1, display: 'flex', justifyContent: 'center', cursor: 'pointer' }}>삭제</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
