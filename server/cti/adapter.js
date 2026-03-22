// CTI 어댑터 인터페이스
// NHN Contiple 연동 시 이 파일만 교체

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CALL_LOG_DIR = join(__dirname, '..', 'data', 'call-logs');

class CTIAdapter {
  constructor() {
    this.calls = new Map();
    this.agents = new Map();
    // 통화 로그 디렉토리 생성
    if (!existsSync(CALL_LOG_DIR)) mkdirSync(CALL_LOG_DIR, { recursive: true });
  }

  // 종료된 통화를 파일로 저장
  _persistCall(call) {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const logFile = join(CALL_LOG_DIR, `${date}.json`);
      const logs = existsSync(logFile) ? JSON.parse(readFileSync(logFile, 'utf8')) : [];
      logs.push(call);
      writeFileSync(logFile, JSON.stringify(logs, null, 2));
    } catch (e) {
      console.warn('통화 로그 저장 실패:', e.message);
    }
  }

  // 발신
  async makeCall(agentId, phoneNumber) {
    const callId = 'call-' + Date.now().toString(36);
    const call = {
      callId,
      agentId,
      phoneNumber,
      direction: 'outbound',
      status: 'ringing', // ringing → connected → held → ended
      startedAt: new Date().toISOString(),
      connectedAt: null,
      endedAt: null,
      duration: 0,
      recordingUrl: null,
    };
    this.calls.set(callId, call);
    this.agents.set(agentId, { status: 'on_call', callId });

    // Mock: 2초 후 자동 연결
    setTimeout(() => {
      if (this.calls.has(callId) && this.calls.get(callId).status === 'ringing') {
        this.calls.get(callId).status = 'connected';
        this.calls.get(callId).connectedAt = new Date().toISOString();
      }
    }, 2000);

    return call;
  }

  // 수신 응답
  async answerCall(callId) {
    const call = this.calls.get(callId);
    if (!call) throw new Error('통화를 찾을 수 없습니다');
    call.status = 'connected';
    call.connectedAt = new Date().toISOString();
    return call;
  }

  // 보류
  async holdCall(callId) {
    const call = this.calls.get(callId);
    if (!call) throw new Error('통화를 찾을 수 없습니다');
    call.status = 'held';
    return call;
  }

  // 보류 해제
  async resumeCall(callId) {
    const call = this.calls.get(callId);
    if (!call) throw new Error('통화를 찾을 수 없습니다');
    call.status = 'connected';
    return call;
  }

  // 전환
  async transferCall(callId, targetNumber) {
    const call = this.calls.get(callId);
    if (!call) throw new Error('통화를 찾을 수 없습니다');
    call.status = 'transferred';
    call.transferTo = targetNumber;
    call.endedAt = new Date().toISOString();
    this.agents.delete(call.agentId);
    return call;
  }

  // 종료
  async hangupCall(callId) {
    const call = this.calls.get(callId);
    if (!call) throw new Error('통화를 찾을 수 없습니다');
    call.status = 'ended';
    call.endedAt = new Date().toISOString();
    if (call.connectedAt) {
      call.duration = Math.round((new Date(call.endedAt) - new Date(call.connectedAt)) / 1000);
    }
    // Mock 녹취 URL
    call.recordingUrl = `/recordings/${callId}.wav`;
    this.agents.delete(call.agentId);
    // 종료된 통화 영속화
    this._persistCall(call);
    return call;
  }

  // 통화 상태 조회
  getCall(callId) {
    return this.calls.get(callId) || null;
  }

  // 상담사 상태 조회
  getAgentState(agentId) {
    return this.agents.get(agentId) || { status: 'idle', callId: null };
  }

  // 수신 시뮬레이션 (Mock)
  simulateIncoming(agentId, phoneNumber, customerName) {
    const callId = 'call-' + Date.now().toString(36);
    const call = {
      callId,
      agentId,
      phoneNumber,
      customerName,
      direction: 'inbound',
      status: 'ringing',
      startedAt: new Date().toISOString(),
      connectedAt: null,
      endedAt: null,
      duration: 0,
      recordingUrl: null,
    };
    this.calls.set(callId, call);
    this.agents.set(agentId, { status: 'ringing', callId });
    return call;
  }
}

// 싱글톤
export const cti = new CTIAdapter();
