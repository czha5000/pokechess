// 单场战斗:生成敌人、开战、胜负结算与章节推进
function spawnEnemies(n){const out=[];const ks=Object.keys(WILD);
  const slots=[0,1,2,4,5];let si=0;
  const add=(tmpl,slot,boss)=>out.push(mkEnemy(tmpl,ESLOTS[slot][0],ESLOTS[slot][1],boss));
  const rnd=()=>WILD[ks[Math.random()*ks.length|0]];
  if(n.type==='boss'){add(CH_BOSS[run.chapter],3,true);for(let i=0;i<3&&si<slots.length;i++)add(rnd(),slots[si++]);}
  else if(n.type==='elite'){add((typeof CH_ELITE!=='undefined'&&CH_ELITE[run.chapter])||ELITE,3);for(let i=0;i<3&&si<slots.length;i++)add(rnd(),slots[si++]);}
  else{const cnt=Math.min(slots.length,4+(Math.random()<0.5?1:0));for(let i=0;i<cnt;i++)add(rnd(),slots[si++]);}
  return out;}
function startBattle(n){units=[];battleCaptures=[];selected=null;clearSel();if(typeof setBattleMap==='function')setBattleMap();run._battleOver=false;run.obj=(n.type==='battle'&&n.obj)?n.obj:'clear';run.objN=n.objN||3;run.round=0;run.objX=null;run.objY=null;
  deployList.forEach((src,s)=>{const u=mkBattleUnit(src,PSTART[s][0],PSTART[s][1]);applyRelicStats(u);applyItemStats(u);units.push(u);});
  (pendingEnemies&&pendingEnemies.length?pendingEnemies:spawnEnemies(n)).forEach(e=>units.push(e));
  if(run.obj==='reach'){const cand=[[9,3],[8,4],[9,5],[8,3],[9,2],[8,5]];for(const g of cand){if(TERRAIN[g[1]][g[0]]===0&&!units.find(u=>u.x===g[0]&&u.y===g[1])){run.objX=g[0];run.objY=g[1];break;}}}
  log(run.obj==='survive'?`🎯 目标:守住 ${run.objN} 回合即胜`:run.obj==='reach'?'🎯 目标:派任意单位抵达 🏁 格':'🎯 目标:击败全部敌人','#ffd95a');
  log(`<b>${NNAME[n.type]}</b> 开始！出战：${deployList.map(d=>d.name).join('、')}`,'#6ad1ff');
  log('行动顺序按<b>速度</b>交错(敌我混排)。当前行动单位会高亮。','#9aa6c8');
  if(n.type==='boss'&&typeof STORY!=='undefined'&&STORY.scene){render();var _bs=function(){if(typeof showCutscene==='function')showCutscene(STORY.scene.boss[run.chapter],startRound);else startRound();};var _bv=STORY.bossVideo&&STORY.bossVideo[run.chapter];if(_bv&&typeof showVideo==='function')showVideo(_bv,_bs);else _bs();return;}
  render();startRound();}
function winBattle(){onBattleWin();}
function onBattleWin(){if(run._battleOver)return;run._battleOver=true;run.gold=(run.gold||0)+12+run.chapter*3;log(`💰 获得金币 +${12+run.chapter*3}(共 ${run.gold})`,'#ffd95a');
  // 同步存活者成长回精灵池(含进化后的 pid/name/stage);扣除遗物临时增量,避免复利
  units.filter(u=>u.side==='player').forEach(u=>{const s=u.src;if(!s)return;const rb=u._rb||{atk:0,def:0,spd:0,maxhp:0,lck:0};
    s.lv=u.lv;s.exp=u.exp;s.maxhp=u.maxhp-rb.maxhp;s.atk=u.atk-rb.atk;s.def=u.def-rb.def;s.spd=u.spd-rb.spd;s.skl=u.skl;
    s.curHp=Math.max(1,Math.min(s.maxhp,u.hp-rb.maxhp)); // 当前血量跨战保留
    if(!s.hero){s.skills=u.skills.slice();s.stage=u.stage;s.pid=u.pid;s.name=u.name;}});
  run.pool=run.pool.filter(e=>!e._dead);
  battleCaptures.forEach(e=>run.pool.push(poolEntryFromEnemy(e)));
  const n=nodeById(run.cur);if(n)n.done=true;
  log(`<b>胜利！</b>${battleCaptures.length?' 收服 '+battleCaptures.map(c=>c.name).join('、'):''}`,'#7fe0a0');
  const cont=()=>{
    if(n&&n.type==='boss'){
      if(run.chapter>=3){runOver(true);return;}
      run.pool.forEach(m=>m.curHp=m.maxhp);log('🌙 章节通关——全队休养,生命回满。','#7fe0a0'); // 章末回满阀门
      run.chapter++;buildMap();log(`—— 进入 <b>${CH_NAME[run.chapter]}</b>，敌人更强了 ——`,'#ffcf5a');const _cs=(typeof showCutscene==='function'&&typeof STORY!=='undefined')?()=>showCutscene([{name:'',pid:null,text:STORY.chapter[run.chapter]}],showMap):showMap;setTimeout(_cs,650);return;}
    setTimeout(showMap,500);};
  if(n&&(n.type==='elite'||n.type==='boss'))offerRelic(cont);else cont();}
function runOver(win){if(run._over)return;run._over=true;stage='over';if(typeof sfxWin==='function'){win?sfxWin():sfxLose();}show('endScreen',true);const earned=awardShards(win);try{localStorage.removeItem(SAVE_KEY);}catch(e){}
  document.getElementById('endTitle').textContent=win?'🏆 通关全部三章！':`💀 全军覆没（${CH_NAME[run.chapter]}）`;
  document.getElementById('endMsg').innerHTML=(win?`你击败了最终 Boss <b>超梦</b>！最终精灵池 ${run.pool.length} 只。`:`队伍全灭。永久死亡 + 单局随机就是肉鸽的张力所在。`)+(typeof STORY!=='undefined'?`<br><i>${win?STORY.win:STORY.lose}</i>`:'')+`<br>本局获得 💎 <b>${earned}</b> 魂晶（共 ${meta.shards}）。<br>回到开始界面可解锁<b>起始遗物 / 起始等级</b>，越打越强。`;}
