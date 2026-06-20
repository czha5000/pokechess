// 部署界面:自选3 + 随机补满,确认开战
function startDeploy(n){pendingNode=n;picks=[];snapshotForRetry();pendingEnemies=spawnEnemies(n);
  document.getElementById('deployTitle').textContent=(n.type==='boss'?'👑 BOSS战 部署':n.type==='elite'?'☠ 精英战 部署':'⚔ 部署出战')+'(自选3)';
  const enemyList=pendingEnemies.map(e=>`${e.em}${e.name}(<span style="color:${TCOLOR[e.type]}">${TYPE_CN[e.type]}</span>${e.elite?'★':''})`).join('、');
  document.getElementById('deploySub').innerHTML=`精灵池 ${run.pool.length} 只，自选 ${Math.min(3,run.pool.length)} + 随机补至 5（池越大随机越不稳定）。<br><b>战场敌人：</b>${enemyList}<br><span class="small">下方迷你战场可预览布点与地形，据此选克制阵容。</span>`;
  renderPreview();renderPicks();show('mapScreen',false);show('deploy',true);if(autoOn)setTimeout(autoDeploy,900);}
function renderPicks(){const pa=document.getElementById('pickArea');pa.innerHTML='';const cap=Math.min(3,run.pool.length);
  run.pool.forEach((p,i)=>{const on=picks.includes(i),el=document.createElement('div');el.className='card'+(on?' on':'');
    el.innerHTML=`<img src="${SPRITE(p.pid)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'${p.em}',style:'font-size:42px'}))">
      <div class="nm">${p.name} <span class="pill" style="background:${TCOLOR[p.type]}">${TYPE_CN[p.type]}</span>${p.hero?' 👑':''}</div>
      <div class="st">L${p.lv}·HP${p.maxhp}·攻${p.atk}<br>速${p.spd}·射程${p.rng}</div>`;
    el.onclick=()=>{const k=picks.indexOf(i);if(k>=0)picks.splice(k,1);else{if(picks.length>=cap)return;picks.push(i);}
      renderPicks();const b=document.getElementById('confirmDeploy');b.disabled=picks.length!==cap;b.textContent=`已选 ${picks.length}/${cap} — 随机补充并开战 ▶`;};
    pa.appendChild(el);});
  const b=document.getElementById('confirmDeploy');b.disabled=picks.length!==cap;b.textContent=`已选 ${picks.length}/${cap} — 随机补充并开战 ▶`;}
function confirmDeploy(){
  const rest=run.pool.map((_,i)=>i).filter(i=>!picks.includes(i));
  for(let i=rest.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[rest[i],rest[j]]=[rest[j],rest[i]];}
  const need=Math.min(5-picks.length,rest.length);const rnd=rest.slice(0,need);
  deployList=[...picks,...rnd].map(i=>run.pool[i]);
  show('deploy',false);startBattle(pendingNode);}
