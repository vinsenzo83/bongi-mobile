import React, { useEffect, useState } from 'react';

export default function BottomSheet({ open, onClose, title, children, height }) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!visible) return null;

  const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: animating ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
    transition: 'background-color 0.3s ease',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  };

  const sheetStyle = {
    width: '100%',
    maxWidth: 480,
    height: height || 'auto',
    maxHeight: '85vh',
    backgroundColor: '#fff',
    borderRadius: '16px 16px 0 0',
    transform: animating ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  };

  const titleStyle = {
    fontSize: 18,
    fontWeight: 700,
    color: '#1a2744',
    margin: 0,
  };

  const closeBtnStyle = {
    background: 'none',
    border: 'none',
    fontSize: 22,
    color: '#6b7280',
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
  };

  const bodyStyle = {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          <button style={closeBtnStyle} onClick={onClose} aria-label="닫기">
            {'✕'}
          </button>
        </div>
        <div style={bodyStyle}>{children}</div>
      </div>
    </div>
  );
}
