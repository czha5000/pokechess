// 从 combat_tables.js 生成 UE DataTable 用的 CSV（UTF-8）。
// 列名必须和 C++ FSkillRow / FRelicRow 的 UPROPERTY 名字一致。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'combat_tables.js'), 'utf8');
vm.runInThisContext(src, { filename: 'combat_tables.js' });

const skillNow = new Set(UE_IMPLEMENT_NOW.skills);
const relicNow = new Set(UE_IMPLEMENT_NOW.relics);

function csvEscape(v) {
  const s = v === undefined || v === null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function bool(v) { return v ? 'True' : 'False'; }

const skillHeader = ['---','DisplayName','Mult','Hit','Crit','RangeBonus','TypeId','TypeName','InflictKind','InflictChance','bUseInflictInSlice','UePhase','bEnabledInSlice'];
const skillLines = [skillHeader.join(',')];
for (const s of NUMERIC_SKILLS) {
  skillLines.push([
    s.id, csvEscape(s.name), s.mult, s.hit, s.crit || 0, s.rb || 0, s.typeId,
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

const ueImport = 'C:/Users/AI_Work/Documents/Unreal Projects/MyProject 5.8/Saved/Import';
const webImport = path.join(__dirname, 'ue_import');
fs.mkdirSync(ueImport, { recursive: true });
fs.mkdirSync(webImport, { recursive: true });
fs.writeFileSync(path.join(ueImport, 'DT_Skills.csv'), skillCsv);
fs.writeFileSync(path.join(ueImport, 'DT_Relics.csv'), relicCsv);
fs.writeFileSync(path.join(webImport, 'DT_Skills.csv'), skillCsv);
fs.writeFileSync(path.join(webImport, 'DT_Relics.csv'), relicCsv);
console.log('wrote', NUMERIC_SKILLS.length, 'skills,', NUMERIC_RELICS.length, 'relics');
