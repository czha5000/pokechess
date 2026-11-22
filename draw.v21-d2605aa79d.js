'use strict';
window.paintBattleAsset = function(ctx, game, asset) {
const {LANES}=window.DeployGame;
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
 else if(u.kind==='sprout'){ellipse(0,3,18,21,tint||'#91b77b');ellipse(0,-17,29,12,'#9f8bb8');ellipse(-13,-21,6,4,'#e7d6ee');ellipse(10,-19,5,4,'#e7d6ee');line(-6,-36,0,-27,'#a0d792',4);poly([[0,-28],[5,-44],[18,-40],[12,-28]],'#b9d99b');ellipse(9,0,2,3,'#293c30');ellipse(-5,0,2,3,'#293c30');}
 else if(u.kind==='badger'){ellipse(0,5,25,17,tint||'#9c9eac');poly([[-23,2],[-17,-20],[0,-28],[21,-15],[24,4]],'#747f95');poly([[-17,-15],[0,-25],[16,-14],[3,-6]],'#c3c4bc');ellipse(23,5,15,11,'#c9c9bc');poly([[12,-3],[31,0],[28,5],[13,3]],'#4d5968');ellipse(29,1,2,2,'#182832');ellipse(-13,21,8,5,'#69798a');ellipse(13,21,8,5,'#69798a');}
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
}

// Asset baking only: Phaser uploads these once, never a whole-frame canvas texture.
if(asset){
 if(asset==='terrain')background();
 else {const hit=asset.endsWith('-hit'),kind=asset.replace(/-hit$/,'');ctx.save();ctx.translate(80,112);creature({kind:kind.replace('boss-windup','boss'),flash:hit?1:0,name:'',x:0,y:0,side:0,special:kind==='boss-windup'?{wait:0,wind:1}:null});ctx.restore();}
 return;
}
};
