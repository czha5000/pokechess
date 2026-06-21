// 引擎内过场:打字机对白框 + 立绘 + 跳过。showCutscene([{name,pid,text}], done)。自动演示时直接跳过。
(function(){
 let _seq=null,_i=0,_done=null,_typing=false,_full='',_ti=0,_timer=null,ov,port,nameEl,txtEl,hint;
 function build(){
   ov=document.createElement('div');ov.id='csOverlay';ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(8,8,16,.74);display:none;align-items:flex-end;justify-content:center;padding:0 0 7vh';
   const b=document.createElement('div');b.style.cssText='width:min(720px,92vw);background:#11162a;border:2px solid #3a4360;border-radius:14px;padding:16px 18px;display:flex;gap:14px;box-shadow:0 10px 34px rgba(0,0,0,.55);cursor:pointer';
   port=document.createElement('div');port.style.cssText='width:74px;height:74px;flex:0 0 74px;border-radius:10px;background:#0c1020;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid #2e3650;font-size:30px';
   const r=document.createElement('div');r.style.cssText='flex:1;min-width:0';
   nameEl=document.createElement('div');nameEl.style.cssText='font-weight:800;color:#ffcf5a;margin-bottom:6px;font-size:15px';
   txtEl=document.createElement('div');txtEl.style.cssText='color:#e8ecf4;line-height:1.7;font-size:15px;min-height:3.2em';
   hint=document.createElement('div');hint.style.cssText='text-align:right;color:#8b95ad;font-size:12px;margin-top:4px';hint.textContent='▶ 点击继续';
   r.appendChild(nameEl);r.appendChild(txtEl);r.appendChild(hint);b.appendChild(port);b.appendChild(r);
   const skip=document.createElement('div');skip.textContent='跳过 ⏭';skip.style.cssText='position:fixed;top:42px;right:8px;z-index:10001;color:#cfe;background:#1a1f2e;border:1px solid #2e3650;border-radius:8px;padding:4px 10px;font-size:13px;cursor:pointer';skip.onclick=e=>{e.stopPropagation();finish();};
   ov.appendChild(b);ov.appendChild(skip);ov.onclick=advance;document.body.appendChild(ov);
 }
 function portrait(l){port.innerHTML='';if(l.pid&&typeof SPRITE==='function'){const im=document.createElement('img');im.src=SPRITE(l.pid);im.style.cssText='width:100%;height:100%;object-fit:contain';im.onerror=()=>{port.textContent='✦';};port.appendChild(im);}else{port.textContent='✦';}}
 function showLine(l){portrait(l);nameEl.textContent=l.name||'';_full=l.text||'';_ti=0;txtEl.textContent='';_typing=true;hint.style.opacity=.25;clearInterval(_timer);_timer=setInterval(()=>{_ti++;txtEl.textContent=_full.slice(0,_ti);if(_ti>=_full.length){clearInterval(_timer);_typing=false;hint.style.opacity=1;}},24);}
 function advance(){if(_typing){clearInterval(_timer);txtEl.textContent=_full;_typing=false;hint.style.opacity=1;return;}_i++;if(!_seq||_i>=_seq.length){finish();return;}showLine(_seq[_i]);}
 function finish(){clearInterval(_timer);if(ov)ov.style.display='none';const d=_done;_seq=null;_done=null;if(typeof d==='function')d();}
 window.showCutscene=function(lines,done){
   if(typeof autoOn!=='undefined'&&autoOn){if(typeof done==='function')done();return;}
   if(!lines||!lines.length){if(typeof done==='function')done();return;}
   if(!ov)build();_seq=lines;_i=0;_done=done;ov.style.display='flex';showLine(_seq[0]);
 };
})();
// 视频过场:showVideo(src,done) —— 全屏播放,可跳过;播放时暂停背景音乐。
(function(){
 window.showVideo=function(src,done){
   if(typeof autoOn!=='undefined'&&autoOn){if(typeof done==='function')done();return;}
   const ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;z-index:10002;background:#000;display:flex;align-items:center;justify-content:center';
   const v=document.createElement('video');v.src=src;v.autoplay=true;v.setAttribute('playsinline','');v.style.cssText='max-width:100%;max-height:100%';
   const skip=document.createElement('div');skip.textContent='跳过 ⏭';skip.style.cssText='position:fixed;top:12px;right:12px;z-index:10003;color:#fff;background:rgba(26,31,46,.85);border:1px solid #3a4360;border-radius:8px;padding:6px 12px;font-size:14px;cursor:pointer';
   let ended=false;function fin(){if(ended)return;ended=true;try{v.pause();}catch(e){}ov.remove();if(typeof musicSuspend==='function')musicSuspend(false);if(typeof done==='function')done();}
   skip.onclick=fin;v.onended=fin;v.onerror=fin;
   ov.appendChild(v);ov.appendChild(skip);document.body.appendChild(ov);
   if(typeof musicSuspend==='function')musicSuspend(true);
   const p=v.play();if(p&&p.catch)p.catch(()=>{v.muted=true;v.play().catch(fin);});
 };
})();
