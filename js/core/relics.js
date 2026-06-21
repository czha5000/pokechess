// 遗物钩子:遍历 run.relics 聚合效果,并提供奖励选择/展示
function hasRelic(id){return run.relics&&run.relics.some(r=>r.id===id);}
function relicDmgMult(att,sk,def){let m=1;if(att.side==='player')for(const r of run.relics){if(r.dmgMult)m*=r.dmgMult(att,sk,def);}return m;}
function relicHitAdd(att,sk){let a=0;if(att.side==='player')for(const r of run.relics){if(r.hitAdd)a+=r.hitAdd(att,sk);}return a;}
function relicCapAdd(){let a=0;for(const r of run.relics){if(r.capAdd)a+=r.capAdd;}return a;}
function relicExpMult(){let m=1;for(const r of run.relics){if(r.expMult)m*=r.expMult;}return m;}
// 应用遗物开战属性,并记录增量 _rb(战后同步时扣除,避免遗物加成被复利累积进牌库)
function applyRelicStats(u){u._rb={atk:0,def:0,spd:0,maxhp:0,lck:0};for(const r of run.relics){if(r.statMod){const b={atk:u.atk,def:u.def,spd:u.spd,maxhp:u.maxhp,lck:u.lck};r.statMod(u);u._rb.atk+=u.atk-b.atk;u._rb.def+=u.def-b.def;u._rb.spd+=u.spd-b.spd;u._rb.maxhp+=u.maxhp-b.maxhp;u._rb.lck+=u.lck-b.lck;}}}
function relicOnKill(att){if(att.side!=='player')return;for(const r of run.relics){if(r.onKill)r.onKill(att);}}
function relicThorns(){let t=0;for(const r of run.relics){if(r.thorns)t+=r.thorns;}return t;}
function relicShieldRegen(){let v=0;for(const r of run.relics){if(r.shieldRegen)v+=r.shieldRegen;}return v;}
function relicReviveAvailable(){return run.relics.some(r=>r.revive)&&!run.reviveUsed;}
function relicCritAdd(att){let a=0;if(att.side==='player')for(const r of run.relics){if(r.critAdd)a+=(typeof r.critAdd==='function'?r.critAdd():r.critAdd);}return a;}
function relicDmgTaken(def){let m=1;if(def&&def.side==='player')for(const r of run.relics){if(r.dmgTakenMult)m*=r.dmgTakenMult;}return m;}
function relicOnHit(att,def){if(att.side!=='player'||!def||def.hp<=0)return;for(const r of run.relics){if(r.onHitInflict&&rand100()<r.onHitInflict.chance)applyStatus(def,r.onHitInflict.kind);}}

// 战后(精英/Boss)三选一奖励;无可选则直接继续
function offerRelic(cont){
  const owned=new Set(run.relics.map(r=>r.id));
  const pool=RELICS.filter(r=>!owned.has(r.id));
  if(!pool.length){cont();return;}
  const tmp=pool.slice(),pick=[];for(let i=0;i<3&&tmp.length;i++){pick.push(tmp.splice(Math.random()*tmp.length|0,1)[0]);}
  const box=document.getElementById('relicChoices');box.innerHTML='';
  pick.forEach(r=>{const b=document.createElement('button');b.className='btn ghost';b.style.cssText='display:flex;flex-direction:column;align-items:flex-start;text-align:left;max-width:220px';
    b.innerHTML=`<span style="font-size:15px">${r.icon} ${r.name}</span><small style="font-weight:400;color:#ccd">${r.desc}</small>`;
    b.onclick=()=>{run.relics.push(r);log(`获得遗物 ${r.icon} <b>${r.name}</b>`,'#ffd95a');show('relicModal',false);cont();};
    box.appendChild(b);});
  show('relicModal',true);if(autoOn)setTimeout(autoRelic,900);}
function renderRelicBar(){const el=document.getElementById('relicBar');if(!el)return;
  el.innerHTML='<span style="color:#ffd95a;margin-right:8px">💰 '+((typeof run!=='undefined'&&run.gold)||0)+'</span>'+(run.relics.length?run.relics.map(r=>`<span title="${r.name}：${r.desc}" style="font-size:22px;cursor:help">${r.icon}</span>`).join(' '):'<span class="small">(暂无遗物；打精英☠/Boss👑 可三选一获得)</span>');}
