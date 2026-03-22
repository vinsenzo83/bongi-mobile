import { useState, useRef } from 'react';

export default function InputArea({ onSend, loading }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  const handleSend = () => {
    if (!text.trim() || loading) return;
    onSend(text.trim());
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        <div style={styles.inputWrap}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            style={styles.textarea}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || loading}
            style={{ ...styles.sendBtn, opacity: text.trim() && !loading ? 1 : 0.3 }}
          >
            ↑
          </button>
        </div>
        <div style={styles.disclaimer}>
          봉이모바일 AI는 실수할 수 있습니다. 정확한 가격은 상담사 확인을 권장합니다.
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '12px 20px 16px',
    background: '#212121',
  },
  inner: {
    maxWidth: 720,
    margin: '0 auto',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    background: '#303030',
    borderRadius: 16,
    padding: '8px 8px 8px 16px',
    border: '1px solid #444',
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ececec',
    fontSize: 15,
    lineHeight: 1.5,
    resize: 'none',
    maxHeight: 120,
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: '#fff',
    color: '#000',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#666',
    marginTop: 8,
  },
};
