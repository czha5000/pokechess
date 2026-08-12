// 怪物数据(占位 sprite 用 PokeAPI 图鉴号;正式版替换为原创怪物)
// 我方初始精灵池
const POOL=[
 {key:'fire',name:'小火龙',pid:4,type:'fire',em:'🦎',hp:26,atk:13,def:7,spd:7,skl:8,lck:5,mov:5,rng:1},
 {key:'water',name:'杰尼龟',pid:7,type:'water',em:'🐢',hp:32,atk:10,def:12,spd:4,skl:5,lck:4,mov:4,rng:1},
 {key:'grass',name:'妙蛙种子',pid:1,type:'grass',em:'🌿',hp:24,atk:12,def:8,spd:6,skl:7,lck:5,mov:4,rng:2},
 {key:'electric',name:'皮卡丘',pid:25,type:'electric',em:'⚡',hp:20,atk:14,def:5,spd:11,skl:9,lck:6,mov:6,rng:2},
 {key:'ghost',name:'鬼斯',pid:92,type:'ghost',em:'👻',hp:18,atk:16,def:4,spd:9,skl:8,lck:4,mov:5,rng:2},
 {key:'normal',name:'伊布',pid:133,type:'normal',em:'🐾',hp:26,atk:12,def:8,spd:7,skl:7,lck:6,mov:5,rng:1,hero:true}
];
// 进化线(阶段0/1/2;伊布走形态切换不在此)
const EVO={
 fire:[{pid:4,name:'小火龙'},{pid:5,name:'火恐龙'},{pid:6,name:'喷火龙'}],
 water:[{pid:7,name:'杰尼龟'},{pid:8,name:'卡咪龟'},{pid:9,name:'水箭龟'}],
 grass:[{pid:1,name:'妙蛙种子'},{pid:2,name:'妙蛙草'},{pid:3,name:'妙蛙花'}],
 electric:[{pid:25,name:'皮卡丘'},{pid:26,name:'雷丘'}],
 ghost:[{pid:92,name:'鬼斯'},{pid:93,name:'鬼斯通'},{pid:94,name:'耿鬼'}],
 // —— 可收服野怪/精英 各自进化线(key=种类,Lv4 进 2 阶 / Lv7 进 3 阶)——
 vulpix:[{pid:37,name:'六尾'},{pid:38,name:'九尾'}],
 oddish:[{pid:43,name:'走路草'},{pid:44,name:'臭臭花'},{pid:45,name:'霸王花'}],
 poliwag:[{pid:60,name:'蚊香蝌蚪'},{pid:61,name:'蚊香君'},{pid:62,name:'蚊香蛙皇'}],
 pidgey:[{pid:16,name:'波波'},{pid:17,name:'比比鸟'},{pid:18,name:'大比鸟'}],
 rattata:[{pid:19,name:'小拉达'},{pid:20,name:'拉达'}],
 growlithe:[{pid:58,name:'卡蒂狗'},{pid:59,name:'风速狗'}],
 machop:[{pid:66,name:'腕力'},{pid:67,name:'豪力'},{pid:68,name:'怪力'}],
 geodude:[{pid:74,name:'小拳石'},{pid:75,name:'隆隆石'},{pid:76,name:'隆隆岩'}],
 bellsprout:[{pid:69,name:'喇叭芽'},{pid:70,name:'口呆花'},{pid:71,name:'大食花'}],
 zubat:[{pid:41,name:'超音蝠'},{pid:42,name:'大嘴蝠'}],
 chansey:[{pid:113,name:'吉利蛋'},{pid:242,name:'幸福蛋'}],
 mareep:[{pid:179,name:'咩利羊'},{pid:180,name:'茸茸羊'},{pid:181,name:'电龙'}],
 voltorb:[{pid:100,name:'霹雳电球'},{pid:101,name:'顽皮雷弹'}],
 misdreavus:[{pid:200,name:'梦妖'},{pid:429,name:'梦妖魔'}],
 shuppet:[{pid:353,name:'怨影娃娃'},{pid:354,name:'诅咒娃娃'}],
 staryu:[{pid:120,name:'海星星'},{pid:121,name:'宝石海星'}],
 horsea:[{pid:116,name:'墨海马'},{pid:117,name:'海刺龙'},{pid:230,name:'刺龙王'}],
 psyduck:[{pid:54,name:'可达鸭'},{pid:55,name:'哥达鸭'}],
 graveler:[{pid:75,name:'隆隆石'},{pid:76,name:'隆隆岩'}],
 diglett:[{pid:50,name:'地鼠'},{pid:51,name:'三地鼠'}],
 abra:[{pid:63,name:'凯西'},{pid:64,name:'勇基拉'},{pid:65,name:'胡地'}],
 magnemite:[{pid:81,name:'小磁怪'},{pid:82,name:'三合一磁怪'}],
 paras:[{pid:46,name:'派拉斯'},{pid:47,name:'派拉斯特'}],
 ekans:[{pid:23,name:'阿柏蛇'},{pid:24,name:'阿柏怪'}],
 mankey:[{pid:56,name:'猴怪'},{pid:57,name:'火爆猴'}],
 spearow:[{pid:21,name:'烈雀'},{pid:22,name:'大嘴雀'}],
 clefairy:[{pid:35,name:'皮皮'},{pid:36,name:'皮可西'}],
 dratini:[{pid:147,name:'迷你龙'},{pid:148,name:'哈克龙'},{pid:149,name:'快龙'}],
 seel:[{pid:86,name:'小海狮'},{pid:87,name:'白海狮'}],
 houndour:[{pid:228,name:'戴鲁比'},{pid:229,name:'黑鲁加'}]
};
// 伊布形态(每战可选,战后变回)
const EEVEE_FORMS={fire:{pid:136,name:'火伊布',el:'fire'},water:{pid:134,name:'水伊布',el:'water'},electric:{pid:135,name:'雷伊布',el:'electric'}};
// 野怪(普通战)—— 各按类型揣 1 个元素招(e_*),让敌方也吃克制博弈
const WILD={
 vulpix:{key:'vulpix',name:'六尾',pid:37,type:'fire',em:'🔥',hp:20,atk:11,def:6,spd:6,skl:5,lck:3,mov:4,rng:1,skills:['basic','e_fire']},
 oddish:{key:'oddish',name:'走路草',pid:43,type:'grass',em:'🍃',hp:20,atk:10,def:6,spd:4,skl:4,lck:3,mov:4,rng:1,skills:['basic','e_grass']},
 poliwag:{key:'poliwag',name:'蚊香蝌蚪',pid:60,type:'water',em:'💧',hp:22,atk:11,def:7,spd:5,skl:5,lck:3,mov:4,rng:1,skills:['basic','e_water']},
 pidgey:{key:'pidgey',name:'波波',pid:16,type:'flying',em:'🐦',hp:18,atk:9,def:5,spd:8,skl:6,lck:4,mov:5,rng:1,skills:['basic','gust']},
 rattata:{key:'rattata',name:'小拉达',pid:19,type:'normal',em:'🐀',hp:19,atk:10,def:5,spd:7,skl:5,lck:3,mov:5,rng:1,skills:['basic','bash']},
 growlithe:{key:'growlithe',name:'卡蒂狗',pid:58,type:'fire',em:'🐶',hp:23,atk:12,def:6,spd:7,skl:6,lck:4,mov:5,rng:1,skills:['basic','e_fire']},
 machop:{key:'machop',name:'腕力',pid:66,type:'fighting',em:'🥊',hp:24,atk:13,def:7,spd:5,skl:6,lck:3,mov:4,rng:1,skills:['basic','chop']},
 geodude:{key:'geodude',name:'小拳石',pid:74,type:'rock',em:'🪨',hp:26,atk:11,def:12,spd:3,skl:4,lck:3,mov:3,rng:1,skills:['basic','rockthrow']},
 bellsprout:{key:'bellsprout',name:'喇叭芽',pid:69,type:'grass',em:'🌱',hp:20,atk:12,def:5,spd:6,skl:6,lck:3,mov:4,rng:2,skills:['basic','e_grass']},
 zubat:{key:'zubat',name:'超音蝠',pid:41,type:'poison',em:'🦇',hp:19,atk:10,def:5,spd:9,skl:6,lck:4,mov:6,rng:1,skills:['basic','sludge']},
 chansey:{key:'chansey',name:'吉利蛋',pid:113,type:'normal',em:'🥚',hp:42,atk:7,def:5,spd:5,skl:5,lck:6,mov:4,rng:1,skills:['basic','heal'],role:'healer'},
 mareep:{key:'mareep',name:'咩利羊',pid:179,type:'electric',em:'🐑',hp:21,atk:11,def:6,spd:7,skl:6,lck:4,mov:4,rng:1,skills:['basic','e_elec']},
 voltorb:{key:'voltorb',name:'霹雳电球',pid:100,type:'electric',em:'🔴',hp:20,atk:10,def:7,spd:10,skl:7,lck:4,mov:4,rng:2,skills:['basic','e_elec']},
 misdreavus:{key:'misdreavus',name:'梦妖',pid:200,type:'ghost',em:'🌀',hp:19,atk:13,def:5,spd:9,skl:7,lck:5,mov:5,rng:2,skills:['basic','e_ghost']},
 shuppet:{key:'shuppet',name:'怨影娃娃',pid:353,type:'ghost',em:'🎏',hp:18,atk:14,def:4,spd:8,skl:7,lck:4,mov:5,rng:1,skills:['basic','e_ghost']},
 staryu:{key:'staryu',name:'海星星',pid:120,type:'water',em:'⭐',hp:22,atk:11,def:7,spd:8,skl:6,lck:5,mov:4,rng:2,skills:['basic','e_water']},
 horsea:{key:'horsea',name:'墨海马',pid:116,type:'water',em:'🐴',hp:21,atk:11,def:7,spd:7,skl:6,lck:4,mov:4,rng:2,skills:['basic','e_water']},
 diglett:{key:'diglett',name:'地鼠',pid:50,type:'ground',em:'⛏',hp:18,atk:12,def:5,spd:9,skl:6,lck:4,mov:5,rng:1,skills:['basic','e_ground']},
 abra:{key:'abra',name:'凯西',pid:63,type:'psychic',em:'🔮',hp:18,atk:13,def:4,spd:10,skl:8,lck:5,mov:5,rng:2,skills:['basic','confusion']},
 magnemite:{key:'magnemite',name:'小磁怪',pid:81,type:'steel',em:'🧲',hp:20,atk:11,def:10,spd:6,skl:6,lck:3,mov:3,rng:2,skills:['basic','e_steel']},
 paras:{key:'paras',name:'派拉斯',pid:46,type:'bug',em:'🍄',hp:20,atk:11,def:8,spd:4,skl:5,lck:3,mov:4,rng:1,skills:['basic','e_bug']},
 ekans:{key:'ekans',name:'阿柏蛇',pid:23,type:'poison',em:'🐍',hp:20,atk:12,def:6,spd:6,skl:6,lck:4,mov:4,rng:1,skills:['basic','sludge']},
 onix:{key:'onix',name:'大岩蛇',pid:95,type:'rock',em:'🗿',hp:30,atk:10,def:14,spd:5,skl:4,lck:3,mov:4,rng:1,skills:['basic','rockthrow']},
 mankey:{key:'mankey',name:'猴怪',pid:56,type:'fighting',em:'🐒',hp:21,atk:13,def:6,spd:8,skl:7,lck:4,mov:5,rng:1,skills:['basic','chop']},
 spearow:{key:'spearow',name:'烈雀',pid:21,type:'flying',em:'🐤',hp:19,atk:11,def:5,spd:9,skl:7,lck:4,mov:6,rng:1,skills:['basic','gust']},
 clefairy:{key:'clefairy',name:'皮皮',pid:35,type:'fairy',em:'🧚',hp:24,atk:10,def:7,spd:5,skl:6,lck:6,mov:4,rng:1,skills:['basic','e_fairy']},
 dratini:{key:'dratini',name:'迷你龙',pid:147,type:'dragon',em:'🐉',hp:22,atk:12,def:7,spd:7,skl:6,lck:4,mov:4,rng:1,skills:['basic','e_dragon']},
 seel:{key:'seel',name:'小海狮',pid:86,type:'ice',em:'❄',hp:24,atk:10,def:8,spd:6,skl:5,lck:4,mov:4,rng:1,skills:['basic','e_ice']},
 houndour:{key:'houndour',name:'戴鲁比',pid:228,type:'dark',em:'🐺',hp:20,atk:12,def:6,spd:8,skl:6,lck:4,mov:5,rng:1,skills:['basic','e_dark']}
};
const ELITE={key:'psyduck',name:'可达鸭',pid:54,type:'water',em:'🦆',hp:34,atk:14,def:9,spd:6,skl:6,lck:4,mov:4,rng:1,skills:['basic','e_water'],elite:true};
// 分章精英(各带一个机制;mech 判定与 Boss 通用)
const CH_ELITE={
 1:{key:'psyduck',name:'可达鸭',pid:54,type:'water',em:'🦆',hp:34,atk:14,def:9,spd:6,skl:6,lck:4,mov:4,rng:1,skills:['basic','e_water'],elite:true,mech:'enrage'},
 2:{key:'graveler',name:'隆隆石',pid:75,type:'rock',em:'🪨',hp:42,atk:13,def:14,spd:3,skl:5,lck:4,mov:3,rng:1,skills:['basic','rockthrow'],elite:true,dmgCap:14},
 3:{key:'gengar',name:'耿鬼',pid:94,type:'ghost',em:'👻',hp:34,atk:15,def:6,spd:9,skl:8,lck:5,mov:5,rng:2,skills:['basic','e_ghost'],elite:true,bossShield:8}
};
// 三章 Boss(高血量、长回合、非秒杀)
const CH_BOSS={
 1:{key:'gyarados',name:'暴鲤龙',pid:130,type:'water',em:'🐉',hp:80,atk:14,def:11,spd:7,skl:7,lck:5,mov:4,rng:1,skills:['basic','e_water'],elite:true,mech:'enrage'},
 2:{key:'dragonite',name:'快龙',pid:149,type:'dragon',em:'🐲',hp:105,atk:15,def:13,spd:8,skl:8,lck:6,mov:5,rng:1,skills:['basic','gust'],elite:true,dmgCap:26},
 3:{key:'mewtwo',name:'超梦',pid:150,type:'psychic',em:'🧠',hp:140,atk:17,def:13,spd:9,skl:9,lck:7,mov:5,rng:2,skills:['basic','confusion'],elite:true,bossShield:15}
};
const CH_NAME={1:'第一章 · 静水湾',2:'第二章 · 龙脊山',3:'第三章 · 心智深渊'};
const NICON={battle:'⚔',elite:'☠',event:'❓',rest:'🏕',boss:'👑',shop:'🛒'};
const NNAME={battle:'战斗',elite:'精英',event:'事件',rest:'休整',boss:'BOSS',shop:'商店'};
// 开局阵容(C4):units 用 POOL 的 key,或 'w:野怪key' 引用野怪;relic=免费起始遗物
const START_DECKS=[
 {id:'all',  name:'全能队', desc:'六系俱全,最稳的开局,适合新手', units:['fire','water','grass','electric','ghost','normal'], relic:null},
 {id:'aggro',name:'先锋队', desc:'高攻速攻,脆但爆发(免费:瞄准镜)', units:['fire','electric','ghost','normal'], relic:'sharp_scope'},
 {id:'wall', name:'壁垒队', desc:'肉盾持久,慢热稳健(免费:重盾)', units:['water','grass','normal','w:geodude','w:machop'], relic:'heavy_shield'}
];
