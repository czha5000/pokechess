// 存档(localStorage) + 重来本关(内存快照)
const SAVE_KEY='wenshou_save';
function serializeRun(){return JSON.stringify({pool:run.pool,map:run.map,cur:run.cur,depth:run.depth,chapter:run.chapter,ascSel:run.ascSel||0,gold:run.gold||0,bag:run.bag||[],reviveUsed:!!run.reviveUsed,relicIds:run.relics.map(r=>r.id),uid});}
function applyRunData(o){run.pool=o.pool;run.map=o.map;run.cur=o.cur;run.depth=o.depth||(typeof MAP_DEPTH!=="undefined"?MAP_DEPTH:9);run.chapter=o.chapter;run.ascSel=o.ascSel||0;run.gold=o.gold||0;run.bag=o.bag||[];run.reviveUsed=!!o.reviveUsed;run.relics=(o.relicIds||[]).map(id=>RELICS.find(r=>r.id===id)).filter(Boolean);if(o.uid)uid=Math.max(uid,o.uid);}
function autoSave(){try{localStorage.setItem(SAVE_KEY,serializeRun());}catch(e){}}
function saveGame(){try{localStorage.setItem(SAVE_KEY,serializeRun());log('💾 进度已保存(自动也会在每次回到地图时保存)。','#7fe0a0');}catch(e){alert('保存失败:'+e.message);}}
function hasSave(){try{return !!localStorage.getItem(SAVE_KEY);}catch(e){return false;}}
function loadGame(){try{const s=localStorage.getItem(SAVE_KEY);if(!s){alert('没有存档');return;}applyRunData(JSON.parse(s));show('intro',false);log('📂 已读取存档，回到地图。','#6ad1ff');showMap();}catch(e){alert('读取失败:'+e.message);}}

// 重来本关:进入节点(部署前)拍快照,可一键恢复到该节点开始
let retrySnap=null;
function snapshotForRetry(){retrySnap={pool:JSON.parse(JSON.stringify(run.pool)),map:JSON.parse(JSON.stringify(run.map)),cur:run.cur,chapter:run.chapter,ascSel:run.ascSel||0,reviveUsed:run.reviveUsed,relicIds:run.relics.map(r=>r.id)};}
function retryBattle(){if(!retrySnap){return;}
  run.pool=JSON.parse(JSON.stringify(retrySnap.pool));run.map=JSON.parse(JSON.stringify(retrySnap.map));
  run.cur=retrySnap.cur;run.chapter=retrySnap.chapter;run.ascSel=retrySnap.ascSel||0;run.reviveUsed=retrySnap.reviveUsed;
  run.relics=retrySnap.relicIds.map(id=>RELICS.find(r=>r.id===id)).filter(Boolean);
  busy=false;clearSel();log('↺ 重来本关(回到部署前)。','#ffcf5a');
  const n=nodeById(run.cur);if(n)startDeploy(n);}
