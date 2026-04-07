/**
 * 스마트초이스 공시지원금 자동 크롤링
 * 매일 09:00 KST 자동 실행 (node-cron)
 * Playwright headless chromium 사용
 */

import { chromium } from 'playwright';
import { supabase } from '../db/supabase.js';

const TARGET_KEYWORDS = ['S26', 'S25', '플립7', '폴드7', '아이폰 17', '아이폰 16'];
const EXCLUDE_KEYWORDS = ['S7', 'S6', 'S20', 'S23', '노트', '올림픽', '크록스', 'S24'];
const DELAY = 10000;
const DELAY_ERR = 30000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function collectModelCodes(page, maker) {
  await page.selectOption('#dan_Mau', maker);
  await page.waitForTimeout(500);
  await page.evaluate(`productPopup('${maker}', 'D', '')`);
  await page.waitForTimeout(5000);
  const models = await page.evaluate(() => {
    const r = [];
    document.querySelectorAll('input[name="PLAN_CODE"]').forEach(i => {
      const l = i.nextElementSibling;
      const n = l ? l.querySelector('.phone_name') : null;
      if (n) r.push({ name: n.innerText.trim(), code: i.value, id: i.id });
    });
    return r;
  });
  await page.evaluate(`var b=document.querySelector('.layerPop .btn_close,[onclick*="close"]');if(b)b.click();`);
  await page.waitForTimeout(1000);
  return models;
}

function filterModels(models, maker) {
  return models.filter(m => {
    const n = m.name;
    if (!TARGET_KEYWORDS.some(t => n.includes(t))) return false;
    if (EXCLUDE_KEYWORDS.some(e => n.includes(e))) return false;
    return true;
  }).map(m => ({
    ...m,
    maker,
    service: m.name.includes('[LTE]') ? 'LTE' : '5G',
    clean_name: m.name.replace('[5G] ', '').replace('[LTE] ', '').trim(),
  }));
}

async function searchSubsidy(page, model) {
  await page.evaluate(`
    document.getElementById('dan_Mau').value='${model.maker}';
    document.getElementById('productName').value='${model.code}';
    document.getElementById('dan_Pc_Name').value='${model.clean_name}';
    document.getElementById('dan_Service').value='${model.service}';
    document.getElementById('selectPhone_BTN').innerText='${model.clean_name}';
  `);
  await page.waitForTimeout(500);
  await page.evaluate("danAllSearch('web')");
  await page.waitForTimeout(8000);

  const rows = await page.$$('#planTable tr');
  const results = [];
  for (const row of rows) {
    const cols = await row.$$('td');
    if (cols.length >= 3) {
      const v = await Promise.all(cols.map(c => c.innerText()));
      const vals = v.map(t => t.trim());
      if (vals[0] && !vals[0].includes('옵션') && !vals[0].includes('선택')) {
        results.push({
          model: model.clean_name,
          carrier: vals[0],
          plan_name: vals[1] || '',
          subsidy_amount: vals[2] || '',
          updated_date: new Date().toISOString().slice(0, 10),
        });
      }
    }
  }
  return results;
}

export async function crawlSubsidy() {
  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`\n${'='.repeat(50)}\n 공시지원금 크롤링 [${now}]\n${'='.repeat(50)}\n`);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.smartchoice.or.kr/smc/mobile/dantongList.do?type=pc', { timeout: 30000 });
    await page.waitForTimeout(5000);

    const allModels = [];
    for (const maker of ['삼성전자', '애플']) {
      const models = await collectModelCodes(page, maker);
      const filtered = filterModels(models, maker);
      allModels.push(...filtered);
      console.log(`${maker}: ${filtered.length}개`);
    }

    console.log(`총 ${allModels.length}개 모델 (간격 ${DELAY / 1000}초)\n`);

    const allResults = [];
    for (let i = 0; i < allModels.length; i++) {
      const model = allModels[i];
      try {
        const results = await searchSubsidy(page, model);
        allResults.push(...results);
        const st = results.length ? `✅ ${results.length}건` : '⚠️ 없음';
        console.log(`  [${i + 1}/${allModels.length}] ${model.clean_name}: ${st}`);
        await sleep(DELAY);
      } catch (e) {
        console.log(`  [${i + 1}/${allModels.length}] ${model.clean_name}: ❌ ${String(e).slice(0, 40)}`);
        await sleep(DELAY_ERR);
        try {
          await page.goto('https://www.smartchoice.or.kr/smc/mobile/dantongList.do?type=pc', { timeout: 30000 });
          await page.waitForTimeout(5000);
        } catch { /* ignore */ }
      }
    }

    await browser.close();

    // Supabase에 저장
    if (allResults.length > 0 && supabase) {
      // 기존 데이터 삭제 후 새로 삽입
      await supabase.from('bongi_subsidy_data').delete().neq('id', 0);
      // 500개씩 배치 삽입
      for (let i = 0; i < allResults.length; i += 500) {
        const batch = allResults.slice(i, i + 500);
        const { error } = await supabase.from('bongi_subsidy_data').insert(batch);
        if (error) console.error('DB 삽입 에러:', error.message);
      }
      console.log(`✅ Supabase 저장: ${allResults.length}건`);
    }

    console.log(`\n완료: ${allResults.length}건\n`);
    return allResults;
  } catch (e) {
    console.error('크롤링 실패:', e.message);
    if (browser) await browser.close();
    return [];
  }
}
