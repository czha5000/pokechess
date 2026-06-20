// 8-bit 程序化音效(Web Audio,无素材/离线/无版权)。所有函数全局,调用方 typeof 守卫即可。
let _actx=null, _sfxMuted=false;
try{_sfxMuted=localStorage.getItem('wenshou_mute')==='1';}catch(e){}
function _ac(){if(!_actx){try{_actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}return _actx;}
function _blip(freq,dur,type,vol,glideTo,delay){const ac=_ac();if(!ac||_sfxMuted)return;const t=ac.currentTime+(delay||0);const o=ac.createOscillator(),g=ac.createGain();o.type=type||'square';o.frequency.setValueAtTime(freq,t);if(glideTo)o.frequency.exponentialRampToValueAtTime(Math.max(20,glideTo),t+dur);g.gain.setValueAtTime(vol||0.18,t);g.gain.exponentialRampToValueAtTime(0.0008,t+dur);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+dur+0.02);}
function _noise(dur,vol,filt,delay){const ac=_ac();if(!ac||_sfxMuted)return;const t=ac.currentTime+(delay||0);const n=Math.max(1,Math.floor(ac.sampleRate*dur));const buf=ac.createBuffer(1,n,ac.sampleRate);const d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const src=ac.createBufferSource();src.buffer=buf;const g=ac.createGain();g.gain.value=vol||0.18;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=filt||1800;src.connect(f).connect(g).connect(ac.destination);src.start(t);}

function sfxSelect(){_blip(640,0.05,'square',0.10);}
function sfxClick(){_blip(880,0.045,'square',0.09);}
function sfxMove(){_blip(420,0.05,'triangle',0.08,520);}
function sfxHit(crit,sup){_noise(crit?0.16:0.09,crit?0.24:0.16,crit?3200:1500);if(crit)_blip(170,0.22,'sawtooth',0.22,55);else if(sup)_blip(560,0.1,'square',0.16,820);}
function sfxMiss(){_blip(320,0.12,'sine',0.10,150);}
function sfxHeal(){_blip(520,0.16,'sine',0.14,900);}
function sfxShield(){_blip(300,0.13,'triangle',0.14,520);}
function sfxStatus(kind){if(kind==='para'){_blip(130,0.07,'square',0.18);_blip(130,0.07,'square',0.16,null,0.09);}else if(kind==='burn'){_noise(0.18,0.16,2600);}else{_blip(180,0.16,'sawtooth',0.14,90);}}
function sfxLevel(){[523,659,784].forEach((f,i)=>_blip(f,0.1,'square',0.16,null,i*0.08));}
function sfxEvolve(){_blip(220,0.5,'sawtooth',0.18,900);[660,880,1175].forEach((f,i)=>_blip(f,0.12,'square',0.14,null,0.18+i*0.1));}
function sfxCapture(){[440,587,740,880].forEach((f,i)=>_blip(f,0.12,'square',0.16,null,i*0.09));}
function sfxDrown(){_noise(0.35,0.2,700);_blip(420,0.35,'sine',0.14,70);}
function sfxWin(){[523,659,784,1047].forEach((f,i)=>_blip(f,0.16,'square',0.2,null,i*0.13));}
function sfxLose(){[392,330,262,196].forEach((f,i)=>_blip(f,0.22,'triangle',0.18,null,i*0.16));}

// 首次用户手势激活/恢复音频上下文(浏览器策略)
function _sfxResume(){const ac=_ac();if(ac&&ac.state==='suspended')ac.resume();}
document.addEventListener('pointerdown',_sfxResume,{passive:true});
document.addEventListener('keydown',_sfxResume,{passive:true});
// 右上角静音按钮
(function(){function mk(){const b=document.createElement('button');b.id='sfxBtn';b.style.cssText='position:fixed;top:8px;right:8px;z-index:9999;background:#1a1f2e;color:#cfe;border:1px solid #2e3650;border-radius:8px;padding:4px 9px;font-size:14px;cursor:pointer;opacity:.85';
  const upd=()=>b.textContent=_sfxMuted?'🔇':'🔊';upd();
  b.onclick=()=>{_sfxMuted=!_sfxMuted;try{localStorage.setItem('wenshou_mute',_sfxMuted?'1':'0');}catch(e){}upd();if(!_sfxMuted){_sfxResume();sfxClick();}};
  document.body.appendChild(b);}
  if(document.body)mk();else document.addEventListener('DOMContentLoaded',mk);})();
