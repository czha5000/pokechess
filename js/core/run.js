// 单局(run):地图生成、节点推进、事件、休整
function buildDeck(d){const arr=[];(d.units||[]).forEach(u=>{if(u.indexOf('w:')===0){const w=WILD[u.slice(2)];if(w)arr.push(poolEntryFromEnemy(w));}else{const p=POOL.find(x=>(x.key||x.type)===u);if(p)arr.push(poolEntry(p));}});return arr.length?arr:POOL.map(poolEntry);}
function enterChapterMap(){var _cv=(typeof STORY!=='undefined'&&STORY.chapterVideo)?STORY.chapterVideo[run.chapter]:null;if(_cv&&typeof showVideo==='function')showVideo(_cv,showMap);else showMap();}
function beginRun(){const _dk=(typeof START_DECKS!=='undefined')?(START_DECKS[(meta.deck||0)]||START_DECKS[0]):null;run.pool=_dk?buildDeck(_dk):POOL.map(poolEntry);run.chapter=1;run.relics=[];run.reviveUsed=false;run._over=false;run.gold=0;run.bag=[];run.ascSel=meta.ascSel||0;applyMetaToRun();if(_dk&&_dk.relic){const _r=RELICS.find(x=>x.id===_dk.relic);if(_r&&!run.relics.some(z=>z.id===_r.id))run.relics.push(_r);}buildMap();show('intro',false);log('冒险开始！从地图首列选择一个节点。','#6ad1ff');if(typeof STORY!=='undefined'){log(STORY.chapter[1],'#ffcf5a');}if(meta.startLv>1||meta.equipRelic)log(`Meta 加成已生效：起始 Lv.${meta.startLv}${meta.equipRelic?'，起始遗物 '+RELICS.find(r=>r.id===meta.equipRelic).name:''}`,'#ffd95a');var _go=function(){if(typeof showCutscene==='function'&&typeof STORY!=='undefined'&&STORY.scene){showCutscene(STORY.scene.opening,enterChapterMap);}else showMap();};if(typeof showVideo==='function'){showVideo('assets/opening.mp4',_go);}else _go();}
function buildMap(){run.map=[];const cols=run.depth;
  for(let c=0;c<cols;c++){let n=c===0?2:c===cols-1?1:1+(Math.random()*3|0);n=Math.max(1,Math.min(3,n));const arr=[];
    for(let r=0;r<n;r++){let type;if(c===cols-1)type='boss';else if(c===0)type='battle';else type=['battle','battle','elite','event','rest','shop'][Math.random()*6|0];
      const node={id:c+'-'+r,c,r,type,done:false,edges:[]};if(type==='battle'&&c>0){const rr=Math.random();if(rr<0.15){node.obj='survive';node.objN=3+(Math.random()<0.5?1:0);}else if(rr<0.30){node.obj='reach';}}arr.push(node);}run.map.push(arr);}
  for(let c=0;c<cols-1;c++){const cur=run.map[c],nxt=run.map[c+1];
    cur.forEach((node,ri)=>{const k=1+(Math.random()<0.5?1:0);const base=Math.round(ri*(nxt.length-1)/Math.max(1,cur.length-1));
      for(let j=0;j<k;j++){const idx=Math.max(0,Math.min(nxt.length-1,base+(j===0?0:(Math.random()<0.5?-1:1))));if(!node.edges.includes(nxt[idx].id))node.edges.push(nxt[idx].id);}});
    nxt.forEach((nn,j)=>{if(!cur.some(node=>node.edges.includes(nn.id))){const src=cur[Math.min(cur.length-1,Math.round(j*cur.length/nxt.length))];src.edges.push(nn.id);}});}
  run.cur=null;}
function nodeById(id){for(const col of run.map)for(const n of col)if(n.id===id)return n;return null;}
function reachableIds(){if(run.cur===null)return run.map[0].map(n=>n.id);const n=nodeById(run.cur);return n?n.edges:[];}
function enterNode(n){run.cur=n.id;
  if(n.type==='event')showEvent(n);
  else if(n.type==='shop')showShop(n);
  else if(n.type==='rest'){run.pool.forEach(m=>{const cur=(m.curHp!=null?m.curHp:m.maxhp);m.curHp=Math.min(m.maxhp,cur+Math.ceil(m.maxhp*ascRestHeal(run.ascSel||0)));});log('🏕 休整:全队回复 30% 生命。','#7fe0a0');showRest(n);}
  else startDeploy(n);}

// 事件 / 休整
const EVENTS=[
 {t:'神秘树果',d:'林间结着发光果实。',c:[
   {label:'全队进食(各+30经验)',fn:()=>{run.pool.forEach(m=>grantExpEntry(m,30));log('全队获得经验。','#7fe0a0');}},
   {label:'喂给一只(它+80经验)',fn:()=>pickMon('选择进食的精灵',m=>grantExpEntry(m,80))}]},
 {t:'受伤的野怪',d:'一只野生精灵向你求助。',c:[
   {label:'收留它(随机入池)',fn:()=>{const ks=Object.keys(WILD);const e=WILD[ks[Math.random()*ks.length|0]];const m=poolEntryFromEnemy(e,ENEMY_LV[run.chapter]||1);run.pool.push(m);log(`${m.name} 加入精灵池(牌库+1)。`,'#7fe0a0');}},
   {label:'放生(无事)',fn:()=>log('你放它离开了。','#9aa6c8')}]},
 {t:'古老石碑',d:'触碰石碑似乎能强化一只精灵。',c:[
   {label:'强化一只(攻+3 防+2)',fn:()=>pickMon('选择强化的精灵',m=>{m.atk+=3;m.def+=2;log(`${m.name} 被永久强化。`,'#7fe0a0');})},
   {label:'离开',fn:()=>log('你没有触碰。','#9aa6c8')}]},
 {t:'流浪商队',d:'商队摊开一件古物,对你微笑。',c:[
   {label:'收下馈赠(随机遗物)',fn:()=>grantRandomRelic()},
   {label:'婉拒离开',fn:()=>log('你谢绝了商队。','#9aa6c8')}]},
 {t:'磨刀石',d:'一块泛着寒光的磨刀石。',c:[
   {label:'全队磨砺(各攻+1)',fn:()=>{run.pool.forEach(m=>m.atk+=1);log('全队攻击 +1。','#7fe0a0');}},
   {label:'专精一只(攻+4)',fn:()=>pickMon('选择磨砺的精灵',m=>{m.atk+=4;log(`${m.name} 攻击 +4。`,'#7fe0a0');})}]},
 {t:'温泉',d:'雾气氤氲的温泉,泡过似乎更强健。',c:[
   {label:'全队浸泡(各最大生命+3)',fn:()=>{run.pool.forEach(m=>{m.maxhp+=3;m.curHp=(m.curHp!=null?m.curHp:m.maxhp)+3;});log('全队最大生命 +3。','#7fe0a0');}},
   {label:'让一只静养(最大生命+9)',fn:()=>pickMon('选择静养的精灵',m=>{m.maxhp+=9;m.curHp=(m.curHp!=null?m.curHp:m.maxhp)+9;log(`${m.name} 最大生命 +9。`,'#7fe0a0');})}]},
 {t:'训练场',d:'废弃的训练桩,可供操练。',c:[
   {label:'全队操练(各+20经验)',fn:()=>{run.pool.forEach(m=>grantExpEntry(m,20));log('全队获得经验。','#7fe0a0');}},
   {label:'特训一只(+70经验)',fn:()=>pickMon('选择特训的精灵',m=>grantExpEntry(m,70))}]},
 {t:'疾风古树',d:'风穿过枝叶,脚步似乎更轻盈。',c:[
   {label:'全队感悟(各速度+1)',fn:()=>{run.pool.forEach(m=>m.spd+=1);log('全队速度 +1。','#7fe0a0');}},
   {label:'让一只领悟(速度+3)',fn:()=>pickMon('选择领悟的精灵',m=>{m.spd+=3;log(`${m.name} 速度 +3。`,'#7fe0a0');})}]},
 {t:'坚岩壁画',d:'壁画描绘着坚不可摧的守护。',c:[
   {label:'全队领会(各防+1)',fn:()=>{run.pool.forEach(m=>m.def+=1);log('全队防御 +1。','#7fe0a0');}},
   {label:'让一只参悟(防+4)',fn:()=>pickMon('选择参悟的精灵',m=>{m.def+=4;log(`${m.name} 防御 +4。`,'#7fe0a0');})}]},
 {t:'赌徒之石',d:'石中似有力量,但凶吉难料。',c:[
   {label:'赌一把(60%攻+6 / 40%防-2)',fn:()=>pickMon('选择押注的精灵',m=>{if(Math.random()<0.6){m.atk+=6;log(`大吉！${m.name} 攻击 +6。`,'#7fe0a0');}else{m.def=Math.max(0,m.def-2);log(`小凶…${m.name} 防御 -2。`,'#ff8a8a');}})},
   {label:'不赌(离开)',fn:()=>log('你收回了手。','#9aa6c8')}]},
 {t:'迷途盗贼',d:'一名盗贼挡住去路。',c:[
   {label:'花钱消灾(无事发生)',fn:()=>log('盗贼收下口粮,放你通行。','#9aa6c8')},
   {label:'制服他(随机一只攻+3)',fn:()=>{const m=run.pool[Math.random()*run.pool.length|0];m.atk+=3;log(`制服了盗贼,${m.name} 攻击 +3。`,'#7fe0a0');}}]},
 {t:'进化苔藓',d:'罕见的苔藓,据说能催化成长。',c:[
   {label:'涂抹一只(+100经验,助其进化)',fn:()=>pickMon('选择催化的精灵',m=>grantExpEntry(m,100))},
   {label:'采集留用(随机一只+40经验)',fn:()=>{const m=run.pool[Math.random()*run.pool.length|0];grantExpEntry(m,40);log(`${m.name} 获得经验。`,'#7fe0a0');}}]},
 {t:'治愈清泉',d:'泉水清澈,饮之回神。',c:[
   {label:'全队畅饮(全部回满)',fn:()=>{run.pool.forEach(m=>m.curHp=m.maxhp);log('全队生命回满。','#7fe0a0');}},
   {label:'独享一只(回满+最大生命+5)',fn:()=>pickMon('选择畅饮的精灵',m=>{m.maxhp+=5;m.curHp=m.maxhp;log(`${m.name} 回满并 +5 最大生命。`,'#7fe0a0');})}]},
 {t:'古战场遗骸',d:'残破的营地散落着旧物。',c:[
   {label:'拾取金币(+25)',fn:()=>{run.gold=(run.gold||0)+25;log('拾得金币 +25。','#ffd95a');if(typeof renderRelicBar==='function')renderRelicBar();}},
   {label:'搜刮兵器(随机一只攻+4)',fn:()=>{const m=run.pool[Math.random()*run.pool.length|0];m.atk+=4;log(`${m.name} 攻击 +4。`,'#7fe0a0');}}]},
 {t:'废弃祭坛',d:'祭坛散发不祥又诱人的气息。',c:[
   {label:'献祭求宝(50% 遗物 / 50% 全队-3血)',fn:()=>{if(Math.random()<0.5){grantRandomRelic();}else{run.pool.forEach(m=>m.curHp=Math.max(1,(m.curHp!=null?m.curHp:m.maxhp)-3));log('祭坛反噬,全队 -3 血。','#ff8a8a');}}},
   {label:'敬而远之',fn:()=>log('你绕开了祭坛。','#9aa6c8')}]},
 {t:'双生水晶',d:'三色水晶共鸣,可赋予全队一种特质。',c:[
   {label:'红晶·全队攻+1',fn:()=>{run.pool.forEach(m=>m.atk+=1);log('全队攻击 +1。','#7fe0a0');}},
   {label:'蓝晶·全队防+1',fn:()=>{run.pool.forEach(m=>m.def+=1);log('全队防御 +1。','#7fe0a0');}},
   {label:'黄晶·全队速+1',fn:()=>{run.pool.forEach(m=>m.spd+=1);log('全队速度 +1。','#7fe0a0');}}]},
 {t:'试炼之门',d:'门后传来低吼,通过者将获巨大历练。',c:[
   {label:'应战(70% +120经验 / 30% -8血)',fn:()=>pickMon('选择应战的精灵',m=>{if(Math.random()<0.7){grantExpEntry(m,120);log(`${m.name} 通过试炼,大幅成长!`,'#7fe0a0');}else{m.curHp=Math.max(1,(m.curHp!=null?m.curHp:m.maxhp)-8);log(`${m.name} 落败受伤 -8 血。`,'#ff8a8a');}})},
   {label:'绕道',fn:()=>log('你绕过了试炼之门。','#9aa6c8')}]},
 {t:'远古遗物匣',d:'一只上锁的古匣。',c:[
   {label:'解锁(随机遗物)',fn:()=>grantRandomRelic()},
   {label:'砸开取材(金币+30)',fn:()=>{run.gold=(run.gold||0)+30;log('砸开古匣,得金币 +30。','#ffd95a');if(typeof renderRelicBar==='function')renderRelicBar();}}]},
 {t:'迷雾祭司',d:'祭司低语,愿引一只迷途之兽相随。',c:[
   {label:'接纳(随机野怪入池)',fn:()=>{const ks=Object.keys(WILD);const e=WILD[ks[Math.random()*ks.length|0]];const m=poolEntryFromEnemy(e,ENEMY_LV[run.chapter]||1);run.pool.push(m);log(`${m.name} 加入精灵池。`,'#7fe0a0');}},
   {label:'谢绝',fn:()=>log('你婉拒了祭司。','#9aa6c8')}]},
 {t:'梦的低语',d:'空气里浮起细碎私语,像在叩问你的来意。',c:[
   {label:'倾听(全队技巧+1)',fn:()=>{run.pool.forEach(m=>m.skl+=1);log('全队技巧 +1,命中更准。','#7fe0a0');}},
   {label:'闭耳前行',fn:()=>log('你压下心绪,继续前行。','#9aa6c8')}]}
];
function grantRandomRelic(){const owned=new Set(run.relics.map(r=>r.id));const pool=RELICS.filter(r=>!owned.has(r.id));if(!pool.length){log('遗物已收集齐全,商队悻悻离去。','#9aa6c8');return;}const r=pool[Math.random()*pool.length|0];run.relics.push(r);log(`获得遗物 ${r.icon} <b>${r.name}</b>`,'#ffd95a');renderRelicBar();}
// 事件经验(v0.50):成长值与战斗升级统一(走 bumpEntryToLv);上限=本章敌人等级+1(ch1可到Lv4,进化苔藓真能促成进化了),到顶有提示。
function grantExpEntry(m,amt){const cap=Math.min(MAXLV,(ENEMY_LV[run.chapter]||3)+1);
  if(m.lv>=cap){log(`${m.name} 历练已达本章上限(Lv.${cap}),经验溢出。`,'#9aa6c8');return;}
  m.exp+=amt;while(m.lv<cap&&m.exp>=THRESH[m.lv]){m.exp-=THRESH[m.lv];bumpEntryToLv(m,m.lv+1);}}
function pickMon(title,fn){document.getElementById('evTitle').textContent=title;document.getElementById('evDesc').textContent='';
  const box=document.getElementById('evChoices');box.innerHTML='';box.style.maxHeight='';
  run.pool.forEach(mon=>{const b=document.createElement('button');b.className='btn ghost';b.textContent=`${mon.name} L${mon.lv}`;b.onclick=()=>{fn(mon);finishNode();};box.appendChild(b);});
  show('eventModal',true);}
function showEvent(n){const ev=EVENTS[Math.random()*EVENTS.length|0];document.getElementById('evTitle').textContent='❓ '+ev.t;document.getElementById('evDesc').textContent=ev.d;
  const box=document.getElementById('evChoices');box.innerHTML='';
  ev.c.forEach(ch=>{const b=document.createElement('button');b.className='btn';b.textContent=ch.label;b.onclick=()=>{ch.fn();if(document.getElementById('eventModal').style.display!=='none'&&!/选择/.test(document.getElementById('evTitle').textContent))finishNode();};box.appendChild(b);});
  show('eventModal',true);if(autoOn)setTimeout(autoEvent,800);}
function shopOffers(n){if(!n._shop){const owned=new Set(run.relics.map(r=>r.id));const pool=RELICS.filter(r=>!owned.has(r.id));const rel=(typeof draftRelics==='function')?draftRelics(pool,2):(function(){const r=[];for(let i=0;i<2&&pool.length;i++)r.push(pool.splice(Math.random()*pool.length|0,1)[0]);return r;})();n._shop={rel,healed:false,item:(typeof HELD_KEYS!=='undefined')?HELD_KEYS[Math.random()*HELD_KEYS.length|0]:null};}return n._shop;}
function showShop(n){const sh=shopOffers(n);document.getElementById('evTitle').textContent='🛒 商队商店　💰 '+(run.gold||0);document.getElementById('evDesc').textContent='用金币购买;离开即继续。';
  const box=document.getElementById('evChoices');box.innerHTML='';box.style.maxHeight='';
  sh.rel.forEach((r,idx)=>{const price=50;const b=document.createElement('button');b.className='btn ghost';b.style.cssText='display:flex;flex-direction:column;align-items:flex-start;text-align:left;max-width:240px';b.innerHTML=`<span>🛍 ${r.icon} ${r.name} <b>(💰${price})</b></span><small style="font-weight:400;color:#ccd">${r.desc}</small>`;b.onclick=()=>{if((run.gold||0)<price){log('金币不足。','#ff8a8a');return;}run.gold-=price;run.relics.push(r);sh.rel.splice(idx,1);log(`购买 ${r.icon} ${r.name}`,'#ffd95a');renderRelicBar();showShop(n);};box.appendChild(b);});
  if(!sh.healed){const hp=30,b=document.createElement('button');b.className='btn';b.textContent=`💊 全队回满 (💰${hp})`;b.onclick=()=>{if((run.gold||0)<hp){log('金币不足。','#ff8a8a');return;}run.gold-=hp;run.pool.forEach(m=>m.curHp=m.maxhp);sh.healed=true;log('全队回满。','#7fe0a0');showShop(n);};box.appendChild(b);}
  if(sh.item&&typeof HELD_ITEMS!=='undefined'){const it=HELD_ITEMS[sh.item],ip=40,ib=document.createElement('button');ib.className='btn ghost';ib.style.cssText='display:flex;flex-direction:column;align-items:flex-start;text-align:left;max-width:240px';ib.innerHTML=`<span>🛍 ${it.icon} ${it.name} <b>(💰${ip})</b></span><small style="font-weight:400;color:#ccd">${it.desc}</small>`;ib.onclick=()=>{if((run.gold||0)<ip){log('金币不足。','#ff8a8a');return;}run.gold-=ip;run.bag=run.bag||[];run.bag.push(sh.item);sh.item=null;log(`购买道具 ${it.icon} ${it.name}(进背包)`,'#ffd95a');renderRelicBar();showShop(n);};box.appendChild(ib);}
  const lv=document.createElement('button');lv.className='btn';lv.textContent='离开商店';lv.onclick=()=>{show('eventModal',false);finishNode();};box.appendChild(lv);
  show('eventModal',true);if(autoOn)setTimeout(()=>{show('eventModal',false);finishNode();},800);}
function showRest(n){const box=document.getElementById('restRoster');box.innerHTML='';
  run.pool.forEach(m=>{const d=document.createElement('div');d.className='rmon';d.style.cursor='pointer';
    d.innerHTML=`<img src="${SPRITE(m.pid)}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{textContent:'${m.em}',style:'font-size:34px'}))"><br>${m.name}${hpMini(m)}<br>释放`;
    d.onclick=()=>{if(m.hero){log('主角伊布不可释放。','#ff8a8a');return;}if(run.pool.length<=2){log('队伍太少,不能再释放。','#ff8a8a');return;}run.pool=run.pool.filter(x=>x!==m);log(`释放了 ${m.name}，牌库精简(-1)。`,'#c78bff');showRest(n);};
    box.appendChild(d);});
  show('restModal',true);if(autoOn)setTimeout(()=>{show('restModal',false);finishNode();},900);}
function finishNode(){show('eventModal',false);const n=nodeById(run.cur);if(n)n.done=true;showMap();}
