// 音乐总控:菜单/结算放人声主题曲(theme.mp3),进游戏放器乐版(theme_inst.mp3)。一个 🎵 键统一开关。
// 默认音乐/音效均为开;首次点击前浏览器禁止出声,故显示一次"点击开启声音"提示。
(function(){
 let _on=true,_unlocked=false,_cur=null,_menuA=null,_gameA=null,_hint=null,_suspended=false;
 try{_on=localStorage.getItem('wenshou_music')!=='0';}catch(e){}
 function menuA(){if(!_menuA){_menuA=new Audio('assets/theme.mp3');_menuA.loop=true;_menuA.volume=0.55;}return _menuA;}
 function gameA(){if(!_gameA){_gameA=new Audio('assets/theme_inst.mp3');_gameA.loop=true;_gameA.volume=0.42;}return _gameA;}
 function isMenu(){return (typeof stage==='undefined')||stage==='intro'||stage==='over';}
 function director(){
   if(typeof stopMusic==='function')stopMusic();
   if(_suspended){menuA().pause();gameA().pause();return;}
   if(!_on||!_unlocked){menuA().pause();gameA().pause();_cur=null;return;}
   if(isMenu()){if(_cur!=='menu'){gameA().pause();menuA().play().catch(()=>{});_cur='menu';}}
   else{if(_cur!=='game'){menuA().pause();gameA().play().catch(()=>{});_cur='game';}}
 }
 function unlock(){_unlocked=true;if(_hint){_hint.remove();_hint=null;}director();}
 window.musicSuspend=function(b){_suspended=b;if(b){menuA().pause();gameA().pause();}else{_cur=null;director();}};
 document.addEventListener('pointerdown',unlock,{once:true});
 document.addEventListener('keydown',unlock,{once:true});
 setInterval(director,500);
 function mk(){
   const b=document.createElement('button');b.id='musBtn';b.title='音乐开关';b.style.cssText='position:fixed;top:8px;right:52px;z-index:9999;background:#1a1f2e;color:#cfe;border:1px solid #2e3650;border-radius:8px;padding:4px 9px;font-size:14px;cursor:pointer;opacity:.85';
   const upd=()=>b.textContent=_on?'🎵':'🔕';upd();
   b.onclick=()=>{_on=!_on;try{localStorage.setItem('wenshou_music',_on?'1':'0');}catch(e){}upd();_unlocked=true;_cur=null;director();};
   document.body.appendChild(b);
   // 首次提示(点击任意处开启声音)
   _hint=document.createElement('div');_hint.textContent='🔊 点击任意处 开启音乐与音效';
   _hint.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9999;background:#ffcf5a;color:#1a1020;font-weight:700;font-size:13px;padding:6px 14px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.4);animation:mmPulse 1.2s ease-in-out infinite';
   const st=document.createElement('style');st.textContent='@keyframes mmPulse{0%,100%{opacity:.7}50%{opacity:1}}';document.head.appendChild(st);
   document.body.appendChild(_hint);
 }
 if(document.body)mk();else document.addEventListener('DOMContentLoaded',mk);
})();
