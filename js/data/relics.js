// 遗物(肉鸽 build 载体)。每个遗物可带任意钩子(都可选):
//  dmgMult(att,sk)->倍率  hitAdd(att,sk)->命中加成  capAdd->收服率加成
//  expMult->经验倍率  statMod(u)->开战时改我方属性  onKill(att)->击杀触发
//  thorns->被命中反伤  revive->本局首位阵亡半血复活一次
//  critAdd->暴击率加成  dmgTakenMult->我方受伤倍率(<1=减伤)  onHitInflict={kind,chance}->命中概率附异常
const RELICS=[
 // —— 宽泛增伤(不做单属性,泛用性差) ——
 {id:'elem_core',   icon:'🔮', name:'元素核心', desc:'所有元素(非普通系)招数 +15%', dmgMult:(a,s)=>(s.type&&s.type!=='normal')?1.15:1},
 {id:'brute_core',  icon:'🥊', name:'蛮力核心', desc:'所有普通系(物理)招数 +15%', dmgMult:(a,s)=>(s.type==='normal')?1.15:1},
 // —— 属性强化 ——
 {id:'power_band',  icon:'💪', name:'力量头带', desc:'全队攻击 +2', statMod:u=>{u.atk+=2;}},
 {id:'steel_will',  icon:'🛡️', name:'钢之意志', desc:'全队防御 +2', statMod:u=>{u.def+=2;}},
 {id:'swift_boots', icon:'👟', name:'迅捷之靴', desc:'全队速度 +2(更易抢先/二段)', statMod:u=>{u.spd+=2;}},
 {id:'giant_belt',  icon:'🎽', name:'巨力腰带', desc:'全队最大生命 +8', statMod:u=>{u.maxhp+=8;u.hp+=8;}},
 {id:'lucky_coin',  icon:'🍀', name:'幸运币',   desc:'全队幸运 +4(更易暴击/闪避)', statMod:u=>{u.lck+=4;}},
 {id:'glass_cannon',icon:'💎', name:'玻璃大炮', desc:'全队攻击 +5,但防御 -2', statMod:u=>{u.atk+=5;u.def=Math.max(0,u.def-2);}},
 // —— 命中 / 暴击 / 减伤 ——
 {id:'hunter_lens', icon:'🔍', name:'猎手之瞳', desc:'全队命中 +12', hitAdd:(a,s)=>12},
 {id:'sharp_scope', icon:'🎯', name:'瞄准镜',   desc:'暴击率 +15%', critAdd:15},
 {id:'iron_hide',   icon:'🦏', name:'铁甲皮',   desc:'我方受到伤害 -15%', dmgTakenMult:0.85},
 // —— 收服 / 经验 ——
 {id:'tamer_flute', icon:'🪈', name:'驯兽笛',   desc:'收服成功率 +20%', capAdd:0.20},
 {id:'exp_necklace',icon:'📿', name:'经验项链', desc:'获得经验 +30%', expMult:1.3},
 {id:'gold_idol',   icon:'🗿', name:'黄金神像', desc:'获得经验 +50%', expMult:1.5},
 // —— 击杀 / 反伤 / 复活 ——
 {id:'vamp_charm',  icon:'🧛', name:'吸血护符', desc:'击败敌人时,出手者回复 8 HP', onKill:a=>{a.hp=Math.min(a.maxhp,a.hp+8);}},
 {id:'berserker',   icon:'😤', name:'狂战之血', desc:'每击败一敌,该单位攻击永久 +1(本局)', onKill:a=>{a.atk+=1;}},
 {id:'thorn_mail',  icon:'🌵', name:'荆棘甲',   desc:'我方被命中时反伤 4', thorns:4},
 {id:'spike_shell', icon:'🐚', name:'尖刺壳',   desc:'我方被命中时反伤 6', thorns:6},
 {id:'phoenix',     icon:'🪶', name:'复活羽毛', desc:'本局首位阵亡的精灵以半血复活一次', revive:true},
 // —— 状态联动(配合异常系统)——
 {id:'venom_fang',  icon:'🦷', name:'剧毒獠牙', desc:'我方命中时 30% 使目标中毒', onHitInflict:{kind:'poison',chance:30}},
 {id:'flame_brand', icon:'🏮', name:'烈焰刻印', desc:'我方命中时 30% 使目标灼烧', onHitInflict:{kind:'burn',chance:30}}
];
