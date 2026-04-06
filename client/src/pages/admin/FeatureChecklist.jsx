import { useState, useEffect, useCallback } from 'react';
import { theme, statusStyle, tableStyles, card, button, filterBtn, kpiCard, input } from '../../styles/admin-theme.js';

const BM_KEY = 'bm_cl_v1';

const SECTIONS = [
  {
    icon: '🗄️', title: 'DB / 인프라', tag: 'INFRA', id: 0,
    items: ['Supabase 프로젝트 생성', 'users 테이블', 'applications 테이블', 'gifts 테이블', 'points 테이블', 'addresses 테이블', 'referrals 테이블', 'guard_items 테이블', 'products 테이블', 'Supabase Storage 버킷', 'Vercel 배포 연결'],
  },
  {
    icon: '🔐', title: '인증', tag: 'AUTH', id: 1,
    items: ['카카오 소셜 로그인', '구글 소셜 로그인', '어드민 로그인', '어드민 권한 분기', 'PASS 본인인증 연동', 'PASS 인증 후 DB 자동 업데이트'],
  },
  {
    icon: '👥', title: '회원 관리', tag: 'MEMBERS', id: 2,
    items: ['회원 목록 조회/검색/필터', '회원 상세 기본정보', '회원 상세 계좌/주소', '회원 상세 신청/계약 이력', '회원 상세 사은품 내역', '회원 상세 포인트 내역', '회원 상세 친구초대 현황', '회원 상세 돈지키미 현황', '미인증 회원 필터', '알림톡 일괄 발송'],
  },
  {
    icon: '📋', title: '신청 현황', tag: 'APPLY', id: 3,
    items: ['신청 목록 전 채널 통합', '채널별 필터', '회원/비회원 구분 표시', 'CRM 전달 상태 표시', '신청 상세 팝업', '담당자 배정'],
  },
  {
    icon: '🎁', title: '사은품 관리', tag: 'GIFTS', id: 4,
    items: ['사은품 목록', '지급 처리 승인/보류', '일괄 지급 처리', '비회원 가입 유도 알림톡 3단계', '계좌 실명 조회 연동'],
  },
  {
    icon: '💰', title: '포인트 관리', tag: 'POINTS', id: 5,
    items: ['출금 신청 목록', '조건 4가지 자동 검증', '출금 승인/반려', '계좌 자동 입금 연동', '포인트 적립 내역 조회'],
  },
  {
    icon: '🛍️', title: '상품 관리', tag: 'PRODUCTS', id: 6,
    items: ['인터넷+TV 상품 관리', '렌탈 렌트리 URL 자동 파싱', '렌탈 이미지 Supabase 저장', '중고폰 매입 관리', 'AI 노출 ON/OFF'],
  },
  {
    icon: '🤖', title: 'AI 학습 데이터', tag: 'AI DATA', id: 7,
    items: ['모바일 요금제', '유선 인터넷+TV', '가족결합', '렌탈 상품', '시세 관리', '가이드', '매장 정보'],
  },
  {
    icon: '📦', title: '중고폰', tag: 'USED', id: 8,
    items: ['위탁업체 API 연동 트레딧', '매입 신청 목록', '상태 동기화', '알림톡 자동 발송', '중고폰 시세 관리'],
  },
  {
    icon: '🔔', title: '돈지키미', tag: 'GUARD', id: 9,
    items: ['돈지키미 등록 관리', 'D-90/D-30/D-7/D-1 알람 자동 발송', 'CRM 해피콜 자동 연동'],
  },
  {
    icon: '🔗', title: 'CRM 연동', tag: 'CRM', id: 10,
    items: ['CRM 어드민 웹훅 동기화', '비회원 회원 자동 매칭', '신규 고객 CRM 자동 전달', '계약 완료 CRM 업데이트', 'CTI CRM등록 감지'],
  },
  {
    icon: '🕷️', title: '크롤링', tag: 'CRAWL', id: 11,
    items: ['모바일 요금제 크롤러', '공시지원금 크롤러', '검토 승인 AI 반영 플로우'],
  },
  {
    icon: '📊', title: '통계', tag: 'STATS', id: 12,
    items: ['대시보드 KPI', '채널별 신청 차트', '비회원 회원 전환 현황', '월별 계약 통계'],
  },
];

const TOTAL_ITEMS = SECTIONS.reduce((sum, s) => sum + s.items.length, 0);

export default function FeatureChecklist() {
  const [checked, setChecked] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(BM_KEY) || '{}');
    } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem(BM_KEY, JSON.stringify(checked));
  }, [checked]);

  const toggle = useCallback((key) => {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
  }, []);

  const doneCount = Object.values(checked).filter(Boolean).length;
  const leftCount = TOTAL_ITEMS - doneCount;
  const pct = TOTAL_ITEMS ? Math.round(doneCount / TOTAL_ITEMS * 100) : 0;

  const getSectionDone = (sectionId) => {
    const section = SECTIONS.find(s => s.id === sectionId);
    if (!section) return 0;
    return section.items.filter((_, idx) => checked[`${sectionId}_${idx}`]).length;
  };

  const clTotalStyle = {
    display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 16, padding: '16px 0',
  };
  const clKpiStyle = { textAlign: 'center' };
  const clKpiNStyle = (color) => ({ fontSize: 28, fontWeight: 900, color });
  const clKpiLStyle = { fontSize: 11, color: theme.textMuted, marginTop: 4 };

  const clBarWrap = {
    background: '#e5e7eb', borderRadius: 8, height: 8, marginBottom: 20, overflow: 'hidden',
  };
  const clBarFill = {
    background: `linear-gradient(90deg, ${theme.green}, ${theme.blue})`,
    height: '100%', borderRadius: 8, transition: 'width 0.3s',
    width: `${pct}%`,
  };

  const clSectionStyle = {
    marginBottom: 12, background: '#fff', border: `1px solid ${theme.border}`, borderRadius: 10, padding: 12,
  };
  const clSecTitleStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontWeight: 700, fontSize: 13, color: theme.navy, marginBottom: 8,
  };
  const clStagStyle = {
    fontSize: 9, padding: '2px 6px', background: '#e0e7ff', color: theme.navy, borderRadius: 4, fontWeight: 700, marginLeft: 6,
  };
  const clSecProgStyle = { fontSize: 11, color: theme.textMuted, fontWeight: 400 };

  const clItemStyle = (done) => ({
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6,
    cursor: 'pointer', transition: 'background 0.15s',
    background: done ? '#f0fdf4' : 'transparent',
    opacity: done ? 0.7 : 1,
  });
  const clCbStyle = (done) => ({
    width: 20, height: 20, borderRadius: 4,
    border: done ? `2px solid ${theme.green}` : `2px solid ${theme.borderDark}`,
    background: done ? theme.green : '#fff',
    color: done ? '#fff' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0, transition: 'all 0.15s',
  });
  const clLabelStyle = (done) => ({
    fontSize: 12, color: done ? theme.textMuted : theme.text,
    textDecoration: done ? 'line-through' : 'none',
  });

  return (
    <div>
      {/* Total KPIs */}
      <div style={clTotalStyle}>
        <div style={clKpiStyle}><div style={clKpiNStyle(theme.green)}>{doneCount}</div><div style={clKpiLStyle}>완료</div></div>
        <div style={clKpiStyle}><div style={clKpiNStyle(theme.orange)}>{leftCount}</div><div style={clKpiLStyle}>미완료</div></div>
        <div style={clKpiStyle}><div style={clKpiNStyle(theme.navy)}>{TOTAL_ITEMS}</div><div style={clKpiLStyle}>전체</div></div>
        <div style={clKpiStyle}><div style={clKpiNStyle(theme.blue)}>{pct}%</div><div style={clKpiLStyle}>진행률</div></div>
      </div>

      {/* Progress bar */}
      <div style={clBarWrap}><div style={clBarFill} /></div>

      {/* Sections */}
      {SECTIONS.map(section => {
        const secDone = getSectionDone(section.id);
        return (
          <div key={section.id} style={clSectionStyle}>
            <div style={clSecTitleStyle}>
              <span>
                {section.icon} {section.title} <span style={clStagStyle}>{section.tag}</span>
              </span>
              <span style={clSecProgStyle}>{secDone} / {section.items.length}</span>
            </div>
            {section.items.map((item, idx) => {
              const key = `${section.id}_${idx}`;
              const done = !!checked[key];
              return (
                <div key={key} onClick={() => toggle(key)} style={clItemStyle(done)}>
                  <div style={clCbStyle(done)}>✓</div>
                  <div style={clLabelStyle(done)}>{item}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
