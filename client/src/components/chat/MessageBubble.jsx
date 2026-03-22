export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div style={{ ...styles.row, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <div style={styles.avatar}>🐟</div>}

      <div style={{ ...styles.bubble, ...(isUser ? styles.userBubble : styles.aiBubble) }}>
        {/* 마크다운 간이 렌더링 */}
        <div
          style={styles.content}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || '') }}
        />

        {/* 리치 UI 요소 (Phase B 확장) */}
        {message.ui_elements?.map((el, i) => (
          <RichElement key={i} element={el} />
        ))}
      </div>

      {isUser && <div style={styles.userAvatar}>👤</div>}
    </div>
  );
}

function RichElement({ element }) {
  // Phase B 확장: product_card, compare_table, image, map, form, actions
  return null;
}

// 간이 마크다운 → HTML
function renderMarkdown(text) {
  if (!text) return '';
  return text
    // 코드블록 (backtick)
    .replace(/`([^`]+)`/g, '<code style="background:#333;padding:1px 6px;border-radius:4px;font-size:13px;color:#7ee787">$1</code>')
    // 볼드
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff">$1</strong>')
    // 이탤릭
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // 줄바꿈
    .replace(/\n/g, '<br/>');
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#2a2a2a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
    marginTop: 2,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#5b5fc7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    flexShrink: 0,
    marginTop: 2,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: '10px 16px',
    lineHeight: 1.7,
    fontSize: 15,
  },
  userBubble: {
    background: '#303030',
    borderBottomRightRadius: 4,
    color: '#ececec',
  },
  aiBubble: {
    background: 'transparent',
    borderBottomLeftRadius: 4,
    color: '#d1d5db',
  },
  content: {
    wordBreak: 'break-word',
  },
};
