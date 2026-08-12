// 招数表 + 各属性学习表(按等级解锁 LEARN[type][lv-1])
// type=null 为治疗;普通系招数(normal)幽灵免疫。inflict={kind,chance} 命中后概率附异常。recoil=造成伤害后自损比例。
const SKILLS={
  basic:{name:'普通攻击',kind:'atk',mult:0.9,rb:0,type:'normal',hit:95,crit:0,desc:'普通系0.9×·命中95'},
  heavy:{name:'重击',kind:'atk',mult:1.6,rb:0,type:'normal',hit:80,crit:5,desc:'普通系1.6×·暴+5'},
  sweep:{name:'横扫',kind:'aoe',mult:1.0,rb:0,type:'normal',hit:85,crit:0,desc:'普通系群体'},
  heal:{name:'治疗',kind:'heal',amount:10,rb:0,type:null,hit:100,crit:0,desc:'治疗相邻/自身'},
  // —— v0.61 新动作类型。诊断显示每次决策只有 3.9 个候选、且 64% 只是"换个招打同一个人",
  //    所以问题不是"技能不够多",而是"动作种类只有走+打"。以下两个是新的【种类】,不是新的伤害招。
  charge:{name:'蓄力',kind:'charge',rb:0,type:null,hit:100,crit:0,desc:'本回合不出手;下次攻击伤害 ×1.8(被打断也保留)'},
  swap:{name:'换位',kind:'swap',rb:2,type:null,hit:100,crit:0,desc:'与 2 格内的友军交换位置(把残血换出去/把坦克换进来)'},
  reckless:{name:'舍身冲撞',kind:'atk',mult:1.8,rb:0,type:'normal',hit:90,crit:0,recoil:0.25,desc:'普通系1.8×·自损25%伤害'},
  shieldbash:{name:'盾击',kind:'atk',mult:0.8,rb:0,type:'normal',hit:95,crit:0,useShield:true,desc:'普通系0.8×+当前护盾值(坦克转输出)'},
  bash:{name:'撞击',kind:'atk',mult:1.0,rb:0,type:'normal',hit:95,crit:0,knock:1,desc:'普通系1.0×·击退目标1格(可溺杀/撞击)'},
  ember:{name:'火花',kind:'atk',mult:1.4,rb:0,type:'fire',hit:90,crit:0,inflict:{kind:'burn',chance:30},desc:'火属性1.4×·30%灼烧'},
  aqua:{name:'水枪',kind:'atk',mult:1.4,rb:1,type:'water',hit:90,crit:0,desc:'水属性·射程+1'},
  spark:{name:'电击',kind:'atk',mult:1.4,rb:1,type:'electric',hit:88,crit:5,inflict:{kind:'para',chance:30},desc:'电属性·射程+1·30%麻痹'},
  vine:{name:'藤鞭',kind:'atk',mult:1.4,rb:1,type:'grass',hit:90,crit:0,desc:'草属性·射程+1'},
  shadow:{name:'暗影球',kind:'atk',mult:1.4,rb:1,type:'ghost',hit:88,crit:5,desc:'幽灵属性·射程+1'},
  bravebird:{name:'勇鸟冲锋',kind:'atk',mult:1.7,rb:0,type:'flying',hit:95,crit:0,recoil:0.25,desc:'飞行系1.7×·自损25%伤害'},
  // 敌方覆盖招(mult≈1.0,中性≈普攻,克制×2才爆发);玩家捕获对应属性也可学。
  e_fire:{name:'喷焰',kind:'atk',mult:1.0,rb:0,type:'fire',hit:90,crit:0,inflict:{kind:'burn',chance:25},desc:'火·25%灼烧'},
  e_water:{name:'喷水',kind:'atk',mult:1.0,rb:1,type:'water',hit:90,crit:0,desc:'水·射程+1'},
  e_grass:{name:'缠绕',kind:'atk',mult:1.0,rb:1,type:'grass',hit:90,crit:0,desc:'草·射程+1'},
  gust:{name:'起风',kind:'atk',mult:1.0,rb:1,type:'flying',hit:90,crit:0,desc:'飞·射程+1'},
  chop:{name:'空手劈',kind:'atk',mult:1.05,rb:0,type:'fighting',hit:88,crit:5,desc:'斗·暴+5'},
  rockthrow:{name:'落石',kind:'atk',mult:1.0,rb:1,type:'rock',hit:85,crit:0,desc:'岩·射程+1'},
  e_elec:{name:'电花',kind:'atk',mult:1.0,rb:1,type:'electric',hit:88,crit:0,inflict:{kind:'para',chance:20},desc:'电·射程+1·20%麻痹'},
  e_ghost:{name:'惊吓',kind:'atk',mult:1.0,rb:1,type:'ghost',hit:88,crit:0,desc:'幽灵·射程+1'},
  sludge:{name:'污泥攻击',kind:'atk',mult:1.0,rb:0,type:'poison',hit:90,crit:0,inflict:{kind:'poison',chance:50},desc:'毒·50%中毒'},
  confusion:{name:'念力',kind:'atk',mult:1.05,rb:1,type:'psychic',hit:90,crit:0,inflict:{kind:'para',chance:25},desc:'超·射程+1·25%麻痹'},
  e_ground:{name:'地震',kind:'atk',mult:1.0,rb:0,type:'ground',hit:90,crit:0,desc:'地面·1.0×'},
  e_bug:{name:'虫咬',kind:'atk',mult:1.0,rb:0,type:'bug',hit:90,crit:0,desc:'虫·1.0×'},
  e_ice:{name:'冰冻光束',kind:'atk',mult:1.0,rb:1,type:'ice',hit:90,crit:0,desc:'冰·射程+1'},
  e_steel:{name:'金属爪',kind:'atk',mult:1.0,rb:0,type:'steel',hit:92,crit:5,desc:'钢·暴+5'},
  e_dark:{name:'咬碎',kind:'atk',mult:1.05,rb:0,type:'dark',hit:90,crit:5,desc:'恶·暴+5'},
  e_fairy:{name:'魔法闪耀',kind:'atk',mult:1.0,rb:1,type:'fairy',hit:90,crit:0,desc:'妖·射程+1'},
  e_dragon:{name:'龙息',kind:'atk',mult:1.0,rb:1,type:'dragon',hit:90,crit:0,desc:'龙·射程+1'},
  // —— 进阶招(draft 获取;可升级叠深)——
  inferno:{name:'烈焰',tier:'adv',kind:'atk',mult:1.5,rb:0,type:'fire',hit:88,crit:5,inflict:{kind:'burn',chance:50},desc:'火·1.5×·50%灼烧'},
  hydro:{name:'水炮',tier:'adv',kind:'atk',mult:1.5,rb:1,type:'water',hit:88,crit:0,desc:'水·1.5×·射程+1'},
  thunder:{name:'雷击',tier:'adv',kind:'atk',mult:1.5,rb:1,type:'electric',hit:85,crit:5,inflict:{kind:'para',chance:45},desc:'电·1.5×·45%麻痹'},
  leafblade:{name:'飞叶刃',tier:'adv',kind:'atk',mult:1.5,rb:1,type:'grass',hit:90,crit:12,desc:'草·1.5×·暴+12'},
  nightshade:{name:'夜阴',tier:'adv',kind:'atk',mult:1.5,rb:1,type:'ghost',hit:88,crit:15,desc:'幽·1.5×·暴+15'},
  toxic:{name:'剧毒',tier:'adv',kind:'atk',mult:0.9,rb:1,type:'poison',hit:90,crit:0,inflict:{kind:'poison',chance:90},desc:'毒·0.9×·90%中毒(叠毒核心)'},
  quake:{name:'地裂',tier:'adv',kind:'aoe',mult:1.2,rb:0,type:'ground',hit:85,crit:0,desc:'地·群体1.2×'},
  icebeam:{name:'极冰',tier:'adv',kind:'atk',mult:1.45,rb:1,type:'ice',hit:90,crit:5,desc:'冰·1.45×·射程+1'},
  irontail:{name:'铁尾',tier:'adv',kind:'atk',mult:1.5,rb:0,type:'steel',hit:88,crit:10,desc:'钢·1.5×·暴+10'},
  crunch:{name:'咬碎击',tier:'adv',kind:'atk',mult:1.5,rb:0,type:'dark',hit:88,crit:10,desc:'恶·1.5×·暴+10'},
  dragonpulse:{name:'龙波',tier:'adv',kind:'atk',mult:1.5,rb:2,type:'dragon',hit:88,crit:5,desc:'龙·1.5×·射程+2'},
  dazzle:{name:'魔法闪光',tier:'adv',kind:'atk',mult:1.45,rb:1,type:'fairy',hit:92,crit:5,desc:'妖·1.45×·射程+1'},
  psybeam:{name:'幻象光',tier:'adv',kind:'atk',mult:1.45,rb:1,type:'psychic',hit:90,crit:5,inflict:{kind:'para',chance:30},desc:'超·1.45×·30%麻痹'},
  bugbuzz:{name:'虫鸣',tier:'adv',kind:'atk',mult:1.45,rb:1,type:'bug',hit:90,crit:5,desc:'虫·1.45×·射程+1'},
  airslash:{name:'气旋斩',tier:'adv',kind:'atk',mult:1.5,rb:1,type:'flying',hit:88,crit:10,desc:'飞·1.5×·射程+1·暴+10'},
  rockslide:{name:'岩崩',tier:'adv',kind:'aoe',mult:1.2,rb:1,type:'rock',hit:82,crit:0,desc:'岩·群体1.2×·射程+1'},
  closecombat:{name:'近身战',tier:'adv',kind:'atk',mult:1.7,rb:0,type:'fighting',hit:90,crit:10,desc:'斗·1.7×·暴+10'},
  // —— 通用进阶(任意精灵可 draft)——
  powerstrike:{name:'强袭',tier:'adv',kind:'atk',mult:1.7,rb:0,type:'normal',hit:85,crit:8,desc:'普·1.7×·暴+8'},
  guardstance:{name:'守势',tier:'adv',kind:'atk',mult:0.7,rb:0,type:'normal',hit:95,crit:0,useShield:true,gainShield:6,desc:'普·0.7×+盾值;并获6盾'},
  cleave:{name:'横扫斩',tier:'adv',kind:'aoe',mult:1.25,rb:0,type:'normal',hit:85,crit:0,desc:'普·群体1.25×'}
};
const LEARN={
  fire:['basic','ember','heavy'], water:['basic','aqua','heal','shieldbash'],
  grass:['basic','vine','sweep'], electric:['basic','spark','heavy'],
  ghost:['basic','shadow','sweep'], normal:['basic','reckless','bash'],
  flying:['basic','gust','bravebird'], fighting:['basic','chop','reckless','bash'],
  rock:['basic','rockthrow','shieldbash'], poison:['basic','sludge','heavy'], dark:['basic','e_dark','heavy'],
  ground:['basic','e_ground','bash'], bug:['basic','e_bug','sweep'], ice:['basic','e_ice','heavy'],
  steel:['basic','e_steel','shieldbash'], psychic:['basic','confusion','heal'], fairy:['basic','e_fairy','heal'],
  dragon:['basic','e_dragon','heavy']
};
// 可 draft 招池:按属性给进阶/元素招;主角伊布(normal)可学多系
const DRAFT_POOL={
 fire:['ember','inferno'], water:['aqua','hydro'], electric:['spark','thunder'], grass:['vine','leafblade'],
 ghost:['shadow','nightshade'], normal:['heavy','bash','reckless'], flying:['gust','airslash','bravebird'],
 fighting:['chop','closecombat'], rock:['rockthrow','rockslide'], poison:['sludge','toxic'],
 ground:['e_ground','quake'], bug:['e_bug','bugbuzz'], ice:['e_ice','icebeam'], steel:['e_steel','irontail'],
 dark:['e_dark','crunch'], psychic:['confusion','psybeam'], fairy:['e_fairy','dazzle'], dragon:['e_dragon','dragonpulse']
};
const UNIVERSAL_DRAFT=['powerstrike','cleave','guardstance','heavy','bash','shieldbash','heal','charge','swap'];
