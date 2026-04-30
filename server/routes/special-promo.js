// 파이어니 × 에이스휴먼파워 단독 특판 신청 API (JSON 파일 영속화)
import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'special-applications.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

let applications = [];
try {
  if (existsSync(DATA_FILE)) {
    applications = JSON.parse(readFileSync(DATA_FILE, 'utf-8')) || [];
    console.log(`[special-promo] 로드: ${applications.length}건`);
  } else {
    writeFileSync(DATA_FILE, '[]', 'utf-8');
  }
} catch (err) {
  console.error('[special-promo] 데이터 로드 실패:', err.message);
  applications = [];
}

function persist() {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(applications, null, 2), 'utf-8');
  } catch (err) {
    console.error('[special-promo] 데이터 저장 실패:', err.message);
  }
}

const router = express.Router();

const STATUS_LABELS = {
  pending: '대기',
  contacted: '상담중',
  completed: '완료',
  cancelled: '취소',
};

// 신청 접수
router.post('/', (req, res) => {
  const {
    empno, name, phone,
    currentCarrier, moveCarrier,
    gift, color, combo,
    accountHolder, account,
    address, addressDetail, zonecode,
    agreements,
  } = req.body || {};

  if (!empno || !name || !phone || !currentCarrier || !moveCarrier || !gift || !address) {
    return res.status(400).json({ ok: false, error: 'missing required fields' });
  }
  if (currentCarrier === moveCarrier) {
    return res.status(400).json({ ok: false, error: 'current and move carrier must differ' });
  }

  const id = `SP${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000).toString(36).toUpperCase()}`;
  const created_at = new Date().toISOString();
  const application = {
    id,
    empno: String(empno).trim(),
    name: String(name).trim(),
    phone: String(phone).trim(),
    currentCarrier,
    moveCarrier,
    gift,
    color: color ? String(color).trim() : '',
    combo: combo === '1' || combo === true,
    accountHolder: accountHolder ? String(accountHolder).trim() : '',
    account: account ? String(account).trim() : '',
    address: String(address).trim(),
    addressDetail: addressDetail ? String(addressDetail).trim() : '',
    zonecode: zonecode ? String(zonecode).trim() : '',
    agreements: agreements || {},
    status: 'pending',
    memo: '',
    created_at,
    updated_at: created_at,
  };
  applications.unshift(application);
  persist();

  return res.json({ ok: true, id, created_at });
});

// 목록 조회
router.get('/', (req, res) => {
  const { status, q } = req.query;
  let list = [...applications];

  if (status && status !== 'all') {
    list = list.filter(a => a.status === status);
  }
  if (q) {
    const k = String(q).toLowerCase();
    list = list.filter(a =>
      (a.empno || '').toLowerCase().includes(k) ||
      (a.name || '').toLowerCase().includes(k) ||
      (a.phone || '').includes(k) ||
      (a.id || '').toLowerCase().includes(k)
    );
  }

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    contacted: applications.filter(a => a.status === 'contacted').length,
    completed: applications.filter(a => a.status === 'completed').length,
    cancelled: applications.filter(a => a.status === 'cancelled').length,
    combo: applications.filter(a => a.combo).length,
  };

  return res.json({ ok: true, applications: list, stats, statusLabels: STATUS_LABELS });
});

// 상태/메모 변경
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const app = applications.find(a => a.id === id);
  if (!app) return res.status(404).json({ ok: false, error: 'not found' });

  const { status, memo } = req.body || {};
  if (status && Object.keys(STATUS_LABELS).includes(status)) app.status = status;
  if (typeof memo === 'string') app.memo = memo;
  app.updated_at = new Date().toISOString();
  persist();

  return res.json({ ok: true, application: app });
});

// 삭제
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const idx = applications.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'not found' });
  applications.splice(idx, 1);
  persist();
  return res.json({ ok: true });
});

export default router;
