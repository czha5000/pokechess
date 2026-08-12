// 遗物钩子:遍历 run.relics 聚合效果,并提供奖励选择/展示
function hasRelic(id){return run.relics&&run.relics.some(r=>r.id===id);}
// 防御收益递减(v0.59):扫描证实「减伤 × 生命池」是乘算叠加,导致防御流遗物包揽强度榜前 7。
// 每多一件防御流遗物,所有防御效果按此系数缩水 ⇒ 堆防御从"必胜解"变成"一个选项"。
function defScale(){const n=(run.relics||[]).filter(r=>r.arch==='def').length;return n>1?1/(1+0.35*(n-1)):1;}
function relicDmgMult(att,sk,def){let m=1;if(att.side==='player')for(const r of run.relics){if(r.dmgMult)m*=r.dmgMult(att,sk,def);}return m;}
function relicHitAdd(att,sk){let a=0;if(att.side==='player')for(const r of run.relics){if(r.hitAdd)a+=r.hitAdd(att,sk);}return a;}
function relicCapAdd(){let a=0;for(const r of run.relics){if(r.capAdd)a+=r.capAdd;}return a;}
function isCurse(r){return !!(r&&r.curse);}
function relicExpMult(){let m=1;for(const r of run.relics){if(r.expMult)m*=r.expMult;}return m;}
// 应用遗物开战属性,并记录增量 _rb(战后同步时扣除,避免遗物加成被复利累积进牌库)
function applyRelicStats(u){u._rb={atk:0,def:0,spd:0,maxhp:0,lck:0};const ds=defScale();
  for(const r of run.relics){if(!r.statMod)continue;
    const b={atk:u.atk,def:u.def,spd:u.spd,maxhp:u.maxhp,lck:u.lck,hp:u.hp,shield:u.shield||0};
    r.statMod(u);
    if(r.arch==='def'&&ds<1){ // 防御流属性加成同样递减
      ['atk','def','spd','maxhp','lck','hp'].forEach(k=>{u[k]=b[k]+Math.round((u[k]-b[k])*ds);});
      u.shield=b.shield+Math.round(((u.shield||0)-b.shield)*ds);}
    u._rb.atk+=u.atk-b.atk;u._rb.def+=u.def-b.def;u._rb.spd+=u.spd-b.spd;u._rb.maxhp+=u.maxhp-b.maxhp;u._rb.lck+=u.lck-b.lck;}
  if(u.shield&&typeof shieldCapOf==='function')u.shield=Math.min(u.shield,shieldCapOf(u));} // 开战护盾也受上限约束(重盾)
function relicOnKill(att){if(att.side!=='player')return;for(const r of run.relics){if(r.onKill)r.onKill(att);}}
function relicThorns(){let t=0;for(const r of run.relics){if(r.thorns)t+=r.thorns*(r.arch==='def'?defScale():1);}return Math.round(t);}
function relicShieldRegen(){let v=0;for(const r of run.relics){if(r.shieldRegen)v+=r.shieldRegen;}return Math.round(v*defScale());}
function relicHpDrain(){let v=0;for(const r of run.relics){if(r.hpDrain)v+=r.hpDrain;}return v;} // 诅咒:每回合自损
function relicHitFix(){for(const r of run.relics){if(r.hitFix!=null)return r.hitFix;}return null;} // 诅咒:命中率锁定
function relicReviveAvailable(){return run.relics.some(r=>r.revive)&&!run.reviveUsed;}
function relicCritAdd(att){let a=0;if(att.side==='player')for(const r of run.relics){if(r.critAdd)a+=(typeof r.critAdd==='function'?r.critAdd():r.critAdd);}return a;}
function relicDmgTaken(def){let m=1;if(def&&def.side==='player'){const ds=defScale();
  for(const r of run.relics){if(!r.dmgTakenMult)continue;
    if(r.dmgTakenMult<1&&r.arch==='def')m*=(1-(1-r.dmgTakenMult)*ds); // 减伤按递减系数打折
    else m*=r.dmgTakenMult;}}                                        // 增伤类诅咒不打折
  return m;}
function relicOnHit(att,def){if(att.side!=='player'||!def||def.hp<=0)return;for(const r of run.relics){if(r.onHitInflict&&rand100()<r.onHitInflict.chance)applyStatus(def,r.onHitInflict.kind);}}

// 战后(精英/Boss)三选一奖励;无可选则直接继续
// 协同加权抽取:已拥有某流派越多,越易刷到该流派(滚雪球成套)
function _archCnt(){const c={};(run.relics||[]).forEach(r=>{if(r.arch)c[r.arch]=(c[r.arch]||0)+1;});return c;}
function draftRelics(pool,n){const c=_archCnt();const w=r=>1+2*((r.arch&&c[r.arch])||0);const out=[];const p=pool.slice();
  for(let i=0;i<n&&p.length;i++){let tot=0;p.forEach(r=>tot+=w(r));let x=Math.random()*tot,idx=0;for(let j=0;j<p.length;j++){x-=w(p[j]);if(x<=0){idx=j;break;}}out.push(p.splice(idx,1)[0]);}return out;}
function offerRelic(cont){
  const owned=new Set(run.relics.map(r=>r.id));
  const pool=RELICS.filter(r=>!owned.has(r.id));
  if(!pool.length){cont();return;}
  const pick=draftRelics(pool,3);
  const box=document.getElementById('relicChoices');box.innerHTML='';
  pick.forEach(r=>{const b=document.createElement('button');b.className='btn ghost';b.style.cssText='display:flex;flex-direction:column;align-items:flex-start;text-align:left;max-width:220px';
    b.innerHTML=`<span style="font-size:15px">${r.icon} ${r.name}</span><small style="font-weight:400;color:#ccd">${r.desc}</small>`;
    b.onclick=()=>{run.relics.push(r);log(`获得遗物 ${r.icon} <b>${r.name}</b>`,'#ffd95a');show('relicModal',false);cont();};
    box.appendChild(b);});
  show('relicModal',true);if(autoOn)setTimeout(autoRelic,900);}
function _learnable(m){const base=(typeof DRAFT_POOL!=='undefined'?(DRAFT_POOL[m.key]||DRAFT_POOL[m.type]||[]):[]);const uni=(typeof UNIVERSAL_DRAFT!=='undefined')?UNIVERSAL_DRAFT:[];return base.concat(uni).filter((v,i,a)=>a.indexOf(v)===i&&SKILLS[v]);}
function _draftOpts(){const pool=run.pool||[];const out=[];
  pool.forEach(m=>{if(m.hero)return;if(m.skills.length<4)_learnable(m).forEach(k=>{if(!m.skills.includes(k))out.push({kind:'learn',mon:m,sk:k});});});
  pool.forEach(m=>{if(m.hero)return;m.skills.forEach(k=>{const s=SKILLS[k];if(s&&(s.kind==='atk'||s.kind==='aoe')&&((m.skillUp&&m.skillUp[k])||0)<3)out.push({kind:'up',mon:m,sk:k});});});
  return out;}
function battleDraft(node,cont){
  const owned=new Set(run.relics.map(r=>r.id));const relicPool=RELICS.filter(r=>!owned.has(r.id));
  const sopts=_draftOpts();for(let i=sopts.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[sopts[i],sopts[j]]=[sopts[j],sopts[i]];}
  const picks=[];const big=node&&(node.type==='elite'||node.type==='boss');
  if(relicPool.length&&(big||Math.random()<0.25))picks.push({t:'relic',r:draftRelics(relicPool,1)[0]});
  const seen={};for(const o of sopts){if(picks.length>=3)break;const k=o.kind+o.mon.uid+o.sk;if(seen[k])continue;seen[k]=1;picks.push({t:'skill',o});}
  while(picks.length<3&&relicPool.length){const r=draftRelics(relicPool.filter(x=>!picks.some(p=>p.r&&p.r.id===x.id)),1)[0];if(!r)break;picks.push({t:'relic',r});}
  if(!picks.length){cont();return;}
  const tt=document.getElementById('relicTitle');if(tt)tt.textContent='✦ 战利品 — 三选一';
  const sb=document.getElementById('relicSub');if(sb)sb.textContent='学新招 / 升招(伤害+20%/级,可叠+3) / 遗物 —— 每战推进流派。';
  const box=document.getElementById('relicChoices');box.innerHTML='';
  picks.forEach(p=>{const b=document.createElement('button');b.className='btn ghost';b.style.cssText='display:flex;flex-direction:column;align-items:flex-start;text-align:left;max-width:240px';
    let title,desc;
    if(p.t==='relic'){title=(p.r.curse?'⚠ ':'')+p.r.icon+' '+p.r.name;desc=(p.r.curse?'【诅咒】':'')+p.r.desc;}
    else if(p.o.kind==='learn'){const s=SKILLS[p.o.sk];title='📖 '+p.o.mon.name+' 学【'+s.name+'】';desc=s.desc;}
    else{const s=SKILLS[p.o.sk];const cur=(p.o.mon.skillUp&&p.o.mon.skillUp[p.o.sk])||0;title='⬆ '+p.o.mon.name+'【'+s.name+'】 +'+cur+'→+'+(cur+1);desc='该招伤害 +20%(当前流派越投越深)';}
    b.innerHTML='<span style="font-size:14px">'+title+'</span><small style="font-weight:400;color:#ccd">'+desc+'</small>';
    b.onclick=()=>{
      if(p.t==='relic'){run.relics.push(p.r);log('获得遗物 '+p.r.icon+' <b>'+p.r.name+'</b>','#ffd95a');if(typeof renderRelicBar==='function')renderRelicBar();}
      else if(p.o.kind==='learn'){p.o.mon.skills.push(p.o.sk);log('✦ '+p.o.mon.name+' 学会【'+SKILLS[p.o.sk].name+'】','#c78bff');}
      else{p.o.mon.skillUp=p.o.mon.skillUp||{};p.o.mon.skillUp[p.o.sk]=(p.o.mon.skillUp[p.o.sk]||0)+1;log('⬆ '+p.o.mon.name+'【'+SKILLS[p.o.sk].name+'】升到 +'+p.o.mon.skillUp[p.o.sk],'#ffd95a');}
      show('relicModal',false);cont();};
    box.appendChild(b);});
  show('relicModal',true);if(typeof autoOn!=='undefined'&&autoOn)setTimeout(autoRelic,900);}
function renderRelicBar(){const el=document.getElementById('relicBar');if(!el)return;
  el.innerHTML='<span style="color:#ffd95a;margin-right:8px">💰 '+((typeof run!=='undefined'&&run.gold)||0)+'</span>'+(run.relics.length?run.relics.map(r=>`<span title="${r.name}：${r.desc}" style="font-size:22px;cursor:help">${r.icon}</span>`).join(' '):'<span class="small">(暂无遗物；打精英☠/Boss👑 可三选一获得)</span>');}
