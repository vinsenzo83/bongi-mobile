// 파이어니 × 에이스휴먼파워 단독 특판 신청 API (Supabase 영속화)
import express from 'express';
import { supabase } from '../db/supabase.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DATA_FILE = join(DATA_DIR, 'special-applications.json');
const TABLE = 'bongi_special_promo_applications';

const STATUS_LABELS = {
  pending: '대기',
  contacted: '상담중',
  completed: '완료',
  cancelled: '취소',
};

// === Fallback in-memory + JSON file (Supabase 미설정 시) ===
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
let fallbackApps = [];
if (!supabase) {
  try {
    if (existsSync(DATA_FILE)) {
      fallbackApps = JSON.parse(readFileSync(DATA_FILE, 'utf-8')) || [];
      console.log(`[special-promo] 파일 로드: ${fallbackApps.length}건 (Supabase 미설정)`);
    }
  } catch {}
} else {
  console.log('[special-promo] Supabase 모드');
}
function persistFile() {
  if (supabase) return;
  try { writeFileSync(DATA_FILE, JSON.stringify(fallbackApps, null, 2), 'utf-8'); } catch {}
}

// snake_case ↔ camelCase 변환
function fromDb(r) {
  if (!r) return r;
  return {
    id: r.id,
    empno: r.empno,
    name: r.name,
    phone: r.phone,
    currentCarrier: r.current_carrier,
    moveCarrier: r.move_carrier,
    gift: r.gift,
    color: r.color || '',
    combo: r.combo || false,
    accountHolder: r.account_holder || '',
    bank: r.bank || '',
    account: r.account || '',
    address: r.address,
    addressDetail: r.address_detail || '',
    zonecode: r.zonecode || '',
    agreements: r.agreements || {},
    status: r.status,
    memo: r.memo || '',
    deleted: r.deleted || false,
    trashed_at: r.trashed_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

const router = express.Router();

// 신청 접수
router.post('/', async (req, res) => {
  const {
    empno, name, phone,
    currentCarrier, moveCarrier,
    gift, color, combo,
    accountHolder, bank, account,
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
  const record = {
    id,
    empno: String(empno).trim(),
    name: String(name).trim(),
    phone: String(phone).trim(),
    current_carrier: currentCarrier,
    move_carrier: moveCarrier,
    gift,
    color: color ? String(color).trim() : '',
    combo: combo === '1' || combo === true,
    account_holder: accountHolder ? String(accountHolder).trim() : '',
    bank: bank ? String(bank).trim() : '',
    account: account ? String(account).trim() : '',
    address: String(address).trim(),
    address_detail: addressDetail ? String(addressDetail).trim() : '',
    zonecode: zonecode ? String(zonecode).trim() : '',
    agreements: agreements || {},
    status: 'pending',
    memo: '',
    deleted: false,
    created_at,
    updated_at: created_at,
  };

  if (supabase) {
    const { error } = await supabase.from(TABLE).insert(record);
    if (error) {
      console.error('[special-promo] insert error:', error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }
  } else {
    fallbackApps.unshift(fromDb(record));
    persistFile();
  }

  return res.json({ ok: true, id, created_at });
});

// 목록 조회
router.get('/', async (req, res) => {
  const { status, q, trash } = req.query;
  const isTrash = trash === '1' || trash === 'true';

  let list = [];
  let stats = {};

  if (supabase) {
    let query = supabase.from(TABLE).select('*').order('created_at', { ascending: false });
    query = query.eq('deleted', isTrash);
    if (status && status !== 'all') query = query.eq('status', status);
    if (q) {
      const k = String(q);
      query = query.or(`empno.ilike.%${k}%,name.ilike.%${k}%,phone.ilike.%${k}%,id.ilike.%${k}%`);
    }
    const { data, error } = await query;
    if (error) {
      console.error('[special-promo] select error:', error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }
    list = (data || []).map(fromDb);

    // stats: 전체 활성/휴지통 카운트
    const { data: allActive } = await supabase.from(TABLE).select('status, combo').eq('deleted', false);
    const { count: trashCount } = await supabase.from(TABLE).select('*', { count: 'exact', head: true }).eq('deleted', true);
    const active = allActive || [];
    stats = {
      total: active.length,
      pending: active.filter(a => a.status === 'pending').length,
      contacted: active.filter(a => a.status === 'contacted').length,
      completed: active.filter(a => a.status === 'completed').length,
      cancelled: active.filter(a => a.status === 'cancelled').length,
      combo: active.filter(a => a.combo).length,
      trash: trashCount || 0,
    };
  } else {
    list = fallbackApps.filter(a => isTrash ? a.deleted === true : !a.deleted);
    if (status && status !== 'all') list = list.filter(a => a.status === status);
    if (q) {
      const k = String(q).toLowerCase();
      list = list.filter(a =>
        (a.empno || '').toLowerCase().includes(k) ||
        (a.name || '').toLowerCase().includes(k) ||
        (a.phone || '').includes(k) ||
        (a.id || '').toLowerCase().includes(k)
      );
    }
    const active = fallbackApps.filter(a => !a.deleted);
    stats = {
      total: active.length,
      pending: active.filter(a => a.status === 'pending').length,
      contacted: active.filter(a => a.status === 'contacted').length,
      completed: active.filter(a => a.status === 'completed').length,
      cancelled: active.filter(a => a.status === 'cancelled').length,
      combo: active.filter(a => a.combo).length,
      trash: fallbackApps.filter(a => a.deleted).length,
    };
  }

  return res.json({ ok: true, applications: list, stats, statusLabels: STATUS_LABELS });
});

// 상태/메모 변경
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { status, memo } = req.body || {};
  const updates = { updated_at: new Date().toISOString() };
  if (status && Object.keys(STATUS_LABELS).includes(status)) updates.status = status;
  if (typeof memo === 'string') updates.memo = memo;

  if (supabase) {
    const { data, error } = await supabase.from(TABLE).update(updates).eq('id', id).select().single();
    if (error) return res.status(404).json({ ok: false, error: error.message });
    return res.json({ ok: true, application: fromDb(data) });
  } else {
    const app = fallbackApps.find(a => a.id === id);
    if (!app) return res.status(404).json({ ok: false, error: 'not found' });
    if (updates.status) app.status = updates.status;
    if (updates.memo !== undefined) app.memo = updates.memo;
    app.updated_at = updates.updated_at;
    persistFile();
    return res.json({ ok: true, application: app });
  }
});

// 삭제 (soft / permanent)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { permanent } = req.query;
  const isPermanent = permanent === '1' || permanent === 'true';

  if (supabase) {
    if (isPermanent) {
      const { error } = await supabase.from(TABLE).delete().eq('id', id);
      if (error) return res.status(404).json({ ok: false, error: error.message });
    } else {
      const now = new Date().toISOString();
      const { error } = await supabase.from(TABLE).update({ deleted: true, trashed_at: now, updated_at: now }).eq('id', id);
      if (error) return res.status(404).json({ ok: false, error: error.message });
    }
    return res.json({ ok: true });
  } else {
    const idx = fallbackApps.findIndex(a => a.id === id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'not found' });
    if (isPermanent) {
      fallbackApps.splice(idx, 1);
    } else {
      fallbackApps[idx].deleted = true;
      fallbackApps[idx].trashed_at = new Date().toISOString();
      fallbackApps[idx].updated_at = new Date().toISOString();
    }
    persistFile();
    return res.json({ ok: true });
  }
});

// 복원
router.post('/:id/restore', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    const { data, error } = await supabase.from(TABLE)
      .update({ deleted: false, trashed_at: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(404).json({ ok: false, error: error.message });
    return res.json({ ok: true, application: fromDb(data) });
  } else {
    const app = fallbackApps.find(a => a.id === id);
    if (!app) return res.status(404).json({ ok: false, error: 'not found' });
    app.deleted = false;
    app.trashed_at = null;
    app.updated_at = new Date().toISOString();
    persistFile();
    return res.json({ ok: true, application: app });
  }
});

export default router;
