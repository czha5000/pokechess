// 速度交错行动引擎:所有存活单位按速度排序,逐个行动(敌我混排)
function startRound(){units.forEach(u=>{u.acted=false;u.moved=false;u._didAttack=false;});
  if(typeof run!=='undefined'&&run.obj==='survive'){run.round=(run.round||0)+1;if(run.round>run.objN){winBattle();return;}log('🎯 守住中…还需 '+(run.objN-run.round+1)+' 回合','#9fd3ff');}
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
  if(u.side==='player'){const sr=relicShieldRegen();if(sr>0){addShield(u,sr);floatText(u.x,u.y,'+'+sr+'🛡','#9fd3ff');}
    const dr=relicHpDrain();if(dr>0&&u.hp>0){u.hp=Math.max(1,u.hp-dr);floatText(u.x,u.y,'-'+dr+'🔥','#e8602c');setHp(u);}} // 焚身印记
  {const _it=(typeof itemOf==='function')?itemOf(u):null;if(_it&&_it.regen&&u.hp>0){u.hp=Math.min(u.maxhp,u.hp+_it.regen);floatText(u.x,u.y,'+'+_it.regen,'#6affa0');setHp(u);}}
  if(u.side==='player'){stage='player';busy=false;document.getElementById('turnBadge').textContent='我方行动：'+u.name;selectUnit(u);if(autoOn)setTimeout(()=>autoPlayUnit(u),AUTODELAY);}
  else{stage='enemy';busy=true;document.getElementById('turnBadge').textContent='敌方行动：'+u.name;clearSel();render();
    await delay(280);await aiAct(u);u.acted=true;busy=false;advanceInit();}}
