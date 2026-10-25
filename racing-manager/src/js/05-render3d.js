/* ---------- трасса ---------- */
const pathCache={};
function trackPath(id){
  if(pathCache[id])return pathCache[id];
  const gd=GEO_DATA[id],str=gd[2],ctl=[];
  for(let i=0;i<str.length;i+=6)ctl.push([+str.slice(i,i+3)/999*gd[1],+str.slice(i+3,i+6)/999]);
  // сглаживание Catmull-Rom по равномерным контрольным точкам
  const n=ctl.length,N=640,pts=[],per=N/n;
  for(let i=0;i<N;i++){const s=Math.floor(i/per),t=i/per-s,p0=ctl[(s-1+n)%n],p1=ctl[s%n],p2=ctl[(s+1)%n],p3=ctl[(s+2)%n];
    const cr=(a,b,c,d)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    pts.push([cr(p0[0],p1[0],p2[0],p3[0]),cr(p0[1],p1[1],p2[1],p3[1])])}
  let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;pts.forEach(([x,y])=>{mnx=Math.min(mnx,x);mxx=Math.max(mxx,x);mny=Math.min(mny,y);mxy=Math.max(mxy,y)});
  const norm=pts.map(([x,y])=>[(x-mnx)/(mxx-mnx),(y-mny)/(mxy-mny)]);
  const cum=[0];for(let i=1;i<=N;i++){const a=norm[i-1],b=norm[i%N];cum.push(cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]))}
  // мировой масштаб ≈ метры (болид ~6 единиц)
  return pathCache[id]={pts:norm,cum,len:cum[N],ar:(mxx-mnx)/(mxy-mny),ws:gd[0]*(mxy-mny)*.95};
}
function pointAt(p,f){
  f=((f%1)+1)%1;const d=f*p.len;let lo=0,hi=p.pts.length;
  while(hi-lo>1){const m=(lo+hi)>>1;if(p.cum[m]<=d)lo=m;else hi=m}
  const a=p.pts[lo],b=p.pts[(lo+1)%p.pts.length],t=(d-p.cum[lo])/((p.cum[lo+1]-p.cum[lo])||1);
  return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
}
function fitBox(cv){
  const dpr=Math.min(2,window.devicePixelRatio||1),w=cv.clientWidth,h=cv.clientHeight;
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
  const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w,h};
}
function fitCanvas(cv,ratio){
  const dpr=Math.min(2,window.devicePixelRatio||1),w=cv.clientWidth,h=Math.round(w*ratio);
  cv.style.height=h+'px';if(cv.width!==Math.round(w*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
  const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return{ctx,w,h};
}
function drawTrack(ctx,w,h,p,thick,wet){
  const pad=thick*1.6+6,sx=w-pad*2,sy=h-pad*2,s=Math.min(sx/p.ar,sy),ox=(w-s*p.ar)/2,oy=(h-s)/2;
  const tf=([x,y])=>[ox+x*s*p.ar,oy+y*s];
  ctx.clearRect(0,0,w,h);
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();p.pts.forEach((pt,i)=>{const[x,y]=tf(pt);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();
  ctx.strokeStyle='#2c3a4b';ctx.lineWidth=thick+6;ctx.stroke();
  ctx.strokeStyle=wet?'#1d3550':'#1a232e';ctx.lineWidth=thick;ctx.stroke();
  ctx.setLineDash([2,10]);ctx.strokeStyle='rgba(232,238,244,.18)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
  const a=tf(pointAt(p,0)),b=tf(pointAt(p,.004)),ang=Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2;
  ctx.save();ctx.translate(a[0],a[1]);ctx.rotate(ang);
  for(let i=-2;i<2;i++)for(let j=0;j<2;j++){ctx.fillStyle=(i+j)%2?'#e8eef4':'#0b0f14';ctx.fillRect(i*thick/4,j*3-3,thick/4,3)}
  ctx.restore();
  return tf;
}

/* ---------- 3D: болид ---------- */
const GEO={};
function geo(key,mk){return GEO[key]||(GEO[key]=mk())}
const ACCENT={mclaren:'#1a1a1a',ferrari:'#ffffff',redbull:'#e10600',mercedes:'#101418',williams:'#0a2a6b',rb:'#ffffff',aston:'#cedc00',haas:'#e10600',sauber:'#101418',audi:'#e40521',alpine:'#ff87bc',cadillac:'#101418'};
const accentOf=id=>ACCENT[id]||'#14181d';
const MATS={};
function mat(k,mk){return MATS[k]||(MATS[k]=mk())}
// корпус по сечениям: [z, ширина, высота, центр по y]
function loftGeo(secs,M,n){
  const pos=[],idx=[];
  secs.forEach(([z,w,h,y])=>{for(let k=0;k<M;k++){const a=k/M*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);
    pos.push(Math.sign(c)*Math.pow(Math.abs(c),2/n)*w/2,y+Math.sign(sn)*Math.pow(Math.abs(sn),2/n)*h/2,z)}});
  for(let i=0;i<secs.length-1;i++)for(let k=0;k<M;k++){const a=i*M+k,b=i*M+(k+1)%M,c=(i+1)*M+k,d=(i+1)*M+(k+1)%M;idx.push(a,c,b,b,c,d)}
  [0,secs.length-1].forEach(i=>{const ci=pos.length/3,[z,,,y]=secs[i];pos.push(0,y,z);for(let k=0;k<M;k++)idx.push(ci,i*M+k,i*M+(k+1)%M)});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
// профиль крыла (хорда вдоль z), вытянутый по ширине x
function wingGeo(chord,thick,width){
  const sh=new THREE.Shape();sh.moveTo(0,0);
  sh.bezierCurveTo(chord*.3,thick*1.3,chord*.8,thick*1.2,chord,thick*.45);
  sh.bezierCurveTo(chord*1.02,thick*.1,chord*.8,-thick*.25,0,0);
  const g=new THREE.ExtrudeGeometry(sh,{depth:width,bevelEnabled:false,curveSegments:6});g.translate(0,0,-width/2);g.rotateY(-Math.PI/2);return g;
}
function plateGeo(len,hgt,r,th){
  const sh=new THREE.Shape();sh.moveTo(r,0);sh.lineTo(len-r,0);sh.quadraticCurveTo(len,0,len,r);sh.lineTo(len,hgt-r);sh.quadraticCurveTo(len,hgt,len-r,hgt);sh.lineTo(r,hgt);sh.quadraticCurveTo(0,hgt,0,hgt-r);sh.lineTo(0,r);sh.quadraticCurveTo(0,0,r,0);
  const g=new THREE.ExtrudeGeometry(sh,{depth:th,bevelEnabled:false,curveSegments:4});g.translate(0,0,-th/2);g.rotateY(-Math.PI/2);return g;
}
function tyreGeo(ro,ri,w){
  const rc=.07,pts=[new THREE.Vector2(ri,-w/2),new THREE.Vector2(ro-rc,-w/2)];
  for(let i=1;i<=4;i++){const a=-Math.PI/2+i/4*Math.PI/2;pts.push(new THREE.Vector2(ro-rc+Math.cos(a)*rc,-w/2+rc+Math.sin(a)*rc))}
  for(let i=1;i<=4;i++){const a=i/4*Math.PI/2;pts.push(new THREE.Vector2(ro-rc+Math.cos(a)*rc,w/2-rc+Math.sin(a)*rc))}
  pts.push(new THREE.Vector2(ri,w/2));
  const g=new THREE.LatheGeometry(pts,26);g.rotateZ(Math.PI/2);return g;
}
function buildCarRaw(color,accent){
  const outer=new THREE.Group(),g=new THREE.Group();outer.add(g);g.position.z=-.2;
  const ds=THREE.DoubleSide;
  const paint=new THREE.MeshStandardMaterial({color,roughness:.28,metalness:.45,side:ds});
  const acc=new THREE.MeshStandardMaterial({color:accent||'#14181d',roughness:.35,metalness:.3,side:ds});
  const carbon=mat('carbon',()=>new THREE.MeshStandardMaterial({color:0x14171b,roughness:.5,metalness:.4,side:ds}));
  const black=mat('black',()=>new THREE.MeshStandardMaterial({color:0x07090b,roughness:.4,metalness:.2,side:ds}));
  const tyreM=mat('tyre',()=>new THREE.MeshStandardMaterial({color:0x151515,roughness:.88,metalness:0,side:ds}));
  const rimM=mat('rim',()=>new THREE.MeshStandardMaterial({color:0x2a2f35,roughness:.3,metalness:.85}));
  const helmM=mat('helm',()=>new THREE.MeshStandardMaterial({color:0xf4f4f4,roughness:.2,metalness:.2}));
  const add=(k,mk,m,x=0,y=0,z=0,rx=0)=>{const o=new THREE.Mesh(geo(k,mk),m);o.position.set(x,y,z);o.rotation.x=rx;g.add(o);return o};
  // монокок, нос и капот двигателя
  add('body',()=>loftGeo([[2.95,.08,.07,.23],[2.6,.2,.15,.26],[2.1,.3,.23,.3],[1.6,.4,.31,.35],[1.1,.55,.41,.41],[.6,.7,.5,.46],[.15,.8,.55,.49],[-.3,.8,.62,.54],[-.75,.66,.74,.6],[-1.25,.5,.56,.55],[-1.8,.32,.36,.45],[-2.3,.15,.2,.38]],22,3.2),paint);
  // понтоны
  add('pods',()=>loftGeo([[.7,1.15,.28,.36],[.4,1.5,.36,.37],[-.15,1.56,.36,.36],[-.8,1.36,.3,.33],[-1.4,.95,.22,.3],[-1.95,.5,.15,.28]],22,3),paint);
  add('inlet',()=>new THREE.BoxGeometry(.26,.2,.05),black,.6,.4,.66);add('inlet',()=>new THREE.BoxGeometry(.26,.2,.05),black,-.6,.4,.66);
  // кокпит, воздухозаборник, плавник
  const ck=add('cock',()=>new THREE.SphereGeometry(1,16,8),black,0,.74,.22);ck.scale.set(.27,.07,.48);
  const ab=add('abox',()=>new THREE.SphereGeometry(1,12,8),black,0,.9,-.36);ab.scale.set(.13,.1,.04);
  add('fin',()=>plateGeo(1.1,.32,.08,.025),acc,0,.82,-2.05);
  add('tcam',()=>new THREE.BoxGeometry(.18,.06,.1),acc,0,.97,-.55);
  // днище и диффузор
  add('floor',()=>{const sh=new THREE.Shape();[[-.55,1.3],[.55,1.3],[.85,.9],[.9,-1.4],[.75,-2.05],[-.75,-2.05],[-.9,-1.4],[-.85,.9]].forEach(([x,z],i)=>i?sh.lineTo(x,z):sh.moveTo(x,z));
    const fg=new THREE.ExtrudeGeometry(sh,{depth:.04,bevelEnabled:false});fg.rotateX(Math.PI/2);return fg},carbon,0,.1,0);
  add('diff',()=>new THREE.BoxGeometry(1.0,.16,.3),carbon,0,.17,-2.15,-.35);
  // переднее крыло: три элемента и боковые пластины
  add('fw1',()=>wingGeo(.4,.045,1.9),carbon,0,.09,2.64,.05);
  add('fw2',()=>wingGeo(.28,.035,1.78),paint,0,.15,2.52,.28);
  add('fw3',()=>wingGeo(.2,.03,1.66),acc,0,.22,2.4,.55);
  add('fwep',()=>plateGeo(.72,.3,.07,.025),carbon,.95,.05,2.36);add('fwep',()=>plateGeo(.72,.3,.07,.025),carbon,-.95,.05,2.36);
  // заднее крыло: основной элемент, DRS-закрылок, балочное крыло, пластины, пилон
  add('rw1',()=>wingGeo(.42,.05,1.0),paint,0,.78,-2.62,.12);
  add('rw2',()=>wingGeo(.25,.035,1.0),acc,0,.93,-2.44,.45);
  add('rwb',()=>wingGeo(.2,.03,.72),carbon,0,.42,-2.42,.15);
  add('rwep',()=>plateGeo(.68,.62,.12,.03),carbon,.51,.42,-2.68);add('rwep',()=>plateGeo(.68,.62,.12,.03),carbon,-.51,.42,-2.68);
  add('pyl',()=>new THREE.BoxGeometry(.04,.36,.12),carbon,0,.62,-2.3,.3);
  // Halo
  add('halo',()=>{const c=new THREE.CatmullRomCurve3([[-.27,.7,-.05],[-.3,.8,.35],[-.13,.86,.62],[0,.87,.67],[.13,.86,.62],[.3,.8,.35],[.27,.7,-.05]].map(v=>new THREE.Vector3(...v)));return new THREE.TubeGeometry(c,24,.032,6,false)},carbon);
  add('halop',()=>{const c=new THREE.LineCurve3(new THREE.Vector3(0,.87,.67),new THREE.Vector3(0,.6,.92));return new THREE.TubeGeometry(c,2,.03,6,false)},carbon);
  // шлем пилота
  add('helm',()=>new THREE.SphereGeometry(.13,16,12),helmM,0,.79,.16);
  const vis=add('vis',()=>new THREE.SphereGeometry(.131,16,6,-.9,1.8,1.25,.45),black,0,.79,.16);vis.rotation.y=0;
  // зеркала
  [1,-1].forEach(sx=>{add('mirs',()=>new THREE.BoxGeometry(.18,.025,.03),carbon,.4*sx,.66,.72);add('mir',()=>new THREE.BoxGeometry(.15,.07,.04),paint,.5*sx,.69,.72)});
  // подвеска
  const rod=(a,b)=>{const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),m=new THREE.Mesh(geo('rod',()=>new THREE.CylinderGeometry(.018,.018,1,5)),carbon);
    m.position.copy(va).add(vb).multiplyScalar(.5);m.scale.y=va.distanceTo(vb);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.sub(va).normalize());g.add(m)};
  [1,-1].forEach(sx=>{rod([.2*sx,.44,1.95],[.66*sx,.42,1.78]);rod([.2*sx,.44,1.55],[.66*sx,.42,1.74]);rod([.18*sx,.28,1.9],[.66*sx,.3,1.76]);
    rod([.3*sx,.46,-1.6],[.62*sx,.44,-1.8]);rod([.3*sx,.3,-1.55],[.62*sx,.3,-1.8])});
  // колёса
  // колёса: по оси на переднюю и заднюю пару (вращаются целиком)
  const axles=[];
  [[1.76,.36,.3,.8,'f'],[-1.8,.37,.4,.78,'r']].forEach(([z,r,w,x,k])=>{
    const ag=new THREE.Group();ag.position.set(0,r,z);g.add(ag);
    [x,-x].forEach(wx=>{const a2=(gk,mk,m)=>{const o=new THREE.Mesh(geo(gk,mk),m);o.position.x=wx;ag.add(o)};
      a2('ty'+k,()=>tyreGeo(r,r*.62,w),tyreM);
      a2('rim'+k,()=>{const c=new THREE.CylinderGeometry(r*.63,r*.63,w*.92,18);c.rotateZ(Math.PI/2);return c},rimM);
      a2('cap'+k,()=>{const c=new THREE.CylinderGeometry(r*.5,r*.5,w*.96,12);c.rotateZ(Math.PI/2);return c},acc);
      a2('spk'+k,()=>new THREE.BoxGeometry(w*.97,r*1.1,.05),black)});
    axles.push(ag);
  });
  return{g,axles,mats:{paint,acc,carbon,black,tyre:tyreM,rim:rimM,helm:helmM}};
}
// склейка всех деталей одного материала в одну сетку: в разы меньше вызовов отрисовки
function mergeByMaterial(root,roles){
  root.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),buckets=new Map();
  root.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));
    const role=roles.get(o.material);if(!buckets.has(role))buckets.set(role,[]);buckets.get(role).push(g)});
  const out=[];
  buckets.forEach((gs,role)=>{let n=0;gs.forEach(g=>n+=g.attributes.position.count);const pos=new Float32Array(n*3),nor=new Float32Array(n*3);let o=0;
    gs.forEach(g=>{pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count;g.dispose()});
    const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.BufferAttribute(pos,3));mg.setAttribute('normal',new THREE.BufferAttribute(nor,3));mg.computeBoundingSphere();out.push([role,mg])});
  return out;
}
function carTemplate(){
  if(GEO.carT)return GEO.carT;
  const raw=buildCarRaw('#888888','#444444'),roles=new Map(Object.entries(raw.mats).map(([k,m])=>[m,k]));
  raw.axles.forEach(a=>raw.g.remove(a));
  const T={body:mergeByMaterial(raw.g,roles),axles:raw.axles.map(a=>({pos:a.position.clone(),parts:mergeByMaterial(a,roles)}))};
  raw.mats.paint.dispose();raw.mats.acc.dispose();
  T.body.forEach(([r,gm],i)=>GEO['ct_b'+i]=gm);T.axles.forEach((a,j)=>a.parts.forEach(([r,gm],i)=>GEO['ct_a'+j+'_'+i]=gm));
  // упрощённая модель для дальних машин
  const lowB=new THREE.Group();[[.8,.5,4.6,0,.45,.1],[1.5,.34,1.6,0,.38,-.3],[1.9,.06,.4,0,.12,2.8],[1,.08,.45,0,.85,-2.5]].forEach(([w,h,d,x,y,z])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),raw.mats.carbon);m.position.set(x,y,z);lowB.add(m)});
  const lowW=new THREE.Group();[[.8,1.76,.36],[-.8,1.76,.36],[.78,-1.8,.37],[-.78,-1.8,.37]].forEach(([x,z,r])=>{const c=new THREE.CylinderGeometry(r,r,.35,8);c.rotateZ(Math.PI/2);const m=new THREE.Mesh(c,raw.mats.black);m.position.set(x,r,z);lowW.add(m)});
  T.low=[mergeByMaterial(lowB,new Map([[raw.mats.carbon,'paint']]))[0][1],mergeByMaterial(lowW,new Map([[raw.mats.black,'black']]))[0][1]];
  GEO.ct_l0=T.low[0];GEO.ct_l1=T.low[1];
  return GEO.carT=T;
}
function carMesh(color,shadow,accent,lod){
  const T=carTemplate(),ds=THREE.DoubleSide;
  const M={paint:SET.gfx>=2||!lod?new THREE.MeshPhysicalMaterial({color,roughness:.32,metalness:.35,clearcoat:1,clearcoatRoughness:.06,side:ds}):new THREE.MeshStandardMaterial({color,roughness:.28,metalness:.45,side:ds}),acc:new THREE.MeshStandardMaterial({color:accent||'#14181d',roughness:.35,metalness:.3,side:ds}),
    carbon:MATS.carbon,black:MATS.black,tyre:MATS.tyre,rim:MATS.rim,helm:MATS.helm};
  const outer=new THREE.Group(),g=new THREE.Group();outer.add(g);g.position.z=-.2;
  T.body.forEach(([r,gm])=>g.add(new THREE.Mesh(gm,M[r])));
  const wheels=T.axles.map(a=>{const ag=new THREE.Group();ag.position.copy(a.pos);a.parts.forEach(([r,gm])=>ag.add(new THREE.Mesh(gm,M[r])));g.add(ag);return ag});
  if(shadow)outer.traverse(o=>{if(o.isMesh)o.castShadow=true});
  outer.scale.setScalar(1.1);
  if(!lod)return{g:outer,wheels,paint:M.paint};
  const low=new THREE.Group(),lg=new THREE.Group();low.add(lg);lg.position.z=-.2;lg.add(new THREE.Mesh(T.low[0],M.paint),new THREE.Mesh(T.low[1],M.black));low.scale.setScalar(1.1);
  const L=new THREE.LOD();L.addLevel(outer,0);L.addLevel(low,lod);
  return{g:L,wheels,paint:M.paint};
}
function safetyCar(){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(2,1,4.4),new THREE.MeshStandardMaterial({color:0xc9ced4,roughness:.3,metalness:.7}));body.position.y=.7;g.add(body);
  const cab=new THREE.Mesh(new THREE.BoxGeometry(1.7,.6,2),new THREE.MeshStandardMaterial({color:0x1b232c,roughness:.2,metalness:.5}));cab.position.set(0,1.45,-.3);g.add(cab);
  const bar=new THREE.Mesh(new THREE.BoxGeometry(1.4,.18,.3),new THREE.MeshBasicMaterial({color:0xffa31a}));bar.position.set(0,1.85,-.3);g.add(bar);
  g.scale.setScalar(1.25);return g;
}
function dotTexture(color){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  x.beginPath();x.arc(32,32,26,0,Math.PI*2);x.fillStyle=color;x.fill();x.lineWidth=7;x.strokeStyle='#0b0f14';x.stroke();
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;
}
function labelTex(text,color){
  const c=document.createElement('canvas');c.width=128;c.height=80;const x=c.getContext('2d');
  x.fillStyle=color;x.fillRect(14,4,100,52);x.beginPath();x.moveTo(52,56);x.lineTo(76,56);x.lineTo(64,74);x.fill();
  x.fillStyle='#0b0f14';x.font='bold 38px JetBrains Mono, monospace';x.textAlign='center';x.textBaseline='middle';x.fillText(text,64,31);
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;
}

/* ---------- 3D: трасса ---------- */
function trackFrames(p){
  const N=p.pts.length,F=[];
  const P=i=>{const a=p.pts[((i%N)+N)%N];return[(a[0]-.5)*p.ar*p.ws,(a[1]-.5)*p.ws]};
  for(let i=0;i<N;i++){const a=P(i-1),b=P(i+1),c=P(i);let tx=b[0]-a[0],tz=b[1]-a[1];const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;F.push({x:c[0],z:c[1],nx:-tz,nz:tx,tx,tz})}
  for(let i=0;i<N;i++){const A=F[(i-3+N)%N],B=F[(i+3)%N];F[i].k=Math.abs(Math.atan2(A.tx*B.tz-A.tz*B.tx,A.tx*B.tx+A.tz*B.tz))}
  let len=0;for(let i=0;i<N;i++){F[i].d=len;const b=F[(i+1)%N];len+=Math.hypot(b.x-F[i].x,b.z-F[i].z)}
  F.len=len;return F;
}
function ribbonGeo(F,o1,o2,y1,y2,colorFn,skip){
  const pos=[],col=[],uv=[],N=F.length,c=new THREE.Color();
  for(let i=0;i<N;i++){
    if(skip&&skip(i))continue;
    const a=F[i],b=F[(i+1)%N],va=a.d/8,vb=(i+1===N?F.len:b.d)/8;
    uv.push(0,va,1,va,0,vb,1,va,1,vb,0,vb);
    pos.push(a.x+a.nx*o1,y1,a.z+a.nz*o1, a.x+a.nx*o2,y2,a.z+a.nz*o2, b.x+b.nx*o1,y1,b.z+b.nz*o1,
             a.x+a.nx*o2,y2,a.z+a.nz*o2, b.x+b.nx*o2,y2,b.z+b.nz*o2, b.x+b.nx*o1,y1,b.z+b.nz*o1);
    if(colorFn){c.set(colorFn(i));for(let k=0;k<6;k++)col.push(c.r,c.g,c.b)}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  if(colorFn)g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();return g;
}
const w3=(f,off)=>w3f(G.F,f,off);
function w3f(F,f,off){
  const N=F.length,x=(((f%1)+1)%1)*N,i=Math.floor(x),t=x-i,a=F[i%N],b=F[(i+1)%N];
  let tx=a.tx+(b.tx-a.tx)*t,tz=a.tz+(b.tz-a.tz)*t;const l=Math.hypot(tx,tz)||1;tx/=l;tz/=l;
  return{x:a.x+(b.x-a.x)*t+(-tz)*off,z:a.z+(b.z-a.z)*t+tx*off,tx,tz};
}
// процедурные текстуры
function canvasTex(size,draw,rx,ry){const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;t.repeat.set(rx||1,ry||1);return t}
function speckle(x,n,sz,cols){for(let i=0;i<n;i++){x.fillStyle=cols[i%cols.length];const r=Math.random()*sz+.5;x.fillRect(Math.random()*x.canvas.width,Math.random()*x.canvas.height,r,r)}}
const grassTex=r=>canvasTex(512,(x,s)=>{x.fillStyle='#3a722f';x.fillRect(0,0,s,s);for(let i=0;i<8;i++){x.fillStyle=i%2?'rgba(255,255,255,.022)':'rgba(0,0,0,.028)';x.fillRect(0,i*s/8,s,s/8)}
  speckle(x,9000,2,['rgba(30,70,25,.55)','rgba(90,140,60,.45)','rgba(60,110,40,.5)','rgba(120,150,70,.25)'])},r,r);
const asphaltTex=()=>canvasTex(256,(x,s)=>{x.fillStyle='#34383e';x.fillRect(0,0,s,s);speckle(x,7000,1.6,['rgba(0,0,0,.35)','rgba(255,255,255,.10)','rgba(90,95,105,.4)','rgba(20,22,25,.5)']);
  x.fillStyle='rgba(0,0,0,.18)';x.fillRect(s*.42,0,s*.16,s)},1,1);
const noiseTex=()=>canvasTex(256,(x,s)=>{x.fillStyle='#d8d8d8';x.fillRect(0,0,s,s);speckle(x,6000,2,['rgba(0,0,0,.18)','rgba(255,255,255,.25)','rgba(80,80,80,.2)'])},1,1);
function linearize(root){
  const lin=a=>{for(let i=0;i<a.length;i++)a[i]=Math.pow(a[i],2.2)};
  root.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
    ms.forEach(m=>{if(m.userData.lin)return;m.userData.lin=1;if(m.color)m.color.convertSRGBToLinear();if(m.map)m.map.encoding=THREE.sRGBEncoding;m.needsUpdate=true});
    const g=o.geometry;if(g&&g.attributes&&g.attributes.color&&!g.userData.lin){g.userData.lin=1;lin(g.attributes.color.array);g.attributes.color.needsUpdate=true}
    if(o.isInstancedMesh&&o.instanceColor&&!o.userData.lin){o.userData.lin=1;lin(o.instanceColor.array);o.instanceColor.needsUpdate=true}});
}
function skyColors(geo,R0,wet){
  const top=new THREE.Color(wet?0x5a6876:0x2a67c4),hor=new THREE.Color(wet?0xa4afb9:0xd6eaf6),pa=geo.attributes.position,col=[],c=new THREE.Color();
  for(let i=0;i<pa.count;i++){c.copy(hor).lerp(top,clamp(pa.getY(i)/R0*1.7,0,1)).convertSRGBToLinear();col.push(c.r,c.g,c.b)}
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.userData.lin=1;return hor;
}
function buildEnv(renderer,wet){
  const es=new THREE.Scene(),sg=new THREE.SphereGeometry(50,32,16);skyColors(sg,50,wet);
  es.add(new THREE.Mesh(sg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
  const gr=new THREE.Mesh(new THREE.CircleGeometry(49,32),new THREE.MeshBasicMaterial({color:new THREE.Color(0x35602c).convertSRGBToLinear()}));gr.rotation.x=-Math.PI/2;gr.position.y=-2;es.add(gr);
  if(!wet){const sunM=new THREE.Mesh(new THREE.SphereGeometry(3,12,8),new THREE.MeshBasicMaterial({color:new THREE.Color(12,11,9)}));sunM.position.set(24,38,15);es.add(sunM)}
  const pm=new THREE.PMREMGenerator(renderer),rt=pm.fromScene(es,.035);pm.dispose();sg.dispose();
  return rt;
}
function glowTex(){return canvasTex(128,(x,s)=>{const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,252,240,1)');g.addColorStop(.15,'rgba(255,240,200,.9)');g.addColorStop(.45,'rgba(255,220,160,.25)');g.addColorStop(1,'rgba(255,220,160,0)');x.fillStyle=g;x.fillRect(0,0,s,s)})}
function cloudTex(){return canvasTex(256,(x,s)=>{for(let i=0;i<18;i++){const cx=s*(.2+Math.random()*.6),cy=s*(.45+Math.random()*.2),r=s*(.08+Math.random()*.16);const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,s,s)}})}
let G=null;
function init3D(cv){
  const q=SET.gfx,p=R.path,F=trackFrames(p),D=Math.max(p.ar,1)*p.ws,SKY=Math.max(2600,D*2.6);
  const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:q>0,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,[1,1.5,2,2][q]));
  renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  renderer.shadowMap.enabled=q>=1;if(q>=2)renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const aniso=renderer.capabilities.getMaxAnisotropy();
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1,.3,SKY*1.6);
  const hemi=new THREE.HemisphereLight(0xd6ecff,0x41612f,.75);scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff0d6,2.1);sun.position.set(250,420,160);scene.add(sun);scene.add(sun.target);
  if(q>=1){sun.castShadow=true;const ms=[0,1024,2048,4096][q];sun.shadow.mapSize.set(ms,ms);const sc=sun.shadow.camera;sc.left=-80;sc.right=80;sc.top=80;sc.bottom=-80;sc.near=10;sc.far=900;sun.shadow.bias=-.0006}
  const skyG=new THREE.SphereGeometry(SKY,32,16);
  scene.add(new THREE.Mesh(skyG,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})));
  scene.fog=new THREE.Fog(0xcfe6f7,350,2400);
  const gt=grassTex(SKY*2.4/28);gt.anisotropy=aniso;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(SKY*2.4,SKY*2.4),new THREE.MeshLambertMaterial({map:gt}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=q>=1;scene.add(ground);
  // солнце и облака
  const sunDir=sun.position.clone().normalize();
  const sunSp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex(),fog:false,depthWrite:false,transparent:true,blending:THREE.AdditiveBlending}));sunSp.position.copy(sunDir).multiplyScalar(SKY*.85);sunSp.scale.set(SKY*.22,SKY*.22,1);scene.add(sunSp);
  const clouds=new THREE.Group();scene.add(clouds);
  if(q>=1){const ct=cloudTex();for(let i=0;i<16;i++){const a=i/16*Math.PI*2+rnd(-.2,.2),r=SKY*rnd(.55,.8),cm=new THREE.SpriteMaterial({map:ct,fog:false,depthWrite:false,transparent:true,opacity:rnd(.55,.9)});
    const cs=new THREE.Sprite(cm);cs.position.set(Math.cos(a)*r,SKY*rnd(.14,.3),Math.sin(a)*r);const sc=SKY*rnd(.18,.32);cs.scale.set(sc,sc*.45,1);clouds.add(cs)}}
  const lam=(c,o={})=>new THREE.MeshLambertMaterial(Object.assign({color:c,side:THREE.DoubleSide},o));
  const at=asphaltTex();at.anisotropy=aniso;
  const asphalt=new THREE.MeshStandardMaterial({color:0xb4b8bf,map:at,roughness:.9,metalness:0,side:THREE.DoubleSide});
  const mesh=(g,m,shadow)=>{const o=new THREE.Mesh(g,m);if(shadow&&q>=1)o.receiveShadow=true;scene.add(o);return o};
  const ks=F.map(f=>f.k).sort((a,b)=>a-b),kt=ks[Math.floor(ks.length*.68)];
  // зона безопасности: гравий в поворотах, асфальт на прямых, дальше трава
  const nt=noiseTex();nt.anisotropy=aniso;
  const runC=i=>F[i].k>=kt?0xc4ad7c:0x5d636b;
  mesh(ribbonGeo(F,7.8,15,.04,.04,runC),lam(0xffffff,{vertexColors:true,map:nt}),true);mesh(ribbonGeo(F,-15,-7.8,.04,.04,runC),lam(0xffffff,{vertexColors:true,map:nt}),true);
  mesh(ribbonGeo(F,-8,8,.05,.05),lam(0x585e66,{map:nt}),true);
  mesh(ribbonGeo(F,-6.5,6.5,.07,.07),asphalt,true);
  mesh(ribbonGeo(F,5.8,6.2,.09,.09),lam(0xeef2f6));mesh(ribbonGeo(F,-6.2,-5.8,.09,.09),lam(0xeef2f6));
  const kc=i=>Math.floor(i/2)%2?0xe8eef4:0xd8322a,skip=i=>F[i].k<kt;
  mesh(ribbonGeo(F,6.2,8,.1,.1,kc,skip),lam(0xffffff,{vertexColors:true}));
  mesh(ribbonGeo(F,-8,-6.2,.1,.1,kc,skip),lam(0xffffff,{vertexColors:true}));
  const ads=S.teams.map(t=>t.color);
  const adc=i=>Math.floor(i/6)%2?0xf2f4f6:ads[Math.floor(i/12)%ads.length];
  const wallM=lam(0xffffff,{vertexColors:true});
  const crowded=(i,o)=>{const a=F[i],x=a.x+a.nx*o,z=a.z+a.nz*o,N=F.length;for(let j=0;j<N;j+=2){const di=Math.min(Math.abs(j-i),N-Math.abs(j-i));if(di<25)continue;const dx=F[j].x-x,dz=F[j].z-z;if(dx*dx+dz*dz<18*18)return true}return false};
  // старт-финиш
  const ck=document.createElement('canvas');ck.width=128;ck.height=32;const cx=ck.getContext('2d');
  for(let i=0;i<16;i++)for(let j=0;j<4;j++){cx.fillStyle=(i+j)%2?'#0b0f14':'#f4f4f4';cx.fillRect(i*8,j*8,8,8)}
  const sl=new THREE.Mesh(new THREE.PlaneGeometry(13,3),new THREE.MeshLambertMaterial({map:new THREE.CanvasTexture(ck)}));
  sl.rotation.order='YXZ';sl.rotation.y=Math.atan2(F[0].tx,F[0].tz);sl.rotation.x=-Math.PI/2;sl.position.set(F[0].x,.12,F[0].z);scene.add(sl);
  // стартовая решётка
  const gridM=lam(0xe8eef4);
  for(let i=0;i<R.cars.length;i++){const s=w3f(F,-(5+i*8)/F.len,(i+1)%2?-3:3);const gb=new THREE.Mesh(geo('gridbox',()=>new THREE.PlaneGeometry(3,.4)),gridM);gb.rotation.order='YXZ';gb.rotation.y=Math.atan2(s.tx,s.tz);gb.rotation.x=-Math.PI/2;gb.position.set(s.x,.11,s.z);scene.add(gb)}
  // расстояние до трассы
  const near=(x,z,r)=>{for(let i=0;i<F.length;i+=3){const dx=F[i].x-x,dz=F[i].z-z;if(dx*dx+dz*dz<r*r)return true}return false};
  // трибуны и пит-здание
  const blocked=[];
  const concrete=lam(0x9aa3ad),dark=lam(0x3a4049),roofM=lam(0xe4e8ec),glass=new THREE.MeshLambertMaterial({color:0x9ec9e6,transparent:true,opacity:.35,side:THREE.DoubleSide});
  const seatSets=[[0x1d4ed8,0xf4f4f4],[0xd8322a,0xf4f4f4],[0x1e9a55,0xf2c230],[0x6b7280,0xff8000]];
  function grandstand(L,rows,fill,seats){
    const g=new THREE.Group(),d=1.05,h=.55,f0=1.6,dep=rows*d,top=f0+rows*h;
    const sh=new THREE.Shape();sh.moveTo(0,0);sh.lineTo(0,f0);
    for(let j=0;j<rows;j++){sh.lineTo(j*d,f0+(j+1)*h);sh.lineTo((j+1)*d,f0+(j+1)*h)}
    sh.lineTo(dep,top+2.4);sh.lineTo(dep+.5,top+2.4);sh.lineTo(dep+.5,0);sh.lineTo(0,0);
    const eg=new THREE.ExtrudeGeometry(sh,{depth:L,bevelEnabled:false});eg.translate(0,0,-L/2);
    const body=new THREE.Mesh(eg,concrete);if(q>=2)body.castShadow=true;if(q>=1)body.receiveShadow=true;g.add(body);
    for(let j=0;j<rows;j++){const st=new THREE.Mesh(geo('seat'+L,()=>new THREE.BoxGeometry(d*.5,.28,L-.8)),lam(seats[j%2]));st.position.set(j*d+d*.62,f0+(j+1)*h+.14,0);g.add(st)}
    // рекламный бортик и стекло
    const ad=new THREE.Mesh(new THREE.BoxGeometry(.12,1.1,L),lam(0x111827));ad.position.set(-.06,.55,0);g.add(ad);
    const gl=new THREE.Mesh(new THREE.PlaneGeometry(L,1.1),glass);gl.rotation.y=Math.PI/2;gl.position.set(-.05,f0+.55,0);g.add(gl);
    // торцевые стены
    [-1,1].forEach(e=>{const sg2=new THREE.ShapeGeometry(sh);const w=new THREE.Mesh(sg2,dark);w.position.z=e*L/2;g.add(w)});
    // крыша-козырёк на колоннах
    const roof=new THREE.Mesh(new THREE.BoxGeometry(dep+4,.35,L+1.5),roofM);roof.position.set(dep/2-.8,top+6,0);roof.rotation.z=.07;if(q>=1)roof.castShadow=true;g.add(roof);
    for(let z=-L/2+1;z<=L/2-1;z+=Math.max(8,L/6)){const c=new THREE.Mesh(geo('col',()=>new THREE.CylinderGeometry(.22,.26,1,8)),lam(0xc3cad1));c.scale.y=top+6.2;c.position.set(dep+.2,(top+6.2)/2,z);g.add(c)}
    // зрители
    if(fill>0){const per=Math.floor(L/.72),n=Math.floor(rows*per*fill),cm=new THREE.InstancedMesh(geo('fan',()=>new THREE.BoxGeometry(.42,.78,.34)),new THREE.MeshLambertMaterial({color:0xffffff}),n),m4=new THREE.Matrix4(),c=new THREE.Color();
      let k=0;for(let j=0;j<rows&&k<n;j++)for(let i=0;i<per&&k<n;i++){if(Math.random()>fill)continue;m4.makeTranslation(j*d+d*.45,f0+(j+1)*h+.52,-L/2+.6+i*.72+rnd(-.08,.08));cm.setMatrixAt(k,m4);if(cm.setColorAt)cm.setColorAt(k,c.setHSL(Math.random(),rnd(.4,.8),rnd(.35,.65)));k++}
      cm.count=k;g.add(cm)}
    return{g,dep};
  }
  function standFits(i,side,off,dep,L){
    const f=F[i];
    for(const u of[0,.5,1])for(const v of[-.5,-.25,0,.25,.5]){const o=off+u*(dep+1),x=f.x+f.nx*side*o+f.tx*v*L,z=f.z+f.nz*side*o+f.tz*v*L;
      if(near(x,z,11.5))return false;if(blocked.some(b=>Math.hypot(b.x-x,b.z-z)<b.r))return false}
    return true;
  }
  function place(obj,i,side,off,L){
    const f=F[i];obj.position.set(f.x+f.nx*side*off,0,f.z+f.nz*side*off);obj.rotation.y=Math.atan2(f.tx,f.tz)+(side>0?Math.PI:0);scene.add(obj);
    blocked.push({x:f.x+f.nx*side*(off+8),z:f.z+f.nz*side*(off+8),r:L/2+12});
  }
  const fill=[0,.45,.8,.95][q],N0=F.length,iMain=(N0-10)%N0;
  const sideFree=sd=>standFits(iMain,sd,22,16,100);
  const sMain=sideFree(1)?1:sideFree(-1)?-1:0;
  if(sMain){const st=grandstand(100,14,fill,seatSets[0]);place(st.g,iMain,sMain,22,100)}
  // пит-здание с боксами на другой стороне
  const pSide=sMain?-sMain:1;R._pS=pSide;R._pL=F.len;R._pg=null;
  const pg0=pitGeo(),fm=m=>1+m/F.len,iB=Math.round((F.len-110)/F.len*N0)%N0;
  {// полоса пит-лейна: переменное смещение, асфальт и белые линии
    const strip=(o1,o2,y,mat,boxFree)=>{const pos=[];for(let m=-pg0.len;m<0;m+=3){const m2=Math.min(0,m+3);
      const A=w3f(F,fm(m),0),B=w3f(F,fm(m2),0),oA=pitOff(m)*pSide,oB=pitOff(m2)*pSide,
        P=(S0,o)=>[S0.x+(-S0.tz)*o*pSide,y,S0.z+S0.tx*o*pSide];
      const a1=P(A,oA+o1(m)),a2=P(A,oA+o2(m)),b1=P(B,oB+o1(m2)),b2=P(B,oB+o2(m2));pos.push(...a1,...a2,...b1,...a2,...b2,...b1)}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return mesh(g,mat,true)};
    const wide=m=>m>-pg0.len+PIT.inR&&m<-PIT.outR?5.2:2.6;
    strip(()=>-2.6,wide,.065,asphalt);
    strip(()=>-2.75,()=>-2.45,.09,lam(0xeef2f6));
    strip(m=>wide(m)-.15,wide,.09,lam(0xeef2f6));
    // линия ограничителя скорости на въезде и выезде
    [-pg0.len+PIT.inR,-PIT.outR].forEach(m=>{const S0=w3f(F,fm(m),PIT.fast*pSide);const b=new THREE.Mesh(new THREE.PlaneGeometry(5.5,.5),lam(0xf2c230));b.rotation.order='YXZ';b.rotation.y=Math.atan2(S0.tx,S0.tz);b.rotation.x=-Math.PI/2;b.position.set(S0.x,.1,S0.z);scene.add(b)});
  }
  // боксы команд: цветная разметка, ворота гаража и механики
  const crews={};
  S.teams.forEach(t=>{const bm=pg0.box[t.id],S0=w3f(F,fm(bm),PIT.work*pSide),yaw=Math.atan2(S0.tx,S0.tz),nx=-S0.tz*pSide,nz=S0.tx*pSide;
    const mk=new THREE.Mesh(new THREE.PlaneGeometry(2.6,5.4),lam(t.color,{transparent:true,opacity:.55}));mk.rotation.order='YXZ';mk.rotation.y=yaw;mk.rotation.x=-Math.PI/2;mk.position.set(S0.x,.08,S0.z);scene.add(mk);
    const dr=new THREE.Mesh(new THREE.BoxGeometry(6.5,4.2,.3),lam(t.color));dr.rotation.y=yaw+Math.PI/2;dr.position.set(S0.x+nx*2.6,2.1,S0.z+nz*2.6);scene.add(dr);
    const mat=lam(t.color),men=[],idle=[];
    for(let j=0;j<8;j++){const mm=new THREE.Mesh(geo('mech',()=>new THREE.BoxGeometry(.5,1.7,.45)),mat);const v=new THREE.Vector3(S0.x+nx*1.8+S0.tx*(-2.6+j*.75),.85,S0.z+nz*1.8+S0.tz*(-2.6+j*.75));mm.position.copy(v);scene.add(mm);men.push(mm);idle.push(v)}
    // во время стоянки: по механику у каждого колеса, домкраты спереди и сзади, двое у кокпита
    crews[t.id]={men,idle,st:null,act:[[1.6,1.4],[1.6,-1.4],[-1.6,1.4],[-1.6,-1.4],[3.4,0],[-3.4,0],[0,1.6],[0,-1.6]].map(([a,b])=>[a,b*pSide])}});
  if(standFits(iB,pSide,22.5,12,110)){
    const pg=new THREE.Group();
    const bld=new THREE.Mesh(new THREE.BoxGeometry(12,9,110),lam(0xeef1f4));bld.position.set(8,4.5,0);pg.add(bld);
    const top2=new THREE.Mesh(new THREE.BoxGeometry(9,3,110),glass);top2.position.set(7,10.5,0);pg.add(top2);
    place(pg,iB,pSide,23.6,110);
  }
  // ограждение с рекламой; на стороне боксов — проёмы на въезде и выезде пит-лейна
  const pitGap=(i,o)=>{if(Math.sign(o)!==R._pS)return false;const m=F[i].d-F.len,pg=pitGeo();return(m>-pg.len-4&&m<-pg.len+PIT.inR)||m>-PIT.outR-4};
  [17,-17].forEach(o=>{const w=mesh(ribbonGeo(F,o,o,0,1.4,adc,i=>crowded(i,o)||pitGap(i,o)),wallM,true);if(q>=2)w.castShadow=true});
  // трибуны в поворотах (снаружи поворота, где есть место)
  const peaks=[];for(let i=0;i<N0;i++){const k=F[i].k;if(k>=F[(i+N0-4)%N0].k&&k>=F[(i+4)%N0].k)peaks.push(i)}
  peaks.sort((a,b)=>F[b].k-F[a].k);
  const want=[1,3,5,6][q],used=[iMain];
  for(const i of peaks){if(used.length>want)break;if(used.some(u=>Math.min(Math.abs(u-i),N0-Math.abs(u-i))<N0/9))continue;
    const A=F[(i-4+N0)%N0],B=F[(i+4)%N0],cross=A.tx*B.tz-A.tz*B.tx,out=cross>0?-1:1;
    for(const sd of[out,-out]){if(standFits(i,sd,24,10,56)){const st=grandstand(56,9,fill,seatSets[used.length%seatSets.length]);place(st.g,i,sd,24,56);used.push(i);break}}
  }
  // деревья
  const trees=[0,160,380,700][q]+60;
  const tg=new THREE.ConeGeometry(4.2,12,8),trg=new THREE.CylinderGeometry(.6,.8,3,6),dg=new THREE.IcosahedronGeometry(5,1);dg.scale(1,.85,1);
  const tm=new THREE.InstancedMesh(tg,new THREE.MeshLambertMaterial({color:0xffffff}),trees),trm=new THREE.InstancedMesh(trg,new THREE.MeshLambertMaterial({color:0x5b4030}),trees),dm=new THREE.InstancedMesh(dg,new THREE.MeshLambertMaterial({color:0xffffff}),trees);
  let dPlaced=0;
  const m4=new THREE.Matrix4(),col=new THREE.Color(),X=p.ar*p.ws*.5+220,Z=p.ws*.5+220;let placed=0;
  for(let a=0;a<trees*8&&placed<trees;a++){const x=rnd(-X,X),z=rnd(-Z,Z);if(near(x,z,30)||blocked.some(b=>Math.hypot(b.x-x,b.z-z)<b.r+6))continue;const s=rnd(.7,1.5);
    m4.makeScale(s,s,s);m4.setPosition(x,1.5*s,z);trm.setMatrixAt(placed,m4);
    if(Math.random()<.42){m4.makeScale(s,s,s);m4.setPosition(x,6.8*s,z);dm.setMatrixAt(dPlaced,m4);if(dm.setColorAt)dm.setColorAt(dPlaced,col.setHSL(rnd(.2,.32),rnd(.4,.65),rnd(.25,.38)));dPlaced++;m4.makeScale(0,0,0);tm.setMatrixAt(placed,m4)}
    else{m4.makeScale(s,s,s);m4.setPosition(x,6*s+2.6*s,z);tm.setMatrixAt(placed,m4)}
    if(tm.setColorAt)tm.setColorAt(placed,col.setHSL(rnd(.26,.38),rnd(.35,.6),rnd(.16,.28)));placed++}
  tm.count=placed;trm.count=placed;dm.count=dPlaced;if(q>=2){tm.castShadow=true;dm.castShadow=true}scene.add(tm);scene.add(trm);scene.add(dm);
  // дальние холмы
  const hillM=new THREE.MeshLambertMaterial({color:0x5d7f55});
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2,r=D*rnd(.9,1.3)+700;const h=new THREE.Mesh(geo('hill',()=>new THREE.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2)),hillM);h.scale.set(rnd(260,480),rnd(80,220),rnd(260,480));h.position.set(Math.cos(a)*r,-5,Math.sin(a)*r);scene.add(h)}
  // дождь
  const rn=q===0?700:q===3?2600:1600,ra=new Float32Array(rn*3);for(let i=0;i<rn;i++){ra[i*3]=rnd(-60,60);ra[i*3+1]=rnd(0,50);ra[i*3+2]=rnd(-60,60)}
  const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(ra,3));
  const rain=new THREE.Points(rg,new THREE.PointsMaterial({color:0xc4d8ea,size:.07,transparent:true,opacity:.6}));scene.add(rain);
  // машины
  const cars={};
  const dotTex={},sprayTex=q>=1?glowTex():null;
  R.cars.forEach(c=>{const t=team(c.tid),m=carMesh(t.color,q>=1,accentOf(t.id),[90,140,190,260][q]);scene.add(m.g);const o={m,lane:0,prev:null,spin:0};
    if(c.me){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTex('–',t.color),depthTest:false}));sp.scale.set(3.1,1.95,1);sp.position.y=3;m.g.add(sp);o.label=sp;o.ltxt='–'}
    if(!dotTex[t.color])dotTex[t.color]=dotTexture(t.color);
    const mk=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex[t.color],depthTest:false}));mk.visible=false;mk.renderOrder=5;scene.add(mk);o.mk=mk;
    // водяная пыль за машиной в дождь (только средняя графика и выше)
    if(q>=1){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:sprayTex,transparent:true,opacity:.5,depthWrite:false,color:0xdfe8f0}));sp.scale.set(4.2,2,1);sp.visible=false;scene.add(sp);o.spray=sp}
    cars[c.did]=o});
  // дым: общий пул спрайтов (сходы, ошибки пилотов, старт)
  const smokeTex=glowTex(),smoke=[];for(let i=0;i<(q>=1?36:14);i++){const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex,transparent:true,opacity:0,depthWrite:false,color:0x9aa1a8}));sp.visible=false;scene.add(sp);smoke.push({sp,life:0})}
  // следы шин на стартовой решётке появляются после старта
  const marks=new THREE.Group();marks.visible=false;scene.add(marks);{const mm=new THREE.MeshBasicMaterial({color:0x111214,transparent:true,opacity:.55,depthWrite:false});
    for(let i=0;i<R.cars.length;i++)for(const dx of[-.75,.75]){const s0=w3f(F,-(6+i*8)/F.len+3/F.len,((i+1)%2?-3:3)+dx);const m=new THREE.Mesh(geo('mark',()=>new THREE.PlaneGeometry(.32,7)),mm);m.rotation.order='YXZ';m.rotation.y=Math.atan2(s0.tx,s0.tz);m.rotation.x=-Math.PI/2;m.position.set(s0.x,.075,s0.z);marks.add(m)}}
  const sc=safetyCar();sc.visible=false;scene.add(sc);
  // ТВ-камеры вдоль трассы
  const tv=[];for(let i=0;i<28;i++){const f=F[Math.floor(i/28*F.length)],s=i%2?1:-1;if(near(f.x+f.nx*s*26,f.z+f.nz*s*26,20))continue;tv.push(new THREE.Vector3(f.x+f.nx*s*26,6+rnd(0,6),f.z+f.nz*s*26))}
  G={clouds,sunSp,D,SKY,renderer,scene,camera,sun,hemi,skyG,asphalt,rain,cars,sc,tv,F,w:0,h:0,wet:null,dir:new THREE.Vector3(0,0,1),look:new THREE.Vector3(),tvIdx:-1,fov:55,ov:{x:0,z:0,zoom:1,follow:false},path:p,crews,smoke,marks};
  linearize(scene);hemi.color.convertSRGBToLinear();hemi.groundColor.convertSRGBToLinear();sun.color.convertSRGBToLinear();
  setWeather3D(R.wet[0]);
}
function setWeather3D(wet){
  G.wet=wet;
  const hor=skyColors(G.skyG,G.SKY,wet);
  G.scene.fog.color.copy(hor).convertSRGBToLinear();
  if(G.env)G.env.dispose();G.env=buildEnv(G.renderer,wet);G.scene.environment=G.env.texture;
  G.sunSp.visible=!wet;G.clouds.children.forEach(c=>{c.material.color.setScalar(wet?.55:1)});G.scene.fog.near=wet?150:G.D*.5;G.scene.fog.far=wet?1400:Math.max(2400,G.D*2.4);
  G.asphalt.color.set(wet?0x7d838c:0xb4b8bf).convertSRGBToLinear();G.asphalt.roughness=wet?.18:.9;G.asphalt.metalness=wet?.25:0;G.asphalt.envMapIntensity=wet?1.4:.35;
  G.sun.intensity=wet?.7:2.1;G.hemi.intensity=wet?.85:.75;G.rain.visible=wet;
}
function dispose3D(){
  if(!G)return;if(G.env)G.env.dispose();
  try{G.scene.traverse(o=>{if(o.geometry&&!Object.values(GEO).includes(o.geometry))o.geometry.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(m.map)m.map.dispose();m.dispose()})});
  G.renderer.dispose();G.renderer.forceContextLoss()}catch(e){diag('освобождение 3D-сцены',e)}
  G=null;
}
function carProg3D(c,T){
  const p=carProgress(c,T);
  if(c.out)return{prog:c.parkF||0,out:true};
  if(p.done){const end=c.cum[R.N];return{prog:R.N+(T-end)/(R.track.base*1.6),done:true}}
  return{prog:p.laps+p.f,pit:p.pit};
}
function draw3D(dt){
  const cv=G.renderer.domElement,w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
  // авто-разрешение: держим плавность, снижая чёткость на слабых устройствах
  if(dt>0){G.ft=G.ft?G.ft*.93+dt*.07:dt;G.rt=(G.rt||0)+dt;
    if(G.rt>1.2){G.rt=0;const max=Math.min(window.devicePixelRatio||1,[1,1.5,2,2][SET.gfx]);let pr=G.renderer.getPixelRatio();
      if(G.ft>.026&&pr>.6)pr=Math.max(.6,pr-.2);else if(G.ft<.016&&pr<max)pr=Math.min(max,pr+.1);
      // совсем медленно даже на минимуме — отключаем тяжёлые эффекты
      if(G.ft>.045&&pr<=.6&&!G.lite){G.lite=true;G.renderer.shadowMap.enabled=false;G.sun.castShadow=false;G.clouds.visible=false;G.scene.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true)})}
      if(pr!==G.renderer.getPixelRatio()){G.renderer.setPixelRatio(pr);G.w=0}}}
  if(w!==G.w||h!==G.h){G.w=w;G.h=h;G.renderer.setSize(w,h,false);G.camera.aspect=w/h;G.camera.updateProjectionMatrix()}
  const wetNow=R.wet[Math.min(R.N-1,R.lapDone)];if(wetNow!==G.wet)setWeather3D(wetNow);
  const len=G.F.len,stopped={};
  // стартовая решётка: до старта машины стоят парами в шахматном порядке через 8 м;
  // после старта — разгон с места (Te отстаёт от T и догоняет) и плавный переход к позициям симуляции
  const T=R.T,TAU=10,u=Math.min(1,T/TAU),bl=R.count>0?1:1-u*u*(3-2*u),Te=T<TAU?T-T*(1-T/TAU)**2:T;
  const slot=c=>-(6+(c.grid-1)*8)/len,slotLane=c=>(c.grid%2?-3:3);
  const list=R.cars.map(c=>{
    if(R.count>0&&!c.out)return{c,prog:slot(c),grid:true};
    const x={c,...carProg3D(c,Te)};
    if(bl>0&&!x.out&&!x.done){const s0=c.cum.length>1?-c.cum[0]/(c.cum[1]-c.cum[0]):-c.cum[0]/R.track.base;x.prog+=(slot(c)-s0)*bl;x.bl=bl}
    return x;
  }),run=list.filter(x=>!x.out).sort((a,b)=>b.prog-a.prog);
  run.forEach((x,i)=>{
    const o=G.cars[x.c.did];
    let target=0;
    if(i>0&&!run[i-1].pit&&run[i-1].prog-x.prog<5/len*2.2)target=(i%2?2.6:-2.6);
    if(x.done)target=-4;
    if(x.grid)o.lane=slotLane(x.c);else if(x.bl>0)o.lane=slotLane(x.c)*x.bl+target*(1-x.bl);
    else if(x.pit)o.lane=pitOff(x.pit.m,x.pit.bm);
    else o.lane+=(target-o.lane)*Math.min(1,dt*2.5);
    const s=w3(x.prog,o.lane);
    let yaw=Math.atan2(s.tx,s.tz);
    if(x.pit&&!x.pit.stop){const sl=(pitOff(x.pit.m+1,x.pit.bm)-pitOff(x.pit.m-1,x.pit.bm))/2;yaw=Math.atan2(s.tx-sl*s.tz,s.tz+sl*s.tx)}
    o.m.g.position.set(s.x,0,s.z);o.m.g.rotation.y=yaw;o.m.g.visible=true;
    if(x.pit&&x.pit.stop)stopped[x.c.tid]=s;
    if(o.prev!==null){o.spin+=(x.prog-o.prev)*len/.56;o.m.wheels.forEach(wg=>wg.rotation.x=o.spin)}
    o.prev=x.prog;
    if(o.label){o.label.visible=!(x.c.did===UI.follow&&(UI.cam==='chase'||UI.cam==='cockpit'));const t=x.c.out?'—':String(i+1);if(t!==o.ltxt){o.ltxt=t;o.label.material.map.dispose();o.label.material.map=labelTex(t,team(x.c.tid).color)}}
  });
  list.filter(x=>x.out).forEach(x=>{const o=G.cars[x.c.did];const s=w3(x.prog,11);o.m.g.position.set(s.x,0,s.z);o.m.g.rotation.y=Math.atan2(s.tx,s.tz)+.7;if(o.label)o.label.visible=false});
  // водяная пыль: за машиной на трассе, если мокро и машина едет
  const wetNow2=G.wet,tm=performance.now()/1000;
  run.forEach(x=>{const o=G.cars[x.c.did];if(!o.spray)return;const on=wetNow2&&!x.grid&&!(x.pit&&x.pit.stop)&&!x.done&&R.count<=0;o.spray.visible=on;
    if(on){const g=o.m.g,yaw=g.rotation.y;o.spray.position.set(g.position.x-Math.sin(yaw)*3.2,.9,g.position.z-Math.cos(yaw)*3.2);const f=.85+Math.sin(tm*9+o.lane)*.15;o.spray.scale.set(4.2*f,2*f,1);o.spray.material.opacity=.32+.12*Math.sin(tm*7+o.lane)}});
  // дым: сход (поломка) — столб на месте машины, ошибка пилота — облако у колёс, старт — дым от пробуксовки
  const puff=(x,z,big)=>{const p=G.smoke.find(s=>s.life<=0);if(!p)return;p.life=big?3.2:1.4;p.max=p.life;p.big=big;p.sp.position.set(x+rnd(-.6,.6),.8,z+rnd(-.6,.6));p.sp.visible=true};
  if(R.count<=0&&!G.marksOn){G.marksOn=true;G.marks.visible=true;run.slice(0,12).forEach(x=>{const g=G.cars[x.c.did].m.g;puff(g.position.x,g.position.z,false)})}
  list.forEach(x=>{const o=G.cars[x.c.did],g=o.m.g;
    if(x.out&&!o.smoked){o.smoked=true;if(x.c.outWhy!=='crash'){o.smokeUntil=performance.now()+9000}}
    if(o.smokeUntil&&performance.now()<o.smokeUntil&&Math.random()<dt*5)puff(g.position.x,g.position.z,true);
    if(x.c.errLap&&x.c.errLap!==o.errSeen&&Math.floor(x.prog)+1===x.c.errLap){o.errSeen=x.c.errLap;for(let i=0;i<3;i++)puff(g.position.x,g.position.z,false)}});
  G.smoke.forEach(p=>{if(p.life<=0)return;p.life-=dt;const k=1-p.life/p.max;if(p.life<=0){p.sp.visible=false;return}
    const sc0=(p.big?3:2)+k*(p.big?9:5);p.sp.scale.set(sc0,sc0,1);p.sp.position.y+=dt*(p.big?2.4:1);p.sp.material.opacity=(1-k)*(p.big?.55:.4)});
  // механики: у гаража в ожидании, вокруг машины во время стоянки
  if(G.crews)Object.entries(G.crews).forEach(([tid,cr])=>{const st=stopped[tid];if(st!==cr.st){cr.st=st;
    cr.men.forEach((mm,j)=>{if(st){const a=cr.act[j],sx=-st.tz,sz=st.tx;mm.position.set(st.x+st.tx*a[0]+sx*a[1],.85,st.z+st.tz*a[0]+sz*a[1])}else mm.position.copy(cr.idle[j])})}
    // во время стоянки механики работают: приседают у колёс
    if(cr.st)cr.men.forEach((mm,j)=>{mm.scale.y=.78+.22*Math.abs(Math.sin(tm*10+j*1.3));mm.position.y=.85*mm.scale.y});else if(cr.men[0].scale.y!==1)cr.men.forEach(mm=>{mm.scale.y=1;mm.position.y=.85})});
  // метки машин на обзоре
  const over=UI.cam==='over';
  R.cars.forEach(c=>{const o=G.cars[c.did];o.mk.visible=over&&o.m.g.visible;
    if(over){const H=G.ovH||500,k=H*(c.me?.03:.022);o.mk.scale.set(k,k,1);o.mk.position.set(o.m.g.position.x,2,o.m.g.position.z)}
    if(o.label){const k=over?(G.ovH||500)*.045/1.1:1;o.label.scale.set(3.1*k,1.95*k,1);o.label.position.y=over?3+k*1.2:3}});
  // машина безопасности
  if(R.sc>0&&run[0]){G.sc.visible=true;const s=w3(run[0].prog+14/len,0);G.sc.position.set(s.x,0,s.z);G.sc.rotation.y=Math.atan2(s.tx,s.tz)}else G.sc.visible=false;
  // камера
  let tgt=list.find(x=>x.c.did===UI.follow)||run[0]||list[0];
  const tp=tgt.out?w3(tgt.prog,11):w3(tgt.prog,G.cars[tgt.c.did].lane);
  const pos=new THREE.Vector3(tp.x,0,tp.z),d=new THREE.Vector3(tp.tx,0,tp.tz);
  G.dir.lerp(d,Math.min(1,dt*(UI.cam==='cockpit'?14:5))).normalize();
  const cam=G.camera,dir=G.dir;let fov=55;const pc=cam.position.clone(),pl=G.look.clone();
  if(UI.cam!==G.lastCam){G.blend=G.lastCam?1:0;G.lastCam=UI.cam}
  const fi=run.indexOf(tgt);
  if(R.count>0&&UI.cam!=='over'){// перед стартом: кран над решёткой, видна вся стартовая решётка
    const k=clamp((6.6-R.count)/6.6,0,1),gl=(6+(run.length-1)*8)/len,a=w3(28/len-k*10/len,-12),b=w3(-gl*.55,0);
    cam.position.set(a.x,30+k*8,a.z);G.look.set(b.x,0,b.z);fov=clamp(2*Math.atan(gl*len*.36/(gl*len*.55+30))*180/Math.PI*1.25,40,62);G.chB=0;
  }else if(UI.cam==='chase'){
    // погоня: камера отъезжает так, чтобы в кадре было до 3 соперников впереди и 3 позади (если они не дальше 140 м)
    let dA=0,dB=0;if(fi>=0)for(let j=1;j<=3;j++){
      const f=run[fi-j],r=run[fi+j];
      if(f){const d=(f.prog-tgt.prog)*len;if(d<=140)dA=Math.max(dA,d)}
      if(r){const d=(tgt.prog-r.prog)*len;if(d<=140)dB=Math.max(dB,d)}}
    const wb=clamp(dB+16,26,115),wa=clamp(dA*.65,26,100),kf=G.chB?Math.min(1,dt*1.2):1;
    G.chB=(G.chB||wb)+(wb-(G.chB||wb))*kf;G.chA=(G.chA||wa)+(wa-(G.chA||wa))*kf;
    const p=tgt.prog,cl=tgt.pit?G.cars[tgt.c.did].lane*.85:0,cp=w3(p-G.chB/len,cl),lp=w3(p+G.chA/len,cl);
    cam.position.set(cp.x,8+G.chB*.26,cp.z);G.look.set(lp.x,.5,lp.z);fov=62}
  else if(UI.cam==='cockpit'){cam.position.copy(pos).addScaledVector(dir,-.25).setY(1.32);G.look.copy(pos).addScaledVector(dir,30).setY(1);fov=70}
  else if(UI.cam==='heli'){cam.position.copy(pos).addScaledVector(dir,-55).setY(62);G.look.copy(pos).addScaledVector(dir,25)}
  else if(UI.cam==='over'){const ov=G.ov,P=G.path;fov=50;
    if(ov.follow){const kf=Math.min(1,dt*4);ov.x+=(pos.x-ov.x)*kf;ov.z+=(pos.z-ov.z)*kf}
    const fitH=1.08*Math.max(P.ws,P.ar*P.ws/cam.aspect)/(2*Math.tan(25*Math.PI/180)),H=fitH/ov.zoom;G.ovH=H;
    cam.position.set(ov.x,H,ov.z+H*.06);G.look.set(ov.x,0,ov.z)}
  else{// ТВ: ближайшая камера у трассы
    let bi=0,bd=1e9;G.tv.forEach((v,i)=>{const dd=v.distanceTo(pos);if(dd<bd){bd=dd;bi=i}});
    if(G.tv.length){cam.position.copy(G.tv[bi]);G.look.copy(pos).setY(1)}fov=clamp(2*Math.atan(9/Math.max(10,bd))*180/Math.PI,12,50);
  }
  // плавный переход между камерами (около полусекунды)
  if(G.blend>0&&UI.cam!=='tv'){G.blend=Math.max(0,G.blend-dt*2);const k=Math.min(1,dt*6+(1-G.blend)*.15);cam.position.lerpVectors(pc,cam.position,k);G.look.lerpVectors(pl,G.look,k);fov=G.fov+(fov-G.fov)*k}
  if(Math.abs(fov-G.fov)>.05){G.fov=fov;cam.fov=fov;cam.updateProjectionMatrix()}
  cam.lookAt(G.look);
  if(G.sun.castShadow){G.sun.position.copy(pos).add(new THREE.Vector3(120,220,80));G.sun.target.position.copy(pos)}
  if(G.rain.visible){const a=G.rain.geometry.attributes.position;for(let i=0;i<a.count;i++){let y=a.getY(i)-dt*48;if(y<0)y+=50;a.setY(i,y)}a.needsUpdate=true;G.rain.position.set(cam.position.x,cam.position.y-25,cam.position.z)}
  G.renderer.render(G.scene,cam);
}

/* ---------- 3D: шоурум ---------- */
let SHOW=null;
function disposeShow(){if(!SHOW)return;SHOW.alive=false;try{SHOW.r.dispose();SHOW.r.forceContextLoss()}catch(e){diag('освобождение 3D-витрины',e)}SHOW=null}
function initShow(cv,color,accent){
  disposeShow();if(!HAS3D)return;
  try{
    const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.1;
    const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(30,1,.1,200);cam.position.set(8.5,3.6,8.5);cam.lookAt(0,.55,0);
    sc.add(new THREE.HemisphereLight(0xe6f0ff,0x1a222c,.95));
    const d=new THREE.DirectionalLight(0xffffff,.95);d.position.set(5,9,4);sc.add(d);
    const d2=new THREE.DirectionalLight(0xffb020,.45);d2.position.set(-6,3,-5);sc.add(d2);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(5.6,48),new THREE.MeshStandardMaterial({color:0x16202b,roughness:.55,metalness:.3}));floor.rotation.x=-Math.PI/2;sc.add(floor);
    const ring=new THREE.Mesh(new THREE.RingGeometry(5.45,5.6,64),new THREE.MeshBasicMaterial({color:0xffb020}));ring.rotation.x=-Math.PI/2;ring.position.y=.01;sc.add(ring);
    const car=carMesh(color,false,accent);car.g.rotation.y=.9;sc.add(car.g);linearize(sc);const env=buildEnv(r,false);sc.environment=env.texture;
    const st={r,alive:true,vel:.35,drag:null,w:0,h:0};
    cv.addEventListener('pointerdown',e=>{st.drag=e.clientX;st.vel=0});
    cv.addEventListener('pointermove',e=>{if(st.drag===null)return;car.g.rotation.y+=(e.clientX-st.drag)*.012;st.drag=e.clientX});
    const up=()=>{st.drag=null;st.vel=.35};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);cv.addEventListener('pointerleave',up);
    let last=0;
    const tick=ts=>{if(!st.alive||!cv.isConnected){if(SHOW===st)disposeShow();return}
      const dt=last?Math.min(.05,(ts-last)/1000):0;last=ts;
      const w=cv.clientWidth,h=cv.clientHeight;if(w&&h&&(w!==st.w||h!==st.h)){st.w=w;st.h=h;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
      car.g.rotation.y+=st.vel*dt;car.wheels.forEach(wg=>wg.rotation.x+=st.vel*dt*2);r.render(sc,cam);requestAnimationFrame(tick)};
    requestAnimationFrame(tick);SHOW=st;
  }catch(e){console.warn(e)}
}

