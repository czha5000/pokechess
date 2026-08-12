// 棋盘渲染、战斗动画、范围计算、格子点击与选择
function render(){boardEl.style.gridTemplateColumns=`repeat(${COLS},50px)`;boardEl.innerHTML='';
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const c=document.createElement('div'),t=TERRAIN[y][x];
    c.className='cell '+(t===1?'water':t===2?'forest':t===3?'lava':t===4?'high':'plain');c.dataset.x=x;c.dataset.y=y;
    const h=highlights.find(m=>m.x===x&&m.y===y);if(h)c.classList.add(h.kind);
    if(h&&h.zoc>0){const z=document.createElement('div');z.textContent='⚔';z.title='走到这里会被 '+h.zoc+' 个敌人借机攻击';
      z.style.cssText='position:absolute;top:0;right:1px;font-size:11px;color:#ffb24d;pointer-events:none;z-index:2;text-shadow:0 0 3px #000';
      c.style.position='relative';c.appendChild(z);}
    if(selected&&selected.x===x&&selected.y===y)c.classList.add('sel');
    {const _act=(typeof initiative!=='undefined'&&initiative)?initiative[iPtr]:null;if(_act&&_act.hp>0&&_act.x===x&&_act.y===y&&(stage==='player'||stage==='enemy'))c.classList.add('acting');}
    if(pendingTgt&&pendingTgt.x===x&&pendingTgt.y===y)c.classList.add('tgt');
    if(typeof run!=='undefined'&&run.obj==='reach'&&run.objX===x&&run.objY===y){c.style.position='relative';const gs=document.createElement('div');gs.textContent='🏁';gs.style.cssText='position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;pointer-events:none;z-index:1;opacity:.85';c.appendChild(gs);}
    const u=unitAt(x,y);
    if(u){const w=document.createElement('div');w.className='tokenwrap '+(u.side==='player'?'side-ally':'side-enemy')+(u.acted&&u.side==='player'?' acted':'');
      const eff=u.eff?Object.keys(u.eff).filter(k=>STATUS[k]&&u.eff[k]>0).map(k=>`<span title="${STATUS[k].name}(${u.eff[k]}回合)">${STATUS[k].icon}</span>`).join(''):'';
      w.innerHTML=`<div class="flag">${u.side==='player'?'我':'敌'}</div><div class="lvb">L${u.lv}</div>${u.shield>0?'<div class="shb" style="position:absolute;top:-5px;right:-3px;font-size:10px;background:#1c3b5a;color:#9fd3ff;border-radius:6px;padding:0 3px;z-index:3">🛡'+u.shield+'</div>':''}
        ${eff?`<div class="seff" style="position:absolute;top:-5px;left:-3px;font-size:11px;line-height:1;text-shadow:0 0 2px #000;z-index:3">${eff}</div>`:''}
        <div class="token" style="background:${TCOLOR[u.type]}55"><img src="${SPRITE(u.pid)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${u.em}'}))"></div>
        <div class="hpbar"><div class="hpfill" style="width:${100*u.hp/u.maxhp}%;${u.hp/u.maxhp<.35?'background:#e0703f':''}"></div></div>`;c.appendChild(w);}
    c.onclick=()=>onCell(x,y);boardEl.appendChild(c);}renderOrderBar();}
// 行动顺序条:按速度排序的本回合队列,高亮当前、淡化已行动
function renderOrderBar(){const el=document.getElementById('orderBar');if(!el)return;
  if((stage!=='player'&&stage!=='enemy')||!initiative.length){el.innerHTML='';return;}
  const order=initiative.filter(u=>u&&u.hp>0);
  el.innerHTML='<span class="small" style="align-self:center;margin-right:2px">行动顺序▶</span>'+order.map(u=>{
    const cur=u===initiative[iPtr];const cls='ochip '+(u.side==='player'?'ally':'enemy')+(cur?' cur':'')+(u.acted&&!cur?' done':'');
    return `<div class="${cls}" title="${u.name} 速度${u.spd}"><img src="${SPRITE(u.pid)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${u.em}'}))"><span>${u.name.slice(0,4)}<b>${u.spd}</b></span></div>`;
  }).join('');}
// 战前预览:迷你战场(地形 + 敌人布点 + 我方出战格),供排兵布阵
function renderPreview(){const el=document.getElementById('previewBoard');if(!el)return;
  const starts=new Set(PSTART.slice(0,5).map(p=>p[0]+','+p[1]));
  let h=`<div style="display:grid;grid-template-columns:repeat(${COLS},22px);gap:1px">`;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const t=TERRAIN[y][x];
    const e=pendingEnemies.find(u=>u.x===x&&u.y===y);
    const bg=t===1?'#244a78':t===2?'#2f5d3a':t===3?'#8a2e12':t===4?'#8a6b34':'#39425f';
    let inner='';
    if(e)inner=`<span style="font-size:13px" title="${e.name} ${TYPE_CN[e.type]}${e.elite?' ★':''}">${e.em}</span>`;
    else if(starts.has(x+','+y))inner='<span style="color:#43c6ff;font-size:11px;font-weight:800">我</span>';
    h+=`<div style="width:22px;height:22px;border-radius:3px;background:${bg};display:flex;align-items:center;justify-content:center;${e?'box-shadow:0 0 0 2px #ff5252 inset':''}">${inner}</div>`;}
  h+='</div>';el.innerHTML=h;}
function floatText(x,y,txt,color){const c=cellEl(x,y);if(!c)return;const f=document.createElement('div');f.className='float';f.textContent=txt;f.style.color=color||'#fff';c.appendChild(f);setTimeout(()=>f.remove(),1000);}
function burst(x,y,color){const c=cellEl(x,y);if(!c)return;const b=document.createElement('div');b.className='burst';b.style.background=color;c.appendChild(b);setTimeout(()=>b.remove(),520);}
function flashCell(x,y){const c=cellEl(x,y);if(!c)return;const w=c.querySelector('.tokenwrap');if(w){w.classList.add('hit');setTimeout(()=>w.classList.remove('hit'),360);}}
function setHp(u){const c=cellEl(u.x,u.y);if(!c)return;const f=c.querySelector('.hpfill');if(f){f.style.width=(100*Math.max(0,u.hp)/u.maxhp)+'%';if(u.hp/u.maxhp<.35)f.style.background='#e0703f';}}
// 名册/休整界面的迷你血条(显示跨战保留的当前血量)
function hpMini(m){const cur=(m.curHp!=null?m.curHp:m.maxhp),pct=Math.max(0,100*cur/m.maxhp),col=pct<35?'#e0703f':pct<70?'#e8c33a':'#4ade80';return `<div style="width:46px;height:5px;background:#222;border-radius:3px;margin:3px auto 1px"><div style="width:${pct}%;height:100%;background:${col};border-radius:3px"></div></div><span style="font-size:10px;color:#9aa6c8">${cur}/${m.maxhp}</span>`;}
async function lunge(att,tx,ty){const c=cellEl(att.x,att.y);if(!c)return;const w=c.querySelector('.tokenwrap');if(!w)return;const dx=Math.sign(tx-att.x)*16,dy=Math.sign(ty-att.y)*16;w.style.transform=`translate(${dx}px,${dy}px)`;await delay(120);w.style.transform='';}

function moveBFS(u){const seen={[u.x+','+u.y]:0},q=[{x:u.x,y:u.y,d:0}],out=[];
  while(q.length){const c=q.shift();out.push({x:c.x,y:c.y});for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=c.x+dx,ny=c.y+dy;
    if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;if(TERRAIN[ny][nx]===1)continue;if(unitAt(nx,ny))continue;const nd=c.d+1;if(nd>u.mov)continue;if(seen[nx+','+ny]!==undefined)continue;seen[nx+','+ny]=nd;q.push({x:nx,y:ny,d:nd});}}return out;}
function threatFrom(mv,reach){const set={};mv.forEach(m=>{for(let dx=-reach;dx<=reach;dx++)for(let dy=-reach;dy<=reach;dy++){if(Math.abs(dx)+Math.abs(dy)>reach||(dx===0&&dy===0))continue;const x=m.x+dx,y=m.y+dy;if(x<0||y<0||x>=COLS||y>=ROWS)continue;set[x+','+y]=1;}});return Object.keys(set).map(k=>{const[x,y]=k.split(',').map(Number);return{x,y};});}

function onCell(x,y){if(stage!=='player'||busy)return;const u=unitAt(x,y),h=highlights.find(m=>m.x===x&&m.y===y);
  if(selected&&pendingSkill&&h&&h.kind==='heal'){const _k=SKILLS[pendingSkill].kind;
    if(_k==='charge'){execCharge(selected);return;}
    if(_k==='swap'){const t=unitAt(x,y);if(t&&t!==selected)execSwap(selected,t);return;}
    execHeal(selected,pendingSkill,unitAt(x,y));return;}
  if(selected&&pendingSkill&&h&&h.kind==='atk'){showForecast(selected,pendingSkill,unitAt(x,y));return;}
  if(selected&&pendingSkill&&SKILLS[pendingSkill]&&SKILLS[pendingSkill].kind!=='heal'&&u&&u.side==='enemy'&&h&&h.kind==='oor'){floatText(x,y,'✗ 范围外','#ff5252');flashCell(x,y);log('⚠ <b>'+u.name+'</b> 在攻击范围外——先移动靠近,或换射程更远的技能。','#ff9a9a');return;}
  if(u&&u===initiative[iPtr]&&u.side==='player'){selectUnit(u);return;}
  if(u&&u.side==='enemy'){showEnemyRange(u);return;}
  if(selected&&h&&h.kind==='move'){doMove(selected,x,y);return;}}
function selectUnit(u){if(typeof sfxSelect==='function'&&selected!==u)sfxSelect();selected=u;if(!u.moved){u._homeX=u.x;u._homeY=u.y;}pendingSkill=null;pendingTgt=null;fcEl.innerHTML='';showOwnRange(u);showInfo(u);renderSkills(u);renderActs(u);render();}
function showOwnRange(u){highlights=[];const mv=u.moved?[{x:u.x,y:u.y}]:moveBFS(u);
  if(!u.moved){const prov=(typeof zocProvokers==='function');
    mv.forEach(m=>highlights.push({x:m.x,y:m.y,kind:'move',zoc:prov?zocProvokers(u,u.x,u.y,m.x,m.y).length:0}));}
  const ms=new Set(mv.map(m=>m.x+','+m.y));threatFrom(mv,reachOf(u)).forEach(t=>{if(!ms.has(t.x+','+t.y))highlights.push({x:t.x,y:t.y,kind:'threat'});});}
function showEnemyRange(e){selected=null;pendingSkill=null;pendingTgt=null;fcEl.innerHTML='';document.getElementById('skillRow').innerHTML='';document.getElementById('actRow').innerHTML='';
  highlights=[];const mv=moveBFS(e);mv.forEach(m=>highlights.push({x:m.x,y:m.y,kind:'foemove'}));const ms=new Set(mv.map(m=>m.x+','+m.y));threatFrom(mv,reachOf(e)).forEach(t=>{if(!ms.has(t.x+','+t.y))highlights.push({x:t.x,y:t.y,kind:'foe'});});showInfoEnemy(e);render();}
function doMove(u,x,y){if(typeof sfxMove==='function')sfxMove();
  const ox=u.x,oy=u.y;
  const finish=async()=>{busy=false;u.x=x;u.y=y;u.moved=true;
    // 借机攻击:脱离敌方邻格要挨打(移动前已在范围高亮里用 ⚔ 标出)
    if(typeof zocProvoke==='function'){const hit=await zocProvoke(u,ox,oy,x,y);
      if(hit){u._noUndo=true;render();if(u.hp<=0){clearSel();advanceInit();return;}}}
    if(typeof run!=='undefined'&&run.obj==='reach'&&run.objX!=null&&u.x===run.objX&&u.y===run.objY){render();log('🏁 抵达目标格——任务达成!','#7fe0a0');if(typeof winBattle==='function')winBattle();return;}showOwnRange(u);showInfo(u);renderSkills(u);renderActs(u);render();};
  const src=cellEl(u.x,u.y),dst=cellEl(x,y),w=src&&src.querySelector('.tokenwrap');
  if(w&&dst&&!(typeof autoOn!=='undefined'&&autoOn)){const a=src.getBoundingClientRect(),b=dst.getBoundingClientRect();const ms=Math.max(80,Math.round(190/(typeof SPEED!=='undefined'?SPEED:1)));busy=true;w.style.zIndex='5';w.style.transition='transform '+ms+'ms ease';w.style.transform='translate('+(b.left-a.left)+'px,'+(b.top-a.top)+'px)';setTimeout(finish,ms+10);}else finish();}
function undoMove(u){if(!u||!u.moved)return;u.x=(u._homeX!=null?u._homeX:u.x);u.y=(u._homeY!=null?u._homeY:u.y);u.moved=false;selectUnit(u);}
if(typeof boardEl!=='undefined'&&boardEl)boardEl.addEventListener('contextmenu',e=>{e.preventDefault();if(stage==='player'&&!busy&&selected&&selected===initiative[iPtr]&&selected.moved)undoMove(selected);});
function clearSel(){selected=null;pendingSkill=null;pendingTgt=null;highlights=[];fcEl.innerHTML='';document.getElementById('skillRow').innerHTML='';document.getElementById('actRow').innerHTML='';}
