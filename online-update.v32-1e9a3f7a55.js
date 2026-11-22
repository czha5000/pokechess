(() => {
 'use strict';
 if(!window.WENSHOU_RELEASE)return;
 const current=window.WENSHOU_RELEASE,bar=document.createElement('div');bar.id='online-version';
 bar.style.cssText='font-size:11px;color:#b5c6b7;padding:6px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
 const label=document.createElement('span'),button=document.createElement('button');label.textContent='线上版本 '+current;button.hidden=true;button.textContent='更新到新版';bar.append(label,button);document.querySelector('.footer').after(bar);
 let latest=null,busy=false;
 const safe=()=>typeof window.wenshouCanUpdate==='function'&&window.wenshouCanUpdate();
 function render(){button.hidden=!latest;button.disabled=!safe();if(latest)button.textContent=safe()?'更新到新版':'新版已准备 · 本局结束后更新';}
 button.onclick=()=>{if(!safe())return;const url=new URL(location.href);url.searchParams.set('v',latest);location.assign(url.href);};
 async function check(){if(busy||document.hidden)return;busy=true;try{const response=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(response.ok){const data=await response.json();if(typeof data.version==='string'&&/^v\d+-[a-f0-9]{10}$/.test(data.version)&&data.version!==current)latest=data.version;}}catch{}finally{busy=false;render();}}
 setInterval(check,60000);setInterval(render,1000);document.addEventListener('visibilitychange',check);window.addEventListener('focus',check);check();
})();
