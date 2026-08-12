// ============================================================================
// rules.js · 纯规则层(唯一真相源)
// ----------------------------------------------------------------------------
// 设计契约(改这里前先读):
//  1. 无 DOM、无 await、无动画、无 log、不读写任何全局(units/run/…)。
//  2. 所有函数对"传入的 state"操作,state 可被 cloneState 深拷贝后随意试走。
//     —— 这是搜索(Expectimax/MCTS)与强化学习环境的前置条件。
//  3. 随机性全部经 rng 参数注入:传函数=真随机;传 null=期望值模式(确定性,给搜索用)。
//  4. 浏览器与 Node 双端加载:浏览器挂 window.RULES,Node 走 module.exports。
//
// 分层:  ui  →  core(battle/turn:表现与流程)  →  rules(纯计算)  →  data
// 迁移状态:阶段1=战斗层(伤害/命中/移动/动作枚举/结算)。地图/事件/商店仍在 run.js。
// ============================================================================
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.RULES=factory();
})(typeof self!=='undefined'?self:this,function(){
'use strict';

// 创建规则实例。D=数据依赖(浏览器传全局,Node 传 loadData 结果);hooks=遗物/道具钩子(可选)
function create(D,hooks){
  const SKILLS=D.SKILLS, typeMult=D.typeMult, COLS=D.COLS, ROWS=D.ROWS, STATUS=D.STATUS;
  const CRITX=D.CRITX!=null?D.CRITX:3, DOUBLE_GAP=D.DOUBLE_GAP!=null?D.DOUBLE_GAP:4, FOREST_AVO=D.FOREST_AVO!=null?D.FOREST_AVO:15;
  const H=Object.assign({
    dmgMult:()=>1, dmgTaken:()=>1, hitAdd:()=>0, critAdd:()=>0,
    thorns:()=>0, shieldRegen:()=>0, onHitInflict:()=>[], capAdd:()=>0,
    onKill:()=>{}, itemOf:()=>null, featureOn:()=>false
  },hooks||{});

  // ---- 状态 ----------------------------------------------------------------
  // state={terrain, units[], obj:{kind,n}, round}
  // unit={id,side,type,key,hp,maxhp,atk,def,spd,skl,lck,mov,rng,skills[],skillUp{},
  //       x,y,acted,moved,shield,eff{},lv,elite,dmgCap,bossShield,mech,item,hero}
  function cloneState(s){
    return {terrain:s.terrain, // 地形只读,共享引用即可(省 90% 克隆开销)
      units:s.units.map(u=>{const c=Object.assign({},u);if(u.eff)c.eff=Object.assign({},u.eff);c.skills=u.skills.slice();return c;}),
      obj:s.obj, round:s.round||0};
  }
  const alive=s=>s.units.filter(u=>u.hp>0);
  const allies=(s,side)=>s.units.filter(u=>u.hp>0&&u.side===side);
  const foes=(s,side)=>s.units.filter(u=>u.hp>0&&u.side!==side);
  const byId=(s,id)=>s.units.find(u=>u.id===id);
  const unitAt=(s,x,y)=>s.units.find(u=>u.hp>0&&u.x===x&&u.y===y);
  const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

  // ---- 地形 / 派生 ---------------------------------------------------------
  const terrainAt=(s,x,y)=>s.terrain[y][x];
  // 视线遮挡(v0.71),与 combat.losBlocked 一致
  const LOS_HIT=(D.LOS_HIT!=null?D.LOS_HIT:20), LOS_DMG=(D.LOS_DMG!=null?D.LOS_DMG:0.8);
  const FLANK_M=(D.FLANK_MULT!=null?D.FLANK_MULT:1.15);
  function losBlocked(s,ax,ay,bx,by){
    if(s.terrain[ay]&&s.terrain[ay][ax]===4)return false;
    const dx=bx-ax,dy=by-ay;if(Math.abs(dx)+Math.abs(dy)<2)return false;
    const steps=Math.max(Math.abs(dx),Math.abs(dy))*2,seen={};
    for(let i=1;i<steps;i++){
      const x=Math.round(ax+dx*i/steps),y=Math.round(ay+dy*i/steps);
      if((x===ax&&y===ay)||(x===bx&&y===by))continue;
      const k=x+','+y;if(seen[k])continue;seen[k]=1;
      if(s.terrain[y]&&s.terrain[y][x]===2)return true;
      if(s.units.some(u=>u.hp>0&&u.x===x&&u.y===y))return true;}
    return false;}
  const coverOf=(s,u)=>terrainAt(s,u.x,u.y)===2?2:0;
  const avoidTerrain=(s,u)=>terrainAt(s,u.x,u.y)===2?FOREST_AVO:0;
  function adjAllies(s,u){return s.units.filter(a=>a.side===u.side&&a.hp>0&&a!==u&&dist(a,u)===1).length;}
  function isFlankedSide(s,att,def){const dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);const ox=def.x+dx,oy=def.y+dy;
    return s.units.some(a=>a.side===att.side&&a.hp>0&&a!==att&&a.x===ox&&a.y===oy);}
  function reachOf(u){let mr=0;u.skills.forEach(k=>{const sk=SKILLS[k];if(sk&&(sk.kind==='atk'||sk.kind==='aoe'))mr=Math.max(mr,sk.rb||0);});return u.rng+mr;}
  function skillOf(u,k){let s=SKILLS[k];if(!s)return null;const up=(u.skillUp&&u.skillUp[k])||0;
    return up?Object.assign({},s,{mult:s.mult*(1+0.2*up)}):s;}

  // ---- 核心数值(与 combat.js 逐项对应)-----------------------------------
  function baseDmg(s,att,def,sk){
    const m=typeMult(sk.type,def.type);if(m===0)return{d:0,m:0};
    const _k=(D.DEF_K!=null?D.DEF_K:16), _dv=def.def+coverOf(s,def);
    let d=Math.max(1,Math.round(att.atk*sk.mult*m*(_k/(_k+_dv))));
    if(losBlocked(s,att.x,att.y,def.x,def.y))d=Math.max(1,Math.round(d*LOS_DMG));
    d=Math.round(d*H.dmgMult(att,sk,def)*H.dmgTaken(def));
    if(sk.useShield)d+=(att.shield||0);
    if(terrainAt(s,att.x,att.y)===4)d=Math.round(d*1.25);
    // v0.71 修漂移:此处曾硬编码 1.15,漏跟 v0.58 的 FLANK_MULT=1.30 —— 由 difftest 对拍抓出
    if(isFlankedSide(s,att,def))d=Math.round(d*((att.side==='player'&&H.featureOn('flank'))?1.5:FLANK_M));
    if(att.side==='player'){
      if(H.featureOn('formation'))d=Math.round(d*(1+0.12*adjAllies(s,att)));
      if(H.featureOn('alpha')&&!def.acted)d=Math.round(d*1.4);
    }
    return{d:Math.max(1,d),m};
  }
  function hitRate(s,att,def,sk){const it=H.itemOf(att);
    const _los=losBlocked(s,att.x,att.y,def.x,def.y)?LOS_HIT:0;
    return Math.max(0,Math.min(100,Math.round(sk.hit+att.skl*2-(def.spd*2+def.lck)-avoidTerrain(s,def)-_los+H.hitAdd(att,sk)+(it&&it.hit?it.hit:0))));}
  function critRate(s,att,def,sk){const it=H.itemOf(att);
    return Math.max(0,Math.min(100,Math.round(sk.crit+att.skl-def.lck+H.critAdd(att)+(it&&it.crit?it.crit:0))));}
  const doubles=(att,def)=>(att.spd-def.spd)>=DOUBLE_GAP;

  // 一次攻击的期望伤害(搜索/评估用,不掷骰)
  function expectedDmg(s,att,def,skKey){
    const sk=skillOf(att,skKey);if(!sk)return 0;
    const b=baseDmg(s,att,def,sk);if(b.m===0)return 0;
    const h=hitRate(s,att,def,sk)/100, c=critRate(s,att,def,sk)/100;
    const per=b.d*(1-c)+Math.min(b.d*CRITX,def.dmgCap||Infinity)*c;
    const times=(doubles(att,def)&&sk.kind!=='aoe')?2:1;
    return h*per*times;
  }

  // ---- 移动 ----------------------------------------------------------------
  function moveTiles(s,u){ // BFS,含原地;排除水域与被占格
    const seen={},q=[{x:u.x,y:u.y,d:0}],out=[{x:u.x,y:u.y,d:0}];seen[u.x+','+u.y]=0;
    while(q.length){const c=q.shift();
      for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=c.x+dx,ny=c.y+dy,k=nx+','+ny;
        if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;
        if(s.terrain[ny][nx]===1)continue;
        if(unitAt(s,nx,ny))continue;
        const nd=c.d+1;if(nd>u.mov||seen[k]!==undefined)continue;
        seen[k]=nd;q.push({x:nx,y:ny,d:nd});out.push({x:nx,y:ny,d:nd});}}
    return out;
  }
  // 某格会被多少敌方单位打到(威胁度)——玩家侧 UI 与 AI 共用同一定义
  function threatAt(s,side,x,y,exclude){let n=0;
    s.units.forEach(e=>{if(e.side===side||e.hp<=0||e===exclude)return;
      if(Math.abs(e.x-x)+Math.abs(e.y-y)<=e.mov+reachOf(e))n++;});
    return n;}

  // ---- 动作枚举 ------------------------------------------------------------
  // action={kind:'attack'|'heal'|'capture'|'wait', unitId, to:[x,y], skill?, targetId?}
  function legalActions(s,u,opt){
    opt=opt||{};const out=[];
    const tiles=u.moved?[{x:u.x,y:u.y,d:0}]:moveTiles(s,u);
    const enemies=foes(s,u.side);
    for(const key of u.skills){
      const sk=skillOf(u,key);if(!sk)continue;
      if(sk.kind==='heal'){
        for(const t of tiles)for(const a of allies(s,u.side))
          if(Math.abs(t.x-a.x)+Math.abs(t.y-a.y)<=1&&a.hp<a.maxhp)
            out.push({kind:'heal',unitId:u.id,to:[t.x,t.y],skill:key,targetId:a.id});
        continue;
      }
      if(sk.kind!=='atk'&&sk.kind!=='aoe')continue;
      const R=u.rng+(sk.rb||0);
      for(const e of enemies){
        if(typeMult(sk.type,e.type)===0)continue; // 免疫:不生成无效动作
        // 每个(技能,目标)只保留若干代表性落点,控制分支因子
        let cands=tiles.filter(t=>Math.abs(t.x-e.x)+Math.abs(t.y-e.y)<=R);
        if(!cands.length)continue;
        if(opt.prune!==false){
          cands=cands.slice().sort((a,b)=>{
            const ta=threatAt(s,u.side,a.x,a.y,e)-(s.terrain[a.y][a.x]===2?0.75:0)+(s.terrain[a.y][a.x]===3?2:0)-(s.terrain[a.y][a.x]===4?0.5:0);
            const tb=threatAt(s,u.side,b.x,b.y,e)-(s.terrain[b.y][b.x]===2?0.75:0)+(s.terrain[b.y][b.x]===3?2:0)-(s.terrain[b.y][b.x]===4?0.5:0);
            return ta-tb||a.d-b.d;}).slice(0,opt.tilesPerTarget||2);
        }
        for(const t of cands)out.push({kind:'attack',unitId:u.id,to:[t.x,t.y],skill:key,targetId:e.id});
      }
    }
    // 收服(贴脸、非精英)
    if(opt.allowCapture!==false&&u.side==='player'){
      for(const t of tiles)for(const e of enemies)
        if(!e.elite&&Math.abs(t.x-e.x)+Math.abs(t.y-e.y)===1&&captureChance(e)>=0.35)
          out.push({kind:'capture',unitId:u.id,to:[t.x,t.y],targetId:e.id});
    }
    // 待机/机动:候选必须同时覆盖【最安全】与【最靠前】两端 ——
    // 只给"最安全"会让搜索型 AI 永远后退(敌人 mov 有上限,追不上 → 拖到超时判负)。
    {const keep=opt.waitTiles||3;const picked=[],seen={};
     const add=t=>{const k=t.x+','+t.y;if(seen[k])return;seen[k]=1;picked.push(t);};
     const safe=tiles.slice().sort((a,b)=>threatAt(s,u.side,a.x,a.y,null)-threatAt(s,u.side,b.x,b.y,null)||a.d-b.d);
     const near=enemies.length?enemies.reduce((a,b)=>{
       const da=Math.min.apply(null,tiles.map(t=>Math.abs(t.x-a.x)+Math.abs(t.y-a.y)));
       const db=Math.min.apply(null,tiles.map(t=>Math.abs(t.x-b.x)+Math.abs(t.y-b.y)));
       return da<=db?a:b;}):null;
     for(const t of safe.slice(0,Math.max(1,keep-1)))add(t);          // 安全端
     if(near){const fwd=tiles.slice().sort((a,b)=>
        (Math.abs(a.x-near.x)+Math.abs(a.y-near.y))-(Math.abs(b.x-near.x)+Math.abs(b.y-near.y)));
       add(fwd[0]);                                                    // 最靠前
       if(fwd.length>1)add(fwd[Math.min(1,fwd.length-1)]);}
     add({x:u.x,y:u.y,d:0});                                           // 原地
     for(const t of picked)out.push({kind:'wait',unitId:u.id,to:[t.x,t.y]});}
    return out;
  }
  function captureChance(def){return Math.min(0.95,(def.elite?0.25:0.70)*(1-def.hp/def.maxhp)+H.capAdd());}

  // ---- 结算 ----------------------------------------------------------------
  // rng: ()=>0..100 的函数;传 null = 期望值模式(命中必中但伤害按期望缩放,供搜索用)
  function strike(s,att,def,skKey,rng,ev){
    const sk=skillOf(att,skKey);if(!sk)return ev;
    const times=(doubles(att,def)&&sk.kind!=='aoe')?2:1;
    let dealt=0;const wasFull=(def.hp===def.maxhp);
    for(let i=0;i<times;i++){
      if(def.hp<=0)break;
      const b=baseDmg(s,att,def,sk);
      if(b.m===0){ev.push({t:'immune',by:att.id,on:def.id});break;}
      const hr=hitRate(s,att,def,sk),cr=critRate(s,att,def,sk);
      let d;
      if(rng){
        if(rng()>=hr){ev.push({t:'miss',by:att.id,on:def.id});continue;}
        const crit=rng()<cr;d=crit?b.d*CRITX:b.d;
        if(def.dmgCap&&d>def.dmgCap)d=def.dmgCap;
        ev.push({t:'hit',by:att.id,on:def.id,dmg:d,crit,mult:b.m});
      }else{ // 期望模式
        const cap=x=>(def.dmgCap&&x>def.dmgCap)?def.dmgCap:x;
        d=Math.round((hr/100)*(b.d*(1-cr/100)+cap(b.d*CRITX)*(cr/100)));
        ev.push({t:'hit',by:att.id,on:def.id,dmg:d,crit:false,mult:b.m,expected:true});
      }
      const ab=Math.min(def.shield||0,d);if(ab>0)def.shield-=ab;
      def.hp-=(d-ab);dealt+=d;
      if(sk.inflict&&def.hp>0&&(!rng||rng()<sk.inflict.chance))applyStatus(def,sk.inflict.kind,ev);
      if(att.side==='player'&&def.hp>0)H.onHitInflict(att,def).forEach(k=>applyStatus(def,k,ev));
      const th=H.thorns();
      if(att.side==='enemy'&&th>0&&att.hp>0){att.hp-=th;ev.push({t:'thorns',on:att.id,dmg:th});}
    }
    if(sk.recoil&&dealt>0&&att.hp>0){const rc=Math.max(1,Math.round(dealt*sk.recoil));att.hp-=rc;ev.push({t:'recoil',on:att.id,dmg:rc});}
    if(def.hp>0&&(sk.knock||(att.side==='player'&&H.featureOn('knockback'))))push(s,att,def,sk.knock||1,ev);
    if(def.hp<=0)ev.push({t:'kill',by:att.id,on:def.id,fromFull:wasFull});
    return dealt;
  }
  // 与 combat.pushTarget / sim.pushTargetS 保持一致(v0.55)
  const DROWN_EXEC=0.40, DROWN_HURT=0.30;
  function push(s,att,def,n,ev){
    if(def.isBoss)return;                       // Boss 免疫击退
    let dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);
    if(dx&&dy){if(Math.abs(def.x-att.x)>=Math.abs(def.y-att.y))dy=0;else dx=0;}
    if(!dx&&!dy)return;
    for(let i=0;i<n;i++){
      if(def.elite){def._kr=(def._kr||0)+1;if(def._kr<2)return;def._kr=0;} // 精英:两次才推动一格
      const nx=def.x+dx,ny=def.y+dy;
      if(nx<0||ny<0||nx>=COLS||ny>=ROWS){def.hp-=4;ev.push({t:'wall',on:def.id,dmg:4});return;} // 边界=撞墙
      if(s.terrain[ny][nx]===1){                // 水=处决,非即死
        if(def.hp<=def.maxhp*DROWN_EXEC){def.hp=0;ev.push({t:'drown',on:def.id});}
        else{const d=Math.max(1,Math.round(def.maxhp*DROWN_HURT));def.hp-=d;ev.push({t:'soaked',on:def.id,dmg:d});}
        return;}
      const occ=unitAt(s,nx,ny);
      if(occ){def.hp-=4;occ.hp-=4;ev.push({t:'collide',on:def.id,other:occ.id});return;}
      def.x=nx;def.y=ny;}
  }
  function applyStatus(u,kind,ev){const st=STATUS[kind];if(!st)return;
    u.eff=u.eff||{};
    if(st.stack)u.eff[kind]=(u.eff[kind]||0)+(st.apply||3);else u.eff[kind]=st.turns;
    ev.push({t:'status',on:u.id,kind});}
  // 行动前的持续伤害/麻痹判定
  function tickStatus(s,u,rng,ev){
    let dead=false,skip=false;
    if(terrainAt(s,u.x,u.y)===3){u.hp-=4;ev.push({t:'lava',on:u.id,dmg:4});}
    if(u.eff){
      if(u.eff.burn>0){u.hp-=STATUS.burn.dmg;ev.push({t:'dot',on:u.id,kind:'burn',dmg:STATUS.burn.dmg});if(--u.eff.burn<=0)delete u.eff.burn;}
      if(u.eff.poison>0){const d=u.eff.poison;u.hp-=d;ev.push({t:'dot',on:u.id,kind:'poison',dmg:d});if(--u.eff.poison<=0)delete u.eff.poison;}
    }
    if(u.hp<=0)return{dead:true,skip:false};
    if(u.eff&&u.eff.para>0){if(--u.eff.para<=0)delete u.eff.para;
      const p=STATUS.para.skip;
      if(rng?rng()<p:false){skip=true;ev.push({t:'para',on:u.id});}}
    return{dead,skip};
  }

  // 执行一个动作 → 就地修改 state,返回事件流(表现层据此播动画)
  function applyAction(s,action,rng){
    const ev=[];const u=byId(s,action.unitId);
    if(!u||u.hp<=0)return ev;
    if(action.to&&(action.to[0]!==u.x||action.to[1]!==u.y)){u.x=action.to[0];u.y=action.to[1];u.moved=true;ev.push({t:'move',on:u.id,to:action.to});}
    if(action.kind==='attack'){
      const tgt=byId(s,action.targetId);
      if(tgt&&tgt.hp>0){
        const sk=skillOf(u,action.skill);
        if(sk.kind==='aoe'){
          const list=[tgt].concat(foes(s,u.side).filter(e=>e!==tgt&&dist(e,tgt)===1));
          for(const d of list){if(d.hp<=0)continue;strike(s,u,d,action.skill,rng,ev);}
        }else{
          strike(s,u,tgt,action.skill,rng,ev);
          // 反击:目标存活、在其射程内、未麻痹
          if(tgt.hp>0&&dist(u,tgt)<=tgt.rng&&u.hp>0&&!(tgt.eff&&tgt.eff.para))strike(s,tgt,u,'basic',rng,ev);
        }
      }
    }else if(action.kind==='heal'){
      const tgt=byId(s,action.targetId);const sk=skillOf(u,action.skill);
      if(tgt&&tgt.hp>0){const amt=sk.amount;tgt.hp=Math.min(tgt.maxhp,tgt.hp+amt);ev.push({t:'heal',by:u.id,on:tgt.id,amt});}
    }else if(action.kind==='capture'){
      const tgt=byId(s,action.targetId);
      if(tgt&&tgt.hp>0){
        const ch=captureChance(tgt);
        if(rng?(rng()<ch*100):(ch>=0.5)){tgt.hp=0;ev.push({t:'capture',by:u.id,on:tgt.id});}
        else{ev.push({t:'captureFail',by:u.id,on:tgt.id});strike(s,tgt,u,'basic',rng,ev);}
      }
    }
    u.acted=true;
    s.units=s.units.filter(x=>x.hp>0||x.side==='player'); // 敌方死亡即移除;我方保留尸体供上层处理永久死亡
    return ev;
  }

  // ---- 局面评估(搜索用)---------------------------------------------------
  // 正=我方优势。血量为主,存活数其次,轻微位置项(避免呆站威胁区)
  function evalState(s,side){
    side=side||'player';
    let me=0,op=0,meN=0,opN=0,risk=0;
    for(const u of s.units){
      if(u.hp<=0)continue;
      const w=u.hp/u.maxhp;
      if(u.side===side){me+=w;meN++;risk+=threatAt(s,side,u.x,u.y,null)*0.03;}
      else{op+=w;opN++;}
    }
    return (me*1.0+meN*0.55)-(op*1.0+opN*0.55)-risk;
  }
  function isTerminal(s){
    const p=s.units.some(u=>u.hp>0&&u.side==='player');
    const e=s.units.some(u=>u.hp>0&&u.side==='enemy');
    if(!p)return 'lose';
    if(!e)return 'win';
    return null;
  }
  function speedOrder(s){ // 速度交错行动序(与 turn.js 一致)
    return alive(s).slice().sort((a,b)=>(b.spd-a.spd)||((a.side==='player'?0:1)-(b.side==='player'?0:1)));
  }

  return {cloneState,alive,allies,foes,byId,unitAt,dist,
    terrainAt,coverOf,avoidTerrain,adjAllies,isFlankedSide,reachOf,skillOf,
    baseDmg,hitRate,critRate,doubles,expectedDmg,losBlocked,
    moveTiles,threatAt,legalActions,captureChance,
    strike,applyStatus,tickStatus,applyAction,
    evalState,isTerminal,speedOrder,
    CRITX,DOUBLE_GAP,FOREST_AVO};
}

return {create};
});
