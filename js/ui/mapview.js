// 章节地图渲染:节点定位、连线、节点按钮、精灵池一览
function nodePos(n){const W=document.getElementById('mapwrap').clientWidth||760;const cols=run.depth;
  const x=40+n.c*((W-80)/(cols-1));const col=run.map[n.c];const cnt=col.length;
  const y=cnt===1?180:50+n.r*((260)/(cnt-1));return{x,y};}
function showMap(){stage='map';document.getElementById('turnBadge').textContent=CH_NAME[run.chapter];show('mapScreen',true);
  const mh=document.querySelector('#mapScreen h2');if(mh)mh.textContent='🗺 '+CH_NAME[run.chapter];
  document.getElementById('info').innerHTML='在地图选择下一个节点。';clearSel();render();
  const reach=reachableIds();const svg=document.getElementById('mapSvg');
  let lines='';run.map.forEach(col=>col.forEach(n=>{const p=nodePos(n);n.edges.forEach(eid=>{const tp=nodePos(nodeById(eid));lines+=`<line x1="${p.x}" y1="${p.y}" x2="${tp.x}" y2="${tp.y}" stroke="#3a4360" stroke-width="3"/>`;});}));
  svg.innerHTML=lines;
  const wrap=document.getElementById('mapwrap');[...wrap.querySelectorAll('.mnode')].forEach(e=>e.remove());
  run.map.forEach(col=>col.forEach(n=>{const p=nodePos(n);const el=document.createElement('div');
    const isReach=reach.includes(n.id)&&!n.done;el.className='mnode'+(isReach?' reach':'')+(n.done?' done':'')+(run.cur===n.id?' cur':'');
    el.style.left=p.x+'px';el.style.top=p.y+'px';el.innerHTML=`<div>${NICON[n.type]}</div><small>${NNAME[n.type]}</small>`;
    if(isReach)el.onclick=()=>enterNode(n);wrap.appendChild(el);}));
  renderRoster();renderRelicBar();autoSave();if(autoOn)setTimeout(autoPickNode,900);}
function renderRoster(){const r=document.getElementById('roster');r.innerHTML='';
  run.pool.forEach(m=>{const d=document.createElement('div');d.className='rmon';
    d.innerHTML=`<img src="${SPRITE(m.pid)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'${m.em}',style:'font-size:34px'}))"><br>${m.name}<br><span class="pill" style="background:${TCOLOR[m.type]}">${TYPE_CN[m.type]}</span> L${m.lv}${hpMini(m)}`;r.appendChild(d);});
  document.getElementById('poolCount').textContent=`(${run.pool.length} 只${run.pool.length>6?' · 偏大,随机位更不稳定':''})`;}
