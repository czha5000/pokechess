// 打斗特效:按招数属性出不同粒子/光环 + 暴击/克制闪屏 + 治疗/溺杀。纯 DOM+CSS,轻量。
(function(){
 const css=`
 .vpart{position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:50%;pointer-events:none;transform:translate(-50%,-50%);animation:vfxPart .5s ease-out forwards;z-index:6}
 @keyframes vfxPart{to{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.3);opacity:0}}
 .vring{position:absolute;left:50%;top:50%;width:38px;height:38px;border-radius:50%;border:3px solid #fff;pointer-events:none;z-index:6;animation:vfxRing .45s ease-out forwards}
 @keyframes vfxRing{from{transform:translate(-50%,-50%) scale(.2);opacity:.9}to{transform:translate(-50%,-50%) scale(2.3);opacity:0}}
 .vslash{position:absolute;left:50%;top:50%;width:48px;height:5px;background:linear-gradient(90deg,transparent,#fff,transparent);pointer-events:none;z-index:6;transform:translate(-50%,-50%) rotate(-35deg);animation:vfxFade .3s ease-out forwards}
 .vbolt{position:absolute;left:50%;top:50%;width:4px;height:46px;background:linear-gradient(#fff,#f2c233);pointer-events:none;z-index:6;transform:translate(-50%,-50%) rotate(12deg);box-shadow:0 0 8px #f2c233;animation:vfxFade .25s ease-out forwards}
 .vheal{position:absolute;left:50%;top:55%;color:#6affa0;font-weight:800;font-size:14px;pointer-events:none;z-index:6;animation:vfxHealP .8s ease-out forwards}
 @keyframes vfxHealP{to{transform:translate(-50%,-26px);opacity:0}}
 @keyframes vfxFade{from{opacity:.85}to{opacity:0}}
 #vflash{position:absolute;inset:0;pointer-events:none;z-index:40;opacity:0}
 @keyframes vfxScreen{from{opacity:.45}to{opacity:0}}
 `;
 const st=document.createElement('style');st.textContent=css;(document.head||document.documentElement).appendChild(st);
 function cell(x,y){return (typeof cellEl==='function')?cellEl(x,y):null;}
 function col(t){return (typeof TCOLOR!=='undefined'&&TCOLOR[t])?TCOLOR[t]:'#dfe6ff';}
 function add(c,el,ms){c.appendChild(el);setTimeout(()=>el.remove(),ms);}
 window.vfxHit=function(x,y,type,crit,sup){const c=cell(x,y);if(!c)return;c.style.position='relative';
   const color=type?col(type):'#dfe6ff';
   const r=document.createElement('div');r.className='vring';r.style.borderColor=crit?'#ffd95a':(sup?'#7fe0a0':color);add(c,r,460);
   const n=crit?13:7;for(let i=0;i<n;i++){const p=document.createElement('div');p.className='vpart';p.style.background=crit?'#ffd95a':color;const a=Math.random()*6.283,d=14+Math.random()*(crit?28:16);p.style.setProperty('--dx',(Math.cos(a)*d).toFixed(1)+'px');p.style.setProperty('--dy',(Math.sin(a)*d).toFixed(1)+'px');add(c,p,520);}
   if(type==='electric'){const z=document.createElement('div');z.className='vbolt';z.style.transform='translate(-50%,-50%) rotate('+(Math.random()*40-20)+'deg)';add(c,z,260);}
   else if(!type||type==='normal'||type==='fighting'||type==='rock'){const sl=document.createElement('div');sl.className='vslash';sl.style.transform='translate(-50%,-50%) rotate('+(Math.random()*50-55)+'deg)';add(c,sl,320);}
   if(crit||sup)vflash(crit?'#ffd95a':'#7fe0a0',crit?.45:.28);
 };
 window.vfxHeal=function(x,y){const c=cell(x,y);if(!c)return;c.style.position='relative';for(let i=0;i<5;i++){const p=document.createElement('div');p.className='vheal';p.textContent='＋';p.style.left=(28+Math.random()*44)+'%';p.style.animationDelay=(i*0.06)+'s';add(c,p,860);}};
 function vflash(color,op){const bw=document.getElementById('boardwrap');if(!bw)return;bw.style.position=bw.style.position||'relative';let f=document.getElementById('vflash');if(!f){f=document.createElement('div');f.id='vflash';bw.appendChild(f);}f.style.background=color;f.style.animation='none';void f.offsetWidth;f.style.animation='vfxScreen .35s ease-out forwards';}
 window.vfxFlash=vflash;
})();
