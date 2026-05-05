// vanilla HTML 페이지를 iframe으로 wrap
// V5AdminLayout main이 overflow:auto + height:100vh이라 iframe만 100% 차지하면 됨
export default function IframePage({ src, title }) {
  return (
    <iframe
      src={src}
      title={title}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: '100vh',
        border: 'none',
        background: '#0f172a',
      }}
    />
  );
}
