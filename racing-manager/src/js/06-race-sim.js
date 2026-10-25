/* ---------- модель круга ---------- */
function lapModel(c,lap,wet){
  const tr=R.track,t=team(c.tid),d=drv(c.did);
  let lt=tr.base+(100-perf(t,tr))*.06+(100-d.pace)*.035-lap*.03*R.ls;
  if(wet){lt+=7+(100-(d.wet||d.craft))*.03+(c.tyre==='I'?0:8.5)}else lt+=TYRES[c.tyre].off;
  const h=c.health;lt+=(100-h)*.018+(h<35?(35-h)*.09:0);
  lt+=c.mode==='push'?-.35:c.mode==='save'?.45:0;
  lt-=(c.sq-60)*.012;
  lt+=compPen(S.parts[c.did])-specBonus(S.parts[c.did]);
  lt+=gauss()*(.15+(100-(d.cons||d.craft))/100*.35)*(lap===1?2.2:1);
  if(lap===1)lt-=((d.start||80)-80)*.02;
  return lt;
}
function wearRate(c,wet){return tyreWear(c.tyre,wet,drv(c.did).tyre,c.mode,R.ls,R.tw)}

/* ---------- стратегия: оценка времени до финиша ---------- */
function stintTable(c,n,d,wet,ls,h0){
  const T=TYRES[c],off=wet?(c==='I'?0:8.5):T.off,w=tyreWear(c,wet,d.tyre,'norm',ls,(R&&UI.screen==='race'?R.tw:W.tw));
  const pre=[0];let h=h0;
  for(let i=0;i<n;i++){pre.push(pre[i]+off+(100-h)*.018+(h<35?(35-h)*.09:0)+(h<10?2.5:0));h=Math.max(0,h-w)}
  return pre;
}
function bestPlan(start,h0,n,maxStops,usedDry,ruleOn,d,wet,ls,pit,minStops=0){
  if(n<=0)return{cost:0,plan:[]};
  const comps=['S','M','H','I'],tb={};comps.forEach(k=>tb[k]=stintTable(k,n,d,wet,ls,100));
  const t0=h0<100?stintTable(start,n,d,wet,ls,h0):tb[start];
  const ok=arr=>!ruleOn||new Set([...usedDry,...arr].filter(x=>x!=='I')).size>=2;
  let best={cost:Infinity,plan:[]};const st=Math.max(1,Math.floor(n/28));
  if(ok([start])&&minStops<1)best={cost:t0[n],plan:[[start,n]]};
  if(maxStops>=1&&minStops<2)for(let k=1;k<n;k+=st)for(const c2 of comps){if(!ok([start,c2]))continue;const v=t0[k]+pit+tb[c2][n-k];if(v<best.cost)best={cost:v,plan:[[start,k],[c2,n-k]]}}
  if(maxStops>=2)for(let k1=1;k1<n-1;k1+=st)for(let k2=k1+1;k2<n;k2+=st)for(const c2 of comps)for(const c3 of comps){if(!ok([start,c2,c3]))continue;
    const v=t0[k1]+pit+tb[c2][k2-k1]+pit+tb[c3][n-k2];if(v<best.cost)best={cost:v,plan:[[start,k1],[c2,k2-k1],[c3,n-k2]]}}
  return best;
}
const planText=pl=>pl.map(([c,l])=>`${TYRES[c].n.toLowerCase()} ${l}`).join(' → ');
const fdelta=v=>v<.05?'лучшие':'+'+(v<10?v.toFixed(1):Math.round(v)).toString().replace('.',',')+' с';
// старт: каждый состав с его лучшей стратегией на всю дистанцию
function startOptions(id){
  const d=drv(id),wet=W.weather[0],res={};
  Object.keys(TYRES).forEach(k=>res[k]=bestPlan(k,100,W.laps,2,[],!wet,d,wet,W.ls,W.tr.pit+2.6+S.rules.pitAdd,!wet&&S.rules.twoStop?2:0));
  const min=Math.min(...Object.values(res).map(r=>r.cost));Object.values(res).forEach(r=>r.delta=r.cost-min);
  return res;
}
// гонка: заехать сейчас на каждый состав или остаться на трассе
function raceOptions(c){
  const d=drv(c.did),k=Math.min(R.N-1,R.lapDone),wet=R.wet[k],rem=Math.max(0,R.N-R.lapDone-1),ruleOn=!R.anyWet&&!wet,used=c.used.filter(x=>x!=='I'),pit=(R.sc>0?R.track.pit*.45:R.track.pit)+2.6+S.rules.pitAdd,ms=ruleOn&&S.rules.twoStop?Math.max(0,2-c.stops):0;
  const res={};
  Object.keys(TYRES).forEach(t=>{const b=bestPlan(t,100,rem,Math.max(1,ms-1),used,ruleOn,d,wet,R.ls,pit,Math.max(0,ms-1));res[t]={cost:pit+b.cost,plan:b.plan}});
  const stay=bestPlan(c.tyre,c.health,rem,2,used,ruleOn,d,wet,R.ls,pit,ms);res.stay={cost:stay.cost,plan:stay.plan};
  const min=Math.min(...Object.values(res).map(r=>r.cost));Object.values(res).forEach(r=>r.delta=r.cost-min);
  return res;
}

/* ---------- уик-энд ---------- */
function genWeather(tr,laps){
  let wet=Math.random()<tr.rain*.55;const arr=[];let seg=0;const sc=tr.laps/laps,minSeg=Math.ceil(4/sc);
  for(let i=0;i<laps;i++){arr.push(wet);seg++;if(seg>=minSeg&&Math.random()<(wet?.16:tr.rain*.2)*sc){wet=!wet;seg=0}}
  return arr;
}
const SESS={media:['Четверг','Медиа-день'],fp1:['Пятница','Практика 1'],fp2:['Пятница','Практика 2'],fp3:['Суббота','Практика 3'],fp:['Пятница','Свободная практика'],quali:['Суббота','Квалификация'],race:['Воскресенье','Гонка']};
const isFP=st=>st==='fp'||st==='fp1'||st==='fp2'||st==='fp3';
function startWeekend(){
  ensureEcon();autoOrder();
  if(S.day<weekendDay())advanceDays(weekendDay()-S.day);
  // одно правило для всех: узел меняют, если его ресурса не хватит на гонку с запасом (богатые команды осторожнее); автозамена игрока не берёт штраф, пока узел ещё доживёт до финиша
  S.teams.forEach(t=>t.drivers.forEach(id=>{const P=ensureParts(id);COMPS.forEach(([k])=>{const w=nextWear(id,k);if(t.id!==S.pid){if(P[k].h<w*(1+t.budget/120))fitPart(id,k,false)}else if(S.autoFit&&S.stock[k]>0&&(P[k].h<w*1.05||(P[k].h<w*1.3&&!partPen(id,k))))fitPart(id,k,true)})}));
  if(S.vote){if(S.vote.mine===null)S.vote.mine=false;resolveVote()}
  const tr=seasonTracks()[S.round],real=SET.mode==='real',laps=real?tr.realLaps:Math.max(8,Math.round(tr.laps*SET.len));
  W={ti:S.round,tr,laps,ls:tr.laps/laps,real,weather:genWeather(tr,laps),risk:{},grid:null,qt:{},start:{},
     setups:{},runsBy:{},fbs:{},prac:[],aiSq:{},
     steps:real?['media','fp1','fp2','fp3','quali','race']:['fp','quali','race'],step:0,sheet:{},hype:null,
     dayWet:{fri:Math.random()<tr.rain*.6,sat:Math.random()<tr.rain*.6},seed:Math.floor(Math.random()*2147483647)};
  W.qwet=real?W.dayWet.sat:null;
  const tt=TRACK_TYRE[tr.id]||[1,35];W.abr=tt[0];W.temp=Math.round(tt[1]+rnd(-5,5));W.tw=trackWear(W.abr,W.temp,W.weather[0]);
  me().drivers.forEach(id=>{W.setups[id]={wing:5,susp:5,gear:5,brake:5};W.fbs[id]=null});
  UI.pd=me().drivers[0];
  W.ideal=idealSetup(tr,W.weather[0]);
  // настройка соперников зависит от их гоночных инженеров и техдиректора (как у игрока — от инженеров и практики)
  S.teams.forEach(t=>{W.aiSq[t.id]=clamp(78+(srat(t,'eng')-70)*.6+(t.td.rating-70)*.25+rnd(-8,8)+(SET.diff-1)*8,25,98)});
  me().drivers.forEach(id=>{W.risk[id]=false;W.start[id]=W.weather[0]?'I':'M'});
  enterStep();
}
const stepName=()=>W.steps[W.step];
function sessWet(){const st=stepName();return st==='fp'?W.weather[0]:st==='fp3'||st==='quali'?(W.real?W.dayWet.sat:W.weather[0]):W.dayWet.fri}
function enterStep(){
  const st=stepName();
  if(st==='media'){UI.screen='media'}
  else if(isFP(st)){me().drivers.forEach(id=>W.runsBy[id]=(st==='fp3'?2:3)+(srat(me(),'eng')>=85?1:0));
    // протокол сессии: соперники проезжают свои программы
    const wet=sessWet(),sh=[];
    S.teams.forEach(t=>{if(t.id===S.pid)return;t.drivers.forEach(id=>{const d=drv(id);
      sh.push({id,tid:t.id,t:W.tr.base+(wet?7:0)+(100-perf(t,W.tr))*.06+(100-d.pace)*.035-(W.aiSq[t.id]-60)*.012+TYRES.M.off+gauss()*.3+rnd(0,.9)-(st==='fp3'?.3:st==='fp2'?.15:0)})})});
    W.sheet[st]=sh;UI.screen='setup'}
  else if(st==='quali'){W.qstage=W.real?1:0;W.qin=S.teams.flatMap(t=>t.drivers);W.qout=[];W.qlast=null;UI.screen='quali'}
  render();
}
function nextStep(){W.step=Math.min(W.steps.length-1,W.step+1);enterStep()}
const mySq=id=>clamp(setupQ(W.setups[id]||{wing:5,susp:5,gear:5,brake:5},W.ideal)+(srat(me(),'eng')-70)*.15+((S.fac?S.fac.sim:2)-2)*2+(S.testBonus||0)*.75,0,100);
function practiceRun(id){
  if(!(W.runsBy[id]>0))return;W.runsBy[id]--;
  const t=me(),tr=W.tr,d=drv(id),setup=W.setups[id];
  const sq=mySq(id);
  const lap=tr.base+(sessWet()?7:0)-(stepName()==='fp3'?.3:stepName()==='fp2'?.15:0)+(100-perf(t,tr))*.06+(100-d.pace)*.035-(sq-60)*.012+TYRES.M.off+gauss()*.2;
  const fb={};
  SETUP.forEach(([k,,,,lo,hi])=>{
    const diff=setup[k]-W.ideal[k],right=Math.random()<.56+srat(me(),'eng')/400+(d.fb||d.craft)/700+(S.fac?S.fac.sim:2)*.01;
    if(Math.abs(diff)<=1&&right){fb[k]={ok:true,t:'Ощущения хорошие, менять не нужно.'}}
    else{let dir=Math.sign(diff)||pick([-1,1]);if(!right)dir=-dir;
      fb[k]={ok:false,dir:-dir,t:(dir<0?lo:hi)+(Math.abs(diff)>=4?' Очень сильно.':'')}}
  });
  W.fbs[id]=fb;W.prac.unshift({who:d.name,did:d.id,st:stepName(),lap,sq:clamp(Math.round(sq+rnd(-6,6)),0,100)});
}
function applyGridPen(g){
  const pen=S.gpen||{},out=[...g],back=[];
  // больше 15 мест — в конец решётки (в порядке квалификации); остальные штрафы — по порядку квалификации
  g.forEach(x=>{const n=pen[x.id];if(n>15){out.splice(out.indexOf(x),1);x.note=(x.note?x.note+', ':'')+'штраф: последний ряд';back.push(x)}});
  g.forEach(x=>{const n=pen[x.id];if(!n||n>15)return;const i=out.indexOf(x);out.splice(i,1);x.note=(x.note?x.note+', ':'')+'штраф −'+n;out.splice(Math.min(out.length,i+n),0,x)});
  S.gpen={};return out.concat(back);
}
function runQuali(){
  const tr=W.tr,wet=W.real?W.qwet:W.weather[0],all=[],stg=W.qstage||0;
  S.teams.forEach(t=>t.drivers.forEach(id=>{
    if(stg&&!W.qin.includes(id))return;
    const d=drv(id);const risk=t.id===S.pid?W.risk[id]:Math.random()<.3;
    const sq=t.id===S.pid?mySq(id):W.aiSq[t.id];
    let q=tr.base-1.2+(100-perf(t,tr))*.06+(100-d.pace)*.035+TYRES.S.off-(sq-60)*.012-specBonus(S.parts&&S.parts[id])+gauss()*(.12+(100-(d.cons||d.craft))/100*.25);
    if(wet)q+=7+(100-(d.wet||d.craft))*.035;
    let note='';
    if(risk){q-=.28;if(Math.random()<(wet?.2:.12)){q+=rnd(1.2,3);note='ошибка'}}
    q-=stg>1?(stg-1)*.18:0;
    all.push({id,tid:t.id,q,note});
  }));
  all.sort((a,b)=>a.q-b.q);
  if(!stg||stg===3){W.grid=applyGridPen(stg?[...all,...W.qout]:all);W.qlast=stg?{stg,list:all,cut:all.length}:null;UI.screen='qres';render();return}
  const n=all.length,cut=stg===1?n-Math.ceil((n-10)/2):10;
  W.qout=[...all.slice(cut),...W.qout];W.qin=all.slice(0,cut).map(x=>x.id);
  W.qlast={stg,list:all,cut};UI.screen='qstage';render();
}

/* ---------- гонка ---------- */
// воспроизводимый генератор случайных чисел гонки: перезагрузка страницы не даёт переиграть гонку
function mulberry32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function withRng(f){if(!R||!R.rng)return f();const mr=Math.random;Math.random=R.rng;try{return f()}finally{Math.random=mr}}
function startRace(){
  if(W.seed==null)W.seed=Math.floor(Math.random()*2147483647);
  const rng=mulberry32(W.seed),mr=Math.random;Math.random=rng;try{startRace0()}finally{Math.random=mr}
  R.rng=rng;startRace1();
}
function startRace0(){
  const tr=W.tr;
  R={track:tr,N:W.laps,ls:W.ls,tw:W.tw,temp:W.temp,abr:W.abr,T:0,speed:SET.speed,paused:false,count:6.6,wet:W.weather,sc:0,done:false,feed:[],lapDone:0,anyWet:W.weather.some(x=>x),path:trackPath(tr.seed),
     cars:W.grid.map((g,i)=>{
       const isMe=g.tid===S.pid;
       let tyre=isMe?W.start[g.id]:(W.weather[0]?'I':(i<10?pick(['S','M','M']):pick(['M','H','S'])));
       return{did:g.id,tid:g.tid,me:isMe,grid:i+1,tyre,health:100,mode:'norm',pitReq:null,stintLap:0,cum:[i*.32],out:false,used:[tyre],stops:0,pen:0,thr:rnd(22,38),last:0,best:1e9,
              sq:isMe?mySq(g.id):W.aiSq[g.tid],auto:isMe,tac:isMe?{...TAC_DEF,...((W.tac||{})[g.id]||{})}:null};
     })};
  const sr=srat(me(),'strat');R.fexact=clamp(Math.round(2+sr/20),3,7);R.frng=Math.max(1,Math.round((100-sr)/8));R.fshift=ri(-R.frng,R.frng);
  UI.follow=R.cars.find(c=>c.me).did;UI.cam=SET.cam;
}
function startRace1(){
  feed(`Прогрев шин. ${R.N} ${plural(R.N,'круг','круга','кругов')}, ${R.wet[0]?'трасса мокрая':'сухо'}.`);
  UI.screen='race';render();
  if(SET.view==='3d'&&HAS3D){try{init3D($('#v3d'))}catch(e){diag('запуск 3D-трансляции',e);G=null;$('#trk').classList.remove('mini')}}
  V2.z=1;V2.x=0;V2.y=0;V2.follow=false;bindRaceViews();
  lastTs=0;requestAnimationFrame(loop);
}
function feed(t,mine){R.feed.unshift({t,mine,l:R.lapDone});R.feed=R.feed.slice(0,40)}
const nm=id=>drv(id).name.split(' ').slice(-1)[0];

// режим пилота-соперника: атака в борьбе и на финише, бережёт шины и узлы при износе
// темп развития пилота за гонку: тренер команды × возраст (0 — не растёт)
function growF(d,t){if(!t)return 0;const c=clamp((srat(t,'coach')-40)/45,.15,1.3),a=d.age<=21?1.3:d.age<=25?1:d.age<=28?.6:d.age<=31?.3:0;return c*a}
function trainDrivers(){
  S.teams.forEach(t=>t.drivers.forEach(id=>{const d=ensureAttrs(drv(id)),f=growF(d,t);if(f<=0)return;const r=BAL.growRate*f;
    const room=d.pot-d.pace;if(room>0){const before=Math.floor(d.pace);d.pace=Math.min(d.pot,d.pace+room*r);if(t.id===S.pid&&Math.floor(d.pace)>before)news(`${d.name} прогрессирует: скорость ${Math.floor(d.pace)} — работа тренера.`)}
    GROW_ATTRS.forEach(k=>{if(d[k]==null)return;const cap=clamp(d.pot+((d.skOff||{})[k]||0),40,99),gap=cap-d[k];if(gap>0)d[k]=Math.min(cap,d[k]+gap*r*(k==='craft'||k==='cons'||k==='defend'?.8:1))});
  }));
}
function aiMode(c,gapAhead,k,wet){
  if(c.me&&!tacOn(c,'mode'))return;
  const P=S.parts[c.did],left=R.N-k+1,comp=P?Math.min(P.ice.h,P.ers.h,P.gb.h):100;
  if(comp<25||(c.health<30&&!c.pitReq&&left>3))c.mode='save';
  else if((gapAhead<1.2&&c.health>45&&comp>40)||(left<=3&&c.health>25&&comp>30))c.mode=wet&&c.health<60?'norm':'push';
  else c.mode='norm';
}
// зоны ответственности стратега для машин игрока: плановые пит-стопы, смена шин по погоде, пит-стоп под SC, режим пилота
const TAC_DEF={plan:true,weather:true,sc:true,mode:true};
const TAC_AREAS=[['plan','Плановые пит-стопы','когда заезжать и на какие шины по износу'],['weather','Шины при дожде и высыхании','переход на дождевые и обратно на сухие'],['sc','Пит-стоп под машиной безопасности','дешёвый заезд, пока поле едет за SC'],['mode','Режим пилота','атака в борьбе и на финише, «беречь» при износе']];
const tacOn=(c,k)=>!c.me||!!(c.tac&&c.tac[k]);
function aiDecide(c,k,wet,sc){
  if(c.pitReq)return;
  if(c.me&&!['plan','weather','sc'].some(x=>tacOn(c,x)))return;
  // одно правило для всех команд: сильный стратег (70+) считает варианты оптимизатором, слабый — заезжает по порогу износа
  if(tacOn(c,'plan')&&srat(team(c.tid),'strat')>=70&&!sc&&!(wet&&c.tyre!=='I')&&!(!wet&&c.tyre==='I')){const o=raceOptions(c),b=Object.keys(o).find(x=>o[x].delta<.05);if(b&&b!=='stay')c.pitReq=b;return}
  const left=(R.N-k+1)*R.ls;
  // реакция на погоду: чем сильнее стратег, тем быстрее зовёт в боксы
  const react=.4+srat(team(c.tid),'strat')/300;
  if(wet&&c.tyre!=='I'){if(tacOn(c,'weather')&&Math.random()<react)c.pitReq='I';return}
  if(!wet&&c.tyre==='I'){if(tacOn(c,'weather')&&Math.random()<react)c.pitReq=left>14?'H':left>8?'M':'S';return}
  if(left<=1)return;
  const dry=c.used.filter(x=>x!=='I');
  const needSecond=!R.anyWet&&(new Set(dry).size<2||(S.rules.twoStop&&c.stops<2));
  if(tacOn(c,'plan')&&S.rules.twoStop&&!R.anyWet&&c.stops===0&&left<R.N*R.ls*.62&&c.health<70){c.pitReq=c.tyre==='M'?'H':'M';return}
  if((tacOn(c,'plan')&&c.health<c.thr)||(tacOn(c,'sc')&&sc&&c.health<62&&left>4)||(tacOn(c,'plan')&&needSecond&&left<=3)){
    let ch=left>15?'H':left>8?'M':'S';
    if(needSecond&&ch===c.tyre)ch=ch==='H'?'M':ch==='M'?(left>10?'H':'S'):'M';
    if(left<=3&&c.health>45&&!needSecond)return;
    c.pitReq=ch;
  }
}
function simLap(k){
  const wet=R.wet[k-1];
  if(wet)R.anyWet=true;
  if(R.sc===0&&k>2&&k<R.N-1&&Math.random()<.028*R.ls){R.sc=Math.round(3/Math.sqrt(R.ls));feed('Машина безопасности на трассе!')}
  const sc=R.sc>0;
  const run=R.cars.filter(c=>!c.out).sort((a,b)=>a.cum[k-1]-b.cum[k-1]);
  // износ шин зависит от погоды на этом круге — пересчитываем здесь, а не в интерфейсе
  R.tw=trackWear(R.abr,R.temp,wet);
  run.forEach((c,i)=>aiMode(c,i>0?c.cum[k-1]-run[i-1].cum[k-1]:99,k,wet));
  let prevEnd=null,prev=null;
  const pitted=new Set();
  for(const c of run){
    aiDecide(c,k,wet,sc);
    const d=drv(c.did),t=team(c.tid);
    let lt=sc?R.track.base*1.38+rnd(0,.4):lapModel(c,k,wet);
    // надёжность
    // износ узлов: без случайных отказов — узел ломается, когда выработан
    const P=ensureParts(c.did);let broke=null;
    COMPS.forEach(([pk])=>{P[pk].h=Math.max(0,P[pk].h-compWear(pk,d,t,c.mode,R.track)*(1-SPEC[pk][1]*((P[pk].sp||1)-1))/R.N*(sc?.4:1));if(FATAL.has(pk)&&P[pk].h<=0&&!broke)broke=pk});
    if(c.me)COMPS.forEach(([pk,pn])=>{if(FATAL.has(pk)&&P[pk].h<20&&!(c.warn||{})[pk]){c.warn=c.warn||{};c.warn[pk]=1;feed(`Радио ${nm(c.did)}: «${pn} на пределе (${Math.round(P[pk].h)}%) — переходи в режим «Беречь»!»`,true)}});
    if(broke){c.out=true;c.outLap=k;c.parkF=(k-1)+clamp((R.T-c.cum[k-1])/(R.track.base+5),.05,.95);c.cum.push(Infinity);c.outWhy=broke;feed(`${nm(c.did)} сходит: ${({ice:'выработан двигатель',ers:'отказ ERS',gb:'отказ коробки передач'})[broke]}.`,c.me);continue}
    if(!sc&&Math.random()<(c.mode==='push'?.012:c.mode==='save'?.002:.004)*(1.3-d.craft/100)*(wet?2.2:1)*R.ls*(1.1-(d.exp||50)/1000)*(1.25-srat(team(c.tid),'coach')/250)){const loss=rnd(1.5,5);lt+=loss;
      // ошибка на пределе бьёт по аэродинамике; в дождь на атаке — риск аварии
      if(c.mode==='push'){P.fw.h=Math.max(0,P.fw.h-rnd(15,35));P.floor.h=Math.max(0,P.floor.h-rnd(4,14))}
      if(c.mode==='push'&&loss>(wet?4:4.6)&&(wet||Math.random()<.3)){c.out=true;c.outLap=k;c.parkF=(k-1)+.5;c.cum.push(Infinity);c.outWhy='crash';P.fw.h=0;P.floor.h=Math.max(0,P.floor.h-40);feed(`${nm(c.did)} разбивает машину на мокрой трассе!`,c.me);continue}
      c.errLap=k;feed(`${nm(c.did)} ошибается и теряет ${loss.toFixed(1).replace('.',',')} с${c.mode==='push'?' — повреждено переднее крыло':''}.`,c.me)}
    // прокол
    if(c.health<10&&Math.random()<.18){lt+=rnd(18,28);c.health=0;if(!c.pitReq)c.pitReq=R.N-k>8?'M':'S';feed(`Прокол у ${nm(c.did)}! Ползёт в боксы.`,c.me)}
    // пит-стоп
    if(c.pitReq&&k<R.N){
      // круг заезда проходит на старом комплекте: его износ считается до смены
      c.health=Math.max(0,c.health-wearRate(c,wet)*(sc?.35:1));
      const crew=t.crew.rating;let st=2.1+(100-crew)*.03;let slow=false;
      if(Math.random()<.05+(100-crew)*.0015){st+=rnd(2,6);slow=true}
      const pl=(sc?R.track.pit*.45:R.track.pit)+S.rules.pitAdd+st;lt+=pl;
      (c.pitAt=c.pitAt||{})[k]={extra:pl,st,from:c.tyre,fromH:c.health,fromStint:c.stintLap};
      c.tyre=c.pitReq;c.health=100;c.stops++;c.stintLap=k;c.used.push(c.tyre);c.pitReq=null;pitted.add(c);
      if(c.me||slow)feed(`${nm(c.did)} в боксах: ${TYRES[c.tyre].n.toLowerCase()}, стоянка ${st.toFixed(1).replace('.',',')} с${slow?' — проблема с колесом':''}.`,c.me);
    }else{c.pitReq=null;c.health=Math.max(0,c.health-wearRate(c,wet)*(sc?.35:1))}
    let end=c.cum[k-1]+lt;
    if(prev&&!sc&&!pitted.has(c)&&!pitted.has(prev)&&c.cum[k-1]-prev.cum[k-1]<2.5){
      if(end<prevEnd+.25){
        if(end<prevEnd){
          const pd=drv(prev.did);
          const p=clamp(.22+(prevEnd-end)*.35-R.track.over*.38+((d.overtake||d.craft)-(pd.defend||pd.craft))/110-(wet?.05:0),.05,.92);
          if(Math.random()<p){if(c.me||prev.me)feed(`${nm(c.did)} обгоняет ${nm(prev.did)}!`,true)}
          else end=prevEnd+rnd(.25,.6);
        }else end=prevEnd+.25+rnd(0,.2);
      }
    }
    c.last=lt;if(!sc&&!pitted.has(c)&&k>1)c.best=Math.min(c.best,lt);
    c.cum.push(end);
    if(!pitted.has(c)){if(prevEnd===null||end>prevEnd){prevEnd=end;prev=c}}
  }
  if(sc){
    const ord=R.cars.filter(c=>!c.out).sort((a,b)=>a.cum[k]-b.cum[k]);
    // очередь за машиной безопасности: отрывы сжимаются, круговые остаются на круг (и больше) позади
    const lead=ord[0].cum[k],scLap=R.track.base*1.38,down=ord.map(c=>Math.floor((c.cum[k]-lead)/R.track.base));
    for(let i=1;i<ord.length;i++)ord[i].cum[k]=Math.max(lead+down[i]*scLap+i*.9,ord[i-1].cum[k]+.9);
    R.sc--;if(R.sc===0)feed('Машина безопасности уходит. Рестарт!');
  }
  if(k<R.N&&R.wet[k]!==wet)feed(R.wet[k]?'Начинается дождь!':'Дождь прекращается, трасса подсыхает.');
  R.lapDone=k;
}
// пит-лейн (в метрах до линии старта): въезд, разгон по ограничителю, бокс своей команды, выезд к линии
const PIT={len:420,inR:70,outR:50,fast:19.5,work:22.5,edge:7};
function pitGeo(){
  const L=R._pL||R.track.km*1000,side=R._pS||1;
  if(R._pg&&R._pg.L===L&&R._pg.side===side)return R._pg;
  const len=Math.min(PIT.len,L*.14),n=S.teams.length,box={};
  // боксы команд вдоль здания: от −165 до −55 м до линии
  S.teams.forEach((t,i)=>box[t.id]=(-165+(i+.5)*110/n));
  return R._pg={L,side,len,a:len/L,box};
}
const sstep=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
// боковое смещение машины в пит-лейне на расстоянии m от линии (m<0)
function pitOff(m,boxM){
  const g=pitGeo(),ent=-g.len;
  let o=m<ent+PIT.inR?PIT.edge+(PIT.fast-PIT.edge)*sstep((m-ent)/PIT.inR):m>-PIT.outR?PIT.fast+(PIT.edge-PIT.fast)*sstep((m+PIT.outR)/PIT.outR):PIT.fast;
  if(boxM!=null)o+=(PIT.work-PIT.fast)*sstep(1-Math.abs(m-boxM)/14);
  return o*g.side;
}
// шины, которые сейчас на машине на экране: симуляция считает круг вперёд, а комплект меняется только в боксе
// машина сейчас в пит-лейне (по экранному времени)
function pitState(c){if(!c.pitAt||c.out)return false;const p=carProgress(c,R.T);return!!p.pit}
function raceToast(html,kind){const el=$('#rtoast');if(!el)return;el.innerHTML=html;el.className='rtoast '+(kind||'');el.hidden=false;clearTimeout(R._tt);R._tt=setTimeout(()=>{const e2=$('#rtoast');if(e2)e2.hidden=true},3600)}
function tyreNow(c){
  if(!c.pitAt||c.out)return{tyre:c.tyre,h:c.health,stint:c.stintLap};
  const p=carProgress(c,R.T),j=p.laps+1;
  for(let q=j;q<=R.lapDone;q++){const ps=c.pitAt[q];if(ps&&(q>j||!(p.pit&&p.pit.after)))return{tyre:ps.from,h:ps.fromH,stint:ps.fromStint}}
  return{tyre:c.tyre,h:c.health,stint:c.stintLap};
}
function carProgress(c,T){
  const cum=c.cum;let i=Math.min(c.pi||0,cum.length-1);
  while(i>0&&cum[i]>T)i--;
  while(i<cum.length-1&&cum[i+1]<=T)i++;c.pi=i;
  if(i>=cum.length-1){return{laps:i,f:0,done:i>=R.N}}
  const a=cum[i],b=cum[i+1];
  if(!isFinite(b))return{laps:i,f:0,out:true};
  const ps=c.pitAt&&c.pitAt[i+1];
  if(ps&&T>a){// круг с пит-стопом: до въезда — темп гонки, в пит-лейне — ограничитель и стоянка
    const g=pitGeo(),lt=b-a,t=T-a,norm=Math.max(lt*.5,lt-ps.extra),t1=(1-g.a)*norm;
    if(t>=t1){const drive=Math.max(1,lt-t1-ps.st),bm=g.box[c.tid]!=null?g.box[c.tid]:-110,bu=(bm+g.len)/g.len,tIn=drive*bu,u=t-t1;
      let s2,stop=false,after=u>=tIn+ps.st;if(u<tIn)s2=bu*u/tIn;else if(u<tIn+ps.st){s2=bu;stop=true}else s2=bu+(1-bu)*Math.min(1,(u-tIn-ps.st)/Math.max(.1,drive-tIn));
      const m=-g.len*(1-s2);return{laps:i,f:clamp(1-g.a+g.a*s2,-.5,1),done:false,pit:{m,bm,stop,after}}}
  }
  return{laps:i,f:clamp((T-a)/(b-a),-.5,1),done:false};
}
function liveOrder(){
  const T=R.T;if(R._lo&&R._loT===T&&R._loL===R.lapDone)return R._lo;
  const arr=R.cars.map(c=>{const p=carProgress(c,T);return{c,p,prog:c.out?-1e6+c.cum.length:p.laps+p.f}});
  arr.sort((a,b)=>b.prog-a.prog);
  const lead=arr[0];
  arr.forEach(x=>{
    if(x.c.out){x.gap='Сход';return}
    if(x===lead){x.gap='Лидер';return}
    const L=Math.min(x.p.laps,R.N);
    const g=x.c.cum[L]-lead.c.cum[L];
    const lapsDown=lead.p.laps-x.p.laps;
    x.gap=lapsDown>=1&&g>R.track.base?`+${lapsDown} кр.`:fgap(Math.max(0,g));
  });
  R._lo=arr;R._loT=T;R._loL=R.lapDone;
  return arr;
}
let lastTs=0,lastUi=0;
function loop(ts){
  if(UI.screen!=='race'||!R)return;
  const dt=lastTs?Math.min(.25,(ts-lastTs)/1000):0;lastTs=ts;
  if(R.count>0){
    R.count-=dt;
    const n=clamp(Math.floor((3.6-R.count)/.6),0,5);
    if(n!==R._ln){R._ln=n;if(n>0&&R.count>0)sfxLight()}
    document.querySelectorAll('#lights i').forEach((el,i)=>el.classList.toggle('on',i<n&&R.count>0));
    if(R.count<=0){const l=$('#lights');if(l)l.hidden=true;sfxGo();feed('Огни погасли — старт!')}
  }else if(!R.paused&&!R.done){
    R.T+=dt*6.5*R.speed;
    // досчитать круги
    for(;;){
      const k=R.lapDone;if(k>=R.N)break;
      const run=R.cars.filter(c=>!c.out);if(!run.length)break;
      const lead=Math.min(...run.map(c=>c.cum[k]));
      if(R.T>=lead)withRng(()=>simLap(k+1));else break;
    }
    if(R.lapDone>=R.N){
      const run=R.cars.filter(c=>!c.out);
      if(run.every(c=>R.T>=c.cum[R.N])){R.done=true;finishRace();return}
    }
  }
  if(G)draw3D(dt);
  drawRace();
  if(ts-lastUi>400){lastUi=ts;updateRaceUi()}
  requestAnimationFrame(loop);
}
// 2D-вид: масштаб и сдвиг карты
const V2={z:1,x:0,y:0,follow:false};
function kerbsOf(p){
  if(p.kerb)return p.kerb;const N=p.pts.length,k=[];
  for(let i=0;i<N;i++){const a=p.pts[(i-4+N)%N],b=p.pts[i],c=p.pts[(i+4)%N];
    const t1=Math.atan2((b[1]-a[1]),(b[0]-a[0])*p.ar),t2=Math.atan2((c[1]-b[1]),(c[0]-b[0])*p.ar);let d=Math.abs(t2-t1);if(d>Math.PI)d=2*Math.PI-d;k.push(d)}
  const sorted=[...k].sort((a,b)=>a-b),th=sorted[Math.floor(N*.7)];
  return p.kerb=k.map(v=>v>=th);
}
function drawCar2D(ctx,x,y,a,L,col,acc,me){
  ctx.save();ctx.translate(x,y);ctx.rotate(a);const u=L/5.7;ctx.scale(u,u);
  const poly=pts=>{ctx.beginPath();pts.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fill()};
  if(me){ctx.fillStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.ellipse(.2,0,3.6,1.45,0,0,Math.PI*2);ctx.fill()}
  ctx.fillStyle='#0d0d0d';[[1.76,.8,.3],[1.76,-.8,.3],[-1.8,.78,.4],[-1.8,-.78,.4]].forEach(([wx,wy,ww])=>ctx.fillRect(wx-.36,wy-ww/2,.72,ww));
  ctx.fillStyle='#16191d';poly([[1.3,-.55],[1.3,.55],[.9,.86],[-1.4,.9],[-2.05,.75],[-2.05,-.75],[-1.4,-.9],[.9,-.86]]);
  ctx.fillStyle=col;ctx.beginPath();ctx.ellipse(-.45,0,1.25,.78,0,0,Math.PI*2);ctx.fill();
  poly([[3.0,-.05],[3.0,.05],[2.1,.15],[1.1,.28],[.2,.4],[-.8,.36],[-1.8,.18],[-2.35,.09],[-2.35,-.09],[-1.8,-.18],[-.8,-.36],[.2,-.4],[1.1,-.28],[2.1,-.15]]);
  ctx.fillStyle=acc;ctx.fillRect(2.62,-.96,.42,1.92);ctx.fillRect(-2.78,-.52,.44,1.04);
  ctx.fillStyle='#07090b';ctx.beginPath();ctx.ellipse(.22,0,.42,.17,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#f2f2f2';ctx.beginPath();ctx.arc(.16,0,.13,0,Math.PI*2);ctx.fill();
  ctx.restore();
}
function draw2D(cv){
  const{ctx,w,h}=fitBox(cv);if(!w)return;
  const p=R.path,pad=18,s0=Math.min((w-pad*2)/p.ar,h-pad*2),s=s0*V2.z,mpp=s/p.ws;
  const ord=liveOrder();
  if(V2.follow){const x=ord.find(o=>o.c.did===UI.follow);if(x&&!x.c.out){const pt=pointAt(p,x.p.f),tx=-(pt[0]-.5)*p.ar*s,ty=-(pt[1]-.5)*s;V2.x+=(tx-V2.x)*.15;V2.y+=(ty-V2.y)*.15}}
  const tf=([x,y])=>[w/2+(x-.5)*p.ar*s+V2.x,h/2+(y-.5)*s+V2.y];
  const wet=R.wet[Math.min(R.N-1,R.lapDone)];
  ctx.fillStyle=wet?'#1f3326':'#25412a';ctx.fillRect(0,0,w,h);
  const thick=Math.max(7,14*mpp),N=p.pts.length,SP=p.pts.map(tf);
  const stroke=(lw,col,dash,from,to)=>{ctx.beginPath();for(let i=from;i<=to;i++){const q=SP[i%N];i===from?ctx.moveTo(q[0],q[1]):ctx.lineTo(q[0],q[1])}ctx.lineWidth=lw;ctx.strokeStyle=col;ctx.setLineDash(dash||[]);ctx.stroke();ctx.setLineDash([])};
  ctx.lineJoin='round';ctx.lineCap='round';
  stroke(thick*2.6,'#3f4b40',null,0,N);
  // поребрики в поворотах
  const kb=kerbsOf(p);let i=0;
  while(i<N){if(!kb[i]){i++;continue}let j=i;while(j<N&&kb[j])j++;stroke(thick+6,'#f2f2f2',null,i,j);stroke(thick+6,'#d8322a',[Math.max(3,thick*.45),Math.max(3,thick*.45)],i,j);i=j}
  ctx.lineCap='butt';stroke(thick+2,'#dfe4e9',null,0,N);stroke(thick,wet?'#1d3550':'#2b3037',null,0,N);ctx.lineCap='round';
  // старт-финиш
  const a0=SP[0],a1=SP[2],ang0=Math.atan2(a1[1]-a0[1],a1[0]-a0[0]);
  ctx.save();ctx.translate(a0[0],a0[1]);ctx.rotate(ang0);const cs=thick/4;
  for(let r=0;r<4;r++)for(let c=0;c<2;c++){ctx.fillStyle=(r+c)%2?'#0b0f14':'#f4f4f4';ctx.fillRect(c*cs-cs,-thick/2+r*cs,cs,cs)}ctx.restore();
  // машины
  const L=Math.max(thick*1.25,5.7*mpp);
  const run=ord.filter(x=>!x.c.out);
  for(let k=run.length-1;k>=0;k--){
    const x=run[k],f=x.p.done?0:x.p.f,pt=tf(pointAt(p,f)),pn=tf(pointAt(p,f+.002)),ang=Math.atan2(pn[1]-pt[1],pn[0]-pt[0]);
    const close=k>0&&(run[k-1].prog-x.prog)<.004;const off=close?(k%2?1:-1)*thick*.24:0;
    const px=pt[0]-Math.sin(ang)*off,py=pt[1]+Math.cos(ang)*off,t=team(x.c.tid);
    if(px<-20||py<-20||px>w+20||py>h+20)continue;
    drawCar2D(ctx,px,py,ang,L,t.color,accentOf(t.id),x.c.me);
    if(x.c.me||V2.z>3){const lbl=String(k+1)+(V2.z>3?' '+nm(x.c.did):'');ctx.font='600 11px JetBrains Mono, monospace';const tw=ctx.measureText(lbl).width+10;
      ctx.fillStyle=x.c.me?t.color:'rgba(11,15,20,.8)';ctx.fillRect(px-tw/2,py-L*.6-18,tw,16);ctx.fillStyle=x.c.me?'#0b0f14':'#e8eef4';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(lbl,px,py-L*.6-10)}
  }
  if(R.sc>0&&run[0]){const f=run[0].p.f+.006,pt=tf(pointAt(p,f)),pn=tf(pointAt(p,f+.002));drawCar2D(ctx,pt[0],pt[1],Math.atan2(pn[1]-pt[1],pn[0]-pt[0]),L*.9,'#c9ced4','#ffa31a',false);
    ctx.fillStyle='#ffd23f';ctx.font='600 12px JetBrains Mono, monospace';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText('SC',10,18)}
}
function drawRace(){
  const cv=$('#trk');if(!cv)return;
  const mini=cv.classList.contains('mini');
  if(!mini)return draw2D(cv);
  const{ctx,w,h}=fitBox(cv);if(!w)return;
  const wetNow=R.wet[Math.min(R.N-1,R.lapDone)],key=w+'x'+h+wetNow;
  // трасса рисуется один раз в отдельный слой, каждый кадр — только машины
  if(!R._mini||R._mini.key!==key){const off=document.createElement('canvas');off.width=cv.width;off.height=cv.height;const oc=off.getContext('2d');oc.setTransform(cv.width/w,0,0,cv.height/h,0,0);
    R._mini={key,off,tf:drawTrack(oc,w,h,R.path,Math.max(4,w*.03),wetNow)}}
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(R._mini.off,0,0);ctx.setTransform(cv.width/w,0,0,cv.height/h,0,0);
  const tf=R._mini.tf;
  const ord=liveOrder();
  for(let i=ord.length-1;i>=0;i--){
    const x=ord[i];if(x.c.out||x.p.done)continue;
    const[px,py]=tf(pointAt(R.path,x.p.f));
    const t=team(x.c.tid);
    ctx.beginPath();ctx.arc(px,py,mini?(x.c.me?4:2.6):(x.c.me?7:5),0,Math.PI*2);ctx.fillStyle=t.color;ctx.fill();
    if(x.c.me&&mini){ctx.lineWidth=1.5;ctx.strokeStyle='#ffffff';ctx.stroke()}
    else if(x.c.me){ctx.lineWidth=2.5;ctx.strokeStyle='#ffffff';ctx.stroke();
      ctx.font='600 11px JetBrains Mono, monospace';ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.fillText(String(i+1),px,py-11)}
    else{ctx.lineWidth=1;ctx.strokeStyle='#0b0f14';ctx.stroke()}
  }
  if(R.sc>0){ctx.fillStyle='#ffd23f';ctx.font='600 12px JetBrains Mono, monospace';ctx.textAlign='left';ctx.fillText('SC',10,18)}
}
function panZoom(el,onPan,onZoom){
  const pts=new Map();let lastD=0;el.style.touchAction='none';
  el.addEventListener('pointerdown',e=>{try{el.setPointerCapture(e.pointerId)}catch(_){}pts.set(e.pointerId,[e.clientX,e.clientY]);lastD=0});
  el.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;const pr=pts.get(e.pointerId),cur=[e.clientX,e.clientY];
    if(pts.size===1)onPan(cur[0]-pr[0],cur[1]-pr[1]);pts.set(e.pointerId,cur);
    if(pts.size===2){const[a,b]=[...pts.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),r=el.getBoundingClientRect();if(lastD)onZoom(d/lastD,(a[0]+b[0])/2-r.left,(a[1]+b[1])/2-r.top);lastD=d}});
  const up=e=>{pts.delete(e.pointerId);lastD=0};['pointerup','pointercancel','pointerleave'].forEach(k=>el.addEventListener(k,up));
  el.addEventListener('wheel',e=>{e.preventDefault();const r=el.getBoundingClientRect();onZoom(Math.exp(-e.deltaY*.0008),e.clientX-r.left,e.clientY-r.top)},{passive:false});
  el.addEventListener('dblclick',()=>onZoom(0));
}
function zoom2D(f,mx,my,w,h){
  if(f===0){V2.z=1;V2.x=0;V2.y=0;V2.follow=false;return}
  const z0=V2.z,z1=clamp(z0*f,1,40);
  V2.x+=(mx-w/2-V2.x)*(1-z1/z0);V2.y+=(my-h/2-V2.y)*(1-z1/z0);V2.z=z1;
}
function zoom3D(f,mx,my,w,h){
  const ov=G.ov;if(f===0){ov.x=0;ov.z=0;ov.zoom=1;ov.follow=false;return}
  const H=G.ovH||1000,wpp=2*H*Math.tan(25*Math.PI/180)/h,z1=clamp(ov.zoom*f,1,40);
  const px=ov.x+(mx-w/2)*wpp,pz=ov.z+(my-h/2)*wpp,wpp1=wpp*ov.zoom/z1;
  ov.x=px-(mx-w/2)*wpp1;ov.z=pz-(my-h/2)*wpp1;ov.zoom=z1;
}
function bindRaceViews(){
  const cv=$('#trk');
  if(cv&&!cv.classList.contains('mini'))panZoom(cv,(dx,dy)=>{V2.x+=dx;V2.y+=dy;V2.follow=false},(f,mx,my)=>zoom2D(f,mx,my,cv.clientWidth,cv.clientHeight));
  const v=$('#v3d');
  if(v&&G)panZoom(v,(dx,dy)=>{if(UI.cam!=='over')return;const H=G.ovH||1000,wpp=2*H*Math.tan(25*Math.PI/180)/v.clientHeight;G.ov.x-=dx*wpp;G.ov.z-=dy*wpp;G.ov.follow=false},
    (f,mx,my)=>{if(UI.cam!=='over'){if(f){UI.cam='over';G.ov.zoom=1;updateRaceUi()}return}zoom3D(f,mx,my,v.clientWidth,v.clientHeight)});
}
function zoomBtn(kind){
  const is3=!!G&&UI.cam==='over',el=is3?$('#v3d'):$('#trk');if(!el)return;const w=el.clientWidth,h=el.clientHeight,f=kind==='in'?1.6:kind==='out'?1/1.6:0;
  if(kind==='follow'){if(is3){G.ov.follow=!G.ov.follow;if(G.ov.zoom<3)G.ov.zoom=5}else{V2.follow=!V2.follow;if(V2.z<3)V2.z=5}return}
  is3?zoom3D(f,w/2,h/2,w,h):zoom2D(f,w/2,h/2,w,h);
}
function finishRace(){
  const N=R.N;
  const fin=R.cars.filter(c=>!c.out).map(c=>{
    const dry=new Set(c.used.filter(x=>x!=='I'));
    if(!R.anyWet&&(dry.size<2||(S.rules.twoStop&&c.stops<2))){c.pen=10}
    return{c,t:c.cum[N]+c.pen};
  }).sort((a,b)=>a.t-b.t);
  const dnf=R.cars.filter(c=>c.out).sort((a,b)=>b.cum.length-a.cum.length).map(c=>({c,t:Infinity}));
  const res=[...fin,...dnf];
  const win=fin[0]?fin[0].t:0;
  const rows=res.map((x,i)=>{
    const pts=x.c.out?0:(POINTS[i]||0);
    const d=drv(x.c.did);d.pts+=pts;team(x.c.tid).pts+=pts;
    // победы и подиумы — за сезон; за карьеру — отдельно
    if(i===0&&!x.c.out){d.wins++;d.cWins=(d.cWins||0)+1}if(i<3&&!x.c.out){d.pods++;d.cPods=(d.cPods||0)+1}
    return{did:x.c.did,tid:x.c.tid,pos:i+1,grid:x.c.grid,out:x.c.out,time:x.t,gap:x.c.out?null:x.t-win,lapsDown:x.c.out||!fin[0]?0:Math.floor((x.c.cum[N]-fin[0].c.cum[N])/(fin[0].c.cum[N]/N)),pts,pen:x.c.pen,stops:x.c.stops,me:x.c.me,best:x.c.best};
  });
  // экономика
  const mine=rows.filter(r=>r.me);
  const ptsMine=mine.reduce((s,r)=>s+r.pts,0);
  const best=Math.min(...mine.map(r=>r.out?99:r.pos));
  const goalOk={finish:mine.every(r=>!r.out),points:mine.some(r=>!r.out&&r.pos<=10),both:mine.every(r=>!r.out&&r.pos<=10),podium:best<=3,win:best===1};
  const inc=[];
  inc.push(['Выплаты FOM',BAL.fomBase]);
  // призовые FOM приходят частями по ходу сезона — по месту в Кубке конструкторов прошлого года
  inc.push([`Призовые FOM (${lastRank(me())}-е место)`,+(fomPrize(lastRank(me()))/NR()).toFixed(2)]);
  S.sponsors.forEach(s=>{inc.push([s.name,s.per]);if(goalOk[s.goal])inc.push([`Бонус: ${s.name}`,s.bonus])});
  const t=me();
  const crash=mine.filter(r=>r.out).length;
  const exp=[['Зарплаты пилотов',t.drivers.reduce((s,id)=>s+drv(id).salary,0)/NR()],['Персонал',staffSalary(t)/NR()],['Логистика и операции',BAL.logistics],['Академия и скаутинг',acadUpkeep()],['Содержание базы',facUpkeep()]];
  if(crash)exp.push([crash>1?'Эвакуация и проверка двух болидов':'Эвакуация и проверка болида',+(crash*BAL.crashCost).toFixed(2)]);
  const net=inc.reduce((s,x)=>s+x[1],0)-exp.reduce((s,x)=>s+x[1],0);
  inc.forEach(([n,v])=>money(v,n==='Выплаты FOM'?'fom':n.startsWith('Бонус')?'bonus':/Призов/.test(n)?'prize':'sponsor',n));
  exp.forEach(([n,v])=>money(-v,EXP_CAT[n]||(/Эвакуац/.test(n)?'repair':'other'),n));
  finClose(W.tr.gp);
  // репутация
  const exp_pos=S.goal*2;
  S.rep=clamp(S.rep+clamp((exp_pos-best)*.08,-1,.4)+(best<=3?.8:0),10,100);
  tasksAfterRace(rows,W.grid||[]);
  if(W.hype){const ok=best<=10;S.rep=clamp(S.rep+(ok?2.5:-3),10,100);news(ok?'Громкие заявления на медиа-дне подтвердились — репутация растёт.':'Обещания на медиа-дне не сбылись — пресса критикует команду.')}
  // тренировки во всех командах: рост к потенциалу зависит от тренера и возраста
  trainDrivers();
  // проекты

  // развитие соперников
  S.teams.forEach(o=>{if(o.id===S.pid)return;
    // как у игрока: деньги на разработку (фонд FOM + своя доля) делятся между текущим болидом и следующим
    const m=aiDevBudget(o)/NR()*DIFF_DEV[SET.diff],nx=S.round>NR()*.4?.7:.3;
    PARTS.forEach(([k])=>{if(k==='engine'&&o.engineSup)return;o.next[k]+=m*nx/4*devEff(o,k)*rnd(.7,1.3)});
    if(Math.random()<.12+o.budget/900){const k=pick(['floor','fw','floor','gb','ice','ers']);if(teamSpec(o,k)<SPEC_MAX&&!((k==='ice'||k==='ers')&&(S.rules.freeze||o.engineSup))){o.spec=o.spec||{};o.spec[k]=teamSpec(o,k)+1}}
    let part=pick(['aero','engine','chassis','aero','engine','chassis','rel']);if(part==='engine'&&S.rules.freeze)part='chassis';o.car[part]=clamp(+(o.car[part]+m*(1-nx)*BAL.aiPtsPerM*(.7+o.td.rating/200)*facMul(o,part)*rnd(.6,1.4)/(1+Math.max(0,o.car[part]-70)/40)).toFixed(1),0,100)});
  // новые предложения
  if(S.round%3===2){S.offers.push(mkOffer());S.offers=S.offers.slice(-5)}
  academyRace();autoOrder();ensureIntel();CATS.forEach(([k])=>S.intel.conf[k]=Math.min(.92,S.intel.conf[k]+.035));
  retireCheck();
  if(S.vote)resolveVote();
  if(S.round%6===2&&S.round<NR()-1)newVote();
  const winner=rows[0];
  S.results.push({round:S.round,winner:winner.did,wtid:winner.tid,my:mine.map(r=>r.out?'сход':r.pos)});
  const mtxt=mine.map(r=>`${nm(r.did)} — ${r.out?'сход':r.pos+'-й'}`).join(', ');
  news(`${W.tr.gp}: победа ${drv(winner.did).name} («${team(winner.tid).name}»). У нас: ${mtxt}.`);
  S.lastRace={rows,inc,exp,net,ptsMine,track:W.tr.gp};
  S.day=Math.max(S.day,raceDay(W.tr));
  S.round++;
  save(true);
  UI.screen='result';render();
}

