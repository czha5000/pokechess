(() => {
'use strict';
const W=1000,H=500,TAU=Math.PI*2;
const color=s=>parseInt(s.replace('#','').slice(0,6),16);

// The renderer reads a snapshot of references; only app.js advances the rules.
window.createBattleRenderer=function(canvas,advance,readView,onSuspend){
 if(!window.Phaser)throw new Error('战场引擎未加载，请刷新页面。');
 class BattleScene extends Phaser.Scene {
  constructor(){super('battle');this.actors=new Map();this.labels=new Map();this.model=null;}
  create(){
   const game=readView().game;
   const terrain=this.textures.createCanvas('terrain',W,H);
   window.paintBattleAsset(terrain.getContext(),{...game,time:0,phase:'battle'},'terrain');terrain.refresh();
   this.add.image(0,0,'terrain').setOrigin(0).setDepth(0);
   for(const base of ['turtle','fox','bird','sprout','badger','wolf','lure','archer','raider','brute','boss','boss-windup'])for(const kind of [base,base+'-hit']){
    const texture=this.textures.createCanvas(kind,160,192);
    window.paintBattleAsset(texture.getContext(),{...game,time:0,phase:'setup'},kind);texture.refresh();
   }
   this.ground=this.add.graphics().setDepth(1);
   this.signals=this.add.graphics().setDepth(900);
   this.selection=this.add.graphics().setDepth(1100);
   this.shade=this.add.rectangle(0,0,W,H,0x10221e,.24).setOrigin(0).setDepth(1200).setVisible(false);
   this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
   canvas.dataset.engine='phaser';canvas.dataset.renderer=this.game.renderer.type===Phaser.WEBGL?'webgl':'canvas';
   canvas.dataset.ready='true';
   this.events.once('shutdown',()=>{this.actors.clear();this.labels.clear();});
  }
  label(key,value,x,y,size=13,tint='#eee7d0',alpha=1,depth=1000){
   let t=this.labels.get(key);
   if(!t){t=this.add.text(0,0,'',{fontFamily:'Microsoft YaHei, sans-serif',fontSize:size,fontStyle:'bold',color:tint,stroke:'#172c29',strokeThickness:3,resolution:2}).setOrigin(.5,1);this.labels.set(key,t);}
   const text=String(value??'');if(t.text!==text)t.setText(text);
   if(t.style.fontSize!==size+'px')t.setFontSize(size);
   if(t.style.color!==tint)t.setColor(tint);
   t.setPosition(x,y).setAlpha(alpha).setDepth(depth).setVisible(true);t.seen=true;
  }
  circle(g,x,y,r,tint,alpha=1,fill=false,width=2){
   if(!Number.isFinite(r)||r<=0)return;
   if(fill)g.fillStyle(color(tint),alpha).fillCircle(x,y,r);
   else g.lineStyle(width,color(tint),alpha).strokeCircle(x,y,r);
  }
  line(g,x,y,tx,ty,tint,alpha=1,width=2){g.lineStyle(width,color(tint),alpha).lineBetween(x,y,tx,ty);}
  dashed(g,x,y,tx,ty,tint){const d=Math.hypot(tx-x,ty-y);for(let s=0;s<d;s+=13){const e=Math.min(d,s+7);this.line(g,x+(tx-x)*s/d,y+(ty-y)*s/d,x+(tx-x)*e/d,y+(ty-y)*e/d,tint,.85,2);}}
  route(key,path){if(!path?.length)return;for(let i=1;i<path.length;i++)this.dashed(this.selection,path[i-1].x,path[i-1].y,path[i].x,path[i].y,'#a8e5ef');const end=path[path.length-1];this.circle(this.selection,end.x,end.y,18,'#a8e5ef');this.label(key,'施法位置',end.x,end.y-23,12,'#c5f4ff');}
  actor(u,game,touchMode){
   const base=u.kind==='boss'&&u.special?'boss-windup':this.textures.exists(u.kind)?u.kind:'raider',texture=base+(u.flash>0?'-hit':'');
   let sprite=this.actors.get(u.id);
   if(!sprite){sprite=this.add.image(0,0,texture).setOrigin(.5,112/192);this.actors.set(u.id,sprite);}
   if(sprite.texture.key!==texture)sprite.setTexture(texture);
   const bob=!this.reduced.matches&&game.phase==='battle'?Math.sin(game.time*4+u.x)*1.2:0;
   sprite.setPosition(u.x,u.y+bob).setFlipX(!!u.side).setDepth(20+u.y).setVisible(true);sprite.seen=true;
   sprite.setScale(u.kind==='boss'&&u.recovery>0?1.1:1,u.kind==='boss'&&u.recovery>0?.85:1);
   if(u.max){const w=u.kind==='boss'?68:44,y=u.y-(u.kind==='boss'?64:46);this.signals.fillStyle(0x142723).fillRoundedRect(u.x-w/2-1,y-1,w+2,7,2);this.signals.fillStyle(u.side?0xf0a184:0x9cddb5).fillRect(u.x-w/2,y,w*Math.max(0,u.hp/u.max),5);}
   if(u.stun>0)this.label(u.id+'stun','✦',u.x,u.y-52,18,'#ffe298');
   if(u.hero!==undefined||u.kind==='boss')this.label(u.id+'name',u.name,u.x,u.y+43,12,u.side?'#f6c1a3':'#f2eed6');
   if(u.hero!==undefined){
    if(u.shield>0){this.circle(this.signals,u.x,u.y,31,'#9ce2df',.8);this.label(u.id+'shield',(game.wardInfo(u)?'援盾 ':'盾 ')+Math.ceil(u.shield),u.x,u.y-55,11,'#c0f2e5');}
    if(!touchMode)this.label(u.id+'dodge',u.dodgeCooldown>0?'闪避 '+u.dodgeCooldown.toFixed(1)+'s':'闪避就绪',u.x,u.y+57,10,'#b8efc6');
   }
   if(u.side){
    if(u.trait){
     const traits={rage:'怒 '+(u.rage||0)+'/3',crystal:(u.vulnerableUntil||0)>game.time?'虚弱 +40%':'晶甲 '+(u.crystalHits||0)+'/4',regen:u.regenerating?'回生 +6/s':'回生',guard:'护链',priest:'祭司',ambush:'伏击'};
     this.label(u.id+'trait',traits[u.trait]||u.trait,u.x,u.y-61,12,'#efdaab');
     this.circle(this.ground,u.x,u.y,29,u.trait==='crystal'?'#b9e8ff':u.trait==='regen'?'#b6df9d':'#d0b0e7',.8);
    }
    if(u.recovery>0)this.label(u.id+'recover','反击 '+u.recovery.toFixed(1)+'s',u.x,u.y+65,13,'#c5f6a9');
    const states=[];
    if((u.empoweredUntil||0)>game.time)states.push('强化');
    if(game.active(u.controlTag))states.push('牵制');
    if(game.active(u.poison))states.push('毒 '+u.poison.stacks);
    if(game.active(u.burn))states.push('灼烧');
    if(game.active(u.breach)){states.push('破绽');this.circle(this.signals,u.x,u.y,35,'#f5d680');}
    if(states.length)this.label(u.id+'states',states.join(' · '),u.x,u.y+(u.kind==='boss'?58:34),11,'#ffd2a0');
   }
  }
  update(time,delta){
   advance(time,delta);
   const v=readView(),{game,selected,aim,hover,preview,mode,touchMode,dodgePreview}=v;
   if(this.model!==game){for(const s of this.actors.values())s.destroy();for(const t of this.labels.values())t.destroy();this.actors.clear();this.labels.clear();this.model=game;}
   for(const t of this.labels.values())t.seen=false;
   for(const s of this.actors.values())s.seen=false;
   this.ground.clear();this.signals.clear();this.selection.clear();
   const G=this.ground,S=this.signals,P=this.selection,{CARDS,HEROES}=window.DeployGame;
   if(game.phase==='setup'||selected>=0&&CARDS[game.hand[selected]]?.zone==='home'){
    G.fillStyle(0xc4e3ac,.08).fillRect(105,55,300,390);G.lineStyle(2,0xc1dfaa,.5).strokeRect(105,55,300,390);
   }
   if(game.wave===1){const m=game.mission;this.circle(G,m.x,m.y,m.r,'#d8c885',.16,true);this.circle(G,m.x,m.y,m.r,'#e7d38b');this.line(G,m.x,m.y-45,m.x,m.y+15,'#e0dab3',1,4);G.fillStyle(0xe4ce8a).fillTriangle(m.x,m.y-45,m.x+35,m.y-33,m.x,m.y-20);this.label('objective','风眼 '+(game.control||0).toFixed(1)+' / 14s',m.x,m.y+m.r+22,15,'#f9e4a7');}
   if(game.wave===2&&!game.seal){this.circle(G,825,345,42,'#e6a08b');this.label('objective','封印目标',825,410,14,'#f1c1a5');}
   for(const u of game.units.filter(u=>u.hp>0&&u.trait==='guard')){const t=game.units.find(t=>t.id===u.guardTarget&&t.hp>0);if(t&&game.guardFor(t)===u){this.line(G,u.x,u.y,t.x,t.y,'#9ad9ff',.8,3);this.label(u.id+'link','护链 '+Math.ceil(u.guardBank),(u.x+t.x)/2,(u.y+t.y)/2-15,12,'#bdeaff');}}
   game.fields.forEach((f,i)=>{const heal=f.kind==='healfield',c=heal?'#a5e7af':'#f6a06b';this.circle(G,f.x,f.y,f.r,c,.16,true);this.circle(G,f.x,f.y,f.r,c,.6);this.label('field'+i,(heal?'恢复 ':'火区 ')+Math.ceil(f.life)+'s',f.x,f.y+28,12,heal?'#c6edb5':'#ffd298');});
   for(const u of game.units){const p=u.hp>0&&u.special;if(!p)continue;
    const progress=Phaser.Math.Clamp(1-p.wait/p.wind,0,1),c=p.kind==='chant'?'#c79aef':'#ff795e';
    if(p.kind==='charge'){this.line(G,p.from.x,p.from.y,p.x,p.y,c,.24,p.r*2);this.circle(G,p.from.x,p.from.y,p.r,c,.24,true);this.circle(G,p.x,p.y,p.r,c,.24,true);this.dashed(S,p.from.x,p.from.y,p.x,p.y,'#ffb49b');}
    else this.circle(G,p.x,p.y,p.r,c,.24,true);
    this.circle(S,p.x,p.y,p.r,'#ffb49b',1,false,2);S.lineStyle(4,0xffedd5).beginPath().arc(p.x,p.y,p.r,-Math.PI/2,-Math.PI/2+TAU*progress,false).strokePath();
    this.circle(S,u.x,u.y,38,c);this.label(u.id+'threat',Math.max(0,p.wait).toFixed(1)+'s',p.x,Math.max(22,p.y-p.r-12),20,'#fff0dc');
   }
   for(const o of game.orders){this.route(o.id+'route',o.path);const u=game.mains.find(u=>u.id===o.casterId);if(u)this.label(o.id+'order','靠近 · '+CARDS[o.card].name,u.x,u.y-76,12,'#c5f4ff');}
   if(preview?.approach&&hover)this.route('preview-route',preview.path);
   for(const p of game.pending){const c=CARDS[p.card],caster=game.mains.find(u=>u.id===p.casterId);this.circle(G,p.x,p.y,p.r,'#f0c58a',.12,true);this.circle(S,p.x,p.y,p.r,'#eacb91',.7);
    if(p.stage==='windup'&&caster){this.circle(S,caster.x,caster.y,34,'#f4d693');this.line(S,caster.x,caster.y,p.x,p.y,'#f4d693',.5);this.label(p.id+'wind',c.name+' '+Math.max(0,p.wait).toFixed(1)+'s',caster.x,caster.y-65,13,'#fff0af');}
    else if(p.from){const t=1-Math.max(0,p.wait/p.total),x=p.from.x+(p.x-p.from.x)*t,y=p.from.y+(p.y-p.from.y)*t;this.line(S,p.from.x,p.from.y,x,y,'#f0d599',.35,3);this.circle(S,x,y,7,'#ffeba2',1,true);}
   }
   if(game.phase==='setup')game.placed.forEach((p,i)=>{if(p&&game.activeHeroes.includes(i)){this.circle(G,p.x,p.y,32,selected===i?'#f2d898':'#b4d7aa',.7);this.actor({...HEROES[i],...p,id:'setup'+i,hero:i,side:0},game,touchMode);}});
   else for(const u of game.units.filter(u=>u.hp>0)){
    if(u.kind==='seal'){G.fillStyle(0x2a3027,.4).fillEllipse(u.x,u.y+25,84,28);S.fillStyle(u.flash>0?0xfff1c6:0xc58891).fillPoints([{x:u.x,y:u.y-48},{x:u.x+30,y:u.y},{x:u.x,y:u.y+35},{x:u.x-30,y:u.y}],true);this.circle(S,u.x,u.y,45,'#dfad94');this.label(u.id+'seal','封印 '+Math.ceil(u.hp),u.x,u.y-62,15,'#ffdbb5');}
    else this.actor(u,game,touchMode);
   }
   game.effects.forEach((f,i)=>{const a=Math.max(0,f.life/f.max),key='fx'+i;
    if(f.kind==='text')this.label(key,f.text,f.x,f.y-35-(1-a)*20,15,'#ffe6bb',a);
    else if(f.kind==='line')this.line(S,f.x,f.y,f.tx,f.ty,f.side?'#ffbc9e':'#e1edac',a);
    else{this.circle(S,f.x,f.y,f.kind==='coop'?f.r+12*(1-a):f.r*(1.1-a*.3),f.kind==='enemy-impact'?'#ff765b':f.kind==='meteor'?'#f4b172':'#d5eab7',a);if(f.text)this.label(key,f.text,f.x,f.y-45,17,'#fff1b5',a);}
   });
   if(mode==='capture'){
    for(const u of game.units.filter(u=>u.side&&u.hp>0&&u.capturable)){const p=game.capturePreview(u.id),weak=u.hp/u.max<=.5;this.circle(P,u.x,u.y,34,weak?'#ddc292':'#b4c0aa');this.label(u.id+'capture',weak?Math.round(p.probability*100)+'%':'需削弱',u.x,u.y+45,15,'#ffe4a1');}
    if(preview?.target)this.circle(P,preview.target.x,preview.target.y,40,preview.valid?'#ffe4a1':'#ef9c83');
   }else if(selected>=0&&hover&&['setup','battle'].includes(game.phase)){
    const setup=game.phase==='setup',c=setup?null:CARDS[game.hand[selected]];
    if(setup||c){const valid=setup?game.valid(aim.x,aim.y,'home'):preview?.valid,col=valid?'#f1dd9f':'#ed9c85';
     if(preview?.caster&&!setup){const u=preview.caster;this.circle(P,u.x,u.y,preview.range,'#c5e8c1',.4);this.circle(P,u.x,u.y,37,preview.echo?'#d6b5ff':'#fff0a2');this.line(P,u.x,u.y,aim.x,aim.y,col);this.label('caster',(preview.echo?'残响 · ':'')+u.name,u.x,u.y-72,15,'#fff0a2');}
     if(preview?.coop){for(const id of preview.coop.targets){const u=game.units.find(u=>u.id===id);if(u)this.circle(P,u.x,u.y,39,'#d4efac');}for(const {from,to} of preview.coop.links)this.line(P,from.x,from.y,to.x,to.y,'#b8e8c4');}
     this.circle(P,aim.x,aim.y,c?.r||32,col,.1,true);this.circle(P,aim.x,aim.y,c?.r||32,col);if(c?.centerRadius)this.circle(P,aim.x,aim.y,c.centerRadius,'#ffae75');this.line(P,aim.x-8,aim.y,aim.x+8,aim.y,col);this.line(P,aim.x,aim.y-8,aim.x,aim.y+8,col);this.label('aim',setup?HEROES[selected].name:valid?c.name:'不可施放',aim.x,Math.max(25,aim.y-(c?.r||32)-10),14,col);
    }
   }
   if(dodgePreview?.caster){const p=dodgePreview,u=p.caster,col=p.valid?'#b5f0d2':'#f2a187';this.circle(P,u.x,u.y,85,'#b5f0d2',.3);this.line(P,u.x,u.y,p.x,p.y,col,1,3);this.circle(P,p.x,p.y,24,col);this.label('dodge-preview',p.valid?'松手闪避':p.reason,p.x,Math.max(25,p.y-34),13,col);}
   this.shade.setVisible(game.paused);if(game.paused)this.label('pause',touchMode?'战术暂停 · 点右上角继续':'战术暂停 · 空格继续',500,35,21,'#f3e6be',1,1201);
   for(const [key,s]of this.actors)if(!s.seen){s.destroy();this.actors.delete(key);}
   for(const [key,t]of this.labels)if(!t.seen){t.setVisible(false);t.idle=(t.idle||0)+1;if(t.idle>120){t.destroy();this.labels.delete(key);}}else t.idle=0;
  }
 }
 const forcedCanvas=new URLSearchParams(location.search).get('renderer')==='canvas';
 // Phaser requires an explicit type for an existing canvas. Probe that same canvas,
 // so unsupported devices use Canvas without an external CDN or a second game loop.
 let context=null;
 if(!forcedCanvas){try{context=canvas.getContext('webgl',{alpha:false,antialias:true,stencil:true,premultipliedAlpha:true});}catch{}}
 const engine=new Phaser.Game({type:context?Phaser.WEBGL:Phaser.CANVAS,context:context||undefined,canvas,width:W,height:H,backgroundColor:'#132725',banner:false,audio:{noAudio:true},input:{mouse:false,touch:false,keyboard:false,gamepad:false},scale:{mode:Phaser.Scale.NONE,width:W,height:H},render:{antialias:true,roundPixels:false},fps:{target:60,smoothStep:false},scene:BattleScene});
 const lost=e=>{e.preventDefault();onSuspend('画面连接中断，已暂停；恢复后继续。');};
 canvas.addEventListener('webglcontextlost',lost);
 const observer=new ResizeObserver(()=>{canvas.style.width='100%';canvas.style.height='100%';});observer.observe(canvas.parentElement);
 return {engine,destroy(){observer.disconnect();canvas.removeEventListener('webglcontextlost',lost);engine.destroy(false);}};
};
})();
