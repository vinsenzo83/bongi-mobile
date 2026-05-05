// V5 — 요금 계산기 (TM 데이터 / Calc Data)
// 점진 마이그레이션 경계: 본문은 docs/calculator.html (196KB vanilla)을 iframe으로 임시 wrap.
// 어드민 데이터 편집 모드 (?admin=1) — manager / admin 만 접근 허용.
//
// 사이드바에서도 role 기반으로 hide 되지만, URL 직접 접근 시도에 대비해 본 컴포넌트에서도 가드.
import { useEffect, useRef } from 'react';
import { useV5Auth } from '../../../hooks/useV5Auth.jsx';

export default function CalcData() {
  const { agent, getToken } = useV5Auth();
  const iframeRef = useRef(null);

  // role 가드 — manager / admin 만 접근 허용
  const role = agent?.role;
  const allowed = role === 'admin' || role === 'manager';

  // iframe 로드 시점에 토큰/에이전트 정보를 postMessage로 전달
  const handleLoad = () => {
    try {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage({
        type: 'v5/auth-context',
        token: getToken?.(),
        agent: agent ? { id: agent.id, name: agent.name, role: agent.role, center: agent.center } : null,
      }, window.location.origin);
    } catch { /* same-origin이면 안전 — 무시 */ }
  };

  // iframe → 부모 메시지 리스너 (확장 포인트)
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return;
      // 추후 'v5/calc-data-saved' 같은 이벤트 처리 가능
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  if (!allowed) {
    return (
      <div style={{ padding: 40, color: '#fca5a5', background: '#1e293b', borderRadius: 10, border: '1px solid #475569', maxWidth: 520, margin: '40px auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>접근 권한이 없습니다</h2>
        <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
          이 페이지는 <b>manager</b> 또는 <b>admin</b> 권한자만 접근할 수 있습니다.
          {role && <> (현재 역할: <code style={{ background: '#0f172a', padding: '1px 6px', borderRadius: 3 }}>{role}</code>)</>}
        </p>
      </div>
    );
  }

  // ?admin=1 — 어드민 편집 모드, embed=1 — 임베드 모드 시그널 (vanilla 측 미구현이라도 무해)
  const src = '/docs/calculator.html?admin=1&embed=1';

  return (
    <div style={{ height: 'calc(100vh - 0px)', margin: -24 }}>
      <iframe
        ref={iframeRef}
        src={src}
        title="요금 계산기 데이터 편집"
        onLoad={handleLoad}
        style={{ width: '100%', height: '100%', border: 'none', background: '#0f172a', display: 'block' }}
      />
    </div>
  );
}
