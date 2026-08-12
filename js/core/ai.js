// 敌方 AI:选最优招/目标、移动寻路
function _featOn(k){return (typeof FEATURES!=='undefined')&&!!FEATURES[k];}
function bestDmgVs(e,t){let bd=0;e.skills.forEach(k=>{const s=SKILLS[k];if(!s||(s.kind!=='atk'&&s.kind!=='aoe'))return;const b=baseDmg(e,t,s);if(b.d>bd)bd=b.d;});return bd;}
// A1 集火协议:找"本回合未行动敌人合力足以击杀"的我方单位(选 血量/合力 比最小者)。威胁区 UI 已画给玩家,恶意公平。
function aiPickFocus(e){const foes=units.filter(x=>x.side==='enemy'&&x.hp>0);let best=null,bs=1e9;
  units.filter(t=>t.side==='player'&&t.hp>0).forEach(t=>{
    let pot=0;foes.forEach(en=>{if(en.acted&&en!==e)return;if(Math.abs(en.x-t.x)+Math.abs(en.y-t.y)<=en.mov+reachOf(en))pot+=bestDmgVs(en,t);});
    if(pot>=t.hp&&t.hp/pot<bs){bs=t.hp/pot;best=t;}});
  return best;}
function aiScore(e,tgt){let best=-1;e.skills.forEach(k=>{const s=SKILLS[k];if(s.kind!=='atk'&&s.kind!=='aoe')return;const v=typeMult(s.type,tgt.type)*s.mult;if(v>best)best=v;});return best;}
function aiPick(e,tgt){let best='basic',bv=-1;e.skills.forEach(k=>{const s=SKILLS[k];if(s.kind!=='atk'&&s.kind!=='aoe')return;const v=typeMult(s.type,tgt.type)*s.mult;if(v>bv){bv=v;best=k;}});return best;}
async function aiAct(e){if(e.mech==='enrage'&&!e._enraged&&e.hp/e.maxhp<0.5){e.atk=Math.round(e.atk*1.5);e._enraged=true;log(`⚠ ${e.name} 暴怒！攻击大涨`,'#ff8a8a');floatText(e.x,e.y,'暴怒!','#ff5252');}if(e.bossShield){addShield(e,e.bossShield);floatText(e.x,e.y,'+'+e.bossShield+'🛡','#9fd3ff');}if(e.skills.includes('heal')){const hurt=units.filter(a=>a.side==='enemy'&&a.hp>0&&a!==e&&a.hp<a.maxhp*0.6).sort((a,b)=>(a.hp/a.maxhp)-(b.hp/b.maxhp))[0];if(hurt){if(Math.abs(e.x-hurt.x)+Math.abs(e.y-hurt.y)>1){const p=bfsToward(e,hurt);if(p){const _ox=e.x,_oy=e.y;e.x=p.x;e.y=p.y;render();await delay(140);if(typeof zocProvoke==='function'){await zocProvoke(e,_ox,_oy,p.x,p.y);if(e.hp<=0){killUnit(e);return;}}}}if(Math.abs(e.x-hurt.x)+Math.abs(e.y-hurt.y)<=1){const amt=SKILLS.heal.amount;hurt.hp=Math.min(hurt.maxhp,hurt.hp+amt);floatText(hurt.x,hurt.y,'+'+amt,'#6affa0');burst(hurt.x,hurt.y,'#6affa0');if(typeof vfxHeal==='function')vfxHeal(hurt.x,hurt.y);log(`${e.name} 治疗 ${hurt.name} +${amt}`,'#6affa0');setHp(hurt);}return;}}
  let ts=units.filter(u=>u.side==='player'&&u.hp>0);if(!ts.length)return;const hit=ts.filter(t=>aiScore(e,t)>0);if(hit.length)ts=hit;
  // A2 猎杀carry:同克制档下优先高价值目标(等级/攻),其次残血
  ts.sort((a,b)=>{const ma=aiScore(e,a),mb=aiScore(e,b);if(mb!==ma)return mb-ma;if(_featOn('huntCarry')){const va=(b.lv*2+b.atk*0.5)-(a.lv*2+a.atk*0.5);if(va)return va;}return a.hp-b.hp;});
  let tgt=ts[0];
  if(_featOn('focusFire')){const f=aiPickFocus(e);if(f&&Math.abs(e.x-f.x)+Math.abs(e.y-f.y)<=e.mov+reachOf(e)){tgt=f;floatText(f.x,f.y,'⚠集火!','#ff5252');}}
  const sk=aiPick(e,tgt),s=SKILLS[sk],reach=e.rng+(s.rb||0);
  floatText(tgt.x,tgt.y,'⚠','#ff5252');if(typeof flashCell==='function')flashCell(tgt.x,tgt.y);await delay(170);
  if(Math.abs(e.x-tgt.x)+Math.abs(e.y-tgt.y)>reach){const p=bfsToward(e,tgt);if(p){const _ox=e.x,_oy=e.y;e.x=p.x;e.y=p.y;render();await delay(140);
    if(typeof zocProvoke==='function'){await zocProvoke(e,_ox,_oy,p.x,p.y);if(e.hp<=0){killUnit(e);return;}}}}
  if(Math.abs(e.x-tgt.x)+Math.abs(e.y-tgt.y)<=reach){await strike(e,sk,tgt);if(tgt.hp<=0)killUnit(tgt);
    else{const dd=Math.abs(e.x-tgt.x)+Math.abs(e.y-tgt.y);
      const _fl=(typeof FLANK_NOCOUNTER!=='undefined'&&FLANK_NOCOUNTER)&&isFlankedSide(e,tgt);
      if(!_fl&&dd<=tgt.rng&&e.hp>0&&!(tgt.eff&&tgt.eff.para)){const back=await strike(tgt,'basic',e);if(e.hp<=0){killUnit(e);gainExp(tgt,expGain(tgt,e,true));}else if(back>0)gainExp(tgt,Math.round(expGain(tgt,e,false)*0.6));}}}}
function bfsToward(e,tgt){const seen={[e.x+','+e.y]:0},q=[{x:e.x,y:e.y,d:0}];
  while(q.length){const c=q.shift();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=c.x+dx,ny=c.y+dy,k=nx+','+ny;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;if(TERRAIN[ny][nx]===1)continue;if(unitAt(nx,ny))continue;if(seen[k]!==undefined)continue;const nd=c.d+1;if(nd>e.mov)continue;seen[k]=nd;q.push({x:nx,y:ny,d:nd});}}
  let bk=null,bd=1e9;for(const k in seen){const[x,y]=k.split(',').map(Number);if(x===e.x&&y===e.y)continue;
    let dd=Math.abs(x-tgt.x)+Math.abs(y-tgt.y);
    // 敌方也懂借机攻击:脱离我方邻格是有代价的(否则 ZOC 变成玩家的单向白嫖)
    if(typeof zocProvokers==='function')dd+=zocProvokers(e,e.x,e.y,x,y).length*3;
    if(dd<bd){bd=dd;bk=k;}}
  if(!bk)return null;const[bx,by]=bk.split(',').map(Number);return{x:bx,y:by};}
