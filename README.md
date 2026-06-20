# 纹兽战记 · 重构版

战棋 SRPG × Roguelike × 怪物收集培育 的原型。由单文件 `纹兽战记_demo_v0.8.html` 重构为多文件结构，**直接双击 `index.html` 即可运行**（无需服务器/构建工具）。

## 运行

双击 `index.html`，用浏览器打开即可。占位精灵图从 PokeAPI 公开 CDN 实时加载，联网时显示图片、离线时回退为 emoji。

> 注意：图片为开发占位用途，正式发布前需替换为原创怪物美术。

## 目录结构

```
index.html              页面骨架(DOM + 弹窗) + 按依赖顺序引入脚本
css/style.css           全部样式
js/
  data/                 纯数据(改数值/内容动这里)
    config.js           网格/地形/成长曲线/难度旋钮(ENEMY_POWER, BOSS_HP…)
    types.js            18属性克制表 CHART + 颜色/中文 + typeMult()
    skills.js           招数 SKILLS + 各属性学习表 LEARN
    creatures.js        我方池 POOL / 野怪 WILD / 精英 / 三章Boss / 进化线 EVO / 伊布形态
  core/                 核心逻辑(改手感/规则动这里)
    state.js            全局状态 + 工具(log/show/delay/常量)
    units.js            单位工厂 + 网格查询
    combat.js           伤害/命中/暴击/二段、经验、进化、攻击、收服、阵亡
    ai.js               敌方 AI(选招/选目标/寻路)
    turn.js             速度交错行动引擎
    run.js              单局:地图生成、节点推进、事件、休整
    battle.js           开战、生成敌人、胜负结算与章节推进
  ui/                   界面(改外观动这里)
    board.js            棋盘渲染、动画、范围、点击选择
    panels.js           信息栏、技能栏、行动按钮、进化、战斗预测面板
    mapview.js          章节地图渲染
    deploy.js           部署界面(3自选+随机)
    overlays.js         属性克制表弹窗
  main.js               启动 + 所有静态元素的事件绑定
```

## 设计分层

依赖单向向下：`ui → core → data`。
- 调**数值/难度**：只动 `data/`（尤其 `config.js` 的 `ENEMY_POWER`/`BOSS_HP`/`CH_SCALE`/`THRESH`/`STAGE_LV`）。
- 调**战斗手感/规则**：动 `core/combat.js`、`core/turn.js`。
- 调**外观**：动 `css/style.css` 与 `ui/`。

采用经典 `<script>` 标签 + 共享全局作用域（无打包），脚本在 `index.html` 末尾按依赖顺序加载。

## 当前版本要点(承接 v0.8)

- 宝可梦式 18 属性克制(×2 / ×0.5 / ×0 免疫)，普通攻击=普通系(幽灵免疫)。
- 命中/暴击/二段攻击 + 火纹式战斗预测面板。
- 速度交错行动(敌我按速度混排逐单位行动)。
- 精灵池=牌库：3自选+随机补满；等级/经验/进化跨战保留；阵亡永久出池、收服入池。
- 三章地图(战斗/精英/事件/休整/Boss)，Boss 依次 暴鲤龙 → 快龙 → 超梦。
- 平衡经 100 轮模拟校准(评测 AI 通关率约 84%)。

## 后续可加(尚未实现)

遗物系统、Meta 跨局进度、更多怪物/进化、音效。
