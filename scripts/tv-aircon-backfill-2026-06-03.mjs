// TV·에어컨 가전 그룹 신규 6컬럼 backfill (라이브)
// 엑셀 → (company + months + monthly_fee) 매칭으로 옵션 UPDATE
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import fs from 'fs';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function execSql(sql) {
  // Supabase MCP 없으면 직접 PG 연결 필요 — service_role로 SELECT POST
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });
  if (!r.ok) throw new Error(`SQL fail: ${await r.text()}`);
  return r.json();
}

// 함수 없으면 직접 SUPABASE_SERVICE_KEY로 SDK update 사용
async function backfillCategory(name, jsonFile) {
  const opts = JSON.parse(fs.readFileSync(jsonFile));
  console.log(`📥 ${name}: ${opts.length} 엑셀 row`);

  // 회사 list
  const { data: companies } = await sb.from('rental_companies').select('id, name');
  const compMap = new Map(companies.map(c => [c.name, c.id]));

  let matched = 0, updated = 0, miss = 0;
  for (const o of opts) {
    if (!o.com_rate || !o.months || !o.monthly_fee) { miss++; continue; }
    const companyId = compMap.get(o.rental);
    if (!companyId) { miss++; continue; }
    // 매칭: product 찾고 옵션 update
    const { data: products } = await sb.from('rental_products')
      .select('id').eq('company_id', companyId);
    const prodIds = products.map(p => p.id);
    if (!prodIds.length) { miss++; continue; }
    const { data: result, error } = await sb.from('rental_product_options')
      .update({
        as_period_months: o.as_period || null,
        signup_age_limit: o.age_limit || null,
        installation_fee: o.install_fee || null,
        commission_rate: o.com_rate || null,
        commission_basis: o.com_basis || null,
        total_rental_fee: o.total_fee || null,
      })
      .in('product_id', prodIds)
      .eq('months', o.months)
      .eq('monthly_fee', o.monthly_fee)
      .select('id');
    if (error) { console.error('err', o.model, error.message); continue; }
    if (result && result.length) { matched++; updated += result.length; }
    else miss++;
  }
  console.log(`✅ ${name}: matched ${matched} groups / updated ${updated} options / miss ${miss}`);
}

await backfillCategory('TV', '/tmp/tv-opts-extracted.json');
await backfillCategory('에어컨', '/tmp/aircon-opts-extracted.json');
