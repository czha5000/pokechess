// 单位工厂 + 网格查询
function poolEntry(p){return{uid:uid++,name:p.name,pid:p.pid,type:p.type,em:p.em,key:p.key||p.type,hero:!!p.hero,lv:1,exp:0,stage:0,maxhp:p.hp,curHp:p.hp,atk:p.atk,def:p.def,spd:p.spd,skl:p.skl,lck:p.lck,mov:p.mov,rng:p.rng,skills:[ (LEARN[p.key||p.type]||['basic'])[0] ]};}
function poolEntryFromEnemy(e){const k=e.type;const sk=(LEARN[k]||['basic']).slice(0,2);const mh=e.maxhp||e.hp;return{uid:uid++,name:e.name,pid:e.pid,type:e.type,em:e.em,key:k,hero:false,lv:1,exp:0,stage:0,maxhp:mh,curHp:mh,atk:e.atk,def:e.def,spd:e.spd,skl:e.skl,lck:e.lck,mov:e.mov,rng:e.rng,skills:sk};}
// 敌人等级:各章基础 + 精英/Boss 加成(Ascension 由倍率负责,不再叠等级)
function enemyLevel(t,boss){return (ENEMY_LV[run.chapter]||4)+(boss?BOSS_LV:(t.elite?ELITE_LV:0));}
function mkEnemy(t,x,y,boss){const at=(run&&run.ascSel)||0;const aE=ascEnemyMul(at),aB=ascBossMul(at);const lv=enemyLevel(t,boss);
  // 像玩家一样按级成长(每级 hp+3 atk/def/skl+1,偶数级 spd+1)
  let hp=t.hp,atk=t.atk,def=t.def,spd=t.spd,skl=t.skl;
  for(let l=1;l<lv;l++){hp+=3;atk+=1;def+=1;skl+=1;if(l%2===0)spd+=1;}
  const maxhp=boss?Math.round(hp*BOSS_HP*aB):Math.round(hp*ENEMY_POWER*aE);
  const fatk =boss?Math.round(atk*aB):Math.round(atk*ENEMY_POWER*aE);
  return{id:uid++,name:t.name,pid:t.pid,type:t.type,em:t.em,side:'enemy',x,y,maxhp,hp:maxhp,atk:fatk,def,spd,skl,lck:t.lck,mov:t.mov,rng:t.rng,elite:!!t.elite,mech:t.mech,dmgCap:t.dmgCap,bossShield:t.bossShield,acted:false,moved:false,transformed:false,shield:0,lv,exp:0,skills:t.skills.slice()};}
function mkBattleUnit(src,x,y){const ch=Math.max(1,Math.min(src.maxhp,src.curHp!=null?src.curHp:src.maxhp));return{id:uid++,src,name:src.name,pid:src.pid,type:src.type,em:src.em,side:'player',x,y,maxhp:src.maxhp,hp:ch,atk:src.atk,def:src.def,spd:src.spd,skl:src.skl,lck:src.lck,mov:src.mov,rng:src.rng,elite:false,hero:src.hero,key:src.key,stage:src.stage||0,acted:false,moved:false,transformed:false,shield:0,item:src.item||null,lv:src.lv,exp:src.exp,skills:src.skills.slice()};}
function unitAt(x,y){return units.find(u=>u.x===x&&u.y===y&&u.hp>0);}
function cellEl(x,y){return boardEl.querySelector(`[data-x="${x}"][data-y="${y}"]`);}
