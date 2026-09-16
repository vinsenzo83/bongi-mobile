// 빌리고 월별 엑셀을 rental_cat_* 에 적재 (CLI). 기본은 미리보기만, --commit 이면 반영.
//   node scripts/rental-catalog-import.mjs --env .env.dev --month 2026-09 --file "<xlsx>" [--commit]
import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { parseRentalWorkbook } from '../server/services/rental-import/index.js';
import { previewImport, commitImport } from '../server/services/rental-import/commit.js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const envFile = arg('--env');
if (!envFile) { console.error('--env 필수 (라이브 오적재 방지)'); process.exit(1); }
const env = dotenv.parse(fs.readFileSync(envFile));
const month = arg('--month'); const file = arg('--file');
if (!/^\d{4}-\d{2}$/.test(month || '') || !file) { console.error('--month YYYY-MM --file <xlsx> 필수'); process.exit(1); }
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
console.log('대상 DB:', new URL(env.SUPABASE_URL).host.split('.')[0]);

const buf = fs.readFileSync(file);
const parsed = parseRentalWorkbook(buf, { month });
const blocking = parsed.sheets.filter((s) => s.missingRows.length || s.errors.length);
console.log(`파일=${parsed.file} 조건=${parsed.offers.length} 시트=${parsed.sheets.length} 차단시트=${blocking.map((s) => s.sheet).join(',') || '없음'}`);
const { summary } = await previewImport(supabase, parsed);
console.log('미리보기:', summary);
if (!process.argv.includes('--commit')) process.exit(0);
if (blocking.length) { console.error('차단 시트가 있어 반영하지 않습니다'); process.exit(1); }

const batch = { id: randomUUID(), month, file_kind: parsed.file, file_name: path.basename(file), file_hash: createHash('sha256').update(buf).digest('hex'), status: 'preview', sheet_report: parsed.sheets.map(({ missingRows, errors, duplicateSamples, ...s }) => ({ ...s, missing: missingRows.length, errors: errors.length })), created_by: 'cli' };
await supabase.from('rental_cat_batches').insert(batch).throwOnError();
const t = Date.now();
const result = await commitImport(supabase, { batch, offers: parsed.offers, sheets: parsed.sheets, supplierRules: parsed.supplierRules, user: 'cli' });
console.log('반영 완료', result, `${Math.round((Date.now() - t) / 1000)}s`);
