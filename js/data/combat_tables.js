// =============================================================================
// combat_tables.js —— 技能 / 遗物 / 战斗旋钮 的「纯数值」关联配置表
// =============================================================================
//
// 【为什么要有这个文件？】
//   web 版原始数据在：
//     - js/data/config.js   → 难度旋钮、DEF_K 等
//     - js/data/skills.js   → SKILLS（含函数式副作用字段）
//     - js/data/relics.js   → RELICS（钩子经常是 JS 函数，UE DataTable 读不了）
//   UE 切片不能直接跑这些函数。本文件把「只改数字、不改流程」的条目
//   展平成扁平行，方便：
//     1) 对照 web 源数据做数值对齐
//     2) 以后导入 UE DataTable / 或先硬编码到蓝图
//
// 【什么叫「纯数值」？】
//   技能：只要 mult / hit / crit / rb(射程加成) / type，没有
//         inflict / aoe / knock / recoil / heal / charge / swap / useShield。
//   遗物：效果可写成固定加减乘列（atkAdd、dmgMult 等），不依赖
//         牌库数量、异常状态、网格位置、击杀回调等运行时上下文。
//
// 【uePhase 含义】
//   1 = 当前 UE 切片就能接（已有 ComputeSkillDamage / ApplyStartingRelics）
//   2 = 需要一点新钩子（例如回合开始加盾、反伤），但仍是固定数字
//   0 = 故意不进本表（见文件末尾 DEFERRED_* 清单）
//
// ⚠ 本文件是「对照表 / 实现清单」，默认不改 web 运行时逻辑。
//    若要在浏览器里调试，可在 index.html 于 relics.js 之后加一行 script。
// =============================================================================

// ---------------------------------------------------------------------------
// 1) 战斗公式旋钮（从 config.js 抽「伤害链路会用到的」常量）
//    UE 里已硬编码 DEF_K=9；其它列是后续对齐用，现阶段可不接。
// ---------------------------------------------------------------------------
const COMBAT_FORMULA = {
  DEF_K: 9,          // 防御折减：dmg = Atk * mult * type * DEF_K/(DEF_K+Def)
  LOS_HIT: 20,       // 视线遮挡：命中 −20（UE 切片未接）
  LOS_DMG: 0.80,     // 视线遮挡：伤害 ×0.8（UE 切片未接）
  FLANK_MULT: 1.30,  // 夹击倍率（UE 切片未接）
  SHIELD_CAP: 0.5,   // 护盾上限 = maxhp × 此值（UE 切片未接）
  REST_HEAL: 0.12,   // 脱战回血比例（UE 切片未接）
  // 与 UE 当前实现的对应关系（给人看的注释，不是运行数据）
  ueNotes: {
    damage: 'max(1, round(Atk * SkillMult * TypeMult * DEF_K/(DEF_K+Def)))；MISS 时伤害=0 不做最低1兜底',
    hitRoll: 'RandomInteger 0..99 < HitChance 才命中',
    typeSubset: 'UE 目前只做 Normal/Fire/Water/Grass 四属性三角；完整 18 属性见 types.js CHART'
  }
};

// ---------------------------------------------------------------------------
// 2) 属性名 → UE Integer（与 BP_Unit.AtkType 约定对齐）
//    0..3 已在 UE 使用；4+ 是预留，方便以后扩表，当前切片不要用。
// ---------------------------------------------------------------------------
const TYPE_ID = {
  normal: 0,
  fire: 1,
  water: 2,
  grass: 3,
  // —— 以下预留，web 有、UE 切片尚未接 ——
  electric: 4,
  ghost: 5,
  flying: 6,
  fighting: 7,
  rock: 8,
  poison: 9,
  dark: 10,
  ground: 11,
  bug: 12,
  ice: 13,
  steel: 14,
  psychic: 15,
  fairy: 16,
  dragon: 17
};

// ---------------------------------------------------------------------------
// 3) 纯数值技能表（从 SKILLS 过滤 + 展平）
//    列说明：
//      id / name / mult / hit / crit / rb / type / typeId
//      uePhase: 1=可立刻接进 ComputeSkillDamage；2=要先扩属性或技能选择
//      webRef: 对应 skills.js 里的键，方便对表
// ---------------------------------------------------------------------------
const NUMERIC_SKILLS = [
  // —— uePhase 1：UE 已硬编码的两档（数值必须与蓝图一致）——
  // inflictKind / inflictChance：完整保留 web 数值；bUseInflictInSlice=false 表示当前 UE 切片先不算异常，你以后自己改开关即可
  { id: 'basic',  name: '普通攻击', mult: 0.9, hit: 95, crit: 0, rb: 0, type: 'normal', typeId: 0,
    inflictKind: '', inflictChance: 0, bUseInflictInSlice: false,
    uePhase: 1, ueSlot: 'skill1', webRef: 'SKILLS.basic',
    note: 'UE: bUseSkill2=false；属性强制按 Normal 不参与克制' },
  { id: 'ember',  name: '火花',     mult: 1.4, hit: 90, crit: 0, rb: 0, type: 'fire',   typeId: 1,
    inflictKind: 'burn', inflictChance: 30, bUseInflictInSlice: false,
    uePhase: 1, ueSlot: 'skill2_fire',  webRef: 'SKILLS.ember',
    note: '表内保留 30%灼烧；切片默认忽略，接异常系统后把 bUseInflictInSlice 改 true' },
  { id: 'aqua',   name: '水枪',     mult: 1.4, hit: 90, crit: 0, rb: 1, type: 'water',  typeId: 2,
    inflictKind: '', inflictChance: 0, bUseInflictInSlice: false,
    uePhase: 1, ueSlot: 'skill2_water', webRef: 'SKILLS.aqua',
    note: 'UE 切片暂未接 rb 射程；先对齐伤害/命中/属性' },
  { id: 'vine',   name: '藤鞭',     mult: 1.4, hit: 90, crit: 0, rb: 1, type: 'grass',  typeId: 3,
    inflictKind: '', inflictChance: 0, bUseInflictInSlice: false,
    uePhase: 1, ueSlot: 'skill2_grass', webRef: 'SKILLS.vine',
    note: '同上' },

  // —— uePhase 1 候选：同模板、无副作用，换表即可（仍是单目标 atk）——
  { id: 'heavy',      name: '重击',     mult: 1.6,  hit: 80, crit: 5,  rb: 0, type: 'normal',   typeId: 0,  uePhase: 1, webRef: 'SKILLS.heavy' },
  { id: 'powerstrike',name: '强袭',     mult: 1.7,  hit: 85, crit: 8,  rb: 0, type: 'normal',   typeId: 0,  uePhase: 1, webRef: 'SKILLS.powerstrike' },
  { id: 'e_ground',   name: '地震',     mult: 1.0,  hit: 90, crit: 0,  rb: 0, type: 'ground',   typeId: 11, uePhase: 2, webRef: 'SKILLS.e_ground', note: '属性超出 UE 四色，先扩 TYPE 再接' },
  { id: 'e_bug',      name: '虫咬',     mult: 1.0,  hit: 90, crit: 0,  rb: 0, type: 'bug',      typeId: 12, uePhase: 2, webRef: 'SKILLS.e_bug' },
  { id: 'gust',       name: '起风',     mult: 1.0,  hit: 90, crit: 0,  rb: 1, type: 'flying',   typeId: 6,  uePhase: 2, webRef: 'SKILLS.gust' },
  { id: 'e_water',    name: '喷水',     mult: 1.0,  hit: 90, crit: 0,  rb: 1, type: 'water',    typeId: 2,  uePhase: 1, webRef: 'SKILLS.e_water' },
  { id: 'e_grass',    name: '缠绕',     mult: 1.0,  hit: 90, crit: 0,  rb: 1, type: 'grass',    typeId: 3,  uePhase: 1, webRef: 'SKILLS.e_grass' },
  { id: 'rockthrow',  name: '落石',     mult: 1.0,  hit: 85, crit: 0,  rb: 1, type: 'rock',     typeId: 8,  uePhase: 2, webRef: 'SKILLS.rockthrow' },
  { id: 'shadow',     name: '暗影球',   mult: 1.4,  hit: 88, crit: 5,  rb: 1, type: 'ghost',    typeId: 5,  uePhase: 2, webRef: 'SKILLS.shadow' },
  { id: 'e_ghost',    name: '惊吓',     mult: 1.0,  hit: 88, crit: 0,  rb: 1, type: 'ghost',    typeId: 5,  uePhase: 2, webRef: 'SKILLS.e_ghost' },
  { id: 'e_ice',      name: '冰冻光束', mult: 1.0,  hit: 90, crit: 0,  rb: 1, type: 'ice',      typeId: 13, uePhase: 2, webRef: 'SKILLS.e_ice' },
  { id: 'e_fairy',    name: '魔法闪耀', mult: 1.0,  hit: 90, crit: 0,  rb: 1, type: 'fairy',    typeId: 16, uePhase: 2, webRef: 'SKILLS.e_fairy' },
  { id: 'e_dragon',   name: '龙息',     mult: 1.0,  hit: 90, crit: 0,  rb: 1, type: 'dragon',   typeId: 17, uePhase: 2, webRef: 'SKILLS.e_dragon' },
  { id: 'chop',       name: '空手劈',   mult: 1.05, hit: 88, crit: 5,  rb: 0, type: 'fighting', typeId: 7,  uePhase: 2, webRef: 'SKILLS.chop' },
  { id: 'e_steel',    name: '金属爪',   mult: 1.0,  hit: 92, crit: 5,  rb: 0, type: 'steel',    typeId: 14, uePhase: 2, webRef: 'SKILLS.e_steel' },
  { id: 'e_dark',     name: '咬碎',     mult: 1.05, hit: 90, crit: 5,  rb: 0, type: 'dark',     typeId: 10, uePhase: 2, webRef: 'SKILLS.e_dark' },
  { id: 'hydro',      name: '水炮',     mult: 1.5,  hit: 88, crit: 0,  rb: 1, type: 'water',    typeId: 2,  uePhase: 1, webRef: 'SKILLS.hydro' },
  { id: 'leafblade',  name: '飞叶刃',   mult: 1.5,  hit: 90, crit: 12, rb: 1, type: 'grass',    typeId: 3,  uePhase: 1, webRef: 'SKILLS.leafblade' },
  { id: 'irontail',   name: '铁尾',     mult: 1.5,  hit: 88, crit: 10, rb: 0, type: 'steel',    typeId: 14, uePhase: 2, webRef: 'SKILLS.irontail' },
  { id: 'crunch',     name: '咬碎击',   mult: 1.5,  hit: 88, crit: 10, rb: 0, type: 'dark',     typeId: 10, uePhase: 2, webRef: 'SKILLS.crunch' },
  { id: 'icebeam',    name: '极冰',     mult: 1.45, hit: 90, crit: 5,  rb: 1, type: 'ice',      typeId: 13, uePhase: 2, webRef: 'SKILLS.icebeam' },
  { id: 'dragonpulse',name: '龙波',     mult: 1.5,  hit: 88, crit: 5,  rb: 2, type: 'dragon',   typeId: 17, uePhase: 2, webRef: 'SKILLS.dragonpulse' },
  { id: 'dazzle',     name: '魔法闪光', mult: 1.45, hit: 92, crit: 5,  rb: 1, type: 'fairy',    typeId: 16, uePhase: 2, webRef: 'SKILLS.dazzle' },
  { id: 'bugbuzz',    name: '虫鸣',     mult: 1.45, hit: 90, crit: 5,  rb: 1, type: 'bug',      typeId: 12, uePhase: 2, webRef: 'SKILLS.bugbuzz' },
  { id: 'airslash',   name: '气旋斩',   mult: 1.5,  hit: 88, crit: 10, rb: 1, type: 'flying',   typeId: 6,  uePhase: 2, webRef: 'SKILLS.airslash' },
  { id: 'nightshade', name: '夜阴',     mult: 1.5,  hit: 88, crit: 15, rb: 1, type: 'ghost',    typeId: 5,  uePhase: 2, webRef: 'SKILLS.nightshade' },
  { id: 'closecombat',name: '近身战',   mult: 1.7,  hit: 90, crit: 10, rb: 0, type: 'fighting', typeId: 7,  uePhase: 2, webRef: 'SKILLS.closecombat' },

  // —— AOE 范围技能(2026-08-29 移植进 UE,2026-09-01 补进本表)——
  // ⚠ 这 4 行此前只手工加在 js/data/ue_import/DT_Skills.csv 里,没有加进本表,
  //   导致「跑一次 export_ue_csv.js 就会把它们静默抹掉」。补进来后生成器重新成为唯一来源。
  //   kind='aoe' 不写在这里——导出时从 js/data/skills.js 现查(见 export_ue_csv.js),避免又多一份副本。
  { id: 'sweep',      name: '横扫',     mult: 1.0,  hit: 85, crit: 0,  rb: 0, type: 'normal',   typeId: 0,  uePhase: 1, webRef: 'SKILLS.sweep' },
  { id: 'quake',      name: '地裂',     mult: 1.2,  hit: 85, crit: 0,  rb: 0, type: 'ground',   typeId: 11, uePhase: 1, webRef: 'SKILLS.quake' },
  { id: 'rockslide',  name: '岩崩',     mult: 1.2,  hit: 82, crit: 0,  rb: 1, type: 'rock',     typeId: 8,  uePhase: 1, webRef: 'SKILLS.rockslide' },
  { id: 'cleave',     name: '横扫斩',   mult: 1.25, hit: 85, crit: 0,  rb: 0, type: 'normal',   typeId: 0,  uePhase: 1, webRef: 'SKILLS.cleave' }
];

// ---------------------------------------------------------------------------
// 4) 纯数值遗物表（从 RELICS 展平）
//    effectKind 告诉 UE「往哪条链路塞数字」：
//      statMod      → ApplyStartingRelics：开战改 Atk/Def/Spd/MaxHp/Lck/Shield
//      hitAdd       → 命中公式：HitChance += hitAdd
//      critAdd      → 暴击公式：CritChance += critAdd（UE 尚未接暴击时先存表）
//      dmgMult      → 造成伤害乘区
//      dmgTakenMult → 受伤乘区
//      thorns       → 被命中反伤（固定点数）
//      capAdd       → 收服成功率（UE 未接）
//      expMult      → 经验倍率（UE 未接）
//    组合遗物会填多列；实现时按非 0 / 非 1 的列应用即可。
// ---------------------------------------------------------------------------
const NUMERIC_RELICS = [
  // —— 已在 UE ApplyStartingRelics 硬编码（必须保持一致）——
  { id: 'power_band',  name: '力量头带', arch: 'out', uePhase: 1, alreadyInUE: true, effectKind: 'statMod',
    atkAdd: 2, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.power_band', note: 'UE 已实现：全队 Atk+2' },
  { id: 'steel_will',  name: '钢之意志', arch: 'def', uePhase: 1, alreadyInUE: true, effectKind: 'statMod',
    atkAdd: 0, defAdd: 2, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.steel_will', note: 'UE 已实现：全队 Def+2' },

  // —— 下一波最容易接：同样走 ApplyStartingRelics ——
  { id: 'swift_boots', name: '迅捷之靴', arch: 'pos', uePhase: 1, alreadyInUE: false, effectKind: 'statMod',
    atkAdd: 0, defAdd: 0, spdAdd: 2, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.swift_boots' },
  { id: 'giant_belt',  name: '巨力腰带', arch: 'def', uePhase: 1, alreadyInUE: false, effectKind: 'statMod',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 8, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.giant_belt', note: '开战 MaxHp+8 且当前 Hp+8' },
  { id: 'lucky_coin',  name: '幸运币',   arch: 'out', uePhase: 1, alreadyInUE: false, effectKind: 'statMod',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 4, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.lucky_coin', note: 'UE 若尚无 Lck 字段，先加变量再应用' },
  { id: 'glass_cannon',name: '玻璃大炮', arch: 'out', uePhase: 1, alreadyInUE: false, effectKind: 'statMod',
    atkAdd: 5, defAdd: -2, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.glass_cannon', note: 'Def 应用后需 clamp 到 >=0' },
  { id: 'heavy_shield',name: '重盾',     arch: 'def', uePhase: 2, alreadyInUE: false, effectKind: 'statMod',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 10,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.heavy_shield', note: '需要 Shield 字段 + 受伤先扣盾' },
  { id: 'blood_thirst',name: '嗜血渴望', arch: 'curse', uePhase: 1, alreadyInUE: false, effectKind: 'statMod', curse: 1,
    atkAdd: 9, defAdd: 0, spdAdd: 0, maxhpAdd: -4, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.blood_thirst', note: 'MaxHp 下限 5；Hp 同步扣且不低于 1' },

  // —— 命中 / 暴击 / 乘区（进 ComputeSkillDamage 乘区即可）——
  { id: 'hunter_lens', name: '猎手之瞳', arch: 'out', uePhase: 1, alreadyInUE: false, effectKind: 'hitAdd',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 12, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.hunter_lens', note: 'HitChance += 12（建议 clamp 0..100）' },
  { id: 'sharp_scope', name: '瞄准镜',   arch: 'out', uePhase: 2, alreadyInUE: false, effectKind: 'critAdd',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 15, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.sharp_scope', note: 'UE 尚未接暴击骰；接暴击后再启用' },
  { id: 'iron_hide',   name: '铁甲皮',   arch: 'def', uePhase: 1, alreadyInUE: false, effectKind: 'dmgTakenMult',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 0.85, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.iron_hide', note: '我方受伤时 Damage *= 0.85' },
  { id: 'arrogance',   name: '傲慢面具', arch: 'curse', uePhase: 1, alreadyInUE: false, effectKind: 'dmgMult', curse: 1,
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1.35, dmgTakenMult: 1, thorns: 0, capAdd: -1, expMult: 1,
    webRef: 'RELICS.arrogance', note: '造成伤害 ×1.35；capAdd=-1 表示禁止收服（UE 无收服可先忽略）' },
  { id: 'berserk_pact',name: '狂乱契约', arch: 'curse', uePhase: 1, alreadyInUE: false, effectKind: 'dmgMult+statMod', curse: 1,
    atkAdd: 0, defAdd: -1, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1.50, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.berserk_pact' },
  { id: 'abyss_eye',   name: '深渊之眼', arch: 'curse', uePhase: 1, alreadyInUE: false, effectKind: 'hitAdd+statMod', curse: 1,
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: -4, shieldAdd: 0,
    hitAdd: 25, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.abyss_eye' },
  { id: 'glass_heart', name: '玻璃之心', arch: 'curse', uePhase: 2, alreadyInUE: false, effectKind: 'critAdd+statMod', curse: 1,
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0, maxhpPct: -0.12,
    hitAdd: 0, critAdd: 45, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    webRef: 'RELICS.glass_heart', note: 'MaxHp *= (1-0.12) 再 round；依赖暴击系统' },

  // —— 条件乘区：仍是固定数字，但要读技能 type（实现简单）——
  { id: 'elem_core',   name: '元素核心', arch: 'out', uePhase: 1, alreadyInUE: false, effectKind: 'dmgMult_if',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1.15, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    cond: 'skillType != normal', webRef: 'RELICS.elem_core',
    note: '当次技能 type≠normal 时伤害 ×1.15；配 UE 元素技能正好可测' },
  { id: 'brute_core',  name: '蛮力核心', arch: 'out', uePhase: 1, alreadyInUE: false, effectKind: 'dmgMult_if',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1.15, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1,
    cond: 'skillType == normal', webRef: 'RELICS.brute_core' },

  // —— 固定点数反伤 / 经验 / 收服（UE 缺系统时标 phase 2）——
  { id: 'thorn_mail',  name: '荆棘甲',   arch: 'def', uePhase: 2, alreadyInUE: false, effectKind: 'thorns',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 4, capAdd: 0, expMult: 1,
    webRef: 'RELICS.thorn_mail' },
  { id: 'spike_shell', name: '尖刺壳',   arch: 'def', uePhase: 2, alreadyInUE: false, effectKind: 'thorns',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 6, capAdd: 0, expMult: 1,
    webRef: 'RELICS.spike_shell' },
  { id: 'thorn_crown', name: '荆棘王冠', arch: 'curse', uePhase: 2, alreadyInUE: false, effectKind: 'thorns+dmgTakenMult', curse: 1,
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1.12, thorns: 9, capAdd: 0, expMult: 1,
    webRef: 'RELICS.thorn_crown' },
  { id: 'exp_necklace',name: '经验项链', arch: 'collect', uePhase: 2, alreadyInUE: false, effectKind: 'expMult',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1.3,
    webRef: 'RELICS.exp_necklace' },
  { id: 'gold_idol',   name: '黄金神像', arch: 'collect', uePhase: 2, alreadyInUE: false, effectKind: 'expMult',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1.5,
    webRef: 'RELICS.gold_idol' },
  { id: 'tamer_flute', name: '驯兽笛',   arch: 'collect', uePhase: 2, alreadyInUE: false, effectKind: 'capAdd',
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0.20, expMult: 1,
    webRef: 'RELICS.tamer_flute' },
  { id: 'gambler_die', name: '赌徒骰',   arch: 'curse', uePhase: 1, alreadyInUE: false, effectKind: 'hitFix', curse: 1,
    atkAdd: 0, defAdd: 0, spdAdd: 0, maxhpAdd: 0, lckAdd: 0, shieldAdd: 0,
    hitAdd: 0, critAdd: 0, dmgMult: 1, dmgTakenMult: 1, thorns: 0, capAdd: 0, expMult: 1, hitFix: 92,
    webRef: 'RELICS.gambler_die', note: '有此遗物时 HitChance 强制=92，覆盖技能原 hit' }
];

// ---------------------------------------------------------------------------
// 5) 暂不关联（需要状态机 / 网格 / 事件回调）——只列原因，方便排期
// ---------------------------------------------------------------------------
const DEFERRED_SKILLS = [
  { id: 'heal / charge / swap', reason: '非伤害动作，要单独 action kind' },
  { id: 'sweep / quake / rockslide / cleave', reason: 'AOE，要多目标选择' },
  { id: 'bash + knockback relic', reason: '击退与地形致死' },
  { id: 'reckless / bravebird', reason: 'recoil 自损' },
  { id: 'ember/spark/sludge/... inflict', reason: '异常状态（burn/poison/para）' },
  { id: 'shieldbash / guardstance', reason: '依赖护盾数值' }
];

const DEFERRED_RELICS = [
  { id: 'executioner / para_smash', reason: '读目标异常状态' },
  { id: 'lean_zeal / light_pack / lone_wolf', reason: '读牌库数量' },
  { id: 'formation / flank / alpha / knockback', reason: '读网格位置/回合顺序' },
  { id: 'venom_fang / flame_brand', reason: '命中附状态' },
  { id: 'vamp_charm / berserker / phoenix', reason: '击杀/复活事件' },
  { id: 'shield_gen / immolate', reason: '每回合 tick（回盾/自损）' }
];

// ---------------------------------------------------------------------------
// 6) 推荐「下一步直接 implement」子集（最小可验证闭环）
//    目标：不动 UI，只把表里的数字接到现有蓝图函数。
// ---------------------------------------------------------------------------
const UE_IMPLEMENT_NOW = {
  // 技能：保持现有两槽，但把硬编码数字改成「读表」心智模型
  skills: ['basic', 'ember', 'aqua', 'vine'],
  // 遗物：在 power_band + steel_will 之外，优先加 3 个最容易测的
  relics: [
    'power_band',   // 已有
    'steel_will',   // 已有
    'hunter_lens',  // Hit+12 → 肉眼可见更少 MISS
    'iron_hide',    // 受伤 ×0.85
    'elem_core'     // 元素技能伤害 ×1.15（和 skill2 联动最好测）
  ],
  // 蓝图改动建议（给人看）
  blueprintHints: [
    'ComputeSkillDamage：命中后乘上「全局 RelicDmgMult」，受伤前乘「RelicDmgTakenMult」',
    'ComputeSkillDamage：HitChance = 技能 hit + RelicHitAdd；若有 hitFix 则覆盖',
    'ApplyStartingRelics：按 NUMERIC_RELICS 里 statMod 列累加，而不是写死 +2/+2',
    '先不要做遗物三选一 UI：继续用「开局全部启用 UE_IMPLEMENT_NOW.relics」验证数值'
  ]
};

// ---------------------------------------------------------------------------
// 7) 小工具：按 phase / 已实现过滤（浏览器控制台可调用）
// ---------------------------------------------------------------------------
function listNumericSkills(phase) {
  return NUMERIC_SKILLS.filter(s => phase == null || s.uePhase === phase);
}
function listNumericRelics(phase) {
  return NUMERIC_RELICS.filter(r => phase == null || r.uePhase === phase);
}
function getNumericSkill(id) {
  return NUMERIC_SKILLS.find(s => s.id === id) || null;
}
function getNumericRelic(id) {
  return NUMERIC_RELICS.find(r => r.id === id) || null;
}
