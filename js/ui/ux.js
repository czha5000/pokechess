// UX:新手帮助面板(❓,首次自动弹)+ 游戏速度(⚙,1×/2×/3×)。
(function(){
 // 速度
 try{SPEED=+(localStorage.getItem('wenshou_speed')||1)||1;}catch(e){}
 function mkSpeed(){const b=document.createElement('button');b.id='spdBtn';b.style.cssText='position:fixed;top:8px;right:96px;z-index:9999;background:#1a1f2e;color:#cfe;border:1px solid #2e3650;border-radius:8px;padding:4px 9px;font-size:13px;cursor:pointer;opacity:.85';b.title='游戏速度';
   const upd=()=>b.textContent='⚙ '+(typeof SPEED!=='undefined'?SPEED:1)+'×';upd();
   b.onclick=()=>{SPEED=(SPEED>=3?1:SPEED+1);try{localStorage.setItem('wenshou_speed',SPEED);}catch(e){}upd();};
   document.body.appendChild(b);}
 // 帮助
 const HELP=`<h3 style="margin:.2em 0;color:#ffcf5a">⚔ 纹兽战记 · 玩法速览</h3>
 <b>操作</b>:点选我方单位 → 蓝格<b>移动</b>(右键或"撤销移动"可退回)→ 点技能 → 点敌人弹出<b>战斗预测</b> → 确认攻击。贴脸敌人可<b>收服</b>(血越低成功率越高)。
 <b>速度交错</b>:敌我按速度<b>混排</b>行动(非整方回合)。速度差≥4 触发<b>二段攻击</b>。
 <b>属性克制</b>:×2 效果绝佳 / ×0.5 不好 / ×0 无效。普通攻击=普通系(打幽灵无效)。
 <b>状态</b>:🔥灼烧、☣中毒(可叠层)、⚡麻痹(跳过+无法反击)。
 <b>护盾</b>🛡:先扣盾再扣血(配盾击转输出)。<b>血量跨战保留</b>,休整/章末回血。
 <b>地形</b>:🌲森林=减伤+闪避;💧水=不可进(可把敌人击退入水秒杀);🔥岩浆=每回合灼伤;⛰高地=攻击+25%。
 <b>目标</b>:多数是击败全部;也有"守住N回合""派人抵达🏁格"。
 <b>遗物/流派</b>:精英☠/Boss👑 战胜三选一;围绕状态/护盾/暴击/夹击/击退等成 build。
 <b>Ascension</b>:通关后可在开始界面选更高难度层。`;
 function showHelp(){let ov=document.getElementById('helpOv');if(!ov){ov=document.createElement('div');ov.id='helpOv';ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(8,8,16,.7);display:flex;align-items:center;justify-content:center;padding:20px';
   const p=document.createElement('div');p.style.cssText='max-width:560px;max-height:84vh;overflow:auto;background:#11162a;border:2px solid #3a4360;border-radius:14px;padding:18px 20px;font-size:13.5px;line-height:1.7;color:#e8ecf4';
   p.innerHTML=HELP+'<div style="text-align:right;margin-top:12px"><button class="btn" id="helpClose" style="cursor:pointer">知道了</button></div>';
   ov.appendChild(p);ov.onclick=e=>{if(e.target===ov)ov.style.display='none';};document.body.appendChild(ov);
   p.querySelector('#helpClose').onclick=()=>ov.style.display='none';}
  ov.style.display='flex';}
 window.showHelp=showHelp;
 function mkHelp(){const b=document.createElement('button');b.id='helpBtn';b.style.cssText='position:fixed;top:8px;left:8px;z-index:9999;background:#1a1f2e;color:#cfe;border:1px solid #2e3650;border-radius:8px;padding:4px 10px;font-size:14px;cursor:pointer;opacity:.85';b.textContent='❓ 玩法';b.onclick=showHelp;document.body.appendChild(b);}
 function mkBag(){const b=document.createElement('button');b.id='bagBtn';b.style.cssText='position:fixed;top:8px;left:78px;z-index:9999;background:#1a1f2e;color:#cfe;border:1px solid #2e3650;border-radius:8px;padding:4px 10px;font-size:14px;cursor:pointer;opacity:.85';b.textContent='🎒 背包';b.onclick=()=>{if(typeof showBag==='function')showBag();};document.body.appendChild(b);}
 function init(){mkSpeed();mkHelp();mkBag();let seen=false;try{seen=localStorage.getItem('wenshou_helpseen')==='1';}catch(e){}if(!seen){setTimeout(showHelp,400);try{localStorage.setItem('wenshou_helpseen','1');}catch(e){}}}
 if(document.body)init();else document.addEventListener('DOMContentLoaded',init);
})();
