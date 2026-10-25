/* ---------- конец сезона ---------- */
function endSeason(){
  const st=teamStandings();const pos=st.findIndex(t=>t.id===S.pid)+1;
  const prize=BAL.champBonus[pos-1]||0;
  if(prize)money(prize,'prize',`Бонус FOM за ${pos}-е место`);
  // владельцы забирают 60% денег сверх годовых обязательных расходов: резерв на год остаётся команде
  const keep=+(mandPerRace()*NR()).toFixed(1),div=S.budget>keep?+((S.budget-keep)*BAL.dividendShare).toFixed(1):0;
  if(div>0){money(-div,'owners','Дивиденды владельцам');news(`Владельцы команды забрали ${fm(div,1)} — деньги сверх годового резерва (${fm(keep,1)}).`)}
  let verdict;
  if(pos<=S.goal){verdict={ok:true,t:`Цель выполнена: ${pos}-е место при задаче ${S.goal}-е. Совет доволен.`};S.rep=clamp(S.rep+6,10,100);S.warnings=0}
  // у команд с целью 1–2-е место «почти» — до двух мест ниже цели: борьба за титул не должна стоить работы за 2-е место
  else if(pos<=S.goal+(S.goal<=2?2:1)){verdict={ok:null,t:`Почти: ${pos}-е место при задаче ${S.goal}-е. Совет ждёт прогресса.`}}
  else{S.warnings++;verdict={ok:false,t:`Провал: ${pos}-е место при задаче ${S.goal}-е. Предупреждение ${S.warnings} из 2.`}}
  const champ=driverStandings()[0];
  S.history.push({season:year(),pos,champ:champ.name,ctid:st[0].id,cname:st[0].name});
  // неистраченный фонд FOM инженеры распределяют поровну
  if(S.devFund>0){const per=S.devFund/4;PARTS.forEach(([k])=>me().next[k]+=per*devEff(me(),k));news(`Инженеры распределили остаток фонда на новый болид: ${fm(S.devFund,1)}.`);S.devFund=0}
  const broke=S.budget<-20;
  if(broke)verdict={ok:false,t:`Банкротство: долг ${fm(-S.budget,1)}. Владельцы закрывают проект.`};
  UI.season={pos,prize,verdict,champ:champ.name,cteam:st[0].name,gameover:S.warnings>=2||broke};
  S.lastPos={};st.forEach((t,i)=>S.lastPos[t.id]=i+1);S.devFund=fundFor(me());
  // межсезонье
  if(!UI.season.gameover){
    S.season++;S.round=0;S.results=[];S.projects=[];S.day=raceDay(seasonTracks()[0])-24;
    // клиентский мотор: как у поставщика минус 3
    const newCar={};S.teams.forEach(t=>{newCar[t.id]={};PARTS.forEach(([k])=>newCar[t.id][k]=clamp(nextStat(t,k),40,99))});
    S.teams.forEach(t=>{if(t.engineSup&&newCar[t.engineSup])newCar[t.id].engine=clamp(newCar[t.engineSup].engine-3,40,99)});
    UI.season.newCar=PARTS.map(([k,n])=>[n,me().car[k],newCar[S.pid][k]]);
    S.teams.forEach(t=>{t.pts=0;PARTS.forEach(([k])=>t.car[k]=newCar[t.id][k]);t.next={aero:0,engine:0,chassis:0,rel:0}});
    S.spent=0;S.rules.freeze=false;S.vote=null;
    Object.values(S.parts||{}).forEach(P=>COMPS.forEach(([k])=>{P[k].used=1;P[k].h=100;P[k].sp=1}));S.gpen={};S.teams.forEach(o=>o.spec={});S.stockNew={};
    const pool=[];
    Object.values(S.drivers).forEach(d=>{d.pts=0;d.wins=0;d.pods=0;d.age++;ensureAttrs(d);d.exp=Math.min(99,d.exp+3);
      if(d.age<=26)d.pace=clamp(d.pace+ri(0,2),50,99);else if(d.age>=33)d.pace=clamp(d.pace-ri(0,2),50,99);
      d.salary=salaryFor(d.pace);
      if(d.team&&d.team!==S.pid){d.contract--;if(d.contract<=0)d.contract=ri(1,3)}
      if(d.team===S.pid)d.contract--;
      // предварительные контракты: переход в нашу команду
      if(d.next&&!d.retired){const from=team(d.team);if(from)from.drivers=from.drivers.filter(x=>x!==d.id);
        d.team=d.next.tid;d.contract=d.next.len;d.salary=d.next.salary;if(!me().drivers.includes(d.id))me().drivers.push(d.id);ensureParts(d.id);
        news(`${d.name} переходит в команду${from&&from.id!==S.pid?` из «${from.name}»`:''}: контракт до ${year()+d.contract-1}.`);delete d.next}
    });
    // завершение карьеры и истёкшие контракты в нашей команде
    STAFF_ROLES.forEach(([k,n])=>{const sf=me()[k];if(!sf)return;sf.contract=(sf.contract||1)-1;
      if(sf.contract<=0){news(`${n} ${sf.name} покидает команду: контракт истёк. Обязанности временно исполняет помощник.`);me()[k]={name:'И. о. — '+pick(FIRST)+' '+pick(LAST),rating:48,salary:.4,contract:1,acting:true}}});
    me().drivers=me().drivers.filter(id=>{const d=drv(id);
      if(d.retiring){d.team=null;d.retired=true;news(`${d.name} завершил карьеру. Нужен новый пилот — смотрите рынок и академию.`);return false}
      if(d.contract<=0){d.team=null;d.contract=0;news(`Контракт ${d.name} истёк — пилот покидает команду.`);return false}
      return true});
    // академия: юниоры взрослеют, старше 23 — выпускаются
    leaguesSeasonEnd();
    S.academy.juniors.forEach(j=>{j.age++;j.exp=Math.min(99,(j.exp||40)+4)});S.academy.juniors=S.academy.juniors.filter(j=>{if(j.age>23){news(`${j.name} покидает академию: возраст.`);return false}return true});
    // уход ветеранов у соперников
    S.teams.forEach(t=>{if(t.id===S.pid)return;t.drivers=t.drivers.map(id=>{const d=drv(id);if(d.retiring||d.age>=45){d.team=null;d.retired=true;
      let fa=Object.values(S.drivers).filter(x=>!x.team&&!x.retired).sort((a,b)=>b.pace-a.pace)[0];
      if(!fa||Math.random()<.4){fa=rookie();S.drivers[fa.id]=fa}fa.team=t.id;fa.contract=ri(1,3);
      news(`${d.name} завершает карьеру. В «${t.name}» приходит ${fa.name}.`);return fa.id}return id})});
    // соперники закрывают вакансии свободными пилотами
    S.teams.forEach(t=>{if(t.id===S.pid)return;while(t.drivers.length<2){let fa=Object.values(S.drivers).filter(x=>!x.team&&!x.retired&&!x.next).sort((a,b)=>b.pace-a.pace)[0];
      if(!fa||Math.random()<.3){fa=rookie();S.drivers[fa.id]=fa}fa.team=t.id;fa.contract=ri(1,3);t.drivers.push(fa.id);ensureParts(fa.id);news(`«${t.name}» подписывает ${fa.name}.`)}});
    for(let i=0;i<2;i++){const r=rookie();S.drivers[r.id]=r}
    // всегда есть доступный резервный пилот
    const rv=mkDriver(pick(FIRST)+' '+pick(LAST),ri(21,27),ri(72,74),ri(72,78),ri(72,78));S.drivers[rv.id]=rv;
    S.sponsors=S.sponsors.filter(()=>Math.random()<.5);
    S.offers=[];for(let i=0;i<4;i++)S.offers.push(mkOffer());
    S.market=staffMarket();
    // цель совета не строже, чем позволяет бюджет команды: от команды с 6-м бюджетом не требуют места выше 5-го
    const bRank=[...S.teams].sort((a,b)=>b.budget-a.budget).findIndex(x=>x.id===S.pid)+1;
    S.goal=clamp(Math.min(S.goal,pos+1)-(verdict.ok?1:0),Math.max(1,bRank-1),S.teams.length-1);
    news(`Сезон ${year()} начинается. Новая цель совета: ${S.goal}-е место или выше.`);
  }
  save(true);UI.screen='season';render();
}

