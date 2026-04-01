import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble.jsx';

export default function MessageList({ messages, loading, onAction }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} onAction={onAction} />
        ))}

        {loading && (() => {
          // 스트리밍 중 텍스트가 이미 있으면 로딩 dots 숨김 (아이콘 중복 방지)
          const lastMsg = messages[messages.length - 1];
          const hasStreamingContent = lastMsg?.role === 'assistant' && lastMsg?.content;
          if (hasStreamingContent) return null;
          return (
            <div style={styles.loading}>
              <div style={styles.avatar}>🐟</div>
              <div style={styles.dots}>
                <span style={{ ...styles.dot, animationDelay: '0s' }} />
                <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
                <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
              </div>
              <style>{`@keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}`}</style>
            </div>
          );
        })()}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 0',
  },
  inner: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '0 20px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '16px 0',
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
  },
  dots: {
    display: 'flex',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#666',
    animation: 'bounce 1.2s infinite',
  },
};
