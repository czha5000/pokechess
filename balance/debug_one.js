// 单局动作追踪:对比两个策略在同一场战斗里各自选了什么
'use strict';
const path=require('path');
const {loadGameData}=require('./loadData');
const RULES=require(path.join(__dirname,'..','js','core','rules.js'));
const {POLICIES}=require('./agents');
const G=loadGameData();
const CH=+(process.env.CH||3), NODE=process.env.NODE_TYPE||'elite', SEED=+(process.env.SEED||12345);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const R=RULES.create(Object.assign({},G,{CRITX:3,DOUBLE_GAP:4,FOREST_AVO:15}),{});
let UID=1;
function mkPlayer(p,x,y,lv){const u={id:UID++,side:'player',name:p.name,type:p.type,key:p.key||p.type,hero:!!p.hero,lv:1,
  maxhp:p.hp,hp:p.hp,atk:p.atk,def:p.def,spd:p.spd,skl:p.skl,lck:p.lck,mov:p.mov,rng:p.rng,
  skills:(G.LEARN[p.key||p.type]||['basic']).slice(0,2),skillUp:{},x,y,acted:false,moved:false,shield:0,eff:{}};
  while(u.lv<lv){u.lv++;u.maxhp+=3;u.hp+=3;u.atk+=1;u.def+=1;u.skl+=1;if(u.lv%2===0)u.spd+=1;
    const sk=(G.LEARN[u.key]||['basic'])[u.lv-1];if(sk&&!u.skills.includes(sk))u.skills.push(sk);}return u;}
function mkEnemy(t,x,y,boss){const lv=(G.ENEMY_LV[CH]||4)+(boss?G.BOSS_LV:(t.elite?G.ELITE_LV:0));
  let hp=t.hp,atk=t.atk,def=t.def,spd=t.spd,skl=t.skl;
  for(let l=1;l<lv;l++){hp+=3;atk+=1;def+=1;skl+=1;if(l%2===0)spd+=1;}
  const maxhp=boss?Math.round(hp*G.BOSS_HP):Math.round(hp*G.ENEMY_POWER*(G.ENEMY_HP_MUL||1));
  return{id:UID++,side:'enemy',name:t.name,type:t.type,key:t.key,lv,maxhp,hp:maxhp,
    atk:boss?atk:Math.round(atk*G.ENEMY_POWER),def,spd,skl,lck:t.lck,mov:Math.min(t.mov,G.ENEMY_MOV_CAP||99),rng:t.rng,
    elite:!!t.elite,mech:t.mech,dmgCap:t.dmgCap,bossShield:t.bossShield,skills:t.skills.slice(),skillUp:{},
    x,y,acted:false,moved:false,shield:0,eff:{}};}
function build(rand){UID=1;const terrain=G.MAPS[(rand()*G.MAPS.length)|0];const units=[];
  const plv={1:3,2:5,3:7}[CH]||4;
  G.POOL.slice(0,5).forEach((p,i)=>units.push(mkPlayer(p,G.PSTART[i][0],G.PSTART[i][1],plv)));
  const ks=Object.keys(G.WILD);const rw=()=>G.WILD[ks[(rand()*ks.length)|0]];
  const slots=[0,1,2,4,5];let si=0;
  if(NODE==='boss'){units.push(mkEnemy(G.CH_BOSS[CH],G.ESLOTS[3][0],G.ESLOTS[3][1],true));for(let i=0;i<3;i++)units.push(mkEnemy(rw(),G.ESLOTS[slots[si]][0],G.ESLOTS[slots[si++]][1]));}
  else if(NODE==='elite'){units.push(mkEnemy(G.CH_ELITE[CH]||G.ELITE,G.ESLOTS[3][0],G.ESLOTS[3][1]));for(let i=0;i<3;i++)units.push(mkEnemy(rw(),G.ESLOTS[slots[si]][0],G.ESLOTS[slots[si++]][1]));}
  else{for(let i=0;i<4;i++)units.push(mkEnemy(rw(),G.ESLOTS[slots[si]][0],G.ESLOTS[slots[si++]][1]));}
  return{terrain,units,obj:null,round:0};}
function enemyAct(s,e){let ts=R.allies(s,'player');if(!ts.length)return null;
  const sc=(en,t)=>{let b=-1;en.skills.forEach(k=>{const sk=G.SKILLS[k];if(!sk||(sk.kind!=='atk'&&sk.kind!=='aoe'))return;
    const v=G.typeMult(sk.type,t.type)*sk.mult;if(v>b)b=v;});return b;};
  const h=ts.filter(t=>sc(e,t)>0);if(h.length)ts=h;
  ts.sort((a,b)=>{const ma=sc(e,a),mb=sc(e,b);if(mb!==ma)return mb-ma;return a.hp-b.hp;});
  const tgt=ts[0];let bk='basic',bv=-1;
  e.skills.forEach(k=>{const sk=G.SKILLS[k];if(!sk||(sk.kind!=='atk'&&sk.kind!=='aoe'))return;
    const v=G.typeMult(sk.type,tgt.type)*sk.mult;if(v>bv){bv=v;bk=k;}});
  const reach=e.rng+((G.SKILLS[bk].rb)||0);const tiles=R.moveTiles(s,e);
  let bt={x:e.x,y:e.y},bd=1e9;for(const t of tiles){const d=Math.abs(t.x-tgt.x)+Math.abs(t.y-tgt.y);if(d<bd){bd=d;bt=t;}}
  if(bd<=reach)return{kind:'attack',unitId:e.id,to:[bt.x,bt.y],skill:bk,targetId:tgt.id};
  return{kind:'wait',unitId:e.id,to:[bt.x,bt.y]};}

const name=process.argv[2]||'expectimax';const P=POLICIES[name];
const rand=mulberry32(SEED),rng=()=>rand()*100;
const s=build(rand);
console.log(`【${name}】第${CH}章 ${NODE}  我方${R.allies(s,'player').length} vs 敌方${R.allies(s,'enemy').length}`);
console.log('敌:'+R.allies(s,'enemy').map(e=>`${e.name}(${e.hp}hp,atk${e.atk},mov${e.mov})`).join(' '));
console.log('我:'+R.allies(s,'player').map(e=>`${e.name}(${e.hp}hp,atk${e.atk},mov${e.mov},rng${e.rng})`).join(' '));
for(let turn=1;turn<=12;turn++){
  s.units.forEach(u=>{u.acted=false;u.moved=false;});
  console.log(`\n--- 回合 ${turn} ---`);
  for(const u0 of R.speedOrder(s)){
    const u=R.byId(s,u0.id);if(!u||u.hp<=0)continue;
    const ev=[];const tk=R.tickStatus(s,u,rng,ev);if(tk.dead||u.hp<=0||tk.skip)continue;
    const a=(u.side==='player')?P.act(R,s,u):enemyAct(s,u);
    if(!a)continue;
    const before=a.kind==='attack'?(R.byId(s,a.targetId)||{}).hp:null;
    const evs=R.applyAction(s,a,rng);
    if(u.side==='player'){
      const t=a.targetId?R.byId(s,a.targetId):null;
      console.log(`  ${u.name}@(${u.x},${u.y}) ${a.kind}${a.skill?'['+G.SKILLS[a.skill].name+']':''}`
        +(t?` → ${t.name} ${before}→${t.hp}`:(a.targetId?' → 目标已亡':''))
        +`  [自身hp ${u.hp}/${u.maxhp}]`);
    }
    const term=R.isTerminal(s);
    if(term){console.log(`\n结果: ${term}  (回合 ${turn})`);process.exit(0);}
  }
}
console.log('\n结果: 12回合未分胜负');
