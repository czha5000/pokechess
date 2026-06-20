// Agent 桥:供外部(Claude/控制台)读状态并下指令,以"更聪明的玩家"驱动真实引擎。
//   window.snapshot()  -> 返回当前局面 JSON(含每个可行攻击的伤害/命中/暴击预测)
//   await window.act(cmd) -> 执行一步,待"轮到我方/进入选择界面/结束"后返回最新 snapshot
// 与 autoplay 不冲突:agent 玩时把 autoOn 关掉即可(默认就是关)。
function _cur(){return initiative[iPtr];}
function _ui(u){return{id:u.id,key:u.key||u.type,name:u.name,side:u.side,type:u.type,hp:u.hp,maxhp:u.maxhp,atk:u.atk,def:u.def,spd:u.spd,skl:u.skl,lck:u.lck,mov:u.mov,rng:u.rng,x:u.x,y:u.y,moved:!!u.moved,acted:!!u.acted,hero:!!u.hero,transformed:!!u.transformed,elite:!!u.elite,skills:u.skills.slice()};}
function _options(u){const opts=[];const tiles=u.moved?[{x:u.x,y:u.y}]:moveBFS(u);
  u.skills.forEach(sk=>{const s=SKILLS[sk];if(s.kind!=='atk'&&s.kind!=='aoe')return;const R=u.rng+(s.rb||0);
    units.filter(e=>e.side==='enemy'&&e.hp>0).forEach(e=>{let cand=null,cd=1e9;for(const t of tiles){if(Math.abs(t.x-e.x)+Math.abs(t.y-e.y)<=R){const dd=Math.abs(t.x-u.x)+Math.abs(t.y-u.y);if(dd<cd){cd=dd;cand=t;}}}if(!cand)return;
      const b=baseDmg(u,e,s),hit=hitRate(u,e,s),crit=critRate(u,e,s),dbl=doubles(u,e)&&s.kind!=='aoe';
      opts.push({i:opts.length,skill:sk,skillName:s.name,enemyId:e.id,enemyType:e.type,from:[cand.x,cand.y],dmg:b.d,mult:b.m,hits:dbl?2:1,hitPct:hit,critPct:crit,lethal:b.d*(dbl?2:1)>=e.hp&&hit>=60});});});
  return opts;}
function _scr(id){return document.getElementById(id).style.display!=='none';}

window.snapshot=function(){const s={stage,chapter:run.chapter,busy};
  if(_scr('deploy')){s.screen='deploy';s.pickCap=Math.min(3,run.pool.length);s.pool=run.pool.map((p,i)=>({i,key:p.key,type:p.type,lv:p.lv,hp:p.maxhp,atk:p.atk,rng:p.rng}));s.enemyPreview=pendingEnemies.map(e=>({type:e.type,elite:!!e.elite,hp:e.hp,atk:e.atk}));return s;}
  if(_scr('eventModal')){s.screen='event';s.choices=[...document.querySelectorAll('#evChoices button')].map((b,i)=>({i,label:b.textContent}));return s;}
  if(_scr('restModal')){s.screen='rest';s.pool=run.pool.map((p,i)=>({i,key:p.key,lv:p.lv,hero:!!p.hero}));return s;}
  if(_scr('relicModal')){s.screen='relic';s.choices=[...document.querySelectorAll('#relicChoices button')].map((b,i)=>({i,label:b.textContent}));return s;}
  if(stage==='map'){s.turn='map';s.reachable=reachableIds().map(nodeById).filter(n=>n&&!n.done).map(n=>({id:n.id,type:n.type}));s.pool=run.pool.map(p=>({key:p.key,type:p.type,lv:p.lv,stage:p.stage}));s.relics=run.relics.map(r=>r.id);return s;}
  if(stage==='over'){s.turn='over';return s;}
  if(stage==='enemy'){s.turn='enemy';return s;}
  if(stage==='player'){const u=_cur();s.turn='player';s.actor=_ui(u);
    s.allies=units.filter(x=>x.side==='player'&&x.hp>0).map(_ui);
    s.enemies=units.filter(x=>x.side==='enemy'&&x.hp>0).map(_ui);
    s.terrainNote='0平地/1水(不可进)/2森林(守-2,回避+15)';
    s.moves=u.moved?[]:moveBFS(u).map(t=>[t.x,t.y]);
    s.options=_options(u);
    s.captures=units.filter(e=>e.side==='enemy'&&e.hp>0&&Math.abs(e.x-u.x)+Math.abs(e.y-u.y)===1).map(e=>({pos:[e.x,e.y],type:e.type,pct:Math.round(capChance(u,e)*100)}));
    if(u.hero&&!u.transformed)s.transformForms=['fire','water','electric'];
    return s;}
  s.turn=stage;return s;};

function _waitReady(ms){ms=ms||9000;const t0=Date.now();return new Promise(res=>{(function poll(){
  const scr=['deploy','eventModal','restModal','relicModal'].some(_scr);
  const ready=!busy&&((stage==='player'&&_cur()&&_cur().side==='player'&&_cur().hp>0)||stage==='map'||stage==='over'||scr);
  if(ready||Date.now()-t0>ms)res(window.snapshot());else setTimeout(poll,150);})();});}

window.act=async function(cmd){cmd=cmd||{};
  if(stage==='intro'){beginRun();return _waitReady();}
  if(_scr('deploy')){if(cmd.deploy){picks=cmd.deploy.slice(0,Math.min(3,run.pool.length));renderPicks();confirmDeploy();}else{autoDeploy();}return _waitReady();}
  if(_scr('eventModal')){const bs=[...document.querySelectorAll('#evChoices button')];(bs[cmd.choice||0]||bs[0]).click();return _waitReady();}
  if(_scr('restModal')){if(cmd.release!=null){const m=run.pool[cmd.release];if(m&&!m.hero&&run.pool.length>2)run.pool=run.pool.filter(x=>x!==m);}show('restModal',false);finishNode();return _waitReady();}
  if(_scr('relicModal')){const bs=[...document.querySelectorAll('#relicChoices button')];(bs[cmd.relic||0]||bs[0]).click();return _waitReady();}
  if(stage==='map'){let n=cmd.node?nodeById(cmd.node):null;if(!n){const r=reachableIds().map(nodeById).filter(x=>x&&!x.done);n=r[0];}if(n)enterNode(n);return _waitReady();}
  if(stage==='player'){const u=_cur();
    if(cmd.transform&&u.hero&&!u.transformed){transformEevee(u,cmd.transform);return window.snapshot();}
    if(cmd.wait){u.acted=true;clearSel();render();advanceInit();return _waitReady();}
    if(cmd.capture){const e=units.find(x=>x.side==='enemy'&&x.hp>0&&x.x===cmd.capture[0]&&x.y===cmd.capture[1]);if(e)await doCapture(u,e);return _waitReady();}
    let opt=null;
    if(cmd.option!=null)opt=_options(u)[cmd.option];
    else if(cmd.skill&&cmd.target){const e=units.find(x=>x.side==='enemy'&&x.hp>0&&x.x===cmd.target[0]&&x.y===cmd.target[1]);if(e)opt=_options(u).find(o=>o.skill===cmd.skill&&o.enemyId===e.id);}
    if(opt){const e=units.find(x=>x.id===opt.enemyId);if(opt.from[0]!==u.x||opt.from[1]!==u.y)doMove(u,opt.from[0],opt.from[1]);await execAttack(u,opt.skill,e);return _waitReady();}
    if(cmd.move){doMove(u,cmd.move[0],cmd.move[1]);return window.snapshot();}
    u.acted=true;clearSel();render();advanceInit();return _waitReady();}
  return window.snapshot();};
