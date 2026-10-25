// Тактика перед гонкой: зоны ответственности стратега и игрока. Запуск: node racing-manager/tests/tactics.test.js
const path = require('path');
const { chromium } = require('playwright');
const results = []; const check = (n, ok, info) => { results.push(ok); console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${info ? ' — ' + info : ''}`); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/three.min.js', r => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '../game.html') + '?debug');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pitwall_settings_v1', '{"intro":0,"music":0,"mode":"sim","view":"2d"}'); });
  await page.reload();
  await page.click('[data-a=new]'); await page.click('[data-a=create]');
  const toGrid = async () => {
    await page.click('[data-a=tab][data-v=hq]');
    if (await page.$('[data-a=castvote]')) { await page.click('[data-a=vote][data-v="1"]'); await page.click('[data-a=castvote]'); }
    await page.click('[data-a=weekend]');
    for (let i = 0; i < 15 && !(await page.$('[data-a=race]')); i++) { const nb = await page.$('[data-a=nextstep]') || await page.$('[data-a=runq]') || await page.$('[data-a=qnext]'); if (!nb) break; await nb.click(); }
  };
  const runRace = () => page.evaluate(() => {
    const R = __pitwall.R, D = __dbg; R.count = 0; R.paused = true;
    for (let i = 0; i < R.N; i++) R.wet[i] = i >= 8 && i < 13;           // дождь в середине гонки
    const mine = R.cars.filter(c => c.me), modes = mine.map(() => new Set());
    for (let k = 1; k <= R.N; k++) { D.simLap(k); mine.forEach((c, i) => modes[i].add(c.mode)); }
    return mine.map((c, i) => ({ tac: c.tac, stops: c.stops, used: c.used.join('→'), modes: [...modes[i]], punct: R.feed.filter(f => f.t.startsWith('Прокол у ' + D.nm(c.did))).length }));
  });
  await toGrid();
  const ids = await page.evaluate(() => { const S = __pitwall.S; return S.teams.find(t => t.id === S.pid).drivers; });
  // пилот 1: стратег отвечает только за погоду; пилот 2: стратег ведёт всё
  await page.click(`[data-a=tacall][data-v="${ids[0]}"]`);
  for (const [k, v] of [['plan', 0], ['weather', 1], ['sc', 0], ['mode', 0]]) await page.click(`[data-a=tac][data-v="${ids[0]}|${k}|${v}"]`);
  await page.click('[data-a=race]');
  const r1 = await runRace();
  check('выбор зон переносится в гонку', r1[0].tac.weather && !r1[0].tac.plan && !r1[0].tac.mode && r1[1].tac.plan, JSON.stringify(r1[0].tac));
  check('стратег отвечает только за погоду: заезды только на смену погоды', r1[0].used.split('→').length >= 2 && r1[0].used.includes('I') && !/[SMH]→[SMH]/.test(r1[0].used.split('→I')[0] + (r1[0].used.split('I→')[1] ? '' : '')), `шины ${r1[0].used}, режим ${r1[0].modes.join(',')}`);
  check('режим пилота без стратега не меняется', r1[0].modes.length === 1 && r1[0].modes[0] === 'norm', r1[0].modes.join(','));
  check('стратег ведёт всё: меняет шины и управляет режимом', r1[1].stops >= 2 && r1[1].used.includes('I'), `шины ${r1[1].used}, режимы ${r1[1].modes.join(',')}`);
  await page.evaluate(() => { const R = __pitwall.R; R.paused = false; R.T += 1e9; });
  await page.waitForSelector('text=Итоги гонки', { timeout: 20000 }); await page.click('[data-a=hub]');
  // следующий уик-энд: настройки запомнились; выключаем стратега полностью у пилота 1
  await toGrid();
  const remembered = await page.evaluate(id => !__dbg.W.tac || !__dbg.W.tac[id] ? null : __dbg.W.tac[id], ids[0]);
  await page.click(`[data-a=tac][data-v="${ids[0]}|weather|0"]`);
  await page.click('[data-a=race]');
  const r2 = await runRace();
  check('настройки тактики запоминаются между гонками', !!(await page.evaluate(() => __pitwall.S.tacPref)), remembered ? 'да' : 'задаются при открытии');
  check('всё решает игрок: без команд пилот не заезжает (кроме вынужденного заезда с проколом)', r2[0].stops === r2[0].punct && !r2[0].used.includes('I'), `шины ${r2[0].used}, проколов ${r2[0].punct}`);
  check('нет ошибок JavaScript', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} проверок пройдено`); process.exit(results.every(Boolean) ? 0 : 1);
})();
