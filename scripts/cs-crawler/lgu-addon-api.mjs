// LG U+ 부가서비스 BFF API 직접 호출 → 파싱
import { UA } from './lib/browser.mjs';
import { writeFileSync } from 'fs';
const SC = '/private/tmp/claude-501/-Users-vinsenzo/22c2de51-dc9a-44c2-bacf-7836be4787e0/scratchpad/';

const url = 'https://www.lguplus.com/uhdc/fo/prdv/mblspps/v1/spps-exhi-fo-list?pcMblCd=P';
const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Referer': 'https://www.lguplus.com/mobile/plan/addon/addon-all' } });
const j = await r.json();
const list = j.sppsFoDtoList || [];
console.error('부가서비스 총:', list.length);

const won = s => { const m = (s || '').match(/([\d,]{2,})\s*원/); return m ? parseInt(m[1].replace(/,/g, ''), 10) : (/(무료)/.test(s || '') ? 0 : null); };
const out = list.map(x => ({
  carrier: 'LGU',
  name: x.urcAdvpNm,
  kind: x.urcAdvpKndCd || '',
  feeText: x.advpTadvChrgCntn || '',
  fee: won(x.advpTadvChrgCntn),
  code: x.urcAdvpCd,
})).filter(x => x.name);

writeFileSync(SC + 'lgu-addon.json', JSON.stringify(out, null, 2));
console.error('\n샘플 20건:');
out.slice(0, 20).forEach(x => console.error(`  ${x.name} | ${x.feeText} (${x.fee == null ? '?' : x.fee})`));
// 종류 분포
const kinds = {}; out.forEach(x => kinds[x.kind] = (kinds[x.kind] || 0) + 1);
console.error('\n종류코드:', JSON.stringify(kinds));
