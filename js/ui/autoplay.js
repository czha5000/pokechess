// 自动演示:用与平衡台相同的决策策略,驱动【游戏真实引擎】自动开打(非重演,概率由游戏自己掷)。
// 自动接管:开局→地图选点→部署→事件/休整→遗物→逐单位战斗。到结算界面停下让你看结果。
const AUTODELAY=550;

function toggleAuto(){autoOn=!autoOn;const b=document.getElementById('autoBtn');
  if(b){b.textContent=autoOn?'🤖 自动:开':'🤖 自动演示';b.style.color=autoOn?'#7fe0a0':'';}
  log(autoOn?'🤖 自动演示开启——交给 AI 用游戏真实引擎开打。':'🤖 自动演示关闭,交还给你。','#6ad1ff');
  if(!autoOn)return;
  if(stage==='intro'){beginRun();return;}                        // 自动开局
  if(document.getElementById('deploy').style.display!=='none'){setTimeout(autoDeploy,AUTODELAY);return;}
  if(stage==='map'){setTimeout(autoPickNode,AUTODELAY);return;}
  if(stage==='player'){const u=initiative[iPtr];if(u&&u.side==='player'&&!busy)setTimeout(()=>autoPlayUnit(u),AUTODELAY);}}

// 决策策略 v2(与 balance/sim.js 同一套,见 SKILL.md)
// 某格(x,y)下回合会被多少敌人打到(用于规避暴露)
function _threatAt(x,y,exclude){let n=0;units.forEach(e=>{if(e.side==='enemy'&&e.hp>0&&e!==exclude&&(Math.abs(e.x-x)+Math.abs(e.y-y))<=e.mov+reachOf(e))n++;});return n;}
function autoChoose(u){const enemies=units.filter(e=>e.side==='enemy'&&e.hp>0);if(!enemies.length)return null;
  const tiles=u.moved?[{x:u.x,y:u.y}]:moveBFS(u);let best=null;
  for(const skk of u.skills){const s=SKILLS[skk];if(s.kind!=='atk'&&s.kind!=='aoe')continue;const R=u.rng+(s.rb||0);
    for(const e of enemies){const b=baseDmg(u,e,s);if(b.m===0)continue;
      // 在能打到 e 的落点里挑"暴露最低"的(不是最近的)
      let cand=null,cs=1e9;for(const t of tiles){if(Math.abs(t.x-e.x)+Math.abs(t.y-e.y)<=R){const expo=_threatAt(t.x,t.y,e)*4-(TERRAIN[t.y][t.x]===2?3:0);if(expo<cs){cs=expo;cand=t;}}}
      if(!cand)continue;
      const hit=hitRate(u,e,s)/100,dbl=doubles(u,e)&&s.kind!=='aoe',total=b.d*(dbl?2:1);
      const lethal=total>=e.hp&&hit>=0.6;
      let counter=0;if(!lethal&&s.kind!=='aoe'&&(Math.abs(cand.x-e.x)+Math.abs(cand.y-e.y))<=e.rng){counter=baseDmg(e,u,SKILLS.basic).d*0.6;}
      const score=total*hit+(lethal?25:0)+(b.m>1?8:0)+e.atk*0.4-counter-cs;
      if(!best||score>best.score)best={tile:cand,sk:skk,enemy:e,score,lethal};}}
  return best;}
// 没仗打时:走到暴露最低、略向最近敌人靠拢的格(避免拖到超时);残血纯避险
function autoSafeMove(u){const enemies=units.filter(e=>e.side==='enemy'&&e.hp>0);if(!enemies.length)return;
  const tiles=moveBFS(u);const near=enemies.reduce((a,b)=>(Math.abs(u.x-a.x)+Math.abs(u.y-a.y))<(Math.abs(u.x-b.x)+Math.abs(u.y-b.y))?a:b);
  const low=u.hp/u.maxhp<0.35;let bt=null,bs=1e9;
  for(const t of tiles){const expo=_threatAt(t.x,t.y,null)*4+(low?0:(Math.abs(t.x-near.x)+Math.abs(t.y-near.y))*0.3)-(TERRAIN[t.y][t.x]===2?1.5:0);if(expo<bs){bs=expo;bt=t;}}
  if(bt&&(bt.x!==u.x||bt.y!==u.y))doMove(u,bt.x,bt.y);}

async function autoPlayUnit(u){
  if(!autoOn||stage!=='player'||busy||u!==initiative[iPtr]||u.hp<=0)return;
  if(u.hero&&!u.transformed){const enemies=units.filter(e=>e.side==='enemy'&&e.hp>0);let bf='electric',bv=-1;
    for(const f of ['fire','water','electric']){let v=0;enemies.forEach(e=>v+=typeMult(f,e.type));if(v>bv){bv=v;bf=f;}}
    transformEevee(u,bf);await delay(AUTODELAY);}
  const plan=autoChoose(u),low=u.hp/u.maxhp<0.35;
  // 残血时只在"明显划算(击杀/高分)"才出手,否则撤退避险
  if(plan&&(plan.lethal||plan.score>2)&&!(low&&!plan.lethal&&plan.score<6)){
    if(plan.tile.x!==u.x||plan.tile.y!==u.y){doMove(u,plan.tile.x,plan.tile.y);await delay(AUTODELAY);}
    await execAttack(u,plan.sk,plan.enemy);            // execAttack 末尾会 finishAct→advanceInit,自动续上
  }else{
    autoSafeMove(u);await delay(AUTODELAY);
    u.acted=true;clearSel();render();advanceInit();}}

function autoPickNode(){if(!autoOn||stage!=='map')return;
  const reach=reachableIds().map(nodeById).filter(n=>n&&!n.done);if(!reach.length)return;
  enterNode(reach[Math.random()*reach.length|0]);}

function autoDeploy(){if(!autoOn)return;const pool=run.pool;const sc=p=>p.lv*10+p.atk+p.maxhp/5;
  const order=pool.map((p,i)=>i).sort((a,b)=>sc(pool[b])-sc(pool[a]));const cap=Math.min(3,pool.length);
  picks=[];const hi=pool.findIndex(p=>p.hero);if(hi>=0)picks.push(hi);
  for(const i of order){if(picks.length>=cap)break;if(!picks.includes(i))picks.push(i);}
  renderPicks();setTimeout(()=>{if(autoOn)confirmDeploy();},AUTODELAY);}

function autoEvent(){if(!autoOn)return;const b=document.querySelector('#evChoices button');if(b){b.click();
  setTimeout(()=>{if(autoOn&&document.getElementById('eventModal').style.display!=='none')autoEvent();},700);}}

function autoRelic(){if(!autoOn)return;const b=document.querySelector('#relicChoices button');if(b)b.click();}
