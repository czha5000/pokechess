// ============================================================================
// arena.js · 单场战斗擂台:让不同策略在【同一套真实规则(rules.js)】下打同样的仗
// 用途:量"AI 强度"本身,不受单局肉鸽随机(遗物/事件)干扰 —— 调平衡前先确认尺子够准。
// 用法: node arena.js [每组场次] [策略,策略,...]
//   例: node arena.js 200 novice,greedy,expectimax
// ============================================================================
'use strict';
const path=require('path');
const {loadGameData}=require('./loadData');
const RULES=require(path.join(__dirname,'..','js','core','rules.js'));
const {POLICIES}=require('./agents');

const G=loadGameData();
const N=parseInt(process.argv[2]||'200',10);
const WHICH=(process.argv[3]||'novice,greedy,expectimax').split(',');
const CH=+(process.env.CH||2);          // 用第几章的强度出题
const NODE=process.env.NODE_TYPE||'battle'; // battle | elite | boss
const SEED0=+(process.env.SEED||12345);

// —— 可复现随机(同一场次编号,各策略拿到完全相同的战场与骰子序列)——
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const R=RULES.create(Object.assign({},G,{CRITX:3,DOUBLE_GAP:4,FOREST_AVO:15}),{
  // 擂台不带遗物/道具,纯拼策略
  dmgMult:()=>1,dmgTaken:()=>1,hitAdd:()=>0,critAdd:()=>0,thorns:()=>0,
  shieldRegen:()=>0,onHitInflict:()=>[],capAdd:()=>0,onKill:()=>{},itemOf:()=>null,featureOn:()=>false
});

let UID=1;
function mkPlayer(p,x,y,lv){
  const u={id:UID++,side:'player',name:p.name,type:p.type,key:p.key||p.type,hero:!!p.hero,lv:1,
    maxhp:p.hp,hp:p.hp,atk:p.atk,def:p.def,spd:p.spd,skl:p.skl,lck:p.lck,mov:p.mov,rng:p.rng,
    skills:(G.LEARN[p.key||p.type]||['basic']).slice(0,2),skillUp:{},x,y,acted:false,moved:false,shield:0,eff:{}};
  while(u.lv<lv){u.lv++;u.maxhp+=3;u.hp+=3;u.atk+=1;u.def+=1;u.skl+=1;if(u.lv%2===0)u.spd+=1;
    const sk=(G.LEARN[u.key]||['basic'])[u.lv-1];if(sk&&!u.skills.includes(sk))u.skills.push(sk);}
  return u;
}
function mkEnemy(t,x,y,boss){
  const lv=(G.ENEMY_LV[CH]||4)+(boss?G.BOSS_LV:(t.elite?G.ELITE_LV:0));
  let hp=t.hp,atk=t.atk,def=t.def,spd=t.spd,skl=t.skl;
  for(let l=1;l<lv;l++){hp+=3;atk+=1;def+=1;skl+=1;if(l%2===0)spd+=1;}
  const maxhp=boss?Math.round(hp*G.BOSS_HP):Math.round(hp*G.ENEMY_POWER*(G.ENEMY_HP_MUL||1));
  return{id:UID++,side:'enemy',name:t.name,type:t.type,key:t.key,lv,
    maxhp,hp:maxhp,atk:boss?Math.round(atk*1):Math.round(atk*G.ENEMY_POWER),def,spd,skl,lck:t.lck,
    mov:Math.min(t.mov,G.ENEMY_MOV_CAP||99),rng:t.rng,elite:!!t.elite,mech:t.mech,dmgCap:t.dmgCap,bossShield:t.bossShield,
    skills:t.skills.slice(),skillUp:{},x,y,acted:false,moved:false,shield:0,eff:{}};
}

function buildBattle(rand){
  UID=1;
  const terrain=G.MAPS[(rand()*G.MAPS.length)|0];
  const units=[];
  // 我方:固定 5 只(初始池前5),等级贴合该章
  const plv={1:3,2:5,3:7}[CH]||4;
  G.POOL.slice(0,5).forEach((p,i)=>units.push(mkPlayer(p,G.PSTART[i][0],G.PSTART[i][1],plv)));
  // 敌方
  const ks=Object.keys(G.WILD);
  const rndWild=()=>G.WILD[ks[(rand()*ks.length)|0]];
  const slots=[0,1,2,4,5];let si=0;
  if(NODE==='boss'){units.push(mkEnemy(G.CH_BOSS[CH],G.ESLOTS[3][0],G.ESLOTS[3][1],true));
    for(let i=0;i<3;i++){const sl=slots[si++];units.push(mkEnemy(rndWild(),G.ESLOTS[sl][0],G.ESLOTS[sl][1]));}}
  else if(NODE==='elite'){units.push(mkEnemy(G.CH_ELITE[CH]||G.ELITE,G.ESLOTS[3][0],G.ESLOTS[3][1]));
    for(let i=0;i<3;i++){const sl=slots[si++];units.push(mkEnemy(rndWild(),G.ESLOTS[sl][0],G.ESLOTS[sl][1]));}}
  else{const cnt=4+((rand()<0.5)?1:0);
    for(let i=0;i<cnt;i++){const sl=slots[si++];units.push(mkEnemy(rndWild(),G.ESLOTS[sl][0],G.ESLOTS[sl][1]));}}
  return{terrain,units,obj:null,round:0};
}

// 敌方 AI:与游戏内 ai.js 同款(含 A1 集火 / A2 猎 carry)
function enemyAct(s,e,rand){
  const FEAT=G.FEATURES||{};
  let ts=R.allies(s,'player');if(!ts.length)return null;
  const score=(en,t)=>{let b=-1;en.skills.forEach(k=>{const sk=G.SKILLS[k];if(!sk||(sk.kind!=='atk'&&sk.kind!=='aoe'))return;
    const v=G.typeMult(sk.type,t.type)*sk.mult;if(v>b)b=v;});return b;};
  const hit=ts.filter(t=>score(e,t)>0);if(hit.length)ts=hit;
  ts.sort((a,b)=>{const ma=score(e,a),mb=score(e,b);if(mb!==ma)return mb-ma;
    if(FEAT.huntCarry){const va=(b.lv*2+b.atk*0.5)-(a.lv*2+a.atk*0.5);if(va)return va;}
    return a.hp-b.hp;});
  let tgt=ts[0];
  if(FEAT.focusFire){ // 合力可击杀者优先
    let bestT=null,bs=1e9;
    for(const t of R.allies(s,'player')){
      let pot=0;
      for(const en of R.allies(s,'enemy')){if(en.acted&&en!==e)continue;
        if(R.dist(en,t)<=en.mov+R.reachOf(en)){let bd=0;en.skills.forEach(k=>{const sk=R.skillOf(en,k);
          if(!sk||(sk.kind!=='atk'&&sk.kind!=='aoe'))return;const b=R.baseDmg(s,en,t,sk);if(b.d>bd)bd=b.d;});pot+=bd;}}
      if(pot>=t.hp&&t.hp/pot<bs){bs=t.hp/pot;bestT=t;}}
    if(bestT&&R.dist(e,bestT)<=e.mov+R.reachOf(e))tgt=bestT;
  }
  // 选招 + 靠近
  let bk='basic',bv=-1;
  e.skills.forEach(k=>{const sk=G.SKILLS[k];if(!sk||(sk.kind!=='atk'&&sk.kind!=='aoe'))return;
    const v=G.typeMult(sk.type,tgt.type)*sk.mult;if(v>bv){bv=v;bk=k;}});
  const reach=e.rng+((G.SKILLS[bk].rb)||0);
  const tiles=R.moveTiles(s,e);
  let bt={x:e.x,y:e.y},bd=1e9;
  for(const t of tiles){const d=Math.abs(t.x-tgt.x)+Math.abs(t.y-tgt.y);if(d<bd){bd=d;bt=t;}}
  if(bd<=reach)return{kind:'attack',unitId:e.id,to:[bt.x,bt.y],skill:bk,targetId:tgt.id};
  return{kind:'wait',unitId:e.id,to:[bt.x,bt.y]};
}

function playOne(policy,seed){
  const rand=mulberry32(seed);
  const rng=()=>rand()*100;
  const s=buildBattle(rand);
  let turns=0,pAct=0;
  while(turns<40){
    turns++;s.units.forEach(u=>{u.acted=false;u.moved=false;});
    const order=R.speedOrder(s);
    for(const u0 of order){
      const u=R.byId(s,u0.id);if(!u||u.hp<=0)continue;
      const ev=[];const tk=R.tickStatus(s,u,rng,ev);
      if(tk.dead||u.hp<=0)continue;
      if(tk.skip)continue;
      if(u.side==='enemy'&&u.bossShield)u.shield=(u.shield||0)+u.bossShield;
      if(u.side==='enemy'&&u.mech==='enrage'&&!u._enraged&&u.hp/u.maxhp<0.5){u.atk=Math.round(u.atk*1.5);u._enraged=true;}
      const a=(u.side==='player')?(pAct++,policy.act(R,s,u)):enemyAct(s,u,rand);
      if(u.side==='player'){STAT[a?a.kind:'none']=(STAT[a?a.kind:'none']||0)+1;
        if(a&&a.kind==='attack'){const t=R.byId(s,a.targetId);
          if(t)STAT.dmg=(STAT.dmg||0)+Math.min(t.hp,R.expectedDmg(s,u,t,a.skill));}}
      if(a)R.applyAction(s,a,rng);
      const t=R.isTerminal(s);
      if(t)return{win:t==='win',turns,alive:R.allies(s,'player').length,
        hpPct:(()=>{const al=R.allies(s,'player');return al.length?al.reduce((x,u)=>x+u.hp/u.maxhp,0)/al.length:0;})(),
        acts:pAct};
    }
  }
  return{win:false,turns,alive:R.allies(s,'player').length,hpPct:0,acts:pAct,stall:true};
}

// ---- 主程序 ----------------------------------------------------------------
console.log(`===== 策略擂台 · 每组 ${N} 场 · 第${CH}章 ${NODE} · 同种子同战场 =====`);
console.log(`(敌方 AI 固定;FEATURES=${JSON.stringify(G.FEATURES||{})} ENEMY_MOV_CAP=${G.ENEMY_MOV_CAP})\n`);
const rows=[];let STAT={};
for(const name of WHICH){
  const p=POLICIES[name];
  if(!p){console.log('未知策略: '+name);continue;}
  let w=0,turns=0,alive=0,hp=0,acts=0;const t0=Date.now();STAT={};
  for(let i=0;i<N;i++){
    const r=playOne(p,SEED0+i);
    if(r.win)w++;
    turns+=r.turns;alive+=r.alive;hp+=r.hpPct;acts+=r.acts;
  }
  const ms=Date.now()-t0;
  rows.push({name,wr:100*w/N,turns:turns/N,alive:alive/N,hp:100*hp/N,ms:ms/N,perAct:ms/Math.max(1,acts),
    atkRate:100*(STAT.attack||0)/Math.max(1,acts),dmgPerAct:(STAT.dmg||0)/Math.max(1,acts)});
}
console.log('策略'.padEnd(14)+'胜率'.padEnd(9)+'均回合'.padEnd(9)+'存活'.padEnd(8)+'战后血%'.padEnd(9)+'出手攻击%'.padEnd(11)+'伤害/动作'.padEnd(11)+'耗时/场');
rows.forEach(r=>console.log(
  r.name.padEnd(16)+(r.wr.toFixed(1)+'%').padEnd(10)+r.turns.toFixed(1).padEnd(10)+
  r.alive.toFixed(2).padEnd(9)+r.hp.toFixed(0).padEnd(10)+r.atkRate.toFixed(0).padEnd(12)+
  r.dmgPerAct.toFixed(1).padEnd(12)+r.ms.toFixed(1)+'ms'));
if(rows.length>=2){
  const base=rows[0],top=rows[rows.length-1];
  console.log(`\n技巧梯度(${top.name} − ${base.name}) = ${(top.wr-base.wr).toFixed(1)}pp`);
}
