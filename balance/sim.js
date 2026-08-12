// 纹兽战记 · 平衡台模拟器 v2
// 默认 PROFILE=human：复刻真人单局(遗物滚雪球/事件/商店/金币/Meta)，不再用「裸装 AI」当默认。
// PROFILE=bare：旧模式(无遗物成长/跳过事件)，仅供对照。
// 用法: node sim.js [N]
//   PROFILE=human|bare  STARTLV=2  META_RELIC=power_band  DECK=0|1|2
//   RELICS=... 额外遗物(与 META_RELIC 叠加)  ITEMS=power_amulet  ASC=0
'use strict';
const {loadGameData}=require('./loadData');
const G=loadGameData();
const {typeMult,SKILLS,LEARN,DRAFT_POOL,UNIVERSAL_DRAFT,POOL,WILD,ELITE,CH_BOSS,EVO,EEVEE_FORMS,CH_ELITE,RELICS,STATUS,ascEnemyMul,ascBossMul,ascRestHeal,
  COLS,ROWS,PSTART,ESLOTS,MAXLV,THRESH,STAGE_LV,EVO_BONUS,ENEMY_LV,ELITE_LV,BOSS_LV,MAP_DEPTH,HELD_ITEMS,START_DECKS}=G;
const SIMMAPS=G.MAPS;let TERRAIN=(SIMMAPS&&SIMMAPS.length)?SIMMAPS[0]:G.TERRAIN;
const HELD_KEYS=HELD_ITEMS?Object.keys(HELD_ITEMS):[];

const PROFILE=(process.env.PROFILE||'human').toLowerCase(); // human | bare
const EH=+(process.env.EH||G.ENEMY_POWER), BH=+(process.env.BH||G.BOSS_HP), EC=+(process.env.EC||0), DEPTOT=+(process.env.DEPTOT||5);
const STARTLV=+(process.env.STARTLV||1);
const EHPM=+(process.env.EHP||G.ENEMY_HP_MUL||1);
const DECK_IDX=+(process.env.DECK||0);
const ITEMID=process.env.ITEMS||null;
const ASC=+(process.env.ASC||0);
const META_RELIC=process.env.META_RELIC||'';
const EXTRA_RELICS=(process.env.RELICS||'').split(',').map(s=>s.trim()).filter(Boolean);
const MOVCAP=+(process.env.MOVCAP||G.ENEMY_MOV_CAP||99); // 敌方机动上限(镜像 config.ENEMY_MOV_CAP)
const FEAT=Object.assign({focusFire:0,huntCarry:0},G.FEATURES||{}); // 恶意特性开关(镜像 config.FEATURES;env FF/HC 覆写做 A/B)
if(process.env.FF!=null)FEAT.focusFire=+process.env.FF;if(process.env.HC!=null)FEAT.huntCarry=+process.env.HC;
const CRITX=3, DOUBLE_GAP=4, FOREST_AVO=15, EEVEE=['fire','water','electric'];
// 可复现随机(v0.62)。实测:同配置 N=120 重复跑,通关率在 32.5%~48.3% 间浮动(极差 15.8pp)
// ⇒ 此前多数 A/B 结论(差异 <10pp)都在噪声内。定种子 + 加大 N 是唯一解。
if(process.env.SEED){let _a=(+process.env.SEED)>>>0;
  Math.random=function(){_a|=0;_a=_a+0x6D2B79F5|0;let t=Math.imul(_a^_a>>>15,1|_a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rnd=()=>Math.random()*100, ri=n=>Math.random()*n|0;
let M, run;
const TRACE=!!process.env.TRACE; let TRACING=false;
function T(s){if(TRACING)console.log(s);}
const POLICY=(process.env.POLICY||'smart').toLowerCase(); // smart | novice(纯贪心,不避威胁不撤退——量"技巧梯度"用,策略定义锁死勿改)
let __EID=0; // 敌人流水号(被迫应变率对照用)

function relicsOf(){return (run&&run.relics)||[];}
function hasRelicS(id){return relicsOf().some(r=>r.id===id);}
function deckShortS(){return (run&&run.pool)?Math.max(0,6-run.pool.length):0;}

// ---- 遗物钩子(读 run.relics,局内动态增长) ----
function rDmg(att,sk,def){let m=1;if(att.player)for(const r of relicsOf())if(r.dmgMult)m*=r.dmgMult(att,sk,def);return m;}
function rHit(att,sk){let a=0;if(att.player){for(const r of relicsOf())if(r.hitAdd)a+=r.hitAdd(att,sk);const it=itemOfS(att);if(it&&it.hit)a+=it.hit;}return a;}
function rCap(){let a=0;for(const r of relicsOf())if(r.capAdd)a+=r.capAdd;return a;}
function rExp(){let m=1;for(const r of relicsOf())if(r.expMult)m*=r.expMult;return m;}
function rStat(u){u._rb={atk:0,def:0,spd:0,maxhp:0,lck:0};const ds=defScaleS();
  for(const r of relicsOf()){if(!r.statMod)continue;
    const bb={atk:u.atk,def:u.def,spd:u.spd,maxhp:u.maxhp,lck:u.lck,hp:u.hp,shield:u.shield||0};
    r.statMod(u);
    if(r.arch==='def'&&ds<1){['atk','def','spd','maxhp','lck','hp'].forEach(k=>{u[k]=bb[k]+Math.round((u[k]-bb[k])*ds);});
      u.shield=bb.shield+Math.round(((u.shield||0)-bb.shield)*ds);}
    u._rb.atk+=u.atk-bb.atk;u._rb.def+=u.def-bb.def;u._rb.spd+=u.spd-bb.spd;u._rb.maxhp+=u.maxhp-bb.maxhp;u._rb.lck+=u.lck-bb.lck;}
  if(u.shield)u.shield=Math.min(u.shield,shieldCapOfS(u));}
function rKill(att){if(att.player)for(const r of relicsOf())if(r.onKill)r.onKill(att);}
// 镜像 core/relics.defScale(v0.59):防御流收益递减
function defScaleS(){const n=relicsOf().filter(r=>r.arch==='def').length;return n>1?1/(1+0.35*(n-1)):1;}
function rThorns(){let t=0;for(const r of relicsOf())if(r.thorns)t+=r.thorns*(r.arch==='def'?defScaleS():1);return Math.round(t);}
function rShieldRegen(){let v=0;for(const r of relicsOf())if(r.shieldRegen)v+=r.shieldRegen;return Math.round(v*defScaleS());}
function rHpDrain(){let v=0;for(const r of relicsOf())if(r.hpDrain)v+=r.hpDrain;return v;}
function rHitFix(){for(const r of relicsOf())if(r.hitFix!=null)return r.hitFix;return null;}
function rCrit(att){let v=0;if(att.player){for(const r of relicsOf())if(r.critAdd)v+=(typeof r.critAdd==='function'?r.critAdd():r.critAdd);const it=itemOfS(att);if(it&&it.crit)v+=it.crit;}return v;}
function rTaken(def){let m=1;if(def&&def.player){const ds=defScaleS();
  for(const r of relicsOf()){if(!r.dmgTakenMult)continue;
    if(r.dmgTakenMult<1&&r.arch==='def')m*=(1-(1-r.dmgTakenMult)*ds);else m*=r.dmgTakenMult;}}
  return m;}
function itemOfS(u){return u&&u.item&&HELD_ITEMS?HELD_ITEMS[u.item]:null;}

let CURUNITS=null;
function adjAlliesS(u){return CURUNITS?CURUNITS.filter(a=>a.player===u.player&&a.hp>0&&a!==u&&Math.abs(a.x-u.x)+Math.abs(a.y-u.y)===1).length:0;}
function isFlankedSideS(att,def){if(!CURUNITS)return false;const dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);const ox=def.x+dx,oy=def.y+dy;return CURUNITS.some(a=>a.player===att.player&&a.hp>0&&a!==att&&a.x===ox&&a.y===oy);}
// 镜像 combat.pushTarget(v0.55):边界=撞墙 / 水=仅处决残血 / Boss免疫 / 精英抗性
const DROWN_EXEC=0.40, DROWN_HURT=0.30;
function pushTargetS(att,def,n){
  if(def.isBoss)return;
  let dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);if(dx&&dy){if(Math.abs(def.x-att.x)>=Math.abs(def.y-att.y))dy=0;else dx=0;}if(!dx&&!dy)return;
  for(let i=0;i<n;i++){
    if(def.elite){def._kr=(def._kr||0)+1;if(def._kr<2)return;def._kr=0;}
    const nx=def.x+dx,ny=def.y+dy;
    if(nx<0||ny<0||nx>=COLS||ny>=ROWS){def.hp-=4;if(att.player&&def.hp<=0){tally('edgeKill');tally('envKill');M.hits.pkill=(M.hits.pkill||0)+1;}return;}
    if(TERRAIN[ny][nx]===1){
      if(def.hp<=def.maxhp*DROWN_EXEC){
        if(att.player){tally('drownKill');tally('envKill');M.hits.pkill=(M.hits.pkill||0)+1;
          if(def.elite)tally('envKillElite');M.envHp=(M.envHp||0)+def.hp/def.maxhp;M.envN=(M.envN||0)+1;}
        def.hp=0;
      }else def.hp-=Math.max(1,Math.round(def.maxhp*DROWN_HURT));
      return;}const occ=CURUNITS&&CURUNITS.find(u=>u.x===nx&&u.y===ny&&u.hp>0);if(occ){def.hp-=4;occ.hp-=4;return;}def.x=nx;def.y=ny;}}

// ---- 数值 ----
// 镜像 combat.js 的护盾上限与消耗(v0.56)
const SHIELD_CAP=(G.SHIELD_CAP!=null?G.SHIELD_CAP:0.5);
// 镜像 v0.58 位置经济学
const ZOC_ON=(process.env.ZOC!=null)?+process.env.ZOC:(G.ZOC_ON!=null?G.ZOC_ON:0);
const FLANK_MULT=(G.FLANK_MULT!=null?G.FLANK_MULT:1.15);
const FLANK_NC=(process.env.FLNC!=null)?+process.env.FLNC:(G.FLANK_NOCOUNTER!=null?G.FLANK_NOCOUNTER:0);
function zocProvokersS(units,u,ox,oy,nx,ny){
  if(!ZOC_ON)return [];
  return units.filter(e=>e.player!==u.player&&e.hp>0
    &&Math.abs(e.x-ox)+Math.abs(e.y-oy)===1&&Math.abs(e.x-nx)+Math.abs(e.y-ny)!==1);}
function zocProvokeS(units,u,ox,oy,nx,ny){
  for(const e of zocProvokersS(units,u,ox,oy,nx,ny)){
    if(u.hp<=0||e.hp<=0)break;
    tally(u.player?'zocOnPlayer':'zocOnEnemy');
    strike(e,u,'basic');}
  return u.hp>0;}
function shieldCapOfS(u){return Math.max(1,Math.round(u.maxhp*SHIELD_CAP));}
function addShieldS(u,n){u.shield=Math.min((u.shield||0)+n,shieldCapOfS(u));return u.shield;}
// 镜像 combat.losBlocked(v0.71)
const LOS_HIT=(G.LOS_HIT!=null?G.LOS_HIT:20), LOS_DMG=(G.LOS_DMG!=null?G.LOS_DMG:0.8);
function losBlocked(ax,ay,bx,by){
  if(TERRAIN[ay]&&TERRAIN[ay][ax]===4)return false;
  const dx=bx-ax,dy=by-ay;if(Math.abs(dx)+Math.abs(dy)<2)return false;
  const steps=Math.max(Math.abs(dx),Math.abs(dy))*2,seen={};
  for(let i=1;i<steps;i++){
    const x=Math.round(ax+dx*i/steps),y=Math.round(ay+dy*i/steps);
    if((x===ax&&y===ay)||(x===bx&&y===by))continue;
    const k=x+','+y;if(seen[k])continue;seen[k]=1;
    if(TERRAIN[y]&&TERRAIN[y][x]===2)return true;
    if(CURUNITS&&CURUNITS.some(u=>u.hp>0&&u.x===x&&u.y===y))return true;}
  return false;}
function cover(u){return TERRAIN[u.y][u.x]===2?2:0;}
function avo(u){return TERRAIN[u.y][u.x]===2?FOREST_AVO:0;}
function baseDmg(att,def,sk){const m=typeMult(sk.type,def.type);if(m===0)return{d:0,m:0};const _k=(G.DEF_K!=null?G.DEF_K:16),_dv=def.def+cover(def);let d=Math.max(1,Math.round(att.atk*sk.mult*m*(_k/(_k+_dv))));
  if(losBlocked(att.x,att.y,def.x,def.y))d=Math.max(1,Math.round(d*LOS_DMG));d=Math.round(d*rDmg(att,sk,def)*rTaken(def));if(sk.useShield)d+=(att.shield||0);if(TERRAIN[att.y]&&TERRAIN[att.y][att.x]===4)d=Math.round(d*1.25);if(isFlankedSideS(att,def))d=Math.round(d*(hasRelicS('flank')?1.5:FLANK_MULT));if(att.player){if(hasRelicS('formation'))d=Math.round(d*(1+0.12*adjAlliesS(att)));if(hasRelicS('alpha')&&!def.acted)d=Math.round(d*1.4);}return{d:Math.max(1,d),m};}
function hitRate(att,def,sk){if(att.player){const fx=rHitFix();if(fx!=null)return fx;}
  const _los=losBlocked(att.x,att.y,def.x,def.y)?LOS_HIT:0;
  return Math.max(0,Math.min(100,Math.round(sk.hit+att.skl*2-(def.spd*2+def.lck)-avo(def)-_los+rHit(att,sk))));}
function critRate(att,def,sk){return Math.max(0,Math.min(100,Math.round(sk.crit+att.skl-def.lck+rCrit(att))));}
function doubles(a,b){return (a.spd-b.spd)>=DOUBLE_GAP;}
function reachOf(u){let mr=0;u.skills.forEach(s=>{const sk=SKILLS[s];if(sk&&(sk.kind==='atk'||sk.kind==='aoe'))mr=Math.max(mr,sk.rb);});return u.rng+mr;}
function dist(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function unitAt(units,x,y){return units.find(u=>u.x===x&&u.y===y&&u.hp>0);}

function gainExp(u,amt){if(!u.player||u.lv>=MAXLV)return;u.exp+=Math.round(amt*rExp());
  while(u.lv<MAXLV&&u.exp>=THRESH[u.lv]){u.exp-=THRESH[u.lv];u.lv++;u.maxhp+=3;u.atk+=1;u.def+=1;u.skl+=1;if(u.lv%2===0)u.spd+=1;
    if(!u.hero){const list=LEARN[u.transformed?u.type:u.key]||LEARN[u.type]||['basic'];const sk=list[u.lv-1];if(sk&&!u.skills.includes(sk))u.skills.push(sk);}
    if(!u.hero&&!u.noEvo){const line=EVO[u.key];let g=0;while(g++<3){const nx=(u.stage||0)+1,req=STAGE_LV[nx];if(!req||!line||!line[nx]||u.lv<req)break;u.stage=nx;const b=EVO_BONUS[nx];u.maxhp+=b.hp;u.atk+=b.atk;u.def+=b.def;u.spd+=b.spd;}}
  }}
function tally(c){M.hits[c]=(M.hits[c]||0)+1;}

// ============ 退化玩法猎手:不变量断言 + 归因 ============
// 思路:写一批"永远不该发生"的事,跑上万场收集违规,并记录【是谁造成的】(技能/遗物)。
// 工具只负责给出"统计上反常"的候选名单;"是 bug 还是特色"由人判断。
const ANOM={};let CURTURN=0,CURNODE='';
function anom(kind,tag,val){
  const a=ANOM[kind]||(ANOM[kind]={n:0,by:{},max:0,maxTag:''});
  a.n++;if((val||0)>a.max){a.max=val||0;a.maxTag=tag||'';}
  if(tag)a.by[tag]=(a.by[tag]||0)+1;
}
function skillTag(att,skKey){const s=SKILLS[skKey];return (att.player?'我·':'敌·')+((s&&s.name)||skKey);}
function relicTags(){return relicsOf().map(r=>r.name);}
function applyEff(u,kind){const st=STATUS[kind];if(!st)return;u.eff=u.eff||{};if(st.stack)u.eff[kind]=(u.eff[kind]||0)+(st.apply||3);else u.eff[kind]=st.turns;}
const CHARGE_MULT=1.8;
function strike(att,def,skKey){let s=SKILLS[skKey]||skKey;if(att.skillUp){const _up=att.skillUp[skKey]||0;if(_up)s=Object.assign({},s,{mult:s.mult*(1+0.2*_up)});}
  if(att._charged&&s.mult){s=Object.assign({},s,{mult:s.mult*CHARGE_MULT});att._charged=0;}const times=(doubles(att,def)&&s.kind!=='aoe')?2:1;let dealt=0;const _df=(def.hp===def.maxhp);const _hp0=def.hp;let _spent=false;
  for(let i=0;i<times;i++){if(def.hp<=0)break;const b=baseDmg(att,def,s);
    if(b.m===0){if(att.player)tally('immune');else tally('e_immune');break;}
    if(rnd()>=hitRate(att,def,s)){if(att.player)tally('miss');continue;}
    const crit=rnd()<critRate(att,def,s);let d=crit?b.d*CRITX:b.d;if(def.dmgCap&&d>def.dmgCap)d=def.dmgCap;const ab=Math.min(def.shield||0,d);if(ab>0)def.shield-=ab;def.hp-=(d-ab);dealt+=d;
    if(d>=def.maxhp*0.6)anom('① 单次重击 ≥60%最大生命',skillTag(att,skKey),d/def.maxhp);
    if(att.player&&att.src)att.src._dmgDealt=(att.src._dmgDealt||0)+d;
    if(att.player)tally(b.m>1?'super':b.m<1?'resist':'neutral');
    else tally(b.m>1?'e_super':b.m<1?'e_resist':'e_neutral');
    if(s.useShield&&!_spent&&(att.shield||0)>0){_spent=true;att.shield=0;}
    if(s.inflict&&def.hp>0&&Math.random()*100<s.inflict.chance)applyEff(def,s.inflict.kind);
    if(att.player&&def.hp>0)for(const r of relicsOf())if(r.onHitInflict&&Math.random()*100<r.onHitInflict.chance)applyEff(def,r.onHitInflict.kind);
    if(att.player&&def.hp>0){const _it=itemOfS(att);if(_it&&_it.onHit&&Math.random()*100<_it.onHit.chance)applyEff(def,_it.onHit.kind);}
    if(!att.player&&rThorns()>0&&att.hp>0)att.hp-=rThorns();
  }
  if(att.player&&def.hp<=0){M.hits.pkill=(M.hits.pkill||0)+1;if(_df)M.hits.oskill=(M.hits.oskill||0)+1;
    if(_hp0>def.maxhp*0.5)anom('② 高血斩杀 一次行动打死>50%血的敌人',skillTag(att,skKey),_hp0/def.maxhp);
    if(def.isBoss&&CURTURN<=2)anom('③ Boss 在≤2回合内死亡',CURNODE+' 回合'+CURTURN,CURTURN);}
  if(!att.player&&def.player&&def.hp<=0){tally('pdeath');if(def._hadEscape)tally('pdeathAvoid');} // 我方阵亡:死前自己回合有零暴露落点=可避免(代理)
  if(s.recoil&&dealt>0&&att.hp>0)att.hp-=Math.max(1,Math.round(dealt*s.recoil));
  if(def.hp>0&&(s.knock||(att.player&&hasRelicS('knockback'))))pushTargetS(att,def,s.knock||1);
  return dealt;}

// ---- 单位 / 池 ----
function metaBump(m,target){while(m.lv<target){m.lv++;m.maxhp+=3;m.atk+=1;m.def+=1;m.skl+=1;if(m.lv%2===0)m.spd+=1;const key=m.hero?'normal':m.key;const sk=(LEARN[key]||['basic'])[m.lv-1];if(sk&&!m.skills.includes(sk)&&!m.hero)m.skills.push(sk);}}
function poolEntry(p){const e={key:p.key,type:p.type,hero:!!p.hero,lv:1,exp:0,stage:0,maxhp:p.hp,atk:p.atk,def:p.def,spd:p.spd,skl:p.skl,lck:p.lck,mov:p.mov,rng:p.rng,skills:(LEARN[p.key]||['basic']).slice(0,2),skillUp:{}};if(STARTLV>1)metaBump(e,STARTLV);e.curHp=e.maxhp;return e;}
function buildDeck(d){const arr=[];(d.units||[]).forEach(u=>{if(String(u).indexOf('w:')===0){const w=WILD[u.slice(2)];if(w)arr.push(poolEntryFromWild(w));}else{const p=POOL.find(x=>(x.key||x.type)===u);if(p)arr.push(poolEntry(p));}});return arr.length?arr:POOL.map(poolEntry);}
function poolEntryFromWild(w){const k=w.key||w.type;return{key:k,type:w.type,hero:false,lv:1,exp:0,stage:0,maxhp:w.hp,atk:w.atk,def:w.def,spd:w.spd,skl:w.skl,lck:w.lck,mov:w.mov,rng:w.rng,curHp:w.hp,skills:(LEARN[k]||['basic']).slice(0,2),skillUp:{}};}
function mkBattleUnit(src,x,y){const u=Object.assign({},src);u.player=true;u.src=src;u.x=x;u.y=y;u.hp=Math.max(1,Math.min(src.maxhp,src.curHp!=null?src.curHp:src.maxhp));u.skills=src.skills.slice();u.transformed=false;rStat(u);
  if(ITEMID&&HELD_ITEMS[ITEMID]){u.item=ITEMID;const it=HELD_ITEMS[ITEMID];u._rb=u._rb||{atk:0,def:0,spd:0,maxhp:0,lck:0};if(it.atk){u.atk+=it.atk;u._rb.atk+=it.atk;}if(it.def){u.def+=it.def;u._rb.def+=it.def;}if(it.spd){u.spd+=it.spd;u._rb.spd+=it.spd;}if(it.maxhp){u.maxhp+=it.maxhp;u.hp+=it.maxhp;u._rb.maxhp+=it.maxhp;}}
  return u;}
function enemyLevelS(t,boss){return (ENEMY_LV[run.chapter]||4)+(boss?BOSS_LV:(t.elite?ELITE_LV:0));}
function mkEnemy(t,x,y,boss){const aE=ascEnemyMul(ASC),aB=ascBossMul(ASC);const lv=enemyLevelS(t,boss);const e=Object.assign({},t);e.player=false;
  let hp=t.hp,atk=t.atk,def=t.def,spd=t.spd,skl=t.skl;
  for(let l=1;l<lv;l++){hp+=3;atk+=1;def+=1;skl+=1;if(l%2===0)spd+=1;}
  e.maxhp=boss?Math.round(hp*BH*aB):Math.round(hp*EHPM*aE);e.hp=e.maxhp; // 血量只由 EHPM 控制(v0.68 解耦)
  e.atk=boss?Math.round(atk*aB):Math.round(atk*EH*aE);e.def=def;e.spd=spd;e.skl=skl;e.lv=lv;
  e.mech=t.mech;e.dmgCap=t.dmgCap;e.bossShield=t.bossShield;e._id=++__EID;e.isBoss=!!boss;
  e.mov=Math.min(e.mov||t.mov,MOVCAP);
  e.x=x;e.y=y;e.skills=t.skills.slice();return e;}
let CAPBUF=null;
function capChanceS(def){return Math.min(0.95,(def.elite?0.25:0.70)*(1-def.hp/def.maxhp)+rCap());}
function baseByKey(k){if(WILD[k])return WILD[k];for(const p of POOL)if((p.key||p.type)===k)return p;if(CH_ELITE)for(const c in CH_ELITE)if(CH_ELITE[c].key===k)return CH_ELITE[c];if(CH_BOSS)for(const c in CH_BOSS)if(CH_BOSS[c].key===k)return CH_BOSS[c];return null;}
function isBossKey(k){if(!CH_BOSS)return false;for(const c in CH_BOSS)if(CH_BOSS[c].key===k)return true;return false;}
function poolFromEnemy(e,lv){const k=e.key||e.type;const b=baseByKey(k)||e;const boss=isBossKey(k);const sk=(b.skills&&b.skills.length?b.skills.slice():(e.skills&&e.skills.length?e.skills.slice():(LEARN[k]||LEARN[e.type]||['basic']).slice(0,2)));const mh=Math.max(1,Math.round((b.hp||e.maxhp)*(boss?0.85:1)));const en={key:k,type:b.type||e.type,hero:false,lv:1,exp:0,stage:0,maxhp:mh,curHp:mh,atk:Math.round((b.atk||e.atk)*(boss?0.9:1)),def:b.def||e.def,spd:b.spd||e.spd,skl:b.skl||e.skl,lck:b.lck||e.lck,mov:b.mov||e.mov,rng:b.rng||e.rng,skills:sk,skillUp:{}};return bumpEntryS(en,lv||1);}
// —— 镜像 units.bumpEntryToLv / combat.expGain(v0.50) ——
function bumpEntryS(m,target){target=Math.min(target||1,MAXLV);
  while(m.lv<target){m.lv++;m.maxhp+=3;m.curHp=(m.curHp!=null?m.curHp:m.maxhp)+3;m.atk+=1;m.def+=1;m.skl+=1;if(m.lv%2===0)m.spd+=1;
    const key=m.hero?'normal':(m.key||m.type);const sk=(LEARN[key]||['basic'])[m.lv-1];if(sk&&!m.skills.includes(sk)&&!m.hero)m.skills.push(sk);
    if(!m.hero&&!m.noEvo){const line=EVO[m.key||m.type];const next=(m.stage||0)+1;if(line&&STAGE_LV[next]&&line[next]&&m.lv>=STAGE_LV[next]){m.stage=next;const b=EVO_BONUS[next];m.maxhp+=b.hp;m.curHp+=b.hp;m.atk+=b.atk;m.def+=b.def;m.spd+=b.spd;}}}
  return m;}
function expGainS(u,tgt,kill){const lvd=((tgt&&tgt.lv)||1)-u.lv;const mod=Math.max(0.3,Math.min(2,1+lvd*0.25));let v=12*mod;if(kill)v+=6;if(tgt&&tgt.elite)v*=1.3;return Math.round(v);}

// ---- 单局成长:遗物/事件/商店(真人会吃的) ----
function initRelics(){const ids=new Set();const out=[];
  const add=id=>{const r=RELICS.find(x=>x.id===id);if(r&&!ids.has(id)){ids.add(id);out.push(r);}};
  if(META_RELIC)add(META_RELIC);
  EXTRA_RELICS.forEach(add);
  if(PROFILE==='human'&&START_DECKS&&START_DECKS[DECK_IDX]&&START_DECKS[DECK_IDX].relic)add(START_DECKS[DECK_IDX].relic);
  return out;
}
function scoreRelicPick(r){let s=2;if(r.dmgMult)s+=4;if(r.statMod)s+=3;if(r.expMult)s+=2;if(r.shieldRegen)s+=3;if(r.dmgTakenMult)s+=2;if(r.critAdd)s+=2;if(r.thorns)s+=1;if(r.tag)s+=3;if(r.onHitInflict)s+=3;if(r.arch){s+=relicsOf().filter(x=>x.arch===r.arch).length*3;}
  if(r.id==='lean_zeal'||r.id==='light_pack')s+=deckShortS();if(r.id==='lone_wolf'&&run.pool&&run.pool.length<=3)s+=4;
  if(r.arch==='def'){const n=relicsOf().filter(x=>x.arch==='def').length;s-=n*2;}   // 防御已递减,再堆不划算
  if(r.curse)s-=4;                                                                  // 诅咒有代价,AI 谨慎但不排斥
  return s;}
function pickRelicReward(){const owned=new Set(relicsOf().map(r=>r.id));const pool=RELICS.filter(r=>!owned.has(r.id));if(!pool.length)return;
  const tmp=pool.slice(),cands=[];for(let i=0;i<3&&tmp.length;i++)cands.push(tmp.splice(ri(tmp.length),1)[0]);
  let best=cands[0],bs=scoreRelicPick(best);for(const r of cands)if(scoreRelicPick(r)>bs){bs=scoreRelicPick(r);best=r;}
  run.relics.push(best);M.relicPicks=(M.relicPicks||0)+1;}
function grantExpPool(m,amt){const cap=Math.min(MAXLV,(ENEMY_LV[run.chapter]||3)+1);if(m.lv>=cap)return;m.exp+=amt;while(m.lv<cap&&m.exp>=THRESH[m.lv]){m.exp-=THRESH[m.lv];bumpEntryS(m,m.lv+1);}}
function grantRandomRelic(){const owned=new Set(relicsOf().map(r=>r.id));const pool=RELICS.filter(r=>!owned.has(r.id));if(!pool.length)return;run.relics.push(pool[ri(pool.length)]);}
const SIM_EVENTS=[
 ()=>run.pool.forEach(m=>grantExpPool(m,30)),
 ()=>{const ks=Object.keys(WILD);run.pool.push(poolFromEnemy(WILD[ks[ri(ks.length)]],ENEMY_LV[run.chapter]||1));},
 ()=>run.pool.forEach(m=>{m.atk+=1}),
 ()=>run.pool.forEach(m=>{m.maxhp+=3;m.curHp=(m.curHp!=null?m.curHp:m.maxhp)+3}),
 ()=>run.pool.forEach(m=>grantExpPool(m,20)),
 ()=>grantRandomRelic(),
 ()=>{run.gold=(run.gold||0)+25},
 ()=>{const m=run.pool[ri(run.pool.length)];if(m){m.atk+=4;}},
 ()=>run.pool.forEach(m=>{m.def+=1}),
 ()=>run.pool.forEach(m=>m.curHp=m.maxhp),
];
function simEvent(){SIM_EVENTS[ri(SIM_EVENTS.length)]();M.events=(M.events||0)+1;}
function simShop(){const owned=new Set(relicsOf().map(r=>r.id));let pool=RELICS.filter(r=>!owned.has(r.id));
  for(let i=0;i<2&&pool.length;i++){const idx=ri(pool.length);const r=pool[idx];pool=pool.filter((_,j)=>j!==idx);
    if((run.gold||0)>=50&&scoreRelicPick(r)>=3){run.gold-=50;run.relics.push(r);M.shopRelic=(M.shopRelic||0)+1;break;}}
  if((run.gold||0)>=30&&run.pool.some(m=>(m.curHp!=null?m.curHp:m.maxhp)<m.maxhp)){run.gold-=30;run.pool.forEach(m=>m.curHp=m.maxhp);M.shopHeal=(M.shopHeal||0)+1;}
  if(HELD_KEYS.length&&(run.gold||0)>=40){run.gold-=40;run.bag=run.bag||[];run.bag.push(HELD_KEYS[ri(HELD_KEYS.length)]);M.shopItem=(M.shopItem||0)+1;}}
function afterBattleWin(nodeType,chapter){run.gold=(run.gold||0)+12+chapter*3;if(PROFILE==='human'&&(nodeType==='elite'||nodeType==='boss'))pickRelicReward();}
function _learnableS(m){const base=(DRAFT_POOL[m.key]||DRAFT_POOL[m.type]||[]);return base.concat(UNIVERSAL_DRAFT||[]).filter((v,i,a)=>a.indexOf(v)===i&&SKILLS[v]);}
function simDraft(){const pool=(run.pool||[]).filter(m=>!m.hero);if(!pool.length)return;const m=pool.slice().sort((a,b)=>(b.lv*8+b.atk)-(a.lv*8+a.atk))[0];m.skillUp=m.skillUp||{};const atks=m.skills.filter(k=>{const s=SKILLS[k];return s&&(s.kind==='atk'||s.kind==='aoe');});if(Math.random()<0.3&&m.skills.length<4){const cand=_learnableS(m).filter(k=>!m.skills.includes(k));if(cand.length){m.skills.push(cand[ri(cand.length)]);M.draftLearn=(M.draftLearn||0)+1;return;}}if(atks.length){const best=atks.slice().sort((a,b)=>(SKILLS[b].mult||0)-(SKILLS[a].mult||0))[0];if(((m.skillUp[best])||0)<3){m.skillUp[best]=(m.skillUp[best]||0)+1;M.draftUp=(M.draftUp||0)+1;return;}}if(m.skills.length<4){const cand=_learnableS(m).filter(k=>!m.skills.includes(k));if(cand.length){m.skills.push(cand[ri(cand.length)]);M.draftLearn=(M.draftLearn||0)+1;}}}
function equipBagItems(){if(!ITEMID&&run.bag&&run.bag.length){const id=run.bag.pop();const m=run.pool.slice().sort((a,b)=>b.atk-a.atk)[0];if(m&&!m.item)m.item=id;}}

// ---- 寻路 / AI ----
function moveTiles(units,u){const seen={[u.x+','+u.y]:0},q=[{x:u.x,y:u.y,d:0}],out=[{x:u.x,y:u.y,d:0}];
  while(q.length){const c=q.shift();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=c.x+dx,ny=c.y+dy;
    if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;if(TERRAIN[ny][nx]===1)continue;if(unitAt(units,nx,ny))continue;const nd=c.d+1;if(nd>u.mov)continue;if(seen[nx+','+ny]!==undefined)continue;seen[nx+','+ny]=nd;q.push({x:nx,y:ny,d:nd});out.push({x:nx,y:ny,d:nd});}}
  return out;}
function _threatAtS(units,x,y,exclude){let n=0;units.forEach(e=>{if(!e.player&&e.hp>0&&e!==exclude&&(Math.abs(e.x-x)+Math.abs(e.y-y))<=e.mov+reachOf(e))n++;});return n;}
// 候选动作全集(按分排序)。chooseAttack 取 top1;近择率/被迫应变率读全表。
function _plans(units,u,reachBias){const enemies=units.filter(e=>!e.player&&e.hp>0);if(!enemies.length)return[];
  const tiles=u.moved?[{x:u.x,y:u.y,d:0}]:moveTiles(units,u);const out=[];
  for(const sk of u.skills){const s=SKILLS[sk];if(s.kind!=='atk'&&s.kind!=='aoe')continue;const R=u.rng+(s.rb||0);
    for(const e of enemies){if(typeMult(s.type,e.type)===0)continue;
      // v0.71:落点必须【逐格算伤害】。此前是"先按暴露挑格、再算伤害",于是视线遮挡/高地加成
      // 这类【随落点变化】的效应对 AI 不可见 —— 第四次踩"AI 看不见机制"。
      let cand=null,cs=1e9,bBest=null,hBest=0;const _tsc=[];
      for(const t of tiles){if(Math.abs(t.x-e.x)+Math.abs(t.y-e.y)>R)continue;
        const gu=Object.assign({},u,{x:t.x,y:t.y});
        const bb=baseDmg(gu,e,s);if(bb.m===0)continue;
        const hh=hitRate(gu,e,s)/100;
        let expo;
        if(POLICY==='novice'){expo=Math.abs(t.x-u.x)+Math.abs(t.y-u.y);}
        else{const _t=TERRAIN[t.y][t.x];
          expo=_threatAtS(units,t.x,t.y,e)*4-(_t===2?3:0)-(_t===4?3:0)+(_t===3?6:0);
          if(reachBias)expo-=t.x*0.5;
          if(ZOC_ON)expo+=zocProvokersS(units,u,u.x,u.y,t.x,t.y).length*7;
          expo-=bb.d*hh*0.35;} // 该落点的实际输出(含遮挡/高地)计入落点选择
        _tsc.push(expo);
        if(expo<cs){cs=expo;cand=t;bBest=bb;hBest=hh;}}
      if(!cand)continue;
      const b=bBest,hit=hBest,dbl=(u.spd-e.spd>=4&&s.kind!=='aoe'),total=b.d*(dbl?2:1);
      const lethal=total>=e.hp&&hit>=0.6;
      let score;
      if(POLICY==='novice'){score=total*hit+(b.m>1?8:0);} // 笨:只看期望伤害,不算反击/击杀价值/暴露
      else{let counter=0;
        // 夹击免反击 ⇒ 提前用友军包夹是有回报的走位
        const _fl=FLANK_NC&&isFlankedSideS(Object.assign({},u,{x:cand.x,y:cand.y}),e);
        if(!lethal&&!_fl&&s.kind!=='aoe'&&(Math.abs(cand.x-e.x)+Math.abs(cand.y-e.y))<=e.rng)counter=baseDmg(e,u,SKILLS.basic).d*0.6;
        score=total*hit+(lethal?25:0)+(b.m>1?8:0)+(_fl?6:0)+e.atk*0.4-counter-cs;}
      // 位置维度的可选性:有多少个落点的"暴露分"接近最优(±2 分内)—— 近择率原本看不见这个维度
      if(MEASURE&&_tsc.length){const mn=Math.min.apply(null,_tsc);
        M.tileOpt=(M.tileOpt||0)+_tsc.filter(v=>v<=mn+2).length;M.tileTot=(M.tileTot||0)+1;
        M.tileAll=(M.tileAll||0)+_tsc.length;}
      out.push({tile:cand,skKey:sk,enemy:e,score,lethal});}}
  return out.sort((a,b)=>b.score-a.score);}
let MEASURE=false;
function chooseAttack(units,u,reachBias){const p=_plans(units,u,reachBias);return p.length?p[0]:null;}
// 回合级记账:集火压力/逃生位(可避免率代理)/近择率/被迫应变率(与"敌方冻结在回合初"的对照局比 top1 是否同一动作)
function instrumentTurn(units,u,objKind,eSnap){
  M.threatSum=(M.threatSum||0)+_threatAtS(units,u.x,u.y,null);M.threatN=(M.threatN||0)+1;
  // 死亡可避免率(v0.69 重定义):旧定义是"存在零暴露落点",但持久战里"完全不暴露"本就不现实
  // ⇒ 改问"**有没有活路**":存在某个可达格,使下一轮预期承伤 < 当前 HP。
  {const tiles=u.moved?[{x:u.x,y:u.y}]:moveTiles(units,u);
   const samp=tiles.length>14?tiles.filter((_,i)=>i%Math.ceil(tiles.length/14)===0):tiles;
   let minInc=Infinity;
   for(const t of samp){let inc=0;
     for(const e of units){if(e.player===u.player||e.hp<=0)continue;
       if(Math.abs(e.x-t.x)+Math.abs(e.y-t.y)>e.mov+reachOf(e))continue;
       const gu=Object.assign({},u,{x:t.x,y:t.y});let bd=0;
       for(const k of e.skills){const s=SKILLS[k];if(!s||(s.kind!=='atk'&&s.kind!=='aoe'))continue;
         const b=baseDmg(e,gu,s);if(b.m===0)continue;
         const v=b.d*(hitRate(e,gu,s)/100)*((e.spd-u.spd>=DOUBLE_GAP&&s.kind!=='aoe')?2:1);
         if(v>bd)bd=v;}
       inc+=bd;}
     if(inc<minInc)minInc=inc;}
   u._hadEscape=(minInc<u.hp);}
  MEASURE=true;const real=_plans(units,u,objKind==='reach');MEASURE=false;
  if(real.length){tally('choiceTurns');if(real.length>=2&&real[0].score>0&&real[1].score>=real[0].score*0.85)tally('nearChoice');
    // —— 近择率诊断(v0.60):低近择率到底是"没得选"还是"指标不对"? ——
    M.planN=(M.planN||0)+real.length;M.planT=(M.planT||0)+1;
    const best=real[0];
    (M.skillPick=M.skillPick||{})[best.skKey]=(M.skillPick[best.skKey]||0)+1;
    if(real.length>=2&&real[0].score>0){
      const ratio=real[1].score/real[0].score;
      const b=Math.max(0,Math.min(9,Math.floor(ratio*10)));
      (M.gapHist=M.gapHist||{})[b]=(M.gapHist[b]||0)+1;
      // top2 与 top1 是"同一个决策的不同版本"还是"真的两个不同决策"?
      if(real[1].enemy===best.enemy&&real[1].skKey!==best.skKey)tally('altSameTgt');   // 同目标换招
      else if(real[1].enemy!==best.enemy&&real[1].skKey===best.skKey)tally('altSameSk'); // 同招换目标
      else tally('altBoth');
    }
    const es=units.filter(e=>!e.player&&e.hp>0);
    if(es.length>1){
      const lowest=es.reduce((a,b)=>a.hp<=b.hp?a:b);
      if(best.enemy===lowest)tally('pickLowestHp');
      let bt=null,bv=-1;es.forEach(e=>{const v=typeMult(SKILLS[best.skKey].type,e.type);if(v>bv){bv=v;bt=e;}});
      if(best.enemy===bt)tally('pickBestType');
      tally('pickTot');}
  }
  const ghost=units.filter(x=>x.player&&x.hp>0).concat(
    units.filter(x=>!x.player&&eSnap[x._id]).map(e=>{const s=eSnap[e._id];const c=Object.assign({},e);c.x=s.x;c.y=s.y;c.hp=s.hp;return c;}).filter(c=>c.hp>0));
  const gp=_plans(ghost,u,objKind==='reach');
  const rb=real[0],gb=gp[0];
  if(rb||gb){tally('forcedN');if(!rb||!gb||rb.enemy._id!==gb.enemy._id||rb.skKey!==gb.skKey)tally('forced');}}
function actPlayer(units,u,objKind){
  const reachBias=objKind==='reach';
  const plan=chooseAttack(units,u,reachBias);
  const low=u.hp/u.maxhp<0.35;
  // —— 新动作类型的决策(v0.61)。不教会 AI 用,指标就测不出效果(v0.60 的教训)——
  const NEWACT=(process.env.NEWACT!=null)?+process.env.NEWACT:1;
  if(NEWACT&&POLICY!=='novice'&&u.skills.includes('swap')&&low){
    // 残血:与"更耐打且暴露更低"的友军换位 —— 把大哥换出火线
    const R=u.rng+2;let bestSw=null,bv=0;
    for(const a of units){if(!a.player||a.hp<=0||a===u)continue;
      if(dist(u,a)>R)continue;
      const gain=(a.hp/a.maxhp-u.hp/u.maxhp)*10+(_threatAtS(units,u.x,u.y,null)-_threatAtS(units,a.x,a.y,null))*3;
      if(gain>bv){bv=gain;bestSw=a;}}
    if(bestSw){const tx=bestSw.x,ty=bestSw.y;bestSw.x=u.x;bestSw.y=u.y;u.x=tx;u.y=ty;tally('useSwap');return;}
  }
  if(NEWACT&&POLICY!=='novice'&&u.skills.includes('charge')&&!u._charged){
    // 只在"这回合本来就打不到人,但下回合能打到"时蓄力 —— 否则会顶掉推进,变成原地空转
    const foeSoon=units.some(e=>!e.player&&e.hp>0&&dist(u,e)<=u.mov+reachOf(u)+3);
    if(!plan&&foeSoon&&_threatAtS(units,u.x,u.y,null)<=1){u._charged=1;tally('useCharge');return;}
  }
  if(plan&&(POLICY==='novice'||((plan.lethal||plan.score>2)&&!(low&&!plan.lethal&&plan.score<6)))){ // 笨:有仗就打,不权衡
    T('  我方 '+u.key+'(Lv'+u.lv+') →('+plan.tile.x+','+plan.tile.y+') 用['+SKILLS[plan.skKey].name+'] 打 '+plan.enemy.type);
    {const _ox=u.x,_oy=u.y;u.x=plan.tile.x;u.y=plan.tile.y;
     if(ZOC_ON&&!zocProvokeS(units,u,_ox,_oy,u.x,u.y))return;}
    const s=SKILLS[plan.skKey];
    const ce=plan.enemy;
    if(run.pool&&run.pool.length<6&&!ce.elite&&(Math.abs(u.x-ce.x)+Math.abs(u.y-ce.y))<=1&&capChanceS(ce)>=0.35){
      tally('capTry');
      if(Math.random()<capChanceS(ce)){tally('capture');if(CAPBUF)CAPBUF.push(poolFromEnemy(ce,ENEMY_LV[run.chapter]||1));ce.hp=0;gainExp(u,15);}
      return;
    }
    if(s.kind==='aoe'){
      const list=[plan.enemy,...units.filter(e=>!e.player&&e.hp>0&&e!==plan.enemy&&Math.abs(e.x-plan.enemy.x)+Math.abs(e.y-plan.enemy.y)===1)];
      let dealt=0,hitN=0;
      for(const d of list){
        const b=baseDmg(u,d,s);if(b.m===0){tally('immune');continue;}
        if(rnd()>=hitRate(u,d,s)){tally('miss');continue;}
        d.hp-=b.d;dealt+=b.d;hitN++;tally(b.m>1?'super':b.m<1?'resist':'neutral');
      }
      const dead=list.filter(d=>d.hp<=0).length;
      if(dead)rKill(u);
      if(hitN>0)gainExp(u,Math.round(expGainS(u,plan.enemy,false)*(1+0.4*(hitN-1)))+dead*6);
    }else{
      const dealt=strike(u,plan.enemy,plan.skKey);
      if(plan.enemy.hp<=0){rKill(u);gainExp(u,expGainS(u,plan.enemy,true));}
      else{
        const _fl=FLANK_NC&&isFlankedSideS(u,plan.enemy);
        if(!_fl&&dist(u,plan.enemy)<=plan.enemy.rng&&!(plan.enemy.eff&&plan.enemy.eff.para))strike(plan.enemy,u,'basic');
        if(dealt>0)gainExp(u,expGainS(u,plan.enemy,false));
      }
    }
  }else{
    const enemies=units.filter(e=>!e.player&&e.hp>0);
    if(!enemies.length)return;
    const tiles=moveTiles(units,u);
    const near=enemies.reduce((a,b)=>dist(u,a)<dist(u,b)?a:b);
    let bt=null,bs=1e9;
    for(const t of tiles){
      let expo;
      if(POLICY==='novice'){expo=Math.abs(t.x-near.x)+Math.abs(t.y-near.y);} // 笨:直奔最近敌人,不避险
      else{const _t=TERRAIN[t.y][t.x];
        expo=_threatAtS(units,t.x,t.y,null)*4+(low?0:(Math.abs(t.x-near.x)+Math.abs(t.y-near.y))*0.3)-(_t===2?1.5:0)-(_t===4?1.5:0)+(_t===3?6:0);
        if(reachBias)expo-=t.x*0.6;
        if(ZOC_ON)expo+=zocProvokersS(units,u,u.x,u.y,t.x,t.y).length*7;}
      if(expo<bs){bs=expo;bt=t;}
    }
    if(bt&&(bt.x!==u.x||bt.y!==u.y)){const _ox=u.x,_oy=u.y;u.x=bt.x;u.y=bt.y;
      if(ZOC_ON)zocProvokeS(units,u,_ox,_oy,u.x,u.y);}
    // 脱战回复(v0.69):没出手 + 邻格无敌人 ⇒ 喘一口气。制造血线摆动。
    const rh=(G.REST_HEAL!=null?G.REST_HEAL:0);
    if(rh>0&&u.hp>0&&u.hp<u.maxhp&&!units.some(e=>e.player!==u.player&&e.hp>0&&dist(e,u)<=1)){
      u.hp=Math.min(u.maxhp,u.hp+Math.max(1,Math.round(u.maxhp*rh)));tally('restHeal');}
  }
}
function aiScore(e,t){let best=-1;e.skills.forEach(k=>{const s=SKILLS[k];if(s.kind!=='atk'&&s.kind!=='aoe')return;const v=typeMult(s.type,t.type)*s.mult;if(v>best)best=v;});return best;}
function aiPick(e,t){let best='basic',bv=-1;e.skills.forEach(k=>{const s=SKILLS[k];if(s.kind!=='atk'&&s.kind!=='aoe')return;const v=typeMult(s.type,t.type)*s.mult;if(v>bv){bv=v;best=k;}});return best;}
// —— 镜像 ai.js A1/A2(v0.53)——
function bestDmgVsS(e,t){let bd=0;e.skills.forEach(k=>{const s=SKILLS[k];if(!s||(s.kind!=='atk'&&s.kind!=='aoe'))return;const b=baseDmg(e,t,s);if(b.d>bd)bd=b.d;});return bd;}
function pickFocusS(units,e){const foes=units.filter(x=>!x.player&&x.hp>0);let best=null,bs=1e9;
  units.filter(t=>t.player&&t.hp>0).forEach(t=>{let pot=0;foes.forEach(en=>{if(en.acted&&en!==e)return;if(dist(en,t)<=en.mov+reachOf(en))pot+=bestDmgVsS(en,t);});
    if(pot>=t.hp&&t.hp/pot<bs){bs=t.hp/pot;best=t;}});
  return best;}
function actEnemy(units,e){
  if(e.mech==='enrage'&&!e._enraged&&e.hp/e.maxhp<0.5){e.atk=Math.round(e.atk*1.5);e._enraged=true;}
  if(e.bossShield)addShieldS(e,e.bossShield);
  if(e.skills.includes('heal')){
    const hurt=units.filter(a=>!a.player&&a.hp>0&&a!==e&&a.hp<a.maxhp*0.6).sort((a,b)=>(a.hp/a.maxhp)-(b.hp/b.maxhp))[0];
    if(hurt){
      if(dist(e,hurt)>1){
        const tiles=moveTiles(units,e);let bt=null,bd=1e9;
        for(const t of tiles){const dd=Math.abs(t.x-hurt.x)+Math.abs(t.y-hurt.y);if(dd<bd){bd=dd;bt=t;}}
        if(bt){e.x=bt.x;e.y=bt.y;}
      }
      if(dist(e,hurt)<=1)hurt.hp=Math.min(hurt.maxhp,hurt.hp+SKILLS.heal.amount);
      return;
    }
  }
  let ts=units.filter(u=>u.player&&u.hp>0);if(!ts.length)return;
  const hit=ts.filter(t=>aiScore(e,t)>0);if(hit.length)ts=hit;
  ts.sort((a,b)=>{const ma=aiScore(e,a),mb=aiScore(e,b);if(mb!==ma)return mb-ma;if(FEAT.huntCarry){const va=(b.lv*2+b.atk*0.5)-(a.lv*2+a.atk*0.5);if(va)return va;}return a.hp-b.hp;});
  let tgt=ts[0];
  if(FEAT.focusFire){const f=pickFocusS(units,e);if(f&&dist(e,f)<=e.mov+reachOf(e))tgt=f;}
  const sk=aiPick(e,tgt),s=SKILLS[sk],reach=e.rng+(s.rb||0);
  T('  敌 '+e.type+' 用['+SKILLS[sk].name+'] 打 '+tgt.key);
  if(dist(e,tgt)>reach){
    const tiles=moveTiles(units,e);let bt=null,bd=1e9;
    for(const t of tiles){let dd=Math.abs(t.x-tgt.x)+Math.abs(t.y-tgt.y);
      if(ZOC_ON)dd+=zocProvokersS(units,e,e.x,e.y,t.x,t.y).length*3; // 敌方也懂脱离有代价
      if(dd<bd){bd=dd;bt=t;}}
    if(bt&&(bt.x!==e.x||bt.y!==e.y)){const _ox=e.x,_oy=e.y;e.x=bt.x;e.y=bt.y;
      if(ZOC_ON&&!zocProvokeS(units,e,_ox,_oy,e.x,e.y))return;}
  }
  if(dist(e,tgt)<=reach){
    strike(e,tgt,sk);
    if(tgt.hp>0&&!(FLANK_NC&&isFlankedSideS(e,tgt))&&dist(e,tgt)<=tgt.rng&&e.hp>0&&!(tgt.eff&&tgt.eff.para)){
      const back=strike(tgt,e,'basic');
      if(e.hp<=0)gainExp(tgt,expGainS(tgt,e,true));else if(back>0)gainExp(tgt,Math.round(expGainS(tgt,e,false)*0.6));
    }
  }
}

// ---- 单场战斗 ----
function battle(pool,deploy,nodeType,chapter,obj){
  run.chapter=chapter;run.pool=pool;const units=[];const caps=[];CAPBUF=caps;
  if(SIMMAPS&&SIMMAPS.length){const cp=(!process.env.NOCHMAP)&&G.CH_MAPS&&G.CH_MAPS[chapter];
    const fx=process.env.ONEMAP!=null?+process.env.ONEMAP:null;
    TERRAIN=fx!=null?SIMMAPS[fx]:(cp?SIMMAPS[cp[ri(cp.length)]]:SIMMAPS[ri(SIMMAPS.length)]);}
  deploy.forEach((src,s)=>units.push(mkBattleUnit(src,PSTART[s][0],PSTART[s][1])));
  const slots=[0,1,2,4,5];let si=0;const R=()=>{const ks=Object.keys(WILD);return WILD[ks[ri(ks.length)]];};
  if(nodeType==='boss'){units.push(mkEnemy(CH_BOSS[chapter],ESLOTS[3][0],ESLOTS[3][1],true));for(let i=0;i<3+EC&&si<slots.length;i++){const sl=slots[si++];units.push(mkEnemy(R(),ESLOTS[sl][0],ESLOTS[sl][1]));}}
  else if(nodeType==='elite'){units.push(mkEnemy((CH_ELITE&&CH_ELITE[chapter])||ELITE,ESLOTS[3][0],ESLOTS[3][1]));for(let i=0;i<3+EC&&si<slots.length;i++){const sl=slots[si++];units.push(mkEnemy(R(),ESLOTS[sl][0],ESLOTS[sl][1]));}}
  else{const cnt=Math.min(slots.length,4+(Math.random()<0.5?1:0)+EC);for(let i=0;i<cnt;i++){const sl=slots[si++];units.push(mkEnemy(R(),ESLOTS[sl][0],ESLOTS[sl][1]));}}
  const hero=units.find(u=>u.hero);if(hero){const foes=units.filter(u=>!u.player);let bf='electric',bv=-1;for(const f of EEVEE){let v=0;foes.forEach(e=>v+=typeMult(f,e.type));if(v>bv){bv=v;bf=f;}}hero.type=bf;hero.transformed=true;hero.skills=(LEARN[bf]||['basic']).slice(0,Math.max(hero.lv,2));}
  T(`\n[第${chapter}章/${nodeType}] 遗物×${relicsOf().length} 出战:${units.filter(u=>u.player).map(u=>u.key+'Lv'+u.lv).join(' ')}`);
  const pAlive=()=>units.some(u=>u.player&&u.hp>0),eAlive=()=>units.some(u=>!u.player&&u.hp>0);
  const sync=()=>units.filter(u=>u.player&&u.hp>0).forEach(u=>{const s=u.src;const rb=u._rb||{atk:0,def:0,spd:0,maxhp:0,lck:0};s.lv=u.lv;s.exp=u.exp;s.stage=u.stage;s.maxhp=u.maxhp-rb.maxhp;s.atk=u.atk-rb.atk;s.def=u.def-rb.def;s.spd=u.spd-rb.spd;s.skl=u.skl;s.curHp=Math.max(1,Math.min(s.maxhp,u.hp-rb.maxhp));if(!s.hero)s.skills=u.skills.slice();});
  let turns=0;CURUNITS=units;
  const teamMax=Math.max(1,units.filter(x=>x.player).reduce((a,x)=>a+x.maxhp,0));const hpTrace=[];let minHp=1;
  const fin=r=>{let s=0;for(let i=2;i<hpTrace.length;i++){const d1=hpTrace[i-1]-hpTrace[i-2],d2=hpTrace[i]-hpTrace[i-1];if(d1*d2<0&&Math.abs(d2)>0.02)s++;}M.swingSum=(M.swingSum||0)+s;M.swingN=(M.swingN||0)+1;if(r.win&&minHp<=0.30)tally('closeWin');r.minHp=minHp;return r;};
  const objKind=obj&&obj.kind,objN=(obj&&obj.n)||3,reachX=9;
  while(turns<40){turns++;units.forEach(x=>x.acted=false);CURTURN=turns;CURNODE='ch'+chapter+'/'+nodeType;
    const eSnap={};units.forEach(x=>{if(!x.player)eSnap[x._id]={x:x.x,y:x.y,hp:x.hp};});
    if(objKind==='survive'&&turns>objN&&pAlive()){sync();return fin({win:true,turns,dead:units.filter(u=>u.player&&u.hp<=0).map(u=>u.src),caps,nodeType,obj:objKind});}
    if(objKind==='reach'&&units.some(u=>u.player&&u.hp>0&&u.x>=reachX-1)){sync();return fin({win:true,turns,dead:units.filter(u=>u.player&&u.hp<=0).map(u=>u.src),caps,nodeType,obj:objKind});}
    const order=units.filter(u=>u.hp>0).slice().sort((a,b)=>(b.spd-a.spd)||((a.player?0:1)-(b.player?0:1)));
    for(const u of order){if(u.hp<=0)continue;
      if(TERRAIN[u.y]&&TERRAIN[u.y][u.x]===3)u.hp-=4;
      if(u.eff){if(u.eff.burn>0){u.hp-=STATUS.burn.dmg;if(--u.eff.burn<=0)delete u.eff.burn;}if(u.eff.poison>0){u.hp-=u.eff.poison;if(--u.eff.poison<=0)delete u.eff.poison;}}
      if(u.hp<=0){if(u.player){tally('pdeath');if(u._hadEscape)tally('pdeathAvoid');}continue;}
      let _sk=false;if(u.eff&&u.eff.para>0){if(--u.eff.para<=0)delete u.eff.para;if(Math.random()*100<STATUS.para.skip)_sk=true;}
      if(_sk)continue;
      if(u.player){const sr=rShieldRegen();if(sr>0)addShieldS(u,sr);const dr=rHpDrain();if(dr>0&&u.hp>0)u.hp=Math.max(1,u.hp-dr);const it=itemOfS(u);if(it&&it.regen&&u.hp>0)u.hp=Math.min(u.maxhp,u.hp+it.regen);
        if((u.shield||0)>u.maxhp)anom('⑥ 护盾 > 自身最大生命',relicTags().join('+')||'无遗物',u.shield/u.maxhp);}
      if(u.player)instrumentTurn(units,u,objKind,eSnap);
      u.player?actPlayer(units,u,objKind):actEnemy(units,u);u.acted=true;if(!eAlive()||!pAlive())break;}
    {const cur=units.filter(x=>x.player&&x.hp>0).reduce((a,x)=>a+x.hp,0)/teamMax;hpTrace.push(cur);if(cur<minHp)minHp=cur;}
    if(!eAlive()){sync();const _al=units.filter(u=>u.player&&u.hp>0);const _hp=_al.length?_al.reduce((x,u)=>x+u.hp/u.maxhp,0)/_al.length:0;
      if(turns<=1&&!objKind)anom('④ 战斗在第1回合结束','ch'+chapter+'/'+nodeType,1);
      if(_hp>=0.999&&units.filter(u=>u.player).length===_al.length)anom('⑤ 零伤获胜(全员满血)','ch'+chapter+'/'+nodeType,1);
      return fin({win:true,turns,dead:units.filter(u=>u.player&&u.hp<=0).map(u=>u.src),caps,nodeType,hpPct:_hp});}
    if(!pAlive()){sync();return fin({win:false,turns,dead:[],nodeType});}
  }
  return fin({win:false,turns,dead:[],nodeType,stall:true});}

function pickDeploy(pool){const sorted=pool.slice().sort((a,b)=>(b.lv*10+b.atk+b.maxhp/5)-(a.lv*10+a.atk+a.maxhp/5));
  const chosen=[],hero=pool.find(p=>p.hero);if(hero)chosen.push(hero);
  for(const p of sorted){if(chosen.length>=3)break;if(!chosen.includes(p))chosen.push(p);}
  const rest=pool.filter(p=>!chosen.includes(p));for(let i=rest.length-1;i>0;i--){const j=ri(i+1);[rest[i],rest[j]]=[rest[j],rest[i]];}
  return chosen.concat(rest.slice(0,Math.min(DEPTOT-chosen.length,rest.length)));}

function initPool(){if(START_DECKS&&START_DECKS[DECK_IDX])return buildDeck(START_DECKS[DECK_IDX]);return POOL.map(poolEntry);}

function runOnce(){
  let pool=initPool();
  run={chapter:1,relics:initRelics(),gold:0,bag:[],pool,reviveUsed:false};
  const rec={win:false,chapter:0,battles:0,turns:0,deaths:0,bossTurns:{},stage1:[],stage3:[],relicsEnd:0,minTeam:1};
  const cols=MAP_DEPTH||9; let nodeIdx=0;
  for(let ch=1;ch<=3;ch++){run.chapter=ch;rec.chapter=ch;
    for(let col=0;col<cols;col++){nodeIdx++;
      let type=col===cols-1?'boss':col===0?'battle':['battle','battle','elite','event','rest','shop'][ri(6)];
      if(type==='event'){simEvent();continue;}
      if(type==='shop'){simShop();continue;}
      if(type==='rest'){run.pool.forEach(m=>{const c=(m.curHp!=null?m.curHp:m.maxhp);m.curHp=Math.min(m.maxhp,c+Math.ceil(m.maxhp*ascRestHeal(ASC)));});continue;}
      equipBagItems();
      const obj=(type==='battle'||type==='elite')?(()=>{const q=Math.random();return q<0.15?{kind:'survive',n:3}:q<0.30?{kind:'reach',n:3}:null;})():null;
      const r=battle(pool,pickDeploy(pool),type,ch,obj);
      rec.battles++;rec.turns+=r.turns;if(type==='boss')rec.bossTurns[ch]=r.turns;if(r.minHp!=null&&r.minHp<rec.minTeam)rec.minTeam=r.minHp;
      if(type==='battle'&&r.win&&r.hpPct!=null){(M.hpAfter[ch]=M.hpAfter[ch]||[]).push(r.hpPct);}
      if(r.dead&&r.dead.length){rec.deaths+=r.dead.length;pool=pool.filter(p=>!r.dead.includes(p));run.pool=pool;}
      if(r.caps&&r.caps.length){pool=pool.concat(r.caps);run.pool=pool;}
      if(!r.win)return Object.assign(rec,{win:false,nodes:nodeIdx,diedAt:'第'+ch+'章/'+type,relicsEnd:relicsOf().length,relicIds:relicsOf().map(r=>r.id)});
      afterBattleWin(type,ch);simDraft();
      if(M.capNode==null&&pool.some(p=>p.lv>=MAXLV))M.capNode=nodeIdx;
    }
    pool.forEach(m=>m.curHp=m.maxhp); // 章末回满
    (M.lvEnd[ch]=M.lvEnd[ch]||[]).push(Math.max.apply(null,pool.map(p=>p.lv)));
    if(ch===1)rec.stage1=pool.filter(p=>!p.hero).map(p=>p.stage);
    if(ch===3)rec.stage3=pool.filter(p=>!p.hero).map(p=>p.stage);
  }
  // —— 局级不变量 ——
  if(rec.deaths===0)relicTags().forEach(t=>anom('⑦ 无损通关(整局零阵亡)',t,1));
  {const tot=pool.reduce((a,m)=>a+(m._dmgDealt||0),0);
   const top=pool.slice().sort((a,b)=>(b._dmgDealt||0)-(a._dmgDealt||0))[0];
   if(tot>0&&top&&(top._dmgDealt||0)/tot>0.6)anom('⑧ 单核依赖(一只精灵包办>60%伤害)',top.key+' '+Math.round(100*top._dmgDealt/tot)+'%',top._dmgDealt/tot);}
  rec.win=true;rec.nodes=nodeIdx;rec.relicsEnd=relicsOf().length;rec.relicIds=relicsOf().map(r=>r.id);return rec;
}

// ---- 主程序 ----
const N=parseInt(process.argv[2]||'100',10);
const agg={wins:0,diedAt:{},battles:0,turns:0,deaths:0,bossT:{1:[],2:[],3:[]},clear:{1:0,2:0,3:0},relics:[]};
M={hits:{},hpAfter:{},lvEnd:{},capNode:null};
let capSum=0,capCnt=0;
const ARCH={'输出流':['power_band','glass_cannon','brute_core','berserker','sharp_scope','lucky_coin','hunter_lens','elem_core'],'防御流':['steel_will','iron_hide','heavy_shield','shield_gen','thorn_mail','spike_shell','phoenix','vamp_charm','giant_belt'],'状态流':['venom_fang','flame_brand','executioner','para_smash'],'走位流':['knockback','formation','flank','alpha','swift_boots'],'收集精简':['lean_zeal','light_pack','lone_wolf','exp_necklace','gold_idol','tamer_flute'],
 '诅咒流':['glass_heart','arrogance','blood_thirst','abyss_eye','immolate','gambler_die','thorn_crown','berserk_pact']};
let _setRuns=0,_relicTot=0,_runs=0;const _archDone={};

const NODES=[];
for(let i=0;i<N;i++){TRACING=TRACE&&i===0;M.capNode=null;const r=runOnce();
  NODES.push(r.nodes||0);
  agg.battles+=r.battles;agg.turns+=r.turns;agg.deaths+=r.deaths;
  if(r.win){agg.wins++;agg.clear[1]++;agg.clear[2]++;agg.clear[3]++;if(r.minTeam<0.35)agg.comeback=(agg.comeback||0)+1;}
  else{agg.diedAt[r.diedAt]=(agg.diedAt[r.diedAt]||0)+1;for(let c=1;c<r.chapter;c++)agg.clear[c]++;}
  for(const c of [1,2,3])if(r.bossTurns[c])agg.bossT[c].push(r.bossTurns[c]);
  agg.relics.push(r.relicsEnd||0);
  if(M.capNode!=null){capSum+=M.capNode;capCnt++;}
  {const ids=r.relicIds||[];_relicTot+=ids.length;_runs++;let mx=0;for(const a in ARCH){const cc=ids.filter(id=>ARCH[a].includes(id)).length;if(cc>=3)_archDone[a]=(_archDone[a]||0)+1;if(cc>mx)mx=cc;}if(mx>=3)_setRuns++;}}
const avg=a=>a&&a.length?a.reduce((x,y)=>x+y,0)/a.length:0, pct=(a,b)=>b?(100*a/b).toFixed(1)+'%':'-';
const TOTN=3*(MAP_DEPTH||9);
console.log('===== 纹兽战记 平衡台v2 · '+N+'局 · PROFILE='+PROFILE+' POLICY='+POLICY+' 起Lv'+STARTLV+' 卡组'+DECK_IDX+' 遗物['+((META_RELIC?[META_RELIC]:[]).concat(EXTRA_RELICS).join(',')||'随机成长')+'] =====');
// ★ 主指标(v0.62 起):推进节点数。连续量,方差远低于二值通关率 ⇒ 同样本量下分辨力高数倍。
{const m=NODES.reduce((a,b)=>a+b,0)/N;
 const sd=Math.sqrt(NODES.reduce((a,b)=>a+(b-m)*(b-m),0)/N);
 const se=sd/Math.sqrt(N);
 const wse=100*Math.sqrt((agg.wins/N)*(1-agg.wins/N)/N);
 console.log('★【推进力】 平均推进 '+m.toFixed(2)+' / '+TOTN+' 节点   标准误 ±'+se.toFixed(2)+'  (变异系数 '+(sd/m*100).toFixed(0)+'%)');
 console.log('   —— 对照:通关率 '+pct(agg.wins,N)+' 标准误 ±'+wse.toFixed(2)+'pp(变异系数 '+(100*Math.sqrt((agg.wins/N)*(1-agg.wins/N))/(agg.wins/N||1)).toFixed(0)+'%)');}
console.log('【难度】 通关率 '+pct(agg.wins,N)+' | 各章 '+pct(agg.clear[1],N)+' '+pct(agg.clear[2],N)+' '+pct(agg.clear[3],N));
console.log(' 失败点:');Object.entries(agg.diedAt).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('   '+k+': '+pct(v,N)));
console.log(' 平均每局 战斗 '+(agg.battles/N).toFixed(1)+' 场, 阵亡 '+(agg.deaths/N).toFixed(2)+' 只');
const pk=M.hits.pkill||0,os=M.hits.oskill||0;
console.log('【A·碾压度】 一招秒率(满血→死) '+pct(os,pk)+' [目标15-25%]');
console.log('   常规战战后均血 ch1/2/3: '+[1,2,3].map(c=>(avg(M.hpAfter[c])*100).toFixed(0)+'%').join(' / ')+'  [目标65-85%=掉15-35%]');
console.log('【B·成长曲线】 carry首次满级节点 均值 '+(capCnt?(capSum/capCnt).toFixed(1)+' / 共'+TOTN+'节点':'未达MAXLV')+'  [目标>第1章末('+(MAP_DEPTH||9)+')]');
console.log('   各章末最高Lv: '+[1,2,3].map(c=>avg(M.lvEnd[c]).toFixed(1)).join(' / ')+'  [目标 ≤4 / ≤6 / 7-8]');
console.log('【经济】 平均遗物/局 '+avg(agg.relics).toFixed(1)+' | Boss平均回合 '+[1,2,3].map(c=>avg(agg.bossT[c]).toFixed(1)).join('/'));
const PK=['super','neutral','resist','immune','miss'],TH=PK.reduce((a,k)=>a+(M.hits[k]||0),0);
console.log('【克制·我方】 '+PK.map(k=>k+' '+pct(M.hits[k]||0,TH)).join('  '));
console.log('【收服】 尝试 '+(M.hits.capTry||0)+' 成功 '+(M.hits.capture||0));
{const ek=M.hits.envKill||0,pk2=M.hits.pkill||0;
 console.log('【退化玩法·环境击杀】 出界 '+(M.hits.edgeKill||0)+' + 落水 '+(M.hits.drownKill||0)+' = '+ek+'  占我方总击杀 '+pct(ek,pk2)+'  [红线:应<3%]');
 console.log('   其中精英/Boss '+(M.hits.envKillElite||0)+' 次 | 被秒时平均剩余血量 '+(M.envN?(100*M.envHp/M.envN).toFixed(0)+'%':'-')+' (越高=越白嫖,绕过血量设计)');}
console.log('【新动作使用】 蓄力 '+(M.hits.useCharge||0)+' 次 · 换位 '+(M.hits.useSwap||0)+' 次 · 脱战回复 '+(M.hits.restHeal||0)+' 次');
if(ZOC_ON)console.log('【位置经济学】 借机攻击触发:打到我方 '+(M.hits.zocOnPlayer||0)+' 次 / 打到敌方 '+(M.hits.zocOnEnemy||0)+' 次  (夹击 ×'+FLANK_MULT+(FLANK_NC?'·免反击':'')+')');
// ---- 近择率诊断 ----
{const pt=M.planT||1;
 console.log('\n【诊断·近择率】 平均候选动作数 '+((M.planN||0)/pt).toFixed(1)+' 个/决策');
 const gh=M.gapHist||{},gt=Object.values(gh).reduce((a,b)=>a+b,0)||1;
 console.log('   top2/top1 分数比分布: '+[0,1,2,3,4,5,6,7,8,9].map(b=>(b/10).toFixed(1)+'~ '+pct(gh[b]||0,gt)).join(' | '));
 console.log('   次优动作的性质: 同目标换招 '+pct(M.hits.altSameTgt||0,gt)+' · 同招换目标 '+pct(M.hits.altSameSk||0,gt)+' · 两者都变 '+pct(M.hits.altBoth||0,gt));
 const sp=M.skillPick||{},st=Object.values(sp).reduce((a,b)=>a+b,0)||1;
 const top=Object.entries(sp).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>((SKILLS[k]&&SKILLS[k].name)||k)+' '+pct(v,st));
 let H=0;Object.values(sp).forEach(v=>{const p=v/st;if(p>0)H-=p*Math.log2(p);});
 console.log('   技能选择: '+top.join(' | ')+'   熵='+H.toFixed(2)+'bit(越低=越只用一招)');
 console.log('   目标选择: 选了最残血的 '+pct(M.hits.pickLowestHp||0,M.hits.pickTot||0)+' · 选了克制最优的 '+pct(M.hits.pickBestType||0,M.hits.pickTot||0));
 console.log('   ★位置维度: 每个(招×目标)平均有 '+((M.tileAll||0)/(M.tileTot||1)).toFixed(1)+' 个可用落点,其中 '+((M.tileOpt||0)/(M.tileTot||1)).toFixed(1)+' 个"几乎一样好"');
 console.log('     → 近择率只统计(招×目标),看不见落点选择;ZOC/夹击只影响落点 ⇒ 对近择率无感是结构性的,不代表无效');}
console.log('【E·恶意】 被迫应变率 '+pct(M.hits.forced||0,M.hits.forcedN||0)+' [带25-45] | 集火压力 '+((M.threatSum||0)/(M.threatN||1)).toFixed(2)+' [带1.2-2.0] | 死亡可避免率(死前存在"能活下来"的落点) '+pct(M.hits.pdeathAvoid||0,M.hits.pdeath||0)+' [带≥70]');
console.log('【F·趣味】 近择率 '+pct(M.hits.nearChoice||0,M.hits.choiceTurns||0)+' [带35-60] | 场均摆动 '+((M.swingSum||0)/(M.swingN||1)).toFixed(2)+' [带≥1.5] | 险胜率 '+pct(M.hits.closeWin||0,M.swingN||0)+' [带8-18] | 翻盘率 '+pct(agg.comeback||0,N)+' [带5-15]');
console.log('   技巧梯度:同参数分别跑 POLICY=smart / POLICY=novice,通关率之差 [带≥25pp]');
console.log('【D·build深度】 平均升招/局 '+((M.draftUp||0)/_runs).toFixed(1)+' · 学进阶招/局 '+((M.draftLearn||0)/_runs).toFixed(1)+' (升招可叠到+3=越投越深)');
console.log('【C·构筑】 平均遗物/局 '+(_relicTot/_runs).toFixed(1)+' | 成套率(≥3同流派) '+pct(_setRuns,_runs)+' [目标≥60%]');
console.log('   各流派成套占比: '+(Object.entries(_archDone).sort((a,b)=>b[1]-a[1]).map(([a,v])=>a+' '+pct(v,_runs)).join(' / ')||'无'));
// ---- 退化玩法猎手报告 ----
{const ks=Object.keys(ANOM).sort();
 if(ks.length){
   console.log('\n===== 🔎 退化玩法猎手 · 可疑事件排行(N='+N+'局) =====');
   console.log('(工具只给"统计上反常"的候选;是 bug 还是特色由人判断)');
   for(const k of ks){const a=ANOM[k];
     const top=Object.entries(a.by).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([t,c])=>t+'×'+c).join('  |  ');
     console.log('\n'+k+'  —— 触发 '+a.n+' 次'+(a.max>1?'  峰值 '+(a.max<10?a.max.toFixed(2):a.max.toFixed(0))+' ('+a.maxTag+')':''));
     if(top)console.log('   主要来源: '+top);}
 }else console.log('\n🔎 退化玩法猎手:未触发任何不变量断言。');}
