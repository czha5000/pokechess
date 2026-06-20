// 侧栏:单位信息、技能栏、行动按钮、伊布进化、战斗预测面板
function renderSkills(u){const row=document.getElementById('skillRow');row.innerHTML='';
  u.skills.forEach(sk=>{const s=SKILLS[sk];const b=document.createElement('button');b.className='btn skbtn'+(pendingSkill===sk?' on':'');
    b.innerHTML=`<span><span class="tdot" style="background:${s.type?TCOLOR[s.type]:'#bbb'}"></span>${s.name}</span><small>${s.desc}</small>`;
    b.onclick=()=>{pendingSkill=sk;pendingTgt=null;fcEl.innerHTML='';highlightTargets(u,sk);renderSkills(u);render();};row.appendChild(b);});}
function highlightTargets(u,sk){const s=SKILLS[sk];highlights=[];
  if(s.kind==='heal'){units.filter(a=>a.side==='player'&&a.hp>0&&Math.abs(a.x-u.x)+Math.abs(a.y-u.y)<=1).forEach(a=>highlights.push({x:a.x,y:a.y,kind:'heal'}));}
  else{const reach=u.rng+(s.rb||0);units.filter(e=>e.side==='enemy'&&e.hp>0&&Math.abs(e.x-u.x)+Math.abs(e.y-u.y)<=reach).forEach(e=>highlights.push({x:e.x,y:e.y,kind:'atk'}));}}
function renderActs(u){const row=document.getElementById('actRow');row.innerHTML='';
  if(u.hero&&!u.transformed&&!u.acted){['fire','water','electric'].forEach(f=>{const F=EEVEE_FORMS[f];const b=document.createElement('button');b.className='btn evo';b.textContent=`进化→${F.name}`;b.onclick=()=>transformEevee(u,f);row.appendChild(b);});}
  units.filter(e=>e.side==='enemy'&&e.hp>0&&Math.abs(e.x-u.x)+Math.abs(e.y-u.y)===1).forEach(e=>{const ch=capChance(u,e),b=document.createElement('button');b.className='btn';b.style.background='var(--accent)';b.textContent=`收服 ${e.name}(${Math.round(ch*100)}%)`;b.onclick=()=>doCapture(u,e);row.appendChild(b);});
  const w=document.createElement('button');w.className='btn ghost';w.textContent='待机(结束该单位)';w.onclick=()=>{u.acted=true;clearSel();render();advanceInit();};row.appendChild(w);}
function transformEevee(u,f){const F=EEVEE_FORMS[f];u.type=F.el;u.pid=F.pid;u.name=F.name;u.transformed=true;u.skills=LEARN[F.el].slice(0,Math.max(u.lv,2));
  log(`✦ 伊布进化成 <b>${F.name}</b>(${TYPE_CN[F.el]})（战后变回）`,'#c78bff');burst(u.x,u.y,'#c78bff');floatText(u.x,u.y,'进化!','#c78bff');showInfo(u);renderSkills(u);renderActs(u);render();}
function showInfo(u){const atMax=u.lv>=MAXLV,need=THRESH[u.lv]||0,rem=atMax?0:Math.max(0,need-u.exp);
  const evoHint=(!u.hero&&EVO[u.key||u.type])?(()=>{const line=EVO[u.key||u.type];const next=(u.stage||0)+1;const req=STAGE_LV[next];return (req&&line[next])?`　下次进化：Lv.${req}`:'已最终进化';})():'';
  document.getElementById('info').innerHTML=`<b>${u.name}</b> <span class="pill" style="background:${TCOLOR[u.type]}">${TYPE_CN[u.type]}</span> Lv.${u.lv}${u.hero?' ·主角':''}<br>HP ${Math.max(0,u.hp)}/${u.maxhp}　攻 ${u.atk}　防 ${u.def}<br>速 ${u.spd}　技 ${u.skl}　幸 ${u.lck}　移 ${u.mov}　射程 ${u.rng}
    <div class="expbar" style="position:relative;height:14px"><div class="expfill" style="width:${atMax?100:100*u.exp/need}%"></div><span style="position:absolute;inset:0;text-align:center;font-size:10px;font-weight:700;color:#fff;line-height:14px;text-shadow:0 1px 2px #000">${atMax?'满级 MAX':`EXP ${u.exp}/${need}（距升级 ${rem}）`}</span></div>
    <span class="small">已学：${u.skills.map(s=>SKILLS[s].name).join('、')}${evoHint}</span>`;}
function showInfoEnemy(e){document.getElementById('info').innerHTML=`<b style="color:#ff9a9a">${e.name}</b> <span class="pill" style="background:${TCOLOR[e.type]}">${TYPE_CN[e.type]}</span> ${e.elite?'★精英':''}<br>HP ${e.hp}/${e.maxhp}　攻 ${e.atk}　防 ${e.def}<br>速 ${e.spd}　技 ${e.skl}　幸 ${e.lck}　移 ${e.mov}　射程 ${e.rng}<br>招数：${e.skills.map(s=>SKILLS[s].name).join('、')}<br><span class="small">橙虚线=可移动 · 橙底=威胁范围。</span>`;}
function showForecast(att,sk,tgt){pendingTgt=tgt;const s=SKILLS[sk];const a=baseDmg(att,tgt,s),aHit=hitRate(att,tgt,s),aCrit=critRate(att,tgt,s),aDbl=doubles(att,tgt)&&s.kind!=='aoe';
  const aTotal=a.d*(aDbl?2:1),tgtAfter=Math.max(0,tgt.hp-aTotal);const dist=Math.abs(att.x-tgt.x)+Math.abs(att.y-tgt.y),canC=tgtAfter>0&&dist<=tgt.rng;
  let cHtml='<div class="fcrow"><span class="en">反击</span><span class="fcnums mut">射程外/已击倒，无反击</span></div>';
  if(canC){const cb=baseDmg(tgt,att,SKILLS.basic),cHit=hitRate(tgt,att,SKILLS.basic),cDbl=doubles(tgt,att),attAfter=Math.max(0,att.hp-cb.d*(cDbl?2:1));
    cHtml=`<div class="fcrow"><span class="en">↩ ${tgt.name} 反击(普攻)</span><span class="fcnums">${cb.m===0?'<b>无效</b>':'<b>'+cb.d+'</b>'+(cDbl?'<span class="x2">×2</span>':'')+'　命中 '+cHit+'%'}</span></div><div class="hpprev">${att.name} HP ${att.hp} → <b>${cb.m===0?att.hp:attAfter}</b></div>`;}
  const dmgShow=a.m===0?'无效':('<b>'+a.d+'</b>'+(aDbl?'<span class="x2">×2</span>':''));
  fcEl.innerHTML=`<div class="fc"><h4>⚔ 战斗预测</h4><div class="fcrow"><span class="me fcname">${att.name}【${s.name}】</span><span class="fcnums">${dmgShow}　${a.m===0?'':'命中 '+aHit+'% 暴击 '+aCrit+'%'}</span></div><div class="hpprev">${tgt.name} HP ${tgt.hp} → <b>${tgtAfter}</b>${tgtAfter===0&&a.m>0?' ☠':''}</div>${cHtml}<div class="fcform">${a.m===0?`普通系对 ${TYPE_CN[tgt.type]} <b>无效(免疫)</b>`:`伤害 = 攻${att.atk} × ${s.mult} × ${a.m} − 防${tgt.def}${coverOf(tgt)?` − ${coverOf(tgt)}(林)`:''} = <b>${a.d}</b>`}　[${mtag(a.m)}]</div></div>`;
  const row=document.getElementById('actRow');row.innerHTML='';if(a.m!==0){const go=document.createElement('button');go.className='btn go';go.textContent='确认攻击 ⚔';go.onclick=()=>execAttack(att,sk,tgt);row.appendChild(go);}
  const cancel=document.createElement('button');cancel.className='btn ghost';cancel.textContent='取消';cancel.onclick=()=>{pendingTgt=null;fcEl.innerHTML='';highlightTargets(att,sk);renderActs(att);render();};row.appendChild(cancel);render();}
