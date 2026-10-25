// Безопасность и надёжность: импорт сохранения с HTML в строках, работа без сети, утечки памяти и обработчиков.
// Запуск: node racing-manager/tests/security.test.js
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require('playwright');
const GAME = 'file://' + path.resolve(__dirname, '../game.html') + '?debug';
const results = []; const check = (n, ok, info) => { results.push(ok); console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${info ? ' — ' + info : ''}`); };
(async () => {
  const browser = await chromium.launch({ args: ['--js-flags=--expose-gc'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('dialog ' + d.message()); d.dismiss(); });
  // 1. без интернета: все внешние запросы оборваны
  await page.route(/^https?:/, r => r.abort());
  await page.goto(GAME);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pitwall_settings_v1', '{"intro":0,"music":0,"mode":"sim"}'); });
  await page.reload();
  await page.click('[data-a=new]'); await page.click('[data-a=create]');
  const offline = await page.evaluate(() => ({ three: typeof THREE !== 'undefined', hub: !!document.querySelector('[data-a=weekend]') }));
  check('игра запускается без интернета (3D отключается, 2D работает)', offline.hub && !offline.three, `three.js: ${offline.three ? 'есть' : 'нет'}`);
  // 2. импорт сохранения со строками-ловушками: ни одна не исполняется как HTML
  const evil = '<img src=x id=pwn onerror="window.__pwn=1">';
  const file = path.join(os.tmpdir(), 'pitwall-evil.json');
  const S = await page.evaluate(() => JSON.parse(JSON.stringify(__pitwall.S)));
  const poison = o => { if (Array.isArray(o)) return o.map(poison); if (o && typeof o === 'object') { for (const k of Object.keys(o)) { if (['id', 'pid', 'tid', 'team', 'goal', 'did', 'k', 'part', 'comp', 'type', 'league', 'region', 'scr', 'from', 'tyre', 'mode', 'cat'].includes(k)) continue; o[k] = typeof o[k] === 'string' ? o[k] + evil : poison(o[k]); } } return o; };
  poison(S.teams); poison(S.drivers); poison(S.sponsors); poison(S.offers); S.news = (S.news || []).map(n => typeof n === 'string' ? n + evil : poison(n));
  fs.writeFileSync(file, JSON.stringify(S));
  await page.click('[data-a=settings]'); await page.setInputFiles('#importfile', file); await page.waitForTimeout(300);
  for (const tab of ['hq', 'car', 'staff', 'academy', 'money', 'table']) { await page.click(`[data-a=tab][data-v=${tab}]`); await page.waitForTimeout(80); }
  for (const st of ['teams', 'drivers', 'hist']) { await page.click('[data-a=tab][data-v=table]'); const b = await page.$(`[data-a=stand][data-v=${st}]`); if (b) await b.click(); }
  const pwn = await page.evaluate(() => ({ el: !!document.getElementById('pwn'), flag: !!window.__pwn }));
  check('строки из импортированного сохранения не исполняются как HTML', !pwn.el && !pwn.flag, pwn.el ? 'найден внедрённый элемент' : 'чисто на 6 вкладках');
  // 3. память и обработчики: 6 гонок подряд без роста
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pitwall_settings_v1', '{"intro":0,"music":0,"mode":"sim","view":"2d"}'); });
  await page.reload(); await page.click('[data-a=new]'); await page.click('[data-a=create]');
  const heap = [];
  for (let i = 0; i < 6; i++) {
    await page.click('[data-a=tab][data-v=hq]');
    if (await page.$('[data-a=castvote]')) { await page.click('[data-a=vote][data-v="1"]'); await page.click('[data-a=castvote]'); }
    await page.click('[data-a=weekend]');
    for (let j = 0; j < 15 && !(await page.$('[data-a=race]')); j++) { const nb = await page.$('[data-a=nextstep]') || await page.$('[data-a=runq]') || await page.$('[data-a=qnext]'); if (!nb) break; await nb.click(); }
    await page.click('[data-a=race]');
    await page.evaluate(() => { const R = __pitwall.R; R.count = 0; R.T += 1e9; });
    await page.waitForSelector('text=Итоги гонки');
    await page.click('[data-a=hub]');
    heap.push(await page.evaluate(() => { if (window.gc) gc(); return performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0; }));
  }
  const grow = heap[heap.length - 1] - heap[1];
  check('память не растёт от гонки к гонке', grow < 8, `куча, МБ: ${heap.join(' → ')}`);
  const loops = await page.evaluate(() => typeof __pitwall.R === 'object' && __pitwall.R && !__pitwall.R.done);
  check('после гонки симуляция остановлена', !loops);
  check('нет ошибок JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} проверок пройдено`); process.exit(results.every(Boolean) ? 0 : 1);
})();
