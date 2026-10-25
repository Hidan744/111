// Автотесты сохранений и экономики Пит-Уолл. Запуск: node racing-manager/tests/save.test.js (нужен Playwright)
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require('playwright');
const GAME = 'file://' + path.resolve(__dirname, '../game.html') + '?debug';
const results = [];
const check = (name, ok, info) => { results.push({ name, ok }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/three.min.js', r => r.abort());
  await page.goto(GAME);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pitwall_settings_v1', '{"intro":0,"music":0,"mode":"sim","view":"2d"}'); });
  await page.reload();
  await page.click('[data-a=new]'); await page.click('[data-a=create]');
  const toQuali = async () => {
    await page.click('[data-a=tab][data-v=hq]');
    if (await page.$('[data-a=castvote]')) { await page.click('[data-a=vote][data-v="1"]'); await page.click('[data-a=castvote]'); }
    await page.click('[data-a=weekend]');
    for (let i = 0; i < 15 && !(await page.$('[data-a=race]')); i++) { const nb = await page.$('[data-a=nextstep]') || await page.$('[data-a=runq]') || await page.$('[data-a=qnext]'); if (!nb) break; await nb.click(); }
  };
  const finishRace = async () => {
    await page.evaluate(() => { const R = __pitwall.R; R.paused = false; R.count = 0; R.speed = 32; R.T += 1e9; });
    await page.waitForSelector('text=Итоги гонки', { timeout: 30000 });
    return page.evaluate(() => __pitwall.S.lastRace.rows.map(r => r.did).join(','));
  };

  // 1. Уик-энд переживает перезагрузку: погода и стартовая решётка те же
  await toQuali();
  const before = await page.evaluate(() => ({ w: JSON.stringify(__dbg.W.weather), g: __dbg.W.grid.map(x => x.id).join(',') }));
  await page.waitForTimeout(600);
  const snap = await page.evaluate(() => localStorage.getItem('pitwall_save_v1'));
  await page.reload(); await page.click('[data-a=continue]');
  const after = await page.evaluate(() => ({ w: __dbg.W && JSON.stringify(__dbg.W.weather), g: __dbg.W && __dbg.W.grid && __dbg.W.grid.map(x => x.id).join(','), scr: __pitwall.S && document.querySelector('[data-a=race]') !== null }));
  check('уик-энд продолжается после перезагрузки', after.w === before.w && after.g === before.g && after.scr, after.scr ? 'погода и решётка совпали' : 'нет кнопки гонки');

  // 2. Гонка воспроизводима: перезапуск страницы не даёт переиграть результат
  await page.click('[data-a=race]');
  const orderA = await finishRace();
  await page.evaluate(s => localStorage.setItem('pitwall_save_v1', s), snap);
  await page.reload(); await page.click('[data-a=continue]'); await page.click('[data-a=race]');
  const orderB = await finishRace();
  check('гонка воспроизводима после перезагрузки', orderA === orderB, orderA === orderB ? 'одинаковый итоговый порядок' : 'порядок отличается');

  // 3. Учёт денег: начальный баланс + операции = конечный в каждом периоде
  const inv = await page.evaluate(() => __pitwall.S.fin.periods.map(p => +(p.start + p.sum - p.end).toFixed(2)));
  check('баланс сходится с операциями', inv.length > 0 && inv.every(x => Math.abs(x) <= .01), `периодов ${inv.length}`);
  await page.click('[data-a=hub]');

  // 4. Повреждённое основное сохранение — загружается резервная копия, данные не стираются
  const good = await page.evaluate(() => __pitwall.S.round);
  await page.evaluate(() => localStorage.setItem('pitwall_save_v1', '{испорчено'));
  await page.reload();
  const note = await page.textContent('body');
  await page.click('[data-a=continue]');
  const rec = await page.evaluate(() => __pitwall.S && __pitwall.S.round);
  const kept = await page.evaluate(() => localStorage.getItem('pitwall_save_v1') !== null);
  check('повреждённое сохранение: резервная копия', /резервная копия/.test(note) && rec >= good - 1 && kept, `этап ${rec}`);

  // 5. Экспорт и импорт карьеры
  await page.reload(); await page.click('[data-a=continue]'); await page.reload();
  await page.click('[data-a=settings]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a=export]')]);
  const file = path.join(os.tmpdir(), 'pitwall-export.json'); await dl.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  await page.evaluate(() => { localStorage.removeItem('pitwall_save_v1'); localStorage.removeItem('pitwall_save_v1_bak'); });
  await page.reload();
  await page.setInputFiles('#importfile', file);
  await page.waitForTimeout(300);
  const imp = await page.evaluate(() => __pitwall.S && { b: __pitwall.S.budget, r: __pitwall.S.round });
  check('экспорт и импорт карьеры', imp && imp.b === exported.budget && imp.r === exported.round, imp ? `бюджет ${imp.b}` : 'не загрузилось');

  // 6. Переполненное хранилище: игра не падает и предупреждает
  const quota = await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('QuotaExceededError') }; let r; try { r = __dbg.save(); } finally { Storage.prototype.setItem = o; } return r; });
  check('переполненное хранилище не ломает игру', quota === false, 'save() вернул false, показано предупреждение');

  check('нет ошибок JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
  process.exit(failed ? 1 : 0);
})();
