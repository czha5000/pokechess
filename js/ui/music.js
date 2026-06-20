// 原创 chiptune 主题(宝可梦风:双脉冲平行三度和声 + 弹跳琶音贝斯 + 极简鼓点)。原创作曲,非复制。
(function(){
const NF={C2:65.41,E2:82.41,F2:87.31,G2:98,A2:110,B2:123.47,C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196,A3:220,
 E4:329.63,F4:349.23,G4:392,A4:440,B4:493.88,C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880,B5:987.77,C6:1046.5,D6:1174.66,E6:1318.51};
const SCALE=['E4','F4','G4','A4','B4','C5','D5','E5','F5','G5','A5','B5','C6','D6','E6'];
function third(n){const i=SCALE.indexOf(n);return i>=2?SCALE[i-2]:null;} // 下方三度和声(宝可梦双脉冲招牌)
const BPM=158,BEAT=60/BPM;
const MELODY=[
 ['E5',.5],['G5',.5],['C6',.5],['G5',.5],['E5',.5],['C5',.5],['E5',1],
 ['D5',.5],['G5',.5],['B5',.5],['G5',.5],['D5',.5],['B4',.5],['D5',1],
 ['C5',.5],['E5',.5],['A5',.5],['E5',.5],['C5',.5],['A4',.5],['C5',1],
 ['B4',.5],['E5',.5],['G5',.5],['E5',.5],['B4',.5],['G4',.5],['B4',1],
 ['A5',.5],['F5',.5],['A5',.5],['C6',.5],['A5',.5],['F5',.5],['C5',1],
 ['G5',.5],['E5',.5],['C6',.5],['E5',.5],['G5',1],['C5',1],
 ['F5',.5],['A5',.5],['C6',.5],['A5',.5],['F5',1],['A5',1],
 ['G5',.5],['B5',.5],['D6',.5],['B5',.5],['G5',1],['D5',1],
 ['C6',1],['G5',.5],['E5',.5],['G5',1],['C6',1],
 ['B5',1],['G5',.5],['D5',.5],['G5',2],
 ['A5',1],['E5',.5],['C5',.5],['E5',2],
 ['G5',1],['E5',.5],['B4',.5],['E5',2],
 ['A5',1],['C6',.5],['A5',.5],['F5',2],
 ['E5',.5],['G5',.5],['C6',.5],['E6',.5],['C6',2],
 ['A5',1],['F5',.5],['C5',.5],['F5',2],
 ['D6',.5],['B5',.5],['G5',.5],['D5',.5],['G5',2]
];
const CHORDS=['C','G','Am','Em','F','C','F','G','C','G','Am','Em','F','C','F','G'];
const R3={C:['C2','G2','C3'],G:['G2','D3','G3'],Am:['A2','E3','A3'],Em:['E2','B2','E3'],F:['F2','C3','F3']};
const BASS=[];CHORDS.forEach(c=>{const r=R3[c];[0,1,2,1,0,1,2,1].forEach(k=>BASS.push(r[k]));}); // 8分弹跳贝斯
let _mOn=false,_mTimer=null,_mGain=null;
try{_mOn=localStorage.getItem('wenshou_music')!=='0';}catch(e){}
function ctx(){return (typeof _ac==='function')?_ac():null;}
function gain(){const ac=ctx();if(!ac)return null;if(!_mGain){_mGain=ac.createGain();_mGain.gain.value=0.5;_mGain.connect(ac.destination);}return _mGain;}
function voice(f,t,d,type,v){const ac=ctx();if(!ac)return;const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+0.008);g.gain.exponentialRampToValueAtTime(0.0001,t+d*0.9);o.connect(g).connect(gain());o.start(t);o.stop(t+d);}
function tick(t,soft){const ac=ctx();if(!ac)return;const dur=soft?0.025:0.07,n=Math.floor(ac.sampleRate*dur),b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);const s=ac.createBufferSource();s.buffer=b;const g=ac.createGain();g.gain.value=soft?0.01:0.03;const f=ac.createBiquadFilter();f.type=soft?'highpass':'lowpass';f.frequency.value=soft?8000:200;s.connect(f).connect(gain());s.start(t);}
function schedule(){const ac=ctx();if(!ac||!_mOn)return;const t0=ac.currentTime+0.06;let t=t0;
 MELODY.forEach(([n,b])=>{if(NF[n]){voice(NF[n],t,b*BEAT,'square',0.085);const h=third(n);if(h&&NF[h])voice(NF[h],t,b*BEAT,'square',0.045);}t+=b*BEAT;}); // 旋律+平行三度
 t=t0;BASS.forEach(n=>{if(NF[n])voice(NF[n],t,BEAT*0.46,'triangle',0.11);t+=BEAT*0.5;});
 for(let bar=0;bar<16;bar++){tick(t0+bar*4*BEAT,false);tick(t0+(bar*4+1)*BEAT,true);tick(t0+(bar*4+3)*BEAT,true);} // 极简:每小节1底鼓+2轻镲
 _mTimer=setTimeout(schedule,(64*BEAT-0.05)*1000);}
function startMusic(){const g=gain();if(!g)return;if(typeof _sfxResume==='function')_sfxResume();g.gain.value=0.5;if(!_mTimer)schedule();}
function stopMusic(){if(_mGain)_mGain.gain.value=0;if(_mTimer){clearTimeout(_mTimer);_mTimer=null;}}
window.startMusic=startMusic;window.stopMusic=stopMusic;
})();
