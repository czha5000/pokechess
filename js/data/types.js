// 属性系统:18属性克制表 + 颜色/中文 + 占位贴图 URL
const SPRITE=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const TYPE_CN={normal:'普',fire:'火',water:'水',electric:'电',grass:'草',ice:'冰',fighting:'斗',poison:'毒',ground:'地',flying:'飞',psychic:'超',bug:'虫',rock:'岩',ghost:'幽',dragon:'龙',dark:'恶',steel:'钢',fairy:'妖'};
const TCOLOR={normal:'#9aa0aa',fire:'#e8602c',water:'#3aa0e8',electric:'#f2c233',grass:'#4caf50',ice:'#7fd8d8',fighting:'#c03028',poison:'#a040a0',ground:'#c8a85b',flying:'#9fb7ed',psychic:'#f85888',bug:'#a8b820',rock:'#b8a038',ghost:'#8e5fd0',dragon:'#6f35fc',dark:'#5a5366',steel:'#9aa6c8',fairy:'#ee99ac'};
// 只列非1倍的关系(攻击属性 -> {防守属性:倍率})
const CHART={
 normal:{rock:.5,ghost:0,steel:.5},
 fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},
 water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},
 electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},
 grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},
 ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},
 fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},
 poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},
 ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},
 flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},
 psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},
 bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},
 rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},
 ghost:{normal:0,psychic:2,ghost:2,dark:.5},
 dragon:{dragon:2,steel:.5,fairy:0},
 dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},
 steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},
 fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
};
function typeMult(a,b){if(!a)return 1;const r=CHART[a];if(!r)return 1;return (b in r)?r[b]:1;}
const ACTIVE_TYPES=['normal','fire','water','electric','grass','ghost','flying']; // 克制表速查里展示的属性
