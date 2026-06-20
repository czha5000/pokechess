// 战斗数值与结算:伤害/命中/暴击/二段、经验、进化、攻击、收服、阵亡
function coverOf(u){return TERRAIN[u.y][u.x]===2?2:0;}
function avoidTerrain(u){return TERRAIN[u.y][u.x]===2?FOREST_AVO:0;}
function baseDmg(att,def,sk){const m=typeMult(sk.type,def.type);if(m===0)return{d:0,m:0};let d=Math.max(1,Math.round(att.atk*sk.mult*m)-def.def-coverOf(def));d=Math.round(d*relicDmgMult(att,sk)*relicDmgTaken(def));return{d:Math.max(1,d),m};}
function hitRate(att,def,sk){return Math.max(0,Math.min(100,Math.round(sk.hit+att.skl*2-(def.spd*2+def.lck)-avoidTerrain(def)+relicHitAdd(att,sk))));}
function critRate(att,def,sk){return Math.max(0,Math.min(100,Math.round(sk.crit+att.skl-def.lck+relicCritAdd(att))));}
function doubles(att,def){return (att.spd-def.spd)>=DOUBLE_GAP;}
function reachOf(u){let mr=0;u.skills.forEach(s=>{const sk=SKILLS[s];if(sk&&(sk.kind==='atk'||sk.kind==='aoe'))mr=Math.max(mr,sk.rb);});return u.rng+mr;}
function mtag(m){return m===0?'<span style="color:#cfcfcf">无效 ×0</span>':m>1?'<span style="color:#7fe0a0">效果绝佳 ×'+m+'</span>':m<1?'<span style="color:#ff9a9a">效果不好 ×'+m+'</span>':'普通 ×1';}

// 状态/异常:施加 + 每回合结算。灼烧=固定伤×回合;中毒=层数(伤害=层数,每回合-1);麻痹=概率跳过。
function applyStatus(u,kind){const st=STATUS[kind];if(!st)return;u.eff=u.eff||{};
  if(st.stack){u.eff[kind]=(u.eff[kind]||0)+(st.apply||3);}else{u.eff[kind]=st.turns;}
  floatText(u.x,u.y,st.icon+st.name+(st.stack?'×'+u.eff[kind]:''),st.col);burst(u.x,u.y,st.col);log(`${u.name} 陷入【${st.name}】${st.stack?' '+u.eff[kind]+'层':''}`,st.col);}
function statusTick(u){let ticked=false;
  if(u.eff){
    if(u.eff.burn>0){const st=STATUS.burn;u.hp-=st.dmg;ticked=true;floatText(u.x,u.y,'-'+st.dmg+st.icon,st.col);log(`${u.name}【灼烧】损失 ${st.dmg}`,st.col);if(--u.eff.burn<=0)delete u.eff.burn;}
    if(u.eff.poison>0){const st=STATUS.poison,dmg=u.eff.poison;u.hp-=dmg;ticked=true;floatText(u.x,u.y,'-'+dmg+st.icon,st.col);log(`${u.name}【中毒】${u.eff.poison}层,损失 ${dmg}`,st.col);if(--u.eff.poison<=0)delete u.eff.poison;}
    if(ticked)setHp(u);
    if(u.hp<=0){killUnit(u);return{ticked:true,dead:!(units.includes(u)&&u.hp>0),skip:false};}}
  let skip=false;
  if(u.eff&&u.eff.para>0){if(--u.eff.para<=0)delete u.eff.para;if(rand100()<STATUS.para.skip){skip=true;ticked=true;floatText(u.x,u.y,'⚡麻痹!','#f2c233');log(`${u.name} 被麻痹,无法行动!`,'#f2c233');}}
  return{ticked,dead:false,skip};}

function gainExp(u,amt){if(u.side!=='player'||u.lv>=MAXLV)return;u.exp+=Math.round(amt*relicExpMult());
  while(u.lv<MAXLV&&u.exp>=THRESH[u.lv]){u.exp-=THRESH[u.lv];u.lv++;u.maxhp+=3;u.hp+=3;u.atk+=1;u.def+=1;u.skl+=1;if(u.lv%2===0)u.spd+=1;learnNext(u);floatText(u.x,u.y,'Lv.'+u.lv,'#ffd95a');tryEvolve(u);setHp(u);}}
function tryEvolve(u){if(u.hero)return;const line=EVO[u.key||u.type];if(!line)return;let g=0;
  while(g++<3){const next=(u.stage||0)+1;const req=STAGE_LV[next];if(!req||!line[next]||u.lv<req)break;
    u.stage=next;const b=EVO_BONUS[next];u.maxhp+=b.hp;u.hp+=b.hp;u.atk+=b.atk;u.def+=b.def;u.spd+=b.spd;const old=u.name;u.pid=line[next].pid;u.name=line[next].name;
    log(`✦✦ ${old} 进化为 <b>${u.name}</b>！属性大幅提升`,'#ffd95a');burst(u.x,u.y,'#ffd95a');floatText(u.x,u.y,'进化!','#ffd95a');render();}}
function learnNext(u){let key=u.transformed?u.type:(u.hero?'normal':(u.key||u.type));const list=LEARN[key]||['basic'];const sk=list[u.lv-1];if(sk&&!u.skills.includes(sk)&&!u.hero)u.skills.push(sk),log(`✦ ${u.name} 升 Lv.${u.lv}，学会【${SKILLS[sk].name}】！`,'#c78bff');else log(`✦ ${u.name} 升 Lv.${u.lv}！`,'#c78bff');}

async function strike(att,sk,def){const s=SKILLS[sk]||sk;const times=(doubles(att,def)&&s.kind!=='aoe')?2:1;let dealt=0;
  for(let i=0;i<times;i++){if(def.hp<=0)break;await lunge(att,def.x,def.y);const b=baseDmg(att,def,s);
    if(b.m===0){floatText(def.x,def.y,'无效','#cfcfcf');log(`${att.name}【${s.name}】对 ${def.name} 无效(免疫)`,'#9aa6c8');await delay(280);break;}
    if(rand100()>=hitRate(att,def,s)){floatText(def.x,def.y,'Miss','#cfcfcf');log(`${att.name}【${s.name}】未命中`,'#9aa6c8');bw.classList.add('shake');setTimeout(()=>bw.classList.remove('shake'),200);await delay(280);continue;}
    const isCrit=rand100()<critRate(att,def,s);const d=isCrit?b.d*CRITX:b.d;def.hp-=d;dealt+=d;
    flashCell(def.x,def.y);burst(def.x,def.y,isCrit?'#ffd95a':b.m>1?'#7fe0a0':(s.type?TCOLOR[s.type]:'#fff'));floatText(def.x,def.y,'-'+d+(isCrit?' 暴击!':b.m>1?'!':''),isCrit?'#ffd95a':b.m>1?'#7fe0a0':'#fff');setHp(def);
    bw.classList.add('shake');setTimeout(()=>bw.classList.remove('shake'),320);
    log(`${att.name}【${s.name}】命中 ${def.name} <b>${d}</b>${isCrit?'（暴击!）':b.m>1?'（效果绝佳!）':b.m<1?'（效果不好）':''}`,att.side==='player'?'#eef2ff':'#ff9a9a');
    if(att.side==='enemy'&&relicThorns()>0&&att.hp>0){const tt=relicThorns();att.hp-=tt;floatText(att.x,att.y,'-'+tt+' 荆棘','#7fe0a0');setHp(att);if(att.hp<=0)killUnit(att);}
    if(s.inflict&&def.hp>0&&rand100()<s.inflict.chance)applyStatus(def,s.inflict.kind);
    relicOnHit(att,def);
    await delay(320);}
  if(s.recoil&&dealt>0&&att.hp>0){const rc=Math.max(1,Math.round(dealt*s.recoil));att.hp-=rc;floatText(att.x,att.y,'-'+rc+' 反作用','#ff8a8a');setHp(att);log(`${att.name} 受【${s.name}】反作用力 ${rc}`,'#ff8a8a');if(att.hp<=0)killUnit(att);}
  return dealt;}
async function execAttack(att,sk,tgt){if(busy)return;busy=true;const s=SKILLS[sk];clearSel();
  if(s.kind==='aoe'){const list=[tgt,...units.filter(e=>e.side==='enemy'&&e.hp>0&&e!==tgt&&Math.abs(e.x-tgt.x)+Math.abs(e.y-tgt.y)===1)];let dealt=0;await lunge(att,tgt.x,tgt.y);bw.classList.add('shake');setTimeout(()=>bw.classList.remove('shake'),320);
    for(const d of list){const b=baseDmg(att,d,s);if(b.m===0){floatText(d.x,d.y,'无效','#cfcfcf');continue;}if(rand100()>=hitRate(att,d,s)){floatText(d.x,d.y,'Miss','#cfcfcf');continue;}d.hp-=b.d;dealt+=b.d;flashCell(d.x,d.y);burst(d.x,d.y,b.m>1?'#7fe0a0':'#fff');floatText(d.x,d.y,'-'+b.d+(b.m>1?'!':''),b.m>1?'#7fe0a0':'#fff');setHp(d);}
    log(`${att.name}【横扫】命中 ${list.length} 个`,'#eef2ff');await delay(360);const dead=list.filter(d=>d.hp<=0);dead.forEach(d=>killUnit(d));if(dead.length){relicOnKill(att);setHp(att);}gainExp(att,Math.round(dealt*1.4)+dead.length*5);busy=false;finishAct(att);return;}
  let dealt=await strike(att,sk,tgt);
  if(tgt.hp<=0){killUnit(tgt);relicOnKill(att);setHp(att);gainExp(att,Math.round(dealt*1.4)+5);}
  else{const dist=Math.abs(att.x-tgt.x)+Math.abs(att.y-tgt.y);if(dist<=tgt.rng&&att.hp>0){await delay(110);await strike(tgt,'basic',att);if(att.hp<=0)killUnit(att);}gainExp(att,Math.round(dealt*1.4));}
  busy=false;finishAct(att);}
function execHeal(att,sk,tgt){if(busy)return;const s=SKILLS[sk];clearSel();floatText(tgt.x,tgt.y,'+'+s.amount,'#6affa0');burst(tgt.x,tgt.y,'#6affa0');tgt.hp=Math.min(tgt.maxhp,tgt.hp+s.amount);setHp(tgt);log(`${att.name}【治疗】恢复 ${tgt.name} ${s.amount}`,'#6affa0');att.acted=true;render();advanceInit();}
function capChance(att,def){return Math.min(0.95,(def.elite?0.25:0.70)*(1-def.hp/def.maxhp)+relicCapAdd());}
async function doCapture(att,def){if(busy)return;busy=true;clearSel();const ch=capChance(att,def);log(`${att.name} 贴脸收服 ${def.name}（${Math.round(ch*100)}%）…`,'#ffcf5a');await lunge(att,def.x,def.y);
  if(Math.random()<ch){battleCaptures.push(def);burst(def.x,def.y,'#ffd95a');floatText(def.x,def.y,'收服!','#ffd95a');log(`✦ 收服成功！<b>${def.name}</b> 战后入池`,'#7fe0a0');def.hp=0;await delay(450);killUnit(def,true);gainExp(att,15);}
  else{floatText(def.x,def.y,'激怒!','#ff8a8a');burst(def.x,def.y,'#ff5252');log(`✕ 失败！${def.name} 激怒反扑`,'#ff8a8a');await delay(250);await strike(def,'basic',att);if(att.hp<=0)killUnit(att);}
  busy=false;finishAct(att);}
function killUnit(u,cap){if(u.side==='player'){
    if(relicReviveAvailable()){run.reviveUsed=true;u.hp=Math.max(1,Math.ceil(u.maxhp/2));log(`🪶 复活羽毛救起 ${u.name}(半血)！`,'#ffd95a');floatText(u.x,u.y,'复活!','#ffd95a');setHp(u);return;}
    if(u.src)u.src._dead=true;log(`💀 ${u.name} 阵亡——永久出池(牌库-1)`,'#ff8a8a');}else if(!cap)log(`${u.name} 被击败`,'#9aa6c8');units=units.filter(x=>x!==u);}
function finishAct(att){const a=units.find(u=>u===att);if(a)a.acted=true;render();advanceInit();}
function checkEndSilent(){return units.filter(u=>u.side==='enemy'&&u.hp>0).length===0||units.filter(u=>u.side==='player'&&u.hp>0).length===0;}
function checkEnd(){const f=units.filter(u=>u.side==='enemy'&&u.hp>0).length,a=units.filter(u=>u.side==='player'&&u.hp>0).length;
  if(a===0){runOver(false);return true;}
  if(f===0){onBattleWin();return true;}return false;}
