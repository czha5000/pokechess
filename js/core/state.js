// 全局状态 + 基础工具(经典script共享全局作用域)
let units=[], selected=null, stage='intro', highlights=[], picks=[], pendingSkill=null, pendingTgt=null, busy=false, uid=1;
let run={pool:[],map:[],cur:null,depth:6,chapter:1}, pendingNode=null, pendingEnemies=[], deployList=[], battleCaptures=[];
let initiative=[], iPtr=0;
let autoOn=false; // 自动演示开关(autoplay.js)

const CRITX=3, DOUBLE_GAP=4, FOREST_AVO=15; // 暴击倍率 / 二段速度差 / 森林回避
const rand100=()=>Math.random()*100;
let SPEED=1;const delay=ms=>new Promise(r=>setTimeout(r,ms/(SPEED||1)));

// DOM 引用(脚本置于 <body> 末尾,加载时 DOM 已就绪)
const boardEl=document.getElementById('board'),
      logEl=document.getElementById('log'),
      bw=document.getElementById('boardwrap'),
      fcEl=document.getElementById('forecast');

function log(m,c){const d=document.createElement('div');d.innerHTML=m;if(c)d.style.color=c;logEl.appendChild(d);logEl.scrollTop=logEl.scrollHeight;}
function show(id,on){document.getElementById(id).style.display=on?'flex':'none';}
