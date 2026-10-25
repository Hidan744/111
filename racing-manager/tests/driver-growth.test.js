// Развитие пилотов: рост к потенциалу зависит от тренера и возраста, у всех команд.
// Запуск: node racing-manager/tests/driver-growth.test.js
const path = require('path');
const { chromium } = require('playwright');
const results = []; const check = (n, ok, info) => { results.push(ok); console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${info ? ' — ' + info : ''}`); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/three.min.js', r => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '../game.html') + '?debug');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pitwall_settings_v1', '{"intro":0,"music":0}'); });
  await page.reload();
  await page.click('[data-a=new]'); await page.click('[data-a=create]');
  // два одинаковых таланта (20 лет, скорость 78, потенциал 90) в командах с тренером 90 и 55; третий — потенциал 80
  const r = await page.evaluate(() => {
    const S = __pitwall.S, D = __dbg, T = S.teams.filter(t => t.id !== S.pid);
    const a = S.drivers[T[0].drivers[0]], b = S.drivers[T[1].drivers[0]], c = S.drivers[T[2].drivers[0]];
    T[0].coach.rating = 90; T[1].coach.rating = 55; T[2].coach.rating = 90;
    [a, b, c].forEach(d => { d.age = 20; d.pace = 78; d.craft = 76; d.skOff = null; });
    a.pot = 90; b.pot = 90; c.pot = 80; [a, b, c].forEach(d => { d.skOff = null; D.ensurePot(d); });
    const hist = { a: [], b: [], c: [] };
    for (let race = 1; race <= 72; race++) { D.trainDrivers(); if (race % 24 === 0) { hist.a.push(+a.pace.toFixed(1)); hist.b.push(+b.pace.toFixed(1)); hist.c.push(+c.pace.toFixed(1)); } }
    return { hist, craftA: +a.craft.toFixed(1), craftB: +b.craft.toFixed(1), fa: D.growF(a, T[0]).toFixed(2), fb: D.growF(b, T[1]).toFixed(2) };
  });
  check('талант + сильный тренер растёт быстро', r.hist.a[0] >= 82, `скорость по сезонам: ${r.hist.a.join(' → ')} (потенциал 90)`);
  check('тот же талант + слабый тренер растёт медленнее', r.hist.b[2] < r.hist.a[2] - 2, `${r.hist.b.join(' → ')} (тренер 55)`);
  check('низкий потенциал — рост упирается в потолок', r.hist.c[2] <= 80 && r.hist.c[2] >= 79, `${r.hist.c.join(' → ')} (потенциал 80)`);
  check('навыки тоже растут, быстрее у хорошего тренера', r.craftA > r.craftB && r.craftB > 76, `мастерство ${r.craftA} против ${r.craftB}`);
  // ветеран без запаса не растёт
  const v = await page.evaluate(() => { const S = __pitwall.S, D = __dbg, t = S.teams.find(x => x.id !== S.pid), d = S.drivers[t.drivers[1]]; d.age = 34; d.pace = 85; d.pot = 85; const p0 = d.pace; for (let i = 0; i < 24; i++) D.trainDrivers(); return [p0, d.pace]; });
  check('ветеран у потолка не растёт', v[1] === v[0], `${v[0]} → ${v[1]}`);
  check('нет ошибок JavaScript', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  console.log(`\n${results.filter(Boolean).length}/${results.length} проверок пройдено`); process.exit(results.every(Boolean) ? 0 : 1);
})();
