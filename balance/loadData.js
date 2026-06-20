// 读取游戏真实数据文件(js/data/*.js),抽取其中的常量/函数,保证模拟器与游戏数值永不漂移。
// 数据文件用 `const X=...` 声明(浏览器全局风格),这里用 new Function 包一层把它们取出来。
const fs=require('fs'), path=require('path');
function loadGameData(dataDir){
  dataDir=dataDir||path.join(__dirname,'..','js','data');
  const files=['config.js','types.js','skills.js','creatures.js','relics.js'];
  const code=files.map(f=>fs.readFileSync(path.join(dataDir,f),'utf8')).join('\n');
  const names=['COLS','ROWS','TERRAIN','PSTART','ESLOTS','MAXLV','THRESH','STAGE_LV','EVO_BONUS',
    'ENEMY_POWER','BOSS_HP','CH_SCALE','STATUS','ASC_MAX','ascEnemyMul','ascBossMul','ascRestHeal','SPRITE','TYPE_CN','TCOLOR','CHART','typeMult','ACTIVE_TYPES',
    'SKILLS','LEARN','POOL','EVO','EEVEE_FORMS','WILD','ELITE','CH_BOSS','CH_NAME','NICON','NNAME','RELICS'];
  // eslint-disable-next-line no-new-func
  return new Function(code+'\n;return {'+names.join(',')+'};')();
}
module.exports={loadGameData};
