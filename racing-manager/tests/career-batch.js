// Серии быстрых карьер без отрисовки. Запуск: node racing-manager/tests/career-batch.js <команда 0|5|10|own> <политика> <сезонов> <прогонов>
// Политики: spend (сбалансированно), save (без развития), aero (всё в одну характеристику), infra (сначала база), risky (без резерва)
const path = require('path');
const { chromium } = require('playwright');
const [team = '5', policy = 'spend', seasons = '3', runs = '10'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/three.min.js', r => r.abort());
  await page.route(/fonts\.(googleapis|gstatic)/, r => r.abort());
  await page.goto('file://' + (process.env.GAME || path.resolve(__dirname, '../game.html')) + '?debug');
  await page.evaluate(() => localStorage.setItem('pitwall_settings_v1', '{"intro":0,"music":0}'));
  const res = [];
  for (let i = 0; i < +runs; i++) res.push(await page.evaluate(o => __dbg.batchCareer(o), { team, policy, seasons: +seasons }));
  console.log(JSON.stringify({ team, policy, seasons: +seasons, runs: +runs, res, errors: errors.slice(0, 3) }));
  await browser.close();
})();
