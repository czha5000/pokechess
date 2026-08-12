# 纹兽战记 → UE5 实操教程(垂直切片:到"一场能打的战斗")

> 目标里程碑:在 UE 里跑通**一场 2v2 能分胜负的战斗**。全程蓝图、2.5D 固定相机。
> 逻辑/数值/克制表都从 web 版 `js/data/*` 带走,只重写代码。

---

## 📍 续接区(开新对话先看这里)
- **怎么续**:新对话里把本文件或 `UE学习笔记.md` 发给我,或说「继续UE」。我读续接区+笔记就知道进度。
- **当前进度**:M0/M1/M2 ✅。移动范围 A–D ✅。切片第3步(多单位+敌我)✅含点击过滤。**切片第4步 BP_TurnManager 行动序 ✅**——按生成顺序(我我敌敌)循环,N 键切换,当前单位高亮;真正按 Spd 排序留作后续优化(不阻塞)。
- **下一步动作**:切片第5步**攻击+伤害公式**。已对照 web `combat.js`/`types.js`/`config.js` 核实当前真实数值(不是本文件旧笔记里那版简化公式):
  - 当前伤害公式(v0.68+,乘算防御衰减):`d = max(1, round(Atk × 技能倍率 × 属性克制 × (DEF_K/(DEF_K+Def+掩体))))`,再叠 LOS 遮挡×0.8、地形/侧翼/遗物等乘算项。
  - 关键常量(已从 config.js/state.js 核实):`DEF_K=9`、`LOS_HIT=20`、`LOS_DMG=0.80`、`FLANK_MULT=1.30`、`CRITX=3`、`DOUBLE_GAP=4`。
  - UE 切片版简化到:`d = max(1, round(Atk × (DEF_K/(DEF_K+Def))))`,先不带技能倍率/属性克制/命中率/暴击/掩体/地形/遗物——这些留作对表前的补齐项(与切片一贯"先跑通再补真实度"的做法一致)。
  - 18 属性克制表(展平 DataTable)本步先不做,等基础伤害流程跑通再单独排半天。
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

**3. 多单位 + 敌我** 🔨生成✅ / 点击限制⬜:BP_Unit 有 `Side` + `Setup(Ally)` 换 `M_Enemy`。GridManager `SpawnUnit` 在 Completed 后生成 index 30/41(我方)+52/63(敌方)。Spawn 必须 **Always Spawn, Ignore Collisions** + Z+50。仍缺:HP/Atk/Def/Spd 等战斗变量;ActorOnClicked 按 Side 过滤。
**4. 速度行动序(回合)** ✅:`BP_TurnManager`——BeginPlay 收集全部单位存 TurnOrder(按生成顺序,非真 Spd 排序,留作后续优化),CurrentIndex 循环推进(N 键,取模 wraparound),StartTurn 高亮当前单位。
**5. 攻击 + 伤害公式** 🔨 进行中:选单位→高亮**攻击范围**(射程)→点敌人→扣血。已对照 web `combat.js` 核实真实公式为**乘算防御衰减** `d = max(1, round(攻×招倍率×克制×(DEF_K/(DEF_K+防+掩体))))`(DEF_K=9),而非本文件旧版加法公式——UE 切片第一版简化到 `d = max(1, round(攻×(DEF_K/(DEF_K+防))))`,不含招倍率/克制/命中/暴击,后续再补。**18 属性克制表**:web `types.js` 的 CHART 是稀疏表(只列非 1 倍关系),DataTable 需要行结构——要先**展平**:每行 = 攻属性,18 个 float 列 = 对每种防属性的倍率(缺省填 1)。这步有实际工作量,单独留半天,别指望"导入"一键完成,本步暂缓。
**6. 血条 + 死亡 + 胜负**:单位头顶 **Widget 血条**(UMG);HP≤0 移除;一方全灭 → 弹"胜/负"。
**7. 敌方简单 AI**:敌方回合自动走向最近我方并攻击。
→ 做完 = **一场 2v2 能从头打到分胜负**,垂直切片完成。

---

## 已掌握清单(不用重讲)
建工程/Blueprint 类、加组件、嵌套 For Loop、数组 Add/Get、SpawnActor+Split、关卡蓝图 SetViewTarget、Class Defaults、World Settings、碰撞 BlockAll、ActorOnClicked、变量增删、函数+参数、Branch/For Each、GetActorLocation/SetActorLocation、Compile-Play、执行线vs数据线、三大角色分工。
