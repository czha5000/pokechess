// 纹兽战记 · 平衡台模拟器
// 复刻战斗结算 + 速度交错行动 + 启发式 AI,跑 N 局并产出平衡指标。
// 数值/怪物/遗物全部从游戏真实 js/data/*.js 读取(见 loadData.js),不会漂移。
// 用法: node sim.js [N]
//   旋钮(环境变量): EH敌人血/攻倍率 BH Boss血倍率 EC普通战额外敌人 DEPTOT出战总数
//                   RELICS=ember_totem,power_band 给玩家装备遗物  STARTLV=2 起始等级
'use strict';
const {loadGameData}=require('./loadData');
const G=loadGameData();
const {typeMult,SKILLS,LEARN,POOL,WILD,ELITE,CH_BOSS,EVO,EEVEE_FORMS,CH_ELITE,RELICS,STATUS,ascEnemyMul,ascBossMul,ascRestHeal,
  COLS,ROWS,PSTART,ESLOTS,MAXLV,THRESH,STAGE_LV,EVO_BONUS,CH_SCALE,ENEMY_LV,ELITE_LV,BOSS_LV,HELD_ITEMS}=G;
const SIMMAPS=G.MAPS;let TERRAIN=(SIMMAPS&&SIMMAPS.length)?SIMMAPS[0]:G.TERRAIN;

const EH=+(process.env.EH||G.ENEMY_POWER), BH=+(process.env.BH||G.BOSS_HP), EC=+(process.env.EC||0), DEPTOT=+(process.env.DEPTOT||5); // 默认跟随 config(不漂移)
const STARTLV=+(process.env.STARTLV||1);
const ITEMID=process.env.ITEMS||null; // 给全部出战单位装备同一携带道具(测试道具强度)
function itemOfS(u){return u&&u.item&&HELD_ITEMS?HELD_ITEMS[u.item]:null;}
const ASC=+(process.env.ASC||0);
const EQUIP=(process.env.RELICS||'').split(',').map(s=>s.trim()).filter(Boolean).map(id=>RELICS.find(r=>r.id===id)).filter(Boolean);
const CRITX=3, DOUBLE_GAP=4, FOREST_AVO=15, EEVEE=['fire','water','electric'];
const rnd=()=>Math.random()*100, ri=n=>Math.random()*n|0;
let M; // 指标累加器
// 步骤追踪:TRACE=1 时打印第 1 局的逐步决策(部署/移动/用招/目标/胜负),供"另一技能在真实游戏里复演"参考
const TRACE=!!process.env.TRACE; let TRACING=false;
function T(s){if(TRACING)console.log(s);}

// ---- 遗物钩子(镜像 core/relics.js) ----
function rDmg(att,sk,def){let m=1;if(att.player)for(const r of EQUIP)if(r.dmgMult)m*=r.dmgMult(att,sk,def);return m;}
function rHit(att,sk){let a=0;if(att.player){for(const r of EQUIP)if(r.hitAdd)a+=r.hitAdd(att,sk);const it=itemOfS(att);if(it&&it.hit)a+=it.hit;}return a;}
function rCap(){let a=0;for(const r of EQUIP)if(r.capAdd)a+=r.capAdd;return a;}
function rExp(){let m=1;for(const r of EQUIP)if(r.expMult)m*=r.expMult;return m;}
function rStat(u){u._rb={atk:0,def:0,spd:0,maxhp:0,lck:0};for(const r of EQUIP)if(r.statMod){const bb={atk:u.atk,def:u.def,spd:u.spd,maxhp:u.maxhp,lck:u.lck};r.statMod(u);u._rb.atk+=u.atk-bb.atk;u._rb.def+=u.def-bb.def;u._rb.spd+=u.spd-bb.spd;u._rb.maxhp+=u.maxhp-bb.maxhp;u._rb.lck+=u.lck-bb.lck;}}
function rKill(att){if(att.player)for(const r of EQUIP)if(r.onKill)r.onKill(att);}
function rThorns(){let t=0;for(const r of EQUIP)if(r.thorns)t+=r.thorns;return t;}
function rShieldRegen(){let v=0;for(const r of EQUIP)if(r.shieldRegen)v+=r.shieldRegen;return v;}
function rCrit(att){let v=0;if(att.player){for(const r of EQUIP)if(r.critAdd)v+=(typeof r.critAdd==='function'?r.critAdd():r.critAdd);const it=itemOfS(att);if(it&&it.crit)v+=it.crit;}return v;}
function rTaken(def){let m=1;if(def&&def.player)for(const r of EQUIP)if(r.dmgTakenMult)m*=r.dmgTakenMult;return m;}
let CURUNITS=null;
function adjAlliesS(u){return CURUNITS?CURUNITS.filter(a=>a.player===u.player&&a.hp>0&&a!==u&&Math.abs(a.x-u.x)+Math.abs(a.y-u.y)===1).length:0;}
function isFlankedS(att,def){if(!CURUNITS)return false;const dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);const ox=def.x+dx,oy=def.y+dy;return CURUNITS.some(a=>a.player&&a.hp>0&&a.x===ox&&a.y===oy);}
function isFlankedSideS(att,def){if(!CURUNITS)return false;const dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);const ox=def.x+dx,oy=def.y+dy;return CURUNITS.some(a=>a.player===att.player&&a.hp>0&&a!==att&&a.x===ox&&a.y===oy);}
function pushTargetS(att,def,n){let dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);if(dx&&dy){if(Math.abs(def.x-att.x)>=Math.abs(def.y-att.y))dy=0;else dx=0;}if(!dx&&!dy)return;for(let i=0;i<n;i++){const nx=def.x+dx,ny=def.y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS||TERRAIN[ny][nx]===1){def.hp=0;return;}const occ=CURUNITS&&CURUNITS.find(u=>u.x===nx&&u.y===ny&&u.hp>0);if(occ){def.hp-=4;occ.hp-=4;return;}def.x=nx;def.y=ny;}}

// ---- 数值 ----
function cover(u){return TERRAIN[u.y][u.x]===2?2:0;}
function avo(u){return TERRAIN[u.y][u.x]===2?FOREST_AVO:0;}
function baseDmg(att,def,sk){const m=typeMult(sk.type,def.type);if(m===0)return{d:0,m:0};let d=Math.max(1,Math.round(att.atk*sk.mult*m)-def.def-cover(def));d=Math.round(d*rDmg(att,sk,def)*rTaken(def));if(sk.useShield)d+=(att.shield||0);if(TERRAIN[att.y]&&TERRAIN[att.y][att.x]===4)d=Math.round(d*1.25);if(isFlankedSideS(att,def))d=Math.round(d*((att.player&&EQUIP.some(r=>r.id==='flank'))?1.5:1.15));if(att.player){if(EQUIP.some(r=>r.id==='formation'))d=Math.round(d*(1+0.12*adjAlliesS(att)));if(EQUIP.some(r=>r.id==='alpha')&&!def.acted)d=Math.round(d*1.4);}return{d:Math.max(1,d),m};}
function hitRate(att,def,sk){return Math.max(0,Math.min(100,Math.round(sk.hit+att.skl*2-(def.spd*2+def.lck)-avo(def)+rHit(att,sk))));}
function critRate(att,def,sk){return Math.max(0,Math.min(100,Math.round(sk.crit+att.skl-def.lck+rCrit(att))));}
function doubles(a,b){return (a.spd-b.spd)>=DOUBLE_GAP;}
function reachOf(u){let mr=0;u.skills.forEach(s=>{const sk=SKILLS[s];if(sk&&(sk.kind==='atk'||sk.kind==='aoe'))mr=Math.max(mr,sk.rb);});return u.rng+mr;}
function dist(a,b){return Math.abs(a.x-b.x)+Math.abs(a.y-b.y);}
function unitAt(units,x,y){return units.find(u=>u.x===x&&u.y===y&&u.hp>0);}

function gainExp(u,amt){if(!u.player||u.lv>=MAXLV)return;u.exp+=Math.round(amt*rExp());
  while(u.lv<MAXLV&&u.exp>=THRESH[u.lv]){u.exp-=THRESH[u.lv];u.lv++;u.maxhp+=3;u.atk+=1;u.def+=1;u.skl+=1;if(u.lv%2===0)u.spd+=1;
    if(!u.hero){const list=LEARN[u.transformed?u.type:u.key]||['basic'];const sk=list[u.lv-1];if(sk&&!u.skills.includes(sk))u.skills.push(sk);}
    if(!u.hero){const line=EVO[u.key];let g=0;while(g++<3){const nx=(u.stage||0)+1,req=STAGE_LV[nx];if(!req||!line||!line[nx]||u.lv<req)break;u.stage=nx;const b=EVO_BONUS[nx];u.maxhp+=b.hp;u.atk+=b.atk;u.def+=b.def;u.spd+=b.spd;}}
  }}
function tally(c){M.hits[c]=(M.hits[c]||0)+1;}
function applyEff(u,kind){const st=STATUS[kind];if(!st)return;u.eff=u.eff||{};if(st.stack)u.eff[kind]=(u.eff[kind]||0)+(st.apply||3);else u.eff[kind]=st.turns;}
function strike(att,def,skKey){const s=SKILLS[skKey]||skKey;const times=(doubles(att,def)&&s.kind!=='aoe')?2:1;let dealt=0;
  for(let i=0;i<times;i++){if(def.hp<=0)break;const b=baseDmg(att,def,s);
    if(b.m===0){if(att.player)tally('immune');else tally('e_immune');break;}
    if(rnd()>=hitRate(att,def,s)){if(att.player)tally('miss');continue;}
    const crit=rnd()<critRate(att,def,s);let d=crit?b.d*CRITX:b.d;if(def.dmgCap&&d>def.dmgCap)d=def.dmgCap;const ab=Math.min(def.shield||0,d);if(ab>0)def.shield-=ab;def.hp-=(d-ab);dealt+=d;
    if(att.player)tally(b.m>1?'super':b.m<1?'resist':'neutral');
    else tally(b.m>1?'e_super':b.m<1?'e_resist':'e_neutral');
    if(s.inflict&&def.hp>0&&Math.random()*100<s.inflict.chance)applyEff(def,s.inflict.kind);
    if(att.player&&def.hp>0)for(const r of EQUIP)if(r.onHitInflict&&Math.random()*100<r.onHitInflict.chance)applyEff(def,r.onHitInflict.kind);
    if(att.player&&def.hp>0){const _it=itemOfS(att);if(_it&&_it.onHit&&Math.random()*100<_it.onHit.chance)applyEff(def,_it.onHit.kind);}
    if(!att.player&&rThorns()>0&&att.hp>0){att.hp-=rThorns();} // 我方荆棘反伤敌人
  }
  if(s.recoil&&dealt>0&&att.hp>0)att.hp-=Math.max(1,Math.round(dealt*s.recoil));
  if(def.hp>0&&(s.knock||(att.player&&EQUIP.some(r=>r.id==='knockback'))))pushTargetS(att,def,s.knock||1);
  return dealt;}

// ---- 单位 ----
function metaBump(m,target){while(m.lv<target){m.lv++;m.maxhp+=3;m.atk+=1;m.def+=1;m.skl+=1;if(m.lv%2===0)m.spd+=1;const key=m.hero?'normal':m.key;const sk=(LEARN[key]||['basic'])[m.lv-1];if(sk&&!m.skills.includes(sk)&&!m.hero)m.skills.push(sk);}}
function poolEntry(p){const e={key:p.key,type:p.type,hero:!!p.hero,lv:1,exp:0,stage:0,maxhp:p.hp,atk:p.atk,def:p.def,spd:p.spd,skl:p.skl,lck:p.lck,mov:p.mov,rng:p.rng,skills:[(LEARN[p.key]||['basic'])[0]]};if(STARTLV>1)metaBump(e,STARTLV);e.curHp=e.maxhp;return e;}
function mkBattleUnit(src,x,y){const u=Object.assign({},src);u.player=true;u.src=src;u.x=x;u.y=y;u.hp=Math.max(1,Math.min(src.maxhp,src.curHp!=null?src.curHp:src.maxhp));u.skills=src.skills.slice();u.transformed=false;rStat(u);if(ITEMID&&HELD_ITEMS[ITEMID]){u.item=ITEMID;const it=HELD_ITEMS[ITEMID];u._rb=u._rb||{atk:0,def:0,spd:0,maxhp:0,lck:0};if(it.atk){u.atk+=it.atk;u._rb.atk+=it.atk;}if(it.def){u.def+=it.def;u._rb.def+=it.def;}if(it.spd){u.spd+=it.spd;u._rb.spd+=it.spd;}if(it.maxhp){u.maxhp+=it.maxhp;u.hp+=it.maxhp;u._rb.maxhp+=it.maxhp;}}return u;}
// 敌人等级(镜像 units.js enemyLevel):各章基础 + 精英/Boss 加成 + 每2层Ascension+1
function enemyLevelS(t,boss){return (ENEMY_LV[run.chapter]||4)+(boss?BOSS_LV:(t.elite?ELITE_LV:0));}
function mkEnemy(t,x,y,boss){const aE=ascEnemyMul(ASC),aB=ascBossMul(ASC);const lv=enemyLevelS(t,boss);const e=Object.assign({},t);e.player=false;
  let hp=t.hp,atk=t.atk,def=t.def,spd=t.spd,skl=t.skl;
  for(let l=1;l<lv;l++){hp+=3;atk+=1;def+=1;skl+=1;if(l%2===0)spd+=1;}
  e.maxhp=boss?Math.round(hp*BH*aB):Math.round(hp*EH*aE);e.hp=e.maxhp;
  e.atk=boss?Math.round(atk*aB):Math.round(atk*EH*aE);e.def=def;e.spd=spd;e.skl=skl;e.lv=lv;
  e.x=x;e.y=y;e.skills=t.skills.slice();return e;}
let CAPBUF=null;
function capChanceS(def){return Math.min(0.95,(def.elite?0.25:0.70)*(1-def.hp/def.maxhp)+rCap());}
function poolFromEnemy(e){const k=e.type;const sk=(LEARN[k]||['basic']).slice(0,2);const mh=e.maxhp||e.hp;return{key:k,type:e.type,hero:false,lv:1,exp:0,stage:0,maxhp:mh,curHp:mh,atk:e.atk,def:e.def,spd:e.spd,skl:e.skl,lck:e.lck,mov:e.mov,rng:e.rng,skills:sk};}

// ---- 范围/寻路 ----
function moveTiles(units,u){const seen={[u.x+','+u.y]:0},q=[{x:u.x,y:u.y,d:0}],out=[{x:u.x,y:u.y,d:0}];
  while(q.length){const c=q.shift();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=c.x+dx,ny=c.y+dy;
    if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;if(TERRAIN[ny][nx]===1)continue;if(unitAt(units,nx,ny))continue;const nd=c.d+1;if(nd>u.mov)continue;if(seen[nx+','+ny]!==undefined)continue;seen[nx+','+ny]=nd;q.push({x:nx,y:ny,d:nd});out.push({x:nx,y:ny,d:nd});}}
  return out;}

// ---- AI ----
function _threatAtS(units,x,y,exclude){let n=0;units.forEach(e=>{if(!e.player&&e.hp>0&&e!==exclude&&(Math.abs(e.x-x)+Math.abs(e.y-y))<=e.mov+reachOf(e))n++;});return n;}
function chooseAttack(units,u){const enemies=units.filter(e=>!e.player&&e.hp>0);if(!enemies.length)return null;
  const tiles=u.moved?[{x:u.x,y:u.y,d:0}]:moveTiles(units,u);let best=null;
  for(const sk of u.skills){const s=SKILLS[sk];if(s.kind!=='atk'&&s.kind!=='aoe')continue;const R=u.rng+(s.rb||0);
    for(const e of enemies){const b=baseDmg(u,e,s);if(b.m===0)continue;
      let cand=null,cs=1e9;for(const t of tiles){if(Math.abs(t.x-e.x)+Math.abs(t.y-e.y)<=R){const expo=_threatAtS(units,t.x,t.y,e)*4-(TERRAIN[t.y][t.x]===2?3:0);if(expo<cs){cs=expo;cand=t;}}}
      if(!cand)continue;
      const hit=hitRate(u,e,s)/100,dbl=(u.spd-e.spd>=4&&s.kind!=='aoe'),total=b.d*(dbl?2:1);
      const lethal=total>=e.hp&&hit>=0.6;
      let counter=0;if(!lethal&&s.kind!=='aoe'&&(Math.abs(cand.x-e.x)+Math.abs(cand.y-e.y))<=e.rng)counter=baseDmg(e,u,SKILLS.basic).d*0.6;
      const score=total*hit+(lethal?25:0)+(b.m>1?8:0)+e.atk*0.4-counter-cs;
      if(!best||score>best.score)best={tile:cand,skKey:sk,enemy:e,score,lethal};}}
  return best;}
function actPlayer(units,u){const plan=chooseAttack(units,u);const low=u.hp/u.maxhp<0.35;
  if(plan&&(plan.lethal||plan.score>2)&&!(low&&!plan.lethal&&plan.score<6)){T('  我方 '+u.key+'(Lv'+u.lv+') →('+plan.tile.x+','+plan.tile.y+') 用['+SKILLS[plan.skKey].name+'] 打 '+plan.enemy.type);u.x=plan.tile.x;u.y=plan.tile.y;const s=SKILLS[plan.skKey];
    {const ce=plan.enemy;if(run.pool&&run.pool.length<5&&!ce.elite&&(Math.abs(u.x-ce.x)+Math.abs(u.y-ce.y))<=1&&capChanceS(ce)>=0.5){tally('capTry');if(Math.random()<capChanceS(ce)){tally('capture');if(CAPBUF)CAPBUF.push(poolFromEnemy(ce));ce.hp=0;}return;}}
    if(s.kind==='aoe'){const list=[plan.enemy,...units.filter(e=>!e.player&&e.hp>0&&e!==plan.enemy&&Math.abs(e.x-plan.enemy.x)+Math.abs(e.y-plan.enemy.y)===1)];let dealt=0;
      for(const d of list){const b=baseDmg(u,d,s);if(b.m===0){tally('immune');continue;}if(rnd()>=hitRate(u,d,s)){tally('miss');continue;}d.hp-=b.d;dealt+=b.d;tally(b.m>1?'super':b.m<1?'resist':'neutral');}
      const dead=list.filter(d=>d.hp<=0).length;if(dead)rKill(u);gainExp(u,Math.round(dealt*1.4)+dead*5);}
    else{const dealt=strike(u,plan.enemy,plan.skKey);
      if(plan.enemy.hp<=0){M.deaths;rKill(u);gainExp(u,Math.round(dealt*1.4)+5);}
      else{if(dist(u,plan.enemy)<=plan.enemy.rng&&!(plan.enemy.eff&&plan.enemy.eff.para)){strike(plan.enemy,u,'basic');}gainExp(u,Math.round(dealt*1.4));}}
  }else{const enemies=units.filter(e=>!e.player&&e.hp>0);if(!enemies.length)return;const tiles=moveTiles(units,u);const near=enemies.reduce((a,b)=>dist(u,a)<dist(u,b)?a:b);let bt=null,bs=1e9;for(const t of tiles){const expo=_threatAtS(units,t.x,t.y,null)*4+(low?0:(Math.abs(t.x-near.x)+Math.abs(t.y-near.y))*0.3)-(TERRAIN[t.y][t.x]===2?1.5:0);if(expo<bs){bs=expo;bt=t;}}if(bt){u.x=bt.x;u.y=bt.y;}}}
function aiScore(e,t){let best=-1;e.skills.forEach(k=>{const s=SKILLS[k];if(s.kind!=='atk'&&s.kind!=='aoe')return;const v=typeMult(s.type,t.type)*s.mult;if(v>best)best=v;});return best;}
function aiPick(e,t){let best='basic',bv=-1;e.skills.forEach(k=>{const s=SKILLS[k];if(s.kind!=='atk'&&s.kind!=='aoe')return;const v=typeMult(s.type,t.type)*s.mult;if(v>bv){bv=v;best=k;}});return best;}
function actEnemy(units,e){if(e.mech==='enrage'&&!e._enraged&&e.hp/e.maxhp<0.5){e.atk=Math.round(e.atk*1.5);e._enraged=true;}if(e.bossShield){e.shield=(e.shield||0)+e.bossShield;}if(e.skills.includes('heal')){const hurt=units.filter(a=>!a.player&&a.hp>0&&a!==e&&a.hp<a.maxhp*0.6).sort((a,b)=>(a.hp/a.maxhp)-(b.hp/b.maxhp))[0];if(hurt){if(dist(e,hurt)>1){const tiles=moveTiles(units,e);let bt=null,bd=1e9;for(const t of tiles){const dd=Math.abs(t.x-hurt.x)+Math.abs(t.y-hurt.y);if(dd<bd){bd=dd;bt=t;}}if(bt){e.x=bt.x;e.y=bt.y;}}if(dist(e,hurt)<=1)hurt.hp=Math.min(hurt.maxhp,hurt.hp+SKILLS.heal.amount);return;}}let ts=units.filter(u=>u.player&&u.hp>0);if(!ts.length)return;const hit=ts.filter(t=>aiScore(e,t)>0);if(hit.length)ts=hit;
  ts.sort((a,b)=>{const ma=aiScore(e,a),mb=aiScore(e,b);if(mb!==ma)return mb-ma;return a.hp-b.hp;});
  const tgt=ts[0],sk=aiPick(e,tgt),s=SKILLS[sk],reach=e.rng+(s.rb||0);
  T('  敌 '+e.type+' 用['+SKILLS[sk].name+'] 打 '+tgt.key);
  if(dist(e,tgt)>reach){const tiles=moveTiles(units,e);let bt=null,bd=1e9;for(const t of tiles){const dd=Math.abs(t.x-tgt.x)+Math.abs(t.y-tgt.y);if(dd<bd){bd=dd;bt=t;}}if(bt){e.x=bt.x;e.y=bt.y;}}
  if(dist(e,tgt)<=reach){strike(e,tgt,sk);if(tgt.hp>0&&dist(e,tgt)<=tgt.rng&&e.hp>0&&!(tgt.eff&&tgt.eff.para)){const back=strike(tgt,e,'basic');if(e.hp>0)gainExp(tgt,back);}}}

// ---- 单场战斗(速度交错) ----
let run;
function battle(pool,deploy,nodeType,chapter,obj){
  run.chapter=chapter;run.pool=pool;const units=[];const caps=[];CAPBUF=caps;if(SIMMAPS&&SIMMAPS.length)TERRAIN=SIMMAPS[ri(SIMMAPS.length)];
  deploy.forEach((src,s)=>units.push(mkBattleUnit(src,PSTART[s][0],PSTART[s][1])));
  const slots=[0,1,2,4,5];let si=0;const R=()=>{const ks=Object.keys(WILD);return WILD[ks[ri(ks.length)]];};
  if(nodeType==='boss'){units.push(mkEnemy(CH_BOSS[chapter],ESLOTS[3][0],ESLOTS[3][1],true));for(let i=0;i<3+EC&&si<slots.length;i++){const sl=slots[si++];units.push(mkEnemy(R(),ESLOTS[sl][0],ESLOTS[sl][1]));}}
  else if(nodeType==='elite'){units.push(mkEnemy((CH_ELITE&&CH_ELITE[chapter])||ELITE,ESLOTS[3][0],ESLOTS[3][1]));for(let i=0;i<3+EC&&si<slots.length;i++){const sl=slots[si++];units.push(mkEnemy(R(),ESLOTS[sl][0],ESLOTS[sl][1]));}}
  else{const cnt=Math.min(slots.length,4+(Math.random()<0.5?1:0)+EC);for(let i=0;i<cnt;i++){const sl=slots[si++];units.push(mkEnemy(R(),ESLOTS[sl][0],ESLOTS[sl][1]));}}
  // 伊布选最优形态
  const hero=units.find(u=>u.hero);if(hero){const foes=units.filter(u=>!u.player);let bf='electric',bv=-1;for(const f of EEVEE){let v=0;foes.forEach(e=>v+=typeMult(f,e.type));if(v>bv){bv=v;bf=f;}}hero.type=bf;hero.transformed=true;hero.skills=(LEARN[bf]||['basic']).slice(0,Math.max(hero.lv,2));}
  T(`\n[第${chapter}章/${nodeType}] 出战:${units.filter(u=>u.player).map(u=>u.key+(u.transformed?'→'+u.type:'')+'Lv'+u.lv).join(' ')}  敌:${units.filter(u=>!u.player).map(u=>u.type+(u.elite?'★':'')+'('+u.hp+')').join(' ')}`);
  const pAlive=()=>units.some(u=>u.player&&u.hp>0),eAlive=()=>units.some(u=>!u.player&&u.hp>0);
  const sync=()=>units.filter(u=>u.player&&u.hp>0).forEach(u=>{const s=u.src;const rb=u._rb||{atk:0,def:0,spd:0,maxhp:0,lck:0};s.lv=u.lv;s.exp=u.exp;s.stage=u.stage;s.maxhp=u.maxhp-rb.maxhp;s.atk=u.atk-rb.atk;s.def=u.def-rb.def;s.spd=u.spd-rb.spd;s.skl=u.skl;s.curHp=Math.max(1,Math.min(s.maxhp,u.hp-rb.maxhp));if(!s.hero)s.skills=u.skills.slice();});
  let turns=0;CURUNITS=units;
  // 目标:survive=守住N回合即胜;reach=抵达对侧(用单位推进近似:存活到第N回合即视为已抵达)
  const objKind=obj&&obj.kind,objN=(obj&&obj.n)||3;
  while(turns<40){turns++;units.forEach(x=>x.acted=false);
    if(objKind==='survive'&&turns>objN&&pAlive()){T('  => 守住胜('+turns+'回合)');sync();return{win:true,turns,dead:units.filter(u=>u.player&&u.hp<=0).map(u=>u.src),caps,nodeType,obj:objKind};}
    if(objKind==='reach'&&turns>objN&&pAlive()){T('  => 抵达胜('+turns+'回合)');sync();return{win:true,turns,dead:units.filter(u=>u.player&&u.hp<=0).map(u=>u.src),caps,nodeType,obj:objKind};}
    const order=units.filter(u=>u.hp>0).slice().sort((a,b)=>(b.spd-a.spd)||((a.player?0:1)-(b.player?0:1)));
    for(const u of order){if(u.hp<=0)continue;
      if(TERRAIN[u.y]&&TERRAIN[u.y][u.x]===3)u.hp-=4;
      if(u.eff){if(u.eff.burn>0){u.hp-=STATUS.burn.dmg;if(--u.eff.burn<=0)delete u.eff.burn;}if(u.eff.poison>0){u.hp-=u.eff.poison;if(--u.eff.poison<=0)delete u.eff.poison;}}
      if(u.hp<=0)continue;
      let _sk=false;if(u.eff&&u.eff.para>0){if(--u.eff.para<=0)delete u.eff.para;if(Math.random()*100<STATUS.para.skip)_sk=true;}
      if(_sk)continue;
      if(u.player){const sr=rShieldRegen();if(sr>0)u.shield=(u.shield||0)+sr;const it=itemOfS(u);if(it&&it.regen&&u.hp>0)u.hp=Math.min(u.maxhp,u.hp+it.regen);}
      u.player?actPlayer(units,u):actEnemy(units,u);u.acted=true;if(!eAlive()||!pAlive())break;}
    if(!eAlive()){T('  => 胜 ('+turns+'回合)');sync();return{win:true,turns,dead:units.filter(u=>u.player&&u.hp<=0).map(u=>u.src),caps,nodeType};}
    if(!pAlive()){T('  => 败 ('+turns+'回合)');sync();return{win:false,turns,dead:[],nodeType};}
  }
  return{win:false,turns,dead:[],nodeType,stall:true};}

function pickDeploy(pool){const sorted=pool.slice().sort((a,b)=>(b.lv*10+b.atk+b.maxhp/5)-(a.lv*10+a.atk+a.maxhp/5));
  const chosen=[],hero=pool.find(p=>p.hero);if(hero)chosen.push(hero);
  for(const p of sorted){if(chosen.length>=3)break;if(!chosen.includes(p))chosen.push(p);}
  const rest=pool.filter(p=>!chosen.includes(p));for(let i=rest.length-1;i>0;i--){const j=ri(i+1);[rest[i],rest[j]]=[rest[j],rest[i]];}
  return chosen.concat(rest.slice(0,Math.min(DEPTOT-chosen.length,rest.length)));}

function runOnce(){let pool=POOL.map(poolEntry);run={chapter:1};
  const rec={win:false,chapter:0,battles:0,turns:0,deaths:0,bossTurns:{},stage1:[],stage3:[]};
  for(let ch=1;ch<=3;ch++){rec.chapter=ch;
    for(let col=0;col<6;col++){let type=col===5?'boss':col===0?'battle':['battle','battle','elite','event','rest','shop'][ri(6)];
      if(type==='rest'){pool.forEach(m=>{const c=m.curHp!=null?m.curHp:m.maxhp;m.curHp=Math.min(m.maxhp,c+Math.ceil(m.maxhp*ascRestHeal(ASC)));});continue;}
      if(type==='shop'){pool.forEach(m=>{const c=m.curHp!=null?m.curHp:m.maxhp;m.curHp=Math.min(m.maxhp,c+Math.ceil(m.maxhp*0.2));});continue;} // 金币经济近似:商店回血20%
      if(type==='event')continue;
      // 目标:战斗/精英节点 15% 守住 + 15% 抵达(其余=清场),与游戏一致
      const obj=(type==='battle'||type==='elite')?(()=>{const q=Math.random();return q<0.15?{kind:'survive',n:3}:q<0.30?{kind:'reach',n:3}:null;})():null;
      const r=battle(pool,pickDeploy(pool),type,ch,obj);rec.battles++;rec.turns+=r.turns;if(r.obj)rec.objWins=(rec.objWins||0)+1;if(type==='boss')rec.bossTurns[ch]=r.turns;
      if(r.dead.length){rec.deaths+=r.dead.length;pool=pool.filter(p=>!r.dead.includes(p));}
      if(r.caps&&r.caps.length)pool=pool.concat(r.caps);
      if(!r.win)return Object.assign(rec,{win:false,diedAt:`第${ch}章/${type}`});}
    pool.forEach(m=>m.curHp=m.maxhp); // 章末回满阀门
    if(ch===1)rec.stage1=pool.filter(p=>!p.hero).map(p=>p.stage);
    if(ch===3)rec.stage3=pool.filter(p=>!p.hero).map(p=>p.stage);}
  rec.win=true;return rec;}

// ---- 主程序 ----
const N=parseInt(process.argv[2]||'100',10);
const agg={wins:0,diedAt:{},battles:0,turns:0,deaths:0,objWins:0,bossT:{1:[],2:[],3:[]},s1:[],s3:[],clear:{1:0,2:0,3:0}};
M={hits:{}};
for(let i=0;i<N;i++){TRACING=TRACE&&i===0;const r=runOnce();agg.battles+=r.battles;agg.turns+=r.turns;agg.deaths+=r.deaths;agg.objWins+=(r.objWins||0);
  if(r.win){agg.wins++;agg.clear[1]++;agg.clear[2]++;agg.clear[3]++;}
  else{agg.diedAt[r.diedAt]=(agg.diedAt[r.diedAt]||0)+1;for(let c=1;c<r.chapter;c++)agg.clear[c]++;}
  for(const c of[1,2,3])if(r.bossTurns[c])agg.bossT[c].push(r.bossTurns[c]);
  if(r.stage1)agg.s1.push(...r.stage1);if(r.stage3)agg.s3.push(...r.stage3);}
const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length):0, pct=(a,b)=>b?(100*a/b).toFixed(1)+'%':'-';
const PKEYS=['super','neutral','resist','immune','miss'];
const EKEYS=['e_super','e_neutral','e_resist','e_immune'];
const TH=PKEYS.reduce((a,k)=>a+(M.hits[k]||0),0);
const EH_T=EKEYS.reduce((a,k)=>a+(M.hits[k]||0),0);
console.log(`===== 纹兽战记 平衡台 · ${N} 轮 =====`);
console.log(`旋钮: 敌×${EH} Boss血×${BH} 额外敌+${EC} 出战${DEPTOT} 起始Lv${STARTLV} 遗物[${EQUIP.map(r=>r.name).join(',')||'无'}]\n`);
console.log('【难度】');
console.log(' 通关率:',pct(agg.wins,N),' | 各章通过:',pct(agg.clear[1],N),pct(agg.clear[2],N),pct(agg.clear[3],N));
console.log(' 失败点:');Object.entries(agg.diedAt).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log('   '+k+': '+pct(v,N)));
console.log(' 平均每轮: 战斗',(agg.battles/N).toFixed(1),'场, 阵亡',(agg.deaths/N).toFixed(2),'只, 目标胜(守住/抵达)',(agg.objWins/N).toFixed(2),'次');
console.log('\n【节奏】 平均回合/场',(agg.turns/agg.battles).toFixed(1),'| Boss回合 暴鲤龙',avg(agg.bossT[1]).toFixed(1),'快龙',avg(agg.bossT[2]).toFixed(1),'超梦',avg(agg.bossT[3]).toFixed(1));
console.log('\n【进化曲线】 一章末二段+',pct(agg.s1.filter(x=>x>=1).length,agg.s1.length),'| 三章末三段',pct(agg.s3.filter(x=>x>=2).length,agg.s3.length),'二段+',pct(agg.s3.filter(x=>x>=1).length,agg.s3.length));
console.log('\n【克制深度·我方】');PKEYS.forEach(k=>console.log('   '+k+': '+pct(M.hits[k]||0,TH)));
console.log('【克制深度·敌方(双向博弈)】');EKEYS.forEach(k=>console.log('   '+k+': '+pct(M.hits[k]||0,EH_T)));
console.log('\n【收服】 平均每轮收服 '+((M.hits['capture']||0)/N).toFixed(2)+' 只 (尝试 '+((M.hits['capTry']||0)/N).toFixed(2)+')');
