// 遗物(肉鸽 build 载体)。钩子(都可选):
//  dmgMult(att,sk,def)->倍率(可读目标状态)  hitAdd(att,sk)  capAdd  expMult
//  statMod(u)开战改属性  onKill(att)  thorns  revive  critAdd(数或函数)  dmgTakenMult  onHitInflict={kind,chance}
function _deckShort(){return (typeof run!=='undefined'&&run.pool)?Math.max(0,6-run.pool.length):0;}
const RELICS=[
 // —— 宽泛增伤(不做单属性) ——
 {id:'elem_core',   icon:'🔮', name:'元素核心', desc:'所有元素(非普通系)招数 +15%', dmgMult:(a,s,d)=>(s.type&&s.type!=='normal')?1.15:1},
 {id:'brute_core',  icon:'🥊', name:'蛮力核心', desc:'所有普通系(物理)招数 +15%', dmgMult:(a,s,d)=>(s.type==='normal')?1.15:1},
 // —— 状态联动:对异常目标加伤 ——
 {id:'executioner', icon:'☠️', name:'处决者',   desc:'对处于异常(毒/烧/麻)的敌人伤害 +40%', dmgMult:(a,s,d)=>(d&&d.eff&&(d.eff.poison||d.eff.burn||d.eff.para))?1.4:1},
 {id:'para_smash',  icon:'🔨', name:'麻痹克星', desc:'对被麻痹的敌人伤害 ×2', dmgMult:(a,s,d)=>(d&&d.eff&&d.eff.para)?2:1},
 // —— 属性强化 ——
 {id:'power_band',  icon:'💪', name:'力量头带', desc:'全队攻击 +2', statMod:u=>{u.atk+=2;}},
 {id:'steel_will',  icon:'🛡️', name:'钢之意志', desc:'全队防御 +2', statMod:u=>{u.def+=2;}},
 {id:'swift_boots', icon:'👟', name:'迅捷之靴', desc:'全队速度 +2(更易抢先/二段)', statMod:u=>{u.spd+=2;}},
 {id:'giant_belt',  icon:'🎽', name:'巨力腰带', desc:'全队最大生命 +8', statMod:u=>{u.maxhp+=8;u.hp+=8;}},
 {id:'lucky_coin',  icon:'🍀', name:'幸运币',   desc:'全队幸运 +4(更易暴击/闪避)', statMod:u=>{u.lck+=4;}},
 {id:'glass_cannon',icon:'💎', name:'玻璃大炮', desc:'全队攻击 +5,但防御 -2', statMod:u=>{u.atk+=5;u.def=Math.max(0,u.def-2);}},
 // —— 精简流三件套(牌库越小越强) ——
 {id:'lean_zeal',   icon:'🔪', name:'精简狂热', desc:'牌库每少于6只,全队攻击 +1', statMod:u=>{u.atk+=_deckShort();}},
 {id:'light_pack',  icon:'🎒', name:'轻装上阵', desc:'牌库每少于6只,全队速度 +1', statMod:u=>{u.spd+=_deckShort();}},
 {id:'lone_wolf',   icon:'🐺', name:'孤狼之心', desc:'牌库 ≤3 只时,暴击率 +20%', critAdd:()=>((typeof run!=='undefined'&&run.pool&&run.pool.length<=3)?20:0)},
 // —— 命中 / 暴击 / 减伤 ——
 {id:'hunter_lens', icon:'🔍', name:'猎手之瞳', desc:'全队命中 +12', hitAdd:(a,s)=>12},
 {id:'sharp_scope', icon:'🎯', name:'瞄准镜',   desc:'暴击率 +15%', critAdd:15},
 {id:'iron_hide',   icon:'🦏', name:'铁甲皮',   desc:'我方受到伤害 -15%', dmgTakenMult:0.85},
 {id:'heavy_shield',icon:'🔰', name:'重盾',     desc:'开战时全队获得 10 点护盾', statMod:u=>{u.shield=(u.shield||0)+10;}},
 {id:'shield_gen',  icon:'⚙️', name:'护盾发生器', desc:'每回合行动前获得 4 点护盾', shieldRegen:4},
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
 // —— 命中附状态 ——
 {id:'venom_fang',  icon:'🦷', name:'剧毒獠牙', desc:'我方命中时 30% 使目标中毒', onHitInflict:{kind:'poison',chance:30}},
 {id:'flame_brand', icon:'🏮', name:'烈焰刻印', desc:'我方命中时 30% 使目标灼烧', onHitInflict:{kind:'burn',chance:30}},
 // —— 战旗向(引擎读标记,利用网格/水/速度) ——
 {id:'knockback',  icon:'👊', name:'冲击拳套', desc:'我方攻击命中后击退目标1格;推入水/边界即死,撞到单位双方受创', tag:'knockback'},
 {id:'formation',  icon:'🔗', name:'连携纹章', desc:'每个相邻友军,该单位伤害 +12%(抱团强,怕群体)', tag:'formation'},
 {id:'flank',      icon:'🗡️', name:'夹击之印', desc:'攻击被我方对向夹住的敌人,伤害 +50%', tag:'flank'},
 {id:'alpha',      icon:'🥷', name:'奇袭印记', desc:'对本回合尚未行动的敌人,伤害 +40%(配速度抢先手)', tag:'alpha'}
];
