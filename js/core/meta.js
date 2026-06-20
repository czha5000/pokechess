// Meta 跨局进度:魂晶货币(独立 localStorage,跨整局持久) + 开局 hub 解锁
let meta={shards:0, relics:[], startLv:1, equipRelic:null};
const META_KEY='wenshou_meta';
const META_RELICS=[ // 可解锁为"起始遗物"的项及其魂晶价格
 {id:'power_band',cost:30},{id:'swift_boots',cost:30},{id:'exp_necklace',cost:40},
 {id:'tamer_flute',cost:50},{id:'elem_core',cost:60}
];
const META_LV_COST={1:50,2:120}; // 起始等级 1→2 / 2→3 的价格

function loadMeta(){try{const s=localStorage.getItem(META_KEY);if(s)meta=Object.assign(meta,JSON.parse(s));}catch(e){}}
function saveMeta(){try{localStorage.setItem(META_KEY,JSON.stringify(meta));}catch(e){}}

function unlockRelic(id){const u=META_RELICS.find(x=>x.id===id);if(!u||meta.relics.includes(id))return;
  if(meta.shards<u.cost){alert('魂晶不足');return;}meta.shards-=u.cost;meta.relics.push(id);if(!meta.equipRelic)meta.equipRelic=id;saveMeta();renderHub();}
function buyStartLv(){if(meta.startLv>=3)return;const c=META_LV_COST[meta.startLv];if(meta.shards<c){alert('魂晶不足');return;}meta.shards-=c;meta.startLv++;saveMeta();renderHub();}

// 把精灵池条目提升到目标等级(应用逐级成长,起始等级≤3 不触发进化)
function metaBumpEntry(m,target){while(m.lv<target){m.lv++;m.maxhp+=3;m.atk+=1;m.def+=1;m.skl+=1;if(m.lv%2===0)m.spd+=1;
  const key=m.hero?'normal':m.key;const sk=(LEARN[key]||['basic'])[m.lv-1];if(sk&&!m.skills.includes(sk)&&!m.hero)m.skills.push(sk);}}
function applyMetaToRun(){
  if(meta.startLv>1)run.pool.forEach(m=>metaBumpEntry(m,meta.startLv));
  if(meta.equipRelic){const r=RELICS.find(x=>x.id===meta.equipRelic);if(r&&!run.relics.some(z=>z.id===r.id))run.relics.push(r);}}
function awardShards(win){const earned=(run.chapter-1)*20+(win?60:10)+run.pool.length*2;meta.shards+=earned;saveMeta();return earned;}

// 开局界面的 Meta 面板
function renderHub(){const el=document.getElementById('metaPanel');if(!el)return;
  let h=`<div style="background:#141b2b;border:1px solid #3a4360;border-radius:8px;padding:10px;margin:8px 0;font-size:13px;text-align:left">`;
  h+=`<div style="font-weight:700;color:var(--accent)">✦ Meta 进度　魂晶 💎 ${meta.shards}</div>`;
  h+=`<div style="margin-top:6px">起始等级 <b>Lv.${meta.startLv}</b> ${meta.startLv<3?`<button class="btn" data-buy="lv">升级(💎${META_LV_COST[meta.startLv]})</button>`:'（已满）'}</div>`;
  h+=`<div style="margin-top:6px">起始遗物：</div><div class="row">`;
  META_RELICS.forEach(u=>{const owned=meta.relics.includes(u.id);const r=RELICS.find(x=>x.id===u.id);
    h+=owned?`<span class="ochip ${meta.equipRelic===u.id?'cur':'ally'}" style="cursor:pointer" data-equip="${u.id}">${meta.equipRelic===u.id?'✅':''}${r.icon}${r.name}</span>`
            :`<button class="btn ghost" data-unlock="${u.id}">🔒${r.icon}${r.name}(💎${u.cost})</button>`;});
  h+=`</div>`;
  if(meta.relics.length)h+=`<div class="small">点已解锁遗物 = 选为本局起始(再点取消)。当前：${meta.equipRelic?RELICS.find(r=>r.id===meta.equipRelic).icon+RELICS.find(r=>r.id===meta.equipRelic).name:'无'}</div>`;
  h+=`</div>`;el.innerHTML=h;
  el.querySelectorAll('[data-unlock]').forEach(b=>b.onclick=()=>unlockRelic(b.dataset.unlock));
  el.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>{meta.equipRelic=(meta.equipRelic===b.dataset.equip)?null:b.dataset.equip;saveMeta();renderHub();});
  const lvb=el.querySelector('[data-buy="lv"]');if(lvb)lvb.onclick=buyStartLv;}
