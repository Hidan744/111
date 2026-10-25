/* ---------- настройка болида ---------- */
// ключ, название, подпись min, подпись max, жалоба при «мало», жалоба при «много»
const SETUP=[
 ['wing','Антикрыло','мин. прижим','макс. прижим','Машину сносит в быстрых поворотах — не хватает прижимной силы.','На прямых медленно — слишком много крыла.'],
 ['susp','Жёсткость подвески','мягкая','жёсткая','Машина раскачивается, медленно перекладывается в связках.','Машину подбрасывает на поребриках и неровностях.'],
 ['gear','Передаточные числа','короткие','длинные','Упираемся в отсечку в конце прямой.','Медленный разгон из медленных поворотов.'],
 ['brake','Баланс тормозов','назад','вперёд','Блокируются задние колёса, машину разворачивает.','Блокируются передние колёса, машина не входит в поворот.'],
];
function idealSetup(tr,wet){
  const r=mulberry(hashStr(tr.seed)*131+(S?S.season:1)*7);
  return{wing:clamp(Math.round(1+tr.aero*6-(tr.engine-1)*6+(wet?2:0)),1,10),susp:1+Math.floor(r()*9),gear:clamp(Math.round(tr.engine*6-1),1,10),brake:2+Math.floor(r()*7)};
}
const setupQ=(s,id)=>clamp(100-SETUP.reduce((a,[k])=>a+Math.abs(s[k]-id[k]),0)*7,0,100);

/* ---------- балансные параметры (в одном месте) ---------- */
// экономика — млн за этап, если не сказано иначе
const BAL={
  fomBase:1,                // выплата FOM за участие в этапе
  prizeMin:14,prizeStep:4.5,// призовой фонд сезона: последнему 14, каждое место выше +4,5
  prizeFlatMin:24,prizeFlatStep:2.2,
  champBonus:[8,5,3],       // бонус за 1–3 место в Кубке конструкторов
  logistics:1.5,            // логистика и операции
  facK:.035,facPow:1.5,     // содержание базы: k × уровень^pow за каждое здание
  sponsorRep:150,sponsorBase:.5,sponsorBonusK:.6,sponsorDropK:2,
  staffPayK:1.5,
  dividendShare:.6,         // доля денег сверх годового резерва, которую забирают владельцы
  crashCost:.4,
  // развитие соперников: бюджет разработки за сезон = фонд FOM + доля «силы бюджета» команды
  aiDevShare:.55,aiDevMin:10,aiDevMax:50,aiPtsPerM:.48,
};
/* ---------- финансы: журнал операций ---------- */
// каждая операция с деньгами проходит через money(): баланс меняется, запись попадает в журнал текущего периода
const FIN_CATS={fom:['Выплаты FOM',1],prize:['Призовые',1],sponsor:['Спонсоры',1],bonus:['Бонусы спонсоров',1],task:['Задания',1],
  drivers:['Зарплаты пилотов',-1],staff:['Персонал',-1],logistics:['Логистика',-1],facilities:['Содержание базы',-1],academy:['Академия',-1],
  repair:['Ремонт и эвакуация',-1],production:['Производство узлов',-1],dev:['Разработка',-1],build:['Стройка',-1],transfer:['Контракты и трансферы',-1],owners:['Дивиденды владельцам',-1],other:['Прочее',-1]};
const EXP_CAT={'Зарплаты пилотов':'drivers','Персонал':'staff','Логистика и операции':'logistics','Академия и скаутинг':'academy','Содержание базы':'facilities'};
function finState(){
  if(!S.fin||S.fin.season!==S.season){const prev=S.fin;if(prev){S.finHist=(S.finHist||[]).concat([{season:prev.season,year:prev.year,start:prev.start,end:S.budget,cats:prev.cats}]).slice(-6)}
    S.fin={season:S.season,year:year(),start:S.budget,cats:{},periods:[],cur:{start:S.budget,items:[]}}}
  return S.fin;
}
function money(amt,cat,label){
  amt=+(+amt).toFixed(2);if(!amt)return;const F=finState();
  S.budget=+(S.budget+amt).toFixed(2);F.cats[cat]=+((F.cats[cat]||0)+amt).toFixed(2);
  F.cur.items.push([cat,label,amt]);if(F.cur.items.length>80)F.cur.items.splice(0,F.cur.items.length-80);
}
// закрыть финансовый период (между гонками): начальный баланс + операции = конечный
function finClose(name){const F=finState(),c=F.cur,sum=c.items.reduce((a,x)=>a+x[2],0);
  F.periods.push({name,round:S.round,start:c.start,end:S.budget,sum:+sum.toFixed(2),items:c.items});if(F.periods.length>30)F.periods.shift();
  F.cur={start:S.budget,items:[]};}
// сохранение; bak — в безопасной точке (после гонки, в конце сезона) прежняя версия уходит в резервную копию
function save(bak){
  if(!S)return false;
  try{S.v=SAVE_VER;S.wk=W&&W.ti===S.round?W:null;if(W)W.scr=UI.screen;S.savedAt=Date.now();
    const j=JSON.stringify(S);
    if(bak){const prev=localStorage.getItem(SAVE);if(prev)localStorage.setItem(BAK,prev)}
    localStorage.setItem(SAVE,j);UI.saveErr=null;return true}
  catch(e){diag('сохранение карьеры',e);UI.saveErr='Не удалось сохранить карьеру: память браузера заполнена или недоступна. Скачайте сохранение в настройках.';try{toast(UI.saveErr)}catch(e2){}return false}
}
// экспорт и импорт карьеры (файл .json)
function exportSave(raw){
  const txt=raw?(()=>{try{return localStorage.getItem(SAVE)||''}catch(e){return''}})():JSON.stringify(S);if(!txt)return toast('Нечего сохранять');
  const t=S&&S.teams?S.teams.find(x=>x.id===S.pid):null,name=`pitwall-${t?t.short:'career'}-${S?(S.year0||2026)+(S.season||1)-1:''}.json`;
  // внутри claude.ai файл отдаётся через возможность downloads, в обычном браузере — ссылкой на скачивание
  const dl=UI.dlCap;
  if(dl){dl.save({filename:name,data:txt}).then(()=>toast('Файл карьеры сохранён: '+name),e=>{if(e&&e.code!=='declined')toast('Не удалось сохранить файл')});return}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500);toast('Файл карьеры сохранён: '+name)}
  catch(e){toast('Не удалось скачать файл')}
}
function importSave(txt){
  let o;try{o=JSON.parse(txt)}catch(e){return toast('Файл не похож на сохранение Пит-Уолла')}
  if(!validSave(o))return toast('В файле нет карьеры Пит-Уолла');
  if(o.v>SAVE_VER)return toast('Сохранение из более новой версии игры');
  try{const prev=localStorage.getItem(SAVE);if(prev)localStorage.setItem(BAK,prev)}catch(e){diag('резервная копия перед импортом',e)}
  S=o;W=null;R=null;ensureEcon();if(!save())return;UI.screen='hub';UI.tab='hq';toast('Карьера загружена из файла');render();
}
// версия схемы сохранения; старые карьеры переводятся миграциями в ensureEcon
const SAVE_VER=3,BAK=SAVE+'_bak';
const validSave=o=>!!(o&&typeof o==='object'&&Array.isArray(o.teams)&&o.teams.length&&o.pid&&o.drivers&&typeof o.budget==='number'&&o.teams.some(t=>t.id===o.pid));
function readSave(key){const s=localStorage.getItem(key);if(!s)return null;const o=JSON.parse(s);if(!validSave(o))throw new Error('invalid');return o}
// загрузка: основное сохранение, при повреждении — резервная копия; повреждённые данные не удаляются
function load(){
  UI.loadNote=null;
  try{const o=readSave(SAVE);if(o&&o.v>SAVE_VER){UI.loadNote='Сохранение создано более новой версией игры — обновите игру.';return null}return o}
  catch(e){diag('загрузка сохранения',e);try{const b=readSave(BAK);if(b){UI.loadNote='Основное сохранение повреждено — загружена резервная копия.';return b}}catch(e2){diag('загрузка резервной копии',e2)}
    UI.loadNote='Сохранение повреждено и не может быть загружено. Оно не удалено: скачайте файл в настройках, прежде чем начинать новую карьеру.';return null}
}
const hasSave=()=>{try{return!!localStorage.getItem(SAVE)}catch(e){return false}};
// удаление карьеры — только по явному действию игрока (сброс или новая карьера), никогда при ошибке
function wipe(){try{localStorage.removeItem(SAVE)}catch(e){diag('удаление сохранения',e)}}

const team=id=>S.teams.find(t=>t.id===id);
const drv=id=>S.drivers[id];
const me=()=>team(S.pid);
const salaryFor=p=>+(0.6+Math.pow(Math.max(0,p-70)/25,2)*9).toFixed(2);
let uid=1000;
function mkDriver(name,age,pace,craft,tyre){const id='d'+(uid++);return ensureAttrs({id,name,age,pace,craft,tyre,salary:salaryFor(pace),contract:ri(1,3),team:null,pts:0,wins:0,pods:0,career:0,cWins:0,cPods:0})}
// умения пилота и их вес в общем рейтинге
const ATTRS=[['pace','Скорость',.22],['craft','Гоночное мастерство',.14],['tyre','Работа с шинами',.11],['overtake','Обгон',.1],['defend','Защита',.08],['cons','Стабильность',.1],['wet','Дождь',.08],['start','Старт',.06],['fb','Обратная связь',.05],['exp','Опыт',.06]];
const REAL_TRAITS={'Ферстаппен':{wet:98,overtake:96,start:92,cons:94},'Хэмилтон':{wet:96,defend:93,exp:99},'Алонсо':{defend:97,exp:99,start:96,overtake:93},'Норрис':{cons:86,fb:90},'Леклер':{overtake:90,defend:84},'Пиастри':{cons:92,defend:88},'Расселл':{wet:90,fb:89},'Сайнс':{fb:93,cons:90},'Боттас':{start:80,fb:90},'Хюлькенберг':{fb:90,exp:95},'Перес':{tyre:92,start:85},'Антонелли':{wet:90}};
function ensureAttrs(d){
  if(d.overtake!=null)return d;
  const b=(d.pace+d.craft)/2,r=v=>clamp(Math.round(v),25,99);
  d.overtake=r(b+gauss()*4);d.defend=r(b+gauss()*4);d.cons=r(d.craft+gauss()*3);d.wet=r(b+gauss()*5);d.start=r(b+gauss()*5);d.fb=r(d.craft+gauss()*5);d.exp=r(30+(d.age-17)*4.5);
  const tr=REAL_TRAITS[String(d.name).split(' ').slice(-1)[0]];if(tr)Object.assign(d,tr);
  return d;
}
const ovr=d=>Math.round(ATTRS.reduce((a,[k,,w])=>a+(d[k]||0)*w,0));
const ovrPill=d=>{const o=ovr(d);return`<span class="ovr ${o>=88?'a':o>=80?'b':o>=70?'c':'d'}">${o}</span>`};
function rookie(){return mkDriver(pick(FIRST)+' '+pick(LAST),ri(18,22),ri(72,82),ri(68,78),ri(70,80))}
