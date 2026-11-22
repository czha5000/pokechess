function bootBattleApp(){
'use strict';
const {Game,CARDS,HEROES,TACTICS,RELICS,distance,validBuild}=window.DeployGame;
const $=id=>document.getElementById(id),canvas=$('board');
let game=new Game(),selected=-1,aim={x:370,y:155},hover=false,mode='card',preview=null;
game.setTactic('tactical');
window.wenshouCanUpdate=()=>game.phase!=='battle';
let replacements=new Set(),shown='',acc=0,uiTime=0,toastUntil=0,toastText='',dragging=false;
let touchMode=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0,touchTargeted=false;
let dodgeDrag=null,dodgePreview=null;
let lockedCaster=null,cardDrag=null,ignoreCardClick=0,replaceSkill=null;
const picker=document.createElement('div');picker.id='caster-picker';picker.hidden=true;document.body.append(picker);
function hidePicker(){picker.hidden=true;}
function showPicker(slot,rect){
 const choices=game.casters(game.hand[slot]).units,c=CARDS[game.hand[slot]];
 picker.innerHTML='<small>滑过头像选择施法者，再拖向战场</small><div>'+choices.map(u=>'<button data-caster="'+u.id+'">'+HEROES[u.hero].icon+' '+u.name+(u.busy?' · 蓄力':u.stun>0?' · 控制':'')+'</button>').join('')+'</div>';
 picker.style.left=Math.max(8,Math.min(innerWidth-248,rect.left))+'px';picker.style.top=Math.max(8,rect.top-83)+'px';picker.hidden=choices.length<2;picker.style.top=Math.max(8,rect.top-picker.offsetHeight-8)+'px';
}
document.documentElement.classList.toggle('touch-ui',touchMode);
$('help-toggle').textContent='规则';document.querySelector('nav').prepend($('help-toggle'));
function notice(s){toastText=s;toastUntil=performance.now()+2600;}

const skillDrawings={"sidestep":"<path d=\"M18 72Q40 20 66 42L54 52M66 42L63 27\"/><path d=\"M20 51L30 38M30 76L40 63\"/><ellipse cx=\"73\" cy=\"66\" rx=\"12\" ry=\"18\"/>","tackle":"<path d=\"M12 35H38M8 52H31M17 70H38\"/><path d=\"M40 32L67 24L83 47L75 73L48 76L34 54Z\"/><path d=\"M83 32L92 23M88 54H97M83 74L92 84\"/>","spark":"<path d=\"M13 70L52 30L42 56L86 22L63 66L79 59L57 85\"/><path d=\"M15 36L31 22M12 51L23 40\"/>","fire":"<path d=\"M66 13L73 34L95 35L78 49L84 71L65 58L46 71L51 49L34 35L57 34Z\"/><path d=\"M14 53L38 43M12 72L41 56M28 85L48 68\"/>","meteor":"<path d=\"M10 30L85 44L98 54L85 65L10 78Z\"/><ellipse cx=\"22\" cy=\"54\" rx=\"9\" ry=\"25\"/><path d=\"M85 23V35M85 75V88M64 14L71 30M65 82L70 72\"/>","ember":"<path d=\"M12 62L35 39L49 55L65 39L88 61L72 82L51 66L30 82Z\"/><path d=\"M50 14V32M35 21L40 31M65 21L60 31\"/>","retreat":"<path d=\"M12 73L35 51L27 47L65 19L52 44L76 38L46 81L51 62Z\"/><path d=\"M70 65L90 45M77 78L92 62\"/>","snare":"<path d=\"M18 22L36 40L48 25L62 40L82 22L78 48H22ZM22 56H78L82 82L62 67L48 82L36 67L18 82Z\"/>","waterneedle":"<path d=\"M14 79L35 38L85 17L62 66Z\"/><path d=\"M31 65L72 29M12 46L23 35M50 85L62 73\"/>","tide":"<path d=\"M15 53C15 11 85 11 85 51C85 87 30 87 30 53C30 30 66 30 66 51C66 67 43 67 43 52\"/><path d=\"M13 53L24 43M13 53L5 40\"/>","shell":"<path d=\"M50 14L82 28V52Q77 77 50 89Q23 77 18 52V28Z\"/><path d=\"M24 54Q37 40 50 54T77 54M50 23V45\"/>","spring":"<path d=\"M35 85V39H65V85ZM27 39L50 13L73 39M43 50H57M43 64H57\"/><path d=\"M12 61V79M4 70H20M85 47V65M76 56H94\"/>","rush":"<path d=\"M10 78Q32 36 58 53Q40 25 66 21Q88 18 85 40Q75 59 91 77Z\"/><path d=\"M31 66L70 39M58 39H70V51\"/>","lure":"<circle cx=\"50\" cy=\"27\" r=\"15\"/><path d=\"M50 42V78M23 48H77M50 78L29 91M50 78L72 91M38 16L26 7M63 16L75 7\"/>","needle":"<path d=\"M58 12L29 54H48L37 89L78 40H58Z\"/><path d=\"M16 28L30 35M16 74L27 67\"/>","bolt":"<path d=\"M15 31Q9 14 28 16Q45 1 58 18Q82 8 86 31Z\"/><path d=\"M54 36L34 62H53L41 91L78 54H58L70 36\"/>","gale":"<path d=\"M12 31H64Q85 31 80 16Q74 7 63 16M8 49H78Q100 49 85 66M16 69H51Q75 69 67 86Q56 99 46 83\"/>","flight":"<path d=\"M50 77Q15 74 10 20L37 38L32 20L50 43L68 20L63 38L90 20Q85 74 50 77Z\"/><path d=\"M50 83V96\"/>","mend":"<path d=\"M30 78Q10 41 72 15Q87 68 30 78ZM29 83L68 25M42 58L64 55M47 47V32\"/><path d=\"M77 72V94M66 83H88\"/>","pack":"<path d=\"M8 28L22 39L37 27L44 57L25 77L7 58ZM55 28L68 39L85 27L94 57L74 77L55 58\"/><path d=\"M16 51L23 55M31 51L25 55M64 51L71 55M80 51L73 55\"/>","venom":"<path d=\"M17 82L37 48L77 16L62 55Z\"/><circle cx=\"28\" cy=\"24\" r=\"8\"/><circle cx=\"78\" cy=\"72\" r=\"11\"/><circle cx=\"53\" cy=\"84\" r=\"5\"/>","vine":"<path d=\"M25 91Q7 56 44 49Q84 42 67 11M75 91Q93 56 56 49Q16 42 33 11\"/><path d=\"M28 62L13 65M72 62L87 65M39 36L26 28M60 35L75 27\"/>","blossom":"<path d=\"M50 53C8 48 8 14 36 21L50 40C50 4 86 8 78 33L59 50C94 43 98 81 70 78L52 60C60 92 24 98 22 73Z\"/><circle cx=\"50\" cy=\"53\" r=\"9\"/>","harvest":"<circle cx=\"35\" cy=\"63\" r=\"17\"/><circle cx=\"61\" cy=\"67\" r=\"17\"/><circle cx=\"49\" cy=\"43\" r=\"17\"/><path d=\"M48 26L63 12M67 24Q90 28 86 55L75 42\"/>","grit":"<path d=\"M18 39L40 24L62 34L72 60L48 84L24 70ZM40 24L38 58L24 70M38 58L62 34M38 58L48 84\"/><path d=\"M72 17L86 28L79 40M11 17L20 25\"/>","rockrush":"<circle cx=\"61\" cy=\"52\" r=\"28\"/><path d=\"M50 28L45 53L62 76M45 53L86 43M8 31H29M6 51H23M13 73H31\"/>","shieldstrike":"<path d=\"M50 16L79 28L74 60L57 78L50 57L59 45L46 38L41 16M35 22L18 30L23 64L40 83L37 58L27 50L36 43\"/><path d=\"M68 78L87 92M83 65L96 68\"/>","bulwark":"<path d=\"M9 78L32 29L44 47L60 13L92 78Z\"/><path d=\"M23 78V57L50 68L78 57V78L50 94Z\"/>","thunderwave":"<path d=\"M49 17L32 49H49L40 77L67 40H52L64 17\"/><path d=\"M22 24Q5 48 22 76M78 24Q95 48 78 76\"/>","electroball":"<circle cx=\"50\" cy=\"51\" r=\"27\"/><path d=\"M54 25L36 53H52L43 77L65 47H51L62 25M9 43L21 38M79 66L92 61M40 8L47 19M63 82L68 95\"/>","voltswitch":"<path d=\"M17 34Q48 5 79 32L68 32M79 32L77 18M83 68Q52 97 21 70L33 70M21 70L23 84M55 33L38 53H54L45 72L65 48H51Z\"/>","shadowpin":"<path d=\"M30 17L71 17L61 44L50 86L39 44Z\"/><ellipse cx=\"50\" cy=\"83\" rx=\"31\" ry=\"7\"/>","shadowball":"<circle cx=\"51\" cy=\"52\" r=\"25\"/><path d=\"M20 43Q7 17 37 22M63 23Q92 11 83 43M80 65Q95 90 64 83M36 81Q8 92 20 61\"/><path d=\"M37 48L45 53M63 48L55 53\"/>","hex":"<path d=\"M50 12L86 50L50 88L14 50ZM26 50Q50 25 74 50Q50 75 26 50Z\"/><circle cx=\"50\" cy=\"50\" r=\"9\"/><path d=\"M12 13L24 25M76 76L88 88M12 88L24 76M76 25L88 13\"/>","substitute":"<path d=\"M24 83V43L17 16L40 31H60L83 16L76 43V83L62 74L50 85L38 74Z\"/><path d=\"M34 49H42M58 49H66M39 65L50 70L61 65\"/>"};
const skillPalette={"water":"#70d8ff","lightning":"#ffe36a","ghost":"#c5a3ff","spore":"#c5a6ed","plant":"#a7ec94","earth":"#efbd8e","wind":"#b5f5dc","wings":"#d4edf9","normal":"#ffe7b1","fox":"#ffe7b1","turtle":"#70d8ff"};
function skillArt(id){const c=CARDS[id],color=skillPalette[c.requires]||'#c8f6ef';return '<svg class="skill-art" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="'+color+'" opacity=".08"/><g fill="'+color+'" fill-opacity=".25" stroke="'+color+'" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'+skillDrawings[id]+'</g></svg>';}
function cardDescription(c,echo=false){
 const s=echo?.45:1,n=value=>Number((value*s).toFixed(2)),damage=n((c.damage||0)*game.power);
 if(c.quickDodge)return '1灵能＋本牌 · 立即位移'+(echo?59.5:85)+' · 可拖角色触发';
 if(c.centerRadius)return '中心单体 '+n(c.centerDamage*game.power)+' · 其余溅射 '+damage;
 if(c.type==='blast')return (c.single?'单体伤害 ':'范围伤害 ')+damage+(c.poison?' · 孢毒1层 / 6秒':'')+(c.harvest?' · 每层孢毒追加'+n(10*game.power):'')+(c.shieldStrike?' · 消耗至多30盾转伤':'')+(c.stun?' · 控制 '+n(c.stun)+' 秒':c.push?' · 击退 '+n(c.push):c.pull?' · 聚拢 '+n(c.pull):'')+(c.allySetupBonus?' · 同伴标记至多 +'+n(c.allySetupBonus*game.power):'')+(c.control?' · 减速35% / '+n(c.control)+'秒':'')+(c.burn?' · 灼烧 '+n(c.burn*game.power)+'/s':'');
 if(c.type==='shield')return '区域护盾 '+n(c.amount)+' · 6 秒';
 if(c.type==='heal')return '区域治疗 '+n(c.amount)+(c.allyShield?' · 护盾 '+n(c.allyShield):'');
 if(c.type==='healfield')return '每秒治疗 '+n(c.amount)+' · '+c.life+' 秒 · 全队限1个';
 if(c.type==='firefield')return '火区 '+n(c.amount*game.power)+'/s · 灼烧 '+n(c.burn*game.power)+'/s · '+c.life+' 秒';
 if(c.type==='dash')return '自身跃迁'+(c.damage?' · 伤害 '+damage:'')+(c.heal?' · 回复 '+n(c.heal):'')+(c.shield?' · 护盾 '+n(c.shield):'');
 if(c.type==='lure')return n(c.hp)+' 生命诱饵 · '+c.life+' 秒';
 if(c.type==='pack')return '两只风狼 · '+n(75)+' 生命 / '+n(13)+' 攻击 · 10 秒';
 return c.desc;
}
function coopDescription(c){return c.coop||(c.type==='dash'?'携同伴援盾突进至少 45，可使落点敌人暴露破绽 5 秒':c.damage?'可接力追击同伴的破绽，追加一次伤害':'为队友创造持续作战的窗口');}
function reset(wave=0){dodgeDrag=null;dodgePreview=null;
 lockedCaster=null;cardDrag=null;replaceSkill=null;hidePicker();
 game=new Game();game.setTactic('tactical');game.wave=wave;selected=-1;mode='card';preview=null;shown='';acc=0;toastText='';touchTargeted=false;replacements.clear();
 $('overlay').hidden=true;$('inspect').close();$('mission-select').value=String(wave);ui();
}
function select(i){
 if(game.phase==='battle'&&game.cancelOrder(i)){notice(game.message);selected=-1;hidePicker();ui();return;}
 if(game.phase==='setup'&&!game.activeHeroes.includes(i))return;
 if(game.phase==='opening'){
  if(replacements.has(i))replacements.delete(i);
  else if(replacements.size<2)replacements.add(i);
  else notice('起手最多换两张；先取消一张。');
 }else if(game.phase==='setup'||game.phase==='battle'){
  selected=selected===i&&mode==='card'?-1:i;mode='card';preview=null;hover=true;touchTargeted=false;lockedCaster=null;hidePicker();
  if(game.phase==='battle'&&selected>=0){const choices=game.casters(game.hand[selected]).units;lockedCaster=choices.length===1?choices[0].id:null;}
  if(game.phase==='battle'&&selected>=0){const c=CARDS[game.hand[selected]],u=game.mains.find(u=>u.hero===c?.owner);if(u?.hp>0)aim={x:Math.min(900,u.x+(['heal','shield','healfield'].includes(c.type)?0:120)),y:u.y};}
 }
 ui();
}
function enemyAt(point){return game.units.filter(u=>u.side&&u.hp>0&&distance(u,point)<45).sort((a,b)=>distance(a,point)-distance(b,point))[0];}
function updatePreview(){
 dodgePreview=dodgeDrag?game.dodgePreview(dodgeDrag.id,aim.x,aim.y):null;
 if(game.phase!=='battle'){preview=null;return;}
 if(mode==='capture')preview=game.capturePreview(enemyAt(aim)?.id);
 else if(selected>=0)preview=game.commandPreview(selected,aim.x,aim.y,lockedCaster||undefined);
 else preview=null;
}
function place(){
 if(game.phase==='setup'&&selected>=0){
  if(game.place(selected,aim.x,aim.y)){notice(HEROES[selected].name+'已就位');selected=game.activeHeroes.find(i=>!game.placed[i])??-1;}else notice(game.message);
 }else if(game.phase==='battle'){
  if(mode==='capture'){
   const target=enemyAt(aim);
   if(!target){notice('这里没有可捕获的目标，不扣费。');return;}
   if(target&&preview?.target?.id!==target.id){preview=game.capturePreview(target.id);notice(target.name+' · 成功率 '+Math.round(preview.probability*100)+'%，再次点击确认。');return;}
   const result=game.capture(preview?.target?.id);notice(game.message);if(result){mode='card';selected=-1;preview=null;}
  }else if(selected>=0){
   if(game.commandCast(selected,aim.x,aim.y,preview?.casterId)){notice(game.message);selected=-1;preview=null;touchTargeted=false;}
   else {notice(game.message);updatePreview();}
  }
 }
 ui();
}
function threatened(u){
 if(!u||u.hp<=0)return false;
 return game.units.some(enemy=>{const p=enemy.hp>0&&enemy.side&&enemy.special;if(!p||p.kind==='chant')return false;
  if(p.kind!=='charge')return Math.hypot(u.x-p.x,u.y-p.y)<=p.r+18;
  const dx=p.x-p.from.x,dy=p.y-p.from.y,t=Math.max(0,Math.min(1,((u.x-p.from.x)*dx+(u.y-p.from.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(u.x-p.from.x-dx*t,u.y-p.from.y-dy*t)<=p.r+18;
 });
}
function partyUI(){
 if(dodgeDrag?.portrait)return;
 const key=game.hand.join()+Math.floor(game.availableEnergy)+game.damageCarry.join()+game.orders.length+game.paused+game.phase+'|'+(game.phase==='setup'?game.wounds.join()+game.tactic+game.activeHeroes.join():game.mains.map(u=>Math.ceil(u.hp)+':'+Math.ceil(u.shield)+':'+Math.ceil(u.dodgeCooldown)+':'+!!u.busy+':'+(u.stun>0)+':'+threatened(u)).join());
 if($('party').dataset.key===key)return;$('party').dataset.key=key;
 $('party').innerHTML=HEROES.map((h,i)=>{
  const u=game.mains.find(u=>u.hero===i),dead=u&&u.hp<=0;
  const state=!game.activeHeroes.includes(i)?'候补 · 战前可换':game.phase==='setup'?(Math.ceil(game.journeyHP(i))+' / '+game.journeyMax(i)+(game.wounds[i]?' · 带伤':'')+' · 4招'):dead?'倒下 · 留下残响':u?Math.ceil(u.hp)+' / '+u.max+(u.shield>0?' · '+(game.wardInfo(u)?'援盾 ':'盾 ')+Math.ceil(u.shield)+' / '+Math.ceil(u.shieldTime)+'s':'')+(u.busy?' · 施法中':u.stun>0?' · 被控制':''):'';
  if(!game.activeHeroes.includes(i))return '';
  const danger=game.phase==='battle'&&threatened(u);
  const evade=u&&!dead?(danger?game.escapePreview(u.id):game.dodgePreview(u.id,u.x+20,u.y)):null;const ready=evade?.valid;
  return '<button class="hero-status '+(dead?'fallen':'')+(danger?' threatened':'')+'" data-dodge-hero="'+i+'" '+(game.phase!=='battle'||dead?'disabled':'')+' aria-label="'+h.name+'，'+state+'。拖头像到战场闪避"><span class="hero-sigil">'+h.icon+'</span><span class="hero-copy"><b>'+h.name+'</b><small>'+state+'</small><span class="hero-health"><i style="width:'+(u?Math.max(0,u.hp/u.max)*100:100)+'%"></i></span><em>'+(danger?'危险 · ':'')+(dead?'残响支援':ready?(danger?'点按避险 · 1费':'拖动闪避 · 1费＋牌'):evade?.reason||'待命')+'</em></span></button>';
 }).join('');
}
function ui(){
 const setup=game.phase==='setup',opening=game.phase==='opening',battle=game.phase==='battle';
 document.body.dataset.phase=game.phase;
 document.body.classList.toggle('is-paused',game.paused);
 document.body.classList.toggle('is-aiming',selected>=0||!!dodgeDrag||mode==='capture');
 const intents=battle?game.units.map(u=>game.enemyIntent(u)).filter(Boolean).sort((a,b)=>Number(!!b.locked)-Number(!!a.locked)||Number(b.inRange)-Number(a.inRange)||a.readyIn-b.readyIn||(a.actor.lastSpecialAt??-1)-(b.actor.lastSpecialAt??-1)):[],intent=intents[0];
 $('danger').hidden=!intent;
 if(intent){$('danger-status').textContent=intent.locked?'落点已锁定 · 可打断':'下一次行动 · 预计';$('danger-name').textContent=intent.actor.name+' · '+intent.name;$('danger-detail').textContent=(intent.locked?'目标：':'预计目标：')+intent.targetName+' · '+(intent.damage?Math.round(intent.damage)+'伤害':'强化同伴');$('danger-time').textContent=intent.locked?Math.max(0,intent.wait).toFixed(1)+'s':intent.inRange?'≥'+intent.readyIn.toFixed(1)+'s':'接近后';$('danger-fill').style.width=(intent.locked?Math.min(100,Math.max(0,1-intent.wait/intent.wind)*100):Math.max(0,1-intent.readyIn/intent.cooldown)*100)+'%';$('danger').classList.toggle('urgent',!!intent.locked&&intent.wait<.6);$('danger').classList.toggle('forecast',!intent.locked);}
 const label={setup:'战前布阵',opening:'选择起手',battle:'实时交战',reward:'营地休整',victory:'旅程完成',defeat:'挑战失败'};
 $('phase').textContent=game.paused?'战术暂停':label[game.phase];
 $('core').textContent='灵核 '+Math.ceil(game.core.hp)+' / '+game.core.max;
 $('wave').textContent=(game.wave+1)+' / 3 · '+game.mission.name;
 $('time').textContent=Math.ceil(game.mission.limit-game.waveTime)+'s';
 $('field-note').textContent=game.wave===1?game.mission.goal+' · '+(game.control||0).toFixed(1)+'/14s':game.mission.goal;
 if(battle)$('field-note').textContent+=' · 敌方剩余 '+game.units.filter(u=>u.side&&u.hp>0&&u.kind!=='seal').length+'/4';
 $('formation').hidden=!setup;$('battle-controls').hidden=setup;
 $('intel').hidden=!setup;$('quick').hidden=!setup;$('loadout').hidden=!setup;$('mission-picker').hidden=!setup;
 $('tactics').hidden=!setup;$('party-picker').hidden=!setup;$('party-mode').value=String(game.activeHeroes.length);for(let j=0;j<3;j++){const el=$('roster-'+j);el.parentElement.hidden=j>=game.activeHeroes.length;el.value=String(game.activeHeroes[j]??0);for(const option of el.options)option.disabled=game.activeHeroes.includes(+option.value)&&+option.value!==game.activeHeroes[j];}
 document.querySelectorAll('[data-tactic]').forEach(b=>{const on=b.dataset.tactic===game.tactic;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
 if(setup)$('mission-select').value=String(game.wave);
 $('begin').hidden=!(setup||opening);$('begin').disabled=setup&&(canvas.dataset.ready!=='true'||game.activeHeroes.some(i=>!game.placed[i]));
 $('begin').textContent=opening?(replacements.size?'换 '+replacements.size+' 张并开战 →':'保留起手并开战 →'):'查看起手 →';
 $('pause').disabled=!battle;$('pause').textContent=game.paused?'继续 · 空格':'暂停 · 空格';
 if(touchMode)$('pause').textContent=game.paused?'继续战斗':'暂停思考';
 $('touch-controls').hidden=!(touchMode&&battle&&mode==='capture');
 $('confirm-target').disabled=!touchTargeted||!preview?.valid||game.paused;
 $('confirm-target').textContent=!touchTargeted?'先点战场选择目标':game.paused?'继续战斗后确认':mode==='capture'?'确认捕获 · 3 灵能':'确认施放 · '+(CARDS[game.hand[selected]]?.cost||0)+' 灵能';
 $('toast').textContent=performance.now()<toastUntil?toastText:'';
 if(setup){
  $('hint').textContent=selected>=0?'摆放 '+HEROES[selected].name+' · 点击左侧陆地':'上场主力已就位 · 可以查看起手';
  $('detail').textContent='敌情：'+game.enemyIntel.map(e=>e.name).join('、')+'。上场 '+game.activeHeroes.length+' 只，每只 4 招，共享 '+game.partyCards.length+' 张牌库；四张随机手牌。';
  const key=JSON.stringify(game.placed)+'|'+selected+'|'+game.activeHeroes.join();
  if($('formation').dataset.key!==key){$('formation').dataset.key=key;$('formation').innerHTML=HEROES.map((h,i)=>!game.activeHeroes.includes(i)?'':'<button class="beast '+(selected===i?'selected':'')+'" data-hero="'+i+'" aria-pressed="'+(selected===i)+'"><span class="icon">'+h.icon+'</span><span><b>'+h.name+'</b><small>'+h.desc+' · '+(game.placed[i]?'已就位':'待摆放')+'</small></span></button>').join('');}
 }else{
  const c=CARDS[game.hand[selected]];
  if(opening){$('hint').textContent='一次起手换牌 · 已选 '+replacements.size+' / 2';$('detail').textContent='点击不想保留的手牌。换掉的牌不会立刻抽回，确认后开战。';}
  else if(mode==='capture'&&battle){
   const p=preview,t=p?.target;
   $('hint').textContent=t?t.name+(t.capturable?(t.hp/t.max>.5?' · 需削弱至半血':' · 捕获成功率 '+Math.round(p.probability*100)+'% · 3 灵能'):' · 不可捕获'):'捕获模式 · 点击野生纹兽';
   $('detail').textContent=t&&!p.valid?p.reason:game.paused?'已暂停，预览后按空格继续。':'先削弱至半血以下；确认即判定，队伍不停火，失败也扣费。';
  }else if(c&&battle){
   const p=preview;
   $('hint').textContent=c.name+' · '+((p?.echo?'残响 · ':'')+(p?.caster?.name||'无可用施法者'))+(p?.caster?' · 射程 '+Math.round(p.range):'');
   $('detail').textContent=p&&!p.valid?p.reason:p?.approach?p.reason:game.paused?(touchMode?'已暂停，可调整落点；点右上角继续后再确认。':'已暂停，选好落点后按空格继续。'):cardDescription(c,p?.echo)+' · 前摇 '+c.wind+' 秒'+(p?.echo?' · 残响效力 45%':'')+(touchMode?' · 拖到落点松手施放；拖回手牌取消':' · Esc 取消');
  }else{$('hint').textContent=game.paused?'战术暂停 · 可查看手牌':'拖手牌到战场释放';$('detail').textContent='拖角色使用手中闪避牌 · 消耗1灵能';}
  if(dodgePreview){$('hint').textContent=dodgePreview.caster?.name+' · 拖动闪避';$('detail').textContent=dodgePreview.valid?'松手消耗一张闪避牌与1灵能 · 无无敌/护盾':dodgePreview.reason;}
 $('energy').textContent=game.availableEnergy.toFixed(1)+' / '+game.maxEnergy+(game.reservedEnergy?'（预留 '+game.reservedEnergy+'）':'');$('energy-fill').style.width=Math.max(0,game.availableEnergy)/game.maxEnergy*100+'%';$('regen').textContent='每秒 +'+game.regen.toFixed(2);
 const spend=mode==='capture'?3:CARDS[game.hand[selected]]?.cost||0;
 $('energy-reserved').style.left=game.availableEnergy/game.maxEnergy*100+'%';$('energy-reserved').style.width=game.reservedEnergy/game.maxEnergy*100+'%';
 $('energy-spend').style.left=Math.max(0,game.availableEnergy-spend)/game.maxEnergy*100+'%';$('energy-spend').style.width=Math.min(spend,game.availableEnergy)/game.maxEnergy*100+'%';
 $('energy-budget').textContent=spend?(game.availableEnergy<spend?'不足 ':'本次 ')+spend+' · 余 '+Math.max(0,game.availableEnergy-spend).toFixed(1):game.reservedEnergy?'斜纹为移动施法预留':'每格 1 灵能';
  $('deck-info').textContent='抽 '+game.deck.length+' / 弃 '+game.discard.length+' / 施 '+game.pending.length;
  $('capture').disabled=!battle;$('capture').classList.toggle('selected',mode==='capture');$('capture').setAttribute('aria-pressed',String(mode==='capture'));
  $('capture').textContent=game.captureCooldown>0?'捕获冷却 '+game.captureCooldown.toFixed(1)+'s':'捕获 · 3 灵能'+(touchMode?'':' [C]');
  const hints=game.hand.map((_,i)=>battle?game.comboHint(i):null);
  const handKey=game.orders.map(o=>o.id).join()+'|'+hints.map(h=>h?.text||'').join()+'|'+game.hand.join()+'|'+selected+'|'+Math.floor(game.energy)+'|'+game.phase+'|'+[...replacements].join()+'|'+game.mains.map(u=>u.hp<=0?'dead':u.busy?'busy':'ready').join();
  if(!cardDrag&&$('hand').dataset.key!==handKey){
   $('hand').dataset.key=handKey;$('hand').innerHTML=game.hand.map((id,i)=>{
    const c=CARDS[id];if(!c)return '<button class="card" disabled>等待补牌</button>';
    const echo=game.casters(id).echo,replace=replacements.has(i),isSelected=i===selected&&mode==='card';
    const queued=game.orderForSlot(i),locked=false,hint=hints[i];
    const names=game.activeHeroes.filter(j=>game.loadouts[j].includes(id)).map(j=>HEROES[j].name).join(' / ');
    return '<button data-slot="'+i+'" data-kind="'+c.type+'" '+(locked||!battle&&!opening?'disabled':'')+' aria-pressed="'+(opening?replace:isSelected)+'" class="card '+(hint?'combo-ready ':'')+(queued?'queued ':'')+(isSelected?'selected ':'')+(echo?'echo ':'')+(replace?'replace ':'')+(game.availableEnergy<c.cost?'poor':'')+'"><span class="owner">'+(queued?'待施放 · 点此取消':names)+(echo?' · 残响':'')+(opening&&replace?' · 换掉':'')+'</span><span class="cost">'+c.cost+'</span>'+skillArt(id)+'<b>'+c.name+'</b><span class="key">'+(i+1)+'</span></button>';
   }).join('');
  }
 }
 partyUI();$('log').textContent=game.message;
 const latest=game.coopEvents[game.coopEvents.length-1],live=game.units.filter(u=>u.hp>0);
 $('coop-preview').textContent=battle&&mode==='card'&&preview?.coop?.text?(preview.valid?'配合预览 · ':'')+preview.coop.text+'（命中时重判）':'';
 $('teamwork').hidden=!(setup||opening||battle);
 $('teamwork-count').textContent=setup?(game.activeHeroes.length===2?'双兽接力':'三兽协作'):'配合 '+game.stats.cooperations+(game.activeHeroes.length===3?' · 三兽 '+game.stats.trios:'');
 $('teamwork-state').textContent=setup||opening?(TACTICS[game.tactic]?.guide||'试试推荐配招：聚敌焚场 / 护送突袭。每张技能仍可独立使用。'):
  latest&&game.time-latest.time<5?latest.text:
  '援盾 '+game.mains.filter(u=>u.hp>0&&game.wardInfo(u)).length+' · 牵制 '+live.filter(u=>game.active(u.controlTag)).length+' · 灼烧 '+live.filter(u=>game.active(u.burn)).length+' · 破绽 '+live.filter(u=>game.active(u.breach)).length+' · 看目标倒计时接力';
 const key=game.phase+game.wave+game.wounds.join()+game.damageCarry.join()+game.campHealUsed;
 if(!battle)hidePicker();
 if(['reward','victory','defeat'].includes(game.phase)&&shown!==key){
  shown=key;selected=-1;mode='card';$('overlay').hidden=false;
  const stats='<p class="stats">出牌 '+game.stats.played+' · 配合 '+game.stats.cooperations+(game.activeHeroes.length===3?' · 三兽合击 '+game.stats.trios:'')+' · 收服 '+game.stats.captures+' · 治疗 '+Math.round(game.stats.healed)+'</p>';
  const captures=game.captured.length?'<p>收服记录：'+game.captured.map(u=>u.name).join('、')+'（暂未开放换队）</p>':'';
  if(game.phase==='reward'){
   const healButtons=HEROES.map((h,i)=>(game.wounds[i]||game.damageCarry[i]>0)?'<button data-heal="'+i+'"><b>治疗 '+h.name+'</b><small>'+Math.ceil(game.journeyHP(i))+'/'+game.journeyMax(i)+'生命 → 恢复40%最大生命并清除伤势；放弃本营地遗物</small></button>':'').join('');
   $('sheet').innerHTML='<span class="eyebrow">CAMP / '+(game.wave+1)+'</span><h2>'+game.mission.name+' · 完成</h2><p>损血带入下一关；倒下者以带伤上限的约30%生命归队。灵核重置。</p><p><strong>只选一项：治疗一只，或取得一个遗物。</strong></p><div class="choices">'+healButtons+RELICS.filter(r=>!game.relics.includes(r.id)).map(r=>'<button data-relic="'+r.id+'"><b>'+r.name+'</b><small>'+r.desc+'；保留当前损血</small></button>').join('')+'</div>'+stats+captures;

  }else $('sheet').innerHTML='<span class="eyebrow">'+(game.phase==='victory'?'JOURNEY COMPLETE':'TRY ANOTHER HAND')+'</span><h2>'+(game.phase==='victory'?'裂隙已封，旅程完成':'这次没能守住')+'</h2><p>'+game.message+'</p>'+stats+captures+'<button data-retry="true" class="primary">再试一局 →</button>';
 }
}
function inspect(kind){
 if(game.phase==='battle')game.paused=true;
 $('inspect').dataset.kind=kind;drawInspect();if(!$('inspect').open)$('inspect').showModal();ui();
}
const buildKey='wenshou-deploy-builds-v1';
function readBuilds(){try{const data=JSON.parse(localStorage.getItem(buildKey)||'[]');return Array.from({length:3},(_,i)=>Array.isArray(data)&&validBuild(data[i])?data[i]:null);}catch{return [null,null,null];}}
function buildPanel(){return '<section class="build-panel"><b>我的配招 · 仅保存在当前浏览器</b><p>保存上场角色与全部角色的技能；载入使用推荐站位，不改变伤势或遗物。</p>'+readBuilds().map((b,i)=>'<div class="build-row"><span>槽 '+(i+1)+' · '+(b?b.activeHeroes.map(h=>HEROES[h].name).join('＋'):'空')+'</span><button data-build-save="'+i+'">'+(b?'覆盖保存':'保存当前')+'</button><button data-build-load="'+i+'" '+(!b?'disabled':'')+'>载入</button></div>').join('')+'<p id="build-status" role="status"></p></section>';}
function drawInspect(){
 if($('inspect').dataset.kind==='intel'){$('inspect-title').textContent='战前敌情 · '+game.mission.name;$('inspect-body').innerHTML='<p>'+game.mission.goal+'</p><p>固定开场1名首领＋3名随从，无后续增援。击杀随从会永久降低本场压力。封印是任务目标，不计入敌人数。</p><div class="intel-list">'+game.enemyIntel.map(e=>'<article><b>'+e.name+'</b><p>'+e.advice+'</p></article>').join('')+'</div><button id="intel-to-loadout">据此调整配招 →</button>';return;}

 const config=$('inspect').dataset.kind==='loadout'&&game.phase==='setup';
 $('inspect-title').textContent=config?'战前配招 · 每只携带 4 招':'共享牌库 · '+game.partyCards.length+' 张（含同名副本）';

 if(!config){$('inspect-body').innerHTML='<p>共享牌库：元素、身体特征或专属条件决定可学技能，装备后才能正常施放。同名牌可选任一存活装备者。</p><div class="skill-list">'+game.partyCards.map(id=>{const c=CARDS[id];return '<div class="deck-entry">'+skillArt(id)+'<small>'+game.activeHeroes.filter(i=>game.loadouts[i].includes(id)).map(i=>HEROES[i].name).join(' / ')+'</small><b>'+c.name+' · '+c.cost+' 灵能</b><small>'+cardDescription(c)+' · 前摇 '+c.wind+'秒 · 射程 '+c.range+'</small><small>配合：'+coopDescription(c)+'</small></div>';}).join('')+'</div>';return;}
 $('inspect-body').innerHTML='<p>'+(config?'先点要替换的携带技能，再点同一只的备用技能。同名技能可由多只携带；仅上场纹兽的配招进入公共牌库，入库后仅存活装备者正常施放；候补技能可预先调整。':'每份配招贡献一张牌；同名牌由存活装备者施放；角色可以直接拖动闪避。不显示隐藏牌序。')+'</p>'+HEROES.map((h,i)=>!config&&!game.activeHeroes.includes(i)?'':'<section class="skill-group"><h3>'+h.icon+' '+h.name+(!game.activeHeroes.includes(i)?' · 候补':'')+'</h3><div class="skill-list">'+(config?h.skills:game.loadouts[i]).map(id=>{
  const c=CARDS[id],equipped=game.loadouts[i].includes(id);
  const label='<span class="skill-tags">'+c.tags.join(' · ')+'</span><b>'+(c.requires?'限定技能 · ':'通用技能 · ')+c.name+' · '+c.cost+' 灵能</b><small>'+c.desc+' · 射程 '+c.range+' · 前摇 '+c.wind+'s</small><small class="coop-copy">配合：'+coopDescription(c)+'</small>';
  return config?'<button data-skill="'+id+'" data-skill-owner="'+i+'" aria-pressed="'+equipped+'" class="'+(equipped?'selected':'reserve')+'">'+(replaceSkill?.owner===i&&replaceSkill.id===id?'待替换 · ':equipped?'携带 · ':'备用 · ')+label+'</button>':'<div class="deck-entry">'+label+'</div>';
 }).join('')+'</div></section>').join('')+(config?buildPanel():'');
}
function point(e,ground=!!dodgeDrag||!!CARDS[game.hand[selected]]?.quickDodge){if(window.battleView)return window.battleView.point(e.clientX,e.clientY,!ground);const r=canvas.getBoundingClientRect(),s=Math.min(r.width/1000,r.height/500);return {x:(e.clientX-r.left-(r.width-1000*s)/2)/s,y:(e.clientY-r.top-(r.height-500*s)/2)/s};}
// Fixed portraits disambiguate overlapping creatures without changing dodge rules.
$('party').addEventListener('pointerdown',e=>{
 const b=e.target.closest('[data-dodge-hero]');if(!b||b.disabled||e.button!==0||cardDrag||dodgeDrag||game.phase!=='battle')return;
 const u=game.mains.find(u=>u.hero===+b.dataset.dodgeHero);if(!u||u.hp<=0)return;
 e.preventDefault();aim={x:u.x,y:u.y};dodgeDrag={id:u.id,pointer:e.pointerId,portrait:true,client:{x:e.clientX,y:e.clientY},moved:false};selected=-1;mode='card';hover=true;hidePicker();$('party').setPointerCapture(e.pointerId);updatePreview();ui();
});
$('party').addEventListener('pointermove',e=>{if(!dodgeDrag?.portrait||dodgeDrag.pointer!==e.pointerId)return;aim=point(e);dodgeDrag.moved ||= Math.hypot(e.clientX-dodgeDrag.client.x,e.clientY-dodgeDrag.client.y)>8;updatePreview();});
function finishPortraitDodge(e,cancel=false){
 if(!dodgeDrag?.portrait||dodgeDrag.pointer!==e.pointerId)return;
 const drag=dodgeDrag,r=canvas.getBoundingClientRect();dodgeDrag=null;dodgePreview=null;
 if($('party').hasPointerCapture(e.pointerId))$('party').releasePointerCapture(e.pointerId);
 if(!cancel&&drag.moved&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){aim=point(e,true);game.dodge(drag.id,aim.x,aim.y);notice(game.message);}
 else if(!cancel&&!drag.moved){game.escape(drag.id);notice(game.message);}
 else if(drag.moved)notice('已取消闪避');
 ui();
}
$('party').addEventListener('pointerup',e=>finishPortraitDodge(e));
$('party').addEventListener('pointercancel',e=>finishPortraitDodge(e,true));
$('hand').addEventListener('pointerdown',e=>{
 const b=e.target.closest('[data-slot]');if(!b||dodgeDrag||game.phase!=='battle'||e.button!==0)return;
 if(game.cancelOrder(+b.dataset.slot)){e.preventDefault();ignoreCardClick=performance.now()+400;notice(game.message);selected=-1;hidePicker();ui();return;}
 e.preventDefault();selected=+b.dataset.slot;mode='card';preview=null;hover=true;
 const choices=game.casters(game.hand[selected]).units;lockedCaster=choices.length===1?choices[0].id:null;
 hidePicker();cardDrag={pointer:e.pointerId,slot:selected,card:game.hand[selected],x:e.clientX,y:e.clientY,moved:false};
 $('hand').setPointerCapture(e.pointerId);ui();
});
$('hand').addEventListener('pointermove',e=>{
 if(!cardDrag||e.pointerId!==cardDrag.pointer)return;
 cardDrag.moved ||= Math.hypot(e.clientX-cardDrag.x,e.clientY-cardDrag.y)>8;
 if(!lockedCaster&&!picker.hidden)for(const b of picker.querySelectorAll('[data-caster]')){const r=b.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){lockedCaster=b.dataset.caster;b.classList.add('selected');break;}}
 aim=point(e);hover=true;updatePreview();
});
function finishDrag(e,cancel=false){
 if(!cardDrag||e.pointerId!==cardDrag.pointer)return;
 const drag=cardDrag;cardDrag=null;ignoreCardClick=performance.now()+400;
 if($('hand').hasPointerCapture(e.pointerId))$('hand').releasePointerCapture(e.pointerId);
 const r=canvas.getBoundingClientRect(),inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
 if(!cancel&&drag.moved&&inside&&game.hand[drag.slot]===drag.card){aim=point(e);updatePreview();place();}
 else if(drag.moved||cancel){selected=-1;preview=null;notice(cancel?'已取消':'已退回手牌，不消耗灵能');}
 if(drag.moved||cancel)hidePicker();ui();
}
$('hand').addEventListener('pointerup',e=>finishDrag(e));
$('hand').addEventListener('pointercancel',e=>finishDrag(e,true));
canvas.addEventListener('pointerdown',e=>{
 if(e.button!==0||cardDrag||dodgeDrag)return;aim=point(e);hover=true;canvas.focus({preventScroll:true});
 if(game.phase==='battle'&&mode!=='capture'&&selected<0){const picked=window.battleView?.hero(e.clientX,e.clientY);const u=game.mains.find(u=>u.hp>0&&u.id===picked)||game.mains.filter(u=>u.hp>0&&distance(u,aim)<36).sort((a,b)=>distance(a,aim)-distance(b,aim))[0];if(u){e.preventDefault();aim={x:u.x,y:u.y};dodgeDrag={id:u.id,pointer:e.pointerId,start:{...aim},client:{x:e.clientX,y:e.clientY},previous:selected,moved:false};selected=-1;preview=null;hidePicker();canvas.setPointerCapture(e.pointerId);updatePreview();ui();return;}}
 if(e.pointerType==='touch'&&game.phase==='battle'&&mode==='capture'){
  touchMode=true;document.documentElement.classList.add('touch-ui');touchTargeted=true;updatePreview();ui();return;
 }
 if(game.phase==='setup'){
  const hit=game.placed.findIndex((p,i)=>game.activeHeroes.includes(i)&&p&&distance(p,aim)<30);
  if(hit>=0){selected=hit;dragging=true;canvas.setPointerCapture(e.pointerId);ui();return;}
 }
 place();
});
canvas.addEventListener('pointermove',e=>{aim=point(e);hover=true;if(dodgeDrag&&dodgeDrag.pointer===e.pointerId)dodgeDrag.moved ||=Math.hypot(e.clientX-dodgeDrag.client.x,e.clientY-dodgeDrag.client.y)>8;updatePreview();});
canvas.addEventListener('pointerup',e=>{if(dodgeDrag&&dodgeDrag.pointer===e.pointerId){const drag=dodgeDrag;dodgeDrag=null;aim=point(e,true);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(drag.moved){const r=canvas.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){game.dodge(drag.id,aim.x,aim.y);notice(game.message);}else notice('已取消闪避');}else{game.escape(drag.id);notice(game.message);selected=drag.previous;}dodgePreview=null;ui();return;}if(dragging){aim=point(e);dragging=false;place();}});
canvas.addEventListener('pointercancel',()=>{dragging=false;dodgeDrag=null;dodgePreview=null;});
canvas.addEventListener('pointerleave',()=>{if(!dragging&&!dodgeDrag&&!touchMode)hover=false;});
canvas.addEventListener('contextmenu',e=>{e.preventDefault();selected=-1;mode='card';preview=null;lockedCaster=null;hidePicker();ui();});
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||b.disabled)return;
 if(b.id==='intel-to-loadout'){inspect('loadout');return;}
 if(b.dataset.buildSave!==undefined&&game.phase==='setup'){const slots=readBuilds();slots[+b.dataset.buildSave]=game.exportBuild();try{localStorage.setItem(buildKey,JSON.stringify(slots));drawInspect();$('build-status').textContent='已保存到槽 '+(+b.dataset.buildSave+1);}catch{$('build-status').textContent='浏览器未允许保存；当前配招仍可继续使用。';}return;}
 if(b.dataset.buildLoad!==undefined&&game.phase==='setup'){const saved=readBuilds()[+b.dataset.buildLoad];if(game.applyBuild(saved)){replaceSkill=null;selected=-1;drawInspect();$('build-status').textContent='已载入，可继续按敌情调整。';ui();}else{drawInspect();$('build-status').textContent='保存内容无效，请重新保存。';}return;}
 if(b.dataset.hero!==undefined)select(+b.dataset.hero);
 if(b.dataset.tactic&&game.setTactic(b.dataset.tactic)){selected=-1;notice('已选 '+TACTICS[b.dataset.tactic].name+' · 可以调整站位，起手仍随机');ui();}
 if(b.dataset.slot!==undefined&&performance.now()>ignoreCardClick)select(+b.dataset.slot);
 if(b.dataset.caster){lockedCaster=b.dataset.caster;hidePicker();picker.querySelectorAll('[data-caster]').forEach(el=>el.classList.toggle('selected',el===b));updatePreview();ui();}
 if(b.dataset.heal!==undefined&&game.healWound(+b.dataset.heal)){shown='';$('overlay').hidden=true;selected=-1;ui();}
 if(b.dataset.relic&&game.choose(b.dataset.relic)){shown='';$('overlay').hidden=true;selected=-1;ui();}
 if(b.dataset.retry)reset();
 if(b.dataset.skill){const id=b.dataset.skill,owner=+b.dataset.skillOwner;if(game.loadouts[owner].includes(id))replaceSkill={owner,id};else if(replaceSkill?.owner===owner&&game.swapSkill(owner,replaceSkill.id,id))replaceSkill=null;drawInspect();ui();}
});
$('party-mode').onchange=e=>{const ids=game.activeHeroes.slice(0,+e.target.value);if(ids.length<+e.target.value)ids.push(HEROES.findIndex((_,i)=>!ids.includes(i)));game.setParty(ids);game.quick();selected=-1;ui();};
for(let j=0;j<3;j++){$('roster-'+j).innerHTML=HEROES.map((h,i)=>'<option value="'+i+'">'+h.name+'</option>').join('');$('roster-'+j).onchange=e=>{const ids=[...game.activeHeroes];ids[j]=+e.target.value;game.setParty(ids);game.quick();selected=-1;ui();};}
$('quick').onclick=()=>{game.quick();selected=-1;ui();};
$('begin').onclick=()=>{
 if(game.phase==='setup'&&game.start()){selected=-1;replacements.clear();ui();}
 else if(game.phase==='opening'&&game.openBattle([...replacements])){selected=-1;replacements.clear();ui();}
};
$('pause').onclick=()=>{game.pause();ui();};$('restart').onclick=()=>reset();
$('mission-select').onchange=e=>reset(+e.target.value);
$('capture').onclick=()=>{if(game.phase==='battle'){mode=mode==='capture'?'card':'capture';selected=-1;preview=null;hover=true;touchTargeted=false;updatePreview();ui();}};
$('confirm-target').onclick=()=>{if(touchTargeted)place();};
$('cancel-target').onclick=()=>{selected=-1;mode='card';preview=null;touchTargeted=false;ui();};
$('intel').onclick=()=>inspect('intel');$('loadout').onclick=()=>inspect('loadout');$('deck-info').onclick=()=>inspect('deck');$('close-inspect').onclick=()=>$('inspect').close();
$('help-toggle').onclick=()=>{if(game.phase==='battle')game.paused=true;$('inspect-title').textContent='战斗规则';$('inspect-body').innerHTML=$('help').innerHTML;$('inspect').dataset.kind='help';if(!$('inspect').open)$('inspect').showModal();ui();};
document.addEventListener('keydown',e=>{
 if(e.repeat||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||$('inspect').open)return;
 if(e.code==='Space'){e.preventDefault();game.pause();ui();}
 else if(e.key==='Escape'){dodgeDrag=null;dodgePreview=null;selected=-1;mode='card';preview=null;ui();}
 else if(e.key.toLowerCase()==='c')$('capture').click();
 else if(/^[1-4]$/.test(e.key)){const i=+e.key-1;if(game.phase==='setup'){if(game.activeHeroes[i]!==undefined)select(game.activeHeroes[i]);}else select(i);}
 else if(e.target===canvas&&e.key.startsWith('Arrow')){
  e.preventDefault();aim.x=Math.max(105,Math.min(905,aim.x+(e.key==='ArrowRight'?25:e.key==='ArrowLeft'?-25:0)));aim.y=Math.max(55,Math.min(445,aim.y+(e.key==='ArrowDown'?25:e.key==='ArrowUp'?-25:0)));hover=true;updatePreview();
 }else if(e.target===canvas&&e.key==='Enter'){e.preventDefault();place();}
});
document.addEventListener('visibilitychange',()=>{dodgeDrag=null;dodgePreview=null;if(document.hidden&&game.phase==='battle'){game.paused=true;ui();}});
function frame(now,delta){
 const portrait=touchMode&&innerHeight>innerWidth&&innerWidth<700;
 document.querySelector('main').inert=portrait;
 if(portrait&&game.phase==='battle'){game.paused=true;dodgeDrag=null;dodgePreview=null;}
 const dt=Math.min(.06,Math.max(0,delta/1000||0));
 if(game.phase==='battle'&&!game.paused){acc+=dt;while(acc>=1/60){game.step(1/60);acc-=1/60;}}else acc=0;
 updatePreview();uiTime+=dt;if(uiTime>.1){ui();uiTime=0;}
}
ui();
try{
 const renderer=window.createBattleRenderer(canvas,frame,()=>({game,selected,aim,hover,preview,mode,touchMode,dodgePreview}),message=>{if(game.phase==='battle')game.paused=true;dodgeDrag=null;dodgePreview=null;notice(message);ui();});
 window.wenshouRenderDiagnostics=renderer.diagnostics;
 window.addEventListener('pagehide',e=>{if(!e.persisted)renderer.destroy();},{once:true});
}catch(error){$('hint').textContent='战场加载失败，请刷新重试';$('detail').textContent=error.message;$('begin').disabled=true;console.error(error);}
}
if(window.createBattleRenderer)bootBattleApp();else window.addEventListener('battle-renderer-ready',bootBattleApp,{once:true});

