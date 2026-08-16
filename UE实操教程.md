# 纹兽战记 → UE5 实操教程(垂直切片:到"一场能打的战斗")

> 目标里程碑:在 UE 里跑通**一场 2v2 能分胜负的战斗**。全程蓝图、2.5D 固定相机。
> 逻辑/数值/克制表都从 web 版 `js/data/*` 带走,只重写代码。

---

## 📍 续接区(开新对话先看这里)
- **怎么续**:新对话里把本文件或 `UE学习笔记.md` 发给我,或说「继续UE」。我读续接区+笔记就知道进度。
- **当前进度(2026-08-15 更新):垂直切片 7 步全部完成 ✅**——一场 2v2 已经能从头打到分胜负,实测截图确认过 DEFEAT 弹窗、血条、敌方 AI、行动顺序条都在正常工作:
  - M0/M1/M2 ✅,移动范围 A–D ✅
  - 3. 多单位+敌我(含点击过滤)✅,**这轮又加固**:只有轮到的单位能点、攻击命中后自动结束回合(移动不算行动)
  - 4. 行动序 ✅,**这轮升级**:不再是生成顺序,换成真 `Spd` 降序排序 + 同速随机 tiebreak(`BP_TurnManager.BuildTurnOrder`,每回合重排),配了行动顺序条 UI(`WBP_OrderBar`,头像先用 Spd 数字代替,hover 显示单位名+速度)
  - 5. 攻击+伤害公式 ✅**这轮补完**:占位版 `max(0,Atk-Def)` 换成 `max(1, round(Atk×DEF_K/(DEF_K+Def)))`(`DEF_K=9`),不含技能倍率/属性克制/命中率/暴击/掩体/地形/遗物——这些明确留到切片之后
  - 6. 血条+死亡+胜负 ✅,7. 敌方简单 AI ✅
- **切片完成不等于"和 web 版数值对齐"**——已知简化明确留到切片后再补:曼哈顿距离寻路(非 BFS,不绕障碍物)、18 属性克制表(DataTable 展平)、技能倍率/命中率/暴击/掩体/地形/侧翼/遗物等乘算项、真正的角色头像(目前没有美术素材,UI 上先用 Spd 数字+颜色区分敌我)。
- **2026-08-16 用户连续两轮 Play 实测反馈,追加五处修正**(全部 MCP 侧回归测试 11 条断言重跑 PASS,均**待人工 Play 验收**):
  1. 一回合只能移动一次(此前无限制,`MoveRange` 形同虚设)——新增 `BP_Unit.bHasMoved` 标记,`StartTurn`/`ActorOnClicked`/`BP_Tile.ActorOnClicked` 三处协同。
  2. 攻击范围红色高亮语义改成"移动范围的最外围能打多远"(`MoveRange+AtkRange`),不再是"当下位置的 `AtkRange`"。
  3. 移动范围和攻击范围重合时优先显示移动范围(黄)——红色只覆盖移动范围**外**、总范围**内**的环形区域,不再整体盖住黄色。
  4. **新增行动菜单**:移动后弹出"攻击/待命/撤销"三选一 Widget(`WBP_ActionMenu`,项目第一个带交互按钮的 UI),解决"移动完不攻击就没法结束回合"的问题;"撤销"能把位置和移动状态整个回退到本回合开始时。
  5. 行动菜单按钮的可点击性依赖 `SetInputModeGameAndUI` 输入模式切换,这是本轮**最大的不确定项**——项目一直靠纯 Game 模式做 3D 点击,这是第一次加交互 UMG 控件,没有先例验证过切换是否真的生效。
  细节见 `UE蓝图状态.md` 已知问题9、`ShowAttackRange` v3/v4、"行动菜单系统"整节;踩坑记录见 `UE节点备忘录.md` 坑11-19。
- **2026-08-16 第三轮反馈,先写火纹对照再修**:用户报了行动菜单的三个具体问题(撤销后不能再行动/点攻击点敌人没反应/移动后攻击范围消失),但要求先写一份"火焰纹章 vs 我们"的移动攻击系统对照、approve 后再动手——对照见对话记录,核心结论是"移动后应该还能看到能打哪、菜单不该挡住这个信息"。approve 后排查:
  - **根因已定位并修复**:`BP_Tile.ActorOnClicked` 移动收尾里有一条行动菜单系统上线前的老代码 `SetSelectedUnit(None)`,时机不对——移动完清空了 `GridManager.SelectedUnit`,导致"攻击"按钮之后点敌人时 `TryAttack` 读到的是 `None`(静默跳过,不掉血不报错),`BP_Unit.ActorOnClicked` 又把这个 `None` 误判成"已命中"直接结束回合。已删除,清空逻辑改到 `StandbyAction()`(真正操作序列结束的时机)。
  - **顺带实现**:新增 `BP_GridManager.ShowAttackRangeCurrent()`,移动落地后立刻围绕新位置画一圈纯 `AtkRange` 红色高亮(不再是移动前那种 `MoveRange+AtkRange` 的"最远预览"语义),解决"移动后仍要显示攻击范围"。
  - **"撤销后不能再行动"这条本轮没有直接修**:`UndoAction` 本身不碰 `SelectedUnit`,理论上不受这次根因影响,重新点自己单位只依赖 `bHasMoved`(已重置)和轮次判断——如果人工验收后依旧复现,大概率是独立的输入路由问题(坑19),需要下一轮单独排查,不要假设已经顺带修好。
  - 11 条自动回归断言重跑全 PASS。详见 `UE蓝图状态.md`"根因修复"一节、`UE节点备忘录.md` 坑20/21、`UE测试用例.md`"行动菜单"一节。**待人工 Play 重新验收上述三条。**
- **2026-08-16 用户反馈"基本OK,下一步做技能和relic"**:web 版原始技能/遗物系统规模很大(40+ 技能、30+ 遗物、18 属性克制表、roguelike 三选一 UI),用 `AskUserQuestion` 让用户选定第一版范围——**最小闭环**:每个单位固定 2 个技能(不做学习/选择系统)、命中率+四选一属性克制(Fire/Water/Grass 三角+Normal中立)这套运算链路跑通、2 个硬编码的纯数值遗物(不做三选一奖励界面)。已实现并验收:
  - `BP_Unit.AtkType`(此前占位未使用)正式启用为元素属性;`BP_GridManager` 新增 `GetTypeMultiplier_0`(属性克制表)、`ComputeSkillDamage`(选技能+掷命中骰+算克制+算伤害,只吃纯 Int/Bool 参数规避跨类取值坑)、`ApplyStartingRelics`(战斗开始给我方 Atk/Def 各 +2);`TryAttack` 新增 `bUseSkill2` 参数,旧调用点(`RunEnemyTurn`)不改动即用默认值 false,保持敌方 AI 只用普攻的简化。
  - `WBP_ActionMenu` 从 3 按钮扩到 4 个:"攻击"拆成"普通攻击"/"元素技能",各自把选择写进 `BP_TurnManager.PendingSkillIsElemental` 再隐藏菜单。
  - **本轮踩了两个新坑,价值较高**:①`create_node` 建"调用另一个蓝图自定义函数"的节点,必须用 `Class|<类名>|<函数名>` 前缀 + `declaring_class`,`CallFunction|` 前缀只对自身蓝图内部函数有效(哪怕 `find_node_types` 精确搜出来的就是 `CallFunction|` 形式,一样建不出来);②给新 Function 写含 `(return X)` 的函数体之前,必须先 `add_function_param(input_param=false)` 显式声明输出参数,否则编译不报错但函数其实是 void——第一版 `GetTypeMultiplier` 就踩了这个,靠 `find_nodes` 主动核实"有没有 `K2Node_FunctionResult` 节点"才发现。详见 `UE节点备忘录.md` 坑22-24。
  - 11 条自动回归断言全 PASS,实测日志确认 `HIT dmg=6` 和公式手算吻合。**待人工 Play 验收**:菜单两个技能按钮、克制/反克制的伤害差异、命中率偶尔 MISS、遗物生效后属性变化,见 `UE测试用例.md`"技能与遗物"一节。
- **下一步方向待定**:切片已完成,下一阶段是"补真实度"(数值对表)还是"扩内容"(更多单位/关卡)需要和用户对齐后再定,不要自己假设方向。
- **协作方式(harness)**:完整协议见 `UE协作Harness规范.md`——**任何新会话接手前先读那份**。简述:`UE蓝图状态.md`(变量/函数/GUID快照)、`UE节点备忘录.md`(踩坑记录+验证过的函数名)、`UE测试用例.md`(验收清单),三份配套文档每次改动后同步更新;复杂逻辑做成独立 Function 整体替换,不在 EventGraph 里打补丁;默认只要新增节点+邻居回传,不要整图。

---

## 通用概念(处处要用)
- **白色执行线**=顺序(谁先跑);**彩色数据线**=数值(不决定顺序)。"A 之后才做 B"必须连白线。
- **三大角色**:Pawn=被操控的身体 / PlayerController=输入 / GameMode=规则总管。
- Actor=能放进关卡的东西;组件=Actor 身上的零件(如 Static Mesh)。
- 每次改完:**Compile → Save → Play**。
- 编辑器里看不到 BeginPlay 生成的东西是正常的,只在 Play 时出现。

---

## M0 · 装环境 + 第一个蓝图 ✅
1. 装 Epic Launcher → 装 UE5。
2. 新建工程:Games → **Blank → Blueprint**(不要 C++)。
3. `BP_Hello`(Actor):BeginPlay → Print String → Play 看打印。

## M1 · 程序化网格 BP_GridManager ✅
- `BP_Tile`(Actor):加 Static Mesh(Plane/Cube)当地砖。
- `BP_GridManager`:变量 Columns=11、Rows=8、TileSize=100、**Tiles(数组,元素 BP_Tile)**。
- BeginPlay → 嵌套 For Loop(外层列/内层行)→ Make Vector(列×TileSize, 行×TileSize)→ Make Transform → Spawn Actor(BP_Tile)→ 把 Return Value **Add 到 Tiles**。
- GridManager 拖进关卡,Play 出棋盘。

## M2 · 相机 / 生成单位 / 鼠标 / 点击移动 ✅
- **相机**:放 Camera Actor(BoardCam)摆斜俯视 → 关卡蓝图 BeginPlay → Get Player Controller → **Set View Target with Blend**(New View Target=BoardCam,Blend 0)。
- **生成单位**:`BP_Unit`(Actor+Sphere)。GridManager 外层 Loop **Completed** 后:Tiles → Get[30] → GetActorLocation → Spawn Actor(BP_Unit)(Spawn Transform 右键 Split,Location 接坐标,可 +50 Z)。
- **鼠标/GameMode**:`BP_TacticsController`(Player Controller)勾 Show Mouse Cursor+Enable Click Events;`BP_TacticsGameMode`(Game Mode Base)设 PlayerController=前者、**Default Pawn=None**;World Settings→GameMode Override=它。
- **点击移动**:BP_Tile 的 Mesh 碰撞设 **BlockAll**;事件 **ActorOnClicked** → Get All Actors Of Class(BP_Unit)→ Get[0] → **Set Actor Location** = self GetActorLocation。

---

## 移动范围高亮(4 阶段)

### A · 地砖/单位记住坐标 🔨
- BP_Tile 加 `Col`、`Row`(Integer),生成时写入(外层 index→Col,内层 index→Row)。
- BP_Unit 加 `Col`、`Row`、`MoveRange`(默认 4),生成时从所在地砖读入。
- ⚠ **Target 必须是 Spawn 的 Return Value**,不是 GridManager 的 self。没写 Col/Row 会导致 C 阶段全不亮。

### B · 地砖能变色高亮 ✅
**B1 做材质**:Content 右键 → **Material** → 命名 `M_Highlight` → 双击 → 空白处按住 `3` 点一下(出 Constant3Vector 颜色节点)→ 双击它选显眼色(青/黄)→ 输出拖到主节点 **Base Color** → Save。
**B2 加材质变量**:打开 BP_Tile → 加变量 `HighlightMat`、`NormalMat`(类型都 **Material Interface**)→ 选 HighlightMat,默认值设 `M_Highlight`。
**B3 记住原材质**:BP_Tile 的 **BeginPlay** → 拖 Static Mesh 组件 → **Get Material**(Element Index 0)→ 返回值 **Set** 到 `NormalMat`。
**B4 开关函数 `SetHighlight`**:My Blueprint → + Function → 命名 SetHighlight → 加输入参数 `bOn`(Boolean)。函数内:**Branch**(条件=bOn)→ True 接 Static Mesh **Set Material**(Element 0, Material=HighlightMat);False 接 Set Material(0, NormalMat)。
**B5 加一个"是否高亮"标记**:BP_Tile 加变量 `Highlighted`(Boolean);在 SetHighlight 里顺便 **Set Highlighted = bOn**(后面 D 判断能不能走要用)。
**B6 临时测**:在 BP_Tile 的 ActorOnClicked 里临时加一句 `SetHighlight(True)` → Play 点格子,格子变色 = B 成功。测完删掉这句临时的。
> 验收:点地砖能变色。截图给我确认再进 C。

### C · 点单位 → 算出范围 → 高亮 🔨(能亮,位置 bug 待修)
思路:点单位=选中它;遍历所有地砖,离它 ≤ 移动力的格高亮。逻辑放 **GridManager**(它有 Tiles 名册)。
**C1 GridManager 加辅助**:加变量 `SelectedUnit`(BP_Unit)。
**C2 清高亮函数 `ClearHighlights`**:For Each Loop(Tiles)→ 对每块 `SetHighlight(False)`。
**C3 显示范围函数 `ShowRange`**(输入 `Unit`:BP_Unit):先调 ClearHighlights → **Set SelectedUnit = Unit**(放循环**外**、ClearHighlights 之后;放循环里会每格重复执行)→ For Each(Tiles):
  - 取 tile.Col/Row 与 Unit.Col/Row → 算 `|tile.Col−Unit.Col| + |tile.Row−Unit.Row|`(用 Abs)。
  - **Branch**:结果 ≤ Unit.MoveRange 且 ≠ 0 **且该格没被占**(建议做辅助函数 `IsTileOccupied(Col,Row)`:Get All Actors Of Class(BP_Unit)→For Each,有单位 Col/Row 等于本格返回 True)→ 该 tile `SetHighlight(True)`。不查占位,§3 上 2v2 后单位会叠在同一格。
> ⚠ 简化声明:这里用曼哈顿距离,**不是** web 版 `moveBFS`——无视水域、不会绕路。垂直切片先这样,BFS 版(含地形/绕障)列入切片后待办;对表 web 数值前必须补上。
**C4 单位可点击**:BP_Unit 的 Mesh 碰撞设 **BlockAll**;加事件 **ActorOnClicked**。
**C5 点单位触发范围**:BP_Unit 的 ActorOnClicked → 拿 GridManager 引用(**Get All Actors Of Class**(BP_GridManager)→ Get[0];更好:BeginPlay 取一次存进变量 `Grid`,顺便学"引用缓存")→ 调它的 **ShowRange**(Unit=self)。
> ⚠ 前瞻:§3 加入敌方后,这里必须先 **Branch(self.Side == 我方)** 再调 ShowRange——否则玩家点敌方棋子也能选中并移动它。
> 验收:点棋子,它周围可走的格亮起来。

### D · 只能走范围内 + 收尾 ⬜
**D0 先拆旧线(必做!)**:M2 时在 BP_Tile 的 ActorOnClicked 里接过「Get All Actors Of Class(BP_Unit)→Get[0]→Set Actor Location」的临时移动——**整段删掉**再做 D1。不删的话,点任意格子 0 号单位照样瞬移,范围限制形同虚设。
**D1 改 BP_Tile 的点击**:ActorOnClicked 里 → **Branch**(条件=self `Highlighted`)→ 只有 True 才继续移动。
**D2 移动到本格**:True 分支 → 拿 GridManager → 取它的 `SelectedUnit`(**IsValid** 才做)→ **Set Actor Location** = 本地砖位置 **+ 生成时用的 Z 偏移(如 +50;漏掉的话棋子会沉进地砖)**;并把 **SelectedUnit.Col/Row 设成本地砖的 Col/Row**(更新棋子坐标)。
**D3 移动后清场**:调 GridManager `ClearHighlights`;把 `SelectedUnit` 置空(取消选中)。
> 验收:点棋子→亮范围→只能点亮格移动→移动后范围消失。移动范围功能完成 ✅

---

## 🎯 垂直切片剩余(到"能打的战斗")
> 下面几步等 A–D 做完再逐一展开成 B 那样的节点教程;这里先记"要建什么"。

**3. 多单位 + 敌我** ✅:BP_Unit 有 `Side` + `Setup(Ally)` 换 `M_Enemy`。GridManager `SpawnUnit` 在 Completed 后生成 index 30/41(我方)+52/63(敌方)。ActorOnClicked 按 Side 过滤,**2026-08-15 又加固**:只有轮到的单位能点。
**4. 速度行动序(回合)** ✅:`BP_TurnManager.BuildTurnOrder`——每回合重新收集存活单位,按真 `Spd` 降序排序、同速随机 tiebreak,`CurrentIndex` 循环推进,`StartTurn` 高亮当前单位 + 刷新行动顺序条 UI。
**5. 攻击 + 伤害公式** ✅:选单位→高亮**攻击范围**(射程)→点敌人→扣血,公式 `d = max(1, round(攻×(DEF_K/(DEF_K+防))))`(DEF_K=9),不含招倍率/克制/命中/暴击/掩体,这些留到切片后。**18 属性克制表**(DataTable 展平)仍未做,留到切片后。
**6. 血条 + 死亡 + 胜负** ✅:单位头顶 Widget 血条;HP≤0 移除;一方全灭 → 弹"胜/负"。
**7. 敌方简单 AI** ✅:敌方回合自动走向最近我方并攻击。
→ **垂直切片已完成(2026-08-15)**:一场 2v2 能从头打到分胜负,实测验证过。

---

## 已掌握清单(不用重讲)
建工程/Blueprint 类、加组件、嵌套 For Loop、数组 Add/Get、SpawnActor+Split、关卡蓝图 SetViewTarget、Class Defaults、World Settings、碰撞 BlockAll、ActorOnClicked、变量增删、函数+参数、Branch/For Each、GetActorLocation/SetActorLocation、Compile-Play、执行线vs数据线、三大角色分工。
