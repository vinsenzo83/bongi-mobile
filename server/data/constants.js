// 봉이모바일 공통 상수 (서버/클라이언트 공유)

export const BASE_SALARY = 2200000;

export const INCENTIVE_PER_ITEM = {
  internet:  { min: 15000, max: 30000, avg: 25000, label: '인터넷+TV', icon: '📡' },
  rental:    { min: 20000, max: 40000, avg: 30000, label: '가전렌탈', icon: '🧺' },
  usim:      { min: 5000,  max: 10000, avg: 7000,  label: '알뜰폰', icon: '📱' },
  usedPhone: { min: 3000,  max: 5000,  avg: 4000,  label: '중고폰', icon: '📦' },
};

export const GRADES = [
  { id: 'rookie', label: '루키',   min: 0,  max: 20,  multiplier: 1.0, bonus: 0 },
  { id: 'pro',    label: '프로',   min: 21, max: 40,  multiplier: 1.2, bonus: 100000 },
  { id: 'ace',    label: '에이스', min: 41, max: 60,  multiplier: 1.5, bonus: 300000 },
  { id: 'master', label: '마스터', min: 61, max: 999, multiplier: 2.0, bonus: 500000 },
];

export const CALL_CENTER = '1600-XXXX';

export const CUSTOMER_STATUSES = [
  '신규유입', '상담중', '진행중', '재연락예약', '계약완료', '설치완료',
  '해피콜대기', '업셀링관심있음', '해피콜완료_관심없음',
  '재계약상담', '쿨다운중', '쿨다운_장기', '연락거부', '미처리', '종결',
];
