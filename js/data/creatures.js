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
 ghost:[{pid:92,name:'鬼斯'},{pid:93,name:'鬼斯通'},{pid:94,name:'耿鬼'}]
};
// 伊布形态(每战可选,战后变回)
const EEVEE_FORMS={fire:{pid:136,name:'火伊布',el:'fire'},water:{pid:134,name:'水伊布',el:'water'},electric:{pid:135,name:'雷伊布',el:'electric'}};
// 野怪(普通战)—— 各按类型揣 1 个元素招(e_*),让敌方也吃克制博弈
const WILD={
 vulpix:{name:'六尾',pid:37,type:'fire',em:'🔥',hp:20,atk:11,def:6,spd:6,skl:5,lck:3,mov:4,rng:1,skills:['basic','e_fire']},
 oddish:{name:'走路草',pid:43,type:'grass',em:'🍃',hp:20,atk:10,def:6,spd:4,skl:4,lck:3,mov:4,rng:1,skills:['basic','e_grass']},
 poliwag:{name:'蚊香蝌蚪',pid:60,type:'water',em:'💧',hp:22,atk:11,def:7,spd:5,skl:5,lck:3,mov:4,rng:1,skills:['basic','e_water']},
 pidgey:{name:'波波',pid:16,type:'flying',em:'🐦',hp:18,atk:9,def:5,spd:8,skl:6,lck:4,mov:5,rng:1,skills:['basic','gust']},
 rattata:{name:'小拉达',pid:19,type:'normal',em:'🐀',hp:19,atk:10,def:5,spd:7,skl:5,lck:3,mov:5,rng:1,skills:['basic']},
 growlithe:{name:'卡蒂狗',pid:58,type:'fire',em:'🐶',hp:23,atk:12,def:6,spd:7,skl:6,lck:4,mov:5,rng:1,skills:['basic','e_fire']},
 machop:{name:'腕力',pid:66,type:'fighting',em:'🥊',hp:24,atk:13,def:7,spd:5,skl:6,lck:3,mov:4,rng:1,skills:['basic','chop']},
 geodude:{name:'小拳石',pid:74,type:'rock',em:'🪨',hp:26,atk:11,def:12,spd:3,skl:4,lck:3,mov:3,rng:1,skills:['basic','rockthrow']},
 bellsprout:{name:'喇叭芽',pid:69,type:'grass',em:'🌱',hp:20,atk:12,def:5,spd:6,skl:6,lck:3,mov:4,rng:2,skills:['basic','e_grass']},
 zubat:{name:'超音蝠',pid:41,type:'poison',em:'🦇',hp:19,atk:10,def:5,spd:9,skl:6,lck:4,mov:6,rng:1,skills:['basic','sludge']},
 mareep:{name:'咩利羊',pid:179,type:'electric',em:'🐑',hp:21,atk:11,def:6,spd:7,skl:6,lck:4,mov:4,rng:1,skills:['basic','e_elec']},
 voltorb:{name:'霹雳电球',pid:100,type:'electric',em:'🔴',hp:20,atk:10,def:7,spd:10,skl:7,lck:4,mov:4,rng:2,skills:['basic','e_elec']},
 misdreavus:{name:'梦妖',pid:200,type:'ghost',em:'🌀',hp:19,atk:13,def:5,spd:9,skl:7,lck:5,mov:5,rng:2,skills:['basic','e_ghost']},
 shuppet:{name:'怨影娃娃',pid:353,type:'ghost',em:'🎏',hp:18,atk:14,def:4,spd:8,skl:7,lck:4,mov:5,rng:1,skills:['basic','e_ghost']},
 staryu:{name:'海星星',pid:120,type:'water',em:'⭐',hp:22,atk:11,def:7,spd:8,skl:6,lck:5,mov:4,rng:2,skills:['basic','e_water']},
 horsea:{name:'墨海马',pid:116,type:'water',em:'🐴',hp:21,atk:11,def:7,spd:7,skl:6,lck:4,mov:4,rng:2,skills:['basic','e_water']}
};
const ELITE={name:'可达鸭',pid:54,type:'water',em:'🦆',hp:34,atk:14,def:9,spd:6,skl:6,lck:4,mov:4,rng:1,skills:['basic','e_water'],elite:true};
// 三章 Boss(高血量、长回合、非秒杀)
const CH_BOSS={
 1:{name:'暴鲤龙',pid:130,type:'water',em:'🐉',hp:80,atk:14,def:11,spd:7,skl:7,lck:5,mov:4,rng:1,skills:['basic','e_water'],elite:true},
 2:{name:'快龙',pid:149,type:'dragon',em:'🐲',hp:105,atk:15,def:13,spd:8,skl:8,lck:6,mov:5,rng:1,skills:['basic','gust'],elite:true},
 3:{name:'超梦',pid:150,type:'psychic',em:'🧠',hp:140,atk:17,def:13,spd:9,skl:9,lck:7,mov:5,rng:2,skills:['basic','confusion'],elite:true}
};
const CH_NAME={1:'第一章 · 静水湾',2:'第二章 · 龙脊山',3:'第三章 · 心智深渊'};
const NICON={battle:'⚔',elite:'☠',event:'❓',rest:'🏕',boss:'👑'};
const NNAME={battle:'战斗',elite:'精英',event:'事件',rest:'休整',boss:'BOSS'};
