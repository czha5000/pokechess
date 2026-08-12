// 启动 + 所有 DOM 事件绑定(集中在此,逻辑文件不直接绑事件)
function bind(id,fn){const el=document.getElementById(id);if(el)el.onclick=fn;}

bind('startRun', beginRun);
bind('confirmDeploy', confirmDeploy);
bind('restLeave', ()=>{show('restModal',false);finishNode();});
bind('chartBtn', ()=>{buildChart();show('chartModal',true);});
bind('chartClose', ()=>show('chartModal',false));
bind('mapBtn', ()=>{if(stage==='map'||stage==='intro')return;if(stage==='player'&&!busy){if(confirm('返回地图将放弃当前战斗进度,确定?'))showMap();}});
bind('endTurn', ()=>{if(stage==='player'&&!busy){const u=initiative[iPtr];if(u&&u.side==='player'){u.acted=true;clearSel();render();advanceInit();}}});
bind('restart', ()=>location.reload());
bind('endRestart', ()=>location.reload());
bind('autoBtn', toggleAuto);
bind('saveBtn', saveGame);
bind('bagBtn', ()=>showBag());
bind('loadBtn', loadGame);
bind('retryBattle', ()=>{if((stage==='player'||stage==='enemy')&&retrySnap){if(confirm('重来本关：回到本节点部署前(本关进度作废,精灵池/遗物恢复)。确定?'))retryBattle();}});

loadMeta();renderHub();
if(hasSave()){const lb=document.getElementById('loadBtn');if(lb)lb.style.display='';}
render();
show('intro',true);
log('欢迎试玩(重构版)：行动按速度交错(敌我混排)；敌人/Boss 增强、普攻削弱(更依赖克制)。','#6ad1ff');
