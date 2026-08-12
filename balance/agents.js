// ============================================================================
// agents.js · 策略库(全部实现同一个接口,方便横向比武 / 将来接 RL)
//   policy.act(R, state, unit) -> action | null
//   R = rules 实例(见 js/core/rules.js)
// 接口稳定性:RL 训练好的模型只要实现 act(),就能直接替换进 sim / 游戏。
// ============================================================================
'use strict';

// ---- 0. novice:纯贪心(技巧梯度的尺子,锁死勿改)---------------------------
const novice={
  name:'novice',
  act(R,s,u){
    const acts=R.legalActions(s,u,{prune:false,waitTiles:1,allowCapture:false});
    let best=null,bv=-1e9;
    for(const a of acts){
      if(a.kind!=='attack')continue;
      const tgt=R.byId(s,a.targetId);
      const v=R.expectedDmg(s,Object.assign({},u,{x:a.to[0],y:a.to[1]}),tgt,a.skill);
      if(v>bv){bv=v;best=a;}
    }
    if(best)return best;
    // 没仗打:直奔最近敌人
    const es=R.foes(s,u.side);if(!es.length)return null;
    const near=es.reduce((a,b)=>R.dist(u,a)<R.dist(u,b)?a:b);
    const tiles=R.moveTiles(s,u);
    let bt=tiles[0],bd=1e9;
    for(const t of tiles){const d=Math.abs(t.x-near.x)+Math.abs(t.y-near.y);if(d<bd){bd=d;bt=t;}}
    return{kind:'wait',unitId:u.id,to:[bt.x,bt.y]};
  }
};

// ---- 1. greedy:当前游戏内启发式的等价实现(基线)---------------------------
const greedy={
  name:'greedy',
  act(R,s,u){
    const acts=R.legalActions(s,u,{tilesPerTarget:2,waitTiles:2});
    const low=u.hp/u.maxhp<0.35;
    let best=null,bv=-1e9;
    for(const a of acts){
      if(a.kind!=='attack')continue;
      const from=Object.assign({},u,{x:a.to[0],y:a.to[1]});
      const tgt=R.byId(s,a.targetId);
      const dmg=R.expectedDmg(s,from,tgt,a.skill);
      const lethal=dmg>=tgt.hp;
      const expo=R.threatAt(s,u.side,a.to[0],a.to[1],tgt);
      let counter=0;
      if(!lethal&&R.dist(from,tgt)<=tgt.rng)counter=R.expectedDmg(s,tgt,from,'basic')*0.6;
      const v=dmg+(lethal?25:0)+tgt.atk*0.4-counter-expo*4;
      if(v>bv){bv=v;best=a;}
    }
    if(best&&(bv>2||!low))return best;
    // 撤退到最安全格
    const tiles=R.moveTiles(s,u);
    let bt=null,bs=1e9;
    const es=R.foes(s,u.side);
    const near=es.length?es.reduce((a,b)=>R.dist(u,a)<R.dist(u,b)?a:b):null;
    for(const t of tiles){
      let sc=R.threatAt(s,u.side,t.x,t.y,null)*4-(R.terrainAt(s,t.x,t.y)===2?1.5:0);
      if(near&&!low)sc+=(Math.abs(t.x-near.x)+Math.abs(t.y-near.y))*0.3;
      if(sc<bs){bs=sc;bt=t;}}
    return bt?{kind:'wait',unitId:u.id,to:[bt.x,bt.y]}:null;
  }
};

// ---- 2. expectimax 深度1:我方一步 → 敌方最优回应 → 评估 -------------------
// 关键:用期望值模式(rng=null)前推,确定性、可比较。
function enemyBestReply(R,s,foeSide){
  // 敌方每个未行动单位各挑自己期望收益最大的一击(近似:不做敌方之间的协同)
  let total=0;
  for(const e of R.allies(s,foeSide)){
    if(e.acted)continue;
    const acts=R.legalActions(s,e,{tilesPerTarget:1,waitTiles:0,allowCapture:false});
    let bv=0;
    for(const a of acts){
      if(a.kind!=='attack')continue;
      const from=Object.assign({},e,{x:a.to[0],y:a.to[1]});
      const t=R.byId(s,a.targetId);
      if(!t||t.hp<=0)continue;
      const d=R.expectedDmg(s,from,t,a.skill);
      // 对我方的威胁价值:伤害 + 击杀溢价
      const v=Math.min(d,t.hp)+(d>=t.hp?t.maxhp*0.5:0);
      if(v>bv)bv=v;
    }
    total+=bv;
  }
  return total;
}
// 评估用【增量】而非绝对值:待机≈0 分,不再"苟着积累存活价值"。
// 另加绝对伤害进度项 —— 否则打 Boss 时"砍掉 20/210 血"在归一化视角下几乎无价值,AI 会学会拖到超时。
function hpSum(R,s,side){let hp=0,mx=0;for(const u of s.units){if(u.hp<=0||u.side!==side)continue;hp+=u.hp;mx+=u.maxhp;}return{hp,mx};}
// 【关键】被集火击杀的风险 —— 对应敌方 A1 集火协议。
// 只看"敌方总伤害"是看不见的:我方单位踏进射程时总伤害几乎不变(敌人本来就要打别人),
// 变的是伤害【分布】。必须单独问:本回合未行动的敌人合力,能不能把这个单位打死?
function killRisk(R,s,u){
  let pot=0;
  for(const e of R.foes(s,u.side)){
    if(e.acted)continue;
    if(R.dist(e,u)>e.mov+R.reachOf(e))continue;
    let bd=0;
    for(const k of e.skills){const sk=R.skillOf(e,k);
      if(!sk||(sk.kind!=='atk'&&sk.kind!=='aoe'))continue;
      const d=R.expectedDmg(s,e,u,k);if(d>bd)bd=d;}
    pot+=bd;
  }
  const eff=u.hp+(u.shield||0);
  if(pot<=0)return 0;
  const ratio=pot/eff;                       // ≥1 = 本回合可能被秒
  return ratio>=1?(1.6+Math.min(1,ratio-1)):Math.max(0,ratio-0.45)*0.8;
}
function unitValue(u){return u.maxhp*0.35+u.atk*1.6+(u.hero?25:0);}
function makeExpectimax(opt){
  opt=Object.assign({tilesPerTarget:3,waitTiles:3,replyWeight:0.5,dmgWeight:1.0,killBonus:0.5,stallTax:45,approach:6,riskWeight:1.0,samples:1},opt||{});
  return {
    name:'expectimax'+(opt.tag||''),
    act(R,s,u){
      const acts=R.legalActions(s,u,{tilesPerTarget:opt.tilesPerTarget,waitTiles:opt.waitTiles});
      if(!acts.length)return null;
      const me=u.side, foe=(me==='player')?'enemy':'player';
      const before=R.evalState(s,me), fBefore=hpSum(R,s,foe), mBefore=hpSum(R,s,me);
      const foeAliveBefore=R.allies(s,foe).length;
      // 基准威胁:我原地不动时敌方的回应强度。后面只算"这一步额外招来多少"(边际威胁),
      // 否则"离远点"永远零风险,1层搜索会学会拖到超时。
      const idleThreat=enemyBestReply(R,s,foe);
      let best=null,bv=-1e9;const dbg=[];
      for(const a of acts){
        // 概率节点:samples>1 时对同一动作掷若干次骰取均值 —— 期望值折叠会把
        // "90%×90% 才能击杀"当成"必杀",从而冲进敌阵送人头(实测主要失分点)。
        let v=0;
        for(let smp=0;smp<opt.samples;smp++){
        const s2=R.cloneState(s);
        R.applyAction(s2,a,opt.samples>1?mkRng(seedCounter++):null);
        const term=R.isTerminal(s2);
        let v1;
        if(term==='win')v1=1e6;
        else if(term==='lose')v1=-1e6;
        else{
          const fAfter=hpSum(R,s2,foe), mAfter=hpSum(R,s2,me);
          const dealt=Math.max(0,fBefore.hp-fAfter.hp);      // 绝对伤害进度
          const lost =Math.max(0,mBefore.hp-mAfter.hp);      // 自损(反击/反作用力)
          const kills=foeAliveBefore-R.allies(s2,foe).length;
          const delta=(R.evalState(s2,me)-before)*60;        // 局面增量(含威胁位置项)
          const threat=enemyBestReply(R,s2,foe)-idleThreat;  // 边际威胁:这一步"额外"招来的火力
          // 拖延税:不造成伤害的回合按"敌方剩余血量"计罚 —— 把 40 回合上限编码进 1 层评估
          let stall=0;
          if(dealt<=0&&kills<=0){
            stall=-(fBefore.hp/Math.max(1,fBefore.mx))*opt.stallTax;
            // 无仗可打时:奖励逼近(否则被 mov 上限保护的"永远后退"成为最优解)
            const eList=R.allies(s2,foe);
            if(eList.length){
              const u2=R.byId(s2,u.id);
              const d0=Math.min.apply(null,eList.map(e=>Math.abs(u.x-e.x)+Math.abs(u.y-e.y)));
              const d1=Math.min.apply(null,eList.map(e=>Math.abs(u2.x-e.x)+Math.abs(u2.y-e.y)));
              stall+=(d0-d1)*opt.approach;
            }
          }
          const u2=R.byId(s2,u.id);
          const risk=(u2&&u2.hp>0)?killRisk(R,s2,u2)*unitValue(u2)*opt.riskWeight:0;
          v1=delta+dealtScore(dealt)*opt.dmgWeight-lost*0.8
            +kills*40*(1+opt.killBonus)-threat*opt.replyWeight+stall-risk;
          if(DBG)LAST=`delta=${delta.toFixed(1)} dealt=${dealt.toFixed(1)} lost=${lost.toFixed(1)} kills=${kills} threat=${(threat*opt.replyWeight).toFixed(1)} stall=${stall.toFixed(1)} risk=${risk.toFixed(1)}`;
        }
        v+=v1;
        }
        v/=opt.samples;
        if(DBG)dbg.push({a,v,parts:LAST});
        if(v>bv){bv=v;best=a;}
      }
      if(DBG&&dbg.length){dbg.sort((x,y)=>y.v-x.v);
        console.log(`  [决策] ${u.name}@(${u.x},${u.y}) 候选${acts.length} → 选 ${best.kind}`);
        dbg.slice(0,4).forEach(d=>console.log(`     ${(d.a.kind+(d.a.skill?'/'+d.a.skill:'')).padEnd(16)}to(${d.a.to})  v=${d.v.toFixed(1)}  ${d.parts||''}`));}
      return best;
    }
  };
}
const DBG=!!process.env.DBGACT;let LAST='';
// 采样用的可复现 rng(独立于对局主 rng,避免污染战斗随机序列)
let seedCounter=1;
function mkRng(seed){let a=seed*2654435761%4294967296;
  return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return(((t^t>>>14)>>>0)/4294967296)*100;};}
const dealtScore=d=>d; // 线性;将来可换非线性(过量伤害递减)

// ---- 3. MCTS 占位(下一阶段);RL 模型也从这里接入 --------------------------
// function makeMCTS(opt){...}  rollout 用 greedy 当 default policy

const E=(k,d)=>process.env[k]!=null?+process.env[k]:d; // 权重可用环境变量扫描
const POLICIES={
  novice, greedy,
  expectimax: makeExpectimax({tag:'',
    replyWeight:E('RW',0.5),dmgWeight:E('DW',1.0),stallTax:E('ST',45),approach:E('AP',6),
    tilesPerTarget:E('TPT',3),waitTiles:E('WT',3),riskWeight:E('RK',1.0),samples:E('SMP',1)}),
  exp_mc: makeExpectimax({tag:'_mc',samples:5,replyWeight:0.35,riskWeight:0.8,stallTax:60,approach:8}),
  exp_aggro: makeExpectimax({tag:'_aggro',replyWeight:0.2,dmgWeight:1.4,stallTax:70,approach:12}),
  exp_wide:  makeExpectimax({tag:'_wide',tilesPerTarget:5,waitTiles:5,replyWeight:0.35,approach:10})
};
module.exports={POLICIES,makeExpectimax,novice,greedy};
