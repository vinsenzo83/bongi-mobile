export default function Footer() {
  return (
    <footer style={styles.footer}>
      <div className="container" style={styles.inner}>
        <div>
          <div style={styles.brand}>🐟 봉이모바일</div>
          <p style={styles.text}>광주/전라 8개 직영 매장 운영</p>
          <p style={styles.text}>대표번호: 1600-XXXX</p>
        </div>
        <div style={styles.links}>
          <a href="/stores" style={styles.link}>매장 안내</a>
          <a href="/apply" style={styles.link}>상담 신청</a>
          <span style={styles.text}>© 2026 봉이모바일</span>
        </div>
      </div>
    </footer>
  );
}

const styles = {
  footer: {
    background: '#1e293b',
    color: '#94a3b8',
    padding: '40px 0',
    marginTop: 'auto',
  },
  inner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    marginBottom: 8,
  },
  text: { fontSize: 13, marginBottom: 4 },
  links: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    alignItems: 'flex-end',
  },
  link: {
    color: '#94a3b8',
    fontSize: 13,
    textDecoration: 'none',
  },
};
