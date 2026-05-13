import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../db/supabase.js';
import { authenticateJWT } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const POLICY_DIR = path.resolve(__dirname, '..', '..', 'docs', 'policy');

const router = express.Router();
const errMsg = (e) => (e && e.message) || String(e);

// 파일 동기화 헬퍼 (DB → .md)
async function syncToFile(slug, title, content) {
  try {
    await fs.mkdir(POLICY_DIR, { recursive: true });
    const filePath = path.join(POLICY_DIR, `${slug}.md`);
    const header = `# ${title}\n\n> 동기화: DB \`policy_documents.slug='${slug}'\` ↔ 본 파일 (어드민 편집 시 자동 갱신)\n> 최종 업데이트: ${new Date().toISOString()}\n\n`;
    // 기존 header가 있으면 본문만 사용, 없으면 그대로
    let body = content;
    if (body.startsWith('# ')) {
      // 첫 헤더 라인 + 동기화 메타 라인 제거
      body = body.replace(/^#\s+.+\n+(>\s+동기화:.*\n+)?(>\s+최종.*\n+)?/m, '');
    }
    await fs.writeFile(filePath, header + body, 'utf8');
    return filePath;
  } catch (e) {
    console.warn('[policy-doc file sync]', e.message);
    return null;
  }
}

// ─── 전체 목록 ───
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('policy_documents')
      .select('id, slug, title, category, display_order, updated_at, updated_by')
      .order('display_order')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json({ documents: data || [] });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 단일 조회 (content 포함) ───
router.get('/:slug', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('policy_documents')
      .select('*')
      .eq('slug', req.params.slug)
      .single();
    if (error) throw error;
    res.json({ document: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 수정 (DB + .md 양방향 동기화) ───
router.put('/:slug', authenticateJWT, async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content, category, display_order, notes } = req.body;
    if (!content) return res.status(400).json({ error: 'content 필수' });
    const update = {
      content,
      updated_at: new Date().toISOString(),
      updated_by: req.user?.email || req.user?.id || 'unknown',
    };
    if (title) update.title = title;
    if (category) update.category = category;
    if (display_order != null) update.display_order = Number(display_order);
    if (notes != null) update.notes = notes;

    const { data, error } = await supabase
      .from('policy_documents')
      .update(update)
      .eq('slug', slug)
      .select()
      .single();
    if (error) throw error;

    // .md 파일 동기화
    const filePath = await syncToFile(slug, data.title, data.content);
    res.json({ document: data, file_path: filePath });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 신규 (admin) ───
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { slug, title, content, category = 'common', display_order = 100, notes } = req.body;
    if (!slug || !title || !content) return res.status(400).json({ error: 'slug, title, content 필수' });
    const insert = {
      slug, title, content, category, display_order, notes,
      updated_by: req.user?.email || req.user?.id || 'unknown',
    };
    const { data, error } = await supabase
      .from('policy_documents').insert(insert).select().single();
    if (error) throw error;
    await syncToFile(slug, data.title, data.content);
    res.json({ document: data });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

// ─── 삭제 (admin) ───
router.delete('/:slug', authenticateJWT, async (req, res) => {
  try {
    const { slug } = req.params;
    const { error } = await supabase.from('policy_documents').delete().eq('slug', slug);
    if (error) throw error;
    // 파일도 삭제
    try { await fs.unlink(path.join(POLICY_DIR, `${slug}.md`)); } catch {}
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: errMsg(e) }); }
});

export default router;
