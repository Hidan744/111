/* ---------- экраны ---------- */
const ICONS={
 hq:'<svg viewBox="0 0 24 24"><path d="M4 21V10l8-6 8 6v11"/><path d="M9 21v-6h6v6"/></svg>',
 car:'<svg viewBox="0 0 24 24"><path d="M3 15h18l-2-5H8l-3 5"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M12 10V7h4"/></svg>',
 staff:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/></svg>',
 money:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9v.01M18 15v.01"/></svg>',
 table:'<svg viewBox="0 0 24 24"><path d="M6 20V10M12 20V4M18 20v-7"/></svg>',
 academy:'<svg viewBox="0 0 24 24"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/><path d="M22 9v6"/></svg>',
 gear:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
};
const TABS=[['hq','Штаб'],['car','Болид'],['staff','Команда'],['academy','Академия'],['money','Финансы'],['table','Таблица']];

function header(){
  const t=me();
  return`<div class="top wrap"><div class="badge">${esc(t.short)}</div><div class="grow"><div style="font-weight:700" class="ell">${esc(t.name)}</div><div class="eyebrow">Сезон ${year()} · Этап ${Math.min(S.round+1,NR())}/${NR()} · ${myPos()}-е место</div></div><div class="money">${fm(S.budget)}</div><button class="iconbtn" data-a="settings" aria-label="Настройки">${ICONS.gear}</button></div>`;
}
function tabbar(){return`<nav class="tabs">${TABS.map(([k,n])=>`<button data-a="tab" data-v="${k}" class="${UI.tab===k?'on':''}" aria-label="${n}">${ICONS[k]}<span>${n}</span></button>`).join('')}</nav>`}

function render(){
  const app=$('#app');
  document.documentElement.style.setProperty('--team',S?me().color:'#ff8a1f');
  disposeShow();
  if(UI.screen!=='race')dispose3D();
  app.classList.toggle('wide',UI.screen==='race');
  const fn={title:vTitle,new:vNew,hub:vHub,setup:vSetup,settings:vSettings,media:vMedia,qstage:vQstage,test:vTest,quali:vQuali,qres:vQres,race:vRace,result:vResult,season:vSeason}[UI.screen];
  app.innerHTML=fn();
  after();
  auScreen();
  // автосохранение уик-энда: шаг, настройки, практика и квалификация переживают перезагрузку страницы
  if(S&&W&&UI.screen!=='race'){clearTimeout(UI._ast);UI._ast=setTimeout(()=>save(),400)}
}
function after(){
  const sh=$('#show');if(sh)initShow(sh,sh.dataset.color,sh.dataset.acc);
  document.querySelectorAll('canvas[data-track]').forEach(cv=>{
    const p=trackPath(cv.dataset.track);const{ctx,w,h}=fitCanvas(cv,+cv.dataset.r||.55);drawTrack(ctx,w,h,p,Math.max(6,w*.03),false);
  });
}

function vTitle(){
  const sv=load(),has=!!sv,col=sv?((sv.teams.find(t=>t.id===sv.pid)||{}).color||'#ff8a1f'):'#ff8a1f';
  return`<div class="title wrap narrow">
   <div class="stripes"></div>
   <div><div class="eyebrow">Гоночный менеджер</div><div class="logo">ПИТ<span>-</span>УОЛЛ</div></div>
   ${HAS3D?`<canvas class="show" id="show" data-color="${col}" aria-label="3D-модель болида"></canvas>`:''}
   <p class="muted" style="max-width:40ch">Вы руководитель команды. Пилоты, болид, спонсоры и стратегия в 3D-гонке — решения принимаете вы.</p>
   <div class="stack">
     ${has?`<button class="btn primary block" data-a="continue">Продолжить карьеру</button>`:''}
     <button class="btn ${has?'':'primary'} block" data-a="new">${has?'Новая карьера':'Начать карьеру'}</button>
     <button class="btn block" data-a="settings">Настройки</button>
     ${has?'':'<button class="btn block" data-a="import">Загрузить карьеру из файла</button><input type="file" id="importfile" accept=".json,application/json" hidden>'}
   </div>
   ${UI.loadNote?`<p style="color:var(--accent);font-size:13px;max-width:44ch">${esc(UI.loadNote)}${!has&&hasSave()?' <button class="btn small" data-a="export" data-v="raw">Скачать файл</button>':''}</p>`:''}
   <div class="stripes"></div>
  </div>`;
}
function ownSetup(RS){
  const pool=ownPool(RS),sel=UI.ownDrv||[],oc=ownCar(),left=OWN_PTS-oc.aero-oc.chassis-oc.rel,ost=ownStaff(),ob=ownBudget(RS),inv=UI.ownInv||0;
  return`<div class="card"><h3>Инвестор</h3><div class="stack">${OWN_INV.map((o,i)=>`<button class="btn ${inv===i?'primary':''}" style="justify-content:space-between;text-align:left" data-a="oinv" data-v="${i}"><span><b>${o.n}</b><br><span style="font-size:12px;opacity:.8">${o.h}</span></span><span class="mono">+${o.b} млн</span></button>`).join('')}</div></div>
  <div class="card"><div class="row between"><h3>Пилоты</h3><span class="pill ${sel.length===2?'good':'bad'}">выбрано ${sel.length}/2</span></div>
   ${pool.map((x,i)=>{const on=sel.includes(i),[n,age,pace,craft,tyre]=x.spec;return`<button class="btn ${on?'primary':''}" style="justify-content:space-between;text-align:left" data-a="odrv" data-v="${i}"><span><b>${esc(n)}</b> <span style="opacity:.8">${age} л.</span><br><span class="mono" style="font-size:12px;opacity:.85">рейтинг ${x.ovr} · СКР ${pace} · МАС ${craft} · ШИН ${tyre}</span></span><span class="mono" style="font-size:12px;text-align:right">${fm(x.sal,2)}/сезон<br>подписание ${fm(+(x.sal*.3).toFixed(2),2)}</span></button>`}).join('')}
   <p class="muted" style="font-size:12px">Свободные пилоты и молодые таланты. Сильный пилот дороже: зарплата идёт из бюджета каждый этап.</p></div>
  <div class="card"><div class="row between"><h3>Концепция болида</h3><span class="pill ${left?'acc':'good'}">очков: ${left}</span></div>
   ${[['aero','Аэродинамика',66],['chassis','Шасси',66],['rel','Надёжность',68]].map(([k,n,b])=>`<div class="row between" style="gap:8px"><span style="width:110px">${n}</span><div class="bar grow"><i style="width:${b+oc[k]}%"></i></div><span class="mono" style="width:28px;text-align:right">${b+oc[k]}</span><div class="seg" style="width:auto"><button data-a="ocar" data-v="${k}|-1" ${oc[k]<=0?'disabled':''}>−</button><button data-a="ocar" data-v="${k}|1" ${left<=0||oc[k]>=OWN_MAX?'disabled':''}>+</button></div></div>`).join('')}
   <div class="row between"><span style="width:110px">Двигатель</span><span class="muted" style="font-size:12px">${ob.eng} — от поставщика</span></div>
   <p class="muted" style="font-size:12px">Распределите ${OWN_PTS} очков (не больше ${OWN_MAX} в одну часть): быстрая, но хрупкая машина или надёжная, но медленная.</p></div>
  <div class="card"><h3>Ключевой персонал</h3>${OWN_STAFF.map(([k,n])=>`<div class="stack" style="gap:4px;border-top:1px solid var(--line);padding-top:8px"><b>${n}</b><div class="seg">${OWN_TIER.map(([tn,r,c],i)=>`<button data-a="ostaff" data-v="${k}|${i}" class="${ost[k]===i?'on':''}">${tn} ${r}${c?` · ${String(c).replace('.',',')} млн`:''}</button>`).join('')}</div></div>`).join('')}
   <p class="muted" style="font-size:12px">Техдиректор — темп разработки и слоты; шеф механиков — пит-стопы; стратег — точность прогнозов. Остальной персонал — начинающий, его можно нанять позже.</p></div>
  <div class="card"><h3>Стартовый бюджет</h3><div class="kv">
   <div><span class="eyebrow">База (мотор)</span><b>${fm(ob.base,1)}</b></div><div><span class="eyebrow">Инвестор</span><b style="color:var(--good)">+${fm(ob.inv,1)}</b></div>
   <div><span class="eyebrow">Персонал</span><b style="color:var(--bad)">−${fm(ob.staff,1)}</b></div><div><span class="eyebrow">Пилоты</span><b style="color:var(--bad)">−${fm(ob.drv,2)}</b></div></div>
   <div class="row between" style="border-top:1px solid var(--line);padding-top:8px"><b>Итого</b><b class="money" style="font-size:20px">${fm(ob.total,1)}</b></div>
   ${ob.total<8?`<p style="color:var(--bad);font-size:13px">Мало денег на старт: нужно хотя бы 8 млн на зарплаты и узлы.</p>`:''}
   <p class="muted" style="font-size:12px">Цель совета в первом сезоне: ${OWN_INV[inv].goal?`${S0TeamsN(RS)-OWN_INV[inv].goal}-е место или выше`:'не быть последними'}.</p></div>`;
}
const S0TeamsN=RS=>RS.teams.length+1;
function vNew(){
  const RS=rosterFor(UI.real,UI.year0),nT=RS.teams.length,sel=Math.min(UI.pickTeam,nT-1);UI.pickTeam=sel;
  const seg=(a,cur,opts)=>`<div class="seg">${opts.map(([v,n])=>`<button data-a="${a}" data-v="${v}" class="${String(cur)===String(v)?'on':''}">${n}</button>`).join('')}</div>`;
  return`<div class="scroll wrap" id="sc"><div class="narrow stack" style="gap:14px">
   <div><div class="eyebrow">Новая карьера</div><h1>Выберите команду</h1></div>
   <div class="card"><h3>Стартовый сезон</h3>${seg('year0',UI.year0,[[2025,'2025 · 10 команд'],[2026,'2026 · 11 команд']])}
    <p class="muted" style="font-size:13px">Реальный календарь: ${CALENDARS[UI.year0].length} этапов, с ${CALENDARS[UI.year0][0][1]} (${CIRCUITS[CALENDARS[UI.year0][0][0]][0]}) по ${CALENDARS[UI.year0].slice(-1)[0][1]} (${CIRCUITS[CALENDARS[UI.year0].slice(-1)[0][0]][0]}).</p></div>
   <div class="card"><h3>Команды и пилоты</h3>${seg('real',UI.real?1:0,[[1,'Реальные Ф-1'],[0,'Вымышленные']])}</div>
   <div class="card"><h3>Режим карьеры</h3>${seg('ownmode',UI.own?1:0,[[0,'Возглавить команду'],[1,'Создать свою команду']])}
    <p class="muted" style="font-size:13px">${UI.own?'Новый участник чемпионата: скромный бюджет, слабый болид, база первого уровня, начинающий персонал и низкая репутация. Растите через задания и результаты.':'Возглавьте одну из существующих команд.'}</p></div>
   ${UI.own?`<div class="card"><h3>Своя команда</h3>
    <label class="stack"><span class="eyebrow">Название</span><input type="text" id="tname" maxlength="24" placeholder="Например, Пит-Уолл Рейсинг" value="${esc(UI.teamName)}"></label>
    <label class="stack"><span class="eyebrow">Сокращение (3 буквы)</span><input type="text" id="tshort" maxlength="3" placeholder="ПУР" value="${esc(UI.ownShort||'')}"></label>
    <span class="eyebrow">Цвет</span><div class="row wrapflex">${OWN_COLORS.map(c=>`<button data-a="ocolor" data-v="${c}" aria-label="Цвет" style="width:34px;height:34px;border-radius:8px;background:${c};${(UI.ownColor||OWN_COLORS[0])===c?'box-shadow:0 0 0 3px var(--fg)':''}"></button>`).join('')}</div>
    <span class="eyebrow">Двигатель</span><div class="stack">${[...RS.teams].sort((a,b)=>b[4][1]-a[4][1]).slice(0,5).map(t=>{const eng=t[4][1]-3,b=Math.round(34-(eng-75)*.8);return`<button class="btn ${(UI.ownEng||RS.teams[0][0])===t[0]?'primary':''}" style="justify-content:space-between" data-a="oeng" data-v="${t[0]}"><span>Как у «${t[1]}» · мощность ${eng}</span><span class="mono">бюджет ${b} млн</span></button>`}).join('')}</div>
    <p class="muted" style="font-size:12px">Сильный мотор дороже: стартовый бюджет меньше.</p></div>
   ${ownSetup(RS)}`:''}
   ${UI.own?'':'<p class="muted">Чем ниже команда в списке, тем слабее болид и скромнее бюджет, но и ожидания совета ниже.</p>'}
   ${UI.own?'':`<div class="teampick">${RS.teams.map((t,i)=>{const dd=RS.drivers.slice(i*2,i*2+2).map(d=>d[0].split(' ').slice(-1)[0]).join(', ');const ov=Math.round((t[4][0]+t[4][1]+t[4][2])/3);
     return`<button data-a="pick" data-v="${i}" class="${i===sel?'on':''}"><span class="chip" style="background:${t[3]};width:14px;height:34px"></span>
       <span class="grow"><b>${t[1]}</b> <span class="muted">${dd}</span><br><span class="muted mono" style="font-size:12px">Болид ${ov} · бюджет ${Math.round(t[5]*.5+10)} млн · цель: ${Math.min(nT-1,i+2)}-е</span></span>
       ${i<2?'<span class="pill bad">высокие ожидания</span>':i>nT-3?'<span class="pill acc">аутсайдер</span>':''}</button>`}).join('')}</div>
   <label class="stack"><span class="eyebrow">Своё название команды (необязательно)</span><input type="text" id="tname" maxlength="24" placeholder="${RS.teams[sel][1]}" value="${esc(UI.teamName)}"></label>`}
   ${UI.own&&((UI.ownDrv||[]).length<2||ownBudget(RS).total<8)?`<p style="color:var(--bad);font-size:13px">${(UI.ownDrv||[]).length<2?'Выберите двух пилотов.':'Не хватает денег на старт — выберите другого инвестора, мотор, пилотов или персонал подешевле.'}</p>`:''}
   <button class="btn primary block" data-a="create" ${UI.own&&((UI.ownDrv||[]).length<2||ownBudget(RS).total<8)?'disabled':''}>${UI.own?'Основать команду':'Подписать контракт'}</button>
   <button class="btn block" data-a="home">Назад</button>
  </div></div>`;
}
function vHub(){
  const body={hq:vHQ,car:vCar,staff:vStaff,academy:vAcademy,money:vMoney,table:vTable}[UI.tab]();
  return header()+`<div class="scroll wrap" id="sc">${body}</div>`+tabbar();
}
// что требует внимания: срочные проблемы и доступные решения по данным игры (важное — первым)
function bestUpgrade(){
  const t=me(),tr=seasonTracks().slice(S.round,S.round+5);if(!tr.length)return null;
  const w={aero:tr.reduce((a,x)=>a+x.aero*(S.rules.aeroW||1),0)/tr.length,engine:tr.reduce((a,x)=>a+x.engine,0)/tr.length,chassis:1,rel:.6};
  let best=null;PARTS.forEach(([k,n])=>{if(k==='engine'&&(S.rules.freeze||t.engineSup))return;if(S.projects.some(p=>p.part===k))return;
    const u=UPG[0],c=upgCost(k,u),g=u.g*(.7+t.td.rating/200)*partBoost(t,k),val=g*w[k]/c;if(upgBlock(k,c))return;
    if(!best||val>best.val)best={k,n,c,g,val,why:k==='rel'?'меньше риск схода':`на ближайших трассах вес ${w[k].toFixed(2).replace('.',',')}`}});
  return best;
}
function attention(){
  const t=me(),L=[],add=(lvl,txt,d,a,v,btn)=>L.push({lvl,txt,d,a,v,btn});
  if(t.drivers.length<2)add(3,'Нет второго пилота','Без двух пилотов нельзя начать уик-энд.','goto','staff|','К пилотам');
  t.drivers.forEach(id=>COMPS.forEach(([k,n])=>{const P=ensureParts(id)[k],w=nextWear(id,k),q=S.prod.filter(x=>x.k===k).length;
    if(P.h<w*1.05){const fatal=FATAL.has(k);add(fatal?3:2,`${nm(id)}: ${n} не доживёт до финиша (${Math.round(P.h)}%, нужно ~${Math.round(w)}%)`,S.stock[k]>0?'На складе есть узел — поставьте его.':q?`Узел в производстве: ${etaText(Math.min(...S.prod.filter(x=>x.k===k).map(x=>x.days)))}.`:fatal?'Склад пуст — закажите узел, иначе сход.':'Склад пуст — машина потеряет темп.',S.stock[k]>0?'fit':'prod',S.stock[k]>0?`${id}|${k}`:k,S.stock[k]>0?'Поставить':'Заказать')}}));
  const left=Math.max(0,NR()-S.round),net=incPerRace()-mandPerRace();
  if(S.budget<0)add(3,`Бюджет в минусе: ${fm(S.budget,1)}`,'При долге больше 20 млн в конце сезона команду закроют.','goto','money|','Финансы');
  else if(net<0&&S.budget/-net<left)add(2,`Денег хватит примерно на ${Math.floor(S.budget/-net)} ${plural(Math.floor(S.budget/-net),'этап','этапа','этапов')}`,`Обязательные расходы ${fm(mandPerRace(),2)} больше гарантированного дохода ${fm(incPerRace(),2)} за этап.`,'goto','money|','Финансы');
  if(S.vote&&S.vote.mine==null)add(2,'Голосование по регламенту','Решение примут перед следующим уик-эндом.','goto','hq|vote','Голосовать');
  t.drivers.map(drv).filter(d=>d.retiring&&!d.persuaded).forEach(d=>add(2,`${d.name} хочет завершить карьеру`,'Поговорите с ним, пока он не ушёл.','goto','staff|','Поговорить'));
  if(S.sponsors.length<3&&S.offers.length){const o=[...S.offers].sort((a,b)=>b.per-a.per)[0];add(2,`Свободно мест для спонсоров: ${3-S.sponsors.length}`,`Лучшее предложение: «${o.name}», +${fm(o.per,2)} за этап.`,'goto','money|','Спонсоры')}
  const devAv=Math.max(0,Math.min(S.budget-mandPerRace()*3,capLeft()));
  if(S.projects.length<maxProjects()){const b=bestUpgrade();if(b&&devAv>=b.c)add(1,`Свободно слотов разработки: ${maxProjects()-S.projects.length}`,`Выгоднее всего сейчас: доработка «${b.n}» — +${b.g.toFixed(1).replace('.',',')} за ${fm(b.c,1)} (${b.why}).`,'goto','car|sec-upg','К разработке')}
  COMPS.forEach(([k,n])=>{const sp=teamSpec(t,k);if(sp>1&&(S.stockNew||{})[k]>0&&t.drivers.some(id=>(ensureParts(id)[k].sp||1)<sp))add(1,`Готовы узлы новой версии: ${n}, спец. ${sp}`,'На машинах стоит старая версия.','goto','car|sec-parts','К узлам')});
  if(windowOpen()&&seatsNext()>0)add(1,`Место на ${year()+1} свободно: ${seatsNext()}`,'Открыт рынок пилотов — договоритесь о контракте на следующий сезон.','goto','staff|','К рынку');
  const sx=STAFF_ROLES.filter(([k])=>t[k]&&!t[k].acting&&t[k].contract<=1).map(([,n])=>n);if(sx.length&&S.round>NR()*.5)add(S.round>NR()*.8?2:1,`Контракты персонала истекают: ${sx.join(', ')}`,'Без продления их заменят временные сотрудники с рейтингом 48 — разработка и пит-стопы станут хуже.','goto','staff|','К персоналу');
  const acting=STAFF_ROLES.filter(([k])=>t[k]&&t[k].acting).map(([,n])=>n);if(acting.length)add(2,`Временно исполняют обязанности: ${acting.join(', ')}`,'Наймите постоянных сотрудников на рынке персонала.','goto','staff|','К персоналу');
  const ex=t.drivers.map(drv).filter(d=>d.contract<=1&&!d.retiring);if(ex.length&&S.round>NR()*.5)add(1,`Контракт истекает: ${ex.map(d=>d.name).join(', ')}`,'Продлите или найдите замену до конца сезона.','goto','staff|','Переговоры');
  return L.sort((a,b)=>b.lvl-a.lvl);
}
function attnCard(){
  const L=attention(),pos=myPos(),left=Math.max(0,NR()-S.round),mand=mandPerRace();
  const lv=['','info','acc','bad'],ic=['','•','!','!!'];
  return`<div class="card attn"><div class="sumrow">
    <div><span class="eyebrow">Место</span><b>${pos}<small>/${S.teams.length}</small></b><span class="${pos<=S.goal?'okc':'bdc'}">цель ${S.goal}-е</span></div>
    <div><span class="eyebrow">Бюджет</span><b class="money">${fm(S.budget,1)}</b><span>${mand>0?`≈ ${Math.max(0,Math.floor(S.budget/mand))} эт. расходов`:''}</span></div>
    <div><span class="eyebrow">До конца сезона</span><b>${left}<small> эт.</small></b><span>обязательно ≈ ${fm(+(mand*left).toFixed(1),1)}</span></div>
   </div>
   <h3 style="margin-top:4px">${L.length?'Требует внимания':'Всё под контролем'}</h3>
   ${L.length?L.slice(0,5).map(x=>`<div class="aitem l${x.lvl}"><span class="aic">${ic[x.lvl]}</span><div class="grow"><b>${esc(x.txt)}</b><span>${esc(x.d)}</span></div>${x.a?`<button class="btn small ${x.lvl===3?'danger':''}" data-a="${x.a}" data-v="${x.v}">${x.btn}</button>`:''}</div>`).join('')+(L.length>5?`<p class="muted" style="font-size:12px">И ещё ${L.length-5} — смотрите вкладки команды.</p>`:''):'<p class="muted" style="font-size:13px">Срочных дел нет: можно отправляться на уик-энд.</p>'}
  </div>`;
}
function vHQ(){
  if(S.round>=NR())return`<div class="card"><div class="eyebrow">Сезон ${year()} завершён</div><h2>Все ${NR()} этапов позади</h2><p class="muted">Пора подвести итоги и узнать решение совета директоров.</p><button class="btn primary block" data-a="endseason">Итоги сезона</button></div>`;
  const tr=seasonTracks()[S.round],t=me();
  const need=t.drivers.length<2;
  const feat=tr.aero>=1.2?'Важна аэродинамика':tr.engine>=1.2?'Важен двигатель':'Сбалансированная трасса';
  const pos=myPos();
  return`<div class="cols"><div class="col">${attnCard()}<div class="card">
    <div class="row between"><div><div class="eyebrow">Этап ${S.round+1} · ${tr.country}</div><h2>${tr.gp}</h2><span class="muted" style="font-size:13px">${tr.name} · ${tr.date}.${year()} · ${tr.km.toFixed(3).replace('.',',')} км</span></div><span class="pill acc">${lapsFor(tr)} кр.</span></div>
    <canvas class="track" data-track="${tr.seed}" data-r=".5"></canvas>
    <div class="row wrapflex"><span class="pill">${feat}</span><span class="pill ${tr.over>.6?'bad':tr.over<.4?'good':''}">Обгоны: ${tr.over>.6?'трудно':tr.over<.4?'легко':'средне'}</span><span class="pill info">Дождь ${Math.round(tr.rain*100)}%</span></div>
    ${need?`<p style="color:var(--bad)">Нужно два пилота. Подпишите пилота во вкладке «Команда» или переведите юниора из академии.</p>`:''}
    ${t.drivers.flatMap(id=>COMPS.filter(([k])=>FATAL.has(k)&&ensureParts(id)[k].h<30&&!(S.stock[k]>0)).map(([k,n])=>`<p style="color:var(--bad);font-size:13px">${esc(nm(id))}: ${n} ${Math.round(S.parts[id][k].h)}%, на складе пусто — закажите узел на заводе (вкладка «Болид»), иначе будет сход.</p>`)).join('')}
    ${S.budget<0?`<p style="color:var(--bad);font-size:13px">Бюджет в минусе (${fm(S.budget,1)}). Тратить на разработку нельзя, при долге больше 20 млн к концу сезона — банкротство. Ищите спонсоров и выполняйте задания.</p>`:''}
    ${(()=>{const ex=STAFF_ROLES.filter(([k])=>t[k]&&t[k].contract<=1&&!t[k].acting).map(([,n])=>n.toLowerCase());return ex.length?`<p style="color:var(--accent);font-size:13px">Контракты персонала истекают в конце сезона: ${ex.join(', ')}. Переговоры — во вкладке «Команда».</p>`:''})()}
    ${t.drivers.map(drv).filter(d=>d.contract<=1||d.retiring).map(d=>`<p style="color:var(--accent);font-size:13px">${esc(d.name)}: ${d.retiring?'завершит карьеру в конце сезона':'контракт истекает в конце сезона — проведите переговоры'}.</p>`).join('')}
    <div class="row between wrapflex" style="font-size:13px"><span>Сегодня: <b>${fdate(S.day)}</b>, ${wday(S.day)}</span><span>${weekendDay()-S.day>0?`до уик-энда <b>${weekendDay()-S.day}</b> ${plural(weekendDay()-S.day,'день','дня','дней')}`:'уик-энд начинается'}</span></div>
    ${weekendDay()-S.day>0?`<div class="row">${[[1,'+1 день'],[7,'+7 дней']].map(([n,l])=>`<button class="btn small grow" data-a="day" data-v="${n}" ${S.day+n>weekendDay()?'disabled':''}>${l}</button>`).join('')}<button class="btn small grow" data-a="day" data-v="wk">К уик-энду</button></div>`:''}
    <button class="btn primary block" data-a="weekend" ${need?'disabled':''}>Начать гоночный уик-энд</button>
  </div>
  <div class="card">
    <div class="row between"><h3>Совет директоров</h3><span class="pill ${pos<=S.goal?'good':pos<=S.goal+1?'acc':'bad'}">${pos<=S.goal?'по плану':pos<=S.goal+1?'на грани':'ниже цели'}</span></div>
    <p>Цель: <b>${S.goal}-е</b> место в Кубке конструкторов. Сейчас: <b>${pos}-е</b>, ${t.pts} ${plural(t.pts,'очко','очка','очков')}.${S.warnings?` <span style="color:var(--bad)">Предупреждений: ${S.warnings}/2.</span>`:''}</p>
  </div>
  ${testAvail()?`<div class="card" style="border-color:var(--info)"><div class="row between"><h3>${testAvail()==='pre'?'Предсезонные тесты':'Тестовый день в сезоне'}</h3><span class="pill info">${testAvail()==='pre'?`день ${S.intel.days+1}/3`:'1 день'}</span></div><p class="muted" style="font-size:13px">Соберите данные о болиде и соперниках: кто сильнее на прямых, в поворотах, на шинах и по надёжности.</p><button class="btn block" data-a="totest">На тесты</button></div>`:''}
  ${tasksCard()}
  ${voteCard()}
  <div class="card"><h3>Регламент</h3><ul style="margin:0;padding-left:18px;font-size:13px;display:flex;flex-direction:column;gap:4px">${rulesList().map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
  <div class="card"><h3>Новости паддока</h3><div class="feed">${S.news.slice(0,6).map(n=>`<div><span class="muted mono" style="font-size:11px">${(S.year0||2026)+n.s-1} · этап ${n.r+1}</span><br>${esc(n.t)}</div>`).join('')}</div></div>
  </div><div class="col">
  <div class="kv">
    <div><span class="eyebrow">Доход за этап</span><b style="color:var(--good)">+${incomePerRace().toFixed(1).replace('.',',')}</b><span class="muted" style="font-size:12px">FOM, призовые, спонсоры (без бонусов)</span></div>
    <div><span class="eyebrow">Расходы за этап</span><b style="color:var(--bad)">−${costPerRace().toFixed(1).replace('.',',')}</b><span class="muted" style="font-size:12px">зарплаты, логистика, база, академия</span></div>
    <div><span class="eyebrow">Репутация</span><b>${Math.round(S.rep)}</b><span class="muted" style="font-size:12px">влияет на спонсоров</span></div>
    <div><span class="eyebrow">Разработки</span><b>${S.projects.length}/${maxProjects()}</b><span class="muted" style="font-size:12px">проекты в работе</span></div>
  </div>
  <div class="card"><h3>Календарь</h3><div class="tblwrap"><table><tbody>${seasonTracks().map((tr,i)=>{const r=S.results.find(x=>x.round===i);
    return`<tr${i===S.round?' class="me"':''}><td class="num muted">${tr.date}</td><td>${tr.gp}<br><span class="muted" style="font-size:11px">${tr.name} · ${tr.country}</span></td><td>${r?`<span class="chip" style="background:${team(r.wtid).color}"></span> ${esc(nm(r.winner))}`:i===S.round?'<span class="pill acc">далее</span>':''}</td><td class="num">${r?r.my.join(' / '):''}</td></tr>`}).join('')}</tbody></table></div></div>
  <button class="btn block small" data-a="home">В главное меню</button></div></div>`;
}
function voteCard(){
  const v=S.vote,lv=UI.lastVote;
  let html='';
  if(lv){html+=`<div class="card"><div class="row between"><h3>Итог голосования</h3><span class="pill ${lv.pass?'good':'bad'}">${lv.pass?'принято':'отклонено'} · ${lv.yes}/${S.teams.length}</span></div><p>${esc(lv.t)}</p>
    <div class="row wrapflex" style="gap:6px">${lv.ballots.map(b=>`<span class="pill ${b.yes?'good':'bad'}"><span class="chip" style="background:${team(b.tid).color}"></span>${esc(team(b.tid).short)} ${b.yes?'за':'против'}</span>`).join('')}</div>
    <p class="muted" style="font-size:12px">Нужно ${lv.need} голосов «за» из ${S.teams.length}.</p><button class="btn small" data-a="closevote">Понятно</button></div>`}
  if(!v)return html;
  const p=PROPOSALS.find(x=>x.id===v.id),lean=S.teams.filter(t=>t.id!==S.pid).map(t=>({t,y:p.int(t)>0}));
  const need=Math.ceil(S.teams.length*.6),fav=lean.filter(x=>x.y).length;
  return html+`<div class="card" id="vote" style="border-color:var(--accent)"><div class="row between"><h3>Голосование Комиссии Ф-1</h3><span class="pill acc">нужно ${need} из ${S.teams.length}</span></div>
    <p><b>${esc(p.t)}</b></p><p class="muted" style="font-size:13px">${esc(p.d)}</p>
    <p style="font-size:13px">По данным паддока, «за» склоняются ${fav} ${plural(fav,'команда','команды','команд')}: ${lean.filter(x=>x.y).map(x=>esc(x.t.short)).join(', ')||'никто'}.</p>
    <div class="seg"><button data-a="vote" data-v="1" class="${v.mine===true?'on':''}">Голосовать за</button><button data-a="vote" data-v="0" class="${v.mine===false?'on':''}">Против</button></div>
    <button class="btn primary block" data-a="castvote" ${v.mine===null?'disabled':''}>Отправить голос</button>
    <p class="muted" style="font-size:12px">Если не проголосовать, голос будет засчитан «против» в начале уик-энда.</p></div>`;
}
function facCard(){
  return`<div class="card" id="sec-fac"><div class="row between"><h3>База команды</h3><span class="pill">содержание ${fm(facUpkeep(),2)}/этап</span></div>
   ${FACS.map(([k,n,h])=>{const l=S.fac[k],b=S.facBuild[k];return`<div class="stack" style="border-top:1px solid var(--line);padding-top:8px;gap:4px">
     <div class="row between"><b>${n}</b><span class="mono" style="color:var(--accent)">${'●'.repeat(l)}<span class="muted">${'○'.repeat(5-l)}</span></span></div>
     <span class="muted" style="font-size:12px">${h}</span>
     ${b?`<span class="pill info">строится уровень ${l+1}: готово ${etaText(b.days)}</span>`:l<5?`<button class="btn small" data-a="facup" data-v="${k}" ${S.budget<FAC_COST[l]?'disabled':''}>Улучшить до ${l+1} · ${FAC_COST[l]} млн · ${FAC_DAYS[l]} дн.</button>${S.budget<FAC_COST[l]?`<span style="color:var(--bad);font-size:12px">Не хватает ${fm(+(FAC_COST[l]-S.budget).toFixed(2),2)} — заработайте призовыми, спонсорами или заданиями.</span>`:''}`:'<span class="pill good">максимальный уровень</span>'}</div>`}).join('')}
   <p class="muted" style="font-size:12px">Уровень здания поднимает базу болида следующего сезона по своей части, ускоряет её разработку и продлевает ресурс связанных узлов. Стройка не входит в потолок расходов. Строить можно все здания одновременно, по одному уровню за раз; дни идут по календарю (кнопки дней в «Штабе» или поездка на этап).</p></div>`;
}
function partsCard(compact){
  const ids=me().drivers,col=h=>h<20?'var(--bad)':h<50?'var(--accent)':'var(--good)';
  const stockCard=`<div class="card"><div class="row between"><h3>Склад и завод</h3><span class="pill">завод: уровень ${S.fac?S.fac.fac:2}</span></div>
   ${COMPS.map(([k,n,lim])=>{const q=S.prod.filter(x=>x.k===k);return`<div class="row between wrapflex" style="border-top:1px solid var(--line);padding-top:8px;gap:8px">
     <div class="grow"><b>${n}</b><br><span class="muted" style="font-size:12px">на складе: <b style="color:var(--fg)">${S.stock[k]||0}</b>${lim?` · лимит на пилота: ${lim}`:''}${q.length?` · в производстве: ${q.length} (готово ${etaText(Math.min(...q.map(x=>x.days)))})`:''}</span></div>
     <div class="row" style="gap:6px"><div class="seg" style="width:auto"><button data-a="pq" data-v="${k}|-1" aria-label="Меньше">−</button><button class="on mono" style="min-width:34px" disabled>${pqty(k)}</button><button data-a="pq" data-v="${k}|1" aria-label="Больше">+</button></div>
     <button class="btn small" data-a="prod" data-v="${k}" ${S.budget<prodCost(k)*pqty(k)?'disabled':''}>Произвести ${pqty(k)} шт. · ${String(+(prodCost(k)*pqty(k)).toFixed(2)).replace('.',',')} млн · ${prodDays(k)} дн.</button></div></div>`}).join('')}
   <p class="muted" style="font-size:12px">Кнопками − и + выберите, сколько штук произвести (до 6 за заказ): все узлы заказа делаются параллельно и приходят на склад в указанный день. Срок и цена зависят от уровня завода (вкладка «База команды» ниже).</p></div>`;
  const drvBlock=id=>{const P=ensureParts(id);return`<div class="stack" style="border-top:1px solid var(--line);padding-top:8px;gap:6px"><b>${esc(drv(id).name)}</b>
   ${COMPS.map(([k,n,lim])=>{const h=Math.round(P[k].h);return`<div class="row between" style="gap:8px"><span style="width:92px;font-size:13px" class="ell">${n}</span><div class="bar grow"><i style="width:${h}%;background:${col(h)}"></i></div><span class="mono" style="width:36px;text-align:right">${h}%</span><span class="mono" style="width:44px;font-size:11px;color:${P[k].h<nextWear(id,k)*1.05?'var(--bad)':'var(--muted)'}" title="На сколько гонок хватит ресурса в режиме «Норма»">~${Math.floor(P[k].h/Math.max(.1,nextWear(id,k)))} гон.</span>${lim?`<span class="muted mono" style="font-size:11px;width:28px">${P[k].used}/${lim}</span>`:'<span style="width:28px"></span>'}<button class="btn small${partPen(id,k)?' danger':''}" data-a="fit" data-v="${id}|${k}" ${S.stock[k]>0?'':'disabled'} title="${partPen(id,k)?`Сверх лимита: штраф ${partPen(id,k)} мест на старте`:'Поставить новый узел со склада'}">${partPen(id,k)?`Штраф −${partPen(id,k)}`:'Заменить'}</button></div>`}).join('')}</div>`};
  return`<div class="card" id="sec-parts"><div class="row between wrapflex"><h3>Узлы болидов</h3><span class="row wrapflex" style="gap:10px"><label class="row" style="font-size:12px;gap:6px"><input type="checkbox" id="autofit" ${S.autoFit?'checked':''}>автозамена перед гонкой</label><label class="row" style="font-size:12px;gap:6px"><input type="checkbox" id="autoorder" ${S.autoOrder?'checked':''}>автозаказ на заводе</label></span></div>
   ${ids.map(drvBlock).join('')}
   <p class="muted" style="font-size:12px">Узлы изнашиваются от манеры вождения: «Атака» ×1,5, «Беречь» ×0,75. Влияют мастерство пилота, надёжность болида, трасса и уровень базы. Изношенный узел отнимает темп, выработанный ДВС, ERS или КПП — сход. Лимит на сезон (по регламенту Ф-1): первый узел сверх лимита — штраф 10 мест на старте, каждый следующий того же типа — 5 мест, КПП — 5 мест; больше 15 мест — старт с последнего ряда. «Заменить» ставит узел со склада.</p></div>
   ${stockCard}`;
}
function vCar(){
  const t=me();
  const best={};PARTS.forEach(([k])=>best[k]=Math.max(...S.teams.map(x=>x.car[k])));
  const rank=[...S.teams].sort((a,b)=>carOverall(b)-carOverall(a)).findIndex(x=>x.id===S.pid)+1;
  const slots=maxProjects(),busy=S.projects.length;
  const capCard=`  <div class="card"><div class="row between"><h3>Потолок расходов</h3><span class="pill ${capLeft()<5?'bad':''}">осталось ${capLeft()} млн</span></div>
    <div class="bar"><i style="width:${clamp(S.spent/S.rules.cap*100,0,100)}%"></i></div>
    <p class="muted" style="font-size:12px">На разработку текущего болида и болида ${year()+1} за сезон можно потратить не больше ${S.rules.cap} млн. Каждый миллион выбирайте: очки сейчас или скорость в следующем году.</p></div>`;
  return`<div class="subnav">${[['upg','Доработка'],['spec','Версии узлов'],['parts','Узлы и завод'],['fac','База'],['next','Болид '+(year()+1)]].map(([k,n])=>`<button class="btn small" data-a="jump" data-v="sec-${k}">${n}</button>`).join('')}</div>
  <div class="cols"><div class="col"><div class="card">
    <div class="row between"><h2>Болид</h2><span class="pill acc">${rank}-й по скорости</span></div>
    ${HAS3D?`<canvas class="show" id="show" data-color="${t.color}" data-acc="${accentOf(t.id)}" aria-label="3D-модель болида, потяните чтобы повернуть"></canvas>`:''}
    ${PARTS.map(([k,n])=>`<div class="stat"><span>${n}</span><div class="bar"><i style="width:${t.car[k]}%"></i><b style="left:${best[k]}%"></b></div><span class="mono">${t.car[k].toFixed(0)}</span></div>`).join('')}
    <p class="muted" style="font-size:12px">Белая риска — лучший показатель в чемпионате. Надёжность снижает шанс схода.</p>
  </div>
  <div class="card">
    <div class="row between"><h3>Разработка</h3><span class="pill">${busy}/${slots} слотов</span></div>
    ${S.projects.length?S.projects.map(p=>`<div class="row between"><span>${p.comp?`${COMPS.find(c=>c[0]===p.comp)[1]} <span class="muted">спец. ${teamSpec(t,p.comp)+1}</span>`:`${PARTS.find(x=>x[0]===p.part)[1]} <span class="muted">+${p.gain.toFixed(1).replace('.',',')}</span>`}</span><span class="pill info">${p.days} дн. · ${etaText(p.days)}</span></div>`).join(''):'<p class="muted">Нет активных проектов. Ниже можно запустить доработку болида или новую версию узла.</p>'}
    <p class="muted" style="font-size:12px">Число слотов зависит от техдиректора (${t.td.rating}). Чем выше рейтинг, тем больше прирост.${busy>=slots?' <b style="color:var(--accent)">Все слоты заняты — новый проект можно начать, когда закончится текущий.</b>':''}</p>
  </div>
  ${upgCards()}
  <div class="card" id="sec-next"><div class="row between"><h2>Болид ${year()+1}</h2><span class="pill info">новый сезон</span></div>
    <div class="kv"><div><span class="eyebrow">Фонд FOM на новый болид</span><b style="color:var(--good)">${fm(S.devFund,1)}</b><span class="muted" style="font-size:12px">не входит в потолок, тратится первым</span></div>
    <div><span class="eyebrow">Аэротруба (ATR)</span><b>${Math.round(atr(t)*100)}%</b><span class="muted" style="font-size:12px">${lastRank(t)}-е место прошлого сезона</span></div></div>
    <p class="muted" style="font-size:12px">Как в Формуле-1: отстающим больше фонда и времени в аэротрубе, лидерам меньше. Когда фонд закончится, вложения идут из бюджета команды и входят в потолок расходов.</p>
    <p class="muted" style="font-size:13px">К каждому сезону строится новая машина. Без вложений она будет медленной — соперники уже работают над своими.</p>
    ${t.engineSup?`<p style="font-size:13px">Двигатель — клиентский, как у «${esc(t.engineFrom)}» (минус 3). Вкладываться в мотор не нужно.</p>`:''}
    ${PARTS.filter(([k])=>!(t.engineSup&&k==='engine')).map(([k,n])=>{const ns=nextStat(t,k),bestN=Math.max(...S.teams.filter(x=>x.id!==S.pid).map(x=>nextStat(x,k)));return`<div class="stack" style="border-top:1px solid var(--line);padding-top:8px;gap:6px">
      <div class="stat"><span>${n}</span><div class="bar"><i style="width:${ns}%;background:var(--info)"></i><b style="left:${bestN}%"></b></div><span class="mono">${ns.toFixed(0)}</span></div>
      <div class="row">${[2,5,10].map(m=>`<button class="btn small grow" data-a="next" data-v="${k}|${m}" ${S.budget<Math.max(0,m-S.devFund)||Math.max(0,m-S.devFund)>capLeft()?'disabled':''}>+${m} млн</button>`).join('')}</div></div>`}).join('')}
    <p class="muted" style="font-size:12px">Белая риска — лучший прогноз среди соперников. Эффективность вложений зависит от техдиректора.</p></div>
  </div><div class="col">
  ${partsCard()}
  ${facCard()}
  ${capCard}</div></div>`;
}
// почему доработку нельзя начать (пусто — можно)
function upgBlock(k,c){const t=me(),pr=S.projects.find(p=>p.part===k);
  if(k==='engine'&&S.rules.freeze)return'двигатели заморожены регламентом до конца сезона';
  if(pr)return`уже идёт проект по этой части — готово ${etaText(pr.days)}`;
  if(S.projects.length>=maxProjects())return`все слоты разработки заняты (${S.projects.length}/${maxProjects()}) — дождитесь окончания проекта или наймите техдиректора сильнее`;
  if(t.car[k]>=99)return'достигнут максимум';
  if(c>capLeft())return`не хватает потолка расходов: осталось ${capLeft()} млн`;
  if(S.budget<c)return`не хватает бюджета: нужно ${c.toFixed(1).replace('.',',')} млн, есть ${fm(S.budget,1)}`;
  return'';}
function upgCards(){
  const t=me(),slots=maxProjects(),busy=S.projects.length;
  return`<div class="card" id="sec-upg"><h3>Доработка болида в сезоне</h3><div class="stack" style="gap:12px">${PARTS.map(([k,n])=>`<div class="stack" style="gap:6px"><b>${n}${k==='engine'&&S.rules.freeze?' <span class="pill bad">заморожен</span>':''}</b>${UPG.map(u=>{
     const c=upgCost(k,u),g=u.g*(.7+t.td.rating/200)*partBoost(t,k);const dis=!!upgBlock(k,c);
     return`<button class="btn" style="justify-content:space-between" data-a="upg" data-v="${k}|${u.k}" ${dis?'disabled':''}><span>${u.n} <span class="muted">≈ +${g.toFixed(1).replace('.',',')} · ${u.d} дн.</span></span><span class="money">${c.toFixed(1).replace('.',',')}</span></button>`}).join('')}${(()=>{const rs=UPG.map(u=>upgBlock(k,upgCost(k,u))),why=[...new Set(rs.filter(Boolean))];return rs.every(Boolean)?`<span style="color:var(--accent);font-size:12px">Недоступно: ${why[0]}</span>`:why.length?`<span class="muted" style="font-size:12px">Дороже варианты: ${why.join('; ')}</span>`:''})()}</div>`).join('')}</div></div>
  <div class="card" id="sec-spec"><h3>Новые версии узлов</h3>
   ${COMPS.map(([k,n])=>{const sp=teamSpec(t,k),why=specBlock(t,k),[g,w]=SPEC[k],fit=t.drivers.map(id=>ensureParts(id)[k].sp||1);
     return`<div class="stack" style="border-top:1px solid var(--line);padding-top:8px;gap:6px"><div class="row between"><b>${n}</b><span class="pill">спец. ${sp}${fit.some(x=>x<sp)?` · на машинах ${fit.join('/')}`:''}</span></div>
     <button class="btn" style="justify-content:space-between" data-a="spec" data-v="${k}" ${why?'disabled':''}><span>Спец. ${sp+1} <span class="muted">${g?`−${g.toFixed(2).replace('.',',')} с/круг`:`износ −${Math.round(w*100)}%`} · ${specDays(t,k)} дн.</span></span><span class="money">${specCost(t,k).toFixed(1).replace('.',',')}</span></button>
     ${why?`<span class="muted" style="font-size:12px">${why}</span>`:''}</div>`}).join('')}
   <p class="muted" style="font-size:12px">Как в Ф-1: новую версию сначала разрабатывают (занимает слот разработки, входит в потолок расходов), потом узлы новой версии нужно произвести на заводе и поставить на машину. Узлы со склада, сделанные раньше, остаются старой версии. Замена тоже расходует лимит узлов на сезон. В новом сезоне версии начинаются заново.</p></div>`;
}
function attrGrid(d,floor){
  return`<div class="agrid">${ATTRS.map(([k,n])=>{const v=Math.floor(d[k]||0);return`<div class="stat" style="grid-template-columns:1fr 60px 26px"><span class="ell" style="font-size:12px">${n}</span><div class="bar"><i style="width:${v}%;background:${v>=90?'var(--good)':v>=75?'var(--accent)':'var(--muted)'}"></i></div><span class="mono">${v}</span></div>`}).join('')}</div>`;
}
function drvCard(d,mine){
  const fire=UI.arm==='fire'+d.id,N=UI.nego&&UI.nego.id===d.id?UI.nego:null;
  const cp=!mine?'':d.contract<=1?`<span class="pill bad">последний сезон</span>`:`<span class="pill">контракт до ${endYear(d)}</span>`;
  return`<div class="card"><div class="row between"><div class="row">${ovrPill(ensureAttrs(d))}<div><h3>${esc(d.name)}</h3><span class="muted" style="font-size:12px">${d.age} лет · ${d.pts} очк. · побед ${d.wins} · подиумов ${d.pods||0}${(d.cWins||0)>d.wins||(d.cPods||0)>(d.pods||0)?` · за карьеру ${d.cWins||0}/${d.cPods||0}`:''}</span></div></div><div class="row wrapflex" style="justify-content:flex-end">${d.retiring?'<span class="pill acc">уходит из спорта</span>':''}${cp}</div></div>
   ${attrGrid(ensureAttrs(d))}
   <div class="row between wrapflex"><span class="muted">Зарплата: <span class="mono">${fm(d.salary,2)}</span>/сезон</span>
   ${mine?`<div class="row wrapflex">${d.retiring&&!d.persuaded?`<button class="btn small" data-a="talk" data-v="${d.id}">Поговорить</button>`:''}${!d.retiring?`<button class="btn small" data-a="nego" data-v="${d.id}">Переговоры</button>`:''}<button class="btn small danger" data-a="fire" data-v="${d.id}">${fire?'Точно уволить?':'Уволить'}</button></div>`:''}</div>
   ${mine&&d.retiring?`<p style="font-size:13px;color:var(--accent)">Хочет завершить карьеру: ${esc(d.retireWhy||'решил уйти')}.${d.persuaded?' Решение окончательное.':''}</p>`:''}
   ${mine&&UI.talk&&UI.talk.id===d.id&&d.retiring&&!d.persuaded?(()=>{const T=UI.talk,pc=Math.round(persuadeChance(d,T.args)*100);return`<div class="stack" style="border-top:1px solid var(--line);padding-top:10px">
     <b>Разговор с ${esc(d.name)}</b><span class="muted" style="font-size:12px">На решение влияют возраст (${d.age}), его сезон (${drvRank(d)}-е место), форма команды (${formText(teamForm())}) и желание гоняться. Выберите аргументы:</span>
     ${PERSUADE.map(([k,n,f])=>{const v=f(d),on=T.args.includes(k);return`<button class="btn small" style="justify-content:space-between" data-a="targ" data-v="${k}" ${on?'aria-pressed="true"':''}><span>${on?'✓ ':''}${n}</span><span class="mono ${v<0?'':'muted'}" style="${v<0?'color:var(--bad)':''}">${v>=0?'+':''}${Math.round(v*100)}%</span></button>`}).join('')}
     <div class="row between"><span>Шанс, что останется</span><span class="pill ${pc>=60?'good':pc>=35?'acc':'bad'}">~${pc}%</span></div>
     <div class="row"><button class="btn small primary grow" data-a="persuade" data-v="${d.id}">Убедить остаться</button><button class="btn small" data-a="tcancel">Отмена</button></div>
     <p class="muted" style="font-size:12px">Попытка одна: если пилот откажет, он уйдёт в конце сезона.</p></div>`})():''}
   ${N?(()=>{const ask=asking(d),pc=Math.round(acceptChance(d,N.offer,N.len)*100),blk=d.negoBlock&&d.negoBlock>negoKey();return`<div class="nego stack" style="border-top:1px solid var(--line);padding-top:10px">
     <div class="row between"><b>Новый контракт</b><span class="muted" style="font-size:12px">просит ~${fm(ask,2)}/сезон</span></div>
     <div class="seg">${[1,2,3].map(l=>`<button data-a="nlen" data-v="${l}" class="${N.len===l?'on':''}">${l} ${plural(l,'сезон','сезона','сезонов')} · до ${year()+l}</button>`).join('')}</div>
     <input type="range" id="nego-offer" min="${(ask*.6).toFixed(2)}" max="${(ask*1.6).toFixed(2)}" step="0.05" value="${N.offer}" aria-label="Зарплата в предложении">
     <div class="row between"><span>Предложение: <b class="mono" id="nego-v">${fm(N.offer,2)}</b>/сезон</span><span class="pill ${pc>=70?'good':pc>=40?'acc':'bad'}" id="nego-p">согласие ~${pc}%</span></div>
     <p class="muted" style="font-size:12px">На решение влияют деньги, репутация (${Math.round(S.rep)}), форма команды (${formText(teamForm())}), возраст и амбиции пилота. После отказа к разговору можно вернуться через 2 этапа.</p>
     <div class="row"><button class="btn small grow" data-a="nsend" data-v="${d.id}" ${blk?'disabled':''}>${blk?'Пилот пока не готов к разговору':'Предложить контракт'}</button><button class="btn small" data-a="ncancel">Отмена</button></div></div>`})():''}
   </div>`;
}
function vAcademy(){
  const A=S.academy,slots=ACAD_SLOTS[A.level-1],seat=me().drivers.length<2;
  const bar=(n,v)=>`<div class="stat"><span>${n}</span><div class="bar"><i style="width:${v}%"></i></div><span class="mono">${Math.floor(v)}</span></div>`;
  const potTxt=j=>`<span class="pill info">потенциал ${j.est[0]}–${j.est[1]}</span>`;
  return`<div class="cols"><div class="col">
   <div class="card"><div class="row between"><h2>Академия</h2><span class="pill">уровень ${A.level} · ${A.juniors.length}/${slots}</span></div>
    <p class="muted" style="font-size:13px">Юниоры выступают за фарм-команду «${esc(farmName())}» в Ф-4, Ф-3 и Ф-2 и растут к своему потенциалу. Выберите фокус тренировок — это умение растёт вдвое быстрее. Быстрее — с прокачанной академией и сильным тренером пилотов (${srat(me(),'coach')}). Содержание: ${fm(acadUpkeep(),2)} за этап.</p>
    ${A.level<3?`<button class="btn small" data-a="acadup" ${S.budget<ACAD_COST[A.level]?'disabled':''}>Расширить академию до уровня ${A.level+1} · ${ACAD_COST[A.level]} млн</button>`:''}</div>
   ${A.juniors.length?A.juniors.map(j=>`<div class="card"><div class="row between"><div class="row">${ovrPill(j)}<div><h3>${esc(j.name)}</h3><span class="muted" style="font-size:12px">${j.age} лет · ${esc(j.region)} · ${LEAGUES.find(l=>l[0]===j.league)[1]} за «${esc(farmName())}» · ${j.lpts||0} очк.${j.last?' · последняя гонка: '+j.last+'-й':''}</span></div></div>${potTxt(j)}</div>
     ${attrGrid(j,true)}
     <div class="stack" style="gap:4px"><span class="eyebrow">Фокус тренировок</span><div class="seg wrapflex">${ATTRS.filter(([a])=>a!=='exp').map(([a,n])=>`<button data-a="focus" data-v="${j.id}|${a}" class="${j.focus===a?'on':''}" style="flex:none">${n}</button>`).join('')}</div></div>
     <div class="row wrapflex"><span class="muted" style="font-size:12px">Лига:</span>${LEAGUES.map(([k,n])=>`<button class="btn small ${j.league===k?'on':''}" data-a="jleague" data-v="${j.id}|${k}">${n}</button>`).join('')}</div>
     <div class="row wrapflex"><button class="btn small" data-a="promote" data-v="${j.id}" ${seat&&ovr(j)>=72?'':'disabled'}>Перевести в Ф-1</button><button class="btn small danger" data-a="release" data-v="${j.id}">${UI.arm==='rel'+j.id?'Точно отчислить?':'Отчислить'}</button></div>
     <p class="muted" style="font-size:12px">${ovr(j)<72?'Для суперлицензии нужен рейтинг 72+.':seat?'Готов к дебюту в Формуле-1.':'Суперлицензия есть — освободите место в основном составе.'}</p></div>`).join(''):'<div class="card"><p class="muted">В академии пока нет юниоров — отправьте скаутов.</p></div>'}
  </div><div class="col">
   <div class="card"><div class="row between"><h2>Поиск талантов</h2><span class="pill">скауты: уровень ${A.scout}</span></div>
    <p class="muted" style="font-size:13px">Скауты ищут картингистов и пилотов младших формул. Чем выше уровень сети, тем точнее оценка потенциала (сейчас ±${SCOUT_W[A.scout-1]}).</p>
    ${A.scout<3?`<button class="btn small" data-a="scoutup" ${S.budget<SCOUT_COST[A.scout]?'disabled':''}>Расширить сеть скаутов до уровня ${A.scout+1} · ${SCOUT_COST[A.scout]} млн</button>`:''}
    ${A.mission?`<p>Скауты работают в регионе «${esc(A.mission.region)}»: вернутся ${etaText(A.mission.days)}.</p>`:`<div class="row wrapflex">${REGIONS.map(r=>`<button class="btn small" data-a="scout" data-v="${r}" ${S.budget<.8?'disabled':''}>${r} · 0,8 млн</button>`).join('')}</div><p class="muted" style="font-size:12px">Поездка занимает 18 дней.</p>`}
   </div>
   ${A.prospects.length?`<div class="card"><h3>Найденные таланты</h3>${A.prospects.map(j=>{const fee=+Math.max(.3,.3+((j.est[0]+j.est[1])/2-70)*.06).toFixed(1);return`<div class="stack" style="border-top:1px solid var(--line);padding-top:10px;gap:6px">
     <div class="row between"><div><b>${esc(j.name)}</b> <span class="muted">${j.age} л. · ${esc(j.region)}</span></div>${potTxt(j)}</div>
     <span class="row" style="gap:6px">${ovrPill(j)}<span class="mono muted" style="font-size:12px">${LEAGUES.find(l=>l[0]===j.league)?.[1]||''} · СКР ${Math.floor(j.pace)} · МАС ${Math.floor(j.craft)} · ШИН ${Math.floor(j.tyre)}</span></span>
     <button class="btn small" data-a="signj" data-v="${j.id}" ${A.juniors.length>=slots||S.budget<fee?'disabled':''}>В академию · ${String(fee).replace('.',',')} млн</button></div>`}).join('')}</div>`:''}
  </div></div>`;
}
function marketCard(){
  const open=windowOpen(),seats=seatsNext();
  const cands=Object.values(S.drivers).filter(d=>!d.retired&&!d.retiring&&d.team!==S.pid&&(!d.team||d.contract<=1)).sort((a,b)=>ovr(ensureAttrs(b))-ovr(ensureAttrs(a))).slice(0,10);
  const signed=Object.values(S.drivers).filter(d=>d.next&&d.next.tid===S.pid);
  return`<div class="card"><div class="row between"><h3>Контракты на ${year()+1}</h3><span class="pill ${open?'good':''}">${open?`мест на ${year()+1}: ${Math.max(0,seats)}`:'откроется 1 августа'}</span></div>
   ${signed.map(d=>`<p style="font-size:13px;color:var(--good)">${esc(d.name)} — предварительный контракт, переходит в команду в ${year()+1} (${fm(d.next.salary,2)}/сезон).</p>`).join('')}
   ${!open?`<p class="muted" style="font-size:13px">Как в Ф-1: со второй половины сезона (сейчас ${fdate(S.day)}) можно договариваться с пилотами других команд, у которых истекает контракт, и со свободными пилотами о переходе на следующий сезон.</p>`:
   seats<=0?`<p class="muted" style="font-size:13px">Оба места на ${year()+1} заняты: у пилотов действуют контракты. Место освободится, если пилот уходит или его контракт истекает и вы его не продлите.</p>`:
   cands.map(d=>{const t=team(d.team),P=UI.pre&&UI.pre.id===d.id?UI.pre:null,blk=d.negoBlock&&d.negoBlock>negoKey();return`<div class="stack" style="border-top:1px solid var(--line);padding-top:8px;gap:6px"><div class="row between">${ovrPill(d)}<div class="grow"><b>${esc(d.name)}</b> <span class="muted">${d.age} л.</span><br><span class="muted" style="font-size:12px">${t?`«${esc(t.name)}», контракт истекает`:'свободный пилот'} · ${d.pts} очк. · просит ~${fm(preAsk(d),2)}</span></div>
     ${d.next?'<span class="pill">договорился с другой командой</span>':`<button class="btn small" data-a="pre" data-v="${d.id}" ${blk?'disabled':''}>${blk?'не готов':'Переговоры'}</button>`}</div>
     ${P?(()=>{const pc=Math.round(preChance(d,P.offer,P.len)*100),ask=preAsk(d);return`<div class="seg">${[1,2,3].map(l=>`<button data-a="plen" data-v="${l}" class="${P.len===l?'on':''}">до ${year()+l}</button>`).join('')}</div>
       <input type="range" id="pre-offer" min="${(ask*.6).toFixed(2)}" max="${(ask*1.6).toFixed(2)}" step="0.05" value="${P.offer}" aria-label="Зарплата в предложении">
       <div class="row between"><span>Предложение: <b class="mono" id="pre-v">${fm(P.offer,2)}</b>/сезон</span><span class="pill ${pc>=60?'good':pc>=35?'acc':'bad'}" id="pre-p">согласие ~${pc}%</span></div>
       <span class="muted" style="font-size:12px">Влияют деньги, репутация, форма команды и сила его нынешней команды по сравнению с нашей.</span>
       <div class="row"><button class="btn small primary grow" data-a="psend" data-v="${d.id}">Предложить контракт с ${year()+1}</button><button class="btn small" data-a="pcancel">Отмена</button></div>`})():''}</div>`}).join('')}</div>`;
}
function vStaff(){
  const t=me();
  const pool=Object.values(S.drivers).filter(d=>!d.team&&!d.retired).sort((a,b)=>b.pace-a.pace);
  const free=t.drivers.length<2;
  return`<div class="cols"><div class="col"><div class="eyebrow">Пилоты</div>${t.drivers.map(id=>drvCard(drv(id),true)).join('')}
   <div class="card"><div class="row between"><h3>Свободные пилоты</h3>${free?'<span class="pill bad">есть место</span>':'<span class="pill">мест нет</span>'}</div>
   ${pool.length?pool.map(d=>{const req=Math.max(0,Math.round((d.pace-74)*3));const ok=S.rep>=req;const fee=+(d.salary*.5).toFixed(1);
     return`<div class="row between" style="border-top:1px solid var(--line);padding-top:10px">${ovrPill(ensureAttrs(d))}<div class="grow"><b>${esc(d.name)}</b> <span class="muted">${d.age} л.</span><br><span class="mono muted" style="font-size:12px">СКР ${d.pace} · МАС ${d.craft} · ОБГ ${d.overtake} · ДОЖ ${d.wet} · ${fm(d.salary,1)}/с</span>${ok?'':`<br><span style="color:var(--bad);font-size:12px">нужна репутация ${req}</span>`}</div>
     <button class="btn small" data-a="hire" data-v="${d.id}" ${!free||!ok||S.budget<fee?'disabled':''}>Подписать · ${fee.toFixed(1).replace('.',',')}</button></div>`}).join(''):'<p class="muted">Рынок пуст.</p>'}
   <p class="muted" style="font-size:12px">Чтобы подписать нового пилота, сначала освободите место. Увольнение стоит половину годовой зарплаты.</p></div>
   ${marketCard()}
   <div class="card"><h3>Из Формулы-2 (суперлицензия)</h3>${S.leagues.f2.filter(d=>ovr(d)>=72).sort((a,b)=>ovr(b)-ovr(a)).slice(0,6).map(d=>{const fee=+(1+ovr(d)*.02).toFixed(1),ok=S.rep>=Math.max(0,(ovr(d)-74)*3);return`<div class="row between" style="border-top:1px solid var(--line);padding-top:10px">${ovrPill(d)}<div class="grow"><b>${esc(d.name)}</b> <span class="muted">${d.age} л. · ${esc(d.team)} · ${d.lpts} очк.</span></div><button class="btn small" data-a="hiref2" data-v="${d.id}" ${!free||!ok||S.budget<fee?'disabled':''}>Подписать · ${String(fee).replace('.',',')}</button></div>`}).join('')||'<p class="muted">Пока никто в Ф-2 не дотягивает до суперлицензии.</p>'}</div></div>
   <div class="col"><div class="eyebrow">Персонал</div>
   ${STAFF_ROLES.map(([k,n,h])=>`<div class="card">
     <div class="row between"><div><h3>${n}</h3><span class="muted" style="font-size:12px">${h}</span></div><span class="pill acc mono">${t[k].rating}</span></div>
     <div class="row between wrapflex"><span>${esc(t[k].name)} <span class="muted">· ${fm(t[k].salary,2)}/сезон</span></span>${t[k].acting?'<span class="pill bad">временно</span>':`<span class="row" style="gap:6px"><span class="pill ${t[k].contract<=1?'bad':''}">${t[k].contract<=1?'последний сезон':'до '+(year()+t[k].contract-1)}</span><button class="btn small" data-a="snego" data-v="${k}">Переговоры</button></span>`}</div>
     ${UI.snego&&UI.snego.k===k?(()=>{const N=UI.snego,sf=t[k],ask=staffAsk(sf),pc=Math.round(staffChance(sf,N.offer,N.len)*100),blk=sf.negoBlock&&sf.negoBlock>negoKey();return`<div class="stack" style="border-top:1px solid var(--line);padding-top:8px">
       <div class="row between"><b>Продление</b><span class="muted" style="font-size:12px">просит ~${fm(ask,2)} · ${formText(teamForm())}</span></div>
       <div class="seg">${[1,2,3].map(l=>`<button data-a="snlen" data-v="${l}" class="${N.len===l?'on':''}">до ${year()+l}</button>`).join('')}</div>
       <input type="range" id="snego-offer" min="${(ask*.6).toFixed(2)}" max="${(ask*1.6).toFixed(2)}" step="0.05" value="${N.offer}" aria-label="Зарплата в предложении">
       <div class="row between"><span>Предложение: <b class="mono" id="snego-v">${fm(N.offer,2)}</b></span><span class="pill ${pc>=70?'good':pc>=40?'acc':'bad'}" id="snego-p">согласие ~${pc}%</span></div>
       <div class="row"><button class="btn small grow" data-a="snsend" ${blk?'disabled':''}>${blk?'Пока не готов к разговору':'Предложить'}</button><button class="btn small" data-a="sncancel">Отмена</button></div></div>`})():''}
     ${S.market[k].map((c,i)=>{const cost=hireCost(k,c);return`<div class="row between" style="border-top:1px solid var(--line);padding-top:8px"><span>${esc(c.name)} <span class="mono">${c.rating}</span><br><span class="muted" style="font-size:12px">${fm(c.salary,2)}/сезон</span></span><button class="btn small" data-a="staff" data-v="${k}|${i}" ${S.budget<cost||c.refused?'disabled':''} title="Шанс согласия ~${Math.round(staffChance(c,c.salary,2)*100)}%">${c.refused?'Отказался':`Нанять (~${Math.round(staffChance(c,c.salary,2)*100)}%)`} · ${cost.toFixed(1).replace('.',',')}</button></div>`}).join('')}
   </div>`).join('')}</div></div>`;
}
// обязательные расходы за этап и ожидаемый гарантированный доход (без бонусов)
function mandPerRace(){const t=me();return+(t.drivers.reduce((a,id)=>a+drv(id).salary,0)/NR()+staffSalary(t)/NR()+BAL.logistics+acadUpkeep()+facUpkeep()).toFixed(2)}
function incPerRace(){return+(BAL.fomBase+fomPrize(lastRank(me()))/NR()+S.sponsors.reduce((a,x)=>a+x.per,0)).toFixed(2)}
function finCard(){
  const F=finState(),left=Math.max(0,NR()-S.round),mand=mandPerRace(),inc=incPerRace(),net=+(inc-mand).toFixed(2),fc=+(S.budget+left*net).toFixed(1);
  const reserve=+(mand*3).toFixed(1),devAv=Math.max(0,Math.min(+(S.budget-reserve).toFixed(1),capLeft()));
  const cats=Object.entries(F.cats).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
  const sumI=cats.filter(c=>c[1]>0).reduce((a,c)=>a+c[1],0),sumE=cats.filter(c=>c[1]<0).reduce((a,c)=>a+c[1],0);
  const last=F.periods.slice(-1)[0];
  const row=(n,v)=>`<div class="row between" style="font-size:13px"><span>${n}</span><span class="mono" style="color:${v>=0?'var(--good)':'var(--bad)'}">${v>=0?'+':''}${fm(v,2)}</span></div>`;
  const runway=net<0?Math.floor(S.budget/-net):null;
  return`<div class="card"><div class="row between"><h2>Финансы ${F.year}</h2><span class="money" style="font-size:20px">${fm(S.budget,1)}</span></div>
   <div class="kv"><div><span class="eyebrow">Обязательные расходы</span><b style="color:var(--bad)">−${fm(mand,2)}</b><span class="muted" style="font-size:12px">за этап: зарплаты, логистика, база, академия</span></div>
    <div><span class="eyebrow">Гарантированный доход</span><b style="color:var(--good)">+${fm(inc,2)}</b><span class="muted" style="font-size:12px">за этап: FOM и спонсоры, без бонусов</span></div>
    <div><span class="eyebrow">Прогноз на конец сезона</span><b style="color:${fc<0?'var(--bad)':'var(--fg)'}">${fm(fc,1)}</b><span class="muted" style="font-size:12px">без новых трат и бонусов, ${left} ${plural(left,'этап','этапа','этапов')}</span></div>
    <div><span class="eyebrow">Можно вложить в развитие</span><b>${fm(devAv,1)}</b><span class="muted" style="font-size:12px">резерв на 3 этапа ${fm(reserve,1)} · потолок ${capLeft()}</span></div></div>
   <p class="muted" style="font-size:12px">В конце сезона владельцы забирают 60% денег сверх годовых обязательных расходов (сейчас это ${fm(+(mand*NR()).toFixed(1),1)}). Копить больше годового резерва невыгодно — лучше вкладывать.</p>
   ${runway!==null&&runway<left?`<p style="color:var(--bad);font-size:13px">Расходы выше гарантированного дохода: денег хватит примерно на ${runway} ${plural(runway,'этап','этапа','этапов')}. Нужны бонусы спонсоров, новые контракты или экономия.</p>`:''}
   <h3 style="margin-top:6px">С начала сезона</h3>
   <div class="row between" style="font-size:13px"><span class="muted">На начало сезона</span><span class="mono">${fm(F.start,2)}</span></div>
   ${cats.map(([k,v])=>row((FIN_CATS[k]||[k])[0],v)).join('')||'<p class="muted" style="font-size:13px">Пока операций не было.</p>'}
   <div class="row between" style="border-top:1px solid var(--line);padding-top:6px;font-size:13px"><b>Доходы ${fm(sumI,1)} · расходы ${fm(-sumE,1)}</b><b class="mono">${fm(S.budget,2)}</b></div>
   ${last?`<h3 style="margin-top:6px">Последний период: ${esc(last.name)}</h3><div class="row between" style="font-size:13px"><span class="muted">Было ${fm(last.start,2)} → стало ${fm(last.end,2)}</span><span class="mono" style="color:${last.sum>=0?'var(--good)':'var(--bad)'}">${last.sum>=0?'+':''}${fm(last.sum,2)}</span></div>
     ${[...last.items].sort((a,b)=>Math.abs(b[2])-Math.abs(a[2])).slice(0,8).map(x=>row(esc(x[1]),x[2])).join('')}`:''}
   ${(S.finHist||[]).length?`<h3 style="margin-top:6px">Прошлые сезоны</h3>${S.finHist.map(h=>`<div class="row between" style="font-size:13px"><span>${h.year}</span><span class="mono">${fm(h.start,1)} → ${fm(h.end,1)}</span></div>`).join('')}`:''}
  </div>`;
}
function vMoney(){
  return`<div class="cols"><div class="col">${finCard()}<div class="card"><div class="row between"><h2>Спонсоры</h2><span class="pill">${S.sponsors.length}/3</span></div>
   ${S.sponsors.length?S.sponsors.map((s,i)=>`<div class="stack" style="border-top:1px solid var(--line);padding-top:10px"><div class="row between"><b>${esc(s.name)}</b><span class="money">+${s.per.toFixed(2).replace('.',',')}/этап</span></div><span class="muted" style="font-size:13px">Бонус ${s.bonus.toFixed(2).replace('.',',')} млн: ${GOALS[s.goal].t.toLowerCase()}</span><button class="btn small danger" data-a="drop" data-v="${i}">${UI.arm==='drop'+i?`Неустойка ${fm(+(s.per*BAL.sponsorDropK).toFixed(2),2)} — разорвать?`:'Разорвать'}</button></div>`).join(''):'<p class="muted">Нет спонсоров — подпишите предложения.</p>'}
  </div></div><div class="col">
  <div class="card"><h3>Предложения</h3>
   ${S.offers.length?S.offers.map((s,i)=>`<div class="stack" style="border-top:1px solid var(--line);padding-top:10px"><div class="row between"><b>${esc(s.name)}</b><span class="money">+${s.per.toFixed(2).replace('.',',')}/этап</span></div><span class="muted" style="font-size:13px">Бонус за подпись ${s.sign.toFixed(1).replace('.',',')} млн · за цель «${GOALS[s.goal].t.toLowerCase()}» +${s.bonus.toFixed(2).replace('.',',')}</span><button class="btn small" data-a="sign" data-v="${i}" ${S.sponsors.length>=3?'disabled':''}>Подписать</button></div>`).join(''):'<p class="muted">Новые предложения появляются каждые три этапа.</p>'}
  </div>
  <div class="card flat"><p class="muted" style="font-size:13px">Чем выше репутация (${Math.round(S.rep)}), тем щедрее предложения. Контракты действуют до конца сезона, часть спонсоров продлевает их.</p></div></div></div>`;
}
function vTable(){
  const ds=driverStandings(),ts=teamStandings();
  const segs=`<div class="seg wrapflex">${[['drivers','Пилоты'],['teams','Конструкторы'],['intel','Аналитика'],['f2','Ф-2'],['f3','Ф-3'],['f4','Ф-4'],['hist','История']].map(([k,n])=>`<button data-a="stand" data-v="${k}" class="${UI.stand===k?'on':''}">${n}</button>`).join('')}</div>`;
  if(UI.stand==='f2'||UI.stand==='f3'||UI.stand==='f4'){const k=UI.stand,A=S.academy,list=[...S.leagues[k],...A.juniors.filter(j=>j.league===k)].sort((a,b)=>(b.lpts||0)-(a.lpts||0)||ovr(b)-ovr(a));
    return segs+`<div class="card"><h3>${LEAGUES.find(l=>l[0]===k)[1]}</h3><div class="tblwrap"><table><thead><tr><th>#</th><th>Пилот</th><th>Команда</th><th class="num">Рейт.</th><th class="num">Поб</th><th class="num">Очки</th></tr></thead><tbody>${list.map((d,i)=>{const mine=A.juniors.includes(d);return`<tr${mine?' class="me"':''}><td class="num">${i+1}</td><td>${esc(d.name)} <span class="muted" style="font-size:11px">${d.age}</span></td><td class="muted">${esc(mine?farmName():d.team)}</td><td class="num">${ovr(d)}</td><td class="num">${d.lwins||0}</td><td class="num">${d.lpts||0}</td></tr>`}).join('')}</tbody></table></div></div>`}
  if(UI.stand==='intel')return segs+intelView();
  // пилоты и конструкторы: карточка лидера и список с цветом команды, отставание от лидера
  if(UI.stand==='drivers'||UI.stand==='teams'){const isD=UI.stand==='drivers',list=isD?ds:ts,lead=list[0],lp=lead.pts,col=x=>isD?team(x.team).color:x.color,sub=x=>isD?esc(team(x.team).name):x.engineSup?`Мотор: ${esc(x.engineFrom)}`:`Болид ${carOverall(x).toFixed(0)}`;
    return segs+`<div class="stand"><div class="sh"><span class="eyebrow">Сезон ${year()} · пройдено этапов: ${Math.min(S.round,NR())} из ${NR()}</span><h1>${isD?'Личный зачёт':'Кубок конструкторов'}</h1></div>
     <div class="slead" style="--tc:${col(lead)}"><span class="eyebrow" style="color:var(--accent)">${S.round?'Лидер чемпионата':'Перед стартом сезона'}</span><b>${esc(lead.name)}</b><span class="muted">${sub(lead)}${isD?` · побед ${lead.wins} · подиумов ${lead.pods||0}`:''}</span><span class="sp">${lp}<small>очков</small></span><span class="sn">1</span></div>
     <div class="slist">${list.slice(1).map((x,i)=>{const mine=isD?x.team===S.pid:x.id===S.pid;return`<div class="srow${mine?' me':''}" style="--tc:${col(x)}"><span class="sn">${i+2}</span><div class="grow" style="min-width:0"><b class="ell">${esc(x.name)}</b><span class="ell">${sub(x)}${isD&&(x.wins||x.pods)?` · ${x.wins} поб. · ${x.pods||0} под.`:''}</span></div><div class="sp">${x.pts}<small>${S.round?'−'+(lp-x.pts):'очк.'}</small></div></div>`}).join('')}</div></div>`}
  return segs+`
  <div class="card"><div class="tblwrap"><table>
  ${UI.stand==='drivers'?`<thead><tr><th>#</th><th>Пилот</th><th class="num">Поб</th><th class="num">Под</th><th class="num">Очки</th></tr></thead><tbody>${ds.map((d,i)=>`<tr${d.team===S.pid?' class="me"':''}><td class="num">${i+1}</td><td><span class="chip" style="background:${team(d.team).color}"></span> ${esc(d.name)}</td><td class="num">${d.wins}</td><td class="num">${d.pods||0}</td><td class="num">${d.pts}</td></tr>`).join('')}</tbody>`
  :UI.stand==='teams'?`<thead><tr><th>#</th><th>Команда</th><th class="num">Болид</th><th class="num">Очки</th></tr></thead><tbody>${ts.map((t,i)=>`<tr${t.id===S.pid?' class="me"':''}><td class="num">${i+1}</td><td><span class="chip" style="background:${t.color}"></span> ${esc(t.name)}</td><td class="num">${carOverall(t).toFixed(0)}</td><td class="num">${t.pts}</td></tr>`).join('')}</tbody>`
  :`<thead><tr><th>Сезон</th><th>Чемпион</th><th class="num">Мы</th></tr></thead><tbody>${S.history.length?S.history.map(h=>`<tr><td class="num">${h.season}</td><td>${esc(h.champ)}<br><span class="muted" style="font-size:11px">${esc(h.cname)}</span></td><td class="num">${h.pos}-е</td></tr>`).join(''):'<tr><td colspan="3" class="muted">Первый сезон ещё идёт.</td></tr>'}</tbody>`}
  </table></div></div>`;
}

/* --- квалификация --- */
function vQuali(){
  const t=me(),tr=W.tr,wet=W.real?W.qwet:W.weather[0],stg=W.qstage||0;
  const later=W.weather.some(x=>x!==W.weather[0]);
  const ins=t.drivers.filter(id=>!stg||W.qin.includes(id)),outs=t.drivers.filter(id=>!ins.includes(id));
  const n=stg?W.qin.length:0,elim=stg===1?Math.ceil((n-10)/2):stg===2?n-10:0;
  return`<div class="racehead wrap"><div class="grow"><div class="eyebrow">${tr.gp} · Суббота · Квалификация</div><h2>${stg?'Q'+stg:'Квалификация'}</h2></div><span class="flag ${wet?'wet':'dry'}">${wet?'ДОЖДЬ':'СУХО'}</span></div>
  ${daysBar()}
  <div class="scroll wrap"><div class="narrow stack" style="gap:14px">
   <div class="card"><h3>${stg?`Сессия Q${stg}: ${n} ${plural(n,'пилот','пилота','пилотов')}${elim?`, ${elim} выбывают`:', борьба за поул'}`:'Прогноз инженеров'}</h3><p>${wet?'Трасса мокрая.':'Трасса сухая.'} ${later?'В воскресенье погода по ходу гонки изменится — радар покажет за несколько кругов.':'На гонку погода, вероятно, устойчивая.'}</p>
   ${outs.length?`<p class="muted">${outs.map(id=>esc(drv(id).name)).join(', ')} — уже выбыл${outs.length>1?'и':''}.</p>`:''}</div>
   <div class="card"><h3>Тактика на круг</h3><p class="muted" style="font-size:13px">Риск даёт около трёх десятых, но пилот может ошибиться.</p>
   ${ins.length?'':'<p class="muted">Наших пилотов в этой сессии нет — можно просто посмотреть результат.</p>'}
   ${ins.map(id=>`<div class="stack"><b>${esc(drv(id).name)}</b><div class="seg"><button data-a="qrisk" data-v="${id}|0" class="${!W.risk[id]?'on':''}">Надёжно</button><button data-a="qrisk" data-v="${id}|1" class="${W.risk[id]?'on':''}">На пределе</button></div></div>`).join('')}
   </div>
   <button class="btn primary block" data-a="runq">${stg?'Провести Q'+stg:'Провести квалификацию'}</button>
   <button class="btn block small" data-a="hub">Вернуться в штаб</button>
  </div></div>`;
}
function vQres(){
  const t=me(),pole=W.grid[0].q;
  return`<div class="racehead wrap"><div class="grow"><div class="eyebrow">${W.tr.gp} · ${W.real?'Воскресенье · ':''}Стартовая решётка</div><h2>${W.tr.name}</h2></div><span class="flag ${W.weather[0]?'wet':'dry'}">${W.weather[0]?'ДОЖДЬ':'СУХО'}</span></div>
  ${daysBar()}
  <div class="scroll wrap"><div class="narrow stack" style="gap:14px">
   ${W.real?`<div class="card"><h3>Гонка: ${W.laps} ${plural(W.laps,'круг','круга','кругов')}</h3><p class="muted" style="font-size:13px">Старт на ${wxText(W.weather[0])==='сухо'?'сухой':'мокрой'} трассе. Реальная дистанция — шины изнашиваются по-настоящему медленно, стратегия на 1–2 пит-стопа.</p></div>`:''}
   <div class="card"><div class="tblwrap"><table><tbody>${W.grid.map((g,i)=>`<tr${g.tid===S.pid?' class="me"':''}><td class="pos">${i+1}</td><td><span class="chip" style="background:${team(g.tid).color}"></span> ${esc(drv(g.id).name)}${g.note?` <span class="pill bad">${g.note}</span>`:''}</td><td class="num">${i?fgap(g.q-pole):fsec(g.q)}</td></tr>`).join('')}</tbody></table></div></div>
   <div class="card"><h3>Стартовые шины</h3><p class="muted" style="font-size:13px">В сухой гонке нужно использовать два разных типа сухих шин, иначе штраф 10 с.</p>
    ${t.drivers.map(id=>{const o=startOptions(id),best=Object.keys(o).find(k=>o[k].delta<.05),sel=o[W.start[id]];
     return`<div class="stack"><b>${esc(drv(id).name)} · ${W.grid.findIndex(g=>g.id===id)+1}-й</b><div class="pitrow">${Object.entries(TYRES).map(([k,ty])=>`<div class="tcol"><button class="tbtn ${W.start[id]===k?'on':''}" style="border-color:${ty.col}" data-a="stire" data-v="${id}|${k}" aria-label="${ty.n}">${ty.l}</button><small class="${o[k].delta<.05?'best':''}">${fdelta(o[k].delta)}</small></div>`).join('')}</div>
     <p style="font-size:13px">${TYRES[W.start[id]].n}: ${sel.delta<.05?'<span style="color:var(--good)">оптимальный выбор</span>':`<span style="color:var(--accent)">медленнее оптимальных ${TYRES[best].n.toLowerCase()} на ${fdelta(sel.delta).slice(1)} за гонку</span>`}<br><span class="muted">План: ${planText(sel.plan)} ${plural(5,'','','кругов')}. Лучший: ${planText(o[best].plan)}.</span></p></div>`}).join('')}
    <p class="muted" style="font-size:12px">Оценка инженеров по износу шин, потерям на пит-стопе и правилу двух составов при текущей погоде. Обгоны и машина безопасности не учтены.</p>
   </div>
   <button class="btn primary block" data-a="race">На старт</button>
  </div></div>`;
}

/* --- гонка --- */
function vRace(){
  const mine=R.cars.filter(c=>c.me),is3=SET.view==='3d'&&HAS3D;
  return`<div class="racehead wrap"><div class="grow"><div class="eyebrow">${R.track.gp} · ${R.track.name}</div><div class="rtitle">Гонка</div></div><div id="flags"></div></div>
  <div class="racebody wrap">
   <div class="stage">
   <div class="viewport">
     ${is3?'<canvas id="v3d" aria-label="3D-трансляция гонки"></canvas>':''}
     ${is3?'':'<canvas id="trk" aria-label="Схема трассы"></canvas>'}
     <div class="tower" id="tower"></div>
     <div class="rtop" id="rtop"></div>
     <div class="rtoast" id="rtoast" hidden></div>
     <div class="ovright">${is3?'<canvas id="trk" class="mini" aria-label="Схема трассы"></canvas>':''}<div class="ovfc" id="ovfc"></div></div>
     <div class="lights" id="lights"><i></i><i></i><i></i><i></i><i></i></div>
     <div class="camseg zoomctl" id="zoomctl"><button data-a="zoom" data-v="in" aria-label="Приблизить">＋</button><button data-a="zoom" data-v="out" aria-label="Отдалить">−</button><button data-a="zoom" data-v="fit">Вся трасса</button><button data-a="zoom" data-v="follow" id="zf">За машиной</button></div>
     <div class="hud">
       ${is3?`<div class="camseg" id="cams">${CAMS.map(([k,n])=>`<button data-a="cam" data-v="${k}">${n}</button>`).join('')}</div>`:''}
       <span class="hudtag" id="follow"></span>
     </div>
   </div>
   <div class="rbar">
     <div class="rb-gp"><b>${esc(R.track.country)}</b><span>${esc(R.track.name)}</span></div>
     <div class="rb-wx" id="rbwx"></div>
     <div class="seg spdtop" id="spd">${SPEEDS.map(([v,n])=>`<button data-a="spd" data-v="${v}">${v===0?'❚❚':n}</button>`).join('')}</div>
     <div class="rb-lap" id="lap">Круг 1/${R.N}</div>
   </div>
   </div>
   <div class="side">
   ${mine.map(c=>`<div class="drvctl" id="ctl-${c.did}" style="--tc:${team(c.tid).color}">
     <div class="dh"><div class="dpos"><small id="dl-${c.did}">Круг 1</small><b id="p-${c.did}">–</b></div><div class="grow" style="min-width:0"><b class="dn ell">${esc(drv(c.did).name)}</b><span class="ell" id="g-${c.did}"></span></div><button class="btn small ghost" data-a="follow" data-v="${c.did}" title="Камера на пилота">Камера</button></div>
     <div class="dg"><div class="gauge"><span id="tyr-${c.did}"></span><small>Шины</small></div><div class="gauge"><b id="cond-${c.did}">100%</b><small>Состояние</small></div><div class="gauge"><b id="stint-${c.did}">0</b><small>кр. на комплекте</small></div></div>
     <div class="seg">${[['push','Атака'],['norm','Норма'],['save','Беречь']].map(([m,n])=>`<button data-a="mode" data-v="${c.did}|${m}" id="m-${c.did}-${m}">${n}</button>`).join('')}</div>
     <button class="btn pitbtn" data-a="pitopen" data-v="${c.did}" id="pb-${c.did}">Пит-стоп</button>
     <div class="pitrow" id="pr-${c.did}" hidden><span class="eyebrow" style="width:58px">В боксы</span>${Object.entries(TYRES).map(([k,ty])=>`<div class="tcol"><button class="tbtn" style="border-color:${ty.col}" data-a="pit" data-v="${c.did}|${k}" id="pit-${c.did}-${k}" aria-label="Пит-стоп: ${ty.n}">${ty.l}</button><small id="pd-${c.did}-${k}"></small></div>`).join('')}<div class="stack" style="margin-left:auto;gap:4px"><button class="btn small" data-a="autopit" data-v="${c.did}" id="au-${c.did}" title="Инженеры сами вызывают пилота в боксы">Авто-пит</button><button class="btn small" data-a="follow" data-v="${c.did}">Камера</button></div></div>
     <div class="wearf" id="wf-${c.did}"></div>
     <div class="muted" style="font-size:12px" id="st-${c.did}"></div>
   </div>`).join('')}
   <div class="card fcard"><div class="row between"><h3>Погода на гонку</h3><span class="muted mono" style="font-size:11px" id="wxacc"></span></div>
     <div class="wxstrip" id="wxs"></div><div class="row between muted mono" style="font-size:10px"><span>1</span><span>${Math.round(R.N/2)}</span><span>${R.N}</span></div>
     <p style="font-size:13px" id="wxt"></p>
     <h3>Шины и стратегия</h3>
     <div class="tblwrap"><table class="tyretab" id="tyretab"></table></div>
     <p class="muted" style="font-size:11px" id="tyrenote"></p>
     <div class="stratl" id="strat"></div>
   </div>
   <div class="card"><h3>Радио</h3><div class="feed" id="feed"></div></div>
   </div>
  </div>`;
}
function daysBar(){
  if(!W||!W.real)return'';const cur=SESS[stepName()][0],days=['Четверг','Пятница','Суббота','Воскресенье'],ci=days.indexOf(cur);
  return`<div class="days wrap">${days.map((d,i)=>`<span class="${i===ci?'on':i<ci?'done':''}">${d}</span>`).join('')}</div>`;
}
function wxText(w){return w?'дождь':'сухо'}
function vMedia(){
  const tr=W.tr,ch=W.hype;
  return`<div class="racehead wrap"><div class="grow"><div class="eyebrow">Этап ${W.ti+1} · ${SESS.media[0]} · ${SESS.media[1]}</div><h2>${tr.gp}</h2></div><span class="pill acc">${W.laps} кр.</span></div>
  ${daysBar()}
  <div class="scroll wrap" id="sc"><div class="cols"><div class="col">
   <div class="card"><h3>Брифинг инженеров</h3>
    <p>${tr.name}, ${tr.country}. Длина круга ${tr.km.toFixed(3).replace('.',',')} км, дистанция ${W.laps} ${plural(W.laps,'круг','круга','кругов')} — ${(tr.km*W.laps).toFixed(1).replace('.',',')} км.</p>
    <div class="row wrapflex"><span class="pill">${tr.aero>=1.2?'Важна аэродинамика':tr.engine>=1.2?'Важен двигатель':'Сбалансированная трасса'}</span><span class="pill ${tr.over>.6?'bad':tr.over<.4?'good':''}">Обгоны: ${tr.over>.6?'трудно':tr.over<.4?'легко':'средне'}</span><span class="pill">Пит-стоп −${tr.pit} с</span><span class="pill">Асфальт ~${W.temp}°C</span><span class="pill ${W.abr>=1.2?'bad':W.abr<=.85?'good':''}">Износ шин: ${abrText(W.abr)}</span></div>
   </div>
   <div class="card"><h3>Прогноз погоды</h3>
    <div class="kv"><div><span class="eyebrow">Пятница · FP1, FP2</span><b>${wxText(W.dayWet.fri)}</b></div><div><span class="eyebrow">Суббота · FP3, квалификация</span><b>${wxText(W.dayWet.sat)}</b></div>
    <div><span class="eyebrow">Воскресенье · старт</span><b>${wxText(W.weather[0])}</b></div><div><span class="eyebrow">Шанс дождя в гонке</span><b>${Math.round(tr.rain*100)}%</b></div></div>
   </div></div><div class="col">
   <div class="card"><h3>Пресс-конференция</h3><p class="muted" style="font-size:13px">Журналисты спрашивают о целях на уик-энд.</p>
    <div class="seg"><button data-a="hype" data-v="0" class="${ch===false?'on':''}">Сдержанно</button><button data-a="hype" data-v="1" class="${ch===true?'on':''}">Обещать очки</button></div>
    <p class="muted" style="font-size:13px">${ch===true?'Если команда наберёт очки — репутация вырастет, если нет — пресса это припомнит.':'Спокойный ответ ни к чему не обязывает.'}</p>
   </div>
   <button class="btn primary block" data-a="nextstep">К пятнице: Практика 1</button>
   <button class="btn block small" data-a="hub">Вернуться в штаб</button>
  </div></div></div>`;
}
function vQstage(){
  const L=W.qlast,pole=L.list[0].q;
  return`<div class="racehead wrap"><div class="grow"><div class="eyebrow">${W.tr.gp} · Суббота</div><h2>Итоги Q${L.stg}</h2></div><span class="flag ${W.qwet?'wet':'dry'}">${W.qwet?'ДОЖДЬ':'СУХО'}</span></div>
  ${daysBar()}
  <div class="scroll wrap" id="sc"><div class="narrow stack" style="gap:14px">
   <div class="card"><div class="tblwrap"><table><tbody>${L.list.map((g,i)=>`${i===L.cut?'<tr><td colspan="3" style="color:var(--bad);font-size:11px;letter-spacing:.1em" class="mono">ЗОНА ВЫЛЕТА</td></tr>':''}<tr${g.tid===S.pid?' class="me"':''} style="${i>=L.cut?'opacity:.6':''}"><td class="pos">${i+1}</td><td><span class="chip" style="background:${team(g.tid).color}"></span> ${esc(drv(g.id).name)}${g.note?` <span class="pill bad">${g.note}</span>`:''}</td><td class="num">${i?fgap(g.q-pole):fsec(g.q)}</td></tr>`).join('')}</tbody></table></div></div>
   <button class="btn primary block" data-a="qnext">Дальше: Q${L.stg+1}</button>
  </div></div>`;
}
function vSetup(){
  const ids=me().drivers;if(!ids.includes(UI.pd))UI.pd=ids[0];
  if(!W.setups[UI.pd])W.setups[UI.pd]={wing:5,susp:5,gear:5,brake:5};
  const pd=UI.pd,setup=W.setups[pd],fb=W.fbs[pd],tm=ids.find(x=>x!==pd);
  const tr=W.tr,st=stepName(),wet=sessWet(),nx=W.steps[W.step+1];
  const mine=W.prac.filter(r=>r.st===st),sheet=[...(W.sheet[st]||[])];
  me().drivers.forEach(id=>{const b=mine.filter(r=>r.did===id).reduce((m,r)=>Math.min(m,r.lap),Infinity);sheet.push({id,tid:S.pid,t:b})});
  sheet.sort((a,b)=>a.t-b.t);const best=sheet[0].t;
  const life=drv(pd);
  const twS=trackWear(W.abr,W.temp,wet),lifeTxt=life?['S','M','H'].map(k=>`${TYRES[k].n.toLowerCase()} ~${Math.round(70/tyreWear(k,wet,life.tyre,'norm',W.ls,twS))}`).join(', '):'';
  return`<div class="racehead wrap"><div class="grow"><div class="eyebrow">Этап ${W.ti+1} · ${SESS[st][0]} · ${SESS[st][1]}</div><h2>${tr.gp}</h2></div><span class="flag ${wet?'wet':'dry'}">${wet?'ДОЖДЬ':'СУХО'}</span></div>
  ${daysBar()}
  <div class="scroll wrap" id="sc"><div class="cols">
   <div class="col">
   <div class="card"><h3>Настройка болида</h3>
    <div class="seg">${ids.map(id=>`<button data-a="pdrv" data-v="${id}" class="${id===pd?'on':''}">${esc(nm(id))} · ${W.runsBy[id]||0}</button>`).join('')}</div>
    <p class="muted" style="font-size:13px">У каждого пилота своя машина и свои настройки. После заезда пилот расскажет, что не так. Хорошая настройка даёт до полсекунды на круге.</p>
    ${SETUP.map(([k,n,lo,hi])=>`<div class="slider"><div class="row between"><b>${n}</b><span class="mono" id="sv-${k}">${setup[k]}</span></div>
      <input type="range" min="1" max="10" step="1" id="set-${k}" data-k="${k}" value="${setup[k]}" aria-label="${n}">
      <div class="row between muted" style="font-size:11px"><span>${lo}</span><span>${hi}</span></div>
      ${fb?`<div class="fb" style="color:${fb[k].ok?'var(--good)':'var(--accent)'}">${fb[k].ok?'✓':fb[k].dir>0?'↑ увеличить':'↓ уменьшить'} · ${esc(fb[k].t)}</div>`:''}</div>`).join('')}
    ${tm?`<button class="btn small" data-a="copyset" data-v="${pd}">Скопировать настройки на ${esc(nm(tm))}</button>`:''}
   </div>${partsCard(true)}</div>
   <div class="col">
   <canvas class="track" data-track="${tr.seed}" data-r=".5"></canvas>
   <div class="card"><div class="row between"><h3>Заезды · ${SESS[st][1]}</h3><span class="pill">${ids.map(id=>`${esc(nm(id))}: ${W.runsBy[id]||0}`).join(' · ')}</span></div>
    ${mine.length?mine.map(r=>`<div class="row between" style="border-top:1px solid var(--line);padding-top:8px"><span>${esc(r.who)}</span><span class="mono">${fsec(r.lap)}</span><span class="pill ${r.sq>=80?'good':r.sq>=55?'acc':'bad'}">настройка ~${r.sq}%</span></div>`).join(''):'<p class="muted">Заездов ещё не было. Оценка настройки появится после первого круга.</p>'}
    <div class="row wrapflex">
     <button class="btn grow" data-a="prac" data-v="${pd}" ${(W.runsBy[pd]||0)<=0?'disabled':''}>Заезд: ${esc(nm(pd))}</button>
     ${ids.length>1?`<button class="btn grow" data-a="pracall" ${ids.every(id=>(W.runsBy[id]||0)<=0)?'disabled':''}>Заезд обоими</button>`:''}
    </div>
    ${mine.length?`<p class="muted" style="font-size:12px">Долгий отрезок (${esc(nm(pd))}, асфальт ${W.temp}°C, абразивность ${abrText(W.abr)}): шины держат до 30% износа примерно — ${lifeTxt} кругов.</p>`:''}
   </div>
   <div class="card" style="padding:8px 10px"><h3 style="padding:6px 4px">Протокол сессии</h3><div class="tblwrap"><table><tbody>${sheet.map((r,i)=>`<tr${r.tid===S.pid?' class="me"':''}><td class="pos">${isFinite(r.t)?i+1:'—'}</td><td><span class="chip" style="background:${team(r.tid).color}"></span> ${esc(nm(r.id))}</td><td class="num">${!isFinite(r.t)?'нет круга':i?fgap(r.t-best):fsec(r.t)}</td></tr>`).join('')}</tbody></table></div></div>
   <button class="btn primary block" data-a="nextstep">${isFP(nx)?'Завершить сессию → '+SESS[nx][1]:'К квалификации'}</button>
   <button class="btn block small" data-a="hub">Вернуться в штаб</button>
   </div>
  </div></div>`;
}
function vSettings(){
  const opt=(key,vals)=>`<div class="seg">${vals.map(([v,n])=>`<button data-a="set" data-v="${key}|${v}" class="${String(SET[key])===String(v)?'on':''}">${n}</button>`).join('')}</div>`;
  const card=(t,body,note)=>`<div class="card"><h3>${t}</h3>${body}${note?`<p class="muted" style="font-size:13px">${note}</p>`:''}</div>`;
  return`<div class="racehead wrap"><div class="grow"><div class="eyebrow">Пит-Уолл</div><h2>Настройки</h2></div><button class="btn small" data-a="back">Готово</button></div>
  <div class="scroll wrap" id="sc"><div class="cols"><div class="col">
   ${card('Графика',opt('gfx',[[0,'Низкая'],[1,'Средняя'],[2,'Высокая'],[3,'Ультра']]),HAS3D?'Средняя — тени и отражения. Высокая — мягкие тени, лак на кузовах, облака. Ультра — максимум деревьев и зрителей, тени 4K. Разрешение подстраивается само, если кадров мало.':'<span style="color:var(--bad)">3D недоступно на этом устройстве, гонка будет показана схемой.</span>')}
   ${card('Вид гонки',opt('view',[['3d','3D-трансляция'],['2d','Схема трассы']]))}
   ${card('Музыка и звук',opt('music',[[0,'Выкл'],[1,'Тихо'],[2,'Громко']])+'<div style="height:8px"></div><span class="eyebrow">Заставка при запуске</span>'+opt('intro',[[1,'Показывать'],[0,'Не показывать']])+'<div style="height:8px"></div><button class="btn block" data-a="replayintro">Посмотреть заставку</button>',AU_OK?'Собственная тема в стиле телетрансляций. В меню играет музыка, в гонке остаются только сигналы старта.':'<span style="color:var(--bad)">Звук недоступен в этом браузере.</span>')}
   ${card('Камера по умолчанию',opt('cam',CAMS),'В гонке камеру можно переключить в любой момент.')}
  </div><div class="col">
   ${card('Скорость гонки по умолчанию',opt('speed',[[1,'×1'],[2,'×2'],[3,'×3'],[4,'×4'],[16,'×16']]))}
   ${card('Режим игры',opt('mode',[['real','Реализм'],['sim','Симуляция']]),SET.mode==='real'?'Реализм: реальное число кругов, уик-энд из четырёх дней — медиа-день, три практики, квалификация Q1/Q2/Q3 и гонка.':'Симуляция: короткие гонки, одна практика и одна квалификация. Быстрый темп карьеры.')}
   ${SET.mode==='sim'?card('Длина гонки',opt('len',[[0.6,'Короткая'],[1,'Стандарт'],[1.5,'Длинная']]),'Меняется со следующего уик-энда.'):''}
   ${card('Сложность',opt('diff',[[0,'Лёгкая'],[1,'Нормальная'],[2,'Сложная']]),'Влияет на скорость развития соперников и качество их настроек.')}
   ${card('Сохранение карьеры',`<div class="stack">${S?`<button class="btn block" data-a="export">Скачать карьеру в файл</button>`:hasSave()?`<button class="btn block" data-a="export" data-v="raw">Скачать сохранение в файл</button>`:''}<button class="btn block" data-a="import">Загрузить карьеру из файла</button><input type="file" id="importfile" accept=".json,application/json" hidden></div>${UI.saveErr?`<p style="color:var(--bad);font-size:13px">${esc(UI.saveErr)}</p>`:''}`,S&&S.savedAt?`Автосохранение после каждого действия; резервная копия — после каждой гонки. Последнее сохранение: ${new Date(S.savedAt).toLocaleString('ru-RU')}.`:'Карьера хранится в этом браузере. Файл позволяет перенести её на другое устройство или сохранить копию.')}
   ${card('Диагностика',DIAG.length?`<div class="stack" style="gap:6px;max-height:220px;overflow:auto">${DIAG.map(d=>`<div style="font-size:12px"><b>${esc(d.t)} · ${esc(d.where)}</b><br><span class="mono" style="color:var(--bad)">${esc(d.m)}</span></div>`).join('')}</div>`:'<p class="muted" style="font-size:13px">Ошибок не было.</p>',`Версия сохранения ${SAVE_VER}. 3D: ${HAS3D?'доступно':'недоступно'}. Звук: ${AU_OK?'доступен':'недоступен'}.`)}
   ${S?card('Карьера',`<button class="btn danger block" data-a="reset">${UI.arm==='reset'?'Нажмите ещё раз — карьера будет удалена':'Сбросить карьеру'}</button>`):''}
  </div></div></div>`;
}
// кольцо шины: дуга уменьшается вместе с остатком ресурса
function tyreRing(ty,h,sz){const r=7,c=2*Math.PI*r,f=clamp(h/100,0,1);sz=sz||20;
  return`<svg width="${sz}" height="${sz}" viewBox="0 0 20 20"><circle cx="10" cy="10" r="${r}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/><circle cx="10" cy="10" r="${r}" fill="none" stroke="${ty.col}" stroke-width="3" stroke-dasharray="${(c*f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 10 10)"/><text x="10" y="13.2" text-anchor="middle" font-size="8" font-weight="700" fill="${ty.col}" font-family="JetBrains Mono, monospace">${ty.l}</text></svg>`}
function updateRaceUi(){
  if(!$('#tower'))return;
  const ord=liveOrder();
  const lap=Math.min(R.N,Math.max(1,(ord[0]&&ord[0].p.laps)+1));
  $('#lap').textContent=R.done?'Финиш':`Круг ${lap}/${R.N}`;
  const k=Math.min(R.N-1,Math.max(0,lap-1)),wet=R.wet[k];
  let radar='';for(let i=k+1;i<Math.min(R.N,k+4);i++)if(R.wet[i]!==wet){radar=`<span class="flag ${R.wet[i]?'wet':'dry'}">${R.wet[i]?'Дождь':'Сухо'} через ${i-k}</span>`;break}
  const fl=$('#flags');if(fl)fl.innerHTML=`<div class="row">${R.sc>0?'<span class="flag sc">SC</span>':''}${radar}<span class="flag ${wet?'wet':'dry'}">${wet?'ДОЖДЬ':'СУХО'}</span></div>`;
  [...$('#spd').children].forEach(b=>b.classList.toggle('on',(R.paused?0:R.speed)===+b.dataset.v));
  const zc=$('#zoomctl');if(zc){zc.hidden=!!G&&UI.cam!=='over';const zf=$('#zf');if(zf)zf.classList.toggle('on',G&&UI.cam==='over'?G.ov.follow:V2.follow)}
  const cs=$('#cams');if(cs)[...cs.children].forEach(b=>b.classList.toggle('on',UI.cam===b.dataset.v));
  const fi=ord.findIndex(x=>x.c.did===UI.follow);
  if(fi>=0)$('#follow').textContent=`${G?CAMS.find(c=>c[0]===UI.cam)[1]+' · ':''}${drv(UI.follow).name} · ${ord[fi].c.out?'сход':'P'+(fi+1)} · ${ord[fi].gap}`;
  if($('#tt'))$('#tt').innerHTML='<tbody>'+ord.map((x,i)=>{const t=team(x.c.tid),ty=TYRES[tyreNow(x.c).tyre];
    return`<tr data-a="follow" data-v="${x.c.did}"${x.c.me?' class="me"':''}><td class="pos">${x.c.out?'—':i+1}</td><td><span class="chip" style="background:${t.color}"></span> ${esc(nm(x.c.did))}</td><td class="num">${x.gap}</td><td><span class="tyre" style="border-color:${ty.col};width:18px;height:18px;border-width:2px;font-size:9px">${ty.l}</span></td><td class="num muted">${Math.round(x.c.health)}% · ${Math.max(0,Math.min(R.N,x.p.laps)-x.c.stintLap)} кр.</td></tr>`}).join('')+'</tbody>';
  ord.forEach((x,i)=>{if(!x.c.me)return;const c=x.c,id=c.did;
    $('#p-'+id).textContent=c.out?'—':(i+1);
    $('#g-'+id).textContent=c.out?'Сход':`${i===0?'лидер':x.gap} · пит-стопов ${c.stops}${pitState(c)?' · в боксах':''}`;
    const tn=tyreNow(c),ty=TYRES[tn.tyre];$('#tyr-'+id).innerHTML=tyreRing(ty,tn.h,46)+`<b style="color:${tn.h<30?'var(--bad)':tn.h<55?'var(--accent)':'var(--fg)'}">${Math.round(tn.h)}%</b>`;
    const P=S.parts[id],cond=P?Math.round(Math.min(...['ice','ers','gb','floor','fw'].map(k=>P[k].h))):100,ce=$('#cond-'+id);ce.textContent=cond+'%';ce.style.color=cond<30?'var(--bad)':cond<55?'var(--accent)':'var(--good)';
    $('#stint-'+id).textContent=Math.max(0,Math.min(R.N,x.p.laps)-tn.stint);$('#dl-'+id).textContent=c.out?'сход':`Круг ${Math.min(R.N,x.p.laps+1)}`;
    const pr=$('#pr-'+id),pb=$('#pb-'+id),open=!!(UI.pitOpen&&UI.pitOpen[id])||!!c.pitReq;if(pr)pr.hidden=!open;
    if(pb){pb.textContent=c.pitReq?`Заезд на круге: ${TYRES[c.pitReq].n.toLowerCase()} — отменить`:open?'Скрыть выбор шин':'Пит-стоп';pb.classList.toggle('armed',!!c.pitReq);pb.disabled=c.out}
    ['push','norm','save'].forEach(m=>$(`#m-${id}-${m}`).classList.toggle('on',c.mode===m));
    const au=$('#au-'+id);if(au){au.classList.toggle('on',!!c.auto);au.textContent=c.auto?'Авто-пит: вкл':'Авто-пит: выкл'}
    Object.keys(TYRES).forEach(t=>$(`#pit-${id}-${t}`).classList.toggle('on',c.pitReq===t));
    const dry=new Set(c.used.filter(x=>x!=='I'));
    let st=c.pitReq?`Заезд в боксы на ${TYRES[c.pitReq].n.toLowerCase()} шины — на ближайшем круге.`:c.health<30?'Шины изношены — пора в боксы!':'';
    if(!c.out&&!R.anyWet&&dry.size<2&&lap>R.N*.5)st+=(st?' ':'')+'Нужен второй тип сухих шин!';
    // стратегия: пересчёт раз в секунду
    if(!c.out&&!R.done&&(!c.optT||performance.now()-c.optT>2000)){c.optT=performance.now();c.opt=raceOptions(c)}
    if(c.opt&&!c.out){const o=c.opt;Object.keys(TYRES).forEach(t=>{const el=$(`#pd-${id}-${t}`);el.textContent=fdelta(o[t].delta);el.className=o[t].delta<.05?'best':''});
      const bestK=Object.keys(o).find(k=>o[k].delta<.05);
      const rec=bestK==='stay'?`Оптимально: остаться на ${TYRES[c.tyre].n.toLowerCase()}${o.stay.plan.length>1?`, пит-стоп примерно через ${o.stay.plan[0][1]} кр. на ${TYRES[o.stay.plan[1][0]].n.toLowerCase()}`:' до финиша'}.`:`Оптимально: в боксы сейчас на ${TYRES[bestK].n.toLowerCase()}.`;
      const q=c.pitReq?` Выбраны ${TYRES[c.pitReq].n.toLowerCase()}: ${o[c.pitReq].delta<.05?'это лучший вариант':fdelta(o[c.pitReq].delta)+' до финиша'}.`:'';
      c.recText=rec;st=q.trim()+(st?' '+st:'')}
    $('#st-'+id).textContent=c.out?'Машина сошла с дистанции.':st;
    $('#ctl-'+id).style.opacity=c.out?.5:1;
  });
  // прогноз погоды: ближайшие 5 кругов точно, дальше со сдвигом ±4 круга
  const cur=Math.min(R.N-1,R.lapDone),fc=i=>i<=cur+R.fexact?R.wet[i]:R.wet[clamp(i+R.fshift,0,R.N-1)];
  if(R._wxCur!==cur){R._wxCur=cur;$('#wxs').innerHTML=Array.from({length:R.N},(_,i)=>`<i class="${fc(i)?'w':''}${i<cur?' p':''}${i===cur?' c':''}${i>cur+R.fexact?' f':''}"></i>`).join('');
  }
  let nxt=-1;for(let i=cur+1;i<R.N;i++)if(fc(i)!==fc(cur)){nxt=i;break}
  $('#wxt').textContent=nxt<0?(fc(cur)?'Дождь, вероятно, до конца гонки.':'Сухо до финиша по прогнозу.'):`${fc(nxt)?'Дождь':'Прекращение дождя'} ожидается ${nxt<=cur+R.fexact?'через '+(nxt-cur)+' '+plural(nxt-cur,'круг','круга','кругов')+' (радар)':'около '+(nxt+1)+'-го круга (±'+R.frng+' кр.)'}.`;
  $('#wxacc').textContent=`стратег ${srat(me(),'strat')}: точно ${R.fexact} кр.`;
  // общая таблица шин (средний пилот) и поправка на навык каждого пилота
  const wNow=R.wet[cur],AV=80,tkey=cur+'|'+wNow+'|'+S.rules.wear;
  if(R._tyK!==tkey){R._tyK=tkey;const rows=Object.entries(TYRES).map(([k,ty])=>{const T=TYRES[k];let off,w;
      off=wNow?(k==='I'?0:8.5):T.off;w=tyreWear(k,wNow,AV,'norm',R.ls,R.tw);return{k,ty,off,w,life:Math.floor(70/w)}});
    const bo=Math.min(...rows.map(r=>r.off));
    $('#tyrenote').textContent=`Средний пилот, режим «Норма». Асфальт ${wNow?R.temp-12:R.temp}°C, абразивность ${abrText(R.abr)}. «Атака» +45% износа, «Беречь» −30%; свой навык работы с шинами у каждого пилота.`;
    $('#tyretab').innerHTML='<thead><tr><th></th><th class="num">Темп</th><th class="num">Износ/кр.</th><th class="num">До 30%</th></tr></thead><tbody>'+rows.map(r=>`<tr><td><span class="tyre" style="border-color:${r.ty.col};width:18px;height:18px;border-width:2px;font-size:9px">${r.ty.l}</span> ${r.ty.n}</td><td class="num">${r.off-bo<.05?'<span style="color:var(--good)">лучший</span>':'+'+(r.off-bo).toFixed(1).replace('.',',')+' с'}</td><td class="num">${r.w.toFixed(1).replace('.',',')}%</td><td class="num">~${r.life} кр.</td></tr>`).join('')+'</tbody>'}
  $('#strat').innerHTML=R.cars.filter(c=>c.me).map(c=>{const d=drv(c.did),f=(1.25-d.tyre/200)/(1.25-AV/200),pct=Math.round((f-1)*100);
    return`<div><b>${esc(nm(c.did))}</b> <span class="pill ${pct<0?'good':pct>0?'bad':''}">шины ${d.tyre}: износ ${pct===0?'как у среднего':(pct>0?'+':'')+pct+'%'}</span><br><span>${c.out?'Сход.':esc(c.recText||'Инженеры считают стратегию…')}</span></div>`}).join('');
  // прогноз износа шин моих пилотов
  R.cars.filter(c=>c.me).forEach(c=>{const el=$('#wf-'+c.did);if(!el)return;if(c.out){el.textContent='';return}
    const w=wearRate(c,R.wet[cur]),l30=w>0?Math.max(0,Math.floor((c.health-30)/w)):99,l0=w>0?Math.floor(c.health/w):99,left=R.N-R.lapDone;
    const pct=Math.round(c.health),end=Math.max(0,Math.round(c.health-w*left));
    const PP=S.parts[c.did],pl=COMPS.map(([k,n])=>{const h=Math.round(PP[k].h);return`<span style="color:${h<20?'var(--bad)':h<50?'var(--accent)':'var(--muted)'}">${n} ${h}%</span>`}).join(' · ');
    el.innerHTML=`<span style="flex-basis:100%">${pl}</span><span>${TYRES[c.tyre].n}: <b>${pct}%</b>, ${Math.max(0,R.lapDone-c.stintLap)} кр. на комплекте, износ ${w.toFixed(1).replace('.',',')}%/кр. (${c.mode==='push'?'атака':c.mode==='save'?'бережём':'норма'})</span><span>${l30>=left?`<span style="color:var(--good)">до финиша хватит (на финише ~${end}%)</span>`:`до 30% — <b>${l30}</b> кр. (к ${R.lapDone+l30+1}-му), полный износ через ${l0} кр.`}</span>`});
  // табло трансляции: позиция, пилот, шины и их износ, отставание от лидера или интервал до машины впереди
  const tw=$('#tower');
  if(tw){const vp=tw.parentElement,sm=vp.clientWidth<600,rh=sm?17:24,n=UI.towerMin?0:Math.max(3,Math.floor((vp.clientHeight-(sm?60:70)-(sm?70:92))/rh));
    let rows=ord.map((x,i)=>({x,i}));if(rows.length>n){const top=rows.slice(0,n),mine=rows.filter(r=>r.x.c.me&&r.i>=n);rows=[...top.slice(0,n-mine.length),...mine]}
    const fl=R.cars.filter(c=>c.best<1e8).sort((a,b)=>a.best-b.best)[0];
    const intv=(x,i)=>{if(i===0)return'Лидер';const pv=ord[i-1];if(!pv||pv.c.out)return x.gap;const L=Math.min(x.p.laps,pv.p.laps,R.N);if(pv.p.laps-x.p.laps>=1&&x.c.cum[L]-pv.c.cum[L]>R.track.base)return'+1 кр.';return fgap(Math.max(0,x.c.cum[L]-pv.c.cum[L]))};
    tw.innerHTML=`<div class="th"><span data-a="tower" title="Свернуть или развернуть табло">${UI.towerMin?'▸ ':''}КРУГ ${Math.min(R.N,lap)}/${R.N}</span><button data-a="tgap" title="Переключить: отставание от лидера или интервал">${UI.towerInt?'Интервал':'Отставание'}</button></div>`+rows.map(({x,i})=>{const t=team(x.c.tid),tn=tyreNow(x.c),ty=TYRES[tn.tyre],pit=!x.c.out&&pitState(x.c);
      const age=Math.max(0,Math.min(R.N,x.p.laps)-tn.stint),fast=fl&&fl===x.c;
      return`<div class="tr${x.c.me?' me':''}${x.c.out?' out':''}${x.c.did===UI.follow?' fo':''}" data-a="follow" data-v="${x.c.did}"><b class="ps">${x.c.out?'—':i+1}</b><span class="tb" style="background:${t.color}"></span><span class="nmc${fast?' fl':''}">${esc(sm?nm(x.c.did).slice(0,3).toUpperCase():nm(x.c.did))}</span>${x.c.out?'<span></span><span></span>':`${tyreRing(ty,tn.h,sm?14:19)}<span class="w" style="color:${tn.h<30?'var(--bad)':tn.h<55?'var(--accent)':'#c9d3dd'}">${Math.round(tn.h)}%</span>`}<span class="g">${x.c.out?'<em class="st">СХОД</em>':pit?'<em class="pt">PIT</em>':UI.towerInt?intv(x,i):(i===0?'Лидер':x.gap)}</span><span class="a">${x.c.out?'':age+'к'}</span></div>`}).join('');
    // всплывающие события трансляции: быстрый круг, машина безопасности, события нашей команды
    if(fl&&R.lapDone>=2&&R._fl!==fl.did+'|'+fl.best){R._fl=fl.did+'|'+fl.best;raceToast(`<span class="tl">Быстрый круг</span><b>${esc(drv(fl.did).name)}</b><span class="mono">${fsec(fl.best)}</span>`,'fast')}
    const f0=R.feed[0];if(f0&&R._ft!==f0&&(f0.mine||/безопасности|разбивает|сход/i.test(f0.t))){R._ft=f0;raceToast(esc(f0.t),f0.mine?'mine':'')}
  }
  const rb=$('#rbwx');if(rb){const now=R.wet[Math.min(R.N-1,R.lapDone)];let nx=-1;for(let i=R.lapDone+1;i<R.N;i++)if((i<=R.lapDone+R.fexact?R.wet[i]:R.wet[clamp(i+R.fshift,0,R.N-1)])!==now){nx=i;break}
    rb.innerHTML=`<span class="wxi">${now?'<svg viewBox="0 0 24 24"><path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 15z" fill="#9fb3c8"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" stroke="#55b6ff" stroke-width="2" stroke-linecap="round"/></svg>':'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#ffc531"/><g stroke="#ffc531" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g></svg>'}</span><div><b>${now?'Дождь':'Сухо'} · ${R.temp}°</b><span>${nx<0?'без изменений до финиша':`${now?'сухо':'дождь'} через ~${nx-R.lapDone} кр.`}</span></div>`}
  const rt=$('#rtop');if(rt){const left=Math.max(0,R.N-Math.min(R.N,lap)+1);rt.innerHTML=`${R.sc>0?'<span class="flag sc">МАШИНА БЕЗОПАСНОСТИ</span>':''}<span>${R.done?'ФИНИШ':left<=1?'ПОСЛЕДНИЙ КРУГ':`ОСТАЛОСЬ ${left} ${plural(left,'КРУГ','КРУГА','КРУГОВ').toUpperCase()}`}</span>`}
  // прогноз поверх трансляции
  const ov=$('#ovfc');
  if(ov){const m=[];for(let i=cur;i<Math.min(R.N,cur+15);i++)m.push(fc(i));
    ov.innerHTML=`<div class="row between"><b>Погода</b><span class="muted">${nxt<0?(fc(cur)?'дождь до финиша':'сухо до финиша'):(fc(nxt)?'дождь':'сухо')+' ~'+(nxt-cur)+' кр.'}</span></div><div class="ms">${m.map(w=>`<i class="${w?'w':''}"></i>`).join('')}</div>`+
      R.cars.filter(c=>c.me).map(c=>{if(c.out)return`<div class="dr">${esc(nm(c.did).slice(0,3).toUpperCase())} · сход</div>`;const ty=TYRES[c.tyre],w=wearRate(c,R.wet[cur]),l30=Math.max(0,Math.floor((c.health-30)/w)),o=c.opt;
        const pit=c.pitReq?'в боксы':o&&o.stay&&o.stay.delta<.05?(o.stay.plan.length>1?'пит ~'+o.stay.plan[0][1]+' кр.':'до финиша'):o?'пит сейчас':'';
        return`<div class="dr"><b>${esc(nm(c.did).slice(0,3).toUpperCase())}</b><span class="tyre" style="border-color:${ty.col};width:15px;height:15px;border-width:2px;font-size:8px">${ty.l}</span>${Math.round(c.health)}%<span class="muted">${l30>=R.N-R.lapDone?'хватит':'→30%: '+l30+'кр'}</span><span style="color:var(--accent)">${pit}</span></div>`}).join('')}
  $('#feed').innerHTML=R.feed.slice(0,7).map(f=>`<div style="${f.mine?'border-color:var(--team)':''}"><span class="muted mono" style="font-size:11px">КР ${f.l}</span> ${esc(f.t)}</div>`).join('');
}

/* --- итоги --- */
function vResult(){
  const L=S.lastRace,rows=L.rows;
  const p=[rows[1],rows[0],rows[2]];
  return`<div class="racehead wrap"><div class="grow"><div class="eyebrow">Итоги гонки</div><h2>${L.track}</h2></div></div>
  <div class="scroll wrap">
   <div class="podium">${p.map((r,i)=>r?`<div class="p${[2,1,3][i]}"><b>${[2,1,3][i]}</b><span class="ell" style="font-weight:700">${esc(nm(r.did))}</span><span class="chip" style="background:${team(r.tid).color};margin:0 auto;width:28px;height:4px"></span><span class="muted ell">${esc(team(r.tid).short)}</span></div>`:'<div></div>').join('')}</div>
   <div class="card" style="padding:8px 10px"><div class="tblwrap"><table><thead><tr><th>#</th><th>Пилот</th><th class="num">Старт</th><th class="num">Время</th><th class="num">Очки</th></tr></thead><tbody>
   ${rows.map(r=>`<tr${r.me?' class="me"':''}><td class="pos">${r.out?'—':r.pos}</td><td><span class="chip" style="background:${team(r.tid).color}"></span> ${esc(drv(r.did).name)}${r.pen?' <span class="pill bad">+10 с</span>':''}</td><td class="num muted">${r.grid}</td><td class="num">${r.out?'сход':r.pos===1?fsec(r.time):r.lapsDown>0?`+${r.lapsDown} кр.`:fgap(r.gap)}</td><td class="num">${r.pts||''}</td></tr>`).join('')}
   </tbody></table></div></div>
   <div class="card"><div class="row between"><h3>Финансы этапа</h3><span class="money" style="color:${L.net>=0?'var(--good)':'var(--bad)'}">${L.net>=0?'+':''}${fm(L.net,2)}</span></div>
    ${L.inc.map(x=>`<div class="row between"><span>${esc(x[0])}</span><span class="mono" style="color:var(--good)">+${x[1].toFixed(2).replace('.',',')}</span></div>`).join('')}
    ${L.exp.map(x=>`<div class="row between"><span>${esc(x[0])}</span><span class="mono" style="color:var(--bad)">−${x[1].toFixed(2).replace('.',',')}</span></div>`).join('')}
   </div>
   <button class="btn primary block" data-a="hub">В штаб</button>
  </div>`;
}
function vSeason(){
  const s=UI.season;
  if(s.gameover)return`<div class="title wrap"><div class="stripes"></div><div class="eyebrow">Решение совета директоров</div><h1>${S.budget<-20?'Команда закрыта':'Вы уволены'}</h1><p>${esc(s.verdict.t)}</p><p class="muted">Чемпион: ${esc(s.champ)}. Кубок конструкторов: ${esc(s.cteam)}.</p><button class="btn primary block" data-a="restart">Новая карьера</button><div class="stripes"></div></div>`;
  return`<div class="scroll wrap">
   <div><div class="eyebrow">Сезон ${year()-1} завершён</div><h1>${s.pos}-е место</h1></div>
   <div class="card"><h3>Совет директоров</h3><p style="color:${s.verdict.ok?'var(--good)':s.verdict.ok===false?'var(--bad)':'var(--accent)'}">${esc(s.verdict.t)}</p></div>
   <div class="kv"><div><span class="eyebrow">Призовые FOM на ${year()}</span><b style="color:var(--good)">${fm(fomPrize(s.pos),1)}</b><span class="muted" style="font-size:12px">частями по ходу сезона${s.prize?` · бонус за место +${s.prize}`:''}</span></div><div><span class="eyebrow">Новая цель</span><b>${S.goal}-е</b></div></div>
   <div class="card"><p>Чемпион мира: <b>${esc(s.champ)}</b><br>Кубок конструкторов: <b>${esc(s.cteam)}</b></p>
   <p class="muted" style="font-size:13px">Контракты пилотов уменьшились на год — проверьте вкладку «Команда».</p></div>
   ${s.newCar?`<div class="card"><h3>Новый болид ${year()}</h3>${s.newCar.map(([n,o,nw])=>`<div class="row between"><span>${n}</span><span class="mono">${o.toFixed(0)} → <b style="color:${nw>=o?'var(--good)':'var(--bad)'}">${nw.toFixed(0)}</b></span></div>`).join('')}<p class="muted" style="font-size:12px">Итог вложений в разработку прошлого сезона.</p></div>`:''}
   <button class="btn primary block" data-a="hub">Начать сезон ${year()}</button>
  </div>`;
}

