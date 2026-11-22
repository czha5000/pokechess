(() => {
'use strict';
const LANES = [155, 345];
const ENEMY_CADENCE={basic:3.2,bossBasic:4,openingBasic:1.6,openingBossBasic:2.2,tellGap:2.5};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Legacy spell IDs are preserved for saved-build compatibility; displayed names and mechanics are current.
const CARDS = {
 sidestep:{owner:0,name:'闪避',icon:'闪',cost:1,range:85,r:0,wind:0,type:'dash',quickDodge:true,desc:'立即位移至多85 · 消耗手牌与1灵能',coop:'拖角色快捷使用；无无敌、伤害或护盾，不制造援盾破绽'},
 thunderwave:{owner:5,name:'电磁波',icon:'麻',cost:2,range:260,r:40,wind:.25,type:'blast',single:true,damage:12,stun:.4,control:4,desc:'单体12伤害 · 打断0.4秒 · 牵制减速35%，4秒',coop:'为同伴祸不单行创造窗口；自己的电球不吃自己标记'},
 electroball:{owner:5,name:'电球',icon:'电',cost:3,range:280,r:45,wind:.45,type:'blast',single:true,damage:46,allySetupBonus:24,desc:'单体46伤害 · 同伴毒层/牵制追加至多24',coop:'接妙蛙种子孢毒或耿鬼影缚；毒层另按原规则消费1层'},
 voltswitch:{owner:5,name:'伏特替换',icon:'跃',cost:2,range:220,r:45,wind:.2,type:'dash',damage:22,desc:'自身突进 · 落点22伤害 · 不自动换人',coop:'带同伴援盾移动至少45并命中，制造破绽供同伴追击'},
 shadowpin:{owner:6,name:'影缚',icon:'缚',cost:1,range:260,r:35,wind:.2,type:'blast',single:true,damage:8,control:3,desc:'单体8伤害 · 牵制减速35%，3秒 · 不打断',coop:'低费铺垫同伴电球；自身祸不单行不吃这层协作加成'},
 shadowball:{owner:6,name:'暗影球',icon:'影',cost:2,range:300,r:40,wind:.35,type:'blast',single:true,damage:44,desc:'单体44伤害',coop:'消费同伴孢毒或援盾突袭破绽，适合稳定追击'},
 hex:{owner:6,name:'祸不单行',icon:'咒',cost:4,range:290,r:45,wind:.65,type:'blast',single:true,damage:60,allySetupBonus:42,desc:'单体60伤害 · 同伴毒层/牵制追加至多42',coop:'同伴先挂毒或电磁波，命中时仍有效才追加；自己影缚不触发'},
 substitute:{owner:6,name:'替身',icon:'替',cost:2,range:230,r:175,wind:.3,type:'lure',hp:55,life:4,desc:'55生命替身 · 吸引近敌4秒 · 不回血',coop:'为同伴高费技能争取施法窗口；全队只保留一个诱饵'} ,
 venom:{owner:3,name:'孢针',icon:'芽',cost:1,range:290,r:45,wind:.2,type:'blast',single:true,damage:10,poison:1,desc:'单体10伤害 · 孢毒1层；最多3层，6秒，每层每秒2伤害',coop:'同伴直接伤害技能消耗1层孢毒，追加12伤害；普攻不消耗'},
 vine:{owner:3,name:'缠根',icon:'藤',cost:2,range:260,r:65,wind:.3,type:'blast',damage:26,pull:40,control:3,desc:'范围26伤害 · 聚拢40 · 牵制减速35%，3秒',coop:'聚拢和减速，帮助同伴命中高费技能'},
 blossom:{owner:3,name:'共生芽',icon:'✿',cost:3,range:250,r:70,wind:.25,type:'heal',amount:12,allyShield:20,desc:'区域治疗12 · 护盾20，6秒',coop:'为同伴续航并授盾，可接位移破绽或岩獾碎甲击'},
 harvest:{owner:3,name:'毒果收割',icon:'果',cost:3,range:280,r:45,wind:.5,type:'blast',single:true,damage:45,harvest:true,desc:'单体45伤害 · 消耗全部孢毒，每层额外10伤害',coop:'自己兑现毒层，或把毒层留给同伴低费技能接力'},
 grit:{owner:4,name:'砾甲',icon:'岩',cost:1,range:220,r:55,wind:.15,type:'shield',amount:16,desc:'区域友军护盾16 · 6秒',coop:'同伴带盾位移可制造破绽；也可先给自己蓄盾'},
 rockrush:{owner:4,name:'滚岩突袭',icon:'滚',cost:2,range:200,r:55,wind:.25,type:'dash',damage:24,shield:12,desc:'自身突进 · 落点24伤害 · 自身护盾12',coop:'携同伴援盾突进至少45，可制造破绽让同伴追击'},
 shieldstrike:{owner:4,name:'碎甲击',icon:'砾',cost:3,range:160,r:50,wind:.55,type:'blast',single:true,damage:55,shieldStrike:true,desc:'单体55伤害 · 命中消耗自身至多30盾，每盾追加1.5伤害',coop:'杰尼龟或妙蛙种子授盾，再碎甲击；消耗防御换取爆发'},
 bulwark:{owner:4,name:'山岳守护',icon:'山',cost:4,range:230,r:80,wind:.4,type:'shield',amount:65,desc:'区域友军护盾65 · 6秒',coop:'承受高压或为同伴援盾突袭准备资源；护盾取较高值，不叠加'},
 waterneedle:{owner:0,name:'水针',icon:'滴',cost:1,range:250,r:40,wind:.15,type:'blast',single:true,damage:22,desc:'单体22伤害 · 低费接力',coop:'接孢毒或同伴制造的破绽，单体也有价值'},
 needle:{owner:2,name:'雷针',icon:'针',cost:1,range:280,r:40,wind:.15,type:'blast',single:true,damage:20,desc:'单体20伤害 · 不附带眩晕',coop:'低费消费同伴孢毒或破绽；打断仍需落雷'},

 spark:{owner:1,name:'佯攻',icon:'闪',cost:1,range:300,r:35,wind:.15,type:'blast',single:true,damage:22,desc:'单体22伤害 · 无元素附伤',coop:'低费消费同伴孢毒或破绽；本招不生成标记'},
 tackle:  {owner:0,name:'撞击',icon:'➜',cost:2,range:210,r:60,wind:.2,type:'dash',damage:32,desc:'自身突进 · 落点伤害 32'},
 tide:    {owner:0,name:'回潮牵引',icon:'≈',cost:2,range:240,r:100,wind:.35,type:'blast',damage:34,pull:65,control:3,coop:'聚拢并减速，帮助同伴命中技能',desc:'伤害 34 · 向落点聚拢 65 · 牵制减速 35%'},
 shell:   {owner:0,name:'潮汐护甲',icon:'◈',cost:2,range:240,r:95,wind:.1,type:'shield',amount:45,coop:'授予同伴援盾；同伴突进可消耗至多 20 盾制造破绽',desc:'区域友军获得 45 护盾 · 6 秒'},
 spring:  {owner:0,name:'生命图腾',icon:'✣',cost:4,range:260,r:95,wind:.4,type:'healfield',amount:4,life:6,desc:'范围每秒治疗 4 · 6 秒 · 全队同时仅1个图腾'},
 rush:    {owner:0,name:'踏浪',icon:'↗',cost:2,range:235,r:65,wind:.15,type:'dash',damage:25,shield:25,desc:'自身跃迁 · 落点伤害 25 / 护盾 25'},
 lure:    {owner:0,name:'诱饵木偶',icon:'◎',cost:1,range:265,r:175,wind:.3,type:'lure',hp:45,life:5,desc:'45 生命诱饵 · 吸引近敌 5 秒'},
 fire:{owner:1,name:'高速星星',icon:'星',cost:2,range:320,r:55,wind:.3,type:'blast',single:true,damage:50,desc:'单体50伤害 · 无灼烧',coop:'接同伴孢毒或援盾突袭制造的破绽'},
 meteor:{owner:1,name:'破坏光线',icon:'光',cost:5,range:360,r:100,wind:.9,type:'blast',damage:56,centerDamage:160,centerRadius:35,desc:'中心最近单体160 · 其余溅射56 · 前摇0.9秒',coop:'同伴牵制、聚拢或打断后，再投入5费；落点判定不追踪'},
 ember:{owner:1,name:'帮助',icon:'援',cost:3,range:300,r:70,wind:.25,type:'shield',amount:55,desc:'区域友军护盾55 · 6秒 · 不叠加',coop:'给同伴援盾，接特殊位移制造破绽，或供岩獾碎甲击消耗'},
 retreat:{owner:1,name:'电光一闪',icon:'闪',cost:2,range:235,r:30,wind:.1,type:'dash',damage:25,desc:'自身突进 · 落点25伤害 · 不回血',coop:'带同伴援盾突进至少45距离，制造破绽后交给同伴追击'},
 snare:{owner:1,name:'咬住',icon:'牙',cost:2,range:160,r:35,wind:.3,type:'blast',single:true,damage:26,stun:.9,desc:'单体26伤害 · 打断0.9秒',coop:'短射程打断敌人大招，为同伴创造施法窗口'},
 bolt:    {owner:2,name:'落雷',icon:'ϟ',cost:3,range:330,r:80,wind:.4,type:'blast',damage:40,stun:1,desc:'范围伤害 40 · 眩晕 1 秒'},
 gale:    {owner:2,name:'逐风',icon:'彡',cost:2,range:280,r:90,wind:.3,type:'blast',damage:24,push:75,spread:100,detonate:12,coop:'击退逼近的敌人保护后排，或用直接命中消费同伴孢毒与破绽',desc:'范围伤害 24 · 击退 75'},
 flight:  {owner:2,name:'掠空',icon:'↟',cost:2,range:300,r:75,wind:.15,type:'dash',shield:25,desc:'自身跃迁 · 获得 25 护盾'},
 mend:    {owner:2,name:'羽息',icon:'✧',cost:2,range:260,r:85,wind:.1,type:'heal',amount:18,desc:'区域友军立刻回复 18 生命'},
 pack:    {owner:2,name:'风狼',icon:'双',cost:4,range:250,r:38,wind:.5,type:'pack',desc:'召唤两只风狼 · 10 秒 / 最多 4 只'}
};
const HEROES = [
 {kind:'turtle',name:'杰尼龟',hp:270,atk:11,range:40,speed:43,icon:'◈',desc:'承伤 / 保护',skills:['tide','shell','spring','rush','lure']},
 {kind:'fox',name:'伊布',hp:135,atk:18,range:165,speed:49,icon:'星',desc:'普通系 / 接力追击',skills:['fire','meteor','ember','retreat','snare']},
 {kind:'bird',name:'雷隼',hp:120,atk:14,range:175,speed:58,icon:'羽',desc:'控制 / 机动支援',skills:['bolt','gale','flight','mend','pack']},
 {kind:'sprout',name:'妙蛙种子',hp:150,atk:10,range:155,speed:46,icon:'芽',desc:'孢毒 / 牵制 / 共生',skills:['venom','vine','blossom','harvest']},
 {kind:'badger',name:'岩獾',hp:245,atk:12,range:42,speed:40,icon:'岩',desc:'援盾 / 护甲转伤',skills:['grit','rockrush','shieldstrike','bulwark']},
 {kind:'pikachu',name:'皮卡丘',hp:125,atk:12,range:155,speed:58,icon:'电',desc:'电系 / 控制接力',skills:['needle','thunderwave','electroball','voltswitch','bolt']},
 {kind:'gengar',name:'耿鬼',hp:145,atk:14,range:150,speed:48,icon:'影',desc:'幽灵 / 条件爆发',skills:['shadowpin','shadowball','hex','substitute']}
];
HEROES.forEach(h=>h.skills.push('tackle'));
HEROES[1].skills.push('spark');HEROES[0].skills.push('waterneedle');HEROES[2].skills.push('needle');
// Traits constrain learning; loadouts constrain normal casting.
const requirements={thunderwave:'lightning',electroball:'lightning',voltswitch:'lightning',shadowpin:'ghost',shadowball:'ghost',hex:'ghost',substitute:'ghost',venom:'spore',vine:'plant',blossom:'plant',harvest:'spore',grit:'earth',rockrush:'earth',shieldstrike:'earth',bulwark:'earth',waterneedle:'water',needle:'lightning',spark:'normal',fire:'normal',meteor:'normal',ember:'normal',snare:'fox',tide:'water',shell:'water',spring:'water',rush:'water',lure:'turtle',retreat:'fox',bolt:'lightning',gale:'wind',flight:'wings',mend:'wings',pack:'wind'};
const traitSets=[['water','turtle'],['normal','fox'],['lightning','wind','wings'],['plant','spore'],['earth'],['lightning'],['ghost','poison']];
HEROES.forEach((h,i)=>h.traits=traitSets[i]);
Object.entries(CARDS).forEach(([id,c])=>c.requires=requirements[id]||null);
function canLearn(hero,id){return !!HEROES[hero]&&!!CARDS[id]&&HEROES[hero].skills.includes(id)&&(!CARDS[id].requires||HEROES[hero].traits.includes(CARDS[id].requires));}
// Presets only change legal loadouts and placement. They never arrange the hand.
const TACTICS = {
 tempo:{party:[1,3],name:'轻重配招',roles:['承伤 / 保护','普通系 / 接力追击','控制 / 支援'],guide:'低费技能接力，高费技能兑现；正常随机抽牌。',loadouts:[['prepare','tide','shell','lure'],['spark','step','meteor','ember'],['step','gale','bolt','prepare']]},
 shared:{name:'公共撞击',roles:['撞击 / 授盾','撞击 / 追击','撞击 / 接力'],guide:'三只都带撞击：牌库有三张，任一张均可选择存活装备者。拖过头像再拖到目标。',loadouts:[['tackle','shell','tide','spring'],['tackle','fire','ember','retreat'],['tackle','bolt','gale','mend']]},
 wildfire:{name:'援盾接力',roles:['授盾 / 保护','普通系 / 突进','击退 / 保护'],guide:'同伴授盾，伊布突进制造破绽，再由同伴追击。',loadouts:[['tide','shell','spring','lure'],['fire','ember','snare','retreat'],['gale','flight','bolt','mend']]},
 escort:{name:'护送突袭',roles:['授盾 / 接应','接力追击','带盾突进 / 破甲'],guide:'杰尼龟给同伴援盾 → 雷隼掠空突进制造破绽 → 伊布直接伤害技追击。注意三者射程。',loadouts:[['shell','tide','spring','rush'],['fire','meteor','snare','retreat'],['flight','bolt','gale','mend']]}
};
Object.values(TACTICS).forEach(t=>{t.loadouts.push(['venom','vine','blossom','step'],['grit','rockrush','shieldstrike','step']);t.roles.push('孢毒 / 共生','援盾 / 碎甲');});
TACTICS.shared.loadouts[3]=['tackle','venom','blossom','vine'];TACTICS.shared.loadouts[4]=['tackle','grit','shieldstrike','bulwark'];TACTICS.shared.guide='上场精灵都装备撞击，任意撞击牌可选存活装备者；同伴授盾后突进，再由另一只追击。';
TACTICS.toxin={name:'孢毒接力',roles:[],party:[2,3],guide:'妙蛙种子孢针 → 雷隼雷针消费毒层；共生芽 → 短跃制造破绽 → 同伴追击。',loadouts:[['waterneedle','tide','shell','step'],['spark','fire','meteor','step'],['needle','gale','bolt','step'],['venom','vine','blossom','step'],['grit','rockrush','shieldstrike','step']]};
TACTICS.armor={name:'援盾碎甲',roles:[],party:[0,4],guide:'杰尼龟护甲 → 岩獾碎甲击；或带盾滚岩突袭 → 杰尼龟水针追击。',loadouts:[['waterneedle','shell','tide','step'],['spark','fire','meteor','step'],['needle','gale','bolt','step'],['venom','vine','blossom','step'],['grit','rockrush','shieldstrike','step']]};
const retiredSkills=['prepare','plan','step','sidestep'];
function upgradeLoadout(ids,hero){const legal=ids.filter(id=>canLearn(hero,id));const result=[];for(const id of ids){if(canLearn(hero,id)){result.push(id);continue;}const replacement=HEROES[hero].skills.find(c=>!legal.includes(c)&&!result.includes(c));if(replacement)result.push(replacement);}return result;}
Object.values(TACTICS).forEach(t=>t.loadouts=t.loadouts.map(upgradeLoadout));
TACTICS.tempo.loadouts=[['waterneedle','tide','shell','lure'],['spark','fire','meteor','ember'],['needle','gale','bolt','mend'],['venom','vine','blossom','harvest'],['grit','rockrush','shieldstrike','bulwark']];
TACTICS.wildfire={...TACTICS.wildfire,name:'援盾接力',party:[0,1],guide:'杰尼龟潮汐护甲 → 伊布电光一闪突进 → 杰尼龟水针追击；至少45距离且落点命中。',loadouts:[['waterneedle','shell','tide','rush'],['spark','retreat','fire','ember'],['needle','gale','bolt','flight'],['venom','vine','blossom','harvest'],['grit','rockrush','shieldstrike','bulwark']]};
TACTICS.tempo.roles=['承伤 / 保护','普通系 / 接力追击','控制 / 支援'];TACTICS.tempo.guide='本配招偏进攻；拖角色闪避只需保留1灵能。';
TACTICS.toxin.guide='孢针 → 雷针接毒；共生芽 → 同伴特殊位移技制造破绽。直接拖角色闪避不制造破绽。';
// Extend existing presets without changing their established parties or hand randomness.
Object.values(TACTICS).forEach(t=>{for(let i=t.loadouts.length;i<HEROES.length;i++)t.loadouts.push(HEROES[i].skills.slice(0,4));});
TACTICS.voltghost={name:'电影接力',party:[5,6],roles:[],guide:'耿鬼影缚 → 皮卡丘电球；皮卡丘电磁波 → 耿鬼祸不单行。只有同伴标记能加成，留灵能应对大招。',loadouts:HEROES.map(h=>h.skills.slice(0,4))};
TACTICS.venomhex={name:'毒影追击',party:[3,6],roles:[],guide:'妙蛙种子孢针 → 耿鬼暗影球低费接毒，或积攒4费祸不单行；替身争取施法窗口。',loadouts:HEROES.map(h=>h.skills.slice(0,4))};
TACTICS.tactical={name:'攻防取舍',party:[1,3],roles:[],guide:'护盾、输出和闪避共享灵能。拖角色使用手中闪避牌；预留1费与手牌，或选择承伤抢杀。损血带到下关，营地治疗与遗物二选一。',loadouts:HEROES.map(h=>[...h.skills.slice(0,3),'sidestep'])};
TACTICS.tactical.loadouts[0]=['waterneedle','shell','tide','rush'];TACTICS.tactical.loadouts[1]=['spark','fire','meteor','ember'];
Object.values(TACTICS).forEach(t=>t.loadouts=t.loadouts.map(upgradeLoadout));
TACTICS.tactical.guide='输出、防御和闪避共享灵能。闪避只耗1灵能，不占配招或手牌；损血带到下关。';
const RELICS = [
 {id:'power',name:'雷火铭文',desc:'所有技能伤害 +20%（残响仅结算一次）'},
 {id:'flow',name:'灵能泉眼',desc:'灵能恢复从每秒 1 提高至 1.25'},
 {id:'vital',name:'生命枝芽',desc:'上场主力最大生命 +35'}
];
const MISSIONS = [
 {id:'guard',name:'溪口守卫',goal:'击败首领与三名随从，守住灵核',limit:100},
 {id:'occupy',name:'夺取风眼',goal:'主力占据风眼累计 14 秒，敌人在圈内时停计',limit:100,x:660,y:155,r:88,required:14},
 {id:'break',name:'摧毁裂隙',goal:'推进并摧毁右下方封印',limit:100,x:825,y:345}
];
const ENEMIES = {
 raider:{name:'刺牙',kind:'raider',hp:100,atk:8,range:33,speed:45,capturable:true},
 brute:{name:'裂角',kind:'brute',hp:195,atk:10,range:42,speed:34,capturable:true},
 archer:{name:'咒焰',kind:'archer',hp:95,atk:8,range:150,speed:37,capturable:true},
 rage:{name:'蓄怒兽',kind:'brute',trait:'rage',hp:170,atk:8,range:42,speed:34,capturable:true},
 crystal:{name:'晶甲兽',kind:'brute',trait:'crystal',hp:155,atk:8,range:42,speed:30,capturable:true},
 regen:{name:'回生苔兽',kind:'raider',trait:'regen',hp:140,atk:8,range:33,speed:38,capturable:true},
 guard:{name:'护卫岩兽',kind:'brute',trait:'guard',hp:180,atk:8,range:42,speed:32,capturable:true},
 priest:{name:'共鸣祭司',kind:'archer',trait:'priest',hp:105,atk:6,range:150,speed:35,capturable:true},
 ambush:{name:'伏击影兽',kind:'raider',trait:'ambush',hp:115,atk:7,range:33,speed:48,capturable:true},
 boss:{name:'喷火龙',kind:'boss',hp:650,atk:12,range:50,speed:30,capturable:false}
};
const WAVE_PLANS=[
 [[0,'boss',0,760,155],[0,'rage',0,850,95],[0,'crystal',1,800,345],[0,'archer',0,870,225]],
 [[0,'boss',0,760,155],[0,'regen',1,800,345],[0,'guard',0,850,95],[0,'priest',0,870,225]],
 [[0,'boss',1,760,345],[0,'ambush',0,800,155],[0,'archer',1,870,405],[0,'rage',1,850,265]]
];
const ENEMY_INFO={raider:'近战消耗：保护脆弱后排。',brute:'蓄力直线冲撞：侧向位移或打断。',archer:'延迟轰炸锁定落点：离开预警圈。',rage:'每8秒蓄怒强化大招：优先击破，或留控制打断。',crystal:'4秒内4次直接命中破甲：小技能配合普攻，破甲后再爆发；灼烧不计次数。',regen:'4秒未受伤开始回血：孢毒或持续进攻压制回血。',guard:'护链保护附近同伴：击杀护卫或击退拉开连接。',priest:'吟唱强化同伴下一次大招：保留落雷或咬住打断。',ambush:'标记远程主力位置后突袭：保留位移躲落点。',boss:'蓄力重锤，收招时停步停攻：拖角色闪避，高费技能反击。'};
Object.values(CARDS).forEach(c=>{c.tags=[];if(c.poison||c.harvest)c.tags.push('孢毒');if(c.shieldStrike)c.tags.push('护甲转伤');if(c.single)c.tags.push('单体');if(c.burn)c.tags.push('点燃');if(c.stun)c.tags.push('打断');if(c.type==='dash')c.tags.push('位移');if(c.centerDamage)c.tags.push('单体爆发');if(c.type==='firefield'||c.type==='blast'&&!c.centerDamage&&!c.single)c.tags.push('范围压制');if(c.type==='shield'||c.type==='lure'||c.shield)c.tags.push('保护');if(c.type==='heal'||c.type==='healfield'||c.heal)c.tags.push('治疗');if(c.spread||c.pull||c.push||c.control||c.allySetupBonus)c.tags.push('协作');if(c.type==='pack')c.tags.push('召唤');});
function validBuild(b){return !!b&&b.version===1&&Array.isArray(b.activeHeroes)&&[2,3].includes(b.activeHeroes.length)&&new Set(b.activeHeroes).size===b.activeHeroes.length&&b.activeHeroes.every(i=>Number.isInteger(i)&&!!HEROES[i])&&Array.isArray(b.loadouts)&&[3,5,HEROES.length].includes(b.loadouts.length)&&b.loadouts.every((ids,i)=>Array.isArray(ids)&&ids.length===4&&new Set(ids).size===4&&ids.every(id=>canLearn(i,id)||retiredSkills.includes(id)));}
class Game {
 constructor({seed = (Date.now() ^ Math.floor(Math.random()*1e9)) >>> 0} = {}) {
  this.seed=seed; this.randomState=seed; this.phase='setup'; this.paused=false; this.wave=0;
  this.time=0; this.waveTime=0; this.maxEnergy=6;this.energy=6; this.regen=1; this.power=1; this.serial=0;
  this.core={id:'core',x:65,y:250,hp:260,max:260,side:0,kind:'core'};
  this.units=[]; this.mains=[]; this.fields=[]; this.effects=[]; this.pending=[];this.orders=[];
  this.activeHeroes=[0,1,2];this.placed=HEROES.map(()=>null); this.loadouts=HEROES.map(h=>h.skills.slice(0,4));
  this.tactic=null;this.coopEvents=[];this.coopSeen=new Set();
  this.hand=[]; this.deck=[]; this.discard=[]; this.mulliganUsed=false;
  this.damageCarry=HEROES.map(()=>0);this.relics=[]; this.wounds=HEROES.map(()=>false); this.captured=[]; this.captureCooldown=0;
  this.stats={played:0,damage:0,healed:0,lured:0,captureAttempts:0,captures:0,cooperations:0,trios:0,coopDamage:0};
  this.message='七只候选精灵，上场两或三只，每只四招。';
 }
 get enemyIntel(){return [...new Set(WAVE_PLANS[this.wave].map(w=>w[1]))].map(id=>({id,name:ENEMIES[id].name,advice:ENEMY_INFO[id]}));}
 exportBuild(){return {version:1,activeHeroes:[...this.activeHeroes],loadouts:this.loadouts.map(a=>[...a])};}
 applyBuild(b){if(this.phase!=='setup'||!validBuild(b))return false;this.activeHeroes=[...b.activeHeroes].sort();this.loadouts=HEROES.map((h,i)=>upgradeLoadout(b.loadouts[i]||h.skills.slice(0,4),i));this.tactic=null;this.quick();return true;}
 get partyCards(){return this.activeHeroes.flatMap(i=>this.loadouts[i]);}
 setParty(ids){
  if(this.phase!=='setup'||!Array.isArray(ids)||![2,3].includes(ids.length)||new Set(ids).size!==ids.length||ids.some(i=>!Number.isInteger(i)||!HEROES[i]))return false;
  this.activeHeroes=[...ids].sort();if(this.activeHeroes.some(i=>!this.placed[i]))this.quick();return true;
 }
 get mission(){return MISSIONS[this.wave];}
 random(){let t=this.randomState+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
 shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 unit(spec,x,y,side=0){return {...spec,id:'u'+(++this.serial),x,y,side,max:spec.hp,lane:y<250?0:1,attack:.5,stun:0,flash:0,shield:0,shieldTime:0,busy:null,hold:0,dodgeCooldown:0};}
 valid(x,y,zone='any'){return Number.isFinite(x)&&Number.isFinite(y)&&x>=105&&x<=905&&y>=55&&y<=445&&(zone!=='home'||x<=405)&&!(x>430&&x<570&&Math.min(...LANES.map(l=>Math.abs(y-l)))>38);}
 fail(message){this.message=message;return false;}
 place(i,x,y){
  if(this.phase!=='setup'||!HEROES[i]||!this.activeHeroes.includes(i)||!this.valid(x,y,'home'))return this.fail('请放在左侧部署区。');
  if(this.placed.some((p,j)=>p&&this.activeHeroes.includes(j)&&i!==j&&distance(p,{x,y})<48))return this.fail('纹兽之间需要留一点空间。');
  this.placed[i]={x,y};return true;
 }
 quick(){if(this.phase==='setup'){this.placed=HEROES.map(()=>null);const points=[{x:375,y:155},{x:265,y:155},{x:355,y:345}];this.activeHeroes.forEach((id,j)=>this.placed[id]={...points[j]});}} 
 setTactic(id){
  const tactic=TACTICS[id];if(this.phase!=='setup'||!tactic)return false;
  if(tactic.party)this.setParty(tactic.party);this.tactic=id;this.loadouts=tactic.loadouts.map(a=>[...a]);
  this.quick();if(this.activeHeroes.every(i=>i<3))this.placed.splice(0,3,{x:370,y:190},{x:265,y:155},{x:345,y:290});
  this.message=tactic.guide+' 起手仍然随机，可继续调整阵型与配招。';return true;
 }
 swapSkill(owner,outId,inId){
  if(this.phase!=='setup'||!canLearn(owner,inId)||this.loadouts[owner].includes(inId))return false;
  const i=this.loadouts[owner].indexOf(outId);if(i<0)return false;
  this.loadouts[owner][i]=inId;this.tactic=null;return true;
 }
 start(){
  if(this.phase!=='setup'||this.activeHeroes.some(i=>!this.placed[i]||this.loadouts[i].length!==4||new Set(this.loadouts[i]).size!==4||this.loadouts[i].some(id=>!canLearn(i,id))))return false;
  this.mains=this.activeHeroes.map(i=>{
   const p=this.placed[i];
   const max=this.journeyMax(i),u=this.unit({...HEROES[i],hp:max,hero:i},p.x,p.y);u.hp=this.journeyHP(i);return u;
  });
  this.units=[...this.mains];this.fields=[];this.effects=[];this.pending=[];this.orders=[];this.discard=[];this.coopEvents=[];this.coopSeen.clear();
  this.deck=this.shuffle(this.partyCards);this.hand=this.deck.splice(0,4);
  this.phase='opening';this.mulliganUsed=false;this.waveTime=0;this.energy=this.maxEnergy;this.control=0;
  this.core.hp=this.core.max;this.captureCooldown=0;this.nextThreatAt=0;this.seal=null;
  this.message='最多选择两张换掉，或直接保留。确认后立刻开战。';return true;
 }
 openBattle(slots=[]){
  if(this.phase!=='opening'||this.mulliganUsed||!Array.isArray(slots)||slots.length>2||new Set(slots).size!==slots.length||slots.some(i=>!Number.isInteger(i)||i<0||i>3))return false;
  const removed=slots.map(i=>this.hand[i]);
  for(const i of slots)this.hand[i]=this.deck.shift();
  this.deck.push(...removed);this.shuffle(this.deck);this.mulliganUsed=true;
  this.phase='battle';this.paused=false;
  const waves=WAVE_PLANS[this.wave];
  this.schedule=waves.map(([t,k,l,x,y])=>({t,k,l,x,y}));
  if(this.wave===2){this.seal=this.unit({kind:'seal',name:'裂隙封印',hp:this.activeHeroes.length===2?400:530,atk:0,range:0,speed:0},this.mission.x,this.mission.y,1);this.units.push(this.seal);}
  this.message=this.mission.goal+'。上场主力全倒下立即失败。';return true;
 }
 spawn(k,l){const spec={...ENEMIES[k]};if(this.activeHeroes.length===2){spec.hp=Math.round(spec.hp*.8);spec.atk*=.85;}const u=this.unit(spec,900,LANES[l],1);u.lastHurt=this.time;u.attack=u.kind==='boss'?ENEMY_CADENCE.openingBossBasic:ENEMY_CADENCE.openingBasic;this.units.push(u);return u;}
 refill(){
  for(let i=0;i<4;i++)if(!this.hand[i]){
   if(!this.deck.length&&this.discard.length)this.deck=this.shuffle(this.discard.splice(0));
   if(this.deck.length)this.hand[i]=this.deck.shift();
  }
 }
 casters(id){
  const owners=this.mains.filter(u=>canLearn(u.hero,id)&&this.loadouts[u.hero].includes(id));
  const alive=owners.filter(u=>u.hp>0),echo=owners.length>0&&!alive.length;
  return {echo,units:echo?this.mains.filter(u=>u.hp>0):alive};
 }
 get reservedEnergy(){return (this.orders||[]).reduce((n,o)=>n+CARDS[o.card].cost,0);}
 get availableEnergy(){return this.energy-this.reservedEnergy;}
 skillTargets(c,point){const targets=this.units.filter(u=>u.side&&u.hp>0&&distance(u,point)<=c.r);return c.single?targets.sort((a,b)=>distance(a,point)-distance(b,point)||a.id.localeCompare(b.id)).slice(0,1):targets;}
 meteorTarget(c,point){return this.units.filter(u=>u.side&&u.hp>0&&distance(u,point)<=c.centerRadius).sort((a,b)=>distance(a,point)-distance(b,point)||a.id.localeCompare(b.id))[0];}
 orderForSlot(slot){return this.orders.find(o=>o.slot===slot);}
 approachPath(caster,point,range){
  if(!caster.speed)return null;
  const ghost={...caster},path=[{x:ghost.x,y:ghost.y}];
  for(let i=0;i<2400&&distance(ghost,point)>range-.5;i++){
   this.move(ghost,point,.05);if(!this.valid(ghost.x,ghost.y))return null;
   if(distance(path[path.length-1],ghost)>15)path.push({x:ghost.x,y:ghost.y});
  }
  if(distance(ghost,point)>range)return null;path.push({x:ghost.x,y:ghost.y});return path;
 }
 commandPreview(slot,x,y,casterId){
  const p=this.preview(slot,x,y,casterId);
  if(!p.outOfRange)return p;
  const path=this.approachPath(p.caster,{x,y},p.range);
  return {...p,valid:!!path,reason:path?'靠近后施放；点击待施放牌取消':'没有可达的施法位置',approach:!!path,path};
 }
 commandCast(slot,x,y,casterId){
  if(this.paused)return this.fail('已暂停，继续后再出牌。');
  const p=this.commandPreview(slot,x,y,casterId);
  if(!p.valid)return this.fail(p.reason);
  if(!p.approach)return this.cast(slot,x,y,casterId);
  const c=CARDS[this.hand[slot]];
  const o={id:'o'+(++this.serial),slot,card:this.hand[slot],casterId:p.casterId,x,y,path:p.path};
  this.orders.push(o);p.caster.busy=o.id;this.message=p.caster.name+'正在靠近 · '+c.name+'（点击该牌取消）';return true;
 }
 cancelOrder(slot){
  const o=this.orderForSlot(slot);if(!o)return false;
  this.orders=this.orders.filter(q=>q!==o);const u=this.mains.find(u=>u.id===o.casterId);if(u?.busy===o.id)u.busy=null;
  this.message='移动施法已取消，灵能预留已释放。';return true;
 }
 tickOrders(dt){
  for(const o of [...this.orders]){
   const u=this.mains.find(u=>u.id===o.casterId);
   if(!u||u.hp<=0||u.stun>0||this.hand[o.slot]!==o.card){this.cancelOrder(o.slot);continue;}
   const range=CARDS[o.card].range*(this.casters(o.card).echo?.7:1);
   if(distance(u,o)<=range){this.cancelOrder(o.slot);this.cast(o.slot,o.x,o.y,u.id);continue;}
   this.move(u,o,dt);
  }
 }
 comboHint(slot){
  const c=CARDS[this.hand[slot]];if(!c||this.orderForSlot(slot)||this.availableEnergy<c.cost)return null;
  for(const u of this.casters(this.hand[slot]).units){
   if(u.busy||u.stun>0)continue;
   for(const t of this.units.filter(t=>t.side&&t.hp>0)){
    if(c.allySetupBonus&&this.setupMark(t,u.id)&&this.preview(slot,t.x,t.y,u.id).valid)return {text:'接同伴标记',casterId:u.id,targetId:t.id};
    if(c.damage&&this.active(t.poison)&&t.poison.sourceId!==u.id&&this.preview(slot,t.x,t.y,u.id).valid)return {text:'接孢毒',casterId:u.id,targetId:t.id};
    const mark=c.spread?this.active(t.burn)&&t.burn:c.type==='firefield'?this.active(t.controlTag)&&t.controlTag:c.damage?this.active(t.breach)&&t.breach:null;
    if(mark&&mark.sourceId!==u.id&&this.preview(slot,t.x,t.y,u.id).valid)return {text:c.spread?'接灼烧':c.type==='firefield'?'接牵制':'追破绽',casterId:u.id,targetId:t.id};
   }
  }return null;
 }
 preview(slot,x,y,preferredId){
  const id=this.hand[slot],c=CARDS[id],point={x,y};
  if(!c)return {valid:false,reason:'此手牌位正在补牌。'};
  if(c.quickDodge){const units=this.casters(id).units,unit=preferredId?units.find(u=>u.id===preferredId):units.slice().sort((a,b)=>distance(a,point)-distance(b,point))[0];return unit?this.dodgePreview(unit.id,x,y,slot):{valid:false,reason:'没有存活的主力可以施法。'};}
  const {echo,units:available}=this.casters(id),range=c.range*(echo?.7:1);
  const eligible=available.filter(u=>!u.busy&&u.stun<=0&&distance(u,point)<=range);
  const stable=eligible.find(u=>u.id===preferredId);
  const caster=preferredId?available.find(u=>u.id===preferredId):eligible.sort((a,b)=>distance(a,point)-distance(b,point))[0]||available[0];
  let reason='';
  if(this.phase!=='battle')reason='战斗开始后可施放。';
  else if(this.orderForSlot(slot))reason='该手牌已预留，点击取消移动施法。';
  else if(!this.valid(x,y))reason='落点需要是陆地或石桥。';
  else if(!caster)reason='没有存活的主力可以施法。';
  else if(caster.busy)reason=caster.name+'正在施法。';
  else if(caster.stun>0)reason=caster.name+'被控制，暂时不能施法。';
  else if(c.type==='pack'&&this.units.filter(u=>u.kind==='wolf'&&u.hp>0).length>2)reason='风狼最多同时存在 4 只。';
  else if(this.availableEnergy<c.cost)reason='灵能不足：需要 '+c.cost+' 点。';
  const outOfRange=!reason&&distance(caster,point)>range;
  if(outOfRange)reason='超出射程，可下达靠近施法指令。';
  const coop=caster?this.coopPreview(c,caster,point,echo?.45:1):{text:'',targets:[],links:[]};
  return {valid:!reason,reason,outOfRange,casterId:caster?.id,caster,echo,range,card:id,x,y,coop};
 }
 cast(slot,x,y,expectedCasterId){
  if(this.paused)return this.fail('已暂停，继续战斗后再出牌。');
  const p=this.preview(slot,x,y,expectedCasterId);
  if(expectedCasterId&&p.casterId!==expectedCasterId)return this.fail('施法者已变化，请看新的高亮后再次确认。');
  if(!p.valid)return this.fail(p.reason);
  const id=this.hand[slot],c=CARDS[id],caster=p.caster;
  if(c.quickDodge)return this.dodge(caster.id,x,y,slot);
  this.energy-=c.cost;this.hand[slot]=null;this.stats.played++;
  const action={id:'s'+(++this.serial),card:id,casterId:caster.id,echo:p.echo,potency:p.echo?.45:1,x,y,r:c.r,stage:'windup',wait:c.wind,total:c.wind};
  caster.busy=action.id;this.pending.push(action);this.refill();
  // The played card enters discard only after resolving or being interrupted.
  this.message=caster.name+(p.echo?'承接残响 · ':'施放 · ')+c.name;return true;
 }
 capturePreview(id){
  const target=this.units.find(u=>u.id===id),probability=target?.capturable?Math.min(.85,.15+.7*(1-target.hp/target.max)):0;
  let reason='';
  if(this.phase!=='battle')reason='战斗中才能捕获。';
  else if(!target||target.hp<=0||target.captured)reason='目标已离场，不扣费。';
  else if(!target.side||!target.capturable)reason='只能捕获野生纹兽；守卫与封印不可捕获。';
  else if(target.hp/target.max>.5)reason='先将目标削弱至半血以下，再尝试捕获。';
  else if(this.captureCooldown>0)reason='捕获冷却 '+this.captureCooldown.toFixed(1)+' 秒。';
  else if(this.availableEnergy<3)reason='捕获需要 3 点灵能。';
  return {valid:!reason,reason,target,probability,cost:3};
 }
 capture(id){
  if(this.paused)return this.fail('已暂停，继续战斗后再捕获。');
  const p=this.capturePreview(id);if(!p.valid)return this.fail(p.reason);
  this.energy-=p.cost;this.captureCooldown=1.2;this.stats.captureAttempts++;
  const success=this.random()<p.probability;
  if(success){p.target.captured=true;p.target.hp=0;this.captured.push({name:p.target.name,kind:p.target.kind});this.stats.captures++;}
  this.effects.push({kind:'capture',x:p.target.x,y:p.target.y,r:45,text:success?'收服成功':'挣脱了',life:1.2,max:1.2});
  this.message=p.target.name+(success?'已收服，已收入本次旅程的收服记录。':'挣脱了！消耗 3 灵能，队伍仍正常交战。');
  return {success,probability:p.probability};
 }
 heal(u,n){if(u.hp<=0)return;const amount=Math.min(u.max-u.hp,n);u.hp+=amount;this.stats.healed+=amount;}
 active(mark){return mark&&mark.until>this.time;}
 wardInfo(u){return u.shield>0&&u.shieldTime>0&&this.active(u.ward)&&u.ward.sourceId!==u.id?u.ward:null;}
 grantShield(u,amount,sourceId){
  // A weaker/self shield cannot silently take credit for a stronger ally shield.
  if(amount>u.shield||u.shieldTime<=0){u.shield=amount;u.shieldTime=6;u.ward={sourceId,until:this.time+6};}
  else if(u.ward?.sourceId===sourceId){u.shieldTime=6;u.ward.until=this.time+6;}
 }
 applyBurn(u,burn){
  if(u.hp<=0)return;
  if(!this.active(u.burn)||burn.dps>=u.burn.dps)u.burn={...burn,until:this.time+4};
 }
 cooperate(kind,target,sourceIds,key){
  const ids=[...new Set(sourceIds)].filter(id=>this.mains.some(u=>u.id===id));
  if(ids.length<2||this.coopSeen.has(key))return;
  this.coopSeen.add(key);this.stats.cooperations++;if(ids.length===3)this.stats.trios++;
  const names=ids.map(id=>this.mains.find(u=>u.id===id).name);
  const event={kind,targetId:target.id,sourceIds:ids,key,time:this.time,text:names.join(' → ')+' · '+kind};
  this.coopEvents.push(event);if(this.coopEvents.length>8)this.coopEvents.shift();
  this.effects.push({kind:'coop',x:target.x,y:target.y,r:40,text:ids.length===3?'三兽合击':kind,life:1.4,max:1.4});
 }
 applyPoison(u,p){if(u.hp<=0)return;const old=this.active(u.poison)&&u.poison.sourceId===p.casterId?u.poison:null;u.poison={sourceId:p.casterId,token:p.id,stacks:Math.min(3,(old?.stacks||0)+1),strength:p.potency,until:this.time+6};}
 setupMark(u,casterId){return [u.poison,u.controlTag].find(m=>this.active(m)&&m.sourceId!==casterId);}
 skillHit(u,base,p,source){
  const poison=u.poison,c=CARDS[p.card],setup=c?.allySetupBonus&&this.setupMark(u,p.casterId);
  if(u.hp>0&&setup){const extra=c.allySetupBonus*Math.min(setup.strength??1,p.potency)*this.power;this.stats.coopDamage+=Math.max(0,Math.min(u.hp,base+extra)-Math.min(u.hp,base));base+=extra;this.cooperate('异兽协攻',u,[setup.sourceId,p.casterId],p.id+':setup:'+u.id);this.effects.push({kind:'text',text:'协攻 +'+Math.round(extra),x:u.x,y:u.y-30,life:1,max:1});}
  if(u.hp>0&&this.active(poison)&&poison.stacks>0&&poison.lastProc!==p.id&&(c?.harvest||poison.sourceId!==p.casterId)){
   const stacks=c?.harvest?poison.stacks:1,extra=stacks*(c?.harvest?10:12)*Math.min(poison.strength,p.potency)*this.power;
   poison.lastProc=p.id;poison.stacks-=stacks;if(!poison.stacks)u.poison=null;this.stats.coopDamage+=poison.sourceId!==p.casterId?Math.max(0,Math.min(u.hp,base+extra)-Math.min(u.hp,base)):0;
   this.cooperate('孢毒接力',u,[poison.sourceId,p.casterId],p.id+':poison:'+u.id);base+=extra;
   this.effects.push({kind:'text',text:'孢毒兑现 +'+Math.round(extra),x:u.x,y:u.y-30,life:1,max:1});
  }

  const mark=u.breach;
  if(u.hp>0&&this.active(mark)&&mark.sourceId!==p.casterId){
   const extra=24*mark.strength*p.potency*this.power;
   this.stats.coopDamage+=Math.max(0,Math.min(u.hp,base+extra)-Math.min(u.hp,base));
   u.breach=null; // Consume once, before damage can kill the target or finish combat.
   this.cooperate('接力追击',u,[mark.helperId,mark.sourceId,p.casterId],mark.token+':follow:'+u.id);
   base+=extra;
  }
  this.hit(u,base,{...source,direct:true,hitToken:p.id});
 }
 coopPreview(c,caster,point,potency){
  const targets=this.skillTargets(c,point),links=[];
  let highlighted=[],notes=[];
  if(c.centerRadius){const center=this.meteorTarget(c,point);if(center)highlighted.push(center);notes.push(center?'中心重击 '+center.name+' '+Math.round(c.centerDamage*potency*this.power)+'；其他目标溅射 '+Math.round(c.damage*potency*this.power):'中心35范围内无目标，仅造成外围溅射；命中时重判');}
  if(c.damage){const poisoned=targets.filter(u=>this.active(u.poison)&&(c.harvest||u.poison.sourceId!==caster.id));if(poisoned.length){highlighted.push(...poisoned);notes.push(c.harvest?'消耗全部孢毒，每层追加10伤害':'接同伴孢毒：每目标消耗1层，追加12伤害');}}
  if(c.allySetupBonus){const marked=targets.filter(u=>this.setupMark(u,caster.id));highlighted.push(...marked);notes.push(marked.length?'可接同伴标记，追加至多 '+Math.round(c.allySetupBonus*potency*this.power)+' 伤害；命中时重判':'需要同伴的孢毒或牵制；自己的标记不追加协攻伤害');}
  if(c.shieldStrike)notes.push('命中消耗自身至多30盾，当前可追加 '+Math.round(Math.min(30,caster.shield)*1.5*potency*this.power)+' 伤害');
  const name=id=>this.mains.find(u=>u.id===id)?.name||'同伴';
  if(c.type==='shield'){
   const friends=this.mains.filter(u=>u.hp>0&&u.id!==caster.id&&distance(u,point)<=c.r);
   highlighted=friends;notes.push(friends.length?'援护 '+friends.map(u=>u.name).join('、')+'：带盾突进可制造破绽':'瞄准同伴授予援盾；自身护盾不触发协作');
   for(const u of friends)links.push({from:caster,to:u});
  }
  if(c.quickDodge)return {text:'消耗一张闪避牌与1灵能；不获得无敌或援盾破绽',targets:[],links:[]};
  if(c.type==='dash'){
   const ward=this.wardInfo(caster);
   if(ward&&distance(caster,point)>=45&&targets.length){
    notes.push(name(ward.sourceId)+'援盾 → 消耗 '+Math.min(20,caster.shield).toFixed(0)+' 盾，使 '+targets.length+' 个目标暴露破绽 5 秒');highlighted=targets;
    links.push({from:this.mains.find(u=>u.id===ward.sourceId),to:caster});
   }else notes.push(!ward?'同伴援盾 + 至少 45 距离突进，可使落点敌人暴露破绽':distance(caster,point)<45?'位移至少 45 才能突袭；原地施放不会消耗援盾':'援盾已就绪；落点附近无敌人，不消耗援盾');
  }
  if(c.pull){
   highlighted=targets;notes.push('聚拢 '+targets.length+' 个目标并减速，方便同伴命中高费技能');
   for(const u of targets)links.push({from:u,to:this.shiftPoint(u,point,-c.pull*potency)});
  }
  if(c.type==='firefield'){
   const held=targets.filter(u=>this.active(u.controlTag)&&u.controlTag.sourceId!==caster.id);
   highlighted=held;notes.push(held.length?'同伴牵制 '+held.length+' 个目标：火区伤害 +35%':'把火区铺到同伴牵制的敌人脚下，可提高伤害');
  }
  if(c.spread){
   const burning=targets.filter(u=>this.active(u.burn)&&u.burn.sourceId!==caster.id);
   highlighted=[...burning];notes.push(burning.length?'可借 '+name(burning[0].burn.sourceId)+'的火势爆燃 +'+(c.detonate*potency*this.power).toFixed(0)+' 并扩散；按箭头检查击退方向':'击退保护同伴，或消费同伴孢毒与破绽；按箭头检查方向');
   for(const u of targets)links.push({from:u,to:this.shiftPoint(u,caster,c.push*potency)});
   const receivers=new Set();
   for(const origin of burning){const landing=this.shiftPoint(origin,caster,c.push*potency);for(const t of this.units.filter(t=>t.side&&t.hp>0&&t.id!==origin.id)){
    const position=targets.includes(t)?this.shiftPoint(t,caster,c.push*potency):t;
    if(distance(position,landing)<=c.spread&&(!this.active(t.burn)||t.burn.dps<origin.burn.dps*potency)){receivers.add(t.id);highlighted.push(t);links.push({from:landing,to:position});}
   }}if(burning.length)notes.push('预计扩散 '+receivers.size+' 个目标');
  }
  const breaches=c.damage?targets.filter(u=>this.active(u.breach)&&u.breach.sourceId!==caster.id):[];
  if(breaches.length){highlighted.push(...breaches);notes.push('可追击 '+breaches.length+' 个破绽目标（每目标一次，最多 +'+(24*potency*this.power).toFixed(0)+' 伤害）');}
  if(!notes.length&&c.damage)notes.push('命中同伴制造的破绽可追加追击；仍受自身射程限制');
  return {text:notes.join('；'),targets:[...new Set(highlighted.map(u=>u.id))],links:links.filter(l=>l.from&&l.to)};
 }
 guardFor(target){return this.units.find(e=>e.hp>0&&e.side===target.side&&e.trait==='guard'&&e.guardTarget===target.id&&e.guardBank>0&&distance(e,target)<=150);}
 tickTrait(u,dt){
  if(u.trait==='rage'){u.rageClock=(u.rageClock||0)+dt;if(u.rageClock>=8){u.rageClock-=8;u.rage=Math.min(3,(u.rage||0)+1);}}
  if(u.trait==='crystal'&&this.time>(u.comboUntil||0)){u.crystalHits=0;u.crystalTokens=new Set();}
  if(u.trait==='regen'&&this.time-(u.lastHurt??this.time)<4)u.regenerating=false;
  else if(u.trait==='regen'){u.regenerating=u.hp<u.max;u.hp=Math.min(u.max,u.hp+6*dt);}
  if(u.trait==='guard'){
   const target=this.units.find(t=>t.id===u.guardTarget&&t.hp>0&&distance(u,t)<=150);
   if(!target){u.guardTarget=null;u.guardBank=0;}
   if(this.time>=(u.guardAt||0)){const t=this.units.filter(t=>t.side===u.side&&t.hp>0&&t.id!==u.id&&t.kind!=='seal'&&distance(u,t)<=150).sort((a,b)=>distance(u,a)-distance(u,b))[0];if(t){u.guardTarget=t.id;u.guardBank=35;u.guardAt=this.time+8;}}
  }
 }
 hit(u,n,source){
  if(this.phase!=='battle'||u.hp<=0)return;
  if(u.side&&n>0){
   u.lastHurt=this.time;
   if(u.trait==='crystal'){
    const weak=(u.vulnerableUntil||0)>this.time;n*=weak?1.4:.65;
    if(!weak&&source?.direct){if(this.time>(u.comboUntil||0)){u.crystalHits=0;u.crystalTokens=new Set();}const token=source.hitToken;u.crystalTokens??=new Set();if(!u.crystalTokens.has(token)){if(!u.crystalHits)u.comboUntil=this.time+4;u.crystalTokens.add(token);u.crystalHits=(u.crystalHits||0)+1;if(u.crystalHits>=4){u.vulnerableUntil=this.time+5;u.crystalHits=0;u.crystalTokens.clear();this.effects.push({kind:'text',text:'晶甲破裂 · 虚弱5秒',x:u.x,y:u.y,life:1.3,max:1.3});}}}
   }
   const guard=this.guardFor(u);if(guard){const blocked=Math.min(n,guard.guardBank);guard.guardBank-=blocked;n-=blocked;}
  }
  const absorbed=Math.min(u.shield||0,n);u.shield=Math.max(0,(u.shield||0)-absorbed);n-=absorbed;
  const done=Math.min(u.hp,n);u.hp=Math.max(0,u.hp-n);u.flash=.13;
  if(u.side===1&&source?.side===0)this.stats.damage+=done;
  if(n>=1)this.effects.push({kind:'text',x:u.x,y:u.y,text:'−'+Math.ceil(n),life:.6,max:.6});
  if(source)this.effects.push({kind:'line',x:source.x,y:source.y,tx:u.x,ty:u.y,side:source.side,life:.16,max:.16});
  if(this.core.hp<=0)this.finish(false,'灵核被摧毁。');
  else if(this.mains.length>0&&this.mains.every(h=>h.hp<=0))this.finish(false,'上场主力全部倒下。');
  else if(this.seal&&this.seal.hp<=0)this.finish(true,'裂隙封印已被摧毁。');
 }
 displace(u,x,y){if(!this.valid(x,y))return;u.x=x;u.y=y;u.lane=y<250?0:1;u.hold=2.5;}
 shiftPoint(u,source,amount){
  if(u.kind==='seal')return {x:u.x,y:u.y};const d=distance(u,source);if(d<.001)return {x:u.x,y:u.y};
  const sign=Math.sign(amount),length=amount<0?Math.min(-amount,d):amount;
  for(let n=length;n>0;n-=5){const x=u.x+(u.x-source.x)/d*n*sign,y=u.y+(u.y-source.y)/d*n*sign;
   if(this.valid(x,y))return {x,y};}
  return {x:u.x,y:u.y};
 }
 push(u,source,amount){
  const point=this.shiftPoint(u,source,amount);u.x=point.x;u.y=point.y;u.lane=u.y<250?0:1;
 }
 resolve(p){
  const c=CARDS[p.card],s=p.potency,source={...p.from,side:0};
  const allies=this.units.filter(u=>u.hp>0&&!u.side&&distance(u,p)<=c.r);
  const burning=[],center=c.centerRadius?this.meteorTarget(c,p):null;
  if(c.type==='blast')for(const u of this.skillTargets(c,p)){
   const burn=this.active(u.burn)&&u.burn.sourceId!==p.casterId?{...u.burn}:null;
   let armorExtra=0;const caster=this.mains.find(h=>h.id===p.casterId);if(c.shieldStrike&&caster?.hp>0){const ward=this.wardInfo(caster),spent=Math.min(30,caster.shieldTime>0?caster.shield:0);caster.shield-=spent;armorExtra=spent*1.5*s*this.power;if(ward&&spent)this.cooperate('援盾碎甲',u,[ward.sourceId,p.casterId],p.id+':armor:'+u.id);}
   const extra=c.detonate&&burn?c.detonate*s*this.power:0;
   this.skillHit(u,(u===center?c.centerDamage:c.damage)*s*this.power+extra+armorExtra,p,source);
   if(extra){this.cooperate('接力爆燃',u,[burn.sourceId,p.casterId],p.id+':detonate:'+u.id);this.effects.push({kind:'text',text:'接力爆燃 +'+Math.round(extra),x:u.x,y:u.y-30,life:1.2,max:1.2});}
   if(c.stun)u.stun=Math.max(u.stun,c.stun*s);if(c.push)this.push(u,source,c.push*s);
   if(c.pull)this.push(u,p,-c.pull*s);if(c.control&&u.kind!=='seal')u.controlTag={sourceId:p.casterId,token:p.id,strength:s,until:this.time+c.control*s};
   if(c.poison)this.applyPoison(u,p);
   if(c.burn)this.applyBurn(u,{sourceId:p.casterId,token:p.id,dps:c.burn*s*this.power});
   if(c.spread&&burn&&u.hp>0)burning.push({u,burn});
  }
  // Snapshot origins first. A single wind cast never recursively spreads its own result.
  const spreadTo=new Set();
  for(const {u,burn} of burning)for(const t of this.units.filter(t=>t.side&&t.hp>0&&t.id!==u.id&&distance(t,u)<=c.spread)){
   if(spreadTo.has(t.id)||this.active(t.burn)&&t.burn.dps>=burn.dps*s)continue;
   spreadTo.add(t.id);this.applyBurn(t,{...burn,token:p.id,dps:burn.dps*s});
   const control=this.active(u.controlTag)?u.controlTag:this.active(t.controlTag)?t.controlTag:null;
   this.cooperate('风助火势',t,[control?.sourceId,burn.sourceId,p.casterId],p.id+':spread:'+t.id);
  }
  if(c.spread&&spreadTo.size){this.message='扩散命中 ×'+spreadTo.size;this.effects.push({kind:'text',text:this.message,x:p.x,y:p.y,life:1.4,max:1.4});}
  if(c.type==='heal')allies.forEach(u=>{this.heal(u,c.amount*s);if(c.allyShield)this.grantShield(u,c.allyShield*s,p.casterId);});
  if(c.type==='shield'||c.type==='cycle')allies.forEach(u=>this.grantShield(u,c.amount*s,p.casterId));
  if(c.type==='healfield')this.fields=this.fields.filter(f=>f.kind!=='healfield');
  if(c.type==='healfield'||c.type==='firefield')this.fields.push({id:p.id,sourceId:p.casterId,kind:c.type,x:p.x,y:p.y,r:c.r,life:c.life,amount:c.amount*s*(c.type==='firefield'?this.power:1),burn:c.burn*s*this.power});
  if(c.type==='lure'){
   this.units.filter(u=>u.kind==='lure').forEach(u=>u.hp=0);
   this.units.push(this.unit({kind:'lure',name:c.name,hp:c.hp*s,atk:0,range:0,speed:0,life:c.life},p.x,p.y));
  }
  if(c.type==='pack')for(const dy of [-15,15]){
   if(this.units.filter(u=>u.kind==='wolf'&&u.hp>0).length>=4)break;
   const y=this.valid(p.x,p.y+dy)?p.y+dy:p.y;
   this.units.push(this.unit({kind:'wolf',name:'风狼',hp:75*s,atk:13*s,range:30,speed:66,life:10},p.x,y));
  }
  if(c.type==='dash'){
   const u=this.mains.find(u=>u.id===p.casterId);
   if(u?.hp>0){
    const victims=this.units.filter(t=>t.side&&t.hp>0&&distance(t,p)<=c.r),ward=this.wardInfo(u);
    const spent=ward&&distance(u,p)>=45&&victims.length?Math.min(20,u.shield):0;
    if(spent)u.shield-=spent;
    this.displace(u,p.x,p.y);if(c.heal)this.heal(u,c.heal*s);
    if(c.shield)this.grantShield(u,c.shield*s,u.id);
    for(const t of victims){
     if(c.damage)this.skillHit(t,c.damage*s*this.power,p,u);
     if(spent&&t.hp>0){
      t.breach={sourceId:u.id,helperId:ward.sourceId,token:p.id,until:this.time+5,strength:spent/20*s};
      this.cooperate('援盾突袭',t,[ward.sourceId,u.id],p.id+':breach:'+t.id);
     }
    }
   }
  }
  this.effects.push({kind:p.card,x:p.x,y:p.y,r:c.r,life:.45,max:.45});
 }
 enemySpec(u){const kind=u.trait==='priest'?'chant':u.trait==='ambush'?'ambush':u.kind==='brute'?'charge':u.kind==='boss'?'slam':u.kind==='archer'?'bomb':null;return kind?{...{chant:{name:'共鸣吟唱',wind:2.5,range:250,r:180,damage:0,cooldown:12},ambush:{name:'后排伏击',wind:2.2,range:260,r:48,damage:34,cooldown:10},charge:{name:'蓄力冲撞',wind:2,range:190,r:28,damage:38,cooldown:9},slam:{name:'重锤砸地',wind:2.5,range:85,r:65,damage:48,cooldown:9},bomb:{name:'延迟轰炸',wind:2.3,range:240,r:58,damage:36,cooldown:10}}[kind],kind}:null;}
 enemyIntent(u){
  if(!u?.side||u.hp<=0)return null;const spec=this.enemySpec(u);if(!spec)return null;
  if(u.special)return {...u.special,actor:u,targetName:u.special.targetName||'范围目标',readyIn:0,locked:true,inRange:true,damage:u.special.damage*(this.activeHeroes.length===2?.85:1)};
  const enemies=this.units.filter(t=>t.hp>0&&!t.side&&t.kind!=='seal');let target=enemies.find(t=>t.kind==='lure'&&distance(u,t)<175)||enemies.filter(t=>t.lane===u.lane||distance(u,t)<170).sort((a,b)=>distance(u,a)-distance(u,b))[0];
  if(u.trait==='ambush')target=this.mains.filter(t=>t.hp>0&&distance(u,t)<=260).sort((a,b)=>b.range-a.range)[0]||target;
  if(!target)return {...spec,actor:u,targetName:'寻找目标',readyIn:Math.max(0,u.specialCooldown??2),inRange:false,damage:0};
  const busy=this.units.find(e=>e.hp>0&&e.special),readyIn=Math.max(u.specialCooldown??2,u.stun||0,u.recovery||0,(this.nextThreatAt||0)-this.time,busy?busy.special.wait+ENEMY_CADENCE.tellGap:0,0);
  return {...spec,actor:u,targetName:target.name||'灵核',targetId:target.id,readyIn,inRange:distance(u,target)<=spec.range,damage:spec.damage*(1+(u.rage||0)*.2)*((u.empoweredUntil||0)>this.time?1.25:1)*(this.activeHeroes.length===2?.85:1)};
 }
 specialTarget(u,t){
  const spec=this.enemySpec(u);if(!spec||!t||t.objective||t.hp<=0)return null;
  if(u.trait==='ambush')t=this.mains.filter(h=>h.hp>0&&this.valid(h.x,h.y)&&distance(u,h)<=260).sort((a,b)=>b.range-a.range)[0]||t;
  if(distance(u,t)>spec.range)return null;
  if(spec.kind==='ambush'&&!this.valid(t.x,t.y))return null;
  if(spec.kind==='charge')for(let i=0;i<=20;i++)if(!this.valid(u.x+(t.x-u.x)*i/20,u.y+(t.y-u.y)*i/20))return null;
  return t;
 }
 enemySpecial(u,t,fair=false){
  if(!u.side||(!['brute','archer','boss'].includes(u.kind)&&u.trait!=='ambush')||!t||t.objective||t.hp<=0)return false;
  if(this.time<(this.nextThreatAt||0)||this.units.some(e=>e.hp>0&&e.special))return false;
  t=this.specialTarget(u,t);if(!t)return false;
  if(fair){const ready=this.units.filter(v=>v.side&&v.hp>0&&v.atk>0&&!v.special&&!v.busy&&!(v.stun>0)&&!(v.recovery>0)&&(v.specialCooldown??2)<=0&&this.specialTarget(v,this.target(v,false))).sort((a,b)=>(a.lastSpecialAt??-1)-(b.lastSpecialAt??-1));if(ready.length&&ready[0]!==u)return false;}
  const kind=u.trait==='priest'?'chant':u.trait==='ambush'?'ambush':u.kind==='brute'?'charge':u.kind==='boss'?'slam':'bomb';
  const spec=this.enemySpec(u);
  if(distance(u,t)>spec.range)return false;
  const p={...spec,kind,id:'e'+(++this.serial),from:{x:u.x,y:u.y},targetId:t.id,targetName:t.name||'灵核',x:['slam','chant'].includes(kind)?u.x:t.x,y:['slam','chant'].includes(kind)?u.y:t.y,wait:spec.wind};
  if(kind==='ambush'&&!this.valid(p.x,p.y))return false;
  if(kind==='charge')for(let i=0;i<=20;i++)if(!this.valid(u.x+(p.x-u.x)*i/20,u.y+(p.y-u.y)*i/20))return false;
  p.rage=u.rage||0;p.damage*=1+p.rage*.2;if(kind!=='chant'&&(u.empoweredUntil||0)>this.time){p.damage*=1.25;u.empoweredUntil=0;}
  u.special=p;u.lastSpecialAt=this.time;u.specialCooldown=spec.cooldown;this.nextThreatAt=this.time+spec.wind+ENEMY_CADENCE.tellGap;return true;
 }
 specialContains(p,t){
  if(p.kind!=='charge')return distance(p,t)<=p.r;
  const dx=p.x-p.from.x,dy=p.y-p.from.y,d=dx*dx+dy*dy;
  const k=d?Math.max(0,Math.min(1,((t.x-p.from.x)*dx+(t.y-p.from.y)*dy)/d)):0;
  return Math.hypot(t.x-p.from.x-dx*k,t.y-p.from.y-dy*k)<=p.r;
 }
 tickSpecial(u,dt){
  const p=u.special;if(!p)return false;
  if(u.stun>0){u.special=null;if(u.trait==='rage'){u.rage=0;u.rageClock=0;}u.recovery=.8;this.effects.push({kind:'text',text:'大招打断',x:u.x,y:u.y,life:.8,max:.8});return false;}
  p.wait-=dt;if(p.wait>0)return true;
  u.special=null;if(u.trait==='rage'){u.rage=0;u.rageClock=0;}
  if(p.kind==='chant'){for(const t of this.units.filter(t=>t.side&&t.hp>0&&t.id!==u.id&&distance(t,u)<=180))t.empoweredUntil=this.time+10;this.effects.push({kind:'text',text:'共鸣 · 下次大招强化',x:u.x,y:u.y,life:1.2,max:1.2});}
  for(const t of [...this.units,this.core])if(p.damage>0&&t.hp>0&&!t.side&&this.specialContains(p,t))this.hit(t,p.damage*(this.activeHeroes.length===2?.85:1),u);
  if(p.kind==='charge'||p.kind==='ambush'){u.x=p.x;u.y=p.y;u.lane=u.y<250?0:1;}
  u.recovery=2;u.attack=u.kind==='boss'?ENEMY_CADENCE.bossBasic:ENEMY_CADENCE.basic;
  this.effects.push({kind:'enemy-impact',x:p.x,y:p.y,r:p.r,text:p.name,life:.45,max:.45});return true;
 }
 target(u,track=true){
  const enemies=this.units.filter(t=>t.hp>0&&t.side!==u.side&&t.kind!=='seal');
  if(u.side){
   const lure=enemies.find(t=>t.kind==='lure'&&distance(u,t)<175);
   if(lure){if(track&&!u.lured){this.stats.lured++;u.lured=true;}return lure;}
  }
  const candidates=enemies.filter(t=>t.lane===u.lane||distance(u,t)<170).sort((a,b)=>distance(u,a)-distance(u,b));
  if(candidates[0]&&distance(u,candidates[0])<(u.side?235:310))return candidates[0];
  if(u.side){if(this.wave===1)return {...this.mission,objective:true};return this.core;}
  if(this.wave===1)return {...this.mission,objective:true};
  if(this.wave===2)return this.seal;
  return null;
 }
 move(u,t,dt){
  if(!u.speed)return;let tx=t.x,ty=t.y;
  const crossing=(u.x<=430&&tx>430)||(u.x>=570&&tx<570)||(u.x>430&&u.x<570);
  if(crossing){
   const bridge=LANES[u.lane],right=tx>u.x;
   if(u.x<=430){tx=Math.abs(u.y-bridge)>3?420:580;ty=bridge;}
   else if(u.x>=570){tx=Math.abs(u.y-bridge)>3?580:420;ty=bridge;}
   else {tx=right?580:420;ty=bridge;}
  }
  const d=Math.hypot(tx-u.x,ty-u.y);if(d<1)return;
  const step=Math.min(d,u.speed*(this.active(u.controlTag)?.65:1)*dt);u.x+=(tx-u.x)/d*step;u.y+=(ty-u.y)/d*step;
  if(u.x<=430||u.x>=570)u.lane=u.y<250?0:1;
 }
 journeyMax(i){return Math.round((HEROES[i].hp+(this.relics.includes('vital')?35:0))*(this.wounds[i]?.8:1));}
 journeyHP(i){return Math.max(1,this.journeyMax(i)-(this.damageCarry[i]||0));}
 finish(success,reason){
  if(this.phase!=='battle')return;
  this.phase=success?(this.wave===2?'victory':'reward'):'defeat';this.paused=false;this.message=reason;
  if(success){for(const u of this.mains){const i=u.hero;if(u.hp<=0){this.wounds[i]=true;this.damageCarry[i]=Math.round(this.journeyMax(i)*.7);}else this.damageCarry[i]=Math.max(0,u.max-u.hp);}this.campHealUsed=false;}
 }
 healWound(i){
  if(this.phase!=='reward'||!HEROES[i]||this.campHealUsed||(!this.wounds[i]&&!this.damageCarry[i]))return false;
  this.wounds[i]=false;this.damageCarry[i]=Math.max(0,this.damageCarry[i]-Math.ceil(this.journeyMax(i)*.4));this.campHealUsed=true;return this.leaveCamp();
 }
 choose(id){
  if(this.phase!=='reward'||this.campHealUsed||this.relics.includes(id)||!RELICS.some(r=>r.id===id))return false;
  this.relics.push(id);if(id==='power')this.power=1.2;if(id==='flow')this.regen=1.25;return this.leaveCamp();
 }
 leaveCamp(){
  this.wave++;this.phase='setup';this.units=[];this.mains=[];this.fields=[];this.pending=[];this.orders=[];this.effects=[];
  this.hand=[];this.deck=[];this.discard=[];this.waveTime=0;this.control=0;this.seal=null;
  this.message='下一关 · '+this.mission.goal+'。损血保留，可调整阵型与配招。';return true;
 }
 escapePreview(id){
  const u=this.mains.find(u=>u.id===id),hazards=this.units.filter(e=>e.hp>0&&e.side&&e.special?.damage>0).map(e=>e.special);
  if(!u||!hazards.some(p=>this.specialContains({...p,r:p.r+18},u)))return {valid:false,reason:'当前没有需要避开的预警。'};
  let failure=null;
  for(const radius of [85,60,40,20])for(let i=0;i<32;i++){
   const a=Math.PI+i*Math.PI/16,p=this.dodgePreview(id,u.x+Math.cos(a)*radius,u.y+Math.sin(a)*radius);
   if(!p.valid){failure=p;continue;}
   if(hazards.every(h=>!this.specialContains({...h,r:h.r+18},p)))return p;
  }
  return {valid:false,reason:failure?.reason||'闪避范围内没有安全落点，请手动调整或防御。'};
 }
 escape(id){const p=this.escapePreview(id);return p.valid?this.dodge(id,p.x,p.y,p.slot):this.fail(p.reason);}
 dodgePreview(id,x,y,preferredSlot){
  const u=this.mains.find(u=>u.id===id);if(!u||u.hp<=0)return {valid:false,reason:'角色已离场。'};
  const slot=-1,echo=false;
  const range=85*(echo?.7:1);if(!Number.isFinite(x)||!Number.isFinite(y))return {valid:false,reason:'无效落点。',caster:u,x:u.x,y:u.y};
  const d=distance(u,{x,y}),scale=d>range?range/d:1,point={x:u.x+(x-u.x)*scale,y:u.y+(y-u.y)*scale};let reason='';
  const ownReserve=this.orders.filter(o=>o.casterId===id).reduce((n,o)=>n+CARDS[o.card].cost,0);
  if(this.phase!=='battle')reason='战斗中才能闪避。';else if(this.paused)reason='已暂停，继续后再拖动。';else if(u.stun>0)reason='被控制时不能闪避。';else if(this.availableEnergy+ownReserve<1)reason='闪避需要1点灵能。';else if(d<12)reason='拖出方向再松手闪避。';else if(!this.valid(point.x,point.y))reason='落点必须是陆地或桥面。';
  return {...point,caster:u,casterId:u.id,valid:!reason,reason,range,slot,card:'sidestep',echo,coop:{text:'仅消耗1灵能；取消前摇不退费，无无敌或护盾',targets:[],links:[]}};
 }
 dodge(id,x,y,slot){
  const p=this.dodgePreview(id,x,y,slot);if(!p.valid)return this.fail(p.reason);const u=p.caster;
  for(const o of [...this.orders])if(o.casterId===id)this.cancelOrder(o.slot);
  const cancelled=this.pending.filter(a=>a.casterId===id&&a.stage==='windup');for(const a of cancelled)this.discard.push(a.card);this.pending=this.pending.filter(a=>!cancelled.includes(a));u.busy=null;
  this.energy-=1;this.stats.dodges=(this.stats.dodges||0)+1;
  this.displace(u,p.x,p.y);this.message=u.name+'闪避 · 消耗1灵能'+(cancelled.length?' · 取消施法，原费用不退':'');this.effects.push({kind:'dodge',x:u.x,y:u.y,r:24,life:.3,max:.3});return true;
 }
 pause(){if(this.phase==='battle')this.paused=!this.paused;}
 step(dt){
  if(this.phase!=='battle'||this.paused||!Number.isFinite(dt)||dt<=0)return;
  this.time+=dt;this.waveTime+=dt;this.energy=Math.min(this.maxEnergy,this.energy+this.regen*dt);
  this.captureCooldown=Math.max(0,this.captureCooldown-dt);
  this.effects.forEach(f=>f.life-=dt);this.effects=this.effects.filter(f=>f.life>0);
  while(this.schedule.length&&this.schedule[0].t<=this.waveTime){const s=this.schedule.shift();const enemy=this.spawn(s.k,s.l);if(Number.isFinite(s.x)&&Number.isFinite(s.y)){enemy.x=s.x;enemy.y=s.y;enemy.lane=s.l;}}
  this.tickOrders(dt);
  for(const p of [...this.pending]){
   if(this.phase!=='battle')break;
   const caster=this.mains.find(u=>u.id===p.casterId);
   if(p.stage==='windup'&&(!caster||caster.hp<=0||caster.stun>0)){
    if(caster)caster.busy=null;p.done=true;this.message=CARDS[p.card].name+'被打断，消耗不返还。';
   }else{
    p.wait-=dt;
    if(p.wait<=0){
     if(p.stage==='windup'){
      caster.busy=null;p.from={x:caster.x,y:caster.y};
      if(CARDS[p.card].type==='dash'){this.resolve(p);p.done=true;}
      else {p.stage='flight';p.wait=Math.max(.12,distance(caster,p)/700);p.total=p.wait;}
     }else{this.resolve(p);p.done=true;}
    }
   }
   if(p.done)this.discard.push(p.card);
  }
  this.pending=this.pending.filter(p=>!p.done);this.refill();
  for(const f of this.fields){
   if(this.phase!=='battle')break;
   const elapsed=Math.min(dt,f.life);f.life-=dt;
   for(const u of this.units.filter(u=>u.hp>0&&distance(u,f)<=f.r)){
    if(f.kind==='healfield'&&!u.side)this.heal(u,f.amount*elapsed);
    if(f.kind==='firefield'&&u.side){
     const held=this.active(u.controlTag)&&u.controlTag.sourceId!==f.sourceId;
     const base=f.amount*elapsed,extra=held?base*.35:0;
     if(held){
      this.stats.coopDamage+=Math.max(0,Math.min(u.hp,base+extra)-Math.min(u.hp,base));
      this.cooperate('聚敌焚场',u,[u.controlTag.sourceId,f.sourceId],f.id+':field:'+u.id+':'+u.controlTag.token);
     }
     this.hit(u,base+extra,{...f,side:0});
     if(f.burn)this.applyBurn(u,{sourceId:f.sourceId,token:f.id,dps:f.burn});
    }
   }
  }
  this.fields=this.fields.filter(f=>f.life>0);
  for(const u of this.units){
   if(this.phase!=='battle')break;
   if(u.hp<=0)continue;
   if(this.active(u.burn)){
    this.hit(u,u.burn.dps*Math.min(dt,u.burn.until-this.time),{x:u.x,y:u.y,side:0});
    if(u.hp<=0||this.phase!=='battle')continue;
   }
   if(u.poison?.until>this.time-dt){this.hit(u,2*u.poison.stacks*u.poison.strength*this.power*Math.min(dt,u.poison.until-(this.time-dt)),{x:u.x,y:u.y,side:0});if(u.hp<=0||this.phase!=='battle')continue;}
   u.flash=Math.max(0,u.flash-dt);u.shieldTime-=dt;if(u.shieldTime<=0)u.shield=0;
   u.hold=Math.max(0,u.hold-dt);u.dodgeCooldown=Math.max(0,(u.dodgeCooldown||0)-dt);
   if(u.life!==undefined){u.life-=dt;if(u.life<=0){u.hp=0;continue;}}
   if(u.side){this.tickTrait(u,dt);u.specialCooldown=Math.max(0,(u.specialCooldown??2)-dt);if(this.tickSpecial(u,dt))continue;if(u.recovery>0){u.recovery=Math.max(0,u.recovery-dt);continue;}}
   if(u.stun>0){u.stun=Math.max(0,u.stun-dt);continue;}
   if(u.busy||!u.atk)continue;
   u.attack-=dt;const t=this.target(u);if(!t)continue;
   if(u.side&&u.specialCooldown<=0&&this.enemySpecial(u,t,true))continue;
   if(t.objective){if(!u.hold&&distance(u,t)>35)this.move(u,t,dt);continue;}
   if(distance(u,t)>u.range+12){if(!u.hold)this.move(u,t,dt);}
   else if(u.attack<=0){u.attack=u.side?(u.kind==='boss'?ENEMY_CADENCE.bossBasic:ENEMY_CADENCE.basic):1.25;this.hit(t,u.atk,{...u,direct:true,hitToken:'a'+(++this.serial)});}
  }
  this.units=this.units.filter(u=>u.hp>0);
  if(this.phase!=='battle')return;
  if(this.mains.every(u=>u.hp<=0)){this.finish(false,'上场主力全部倒下。');return;}
  if(this.wave===1){
   const inside=u=>u.hp>0&&distance(u,this.mission)<=this.mission.r;
   if(this.mains.some(inside)&&!this.units.some(u=>u.side&&inside(u)))this.control+=dt;
   if(this.control>=this.mission.required){this.finish(true,'风眼已夺取。');return;}
  }
  if(this.waveTime>=this.mission.limit)this.finish(false,'任务超时。');
  else if(this.wave===0&&!this.schedule.length&&!this.units.some(u=>u.side))this.finish(true,'溪口守住了。');
 }
}
const api={validBuild,canLearn,Game,CARDS,HEROES,TACTICS,RELICS,MISSIONS,LANES,distance};
if(typeof module!=='undefined')module.exports=api;else window.DeployGame=api;
})();
