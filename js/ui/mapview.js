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
// 背包/携带道具管理(C1)
function showBag(){if(typeof run==='undefined'||!run.pool)return;run.bag=run.bag||[];let sel=null;
 let ov=document.getElementById('bagOv');if(!ov){ov=document.createElement('div');ov.id='bagOv';ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(8,8,16,.72);display:flex;align-items:center;justify-content:center;padding:16px';document.body.appendChild(ov);}
 ov.style.display='flex';
 function draw(){ov.innerHTML='';const p=document.createElement('div');p.style.cssText='max-width:680px;max-height:86vh;overflow:auto;background:#11162a;border:2px solid #3a4360;border-radius:14px;padding:16px 18px;color:#e8ecf4;font-size:13px';
  p.innerHTML='<h3 style="margin:.2em 0;color:#ffcf5a">🎒 队伍与携带道具</h3><div class="small">点精灵选中→点背包道具装备(原道具换回背包);点精灵身上的道具卸下。每只限1件。</div>';
  const ur=document.createElement('div');ur.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:10px 0';
  run.pool.forEach((m,i)=>{const it=m.item&&HELD_ITEMS[m.item];const d=document.createElement('div');d.style.cssText='border:2px solid '+(sel===i?'#ffcf5a':'#2e3650')+';border-radius:10px;padding:6px;width:92px;text-align:center;cursor:pointer;background:#0c1020';
    d.innerHTML='<img src="'+SPRITE(m.pid)+'" style="width:38px;height:38px;object-fit:contain" onerror="this.replaceWith(Object.assign(document.createElement(\'div\'),{textContent:\''+m.em+'\',style:\'font-size:28px\'}))"><br>'+m.name+' L'+m.lv+'<br><span style="font-size:18px" title="'+(it?it.name:'无道具')+'">'+(it?it.icon:'—')+'</span>';
    d.onclick=()=>{if(it){run.bag.push(m.item);m.item=null;draw();}else{sel=(sel===i?null:i);draw();}};ur.appendChild(d);});
  p.appendChild(ur);
  const bt=document.createElement('div');bt.innerHTML='<b>背包</b>'+(run.bag.length?'':' <span class="small">(空。商店🛒可买道具)</span>');p.appendChild(bt);
  const br=document.createElement('div');br.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:8px 0';
  run.bag.forEach((id,bi)=>{const it=HELD_ITEMS[id];if(!it)return;const b=document.createElement('button');b.className='btn ghost';b.style.cssText='text-align:left;max-width:210px';b.innerHTML=it.icon+' '+it.name+'<br><small style="color:#ccd">'+it.desc+'</small>';
    b.onclick=()=>{if(sel==null){log&&log('先点选一只精灵再装备。','#ff8a8a');return;}const u=run.pool[sel];if(u.item)run.bag.push(u.item);u.item=id;run.bag.splice(bi,1);sel=null;draw();};br.appendChild(b);});
  p.appendChild(br);
  const cl=document.createElement('button');cl.className='btn';cl.textContent='关闭';cl.onclick=()=>{ov.style.display='none';};p.appendChild(cl);
  ov.appendChild(p);}
 draw();}
window.showBag=showBag;
