// 마이그레이션 중간 단계용 — 기존 vanilla HTML 페이지를 iframe으로 임시 wrap
// React 변환 완료된 페이지는 IframePage 사용 안 하고 별도 컴포넌트로 교체
export default function IframePage({ src, title }) {
  return (
    <div style={{ height: 'calc(100vh - 48px)', margin: -24 }}>
      <iframe
        src={src}
        title={title}
        style={{ width: '100%', height: '100%', border: 'none', background: '#0f172a' }}
      />
    </div>
  );
}
