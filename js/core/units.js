// 单位工厂 + 网格查询
function poolEntry(p){return{uid:uid++,name:p.name,pid:p.pid,type:p.type,em:p.em,key:p.key||p.type,hero:!!p.hero,lv:1,exp:0,stage:0,maxhp:p.hp,curHp:p.hp,atk:p.atk,def:p.def,spd:p.spd,skl:p.skl,lck:p.lck,mov:p.mov,rng:p.rng,skills:(LEARN[p.key||p.type]||['basic']).slice(0,2),skillUp:{}};}
// 收服归一化:按物种基础模板取数值(新兵入队),Boss 仅弱化到'高一档'
function baseByKey(k){if(typeof WILD!=='undefined'&&WILD[k])return WILD[k];if(typeof POOL!=='undefined')for(const p of POOL)if((p.key||p.type)===k)return p;if(typeof CH_ELITE!=='undefined')for(const c in CH_ELITE)if(CH_ELITE[c].key===k)return CH_ELITE[c];if(typeof CH_BOSS!=='undefined')for(const c in CH_BOSS)if(CH_BOSS[c].key===k)return CH_BOSS[c];return null;}
function isBossKey(k){if(typeof CH_BOSS==='undefined')return false;for(const c in CH_BOSS)if(CH_BOSS[c].key===k)return true;return false;}
function poolEntryFromEnemy(e,lv){const k=e.key||e.type;const b=baseByKey(k)||e;const boss=isBossKey(k);const sk=(b.skills&&b.skills.length?b.skills.slice():(e.skills&&e.skills.length?e.skills.slice():(LEARN[k]||LEARN[e.type]||['basic']).slice(0,2)));const mh=Math.max(1,Math.round((b.hp||e.maxhp)*(boss?0.85:1)));const en={uid:uid++,name:b.name||e.name,pid:b.pid||e.pid,type:b.type||e.type,em:b.em||e.em,key:k,hero:false,lv:1,exp:0,stage:0,maxhp:mh,curHp:mh,atk:Math.round((b.atk||e.atk)*(boss?0.9:1)),def:b.def||e.def,spd:b.spd||e.spd,skl:b.skl||e.skl,lck:b.lck||e.lck,mov:b.mov||e.mov,rng:b.rng||e.rng,skills:sk,skillUp:{}};return bumpEntryToLv(en,lv||1);}
// 统一的池条目升级(v0.50):战斗升级同款成长(+3hp/+1攻防技,偶数级+1速),学招 + 触发进化。收服/事件/Meta 共用,不再各写一套。
function bumpEntryToLv(m,target){target=Math.min(target||1,MAXLV);
  while(m.lv<target){m.lv++;m.maxhp+=3;m.curHp=(m.curHp!=null?m.curHp:m.maxhp)+3;m.atk+=1;m.def+=1;m.skl+=1;if(m.lv%2===0)m.spd+=1;
    const key=m.hero?'normal':(m.key||m.type);const sk=(LEARN[key]||['basic'])[m.lv-1];if(sk&&!m.skills.includes(sk)&&!m.hero)m.skills.push(sk);
    if(!m.hero&&!m.noEvo){const line=EVO[m.key||m.type];const next=(m.stage||0)+1;if(line&&STAGE_LV[next]&&line[next]&&m.lv>=STAGE_LV[next]){m.stage=next;const b=EVO_BONUS[next];m.maxhp+=b.hp;m.curHp+=b.hp;m.atk+=b.atk;m.def+=b.def;m.spd+=b.spd;m.pid=line[next].pid;m.name=line[next].name;}}}
  return m;}
// 敌人等级:各章基础 + 精英/Boss 加成(Ascension 由倍率负责,不再叠等级)
function enemyLevel(t,boss){return (ENEMY_LV[run.chapter]||4)+(boss?BOSS_LV:(t.elite?ELITE_LV:0));}
function mkEnemy(t,x,y,boss){const at=(run&&run.ascSel)||0;const aE=ascEnemyMul(at),aB=ascBossMul(at);const lv=enemyLevel(t,boss);
  // 像玩家一样按级成长(每级 hp+3 atk/def/skl+1,偶数级 spd+1)
  let hp=t.hp,atk=t.atk,def=t.def,spd=t.spd,skl=t.skl;
  for(let l=1;l<lv;l++){hp+=3;atk+=1;def+=1;skl+=1;if(l%2===0)spd+=1;}
  // v0.68 解耦:ENEMY_POWER 只管敌方【攻击】,ENEMY_HP_MUL 只管敌方【血量】。
  // 此前两者耦合(血量也乘 ENEMY_POWER),导致"降难度"会同时把敌人变脆 ⇒ 一招秒率不降反升。
  const maxhp=boss?Math.round(hp*BOSS_HP*aB):Math.round(hp*(typeof ENEMY_HP_MUL!=='undefined'?ENEMY_HP_MUL:1)*aE);
  const fatk =boss?Math.round(atk*aB):Math.round(atk*ENEMY_POWER*aE);
  return{id:uid++,name:t.name,pid:t.pid,type:t.type,em:t.em,side:'enemy',key:t.key,x,y,maxhp,hp:maxhp,atk:fatk,def,spd,skl,lck:t.lck,mov:Math.min(t.mov,(typeof ENEMY_MOV_CAP!=='undefined'?ENEMY_MOV_CAP:99)),rng:t.rng,elite:!!t.elite,isBoss:!!boss,mech:t.mech,dmgCap:t.dmgCap,bossShield:t.bossShield,acted:false,moved:false,transformed:false,shield:0,lv,exp:0,skills:t.skills.slice()};}
function mkBattleUnit(src,x,y){const ch=Math.max(1,Math.min(src.maxhp,src.curHp!=null?src.curHp:src.maxhp));return{id:uid++,src,name:src.name,pid:src.pid,type:src.type,em:src.em,side:'player',x,y,maxhp:src.maxhp,hp:ch,atk:src.atk,def:src.def,spd:src.spd,skl:src.skl,lck:src.lck,mov:src.mov,rng:src.rng,elite:false,hero:src.hero,key:src.key,noEvo:src.noEvo,stage:src.stage||0,acted:false,moved:false,transformed:false,shield:0,item:src.item||null,lv:src.lv,exp:src.exp,skills:src.skills.slice(),skillUp:src.skillUp||{}};}
function unitAt(x,y){return units.find(u=>u.x===x&&u.y===y&&u.hp>0);}
function cellEl(x,y){return boardEl.querySelector(`[data-x="${x}"][data-y="${y}"]`);}
