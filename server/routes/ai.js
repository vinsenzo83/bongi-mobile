import { Router } from 'express';
import { chat, getUpsellRecommendation, generateScript } from '../services/ai.js';
import { supabase } from '../db/supabase.js';

const router = Router();

// 고객용 AI 채팅
router.post('/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages 배열 필수' });
  }
  try {
    const reply = await chat(messages);
    res.json(reply);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CRM용 — 고객별 AI 추천
router.get('/recommend/:customerId', async (req, res) => {
  try {
    const { data: customer } = await supabase
      .from('bongi_customers').select('*').eq('id', req.params.customerId).single();
    if (!customer) return res.status(404).json({ error: '고객 없음' });

    const recommendation = await getUpsellRecommendation(customer);
    res.json(recommendation);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CRM용 — 상담 스크립트 생성
router.post('/script', async (req, res) => {
  const { customerId, productTicket } = req.body;
  try {
    const { data: customer } = await supabase
      .from('bongi_customers').select('*').eq('id', customerId).single();

    let product = null;
    if (productTicket) {
      // products 데이터에서 찾기
      const { products } = await import('../data/products.js');
      for (const cat of Object.values(products)) {
        product = cat.find(p => p.ticket === productTicket);
        if (product) break;
      }
    }

    const script = await generateScript(customer, product);
    res.json({ script });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
