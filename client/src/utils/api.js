const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

// 토큰 getter 등록 (AuthProvider에서 설정)
let _getToken = () => sessionStorage.getItem('access_token');
export function setTokenGetter(fn) { _getToken = fn; }

async function request(path, options = {}) {
  const token = _getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '요청 실패');
  }
  return res.json();
}

export const api = {
  // 상품
  getCategories: () => request('/products/categories'),
  getProducts: (category) => request(`/products/${category}`),
  getProductByTicket: (ticket) => request(`/products/ticket/${ticket}`),
  getStores: () => request('/stores'),
  submitApplication: (data) => request('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // CRM
  crm: {
    getDashboard: () => request('/crm/dashboard/stats'),
    getCustomers: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/crm/customers${q ? '?' + q : ''}`);
    },
    getCustomer: (id) => request(`/crm/customers/${id}`),
    updateCustomer: (id, data) => request(`/crm/customers/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
    getCustomerConsultations: (id) => request(`/crm/customers/${id}/consultations`),
    getCustomerContracts: (id) => request(`/crm/customers/${id}/contracts`),
    createConsultation: (data) => request('/crm/consultations', {
      method: 'POST', body: JSON.stringify(data),
    }),
    updateConsultation: (id, data) => request(`/crm/consultations/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
    createContract: (data) => request('/crm/contracts', {
      method: 'POST', body: JSON.stringify(data),
    }),
    getAgents: () => request('/crm/agents'),
    getAgentPerformance: (id, yearMonth) => request(`/crm/agents/${id}/performance${yearMonth ? '?year_month=' + yearMonth : ''}`),
    getApplications: (status) => request(`/crm/applications${status ? '?status=' + status : ''}`),
  },

  // CTI
  cti: {
    makeCall: (agentId, phoneNumber) => request('/cti/call', {
      method: 'POST', body: JSON.stringify({ agentId, phoneNumber }),
    }),
    answer: (callId) => request(`/cti/answer/${callId}`, { method: 'POST' }),
    hold: (callId) => request(`/cti/hold/${callId}`, { method: 'POST' }),
    resume: (callId) => request(`/cti/resume/${callId}`, { method: 'POST' }),
    transfer: (callId, targetNumber) => request(`/cti/transfer/${callId}`, {
      method: 'POST', body: JSON.stringify({ targetNumber }),
    }),
    hangup: (callId) => request(`/cti/hangup/${callId}`, { method: 'POST' }),
    getCall: (callId) => request(`/cti/call/${callId}`),
    getAgentState: (agentId) => request(`/cti/agent/${agentId}`),
    simulateIncoming: (agentId, phoneNumber, customerName) => request('/cti/simulate-incoming', {
      method: 'POST', body: JSON.stringify({ agentId, phoneNumber, customerName }),
    }),
  },

  // 후기
  reviews: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/reviews${qs ? '?' + qs : ''}`);
    },
    create: (data) => request('/reviews', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  // AI
  ai: {
    chat: (messages) => request('/ai/chat', {
      method: 'POST', body: JSON.stringify({ messages }),
    }),
    getRecommendation: (customerId) => request(`/ai/recommend/${customerId}`),
    generateScript: (customerId, productTicket) => request('/ai/script', {
      method: 'POST', body: JSON.stringify({ customerId, productTicket }),
    }),
  },
};
