// 单位工厂 + 网格查询
function poolEntry(p){return{uid:uid++,name:p.name,pid:p.pid,type:p.type,em:p.em,key:p.key||p.type,hero:!!p.hero,lv:1,exp:0,stage:0,maxhp:p.hp,curHp:p.hp,atk:p.atk,def:p.def,spd:p.spd,skl:p.skl,lck:p.lck,mov:p.mov,rng:p.rng,skills:[ (LEARN[p.key||p.type]||['basic'])[0] ]};}
function poolEntryFromEnemy(e){const k=e.type;const sk=(LEARN[k]||['basic']).slice(0,2);const mh=e.maxhp||e.hp;return{uid:uid++,name:e.name,pid:e.pid,type:e.type,em:e.em,key:k,hero:false,lv:1,exp:0,stage:0,maxhp:mh,curHp:mh,atk:e.atk,def:e.def,spd:e.spd,skl:e.skl,lck:e.lck,mov:e.mov,rng:e.rng,skills:sk};}
function mkEnemy(t,x,y,boss){const chS=CH_SCALE[run.chapter];
  const hp=boss?Math.round(t.hp*BOSS_HP):Math.round(t.hp*chS*ENEMY_POWER);
  const atk=boss?Math.round(t.atk*ENEMY_POWER):Math.round(t.atk*chS*ENEMY_POWER);
  const def=boss?t.def:Math.round(t.def*chS);
  return{id:uid++,name:t.name,pid:t.pid,type:t.type,em:t.em,side:'enemy',x,y,maxhp:hp,hp,atk,def,spd:t.spd,skl:t.skl,lck:t.lck,mov:t.mov,rng:t.rng,elite:!!t.elite,acted:false,moved:false,transformed:false,lv:1,exp:0,skills:t.skills.slice()};}
function mkBattleUnit(src,x,y){const ch=Math.max(1,Math.min(src.maxhp,src.curHp!=null?src.curHp:src.maxhp));return{id:uid++,src,name:src.name,pid:src.pid,type:src.type,em:src.em,side:'player',x,y,maxhp:src.maxhp,hp:ch,atk:src.atk,def:src.def,spd:src.spd,skl:src.skl,lck:src.lck,mov:src.mov,rng:src.rng,elite:false,hero:src.hero,key:src.key,stage:src.stage||0,acted:false,moved:false,transformed:false,lv:src.lv,exp:src.exp,skills:src.skills.slice()};}
function unitAt(x,y){return units.find(u=>u.x===x&&u.y===y&&u.hp>0);}
function cellEl(x,y){return boardEl.querySelector(`[data-x="${x}"][data-y="${y}"]`);}
