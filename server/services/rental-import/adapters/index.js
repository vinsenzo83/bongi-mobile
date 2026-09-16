// 어댑터 레지스트리 — 새 렌탈사 양식이 생기면 파일 하나 추가하고 여기 등록.
// 그룹별 파일이 각자 배열을 export 한다(병렬 작업 충돌 방지).
import waterA from './water-a.js';
import waterB from './water-b.js';
import applianceLg from './appliance-lg.js';
import applianceEtc from './appliance-etc.js';

export default [...waterA, ...waterB, ...applianceLg, ...applianceEtc];
