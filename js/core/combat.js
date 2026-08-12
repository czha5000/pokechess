// 战斗数值与结算:伤害/命中/暴击/二段、经验、进化、攻击、收服、阵亡
function itemOf(u){return (u&&u.item&&typeof HELD_ITEMS!=='undefined')?HELD_ITEMS[u.item]:null;}
function applyItemStats(u){const it=itemOf(u);if(!it)return;u._rb=u._rb||{atk:0,def:0,spd:0,maxhp:0,lck:0};if(it.atk){u.atk+=it.atk;u._rb.atk+=it.atk;}if(it.def){u.def+=it.def;u._rb.def+=it.def;}if(it.spd){u.spd+=it.spd;u._rb.spd+=it.spd;}if(it.maxhp){u.maxhp+=it.maxhp;u.hp+=it.maxhp;u._rb.maxhp+=it.maxhp;}}
// 护盾(v0.56):设上限,且「盾击」类技能出手即清空 —— 护盾从"永久属性"变为"可消耗资源",
// 于是产生真实取舍:继续攒盾扛伤,还是现在花掉换一次爆发?
function shieldCapOf(u){return Math.max(1,Math.round(u.maxhp*(typeof SHIELD_CAP!=='undefined'?SHIELD_CAP:0.5)));}
function addShield(u,n){u.shield=Math.min((u.shield||0)+n,shieldCapOf(u));return u.shield;}
// 视线遮挡(v0.71):连线穿过森林或任意单位即被遮挡;站高地无视遮挡。
function losBlocked(ax,ay,bx,by){
  if(TERRAIN[ay]&&TERRAIN[ay][ax]===4)return false;            // 高地视野开阔
  const dx=bx-ax,dy=by-ay,dist=Math.abs(dx)+Math.abs(dy);
  if(dist<2)return false;
  const steps=Math.max(Math.abs(dx),Math.abs(dy))*2;
  const seen={};
  for(let i=1;i<steps;i++){
    const x=Math.round(ax+dx*i/steps),y=Math.round(ay+dy*i/steps);
    if((x===ax&&y===ay)||(x===bx&&y===by))continue;
    const k=x+','+y;if(seen[k])continue;seen[k]=1;
    if(TERRAIN[y]&&TERRAIN[y][x]===2)return true;
    if(units.some(u=>u.hp>0&&u.x===x&&u.y===y))return true;
  }
  return false;}
function coverOf(u){return TERRAIN[u.y][u.x]===2?2:0;}
function avoidTerrain(u){return TERRAIN[u.y][u.x]===2?FOREST_AVO:0;}
function adjAllies(u){return units.filter(a=>a.side===u.side&&a.hp>0&&a!==u&&Math.abs(a.x-u.x)+Math.abs(a.y-u.y)===1).length;}
// 借机攻击(ZOC,v0.58):脱离敌方邻格会挨一记免费普攻。双向生效 —— 站位从此是"承诺"而非随手挪。
function zocProvokers(u,ox,oy,nx,ny){
  if(typeof ZOC_ON==='undefined'||!ZOC_ON)return [];
  return units.filter(e=>e.side!==u.side&&e.hp>0
    && Math.abs(e.x-ox)+Math.abs(e.y-oy)===1        // 移动前贴着它
    && Math.abs(e.x-nx)+Math.abs(e.y-ny)!==1);      // 移动后脱离了
}
async function zocProvoke(u,ox,oy,nx,ny){
  const list=zocProvokers(u,ox,oy,nx,ny);let any=false;
  for(const e of list){
    if(u.hp<=0||e.hp<=0)break;
    any=true;log(`⚔ ${e.name} 借机攻击脱离的 ${u.name}!`,'#ffb24d');
    floatText(e.x,e.y,'借机!','#ffb24d');await delay(180);
    await strike(e,'basic',u);
    if(u.hp<=0){killUnit(u);break;}
  }
  return any;
}
function isFlankedSide(att,def){const dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);const ox=def.x+dx,oy=def.y+dy;return units.some(a=>a.side===att.side&&a.hp>0&&a!==att&&a.x===ox&&a.y===oy);}
function isFlanked(att,def){const dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);const ox=def.x+dx,oy=def.y+dy;return units.some(a=>a.side==='player'&&a.hp>0&&a.x===ox&&a.y===oy);}
// 击退(v0.55 重做)。旧版:推到水/边界一律即死 —— 出界与落水绕过血量/护盾/dmgCap/Boss机制,
// 且 Boss 出生点恰好贴边(ESLOTS idx3),形成"一击必杀 Boss"的退化玩法。现在:
//   · 地图边界 = 撞墙(仅少量伤害),不再是深渊
//   · 落水 = 处决:仅当目标 ≤40% 血才溺毙,否则重伤上岸(-30% 最大生命)
//   · Boss 免疫击退;精英需被击退两次才移动一格
const DROWN_EXEC=0.40, DROWN_HURT=0.30;
function pushTarget(att,def,n){
  if(def.isBoss){floatText(def.x,def.y,'岿然不动','#9aa6c8');return;}
  let dx=Math.sign(def.x-att.x),dy=Math.sign(def.y-att.y);
  if(dx&&dy){if(Math.abs(def.x-att.x)>=Math.abs(def.y-att.y))dy=0;else dx=0;}
  if(!dx&&!dy)return;
  for(let i=0;i<n;i++){
    if(def.elite){def._kr=(def._kr||0)+1;if(def._kr<2){floatText(def.x,def.y,'稳住!','#9aa6c8');return;}def._kr=0;}
    const nx=def.x+dx,ny=def.y+dy;
    if(nx<0||ny<0||nx>=COLS||ny>=ROWS){ // 边界=撞墙
      def.hp-=4;floatText(def.x,def.y,'撞墙-4','#caa765');setHp(def);if(def.hp<=0)killUnit(def);return;}
    if(TERRAIN[ny][nx]===1){ // 水=处决,不是即死
      if(def.hp<=def.maxhp*DROWN_EXEC){
        floatText(def.x,def.y,'坠落!','#43c6ff');burst(def.x,def.y,'#43c6ff');if(typeof sfxDrown==='function')sfxDrown();
        if(typeof vfxHit==='function')vfxHit(def.x,def.y,'water',false,true);def.hp=0;killUnit(def);
      }else{
        const d=Math.max(1,Math.round(def.maxhp*DROWN_HURT));def.hp-=d;
        floatText(def.x,def.y,'落水-'+d,'#43c6ff');burst(def.x,def.y,'#43c6ff');setHp(def);
        log(`${def.name} 跌入水中(生命过半,挣扎上岸)`,'#9fd3ff');if(def.hp<=0)killUnit(def);
      }
      return;}
    const occ=unitAt(nx,ny);
    if(occ){def.hp-=4;occ.hp-=4;floatText(def.x,def.y,'撞击-4','#ffd95a');if(occ.hp<=0)killUnit(occ);if(def.hp<=0)killUnit(def);return;}
    def.x=nx;def.y=ny;}}
function baseDmg(att,def,sk){const m=typeMult(sk.type,def.type);if(m===0)return{d:0,m:0};
  const _k=(typeof DEF_K!=='undefined')?DEF_K:16,_dv=def.def+coverOf(def);
  let d=Math.max(1,Math.round(att.atk*sk.mult*m*(_k/(_k+_dv))));
  if(losBlocked(att.x,att.y,def.x,def.y))d=Math.max(1,Math.round(d*(typeof LOS_DMG!=='undefined'?LOS_DMG:0.8)));d=Math.round(d*relicDmgMult(att,sk,def)*relicDmgTaken(def));if(sk.useShield)d+=(att.shield||0);if(TERRAIN[att.y]&&TERRAIN[att.y][att.x]===4)d=Math.round(d*1.25);if(isFlankedSide(att,def))d=Math.round(d*((att.side==='player'&&hasRelic('flank'))?1.5:(typeof FLANK_MULT!=='undefined'?FLANK_MULT:1.15)));if(att.side==='player'){if(hasRelic('formation'))d=Math.round(d*(1+0.12*adjAllies(att)));if(hasRelic('alpha')&&!def.acted)d=Math.round(d*1.4);}return{d:Math.max(1,d),m};}
function hitRate(att,def,sk){
  if(att.side==='player'){const fx=relicHitFix();if(fx!=null)return fx;} // 赌徒骰:命中率锁定
  const _los=losBlocked(att.x,att.y,def.x,def.y)?(typeof LOS_HIT!=='undefined'?LOS_HIT:20):0;
  return Math.max(0,Math.min(100,Math.round(sk.hit+att.skl*2-(def.spd*2+def.lck)-avoidTerrain(def)-_los+relicHitAdd(att,sk)+(itemOf(att)?(itemOf(att).hit||0):0))));}
function critRate(att,def,sk){return Math.max(0,Math.min(100,Math.round(sk.crit+att.skl-def.lck+relicCritAdd(att)+(itemOf(att)?(itemOf(att).crit||0):0))));}
function doubles(att,def){return (att.spd-def.spd)>=DOUBLE_GAP;}
function reachOf(u){let mr=0;u.skills.forEach(s=>{const sk=SKILLS[s];if(sk&&(sk.kind==='atk'||sk.kind==='aoe'))mr=Math.max(mr,sk.rb||0);});return u.rng+mr;}
function mtag(m){return m===0?'<span style="color:#cfcfcf">无效 ×0</span>':m>1?'<span style="color:#7fe0a0">效果绝佳 ×'+m+'</span>':m<1?'<span style="color:#ff9a9a">效果不好 ×'+m+'</span>':'普通 ×1';}

// 状态/异常:施加 + 每回合结算。灼烧=固定伤×回合;中毒=层数(伤害=层数,每回合-1);麻痹=概率跳过。
function applyStatus(u,kind){const st=STATUS[kind];if(!st)return;u.eff=u.eff||{};
  if(st.stack){u.eff[kind]=(u.eff[kind]||0)+(st.apply||3);}else{u.eff[kind]=st.turns;}
  floatText(u.x,u.y,st.icon+st.name+(st.stack?'×'+u.eff[kind]:''),st.col);burst(u.x,u.y,st.col);log(`${u.name} 陷入【${st.name}】${st.stack?' '+u.eff[kind]+'层':''}`,st.col);if(typeof sfxStatus==='function')sfxStatus(kind);}
function statusTick(u){let ticked=false;
  if(TERRAIN[u.y]&&TERRAIN[u.y][u.x]===3){u.hp-=4;ticked=true;floatText(u.x,u.y,'-4🔥','#e8602c');log(`${u.name} 陷在岩浆里,灼伤 4`,'#e8602c');}
  if(u.eff){
    if(u.eff.burn>0){const st=STATUS.burn;u.hp-=st.dmg;ticked=true;floatText(u.x,u.y,'-'+st.dmg+st.icon,st.col);log(`${u.name}【灼烧】损失 ${st.dmg}`,st.col);if(--u.eff.burn<=0)delete u.eff.burn;}
    if(u.eff.poison>0){const st=STATUS.poison,dmg=u.eff.poison;u.hp-=dmg;ticked=true;floatText(u.x,u.y,'-'+dmg+st.icon,st.col);log(`${u.name}【中毒】${u.eff.poison}层,损失 ${dmg}`,st.col);if(--u.eff.poison<=0)delete u.eff.poison;}
  }
  if(ticked)setHp(u);
  if(u.hp<=0){killUnit(u);return{ticked:true,dead:!(units.includes(u)&&u.hp>0),skip:false};}
  let skip=false;
  if(u.eff&&u.eff.para>0){if(--u.eff.para<=0)delete u.eff.para;if(rand100()<STATUS.para.skip){skip=true;ticked=true;floatText(u.x,u.y,'⚡麻痹!','#f2c233');log(`${u.name} 被麻痹,无法行动!`,'#f2c233');}}
  return{ticked,dead:false,skip};}

// 经验与伤害脱钩(v0.50):固定基数×等级差修正(以强凌弱自然衰减),击杀+6,精英/Boss×1.3。治「越强升越快」正反馈。
function expGain(u,tgt,kill){const lvd=((tgt&&tgt.lv)||1)-u.lv;const mod=Math.max(0.3,Math.min(2,1+lvd*0.25));let v=12*mod;if(kill)v+=6;if(tgt&&tgt.elite)v*=1.3;return Math.round(v);}
function gainExp(u,amt){if(u.side!=='player'||u.lv>=MAXLV)return;u.exp+=Math.round(amt*relicExpMult());
  while(u.lv<MAXLV&&u.exp>=THRESH[u.lv]){u.exp-=THRESH[u.lv];u.lv++;u.maxhp+=3;u.hp+=3;u.atk+=1;u.def+=1;u.skl+=1;if(u.lv%2===0)u.spd+=1;learnNext(u);floatText(u.x,u.y,'Lv.'+u.lv,'#ffd95a');if(typeof sfxLevel==='function')sfxLevel();tryEvolve(u);setHp(u);}}
function tryEvolve(u){if(u.hero||u.noEvo)return;const line=EVO[u.key||u.type];if(!line)return;let g=0;
  while(g++<3){const next=(u.stage||0)+1;const req=STAGE_LV[next];if(!req||!line[next]||u.lv<req)break;
    u.stage=next;const b=EVO_BONUS[next];u.maxhp+=b.hp;u.hp+=b.hp;u.atk+=b.atk;u.def+=b.def;u.spd+=b.spd;const old=u.name;u.pid=line[next].pid;u.name=line[next].name;
    log(`✦✦ ${old} 进化为 <b>${u.name}</b>！属性大幅提升`,'#ffd95a');burst(u.x,u.y,'#ffd95a');floatText(u.x,u.y,'进化!','#ffd95a');if(typeof sfxEvolve==='function')sfxEvolve();render();}}
function learnNext(u){let key=u.transformed?u.type:(u.hero?'normal':(u.key||u.type));const list=LEARN[key]||LEARN[u.type]||['basic'];const sk=list[u.lv-1];if(sk&&!u.skills.includes(sk)&&!u.hero)u.skills.push(sk),log(`✦ ${u.name} 升 Lv.${u.lv}，学会【${SKILLS[sk].name}】！`,'#c78bff');else log(`✦ ${u.name} 升 Lv.${u.lv}！`,'#c78bff');}

async function strike(att,sk,def){let s=SKILLS[sk]||sk;const _uk=(typeof sk==='string')?sk:null;const _up=(_uk&&att.skillUp&&att.skillUp[_uk])||0;if(_up)s=Object.assign({},s,{mult:s.mult*(1+0.2*_up)});
  if(att._charged&&s.mult){s=Object.assign({},s,{mult:s.mult*CHARGE_MULT});att._charged=0;floatText(att.x,att.y,'蓄力释放!','#ffd95a');}const times=(doubles(att,def)&&s.kind!=='aoe')?2:1;let dealt=0;let _spent=false;
  for(let i=0;i<times;i++){if(def.hp<=0)break;await lunge(att,def.x,def.y);const b=baseDmg(att,def,s);
    if(b.m===0){floatText(def.x,def.y,'无效','#cfcfcf');log(`${att.name}【${s.name}】对 ${def.name} 无效(免疫)`,'#9aa6c8');await delay(280);break;}
    if(rand100()>=hitRate(att,def,s)){floatText(def.x,def.y,'Miss','#cfcfcf');log(`${att.name}【${s.name}】未命中`,'#9aa6c8');if(typeof sfxMiss==='function')sfxMiss();bw.classList.add('shake');setTimeout(()=>bw.classList.remove('shake'),200);await delay(280);continue;}
    const isCrit=rand100()<critRate(att,def,s);let d=isCrit?b.d*CRITX:b.d;if(def.dmgCap&&d>def.dmgCap){d=def.dmgCap;floatText(def.x,def.y,'硬鳞!','#9fd3ff');}const ab=Math.min(def.shield||0,d);if(ab>0){def.shield-=ab;floatText(def.x,def.y,'-'+ab+'🛡','#9fd3ff');}def.hp-=(d-ab);dealt+=d;if(typeof sfxHit==='function')sfxHit(isCrit,b.m>1);if(typeof vfxHit==='function')vfxHit(def.x,def.y,s.type,isCrit,b.m>1);
    flashCell(def.x,def.y);burst(def.x,def.y,isCrit?'#ffd95a':b.m>1?'#7fe0a0':(s.type?TCOLOR[s.type]:'#fff'));floatText(def.x,def.y,'-'+d+(isCrit?' 暴击!':b.m>1?'!':''),isCrit?'#ffd95a':b.m>1?'#7fe0a0':'#fff');setHp(def);
    bw.classList.add('shake');setTimeout(()=>bw.classList.remove('shake'),320);
    log(`${att.name}【${s.name}】命中 ${def.name} <b>${d}</b>${isCrit?'（暴击!）':b.m>1?'（效果绝佳!）':b.m<1?'（效果不好）':''}`,att.side==='player'?'#eef2ff':'#ff9a9a');
    if(att.side==='enemy'&&relicThorns()>0&&att.hp>0){const tt=relicThorns();att.hp-=tt;floatText(att.x,att.y,'-'+tt+' 荆棘','#7fe0a0');setHp(att);if(att.hp<=0)killUnit(att);}
    if(s.useShield&&!_spent&&(att.shield||0)>0){_spent=true;att.shield=0;floatText(att.x,att.y,'护盾已消耗','#9fd3ff');}
    if(s.inflict&&def.hp>0&&rand100()<s.inflict.chance)applyStatus(def,s.inflict.kind);
    relicOnHit(att,def);const _it=itemOf(att);if(_it&&_it.onHit&&def.hp>0&&rand100()<_it.onHit.chance)applyStatus(def,_it.onHit.kind);
    await delay(320);}
  if(s.recoil&&dealt>0&&att.hp>0){const rc=Math.max(1,Math.round(dealt*s.recoil));att.hp-=rc;floatText(att.x,att.y,'-'+rc+' 反作用','#ff8a8a');setHp(att);log(`${att.name} 受【${s.name}】反作用力 ${rc}`,'#ff8a8a');if(att.hp<=0)killUnit(att);}
  if(def.hp>0&&(s.knock||(att.side==='player'&&hasRelic('knockback')))){pushTarget(att,def,s.knock||1);render();}
  if(s.gainShield&&att.hp>0){addShield(att,s.gainShield);if(typeof floatText==='function')floatText(att.x,att.y,'+'+s.gainShield+'🛡','#9fd3ff');setHp(att);}
  return dealt;}
async function execAttack(att,sk,tgt){if(busy)return;busy=true;let s=SKILLS[sk];{const _up=(att.skillUp&&att.skillUp[sk])||0;if(_up)s=Object.assign({},s,{mult:s.mult*(1+0.2*_up)});}clearSel();if(TERRAIN[att.y]&&TERRAIN[att.y][att.x]===4&&typeof floatText==='function')floatText(att.x,att.y,'⛰高地+25%','#caa765');
  if(s.kind==='aoe'){const list=[tgt,...units.filter(e=>e.side==='enemy'&&e.hp>0&&e!==tgt&&Math.abs(e.x-tgt.x)+Math.abs(e.y-tgt.y)===1)];let dealt=0,hitN=0;await lunge(att,tgt.x,tgt.y);bw.classList.add('shake');setTimeout(()=>bw.classList.remove('shake'),320);
    for(const d of list){const b=baseDmg(att,d,s);if(b.m===0){floatText(d.x,d.y,'无效','#cfcfcf');continue;}if(rand100()>=hitRate(att,d,s)){floatText(d.x,d.y,'Miss','#cfcfcf');continue;}const ab=Math.min(d.shield||0,b.d);if(ab>0)d.shield-=ab;d.hp-=(b.d-ab);dealt+=b.d;hitN++;flashCell(d.x,d.y);burst(d.x,d.y,b.m>1?'#7fe0a0':'#fff');floatText(d.x,d.y,'-'+b.d+(b.m>1?'!':''),b.m>1?'#7fe0a0':'#fff');setHp(d);if(typeof vfxHit==='function')vfxHit(d.x,d.y,s.type,false,b.m>1);}
    log(`${att.name}【横扫】命中 ${list.length} 个`,'#eef2ff');await delay(360);const dead=list.filter(d=>d.hp<=0);dead.forEach(d=>killUnit(d));if(dead.length){relicOnKill(att);setHp(att);}if(hitN>0)gainExp(att,Math.round(expGain(att,tgt,false)*(1+0.4*(hitN-1)))+dead.length*6);busy=false;finishAct(att);return;}
  let dealt=await strike(att,sk,tgt);
  if(tgt.hp<=0){killUnit(tgt);relicOnKill(att);setHp(att);gainExp(att,expGain(att,tgt,true));}
  else{const dist=Math.abs(att.x-tgt.x)+Math.abs(att.y-tgt.y);
    // 被夹击的目标无法反击(等价"背击"的设计意图,且完全可见)
    const flanked=(typeof FLANK_NOCOUNTER!=='undefined'&&FLANK_NOCOUNTER)&&isFlankedSide(att,tgt);
    if(flanked)log(`${tgt.name} 被夹击,无法反击!`,'#ffd95a');
    if(!flanked&&dist<=tgt.rng&&att.hp>0&&!(tgt.eff&&tgt.eff.para)){await delay(110);await strike(tgt,'basic',att);if(att.hp<=0)killUnit(att);}
    if(dealt>0)gainExp(att,expGain(att,tgt,false));}
  busy=false;finishAct(att);}
// —— 新动作类型(v0.61)——
const CHARGE_MULT=1.8;
function execCharge(u){clearSel();u._charged=1;u.acted=true;
  floatText(u.x,u.y,'蓄力中…','#ffd95a');burst(u.x,u.y,'#ffd95a');
  log(`${u.name} 开始蓄力,下次攻击 ×${CHARGE_MULT}`,'#ffd95a');render();advanceInit();}
function execSwap(u,tgt){clearSel();
  const tx=tgt.x,ty=tgt.y;tgt.x=u.x;tgt.y=u.y;u.x=tx;u.y=ty;
  log(`${u.name} 与 ${tgt.name} 交换位置`,'#9fd3ff');
  floatText(u.x,u.y,'换位','#9fd3ff');floatText(tgt.x,tgt.y,'换位','#9fd3ff');
  u.acted=true;render();advanceInit();}
function execHeal(att,sk,tgt){if(busy)return;const s=SKILLS[sk];clearSel();floatText(tgt.x,tgt.y,'+'+s.amount,'#6affa0');burst(tgt.x,tgt.y,'#6affa0');tgt.hp=Math.min(tgt.maxhp,tgt.hp+s.amount);setHp(tgt);log(`${att.name}【治疗】恢复 ${tgt.name} ${s.amount}`,'#6affa0');if(typeof sfxHeal==='function')sfxHeal();if(typeof vfxHeal==='function')vfxHeal(tgt.x,tgt.y);att.acted=true;render();advanceInit();}
function capChance(att,def){return Math.min(0.95,(def.elite?0.25:0.70)*(1-def.hp/def.maxhp)+relicCapAdd());}
async function doCapture(att,def){if(busy)return;busy=true;clearSel();const ch=capChance(att,def);log(`${att.name} 贴脸收服 ${def.name}（${Math.round(ch*100)}%）…`,'#ffcf5a');await lunge(att,def.x,def.y);
  if(Math.random()<ch){battleCaptures.push(def);burst(def.x,def.y,'#ffd95a');floatText(def.x,def.y,'收服!','#ffd95a');log(`✦ 收服成功！<b>${def.name}</b> 战后入池`,'#7fe0a0');if(typeof sfxCapture==='function')sfxCapture();def.hp=0;await delay(450);killUnit(def,true);gainExp(att,15);}
  else{floatText(def.x,def.y,'激怒!','#ff8a8a');burst(def.x,def.y,'#ff5252');log(`✕ 失败！${def.name} 激怒反扑`,'#ff8a8a');await delay(250);await strike(def,'basic',att);if(att.hp<=0)killUnit(att);}
  busy=false;finishAct(att);}
function killUnit(u,cap){if(u.side==='player'){
    if(relicReviveAvailable()){run.reviveUsed=true;u.hp=Math.max(1,Math.ceil(u.maxhp/2));log(`🪶 复活羽毛救起 ${u.name}(半血)！`,'#ffd95a');floatText(u.x,u.y,'复活!','#ffd95a');setHp(u);return;}
    if(u.src)u.src._dead=true;log(`💀 ${u.name} 阵亡——永久出池(牌库-1)`,'#ff8a8a');}else if(!cap)log(`${u.name} 被击败`,'#9aa6c8');units=units.filter(x=>x!==u);}
// 脱战回复(v0.69):没出手 + 邻格无敌人 = 喘一口气
function tryRestHeal(u){
  if(!u||u.hp<=0||u._didAttack)return false;
  const rh=(typeof REST_HEAL!=='undefined')?REST_HEAL:0;
  if(rh<=0||u.hp>=u.maxhp)return false;
  if(units.some(e=>e.side!==u.side&&e.hp>0&&Math.abs(e.x-u.x)+Math.abs(e.y-u.y)<=1))return false;
  const amt=Math.max(1,Math.round(u.maxhp*rh));
  u.hp=Math.min(u.maxhp,u.hp+amt);
  floatText(u.x,u.y,'+'+amt+' 喘息','#6affa0');setHp(u);
  if(u.side==='player')log(`${u.name} 脱离接战,恢复 ${amt} 点生命`,'#7fe0a0');
  return true;}
function finishAct(att){const a=units.find(u=>u===att);if(a){a.acted=true;a._didAttack=true;}render();advanceInit();}
function checkEndSilent(){return units.filter(u=>u.side==='enemy'&&u.hp>0).length===0||units.filter(u=>u.side==='player'&&u.hp>0).length===0;}
function checkEnd(){const f=units.filter(u=>u.side==='enemy'&&u.hp>0).length,a=units.filter(u=>u.side==='player'&&u.hp>0).length;
  if(a===0){runOver(false);return true;}
  if(f===0){onBattleWin();return true;}return false;}
