// 遗物(肉鸽 build 载体)。钩子(都可选):
//  dmgMult(att,sk,def)->倍率(可读目标状态)  hitAdd(att,sk)  capAdd  expMult
//  statMod(u)开战改属性  onKill(att)  thorns  revive  critAdd(数或函数)  dmgTakenMult  onHitInflict={kind,chance}
function _deckShort(){return (typeof run!=='undefined'&&run.pool)?Math.max(0,6-run.pool.length):0;}
const RELICS=[
 // —— 宽泛增伤(不做单属性) ——
 {id:'elem_core', arch:'out',   icon:'🔮', name:'元素核心', desc:'所有元素(非普通系)招数 +15%', dmgMult:(a,s,d)=>(s.type&&s.type!=='normal')?1.15:1},
 {id:'brute_core', arch:'out',  icon:'🥊', name:'蛮力核心', desc:'所有普通系(物理)招数 +15%', dmgMult:(a,s,d)=>(s.type==='normal')?1.15:1},
 // —— 状态联动:对异常目标加伤 ——
 {id:'executioner', arch:'status', icon:'☠️', name:'处决者',   desc:'对处于异常(毒/烧/麻)的敌人伤害 +40%', dmgMult:(a,s,d)=>(d&&d.eff&&(d.eff.poison||d.eff.burn||d.eff.para))?1.4:1},
 {id:'para_smash', arch:'status',  icon:'🔨', name:'麻痹克星', desc:'对被麻痹的敌人伤害 ×2', dmgMult:(a,s,d)=>(d&&d.eff&&d.eff.para)?2:1},
 // —— 属性强化 ——
 {id:'power_band', arch:'out',  icon:'💪', name:'力量头带', desc:'全队攻击 +2', statMod:u=>{u.atk+=2;}},
 {id:'steel_will', arch:'def',  icon:'🛡️', name:'钢之意志', desc:'全队防御 +2', statMod:u=>{u.def+=2;}},
 {id:'swift_boots', arch:'pos', icon:'👟', name:'迅捷之靴', desc:'全队速度 +2(更易抢先/二段)', statMod:u=>{u.spd+=2;}},
 {id:'giant_belt', arch:'def',  icon:'🎽', name:'巨力腰带', desc:'全队最大生命 +8', statMod:u=>{u.maxhp+=8;u.hp+=8;}},
 {id:'lucky_coin', arch:'out',  icon:'🍀', name:'幸运币',   desc:'全队幸运 +4(更易暴击/闪避)', statMod:u=>{u.lck+=4;}},
 {id:'glass_cannon', arch:'out',icon:'💎', name:'玻璃大炮', desc:'全队攻击 +5,但防御 -2', statMod:u=>{u.atk+=5;u.def=Math.max(0,u.def-2);}},
 // —— 精简流三件套(牌库越小越强) ——
 {id:'lean_zeal', arch:'collect',   icon:'🔪', name:'精简狂热', desc:'牌库每少于6只,全队攻击 +1', statMod:u=>{u.atk+=_deckShort();}},
 {id:'light_pack', arch:'collect',  icon:'🎒', name:'轻装上阵', desc:'牌库每少于6只,全队速度 +1', statMod:u=>{u.spd+=_deckShort();}},
 {id:'lone_wolf', arch:'collect',   icon:'🐺', name:'孤狼之心', desc:'牌库 ≤3 只时,暴击率 +20%', critAdd:()=>((typeof run!=='undefined'&&run.pool&&run.pool.length<=3)?20:0)},
 // —— 命中 / 暴击 / 减伤 ——
 {id:'hunter_lens', arch:'out', icon:'🔍', name:'猎手之瞳', desc:'全队命中 +12', hitAdd:(a,s)=>12},
 {id:'sharp_scope', arch:'out', icon:'🎯', name:'瞄准镜',   desc:'暴击率 +15%', critAdd:15},
 {id:'iron_hide', arch:'def',   icon:'🦏', name:'铁甲皮',   desc:'我方受到伤害 -15%', dmgTakenMult:0.85},
 {id:'heavy_shield', arch:'def',icon:'🔰', name:'重盾',     desc:'开战时全队获得 10 点护盾', statMod:u=>{u.shield=(u.shield||0)+10;}},
 {id:'shield_gen', arch:'def',  icon:'⚙️', name:'护盾发生器', desc:'每回合行动前获得 4 点护盾', shieldRegen:4},
 // —— 收服 / 经验 ——
 {id:'tamer_flute', arch:'collect', icon:'🪈', name:'驯兽笛',   desc:'收服成功率 +20%', capAdd:0.20},
 {id:'exp_necklace', arch:'collect',icon:'📿', name:'经验项链', desc:'获得经验 +30%', expMult:1.3},
 {id:'gold_idol', arch:'collect',   icon:'🗿', name:'黄金神像', desc:'获得经验 +50%', expMult:1.5},
 // —— 击杀 / 反伤 / 复活 ——
 {id:'vamp_charm', arch:'def',  icon:'🧛', name:'吸血护符', desc:'击败敌人时,出手者回复 8 HP', onKill:a=>{a.hp=Math.min(a.maxhp,a.hp+8);}},
 {id:'berserker', arch:'out',   icon:'😤', name:'狂战之血', desc:'每击败一敌,该单位攻击永久 +1(本局)', onKill:a=>{a.atk+=1;}},
 {id:'thorn_mail', arch:'def',  icon:'🌵', name:'荆棘甲',   desc:'我方被命中时反伤 4', thorns:4},
 {id:'spike_shell', arch:'def', icon:'🐚', name:'尖刺壳',   desc:'我方被命中时反伤 6', thorns:6},
 {id:'phoenix', arch:'def',     icon:'🪶', name:'复活羽毛', desc:'本局首位阵亡的精灵以半血复活一次', revive:true},
 // —— 命中附状态 ——
 {id:'venom_fang', arch:'status',  icon:'🦷', name:'剧毒獠牙', desc:'我方命中时 40% 使目标中毒', onHitInflict:{kind:'poison',chance:40}},
 {id:'flame_brand', arch:'status', icon:'🏮', name:'烈焰刻印', desc:'我方命中时 40% 使目标灼烧', onHitInflict:{kind:'burn',chance:40}},
 // —— 战旗向(引擎读标记,利用网格/水/速度) ——
 {id:'knockback', arch:'pos',  icon:'👊', name:'冲击拳套', desc:'我方攻击命中后击退目标1格;推入水/边界即死,撞到单位双方受创', tag:'knockback'},
 {id:'formation', arch:'pos',  icon:'🔗', name:'连携纹章', desc:'每个相邻友军,该单位伤害 +12%(抱团强,怕群体)', tag:'formation'},
 {id:'flank', arch:'pos',      icon:'🗡️', name:'夹击之印', desc:'攻击被我方对向夹住的敌人,伤害 +50%', tag:'flank'},
 {id:'alpha', arch:'pos',      icon:'🥷', name:'奇袭印记', desc:'对本回合尚未行动的敌人,伤害 +40%(配速度抢先手)', tag:'alpha'},
 // —— 诅咒遗物(v0.59):强力 + 明确代价。目的是把"三个都是加分,拿最大的"变成真两难 ——
 // v0.66 数值重校:首版 8 件 lift 全为负(−0.9 ~ −12.6)= 代价碾压收益 = 8 件废卡,没有制造两难。
 // 目标带:lift ∈ [−1, +2] —— 拿与不拿都说得通,才叫真两难。
 {id:'glass_heart', arch:'curse', curse:1, icon:'💔', name:'玻璃之心', desc:'暴击率 +45%,但全队最大生命 −12%',
   critAdd:45, statMod:u=>{const c=Math.round(u.maxhp*0.12);u.maxhp-=c;u.hp=Math.max(1,u.hp-c);}},
 {id:'arrogance', arch:'curse', curse:1, icon:'🎭', name:'傲慢面具', desc:'造成伤害 +35%,但再也无法收服任何精灵',
   dmgMult:()=>1.35, capAdd:-1},
 {id:'blood_thirst', arch:'curse', curse:1, icon:'🩸', name:'嗜血渴望', desc:'全队攻击 +9,最大生命 −4',
   statMod:u=>{u.atk+=9;u.maxhp=Math.max(5,u.maxhp-4);u.hp=Math.max(1,u.hp-4);}},
 {id:'abyss_eye', arch:'curse', curse:1, icon:'🕳', name:'深渊之眼', desc:'全队命中 +25,但幸运 −4(更易被暴击)',
   hitAdd:()=>25, statMod:u=>{u.lck=Math.max(0,u.lck-4);}},
 {id:'immolate', arch:'curse', curse:1, icon:'🔥', name:'焚身印记', desc:'全队攻击 +12,但每回合自损 1 HP',
   statMod:u=>{u.atk+=12;}, hpDrain:1},
 {id:'gambler_die', arch:'curse', curse:1, icon:'🃏', name:'赌徒骰', desc:'我方所有招数命中率固定为 92%(低命中的高倍率招大赚)',
   hitFix:92},
 {id:'thorn_crown', arch:'curse', curse:1, icon:'👑', name:'荆棘王冠', desc:'被命中时反伤 9,但我方受到伤害 +12%',
   thorns:9, dmgTakenMult:1.12},
 // 防御是【减法】扣在伤害上,代价极其陡峭:砍半 lift −7.9,−3 仍 −3.9。最终 −1 并把收益拉到 +50%。
 {id:'berserk_pact', arch:'curse', curse:1, icon:'😈', name:'狂乱契约', desc:'造成伤害 +50%,但全队防御 −1',
   dmgMult:()=>1.50, statMod:u=>{u.def=Math.max(0,u.def-1);}}
];
