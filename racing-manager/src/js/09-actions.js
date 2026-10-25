/* ---------- действия ---------- */
let toastT;
function toast(t){let el=$('.toast');if(el)el.remove();el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);clearTimeout(toastT);toastT=setTimeout(()=>el.remove(),2200)}
const keepScroll=fn=>{const sc=$('#sc');const y=sc?sc.scrollTop:0;fn();const s2=$('#sc');if(s2)s2.scrollTop=y};

document.addEventListener('change',e=>{
  if(e.target.id==='importfile'&&e.target.files&&e.target.files[0]){const fr=new FileReader();fr.onload=()=>importSave(String(fr.result));fr.readAsText(e.target.files[0]);e.target.value=''}
});
document.addEventListener('input',e=>{
  if(e.target.id==='tshort')UI.ownShort=e.target.value;
  if(e.target.id==='tname')UI.teamName=e.target.value;
  if(e.target.id==='autofit'){S.autoFit=e.target.checked;save()}
  if(e.target.id==='autoorder'){S.autoOrder=e.target.checked;save()}
  if(e.target.id==='snego-offer'&&UI.snego){const sf=me()[UI.snego.k];UI.snego.offer=+e.target.value;const pc=Math.round(staffChance(sf,UI.snego.offer,UI.snego.len)*100),v=$('#snego-v'),pp=$('#snego-p');if(v)v.textContent=fm(UI.snego.offer,2);if(pp){pp.textContent=`согласие ~${pc}%`;pp.className='pill '+(pc>=70?'good':pc>=40?'acc':'bad')}}
  if(e.target.id==='pre-offer'&&UI.pre){const d=drv(UI.pre.id);UI.pre.offer=+e.target.value;const v=$('#pre-v'),pp=$('#pre-p'),pc=Math.round(preChance(d,UI.pre.offer,UI.pre.len)*100);if(v)v.textContent=fm(UI.pre.offer,2);if(pp){pp.textContent=`согласие ~${pc}%`;pp.className='pill '+(pc>=60?'good':pc>=35?'acc':'bad')}}
  if(e.target.id==='nego-offer'&&UI.nego){const d=drv(UI.nego.id);UI.nego.offer=+e.target.value;const v=$('#nego-v'),pp=$('#nego-p'),pc=Math.round(acceptChance(d,UI.nego.offer,UI.nego.len)*100);if(v)v.textContent=fm(UI.nego.offer,2);if(pp){pp.textContent=`согласие ~${pc}%`;pp.className='pill '+(pc>=70?'good':pc>=40?'acc':'bad')}}
  const k=e.target.dataset&&e.target.dataset.k;if(k&&W&&W.setups[UI.pd]){W.setups[UI.pd][k]=+e.target.value;const o=$('#sv-'+k);if(o)o.textContent=e.target.value}
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a,v=b.dataset.v||'';
  const armed=UI.arm;UI.arm=null;
  switch(a){
   case'continue':{S=load();if(!S){toast(UI.loadNote||'Сохранение не найдено');render();return}ensureEcon();UI.screen='hub';UI.tab='hq';
     // незавершённый уик-энд продолжается с того же места (погода, квалификация и зерно гонки сохранены)
     if(S.wk&&S.wk.ti===S.round){W=S.wk;UI.pd=me().drivers[0];UI.screen=['media','setup','quali','qres','qstage','test'].includes(W.scr)?W.scr:W.grid?'qres':'hub';if(W.scr==='race'&&W.grid)UI.screen='qres';if(UI.screen==='hub')W=null}
     if(UI.loadNote){toast(UI.loadNote);save()}render();break}
   case'new':UI.screen='new';render();break;
   case'home':UI.screen='title';render();break;
   case'pick':UI.pickTeam=+v;keepScroll(render);break;
   case'year0':UI.year0=+v;keepScroll(render);break;
   case'real':UI.real=v==='1';keepScroll(render);break;
   case'ownmode':UI.own=v==='1';keepScroll(render);break;
   case'ocolor':UI.ownColor=v;keepScroll(render);break;
   case'oeng':UI.ownEng=v;keepScroll(render);break;
   case'oinv':UI.ownInv=+v;keepScroll(render);break;
   case'odrv':{const i=+v,sel=UI.ownDrv||[];UI.ownDrv=sel.includes(i)?sel.filter(x=>x!==i):[...sel,i].slice(-2);keepScroll(render);break}
   case'ocar':{const[k,dv]=v.split('|'),oc=ownCar(),left=OWN_PTS-oc.aero-oc.chassis-oc.rel;if(+dv>0&&(left<=0||oc[k]>=OWN_MAX))return;oc[k]=clamp(oc[k]+(+dv),0,OWN_MAX);keepScroll(render);break}
   case'ostaff':{const[k,i]=v.split('|');ownStaff()[k]=+i;keepScroll(render);break}
   case'create':if(hasSave()&&armed!=='create'){UI.arm='create';toast('Текущая карьера будет заменена новой. Нажмите ещё раз, чтобы продолжить');keepScroll(render);return}
     newGame(UI.pickTeam,UI.teamName);UI.screen='hub';UI.tab='hq';render();break;
   case'restart':wipe();S=null;UI.screen='new';render();break;
   case'tab':UI.tab=v;render();$('#sc').scrollTop=0;break;
   case'stand':UI.stand=v;keepScroll(render);break;
   case'totest':UI.screen='test';render();break;
   case'tprog':UI.tprog=v;keepScroll(render);break;
   case'tdrv':UI.tdrv=v;keepScroll(render);break;
   case'tday':runTestDay(UI.tprog,UI.tdrv);save();toast('Тестовый день завершён');keepScroll(render);break;
   case'hub':UI.screen='hub';UI.tab='hq';render();break;
   case'weekend':startWeekend();break;
   case'prac':practiceRun(v);keepScroll(render);break;
   case'pracall':me().drivers.forEach(id=>practiceRun(id));keepScroll(render);break;
   case'pdrv':UI.pd=v;keepScroll(render);break;
   case'copyset':{const o=me().drivers.find(x=>x!==v);if(o){W.setups[o]={...W.setups[v]};toast(`Настройки скопированы на ${nm(o)}`)}keepScroll(render);break}
   case'nextstep':nextStep();break;
   case'hype':W.hype=v==='1';keepScroll(render);break;
   case'qnext':W.qstage++;UI.screen='quali';render();break;
   case'settings':UI.back=UI.screen;UI.screen='settings';render();break;
   case'back':UI.screen=UI.back||'title';render();break;
   case'set':{const[k,val]=v.split('|');SET[k]=typeof DEF_SET[k]==='number'?+val:val;saveSet();if(k==='music'&&SET.music&&!AU.run)auStart(false);keepScroll(render);break}
   case'replayintro':showIntro();break;
   case'reset':{if(armed!=='reset'){UI.arm='reset';keepScroll(render);return}wipe();S=null;UI.screen='title';render();break}
   case'cam':UI.cam=v;updateRaceUi();break;
   case'follow':UI.follow=v;updateRaceUi();break;
   case'zoom':zoomBtn(v);updateRaceUi();break;
   case'tower':UI.towerMin=!UI.towerMin;updateRaceUi();break;
   case'tgap':UI.towerInt=!UI.towerInt;updateRaceUi();break;
   case'pitopen':{const c=R.cars.find(x=>x.did===v);if(!c||c.out)return;if(c.pitReq){c.pitReq=null}else{UI.pitOpen=UI.pitOpen||{};UI.pitOpen[v]=!UI.pitOpen[v]}updateRaceUi();break}
   case'autopit':{const c=R.cars.find(x=>x.did===v);if(c){c.auto=!c.auto;toast(c.auto?`Пит-стопы ${nm(v)} решают инженеры`:`Пит-стопы ${nm(v)} — вручную`)}updateRaceUi();break}
   case'qrisk':{const[id,r]=v.split('|');W.risk[id]=r==='1';render();break}
   case'runq':runQuali();break;
   case'stire':{const[id,t]=v.split('|');W.start[id]=t;render();break}
   case'race':startRace();break;
   case'export':exportSave(v==='raw');break;
   case'import':{const f=$('#importfile');if(f)f.click();break}
   case'spd':{const n=+v;if(n===0)R.paused=!R.paused;else{R.paused=false;R.speed=n}updateRaceUi();break}
   case'mode':{const[id,m]=v.split('|');const c=R.cars.find(x=>x.did===id);if(c&&!c.out){c.mode=m;updateRaceUi()}break}
   case'pit':{const[id,t]=v.split('|');const c=R.cars.find(x=>x.did===id);if(c&&!c.out){c.pitReq=c.pitReq===t?null:t;updateRaceUi()}break}
   case'endseason':endSeason();break;
   case'next':{const[k,m]=v.split('|'),c=+m,ff=Math.min(S.devFund,c),fb=+(c-ff).toFixed(2);if(S.budget<fb||fb>capLeft())return;S.devCount=(S.devCount||0)+1;S.devFund=+(S.devFund-ff).toFixed(2);money(-fb,'dev','Болид следующего года');S.spent=+(S.spent+fb).toFixed(2);me().next[k]+=c*devEff(me(),k);save();toast(`Вложено ${c} млн в болид ${year()+1}`);keepScroll(render);break}
   case'closevote':UI.lastVote=null;keepScroll(render);break;
   case'vote':S.vote.mine=v==='1';save();keepScroll(render);break;
   case'castvote':resolveVote();save();keepScroll(render);break;
   case'upg':{const[part,k]=v.split('|');const u=UPG.find(x=>x.k===k),c=upgCost(part,u);{const why=upgBlock(part,c);if(why){toast('Нельзя: '+why);return}}S.spent=+(S.spent+c).toFixed(2);S.devCount=(S.devCount||0)+1;
     const g=+(u.g*(.7+me().td.rating/200)*partBoost(me(),part)*rnd(.8,1.2)).toFixed(1);
     money(-c,'dev','Доработка: '+PARTS.find(x=>x[0]===part)[1]);S.projects.push({part,gain:g,days:u.d});save();toast(`Проект запущен: готово ${etaText(u.d)}`);keepScroll(render);break}
   case'fire':{if(armed!=='fire'+v){UI.arm='fire'+v;keepScroll(render);return}
     const d=drv(v),fee=+(d.salary*.5).toFixed(2);money(-fee,'transfer','Расторжение контракта: '+d.name);d.team=null;d.contract=0;me().drivers=me().drivers.filter(x=>x!==v);
     news(`${d.name} покидает команду.`);save();toast(`Пилот уволен, компенсация ${fee.toFixed(1).replace('.',',')} млн`);keepScroll(render);break}
   case'facup':{const l=S.fac[v];if(l>=5||S.facBuild[v]||S.budget<FAC_COST[l])return;money(-FAC_COST[l],'build','Стройка: '+FACS.find(f=>f[0]===v)[1]);S.facBuild[v]={days:FAC_DAYS[l]};save();toast(`Стройка начата: готово ${etaText(FAC_DAYS[l])}`);keepScroll(render);break}
   case'day':{const n=v==='wk'?Math.max(0,weekendDay()-S.day):+v;if(S.day+n>weekendDay())return;advanceDays(n);save();keepScroll(render);break}
   case'fit':{const[id,k]=v.split('|');const pp=partPen(id,k);if(pp&&S.stock[k]>0&&armed!=='fit'+v){UI.arm='fit'+v;toast(`Узел сверх лимита: штраф ${pp} мест на старте. Нажмите ещё раз, чтобы заменить`);return}if(fitPart(id,k,true)){toast(`Установлен новый узел: ${COMPS.find(c=>c[0]===k)[1]} — ${nm(id)}`);save()}keepScroll(render);break}
   case'spec':{const t=me();if(specBlock(t,v))return;const c=specCost(t,v);money(-c,'dev','Новая версия: '+COMPS.find(x=>x[0]===v)[1]);S.spent=+((S.spent||0)+c).toFixed(2);S.projects.push({comp:v,days:specDays(t,v)});save();toast(`Разработка: ${COMPS.find(x=>x[0]===v)[1]}, спец. ${teamSpec(t,v)+1} — готово ${etaText(specDays(t,v))}`);keepScroll(render);break}
   case'jump':{const el=document.getElementById(v);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});break}
   case'goto':{const[tb,sec]=v.split('|');UI.tab=tb;UI.screen='hub';render();const el=sec&&document.getElementById(sec);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});else{const sc=$('#sc');if(sc)sc.scrollTop=0}break}
   case'pq':{const[k,dv]=v.split('|');UI.pq=UI.pq||{};UI.pq[k]=clamp(pqty(k)+(+dv),1,6);keepScroll(render);break}
   case'prod':{const c=COMPS.find(x=>x[0]===v),n=pqty(v),pc=+(prodCost(v)*n).toFixed(2);if(S.budget<pc)return;money(-pc,'production',c[1]+' × '+n);for(let i=0;i<n;i++)S.prod.push({k:v,days:prodDays(v),sp:teamSpec(me(),v)});save();toast(`${c[1]} × ${n}: готово ${etaText(prodDays(v))}`);keepScroll(render);break}
   case'snego':{const sf=me()[v];UI.snego={k:v,len:2,offer:staffAsk(sf)};keepScroll(render);break}
   case'snlen':UI.snego.len=+v;keepScroll(render);break;
   case'sncancel':UI.snego=null;keepScroll(render);break;
   case'snsend':{const N=UI.snego,sf=me()[N.k];if(!sf||(sf.negoBlock&&sf.negoBlock>negoKey()))return;
     if(Math.random()<staffChance(sf,N.offer,N.len)){sf.salary=+N.offer.toFixed(2);sf.contract=1+N.len;UI.snego=null;news(`${sf.name} продлевает контракт до ${year()+sf.contract-1}.`);toast('Контракт продлён')}
     else{sf.negoBlock=negoKey()+2;toast(`${sf.name} отказался. Вернуться к разговору можно через 2 этапа`)}save();keepScroll(render);break}
   case'nego':{const d=drv(v);UI.nego={id:v,len:2,offer:asking(d)};keepScroll(render);break}
   case'nlen':UI.nego.len=+v;keepScroll(render);break;
   case'ncancel':UI.nego=null;keepScroll(render);break;
   case'nsend':{const d=drv(v),N=UI.nego;if(!N||(d.negoBlock&&d.negoBlock>negoKey()))return;if(d.contract<=1&&seatsNext()<=0){toast(`Оба места на ${year()+1} уже заняты предварительными контрактами`);return}
     if(Math.random()<acceptChance(d,N.offer,N.len)){d.salary=+N.offer.toFixed(2);d.contract=1+N.len;UI.nego=null;news(`${d.name} продлевает контракт до ${endYear(d)} (${fm(d.salary,2)}/сезон).`);toast(`${nm(v)} согласен: контракт до ${endYear(d)}`)}
     else{d.negoBlock=negoKey()+2;toast(`${nm(v)} отказался. Вернуться к разговору можно через 2 этапа`)}
     save();keepScroll(render);break}
   case'talk':UI.talk={id:v,args:[]};keepScroll(render);break;
   case'targ':{const T=UI.talk;if(!T)return;T.args=T.args.includes(v)?T.args.filter(x=>x!==v):[...T.args,v];keepScroll(render);break}
   case'tcancel':UI.talk=null;keepScroll(render);break;
   case'persuade':{const d=drv(v);if(d.persuaded||!d.retiring)return;if(d.contract<=1&&seatsNext()<=0){toast(`Оба места на ${year()+1} уже заняты`);return}const args=UI.talk&&UI.talk.id===v?UI.talk.args:[];d.persuaded=true;UI.talk=null;
     if(Math.random()<persuadeChance(d,args)){d.retiring=false;if(args.includes('money'))d.salary=+(d.salary*1.3).toFixed(2);d.contract=args.includes('short')?2:3;if(args.includes('lead'))d.lead=true;
       news(`${d.name} передумал и продолжает карьеру: контракт до ${endYear(d)}.`);toast(`${nm(v)} остаётся!`)}
     else{news(`${d.name} не передумал и завершит карьеру в конце сезона.`);toast(`${nm(v)} не передумал`)}save();keepScroll(render);break}
   case'pre':{const d=drv(v);UI.pre={id:v,len:2,offer:preAsk(d)};keepScroll(render);break}
   case'plen':UI.pre.len=+v;keepScroll(render);break;
   case'pcancel':UI.pre=null;keepScroll(render);break;
   case'psend':{const d=drv(v),P=UI.pre;if(!P||!windowOpen()||seatsNext()<=0||d.next||(d.negoBlock&&d.negoBlock>negoKey()))return;
     if(Math.random()<preChance(d,P.offer,P.len)){d.next={tid:S.pid,salary:+P.offer.toFixed(2),len:P.len};UI.pre=null;news(`${d.name} подписывает предварительный контракт: в следующем сезоне выступает за нас (${fm(d.next.salary,2)}/сезон, до ${year()+P.len}).`);toast(`${nm(v)} — наш пилот со следующего сезона`)}
     else{d.negoBlock=negoKey()+2;toast(`${nm(v)} отказался. Вернуться к разговору можно через 2 этапа`)}save();keepScroll(render);break}
   case'acadup':{const c=ACAD_COST[S.academy.level];if(S.budget<c)return;money(-c,'academy','Расширение академии');S.academy.level++;save();toast('Академия расширена');keepScroll(render);break}
   case'scoutup':{const c=SCOUT_COST[S.academy.scout];if(S.budget<c)return;money(-c,'academy','Сеть скаутов');S.academy.scout++;save();toast('Сеть скаутов расширена');keepScroll(render);break}
   case'scout':{if(S.budget<.8||S.academy.mission)return;money(-.8,'academy','Поездка скаутов');S.academy.mission={region:v,days:18};save();toast(`Скауты отправлены: ${v}, вернутся ${etaText(18)}`);keepScroll(render);break}
   case'signj':{const A=S.academy,j=A.prospects.find(x=>x.id===v);if(!j)return;const fee=+Math.max(.3,.3+((j.est[0]+j.est[1])/2-70)*.06).toFixed(1);if(S.budget<fee||A.juniors.length>=ACAD_SLOTS[A.level-1])return;
     money(-fee,'academy','Юниор в академию: '+j.name);if(j.src)LEAGUES.forEach(([k])=>S.leagues[k]=S.leagues[k].filter(x=>x.id!==j.src));delete j.src;j.team=null;A.juniors.push(j);A.prospects=A.prospects.filter(x=>x!==j);news(`${j.name} подписан в академию.`);save();toast(`${j.name} в академии`);keepScroll(render);break}
   case'release':{if(armed!=='rel'+v){UI.arm='rel'+v;keepScroll(render);return}S.academy.juniors=S.academy.juniors.filter(j=>j.id!==v);save();keepScroll(render);break}
   case'focus':{const[id,a]=v.split('|'),j=S.academy.juniors.find(x=>x.id===id);if(j){j.focus=a;save()}keepScroll(render);break}
   case'jleague':{const[id,k]=v.split('|'),j=S.academy.juniors.find(x=>x.id===id);if(j){j.league=k;save();toast(`${j.name} выступает в ${LEAGUES.find(l=>l[0]===k)[1]}`)}keepScroll(render);break}
   case'hiref2':{const d=S.leagues.f2.find(x=>x.id===v);if(!d||me().drivers.length>=2)return;const fee=+(1+ovr(d)*.02).toFixed(1);if(S.budget<fee)return;
     S.leagues.f2=S.leagues.f2.filter(x=>x!==d);const nd=mkDriver(d.name,d.age,Math.floor(d.pace),Math.floor(d.craft),Math.floor(d.tyre));ATTRS.forEach(([a])=>nd[a]=Math.floor(d[a]));nd.team=S.pid;nd.contract=2;nd.salary=+(salaryFor(nd.pace)*.7).toFixed(2);S.drivers[nd.id]=nd;me().drivers.push(nd.id);ensureParts(nd.id);
     money(-fee,'transfer','Пилот из Формулы-2: '+nd.name);news(`${nd.name} переходит из Формулы-2 в основной состав.`);save();toast(`${nd.name} в команде`);keepScroll(render);break}
   case'promote':{const A=S.academy,j=A.juniors.find(x=>x.id===v);if(!j||me().drivers.length>=2||ovr(j)<72)return;
     const d=mkDriver(j.name,j.age,Math.floor(j.pace),Math.floor(j.craft),Math.floor(j.tyre));ATTRS.forEach(([a])=>d[a]=Math.floor(j[a]));d.salary=+(salaryFor(d.pace)*.6).toFixed(2);d.contract=2;d.team=S.pid;d.pot=j.pot;S.drivers[d.id]=d;me().drivers.push(d.id);ensureParts(d.id);
     A.juniors=A.juniors.filter(x=>x!==j);news(`Дебют: выпускник академии ${d.name} становится боевым пилотом команды.`);save();toast(`${d.name} — в основном составе`);keepScroll(render);break}
   case'hire':{const d=drv(v),fee=+(d.salary*.5).toFixed(2);if(me().drivers.length>=2||S.budget<fee||S.rep<Math.max(0,Math.round((d.pace-74)*3)))return;
     money(-fee,'transfer','Подписание: '+d.name);d.team=S.pid;d.contract=2;me().drivers.push(d.id);ensureParts(d.id);news(`${d.name} подписывает контракт с командой.`);save();toast(`${d.name} в команде`);keepScroll(render);break}
   case'staff':{const[k,i]=v.split('|');const c=S.market[k][+i],cost=hireCost(k,c);if(S.budget<cost||c.refused)return;
     if(Math.random()>staffChance(c,c.salary,2)){c.refused=true;save();toast(`${c.name} отказался: ${formText(teamForm())}, репутация ${Math.round(S.rep)}`);keepScroll(render);break}
     c.contract=2;money(-cost,'staff','Найм: '+c.name);me()[k]=c;S.market[k].splice(+i,1);news(`${STAFF_ROLES.find(r=>r[0]===k)[1]}: ${c.name} (${c.rating}).`);save();toast('Сотрудник нанят');keepScroll(render);break}
   case'sign':{if(S.sponsors.length>=3)return;const o=S.offers.splice(+v,1)[0];S.sponsors.push(o);money(o.sign,'sponsor','Бонус за подписание: '+o.name);save();toast(`Контракт с «${o.name}» подписан`);keepScroll(render);break}
   case'drop':{if(armed!=='drop'+v){UI.arm='drop'+v;keepScroll(render);return}const sp=S.sponsors.splice(+v,1)[0];money(-+(sp.per*BAL.sponsorDropK).toFixed(2),'other','Неустойка: '+sp.name);save();keepScroll(render);break}
  }
});
window.addEventListener('resize',()=>{if(UI.screen!=='race')after()});

render();
if(window.claude&&claude.use)claude.use('downloads').then(d=>{UI.dlCap=d||null}).catch(e=>diag('возможность скачивания',e));
if(SET.intro)showIntro();
window.__pitwall={get S(){return S},get R(){return R},get G(){return G}};
// внутренние функции для автотестов — только при открытии с ?debug
// бот-игрок для прогонов экономики (только в режиме отладки): spend — развивается разумно, save — только спонсоры
function botPolicy(pol){
  if(!S)return;const t=me();
  while(S.sponsors.length<3&&S.offers.length){const i=S.offers.reduce((bi,o,j,a)=>o.per>a[bi].per?j:bi,0);const o=S.offers.splice(i,1)[0];S.sponsors.push(o);money(o.sign,'sponsor','Бонус за подписание: '+o.name)}
  // составы: продлить пилотов, закрыть свободное место лучшим доступным
  t.drivers.forEach(id=>{const d=drv(id);if(d.contract<=1&&!d.retiring&&S.round>NR()*.7){d.salary=asking(d);d.contract=3}});
  STAFF_ROLES.forEach(([k])=>{const sf=t[k];if(sf&&!sf.acting&&sf.contract<=1&&S.round>NR()*.7){sf.salary=staffAsk(sf);sf.contract=3}});
  STAFF_ROLES.forEach(([k])=>{if(!t[k]||!t[k].acting||!S.market||!S.market[k])return;const c=[...S.market[k]].sort((a,b)=>b.rating-a.rating).find(c=>hireCost(k,c)<S.budget-10);if(c){money(-hireCost(k,c),'staff','Найм: '+c.name);c.contract=2;t[k]=c;S.market[k]=S.market[k].filter(x=>x!==c)}});
  while(t.drivers.length<2){const fa=Object.values(S.drivers).filter(d=>!d.team&&!d.retired).sort((a,b)=>b.pace-a.pace)[0];if(!fa)break;fa.team=S.pid;fa.contract=2;t.drivers.push(fa.id);ensureParts(fa.id)}
  if(pol==='save')return;
  // зеркало ИИ: та же сумма и та же раскладка, что у соперников, но из настоящего бюджета игрока
  if(pol==='mirror'){const m=Math.min(aiDevBudget(t)/NR(),Math.max(0,S.budget-mandPerRace()*2),capLeft()),nx=S.round>NR()*.4?.7:.3;if(m<=0)return;
    const ff=Math.min(S.devFund,m*nx),fb=m-ff;S.devFund=+(S.devFund-ff).toFixed(2);money(-fb,'dev','Разработка (зеркало ИИ)');S.spent=+(S.spent+fb).toFixed(2);
    PARTS.forEach(([k])=>{if(k==='engine'&&t.engineSup)return;t.next[k]+=m*nx/4*devEff(t,k)});
    const part=pick(['aero','engine','chassis','aero','engine','chassis','rel'].filter(k=>!(k==='engine'&&(t.engineSup||S.rules.freeze))));t.car[part]=clamp(+(t.car[part]+m*(1-nx)*BAL.aiPtsPerM*(.7+t.td.rating/200)*facMul(t,part)/(1+Math.max(0,t.car[part]-70)/40)).toFixed(1),0,100);return}
  const reserve=pol==='risky'?2:10;
  // одна характеристика: все проекты только в аэродинамику
  if(pol==='aero'){if(S.projects.length<maxProjects()&&!S.projects.some(p=>p.part==='aero')){const u=S.budget>30?UPG[1]:UPG[0],c=upgCost('aero',u);if(S.budget-c>reserve&&c<=capLeft()){money(-c,'dev','Доработка');S.spent=+(S.spent+c).toFixed(2);S.projects.push({part:'aero',gain:+(u.g*(.7+t.td.rating/200)*partBoost(t,'aero')).toFixed(1),days:u.d})}}
    if(S.round>NR()*.55&&S.budget>reserve+6){const c=5,ff=Math.min(S.devFund,c),fb=c-ff;if(fb<=capLeft()){S.devFund=+(S.devFund-ff).toFixed(2);money(-fb,'dev','Болид следующего года');S.spent=+(S.spent+fb).toFixed(2);t.next.aero+=c*devEff(t,'aero')}}return}
  // инфраструктура: сначала стройка, разработка только на остаток
  if(pol==='infra'){const k=FACS.map(f=>f[0]).sort((a,b)=>S.fac[a]-S.fac[b]).find(k=>S.fac[k]<5&&!S.facBuild[k]);if(k&&S.budget-FAC_COST[S.fac[k]]>reserve){money(-FAC_COST[S.fac[k]],'build','Стройка');S.facBuild[k]={days:FAC_DAYS[S.fac[k]]};return}}
  if(S.projects.length<maxProjects()){const k=[...PARTS].map(([k])=>k).filter(k=>!S.projects.some(p=>p.part===k)&&!(k==='engine'&&(S.rules.freeze||t.engineSup))).sort((a,b)=>t.car[a]-t.car[b])[0];
    if(k){const u=S.budget>30?UPG[1]:UPG[0],c=upgCost(k,u);if(S.budget-c>reserve&&c<=capLeft()){money(-c,'dev','Доработка');S.spent=+(S.spent+c).toFixed(2);S.projects.push({part:k,gain:+(u.g*(.7+t.td.rating/200)*partBoost(t,k)).toFixed(1),days:u.d})}}}
  if(S.round>NR()*.55&&S.budget>reserve+6){const k=PARTS.map(([k])=>k).filter(k=>!(t.engineSup&&k==='engine')).sort((a,b)=>t.next[a]-t.next[b])[0],c=5,ff=Math.min(S.devFund,c),fb=c-ff;
    if(fb<=capLeft()){S.devFund=+(S.devFund-ff).toFixed(2);money(-fb,'dev','Болид следующего года');S.spent=+(S.spent+fb).toFixed(2);t.next[k]+=c*devEff(t,k)}}
  if(S.budget>35){const k=FACS.map(f=>f[0]).find(k=>S.fac[k]<5&&!S.facBuild[k]);if(k&&S.budget-FAC_COST[S.fac[k]]>reserve){money(-FAC_COST[S.fac[k]],'build','Стройка');S.facBuild[k]={days:FAC_DAYS[S.fac[k]]}}}
}
// быстрая карьера без отрисовки (только отладка): те же функции игры, интерфейс и сохранение отключены на время прогона
function batchCareer(o){
  const r0=render,s0=save;render=()=>{};save=()=>true;const set0={...SET};Object.assign(SET,{mode:'sim',len:1,intro:0,music:0});
  const out={seasons:[],stopped:null};
  try{
    UI.own=o.team==='own';newGame(o.team==='own'?0:+o.team,'');
    for(let si=0;si<o.seasons;si++){
      const sea={dnf:0,starts:0,pos:[],stops:{},tyres:{},grid:[]};
      for(let r=0;r<NR();r++){
        botPolicy(o.policy);
        startWeekend();me().drivers.forEach(id=>{const st={};Object.keys(W.ideal).forEach(k=>st[k]=clamp(W.ideal[k]+ri(-1,1),1,9));W.setups[id]=st});while(stepName()!=='quali')nextStep();runQuali();
        if(W.seed==null)W.seed=Math.floor(Math.random()*2147483647);
        const rng=mulberry32(W.seed),mr=Math.random;Math.random=rng;try{startRace0()}finally{Math.random=mr}R.rng=rng;
        while(R.lapDone<R.N)withRng(()=>simLap(R.lapDone+1));
        R.T=Math.max(...R.cars.filter(c=>!c.out).map(c=>c.cum[R.N]||0))+1;R.done=true;
        sea.why=sea.why||{};R.cars.filter(c=>c.out).forEach(c=>{const k=(c.me?'me:':'ai:')+(c.outWhy||'?');sea.why[k]=(sea.why[k]||0)+1});R.cars.filter(c=>c.me).forEach(c=>{sea.starts++;if(c.out)sea.dnf++;sea.stops[c.stops]=(sea.stops[c.stops]||0)+1;c.used.forEach(t=>sea.tyres[t]=(sea.tyres[t]||0)+1)});
        sea.allDnf=(sea.allDnf||0)+R.cars.filter(c=>c.out).length;sea.allStarts=(sea.allStarts||0)+R.cars.length;
        if(o.diag){const tr=R.track;out.diag=out.diag||[];R.cars.forEach(c=>{const t=team(c.tid),d=drv(c.did);out.diag.push({me:c.me,tid:c.tid,perf:+((100-perf(t,tr))*.06).toFixed(3),pace:+((100-d.pace)*.035).toFixed(3),sq:+(-(c.sq-60)*.012).toFixed(3),spec:+(-specBonus(S.parts[c.did])).toFixed(3),stops:c.stops,pen:c.pen,time:c.out?null:+(c.cum[R.N]/R.N).toFixed(3),out:c.out})})}
        finishRace();W=null;R=null;
        S.lastRace.rows.filter(x=>x.me).forEach(x=>sea.pos.push(x.out?99:x.pos));
      }
      const st=teamStandings(),cars=S.teams.map(t=>carOverall(t)).sort((a,b)=>b-a);
      sea.cpos=st.findIndex(t=>t.id===S.pid)+1;sea.car=+carOverall(me()).toFixed(1);sea.carBest=+cars[0].toFixed(1);sea.carMed=+cars[Math.floor(cars.length/2)].toFixed(1);
      sea.budgetEnd=S.budget;const F=finState();sea.cats={...F.cats};sea.fac=Object.values(S.fac).reduce((a,v)=>a+v,0);
      endSeason();sea.afterSeason=S.budget;sea.warnings=S.warnings;out.seasons.push(sea);
      if(UI.season&&UI.season.gameover){out.stopped=S.budget<-20?'bankrupt':'fired';break}
    }
  }catch(e){out.error=String(e&&e.stack||e)}
  finally{render=r0;save=s0;Object.assign(SET,set0);}
  return out;
}
if(/[?&]debug\b/.test(location.search))window.__dbg={batchCareer,botPolicy,NR,weekendDay,save,lapModel,simLap,perf,tyreWear,wearRate,aiMode,finishRace,raceOptions,bestPlan,genWeather,liveOrder,mySq,trackWear,AU,showIntro,advanceDays,specBonus,carProgress,tyreNow,aiDevBudget,retireCheck,retireOdds,endSeason,preChance,seatsNext,WINDOW_DAY,persuadeChance,get R(){return R},get W(){return W}};
})();
