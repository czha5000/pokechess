// 敌方 AI:选最优招/目标、移动寻路
function aiScore(e,tgt){let best=-1;e.skills.forEach(k=>{const s=SKILLS[k];if(s.kind!=='atk'&&s.kind!=='aoe')return;const v=typeMult(s.type,tgt.type)*s.mult;if(v>best)best=v;});return best;}
function aiPick(e,tgt){let best='basic',bv=-1;e.skills.forEach(k=>{const s=SKILLS[k];if(s.kind!=='atk'&&s.kind!=='aoe')return;const v=typeMult(s.type,tgt.type)*s.mult;if(v>bv){bv=v;best=k;}});return best;}
async function aiAct(e){let ts=units.filter(u=>u.side==='player'&&u.hp>0);if(!ts.length)return;const hit=ts.filter(t=>aiScore(e,t)>0);if(hit.length)ts=hit;
  ts.sort((a,b)=>{const ma=aiScore(e,a),mb=aiScore(e,b);if(mb!==ma)return mb-ma;return a.hp-b.hp;});
  const tgt=ts[0],sk=aiPick(e,tgt),s=SKILLS[sk],reach=e.rng+(s.rb||0);
  if(Math.abs(e.x-tgt.x)+Math.abs(e.y-tgt.y)>reach){const p=bfsToward(e,tgt);if(p){e.x=p.x;e.y=p.y;render();await delay(140);}}
  if(Math.abs(e.x-tgt.x)+Math.abs(e.y-tgt.y)<=reach){await strike(e,sk,tgt);if(tgt.hp<=0)killUnit(tgt);
    else{const dd=Math.abs(e.x-tgt.x)+Math.abs(e.y-tgt.y);if(dd<=tgt.rng&&e.hp>0){const back=await strike(tgt,'basic',e);if(e.hp<=0)killUnit(e);else gainExp(tgt,back);}}}}
function bfsToward(e,tgt){const seen={[e.x+','+e.y]:0},q=[{x:e.x,y:e.y,d:0}];
  while(q.length){const c=q.shift();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=c.x+dx,ny=c.y+dy,k=nx+','+ny;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;if(TERRAIN[ny][nx]===1)continue;if(unitAt(nx,ny))continue;if(seen[k]!==undefined)continue;const nd=c.d+1;if(nd>e.mov)continue;seen[k]=nd;q.push({x:nx,y:ny,d:nd});}}
  let bk=null,bd=1e9;for(const k in seen){const[x,y]=k.split(',').map(Number);if(x===e.x&&y===e.y)continue;const dd=Math.abs(x-tgt.x)+Math.abs(y-tgt.y);if(dd<bd){bd=dd;bk=k;}}if(!bk)return null;const[bx,by]=bk.split(',').map(Number);return{x:bx,y:by};}
