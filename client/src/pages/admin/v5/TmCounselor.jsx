// V5 — TM 견적·영업 (TM Counselor)
// 점진 마이그레이션 경계: 본문은 docs/tm-counselor.html (170KB / ~3000라인 vanilla)을 iframe으로 임시 wrap.
// 추후 React 네이티브로 전환 예정 (D 변수 요금엔진 + 견적 UI + 인센티브 미리보기 + Daum Postcode 등).
//
// 이 wrapper의 역할:
//  - V5 인증 토큰을 iframe과 공유 (동일 origin이라 localStorage 자동 공유)
//  - 부모 wrapper의 sidebar/header와 중복되지 않도록 ?embed=1 으로 임베드 모드 시그널
//  - iframe에서 postMessage로 보내는 cross-frame 이벤트 수신 (확장 포인트)
import { useEffect, useRef } from 'react';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';

export default function TmCounselor() {
  const { agent, getToken } = useV5Auth();
  const iframeRef = useRef(null);

  // iframe 로드 시점에 토큰/에이전트 정보를 postMessage로 전달 (선택적 — iframe이 listen 안 해도 무해)
  const handleLoad = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({
        type: 'v5/auth-context',
        token: getToken?.(),
        agent: agent ? { id: agent.id, name: agent.name, role: agent.role, center: agent.center } : null,
        month: new Date().toISOString().slice(0, 7),
      }, window.location.origin);
    } catch { /* same-origin이면 안전 — 무시 */ }
  };

  // iframe → 부모 메시지 리스너 (확장 포인트)
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      const msg = e.data || {};
      // 추후 필요한 cross-frame 이벤트 라우팅 (예: 'v5/navigate', 'v5/toast', 'v5/refresh')
      if (msg.type === 'v5/navigate' && typeof msg.path === 'string') {
        // window.location.assign(msg.path); // 의도적으로 비활성 — 명시적 핸들러 추가 시 활성화
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // ?embed=1 — vanilla HTML 측 header/login 박스 hide 시그널 (vanilla 측 미구현이라도 무해)
  const src = '/docs/tm-counselor.html?embed=1';

  return (
    <div style={{ height: 'calc(100vh - 0px)', margin: -24 }}>
      <iframe
        ref={iframeRef}
        src={src}
        title="TM 견적·영업"
        onLoad={handleLoad}
        style={{ width: '100%', height: '100%', border: 'none', background: '#0f172a', display: 'block' }}
      />
    </div>
  );
}
