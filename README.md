# 纹兽战记

战棋 SRPG × Roguelike × 怪物收集培育。项目目前有**三条并行的线**:

| 线 | 位置 | 状态 |
|---|---|---|
| **网页版游戏**(功能最完整,规则的事实权威) | `index.html` + `css/` + `js/` | 可玩,持续迭代中(见 `CHANGELOG.md`) |
| **无头平衡模拟台**(所有数值/平衡结论的来源) | `balance/` | 可用,`node balance/sim.js` |
| **UE5 移植**(当前主线工作) | UE 工程在仓库外,状态文档在本仓库 | 垂直切片阶段,规则集是 web 版的子集 |

> 新接手(人或 AI)请先读 `项目工作指南.md`——它是全仓库的索引。
> 做 UE 相关的任何事之前,`CLAUDE.md` 规定必须先读 `UE协作Harness规范.md`。

---

## 一、网页版游戏

### 运行

双击 `index.html`,浏览器打开即可。**无需服务器、无需构建工具、无依赖安装。**

占位精灵图从 PokeAPI 公开 CDN 实时加载,联网显示图片、离线回退 emoji。

> ⚠️ 图片为开发占位用途,正式发布前需替换为原创怪物美术。

### 目录结构

```
index.html              页面骨架(DOM + 弹窗) + 按依赖顺序引入脚本
css/style.css           全部样式
js/
  data/                 纯数据(改数值/内容动这里)
    config.js           网格/地图/成长曲线/难度旋钮(DEF_K, ENEMY_POWER, ZOC_ON…)
    types.js            18 属性克制表 CHART + 颜色/中文 + typeMult()
    skills.js           招数 SKILLS + 各属性学习表 LEARN + 抽招池 DRAFT_POOL
    creatures.js        我方池 POOL / 野怪 WILD / 精英 / 三章 Boss / 进化线 EVO / 伊布形态
    relics.js           遗物 RELICS(效果是 JS 钩子函数)
    items.js            持有道具 HELD_ITEMS
    story.js            剧情文本与过场配置
    combat_tables.js    ⚠️ 给 UE 用的「纯数值」展平表(见第三节),不是 web 运行时数据
    export_ue_csv.js    由 combat_tables.js 生成 UE DataTable CSV(Node 脚本)
  core/                 核心逻辑(改手感/规则动这里)
    state.js            全局状态 + 工具(log/show/delay/常量)
    units.js            单位工厂 + 网格查询
    combat.js           ★ 伤害/命中/暴击/二段/击退/状态/反击/经验/进化/收服/阵亡
    relics.js           遗物钩子的聚合层(relicDmgMult / relicHitAdd / …)
    ai.js               敌方 AI(选招/选目标/寻路,贪心)
    turn.js             速度交错行动引擎
    run.js              单局:地图生成、节点推进、事件、商店、休整
    battle.js           开战、生成敌人、胜负结算与章节推进
    save.js             localStorage 存档 + 「重来本关」快照
    meta.js             跨局 Meta 进度
    rules.js            ⚠️ 纯规则层,当前**未被本页面加载**,见第四节
  ui/                   界面(改外观动这里)
    board.js            棋盘渲染、动画、范围、点击选择
    panels.js           信息栏、技能栏、行动按钮、进化、战斗预测面板
    mapview.js          章节地图渲染
    deploy.js           部署界面(3 自选 + 随机)
    overlays.js         属性克制表弹窗
    autoplay.js         自动演示
    agent_api.js        Agent 桥:window.snapshot() / window.act(),供自动试玩驱动
    vfx.js / sfx.js / music.js / menumusic.js / cutscene.js / ux.js
  main.js               启动 + 所有静态元素的事件绑定
```

采用经典 `<script>` 标签 + 共享全局作用域(无打包),脚本在 `index.html` 末尾按依赖顺序加载。

### 分层约定

依赖单向向下:`ui → core → data`。

- 调**数值/难度** → 只动 `js/data/`(尤其 `config.js`)
- 调**战斗手感/规则** → 动 `js/core/combat.js`、`js/core/turn.js`
- 调**外观** → 动 `css/style.css` 与 `js/ui/`

> ⚠️ 这个约定目前有已知违反:`CRITX` / `DOUBLE_GAP` / `FOREST_AVO` 三个战斗常量放在 `js/core/state.js` 而不是 `data/`,导致平衡台取不到、只能硬编码。详见 `工程评估报告.md` P0-2。

### 已实现的玩法

- 宝可梦式 **18 属性克制**(×2 / ×0.5 / ×0 免疫),普通攻击 = 普通系
- 命中 / 暴击 / 二段攻击 + 火纹式**战斗预测面板** + **反击**(被夹击时无法反击)
- **速度交错行动**(敌我按速度混排逐单位行动)
- **地形**:森林(掩体 +回避)、高地(+25% 伤害、无视遮挡)、岩浆(每回合灼伤)、水(不可进入 / 击退落水处决)
- **位置经济学**:ZOC 借机攻击、夹击加伤、视线遮挡(远程穿过森林或单位时命中/伤害惩罚)
- **异常状态**:灼烧 / 中毒(层数) / 麻痹
- **护盾**(有上限,盾击类技能出手即消耗)、蓄力、换位、脱战回复
- **精灵池 = 牌库**:3 自选 + 随机补满;等级/经验/进化跨战保留;阵亡永久出池、收服入池
- **三章地图**(战斗 / 精英 / 事件 / 休整 / 商店 / Boss),Boss 依次 暴鲤龙 → 快龙 → 超梦
- **遗物系统**(30+ 种,含诅咒)、**持有道具**、**金币与商店**、**跨局 Meta 进度**、**Ascension 难度阶梯**
- 音效 / BGM / 过场视频 / 剧情文本

---

## 二、平衡模拟台 `balance/`

无头 Node 模拟器,**所有平衡结论的来源**。它从 `js/data/*.js` 直接读取游戏真实数据(`loadData.js`),保证数值不漂移。

```bash
node balance/sim.js 500                      # 跑 500 局,输出通关率/异常指标
SEED=42 PROFILE=human node balance/sim.js 500 # 固定随机种子(结论可复现,必用)
node balance/difftest.js 50000               # ★ 三份规则实现对拍,改战斗代码后必跑
node balance/scan.js                         # 参数扫描
node balance/arena.js                        # 基于 rules.js 的搜索型 AI 对局
node balance/debug_one.js                    # 单局逐回合 trace
```

| 文件 | 作用 |
|---|---|
| `sim.js` | 主模拟器(自带一份战斗实现,见第四节) |
| `difftest.js` | **对拍**:验证 combat.js / rules.js / sim.js 三份实现的核心公式一致 |
| `loadData.js` | 从 `js/data/*.js` 抽取常量与函数,供 Node 侧使用 |
| `arena.js` / `agents.js` | 基于 `rules.js` 的搜索型 AI 与策略对比 |
| `scan.js` / `debug_one.js` | 参数扫描 / 单局调试 |
| `SKILL.md` | `wenshou-balance` 技能说明(调平衡走这个流程) |

> ⚠️ **统计功效**:同配置 N=120 重复跑,通关率极差可达 15.8pp。差异 <10pp 的 A/B 结论都在噪声内。**定种子 + 加大 N 是唯一解**,详见 `sim.js` 顶部注释。

---

## 三、UE5 移植

UE 工程本体在仓库外(`Documents/Unreal Projects/`),本仓库只维护**状态文档**。做任何 UE 相关工作前:

1. **必读** `UE协作Harness规范.md`(协作协议本身)
2. **必读** `UE蓝图状态.md`(每个蓝图有什么变量/函数/怎么连的)+ `UE节点备忘录.md`(85 条已踩过的坑)
3. 验收清单在 `UE测试用例.md`
4. 加动画 / 换模型走 `ue-add-animation/SKILL.md`;美术管线看 `UE美术管线.md`

改动流程是硬性的:**改 → 编译 → 验证 → 写文档 → 下一步**。`.claude/hooks/` 里配了 Stop hook 强制执行(`compile_blueprint` 后没同步文档就不许结束这一轮)。

### 数据流:web → UE

```
js/data/combat_tables.js   ← 手工维护的「纯数值」展平表(技能倍率/命中/遗物固定加成)
        ↓  node js/data/export_ue_csv.js
js/data/ue_import/*.csv    ← 仓库内备份
UE Saved/Import/*.csv      ← UE 导入目录(路径当前硬编码在脚本里)
        ↓  UE 编辑器导入
DT_Skills / DT_Relics      ← UE DataTable 资产
```

> ⚠️ CSV 与 DataTable **不会自动同步**。历史上有过直接用 MCP 写 DataTable、只把 CSV 当备份的做法——改任一边都要手动同步另一边。

### ⚠️ UE 版不是 web 版的完整移植

UE 切片当前**只实现了 web 规则的一个子集**:有防御折减公式、技能倍率、命中掷骰、反击、AOE;**没有**暴击、二段、护盾、地形、视线、夹击、ZOC、异常状态、击退,属性克制只有 4 属性三角且当前关闭。

而且有几处行为**与 web 不一致**(比如 UE 的 AOE 会让每个目标各反击一次,web 的 AOE 不引反击)。

完整对照表与建议见 `工程评估报告.md` 第三节 P0-3。

---

## 四、⚠️ 已知的最大结构问题:战斗规则有四份实现

同一套战斗规则目前存在四份独立实现:

| 实现 | 服务对象 | 谁在用 |
|---|---|---|
| `js/core/combat.js` | 真实游玩 | `index.html` —— **事实上的权威** |
| `js/core/rules.js` | 搜索 / RL | 只有 `balance/arena.js`、`debug_one.js`;**未被 index.html 加载** |
| `balance/sim.js` | 平衡结论 | `sim.js` / `scan.js` / `agents.js` |
| UE 蓝图 | UE 版游戏 | UE 工程 |

它们**覆盖的规则子集并不相同**(例如 `rules.js` 完全没有 ZOC、夹击豁免、脱战回复、蓄力)。`balance/difftest.js` 能对拍其中三份,但只覆盖 4 个纯函数、且把遗物桩成中性。

**改动任何一份战斗实现后,请务必:**

```bash
node balance/difftest.js 50000
```

完整分析、影响面与收敛方案见 **`工程评估报告.md`**(P0-1)。

---

## 五、文档索引

| 想做什么 | 先读 |
|---|---|
| 搞清楚仓库里都有什么 | `项目工作指南.md` |
| 了解工程现状与待办 | **`工程评估报告.md`** |
| 网页游戏改了什么 | `CHANGELOG.md` |
| 调数值 / 平衡 | `balance/SKILL.md` → `js/data/config.js` |
| 自动试玩评测 | `autoplay-review/SKILL.md` |
| UE 蓝图开发 | `UE协作Harness规范.md`(必读)→ `UE蓝图状态.md` → `UE节点备忘录.md` |
| 玩法/剧情/数值设计背景 | `玩法扩充清单.md`、`剧情大纲.md`、`流派表.md`、`遗物事件一览.md`、`属性克制配置.md` |
| 深度与趣味的量化方法论 | `研究综述_深度与趣味的衡量.md`、`loop工程_恶意与趣味指标.md`、`恶意设计方案.md` |
