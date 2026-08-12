# 纹兽战记 → UE 学习笔记 & 进度

> 边学边记。概念用"人话"记;打了 **【待深入】** 的,等遇到具体场景再展开细说。

---

## 当前进度（对照《UE移植课程大纲》）

- **M0 装环境 + Hello** ✅
- **M1 程序化网格** ✅（BP_GridManager 用嵌套 For Loop 铺 11×8,存进 Tiles 数组）
- **M2 相机 + 点击移动** ✅ 完成
  - 相机锁定 ✅（BoardCam + 关卡蓝图 Set View Target with Blend）
  - 代码生成单位 ✅（Tiles[30] 位置 spawn BP_Unit）
  - GameMode/鼠标 ✅（BP_TacticsGameMode + BP_TacticsController,关掉默认飞行球、开鼠标光标+点击事件）
  - 点格子→单位移动 ✅（BP_Tile: ActorOnClicked → 找单位 → SetActorLocation）
  - **移动范围高亮 ✅ 完成**(A坐标 / B高亮 / C范围[世界坐标] / D限制)。
- **切片第3步 · 多单位+敌我 🔨 生成已通**(2026-07-15):2 我方灰球 + 2 敌方红球(`M_Enemy`)已出现在棋盘上。

### ⏭ 明天继续（2026-07-16）
1. **点敌方禁止选中**:`BP_Unit` ActorOnClicked → `Branch(Side==True)` 才调 ShowRange。
2. 清理临时 Print(`ENTER`/`SPAWN_OK`/`Tiles.Length` 等)。
3. （可选）核对 For Loop **First Index=1** 是否与 Col/Row / 高亮一致;必要时改回 0 起。
4. 切片第4步:**BP_TurnManager 行动序**(按 Spd 排序轮流行动)。

## 已搭好的资产（结构备忘）

- **BP_GridManager**：BeginPlay → 嵌套 For Loop(外层 Columns / 内层 Rows;当前 First Index=**1**)→ Spawn BP_Tile → Set Col/Row(目标=Return Value)→ Add **Tiles**(Length=**88**)。外层 **Completed** 后调 4 次 **`SpawnUnit`**:index 30/41 我方、52/63 敌方。函数:`ClearHighlights`、`ShowRange(Unit)`、`SpawnUnit(TileIndex, Ally)`;变量:`SelectedUnit`、`Tiles`。
- **SpawnUnit**:Get Tiles[index]→Location+Z50→**SpawnActor BP_Unit**(Collision=**Always Spawn, Ignore Collisions**)→Is Valid→`Setup(Ally)`。⚠ Default 碰撞会被地砖 BlockAll 挡掉→Outliner 0 个单位。
- **BP_Tile**：碰撞 BlockAll。变量:Col/Row/HighlightMat/NormalMat/Highlighted。函数:`setHighlight(On)`。
- **BP_Unit**：棋子(球)。变量:Col/Row/MoveRange、**Side**(Boolean,Ally 写入)。函数:**`Setup(Ally)`**→Set Side;False 时 Mesh.SetMaterial(0, **M_Enemy**)。Mesh BlockAll;Mobility **Movable**。ActorOnClicked→ShowRange(self)(**明天加 Side 判断**)。
- **BoardCam** / **BP_TacticsController** / **BP_TacticsGameMode**：同前。
- **M_Highlight** / **M_Enemy**：高亮材质 / 敌方红色材质。

---

## ✅ 已掌握知识点（后续不重讲,直接在此基础上推进）

**动手操作（已能独立完成）:**
- 安装 UE5、新建 Blueprint 工程
- 视口导航、切换/驾驶相机看不同视角
- 新建 Blueprint Class:Actor / Player Controller / Game Mode Base
- 给 Actor 加 Static Mesh 组件并选网格
- 嵌套 For Loop 程序化生成（铺网格）
- 数组:声明、Add 加入、按 index 用 Get(a copy) 取
- Make Vector / Make Transform 组合坐标
- Spawn Actor from Class:设 Class、Split 拆分 Spawn Transform 接 Location
- 关卡蓝图:Event BeginPlay、Get Player Controller、Set View Target with Blend、Create a Reference to（选中物体）
- Class Defaults 改属性（Show Mouse Cursor / Enable Click Events / Default Pawn = None）
- Window → World Settings → GameMode Override 指定 GameMode
- Compile → Save → Play 的迭代流程
- 设置 Collision Preset（BlockAll）
- **事件驱动交互**:Event ActorOnClicked、Get All Actors Of Class、Get[0]、Set Actor Location（Sweep/Teleport 含义）
- 完整模式:点地砖 → 找到单位 → 移动它
- 给不同蓝图加变量(Integer 等);从一个引用上 Set/Get 它的变量;跨 Actor 读数据(从地砖读 Col/Row 写到单位)
- **材质高亮 B 阶段**:M_Highlight 材质;BP_Tile 的 SetHighlight 函数;BeginPlay 存 NormalMat
- **函数+Branch+For Each Loop**:ClearHighlights、ShowRange 曼哈顿距离高亮
- **Spawn 后 Set 变量**:Target 必须接 Return Value( spawned Actor ),不能接 self(GridManager)
- **新建 GameMode/Controller** 并 World Settings 指定;Play 后 Shift+F1 释放鼠标

**概念（已理解）:**
- 白色执行线（顺序）vs 彩色数据线（按需拉取）;**依赖只由白线决定** ← 自己推理出来的 💪
- 数组存的是"引用",用 index 取对象、不记坐标;index↔(col,row) 公式
- GameMode / PlayerController / Pawn 三角色分工
- 碰撞用于"被点中";BlockAll 让地砖能被点击射线戳到
- 战棋的"阻挡"是逻辑（BFS 排除）而非物理;移动用 SetActorLocation 插值、不走物理
- **Actor 结构**:Transform + Components(零件) + Variables(记忆) + Functions(技能) + Event Graph(行为)
- **Mesh 组件**:Static Mesh Asset(形状) + Material Slots(Element Index 0,1…) + Collision + 局部 Transform
- **SetHighlight 原理**:外界调用 → Set Highlighted=On → Branch → Mesh.SetMaterial(0, Highlight/Normal)
- **tile vs Unit**:tile=For Each 当前地砖;Unit=ShowRange 参数/点棋子时的 self
- **MoveRange  per-unit**:每个 BP_Unit 实例各自一份,ShowRange 读 Unit.MoveRange,不同角色可不同值
- **飞行球**:UE 默认 Pawn,WASD 乱飞抢鼠标;战棋设 Default Pawn=None,用 BoardCam+鼠标点击

---

## 📅 会话记录 · 2026-07-12（B/C 阶段实操）

### B 阶段 · 地砖变色高亮 ✅

| 步骤 | 内容 | 踩坑 |
|------|------|------|
| B1 | 建 M_Highlight 材质 | — |
| B2 | HighlightMat/NormalMat 变量 | — |
| B3 | BeginPlay: Mesh→Get Material(0)→Set NormalMat | Get Material 无白线也正常(纯函数) |
| B4 | 函数 setHighlight(On): Branch→Mesh.SetMaterial | ❌ Target 接 self 错,❌ SET Mesh 变量错;必须 Components 拖 Mesh |
| B5 | Highlighted 变量;On 接 Set Highlighted 和 Branch | ❌ 只勾复选框=永远 False,必须 On 红线接入 |
| B6 | ActorOnClicked 临时 setHighlight(True) 测变色 | ❌ 没 GameMode→鼠标/点击失效;❌ Play 按键盘抢鼠标,用 Shift+F1 |

### GameMode 补课（B6 失败根因）

当时 Content 里**没有** BP_TacticsGameMode/BP_TacticsController(和 BP_GridManager 不是一回事)。新建后:
- BP_TacticsController:Show Mouse Cursor + Enable Click Events
- BP_TacticsGameMode:Player Controller=上者,Default Pawn=**None**
- World Settings → GameMode Override = BP_TacticsGameMode

### C 阶段 · 点单位亮范围 🔨(有 bug)

| 步骤 | 内容 | 踩坑 |
|------|------|------|
| C1 | GridManager 加 SelectedUnit(BP_Unit) | — |
| C2 | ClearHighlights:For Each Tiles→SetHighlight(False) | ❌ Loop Body 白线没接 Set Highlight |
| C3 | ShowRange(Unit):曼哈顿距离+Branch | ❌ For Each Array 没接 Tiles;❌ 搜 integer-integer 应 Col 拖线搜`-`;❌ Branch Condition 勾 True |
| C4 | BP_Unit Mesh BlockAll + ActorOnClicked | — |
| C5 | 点击→Get GridManager[0]→ShowRange(self) | ❌ 白线没接到 Show Range |
| A 补 | Spawn 后 Set Col/Row | ❌ Target=self 报错;❌ 没写 Col/Row→全不亮(距离恒0,被≠0挡掉) |

### 全不亮排查结论

所有 Col/Row 默认 0 → 每 tile 距离=0 → `≤MoveRange` 过但 `≠0` 不过 → 一块不亮。修法:Spawn BP_Tile 的 **Return Value** 上 Set Col(外层Index)/Set Row(内层Index);Spawn BP_Unit 后从 Tiles[30] 读 Col/Row 写到 Unit。

### 其他警告

`BP_Unit DefaultSceneRoot has to be Movable` → 根组件和 Mesh 的 Mobility 改 **Movable**(地砖用 Static)。

### 之后续(移动范围收尾)
移动范围 A–D 已完成(笔记称 C 用世界坐标)。高亮偏移问题曾怀疑 Col/Row;铺砖现已写 Col/Row,若仍偏可查 First Index=1。

---

## 📅 会话记录 · 2026-07-15（多单位 + 敌我）

### 做了什么
| 项 | 状态 |
|----|------|
| GridManager 封装 `SpawnUnit(Tile Index, Ally)` | ✅ |
| BeginPlay Completed 后 spawn 4 人(30/41 我方,52/63 敌方) | ✅ |
| BP_Unit `Setup(Ally)`:Set Side;敌方换 `M_Enemy` | ✅ |
| Play 验收:棋盘上 2 灰 + 2 红球 | ✅ |

### 大坑:调用了 Spawn 但 Outliner 0 个单位
- Log 可有 `unit spawned`×4、`Tiles.Length=88`,但 **BP_Unit 一个没有**。
- 原因:**SpawnActor Collision Handling = Default** → 与地砖 BlockAll 重叠 → **Abort,不生成 Actor**。Print 在 Spawn 后仍会跑→假成功。
- 修法:**Always Spawn, Ignore Collisions** + Location **+Z50**;用 **Is Valid** 打 `ok`/`failed` 验证 Return Value。

### 调试踩坑
- Print 手写 `"Tiles.Length"` 只会打出文字,要从 **Length 节点**接线才能打出 `88`。
- Event Graph 的 `unit spawned` 与函数内 `ok`/`failed` 易混淆;函数内 Print 须勾 **Print to Log**,且先 **Compile**。
- Spawn 白线须接**外层** For Loop 的 **Completed**(整盘铺完),不要接内层 Completed。

### 明天优先
1. ActorOnClicked:`Branch(Side)` 禁止点敌方选中。
2. 删临时 Print。
3. 进 **TurnManager 行动序**。

---

## 概念笔记

### 1. 两种连线：执行线 vs 数据线（蓝图最核心）
- **白色线 = 执行顺序**：谁先跑、谁后跑。
- **彩色线 = 数据**：算什么。**不决定顺序**,在用到它的节点执行那一刻才"按需拉取"。
- 推论：要保证"A 之后才做 B",必须连**白线**;光连数据线不算依赖。

### 2. GameMode / PlayerController / Pawn 三角色
- **Pawn 身体**：被操控的东西（默认是会 WASD 飞的球)。战棋不要 → Default Pawn = None。
- **PlayerController 大脑/输入**：管鼠标、点击、按键。
- **GameMode 规则总管**：规定这局用哪个 Controller、哪个 Pawn。靠 World Settings → GameMode Override 生效。

### 3. Collision 碰撞（Preset 的意义）
碰撞 = 物体能不能被"检测到/挡住"。两层:
- **三种反应**：Ignore（当不存在）/ Overlap（能感知穿过但不挡,触发器用）/ Block（实心,挡住并触发撞击)。
- **常见 Preset（打包好的反应)**：
  - NoCollision：完全没碰撞,点不中、不挡。
  - **BlockAll**：全部 Block = 实心,**能被点击射线戳中**。地砖用它就是为了能点。
  - BlockAllDynamic：同上,给会动的物体。
  - OverlapAll / Dynamic：触发器(感知穿过,不挡)。
  - Pawn / Character / PhysicsActor / Trigger / UI：各种专用打包。
  - Custom：自己一项项设。
- **为什么地砖用 BlockAll**：鼠标点击=发一条看不见的射线戳物体,物体要 Block 这条射线才算被点中。
- 【待深入】**什么时候用别的 Preset**：遇到这些场景再细说——① 触发区域(踩上去触发事件)→ Overlap;② 会掉落/被撞飞的物体 → 物理类;③ 棋子站格子上,点击射线先中棋子还是地砖(单位 vs 地砖点击冲突)→ 调通道/Custom;④ 性能优化:地砖其实只需 Query Only + Block 点击通道,不必全 Block。

### 4. 战棋的"阻挡"是逻辑,不是物理
- "走不进墙 / 走不到有人的格子" → 由 **BFS 算可走范围时排除**那些格子(数据判定),**不是靠物理碰撞**。
- 棋子移动用 **Set Actor Location**（Sweep 关）瞬移或插值,**全程不碰物理**,所以不会"撞"。
- 物理碰撞只起作用于:① 开了 Simulate Physics;② 带 Sweep 的移动。我们都不用。
- 平滑"走格子" = 沿 BFS 路径**一格一格插值位置**（每段滑 ~0.15s),仍是 SetActorLocation,仍不碰物理。

### 5. Tiles 数组 + 编号换算
- Tiles 是**一维**数组（0…87),存每块地砖的**引用**。
- 用 index 取地砖对象,再问它坐标/地形/谁站这,**不用自己记坐标**。
- index ↔ 行列公式:`index = row × 列数 + col`。

### 6. Event ActorOnClicked 的引脚
- **Touched Actor**：被点中的那个 Actor（这里就是地砖自己)。
- **Button Pressed**：一个 **Key**,告诉你点的是哪个鼠标键(左/右/中)。
- 现在没用 Button Pressed,因为不分左右键,任何点击都移动。【待深入】以后"左键移动、右键取消/查看信息"时,就从 Button Pressed 拉出来判断是不是 Left Mouse Button 再分叉。

---

## 下一步 TODO

**优先(明天 2026-07-16)**:
- [ ] BP_Unit 点击:仅 `Side==True`(我方)才 ShowRange
- [ ] 清理调试 Print
- [ ] 切片第4步:BP_TurnManager(收集单位→按 Spd 排序→轮流激活)

**之后**:
- 攻击范围 + 伤害公式 + 克制表
- 血条 / 死亡 / 胜负
- 敌方简单 AI
- 平滑移动 Timeline;BFS 绕障;DataTable(M3)
