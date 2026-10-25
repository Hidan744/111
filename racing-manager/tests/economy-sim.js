// Прогон экономики: несколько сезонов за выбранную команду с «разумной» политикой игрока.
// Запуск: node racing-manager/tests/economy-sim.js [индекс команды|own] [сезонов] [политика: spend|save]
const path = require('path');
const { chromium } = require('playwright');
const GAME = 'file://' + path.resolve(__dirname, '../game.html') + '?debug';
const team = process.argv[2] || '0', seasons = +(process.argv[3] || 3), policy = process.argv[4] || 'spend';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/three.min.js', r => r.abort());
  await page.goto(GAME);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pitwall_settings_v1', '{"intro":0,"music":0,"mode":"sim","view":"2d"}'); });
  await page.reload();
  await page.click('[data-a=new]');
  if (team === 'own') await page.click('[data-a=ownmode][data-v="1"]');
  else await page.click(`[data-a=pick][data-v="${team}"]`);
  await page.click('[data-a=create]');
  const log = [];
  let stopped = null;
  try {
  for (let s = 0; s < seasons; s++) {
    const nr = await page.evaluate(() => __dbg.NR());
    for (let r = 0; r < nr; r++) {
      // политика игрока между гонками
      await page.evaluate(policy => __dbg.botPolicy(policy), policy);
      await page.click('[data-a=tab][data-v=hq]');
      if (await page.$('[data-a=castvote]')) { await page.click('[data-a=vote][data-v="1"]'); await page.click('[data-a=castvote]'); }
      await page.evaluate(() => { const S = __pitwall.S, D = __dbg; const n = D.weekendDay() - S.day; if (n > 0) D.advanceDays(n); });
      await page.click('[data-a=tab][data-v=money]'); await page.click('[data-a=tab][data-v=hq]');
      const b0 = await page.evaluate(() => __pitwall.S.budget);
      await page.click('[data-a=weekend]');
      for (let i = 0; i < 15 && !(await page.$('[data-a=race]')); i++) {
        const nb = await page.$('[data-a=nextstep]') || await page.$('[data-a=runq]') || await page.$('[data-a=qnext]'); if (!nb) break; await nb.click();
      }
      await page.click('[data-a=race]');
      await page.evaluate(() => { const R = __pitwall.R; R.paused = false; R.count = 0; R.T += 1e9; });
      await page.waitForSelector('text=Итоги гонки', { timeout: 20000 });
      const row = await page.evaluate(b0 => { const S = __pitwall.S, L = S.lastRace, F = S.fin, P = F && F.periods.slice(-1)[0]; const inv = P ? +(P.start + P.sum - P.end).toFixed(2) : null; return { season: S.season, round: S.round, b0, b1: S.budget, net: L.net, inc: L.inc, exp: L.exp, pos: L.rows ? 0 : 0, my: S.results.slice(-1)[0].my, inv, cats: F ? F.cats : null }; }, b0);
      log.push(row);
      await page.click('[data-a=hub]');
    }
    // конец сезона
    const end = await page.evaluate(() => { const S = __pitwall.S; const b = S.budget; return { b }; });
    if (await page.$('[data-a=endseason]')) await page.click('[data-a=endseason]');
    const after = await page.evaluate(() => ({ b: __pitwall.S.budget, season: __pitwall.S.season, prize: (__pitwall.UI || {}).season }));
    log.push({ seasonEnd: s + 1, before: end.b, after: after.b });
    if (await page.$('[data-a=hub]')) await page.click('[data-a=hub]');
  }
  } catch (e) { stopped = await page.evaluate(() => ({ screen: document.querySelector('h1,h2') && document.querySelector('h1,h2').textContent, budget: __pitwall.S && __pitwall.S.budget, warnings: __pitwall.S && __pitwall.S.warnings, season: __pitwall.S && __pitwall.S.season })); }
  const out = path.resolve(__dirname, `../../econ-${team}-${policy}.json`);
  require('fs').writeFileSync(out, JSON.stringify(log, null, 1));
  // сводка
  const races = log.filter(x => x.round);
  const bySeason = {};
  races.forEach(x => { const k = x.season; bySeason[k] = bySeason[k] || { start: x.b0, inc: {}, exp: {}, end: 0 }; x.inc.forEach(([n, v]) => { const key = n.startsWith('Бонус') ? 'Бонусы спонсоров' : /Призов|FOM/.test(n) ? n : 'Спонсоры (за этап)'; bySeason[k].inc[key] = +((bySeason[k].inc[key] || 0) + v).toFixed(2); }); x.exp.forEach(([n, v]) => { bySeason[k].exp[n] = +((bySeason[k].exp[n] || 0) + v).toFixed(2); }); bySeason[k].end = x.b1; });
  const invBad = races.filter(x => x.inv !== null && Math.abs(x.inv) > 0.02).length;
  const lastCats = {}; races.forEach(x => { if (x.cats) lastCats[x.season] = x.cats; });
  console.log(JSON.stringify({ team, policy, stopped, invBad, lastCats, bySeason, seasonEnds: log.filter(x => x.seasonEnd), errors }, null, 1));
  await browser.close();
})();
