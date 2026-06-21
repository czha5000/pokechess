// 携带道具(C1):每只精灵可携带 1 件,开战时生效(增量记入 _rb,不复利)。商店购买、背包装备。
const HELD_ITEMS={
 power_amulet:{icon:'💪',name:'力量护符',desc:'携带者 攻击+3',atk:3},
 guard_amulet:{icon:'🛡️',name:'守护护符',desc:'携带者 防御+3',def:3},
 swift_feather:{icon:'🪶',name:'迅捷羽',desc:'携带者 速度+2',spd:2},
 vital_band:{icon:'❤️',name:'活力带',desc:'携带者 最大生命+8',maxhp:8},
 focus_lens:{icon:'🔍',name:'专注镜',desc:'携带者 命中+12',hit:12},
 crit_claw:{icon:'🗡️',name:'锐利爪',desc:'携带者 暴击+12%',crit:12},
 guts_cape:{icon:'🧥',name:'气合披风',desc:'携带者 每回合回 3 HP',regen:3},
 toxic_orb:{icon:'🧪',name:'剧毒宝珠',desc:'命中 30% 使目标中毒',onHit:{kind:'poison',chance:30}},
 flame_orb:{icon:'🔥',name:'烈焰宝珠',desc:'命中 30% 使目标灼烧',onHit:{kind:'burn',chance:30}}
};
const HELD_KEYS=Object.keys(HELD_ITEMS);
