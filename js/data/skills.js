// 招数表 + 各属性学习表(按等级解锁 LEARN[type][lv-1])
// type=null 为治疗;普通系招数(normal)幽灵免疫。inflict={kind,chance} 命中后概率附异常。recoil=造成伤害后自损比例。
const SKILLS={
  basic:{name:'普通攻击',kind:'atk',mult:0.9,rb:0,type:'normal',hit:95,crit:0,desc:'普通系0.9×·命中95'},
  heavy:{name:'重击',kind:'atk',mult:1.6,rb:0,type:'normal',hit:80,crit:5,desc:'普通系1.6×·暴+5'},
  sweep:{name:'横扫',kind:'aoe',mult:1.0,rb:0,type:'normal',hit:85,crit:0,desc:'普通系群体'},
  heal:{name:'治疗',kind:'heal',amount:10,rb:0,type:null,hit:100,crit:0,desc:'治疗相邻/自身'},
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
  confusion:{name:'念力',kind:'atk',mult:1.05,rb:1,type:'psychic',hit:90,crit:0,inflict:{kind:'para',chance:25},desc:'超·射程+1·25%麻痹'}
};
const LEARN={
  fire:['basic','ember','heavy'], water:['basic','aqua','heal','shieldbash'],
  grass:['basic','vine','sweep'], electric:['basic','spark','heavy'],
  ghost:['basic','shadow','sweep'], normal:['basic','reckless','bash'],
  flying:['basic','gust','bravebird'], fighting:['basic','chop','reckless','bash'],
  rock:['basic','rockthrow','shieldbash'], poison:['basic','sludge'], dark:['basic']
};
