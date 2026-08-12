// ============================================================================
// scan.js · 遗物强度 / 组合协同扫描(退化玩法猎手 · 第二把武器)
// ----------------------------------------------------------------------------
// 为什么不能只看绝对胜率:强制装备【任意】两件遗物都会把通关率从 61% 抬到 89-97%
// ——因为"开局白送两件"本身就是巨大加成。所以必须测【相对偏离】:
//
//   单件强度  lift(A)    = WR(A) − WR(基线)
//   组合协同  syn(A,B)   = WR(A+B) − WR(A) − WR(B) + WR(基线)
//              ↑ 这是交互项:去掉两件各自的贡献后,剩下的就是"1+1>2"的部分
//              syn 显著为正 = 退化组合(A/B 单独都还好,凑一起破坏平衡)
//
// 用法:
//   node scan.js single [每组局数]      扫全部单件
//   node scan.js pair   [每组局数] [K]  取单件 lift 最高的 K 件,两两测协同
//   结果缓存在 scan_cache.json,可中断续跑。
// ============================================================================
'use strict';
const {execSync}=require('child_process');
const fs=require('fs'), path=require('path');
const {loadGameData}=require('./loadData');
const G=loadGameData();
const CACHE=path.join(__dirname,'scan_cache.json');

const MODE=(process.argv[2]||'single').toLowerCase();
const N=parseInt(process.argv[3]||'60',10);
const TOPK=parseInt(process.argv[4]||'8',10);

let cache={};
try{cache=JSON.parse(fs.readFileSync(CACHE,'utf8'));}catch(e){}
const save=()=>fs.writeFileSync(CACHE,JSON.stringify(cache,null,1));

// v0.65:改用「推进力」(连续量,方差约为通关率的 1/3)+ 默认 ASC=2(远离 27 天花板,量程打开)
const ASC=process.env.ASC||'2', SEED=process.env.SEED||'11';
function wr(relics,n){
  const key=(relics||'∅')+'@'+n+'#a'+ASC+'s'+SEED;
  if(cache[key]!=null)return cache[key];
  const env=Object.assign({},process.env,{RELICS:relics||'',ASC,SEED});
  const out=execSync('node '+path.join(__dirname,'sim.js')+' '+n,{env,encoding:'utf8',maxBuffer:1<<24});
  const m=out.match(/平均推进 ([\d.]+)/);
  const v=m?+m[1]:NaN;
  cache[key]=v;save();
  return v;
}

const ALL=G.RELICS.map(r=>r.id);
const NAME=id=>{const r=G.RELICS.find(x=>x.id===id);return r?r.name:id;};

console.log('遗物扫描 · 模式='+MODE+' 每组'+N+'局 · 共'+ALL.length+'件遗物');
const base=wr('',N);
console.log('基线(无强制遗物) 推进力 '+base.toFixed(2)+'\n');

if(MODE==='single'){
  const rows=[];
  ALL.forEach((id,i)=>{
    const v=wr(id,N);
    rows.push({id,name:NAME(id),wr:v,lift:v-base});
    process.stderr.write(`  [${i+1}/${ALL.length}] ${NAME(id)} ${v.toFixed(2)}\n`);
  });
  rows.sort((a,b)=>b.lift-a.lift);
  const lifts=rows.map(r=>r.lift), mean=lifts.reduce((a,b)=>a+b,0)/lifts.length;
  const sd=Math.sqrt(lifts.reduce((a,b)=>a+(b-mean)*(b-mean),0)/lifts.length)||1;
  console.log('单件强度排行(lift = 该遗物通关率 − 基线;z = 偏离均值几个标准差)');
  console.log('均值 lift '+mean.toFixed(1)+'pp  标准差 '+sd.toFixed(1)+'pp\n');
  console.log('遗物'.padEnd(14)+'通关率'.padEnd(10)+'lift'.padEnd(10)+'z');
  rows.forEach(r=>{const z=(r.lift-mean)/sd;
    const flag=z>=2?'  ⚠超模':z<=-2?'  ⚠废件':'';
    console.log(r.name.padEnd(16)+(r.wr.toFixed(2)).padEnd(11)+(r.lift>=0?'+':'')+r.lift.toFixed(1)+'节点'.padEnd(6)+z.toFixed(2)+flag);});
}

if(MODE==='pair'){
  const singles=ALL.map(id=>({id,name:NAME(id),wr:wr(id,N)})).sort((a,b)=>b.wr-a.wr);
  const top=singles.slice(0,TOPK);
  console.log('参与组合测试的 '+TOPK+' 件:'+top.map(t=>t.name).join('、')+'\n');
  const rows=[];
  for(let i=0;i<top.length;i++)for(let j=i+1;j<top.length;j++){
    const A=top[i],B=top[j];
    const v=wr(A.id+','+B.id,N);
    const syn=v-A.wr-B.wr+base;   // 交互项
    rows.push({a:A.name,b:B.name,wr:v,syn});
    process.stderr.write(`  ${A.name}+${B.name} ${v.toFixed(2)} syn=${syn.toFixed(1)}\n`);
  }
  rows.sort((a,b)=>b.syn-a.syn);
  console.log('组合协同排行(syn>0 = 1+1>2,可能是退化组合)\n');
  console.log('组合'.padEnd(26)+'通关率'.padEnd(10)+'协同');
  rows.forEach(r=>console.log((r.a+' + '+r.b).padEnd(28)+(r.wr.toFixed(2)).padEnd(11)+(r.syn>=0?'+':'')+r.syn.toFixed(1)+'节点'+(r.syn>=8?'  ⚠':'')));
}
