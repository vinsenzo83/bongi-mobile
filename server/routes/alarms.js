import { Router } from 'express';
import { supabase } from '../db/supabase.js';

const router = Router();

const VALID_TYPES = ['plan_change', 'addon_cancel', 'internet_expire', 'rental_expire'];

// GET /api/alarms — 내 알람 목록
router.get('/', async (req, res) => {
  try {
    if (!req.user) return res.json({ alarms: [] });
    const { data, error } = await supabase
      .from('bongi_user_alarms')
      .select('*')
      .eq('user_id', req.user.id)
      .order('target_date', { ascending: true });

    if (error) throw error;
    res.json({ alarms: data });
  } catch (e) {
    console.error('알람 조회 실패:', e.message);
    res.json({ alarms: [] });
  }
});

// POST /api/alarms — 알람 추가
router.post('/', async (req, res) => {
  const { alarm_type, title, target_date, memo } = req.body;

  if (!alarm_type || !title || !target_date) {
    return res.status(400).json({ error: 'alarm_type, title, target_date는 필수입니다' });
  }
  if (!VALID_TYPES.includes(alarm_type)) {
    return res.status(400).json({ error: `유효하지 않은 alarm_type: ${alarm_type}` });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
    return res.status(400).json({ error: 'target_date는 YYYY-MM-DD 형식이어야 합니다' });
  }

  try {
    const { data, error } = await supabase
      .from('bongi_user_alarms')
      .insert({
        user_id: req.user.id,
        alarm_type,
        title: title.slice(0, 100),
        target_date,
        memo: (memo || '').slice(0, 500),
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ alarm: data });
  } catch (e) {
    console.error('알람 추가 실패:', e.message);
    res.status(500).json({ error: '알람을 추가할 수 없습니다' });
  }
});

// PATCH /api/alarms/:id — 알람 수정
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, target_date, memo } = req.body;

  const updates = {};
  if (title !== undefined) updates.title = title.slice(0, 100);
  if (target_date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
      return res.status(400).json({ error: 'target_date는 YYYY-MM-DD 형식이어야 합니다' });
    }
    updates.target_date = target_date;
  }
  if (memo !== undefined) updates.memo = memo.slice(0, 500);

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: '수정할 항목이 없습니다' });
  }

  try {
    const { data, error } = await supabase
      .from('bongi_user_alarms')
      .update(updates)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: '알람을 찾을 수 없습니다' });
    res.json({ alarm: data });
  } catch (e) {
    console.error('알람 수정 실패:', e.message);
    res.status(500).json({ error: '알람을 수정할 수 없습니다' });
  }
});

// DELETE /api/alarms/:id — 알람 삭제
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('bongi_user_alarms')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    console.error('알람 삭제 실패:', e.message);
    res.status(500).json({ error: '알람을 삭제할 수 없습니다' });
  }
});

export default router;
