'use strict';
window.drawBattle = function(ctx, game, selected, aim, hover, preview, mode, touchMode=false) {
const {CARDS,HEROES,LANES}=window.DeployGame;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function poly(p,c){ctx.fillStyle=c;ctx.beginPath();p.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function line(x,y,tx,ty,c,w=1){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(tx,ty);ctx.stroke();}
function text(s,x,y,size=12,c='#e7eed4'){ctx.fillStyle=c;ctx.font='600 '+size+'px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(s,x,y);}
function circle(x,y,r,c,fill=false){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=c;ctx.fill();}else{ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();}}
function creature(u){ctx.save();ctx.translate(u.x,u.y);const tint=u.flash>0?'#fff5cf':null;ellipse(0,18,24,8,'#122e2766');const dir=u.side?-1:1;ctx.scale(dir,1);const bob=!reduced&&game.phase==='battle'&&!game.paused?Math.sin(game.time*4+u.x)*1.2:0;ctx.translate(0,bob);
 if(u.kind==='turtle'){ellipse(-14,15,10,6,'#719d85');ellipse(14,15,10,6,'#719d85');ellipse(0,0,24,20,tint||'#559c88');poly([[-17,-8],[0,-17],[18,-6],[13,12],[-12,12]],'#a9c6a0');poly([[-6,-7],[6,-9],[12,2],[0,8],[-9,2]],'#608e70');ellipse(25,1,12,11,'#accab0');ellipse(29,-3,2,3,'#203b32');}
 else if(u.kind==='fox'||u.kind==='wolf'){const wolf=u.kind==='wolf';poly([[-10,10],[-40,-12],[-29,17],[-9,20]],wolf?'#a1b5a2':'#d2834f');ellipse(0,2,21,14,tint||(wolf?'#b7c8b4':'#e2a76c'));ellipse(15,-13,15,14,tint||(wolf?'#d4ddc4':'#f1c590'));poly([[3,-22],[4,-40],[16,-25]],wolf?'#a2bfa9':'#dca26f');poly([[19,-24],[28,-36],[29,-12]],wolf?'#a2bfa9':'#dca26f');ellipse(25,-8,10,6,'#e5e2c9');ellipse(20,-17,2,3,'#263c31');}
 else if(u.kind==='bird'){poly([[-5,0],[-39,-20],[-25,8],[0,17]],'#b3c6ab');poly([[0,-5],[14,-35],[20,-6],[10,14]],'#d4c57c');ellipse(4,3,15,18,tint||'#dfcf8b');ellipse(12,-15,12,12,'#e4ddb2');poly([[22,-16],[36,-12],[22,-8]],'#a47e45');ellipse(16,-19,2,3,'#2e493a');}
 else if(u.kind==='lure'){line(0,-24,0,24,'#a8784d',7);line(-22,-4,22,-4,'#a8784d',5);ellipse(0,-21,14,14,'#d6b371');poly([[-12,-5],[13,-5],[20,17],[-19,17]],'#c87757');text('×',0,-17,17,'#553c2e');}
 else if(u.kind==='archer'){poly([[-20,22],[-10,-18],[9,-23],[22,22]],tint||'#856b7e');ellipse(3,-21,12,11,'#b8b28b');poly([[-16,-24],[2,-45],[21,-24]],'#765b73');ellipse(8,-21,4,2,'#ffbc81');line(26,21,29,-29,'#d3b984',3);ellipse(29,-33,5,7,'#f3a071');}
 else {if(u.kind==='boss'){ctx.scale(1.5,1.5);if(u.special){const lift=1-Math.max(0,u.special.wait/u.special.wind);ctx.translate(0,-5-lift*5);line(-12,-10,-30,-38-lift*12,'#e9cfad',7);poly([[-45,-57-lift*12],[-18,-57-lift*12],[-18,-33-lift*12],[-45,-33-lift*12]],'#e6b18b');}else if(u.recovery>0)ctx.scale(1.1,.85);}ellipse(0,0,23,18,tint||'#8a8c72');ellipse(19,-8,16,16,tint||'#b8ad89');poly([[9,-21],[13,-38],[20,-20]],'#e9d8ad');poly([[25,-19],[38,-31],[32,-4]],'#e9d8ad');ellipse(26,-10,3,2,'#f59c75');poly([[26,4],[29,15],[34,3]],'#f4e4bd');}
 ctx.restore();if(u.max){const w=u.kind==='boss'?68:42;ctx.fillStyle='#182e2c';ctx.fillRect(u.x-w/2,u.y-46,w,5);ctx.fillStyle=u.side?'#f0a184':'#b8e0a7';ctx.fillRect(u.x-w/2,u.y-46,w*u.hp/u.max,5);}if(u.stun>0)text('✦',u.x,u.y-53,18,'#f8e795');if(u.kind==='boss')text(u.name,u.x,u.y+44,12,'#f8c5a0');}
function background(){ctx.fillStyle='#35564b';ctx.fillRect(0,0,1000,500);ctx.fillStyle='#456653';ctx.fillRect(90,40,340,420);ctx.fillStyle='#51664f';ctx.fillRect(570,40,340,420);
 for(const y of LANES){ctx.fillStyle='#bcb78b29';ctx.fillRect(95,y-36,810,72);line(100,y,900,y,'#dce2ab16',1);}
 poly([[445,0],[432,90],[448,220],[433,330],[447,500],[558,500],[570,380],[553,250],[568,110],[555,0]],'#28585b');
 for(let i=0;i<16;i++){const y=(i*39+game.time*(reduced?0:6))%500;line(470+i%3*20,y,482+i%3*20,y-14,'#75b7ac35',2);}
 for(const y of LANES){ctx.fillStyle='#7b8a73';ctx.fillRect(426,y-38,148,76);ctx.fillStyle='#a5ae8d';ctx.fillRect(426,y-32,148,64);for(let x=430;x<570;x+=24)line(x,y-30,x,y+30,'#6f816d',2);line(425,y-37,575,y-37,'#c4c7a4',5);line(425,y+37,575,y+37,'#c4c7a4',5);}
 for(let i=0;i<44;i++){const x=(i*163+21)%1000,y=(i*83+13)%500;if(x>95&&x<910&&y>40&&y<460)continue;ellipse(x,y,19+i%3*6,10+i%4*4,i%2?'#264b3b':'#2b5142');poly([[x-8,y+2],[x-5,y-11],[x,y],[x+8,y-15],[x+5,y+6]],'#6b8b6080');}
 ellipse(65,270,35,14,'#182f2d66');poly([[42,268],[65,282],[88,268],[88,248],[42,248]],'#96a58b');poly([[65,210],[82,238],[65,261],[49,238]],'#bee8c3');poly([[65,210],[65,261],[49,238]],'#78baa4');text('我方灵核',65,305,11,'#dae9c6');
 for(const y of LANES){ellipse(938,y,23,34,'#4e3c3a');ellipse(938,y,15,27,'#b77961');ellipse(938,y,9,20,'#352b30');text('敌袭',938,y+51,11,'#ebc3a0');}
 if(game.phase==='setup'||selected>=0&&CARDS[game.hand[selected]]?.zone==='home'){ctx.fillStyle='#c4e3ac12';ctx.fillRect(105,55,300,390);ctx.strokeStyle='#c1dfaa88';ctx.setLineDash([6,6]);ctx.strokeRect(105,55,300,390);ctx.setLineDash([]);}
}

background();
if(game.wave===1){
 const m=game.mission;circle(m.x,m.y,m.r,'#d8c88528',true);circle(m.x,m.y,m.r,'#e7d38b');
 line(m.x,m.y-45,m.x,m.y+15,'#e0dab3',4);poly([[m.x,m.y-45],[m.x+35,m.y-33],[m.x,m.y-20]],'#e4ce8a');
 text('风眼 '+(game.control||0).toFixed(1)+' / 14s',m.x,m.y+m.r+22,15,'#f9e4a7');
}
if(game.wave===2&&!game.seal){circle(825,345,42,'#e6a08b');text('封印目标',825,410,14,'#f1c1a5');}
for(const f of game.fields){
 const heal=f.kind==='healfield';circle(f.x,f.y,f.r,heal?'#a5e7af25':'#f6a06b33',true);circle(f.x,f.y,f.r,heal?'#a9dfa77a':'#f6b3778a');
 text(heal?'✣':'♨',f.x,f.y,24,heal?'#c6edb5':'#ffd298');text(Math.ceil(f.life)+'s',f.x,f.y+28,12);
 if(!heal)text((game.mains.find(u=>u.id===f.sourceId)?.name||'同伴')+'的火区',f.x,f.y+44,11,'#ffd298');
}
for(const u of game.units){
 const p=u.hp>0&&u.special;if(!p)continue;
 const progress=1-Math.max(0,p.wait/p.wind);
 ctx.save();
 if(p.kind==='charge'){
  ctx.lineCap='round';line(p.from.x,p.from.y,p.x,p.y,'#fa624854',p.r*2);
  ctx.setLineDash([8,5]);line(p.from.x,p.from.y,p.x,p.y,'#ffb49b',3);ctx.setLineDash([]);
 }else{circle(p.x,p.y,p.r,'#fa624854',true);circle(p.x,p.y,p.r,'#ffb49b');}
 ctx.strokeStyle='#fff0cf';ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,p.r,-Math.PI/2,-Math.PI/2+Math.PI*2*progress);ctx.stroke();
 text(p.name+' '+Math.max(0,p.wait).toFixed(1)+'s',p.x,Math.max(22,p.y-p.r-12),16,'#ffe1ce');
 text('锁定 · 可打断',u.x,u.y+55,11,'#ffc0a6');if(u.kind==='boss'){ctx.fillStyle='#362421';ctx.fillRect(u.x-44,u.y-85,88,8);ctx.fillStyle='#ffb088';ctx.fillRect(u.x-44,u.y-85,88*progress,8);text(p.wait<=.5?'即将砸地！':'Boss 蓄力 · 躲开红圈',500,62,18,'#ffe0b4');}ctx.restore();
}
function route(path){if(!path)return;ctx.save();ctx.setLineDash([6,5]);for(let i=1;i<path.length;i++)line(path[i-1].x,path[i-1].y,path[i].x,path[i].y,'#a8e5ef',3);ctx.restore();const end=path[path.length-1];circle(end.x,end.y,18,'#a8e5ef');text('施法位置',end.x,end.y-23,12,'#c5f4ff');}
for(const o of game.orders){route(o.path);const u=game.mains.find(u=>u.id===o.casterId);if(u)text('靠近 · '+CARDS[o.card].name,u.x,u.y-62,13,'#c5f4ff');}
if(preview?.approach&&hover)route(preview.path);
for(const p of game.pending){
 const c=CARDS[p.card],caster=game.mains.find(u=>u.id===p.casterId);
 circle(p.x,p.y,p.r,'#f0c58a22',true);ctx.setLineDash([5,5]);circle(p.x,p.y,p.r,'#eacb91');ctx.setLineDash([]);
 if(p.stage==='windup'&&caster){
  circle(caster.x,caster.y,34,'#f4d693');line(caster.x,caster.y,p.x,p.y,'#f4d69380',2);
  text(c.name+' '+Math.max(0,p.wait).toFixed(1)+'s',caster.x,caster.y-65,14,'#fff0af');
 }else if(p.from){
  const t=1-Math.max(0,p.wait/p.total),x=p.from.x+(p.x-p.from.x)*t,y=p.from.y+(p.y-p.from.y)*t;
  line(p.from.x,p.from.y,x,y,'#f0d59955',3);circle(x,y,7,'#ffeba2',true);
 }
}
if(game.phase==='setup'){
 game.placed.forEach((p,i)=>{if(p&&game.activeHeroes.includes(i)){circle(p.x,p.y,32,selected===i?'#f2d898':'#b4d7aa77');creature({...HEROES[i],...p,side:0});text(HEROES[i].name,p.x,p.y+43,14);}});
}else{
 for(const u of [...game.units].filter(u=>u.hp>0).sort((a,b)=>a.y-b.y)){
  if(u.kind==='seal'){
   ellipse(u.x,u.y+25,42,14,'#2a302755');poly([[u.x,u.y-48],[u.x+30,u.y],[u.x,u.y+35],[u.x-30,u.y]],u.flash>0?'#fff1c6':'#c58891');
   circle(u.x,u.y,45,'#dfad94');text('封印 '+Math.ceil(u.hp),u.x,u.y-62,15,'#ffdbb5');
  }else creature(u);
  if(u.hero!==undefined){
   text(u.name,u.x,u.y+43,13,'#f0f0cc');
   if(u.shield>0){circle(u.x,u.y,31,'#a2e6e1');text((game.wardInfo(u)?'援盾 ':'盾 ')+Math.ceil(u.shield)+' · '+Math.ceil(u.shieldTime)+'s',u.x,u.y-56,11,'#bdf2e1');}
   if(u.hold>0)text('驻留',u.x,u.y+58,10,'#dfd19c');
  }
  if(u.side){
   if(u.kind==='boss'&&u.recovery>0)text('收招硬直 '+u.recovery.toFixed(1)+'s',u.x,u.y-68,13,'#c6f6ad');
   const statuses=[];
   if(game.active(u.controlTag))statuses.push('牵制 '+(u.controlTag.until-game.time).toFixed(1)+'s');
   if(game.active(u.burn))statuses.push('灼烧 '+(u.burn.until-game.time).toFixed(1)+'s');
   if(statuses.length)text(statuses.join(' / '),u.x,u.y+(u.kind==='boss'?62:34),11,'#ffd2a0');
   if(game.active(u.breach)){circle(u.x,u.y,35,'#f5d680');text('破绽 '+(u.breach.until-game.time).toFixed(1)+'s',u.x,u.y+53,12,'#fff0a6');}
  }
 }
}
for(const f of game.effects){
 ctx.globalAlpha=Math.max(0,f.life/f.max);
 if(f.kind==='text')text(f.text,f.x,f.y-35-(1-f.life/f.max)*20,15,'#ffe6bb');
 else if(f.kind==='line')line(f.x,f.y,f.tx,f.ty,f.side?'#ffbc9e':'#e1edac',2);
 else if(f.kind==='enemy-impact'){circle(f.x,f.y,f.r,'#ffb088');circle(f.x,f.y,f.r*(1-f.life/f.max),'#ff765b');text(f.text,f.x,f.y-45,18,'#ffe0b4');}
 else if(f.kind==='coop'){circle(f.x,f.y,f.r+12*(1-f.life/f.max),'#ffe49b');}
 else{circle(f.x,f.y,f.r*(1.1-f.life/f.max*.3),f.kind==='meteor'?'#f4b172':'#d5eab7');if(f.text)text(f.text,f.x,f.y-45,19,'#fff1b5');}
 ctx.globalAlpha=1;
}
if(mode==='capture'){
 for(const u of game.units.filter(u=>u.side&&u.hp>0&&u.capturable)){
  const p=game.capturePreview(u.id),weak=u.hp/u.max<=.5;circle(u.x,u.y,34,weak?'#ddc292':'#b4c0aa66');text(weak?Math.round(p.probability*100)+'%':'需削弱',u.x,u.y+45,15,weak?'#ffe4a1':'#cad3bc');
 }
 if(preview?.target){circle(preview.target.x,preview.target.y,40,preview.valid?'#ffe4a1':'#ef9c83');}
}else if(selected>=0&&hover&&['setup','battle'].includes(game.phase)){
 const setup=game.phase==='setup',c=setup?null:CARDS[game.hand[selected]];
 if(setup||c){
  const valid=setup?game.valid(aim.x,aim.y,'home'):preview?.valid,col=valid?'#f1dd9f':'#ed9c85';
  if(preview?.caster&&!setup){
   const u=preview.caster;ctx.setLineDash([6,8]);circle(u.x,u.y,preview.range,'#c5e8c16b');ctx.setLineDash([]);
   circle(u.x,u.y,37,preview.echo?'#d6b5ff':'#fff0a2');line(u.x,u.y,aim.x,aim.y,col,2);
   text((preview.echo?'残响 · ':'')+u.name,u.x,u.y-72,16,preview.echo?'#e6caff':'#fff0a2');
  }
  if(preview?.coop){
   for(const id of preview.coop.targets){const u=game.units.find(u=>u.id===id);if(u)circle(u.x,u.y,39,'#d4efac');}
   for(const {from,to} of preview.coop.links){
    line(from.x,from.y,to.x,to.y,'#b8e8c4',2);
    const angle=Math.atan2(to.y-from.y,to.x-from.x);
    line(to.x,to.y,to.x-Math.cos(angle-.55)*11,to.y-Math.sin(angle-.55)*11,'#b8e8c4',2);
    line(to.x,to.y,to.x-Math.cos(angle+.55)*11,to.y-Math.sin(angle+.55)*11,'#b8e8c4',2);
   }
  }
  circle(aim.x,aim.y,c?.r||32,valid?'#efdc9d18':'#e7987c22',true);
  ctx.setLineDash([6,4]);circle(aim.x,aim.y,c?.r||32,col);ctx.setLineDash([]);
  line(aim.x-8,aim.y,aim.x+8,aim.y,col);line(aim.x,aim.y-8,aim.x,aim.y+8,col);
  text(setup?HEROES[selected].name:valid?c.name:'不可施放',aim.x,Math.max(25,aim.y-(c?.r||32)-10),14,col);
 }
}
if(game.paused){ctx.fillStyle='#10221e44';ctx.fillRect(0,0,1000,500);text(touchMode?'战术暂停 · 点右上角继续':'战术暂停 · 空格继续',500,35,21,'#f3e6be');}
};

