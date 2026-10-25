// Автотесты логики гонки Пит-Уолл.
// Запуск: npm i playwright && node racing-manager/tests/race-logic.test.js
// Игра открывается с ?debug — тогда доступны внутренние функции через window.__dbg.
// Three.js не загружается (гонка идёт в 2D), сеть не нужна.
const path = require('path');
const { chromium } = require('playwright');

const GAME = 'file://' + path.resolve(__dirname, '../game.html') + '?debug';
const results = [];
const check = (name, ok, info) => { results.push({ name, ok, info }); console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${info ? ' — ' + info : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  await page.route('**/three.min.js', r => r.abort());
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss(); });
  await page.goto(GAME);
  // заставка и музыка мешают кликам — отключаем их для логических проверок
  const clean = async () => { await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pitwall_settings_v1', '{"intro":0,"music":0}'); }); await page.reload(); };
  await clean();

  // 1. Пользовательское имя команды экранируется
  await page.click('[data-a=new]');
  await page.click('[data-a=ownmode][data-v="1"]');
  await page.fill('#tname', '<img src=x onerror=alert(1)>');
  await page.click('[data-a=create]');
  check('имя команды экранируется', await page.evaluate(() => document.querySelectorAll('img').length) === 0);
  await clean();
  await page.click('[data-a=new]');
  await page.click('[data-a=create]');
  await page.click('[data-a=settings]');
  await page.click('[data-a=set][data-v="mode|sim"]');
  await page.click('[data-a=set][data-v="view|2d"]');
  await page.click('[data-a=back]');

  const toRace = async () => {
    await page.click('[data-a=tab][data-v=hq]');
    if (await page.$('[data-a=castvote]')) { await page.click('[data-a=vote][data-v="1"]'); await page.click('[data-a=castvote]'); }
    await page.click('[data-a=weekend]');
    await page.click('[data-a=nextstep]');
    await page.click('[data-a=runq]');
  };
  const finish = async () => {
    await page.evaluate(() => { const R = __pitwall.R; R.paused = false; R.count = 0; R.T += 1e9; });
    await page.waitForSelector('text=Итоги гонки', { timeout: 20000 });
    await page.click('[data-a=hub]');
  };

  // 2. Сила машины и пилота определяет результат (с разумной случайностью)
  let rho = 0, n = 0;
  for (let r = 0; r < 8; r++) {
    await toRace();
    const exp = await page.evaluate(() => {
      const D = __dbg, S = __pitwall.S, W = D.W;
      return Object.fromEntries(W.grid.map(g => { const t = S.teams.find(x => x.id === g.tid), d = S.drivers[g.id]; return [g.id, (100 - D.perf(t, W.tr)) * .06 + (100 - d.pace) * .035]; }));
    });
    await page.click('[data-a=race]');
    await finish();
    const rows = await page.evaluate(() => __pitwall.S.lastRace.rows.filter(r => !r.out).map(r => ({ id: r.did, pos: r.pos })));
    const rank = a => { const s = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const out = []; s.forEach(([, i], k) => out[i] = k + 1); return out; };
    const rx = rank(rows.map(r => exp[r.id])), ry = rank(rows.map(r => r.pos)), m = rows.length;
    rho += 1 - 6 * rx.reduce((a, v, i) => a + (v - ry[i]) ** 2, 0) / (m * (m * m - 1)); n++;
  }
  check('корреляция силы и результата', rho / n > 0.5, `Спирмен ${(rho / n).toFixed(2)}`);

  // 3. Круговой не возвращает себе круг под машиной безопасности
  await toRace();
  await page.click('[data-a=race]');
  const sc = await page.evaluate(() => {
    const R = __pitwall.R, D = __dbg; R.count = 0; R.paused = true; R.sc = -999;
    // искусственно отстающая машина: на круг позади
    const last = R.cars[R.cars.length - 1];
    for (let k = 1; k <= 10; k++) { D.simLap(k); if (k === 5) last.cum[5] += R.track.base * 1.2; }
    const ord = R.cars.filter(c => !c.out).sort((a, b) => a.cum[10] - b.cum[10]);
    const before = last.cum[10] - ord[0].cum[10];
    R.sc = 3; D.simLap(11);
    const ord2 = R.cars.filter(c => !c.out).sort((a, b) => a.cum[11] - b.cum[11]);
    return { before, after: last.cum[11] - ord2[0].cum[11], scLap: R.track.base * 1.38, out: last.out };
  });
  check('круговой остаётся круговым под SC', sc.out || (sc.before > 0 && sc.after >= sc.scLap), `до ${sc.before.toFixed(1)} с, после ${sc.after.toFixed(1)} с, круг под SC ${sc.scLap.toFixed(0)} с`);
  await page.evaluate(() => { __pitwall.R.sc = 0; });

  // 4. Износ шин пересчитывается при смене погоды внутри симуляции
  const tw = await page.evaluate(() => {
    // круг 12 сухой, дальше дождь: коэффициент должен смениться внутри simLap
    const R = __pitwall.R, D = __dbg; R.wet[11] = false; for (let i = 12; i < R.N; i++) R.wet[i] = true;
    D.simLap(12); const dry = R.tw, expectDry = D.trackWear(R.abr, R.temp, false);
    D.simLap(13); return { dry, expectDry, wet: R.tw, expectWet: D.trackWear(R.abr, R.temp, true) };
  });
  check('износ шин учитывает дождь без участия интерфейса', Math.abs(tw.dry - tw.expectDry) < 1e-9 && Math.abs(tw.wet - tw.expectWet) < 1e-9 && tw.wet !== tw.dry, `${tw.dry.toFixed(3)} → ${tw.wet.toFixed(3)}`);

  // 5. Соперники реагируют на дождь сменой шин
  const rain = await page.evaluate(() => {
    const R = __pitwall.R, D = __dbg; let switched = 0, slick = 0;
    for (let k = 14; k <= Math.min(R.N, 18); k++) D.simLap(k);
    R.cars.filter(c => !c.out && !c.me).forEach(c => { c.tyre === 'I' ? switched++ : slick++; });
    return { switched, slick };
  });
  check('соперники переходят на дождевые', rain.switched >= rain.slick * 3, `дождевые ${rain.switched}, слики ${rain.slick}`);

  // 6. Соперники используют режимы пилотирования
  const modes = await page.evaluate(() => [...new Set(__pitwall.R.cars.filter(c => !c.me).map(c => c.mode))]);
  check('соперники меняют режим пилотирования', modes.length > 1 || modes[0] !== 'norm', modes.join(', '));
  await finish();

  // 7. Советчик стратегии учитывает дешёвый пит-стоп под SC
  await toRace();
  await page.click('[data-a=race]');
  const adv = await page.evaluate(() => {
    const R = __pitwall.R, D = __dbg; R.count = 0; R.paused = true; for (let k = 1; k <= 6; k++) D.simLap(k);
    const c = R.cars.find(x => x.me && !x.out); if (!c) return null;
    R.sc = 0; const normal = D.raceOptions(c).M.cost - D.raceOptions(c).stay.cost;
    R.sc = 3; const underSc = D.raceOptions(c).M.cost - D.raceOptions(c).stay.cost; R.sc = 0;
    return { normal, underSc };
  });
  check('пит-стоп под SC выгоднее в расчёте стратегии', !adv || adv.underSc < adv.normal, adv ? `разница ${adv.normal.toFixed(1)} → ${adv.underSc.toFixed(1)} с` : 'машина сошла');
  await finish();

  // 8. Шины меняются только в боксе: сухо → дождь → сухо, на экране комплект меняется лишь после стоянки
  await toRace();
  await page.click('[data-a=race]');
  const box = await page.evaluate(() => {
    const R = __pitwall.R, D = __dbg; R.count = 0; R.paused = true;
    for (let i = 0; i < R.N; i++) R.wet[i] = i >= 5 && i < 11;
    const shown = {}; let bad = 0, changes = 0, T = 0;
    while (R.lapDone < R.N && T < 1e5) {
      T += .5; R.T = T;
      for (;;) { const k = R.lapDone; if (k >= R.N) break; const run = R.cars.filter(c => !c.out); if (!run.length) break; if (R.T >= Math.min(...run.map(c => c.cum[k]))) D.simLap(k + 1); else break; }
      R.cars.forEach(c => { if (c.out) return; c.pi = 0; const pr = D.carProgress(c, T), tn = D.tyreNow(c).tyre;
        if (shown[c.did] && shown[c.did] !== tn) { changes++; if (!(pr.pit && pr.pit.after)) bad++; } shown[c.did] = tn; });
    }
    return { bad, changes };
  });
  check('шины меняются только в боксе', box.changes > 0 && box.bad === 0, `смен шин ${box.changes}, вне бокса ${box.bad}`);
  await finish();

  check('нет ошибок JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} проверок пройдено`);
  process.exit(failed ? 1 : 0);
})();
