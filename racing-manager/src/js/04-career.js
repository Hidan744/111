/* ---------- календарь по дням ---------- */
const MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const dayOf=(m,d)=>Math.round((Date.UTC(year(),m-1,d)-Date.UTC(year(),0,1))/864e5);
const raceDay=tr=>{const[d,m]=tr.date.split('.').map(Number);return dayOf(m,d)};
const fdate=day=>{const dt=new Date(Date.UTC(year(),0,1)+day*864e5);return dt.getUTCDate()+' '+MONTHS[dt.getUTCMonth()]+(dt.getUTCFullYear()!==year()?' '+dt.getUTCFullYear():'')};
const wday=day=>['вс','пн','вт','ср','чт','пт','сб'][new Date(Date.UTC(year(),0,1)+day*864e5).getUTCDay()];
// к какому Гран-при будет готово
function etaText(days){const d=S.day+days,tr=seasonTracks().find(t=>raceDay(t)>=d);return`${fdate(d)}${tr?` · к ${tr.gp.replace('Гран-при','ГП')}`:' · после сезона'}`}
const weekendDay=()=>S.round<NR()?raceDay(seasonTracks()[S.round])-3:S.day;
function advanceDays(n){for(let i=0;i<n;i++){S.day++;tickDay()}}
function tickDay(){
  const t=me();
  // разработки
  const done=[];S.projects.forEach(p=>{p.days--;if(p.days<=0){if(p.comp){t.spec=t.spec||{};t.spec[p.comp]=teamSpec(t,p.comp)+1;S.stockNew=S.stockNew||{};S.stockNew[p.comp]=0}else t.car[p.part]=clamp(+(t.car[p.part]+p.gain).toFixed(1),0,100);done.push(p)}});
  S.projects=S.projects.filter(p=>p.days>0);done.forEach(p=>p.comp?news(`Готова новая версия: ${COMPS.find(c=>c[0]===p.comp)[1]}, спец. ${teamSpec(t,p.comp)}. Закажите узлы на заводе и поставьте их на машины.`):news(`Обновление готово: ${PARTS.find(x=>x[0]===p.part)[1].toLowerCase()} +${p.gain.toFixed(1).replace('.',',')}.`));
  // завод
  S.prod=S.prod.filter(q=>{q.days--;if(q.days<=0){S.stock[q.k]=(S.stock[q.k]||0)+1;S.stockNew=S.stockNew||{};if((q.sp||1)>=teamSpec(me(),q.k))S.stockNew[q.k]=(S.stockNew[q.k]||0)+1;news(`Завод: готов новый узел — ${COMPS.find(c=>c[0]===q.k)[1]}.`);return false}return true});
  // стройка базы
  Object.entries(S.facBuild).forEach(([k,b])=>{b.days--;if(b.days<=0){S.fac[k]++;delete S.facBuild[k];news(`База: «${FACS.find(f=>f[0]===k)[1]}» — уровень ${S.fac[k]}.`)}});
  // скауты
  const A=S.academy;if(A.mission){A.mission.days--;if(A.mission.days<=0){{const pool=[...S.leagues.f4,...S.leagues.f3].filter(d=>d.region===A.mission.region&&d.age<=19).sort(()=>Math.random()-.5).slice(0,3),w=SCOUT_W[A.scout-1];
    A.prospects=pool.map(d=>{const lo=clamp(Math.round(d.pot-rnd(0,w)),40,99);return{...d,est:[lo,Math.min(99,lo+w)],focus:'pace',league:LEAGUES.find(([k])=>S.leagues[k].includes(d))[0],src:d.id}});while(A.prospects.length<3)A.prospects.push(mkJunior(A.mission.region))}news(`Скауты вернулись из региона «${A.mission.region}»: три новых таланта.`);A.mission=null}}
}
/* ---------- задания ---------- */
const OWN_COLORS=['#f97316','#22c55e','#eab308','#a855f7','#ec4899','#14b8a6','#f43f5e','#84cc16','#0ea5e9','#e5e7eb'];
const maxPaceByRep=()=>Math.floor(74+S.rep/3);
function mkTask(){
  const st=teamStandings(),pos=st.findIndex(t=>t.id===S.pid),n0=st.length,strong=pos<3,mid=pos<7,weak=pos>=n0-3,rivals=st.filter(t=>t.id!==S.pid);
  const above=st[Math.max(0,pos-1)]&&st[Math.max(0,pos-1)].id!==S.pid?st[pos-1]:rivals[0];
  const opts=[
   ()=>{if(weak)return{type:'beat',t:`Опередить «${above.name}» хотя бы в одной из 3 гонок`,data:above.id,target:1,left:3,rep:2,money:1};const n=strong?40:mid?14:4,k=3;return{type:'pts',t:`Набрать ${n} ${plural(n,'очко','очка','очков')} за ${k} гонки`,target:n,left:k,rep:2,money:1.5}},
   ()=>({type:'beat',t:`Финишировать выше «${above.name}» в следующей гонке`,data:above.id,target:1,left:1,rep:1.5,money:.8}),
   ()=>({type:'both',t:'Оба пилота финишируют 3 гонки подряд',target:3,left:4,rep:1.5,money:.6}),
   ()=>{const cars=S.teams.length*2,n=strong?3:mid?6:weak?cars-6:10,k=weak?3:2;return{type:'top',t:`Финишировать в топ-${n} за ${k} ${plural(k,'гонку','гонки','гонок')}`,target:n,left:k,rep:2,money:1.2}},
   ()=>{const cars=S.teams.length*2,q=weak?cars-6:10;return{type:'q',t:weak?`Пилот проходит Q1 (старт в топ-${q})`:'Пилот стартует из первой десятки',target:1,data:q,left:3,rep:1,money:.6}},
   ()=>({type:'dev',t:'Запустить 2 разработки (болид или болид следующего сезона)',data:S.devCount||0,target:2,left:4,rep:1,money:.5}),
   ()=>({type:'acad',t:'Юниор академии на подиуме в младших формулах',target:1,left:4,rep:1,money:.5}),
  ];
  const used=new Set((S.tasks||[]).map(x=>x.type));const pool=opts.map(f=>f()).filter(x=>!used.has(x.type));if(!pool.length)return opts[2]();
  const t=pick(pool);t.id='t'+(uid++);t.prog=0;return t;
}
function newTasks(){S.tasks=S.tasks||[];while(S.tasks.length<3)S.tasks.push(mkTask())}
function tasksAfterRace(rows,grid){
  const mine=rows.filter(r=>r.me),best=Math.min(...mine.map(r=>r.out?99:r.pos)),pts=mine.reduce((a,r)=>a+r.pts,0);
  const done=[];
  S.tasks.forEach(t=>{
    if(t.type==='pts')t.prog+=pts;
    else if(t.type==='beat'){const o=rows.filter(r=>r.tid===t.data&&!r.out).map(r=>r.pos);if(best<Math.min(99,...o))t.prog=1}
    else if(t.type==='both')t.prog=mine.every(r=>!r.out)?t.prog+1:0;
    else if(t.type==='top')t.prog=best<=t.target?1:t.prog;
    else if(t.type==='q')t.prog=grid.slice(0,t.data||10).some(g=>g.tid===S.pid)?1:t.prog;
    else if(t.type==='dev')t.prog=(S.devCount||0)-t.data;
    else if(t.type==='acad')t.prog=S.academy.juniors.some(j=>j.last&&j.last<=3)?1:t.prog;
    const ok=t.type==='top'||t.type==='q'||t.type==='acad'||t.type==='beat'?t.prog>=1:t.prog>=t.target;
    t.left--;
    if(ok){S.rep=clamp(S.rep+t.rep,10,100);money(t.money,'task','Задание: '+t.t);news(`Задание выполнено: «${t.t}» — репутация +${t.rep}, +${String(t.money).replace('.',',')} млн.`);done.push(t)}
    else if(t.left<=0){S.rep=clamp(S.rep-.5,10,100);news(`Задание провалено: «${t.t}».`);done.push(t)}
  });
  S.tasks=S.tasks.filter(t=>!done.includes(t));newTasks();
}
function tasksCard(){
  newTasks();
  return`<div class="card"><div class="row between"><h3>Задания</h3><span class="pill acc">репутация ${Math.round(S.rep)}</span></div>
   ${S.tasks.map(t=>{const tgt=t.type==='top'||t.type==='q'||t.type==='acad'||t.type==='beat'?1:t.target,pr=Math.min(tgt,Math.max(0,t.prog));return`<div class="stack" style="border-top:1px solid var(--line);padding-top:8px;gap:4px">
     <div class="row between"><span>${esc(t.t)}</span><span class="muted mono" style="font-size:12px">${t.left} ${plural(t.left,'гонка','гонки','гонок')}</span></div>
     <div class="row between"><div class="bar grow"><i style="width:${pr/tgt*100}%"></i></div><span class="mono" style="font-size:12px;margin-left:8px">${pr}/${tgt}</span></div>
     <span class="muted" style="font-size:12px">Награда: репутация +${t.rep}, ${String(t.money).replace('.',',')} млн</span></div>`}).join('')}
   <p class="muted" style="font-size:12px">Репутация открывает сильных пилотов и персонал: сейчас пилоты со скоростью до ~${maxPaceByRep()} готовы к разговору.</p></div>`;
}
/* ---------- тесты и аналитика команд ---------- */
const CATS=[['straight','Скорость на прямых'],['corner','Повороты'],['traction','Тяга и шасси'],['tyres','Работа с шинами'],['rel','Надёжность'],['pace','Темп в гонке']];
const PROGS=[['aero','Аэро-замеры',['corner','straight'],60],['long','Длинные отрезки',['tyres','pace'],95],['quali','Квалификационные симуляции',['pace','traction'],70],['rel','Пробег на надёжность',['rel','straight'],140]];
function intelTrue(t,k){
  const c=t.car,ty=t.drivers.length?t.drivers.reduce((a,id)=>a+drv(id).tyre,0)/t.drivers.length:80;
  return k==='straight'?c.engine*1.1-c.aero*.1:k==='corner'?c.aero*.6+c.chassis*.4:k==='traction'?c.chassis:k==='tyres'?60+(ty-80)*1.2+(c.chassis-80)*.5+20:k==='rel'?c.rel:(c.aero+c.engine+c.chassis)/3;
}
function ensureIntel(){
  if(S.intel&&S.intel.season===S.season)return;
  const noise={};S.teams.forEach(t=>{noise[t.id]={};CATS.forEach(([k])=>noise[t.id][k]=gauss())});
  S.intel={season:S.season,conf:Object.fromEntries(CATS.map(([k])=>[k,.05])),noise,days:0,mid:false,log:[]};S.testBonus=0;
}
const intelErr=k=>Math.round((1-S.intel.conf[k])*7);
const intelEst=(t,k)=>t.id===S.pid?intelTrue(t,k):intelTrue(t,k)+((S.intel.noise[t.id]||{})[k]||0)*(1-S.intel.conf[k])*7;
const testAvail=()=>{ensureIntel();const pre=S.round===0&&S.intel.days<3&&S.day<weekendDay()-1,mid=S.round>=8&&S.round<NR()&&!S.intel.mid&&S.day<weekendDay();return pre?'pre':mid?'mid':null};
function runTestDay(prog,did){
  const pg=PROGS.find(x=>x[0]===prog),t=me(),d=drv(did),kind=testAvail();if(!kind)return;
  pg[2].forEach(k=>S.intel.conf[k]=Math.min(.92,S.intel.conf[k]+.3));CATS.forEach(([k])=>{if(!pg[2].includes(k))S.intel.conf[k]=Math.min(.92,S.intel.conf[k]+.05)});
  const laps=Math.round(pg[3]*rnd(.85,1.1)*(1.4-t.car.rel/150>1?.9:1)),tr=CIRCUITS['bh-2002'];
  const best=tr[3]-1+(100-(t.car.aero*.9+t.car.engine*1.1+t.car.chassis)/3)*.06+(100-d.pace)*.035+(prog==='quali'?TYRES.S.off:TYRES.M.off)+gauss()*.25;
  S.testBonus=Math.min(4,(S.testBonus||0)+1);
  if(kind==='pre')S.intel.days++;else S.intel.mid=true;
  S.intel.log.unshift({day:kind==='pre'?S.intel.days:'сезон',prog:pg[1],did,laps,best});
  S.day++;tickDay();
  news(`Тесты: ${d.name} проехал ${laps} кругов (${pg[1].toLowerCase()}), лучший ${fsec(best)}.`);
}
function intelView(){
  ensureIntel();const ts=S.teams,me_=me();
  const rows=CATS.map(([k,n])=>{const vals=ts.map(t=>({t,v:intelEst(t,k)})).sort((a,b)=>b.v-a.v);const mn=Math.min(...vals.map(x=>x.v)),mx=Math.max(...vals.map(x=>x.v));
    const myRank=vals.findIndex(x=>x.t.id===S.pid)+1;
    return`<div class="card"><div class="row between"><h3>${n}</h3><span class="pill ${intelErr(k)<=2?'good':intelErr(k)<=4?'acc':'bad'}">точность ±${intelErr(k)}</span></div>
     <p class="muted" style="font-size:12px">Лучше всех: <b style="color:var(--fg)">${esc(vals[0].t.name)}</b> · мы ${myRank}-е</p>
     ${vals.map(x=>`<div class="stat" style="grid-template-columns:120px 1fr 34px"><span class="ell" style="${x.t.id===S.pid?'color:var(--accent);font-weight:700':''}"><span class="chip" style="background:${x.t.color}"></span> ${esc(x.t.short)}</span><div class="bar"><i style="width:${clamp(20+(x.v-mn)/((mx-mn)||1)*80,5,100)}%;background:${x.t.color}"></i></div><span class="mono">${x.v.toFixed(0)}</span></div>`).join('')}</div>`});
  const mine=CATS.map(([k,n])=>({n,r:ts.map(t=>intelEst(t,k)).sort((a,b)=>b-a).indexOf(intelEst(me_,k))+1}));
  const strong=mine.filter(x=>x.r<=3).map(x=>x.n.toLowerCase()),weak=mine.filter(x=>x.r>=ts.length-2).map(x=>x.n.toLowerCase());
  return`<div class="card"><h3>Сводка инженеров</h3><p style="font-size:13px">Сильные стороны: ${strong.join(', ')||'явных нет'}. Слабые: ${weak.join(', ')||'явных нет'}.</p>
    <p class="muted" style="font-size:12px">Данные собраны на тестах (${S.intel.days} ${plural(S.intel.days,'день','дня','дней')}${S.intel.mid?' + тестовый день в сезоне':''}) и в гонках. Значения у соперников — оценка: чем выше точность, тем ближе к правде. Тестовые программы уточняют свои категории.</p></div>
    <div class="cols"><div class="col">${rows.slice(0,3).join('')}</div><div class="col">${rows.slice(3).join('')}</div></div>`;
}
function vTest(){
  ensureIntel();const kind=testAvail(),ids=me().drivers;UI.tprog=UI.tprog||'aero';if(!ids.includes(UI.tdrv))UI.tdrv=ids[0];
  const title=kind==='mid'?'Тестовый день в сезоне · Барселона':'Предсезонные тесты · Сахир';
  return`<div class="racehead wrap"><div class="grow"><div class="eyebrow">${fdate(S.day)}, ${wday(S.day)}</div><h2>${title}</h2></div>${kind==='pre'?`<span class="pill acc">день ${S.intel.days+1}/3</span>`:''}</div>
  <div class="scroll wrap" id="sc"><div class="cols"><div class="col">
   <div class="card"><h3>Программа дня</h3>
    <div class="stack">${PROGS.map(([k,n,cats,laps])=>`<button class="btn ${UI.tprog===k?'primary':''}" style="justify-content:space-between" data-a="tprog" data-v="${k}"><span>${n}</span><span class="muted" style="font-size:12px;${UI.tprog===k?'color:var(--accent-ink)':''}">~${laps} кр. · ${cats.map(c=>CATS.find(x=>x[0]===c)[1].toLowerCase()).join(', ')}</span></button>`).join('')}</div></div>
   <div class="card"><h3>За рулём</h3><div class="seg">${ids.map(id=>`<button data-a="tdrv" data-v="${id}" class="${UI.tdrv===id?'on':''}">${esc(nm(id))}</button>`).join('')}</div>
    <p class="muted" style="font-size:12px">Каждый тестовый день добавляет понимание болида (+ к качеству настройки на весь сезон, максимум 4 дня) и уточняет аналитику соперников. Тесты идут на отдельных узлах — сезонный лимит не тратится.</p></div>
   ${kind?`<button class="btn primary block" data-a="tday">Провести тестовый день</button>`:`<div class="card"><p>Тесты завершены. Смотрите вкладку «Таблица» → «Аналитика».</p></div>`}
   <button class="btn block small" data-a="hub">В штаб</button>
  </div><div class="col">
   <div class="card"><h3>Протокол тестов</h3>${S.intel.log.length?S.intel.log.map(l=>`<div class="row between" style="border-top:1px solid var(--line);padding-top:8px"><span>${typeof l.day==='number'?'День '+l.day:'В сезоне'} · ${esc(S.drivers[l.did]?nm(l.did):'')}<br><span class="muted" style="font-size:12px">${esc(l.prog)} · ${l.laps} кр.</span></span><span class="mono">${fsec(l.best)}</span></div>`).join(''):'<p class="muted">Пока ни одного дня.</p>'}</div>
   ${intelView().split('<div class="cols">')[0]}
  </div></div></div>`;
}
/* ---------- база команды ---------- */
// ключ, здание, на что влияет
const FACS=[
 ['wt','Аэродинамическая труба','аэродинамика: прирост обновлений и база нового болида'],
 ['eng','Моторный стенд','двигатель: прирост, база нового болида, ресурс ДВС и ERS'],
 ['comp','Композитный цех','шасси: прирост, база нового болида, прочность днища и крыла'],
 ['rig','Испытательный стенд','надёжность: прирост, база нового болида, ресурс КПП'],
 ['sim','Симулятор','качество настройки и точность отзывов на практике'],
 ['fac','Завод','стоимость и скорость производства узлов'],
];
const FAC_COST=[0,3,6,10,15],FAC_DAYS=[0,35,50,65,80];
const PART_FAC={aero:'wt',engine:'eng',chassis:'comp',rel:'rig'};
const facL=(t,k)=>t.id===S.pid?(S.fac?S.fac[k]:2):(t.fac?t.fac[k]:2);
const facMul=(t,part)=>.8+facL(t,PART_FAC[part])*.1;
// содержание базы растёт быстрее уровня: большая база — большие постоянные расходы
const facUpkeep=()=>S.fac?+Object.values(S.fac).reduce((a,v)=>a+Math.pow(v,BAL.facPow)*BAL.facK,0).toFixed(2):0;
/* ---------- компоненты болида ---------- */
// ключ, название, лимит на сезон (0 — без лимита), цена производства, износ за гонку в режиме «Норма», %
const COMPS=[['ice','ДВС',4,1.2,15,12],['ers','ERS',3,.9,18,10],['gb','КПП',4,.6,13,7],['floor','Днище',0,.5,6,6],['fw','Переднее крыло',0,.3,5,4]];
const prodCost=k=>+(COMPS.find(c=>c[0]===k)[3]*(1.2-.08*(S.fac?S.fac.fac:2))).toFixed(2);
const prodDays=k=>Math.max(1,Math.round(COMPS.find(c=>c[0]===k)[5]*(1.15-.07*(S.fac?S.fac.fac:2))));
const FATAL=new Set(['ice','ers','gb']);
// спецификации узлов: новая версия разрабатывается в сезоне, затем её нужно произвести и поставить на машину.
// ключ: [выигрыш с/круг за версию, снижение износа за версию, цена разработки млн, дней, что нужно для разработки]
const SPEC={ice:[.08,0,5,35],ers:[.05,0,4,28],gb:[0,.12,2.5,18],floor:[.10,0,3.5,20],fw:[.06,0,2,12]};
const SPEC_MAX=4;
// клиентская команда получает версии ДВС и ERS от поставщика
const teamSpec=(t,k)=>{if(t.engineSup&&(k==='ice'||k==='ers')){const sup=S.teams.find(x=>x.id===t.engineSup);if(sup&&sup!==t)return teamSpec(sup,k)}return((t.spec||{})[k])||1};
const specCost=(t,k)=>+(SPEC[k][2]*(1+.3*(teamSpec(t,k)-1))).toFixed(1);
const specDays=(t,k)=>Math.round(SPEC[k][3]*(1.1-.05*facL(t,k==='ice'||k==='ers'?'eng':k==='gb'?'rig':'comp')));
// почему нельзя начать разработку версии (пусто — можно)
function specBlock(t,k){
  if(teamSpec(t,k)>=SPEC_MAX)return'максимальная версия в этом сезоне';
  if((k==='ice'||k==='ers')&&t.engineSup)return'мотор клиентский — новые версии приходят от поставщика, их нужно только заказать на заводе';
  if((k==='ice'||k==='ers')&&S.rules.freeze)return'двигатели заморожены регламентом';
  if(S.projects.some(p=>p.comp===k))return'уже в разработке';
  if(S.projects.length>=maxProjects())return'все слоты разработки заняты';
  if(specCost(t,k)>capLeft())return'не хватает потолка расходов';
  if(S.budget<specCost(t,k))return'не хватает бюджета';
  return'';
}
// выигрыш от версий поставленных узлов, с/круг
function specBonus(P){if(!P)return 0;let b=0;COMPS.forEach(([k])=>{b+=SPEC[k][0]*(((P[k]&&P[k].sp)||1)-1)});return b}
const pqty=k=>(UI.pq&&UI.pq[k])||1;
function ensureParts(id){if(!S.parts)S.parts={};if(!S.parts[id]){S.parts[id]={};COMPS.forEach(([k])=>S.parts[id][k]={h:100,used:1,sp:1})}return S.parts[id]}
// износ за круг: манера вождения, мастерство пилота, надёжность машины, характер трассы
function compWear(k,d,t,mode,tr){
  const base=COMPS.find(c=>c[0]===k)[4],m=mode==='push'?1.5:mode==='save'?.75:1,sm=1.25-d.craft/200,rl=1.4-t.car.rel/150;
  const trk=k==='ice'||k==='ers'?tr.engine:k==='gb'?.8+tr.over*.4:.6+tr.aero*.4;
  const fk=k==='ice'||k==='ers'?'eng':k==='gb'?'rig':'comp';
  return base*m*sm*rl*trk*(1.15-.07*facL(t,fk));
}
// потеря темпа от износа узлов, с/круг
function compPen(P){if(!P)return 0;const h=k=>P[k].h;
  return Math.max(0,60-h('ice'))*.012+Math.max(0,60-h('ers'))*.01+Math.max(0,40-h('gb'))*.01+Math.max(0,70-h('floor'))*.015+Math.max(0,70-h('fw'))*.012+(h('floor')<=0?1.5:0)+(h('fw')<=0?1.2:0)}
const compLimit=k=>COMPS.find(c=>c[0]===k)[2];
// штраф за узел сверх лимита на сезон (спортивный регламент Ф-1): первый лишний элемент данного типа — 10 мест,
// каждый следующий того же типа — 5 мест; КПП сверх лимита — 5 мест. Больше 15 мест в сумме — старт с последнего ряда.
function partPen(id,k){const lim=compLimit(k),u=ensureParts(id)[k].used;if(!lim||u<lim)return 0;return k==='gb'?5:u===lim?10:5}
// установка нового узла: из склада (наша команда) или сразу (соперники)
// автозаказ: узел у пилота < 40%, на складе и в производстве пусто — заводу ставится заказ
function autoOrder(){
  if(!S.autoOrder)return;
  // заказ покрывает всех пилотов, которым узел понадобится в ближайшие гонки (с учётом срока производства)
  COMPS.forEach(([k,n])=>{const need=me().drivers.filter(id=>ensureParts(id)[k].h<Math.max(40,nextWear(id,k)*2.5)).length,have=(S.stock[k]||0)+S.prod.filter(q=>q.k===k).length;
    const q=Math.max(0,need-have);for(let i=0;i<q&&S.budget>=prodCost(k);i++){money(-prodCost(k),'production','Автозаказ: '+n);S.prod.push({k,days:prodDays(k),sp:teamSpec(me(),k)})}
    if(q)news(`Автозаказ на заводе: ${n} × ${q}, готово ${etaText(prodDays(k))}.`)});
}
// ожидаемый износ узла за следующую гонку (режим «Норма»), %
function nextWear(id,k){const d=drv(id),t=team(d.team)||me(),tr=seasonTracks()[Math.min(S.round,NR()-1)],P=ensureParts(id);return compWear(k,d,t,'norm',tr)*(1-SPEC[k][1]*((P[k].sp||1)-1))}
function fitPart(id,k,own){
  const P=ensureParts(id),t=team(drv(id).team)||me();let sp=teamSpec(t,k);
  if(own){if(!(S.stock[k]>0))return false;S.stock[k]--;S.stockNew=S.stockNew||{};if(S.stockNew[k]>0)S.stockNew[k]--;else sp=Math.max(1,sp-1)}
  P[k].sp=sp;
  const pen=partPen(id,k);P[k].h=100;P[k].used++;const lim=compLimit(k);
  if(pen){S.gpen=S.gpen||{};S.gpen[id]=(S.gpen[id]||0)+pen;const tot=S.gpen[id];
    if(own||drv(id).team===S.pid)news(`${drv(id).name}: ${COMPS.find(c=>c[0]===k)[1]} сверх лимита (${P[k].used}/${lim}) — штраф ${pen} мест на старте${tot>15?'; сумма больше 15 — старт с последнего ряда':tot>pen?`, всего ${tot}`:''}.`)}
  return true;
}
/* ---------- контракты ---------- */
// требования пилота: уровень, очки в сезоне, слабой команде просит больше
const asking=d=>+(salaryFor(d.pace)*(1+Math.min(.4,d.pts/600))*(1+(70-S.rep)/160)).toFixed(2);
// форма команды: место в Кубке конструкторов и очки за последние 5 гонок (0…1)
function teamForm(){const n=S.teams.length,pos=myPos(),rec=(S.results||[]).slice(-5),pts=rec.reduce((a,r)=>a+r.my.reduce((b,x)=>b+(typeof x==='number'?(POINTS[x-1]||0):0),0),0);
  return clamp(((n+1-pos)/n)*.6+Math.min(1,pts/(rec.length*20||1))*.4,0,1)}
const formText=f=>f>=.7?'команда на подъёме':f>=.45?'стабильная форма':'команда в кризисе';
function acceptChance(d,offer,len){
  let p=.5+(offer/asking(d)-1)*1.7+(S.rep-60)/120+(teamForm()-.5)*.35;
  if(d.age>=32)p+=len>=2?.08:-.1;else if(d.age<=24&&len===3)p-=.08;
  if(d.pace>=90&&S.rep<65)p-=.2;
  return clamp(p,.02,.97);
}
const endYear=d=>year()+Math.max(0,d.contract)-1;
const negoKey=()=>S.season*100+S.round;
/* ---------- рынок пилотов в сезоне и завершение карьеры ---------- */
const WINDOW_DAY=()=>dayOf(8,1);
const windowOpen=()=>S.day>=WINDOW_DAY();
const drvRank=d=>driverStandings().indexOf(d)+1;
const teamRank=t=>[...S.teams].sort((a,b)=>b.pts-a.pts).indexOf(t)+1;
// желание продолжать карьеру (0…100), у каждого пилота своё
const drive=d=>{if(d.drive==null)d.drive=ri(30,92);return d.drive};
// вероятность объявить о завершении карьеры: возраст, личные успехи, успех команды, желание гоняться
function retireOdds(d){
  if(d.age<33)return{p:0,why:[]};
  const t=team(d.team),why=[];let p=(d.age-32)*.09;
  const dr=drive(d);p-=(dr-60)/150;if(dr<45)why.push('потерял мотивацию');
  const rk=(S.results||[]).length>=3?drvRank(d):0;if(rk&&rk<=5){p-=.15}else if(rk>12){p+=.08;why.push('неудачный сезон')}
  if(d.wins>0)p-=.1;
  const tr=(S.results||[]).length<3?Math.ceil(S.teams.length/2):t?teamRank(t):S.teams.length;if(tr<=3)p-=.12;else if(tr>S.teams.length-3){p+=.1;why.push('команда не борется за результат')}
  if(d.pace<78){p+=.1;why.push('скорость уже не та')}
  if(d.age>=38)why.push('возраст');
  return{p:clamp(p,.02,.95),why};
}
// с августа ветераны решают, продолжать ли карьеру
function retireCheck(){
  if(!windowOpen()||S.retCheck===S.season)return;S.retCheck=S.season;
  S.teams.forEach(tm=>tm.drivers.forEach(id=>{const d=drv(id);if(d.retiring)return;const o=retireOdds(d);
    if(Math.random()<o.p){d.retiring=true;d.retireWhy=o.why.slice(0,2).join(', ')||'хочет уйти на пике';d.persuaded=false;
      news(`${d.name} (${d.age}) хочет завершить карьеру в конце сезона: ${d.retireWhy}.${tm.id===S.pid?' Поговорите с ним во вкладке «Команда» — его ещё можно убедить остаться.':''}`)}}));
  news('Открыт рынок пилотов: с августа можно договариваться о контрактах на следующий сезон с пилотами других команд, у которых истекает контракт, и со свободными пилотами.');
}
// разговор с пилотом, который хочет уйти
const PERSUADE=[
  ['money','Повысить зарплату на 30%',d=>.15],
  ['lead','Статус первого пилота',d=>{const mate=me().drivers.map(drv).find(x=>x!==d);return mate&&ovr(mate)>ovr(d)?.04:.1}],
  ['car','Пообещать машину для побед',d=>(teamForm()-.45)*.5],
  ['short','Контракт всего на 1 год',d=>.1],
];
function persuadeChance(d,args){
  let p=.22+(drive(d)-50)/150-(d.age-35)*.04;
  const rk=drvRank(d);if(rk&&rk<=8)p+=.08;
  args.forEach(k=>{const a=PERSUADE.find(x=>x[0]===k);if(a)p+=a[2](d)});
  return clamp(p,.03,.92);
}
// ожидаемая зарплата пилота для перехода: пилот лучшей команды просит больше
function preAsk(d){const t=team(d.team);return+(asking(d)*(t&&teamRank(t)<myPos()?1.15:1)).toFixed(2)}
function preChance(d,offer,len){
  const t=team(d.team);let p=.42+(offer/preAsk(d)-1)*1.5+(S.rep-60)/120+(teamForm()-.5)*.4;
  if(t){const diff=teamRank(t)-myPos();p+=diff*.03}
  if(d.pace>=88&&myPos()>5)p-=.15;
  if(d.age>=33)p+=len===1?.05:-.08;else if(d.age<=25&&len>=2)p+=.04;
  return clamp(p,.02,.95);
}
// сколько мест у нас на следующий сезон
const seatsNext=()=>2-me().drivers.map(drv).filter(d=>d.contract>=2&&!d.retiring).length-Object.values(S.drivers).filter(d=>d.next&&d.next.tid===S.pid).length;

/* ---------- академия и скаутинг ---------- */
const REGIONS=['Европа','Южная Америка','Азия','Северная Америка','Океания'];
const ACAD_SLOTS=[2,3,4],ACAD_GROW=[.7,1,1.3],ACAD_UPKEEP=[.1,.2,.35],ACAD_COST=[0,4,8],SCOUT_W=[14,9,5],SCOUT_COST=[0,2.5,5];
function mkJunior(region){
  const age=ri(15,19),pot=Math.round(68+29*Math.pow(Math.random(),1.8)),base=clamp(ri(54,66)+(age-15)*1.6,50,pot);
  const w=SCOUT_W[(S.academy?S.academy.scout:1)-1],lo=clamp(Math.round(pot-rnd(0,w)),50,99);
  const j=ensureAttrs({id:'j'+(uid++),name:pick(FIRST)+' '+pick(LAST),age,region,pace:base,craft:clamp(base+ri(-4,3),45,95),tyre:clamp(base+ri(-3,4),45,95),pot,est:[lo,Math.min(99,lo+w)],lpts:0,focus:'pace'});
  j.league=ovr(j)<58?'f4':ovr(j)<68?'f3':'f2';return j;
}
/* ---------- младшие формулы ---------- */
const LEAGUES=[['f2','Формула-2',[66,80],[18,22]],['f3','Формула-3',[57,71],[16,20]],['f4','Формула-4',[46,62],[15,17]]];
const LTEAMS=['Вектор Юниор','Сапсан Рейсинг','Кедр Моторспорт','Полюс ГП','Нева Рейсинг','Альтаир','Квазар','Буран Юниор','Метеор','Рубин Рейсинг'];
function mkLeagueDriver(lg){
  const L=LEAGUES.find(x=>x[0]===lg),age=ri(L[3][0],L[3][1]),pace=ri(L[2][0],L[2][1]),pot=clamp(Math.round(pace+rnd(2,22)),pace,99);
  return ensureAttrs({id:'l'+(uid++),name:pick(FIRST)+' '+pick(LAST),age,region:pick(REGIONS),pace,craft:clamp(pace+ri(-4,4),40,95),tyre:clamp(pace+ri(-4,4),40,95),pot,team:pick(LTEAMS),lpts:0,lwins:0,last:null});
}
function ensureLeagues(){
  if(!S.leagues){S.leagues={};LEAGUES.forEach(([k])=>{S.leagues[k]=[];for(let i=0;i<20;i++)S.leagues[k].push(mkLeagueDriver(k))})}
  S.academy.juniors.forEach(j=>{ensureAttrs(j);if(!j.league)j.league=ovr(j)<58?'f4':ovr(j)<68?'f3':'f2';if(j.lpts==null)j.lpts=j.f2pts||0});
}
const farmName=()=>me().short+' Юниор';
function leagueRaces(){
  const A=S.academy;
  LEAGUES.forEach(([k,n])=>{
    const field=[...S.leagues[k],...A.juniors.filter(j=>j.league===k)];
    const res=field.map(d=>({d,sc:ovr(d)+gauss()*5})).sort((a,b)=>b.sc-a.sc);
    res.forEach((r,i)=>{r.d.last=i+1;r.d.lpts=(r.d.lpts||0)+(POINTS[i]||0);if(i===0)r.d.lwins=(r.d.lwins||0)+1});
    res.forEach((r,i)=>{if(A.juniors.includes(r.d)&&i<3)news(`${n}: юниор академии ${r.d.name} — ${i+1}-е место${i===0?', победа!':'.'}`)});
    // рост пилотов лиги
    S.leagues[k].forEach(d=>{const g=rnd(0,.3)*(d.age<=19?1.2:.8);if(d.pace<d.pot)d.pace=Math.min(d.pot,d.pace+g);ATTRS.forEach(([a])=>{if(a!=='pace'&&a!=='exp')d[a]=Math.min(97,d[a]+g*.5)})});
  });
}
function leaguesSeasonEnd(){
  const A=S.academy,sorted=k=>[...S.leagues[k],...A.juniors.filter(j=>j.league===k)].sort((a,b)=>(b.lpts||0)-(a.lpts||0));
  const champs=LEAGUES.map(([k,n])=>{const s0=sorted(k)[0];return s0?`${n}: ${s0.name}${A.juniors.includes(s0)?' (наша академия)':''}`:''}).filter(Boolean);
  if(champs.length)news('Чемпионы младших формул — '+champs.join('; ')+'.');
  // повышения: лучшие F4 → F3, F3 → F2, F2 → рынок Ф-1
  const move=(from,to,n)=>{sorted(from).filter(d=>!A.juniors.includes(d)).slice(0,n).forEach(d=>{S.leagues[from]=S.leagues[from].filter(x=>x!==d);S.leagues[to].push(d)})};
  sorted('f2').filter(d=>!A.juniors.includes(d)&&ovr(d)>=70).slice(0,3).forEach(d=>{S.leagues.f2=S.leagues.f2.filter(x=>x!==d);const nd=mkDriver(d.name,d.age,Math.floor(d.pace),Math.floor(d.craft),Math.floor(d.tyre));ATTRS.forEach(([a])=>nd[a]=Math.floor(d[a]));nd.pot=Math.max(d.pot||0,Math.floor(d.pace));nd.skOff=null;ensurePot(nd);S.drivers[nd.id]=nd;news(`${d.name} поднимается из Формулы-2 на рынок Ф-1.`)});
  move('f3','f2',3);move('f4','f3',3);
  LEAGUES.forEach(([k,,,ages])=>{S.leagues[k].forEach(d=>{d.age++;d.lpts=0;d.lwins=0;d.exp=Math.min(99,(d.exp||40)+4)});S.leagues[k]=S.leagues[k].filter(d=>d.age<=ages[1]+2);while(S.leagues[k].length<20)S.leagues[k].push(mkLeagueDriver(k))});
  A.juniors.forEach(j=>{j.lpts=0;j.lwins=0});
}
const acadUpkeep=()=>S.academy?ACAD_UPKEEP[S.academy.level-1]+S.academy.juniors.length*.08:0;
function academyRace(){
  const A=S.academy;if(!A)return;
  ensureLeagues();
  // тренировки: выбранное умение растёт вдвое быстрее, остальные медленнее
  A.juniors.forEach(j=>{
    const g=rnd(.1,.45)*ACAD_GROW[A.level-1]*(.8+srat(me(),'coach')/250)*(j.age<=19?1.2:.8);
    ATTRS.forEach(([a])=>{if(a==='exp')return;const m=a===j.focus?2:.6,cap=a==='pace'?j.pot:Math.min(97,j.pot+3);if(j[a]<cap)j[a]=Math.min(cap,j[a]+g*m)});
  });
  leagueRaces();
}
// роли персонала: ключ, должность, на что влияет, коэффициент зарплаты
const STAFF_ROLES=[
 ['td','Технический директор','число разработок, прирост всех обновлений и болид следующего сезона',3.2],
 ['aero','Главный аэродинамик','прирост аэродинамики сейчас и в болиде следующего сезона',2.2],
 ['engine','Руководитель по двигателям','прирост двигателя и надёжности, мотор следующего сезона',2.2],
 ['eng','Гоночные инженеры','точность отзывов на практике, качество настройки, лишний заезд',1.4],
 ['strat','Главный стратег','точность прогноза погоды и решения авто-пита',1.2],
 ['crew','Шеф механиков','время пит-стопа и ошибки на пит-стопе',1.6],
 ['coach','Тренер пилотов','рост навыков пилотов и меньше ошибок в гонке',1.0],
 ['com','Коммерческий директор','щедрость спонсорских предложений',1.2],
];
const roleK=k=>(STAFF_ROLES.find(r=>r[0]===k)||[0,0,0,1.6])[3];
const srat=(t,k)=>(t[k]&&t[k].rating)||60;
const staffPay=(kind,rating)=>+(0.5+Math.pow((clamp(rating,40,95)-40)/55,2)*roleK(kind)*BAL.staffPayK).toFixed(2);
function mkStaff(kind,rating){rating=Math.round(clamp(rating,40,95));return{name:Math.random()<.3?pick(STAFF_NAMES):pick(FIRST)+' '+pick(LAST),rating,salary:staffPay(kind,rating)}}
function staffMarket(){const m={};STAFF_ROLES.forEach(([k])=>{m[k]=[];for(let i=0;i<3;i++)m[k].push(mkStaff(k,ri(55,93)))});return m}
const hireCost=(kind,sf)=>+(sf.salary*(kind==='td'?1.5:1.2)).toFixed(1);
const staffAsk=sf=>+(sf.salary*(1+(sf.rating-70)/200)*(1+(70-S.rep)/160)).toFixed(2);
function staffChance(sf,offer,len){let p=.5+(offer/staffAsk(sf)-1)*1.7+(S.rep-60)/120+(teamForm()-.5)*.35;if(sf.rating>=85&&S.rep<60)p-=.2;if(len===3)p+=.04;return clamp(p,.03,.97)}
const staffSalary=t=>STAFF_ROLES.reduce((a,[k])=>a+(t[k]?t[k].salary:0),0);

function mkOffer(){
  const rep=S.rep;
  const keys=rep>75?['podium','win','both']:rep>55?['points','both','podium']:['finish','points','both'];
  const g=pick(keys);
  const cm=S.teams?.8+srat(me(),'com')/250:1;
  return{name:pick(SPONSORS),per:+(rnd(.35,.8)*(BAL.sponsorBase+rep/BAL.sponsorRep)*cm).toFixed(2),goal:g,bonus:+(rnd(...GOALS[g].b)*BAL.sponsorBonusK).toFixed(2),sign:+rnd(.5,2.5).toFixed(1)};
}


/* ---------- создание своей команды ---------- */
// инвестор: деньги, стартовая репутация и ожидания совета
const OWN_INV=[
  {n:'Частный энтузиаст',b:0,rep:22,goal:0,h:'Скромно, но без давления: совет ждёт только роста.'},
  {n:'Инвестиционный фонд',b:12,rep:28,goal:1,h:'Больше денег, но фонд ждёт результата уже в первом сезоне.'},
  {n:'Автопроизводитель',b:26,rep:36,goal:3,h:'Большой бюджет и имя, высокие ожидания: место в середине таблицы.'},
];
// ключевой персонал: уровни найма (рейтинг, разовый бонус за подписание, млн)
const OWN_STAFF=[['td','Технический директор'],['crew','Шеф механиков'],['strat','Стратег']];
const OWN_TIER=[['Начинающий',56,0],['Опытный',68,1.5],['Звезда',78,4]];
const OWN_PTS=12,OWN_MAX=8;
// кандидаты в пилоты: свободные агенты из состава и молодые пилоты
function ownPool(RS){
  const key=(UI.real?1:0)+'-'+UI.year0;if(UI.ownPool&&UI.ownPoolKey===key)return UI.ownPool;
  const nT=RS.teams.length,fa=RS.drivers.slice(nT*2).map((d,i)=>({src:'fa',i,spec:d})).filter(x=>x.spec[2]<=84);
  const gen=[];for(let i=0;i<6;i++){const vet=i<2;gen.push({src:'gen',spec:[pick(FIRST)+' '+pick(LAST),vet?ri(30,34):ri(18,23),vet?ri(77,81):ri(72,79),vet?ri(80,86):ri(66,76),vet?ri(78,84):ri(68,78)]})}
  UI.ownPoolKey=key;UI.ownPool=[...fa,...gen].map(x=>({...x,ovr:Math.round(x.spec[2]*.5+x.spec[3]*.3+x.spec[4]*.2),sal:salaryFor(x.spec[2])})).sort((a,b)=>b.ovr-a.ovr);
  UI.ownDrv=[UI.ownPool.length-1,UI.ownPool.length-2];return UI.ownPool;
}
const ownCar=()=>UI.ownCar||(UI.ownCar={aero:0,chassis:0,rel:0});
const ownStaff=()=>UI.ownSt||(UI.ownSt={td:0,crew:0,strat:0});
// итог стартового бюджета: мотор, инвестор, подписание персонала и пилотов
function ownBudget(RS){
  const sup=RS.teams.find(t=>t[0]===(UI.ownEng||RS.teams[0][0]))||RS.teams[0],eng=sup[4][1]-3,pool=ownPool(RS);
  const base=Math.round(34-(eng-75)*.8),inv=OWN_INV[UI.ownInv||0].b,staff=OWN_STAFF.reduce((a,[k])=>a+OWN_TIER[ownStaff()[k]][2],0),
    drv=(UI.ownDrv||[]).reduce((a,i)=>a+(pool[i]?+(pool[i].sal*.3).toFixed(2):0),0);
  return{base,inv,staff,drv:+drv.toFixed(2),total:+(base+inv-staff-drv).toFixed(2),eng};
}
function newGame(ti,customName){
  uid=1000;
  const RS=rosterFor(UI.real,UI.year0),nT=RS.teams.length;
  const drivers={};
  const dl=RS.drivers.map(d=>mkDriver(...d));
  dl.forEach(d=>drivers[d.id]=d);
  const teams=RS.teams.map((t,i)=>{
    const dd=[dl[i*2],dl[i*2+1]];dd.forEach(d=>d.team=t[0]);
    return{id:t[0],name:t[1],short:t[2],color:t[3],car:{aero:t[4][0],engine:t[4][1],chassis:t[4][2],rel:t[4][3]},budget:t[5],rep:t[6],drivers:dd.map(d=>d.id),td:mkStaff('td',85-i*3),crew:mkStaff('crew',84-i*2.5),aero:mkStaff('aero',84-i*2.5),engine:mkStaff('engine',84-i*2.5),eng:mkStaff('eng',82-i*2),strat:mkStaff('strat',82-i*2),coach:mkStaff('coach',78-i*2),com:mkStaff('com',80-i*2),pts:0};
  });
  let p,budget,goal;
  if(UI.own){
    // своя команда: новый участник чемпионата
    const sup=teams.find(t=>t.id===UI.ownEng)||teams[0],eng=sup.car.engine-3,nm0=(UI.teamName||'').trim()||'Новая команда';
    // выбранные пилоты; остальные кандидаты остаются на рынке
    const pool=ownPool(RS),pick2=(UI.ownDrv||[]).slice(0,2),fa=[];
    pool.forEach((x,j)=>{let d=x.src==='fa'?dl[nT*2+x.i]:null;if(!d){d=mkDriver(...x.spec);drivers[d.id]=d}if(pick2.includes(j))fa[pick2.indexOf(j)]=d});
    for(let j=0;j<2;j++)if(!fa[j]){const r=rookie();drivers[r.id]=r;fa[j]=r}
    const inv=OWN_INV[UI.ownInv||0],oc=ownCar(),ost=ownStaff(),ob=ownBudget(RS);
    p={id:'own',name:nm0.slice(0,24),short:((UI.ownShort||'').trim()||nm0.replace(/[^А-ЯЁA-Zа-яёa-z]/g,'').slice(0,3)).toUpperCase().slice(0,3)||'НОВ',color:UI.ownColor||OWN_COLORS[0],
       car:{aero:66+oc.aero,engine:eng,chassis:66+oc.chassis,rel:68+oc.rel},budget:24+inv.b/2,rep:inv.rep,drivers:[fa[0].id,fa[1].id],pts:0,engineFrom:sup.name,engineSup:sup.id};
    STAFF_ROLES.forEach(([k])=>{const os=OWN_STAFF.find(x=>x[0]===k);p[k]=mkStaff(k,os?OWN_TIER[ost[k]][1]+ri(-2,2):ri(52,62));p[k].contract=ri(2,3)});
    fa.slice(0,2).forEach(d=>{d.team='own';d.contract=2});
    teams.push(p);budget=ob.total;goal=teams.length-inv.goal;
  }else{
    p=teams[ti];
    if(customName&&customName.trim()){p.name=customName.trim().slice(0,24);p.short=p.name.replace(/[^А-ЯЁA-Zа-яёa-z]/g,'').slice(0,3).toUpperCase()||p.short}
    budget=Math.round(RS.teams[ti][5]*.5+10);goal=Math.min(nT-1,ti+2);
  }
  S={v:SAVE_VER,season:1,round:0,pid:p.id,rep:p.rep,budget,teams,drivers,year0:UI.year0,real:UI.real,own:!!UI.own,
     sponsors:[],offers:[],projects:[],news:[],results:[],warnings:0,history:[],market:null,goal,lastRace:null};
  ensureEcon();
  if(UI.own){S.fac={wt:1,eng:1,comp:1,rig:1,sim:1,fac:1};S.stock={ice:1,ers:1,gb:1,floor:1,fw:2};news(`Команда «${p.name}» основана! Двигатели — как у «${p.engineFrom}». Первая цель — не оказаться последними и выполнять задания, чтобы расти.`)}
  S.market=staffMarket();
  const first=mkOffer();first.name='Титульный: '+first.name;first.per=+(first.per*1.6).toFixed(2);S.sponsors.push(first);
  for(let i=0;i<4;i++)S.offers.push(mkOffer());
  if(!UI.own)news(`Вы — новый руководитель команды «${p.name}». Совет директоров ждёт ${S.goal}-е место или выше в Кубке конструкторов.`);
  newTasks();save();
}
function news(t){S.news.unshift({r:S.round,s:S.season,t});S.news=S.news.slice(0,30)}

/* ---------- производные ---------- */
function perf(t,tr){const a=tr.aero*(S&&S.rules?S.rules.aeroW:1),w=a+tr.engine+1;return(t.car.aero*a+t.car.engine*tr.engine+t.car.chassis)/w}
/* ---------- регламент, потолок расходов, болид следующего сезона ---------- */
const DEF_RULES={cap:80,wear:1,twoStop:false,aeroW:1,freeze:false,pitAdd:0,prizeFlat:false};
function ensureEcon(){
  if(!S.rules)S.rules={...DEF_RULES};
  if(S.spent==null)S.spent=0;
  // экономика v2: зарплаты персонала по новой шкале (старые сохранения)
  if(!S.econV){S.teams.forEach(t=>STAFF_ROLES.forEach(([k])=>{if(t[k]&&!t[k].acting)t[k].salary=staffPay(k,t[k].rating)}));S.econV=2}
  // старые сохранения: победы и подиумы копились за все сезоны — переносим их в карьеру, сезонные считаем заново
  if(!S.statsV){const res=S.results||[];Object.values(S.drivers).forEach(d=>{d.cWins=d.wins||0;d.cPods=d.pods||0;
      d.wins=res.filter(r=>r.winner===d.id).length;d.pods=clamp(Math.min(d.pods||0,res.length),d.wins,res.length)});
    me().drivers.forEach((id,j)=>{const d=S.drivers[id];if(d)d.pods=res.filter(r=>typeof r.my[j]==='number'&&r.my[j]<=3).length});S.statsV=1}
  S.teams.forEach(t=>{if(!t.next)t.next={aero:0,engine:0,chassis:0,rel:0};STAFF_ROLES.forEach(([k])=>{if(!t[k])t[k]=mkStaff(k,ri(58,72))})});
  if(S.market)STAFF_ROLES.forEach(([k])=>{if(!S.market[k])S.market[k]=[0,1,2].map(()=>mkStaff(k,ri(55,93)))});
  if(!S.votes)S.votes=[];
  if(S.vote===undefined)S.vote=null;
  if(!S.lastPos){S.lastPos={};[...S.teams].sort((a,b)=>carOverall(b)-carOverall(a)).forEach((t,i)=>S.lastPos[t.id]=i+1)}
  if(S.devFund==null)S.devFund=fundFor(me());
  if(!S.fac)S.fac={wt:2,eng:2,comp:2,rig:2,sim:2,fac:2};if(!S.facBuild)S.facBuild={};
  S.teams.forEach(t=>{if(t.id!==S.pid&&!t.fac){const l=clamp(Math.round(t.budget/18),1,5);t.fac={wt:l,eng:l,comp:l,rig:l,sim:l,fac:l}}});
  if(!S.stock)S.stock={ice:1,ers:1,gb:1,floor:2,fw:3};if(!S.prod)S.prod=[];if(S.autoFit===undefined)S.autoFit=true;if(S.autoOrder===undefined)S.autoOrder=true;
  Object.values(S.drivers).forEach(d=>{if(d.team)ensureParts(d.id)});
  if(S.academy&&S.academy.mission&&S.academy.mission.days==null)S.academy.mission.days=(S.academy.mission.left||1)*14;
  if(S.day==null)S.day=S.round<NR()?raceDay(seasonTracks()[S.round])-10:dayOf(12,10);
  (S.projects||[]).forEach(p=>{if(p.days==null)p.days=(p.left||1)*14});(S.prod||[]).forEach(q=>{if(q.days==null)q.days=(q.left||1)*7});
  if(!S.academy){S.academy={level:1,scout:1,juniors:[],prospects:[],mission:null};S.academy.juniors.push(mkJunior(pick(REGIONS)))}
  // счётчик ID после загрузки: не пересекаться с уже существующими
  const nums=[...Object.keys(S.drivers),...S.academy.juniors.map(j=>j.id),...(S.leagues?Object.values(S.leagues).flat().map(d=>d.id):[])].map(x=>+String(x).slice(1)).filter(n=>!isNaN(n));
  uid=Math.max(uid,...nums,999)+1;
  Object.values(S.drivers).forEach(ensureAttrs);
  if(!S.tasks)newTasks();
  STAFF_ROLES.forEach(([k])=>{const sf=me()[k];if(sf&&sf.contract==null)sf.contract=ri(1,3)});
  ensureLeagues();
}
const capLeft=()=>+(S.rules.cap-S.spent).toFixed(1);
// очки разработки на следующий сезон за 1 млн
// место в Кубке конструкторов прошлого сезона (в первом сезоне — по силе команд)
const lastRank=t=>(S.lastPos&&S.lastPos[t.id])||S.teams.length;
// призовой фонд FOM за сезон по месту в Кубке конструкторов (млн): от 14 у последнего до ~59 у чемпиона
const fomPrize=pos=>+(S.rules.prizeFlat?BAL.prizeFlatMin+(S.teams.length-pos)*BAL.prizeFlatStep:BAL.prizeMin+(S.teams.length-pos)*BAL.prizeStep).toFixed(1);
// ATR: время в аэротрубе — отстающим больше (последнее место 115%, чемпион 70%)
const atr=t=>.7+.45*(lastRank(t)-1)/Math.max(1,S.teams.length-1);
// фонд FOM на болид следующего сезона: последним больше
const aiDevBudget=o=>fundFor(o)+clamp(o.budget*BAL.aiDevShare,BAL.aiDevMin,BAL.aiDevMax);
const fundFor=t=>Math.round(14+16*(lastRank(t)-1)/Math.max(1,S.teams.length-1));
const partBoost=(t,k)=>(k==='aero'?.8+srat(t,'aero')/250:k==='engine'||k==='rel'?.8+srat(t,'engine')/250:1)*facMul(t,k)*(k==='aero'?atr(t):1);
const devEff=(t,k)=>(.7+t.td.rating/200)*partBoost(t,k||'chassis');
// прогноз характеристики болида следующего сезона
const nextStat=(t,k)=>+(62+facL(t,PART_FAC[k])*1.2+22*(1-Math.exp(-t.next[k]/20))+(t.car[k]-75)*.25).toFixed(1);
const PROPOSALS=[
 {id:'capdown',t:'Снизить потолок расходов на разработку на 8 млн',d:'Богатым командам сложнее тратить, малые выигрывают.',rep:true,apply:()=>{S.rules.cap=Math.max(30,S.rules.cap-8)},int:t=>(35-t.budget)/12},
 {id:'capup',t:'Поднять потолок расходов на разработку на 8 млн',d:'Команды с большим бюджетом смогут вложить больше.',rep:true,apply:()=>{S.rules.cap+=8},int:t=>(t.budget-35)/12},
 {id:'wear',t:'Более агрессивные шины: износ +20%',d:'Больше пит-стопов и стратегии, выигрывают пилоты с хорошей работой с шинами.',rep:true,apply:()=>{S.rules.wear=+(S.rules.wear*1.2).toFixed(2)},int:t=>(t.drivers.reduce((a,id)=>a+drv(id).tyre,0)/Math.max(1,t.drivers.length)-84)/4},
 {id:'twostop',t:'Два обязательных пит-стопа в сухой гонке',d:'Нарушение — штраф 10 секунд. Сильный шеф механиков становится важнее.',apply:()=>{S.rules.twoStop=true},int:t=>(t.crew.rating-75)/8},
 {id:'aero',t:'Упрощение аэродинамики: её влияние на трассах −20%',d:'Выигрывают команды с сильным двигателем.',rep:true,apply:()=>{S.rules.aeroW=+(S.rules.aeroW*.8).toFixed(2)},int:t=>(t.car.engine-t.car.aero)/3},
 {id:'freeze',t:'Заморозка двигателей до конца сезона',d:'Разработка двигателя запрещена всем. Выгодно тем, у кого мотор уже сильный.',apply:()=>{S.rules.freeze=true},int:t=>(t.car.engine-S.teams.reduce((a,x)=>a+x.car.engine,0)/S.teams.length)/3},
 {id:'pit',t:'Снизить лимит скорости на пит-лейне (+3 с к пит-стопу)',d:'Пит-стопы дороже — меньше остановок, больше игры на износ.',rep:true,apply:()=>{S.rules.pitAdd+=3},int:t=>(78-t.crew.rating)/8},
 {id:'prize',t:'Перераспределить призовой фонд в пользу малых команд',d:'Разница в призовых между первым и последним местом уменьшится вдвое.',apply:()=>{S.rules.prizeFlat=true},int:t=>(teamStandings().findIndex(x=>x.id===t.id)+1-S.teams.length/2)/2},
];
function newVote(){
  const used=new Set(S.votes.filter(v=>v.s===S.season).map(v=>v.id));
  const pool=PROPOSALS.filter(p=>!used.has(p.id)&&(p.rep||!S.votes.some(v=>v.id===p.id&&v.pass))&&!(p.id==='freeze'&&S.rules.freeze));
  if(!pool.length)return;const p=pick(pool);
  S.vote={id:p.id,round:S.round,mine:null};
  news(`Комиссия Формулы-1 ставит на голосование: «${p.t}».`);
}
function resolveVote(){
  const v=S.vote;if(!v)return;const p=PROPOSALS.find(x=>x.id===v.id);
  const ballots=S.teams.map(t=>({tid:t.id,yes:t.id===S.pid?v.mine===true:(p.int(t)+gauss()*.6)>0}));
  const yes=ballots.filter(b=>b.yes).length,need=Math.ceil(S.teams.length*.6),pass=yes>=need;
  if(pass)p.apply();
  S.votes.unshift({id:p.id,t:p.t,s:S.season,yes,need,pass,ballots,mine:v.mine});S.votes=S.votes.slice(0,12);
  news(`Голосование «${p.t}»: ${yes} из ${S.teams.length} за — ${pass?'принято':'отклонено'}.`);
  S.vote=null;UI.lastVote=S.votes[0];
}
function rulesList(){
  const r=S.rules,a=[`Потолок расходов на разработку: ${r.cap} млн за сезон`,'Обязательны два разных состава сухих шин'];
  if(r.twoStop)a.push('Два обязательных пит-стопа в сухой гонке');
  if(r.wear!==1)a.push(`Износ шин ×${String(r.wear).replace('.',',')}`);
  if(r.aeroW!==1)a.push(`Влияние аэродинамики ×${String(r.aeroW).replace('.',',')}`);
  if(r.freeze)a.push('Двигатели заморожены до конца сезона');
  if(r.pitAdd)a.push(`Пит-стоп дольше на ${r.pitAdd} с`);
  if(r.prizeFlat)a.push('Призовые распределяются равномернее');
  return a;
}
const carOverall=t=>(t.car.aero+t.car.engine+t.car.chassis)/3;
function teamStandings(){return[...S.teams].sort((a,b)=>b.pts-a.pts||carOverall(b)-carOverall(a))}
function driverStandings(){return Object.values(S.drivers).filter(d=>d.team).sort((a,b)=>b.pts-a.pts||b.wins-a.wins||b.pace-a.pace)}
const myPos=()=>teamStandings().findIndex(t=>t.id===S.pid)+1;
const maxProjects=()=>me().td.rating>=82?4:me().td.rating>=66?3:2;
// одна формула для главного экрана и вкладки «Финансы»
const costPerRace=()=>mandPerRace();
const incomePerRace=()=>incPerRace();
const UPG=[{k:'small',n:'Доработка',g:1.2,c:3,d:12},{k:'major',n:'Новый пакет',g:3,c:7,d:30},{k:'rev',n:'Концепция',g:5.5,c:12,d:55}];
const upgCost=(part,u)=>+(u.c*(1+Math.max(0,me().car[part]-70)/40)).toFixed(1);

