import { useState, useEffect, useRef } from 'react';
import { api } from '../utils/api.js';

const STATUS_LABEL = {
  idle: { text: '대기', color: '#10b981', bg: '#d1fae5' },
  ringing: { text: '수신 중', color: '#f59e0b', bg: '#fef3c7', pulse: true },
  on_call: { text: '통화 중', color: '#2563eb', bg: '#dbeafe' },
};

const CALL_STATUS = {
  ringing: '발신 중...',
  connected: '통화 중',
  held: '보류 중',
  ended: '통화 종료',
  transferred: '전환 완료',
};

export default function CTIPanel({ agentId, customer, onCallEnd }) {
  const [agentState, setAgentState] = useState({ status: 'idle', callId: null });
  const [call, setCall] = useState(null);
  const [dialNumber, setDialNumber] = useState('');
  const [transferNumber, setTransferNumber] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef(null);

  // 통화 타이머
  useEffect(() => {
    if (call?.status === 'connected') {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      if (!call || call.status === 'ended') setTimer(0);
    }
    return () => clearInterval(timerRef.current);
  }, [call?.status]);

  // SSE: 통화 상태 실시간 스트림
  useEffect(() => {
    if (!call?.callId) return;
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';
    const es = new EventSource(`${API_BASE}/cti/events/${call.callId}`);
    es.onmessage = (e) => {
      try {
        const updated = JSON.parse(e.data);
        if (updated.error) { es.close(); return; }
        setCall(updated);
        if (updated.status === 'ended' || updated.status === 'transferred') es.close();
      } catch {}
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [call?.callId]);

  // 고객 전화번호 세팅
  useEffect(() => {
    if (customer?.phone) setDialNumber(customer.phone);
  }, [customer?.phone]);

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ─── Actions ───
  const handleDial = async () => {
    if (!dialNumber) return;
    const result = await api.cti.makeCall(agentId, dialNumber);
    setCall(result);
    setAgentState({ status: 'on_call', callId: result.callId });
  };

  const handleAnswer = async () => {
    if (!call?.callId) return;
    const result = await api.cti.answer(call.callId);
    setCall(result);
    setAgentState({ status: 'on_call', callId: result.callId });
  };

  const handleHold = async () => {
    if (!call?.callId) return;
    const result = await api.cti.hold(call.callId);
    setCall(result);
  };

  const handleResume = async () => {
    if (!call?.callId) return;
    const result = await api.cti.resume(call.callId);
    setCall(result);
  };

  const handleHangup = async () => {
    if (!call?.callId) return;
    const result = await api.cti.hangup(call.callId);
    setCall(result);
    setAgentState({ status: 'idle', callId: null });
    onCallEnd?.(result);
  };

  const handleTransfer = async () => {
    if (!call?.callId || !transferNumber) return;
    const result = await api.cti.transfer(call.callId, transferNumber);
    setCall(result);
    setAgentState({ status: 'idle', callId: null });
    setShowTransfer(false);
    setTransferNumber('');
  };

  // 수신 시뮬레이션
  const handleSimulateIncoming = async () => {
    const result = await api.cti.simulateIncoming(
      agentId,
      customer?.phone || '010-0000-0000',
      customer?.name || '알 수 없음'
    );
    setCall(result);
    setAgentState({ status: 'ringing', callId: result.callId });
  };

  const isActive = call && !['ended', 'transferred'].includes(call.status);
  const stLabel = isActive ? (call.status === 'ringing' && call.direction === 'inbound' ? STATUS_LABEL.ringing : STATUS_LABEL.on_call) : STATUS_LABEL.idle;

  return (
    <div style={styles.panel}>
      {/* 상태 표시 */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: stLabel.color,
            animation: stLabel.pulse ? 'pulse 1s infinite' : 'none',
          }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: stLabel.color }}>{stLabel.text}</span>
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>CTI</span>
      </div>

      {/* 수신 팝업 */}
      {call?.status === 'ringing' && call.direction === 'inbound' && (
        <div style={styles.incomingPopup}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>📞</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{call.customerName || '알 수 없음'}</div>
          <div style={{ fontSize: 14, color: '#fbbf24', fontFamily: 'monospace' }}>{call.phoneNumber}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={handleAnswer} style={{ ...styles.btn, background: '#10b981', flex: 1 }}>받기</button>
            <button onClick={handleHangup} style={{ ...styles.btn, background: '#ef4444', flex: 1 }}>거절</button>
          </div>
        </div>
      )}

      {/* 통화 중 정보 */}
      {isActive && call.status !== 'ringing' && (
        <div style={styles.callInfo}>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>{CALL_STATUS[call.status]}</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#fff', margin: '4px 0' }}>
            {call.phoneNumber}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: '#60a5fa' }}>
            {formatTime(timer)}
          </div>
        </div>
      )}

      {/* 발신 중 */}
      {call?.status === 'ringing' && call.direction === 'outbound' && (
        <div style={styles.callInfo}>
          <div style={{ fontSize: 13, color: '#fbbf24' }}>발신 중...</div>
          <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#fff', margin: '4px 0' }}>
            {call.phoneNumber}
          </div>
          <button onClick={handleHangup} style={{ ...styles.btn, background: '#ef4444', marginTop: 8, width: '100%' }}>취소</button>
        </div>
      )}

      {/* 통화 컨트롤 */}
      {isActive && call.status !== 'ringing' && (
        <div style={styles.controls}>
          {call.status === 'held' ? (
            <button onClick={handleResume} style={{ ...styles.ctrlBtn, background: '#2563eb' }} title="보류 해제">
              <span style={{ fontSize: 16 }}>▶</span><span style={styles.ctrlLabel}>해제</span>
            </button>
          ) : (
            <button onClick={handleHold} style={styles.ctrlBtn} title="보류">
              <span style={{ fontSize: 16 }}>⏸</span><span style={styles.ctrlLabel}>보류</span>
            </button>
          )}
          <button onClick={() => setShowTransfer(!showTransfer)} style={styles.ctrlBtn} title="전환">
            <span style={{ fontSize: 16 }}>↗</span><span style={styles.ctrlLabel}>전환</span>
          </button>
          <button onClick={handleHangup} style={{ ...styles.ctrlBtn, background: '#ef4444' }} title="종료">
            <span style={{ fontSize: 16 }}>✕</span><span style={styles.ctrlLabel}>종료</span>
          </button>
        </div>
      )}

      {/* 전환 입력 */}
      {showTransfer && (
        <div style={{ padding: '8px 12px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={transferNumber} onChange={e => setTransferNumber(e.target.value)}
              placeholder="전환할 번호" style={styles.input} />
            <button onClick={handleTransfer} style={{ ...styles.btn, background: '#8b5cf6', fontSize: 12 }}>전환</button>
          </div>
        </div>
      )}

      {/* 통화 종료 결과 */}
      {call?.status === 'ended' && (
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>통화 종료</div>
          <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#fff' }}>
            {call.phoneNumber} · {call.duration}초
          </div>
          {call.recordingUrl && (
            <div style={{ fontSize: 12, color: '#60a5fa', marginTop: 4 }}>녹취: {call.recordingUrl}</div>
          )}
          <button onClick={() => { setCall(null); setTimer(0); }}
            style={{ ...styles.btn, background: '#334155', marginTop: 8, width: '100%', fontSize: 12 }}>
            닫기
          </button>
        </div>
      )}

      {/* 다이얼 패드 (대기 상태) */}
      {!isActive && !call?.status?.match(/ended/) && (
        <div style={{ padding: '12px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input value={dialNumber} onChange={e => setDialNumber(e.target.value)}
              placeholder="전화번호 입력" style={styles.input}
              onKeyDown={e => e.key === 'Enter' && handleDial()} />
            <button onClick={handleDial} style={{ ...styles.btn, background: '#10b981' }}>발신</button>
          </div>
          {/* 테스트 버튼 */}
          <button onClick={handleSimulateIncoming}
            style={{ ...styles.btn, background: '#334155', width: '100%', fontSize: 11, marginTop: 4 }}>
            수신 시뮬레이션 (테스트)
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  panel: {
    background: '#1e293b',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid #334155',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    borderBottom: '1px solid #334155',
  },
  incomingPopup: {
    background: 'linear-gradient(135deg, #1e3a5f, #1e40af)',
    padding: '16px',
    textAlign: 'center',
    color: '#fff',
    animation: 'pulse 1.5s infinite',
  },
  callInfo: {
    padding: '16px',
    textAlign: 'center',
    color: '#fff',
  },
  controls: {
    display: 'flex',
    gap: 0,
    borderTop: '1px solid #334155',
  },
  ctrlBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '10px 0',
    background: '#334155',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    transition: 'background 0.15s',
  },
  ctrlLabel: { fontSize: 10, opacity: 0.7 },
  btn: {
    padding: '8px 14px',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  input: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #475569',
    background: '#0f172a',
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
};
