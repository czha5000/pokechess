// ============================================================================
// difftest.js · 三份规则实现的对拍验证
// ----------------------------------------------------------------------------
// 同一套规则目前有三份实现:
//   js/core/combat.js  (游戏,权威)
//   js/core/rules.js   (纯规则层,给搜索/RL)
//   balance/sim.js     (平衡台,所有测量都基于它)
// 只要三者漂移,平衡台的一切结论都是假的。本脚本对海量随机局面逐项比对核心公式。
//
// 手法:把三个文件的源码分别用 new Function 包起来,注入同一套桩(无遗物/无地形/无夹击),
//       只取出 baseDmg / hitRate / critRate / doubles 四个纯函数做数值比对。
// 用法: node difftest.js [样本数]
// ============================================================================
'use strict';
const fs=require('fs'),path=require('path');
const {loadGameData}=require('./loadData');
const G=loadGameData();
const N=parseInt(process.argv[2]||'50000',10);

// 共享地形网格:三份实现都持有同一个数组引用,逐轮就地改写内容即可覆盖各地形分支
// (森林=掩体+回避、高地=+25%伤害、岩浆、水),这几条正是分三处手改过、漂移风险最高的地方
const FLAT=Array.from({length:G.ROWS},()=>Array(G.COLS).fill(0));
function reterrain(){for(let y=0;y<G.ROWS;y++)for(let x=0;x<G.COLS;x++)FLAT[y][x]=[0,0,2,3,4][Math.random()*5|0];}
// 共享单位数组:三份实现的视线遮挡都要读它(combat 用全局 units,rules 用 s.units,sim 用 CURUNITS)
const UNITS=[];

// ---- 1. combat.js(游戏侧,权威)----
function loadCombat(){
  const src=fs.readFileSync(path.join(__dirname,'..','js','core','combat.js'),'utf8');
  const pre=`
    const TERRAIN=FLAT_, COLS=${G.COLS}, ROWS=${G.ROWS};
    const SKILLS=D_.SKILLS, typeMult=D_.typeMult, STATUS=D_.STATUS, HELD_ITEMS=D_.HELD_ITEMS;
    const DEF_K=${G.DEF_K}, FLANK_MULT=${G.FLANK_MULT}, SHIELD_CAP=${G.SHIELD_CAP};
    const CRITX=3, DOUBLE_GAP=4, FOREST_AVO=15, MAXLV=${G.MAXLV}, THRESH=D_.THRESH;
    const LEARN=D_.LEARN, EVO=D_.EVO, STAGE_LV=D_.STAGE_LV, EVO_BONUS=D_.EVO_BONUS;
    let units=UNITS_, run={relics:[]}, busy=false, uid=1, battleCaptures=[];
    const LOS_HIT=${G.LOS_HIT}, LOS_DMG=${G.LOS_DMG};
    const rand100=()=>50;
    // 桩:遗物/道具/表现层全部中性化
    const relicDmgMult=()=>1, relicDmgTaken=()=>1, relicHitAdd=()=>0, relicCritAdd=()=>0,
          relicThorns=()=>0, relicShieldRegen=()=>0, relicHpDrain=()=>0, relicHitFix=()=>null,
          relicCapAdd=()=>0, relicExpMult=()=>1, relicOnKill=()=>{}, relicOnHit=()=>{},
          relicReviveAvailable=()=>false, hasRelic=()=>false;
    // 只桩 combat.js 自身【没有】定义的外部依赖(它自己定义的 learnNext/killUnit 等不能重复声明)
    const floatText=()=>{}, burst=()=>{}, flashCell=()=>{}, setHp=()=>{}, render=()=>{},
          log=()=>{}, advanceInit=()=>{}, clearSel=()=>{}, showInfo=()=>{},
          renderSkills=()=>{}, renderActs=()=>{}, showOwnRange=()=>{},
          delay=()=>Promise.resolve(), lunge=()=>Promise.resolve();
    const bw={classList:{add(){},remove(){}}};
    const document={getElementById:()=>({textContent:'',innerHTML:'',style:{}})};
  `;
  const post=`;return {baseDmg,hitRate,critRate,doubles,losBlocked};`;
  return new Function('FLAT_','D_','UNITS_',pre+src+post)(FLAT,G,UNITS);
}

// ---- 2. rules.js(纯规则层)----
function loadRules(){
  const RULES=require(path.join(__dirname,'..','js','core','rules.js'));
  const R=RULES.create(Object.assign({},G,{CRITX:3,DOUBLE_GAP:4,FOREST_AVO:15}),{});
  const st={terrain:FLAT,units:UNITS,obj:null,round:0};
  return {
    baseDmg:(a,d,s)=>R.baseDmg(st,a,d,s),
    hitRate:(a,d,s)=>R.hitRate(st,a,d,s),
    critRate:(a,d,s)=>R.critRate(st,a,d,s),
    doubles:R.doubles,
    losBlocked:(ax,ay,bx,by)=>R.losBlocked?R.losBlocked(st,ax,ay,bx,by):null
  };
}

// ---- 3. sim.js(平衡台)—— 抽取四个纯函数 ----
function loadSim(){
  const src=fs.readFileSync(path.join(__dirname,'sim.js'),'utf8');
  const pick=name=>{const i=src.indexOf('function '+name+'(');
    if(i<0)throw new Error('sim.js 找不到 '+name);
    let d=0,j=src.indexOf('{',i);const st=j;
    for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'){d--;if(d===0)break;}}
    return src.slice(i,j+1);};
  const pre=`
    const TERRAIN=FLAT_, COLS=${G.COLS}, ROWS=${G.ROWS};
    const SKILLS=D_.SKILLS, typeMult=D_.typeMult;
    const G={DEF_K:${G.DEF_K+(process.env.MUTATE?1:0)}}, FLANK_MULT=${G.FLANK_MULT}, DOUBLE_GAP=4, FOREST_AVO=15, CRITX=3;
    const rDmg=()=>1, rTaken=()=>1, rHit=()=>0, rCrit=()=>0, rHitFix=()=>null;
    const hasRelicS=()=>false, adjAlliesS=()=>0;
    // 夹击必须用真实单位数组(此前桩成 false,掩盖了 rules.js 的倍率漂移)
    function isFlankedSideS(att,def){const dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);
      const ox=def.x+dx,oy=def.y+dy;
      return CURUNITS.some(a=>a.player===att.player&&a.hp>0&&a!==att&&a.x===ox&&a.y===oy);}
    const LOS_HIT=${G.LOS_HIT}, LOS_DMG=${G.LOS_DMG};
    let CURUNITS=UNITS_;
  `;
  const body=[pick('losBlocked'),pick('cover'),pick('avo'),pick('baseDmg'),pick('hitRate'),pick('critRate'),pick('doubles')].join('\n');
  return new Function('FLAT_','D_','UNITS_',pre+body+';return {baseDmg,hitRate,critRate,doubles,losBlocked};')(FLAT,G,UNITS);
}

// ---- 随机单位 ----
const TYPES=Object.keys(G.TYPE_CN);
const SKKEYS=Object.keys(G.SKILLS).filter(k=>{const s=G.SKILLS[k];return s&&(s.kind==='atk'||s.kind==='aoe');});
const ri=n=>Math.random()*n|0;
function mkU(side,i){return{id:i,side,player:side==='player',type:TYPES[ri(TYPES.length)],
  hp:5+ri(120),maxhp:130,atk:4+ri(40),def:ri(24),spd:1+ri(14),skl:ri(12),lck:ri(10),
  mov:3+ri(4),rng:1+ri(2),x:2+ri(4),y:1+ri(5),shield:0,skills:['basic'],skillUp:{},acted:false,eff:{}};}

// ---- 对拍 ----
const C=loadCombat(), R=loadRules(), S=loadSim();
let bad=0;const samples=[];
for(let i=0;i<N;i++){
  reterrain();                       // 每轮换一张随机地形,覆盖 平地/森林/岩浆/高地
  const a=mkU('player',1), d=mkU('enemy',2);
  // 一半相邻、一半拉开距离(拉开才会触发视线遮挡);另放 2 个旁观单位当遮挡物
  if(i%2){d.x=a.x+1;d.y=a.y;}else{d.x=Math.min(G.COLS-1,a.x+2+ri(4));d.y=Math.min(G.ROWS-1,a.y+ri(3));}
  UNITS.length=0;UNITS.push(a,d,mkU('enemy',3),mkU('player',4));
  R.setUnits&&R.setUnits(UNITS);
  const sk=G.SKILLS[SKKEYS[ri(SKKEYS.length)]];
  const r=[['baseDmg',C.baseDmg(a,d,sk).d,R.baseDmg(a,d,sk).d,S.baseDmg(a,d,sk).d],
           ['hitRate',C.hitRate(a,d,sk),R.hitRate(a,d,sk),S.hitRate(a,d,sk)],
           ['critRate',C.critRate(a,d,sk),R.critRate(a,d,sk),S.critRate(a,d,sk)],
           ['doubles',+C.doubles(a,d),+R.doubles(a,d),+S.doubles(a,d)]];
  for(const [nm,c,ru,s] of r){
    if(c!==ru||c!==s){bad++;
      if(samples.length<6)samples.push({nm,c,ru,s,att:{atk:a.atk,skl:a.skl,spd:a.spd,type:a.type},
        def:{def:d.def,spd:d.spd,lck:d.lck,type:d.type},sk:sk.name,
        los:[C.losBlocked(a.x,a.y,d.x,d.y),R.losBlocked(a.x,a.y,d.x,d.y),S.losBlocked(a.x,a.y,d.x,d.y)],
        pos:[a.x,a.y,d.x,d.y],aT:FLAT[a.y][a.x]});}
  }
}
const total=N*4;
console.log('===== 三份实现对拍 · '+N+' 组随机局面 × 4 个公式 = '+total+' 次比对 =====');
console.log('  combat.js(权威) vs rules.js vs sim.js\n');
if(!bad){console.log('✅ 全部一致 —— 三份实现无漂移。');}
else{
  console.log('❌ 发现 '+bad+' 处不一致('+(100*bad/total).toFixed(3)+'%)\n');
  samples.forEach(x=>console.log('  ['+x.nm+'] combat='+x.c+' rules='+x.ru+' sim='+x.s+
    '  LOS='+JSON.stringify(x.los)+' 位置='+JSON.stringify(x.pos)+' 攻方地形='+x.aT+
    ' | 攻'+JSON.stringify(x.att)+' 防'+JSON.stringify(x.def)+' 招='+x.sk));
}
