import { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '../../hooks/useIsMobile.js';

export default function InputArea({ onSend, loading }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const isMobile = useIsMobile();

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

  // 모바일 키보드 올라올 때 visualViewport 활용해 입력창 위치 보정
  useEffect(() => {
    if (!isMobile || !window.visualViewport) return;

    const vv = window.visualViewport;
    const containerEl = document.getElementById('chat-input-container');
    if (!containerEl) return;

    const handleResize = () => {
      const offsetFromBottom = window.innerHeight - vv.height - vv.offsetTop;
      containerEl.style.paddingBottom = `max(${offsetFromBottom}px, env(safe-area-inset-bottom))`;
    };

    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
      if (containerEl) {
        containerEl.style.paddingBottom = '';
      }
    };
  }, [isMobile]);

  return (
    <div
      id="chat-input-container"
      style={{
        ...styles.container,
        ...(isMobile ? styles.containerMobile : {}),
      }}
    >
      <div style={styles.inner}>
        <div style={styles.inputWrap}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            style={{
              ...styles.textarea,
              ...(isMobile ? { fontSize: 16 } : {}),
            }}
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
          리턴AI는 실수할 수 있습니다. 정확한 가격은 상담사 확인을 권장합니다.
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '12px 20px 16px',
    background: '#212121',
    flexShrink: 0,
  },
  containerMobile: {
    padding: '8px 12px',
    paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
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
