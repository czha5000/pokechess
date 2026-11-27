import * as THREE from 'three';
import { GLTFLoader } from './vendor/three-r180/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from './vendor/three-r180/addons/loaders/DRACOLoader.js';
import { clone as cloneSkeleton } from './vendor/three-r180/addons/utils/SkeletonUtils.js';

const WORLD=100, assetRoot=new URL('./assets/3d-v25/',import.meta.url);
const world=(x,y,h=0)=>new THREE.Vector3((x-500)/WORLD,h,(y-250)/WORLD);
const clamp=THREE.MathUtils.clamp;

window.createBattleRenderer=function(canvas,advance,readView,onSuspend){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#b9d8da');scene.fog=new THREE.Fog('#b9d8da',20,38);
 const camera=new THREE.OrthographicCamera(-6,6,2,-2,.1,60);camera.position.set(0,10,14);camera.lookAt(0,.32,0);
 scene.add(new THREE.HemisphereLight('#d6f4ff','#8c7656',2.25));
 const sun=new THREE.DirectionalLight('#fff1cb',3.1);sun.position.set(-5,10,6);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-7,right:7,top:5,bottom:-5,near:1,far:24});sun.shadow.normalBias=.035;sun.shadow.bias=-.00025;sun.shadow.radius=3;scene.add(sun);
 const rim=new THREE.DirectionalLight('#b5e9ff',1.5);rim.position.set(4,4,-7);scene.add(rim);
 const geometries=new Set(),materials=new Set(),textures=new Set(),templates=new Map(),actors=new Map(),effects=new Map(),labels=new Map();
 const labelsRoot=document.createElement('div');labelsRoot.className='world-labels';canvas.parentElement.append(labelsRoot);
 const loading=document.createElement('div');loading.className='world-loading';loading.setAttribute('role','status');loading.innerHTML='<b>准备高清 3D 战场</b><span>载入角色模型 · 0 / 4</span>';canvas.parentElement.append(loading);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let disposed=false,ready=false,last=0,model=null,frames=0,viewW=1,viewH=1;
 const geo=g=>{geometries.add(g);return g;};
 const mat=(c,rough=.8,metal=0)=>{const m=new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal});materials.add(m);return m;};
 const basic=(c,a=1)=>{const m=new THREE.MeshBasicMaterial({color:c,transparent:a<1,opacity:a,depthWrite:false,side:THREE.DoubleSide});materials.add(m);return m;};
 const box=geo(new THREE.BoxGeometry(1,1,1)),sphere=geo(new THREE.SphereGeometry(1,24,16)),cone=geo(new THREE.ConeGeometry(1,1,24)),cylinder=geo(new THREE.CylinderGeometry(1,1,1,20));
 const mesh=(parent,g,m,x,y,z,sx=1,sy=sx,sz=sx)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const terrain=new THREE.Group();scene.add(terrain);
 const grass=mat('#86a867'),edge=mat('#6b7f61'),rock=mat('#758b8a'),sand=mat('#c3b98d'),stone=mat('#d4d8b5'),wood=mat('#a38b63'),leaf=mat('#54886c'),leafLight=mat('#72a57b'),trunk=mat('#74604d');
 // A raised diorama: topology still matches the same two bridges and forbidden river.
 mesh(terrain,box,rock,0,-.52,0,10.5,.8,5.4);
 mesh(terrain,box,edge,-2.82,-.2,0,4.45,.36,5.05);mesh(terrain,box,edge,2.82,-.2,0,4.45,.36,5.05);
 mesh(terrain,box,grass,-2.82,-.035,0,4.44,.07,5.04);mesh(terrain,box,grass,2.82,-.035,0,4.44,.07,5.04);
 const waterMat=new THREE.MeshPhysicalMaterial({color:'#36a7b0',roughness:.23,metalness:.18,transparent:true,opacity:.87,clearcoat:.75});materials.add(waterMat);
 const water=mesh(terrain,box,waterMat,0,-.13,0,1.25,.08,5.3);water.castShadow=false;
 const rippleMat=basic('#b9f4e4',.5),ripples=[];
 for(let i=0;i<16;i++){const o=mesh(terrain,box,rippleMat,((i*17)%9-4)*.105,-.079,-2.4+i*.3,.16,.003,.012);o.castShadow=false;ripples.push(o);}
 for(const z of [-.95,.95]){
  for(const x of [-2.65,2.65])mesh(terrain,box,sand,x,.006,z,3.9,.018,.62);
  for(let i=0;i<9;i++)mesh(terrain,box,stone,-.65+i*.16,.028,z,.145,.10,.78);
  for(const side of [-1,1]){
   mesh(terrain,box,wood,0,.14,z+side*.39,1.5,.10,.065);
   for(const x of [-.7,.7])mesh(terrain,box,stone,x,.16,z+side*.39,.14,.32,.14);
  }
 }
 // Border dressing stays outside the navigable play area.
 for(let i=0;i<28;i++){
  const x=-4.9+(i%14)*.75,z=i<14?-2.48:2.48;if(Math.abs(x)<.7)continue;
  const r=mesh(terrain,sphere,i%3?rock:edge,x,-.09,z,.22+(i%3)*.08,.22,.19);r.rotation.set(i*.8,i*.5,i*.2);
 }
 function tree(x,z,s){const g=new THREE.Group();terrain.add(g);g.position.set(x,0,z);mesh(g,cylinder,trunk,0,.22,0,.055,.5,.055);for(let i=0;i<3;i++){const canopy=mesh(g,sphere,i%2?leaf:leafLight,(i-1)*.16,.58+i*.13,0,.3,.35,.3);canopy.rotation.z=i*.5;}g.scale.setScalar(s);}
 for(const [x,z,s]of [[-4.85,-2.3,.8],[-3.65,-2.43,.75],[-1.4,-2.38,.65],[1.35,-2.4,.7],[3.45,-2.4,.75],[4.8,-2.25,.85],[-4.9,2.35,.65],[4.85,2.35,.65]])tree(x,z,s);
 const gold=mat('#d6bf7c',.45,.25),crystal=mat('#a0efdf',.2,.15);crystal.emissive.set('#3a9a8d');crystal.emissiveIntensity=.35;
 mesh(terrain,cylinder,stone,-4.35,.08,0,.38,.16,.38);mesh(terrain,cylinder,gold,-4.35,.18,0,.27,.1,.27);
 const coreMesh=mesh(terrain,geo(new THREE.OctahedronGeometry(.33)),crystal,-4.35,.57,0,.7,1.25,.7);
 for(const z of [-.95,.95]){const portal=mesh(terrain,geo(new THREE.TorusGeometry(.23,.065,10,40)),mat('#a77b8a',.5,.3),4.42,.32,z);portal.rotation.y=Math.PI/2;mesh(terrain,cylinder,rock,4.42,.04,z,.32,.08,.32);}
 // Original 3D prototypes for roles without matching production models. +Z faces forward.
 function prototype(kind){
  const g=new THREE.Group(),cream=mat('#f7e5b2'),dark=mat('#203745'),brown=mat('#8b7d67'),blue=mat('#4a7d99'),white=mat('#f1e9d3'),orange=mat('#e6aa5b');
  if(kind==='bird'){
   mesh(g,sphere,cream,0,.42,0,.19,.28,.20);mesh(g,sphere,white,0,.72,.10,.17,.17,.17);mesh(g,cone,orange,0,.69,.29,.065,.18,.065).rotation.x=Math.PI/2;
   for(const s of [-1,1]){const wing=mesh(g,sphere,blue,s*.27,.52,-.03,.33,.10,.19);wing.rotation.z=s*-.25;
    for(let j=0;j<5;j++){const feather=mesh(g,sphere,j%2?white:blue,s*(.28+j*.055),.48-j*.016,-.10-j*.025,.06,.035,.22-j*.018);feather.rotation.y=s*.45;}
    mesh(g,sphere,dark,s*.105,.75,.245,.035,.043,.018);mesh(g,sphere,white,s*.108,.766,.259,.011,.012,.007);
    mesh(g,cylinder,orange,s*.09,.13,.04,.022,.14,.022);mesh(g,sphere,orange,s*.09,.06,.10,.055,.025,.11);
   }
   for(let i=-1;i<=1;i++)mesh(g,sphere,blue,i*.065,.27,-.24,.055,.04,.23).rotation.x=-.25;
   mesh(g,cone,orange,0,.91,.07,.07,.19,.055).rotation.z=-.18;
  }else if(kind==='badger'||kind==='raider'||kind==='brute'||kind==='wolf'){
   const body=kind==='badger'?mat('#687d91'):kind==='wolf'?mat('#b4c5bd'):mat('#a39b7e');
   mesh(g,sphere,body,0,.31,0,.27,.23,.37);mesh(g,sphere,body,0,.48,.26,.24,.22,.23);mesh(g,sphere,cream,0,.39,.43,.17,.10,.15);mesh(g,sphere,dark,0,.43,.55,.07,.04,.035);
   for(const s of [-1,1]){mesh(g,cone,body,s*.17,.70,.24,.075,.20,.07);mesh(g,sphere,dark,s*.15,.54,.435,.033,.04,.018);mesh(g,sphere,white,s*.15,.55,.448,.01,.01,.006);for(const z of [-.23,.24])mesh(g,sphere,body,s*.19,.12,z,.10,.14,.12);}
   if(kind!=='wolf')for(let i=0;i<4;i++){const plate=mesh(g,geo(new THREE.DodecahedronGeometry(.18,0)),rock,0,.5,-.27+i*.14,1,.65,1);plate.rotation.y=i*.5;}
   if(kind==='brute')mesh(g,cone,cream,0,.63,.46,.075,.27,.07).rotation.x=.5;
  }else if(kind==='archer'){
   const purple=mat('#8172a8');mesh(g,sphere,purple,0,.4,0,.25,.3,.22);mesh(g,sphere,dark,0,.67,.05,.15,.13,.15);mesh(g,cone,purple,0,.9,0,.28,.35,.24);
   for(const x of [-.06,.06])mesh(g,sphere,orange,x,.69,.19,.025,.018,.014);mesh(g,cylinder,brown,.29,.47,0,.025,.78,.025);mesh(g,geo(new THREE.OctahedronGeometry(.10)),crystal,.29,.91,0);
  }else if(kind==='lure'){mesh(g,cylinder,wood,0,.3,0,.045,.6,.045);mesh(g,sphere,orange,0,.66,0,.17);mesh(g,box,wood,0,.46,0,.48,.05,.05);}
  return g;
 }
 for(const kind of ['bird','badger','raider','brute','wolf','archer','lure'])templates.set(kind,prototype(kind));
 const heights={fox:.82,turtle:.82,sprout:.70,boss:1.30,pikachu:.78,gengar:.95,bird:.92,badger:.72,raider:.7,brute:.9,wolf:.65,archer:.98,lure:.78};
 const draco=new DRACOLoader().setDecoderPath(new URL('./vendor/three-r180/draco/',import.meta.url).href);
 const loader=new GLTFLoader().setDRACOLoader(draco),clips=new Map(),rigged=new Set();let loaded=0;
 const modelLoad=Promise.all(['fox','turtle','sprout','boss','pikachu','gengar'].map(async kind=>{
  const url=['pikachu','gengar'].includes(kind)?new URL('./assets/3d-v27/'+kind+'.glb',import.meta.url):kind==='sprout'?new URL('./assets/3d-v23/bulbasaur.glb',import.meta.url):new URL(({fox:'eevee',turtle:'squirtle',boss:'charizard'})[kind]+'.glb',assetRoot);
  const gltf=await loader.loadAsync(url.href);if(disposed)return;
  const source=gltf.scene,bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const normalized=new THREE.Group(),offset=new THREE.Group();offset.position.set(-center.x,-bounds.min.y,-center.z);offset.add(source);normalized.add(offset);normalized.scale.setScalar(heights[kind]/size.y);
  // Downloaded Pokemon assets face +Z; the scene wrapper owns navigation rotation.
  normalized.rotation.y=0;
  // Eevee's single showcase action is not a battle idle; keep its reference pose.
  if(['sprout','boss','pikachu','gengar'].includes(kind)&&gltf.animations.length)clips.set(kind,gltf.animations);
  source.traverse(o=>{if(o.isSkinnedMesh)rigged.add(kind);});
  source.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.map)textures.add(m.map);m.roughness=Math.max(.45,m.roughness||0);}}});
  templates.set(kind,normalized);loading.querySelector('span').textContent='载入角色模型 · '+(++loaded)+' / 6';
 })).then(()=>{if(disposed)return;ready=true;canvas.dataset.ready='true';loading.remove();}).catch(error=>{loading.innerHTML='<b>3D 模型加载未完成</b><span>请刷新页面重试</span>';console.error(error);});
 const corridorGeo=geo(new THREE.PlaneGeometry(1,1));
 const ringGeo=geo(new THREE.RingGeometry(.92,1,64)),diskGeo=geo(new THREE.CircleGeometry(1,64)),orbGeo=geo(new THREE.SphereGeometry(1,12,8));
 function effect(key,type,x,y,r,c,opacity=.9,h=.045){
  let o=effects.get(key);
  if(!o){o=new THREE.Mesh(type==='ring'?ringGeo:type==='disk'?diskGeo:type==='orb'?orbGeo:cylinder,basic(c,opacity));o.castShadow=false;o.renderOrder=6;effects.set(key,o);scene.add(o);}
  o.geometry=type==='ring'?ringGeo:type==='disk'?diskGeo:type==='orb'?orbGeo:cylinder;
  o.seen=true;o.visible=true;o.position.copy(world(x,y,h));o.scale.setScalar(Math.max(.001,r/WORLD));o.rotation.set(type==='orb'?0:-Math.PI/2,0,0);o.material.color.set(c);o.material.opacity=opacity;o.material.transparent=true;o.material.depthTest=!(key.includes('warning-edge')||key.includes('start-edge')||key.includes('edge-1')||key.includes('edge1'));return o;
 }
 function beam(key,a,b,c,opacity=.7,width=.014){const from=world(a.x,a.y,a.h??.055),to=world(b.x,b.y,b.h??.055),d=to.clone().sub(from);const o=effect(key,'beam',0,0,1,c,opacity);o.position.copy(from).add(to).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());o.scale.set(width,Math.max(.001,d.length()),width);}
 function project(x,y,h=0){const p=world(x,y,h).project(camera);return {x:(p.x+1)/2*viewW,y:(1-p.y)/2*viewH,visible:p.z>-1&&p.z<1};}
 function label(key,text,x,y,h=.7,tone='neutral',opacity=1){let el=labels.get(key);if(!el){el=document.createElement('div');el.className='world-float';labelsRoot.append(el);labels.set(key,el);}el.seen=true;el.hidden=false;el.className='world-float '+(tone==='danger'?'world-threat':tone);if(el.textContent!==text)el.textContent=text;const p=project(x,y,h);el.style.transform=`translate(${p.x}px,${Math.max(30,p.y)}px) translate(-50%,-100%)`;el.style.opacity=opacity;}
 const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),pickTargets=[];
 function prepareRay(clientX,clientY){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1),camera);}
 function picked(clientX,clientY){prepareRay(clientX,clientY);return ray.intersectObjects(pickTargets,false)[0]?.object.userData.unit;}
 window.battleView={
  point(clientX,clientY,snap=true){const u=picked(clientX,clientY);if(snap&&u)return {x:u.x,y:u.y};const hit=ray.ray.intersectPlane(plane,new THREE.Vector3());return hit?{x:hit.x*WORLD+500,y:hit.z*WORLD+250}:{x:-1000,y:-1000};},
  hero(clientX,clientY){const u=picked(clientX,clientY);return u?.hero!==undefined?u.id:null;},
  project(x,y,h=0){const p=project(x,y,h),r=canvas.getBoundingClientRect();return {x:r.left+p.x,y:r.top+p.y};}
 };
 const pickGeo=geo(new THREE.SphereGeometry(1,12,8)),pickMat=new THREE.MeshBasicMaterial({visible:false});materials.add(pickMat);
 function facingTarget(u,game){
  if(game.phase!=='battle')return null;
  const distance=t=>Math.hypot(u.x-t.x,u.y-t.y),enemies=game.units.filter(t=>t.hp>0&&t.side!==u.side&&t.kind!=='seal');
  if(u.side){const lure=enemies.find(t=>t.kind==='lure'&&distance(t)<175);if(lure)return lure;}
  const nearest=enemies.filter(t=>t.lane===u.lane||distance(t)<170).sort((a,b)=>distance(a)-distance(b))[0];
  if(nearest&&distance(nearest)<(u.side?235:310))return nearest;
  if(game.wave===1)return {...game.mission,objective:true};
  return u.side?game.core:game.wave===2?game.seal:null;
 }
 // Sample existing clips against game time. The renderer never schedules damage.
 function pose(a,key,seconds){
  const aliases={ '001aidle':'Battle Idle','001walk':'Battle Idle','001fight_b':'Attack 1','001fight_d':'Ranged Attack 1','001ko':'Down',bossSlam:'Attack 3',bossHurt:'Damage 1' };
  const durations={'001aidle':1.6666666,'001walk':1.1666666,'001fight_b':1.75,'001fight_d':2.625,'001ko':2};
  const sourceClip=a.kind!=='sprout';
  const clip=sourceClip?a.clips.find(c=>c.name===aliases[key])||(['001aidle','001walk'].includes(key)?a.clips.find(c=>c.name==='Idle'):null):a.clips.find(c=>c.name.endsWith(key));if(!clip)return;
  if(sourceClip&&durations[key])seconds=seconds/durations[key]*clip.duration;
  if(a.clip!==clip){a.mixer.stopAllAction();a.action=a.mixer.clipAction(clip);a.action.reset().setLoop(THREE.LoopOnce,1);a.action.clampWhenFinished=true;a.action.play();a.clip=clip;}
  a.action.paused=true;a.action.time=clamp(seconds,0,clip.duration);a.mixer.update(0);a.state=key;
 }
 function animate(a,u,game,target){
  if(!a.mixer)return;
  const dt=game.phase==='setup'?Math.min(.06,a.renderDelta||0):Math.max(0,game.time-a.gameTime);a.gameTime=game.time;a.clock+=dt;
  const moved=Math.hypot(u.x-a.x,u.y-a.y);a.x=u.x;a.y=u.y;
  if(a.kind==='boss'){
   if(u.stun>0){a.special=null;pose(a,'bossHurt',.25);}
   else if(u.special){a.special={release:game.time+u.special.wait};pose(a,'bossSlam',.95*clamp(1-u.special.wait/u.special.wind,0,1));}
   else if(a.special&&u.recovery>0){pose(a,'bossSlam',.95+clamp((game.time-a.special.release)/1.4,0,1)*(2.2333333-.95));}
   else a.special=null;
   if(u.special||u.recovery>0||u.stun>0){a.lastAttack=u.attack;return;}
  }
  const cast=game.pending.find(p=>p.casterId===u.id&&p.stage==='windup');
  if(cast){a.cast={id:cast.id,release:game.time+cast.wait,point:{x:cast.x,y:cast.y}};const c=window.DeployGame.CARDS[cast.card];pose(a,'001fight_d',1.05*clamp(1-cast.wait/c.wind,0,1));}
  else if(a.cast&&game.time-a.cast.release<.45&&(a.cast.released||game.pending.some(p=>p.id===a.cast.id&&p.stage==='flight'))){a.cast.released=true;pose(a,'001fight_d',1.05+Math.max(0,game.time-a.cast.release)/.45*(2.625-1.05));}
  else{
   a.cast=null;
   if(a.lastAttack!==undefined&&u.attack>a.lastAttack+.5)a.strike=game.time;
   const inRange=u.atk>0&&target&&!target.objective&&Math.hypot(u.x-target.x,u.y-target.y)<=u.range+12;
   if(u.stun>0)pose(a,'001aidle',0);
   else if(!u.busy&&inRange&&u.attack<=.20)pose(a,'001fight_b',.75*clamp(1-u.attack/.20,0,1));
   else if(a.strike!==undefined&&game.time-a.strike<.42)pose(a,'001fight_b',.75+(game.time-a.strike)/.42);
   else if(moved>.04&&dt>0){a.movingUntil=game.time+.09;pose(a,'001walk',a.clock%1.1666666);}
   else if(game.time<(a.movingUntil||0))pose(a,'001walk',a.clock%1.1666666);
   else pose(a,'001aidle',a.clock%1.6666666);
  }
  a.lastAttack=u.attack;
 }
 function actor(u,game){
  let a=actors.get(u.id);
  if(!a){const template=templates.get(u.kind)||templates.get('raider');if(!template)return;
   const root=new THREE.Group(),visual=rigged.has(u.kind)?cloneSkeleton(template):template.clone(true),owned=new Set();root.add(visual);scene.add(root);
   visual.traverse(o=>{if(o.isMesh){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of Array.isArray(o.material)?o.material:[o.material]){m.userData.baseEmission=m.emissive?.clone();m.userData.baseEmissionIntensity=m.emissiveIntensity;owned.add(m);}o.castShadow=true;o.receiveShadow=true;}});
   const hit=new THREE.Mesh(pickGeo,pickMat);hit.position.y=(heights[u.kind]||.7)*.42;hit.scale.set(u.kind==='boss'?.48:.30,(heights[u.kind]||.7)*.5,.32);root.add(hit);pickTargets.push(hit);
   const el=document.createElement('div');el.className='world-unit';el.innerHTML='<b></b><i><em></em></i><small></small>';labelsRoot.append(el);
   a={root,visual,owned,hit,el,kind:u.kind,x:u.x,y:u.y,clock:0,gameTime:game.time};
   if(rigged.has(u.kind)){a.bones=[];a.skeletons=new Set();visual.traverse(o=>{if(o.isBone)a.bones.push(o);if(o.isSkinnedMesh){a.skeletons.add(o.skeleton);o.frustumCulled=false;}});}
   if(clips.has(u.kind)){a.clips=clips.get(u.kind);a.mixer=new THREE.AnimationMixer(visual);}
   actors.set(u.id,a);
  }
  a.seen=true;a.unit=u;a.hit.userData.unit=u;a.root.position.copy(world(u.x,u.y));
  // Never call Game.target here: it records lure statistics. Facing is read-only.
  const target=facingTarget(u,game);const dx=target?target.x-u.x:u.side?-1:1,dz=target?target.y-u.y:0;
  const cast=game.pending.find(p=>p.casterId===u.id&&p.stage==='windup'),moving=Math.hypot(u.x-a.x,u.y-a.y)>.04;
  a.root.rotation.y=u.special&&Math.hypot(u.special.x-u.x,u.special.y-u.y)>.1?Math.atan2(u.special.x-u.x,u.special.y-u.y):cast?Math.atan2(cast.x-u.x,cast.y-u.y):moving?Math.atan2(u.x-a.x,u.y-a.y):Math.atan2(dx,dz);a.visual.position.y=0;
  a.renderDelta=frameDelta;animate(a,u,game,target);
  for(const m of a.owned)if(m.emissive){m.emissive.copy(m.userData.baseEmission);if(u.flash>0)m.emissive.set('#fff4bf');m.emissiveIntensity=u.flash>0?.35:m.userData.baseEmissionIntensity;}
  const h=heights[u.kind]||.7,p=project(u.x,u.y,h+.12);a.el.style.transform=`translate(${p.x}px,${Math.max(30,p.y)}px) translate(-50%,-100%)`;
  a.el.classList.toggle('enemy',!!u.side);a.el.querySelector('b').textContent=(u.name||'')+(u.side?' · '+window.DeployGame.enemyMovement(u).name:'');a.el.querySelector('em').style.width=(u.max?Math.max(0,u.hp/u.max)*100:100)+'%';
  const trait=u.trait==='crystal'?((u.vulnerableUntil||0)>game.time?'虚弱':'晶甲 '+(u.crystalHits||0)+'/4'):u.trait==='rage'?'蓄怒 '+(u.rage||0)+'/3':u.trait==='regen'?'回生':u.trait==='guard'?'护链':u.trait==='priest'?'共鸣':u.trait==='ambush'?'伏击':'';
  a.el.querySelector('small').textContent=u.stun>0?'眩晕':u.recovery>0?'反击 '+u.recovery.toFixed(1)+'s':(u.exposedUntil||0)>game.time?'易伤 '+(u.exposedUntil-game.time).toFixed(1)+'s':game.active(u.poison)?'孢毒 '+u.poison.stacks:game.active(u.controlTag)?(u.controlTag.kind==='paralysis'?'麻痹':'牵制')+' '+Math.max(0,u.controlTag.until-game.time).toFixed(1)+'s':game.active(u.burn)?'灼烧':u.shield>0?'护盾 '+Math.ceil(u.shield):trait;
  effect(u.id+'team','ring',u.x,u.y,u.kind==='boss'?43:25,u.side?'#e69b80':'#a6f5de',.72);
  if(u.shield>0)effect(u.id+'shield','orb',u.x,u.y,34,'#8cddf1',.12,h*.45);
 }
 function removeActor(id,a){a.mixer?.stopAllAction();a.mixer?.uncacheRoot(a.visual);for(const s of a.skeletons||[])s.dispose();scene.remove(a.root);a.el.remove();for(const m of a.owned)m.dispose();const i=pickTargets.indexOf(a.hit);if(i>=0)pickTargets.splice(i,1);actors.delete(id);}
 function resize(){const r=canvas.getBoundingClientRect();if(r.width<1||r.height<1)return;viewW=r.width;viewH=r.height;renderer.setSize(viewW,viewH,false);const aspect=viewW/viewH,height=Math.max(4.5,11.7/aspect);camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();camera.updateMatrixWorld();}
 const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);resize();
 let frameDelta=0;
 function frame(now){if(disposed)return;const delta=Math.min(60,last?now-last:0);frameDelta=delta/1000;last=now;advance(now,delta);const v=readView(),{game,selected,aim,hover,preview,mode,dodgePreview}=v;
  if(model!==game){for(const [id,a]of actors)removeActor(id,a);model=game;}
  for(const a of actors.values())a.seen=false;for(const o of effects.values())o.seen=false;for(const el of labels.values())el.seen=false;
  if(!reduced.matches){coreMesh.rotation.y=game.time*.35;ripples.forEach((o,i)=>o.position.z=-2.4+((i*.3+game.time*.05)%4.8));}
  if(ready){
   if(game.phase==='setup')game.placed.forEach((p,i)=>{if(p&&game.activeHeroes.includes(i))actor({...window.DeployGame.HEROES[i],...p,id:'setup'+i,hero:i,side:0},game);});
   else for(const u of game.units.filter(u=>u.hp>0)){if(u.kind==='seal'){effect(u.id,'orb',u.x,u.y,35,'#d896d7',.85,.45);label('seal','封印 '+Math.ceil(u.hp),u.x,u.y,.96,'danger');}else actor(u,game);}
  }
  if(game.wave===1){const m=game.mission;effect('objective','ring',m.x,m.y,m.r,'#ffe49f');effect('objective-fill','disk',m.x,m.y,m.r,'#ffe49f',.12);label('objective-label','风眼 '+(game.control||0).toFixed(1)+' / 14s',m.x,m.y,.1,'gold');}
  const dangerActive=game.units.some(u=>u.hp>0&&u.side&&u.special?.damage>0);
  for(const u of game.units.filter(u=>u.hp>0)){
   if(u.trait==='guard'){const t=game.units.find(t=>t.id===u.guardTarget&&t.hp>0);if(t&&game.guardFor(t)===u)beam(u.id+'link',{...u,h:.35},{...t,h:.35},'#8fe4ff',.8,.025);}
   if(game.active(u.breach))effect(u.id+'breach','ring',u.x,u.y,37,'#ffe89b');
   const p=u.special;if(!p)continue;
   effect(u.id+'warning','disk',p.x,p.y,p.r,p.kind==='chant'?'#bda2fa':'#ff2346',.46,.065);effect(u.id+'warning-edge','ring',p.x,p.y,p.r,'#ff2346',1,.07);
   if(p.kind==='charge'){
    const dx=p.x-p.from.x,dy=p.y-p.from.y,len=Math.hypot(dx,dy),nx=-dy/(len||1)*p.r,ny=dx/(len||1)*p.r;
    const corridor=effect(u.id+'corridor','disk',(p.from.x+p.x)/2,(p.from.y+p.y)/2,1,'#ff2346',.46,.066);corridor.geometry=corridorGeo;corridor.rotation.set(-Math.PI/2,0,-Math.atan2(dy,dx));corridor.scale.set(len/WORLD,2*p.r/WORLD,1);
    effect(u.id+'start','disk',p.from.x,p.from.y,p.r,'#ff2346',.46,.065);
    for(const sign of [-1,1])beam(u.id+'edge'+sign,{x:p.from.x+nx*sign,y:p.from.y+ny*sign},{x:p.x+nx*sign,y:p.y+ny*sign},'#ff2346',1,.025);
    effect(u.id+'start-edge','ring',p.from.x,p.from.y,p.r,'#ff2346',1,.07);
   }
   label(u.id+'impact',p.name+' · '+Math.max(0,p.wait).toFixed(1)+'s',p.x,p.y,.12,'danger');
  }
  game.fields.forEach((f,i)=>{const heal=f.kind==='healfield';effect('field'+i,'disk',f.x,f.y,f.r,heal?'#93e6ab':'#ff984f',.23);effect('field-edge'+i,'ring',f.x,f.y,f.r,heal?'#c2f8cf':'#ffc77d');label('field-label'+i,(heal?'恢复':'火区')+' '+Math.ceil(f.life)+'s',f.x,f.y,.12,heal?'heal':'gold');});
  function route(key,path){if(!path)return;for(let i=1;i<path.length;i++)beam(key+i,path[i-1],path[i],'#c3f4ff',.8,.012);const end=path[path.length-1];if(end){effect(key+'end','ring',end.x,end.y,17,'#c3f4ff');label(key+'text','施法位置',end.x,end.y,.12);}}
  for(const o of game.orders)route(o.id,o.path);if(preview?.approach&&hover)route('preview',preview.path);
  for(const p of game.pending){const c=window.DeployGame.CARDS[p.card],u=game.mains.find(u=>u.id===p.casterId);effect(p.id+'target','ring',p.x,p.y,p.r,'#8fe4ff',dangerActive?.2:.6);if(p.stage==='windup'&&u){effect(p.id+'caster','ring',u.x,u.y,33,'#fff3c0');label(p.id+'text',c.name,u.x,u.y,(heights[u.kind]||.7)+.36,'gold');}else if(p.from){const t=1-clamp(p.wait/p.total,0,1);effect(p.id+'bolt','orb',p.from.x+(p.x-p.from.x)*t,p.from.y+(p.y-p.from.y)*t,8,'#ffe19f',1,.35+Math.sin(t*Math.PI)*.3);}}
  game.effects.forEach((f,i)=>{if(dangerActive&&['text','line'].includes(f.kind))return;const a=clamp(f.life/f.max,0,1)*(dangerActive?.3:1);if(f.kind==='text')label('fx'+i,f.text,f.x,f.y,.9+(1-a)*.3,'damage',a);else if(f.kind==='line')beam('fx'+i,{x:f.x,y:f.y,h:.3},{x:f.tx,y:f.ty,h:.3},f.side?'#ffc4ac':'#edffcc',a,.015);else{effect('fx'+i,'ring',f.x,f.y,f.r*(1.3-a*.3),f.kind==='enemy-impact'?'#ff795f':'#ffe4a7',a,.085);if(f.text)label('fxlabel'+i,f.text,f.x,f.y,.65,'gold',a);}});
  if(mode==='capture'){for(const u of game.units.filter(u=>u.side&&u.hp>0&&u.capturable)){effect(u.id+'capture','ring',u.x,u.y,35,'#ffe3a2');label(u.id+'capturetext',u.hp/u.max<=.5?Math.round(game.capturePreview(u.id).probability*100)+'%':'需削弱',u.x,u.y,(heights[u.kind]||.7)+.3,'gold');}}
  else if(selected>=0&&hover&&['battle','setup'].includes(game.phase)){
   const setup=game.phase==='setup',c=window.DeployGame.CARDS[game.hand[selected]],valid=setup?game.valid(aim.x,aim.y,'home'):preview?.valid,col=valid?'#8fffe1':'#a09aae';
   effect('aim','ring',aim.x,aim.y,setup?32:c?.r||32,col);effect('aim-fill','disk',aim.x,aim.y,setup?32:c?.r||32,col,.12);if(c?.centerRadius&&!setup)effect('aim-center','ring',aim.x,aim.y,c.centerRadius,'#fff2d2');
   if(preview?.caster&&!setup){effect('range','ring',preview.caster.x,preview.caster.y,preview.range,'#c6efde',.5);effect('caster','ring',preview.caster.x,preview.caster.y,34,'#fff5ba');beam('aimline',preview.caster,aim,col,.7,.013);}
   if(preview?.coop){for(const id of preview.coop.targets){const u=game.units.find(u=>u.id===id);if(u)effect(id+'coop','ring',u.x,u.y,39,'#c8ffa8');}preview.coop.links.forEach((l,i)=>beam('coop'+i,l.from,l.to,'#b4f5d0'));}
  }
  if(dodgePreview?.caster){const p=dodgePreview,c=p.valid?'#b9ffe1':'#ff9e84';effect('dodge-range','ring',p.caster.x,p.caster.y,p.range,c,.5);effect('dodge-end','ring',p.x,p.y,24,c);beam('dodge-line',p.caster,p,c);}
  for(const [id,a]of actors)if(!a.seen){
   if(a.mixer&&a.unit?.hp<=0&&!['setup','opening'].includes(game.phase)){
    a.deathTime??=0;a.deathTime+=game.paused?0:game.phase==='battle'?Math.max(0,game.time-a.gameTime):frameDelta;a.gameTime=game.time;
    const duration=a.clips.find(c=>c.name==='Down')?.duration||2;
    a.el.hidden=true;a.hit.userData.unit=null;pose(a,'001ko',Math.min(2,a.deathTime/duration*2));if(a.deathTime<duration+.4)continue;
   }
   removeActor(id,a);
  }
  for(const [key,o]of effects){if(!o.seen){o.visible=false;o.userData.idle=(o.userData.idle||0)+1;if(o.userData.idle>90){scene.remove(o);o.material.dispose();materials.delete(o.material);effects.delete(key);}}else o.userData.idle=0;}
  for(const [key,el]of labels){if(!el.seen){el.hidden=true;el.idle=(el.idle||0)+1;if(el.idle>90){el.remove();labels.delete(key);}}else el.idle=0;}
  renderer.render(scene,camera);frames++;
 }
 const lost=e=>{e.preventDefault();onSuspend('3D 画面连接中断，已暂停；恢复后继续。');};canvas.addEventListener('webglcontextlost',lost);
 canvas.dataset.engine='three';canvas.dataset.renderer='webgl2';canvas.dataset.quality='hd';
 renderer.setAnimationLoop(frame);
 return {ready:modelLoad,diagnostics:()=>({frames,actors:actors.size,effects:effects.size,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,pixelRatio:renderer.getPixelRatio(),width:canvas.width,height:canvas.height,rigged:[...actors].filter(([,a])=>a.bones?.length).map(([id,a])=>({id,kind:a.kind,bones:a.bones.length})),animated:[...actors].filter(([,a])=>a.mixer).map(([id,a])=>({id,kind:a.kind,clip:a.clip?.name,state:a.state,time:a.action?.time,yaw:a.root.rotation.y,bones:a.bones.length,rigIds:[...a.skeletons].map(s=>s.uuid),pose:a.bones.reduce((s,b)=>s+b.quaternion.x+b.quaternion.y*2+b.quaternion.z*3,0),dead:a.deathTime!==undefined}))}),destroy(){disposed=true;renderer.setAnimationLoop(null);draco.dispose();observer.disconnect();canvas.removeEventListener('webglcontextlost',lost);for(const [id,a]of actors)removeActor(id,a);labelsRoot.remove();loading.remove();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();renderer.dispose();delete window.battleView;}};
};
window.dispatchEvent(new Event('battle-renderer-ready'));
