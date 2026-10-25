/* ---------- состояние ---------- */
const SAVE='pitwall_save_v1';
let S=null;            // игра
let W=null;            // уик-энд
let R=null;            // гонка
const UI={screen:'title',tab:'hq',stand:'drivers',arm:null,pickTeam:3,teamName:'',back:'title',year0:2026,real:true};

/* ---------- настройки игры ---------- */
const SKEY='pitwall_settings_v1';
const DEF_SET={gfx:1,view:'3d',cam:'chase',speed:4,len:1,diff:1,mode:'real',music:1,intro:1};
let SET=(()=>{try{return Object.assign({},DEF_SET,JSON.parse(localStorage.getItem(SKEY)||'{}'))}catch(e){return{...DEF_SET}}})();
// журнал диагностики: ошибки не глушатся, а записываются и видны в настройках
const DIAG=[];
function diag(where,e){const m=(e&&e.message)||String(e);DIAG.unshift({t:new Date().toLocaleTimeString('ru-RU'),where,m,stack:e&&e.stack?String(e.stack).split('\n').slice(0,4).join('\n'):''});DIAG.length=Math.min(DIAG.length,30);try{console.warn('[Пит-Уолл]',where,e)}catch(e2){}}
window.addEventListener('error',ev=>{diag('ошибка скрипта',ev.error||ev.message);try{toast('Произошла ошибка: '+((ev.error&&ev.error.message)||ev.message)+'. Подробности — в настройках, «Диагностика».')}catch(e){}});
window.addEventListener('unhandledrejection',ev=>diag('необработанное обещание',ev.reason));
function saveSet(){try{localStorage.setItem(SKEY,JSON.stringify(SET))}catch(e){diag('сохранение настроек',e)}}

/* ---------- звук: собственная тема в духе телетрансляций (синтез Web Audio, без файлов) ---------- */
const AU={ctx:null,out:null,mus:null,sfx:null,rev:null,noise:null,run:false,step:0,t:0,timer:0};
const BPM=132,ST=60/BPM/4;   // длительность шестнадцатой
const mtof=m=>440*Math.pow(2,(m-69)/12);
const AU_OK=!!(window.AudioContext||window.webkitAudioContext);
const auVol=()=>[0,.42,.8][SET.music]||0;
function auCtx(){
  if(AU.ctx)return AU.ctx;if(!AU_OK)return null;
  const c=AU.ctx=new(window.AudioContext||window.webkitAudioContext)();
  const comp=c.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;comp.connect(c.destination);
  AU.out=c.createGain();AU.out.gain.value=0;AU.out.connect(comp);
  AU.sfx=c.createGain();AU.sfx.gain.value=auVol();AU.sfx.connect(comp);
  AU.mus=c.createGain();AU.mus.connect(AU.out);
  const len=c.sampleRate*2.2|0,ir=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3)}
  AU.rev=c.createConvolver();AU.rev.buffer=ir;const rg=c.createGain();rg.gain.value=.3;AU.rev.connect(rg);rg.connect(AU.mus);
  const nb=c.createBuffer(1,c.sampleRate,c.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;AU.noise=nb;
  document.addEventListener('visibilitychange',()=>{if(document.hidden)c.suspend();else c.resume()});
  return c;
}
function aTone(t,type,f,dur,v,dest,f2){const c=AU.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+dur*.6);
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);o.connect(g);g.connect(dest||AU.mus);o.start(t);o.stop(t+dur+.03)}
function aNoise(t,dur,type,f,q,v,dest,f2,a){const c=AU.ctx,s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();s.buffer=AU.noise;s.loop=true;
  fl.type=type;fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+dur);fl.Q.value=q;
  if(a){g.gain.setValueAtTime(.0008,t);g.gain.exponentialRampToValueAtTime(v,t+dur*.95);g.gain.linearRampToValueAtTime(0,t+dur)}else{g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur)}
  s.connect(fl);fl.connect(g);g.connect(dest||AU.mus);s.start(t,Math.random()*.5);s.stop(t+dur+.03)}
// синтезатор: несколько расстроенных осцилляторов через фильтр с огибающей
function aSyn(t,m,dur,o){const c=AU.ctx,fl=c.createBiquadFilter(),g=c.createGain(),a=o.a||.005,rel=o.rel||.08;
  fl.type='lowpass';fl.Q.value=o.q||2;fl.frequency.setValueAtTime(o.cut,t);fl.frequency.exponentialRampToValueAtTime(o.cut2||o.cut,t+Math.max(.02,dur*(o.fs||1)));
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(o.v,t+a);g.gain.setValueAtTime(o.v,t+Math.max(a,dur));g.gain.exponentialRampToValueAtTime(.0008,t+dur+rel);
  fl.connect(g);g.connect(AU.mus);if(o.rev){const s=c.createGain();s.gain.value=o.rev;g.connect(s);s.connect(AU.rev)}
  (o.det||[0]).forEach(d=>{const x=c.createOscillator();x.type=o.type||'sawtooth';x.frequency.value=mtof(m);x.detune.value=d;
    if(o.vib){const l=c.createOscillator(),lg=c.createGain();l.frequency.value=5.2;lg.gain.setValueAtTime(0,t);lg.gain.linearRampToValueAtTime(o.vib,t+.25);l.connect(lg);lg.connect(x.detune);l.start(t);l.stop(t+dur+rel+.05)}
    x.connect(fl);x.start(t);x.stop(t+dur+rel+.05)})}
const aKick=(t,v=1)=>aTone(t,'sine',150,.32,.95*v,0,40);
const aSnare=(t,v=1)=>{aNoise(t,.17,'highpass',1300,.7,.42*v);aNoise(t,.3,'bandpass',2300,.9,.16*v,AU.rev);aTone(t,'triangle',200,.09,.3*v)};
const aHat=(t,v=1)=>aNoise(t,.035,'highpass',7800,.6,.12*v);
function aImpact(t,dest){dest=dest||AU.mus;aTone(t,'sine',120,1.6,1,dest,32);aTone(t,'sawtooth',55,1.1,.18,dest,41);
  aNoise(t,2.2,'lowpass',900,.5,.35,dest,120);aNoise(t,1.8,'highpass',4800,.4,.22,dest);aNoise(t,2.4,'bandpass',1800,.6,.25,AU.rev)}
// гармония: тоника басом и трезвучие (интервалы)
const CH={Dm:[38,[0,3,7]],Bb:[34,[0,4,7]],F:[41,[0,4,7]],C:[36,[0,4,7]],Gm:[43,[0,3,7]],A:[45,[0,4,7]]};
const SEC={B:['Dm','Bb','F','C','Dm','Bb','Gm','A'],A:['Dm','Dm','Bb','C','Dm','Dm','Bb','A']};
const ARP=[0,2,3,2,1,2,3,2,0,2,3,2,1,3,2,1];
// главная тема (шаг, нота, длительность в шестнадцатых)
const LEAD=[[0,69,6],[6,74,2],[8,74,4],[12,76,2],[14,77,2],[16,77,8],[24,74,4],[28,70,4],[32,72,6],[38,77,2],[40,81,4],[44,79,2],[46,77,2],[48,79,12],[60,76,4],
 [64,69,6],[70,74,2],[72,74,4],[76,76,2],[78,77,2],[80,82,8],[88,81,4],[92,77,4],[96,79,6],[102,77,2],[104,74,4],[108,79,4],[112,76,8],[120,73,4],[124,76,4]];
const LEADAT={};LEAD.forEach(n=>LEADAT[n[0]]=n);
const chordNotes=(ch,base)=>{const[r,iv]=CH[ch];const t=iv.map(i=>r+i);return[t[0]+base,t[1]+base,t[2]+base,t[0]+base+12]};
function auStep(s,t){
  const L=ST;
  if(s<0){ // вступление: два такта нарастания до «огни погасли»
    const k=s+32,ch=chordNotes('Dm',24);
    if(k===0)aNoise(t,32*L,'bandpass',260,1.4,.28,0,7000,1);
    if(k<28){aSyn(t,ch[ARP[k%16]],L*.85,{type:'square',cut:600+k*90,cut2:400,v:.035+k*.0015,rel:.05,rev:.2});if(k%2===0)aSyn(t,38,L*1.6,{cut:300,cut2:120,v:.12+k*.003,rel:.05})}
    if([2,8,14,20,26].includes(k)){aTone(t,'sine',90,.5,.6,0,48);aNoise(t,.25,'bandpass',900,1,.12)}
    if(k>=24&&k<28)aSnare(t,.25+(k-24)*.2);
    return;
  }
  const pos=s%256,secB=pos<128,p=pos%128,bar=p>>4,b=p%16,ch=SEC[secB?'B':'A'][bar],[root]=CH[ch];
  if(s===0)aImpact(t);
  // ударные
  const fill=bar===7&&b>=12;
  if(secB?b%4===0:(b===0||b===8||b===10))aKick(t,b===0?1:.85);
  if(fill)aSnare(t,.5+(b-12)*.15);else if(b===4||b===12)aSnare(t,secB?1:.75);
  if(secB?true:b%2===0)aHat(t,b%4===2?1:.55);
  // бас восьмыми
  if(b%2===0){const n=root+((b===6||b===14)?12:0);aSyn(t,n,L*1.7,{cut:secB?1100:800,cut2:160,v:.2,rel:.04,det:[-6,6]});aTone(t,'sine',mtof(n-12),L*1.8,.22)}
  // остинато шестнадцатыми
  const nts=chordNotes(ch,24);aSyn(t,nts[ARP[b]],L*.8,{type:'square',cut:secB?3200:2200,cut2:700,v:b%4===0?.05:.035,rel:.04,rev:.22});
  // медные аккорды
  if(b===0&&(secB||bar>=4))chordNotes(ch,12).slice(0,3).forEach(n=>aSyn(t,n,L*15,{cut:500,cut2:secB?2600:1500,fs:.5,v:secB?.045:.03,a:.12,rel:.4,det:[-9,0,9],rev:.45}));
  if(secB&&b===0)aTone(t,'sine',mtof(root),L*14,.12);
  // мелодия
  if(secB&&LEADAT[p]){const[,m,d]=LEADAT[p];aSyn(t,m,L*d*.95,{cut:3800,cut2:2200,v:.085,a:.02,rel:.18,det:[-6,6],vib:14,rev:.45});aSyn(t,m-12,L*d*.95,{type:'square',cut:1800,v:.03,a:.02,rel:.15})}
  if(!secB&&bar>=4&&b%8===0&&LEADAT[(bar-4)*16+b])aSyn(t,LEADAT[(bar-4)*16+b][1]-12,L*6,{type:'triangle',cut:2000,v:.06,a:.03,rel:.3,rev:.5});
}
function auTick(){const c=AU.ctx;if(!c||!AU.run)return;const now=c.currentTime;if(AU.t<now)AU.t=now+.03;
  while(AU.t<now+.3){auStep(AU.step,AU.t);AU.step++;AU.t+=ST}}
function auFade(v,sec){const c=AU.ctx;if(!c)return;const g=AU.out.gain,n=c.currentTime;g.cancelScheduledValues(n);g.setValueAtTime(g.value,n);g.linearRampToValueAtTime(v,n+sec)}
// запуск темы (только из обработчика нажатия: браузеры не дают звук без жеста)
function auStart(intro){
  if(!SET.music||!auCtx())return 0;const c=AU.ctx;c.resume();
  AU.step=intro?-32:128;AU.t=c.currentTime+.08;AU.run=true;auFade(auVol(),intro?.05:1.5);
  clearInterval(AU.timer);AU.timer=setInterval(auTick,60);auTick();return .08;
}
function auStop(sec){if(!AU.run)return;auFade(0,sec||1);clearTimeout(AU.stopT);AU.stopT=setTimeout(()=>{if(AU.out.gain.value<.01){AU.run=false;clearInterval(AU.timer)}},(sec||1)*1000+200)}
// громкость/экран: во время гонки музыка уходит, в меню возвращается
function auScreen(){
  if(!AU.ctx)return;AU.sfx.gain.value=auVol();
  if(!SET.music||UI.screen==='race')return auStop(UI.screen==='race'?1.2:.3);
  clearTimeout(AU.stopT);if(!AU.run)auStart(false);else auFade(auVol(),.8);
}
const sfxLight=()=>{if(AU.ctx&&SET.music){const t=AU.ctx.currentTime;aTone(t,'sine',95,.45,.5,AU.sfx,50)}};
const sfxGo=()=>{if(AU.ctx&&SET.music)aImpact(AU.ctx.currentTime,AU.sfx)};
document.addEventListener('pointerdown',()=>{if(!AU.ctx&&SET.music&&!$('#intro')&&UI.screen!=='race')auStart(false)},true);

/* ---------- заставка ---------- */
function showIntro(){
  if($('#intro'))return;
  const sv=S||load(),yr=sv?(sv.year0||2026)+(sv.season||1)-1:UI.year0,col=sv?((sv.teams.find(t=>t.id===sv.pid)||{}).color||'#ff8a1f'):'#ff8a1f';
  const el=document.createElement('div');el.id='intro';el.className='intro';el.style.setProperty('--team',col);
  el.innerHTML=`<div class="i-streaks"><i></i><i></i><i></i><i></i><i></i><i></i></div>
   <div class="i-top"><span>Чемпионат мира</span><b>Сезон ${yr}</b></div>
   <div class="i-lights">${'<div><i></i><i></i></div>'.repeat(5)}</div>
   <div class="i-logo"><div class="logo">ПИТ<span>-</span>УОЛЛ</div><div class="i-bar"></div><div class="i-sub">Гоночный менеджер</div></div>
   <div class="i-wipe"></div><div class="i-flash"></div>
   <div class="i-tap">Нажмите, чтобы начать</div><div class="i-skip">Нажмите, чтобы пропустить</div>`;
  document.body.appendChild(el);
  const tm=[],cols=el.querySelectorAll('.i-lights div');let done=false;
  const end=()=>{if(done)return;done=true;tm.forEach(clearTimeout);if(AU.run&&AU.step<0){AU.step=0;AU.t=AU.ctx.currentTime+.03}
    el.classList.add('bye');setTimeout(()=>el.remove(),600)};
  const go=()=>{el.classList.remove('wait');el.classList.add('run');
    const off=auStart(true)*1000;
    [2,8,14,20,26].forEach((k,i)=>tm.push(setTimeout(()=>cols[i].classList.add('on'),off+k*ST*1000)));
    tm.push(setTimeout(()=>{cols.forEach(c=>c.classList.remove('on'));el.classList.add('go')},off+32*ST*1000));
    tm.push(setTimeout(end,off+32*ST*1000+3600));};
  el.addEventListener('click',()=>el.classList.contains('wait')?go():end());
  if(SET.music&&AU_OK&&!(AU.ctx&&AU.ctx.state==='running'))el.classList.add('wait');else go();
}
const HAS3D=(()=>{try{if(typeof THREE==='undefined')return false;const c=document.createElement('canvas');return!!(c.getContext('webgl')||c.getContext('experimental-webgl'))}catch(e){return false}})();
const CAMS=[['chase','Погоня'],['tv','ТВ'],['cockpit','Кокпит'],['heli','Вертолёт'],['over','Обзор']];
const SPEEDS=[[0,'Пауза'],[1,'×1'],[2,'×2'],[3,'×3'],[4,'×4'],[16,'×16'],[32,'×32']];
const DIFF_DEV=[.6,1,1.4];

