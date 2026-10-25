// Сборка игры из исходников src/ в один файл game.html и мобильную обёртку index.html.
// Запуск: node racing-manager/tools/build.js   (проверка без записи: --check)
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), src = path.join(root, 'src');
const order = fs.readFileSync(path.join(src, 'ORDER'), 'utf8').split('\n').filter(Boolean);
const game = order.map(n => fs.readFileSync(path.join(src, n), 'utf8')).join('').replace(/\n$/, '');
// обёртка для телефона: тот же документ с метатегами веб-приложения
const i1 = game.indexOf('<style>'), i2 = game.indexOf('</style>') + '</style>'.length;
const headStart = game.slice(0, game.indexOf('<html'));
const index = '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n<link rel="manifest" href="manifest.webmanifest">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}</style>\n'
  + game.slice(0, i2) + '\n</head>\n<body>\n' + game.slice(i2 + 1) + '</body>\n</html>\n';
// проверка синтаксиса скрипта игры
const js = game.split('<script>')[1].split('</script>')[0];
new Function(js);
if (process.argv.includes('--check')) {
  const cur = fs.readFileSync(path.join(root, 'game.html'), 'utf8');
  console.log(cur === game ? 'game.html совпадает с исходниками' : 'game.html ОТЛИЧАЕТСЯ от исходников'); process.exit(cur === game ? 0 : 1);
}
fs.writeFileSync(path.join(root, 'game.html'), game);
fs.writeFileSync(path.join(root, 'index.html'), index);
console.log('собрано: game.html', game.length, 'байт; index.html', index.length, 'байт');
