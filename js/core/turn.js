// 速度交错行动引擎:所有存活单位按速度排序,逐个行动(敌我混排)
function startRound(){units.forEach(u=>{u.acted=false;u.moved=false;});
  initiative=units.filter(u=>u.hp>0).slice().sort((a,b)=>(b.spd-a.spd)||((a.side==='player'?0:1)-(b.side==='player'?0:1)));
  iPtr=-1;advanceInit();}
function advanceInit(){iPtr++;nextActor();}
async function nextActor(){
  if(checkEnd())return;
  while(iPtr<initiative.length&&(!initiative[iPtr]||initiative[iPtr].hp<=0))iPtr++;
  if(iPtr>=initiative.length){startRound();return;}
  const u=initiative[iPtr];
  // 行动前结算异常:DOT 扣血 / 麻痹概率跳过
  const tk=statusTick(u);
  if(tk.ticked){render();await delay(380);}
  if(tk.dead){if(checkEnd())return;advanceInit();return;}
  if(tk.skip){u.acted=true;render();await delay(200);advanceInit();return;}
  if(u.side==='player'){stage='player';busy=false;document.getElementById('turnBadge').textContent='我方行动：'+u.name;selectUnit(u);if(autoOn)setTimeout(()=>autoPlayUnit(u),AUTODELAY);}
  else{stage='enemy';busy=true;document.getElementById('turnBadge').textContent='敌方行动：'+u.name;clearSel();render();
    await delay(280);await aiAct(u);busy=false;advanceInit();}}
