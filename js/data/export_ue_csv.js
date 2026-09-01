// 从 combat_tables.js 生成 UE DataTable 用的 CSV（UTF-8）。
// 列名必须和 C++ FSkillRow / FRelicRow 的 UPROPERTY 名字一致。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'combat_tables.js'), 'utf8');
vm.runInThisContext(src, { filename: 'combat_tables.js' });

// kind(atk / aoe / heal)只存在于 js/data/skills.js —— 直接从那个真相源现查,
// 不在 combat_tables.js 里再抄一份。UE 侧的 IsAoeSkill 以前是硬编码四个字符串比较,
// 加第 5 个 AOE 技能就得改蓝图;有了 Kind 列之后可以改成读表。
const skillsSrc = fs.readFileSync(path.join(__dirname, 'skills.js'), 'utf8');
vm.runInThisContext(skillsSrc, { filename: 'skills.js' });

function kindOf(id) {
  const s = SKILLS[id];
  if (!s) throw new Error(`combat_tables.js 里的技能 "${id}" 在 skills.js 里不存在,无法确定 kind`);
  if (!s.kind) throw new Error(`skills.js 的 "${id}" 没有 kind 字段`);
  return s.kind;
}

const skillNow = new Set(UE_IMPLEMENT_NOW.skills);
const relicNow = new Set(UE_IMPLEMENT_NOW.relics);

function csvEscape(v) {
  const s = v === undefined || v === null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function bool(v) { return v ? 'True' : 'False'; }

const skillHeader = ['---','DisplayName','Kind','Mult','Hit','Crit','RangeBonus','TypeId','TypeName','InflictKind','InflictChance','bUseInflictInSlice','UePhase','bEnabledInSlice'];
const skillLines = [skillHeader.join(',')];
for (const s of NUMERIC_SKILLS) {
  skillLines.push([
    s.id, csvEscape(s.name), kindOf(s.id), s.mult, s.hit, s.crit || 0, s.rb || 0, s.typeId,
    s.type || '', s.inflictKind || '', s.inflictChance || 0,
    bool(!!s.bUseInflictInSlice), s.uePhase, bool(skillNow.has(s.id))
  ].join(','));
}

const relicHeader = ['---','DisplayName','Arch','bCurse','AtkAdd','DefAdd','SpdAdd','MaxHpAdd','LckAdd','ShieldAdd','MaxHpPct','HitAdd','CritAdd','DmgMult','DmgTakenMult','Thorns','HitFix','CapAdd','ExpMult','Cond','EffectKind','UePhase','bAlreadyInUE','bEnabledInSlice'];
const relicLines = [relicHeader.join(',')];
for (const r of NUMERIC_RELICS) {
  relicLines.push([
    r.id, csvEscape(r.name), r.arch || '', bool(!!r.curse),
    r.atkAdd || 0, r.defAdd || 0, r.spdAdd || 0, r.maxhpAdd || 0, r.lckAdd || 0, r.shieldAdd || 0,
    r.maxhpPct || 0, r.hitAdd || 0, r.critAdd || 0,
    r.dmgMult == null ? 1 : r.dmgMult,
    r.dmgTakenMult == null ? 1 : r.dmgTakenMult,
    r.thorns || 0, r.hitFix || 0, r.capAdd || 0, r.expMult == null ? 1 : r.expMult,
    csvEscape(r.cond || ''), r.effectKind || '', r.uePhase,
    bool(!!r.alreadyInUE), bool(relicNow.has(r.id))
  ].join(','));
}

const skillCsv = '\uFEFF' + skillLines.join('\n') + '\n';
const relicCsv = '\uFEFF' + relicLines.join('\n') + '\n';

// 仓库内副本:永远写,是 git 里可 review 的那一份
const webImport = path.join(__dirname, 'ue_import');
fs.mkdirSync(webImport, { recursive: true });
fs.writeFileSync(path.join(webImport, 'DT_Skills.csv'), skillCsv);
fs.writeFileSync(path.join(webImport, 'DT_Relics.csv'), relicCsv);
console.log('wrote', NUMERIC_SKILLS.length, 'skills,', NUMERIC_RELICS.length, 'relics ->', webImport);

// UE 工程的导入目录:路径因机器/工程名而异,用环境变量指定,不再硬编码。
// 以前这里写死 'C:/Users/AI_Work/Documents/Unreal Projects/MyProject 5.8/Saved/Import',
// 换机器或改工程名就失效,而且失败模式是「mkdirSync(recursive) 静默把错路径建出来、
// 文件写进一个 UE 永远不会读的空目录」——不报错,最难发现。
const ueImport = process.env.UE_IMPORT_DIR;
if (!ueImport) {
  console.log('\n跳过 UE 导入目录(未设 UE_IMPORT_DIR)。要同时写进 UE 工程:');
  console.log('  UE_IMPORT_DIR="<你的工程>/Saved/Import" node js/data/export_ue_csv.js');
} else if (!fs.existsSync(ueImport)) {
  console.error(`\n错误:UE_IMPORT_DIR 指向的目录不存在:${ueImport}`);
  console.error('请检查路径(不自动创建——自动创建会把文件写进 UE 读不到的地方)。');
  process.exit(1);
} else {
  fs.writeFileSync(path.join(ueImport, 'DT_Skills.csv'), skillCsv);
  fs.writeFileSync(path.join(ueImport, 'DT_Relics.csv'), relicCsv);
  console.log('也写入 UE 导入目录 ->', ueImport);
}

// ⚠ 写完 CSV 不等于 UE 里的 DataTable 更新了——还要在 UE 编辑器里重新导入一次。
console.log('\n⚠ 记得在 UE 编辑器里重新导入 DT_Skills / DT_Relics,CSV 和 DataTable 资产不会自动同步。');
