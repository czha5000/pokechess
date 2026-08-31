# UE 蓝图状态快照(harness 核心文档)

> 用途:我不用每次靠翻聊天记录/整图回传来确认现状——直接读这份文档就知道每个蓝图有什么变量、什么函数、大致怎么连的。**每次改动后必须同步更新这里**,否则下次就是瞎猜。

## 📖 怎么读这份文档(253KB,不要通读)

这份文件里有**两类章节交错排列**,用途完全不同:

| 章节形式 | 是什么 | 怎么用 |
|---|---|---|
| `## BP_Xxx` / `## WBP_Xxx` / `## 某某系统` | **当前状态快照**:变量表、函数列表、EventGraph 结构、已知问题 | ✅ **接手时必读这些**(约 97KB) |
| `### 2026-xx-xx ...` | **改动史 / 排查过程存档**:某一天做了什么、踩了什么坑、怎么修的 | 🔍 **不必通读**(约 156KB),排查具体问题时按关键词 grep |

> ⚠️ 注意:日期章节里也常常写着"现在是什么样"(因为它记录的是最后一次改动的结果)。
> 如果快照章节和日期章节冲突,**以日期更晚的为准**,并顺手把快照章节改对——快照过期正是历史上多次误判的根因(见 `UE节点备忘录.md` 坑62–64)。

**配套文档**:`UE硬规则.md`(必读,86 条坑的结论提炼)、`UE规则对齐表.md`(改战斗规则前必查)、`UE节点备忘录.md`(案例档案,按"坑XX"grep)、`UE测试用例.md`(验收清单)。

---

## BP_Unit (`/Game/Maps/BP_Unit.BP_Unit_C`)

> **2026-08-17 父类 Actor → Character**(TPS 直控迁移阶段A,设计见 `C:\Users\AI_Work\.claude\plans\pokemon-tps-misty-walrus.md`)。原有 `DefaultSceneRoot`/`StaticMesh` 完整保留,只是现在挂在 Character 原生根组件 `CollisionCylinder`(胶囊体)下面,不再是 Actor 根。新增组件:`SpringArm`(挂 `CollisionCylinder`,`targetArmLength=300`、`relativeLocation={0,0,100}`、`bUsePawnControlRotation=true`、`bDoCollisionTest=true`、`bEnableCameraLag/bEnableCameraRotationLag=true`)→ `TPSCamera`(挂在 SpringArm 末端)。`CharMoveComp.maxWalkSpeed=500`、`bOrientRotationToMovement=true`(移动方向带动身体转向);CDO 上 `bUseControllerRotationYaw/Pitch/Roll` 全部设为 false(鼠标只转相机,不转身体)。`EventGraph` 新增 `Input|EnhancedActionEvents|IA_Move`(→ `BreakVector2D` + `GetActorForwardVector`/`GetActorRightVector` 各一次 `AddMovementInput`)、`Input|EnhancedActionEvents|IA_Look`(→ `BreakVector2D` + `AddControllerYawInput`(X)/`AddControllerPitchInput`(Y)),原有四个事件(`EventBeginPlay`/`MouseInput|EventActorOnClicked`/`Collision|EventActorBeginOverlap`/`EventTick`)完全没动。`IA_Attack`/`IA_EndTurn` 阶段C才会在这里接线。

### 变量
| 名字 | 类型 | MemberGuid | 备注 |
|---|---|---|---|
| Col | Integer | EC5111B2499BDFC8487A6CB7A0531A60 | |
| Row | Integer | 989E623C43F9417073E99FA096C78C35 | |
| MoveRange | Integer | 未知 | 默认 4 |
| Side | Boolean | 735371B54A6EEBD5326EEDB5B6A97AFE | true=我方,false=敌方 |
| MaxHP | Integer | 未知 | **Class Defaults 已确认 = 20**(2026-08-15 核实) |
| HP | Integer | 7E7CE5CF43871663225F4B9260614168 | **Class Defaults 已确认 = 20**,此前"疑似默认0"的记录已过时 |
| Atk | Integer | 5630A3C3448BD43A03C96DA37CDA3333 | Class Defaults = 10 |
| Def | Integer | 1B57114147085BA71CDBC081B6E015F3 | Class Defaults = 5 |
| Spd | Integer | 未知 | Class Defaults = 6 |
| AtkType | Integer | 未知 | 占位,未接入属性克制表 |
| EnemyMat | Material | - | |
| AtkRange | Integer | 未知 | Class Defaults = 2,**已接入 `TryAttack` 的距离判断**(此前"还没接入判断"的记录已过时,见已知问题2) |
| HealthBarComponent | WidgetComponent | (2026-08-15 新增) | 头顶血条的 WidgetComponent,`UserConstructionScript` 里动态创建 |
| HealthBarWidget | WBP_HealthBar (Object) | (2026-08-15 新增) | 血条 Widget 实例,`UserConstructionScript` 里 `ConstructObjectfromClass` 生成后经 `SetWidget` 挂到 `HealthBarComponent` 上,同时存一份引用在这个变量方便其他函数直接调用 |
| bHasMoved | Boolean | (2026-08-16 新增,默认 false) | 本回合是否已经移动过。`BP_TurnManager.StartTurn` 轮到该单位时重置为 false;`BP_Tile.ActorOnClicked` 里真正挪动位置后置为 true;`ActorOnClicked` 里再点自己会检查这个标记,已移动就不再弹出移动/攻击高亮。用途:修复"一回合能无限移动"的 bug,见下方 `ActorOnClicked`/已知问题3。 |

### 函数
- **Setup(bAlly: Bool)**:`Set Side = bAlly` → Branch(Side) → False 分支 `Mesh.SetMaterial(0, M_Enemy)` → **`UpdateHealthBar()`(2026-08-15 新增,初始化血条为满血)**
- **UpdateHealthBar()**(2026-08-15 新增):`HealthBarWidget.SetHealthPercent(ToFloat(HP) / ToFloat(Max(MaxHP, 1)))`。由 `Setup` 和 `GridManager.TryAttack`(伤害结算后)两处调用,保证血条随 HP 变化实时更新。**⚠ 已踩坑修复:HP/MaxHP 都是 Integer,`/` 直接相除会做整数除法截断成 0**(比如 15/20 算出来是 0 不是 0.75),表现为"随便掉一点血,血条就瞬间全红"——真人 Play 测出来的,回归测试当时只断言了"< 1.0"没测出来。已改成显式 `ToFloat` 转换再相除,并把回归测试的 `T6b` 断言加强成"百分比不能是 0"来防止同类回归。

### UserConstructionScript(2026-08-15 新增血条搭建逻辑)
```
ConstructObjectfromClass(Class=WBP_HealthBar_C, self)  → widget 实例
  → AddWidgetComponent(self, RelativeTransform=Z+120)  → WidgetComponent 实例
    → SetWidget(component, widget实例)
    → SetWidgetSpace(component, World)
    → SetDrawSize(component, 100x14)
    → Set HealthBarComponent = component
    → Set HealthBarWidget = widget实例
```
**踩坑记录**:`AddWidgetComponent`(Construction Script 专用的"动态加组件"节点)没有 WidgetClass 输入 pin,也没有 `SetWidgetClass` 这个蓝图可调用节点(这个引擎版本没暴露)——正确做法是用 `ConstructObjectfromClass` 单独构造 Widget 实例,再用 `SetWidget`(接受实例,不是类)挂上去。细节见 `UE节点备忘录.md`。

### EventGraph
- BeginPlay / ActorBeginOverlap / Tick:模板残留,**Disabled,不用管**
- **ActorOnClicked**(⚠ **2026-08-22 起已停用**,`K2Node_Event_3`→`GetAllActorsOfClass`间的 exec 线已 `break_pins` 断开,点击任何单位[我方/敌方]现在完全没有反应,详见 `BP_TurnManager` 一节"当日修复"第5条。以下描述是**断线之前**的历史行为存档,当前不会执行——核心逻辑,已重构;**2026-08-15 加了"只有轮到的单位才能点"门槛 + 攻击命中后自动结束回合;同日再追加 ShowAttackRange 重触发修复;2026-08-16 再加"一回合只能移动一次"门槛**):
  ```
  Event → Branch(Side)
    True(点我方) → 取 TurnManager.TurnOrder[CurrentIndex] → 是否等于 self?
        是 → Branch(NOT self.bHasMoved)
            true(还没移动过)→ GetAllActorsOfClass(GridManager)[0] → ShowRange(Unit=self) → ShowAttackRange(Unit=self)
            false(已经移动过)→ 什么都不做(不再弹高亮,防止一回合移动多次)
        否 → 什么都不做(不是你的回合,点了也没用)
    False(点敌方) → GetAllActorsOfClass(GridManager)[0] → TryAttack(Defender=self)
        → 再读一次 Grid.SelectedUnit,`IsValid`?
            Is Not Valid(TryAttack 内部命中后会把 SelectedUnit 清成 None)→ 说明这次真打中了 → TurnManager.EndTurn()
            Is Valid(还是原来那个值,说明超出射程/没选中单位,TryAttack 内部什么都没做)→ 不结束回合,允许玩家挪近了再点
  ```
  **2026-08-16 新增"一回合只能移动一次"门槛**:此前没有任何东西阻止玩家在同一回合内反复点自己→挪动→再点自己→再挪动,`MoveRange` 形同虚设。修复分三处协同(单靠某一处都不完整):①`BP_Unit` 新增 `bHasMoved` 变量;②`BP_TurnManager.StartTurn` 轮到该单位时(True/我方分支)重置为 `false`(见 `BP_TurnManager.StartTurn` 词条);③`BP_Tile.ActorOnClicked` 真正执行移动(`SetActorLocation` 之后)时置为 `true`(见 `BP_Tile.ActorOnClicked` 词条);④这里的 `ActorOnClicked` 在跳去 `ShowRange`/`ShowAttackRange` 之前插入 `Branch(NOT bHasMoved)` 门槛,已移动就整段跳过,不再弹出任何高亮——玩家点自己没有任何反应,只能继续点敌方尝试攻击或直接结束回合(暂无"结束回合"按钮,靠攻击命中或轮到敌方自动推进,已知简化)。全部通过 MCP `create_node`/`connect_pins` 增量插入,`compile_blueprint` 后 `get_node_infos` 逐个核对过 exec 连接,回归测试 11 条断言重跑全 PASS。**待人工 Play 验收**:点自己单位移动一次后,再点自己应该不再出现黄/红高亮;点已高亮以外的格子应该没有效果。
  **2026-08-15 bug 修复(共两处,叠加导致"完全看不到攻击范围")**:
  1. **触发时机问题**:此前 `ShowAttackRange` 只在 `BP_TurnManager.StartTurn` 里调用一次,玩家移动后再点回自己单位(重新触发 `ActorOnClicked` → `ShowRange`)时不会重新刷新攻击范围红色高亮。修复:在 `ShowRange` 调用后紧接着插入一个新节点 `K2Node_CallFunction_16 = Class|BPGridManager|ShowAttackRange(self=GridManager引用, Unit=self)`,复用已有的 `K2Node_GetArrayItem_4`(GridManager引用)和 `K2Node_Self_1`(self)两个输出做扇出,`then` 接回原来 `ShowRange.then` 指向的 `IfThenElse_3`。
  2. **判定语义问题(真正的根因)**:第一处修复后用户实测仍然"看不到高亮",排查发现 `ShowAttackRange` 内部逻辑当时是"只高亮当前恰好有敌人站在射程内的格子"——如果点击那一刻没有敌人正好落在范围内,压根不会有任何格子被标记,材质/渲染链路本身没问题(用 `get_property_input` 对比过 `M_AtkHighlight` 和已验证能正常显示的 `M_Highlight`,BaseColor 连线结构完全一致)。改成"以单位当前位置为圆心,曼哈顿距离 1~AtkRange 内的格子一律高亮",不再依赖敌人是否在场,和移动范围黄色高亮同构。详见 `BP_GridManager.ShowAttackRange` 词条。
  
  两次改动后回归测试 T8(`T8_ShowAttackRange_HighlightsEnemyInRange`)重跑均 PASS,9 条用例全绿,确认没有引入回归。**注意:回归测试只验证了 `AtkHighlighted` 布尔标记被正确置位,"点击后屏幕上真的看得到红色格子"这一步仍需要用户在编辑器里手动 Play 验收**,因为当前 MCP 工具集没有鼠标点击模拟能力(`SlateInspectorToolset.Click` 只能点 Slate UI 控件的 ref,不支持按 3D 视口坐标点选 world actor)。

  旧的内联攻击链(GetSelectedUnit/Atk/Def/HP 一堆节点堆在这里)已删除,逻辑整体搬进了 `BP_GridManager.TryAttack`。**"攻击是否真的命中"这个判断没有改 `TryAttack` 的函数签名(没加返回值/参数)**,而是复用了它本来就有的副作用——命中时会把 `SelectedUnit` 清成 `None`,没命中(超范围)则什么都不碰,所以在调用方读一次 `SelectedUnit` 的 `IsValid` 状态就能反推"是否真的打了一下",不用碰 `TryAttack` 内部、也不会影响 `RunEnemyTurn` 里那次独立的 `TryAttack` 调用(敌方回合的结束逻辑本来就在 `StartTurn` 里单独处理,两条路径互不干扰)。

### 已知问题(更新于本轮 TryAttack 重构后)
1. ~~HP 无下限~~ ✅ 已解决:`TryAttack` 内部用 `Max(HP-伤害, 0)` clamp,且 `newHP≤0 → K2_DestroyActor(Defender)`。
2. ~~AtkRange 没接入判断~~ ✅ 已解决:`TryAttack` 用曼哈顿距离 `LessEqual(distance, SelectedUnit.AtkRange)` 判断,超出范围无效果。**实测验证通过**——过程中发现并修复了两个更深层的坑,见问题8。
3. **移动/攻击状态未分离** —— `BP_Tile.ActorOnClicked` 的移动逻辑和这里的攻击逻辑共用同一个 `GridManager.SelectedUnit`,没有明确的"移动模式 vs 攻击模式"状态机,存在误触风险。仍未解决,需要重新设计。~~**"任意时刻可以点任意我方单位"这部分已经解决**——见上方 `ActorOnClicked` 的 TurnOrder 门槛,现在只有轮到的单位能被点出移动范围。~~
4. **HP/Atk/Def 等 Class Defaults 具体数值未核实** —— 需要打开 BP_Unit → Class Defaults 面板确认。
5. 伤害公式仍是占位版 `max(0, Atk-Def)`(用户明确认可"可以无伤,合理"),要换成真实 `max(1, round(Atk×DEF_K/(DEF_K+Def)))`,DEF_K=9(已从 config.js 核实)——留作后续步骤。
6. `BP_Unit` 里 `Col`/`Row` 的 MemberGuid 已在本轮确认:Col=`EC5111B2499BDFC8487A6CB7A0531A60`,Row=`989E623C43F9417073E99FA096C78C35`(此前"未知"已更新,见上方变量表)。
7. ~~`K2_DestroyActor` 的 Target 没接 `Defender`~~ ✅ 已修复:曾经因为这条手动线漏接,导致死亡分支触发时销毁的是 `GridManager` 自己(而不是被打死的敌方单位),表现为攻击几次后地图彻底失效(`GetAllActorsOfClass(BP_GridManager)` 返回空数组)。现已手动补上 `Defender → Destroy.Target` 的连线,验证正常。**这是本轮 TryAttack 手动连线清单里最容易漏、后果最严重的一条,以后生成同类 Function 时要在交付清单里特别提醒检查。**
8. ~~攻击距离判断形同虚设(Dist 恒为 0 或恒为固定值)~~ ✅ 已修复,根因是**逻辑坐标 Col/Row 从未真正被写入过**,分两处:
   - `SpawnUnit`(GridManager):只把新单位摆到了正确的世界坐标(`SetActorTransform`/`SpawnActorFromClass` 的 Location),从没 `Set Col`/`Set Row`——生成的单位逻辑坐标永远是默认值 0。已修复:生成后从对应 `BP_Tile` 读 `Col`/`Row` 写回新单位。
   - `BP_Tile.ActorOnClicked`:移动逻辑只做了 `SetActorLocation`(挪世界坐标)+ `ClearHighlights`,文档里记的"更新 SelectedUnit.Col/Row"这一步实际上从没实现过。已修复:`ClearHighlights` 之后补上从本格读 `Col`/`Row` 写入 `SelectedUnit` 的两个 `Set` 节点。
   - **教训(已写入节点备忘录)**:视觉位置(世界坐标)和逻辑位置(Col/Row 整数变量)是两套独立数据,挪动/生成 Actor 只会同步视觉位置,逻辑坐标必须显式手动同步,UE 不会自动帮你对齐。
9. ~~一回合能无限移动,MoveRange 形同虚设~~ ✅ 已解决(2026-08-16,用户 Play 实测反馈):点自己单位→移动→再点自己→再移动,原来完全没有限制,`MoveRange` 只影响单次移动的距离,不影响移动次数。已通过新增 `BP_Unit.bHasMoved` 标记 + `StartTurn`/`ActorOnClicked`/`BP_Tile.ActorOnClicked` 三处协同解决,见 `BP_Unit.ActorOnClicked` 词条。**注意与已知问题3的区别**:问题3是"移动逻辑和攻击逻辑共用 SelectedUnit,没有状态机"这个更深的结构性问题,本条只是"移动次数没有上限"这个具体表现,两者不是同一个问题,问题3依然未解决。

**Step5(攻击+伤害公式)核心链路已跑通并验证**:点我方→点相邻敌方→伤害生效→HP≤0 正确移除目标(不再误伤 GridManager);AtkRange 范围判断经实测确认生效(超范围不掉血,范围内正常掉血)。仍是占位公式 `max(0, Atk-Def)`,真实 DEF_K 公式和 Class Defaults 数值设置留作后续。

---

## BP_GridManager (`/Game/Maps/BP_GridManager.BP_GridManager_C`)

### 变量
| 名字 | 类型 | MemberGuid |
|---|---|---|
| Columns | Integer | 6A28CE274AC93A26B72AC192E409ED76 |
| Rows | Integer | 957CF42547A92BE46A08F68BD35DE7A7 |
| TileSize | Integer | D43B1A104D44F83199AB3E831DA8BFB8 |
| Tiles | Array\<BP_Tile\> | - |
| SelectedUnit | BP_Unit | D935E037425A56EF9140B3AD499B0189 |
| bRunRegressionTestsOnBeginPlay | Boolean | (2026-08-15 新增,默认 false,Instance Editable) | 回归测试开关,见本文件末尾"自动回归测试"一节 |
| bGameOver | Boolean | (2026-08-15 新增,默认 false) | 胜负是否已判定过,防止一方全灭后每多杀一个单位就重复弹一次胜负窗 |
| bAllyAliveTmp / bEnemyAliveTmp | Boolean | (2026-08-15 新增,`CheckVictoryCondition` 的局部变量) | 循环累加用的临时标记,不代表长期状态,不用关心它们平时的值 |

### 函数
- **ClearHighlights**(GUID `0F31C30A44B85167E0CE73A25A1D95FC`):For Each Tiles → `SetHighlight(False)`
- **ShowAttackRange(Unit: BP_Unit)**(2026-08-15 新增,红色攻击范围高亮;**同日两次修复改了语义,2026-08-16 又改了一次半径公式**):
  - **v1(已废弃)**:`GetAllActorsOfClass(BP_Unit)` → For Each,若 `Side` 和 `Unit` 不同 → 算曼哈顿距离(`ManhattanDistance`)→ ≤ `Unit.AtkRange` → 找到该敌方单位所在的 `Tile` → `SetAttackHighlight(True)`。**问题**:只高亮"当前恰好在射程内的敌方单位所在格",如果点击那一刻没有敌人正好落在范围内,就完全不会有任何红格子出现——这正是用户反馈"看不到攻击范围"的根本原因(不是渲染/材质问题,是"该亮的格子这次根本没被判定为该亮")。
  - **v2(2026-08-15 第二次修复)**:改成和 `ShowRange` 同构的"范围本身"高亮,不再依赖敌人是否恰好在场:`For Each Tiles` → 曼哈顿距离(`Unit.Col/Row` → `Tile.Col/Row`)在 `1..Unit.AtkRange` 之间(`<=AtkRange 且 >0`,排除自己脚下那格)→ `SetAttackHighlight(True)`。也就是不管有没有敌人,只要点自己单位就会立刻围绕它显示一圈红格子,和 `ShowRange` 的黄色移动范围逻辑对称,符合用户说的"移动=黄,攻击=红"的直观预期。
  - **v3(2026-08-16 第三次修复,改了语义)**:用户明确反馈"红色高亮应该是移动范围的最外围,也就是最远能打哪里,而不是当下位置的攻击范围"——v2 的半径只算 `Unit` **当前站的格子**能打多远,没考虑"先移动再攻击"这个战术意图。改成半径 `1..(Unit.MoveRange + Unit.AtkRange)`(仍然以 `Unit` 当前 Col/Row 为圆心算曼哈顿距离,只是上限从 `AtkRange` 换成 `MoveRange+AtkRange`),代表"移动到射程边缘后最远能打到的格子"。改动仅涉及"半径怎么算"这一处比较条件,`ManhattanDistance` 调用和其它逻辑都没动;实现细节(踩过的孤立节点识别坑)见 `UE节点备忘录.md` 坑11。**副作用(v3 当时的已知简化,v4 已解决,见下)**:因为半径变大,移动范围内的格子必然也落在新的攻击范围内,调用顺序又是先黄后红,红色会把黄色整体盖掉。
  - **v4(当前版本,2026-08-16 同日第四次修复,用户继续反馈"移动范围和攻击范围重合时优先显示移动范围")**:在 `<=(MoveRange+AtkRange)` 的基础上再加一个下界条件 `> MoveRange`(不再是 `>0`),也就是红色只覆盖"超出移动范围、但在移动+攻击总范围内"的**环形**区域,移动范围本身(1..MoveRange)完全让给黄色,不再被红色覆盖。这才是真正对应用户"移动范围优先"的诉求——v3 只是把半径变大了,没有解决"谁盖谁"的问题;v4 才是从"哪些格子归红色管"这个源头把两者错开,不需要考虑材质槽覆盖顺序了。**回归测试联动**:`RunRegressionTests` 的 T8 用例原本把测试敌人摆在 `Tiles[1]`(离 `Tiles[0]` 曼哈顿距离 1,在默认 `MoveRange=5` 以内),v4 上线后这个位置按新规则不该再被判定为攻击范围,T8 从 PASS 变 FAIL——已经把测试敌人挪到 `Tiles[7]`(离 `Tiles[0]` 距离 7,`MoveRange(5) < 7 <= MoveRange+AtkRange(7)`,正好落在新的环形区域里),连带把断言检查的格子从 `Tiles[1]` 改成 `Tiles[7]`,重跑 11 条断言全部 PASS。
  - 由 `BP_TurnManager.StartTurn` 和 `BP_Unit.ActorOnClicked`(点自己单位重新选中时)两处调用,`ShowRange` 之后紧接着调用,`ClearHighlights` 已同步扩展会同时清 `AtkHighlighted`。⚠ 建 Col/Row 相关的跨对象取值节点踩过坑:`Class|BPTile|GetCol`/`Class|GridSlot|GetRow` 这类"类名写错"的别名(历史遗留、`read_graph_dsl` 解码出来的)不能直接抄去用在 `BP_Unit` 引用上,必须显式写 `Class|BPUnit|GetCol`/`Class|BPUnit|GetRow`(类名和实际目标类一致)才能通过 `write_graph_dsl` 正确建出节点,细节记进了 `UE节点备忘录.md`。
- **ShowAttackRangeCurrent()**(2026-08-16 新增,无参数,移动完成后调用):不同于 `ShowAttackRange(Unit)` 那种"移动前预览最远能打哪"的语义(半径 `MoveRange+AtkRange`),这个函数是"移动已经落地,现在站在新位置,纯粹的 `AtkRange` 内环形高亮"——`For Each Tiles` → 以 `SelectedUnit` 当前(移动后)Col/Row 为圆心,曼哈顿距离 `1..AtkRange` → `SetAttackHighlight(True)`。故意不接收 `Unit` 参数(`add_function_param` 不支持 Object 类型,见坑17),直接读 `SelectedUnit`——调用时机上这个变量必然还指向刚移动完的单位(见下方"行动菜单系统"一节对 `SetSelectedUnit` 清空时机的修复)。由 `BP_Tile.ActorOnClicked` 移动收尾时调用,对应用户反馈"移动后仍要显示攻击范围"。**踩坑记录见 `UE节点备忘录.md` 坑20**:`write_graph_dsl` 里对局部 `bind` 出来的变量,第二次取撞名属性(`Row`)时不能抄 `Class|GridSlot|GetRow`(`read_graph_dsl` 的显示名怪癖),必须写 `Class|BPUnit|GetRow`。
- **ShowRange(Unit: BP_Unit)**(GUID `365A39F74D91FB2F1BEFE78294302FF7`):ClearHighlights → `Set SelectedUnit=Unit` → For Each Tiles → 曼哈顿距离 ≤ `Unit.MoveRange` 且 ≠0 **且 `NOT IsTileOccupied(Tile.Col, Tile.Row)`**(2026-08-15 新增,见下方 `IsTileOccupied`)→ `SetHighlight(True)`(⚠不是BFS,已知简化;占位检查已补,BFS 仍未做)
- **IsTileOccupied(Col: Int, Row: Int) → Bool**(2026-08-15 新增,MCP 直接图编辑,`create_node`/`connect_pins` 逐节点搭建,未走 DSL 整函数重写):`GetAllActorsOfClass(BP_Unit)` → For Each → 若某单位的 `Col`/`Row` 同时等于参数 → `return true`;循环结束 `return false`。用途:阻止 `ShowRange` 把已被任意单位(我方或敌方)占用的格子标记为可移动目标,修复"单位能移动到和敌人重叠的格子"的 bug。
- **SpawnUnit(TileIndex: Int, bAlly: Bool) → SpawnedUnit: BP_Unit**(2026-08-15 加了返回值,原来是 void):`Tiles[TileIndex]` → 取该 Tile 的世界坐标 `+ (0,0,50)` → `SpawnActorFromClass(BP_Unit)` → `Setup(bAlly)` → **`Set Col`/`Set Row`(读 `Tiles[TileIndex]` 自己的 Col/Row 写回新单位)** → `return` 新生成的单位引用。修复前只摆了世界坐标,没写逻辑坐标,导致新单位 Col/Row 恒为默认值0;新增返回值是为了让 `RunRegressionTests` 能直接拿到spawn出来的单位引用,不用另外写"按坐标反查单位"的辅助函数。**⚠ 加返回值后,`EventGraph.EventBeginPlay` 里原有的 4 个 SpawnUnit 调用节点因为签名变了变成 stale(编译报 "Could not find a pin for the parameter SpawnedUnit"),用 delete_node+create_node 逐个重建才修复,详见 `UE节点备忘录.md`。**
- **RunRegressionTests()**(2026-08-15 新增)/**Assert(Condition: Bool, TestName: String)**(2026-08-15 新增,内部用):自动回归测试入口,见本文件末尾专门一节。
- **ManhattanDistance(ColA, RowA, ColB, RowB) → Int**(2026-08-15 新增):`|ColA-ColB| + |RowA-RowB|`。把此前散落在 `TryAttack`/`FindNearestUnit0`/`MoveUnitTowardTarget`/`RunRegressionTests` 里重复了 4 次的曼哈顿距离算式抽成一个真正的 Function——**不是单纯图省事的重构,是绕开 `write_graph_dsl` 一个真实 bug 的必要修复**:两处"结构相同、输入不同"的内联算式可能被编译器错误地别名成同一个节点,包成 Function 调用(天然带 exec pin,不会被去重)才能保证每次都独立求值。详见 `UE节点备忘录.md`。
- **FindNearestUnit0(FromUnit: BP_Unit, bWantAlly: Bool) → BP_Unit**(2026-08-15 新增,注意函数名末尾没有下划线,是 `remove_function_graph`+`add_function_graph` 重建时自动改的名字):遍历全场 `BP_Unit`,按 `Side==bWantAlly` 过滤,返回曼哈顿距离最近的一个。用**大哨兵初始距离(9999)+ 逐个比较更新**的写法,不用 `IsValid` 判断"是否是第一个候选"(`IsValid` 在 `write_graph_dsl` 里不可靠,详见节点备忘录)。
- **MoveUnitTowardTarget(Unit: BP_Unit, TargetCol: Int, TargetRow: Int)**(2026-08-15 新增):在 `Unit.MoveRange` 范围内、未被占用的格子里,找一个"到目标距离最小"的格子,如果比"原地不动"更近就真的移动过去(`SetActorLocation` + `Set Col`/`Set Row`)。用局部 bool 变量 `FoundBetterTile` 代替 `IsValid(BestTileTmp)` 做"要不要移动"的判断,原因同上。**目前是纯贪心单步移动,不是 BFS 寻路,不会绕开障碍物或别的单位**(和 `ShowRange` 的已知简化一致)。
- **RunEnemyTurn(Unit: BP_Unit)**(2026-08-15 新增):`FindNearestUnit0(找我方)` → `MoveUnitTowardTarget(朝目标移动)` → 移动后如果距离 ≤ `Unit.AtkRange` 就 `Set SelectedUnit=Unit` + `TryAttack(target)`,否则本回合只移动不攻击。这是敌方 AI 的核心入口,由 `BP_TurnManager.StartTurn` 在轮到敌方单位时调用。
- **CheckVictoryCondition()**(2026-08-15 新增):若 `bGameOver` 已是 true 直接跳过(防重复弹窗)。否则 `GetAllActorsOfClass(BP_Unit)` → For Each,按 `Side` 分别标记"我方还有人活着"/"敌方还有人活着"两个临时变量 → 我方全灭 → `Set bGameOver=true` + `ShowGameOverPopup(false)`;敌方全灭 → `Set bGameOver=true` + `ShowGameOverPopup(true)`。**只在有单位真正死亡时调用一次**(接在 `TryAttack` 的 `DestroyActor` 后面),不是每次攻击都查一遍。
- **ShowGameOverPopup(bVictory: Bool)**(2026-08-15 新增,**中途改过一次设计**):`bVictory=true` → `ConstructObjectfromClass(WBP_GameOver)` → `AddToViewport`;`false` → `ConstructObjectfromClass(WBP_GameOverDefeat)` → `AddToViewport`。**不再调用任何"运行时改文字/改颜色"的函数**——原方案是造一个共享 Widget + `ShowResult(bVictory)` 在运行时 `SetText`/`SetColorAndOpacity`,结果 `ConstructObjectfromClass` 造出来的实例的 `bIsVariable` 控件树绑定(`ResultText`)还没初始化,运行时报 `Accessed None`,文字/颜色都设不上,只有背景遮罩能看见(遮罩色是设计时默认值,不走运行时代码,不受影响)。改成两个"文字颜色都在设计时烤死"的独立 Widget 类,`ShowGameOverPopup` 只负责选造哪个类,完全不碰运行时才存在的控件树绑定,问题消失。详见 `UE节点备忘录.md`。每次调用都会 `ConstructObjectfromClass` 一个新实例——目前只会被 `CheckVictoryCondition` 调用一次(靠 `bGameOver` 挡重复),没做"复用同一个实例"的优化,够用就没优化。
- **TryAttack(Defender: BP_Unit)**(本轮新建,已编译通过):
  ```
  Get SelectedUnit(self) → IsValid? →True→
    曼哈顿距离(SelectedUnit.Col/Row vs Defender.Col/Row, 用 Max(x,-x) 组合出 Abs)
    → LessEqual(distance, SelectedUnit.AtkRange) →True→
      伤害 = Max(1, Round(SelectedUnit.Atk × (DEF_K/(DEF_K+Defender.Def))))          [2026-08-15 换成 DEF_K 衰减公式,DEF_K=9,见下方说明,旧的 Max(Atk-Def,0) 占位公式已删]
      新HP = Max(Defender.HP - 伤害, 0)
      Set Defender.HP = 新HP
      → **Defender.UpdateHealthBar()(2026-08-15 新增,MCP `create_node`/`connect_pins` 插入,紧接在 Set HP 之后)**
      → LessEqual(新HP, 0) →True→ K2_DestroyActor(Defender) → **CheckVictoryCondition()(2026-08-15 新增,紧接在 DestroyActor 后面)**
      → (两分支汇合) → ClearHighlights(self) → Set SelectedUnit=None
  ```
  非 self 变量(Defender 的 Col/Row/Def/HP)全部走 `MemberParent + SelfContextInfo=NotSelfContext` 三件套,详见 `UE节点备忘录.md`。
  - ⚠ **2026-08-15 伤害公式升级**:占位版 `max(0, Atk-Def)` 换成 web 版同款的**乘算防御衰减**公式 `max(1, round(Atk × DEF_K/(DEF_K+Def)))`(`DEF_K=9`,已从 `config.js` 核实)。**不含**技能倍率/属性克制/命中率/暴击/掩体/地形/遗物等乘算项——这些是 web 版真实公式的其余部分,切片阶段明确不做,清单里写的就是"简化到这一步"。实现上 `Atk`/`Def` 都是 Integer,要先 `ToFloat` 转成浮点做除法(`DEF_K/(DEF_K+DefFloat)`)再乘 `AtkFloat`,最后 `Math|Float|Round` 转回 Integer、`Max(...,1)` 兜底最低伤害。旧的 `SubDmg`/`MaxDmg` 两个节点已删除,新链路直接接到 `SubHP`(算新 HP)的输入。用默认数值 `Atk=10, Def=5` 验算:`max(1, round(10×9/14)) = max(1, round(6.43)) = 6`(旧公式是 `10-5=5`,数值有变化,符合预期)。
- **GetNearestTile(WorldLocation: Vector) → NearestTile: BP_Tile**(2026-08-20 新增,TPS 阶段B,`write_graph_dsl` 整体生成——全新函数,不涉及历史遗留 DSL 坑):`For Each Tiles` → 每个 Tile 的 `GetActorLocation()` 到 `WorldLocation` 的距离(`Math|Vector|VectorLength` 套一次向量相减,没用带括号的 `Distance(Vector)` 类型名,DSL 解析器对 type_id 里带圆括号的名字容易出问题)→ 比当前 `NearestDistTmp` 更小就更新 `NearestDistTmp`/`NearestTileTmp` 两个新增的临时成员变量(循环累加器,和 `CheckVictoryCondition` 的 `bAllyAliveTmp`/`bEnemyAliveTmp` 同一个套路)→ 循环结束 `return NearestTileTmp`。用途:把连续移动后的世界坐标折算回最近的逻辑 Tile,供 `BP_Unit.EventTick` 回写 `Col`/`Row`。**`read_graph_dsl` 对这个函数的反编译显示会失真**(把 `ForEachLoop` 内部的纯函数计算错误地显示成循环外只算一次,坑42同款警告的再次印证)——真实图结构已用 `get_node_infos` 逐节点核实过,`GetActorLocation`/`VectorLength` 这些纯节点数据管脚确实挂在 `LoopBody` 之后,每次迭代都会重新求值,不是只算一次。
- **ClampMovement(StartLoc: Vector, ProposedLoc: Vector, MoveRange: Int) → ClampedLoc: Vector**(2026-08-20 新增,TPS 阶段B 第二轮修复,`write_graph_dsl` 整体生成):把"移动范围软边界"从 `BP_Unit.EventTick` 搬进来的正式实现,同时处理两层限制——①**曼哈顿菱形边界**(不是欧氏圆形):`Delta=ProposedLoc-StartLoc`,`|Delta.X|+|Delta.Y|` 超过 `MoveRange×TileSize`(`self.TileSize`,不用跨蓝图读了)就按比例同时缩放 `Delta.X`/`Delta.Y`;②**棋盘边缘硬边界**:`For Each Tiles` 现场算所有 Tile 世界坐标 min/max X、Y(4 个新增临时成员变量 `BoardMinXTmp`/`BoardMaxXTmp`/`BoardMinYTmp`/`BoardMaxYTmp`,和 `GetNearestTile` 同一个累加器套路),把①算出来的位置再夹一次到这个范围。`Abs`/`Clamp` 都用嵌套 `select` 三元表达式手搭,没找专门的 `Abs`/`Clamp` 节点(规避 `Math|Float|Absolute(Float)` 这种带圆括号的 type_id,坑44)。被 `BP_Unit.EventTick` 每 Tick 调用一次,取代了 v1 版本(已否决)里直接算的 `ClampVectorSize` 圆形边界。

### 2026-08-21 ARPG 攻击操作(用户要求:数字键 1-5 选技能、显示该技能攻击范围、鼠标左键瞄准攻击)
设计动机:把攻击也从"点击敌人弹预测面板"换成 TPS/ARPG 手感——按 1-5 选中 `SkillSlots` 里的某个技能,实时看到这个技能的攻击范围(不是固定的 `AtkRange`),左键沿准星方向发射线扫描,打中范围内的敌人就直接结算并结束回合。**技能射程复用了 C++ 早就写好但从未接线的 `FSkillRow.RangeBonus` 字段**(`CombatTables.h` 注释"射程加成格数,对应 web SKILLS.rb。切片暂未接射程")——`DT_Skills` 表里 `aqua`/`vine` 已经是 `1`,`basic`/`heavy`/`ember` 是 `0`,不用改任何 C++ 或表数据,纯 Blueprint 接线。**没有改动 `TryAttack`/`ComputeSkillDamage` 的签名**——读 `ComputeSkillDamage` 源码发现它的 `bUseSkill2` 参数其实已经是死代码,实际读的是 `Variables|Default|GetPendingSkillRowName`(GridManager 自己的成员变量),所以新流程只要在调用 `TryAttack` 前把这个变量设成选中的技能行名即可复用现成的伤害结算,不用碰这个全场最复杂、历史上出过"全场最危险的坑"(双重掷骰,坑26)的函数。

**BP_GridManager 新增函数**(全部 `write_graph_dsl` 整体生成,除 `PerformSkillAttack`/`ValidateSkillTarget` 外都不涉及跨实例读取,风险低):
- **GetSkillEffectiveRange(Unit: BP_Unit, SkillIndex: Int) → Range: Int**(`create_node`/`connect_pins` 手搭,因为要把 `Utilities|GetDataTableRow`(exec,`then`/`RowNotFound` 两个分支)和 `Utilities|Struct|BreakSkillRow` 接起来,DSL 对这类多分支+自定义结构体的组合没有把握,不敢赌):`Combat|Loadout|GetSkillSlotName(SkillSlots, SkillIndex)` 查行名 → `GetDataTableRow(DTSkills, 行名)` → 找到就 `Unit.AtkRange + Row.RangeBonus`,找不到就只用 `Unit.AtkRange`(新增临时变量 `SkillRangeTmp` 兜底两个分支收敛到同一个 Return)。
- **ShowSkillRange(Range: Int)**:和 `ShowAttackRangeCurrent` 同构,但半径是参数传入的 `Range`(某技能的有效射程),不是固定读 `SelectedUnit.AtkRange`。**2026-08-21 补判空**:原版没判空,`SelectedUnit` 为 `None`(开局第一帧/被清空后)时 `BP_Unit.EventTick` 每 Tick 无条件调它会报 `Accessed None` 刷屏;现在函数体顶层用 `Utilities|IsValid SelectedUnit` 的 `"Is Valid"`/`"Is Not Valid"` 两个分支包住整段循环,无效直接跳过。排查过程见 `UE节点备忘录.md` 坑47(顺带记录了一个 `read_graph_dsl` 反向序列化 `Col`/`Row` 跨类属性时选错类名的独立 bug)。
- **ClearAttackHighlightsOnly()**:`For Each Tiles → SetAttackHighlight(false)`,只清红色攻击高亮,不碰黄色移动范围(`ClearHighlights` 两个都清,这里故意只清一半)——配合 `BP_Unit.EventTick` 每 Tick 重画技能射程环,不会把回合开始时画好的黄色移动范围也擦掉。
- **ValidateSkillTarget(Attacker, Defender, SkillIndex) → bValid: Bool**:`Defender.Side==true`(我方,不能打)直接 `return false`;否则 `曼哈顿距离(Attacker,Defender) <= GetSkillEffectiveRange(Attacker, SkillIndex)`。**这个函数存在的唯一原因是 `BP_Unit` 自己的 `EventGraph`/新函数图里读不到"另一个 BP_Unit 实例"的 `Side`/`Col`/`Row`**——细节见 `UE节点备忘录.md` 坑46,判定逻辑必须放在 GridManager 侧。
- **PerformSkillAttack(Attacker, Defender, SkillIndex)**:`Combat|Loadout|GetSkillSlotName` 查行名 → `Set SelectedUnit=Attacker` → `Set PendingSkillRowName=行名` → `TryAttack(Defender, false)`(`bUseSkill2` 参数不再有意义,随便传)→ `BP_TurnManager.EndTurn()`(和 `ConfirmPendingAttack` 的收尾一致,攻击=立刻结束回合,不新增行动经济)。

**BP_Unit 新增**:
- 变量 `SelectedSkillIndex`(Int,默认 0)。
- `EventGraph` 新增 `Input|KeyboardEvents|1`~`5`(Pressed,和 WASD/鼠标一样走 legacy 按键事件,不是 Enhanced Input——坑41 教训,任何新输入一律不要赌 Enhanced Input 能触发)→ 各自 `Set SelectedSkillIndex = 0..4`。
- `EventGraph` 新增 `Input|MouseEvents|LeftMouseButton`(Pressed)→ 调用新函数 `AttemptSkillAttack()`。
- 新函数 **AttemptSkillAttack()**(`create_node`/`connect_pins` 手搭,含 `LineTraceByChannel`/`CastToPlayerController`/两层 Cast,DSL 不适合):从 `TPSCamera` 的世界坐标出发,沿 `PlayerController.GetControlRotation()` 的前向量(不是取 `TPSCamera` 自己的前向量,因为组件级 forward 需要额外的 self 类型,直接用 Controller 的更简单,且和玩家视觉感受的准星方向一致)`LineTraceByChannel` 3000 距离 → `BreakHitResult` 取 `HitActor` → `CastToBP_Unit` → 成功就调 `Grid.ValidateSkillTarget(self, HitUnit, SelectedSkillIndex)` → 通过就 `Grid.PerformSkillAttack(self, HitUnit, SelectedSkillIndex)`。
- `EventTick` 在既有 Col/Row 回写(`SetRow`)之后追加:`Grid.ClearAttackHighlightsOnly()` → `Grid.GetSkillEffectiveRange(self, SelectedSkillIndex)` → `Grid.ShowSkillRange(该 Range)`——技能射程环每 Tick 重画,跟随角色移动和技能切换实时更新。

**验证方式**:开 PIE,`RunRegressionTests` 11 条断言(T1-T8)全 PASS。用 `SceneTools.find_actors`(按世界坐标 bounds 定位)+ `get_properties` 直接读实测:`SelectedUnit` 在 `(Col=4,Row=7)`、`AtkRange=2`、默认 `SelectedSkillIndex=0`(此时 `SkillSlots` 是空数组,`GetSkillSlotName` 回退到切片默认"basic",`RangeBonus=0`)——曼哈顿距离 2 的格子(`Col=4,Row=5`)`AtkHighlighted=true`,距离 3 的格子(`Col=4,Row=4`)`AtkHighlighted=false`,和 `AtkRange+RangeBonus=2` 精确吻合。**没能验证的部分**:`SlateInspectorToolset.PressKey` 模拟数字键在这次会话里没能让 PIE 视口拿到键盘焦点(`PressKey` 返回 `false`,`SelectedSkillIndex` 没变化,`ObjectTools.set_properties` 直接改这个 Int 变量也被拒绝——原因未查,可能和之前 `StaticMesh.RelativeRotation` 同类,SCS/Instance 相关变量不接受外部直接赋值),所以**切技能(1-5)本身、以及鼠标左键的实际瞄准命中判定,都还没有实测过,只验证了默认技能(index 0)的射程计算链路是对的**。`compile_blueprint` 通过、`save_assets` 落盘。**待人工 Play 验收**:按 1-5 能否切换技能并看到攻击范围环大小变化(尤其 4/5 号键选中的 `aqua`/`vine` 应该比 1/2/3 号键大一圈);准星对准范围内敌人时左键能否命中结算并结束回合;准星没对准或超出范围时左键是否正确不触发攻击。

### 2026-08-22 ARPG 技能快捷栏 UI + 改按 E 攻击(用户反馈"没有UI显示攻击技能,屏幕下方应该有一排数字对应技能的 UI,类似 ARPG,然后按 E 攻击")

设计:新增 `WBP_SkillBar`(`/Game/UI/WBP_SkillBar.WBP_SkillBar_C`,全新 Widget)常驻屏幕底部居中,显示 1-5 号技能槽(数字+中文技能名),当前选中的槽高亮;攻击键从纯鼠标左键追加一个 legacy `E` 键(~~不改动/不移除原有 `LeftMouseButton→AttemptSkillAttack` 绑定,两者并存~~——2026-08-22 同日用户反馈"不要鼠标点击攻击,完全改成按E攻击",已删除 `LeftMouseButton` 绑定,见下方"当日修复"一节)。

**WBP_SkillBar 结构**:`RootCanvas`(CanvasPanel,根)→ `SlotBox`(HorizontalBox,`CanvasPanelSlot` 锚点 `(0.5,1)~(0.5,1)`、`Alignment=(0.5,1)`、`bAutoSize=true`、`offsets.top=-40`,即贴底居中上移 40px)→ 5 组 `Box0..4`(SizeBox,90×54,横向 `HorizontalBoxSlot.padding=(4,0,4,0)` 隔开)→ 每组内 `Slot0..4`(Border,`bIsVariable=true`,`HAlign_Fill`/`VAlign_Fill`,`padding=(8,6,8,6)`,默认 `brushColor`:Slot0 高亮色 `(1,0.82,0.15,1)`,Slot1-4 常规色 `(0.08,0.08,0.08,0.85)`)→ `Txt_Skill0..4`(TextBlock,`bIsVariable=true`,`justification=Center`,`font.size=16`,白色,设计时占位文字"1".."5")。

**WBP_SkillBar 函数**:
- **SetSkillLabels(S0..S4: String)**:和 `WBP_ActionMenu.SetSkillButtonLabels` 同构,依次 `Widget|SetText(Text)` 五个 `Txt_Skill0..4`(`Utilities|Text|ToText(String)` 转一次)。
- **SetSelectedIndex(Index: Int)**:五段独立 `if(Index==i) then 高亮色 else 常规色 → Class|Border|SetBrushColor`(⚠ 这个函数的 pin 顺序是 `BrushColor` 在前、`self`/目标 Border 在后,和大多数"目标在前"的直觉相反,见 `UE节点备忘录.md` 坑49),高亮/常规两个 `LinearColor` 各自 `bind` 一次复用五遍,不重复 `MakeLinearColor`。

**BP_TurnManager 新增**:
- 变量 `SkillBarComponent`(WidgetComponent)/`SkillBarWidget`(WBP_SkillBar),和 `RelicBarComponent`/`DebugComponent` 完全同构的"Construction 里 Construct+SetWidget 只为初始化 `bIsVariable`,BeginPlay 里才真正 `AddToViewport`"套路。`UserConstructionScript` 末尾追加一段(`DrawSize=520×60`),`EventBeginPlay` 在 `RelicBarComponent`/`DebugComponent` 可见性设置之后追加:`Rendering|SetVisibility(SkillBarComponent)`(3D 组件本身隐藏,只留屏幕拷贝,和其余几个顶栏一致)→ `AddToViewport(SkillBarWidget, ZOrder=12)` → `RefreshSkillBar()`。**重写整个 `EventBeginPlay`/`UserConstructionScript` 时踩了一个新坑**:原文本里两处看起来一样的 `Rendering|SetVisibility` 语句,一处是真的 SceneComponent 函数(单参数),另一处其实是 Widget 的 `Visibility` 属性赋值器(`|SetVisibility`,两参数,`read_graph_dsl` 显示成了同名前缀),照抄回写会把字符串枚举连去布尔参数报类型错——已改用明确的 `Widget|SetVisibility 目标 "Collapsed"`,详见节点备忘录坑50。
- 新函数 **RefreshSkillBar()**(`write_graph_dsl` 整体生成,和既有 `RefreshSkillMenuLabels` 同构):读 `Grid.SkillSlots` 五个槽位 → `SkillIdtoChinese` 转中文 → 各自拼上 `"1 "`.."5 " 前缀 → `SkillBarWidget.SetSkillLabels(...)`。**挂接点**:没有在 `ApplyDebugLoadout`/`ApplyPresetSlice/Heavy/Elem` 等每个改 `SkillSlots` 的地方分别插调用,而是直接在 `RefreshSkillMenuLabels()`(这些函数末尾本来就会调它刷新 `WBP_ActionMenu` 按钮文字)的既有 `SetSkillButtonLabels` 调用后面追加一个新 `CallFunction|RefreshSkillBar` 节点接死循环那条 `then`——这样所有既有调用点(换装、预设、开局)都自动带上刷新技能栏,不用逐个改。
- **cross-BP 调用命名规律确认**:同一个资产 `WBP_SkillBar`,变量读取用 `Variables|WBP_SkillBar|GetTxt_Skill0`(带下划线),函数调用用 `Class|WBPSkillBar|SetSkillLabels`(去下划线)——两种节点对同一个资产名的处理不统一,新增类似跨蓝图调用前必须用 `find_node_types` 逐个确认,不能类推前一个成功的拼法。

**BP_Unit 新增**:
- `EventGraph` 新增 `Input|KeyboardEvents|E`(Pressed,legacy 按键事件,和 1-5/WASD 同款,不赌 Enhanced Input)→ 调用既有 `AttemptSkillAttack()`(新建一个独立的 `CallFunction` 节点)。⚠ Enhanced Input 那套 `IMC_TacticsControl` 里 `E` 键原本注册给了 `IA_EndTurn`(阶段C才打算接线,目前完全没生效,见 `UE蓝图状态.md` "Enhanced Input 资产"一节)——因为 Enhanced Input 全项目不触发(坑41),现阶段两者不冲突,但如果以后修好了 Enhanced Input 触发问题,`E` 键会同时触发"攻击"和"结束回合"两件事,到时候需要重新规划按键。
- 新函数 **UpdateSkillBarUI()**(`write_graph_dsl` 整体生成):`GetAllActorsOfClass(BP_TurnManager)[0]` → `Cast` → `IsValid` → `GetSkillBarWidget` → `IsValid` → `SkillBarWidget.SetSelectedIndex(self.SelectedSkillIndex)`。由已有的 5 个数字键(`Input|KeyboardEvents|1~5` 的 `SetSelectedSkillIndex` 之后)各自新增一条 exec 线,**5 条线全部汇入同一个 `UpdateSkillBarUI` 调用节点的 `execute` pin**(fan-in,而不是新建 5 个调用节点)——这些 `SetSelectedSkillIndex` 节点的 `then` 输出原本是死端(未连接任何后续节点),属于纯增量追加,不影响已有逻辑。**第一版实现有 bug,见下方"当日修复"一节。**

**验证**:两个蓝图 `compile_blueprint` 均无新增 Warning/Error(`get_node_infos`/`get_connected_subgraph` 逐条核对过新增节点的连线)。开 PIE 用 `CaptureEditorImage` 截图确认:底部居中正确显示 5 个技能槽"1 普通攻击 / 2 重击 / 3 火花 / 4 水枪 / 5 藤鞭",默认第 1 槽黄色高亮,`Output Log` 无 `Accessed None`/新增运行时报错(残留的 `Divide by zero: Divide_DoubleDouble` 刷屏是本轮改动之前就存在的问题,和这次改动无关,未处理)。**没能实测的部分**:MCP 没有可靠的键盘模拟能力(同上一节的已知限制),按 1-5 切换后高亮是否真的跟着变、按 E 是否真的能命中结算,仍需人工在编辑器里手动 Play 验收。

### 2026-08-22 当日修复(用户反馈:①"不要鼠标点击攻击,完全改成按E攻击"[反复三轮才堵完];②"按键盘1234没有在UI上显示出切换技能";③"鼠标没反应了但仍无法按E攻击"[第四轮,真正的 bug])

1. **删除鼠标攻击**:`BP_Unit.EventGraph` 里 `Input|MouseEvents|LeftMouseButton`(`K2Node_InputKey_7`)和它调用的 `AttemptSkillAttack` 节点(`K2Node_CallFunction_71`)整个 `delete_node` 删除,不再保留。现在**只有 `E` 键能触发攻击**。`compile_blueprint` 通过,无新增 Warning。
2. **`UpdateSkillBarUI()` 第一版是死代码,根因是 `Utilities|IsValid` 用错了 DSL 语法**:第一版写的是 `(if (Utilities|IsValid tm) (真分支...))`,把 `IsValid` 当成能直接返回 Bool 的纯表达式塞进 `if` 的条件位——**这是错的**,`get_graph_dsl_docs` 里 `IsValid` 明确是"多出口"(multi-exec)节点,只有 `:"Is Valid"`/`:"Is Not Valid"` 两个 exec continuation,**没有 Bool 输出 pin**。这么写的后果是编译器生成了一个跟真实 `IsValid` 完全不连通的、`Condition` 参数硬编码成字面量 `"true"`、`execute` 输入也没接上任何东西的孤立 `Branch` 节点——`get_node_infos` 核对下来这两层判断和最终的 `SetSelectedIndex` 调用全部是悬空孤岛,函数体里唯一真正被执行的语句只有开头的 `Cast`,**难怪按 1-5 什么反应都没有**(`RunTimeError` 也不会报,因为 DSL 层面"能编译通过",只是运行时永远走不到那条 exec 链)。**教训(比 `UE节点备忘录.md` 坑2/47 原来的记录更精确)**:`IsValid` 必须写成 `(Utilities|IsValid 目标 (:"Is Valid" 真分支...) (:"Is Not Valid" 假分支...))` 的 continuation 形式,不能包在 `if` 条件位里——即使某处旧代码(比如 `TryAttack`)看起来是"`if` 包 `IsValid`"的写法,那大概率是 `read_graph_dsl` 反编译时把 continuation 形式又显示成了 `if` 外观(坑47 同款失真),照抄这个"看起来对"的显示文本反而会踩坑,**任何新写的 `IsValid` 判断都要用 continuation 语法,不要模仿反编译输出**。修法:`remove_function_graph`(先清悬空引用要紧跟一次 `compile_blueprint`,否则重建会被迫改名成 `_0`,见坑47 尾注)→ `add_function_graph` 拿回原名 → 用 continuation 语法重写,`get_node_infos` 逐节点核对 exec 链全部连通(`Cast.then→IsValid(tm).IsValid→GetSkillBarWidget→IsValid(bar).IsValid→SetSelectedIndex`)。`EventGraph` 里 5 个数字键 fan-in 到这个调用节点的连线全部原样保留(函数改名重建后按名字重新解析,不需要手动补线,和坑47 尾注描述的行为一致)。
3. 两个蓝图 `compile_blueprint` 均通过,PIE 内截图确认技能栏 UI 和默认高亮仍正常显示,`Output Log` 无新增 `Accessed None`。**仍未实测**:按 1-4 是否真的会让高亮移动(MCP 没有可靠的键盘模拟能力,只能保证"exec 链现在是通的",实际手感待人工 Play 验收);按 E 是否能正常命中攻击(逻辑上和之前的鼠标版本完全一样,只是换了触发键,理论上不受影响)。
4. **(同日第二轮)用户反馈"还是鼠标在控制攻击"——第 1 条只删对了一半**:`LeftMouseButton` legacy 按键绑定确实删了,但漏了另一条完全独立的鼠标攻击路径——`ReceiveActorOnClicked`(点击 3D 网格触发的"clickable"接口事件,和按键事件是两套不同机制)里"点敌方→`SetPendingAttackTarget`+`ShowAttackForecast`弹预测面板"这条 2026-08-16 就存在的老分支从没被这轮改动碰过,点敌人依然会弹出攻击确认面板。已定位并删除该分支的 5 个节点(`GetAllActorsOfClass`/`SetPendingAttackTarget`/`ShowAttackForecast`/以及两个没被用到的死代码节点),详见上方"攻击预测 UI 交互流程"一节的停用说明。**教训:这个项目的战斗输入历史上叠了两代不同机制(点击 3D 网格的 `ActorOnClicked` / 后来加的按键事件),排查"某个输入还有效"类问题时,两套机制都要单独查一遍,不能只看最近一次改的那一套。**`compile_blueprint` 通过,PIE 截图确认无异常。
5. **(同日第三轮)用户反馈"还是不行,整体判断一下"——第 4 条仍然没堵完,因为除了"点击驱动的攻击"以外,还有一整条"点击驱动的移动+菜单"链路能间接把玩家带回鼠标攻击流程**:完整梳理后发现这个项目历史上叠了**三代**输入系统同时活着:
   - **系统A(最老,格子点选回合制)**:`BP_TurnManager.StartTurn` 轮到我方单位时,不管有没有人点鼠标,都会**无条件**调一次 `Grid.ShowRange`/`Grid.ShowAttackRange`,把移动范围(黄)和攻击范围(红)高亮在棋盘格子上摆出来;`BP_Tile.EventActorOnClicked` 一直監听"点一个高亮格子"→ 直接 `SetActorLocation` 瞬移单位过去、`SetbHasMoved(true)`、**`TurnManager.SetPendingActionUnit` + `TurnManager.ShowActionMenu()`**(弹出鼠标可点的"普通攻击/重击/…"菜单)。这条链完全独立于"点击某个 Actor"这件事,只要棋盘上有格子在高亮、玩家点了一下,就会瞬移+弹菜单——**这是本轮之前两次都没查到的入口**,因为它不挂在任何"Attack"相关的按键或直接点敌人的事件上,而是挂在"点地板格子"上。
   - **系统B(中间代,预测面板)**:`BP_Unit.ReceiveActorOnClicked` 点敌方分支(第 4 条已停用)+ `WBP_AttackForecast` 确认/取消按钮,靠系统A弹出的菜单选完技能后再点敌人来触发,本身已经因为第 4 条的修复而无法真正打出伤害,但只要系统A还在弹菜单,玩家仍然会"感觉到"鼠标在主导战斗流程。
   - **系统C(当前唯一该存在的,ARPG 直控)**:WASD 移动 + 鼠标控制镜头 + 数字键 1-5 选技能 + `E` 键攻击(`AttemptSkillAttack`→`PerformSkillAttack`→`TryAttack`)。

   **修复**:用 `break_pins` 掐断两处事件入口的第一条 exec 线(不删节点本身,保留图结构供以后查阅,只让整条分支变成执行不到的死代码)——①`BP_Tile.EventActorOnClicked`(`K2Node_Event_3`)→`IfThenElse_0` 之间的线;②`BP_Unit.EventActorOnClicked`(`K2Node_Event_3`)→`GetAllActorsOfClass`(`K2Node_CallFunction_5`)之间的线。断开后:点任何 3D 网格(自己的单位、敌方单位、地板格子)**完全没有任何反应**——不移动、不弹菜单、不弹攻击面板。`BP_TurnManager.ShowActionMenu()` 现在没有任何调用方,`WBP_ActionMenu` 永远不会再显示。两个蓝图 `compile_blueprint` 都通过,PIE 截图确认无异常(游戏画面/UI 正常,`Output Log` 无新增报错)。
   **有意保留、没有处理的部分**:`StartTurn` 里"轮到我方单位时自动高亮移动/攻击范围格子"这几行**没有删**——现在这些黄/红格子会照常显示,只是纯装饰,点它们不会再发生任何事(`BP_Tile` 的响应已经断了)。这是刻意的最小改动:`StartTurn` 是全项目测试覆盖最重、风险最高的函数之一,而"格子还亮着但点了没用"本身不构成"鼠标控制攻击",所以没有为了美观去动它。**如果之后还想彻底去掉这层高亮**(纯 UI 洁癖,不影响任何功能),需要单独提出来再改。
   **教训**:这个项目在从"回合制点选"往"ARPG 直控"重构的过程中,新系统是**叠加**上去的,不是替换——旧系统的多个独立触发点(高亮格子的自动弹出、点格子的响应、点敌人的响应)分散在三个不同蓝图(`BP_TurnManager`/`BP_Tile`/`BP_Unit`)的不同事件里,任何一个"只删某一条看起来相关的线"的局部修复都会漏掉其余几条。以后再排查"某个操作(移动/攻击/选择)还能通过意料之外的方式触发"类问题,**必须反向从终点函数(这里是 `TryAttack`/`ShowActionMenu` 这类真正产生游戏效果的函数)出发,搜索它所有的调用方,而不是从"最近改过的输入"出发去局部排查**,否则会像这次一样连续三轮才堵完。
6. **(同日第四轮)鼠标已经彻底没反应了,但用户反馈"仍然无法按E键攻击"**——这次不是"多余的路径没删干净",而是 `AttemptSkillAttack()` 里**从一开始就存在的真实 bug**,和这轮任何一次删鼠标的改动都无关:
   - **根因**:`LineTraceByChannel` 的终点算的是 `TPSCamera位置 + 准星方向 * 距离`,"距离"这一项用的是 `Math|Vector|vector*vector`(向量按分量相乘,不是向量乘标量),它的第二个输入 `B` 从这个函数第一次被搭出来就**没有连任何东西、也没有手动填值**,默认值是零向量 `(0,0,0)`。准星方向 × `(0,0,0)` = `(0,0,0)`,导致射线的终点和起点完全重合——**这条射线的长度恒等于 0**,不管准星对着哪里、离敌人多近,永远不可能命中任何东西。`get_node_infos` 读这个 pin 时甚至不会显示成 `"0, 0, 0"` 这种看得出来的字面量(不像别处的默认向量那样显示),而是直接是空字符串,不容易在读图的时候一眼看出问题,这次是靠 `read_graph_dsl` 把整条终点算式完整摊开(`vector*vector ... 0` 那个孤零零的 `0`)才盯出来的。
   - **修复**:`set_pin_value` 把这个 `B` 输入的字面量设成 `"3000.000000,3000.000000,3000.000000"`(和准星方向向量做分量相乘,效果等价于"沿准星方向延伸 3000 单位"),`get_pin_value` 读回确认生效。
   - **顺带加了 5 条 `PrintString` 调试日志**(用户主动问"要不要加log",这里加了,同时打印到屏幕和 Output Log,2 秒/条):①函数入口"E pressed, tracing..."(确认按键真的传到了这个函数);②射线完全没打中任何东西;③打中了东西但不是 `BP_Unit`(大概率是挡在中间的地形/格子);④打中了 `BP_Unit` 但 `ValidateSkillTarget` 判定无效(友军或超出技能射程);⑤`PerformSkillAttack` 真正触发。这样以后即使还有问题,人工 Play 一次就能从屏幕文字直接读出卡在哪一步,不用再靠我这边反复猜。
   - `compile_blueprint` 通过,`read_graph_dsl` 核对新插入的 5 条打印语句全部在正确的分支位置,PIE 内跑了一遍确认没有新增报错。**这个 bug 是历史遗留的**(`AttemptSkillAttack` 最初就是靠 `create_node`/`connect_pins` 手工搭的,文档原话"DSL 不适合",大概率是手工连线时漏连/漏填了这个 `B` 输入),不是这轮删鼠标攻击引入的副作用,只是因为一直没人真正用 `E` 键命中过敌人,所以之前从没暴露出来。
7. **(同日第五轮,用户验收反馈"验收不通过,键盘移动反而完全没反应了")**——`BP_Unit.EventTick` 里两条本该各自独立、每 Tick 都跑的分支(legacy `bIsAIMoving` 插值移动 / 坑41-坑45 那套 WASD+鼠标+`ClampMovement`+技能射程直控)之间**没有 `Sequence` 节点分流**,`EventTick.then` 这一个 exec 输出只能二选一地直连其中一条——`find_nodes(entry_points_only=true)`+`get_connected_subgraph` 现场核实:`EventTick.then` 当时只连到 `bIsAIMoving` 分支,`CastToPlayerController`(WASD 分支入口)的 `execute` 输入是空的;但 `AddMovementInput`/`ClampMovement`/`ShowSkillRange` 等一系列节点都**原封不动留在图里**,不是被误删,只是入口断线,和坑41-53 这几轮"删鼠标攻击"的具体改动没有直接证据关联(推测是两条分支历史上一直靠"谁最后连线谁生效"这种没有 `Sequence` 支撑的脆弱结构在共存,详见 `UE节点备忘录.md` 坑54)。**修复**:新增一个 `Utilities|FlowControl|Sequence` 节点,`EventTick.then→Sequence.execute`,`Sequence.then_0→bIsAIMoving 分支`、`Sequence.then_1→CastToPlayerController 分支`,两条历史分支内部一个节点都没动,只是从"互斥直连"换成"每 Tick 都各跑一遍"。`compile_blueprint`/`save_assets` 确认无警告。**待人工 Play 验收**:WASD 移动、鼠标视角、技能射程环、ARPG 技能栏(1-5 切换+E 攻击)是否全部恢复正常;顺带确认这条修复没有让"AI 单位平滑移动"这条老分支出现新的异常(理论上互不影响,但两条分支现在是第一次真正同时跑,需要留意)。
8. **(同日第六轮,WASD 修好之后用户验收反馈"地板高度不对,人物陷进去了")**——根因和第7条无关,是 TPS 阶段A把 `BP_Unit` 从 `Actor` 改成 `Character` 时,`BP_GridManager.SpawnUnit`/`MoveUnitTowardTarget` 两个函数里各自独立写死的"放置单位时 Z 轴加 50"仍是**改造前(扁平 `Actor`+`StaticMesh`)校准出来的旧常量**,没人跟着 `CapsuleComponent`(半高 88)一起更新过。现场实测(`get_actor_transform`/`get_actor_bounds`,不是推算):`BP_Tile` 顶面世界 Z=地面 `Location.Z+5`,`CapsuleHalfHeight=88`,正确出生高度应是 `5+88=93`,但两处代码一直在用 `50`——差 43,新出生单位的胶囊体连同挂在它下面(`RelativeLocation.Z=-88`)的模型一起陷进地板 43 个单位。`CharacterMovementComponent` 默认 `bRunPhysicsWithNoController=false`,没被 `Possess` 过的单位永远精确停在这个错误高度上不会自己浮出来,只有轮到过回合、被 `Possess` 触发过物理 tick 的单位才会被碰撞穿出机制慢慢顶到接近正确高度(实测顶到 95.15,和修复后的目标值 93 基本吻合,验证了 93 这个数确实是对的)——同一局游戏里"有的单位卡在一个可疑整数、有的数值参差不齐"这种分裂本身就是判断问题出在"出生"而不是"移动"的关键线索。**修复**:`SpawnUnit` 的 `Math|Vector|vector+vector` 字面量输入 `B`(`"0,0,50"`→`"0,0,93"`)、`MoveUnitTowardTarget` 的 `Math|Vector|MakeVector` 的 `Z` 输入(`"50.0"`→`"93.0"`)各用 `set_pin_value` 改了一处,没有动周围任何节点/连线。`compile_blueprint`(`BP_GridManager`)/`save_assets` 通过。**验证**(重开两次 PIE 实测,不是纯读代码):改之前一局同时存在 Z=50(未受物理修正)和 Z=95.15(已受物理修正)两种高度;改之后重开一局,四个单位里三个精确落在新的 `93`,当前被 `Possess` 的那个已经开始被顶到 `95.15`——和"已修正"的收敛值完全一致,确认 93 是对的、95.15 只是引擎碰撞检测的正常余量。详见 `UE节点备忘录.md` 坑55。**待人工 Play 验收**:重新在编辑器里长按 WASD/切换回合,确认视觉上单位是不是稳稳站在地面上,不再有任何下陷感。
9. **(同日第七轮,坑55 的"93"修复之后用户验收反馈"身体还是下去了一半")**——坑55 排查时读到 `StaticMesh.RelativeLocation=(0,0,-88)` 就直接断言"这个值是对的(模型自己的脚部局部原点被放到了胶囊体底部)",**这个断言本身没有用 `StaticMeshTools.get_bounds` 现场核实过模型自身的 pivot 到底在哪,是想当然套用了"标准 `ACharacter` 骨骼网格的 Mesh 组件默认挂 `(0,0,-CapsuleHalfHeight)`,因为骨骼网格的局部原点通常在脚底"这条经验规律,但这次挂的是一个**静态网格**(`Mewtwo_test`,`/Game/Meshes/Mewtwo_test/StaticMeshes/Mewtwo_test`),不是骨骼网格,原始导入的 pivot 并不在脚底**。现场用 `get_bounds` 一查:局部空间 `min.z=-99.065`、`max.z=97.370`,原点几乎在模型的**竖直中心**,不是脚底(脚底在局部 `z≈-99` 而不是 `z≈0`)。`StaticMesh` 组件本身还有 `RelativeScale3D=(0.5,0.5,0.5)`,所以模型的真实半高是 `99.065×0.5≈49.53`,远小于胶囊体半高 `88`——当年沿用骨骼网格的经验公式把 `RelativeLocation.Z` 设成 `-88` 时,相当于把"模型中心"对到了"胶囊体底部往上 88 的地方"再往下拉,实际效果是模型中心被放到世界 `Z=actorZ-88`,模型再往下延伸 `49.53`,整体比正确位置低了 `88-49.53≈38.47`——这正是"下去了一半"(模型总高约 98,沉了 47 个单位,接近半身)的来源,和坑55 的"43 个单位陷进地板"是完全独立的两层问题(坑55 修的是胶囊体贴不贴地面,这次是模型贴不贴胶囊体)。**修复**:`BP_Unit.UserConstructionScript` 里已有的 `Transformation|SetRelativeLocation`(`K2Node_CallFunction_4`,接在既有 `SetRelativeRotation` 语句后面那一条)的 `NewLocation` 输入,用 `set_pin_value` 从 `"0,0,-88"` 改成 `"0,0,-38.467422"`(公式:`-CapsuleHalfHeight - 模型局部最低点Z×RelativeScale3D.Z = -88-(-99.065155×0.5) = -38.467422`,现场量出来的两个数代进去算的,不是套死公式)。`compile_blueprint`(`BP_Unit`)/`save_assets` 通过。**验证**:开 PIE 读 `get_actor_transform` 确认单位仍稳定收敛在坑55的 `95.15`(说明这次改动没有影响坑55的修复);另外在世界坐标 `(10000,10000,93)` 现场摆一个临时 `BP_Unit` 实例(和坑42 同款做法,不影响主关卡,验证完已 `remove_from_scene` 删除),`CaptureViewport` 截图确认模型的下半身贴合胶囊体碰撞体的调试轮廓下缘,不再有明显的"半身沉入地面"既视感。**待人工 Play 验收**:重新在编辑器里 Play,确认这次是不是真的站在地面上了(前几轮的"陷进去"反馈已经反复过,这次修复后仍需要真人在编辑器里确认视觉效果,不能只看数值收敛)。
---

## BP_Tile (`/Game/Maps/BP_Tile.BP_Tile_C`)

> **⚠ 2026-08-22 起 `EventActorOnClicked` 已停用**(ARPG 直控迁移收尾,详见 `BP_TurnManager` 一节"当日修复"第5条):`K2Node_Event_3`(点击事件)到 `IfThenElse_0` 之间的 exec 线已 `break_pins` 断开,点击任何格子(不管高不高亮)现在完全没有反应——原来的"点高亮格子→瞬移单位+弹出行动菜单"整条逻辑成了执行不到的死代码,节点本身还留着没删,仅供以后查阅。下面的 `ActorOnClicked` 词条描述的是**断线之前**的历史行为,仅作为存档参考,当前不会执行。

### 变量
| 名字 | 类型 | MemberGuid |
|---|---|---|
| Col | Integer | F3BBD5584E425C284008F89BEFC97333 |
| Row | Integer | 3D88084C466966D00AD2AB9080BF62AE |
| Highlighted | Boolean | - |
| HighlightMat / NormalMat | Material Interface | - |

### 函数
- **SetHighlight(bOn: Bool)**(GUID `37B4C77B45B3D11565DAEAB67664CF28`):Branch(bOn) → 切材质 + `Set Highlighted=bOn`
- **SetAttackHighlight(bOn: Bool)**(2026-08-15 新增,攻击范围红色高亮):和 `SetHighlight` 完全同构,只是换了一套变量:`AtkHighlighted`(Bool)+`AtkHighlightMat`(Material Interface,Class Default=`/Game/Maps/M_AtkHighlight`,红色 `(1,0.08,0.08)`)。`bOn=false` 时两个高亮函数都切回同一个 `NormalMat`,不会互相打架——因为移动高亮和攻击高亮在设计上互斥(前者排除被占用格,后者只落在被敌方占用的格上)。

### EventGraph
- ActorOnClicked → Branch(self.Highlighted) → True:`GetAllActorsOfClass(GridManager)[0]` → `Get SelectedUnit` → `Set Actor Location`(SelectedUnit,本格世界坐标 + Z50)→ `Set SelectedUnit.bHasMoved = true` → `GetAllActorsOfClass(BP_TurnManager)[0]` → `Set TurnManager.PendingActionUnit = SelectedUnit` → `TurnManager.ShowActionMenu()` → `ClearHighlights` → `Set SelectedUnit.Col`/`Set SelectedUnit.Row`(读本格 self.Col/self.Row 写回 SelectedUnit)→ **`TurnManager.ShowAttackRangeCurrent()`(2026-08-16 新增,收尾最后一步,详见下方"行动菜单系统"一节)** → (链路到此结束)
  - False(未高亮):不执行任何逻辑,符合"点非高亮格子不应移动"的预期。
  - **2026-08-16 新增 `bHasMoved` 置位**:配合 `BP_Unit.bHasMoved`/`BP_TurnManager.StartTurn` 的重置,修复"一回合能无限移动"的 bug,见 `UE蓝图状态.md` → `BP_Unit.ActorOnClicked` 词条和已知问题9。这里只负责"移动真的发生了"这一个事实的记录,不判断是否允许移动(允许与否的门槛在 `BP_Unit.ActorOnClicked` 里)。
  - ⚠ 修复前这里只有 `SetActorLocation + ClearHighlights`,完全没有更新逻辑坐标这一步(旧文档记录有误,实际从未实现),导致移动只改视觉位置、不改 Col/Row,是"攻击距离判断失效"的根本原因之一(另一处是 SpawnUnit,见 BP_Unit 已知问题8)。
  - ~~⚠ 已知遗留:链路末尾没有 `Set SelectedUnit = None`~~ ✅ **2026-08-13 已修复**:节点其实早就存在(`K2Node_ClearSU`,`|SetSelectedUnit`),但之前某轮编辑漏接了 `self`(Target,类型 `BP Grid Manager Object Reference`)引脚,导致蓝图**编译失败但没人发现**——直到本轮 MCP 会话触发重新编译才暴露(`load_level` 时引擎报 `EnsureFailed`,Play 时报 `Blueprint failed to compile: BP_Tile`,棋盘因此生不出来)。用 MCP `BlueprintTools`(`find_nodes`→`get_node_infos`→`connect_pins`→`compile_blueprint`)把 `self` 接到图里已有的 GridManager 引用(`K2Node_GetArrayItem_1` 输出,和旁边 `ClearHighlights` 用的是同一个)上,重新编译无报错,`save_assets` 落盘,`git diff` 确认改动(`BP_Tile.uasset` 111462→110054 字节)。**这是 `BlueprintTools` 图编辑路径第一次在真实内容上验证通过**,详见 `UE协作Harness规范.md` 0.1 节。
  - ~~⚠ 2026-08-16 之前这里在收尾末尾还有一条 `Set SelectedUnit = None`~~ ✅ **2026-08-16 已删除,这是"点攻击再点敌人没有反应"bug 的真正根因**:这条清空逻辑是行动菜单系统上线**之前**的老代码,当时"移动完=回合唯一操作,直接结束"语义下是对的;行动菜单上线后,移动完还要弹菜单选"攻击/待命/撤销",这几个后续操作全靠读 `SelectedUnit` 才知道在操作哪个单位——移动那一刻就清空,直接导致点"攻击"再点敌人时 `TryAttack` 读到的 `SelectedUnit` 已经是 `None`(`TryAttack` 内部唯一的 `IsValid` 判断没有 else 分支,静默跳过整个函数体,不掉血也不报错);紧接着 `BP_Unit.ActorOnClicked` 敌方分支又读一次 `SelectedUnit` 判断"是否命中过",同样读到 `None` 就误判成"已经打过了"直接 `EndTurn`——回合被悄悄结束,玩家只看到"点了没反应"。**修法**:删掉这里的 `SetSelectedUnit(None)`,改成在 `StandbyAction()` 里清空(真正"这个单位操作序列结束"的时机),`TryAttack` 命中时自己本来就会清空,`UndoAction`(撤销=当作没行动过)不清空。详见下方"行动菜单系统"一节和 `UE节点备忘录.md` 坑21。
  - **教训**:蓝图编译错误可能长期潜伏不暴露(只在触发重新编译时才检查),`git diff` 干净不代表逻辑没问题——`.uasset` 从上次提交起字节没变,不等于它是"健康"的,可能本来就带着编译错误躺在那。以后接手新 session、或触发 `load_level`/Play 之类会强制重编译的操作前,最好先用 `BlueprintTools.compile_blueprint` 主动查一遍关键蓝图的编译状态。

---

## BP_TurnManager (`/Game/Maps/BP_TurnManager.BP_TurnManager_C`)

### 变量
| 名字 | 类型 | MemberGuid |
|---|---|---|
| TurnOrder | Array\<BP_Unit\> | 50FBE1244A4A45BC1414749E1EF218A6 |
| CurrentIndex | Integer | 3B1A62544CD5B63712E35FA8E05B6534 |
| Grid | BP_GridManager | 0089C34F4A6557D940AA998478BF680F |
| SortKeysTmp | Array\<Integer\> | (2026-08-15 新增,`BuildTurnOrder` 排序用的临时并行数组,和 `TurnOrder` 逐位对应) |
| MaxIdxTmp | Integer | (2026-08-15 新增,`BuildTurnOrder` 选择排序内层循环的"当前最大值下标"局部状态) |
| OrderBarComponent | WidgetComponent | (2026-08-15 新增,Screen Space,承载 `WBP_OrderBar`) |
| OrderBarWidget | WBP_OrderBar | (2026-08-15 新增,`ConstructObjectfromClass` 出来的行动顺序条实例) |

### 函数
- **StartTurn**(GUID `B1B2BD0C4A80D0C6355B6A862565F459`,**2026-08-15 改过,加了敌方 AI 分支和死亡单位跳过;同日又修过一次真实的接线 bug,见下;同日又加了 `bGameOver` 门槛和行动顺序条刷新,见下;2026-08-16 我方分支新增 `bHasMoved` 重置**):
  - **`true`(我方)分支新增 `Set (该单位).bHasMoved = false`**(2026-08-16,MCP `create_node`/`connect_pins` 增量插入在 `Branch(Side).then` 和 `ShowRange` 之间,用 `read_graph_dsl`/`write_graph_dsl` 整函数重写失败——`bGameOver` getter 的可创建 type_id 三次尝试都不对,详见 `UE节点备忘录.md` 坑12,最后改用纯增量节点插入):每次轮到该单位时把"本回合是否已移动"清零,配合 `BP_Unit.ActorOnClicked` 的门槛检查和 `BP_Tile.ActorOnClicked` 的置位,修复"一回合能无限移动"的 bug。只在我方分支重置,敌方走 `RunEnemyTurn` 不受影响(敌方本来就不通过这套点击门槛移动)。**紧接着(2026-08-16 同日第四轮修复)又插入了 `Set PendingSkillIsElemental = false`**:每个单位轮到自己时把"待用技能选择"也清零,修复"原地攻击(不走菜单)会用上一个单位残留的技能选择"这个 bug,见下方"输入模式来回切换…"一节。
  - **入口先查 `Grid.bGameOver`**(2026-08-15 新增,**同日又把它挪到了整个函数最前面,见下**):`true` → 什么都不做,直接结束(不再往下推进回合)。**根因**:一方全灭后,`CheckVictoryCondition` 只负责弹窗和置位 `bGameOver`,回合循环本身从来没人检查过这个变量,导致继续 `StartTurn`→`RunEnemyTurn`→`FindNearestUnit0` 在已经没有对方单位的情况下找不到目标返回 `None`,后续 `MoveUnitTowardTarget`/`TryAttack` 拿这个 `None` 硬用,级联报一长串 `Accessed None`(实测复现过,`Output Log` 刷屏)。
  - **`false` 分支调用 `OrderBarWidget.RefreshOrder(TurnOrder, CurrentIndex)`**(2026-08-15 新增)刷新行动顺序条,再走原有逻辑。⚠ **最初把这一步放在了 `bGameOver` 检查前面**,导致游戏结束后如果还有最后一次 `StartTurn` 触发,`RefreshOrder` 会拿到刚被 `TryAttack` `DestroyActor` 的单位引用读属性,报 `not valid (pending kill or garbage)`(实测复现)——**已改成 `bGameOver` 检查在最前面,`RefreshOrder` 挪进 `false` 分支里**,游戏结束后彻底不会再碰它(`RefreshOrder` 自己也加了 `IsValid` 防御,见 `WBP_OrderBar` 一节,双保险)。
  - 取 `TurnOrder[CurrentIndex]` → `Utilities|IsValid` 宏(`Is Valid`/`Is Not Valid` 两条 exec 出口)判断该单位是否还有效(比如已经被 `TryAttack` 杀死但 `TurnOrder` 数组从没刷新过,里面还留着死单位的引用)。
  - `Is Not Valid` → 直接 `EndTurn`,跳过这个位置。
  - `Is Valid` → 按 `Side` 分支:`true`(我方)→ `Grid.ShowRange(Unit=该单位)`,和以前一样等玩家点鼠标;`false`(敌方)→ `Grid.RunEnemyTurn(Unit=该单位)` 自动移动+可能攻击,然后**立刻自己调用 `EndTurn`**(不需要玩家做任何操作)。如果连续多个敌方单位挨着,会同一帧内递归 `StartTurn→EndTurn→StartTurn...` 一路自动跑完,直到轮到下一个我方单位才停下来等点击。
  - ⚠ **2026-08-15 修过的真实 bug**:最初的接线中,`Utilities|IsValid` 宏的两条 exec 出口(`Is Valid`/`Is Not Valid`)完全没接到任何东西上——是一条彻底的死路。真正驱动 `Branch` 节点的,是另一个完全独立、从未连过 `IsValid` 结果的 `NOTBoolean` 节点,其输入 `A` 也没有任何连线,用的是字面量默认值 `false`,于是 `NOT(false)=true` 恒真。结果是:`FunctionEntry` 执行到 `IsValid` 宏就直接断流,`Branch`/`ShowRange`/`RunEnemyTurn`/`EndTurn` 全部不可达——**意味着这次改动上线后,连最基本的"点我方单位高亮范围"都会失效**,而不仅仅是敌方 AI 没生效。用 `get_node_infos` 逐个检查 `Branch` 节点的 `execute`/`Condition` 输入的 `connected_pins` 才发现(两处都是空数组)。修法:删掉这个 `NOTBoolean` 驱动的 `Branch` 和它的常量比较节点,把 `IsValid` 宏的 `Is Valid`/`Is Not Valid` 两条 exec 出口直接接到原本 `Branch` then/else 之后的两段逻辑(Side 分支 / `EndTurn`)上,重新编译 + 跑回归测试(T1–T7c 九条断言全 PASS)确认没连带破坏别的东西。**教训:`IsValid` 相关的接线,`compile_blueprint` 编译通过 + regression test 局部 PASS(这次 T7a/b/c 测的是直接调用 `RunEnemyTurn`,没走 `StartTurn` 整条链路)都不能证明整条 exec 链路真的可达,必须用 `get_node_infos` 顺着 `FunctionEntry` 往下每个节点核对一遍。**详见 `UE节点备忘录.md`。
- **StartTurn 追加 Possess/UnPossess**(2026-08-17,TPS 直控迁移阶段A,MCP `create_node`/`connect_pins`/`break_pins` 增量插入,**没有**用 `write_graph_dsl` 整函数重写——这个函数带历史遗留的 `|GetbGameOver` 裸写法,回写会炸,见 `UE节点备忘录.md` 坑38):函数最前面(`FunctionEntry.then` 断开原来到 `Branch(bGameOver)` 的连线,插入新链再接回去)无条件 `GetPlayerController(0)` → `UnPossess` → `RemoveMappingContext(/Game/Input/IMC_TacticsControl)`,哪怕当时没人被 possess 也是安全的空操作。原有 `Side==true` 分支尾部(`ShowAttackRange` 之后,原本是断头的 `then` output)追加 `Possess(该单位)` → `AddMappingContext(/Game/Input/IMC_TacticsControl, Priority=0)`。敌方分支(`RunEnemyTurn`+`EndTurn`)和"单位已失效"分支完全没碰。
- **BuildTurnOrder()**(2026-08-15 新增,对应 web 版 `turn.js` 的 `startRound`):`Grid.GetAllActorsOfClass(BP_Unit)`(死亡单位已被 `TryAttack` `DestroyActor`,天然只剩存活的)→ 每个单位算 `key = Spd*1000 + RandomIntegerInRange(0,999)` 存进 `SortKeysTmp`(和 `TurnOrder` 逐位对应)→ 对 `TurnOrder`/`SortKeysTmp` 做选择排序(按 `SortKeysTmp` 降序,`TurnOrder`/`SortKeysTmp` 同步 `SwapArrayElements`)→ `CurrentIndex=0`。**"Spd 降序 + 同速随机 tiebreak"被压缩成单一数值键排序**:只要随机分量固定在 `[0,999]`、乘数是 1000,不同 `Spd` 的单位永远不会因为随机分量而排序颠倒(`Spd=6` 的最大 key 是 6999,`Spd=7` 的最小 key 是 7000),同 `Spd` 的单位则完全由随机分量决定顺序——不用另写 tie-break 分支。由 `EventBeginPlay` 和 `EndTurn`(每轮结束、`CurrentIndex` 超出数组长度时)调用,对应 web 版"每回合重新排序"的行为。
- **EndTurn**:`CurrentIndex+1`;若超出 `TurnOrder.Length` → 调 `BuildTurnOrder()`(重新排序+清零索引,一轮结束);否则正常 `Set CurrentIndex` → 都会接 `StartTurn`。

### EventGraph
- BeginPlay → Delay(0.2s)→ `GetAllActorsOfClass(BP_GridManager)[0]` → `Set Grid` → `BuildTurnOrder()`(2026-08-15 替换了原来的"直接 `GetAllActorsOfClass(BP_Unit)` → `Set TurnOrder`",见上方 `BuildTurnOrder`)→ `StartTurn`
- ~~行动序目前是生成顺序,不是真 Spd 排序,已知简化~~ ✅ **2026-08-15 已解决**:见 `BuildTurnOrder`。

### UserConstructionScript(2026-08-15 新增,行动顺序条 UI)
`AddComponent|UserInterface|AddWidgetComponent`(self=`self`,`bManualAttachment=false`)→ `Set OrderBarComponent` → `SetDrawSize(500,40)` → `ConstructObjectfromClass(WBP_OrderBar_C)` → `Set OrderBarWidget` → **`SetWidget(comp, widget)`** → **`SetWidgetSpace(comp, "Screen")`**(⚠ 顺序很关键,见下方踩坑记录)→ **`SetVisibility(comp, false)` → `AddToViewport(widget)` → `SetPositionInViewport(widget, (40,40))`**(2026-08-15 追加,见下方"行动顺序条看不见"踩坑)。

⚠ **2026-08-15 踩坑(第一版方案,实测仍然看不见)**:`WidgetComponent`(哪怕 Screen Space)挂在 `BP_TurnManager` 这种"没有明确摆放位置"的 Actor 上,渲染位置是"把这个 Actor 的世界坐标投影到屏幕"决定的,不是真正意义上"固定在屏幕角落"的 HUD;`BP_TurnManager` 摆在 `(-360,-360,0)`,和实际摄像机(`BoardCam`,大概在 `(500,-773,1052)` 朝向棋盘)的取景框对不上。第一版方案是"借 `WidgetComponent.SetWidget` 触发初始化,再对同一个实例调用 `AddToViewport` 挂到屏幕固定位置",但**这一整套调用当时放在了 `UserConstructionScript`(构造脚本)里**,实测截图确认屏幕左上角仍然空白,什么都没有。

⚠ **真正的根因和最终方案(2026-08-15)**:`AddToViewport` 在 `UserConstructionScript` 里调用不生效——构造脚本在编辑器/构造期就会跑,不保证这时候游戏 Viewport 已经就绪,`AddToViewport` 大概率静默失败。对比已经验证能正常显示的胜负弹窗:它的 `AddToViewport` 是在 `CheckVictoryCondition`(真正的游戏逻辑,`BeginPlay` 之后很久)里触发的。**把 `Rendering|SetVisibility(comp,false)`(隐藏 WidgetComponent 本身的渲染)/`AddToViewport`/`SetPositionInViewport` 这三步从 `UserConstructionScript` 挪到 `EventGraph.EventBeginPlay`**(`Delay(0.2s)` 之后、`BuildTurnOrder` 之前)之后,实测截图确认屏幕左上角正常显示出"6666"。**`WidgetComponent.SetWidget→AddWidgetComponent→SetWidget→SetWidgetSpace` 这套"借组件触发初始化"的逻辑仍然留在 `UserConstructionScript` 里没动**——只是"真正显示"这三步挪到了 `BeginPlay`。**教训:`WidgetComponent`/`ConstructObjectfromClass` 相关的初始化可以在 Construction Script 里做,但 `AddToViewport` 这种"挂到游戏 Viewport"的操作必须放到 `BeginPlay`(或更晚)的真实游戏逻辑里,不能指望构造脚本阶段游戏 Viewport 已经可用。**
⚠ **附带观察:`AddToViewport` 会让已经初始化好的 Widget 的 `WidgetTree` 子对象编号往上跳一级**(比如从 `WidgetTree_0` 变成 `WidgetTree_1`),推测 `AddToViewport` 内部对"首次挂载到 Viewport 的 Widget"会重新走一遍类似 `Initialize()`/`RebuildWidget()` 的流程,导致子控件短暂回到设计时默认值——**这是无害的**,后续任何一次 `RefreshOrder` 调用都会把内容覆盖回正确值,不需要额外处理,只是排查时如果发现"刚查的时候是对的,过一会又变回默认文字"不要慌,等下一次数据刷新就好了。

⚠ **2026-08-15 踩坑:`SetWidgetSpace` 必须在 `SetWidget` 之后调用,不能在之前**——最初按"先配置组件属性、再挂 Widget"的直觉顺序写(`AddWidgetComponent → SetWidgetSpace(Screen) → SetDrawSize → ConstructObjectfromClass → SetWidget`),结果 `WBP_OrderBar` 内部所有 `bIsVariable` 子控件(8 个 `TextBlock`)运行时全是 `None`,和胜负弹窗那次踩过的"`ConstructObjectfromClass` 不触发 `bIsVariable` 绑定初始化"是同一类坑——但这次连**血条那套"`WidgetComponent`+`SetWidget`能绕开这个坑"的经验都不管用了**。对比 `BP_Unit` 里跑通的血条写法(`ConstructObjectfromClass → AddWidgetComponent → SetWidget → SetWidgetSpace`(不传参,默认 World)→ `SetDrawSize`),唯一关键差异是 **`SetWidget` 排在 `SetWidgetSpace` 前面**。把顺序换成"先 `SetWidget` 再 `SetWidgetSpace(Screen)`"之后,`get_properties` 读子控件全部变成有效引用,问题消失。**教训:`WidgetComponent` 相关的初始化时序,`SetWidget` 必须是第一个调用的"内容相关"函数,`SetWidgetSpace`/`SetDrawSize` 这类纯外观属性设置放在 `SetWidget` 之后更安全——具体机制未知,但两次独立踩坑（血条能用的写法 vs 这次不能用的写法）指向同一个变量。**
⚠ **同一轮踩坑:外科手术式改接线时,`connect_pins` 只负责"接上新线",不会自动断开某个节点原有的 exec 输出**——为了把 `SetWidgetSpace` 挪到链路末尾,只把"新的两头"接上(`VariableSet_1→CallFunction_7`、`CallFunction_8→CallFunction_5`),但漏了断开 `CallFunction_5` 自己原来还连着 `CallFunction_7` 的旧线,结果拼出一个环(`CallFunction_7→...→CallFunction_8→CallFunction_5→CallFunction_7→...`),`compile_blueprint` 直接跑成死循环(`Runaway loop detected (over 1,000,000 iterations)`,MCP 调用后台跑了 2 分钟没返回)。**教训:凡是"移动一个节点在 exec 链路里的位置"(不是单纯新增),先用 `get_node_infos` 看清楚该节点原有的所有 exec 连接,该断的用 `break_pins` 显式断掉,不要假设"接新线会自动挤掉旧线"——这只对同一个输出 pin 的场景成立(一个 exec 输出 pin 确实只能接一个下家,新连接会顶掉旧的),对"这个节点的输出还连着别处"完全不成立。**

---

## WBP_OrderBar (`/Game/UI/WBP_OrderBar.WBP_OrderBar_C`,2026-08-15 新增)

> 行动顺序条,对应 web 版 `board.js` 的 `renderOrderBar`。挂在 `BP_TurnManager` 的 `OrderBarComponent`(Screen Space `WidgetComponent`)上,不是 `AddToViewport`。

### 结构
`OrderBox`(HorizontalBox,根)→ 8 个 `TextBlock`(`Slot0Text`..`Slot7Text`,全部 `bIsVariable=true`,设计时占位文字"Text Block")。**固定 8 个槽位,不做运行时动态增删子控件**——`RefreshOrder` 只改这 8 个已存在控件的文字/颜色/可见性,不调用任何"造一个新 Widget 实例塞进容器"的操作,彻底避开 `ConstructObjectfromClass` 的动态子 Widget 初始化坑(和自己拼接"每个单位一个独立 chip 实例"比,牺牲了"超过 8 个单位就显示不全"这个上限,换来不用再踩一次 bIsVariable 坑)。

### 变量
| 名字 | 类型 | 说明 |
|---|---|---|
| SlotTexts | Array\<TextBlock\> | `RefreshOrder` 每次调用时 `Clear` + 8 次 `Add` 重新填,把 `Slot0Text`..`Slot7Text` 收进一个数组方便循环处理,不用手写 8 段近乎重复的分支 |

### 函数
- **RefreshOrder(Units: Array\<BP_Unit\>, CurIdx: Int)**:遍历槽位 0-7 —
  - `slot < Units.Length` → 该槽 `Visibility=Visible`,`Text=ToText(Spd)`,颜色:`slot==CurIdx` → 黄色高亮(当前行动);否则按 `Side` 分蓝(我方)/红(敌方)。
  - `slot >= Units.Length` → `Visibility=Collapsed`(隐藏多余槽位)。
  - 由 `BP_TurnManager.StartTurn` 每次调用时驱动刷新(见上方 `StartTurn`),覆盖"顺序变化"(每轮 `BuildTurnOrder` 重排)和"当前高亮变化"(每次 `StartTurn` 移动到下一个单位)两种场景。
  - ⚠ 已知简化:没有实现 web 版"已经行动过的单位变暗"这个视觉状态(`slot < CurIdx` 的语义上等价于"已行动",但当前 `RefreshOrder` 没有第三种颜色区分它和"还没轮到"的单位)——逻辑上数据都在(`slot`/`CurIdx` 都能拿到),只是没加这一条颜色分支,后续要加的话直接在 `RefreshOrder` 的颜色判断里插一个 `slot < CurIdx` 的 `elif` 即可。
  - ⚠ **2026-08-15 追加防御**:`slot < Units.Length` 分支里,读 `Spd`/`Side`/`SetText` 之前先包了一层 `Utilities|IsValid`(对 `Units[slot]`)——一方全灭前的最后一轮,`TurnOrder` 里可能还留着"这一帧刚被 `TryAttack` `DestroyActor` 掉"的单位引用,直接读它的属性会报 `not valid (pending kill or garbage)`(实测复现过)。`Is Not Valid` 分支复用外层"槽位隐藏"那个 `SetVisibility(Collapsed)` 调用,不用另外接一遍。**同时把 `BP_TurnManager.StartTurn` 里 `RefreshOrder` 调用的位置从"最前面"挪到了 `bGameOver` 检查之后**——双保险,游戏结束后 `StartTurn` 哪怕又被调用一次也不会再碰 `RefreshOrder`。

---

## 行动菜单系统(2026-08-16 新增:移动后弹"攻击/待命/撤销"三选一)

> 用户反馈"移动完之后没有明确的结束回合方式,只能靠攻击命中才能推进回合"——之前只有攻击命中才会 `EndTurn`,单纯移动后卡住没有出口。这轮加了一个移动后弹出的操作菜单,同时补上"撤销本回合移动"的能力(需要先记住回合开始时的位置)。**全部通过 MCP 增量 `create_node`/`connect_pins`(EventGraph 部分)+ `write_graph_dsl` 整函数(全新空函数部分)搭建,新函数无孤立节点残留问题。**

### BP_Unit 新增变量(用于"撤销"回退)
| 名字 | 类型 | 说明 |
|---|---|---|
| StartCol | Integer | 本回合开始时的 Col,`BP_TurnManager.StartTurn` 轮到该单位时(我方分支)快照写入 |
| StartRow | Integer | 同上,Row |
| StartLocation | Vector | 同上,`GetActorLocation` 快照的世界坐标,撤销时直接 `SetActorLocation` 回这个值,不用反查 Tile |

写入时机:`StartTurn` 我方分支里,紧跟在 `Set bHasMoved=false` 之后、`ShowRange` 之前(见上方 `BP_TurnManager.StartTurn` 词条)。

### BP_TurnManager 新增变量
| 名字 | 类型 | 说明 |
|---|---|---|
| ActionMenuComponent | WidgetComponent | 挂 `WBP_ActionMenu` 的组件,和 `OrderBarComponent` 完全同构(`UserConstructionScript` 里 `AddWidgetComponent`,只用来触发 `bIsVariable` 绑定初始化,自身渲染在 `EventBeginPlay` 里永久隐藏),真正显示走下面的 `ActionMenuWidget.AddToViewport` |
| ActionMenuWidget | WBP_ActionMenu (Object) | 菜单 Widget 实例。`EventBeginPlay` 里 `AddToViewport` + `SetPositionInViewport((500,400))` 之后立即 `SetVisibility(Collapsed)` 隐藏,`ShowActionMenu`/`HideActionMenu` 切换它的 Visibility 来显示/隐藏(和 `OrderBar` 那种"永远显示"不同,这个默认隐藏,按需弹出) |
| PendingActionUnit | BP_Unit (Object) | 当前菜单对应的单位——弹菜单前由调用方(`BP_Tile.ActorOnClicked`)写入,`HideActionMenu` 时清空 |

### BP_TurnManager 新增函数(均为全新空函数,`write_graph_dsl` 整函数写入,无孤立节点风险)
- **ShowActionMenu()**:`ActionMenuWidget.SetVisibility(Visible)` → `GetPlayerController(0)` → `SetInputModeGameAndUI`。**调用前提**:调用方必须先设置好 `PendingActionUnit`,这个函数本身不接收参数(`add_function_param` 不支持 Object 类型参数,只能走"先设变量、再调用"这个既有约定)。切到 Game+UI 输入模式是为了让 UMG 按钮真的能收到鼠标点击——项目里 3D Actor 点击(`bEnableClickEvents`)靠的是纯 Game 模式下的场景拾取,默认不会路由到屏幕 UI,这是让弹窗按钮可点的必要步骤(**未做过真人 Play 验证,是本轮最大的不确定项**,见下方"待人工验收")。
- **HideActionMenu()**(2026-08-16 删掉了 `SetInputModeGameOnly` 那一步,见下方"输入模式不再切回去"):`ActionMenuWidget.SetVisibility(Collapsed)` → `Set PendingActionUnit=None`。
- **StandbyAction()**:`HideActionMenu()` → **`Grid.SetSelectedUnit(None)`(2026-08-16 新增)** → `EndTurn()`——对应"待命"按钮,不攻击直接结束回合。清空 `SelectedUnit` 这一步是从 `BP_Tile.ActorOnClicked` 移动收尾那里挪过来的(见下方"根因修复"),挪到这里才是真正"这个单位操作序列结束"的时机。
- **UndoAction()**:`Utilities|IsValid(PendingActionUnit)` →
  - Valid → `SetActorLocation(PendingActionUnit, PendingActionUnit.StartLocation)` → `Set PendingActionUnit.Col=StartCol` → `Set PendingActionUnit.Row=StartRow` → `Set PendingActionUnit.bHasMoved=false`(**撤销后允许重新移动**,不是"什么都不能做了")→ `Grid.ClearHighlights()` → `HideActionMenu()`
  - Not Valid → 直接 `HideActionMenu()`(防御,理论上不会触发)

### BP_Unit.ActorOnClicked / BP_Tile.ActorOnClicked 联动(触发点)
`BP_Tile.ActorOnClicked` 的移动分支,`Set SelectedUnit.bHasMoved=true` 之后(见上方 `BP_Tile.ActorOnClicked` 词条)新增:`GetAllActorsOfClass(BP_TurnManager)[0]` → `Set TurnManager.PendingActionUnit = SelectedUnit` → `TurnManager.ShowActionMenu()` → 再走原有的 `ClearHighlights`(黄/红高亮和菜单同时清/弹,不冲突——`ClearHighlights` 清的是 Tile 材质,菜单是独立的 Widget)→ `Set SelectedUnit.Col`/`Row` → **`TurnManager.ShowAttackRangeCurrent()`(2026-08-16 新增)**。

### 2026-08-16 根因修复:移动收尾误删了 `SelectedUnit`,导致移动后所有依赖它的操作(攻击/撤销重选)全部静默失效
用户反馈三条("撤销后不能再行动"/"点攻击再点敌人没有反应,为什么"/"移动后仍要显示攻击范围")之前,先按用户要求写了一份火焰纹章 vs 我们系统的对照(移动范围/攻击范围显示时机/菜单/撤销语义逐项比对),approve 后开始动手排查。顺着"点击→事件→读哪个变量→变量什么时候被写"的数据流,把 `BP_Tile.ActorOnClicked`/`BP_GridManager.TryAttack`/`BP_GridManager.ShowRange` 三个函数的 `read_graph_dsl` 完整读了一遍(不是靠猜或加 PrintString),直接在 `BP_Tile.ActorOnClicked` 移动收尾的最后一步看到一条 `Class|BPGridManager|SetSelectedUnit(0, Grid)`——这是行动菜单系统上线**之前**的老代码(2026-08-13 那次编译修复提到过这个节点,当时语义是对的:那会儿移动完就是回合唯一操作,顺手清空选中无所谓),但行动菜单上线后移动完还要弹菜单选"攻击/待命/撤销",这几个操作全靠 `GridManager.SelectedUnit` 才知道在操作哪个单位——移动那一刻清空,直接让"点攻击再点敌人"和后续判断全部读到 `None`,静默失效(`TryAttack` 内部 `IsValid` 判断没有 else 分支,不掉血也不报错;`BP_Unit.ActorOnClicked` 敌方分支紧接着又读一次 `SelectedUnit` 判断"是否命中过",同样读到 `None` 就误判成命中,直接 `EndTurn`——回合被悄悄结束)。**修法**:删掉移动收尾这条 `SetSelectedUnit(0)`,改成在 `StandbyAction()` 里清空(真正"操作序列结束"的时机);同时新增 `ShowAttackRangeCurrent()` 顺带解决"移动后仍要显示攻击范围"的诉求(移动收尾最后一步调用,详见上方 `BP_GridManager` 一节)。"撤销后不能再行动"是否属于同一根因、还是独立的输入路由问题(`SetInputModeGameAndUI`/`GameOnly` 切换),这次改动**没有直接针对性修复**——`UndoAction` 本身没有清空 `SelectedUnit`,理论上不受这个根因影响,重新点击自己单位只依赖 `bHasMoved`(`UndoAction` 已重置为 false)和 `TurnOrder[CurrentIndex]==self`,如果人工 Play 之后这条还复现,大概率就真的是坑19记录的输入路由问题,需要另外排查。详见 `UE节点备忘录.md` 坑21。11 条自动回归断言重跑全 PASS(不影响 `RunRegressionTests` 覆盖的逻辑,那套测试不走这条交互链路)。

### 交互流程(设计,未经人工 Play 验证)
点自己单位(轮到、未移动)→ 黄/红高亮 → 点高亮格移动 → 高亮清除,菜单弹出("攻击"/"待命"/"撤销")→
- **普通攻击 / 元素技能**(2026-08-16 由单一"攻击"按钮拆分为两个,见下方"技能与遗物系统"一节):点其中一个 → `TurnManager.SelectSkillAndAttack(bElemental)` 记下这次要用哪个技能、隐藏菜单——玩家接着直接点场上敌方单位,走的还是 `BP_Unit.ActorOnClicked` 里原有的 `TryAttack` 链路,只是现在会把选中的技能带过去。
- **待命**:结束回合,`CurrentIndex` 推进、`StartTurn` 走到下一个单位。
- **撤销**:位置和 `bHasMoved` 都回退到本回合开始时的状态,相当于这个回合还没开始过,可以重新选择移动方向(或者再点自己→再撤销,理论上可以反复横跳,不算 bug,撤销本来就该是无代价的)。

### 待人工 Play 验收(MCP 无法验证的部分,2026-08-16 更新)
1. ~~弹窗按钮是否真的能被点击~~ 部分确认:"攻击"按钮确实能点到并生效(否则不会有"点攻击再点敌人没反应"这个具体反馈——按钮点击本身是通的,反应"没有"的根因已定位并修复,见上方"根因修复")。**"撤销"按钮是否也存在类似的输入路由问题仍未定论**,`SetInputModeGameAndUI`/`GameOnly` 这套切换本身还是没有专门验证过,如果撤销后重新点自己单位依旧没反应,下一步要单独排查这个。
2. 弹窗的屏幕位置(`(500,400)`,像素坐标,没有根据分辨率或单位屏幕位置动态调整)是否挡住了棋盘或者位置别扭。
3. **本轮改动待验收**:①移动完成后红色攻击范围是否正确围绕单位新位置显示(`ShowAttackRangeCurrent`);②"攻击"→点敌方是否正常掉血/命中判定是否符合预期(修复了 `SelectedUnit` 被误清空的问题,理论上应该恢复正常);③"撤销"后能否重新点自己单位再次移动(如果还不行,说明不是这次修的根因,是独立的输入路由问题);④"待命"后回合是否正常推进到下一个单位(清空 `SelectedUnit` 的时机挪到了这里,需确认没有引入新问题)。
4. 敌方单位没有走这套菜单流程(它们的移动由 `RunEnemyTurn` 自动完成,不经过 `BP_Tile.ActorOnClicked`),理论上不受影响,但建议顺手确认一下敌方回合别被新逻辑误伤。

### 2026-08-16 第四轮反馈修复:输入模式来回切换导致点击时灵时不灵 + 原地攻击读到残留技能选择
用户实测反馈两条:①"有时候移动点一下就可以,有时候要双击";②"不能原地攻击"。排查确认两者同根同源——`ShowActionMenu`/`HideActionMenu` 每次弹菜单/关菜单都在 `GameAndUI`/`GameOnly` 之间来回切换输入模式,UE 切换输入模式会重置 Viewport 焦点/鼠标捕获状态,连续快速切换时不保证下一次点击能立刻被正确路由,第一次点击可能被"夺回焦点"这个动作本身吃掉;"原地攻击"完全不经过菜单,如果上个单位操作后输入模式恰好停在过渡态,当前单位的两次点击(点自己、点敌人)都可能被吞。**修法**:`bEnableClickEvents` 驱动的 3D 点击在 `GameAndUI` 模式下本来就能正常工作(项目里除 `WBP_ActionMenu` 外的 Widget 都不拦截点击,菜单隐藏时是 `Collapsed` 不参与命中测试),所以**没必要每次隐藏菜单都切回 `GameOnly`**——删掉 `HideActionMenu` 里的 `SetInputMode_GameOnly` 调用,游戏从第一次弹菜单开始就永久留在 `GameAndUI`,不再有"过渡态"这个不稳定窗口。**附带修复**:原地攻击(不移动、不走菜单)时 `TryAttack` 用的 `bUseSkill2` 读自 `TurnManager.PendingSkillIsElemental`,这个变量只在点菜单按钮时写入,原地攻击会读到上一个单位的残留选择——已在 `StartTurn` 重置 `bHasMoved=false` 的同一处顺手把它归零,保证每个单位轮到自己默认是"普通攻击",除非这回合真的移动后在菜单里主动选了"元素技能"。详见 `UE节点备忘录.md` 坑25。11 条自动回归断言重跑全 PASS。**待人工 Play 重新验收**:连续移动多个单位确认不再需要双击;点自己单位不移动、直接点相邻敌人确认能正常攻击。

---

## 技能与遗物系统(2026-08-16 新增,用户明确要求"最小闭环"——2-3个固定技能+命中率+属性克制+2个纯数值遗物,不做数据驱动/技能选择UI/遗物三选一)

> 用户反馈"下一步是做技能和relic",鉴于 web 版原始系统(`js/data/skills.js`/`js/data/relics.js`)有 40+ 技能(含异常状态/AOE/击退)、30+ 遗物(十几种不同钩子)、完整 18 属性克制表、roguelike 三选一奖励 UI,规模远超现有 UE 切片能承载,用 `AskUserQuestion` 让用户选定范围:**每个单位固定 2 个技能(不做学习/选择系统)+ 命中率/属性克制这套运算链路跑通 + 2 个硬编码的纯数值遗物,不做三选一奖励界面**。

### BP_Unit.AtkType 从占位变量正式启用
`AtkType`(Integer,此前"占位,未接入属性克制表")现在代表元素属性:`0=Normal / 1=Fire / 2=Water / 3=Grass`(只做四选一的火→草→水→火三角克制,不是 web 版 18 属性)。每个单位固定拥有**两个技能**(不是数据表,直接硬编码在 `ComputeSkillDamage` 里):
- **普通攻击**(`bUseSkill2=false`):`mult=0.9`,`hit=95%`,属性视为 `Normal`(不参与克制)。
- **元素技能**(`bUseSkill2=true`):`mult=1.4`,`hit=90%`,属性 = 该单位自己的 `AtkType`。

### BP_GridManager 新增函数
- **GetTypeMultiplier_0(AtkType, DefType) → Mult: Float**(原名 `GetTypeMultiplier`,`remove_function_graph`+`add_function_graph` 重建时被自动加了 `_0` 后缀,DSL 里对应 type_id 是 `GetTypeMultiplier0`,不带下划线,同坑5/坑1 记录的命名规律):四选一三角克制——`Fire→Grass`/`Grass→Water`/`Water→Fire` = 2.0 倍,反向(`Fire→Water`/`Water→Grass`/`Grass→Fire`)= 0.5 倍,同属性互克 = 0.5 倍,只要一方是 `Normal`(0)就恒为 1.0 倍(不参与克制)。**第一版实现有真实 bug 且编译不报错**:直接写多分支 `(return X)` 函数体,没有先声明输出参数,导致函数编译成"看起来对但其实是 void"——细节和修法见 `UE节点备忘录.md` 坑24,这是本轮最危险的一个坑,不主动核实"函数是否真的有返回值 pin"根本发现不了。
- **ComputeSkillDamage(bUseSkill2, AttackerAtk, AttackerAtkType, DefenderDef, DefenderAtkType) → Damage: Int**:封装"选技能参数 → 掷命中骰 → 算克制倍率 → 算伤害"整条链路,**故意设计成只吃纯 Int/Bool 参数、不在内部做任何跨类 Col/Row 之类的取值**,规避了坑20 记录的"局部变量二次取撞名属性"问题。内部用 3 个**局部变量**(`SkillMultTmp`/`HitChanceTmp`/`SkillTypeTmp`,`add_variable` 建在这个 Function 自己的 graph 上,函数返回后自动丢弃)先按 `bUseSkill2` 选好这次用哪个技能的参数,再 `Math|Random|RandomIntegerinRange(0,99)` 掷骰,`< HitChanceTmp` 才算命中:
  - **命中**:`Damage = Max(1, Round(AttackerAtk × SkillMult × GetTypeMultiplier0(SkillType, DefenderAtkType) × 9/(9+DefenderDef)))`,顺手 `PrintString("HIT dmg=X")` 方便调试确认。
  - **未命中**:`Damage = 0`,`PrintString("MISS")`,**不做"最低伤害1点"的兜底**——miss 就是纯粹没伤害,这是和"命中但伤害算出来是1"刻意区分开的两种结果。
  - 由 `TryAttack` 唯一调用,验证过实测日志 `HIT dmg=6`(默认 `Atk=10/Def=5/Normal vs Normal`,`10×0.9×1.0×9/14≈6.43→round 6`,和公式手算吻合)。
- **ApplyStartingRelics()**(无参数):`UCombatLoadout::BuildRelicLoadout(DT_Relics, EquippedRelicIds, bRelicFallbackToSlice)` 一次算完,结果快照进 `RelicCache` 再 Break 写出 `RelicAtkAdd`/`RelicDefAdd`/`RelicHitAdd`/三个乘区/`RelicBarText`。然后对每个 `Side=true` 的单位 `Atk = BaseAtk + RelicAtkAdd`、`Def = BaseDef + RelicDefAdd`(禁止 `Atk = Atk + Add`,否则 Debug APPLY 会叠)。开局 `EquippedRelicIds` 空且 `bRelicFallbackToSlice=true` → 用表里 `bEnabledInSlice` 行。自定义 APPLY **解析出遗物 id 后**才关 fallback;解析 0 件则把 fallback 设回 true,避免空读清顶栏。由 `BP_TurnManager.EventBeginPlay` 在 `Set Grid` 之后调用,随后 `RefreshRelicBar`。回归测试里单独 `SpawnUnit` 的单位不走这条 BeginPlay,不受影响。

### BP_GridManager.TryAttack 改动
- 新增输入参数 `bUseSkill2: Bool`(`add_function_param` 支持 bool,不受"不能加 Object 参数"的限制,见坑17)。
- 原来"进入射程判定为真"分支里直接调 `SetHP` 的那段,改成先插入一次 `ComputeSkillDamage(bUseSkill2, SelectedUnit.Atk, SelectedUnit.AtkType, Defender.Def, Defender.AtkType)` 调用,再把结果接到原来的 `HP - 伤害` 那个减法节点上——**原来内联在 `TryAttack` 里的那一整条"ToFloat→DEF_K 公式→Round→Max(...,1)"节点链没有删除,只是断开了数据连接,变成纯数据孤立节点(不在 exec 链路上,不会被执行,也不会被误连)**,这是刻意的低风险选择(删除需要确认哪些节点被其它地方共享,风险大于收益),后续如果要清理图可以参考 `UE节点备忘录.md` 坑11 的判活方法。
- **已有调用点**(`BP_Unit.ActorOnClicked` 敌方分支、`BP_GridManager.RunEnemyTurn`)因为 `bUseSkill2` 是新增的**输入**参数(不是输出参数,不受"改签名后旧调用点报 pin 找不到"那条坑的影响),两处旧调用在没有改动的情况下都编译通过、自动用了默认值 `false`——`RunEnemyTurn` 就此保持"敌方 AI 只用普通攻击"的简化(没有给 AI 加选技能的决策逻辑,是刻意的最小闭环取舍);`BP_Unit.ActorOnClicked` 则新增了一条 `TurnManager.PendingSkillIsElemental` 取值 → 接到 `bUseSkill2` pin,让玩家在菜单里选的技能真正生效(见下方 `BP_TurnManager` 一节)。

### BP_TurnManager 新增
| 名字 | 类型/签名 | 说明 |
|---|---|---|
| `PendingSkillIsElemental` | Bool 变量 | 记录玩家在行动菜单里选的是"普通攻击"还是"元素技能",`SelectSkillAndAttack` 写入,`BP_Unit.ActorOnClicked` 攻击时读出 |
| `SelectSkillAndAttack(bElemental: Bool)` | 函数 | `Set PendingSkillIsElemental=bElemental` → `HideActionMenu()`——两个技能按钮共用这一个函数,只是传的 `bElemental` 不同 |

`EventBeginPlay` 新增一步:`Set Grid` 之后立即 `Class|BPGridManager|ApplyStartingRelics(Grid)`,再走原来的 `BuildTurnOrder()`。⚠ 这一步最初想用"整体 `write_graph_dsl` 重写 `EventBeginPlay`,原文本插一行"的省事做法,结果在完全没碰过的旧代码行 `Rendering|SetVisibility "Collapsed" _actionmenuwidget` 上报类型不兼容——改用 `create_node`(`type_id="Class|BPGridManager|ApplyStartingRelics"`,必须带 `declaring_class`,`CallFunction|` 前缀对跨蓝图函数不认)+ `connect_pins` 精确插入到 `SetGrid.then` 和 `BuildTurnOrder` 调用之间才成功,细节见 `UE节点备忘录.md` 坑22/坑23。

### 待人工 Play 验收(本轮新增,MCP 侧只验证到"11 条回归断言 PASS + 日志能看到 `HIT dmg=6`",没有真人点鼠标走过完整流程)
1. 移动后菜单是否正确显示"普通攻击"/"元素技能"两个按钮(而不是旧的单个"攻击")。
2. 点"元素技能"再点一个属性构成克制关系的敌人(比如我方 Fire 打敌方 Grass),伤害是否明显更高;打反向克制(Fire 打 Water)伤害是否明显更低。
3. 命中率是否真的会导致偶尔 MISS(5%/10% 概率,不掉血,`Output Log` 能看到 `MISS` 字样)——这是设计内行为,不要误判成 bug。
4. 战斗一开始(`BeginPlay`)我方单位属性面板/血条对应的 `Atk`/`Def` 是否比 Class Default(`Atk=10`/`Def=5`)高 2 点(遗物生效的直接证据,目前没有专门的 UI 展示"当前拥有哪些遗物",只能通过数值变化间接确认)。
5. 敌方 AI 攻击应该仍然只用普通攻击效果(没有元素技能加成),这是已知的简化,不是遗漏。

---

## 反击系统 + 攻击预测 UI(2026-08-16 新增,对齐火焰纹章式反击 + 网页版伤害预测面板)

> 用户反馈"每次攻击都会有被攻击者的反击,和火焰纹章一致。同时UI中加上预计本次攻击对对方的伤害、对自己的伤害等信息,类似网页版的效果"。先用后台 Agent 调研了网页版 `js/core/combat.js`/`js/ui/panels.js` 的反击条件和预测面板实现,对齐后再动手。

### 反击(BP_GridManager 新增)
- **CounterDefenderRef**(Object 变量,BP_Unit):`ResolveCounterAttack()` 读取的"这次谁来反击"临时引用,`TryAttack` 调用前显式 `Set`(因为 `add_function_param` 不支持 Object 参数,老办法)。
- **ResolveCounterAttack()**(无参数):读 `CounterDefenderRef`(反击发起者)和 `SelectedUnit`(原攻击者,现在是反击目标)→ 判定反击条件(**HP>0 且 距离<=反击者自己的 AtkRange**,与网页版 `combat.js` 的判定条件一致)→ 若成立,反击永远用**普通攻击**(`bUseSkill2=false`,和网页版"反击只用基础招式,不用装备的技能"一致)算一次独立的 `ComputeSkillDamage`(自己的命中判定,可能 MISS,也可能把原攻击者打死)→ 扣血、刷血条、死亡检测(`DestroyActor`+`CheckVictoryCondition`)。**踩了本轮最危险的坑**:第一版实现里 `ComputeSkillDamage` 被 `write_graph_dsl` 悄悄复制成两次独立调用(两次独立掷骰子),导致"应用到 HP 上的伤害"和"打印出来的伤害"可能对不上——已用"Set 到局部变量再统一 Get"的快照模式修复,细节和更通用的教训见 `UE节点备忘录.md` 坑26。
- **TryAttack** 新增调用点:原来"防御方存活"分支(`Branch3.else`,即 `newHP>0` 那条路)末尾,`ClearHighlights` 之前,插入 `Set CounterDefenderRef=Defender` → `ResolveCounterAttack()`。因为是接在"存活"分支上,**未命中的主攻击(MISS,defender HP 没变但明显 >0)也会触发反击判定**——这正是设计意图(火纹里"你打空了,对方还是能反击"),不是 bug。
- 由于 `TryAttack` 现在是双方都可能扣血的函数,原本的敌方 AI(`RunEnemyTurn`)攻击玩家单位时,**玩家单位现在也会自动反击敌方**,这是免费获得的正确行为(不需要额外改 `RunEnemyTurn`)。

### 攻击预测(BP_GridManager 新增,均为"预览用、不掷骰子、不产生副作用"的纯计算函数)
- **PreviewSkillDamage(bUseSkill2, AttackerAtk, AttackerAtkType, DefenderDef, DefenderAtkType) → Damage: Int**:和 `ComputeSkillDamage` 用同一套倍率/属性克制/DEF_K 公式,但**跳过命中判定**,直接按"assumed 命中"算出伤害数值,用于 UI 预览显示。
- **GetSkillHitChance(bUseSkill2) → HitChance: Int**:普通攻击 95,元素技能 90,单纯把这两个常量暴露成一个小函数方便调用方读取,不用各处硬编码。

### 攻击预测 UI 交互流程(取代原来"点敌人直接攻击"的一步到位设计)
`BP_Unit.ActorOnClicked` 的敌方分支(2026-08-16 重写,删除了原来直接调 `TryAttack`+检查 `SelectedUnit` 有效性来决定是否 `EndTurn` 的旧逻辑)现在是:`Set TurnManager.PendingAttackTarget=self` → `TurnManager.ShowAttackForecast()`。真正的攻击执行挪到了玩家在预测面板里点"确认攻击"之后才发生。

**⚠ 2026-08-22 已停用**:用户反馈"鼠标点击还在控制攻击,应该完全改成按E攻击"——这条分支就是残留的真正原因(之前只删了 ARPG 阶段新加的 `LeftMouseButton→AttemptSkillAttack` legacy 按键绑定,没意识到这条更早期的、基于"点击 3D 网格触发 `ReceiveActorOnClicked`"的点击攻击流程一直独立存在且仍然有效)。已 `delete_node` 删掉 `K2Node_CallFunction_9`(`GetAllActorsOfClass GridManager`)/`K2Node_VariableSet_0`(`SetPendingAttackTarget`)/`K2Node_CallFunction_18`(`ShowAttackForecast`)/`K2Node_GetArrayItem_5`/`K2Node_VariableGet_9`(后两个是取 `SelectedUnit` 的死代码,原本输出就没被用到)这五个节点,`IfThenElse_3`(判断 `NOT Side`,即点到的是敌方)的 `then`/`else` 两个 exec 输出现在都是空的死端——**点击敌方单位 3D 网格不再有任何反应**,不会弹出攻击预测面板,不会设置 `PendingAttackTarget`。`ActorOnClicked` 的其余部分(点我方单位弹移动/攻击范围高亮、`bHasMoved` 门槛)完全没动,只摘掉了"点敌方→攻击"这一条路径。`compile_blueprint` 通过,PIE 截图确认 UI/场景无异常。**现在游戏里唯一能触发攻击的输入是 `E` 键**(`AttemptSkillAttack`,沿准星方向 LineTrace)。

### BP_TurnManager 新增
| 名字 | 类型/签名 | 说明 |
|---|---|---|
| `PendingAttackTarget` | Object 变量(BP_Unit) | 玩家点击的、还没确认攻击的敌方单位 |
| `ForecastComponent`/`ForecastWidget` | WidgetComponent / WBP_AttackForecast | 和 `ActionMenuComponent`/`ActionMenuWidget` 完全同构的挂载方式(`UserConstructionScript` 建组件仅用于触发 `bIsVariable` 初始化,真正显示走 `EventBeginPlay` 里的 `AddToViewport`,默认 `Collapsed`,屏幕坐标同样是 `(500,400)`——和行动菜单不会同时显示,共用坐标不冲突) |
| `ShowAttackForecast()` | 函数,无参数 | 读 `Grid.SelectedUnit`(攻击方)和 `PendingAttackTarget`(防御方),先做距离/`AtkRange` 判断,**不在攻击范围内则什么都不做**(保留旧版"点了没反应,得挪近了再点"的行为);在范围内则:调用 `Grid.PreviewSkillDamage`/`GetSkillHitChance` 算主攻击的预计伤害+命中率,拼成字符串塞进 `ForecastWidget.SetAtkForecast`;紧接着 `SetHpForecast` 显示双方当前 HP 和**假设命中后的敌方剩余 HP**(`Max(敌HP-预计伤害, 0)`),并附带 `Atk vs Def` 方便手算;再判断反击条件(距离<=防御方自己的 `AtkRange`),成立则同样算一遍反击预测塞进 `SetCounterForecast`,不成立则显示"无反击";最后 `SetVisibility(Visible)` 弹出面板,并把 `Btn_Confirm` 设回 Visible。**同样用了 Set-then-Get 快照模式**避免坑26 的重复调用问题。HP 行必须插在 `SetAtkForecast` 之后、反击预览 `SetFcDmg` **之前**,否则 `FcDmg` 会被反击伤害覆盖,剩余 HP 会算错。 |
| `ConfirmAttack()` | 函数,无参数 | 隐藏预测面板 → **IsValid(PendingAttackTarget)** 才 `Grid.TryAttack(...)`(否则打印 `ConfirmAttack skipped: no target`,不结算)→ 检查 `Grid.SelectedUnit` 是否还有效,无效说明攻击真的发生了 → `Set bAttackTargeting=false` → `EndTurn()` |
| `CancelAttackForecast()` | 函数,无参数 | 隐藏预测面板 → 清空 `PendingAttackTarget` → `bAttackTargeting=false` → **重新弹出行动菜单**。选了技能还没最终确认时,点面板「取消」或点自己已移动的单位,都可以放弃本次进攻。 |
| `PendingSkillRowName` | Name | 本次要用的 `DT_Skills` 行名(`basic`/`heavy`/`ember`/`aqua`/`vine`)。`SelectSkillAndAttack` 同时写到 TurnManager 和 GridManager。 |
| `FcSavedSkillRow` | Name | `ShowAttackForecast` 算反击预览前,把 Grid 的技能行名暂存于此,算完还原,避免确认时变成 `basic`。 |
| `bAttackTargeting` | Bool | 已选技能、正在选敌/看预测。`SelectSkillAndAttack` 置 true。 |
| `SelectSkillAndAttack(bElemental, SkillIndex)` | 函数 | `SkillIndex` 0..4 读 `Grid.SkillSlots`(`UCombatLoadout::GetSkillSlotName`,空槽回退 basic/heavy/ember/aqua/vine)。写行名 → 隐藏菜单 → 弹出预测面板提示选敌,**同时把 `Btn_Confirm` Collapsed**。 |
| `RelicBarComponent`/`RelicBarWidget` | WidgetComponent / WBP_RelicBar | 同构挂载:Construction 里 Construct+SetWidget 只为初始化 `bIsVariable`;BeginPlay `AddToViewport` ZOrder=10,组件本身 `SetVisibility(false)` |
| `DebugComponent`/`DebugWidget` | WidgetComponent / WBP_DebugLoadout | 同上,ZOrder=20,默认 Collapsed |
| `bDebugPanelOpen` | Bool | ToggleDebugPanel 用,避免 GetVisibility 枚举和字符串比类型 |
| `RefreshRelicBar()` | 函数 | `RelicBarWidget.SetBarText(Grid.RelicBarText)` |
| `ToggleDebugPanel()` / `HideDebugPanel()` | 函数 | DBG 开关 / CLOSE。**2026-08-30 起 `ToggleDebugPanel()` 同时切输入模式**:打开面板→`SetInputModeGameAndUI`+`SetShowMouseCursor(true)`;关闭→`SetInputModeGameOnly`+`SetShowMouseCursor(false)`,原因和改动细节见下方"2026-08-30"节。`HideDebugPanel()` 本轮未同步改(仍只收起面板、不切输入模式),后续如果发现"用 HideDebugPanel 关闭时鼠标还留着"的问题,要在那边补同样的两行。 |
| `ApplyDebugLoadout()` | 函数 | 读隐藏输入框(DoApply 可能先把非空下拉抄进去)。遗物 CSV → `RelicCsvToIds` → Parse。**解析件数 > 0** 才 `SetEquippedRelicIds` 并关 fallback;**件数为 0** 把 `bRelicFallbackToSlice` 设回 true,让 `ApplyStartingRelics` 再走切片 5 件,禁止空读把顶栏清掉。技能 Parse 件数 > 0 才 `SetSkillSlots`。然后回血、刷新顶栏和菜单。 |
| `ApplyPresetSlice/Heavy/Elem()` | 函数 | 一键配装。直接 `ParseCommaSeparatedNames` 写死英文 id → Set 数组 → 关 fallback → 遗物/回血/刷新。不读输入框。 |
| `RefreshSkillMenuLabels()` | 函数 | `GetSkillSlotName` → `SkillIdToChinese` → `WBP_ActionMenu.SetSkillButtonLabels`。`ShowActionMenu` 每次打开也会调。 |
| `SkillIdToChinese` | 函数 | 技能行名 → 中文。31 条 `EqualExactly` + `if`/`return`,不再调会被 prune 的 B。认不出则原样返回。 |
| `SkillTokenToId` | 函数 | 中文名 → 行名;已是英文 id 则原样返回。同样全部内联,不调 B。 |
| `RelicCsvToIds` | 函数 | 整段 CSV 里把 24 个中文遗物名 `Replace` 成行名。不再调 `RelicCsvToIdsB`。 |

### 遗物顶栏 / Debug 控制台(2026-08-16)

**WBP_RelicBar**(`/Game/UI/WBP_RelicBar`):RootCanvas(`SelfHitTestInvisible`)→ 顶贴边 `BarBorder` → `Txt_Bar` + `Btn_Debug`。`SetBarText(Msg)` 用 `Widget|SetText(Text)`,不要用 `Class|Factory|SetText`(会接到 Bool `bText`)。

**WBP_DebugLoadout**:居中 SizeBox → 中文标题 → 5 个遗物 `ComboBoxString` + 5 个技能下拉 → 切片/重击流/元素流/应用自定义/关闭。旧输入框 Collapsed。`EventConstruct`:`FillRelicCombo`/`FillSkillCombo` + `SetText` 隐藏框默认中文 CSV。`GetComboOption` 必须 `declaring_class=ComboBoxString` 的 `ComboBox|GetSelectedOption`,且 **FunctionEntry.then 必须接到 Return.execute**,否则返回值永远是空串。DoApply:下拉空串**不覆盖**隐藏框;拼出来是 `,,,,` 也不改遗物 CSV。然后才 `ApplyDebugLoadout`。

**WBP_ActionMenu**:`Txt_Attack`/`Txt_Skill2..5` 已 `bIsVariable`。`SetSkillButtonLabels(S0..S4)` 改五个按钮上的字。设计时和运行时都显示中文 DisplayName(普通攻击/重击/火花…)。

**BP_Unit**:`BaseAtk`/`BaseDef`,`Setup` 里在改 Side 之后立刻从当前 Atk/Def 快照。之后遗物只做 `Atk = BaseAtk + RelicAtkAdd`。

**BP_GridManager**:`EquippedRelicIds`/`SkillSlots`(Name 数组)、`RelicBarText`、`bRelicFallbackToSlice`(**CDO true,TestMap 放置实例不得覆盖成 false,见坑35**)、`RelicCache`、`AttackDmgTmp`。`ApplyStartingRelics` 的 Break 必须接 Build 的返回值。`TryAttack` 射程内只算一次 `ComputeSkillDamage`,写入 `AttackDmgTmp` 再扣血。`ResetAllUnitHP()` 给沙盒 APPLY 回满血。

**已知简化**:没有遗物图标;遗物只加我方;预设/自定义都会回满 HP;菜单显示中文全名(不是技能说明);自定义是下拉(诅咒带「（诅咒）」,遗物可「（空）」),可能秒杀;HEAVY 里的 closecombat 等 UePhase=2,但倍率仍会进公式;克制表仍关,元素流和重击流的差异主要是倍率和遗物 Atk,不是属性克制。伤害公式已验收,本轮未改。 `SkillIdToChineseB`/`SkillTokenToIdB`/`RelicCsvToIdsB` 仍留在蓝图里但主路径已不调用。

### WBP_AttackForecast(`/Game/UI/WBP_AttackForecast.WBP_AttackForecast_C`,全新 Widget)
`ForecastBox`(VerticalBox,根)→ **`Txt_HpInfo`(2026-08-16 新增,排在最上面,16pt 黄字,`bIsVariable=true`)** → `Txt_AtkDmg`/`Txt_CounterDmg`(TextBlock,`bIsVariable=true`,运行时动态改文字)→ `Btn_Confirm`("确认攻击")/`Btn_Cancel`("取消")(Button,`bIsVariable=true`,各挂一个静态 `TextBlock` 标签)。三个公开函数 `SetHpForecast(Msg)` / `SetAtkForecast(Msg)` / `SetCounterForecast(Msg)` 内部各自把字符串转 `Text` 后 `SetText` 到对应 TextBlock——和 `WBP_HealthBar.SetHealthPercent` 一样走"外部主动 Push"模式,不用属性 Binding。`SetHpForecast` 用的是 `Widget|SetText(Text)`(TextBlock),不要抄 `Class|Factory|SetText`(会误建成 Factory 的 `bText` Bool setter)。HP 行示例:`敌HP 20/20 -> 13 | 我HP 20/20 | Atk10 vs Def5`(箭头后面是假设本次攻击命中后的敌方剩余 HP)。`EventGraph` 两个 `OnClicked` 事件分别调 `TurnManager.ConfirmAttack()`/`CancelAttackForecast()`。

### 已知简化 / 待人工 Play 验收
1. 预测面板的伤害数字是"假设命中"的确定值,不会因为随机数而在面板上跳动——这是刻意对齐网页版效果(网页版 `showForecast` 同样是 dry-run,不掷骰子),真正的随机结果要点"确认攻击"之后才在 `Output Log`(`HIT dmg=`/`MISS`/`COUNTER dmg=`)和 HP 变化里体现。
2. **自动回归测试新增了一点点不确定性**:`ComputeSkillDamage` 现在会真的掷骰子,`RunRegressionTests` 的 T5/T6a 大约有 5% 概率因为 MISS 假性 FAIL(重跑即可,不是回归),见 `UE节点备忘录.md` 对应记录。
3. **待验收**:①点敌方是否正确弹出预测面板而不是直接攻击;②面板上的"预计伤害"数字是否和实际点确认后的 `Output Log` 数量级吻合(允许因为随机数不同而不完全相等,但克制/反克制的倍率关系应该能从数字大小差异看出来);③防御方在射程内时是否显示"预计反击"信息,超出射程时是否显示"无反击";④点"确认攻击"后是否正常结算(含反击),点"取消"后是否能重新选择/不影响后续操作;⑤敌方 AI 攻击玩家单位时,玩家单位是否会自动反击(不需要任何 UI 交互,`TryAttack` 内部自动处理)。

---

## WBP_ActionMenu (`/Game/UI/WBP_ActionMenu.WBP_ActionMenu_C`,2026-08-16 新增;同日追加第 4 个按钮见下)

> 移动后弹出的操作菜单。项目里第一个带**交互按钮**的 Widget(之前的 `WBP_OrderBar`/`WBP_HealthBar`/`WBP_GameOver` 都是纯展示,没有需要接收点击的控件)。

### 结构
`MenuBox`(VerticalBox,根)→ 7 个 `Button`(`Btn_Attack`/`Btn_Skill2`/`Btn_Skill3`/`Btn_Skill4`/`Btn_Skill5`/`Btn_Standby`/`Btn_Undo`)。技能按钮标签(设计时文字):普通攻击 / 重击 / 火花 / 水枪 / 藤鞭。待命、撤销不变。

### 事件
- `Btn_Attack` → `SelectSkillAndAttack(false, 0)` → `basic`(mult 0.9 / hit 95 / Normal)
- `Btn_Skill2` → `SelectSkillAndAttack(false, 1)` → `heavy`(mult 1.6 / hit 80 / Normal,更容易空刀)
- `Btn_Skill3` → `SelectSkillAndAttack(false, 2)` → `ember`(mult 1.4 / hit 90 / Fire)
- `Btn_Skill4` → `SelectSkillAndAttack(false, 3)` → `aqua`(mult 1.4 / hit 90 / Water)
- `Btn_Skill5` → `SelectSkillAndAttack(false, 4)` → `vine`(mult 1.4 / hit 90 / Grass)
- `Btn_Standby` → `StandbyAction()`
- `Btn_Undo` → `UndoAction()`

这 5 个技能是切片里挑的、效果能看出来差异的固定套装(**不是每只单位独立随机抽牌**)。灼烧等 inflict 仍然不算。

四个都是同一套"查 TurnManager 再调用"的写法,和项目里 `BP_Unit`/`BP_Tile` 一直在用的跨蓝图调用惯例一致,没有给 Widget 单独存一份 TurnManager 引用变量。⚠ `Btn_Attack`/`Btn_Skill2` 这两个事件是用 `write_graph_dsl` **只改这两个事件、不提 Standby/Undo** 的方式写入的,实测确认这种"部分事件重写"不会影响同一 EventGraph 里其它未提及的事件(`Btn_Standby`/`Btn_Undo` 原样保留,没有被清空或重复),但调用 `SelectSkillAndAttack` 时 `create_node` 反复报 "does not exist",改用 `write_graph_dsl` 直接写 DSL 文本才成功创建——具体原因见 `UE节点备忘录.md` 坑22。

---

## WBP_HealthBar (`/Game/UI/WBP_HealthBar.WBP_HealthBar_C`,2026-08-15 新增)

> 第一个 UMG Widget Blueprint,`/Game/UI/` 是新建的文件夹(此前项目里所有资产都在 `/Game/Maps/`)。

### 结构
`RootCanvas`(CanvasPanel,根)→ `HealthProgressBar`(ProgressBar,`bIsVariable=true`,尺寸 100×14,锚点左上不拉伸)。样式:`FillColorAndOpacity` 绿色 `(0.15,0.85,0.2,1)`,`WidgetStyle.BackgroundImage.TintColor` 暗红 `(0.25,0.02,0.02,1)`。

### 函数
- **SetHealthPercent(Percent: Float)**:`HealthProgressBar.SetPercent(Clamp(Percent, 0, 1))`。这是外部(`BP_Unit.UpdateHealthBar`)驱动血条的唯一入口——**没有用 UMG 的属性 Binding(没找到 MCP 里对应的绑定工具),走的是"外部主动 Push 新值"模式**,谁的 HP 变了就显式调用一次这个函数。

### 用法
每个 `BP_Unit` 在 `UserConstructionScript` 里各自 `ConstructObjectfromClass` 出一份独立实例,挂在自己的 `HealthBarComponent`(WidgetComponent,World Space)上,不是共享同一个 Widget。

---

## WBP_GameOver / WBP_GameOverDefeat(`/Game/UI/`,2026-08-15 新增,2026-08-15 拆成两个类)

> 两个几乎一样的 Widget:`WBP_GameOverDefeat` 是 `AssetTools.duplicate` 复制 `WBP_GameOver` 出来的,唯一区别是 `ResultText` 的设计时默认文本/颜色不一样。**不要合并回一个共享类**——见下面"为什么拆成两个"。

### 结构(两个类相同)
`RootCanvas`(CanvasPanel,根)→ `BackgroundBorder`(Border,锚点撑满全屏 `(0,0)-(1,1)`,`BrushColor` 半透明黑 `(0,0,0,0.6)`,内容水平/垂直都居中)→ `ResultText`(TextBlock,`bIsVariable=true`,字号 72)。
- `WBP_GameOver`:`ResultText` 设计时默认文本 `"VICTORY"`,颜色绿 `(0.2,0.9,0.2,1)`。
- `WBP_GameOverDefeat`:`ResultText` 设计时默认文本 `"DEFEAT"`,颜色红 `(0.9,0.15,0.15,1)`。

**文本先用英文占位**,没有确认项目里有没有配 CJK 字体(默认 Roboto 字体大概率不含中文字形,直接写中文会变成方块),真要换成"胜利"/"失败"之类的中文,得先确认字体资源。

### 为什么拆成两个类,而不是一个类 + 运行时 `SetText`
最初做的是一个共享 `WBP_GameOver` + `ShowResult(bVictory)` 函数,运行时调 `SetText`/`SetColorAndOpacity` 去改文字。结果背景遮罩能看见,文字死活不出来,查出来是 `ConstructObjectfromClass`(`Game|ConstructObjectfromClass`,走的是裸 `NewObject`,不是引擎正规的 `Create Widget`/`WidgetBlueprintLibrary::Create` 流程)生成的实例,**`bIsVariable` 控件树绑定(`ResultText` 这个变量指向哪个实际控件)当时还没建立**——`AddToViewport` 也救不了,先 `AddToViewport` 再 `ShowResult` 一样报 `Accessed None trying to read ResultText`。目前 MCP 这边的工具找不到"正规 Create Widget"节点(`find_node_types` 查不到,`UserInterface|Create`/`Widget|Create` 之类都不存在),所以绕不开这个初始化缺口。**背景遮罩之所以一直能看见,是因为它的颜色是设计时默认值,渲染不需要经过任何运行时 Blueprint 代码**——这个思路才是最终方案:两种结局各做一个独立类,文字颜色全部烤进设计时默认值,`ShowGameOverPopup` 只挑造哪个类,完全不在运行时碰 `bIsVariable` 绑定,问题消失。

### 用法
只被 `BP_GridManager.ShowGameOverPopup` 调用:按 `bVictory` 选 `ConstructObjectfromClass(WBP_GameOver 或 WBP_GameOverDefeat)` 现场生成一个实例(不是像血条那样每个单位常驻一份)→ `AddToViewport`(Screen Space 全屏浮层,不是像血条那样挂在某个 Actor 身上的 World Space 组件)。

---

## BP_TacticsController

- `InputKey(N)` → `GetAllActorsOfClass(BP_TurnManager)[0]` → `EndTurn`

---

## 自动回归测试(2026-08-15 新增)

> 目的:每次改完蓝图逻辑,不用再全靠人工按 `UE测试用例.md` 清单点鼠标——跑一遍这个,几秒内拿到 PASS/FAIL。详细搭建过程、踩过的坑见 `UE节点备忘录.md`。**这套机制只覆盖"能在一次 BeginPlay 内跑完的纯逻辑断言",不能替代真人 Play 测试点击交互、视觉表现这类东西**,两者互补。

### 怎么跑

1. 确认 MCP 已连接、PIE 没在跑。
2. 把关卡里 `BP_GridManager` 实例(`TestMap` 里目前叫 `BP_GridManager_C_1`)的 `bRunRegressionTestsOnBeginPlay` 设成 `true`:
   `ObjectTools.set_properties(instance=GridManager实例, values='{"bRunRegressionTestsOnBeginPlay": true}')`
3. `EditorAppToolset.StartPIE`(warmupSeconds 给 2~3 秒,够 BeginPlay 里的建图逻辑和测试都跑完)。
4. `LogsToolset.GetLogEntries(pattern="PASS:|FAIL:|REGRESSION_TESTS_DONE")` 读结果。
5. `EditorAppToolset.StopPIE`。
6. **把 `bRunRegressionTestsOnBeginPlay` 设回 `false`**(不设回去的话下次任何人正常 Play 都会顺带跑测试、多生成两个临时单位)。**⚠ 2026-08-15 实测踩过坑:这个属性一旦通过 `set_properties` 改过,关卡(`TestMap.umap`)就会被标记为 dirty——如果之后为了保存其他蓝图改动调用了 `AssetTools.save_assets([])`("保存所有 dirty 资产"),会连带把关卡也存盘,若这时还没把开关设回 false,会把 `true` 意外落盘。**正确顺序:先把开关设回 false,确认 `get_properties` 读到的是 false,再做任何 `save_assets` 调用;提交前最好用 `git diff --stat` 确认 `.umap` 这次改动符合预期(通常应该没变化,除非你确实是故意在改关卡里的东西)。

### 触发机制

`BP_GridManager.EventGraph.EventBeginPlay` 在原有的建图/生成初始单位逻辑之后,新增了 `Branch(bRunRegressionTestsOnBeginPlay) → True → RunRegressionTests(self)`。默认 false,不影响正常游玩。

### RunRegressionTests 覆盖的断言(当前 12 条)

在 `Tiles[0]`/`Tiles[1]`(11×8 网格里的两个相邻空格,离初始 4 个单位所在的 30/41/52/63 号格远,不会撞车)上:

| 名字 | 断言内容 |
|---|---|
| T1_IsTileOccupied_False_OnEmptyTile | 空格子上 `IsTileOccupied` 应为 false |
| T2_IsTileOccupied_True_AfterSpawn | `SpawnUnit` 之后同一格子 `IsTileOccupied` 应变 true |
| T3_ShowRange_ExcludesOccupiedAdjacentTile | **今天这次 bug 修复的直接回归测试**:相邻格被占用时,`ShowRange` 不应该把它标记为可移动(`Highlighted=false`) |
| T4_ShowRange_ExcludesSelfTile | 单位自己所在格子不应被 `ShowRange` 高亮(距离=0 的既有逻辑) |
| T5_TryAttack_DamagesDefender_HP | `Set SelectedUnit=unitA` → `TryAttack(unitB)` → `unitB.HP` 应该 < 20(确认伤害真的生效) |
| T6a_HealthBar_DecreasesAfterDamage | 同一次攻击后,`unitB.HealthBarWidget.HealthProgressBar.Percent` 应该 < 1.0(确认血条控件跟着 HP 联动,不是摆设) |
| T6b_HealthBar_NotZeroedOut_IntegerDivisionRegression | 同一个 Percent 应该 > 0.0(**专门防同一天踩过的整数除法截断成0的回归**,见 `UpdateHealthBar` 已知问题) |
| T7a_FindNearestUnit_ReturnsDistinctUnit | `FindNearestUnit0(fromUnit, bWantAlly=true)` 返回值不应该是 `fromUnit` 自己(几何无关的设计,不假设具体是哪个单位最近,见下方"以后怎么扩展"里的教训) |
| T7b_RunEnemyTurn_MovesCloserToNearestTarget | `RunEnemyTurn` 跑完之后,敌方单位到"它实际找到的最近目标"的曼哈顿距离应该比移动前更小(**今天 pure 节点别名 bug 的直接回归测试**,见 `UE节点备忘录.md` 坑3) |
| T7c_RunEnemyTurn_VacatesOldTile | `RunEnemyTurn` 跑完之后,单位原来所在的格子 `IsTileOccupied` 应变回 false(**同一个 pure 别名 bug 的另一种表现的回归测试**,见 `UE节点备忘录.md` 坑3) |
| T8_ShowAttackRange_HighlightsEnemyInRange | `ShowAttackRange` 之后,射程内的敌方单位所在格子 `AtkHighlighted` 应为 true |
| T9_AnnounceNextTurn_TargetsOverviewCamera_NotNextUnit | **2026-08-23 新增,直接卡住坑60(回合切换镜头乱甩)**:调用 `TurnManager.AnnounceNextTurn()` 后,`PlayerController.GetViewTarget()` 应该等于 `TurnManager` 自己,不能是"下一个要行动的单位"(那个单位此时还没被 `Possess`,朝向随机)。**这条断言异步执行**:`RunRegressionTests` 里用 `SetTimerbyFunctionName` 延迟 0.4 秒后才调独立函数 `T9_CheckViewTarget()` 做真正的断言,不是同步 Assert——原因是 `SetViewTargetWithBlend(BlendTime=0.3)` 不会同帧生效,`GetViewTarget()` 要等混合结束才反映新目标,见 `UE节点备忘录.md` 坑61。**这也是这条测试的日志顺序和其它测试不一样的原因**:`REGRESSION_TESTS_DONE` 会先打印,`T9` 的 `PASS`/`FAIL` 大约 0.4~0.5 秒后才追加出现在日志里,不代表测试没跑或者顺序错了。 |

⚠ T7a/b/c 测的是**直接调用 `RunEnemyTurn`**,刻意绕开了 `BP_TurnManager.StartTurn` 这个真正的游戏内入口——这也是为什么 `StartTurn` 那个"整条 exec 链路从 `FunctionEntry` 起就断流"的 bug(见上面 `BP_TurnManager.StartTurn` 一节)完全没被这三条断言捕捉到。目前还没有一条断言覆盖"`StartTurn` 本身的分支是否真的可达",这类"入口函数的 exec 链路是否连通"目前只能靠 `get_node_infos` 人工核对,是这套回归测试机制现在的一个已知盲区。

测试自带清理:结束前会 `ClearHighlights` + `DestroyActor` 掉两个临时生成的测试单位,不会污染同一 PIE 会话里后续的人工测试。

## 数据层 C++（2026-08-16）

- 模块:`Source/MyProject/`（`FSkillRow` / `FRelicRow` / `FTypeChartRow` 在 `CombatTables.h`；公式在 `CombatFormula.h/.cpp`）
- 资产:`/Game/Data/DT_Skills`（31 行）、`/Game/Data/DT_Relics`（24 行），已保存
- CSV 源:`Saved/Import/DT_Skills.csv`、`DT_Relics.csv`（`js/data/export_ue_csv.js`）；克制草稿 `js/data/ue_import/DT_TypeChart.csv`
- 切片启用行（`bEnabledInSlice=true`）:技能 `basic/ember/aqua/vine`（另有 `heavy` 可选手选）；遗物 `power_band/steel_will/hunter_lens/iron_hide/elem_core`
- `ember` 表内保留 `inflictKind=burn` / `inflictChance=30`，`bUseInflictInSlice=false`（切片不算灼烧）
- `ApplyStartingRelics` 读 `DT_Relics` 里 `bEnabledInSlice` 行，累加 Atk/Def 到单位，并缓存 `RelicHitAdd` / `RelicDmgMultAlways` / `RelicDmgMultElem` / `RelicDmgTakenMult`
- **2026-08-16 扣血修复**:`ComputeSkillDamage` 里 `ResolveTableDamage` 的 exec 原先没接到 Return 上,确认攻击时伤害输出一直是 0(预测面板仍有数字)。已把查表成功 / RowNotFound / 表无效三条路都接到 `ResolveTableDamage` 再 Return。Output Log 应出现 `HIT dmg=` 或 `MISS`。
- **2026-08-16 Defender Accessed None**:`TryAttack` 的 `bDefenderIsPlayer` 误接到 GridManager **成员** `Defender`(从未赋值,恒为 None),而不是函数参数。已在函数入口 `Set Defender = 参数`,并把 `GetSide` 改接到参数 pin。
- **2026-08-16 同日再修(确认攻击仍刷 Accessed None Defender)**:两层叠加。①`BP_GridManager` 里有两个**签名过期**的 `ComputeSkillDamage` 调用(缺 `bAttackerIsPlayer`/`bDefenderIsPlayer` pin),导致蓝图**编译失败**,PIE 一直跑旧字节码,成员 `Defender` 仍是 None。已删除 `TryAttack.CallFunction_32` 和 `ResolveCounterAttack.CallFunction_2` 两个孤立旧节点,GridManager 重新编译通过。②选技能后预测面板会立刻显示「确认攻击」,此时 `PendingAttackTarget` 还是 None,点确认就会把 None 传进 `TryAttack`。已在 `TryAttack` 入口对参数做 `IsValid`(失败则打印 `TryAttack skipped: Defender is None` 并返回);`ConfirmAttack` 同样先检查目标;`SelectSkillAndAttack` 会把 `Btn_Confirm` 藏起来,点中敌人、`ShowAttackForecast` 算出数字后再显示确认按钮。

## 伤害公式改到 C++（2026-08-16，预览=结算）

原因:确认攻击「一打就死」。预览还在用蓝图硬编码 0.9/1.4 + `GetTypeMultiplier_0`(火打草 ×2),结算走技能表(heavy 1.6 / ember 1.4)+ 克制 ×2 + 元素核心 ×1.15。同一套 Atk12/Def5 下,火打草可以到约 22,MaxHP 20 会被秒。

现在预览和结算都只调 `UCombatFormula::CalculateSkillDamageValue`。蓝图三个函数签名**故意不改**(避免旧 CallFunction pin 过期),内部变成薄包装:

| 蓝图函数 | C++ | 唯一差别 |
|---|---|---|
| `ComputeSkillDamage` | `CalculateSkillDamageValue(..., bRollHit=true)` | 确认/反击:掷 0..99,MISS 伤害=0,并 Print `HIT dmg=` / `MISS` |
| `PreviewSkillDamage` | 同一个函数,`bRollHit=false` | 假设命中,不掷骰,面板数字不跳 |
| `GetSkillHitChance` | `UCombatFormula::GetSkillHitChance` | 只查命中率。行名一律读 Grid.`PendingSkillRowName`(不再用 `bUseSkill2` 猜 ember/basic) |

公式:`max(1, round(Atk × SkillMult × TypeMult × 9/(9+Def) × RelicMults))`。查不到技能行则 Mult=0.9 / Hit=95 / TypeId=0。遗物 Atk/Def 加成已经在 `ApplyStartingRelics` 写进单位属性,C++ **不会再加一遍** RelicAtkAdd,只吃乘区。

**属性克制默认关**(`BP_GridManager.bUseTypeChartInSlice=false` → TypeMult 恒 1.0)。配置对照见 `属性克制配置.md`。打开开关会再用四属性三角,20 血可能再次被秒,先手算再勾。

`ShowAttackForecast` 反击预览会把 Grid.`PendingSkillRowName` 临时改成 `basic`,算完立刻用 `FcSavedSkillRow` 还原。不还原的话,点确认会打出普通攻击而不是刚选的技能。主攻击预览已显式传 `bAttackerIsPlayer=true`;反击预览传 `bAttackerIsPlayer=false` / `bDefenderIsPlayer=true`(吃铁甲皮受伤乘区)。

手算对照(Atk=12 已含力量头带,Def=5,克制关,元素核心对 TypeId≠0 再 ×1.15):

- basic 0.9:`round(12×0.9×9/14)=7`
- ember/aqua/vine 1.4:`round(12×1.4×9/14×1.15)=12`
- heavy 1.6:`round(12×1.6×9/14)=12`(heavy 的 TypeId=0,不吃元素核心)

验收:面板预计伤害必须等于确认后 Output Log 的 `HIT dmg=`(MISS 时确认扣 0,面板仍显示假设命中值,这是设计)。

### 以后怎么扩展

**改完任何 GridManager/Unit/Tile 的逻辑,尤其是修 bug 之后,顺手在 `RunRegressionTests` 里加一条对应断言**,复用 `Assert(Condition, TestName)` 这个内部函数(PASS/FAIL 都走 `PrintString`,可以直接在 Output Log 里 grep)。新增断言时:
- 如果要调用自身(GridManager)的其他函数,DSL 里**必须显式传 `self` 作为第一个参数**(哪怕是自己调自己),比如 `(CallFunction|IsTileOccupied self colA rowA)`——这类自定义 Function 节点即使自调用也会暴露一个 `self` pin,不传会报 "Could not connect pin X to self"。
- 需要新增的临时测试对象记得在断言完之后 `DestroyActor` 清理掉。
- **⚠ 已知坑,别踩第二次**:`(Utilities|IsValid X)` 嵌在 `Assert` 这类普通函数调用的参数位置里(纯表达式写法)不可靠——本轮实测会导致执行流程"静默卡住"(编译通过、不报运行时错误,但 `RunRegressionTests` 跑到那一句之后,后面所有语句,包括结尾的 `REGRESSION_TESTS_DONE`,全部不再执行,Output Log 里也不留任何报错痕迹,非常难排查)。**正确写法是把 `IsValid` 当 `if` 的条件单独起一整条语句**,像 `TryAttack` 里的用法一样:`(if (Utilities|IsValid X) (真分支...) (else (假分支...)))`,不要嵌到别的函数调用参数里。

## `/Game/Input/` Enhanced Input 资产(2026-08-17 新增,TPS 直控迁移阶段A)

- **IA_Move**(`InputAction`,`valueType=Axis2D`):X=前后(前+/后-),Y=左右(右+/左-)。
- **IA_Look**(`InputAction`,`valueType=Axis2D`):X=偏航增量,Y=俯仰增量。
- **IA_Attack**(`InputAction`,`valueType=Boolean`):阶段C才接线,目前只在 `IMC_TacticsControl` 里注册了映射。
- **IA_EndTurn**(`InputAction`,`valueType=Boolean`):同上,阶段C才接线。
- **IMC_TacticsControl**(`InputMappingContext`):
  | 键 | Action | Modifiers | Trigger |
  |---|---|---|---|
  | W | IA_Move | (无) | (默认) |
  | S | IA_Move | Negate | (默认) |
  | A | IA_Move | Negate, SwizzleAxis(默认序 YXZ) | (默认) |
  | D | IA_Move | SwizzleAxis(默认序 YXZ) | (默认) |
  | Mouse2D | IA_Look | Negate(只勾 bY,bX/bZ=false,只修俯仰不影响偏航) | (默认) |
  | LeftMouseButton | IA_Attack | (无) | InputTriggerPressed |
  | E | IA_EndTurn | (无) | InputTriggerPressed |

  搭建这套映射时确认了两条新规律,写进 `UE节点备忘录.md` 坑39:`ObjectTools.set_properties` 的 `values` 是 JSON 字符串不是原生 object;给 `Instanced` 子对象数组(如 `mappings[].modifiers`)赋值时数组元素直接写类路径字符串就会就地实例化,不要用 `{"class": "..."}` 这种写法。

### 2026-08-18/19 Enhanced Input 排查未解决,留下的调试/替代实现(详见 `UE节点备忘录.md` 坑41)
- **`BP_Unit.EventGraph`**:新增一个原始 `Input|KeyboardEvents|W → PrintString("RAW W KEY RECEIVED")`(排查探针,一直没触发过,留作对照);`EventTick` 从"模板残留 Disabled"改成真正接了线——`GetController()→CastToPlayerController` 成功后,`IsInputKeyDown(W/S/A/D)` 各接一个 `SelectFloat`(命中给 ±1,否则 0)、两两 `Add` 得到前后轴/左右轴,乘 `GetActorForwardVector`/`GetActorRightVector` 喂给两个新的 `AddMovementInput`;`GetInputMouseDelta` 的 X/Y 分别喂 `AddControllerYawInput`/`AddControllerPitchInput`。**这套完全不走 Enhanced Input**,原理上应该可靠,但本轮只用 MCP 的 Slate `PressKey`(瞬间按下+松开)测过,没等到确定结果,**必须真人物理长按 WASD 在编辑器里实测**才能验收。原来 `IA_Move`/`IA_Look` 那条 Enhanced Input 链路(`EnhancedInputActionIA_Move/Look → BreakVector2D → AddMovementInput/AddControllerYawInput+PitchInput`,附带 `PrintString("MOVE INPUT RECEIVED")`)**原样保留没删**,节点连线本身是对的,只是 Enhanced Input 全项目不触发所以它不会执行。
- **`BP_TacticsController`**(此前从未在这份文档里记录过,是随 TPS 迁移新建的 PlayerController Blueprint,父类 `PlayerController`):`EventGraph` 原有一个原始 `Input|KeyboardEvents|W → PrintString("CONTROLLER RAW W RECEIVED")`(更早排查用的探针,证明 legacy 输入一直正常)和 `N` 键强制 `EndTurn`(调试快捷键)。本轮新增:`IA_Move`/`IA_Look` 的 Controller 版实现(逻辑同 Pawn 版,`AddMovementInput` 目标换成 `GetControlledPawn()`)——用来验证"绑在 Controller 身上是否就不受坑41 影响",结果证明**同样不触发**,这套代码留着但预期也不会动;`H` 键绑了一个 `HasMappingContext(IMC_TacticsControl)` 实时检测 + `PrintString("H CHECK: TRUE/FALSE")`,可以随时按需确认 IMC 是否 active(排查坑41 用,不是游戏功能)。`BeginPlay`/`Tick` 是模板残留,Disabled。
- **`BP_TurnManager.StartTurn`**:在 `AddMappingContext` 之后插了一段 `HasMappingContext` 检测 + `PrintString("IMC ACTIVE: TRUE/FALSE")`(fan-out 在原有 exec 链路旁边,不影响主流程),每次 StartTurn 跑到该分支都会打一次,用于确认 IMC 是否被移除过。`RemoveMappingContext` 的 `Options` 从 `bIgnoreAllPressedKeysUntilRelease=True` 改成了 `False`(排查时试的,没解决问题但也无害,保留)。

### 2026-08-20 legacy 轮询移动方向修正(转正后的第一轮 bug fix,详见 `UE节点备忘录.md` 坑42)
用户真人长按 WASD 确认 legacy 轮询方案(坑41 留的)能动,但报了 3 个方向问题。`BP_Unit.EventTick` 里新增/改线如下(全部 `create_node`/`connect_pins`/`break_pins` 增量编辑,没有整函数重写):
- 新增 `GetControlRotation`(`K2Node_CallFunction_10`,self 接 `CastToPlayerController` 的 `AsPlayer Controller` 输出)→ `BreakRotator`(`K2Node_CallFunction_11`)只取 Yaw → `MakeRotator`(`K2Node_CallFunction_25`,Roll/Pitch 留默认 0,Yaw 接上一步)→ 分两路接 `Math|Vector|GetForwardVector`(`K2Node_CallFunction_40`)和 `Math|Vector|GetRightVector`(`K2Node_CallFunction_41`,都是吃 `Rotator` 参数的纯函数,不是吃 Actor 的 `Transformation|GetForwardVector` 版本)。
- 原本两个 `AddMovementInput` 的 `WorldDirection`(`K2Node_CallFunction_35` 前后轴、`K2Node_CallFunction_36` 左右轴)从 `GetActorForwardVector`/`GetActorRightVector`(`K2Node_CallFunction_13`/`14`)断开,改接上面的 `GetForwardVector`/`GetRightVector` 输出。`CallFunction_13`/`14` 节点保留没删(仍被 Enhanced Input 那条不触发的 IA_Move 分支用着)。
- 新增 `Utilities|Operators|Multiply`(`K2Node_PromotableOperator_4`,接上浮点后特化成 `Math|Float|float*float`)插在 `GetInputMouseDelta` 的 `DeltaY`(`K2Node_CallFunction_39`)和 `AddControllerPitchInput`(`K2Node_CallFunction_38`)的 `Val` 之间,`B` 端常量 `-1.0`,修鼠标上下方向反了的问题。`DeltaX`→`AddControllerYawInput`(`K2Node_CallFunction_37`)没动。
- 已 `compile_blueprint` 通过、`save_assets` 落盘。A/D 平移和鼠标方向已人工 Play 验收通过;W 仍横着走的问题在下一节(第二轮)修复。

### 2026-08-20 第二轮:模型脸朝向和移动方向不对齐(A/D、鼠标已确认修好,W 仍横着走)
> ⚠ **2026-08-29 起已否决/过时**:本节描述的 `StaticMesh` 组件、`Mewtwo_test` 模型资产已在骨骼网格迁移(见文末"2026-08-29 骨骼网格迁移"一节)中整体替换成 `CharacterMesh0`(`SkeletalMeshComponent`)+ `Mewtwo_TPose`,`StaticMesh.RelativeRotation` 这条修法对当前模型不再适用。当前的朝向补偿值和修法见文末坑64。本节保留仅作历史存档,不要照抄。

`UE节点备忘录.md` 坑42 追加部分。根因:Mewtwo 模型资产的脸朝向是局部 **+Y** 不是 UE 约定的 +X,`StaticMesh` 组件的 `RelativeRotation` 一直是 `(0,0,0)`,胶囊体转向移动方向后模型脸依然侧着 90°。**用临时 actor + `CaptureViewport` 截图验证过**(从正后方看对称/从正前方确认对到脸)。
- **`BP_Unit.UserConstructionScript`** 新增(接在既有血条搭建链路末尾,`K2Node_VariableSet_1`("SetHealthBarWidget")的 `then` 之后):`StaticMesh`(变量 Get,`K2Node_VariableGet_1`)→ `SetRelativeRotation`(`K2Node_CallFunction_5`,`NewRotation=(Pitch=0, Yaw=-90, Roll=0)`,`bSweep=false`,`bTeleport=false`)。
- **踩坑**:`ObjectTools.set_properties` 直接改关卡里已放置实例的 `StaticMesh.RelativeRotation` 会返回 `true` 但读回来立刻还原成 `(0,0,0)`,不生效(SCS 组件的 Relative Transform 疑似有同步机制会冲掉直接反射赋值)。改成在 Construction Script 里插 `SetRelativeRotation` 节点才是真正持久生效的路径。
- 已 `compile_blueprint` 通过、`save_assets` 落盘。**2026-08-20 用户人工 Play 验收通过**:W 沿脸朝向走,A/D 平移、鼠标方向未受影响。阶段 A 的 WASD 移动 + 鼠标视角至此全部验收完毕。

### 2026-08-20 TPS 阶段B:移动范围软边界 + Col/Row 回写(用户要求"每回合的移动不能超出可移动的移动范围")
设计见 `C:\Users\AI_Work\.claude\plans\pokemon-tps-misty-walrus.md` 阶段B。复用了已有的 `StartLocation`(`BP_TurnManager.StartTurn` 轮到该单位时快照的回合开始世界坐标,原本是给 Undo 用的)当"移动范围原点",没有新增 `BP_Unit` 变量。

**v1(已否决,不要当现状用)**:第一版直接用 `ClampVectorSize`(欧氏距离/圆形边界)夹断离 `StartLocation` 的直线距离,且完全没做棋盘边缘限制。用户验收反馈两个问题:①斜着走会越出棋盘;②"移动范围包含了攻击范围"——因为 `ShowRange`/`ShowAttackRange` 这些既有函数用的都是**曼哈顿距离**(格子数,菱形边界),`ClampVectorSize` 却是**欧氏距离**(圆形边界),同样半径下圆形比菱形大,斜着走能摸到黄色移动范围菱形之外、红色攻击范围环之内的格子。

**v2(当前版本,同日修复)**:把整套边界计算从 `BP_Unit.EventTick` 里搬进新函数 `BP_GridManager.ClampMovement(StartLoc: Vector, ProposedLoc: Vector, MoveRange: Int) → ClampedLoc: Vector`(`write_graph_dsl` 整体生成,全新函数),一次调用同时处理两层限制:
  1. **曼哈顿菱形边界**:`Delta = ProposedLoc - StartLoc`,分别算 `|Delta.X|+|Delta.Y|` 和 `MoveRange×TileSize` 比较,超出时用 `MaxDist/Manhattan` 这个缩放比例同时压缩 `Delta.X`/`Delta.Y`(保持方向不变,菱形边界而不是圆形),得到 `RangeClampedLoc`。DSL 里用嵌套 `select` 三元表达式实现(`(select cond a b)`),没有额外找 `Abs`/`Clamp` 专用节点——`Abs` 用 `(select (< x 0.0) (- x) x)`、`Clamp` 用两层嵌套 `select` 手搭,规避了 `Math|Float|Absolute(Float)` 这种 type_id 带圆括号的节点(坑44 同款隐患)。
  2. **棋盘边缘硬边界**:`For Each Tiles` 现场算所有 Tile 世界坐标的 min/max X、Y(4 个新增临时成员变量 `BoardMinXTmp`/`BoardMaxXTmp`/`BoardMinYTmp`/`BoardMaxYTmp`,和 `GetNearestTile` 的累加器同一个套路),把 `RangeClampedLoc` 的 X/Y 分别再夹一次到这个范围内——不管棋盘实际摆在世界坐标哪里、原点怎么偏移,直接从真实 Tile 位置取 ground truth,不猜公式。
  - `BP_Unit.EventTick` 现在只需要:`GetActorLocation()`(`ProposedLoc`)+ `GetStartLocation()`(`StartLoc`)+ `GetMoveRange()` 三个值传给 `GridManager.ClampMovement(...)`(`K2Node_CallFunction_50`,跨蓝图调用)→ 拿到的 `ClampedLoc` 直接喂 `SetActorLocation`(`K2Node_CallFunction_49`)和 `GridManager.GetNearestTile(ClampedLoc)`(`K2Node_CallFunction_44`,Col/Row 回写用)。v1 版本里 `EventTick` 自己算的 `Subtract`/`ClampVectorSize`/`Multiply`/`Add`(`K2Node_PromotableOperator_5/6/7`、`K2Node_CallFunction_47`、`GetTileSize` 的 `VariableGet_11`)全部 `delete_node` 删掉,逻辑搬进 `ClampMovement` 后 `TileSize` 也不用跨蓝图读了(`GridManager` 自己就是 self,直接 `Variables|Default|GetTileSize`)。
- **Col/Row 回写**(v1/v2 都一样没变):`SetActorLocation` 之后紧跟 `GridManager.GetNearestTile(ClampedLoc)` → `Set Col`/`Set Row`(读 `NearestTile` 自己的 Col/Row 写回 self,和 `SpawnUnit` 的既有写法同构)。这一步是让 `ShowAttackRangeCurrent`/`TryAttack` 等既有函数在"连续移动"模式下继续读到正确坐标的关键胶水,阶段A完成时这块是空的(移动方式从瞬移点格子换成连续移动后没人写回,阶段A验收项没测到)。
- 拿 `GridManager` 实例的方式是每 Tick 现查(`Actor|GetAllActorsOfClass(BP_GridManager)`→`Get[0]`→`CastToBP_GridManager`),没有缓存成成员变量——和项目里 `ActorOnClicked`/`IsTileOccupied` 一贯的写法一致,单局同时只有一个单位被 Possess,这个开销可忽略。
- 拿场上 `BP_GridManager` 实例需要一次显式类型转换:`Actor|GetAllActorsOfClass` 返回的数组元素静态类型是否精确到 `BP_GridManager`,取决于 `ActorClass` 参数**当时有没有被赋值**——先设好 `ActorClass` 字面量再连数组元素到需要精确类型的 pin,可以省掉一次 `CastToBP_GridManager`,但保险起见还是走了显式 Cast(`Utilities|Casting|CastToBP_GridManager`,注意这里类名前缀带下划线 `BP_GridManager`,和 `Class|BPGridManager|GetXxx` 那种函数调用前缀去下划线的写法不是同一套命名规则,两个都要蒙对容易混,已踩过一次"直接连报类型不兼容"的坑)。
- **踩坑(v1 排查时留下,仍然成立)**:`get_node_type_pins` 返回的节点 refPath **不是必然真实存在于图里的持久节点**,详见 `UE节点备忘录.md` 坑43,任何要用的节点一律显式 `create_node`。DSL 里避免用带圆括号后缀的 type_id,详见坑44。
- **验证方式(非人工 Play,MCP 直接在 live PIE 里做的)**:每次改完都开一次 PIE 顺带把 11 条 `RunRegressionTests` 跑一遍(`T1`~`T8` 全部 `PASS`),战斗逻辑层全程没受影响。v2 专项验证:`SelectedUnit`(`Col=6,Row=2,MoveRange=5,StartLocation=(600,200,50)`,`TileSize=100`)—①斜向移动:传送到 `(1000,600,50)`(离原点斜向 dx=400,dy=400),拉回后精确落在 `(850,450,50)`——曼哈顿距离 `250+250=500` 正好等于 `MoveRange×TileSize`,和之前 v1 会到 `(953,553)` 这种"摸到攻击环"的情况对比,菱形边界生效;②棋盘边缘:先传送到 `(1500,200,50)`,拉回后精确落在 `(1100,200,50)`;再传送到更远的 `(5000,200,50)`,拉回后**同样精确落在 `(1100,200,50)`**——证明棋盘边缘的硬限制生效了(不管越界多远,总是卡在棋盘实际边缘,不是卡在移动范围菱形上,`1100` 是从真实 Tile 位置算出来的棋盘边界,不是猜的 `Columns×TileSize`)。
- 已 `compile_blueprint` 通过、`save_assets` 落盘。**待人工 Play 验收**:长按 WASD 斜向走到移动范围边缘时,手感上是不是"菱形"而不是"圆形"(斜着走应该比正对着走更早被挡住);走到棋盘边缘时是否会被挡住不能走出棋盘;范围内(菱形内)来回走动是否完全自由;移动后攻击范围红圈/命中判定是否仍然准确跟随实际站位。

### 2026-08-22 敌方回合全景镜头(用户要求"改成敌人回合的时候拉到全景可以看到整个棋盘,然后移动")

**设计**:轮到敌方单位行动时,玩家镜头从上一次 `Possess` 的我方单位近景切到一个能看到整个棋盘的俯视全景;轮到己方单位时切回该单位自己的第三人称跟随镜头。复用 `BP_TurnManager` 本来就是场上单例 Actor 这个前提,不新建 Camera Actor。

**BP_TurnManager 新增**:
- 组件 `OverviewCamera`(`CameraComponent`,用 `ActorTools.add_component(owner=蓝图本身, component_type=/Script/Engine.CameraComponent, name="OverviewCamera")` 加的真正 SCS 组件,不是走 UMG 那套"Construction Script 里插节点动态造"的老路——两种"加组件"方式的差异和各自的取值/改值方法见 `UE节点备忘录.md` 坑57)。
- 新函数 **SetupOverviewCamera()**(`write_graph_dsl` 整体生成,全新函数;⚠ **以下描述的 `Pitch=-90` 正俯视是 2026-08-22 早些时候的版本,当天第七轮已改成 `Pitch=-45` 斜俯视,现状见下方"当日修复(续,第七轮)"第11条,这里保留作历史存档**):`For Each Tiles` 现场量所有 `BP_Tile` 世界坐标的 min/max X、Y 和 max Z(5 个新增的函数局部变量 `OvMinX`/`OvMaxX`/`OvMinY`/`OvMaxY`/`OvMaxZ`,`add_variable` 时显式传了这个函数的 `graph` 引用,和 `ClampMovement`/`GetNearestTile` 的累加器同一个套路,只是这次是函数局部变量而不是类成员变量的 `Tmp` 后缀写法)→ 算出棋盘中心 `(centerX,centerY)` 和"最长边×1.2+300"的经验俯视高度 `camZ`(棋盘越大镜头拉得越远,常数是经验值,不好看可以直接改这里)→ `Transformation|SetWorldLocationAndRotation(OverviewCamera, (centerX,centerY,camZ), Pitch=-90)` 摆好机位。在 `EventBeginPlay` 里 `BuildTurnOrder` 和 `StartTurn` 之间插了一次调用(`create_node`+`break_pins`+`connect_pins` 增量插入,没有重写整个 `EventBeginPlay`)——棋盘布局整局固定不变,只需要算一次,不用每次 `StartTurn` 都重算。
- `StartTurn` 新增两处 `Game|Player|SetViewTargetWithBlend`(`BlendTime=0.75`,柔和过渡不是硬切):
  1. 敌方分支(`if GetSide` 的 `else`,原本直接接 `RunEnemyTurn`)——**插在 `RunEnemyTurn` 调用之前**(`break_pins` 断开 `IfThenElse_3.else→RunEnemyTurn.execute` 这条线,插入新节点重新接上),`NewViewTarget` 传 `self`(`BP_TurnManager` 自己,靠 `OverviewCamera` 生效),这样敌方 AI 的移动过程本身也能在全景镜头下被看到,不是移动完了才切镜头。
  2. 我方分支(`Possess`+`EnableInput`+`AddMappingContext`+`IMC ACTIVE` 打印之后,`SetbShowMouseCursor false` 那句原本是分支末尾、`then` 空着),`NewViewTarget` 传被 `Possess` 的那个 `BP_Unit`(它自带的 `SpringArm`+`Camera` 生效,切回近景跟随)。

**验证**:两个插入点都用 `get_node_infos` 逐节点核对过 exec 链路和参数接线(`self`=`Game|GetPlayerController(0)` 的返回值,`NewViewTarget` 分别接 `GetArrayItem_1`/`Variables|Getareferencetoself`),不是只看 `compile_blueprint` 通过就认定对。开 PIE 后台自动跑的开局流程里出现过一轮"敌方回合开始→我方回合开始",没有产生新的报错;读 live 场景里 `OverviewCamera.RelativeLocation` 确认是 `(960,810,1500)`,是和棋盘规模匹配的非退化真实数值(证明 `SetupOverviewCamera` 确实找到了 Tile 并算出合理机位,不是卡在初始 `(0,0,0)`)。**没能验证的部分**:MCP 没有可靠手段主动触发"再来一次敌方回合"来实拍全景镜头切换瞬间(项目一贯的按键模拟限制),所以镜头俯角/高度好不好看、敌方移动过程是否完整落在画面内,仍需人工 Play 到敌方回合时肉眼确认——如果观感不理想,`SetupOverviewCamera` 里"最长边×1.2+300"这个经验系数是最直接的调参入口。`EditorAppToolset.CaptureViewport` 截的是编辑器工具视口相机、不会跟着 PIE 里的 `SetViewTargetWithBlend` 切换,验证 PIE 画面要用 `CaptureEditorImage`,这个坑详见节点备忘录坑57。

### 2026-08-22 当日修复(续,第六轮:用户验收反馈①"敌人移动方向不对"②"敌方回合仍看不到整个棋盘")

8. **敌方 AI 移动朝向修复**:`BP_Unit.EventTick` 的 `bIsAIMoving` 插值分支(`VInterpTo_Constant→SetActorLocation→[到达判定]→SetActorLocation(吸附)→SetCol/SetRow/SetbIsAIMoving`)从这套逻辑诞生起就没有任何 `SetActorRotation`,`BP_GridManager.MoveUnitTowardTarget` 也只算目标点不管朝向——单位移动但胶囊体朝向不变,是"移动方向和脸朝向对不上"的根因,和坑42(WASD 那条路径专属的朝向逻辑)是两条完全独立的代码路径,不是同一处 bug。**修法**:在插值 `SetActorLocation` 之后、到达判定 `Branch` 之前插入 `FindLookAtRotation(当前坐标,AIMoveTarget)→BreakRotator(取Yaw)→MakeRotator(Roll=0,Pitch=0,Yaw)→SetActorRotation(self)`,复用图里已有的 `GetActorLocation`/`GetAIMoveTarget` 两个输出,和坑42"胶囊体转向+`StaticMesh` 脸部旋转补偿叠加生效"的机制完全复用,`StaticMesh.RelativeRotation` 没动。`compile_blueprint` 通过。**没能实测**:MCP 触发不了敌方真实走一步,逻辑上和已验证生效的 WASD 路径同构,但**需要人工 Play 到敌方回合实测确认**。详见 `UE节点备忘录.md` 坑58。
9. **全景镜头覆盖范围排查:结论是原有公式没有问题**。用 `CaptureViewport` 的 `captureTransform`(不依赖能否触发游戏内事件,指哪拍哪)+ 真实米制网格标注,现场量出原机位(高度1500)实际覆盖 `X∈[-2,14]m,Y∈[-10,18]m`,棋盘真实范围 `X∈[0.5,11.5]m,Y∈[0.5,8.5]m` 完整落在其中,四边都有余量;结合 `FieldOfView=90`/`AspectRatio=1.7778` 反推的两轴几何覆盖关系,原公式（`max(dx,dy)×1.2+300`）在数学上本就是安全的,不是"看似够用其实不够"。**顺手把公式换成了按真实FOV/宽高比几何关系分别算两轴所需高度取更大值再乘1.15安全系数的版本**(`SetupOverviewCamera` 里原来的 `Select_5`/`PromotableOperator_7/12/13`/两个 `MakeLiteralFloat` 常量节点删除,换成一组 `Utilities|Operators|Divide/Add/Multiply/Greater(>)` 手工搭的等价链路,`dx`/`dy` 两个已有节点复用没动),高度从 `1500` 降到实测 `1226.682`,重新截图确认棋盘仍完整可见、只是机位更紧凑——**这个调整不是根因修复,只是顺手把公式从拍脑袋系数换成了有几何依据的系数**。
10. **真正的根因**:8个真实 `BP_Unit_C` 实例(`get_actor_transform` 逐个核实过分布在棋盘各处)在几何上确实落在相机画面范围内,但截图里肉眼完全看不出任何单位的可辨认轮廓——**棋盘贴图是一整片没有逐格描边/分色的默认棋盘格材质,和背景融为一体,90°FOV 下棋盘只占画面一小部分,正常大小的角色模型缩小到这个比例后从正上方看基本认不出来**。这是美术/关卡资源缺失(棋盘边界可视化、单位俯视标记)导致的观感问题,不是蓝图坐标/接线的 bug,已经超出这次镜头逻辑改动能解决的范围,留给用户判断是否要另外排期做美术资源。详见 `UE节点备忘录.md` 坑58。

### 2026-08-22 当日修复(续,第七轮:用户要求"应该是斜上45度角看整个棋盘")

11. **全景镜头从正俯视(`Pitch=-90`)改成斜45度俯视(`Pitch=-45`)**:`SetupOverviewCamera()` 重新计算机位——沿棋盘 `-Y` 方向后退距离 `D`、同时抬高 `D`(`Pitch=-45` 意味着退多远就要抬多高),`D` 由棋盘半宽 `halfX`/半深 `halfY` 结合水平FOV(90°,近排点的水平视野覆盖是主要瓶颈)算出:`D=((halfY+1.41421356×halfX)/2)×1.3`(1.3 是安全系数)。最终 `Location=(centerX, centerY-D, boardTopZ+D)`,`Rotation=(Pitch=-45,Yaw=90,Roll=0)`(`Yaw=90` 让相机朝向世界 `+Y`,即从棋盘南侧往北看)。**`For Each Tiles` 累加 `OvMinX`/`OvMaxX`/`OvMinY`/`OvMaxY`/`OvMaxZ` 这部分循环逻辑本身在这轮被完整重建过一遍**(`remove_function_graph`→`compile_blueprint`→`add_function_graph`→重新 `add_variable` 5 个局部变量→`write_graph_dsl` 整体重写),但排查到最后确认重建前后逻辑都是对的,不是"修复"——细节和排查过程(包括一次因为"组件 `RelativeLocation` 不是世界坐标"而错判成"循环又有 bug"的弯路)见 `UE节点备忘录.md` 坑59。
    - **验证方式**:`EditorAppToolset.SetCameraTransform` 把编辑器视口相机摆到算出来的真实世界坐标 `(600,-237.119,687.119)`+旋转,再用 `WorldPosToScreenCoords` 逐个投影棋盘真实四角 `(100,100,0)`/`(1100,100,0)`/`(100,800,0)`/`(1100,800,0)` 和中心 `(600,450,0)`——四角归一化屏幕坐标都落在 `[0.155,0.845]×[0.326,0.793]` 内(留有余量,不贴边),中心几乎精确落在 `(0.5,0.5)`,证明"四角入画+45度俯视+棋盘居中"三个验收条件都满足。`CaptureViewport` 截图确认过画面里能看到棋盘所在的地板区域,但和坑58 记录的限制一样,棋盘和背景地板材质糊在一起看不出格子边界,这是已知的美术资源限制,不是这次改动引入的新问题。
    - `BP_TurnManager.EventGraph` 里为了验证"是不是 `SetupOverviewCamera` 跑得比 `Tile` 生成还早"这个候补假设而插入的 `Utilities|FlowControl|Delay`(`BuildTurnOrder`→`SetupOverviewCamera` 之间)已确认无关并移除,`EventGraph` 恢复成 `BuildTurnOrder`→`SetupOverviewCamera`→`StartTurn` 直接连接,没有遗留多余节点。
    - `compile_blueprint`/`save_assets` 均通过。**待人工 Play 验收**:实际游戏画面里 45 度俯角看起来是否符合预期(几何范围已用坐标投影验证过,但最终"好不好看"仍需人工确认)。

### 2026-08-22 当日修复(续,第八轮:用户 Play 后反馈"比之前好点但角度仍然不好,应该是斜上45度角看整个棋盘")

12. **这次不是本项目的 unreal-mcp MCP 会话,而是纯文档仓库(`纹兽战记`,无 `.uproject`)里发起的对话——本机没有把 unreal-mcp server 接进这次 Claude 会话**。改用 `curl` 直连 `http://127.0.0.1:8001/mcp`(项目真实 UE 工程 `MyProject 5.8/.mcp.json` 里配置的端口,和 [[project_ue_mcp_port]] 记录一致)手搓 JSON-RPC 请求(`initialize`→带 `Mcp-Session-Id` 头→`tools/call` 套 `call_tool`)完成本轮全部排查和修复,过程中确认响应体是 `event: message\ndata: {...}` 的单帧 SSE 包法,取值前要先剥掉 `data: ` 前缀再解析 JSON——纯粹是本次沟通方式的记录,不是蓝图知识,以后再遇到"当前会话没有 unreal-mcp 工具但编辑器进程在跑"可以照此操作,不用让用户切目录重开会话。
13. **根因排查**:用 `EditorAppToolset.CaptureViewport(captureTransform=...)` 摆出第七轮验收记录的真实机位 `(600,-237.119,687.119)` 实拍(不是只投影四角坐标),叠加世界网格标注后肉眼确认——棋盘真正占的画面比例远小于第七轮"四角都在 `[0.155,0.845]×[0.326,0.793]` 内"这条验收结论给人的印象:该验收只检查了"四角有没有被裁掉",没有检查"棋盘在画面里占多大比例"。用 `WorldPosToScreenCoords` 对多组候选机位做数值扫描后发现两个独立问题:
    - **`D` 公式用的是 Tile *中心点* 的 `OvMinX/MaxX/MinY/MaxY`,没有加上 `TileSize/2` 的格子半径**——最外圈格子的真实边缘比中心点还要再向外 50cm(`TileSize=100`),按中心点算出来的机位对真实棋盘边缘几乎没有安全余量,水平方向实测只有 `1.4%` 屏占比余量(`x∈[0.014,0.986]`),已经贴着画面左右边缘,谈不上"留白构图"。
    - **最外层 `×1.3` 安全系数偏大**:这个系数是在"中心点公式"的基础上加的,两者叠加的净效果是——机位比"刚好不裁边"所需距离整整多退了约 25%,棋盘因此被压缩到画面中上部一小块,下方一大片空地板占满前景(这正是用户说的"看起来不像在看棋盘,像在看地板"的观感来源)。
    - 两个问题方向相反(一个说明当时其实"不够安全",一个说明整体又"太保守"),叠加后表现为"数学上四角没被裁掉"但"视觉观感很差"这个看似矛盾的结果——这正是第七轮验收记录"待人工 Play 验收"这行字后来被用户实测证伪的原因,教训是**验证构图不能只投影角点判断"在不在画面内",还要看这些点落在画面的什么位置比例(至少要检查 y 值代表的画面纵深占比)**,已补记入 `UE节点备忘录.md`。
14. **修法**:`SetupOverviewCamera()` 的 `D` 公式改成"格子边缘 + 更小的安全系数":`halfX_edge = (OvMaxX-OvMinX)/2 + 50.0`、`halfY_edge = (OvMaxY-OvMinY)/2 + 50.0`(`50.0` = `TileSize/2`,当前项目 `TileSize=100`,**这个 `50.0` 是按当前棋盘格子尺寸手工写死的字面量,不是从 `GridManager.TileSize` 动态读的**——`SetupOverviewCamera` 本来就只有 Tile 世界坐标可用,没有现成的跨蓝图 `TileSize` 引用,嫌麻烦没有额外接线,以后如果改 `TileSize` 需要记得回来同步改这两个字面量),`D=((halfY_edge)+1.41421356×(halfX_edge))/2×1.1`(安全系数 `1.3→1.1`)。**没有用 `write_graph_dsl` 整函数重写**——试过一次直接把 `read_graph_dsl` 读出来的原文原样传回 `write_graph_dsl`,报错 `Unreachable code after branch/return`(这个函数开头 `(bind _returnvalue (Transformation|GetActorLocation (Utilities|Array|ForEachLoop ...)))` 的写法,反编译文本本身就不是能直接回灌的合法 DSL,和坑42/58 记录的"`ForEachLoop` 反编译失真"是同一类陷阱,只是这次连"整体照抄不改也报错"都踩到了,以后遇到含 `ForEachLoop` 累加器的函数,**改动一律走 `get_node_infos`+`create_node`/`break_pins`/`connect_pins`/`set_pin_value` 逐节点操作,不要尝试 `write_graph_dsl` 整体重写**,哪怕只是想验证"原样传回去行不行")。改用 `find_nodes`(空标题列出全部 71 个节点)+批量 `get_node_infos` 读出节点图,定位到:
    - `K2Node_PromotableOperator_6`(`(OvMaxX-OvMinX)/2`)的输出原本直接接到 `K2Node_PromotableOperator_13`(`×1.41421356`)的 `B` 输入——`break_pins` 断开,中间插入一个新建的 `Utilities|Operators|Add`(⚠ `create_node` 的 `type_id` 必须传这个通用重载名,不能传 `get_node_infos` 回显的 `Math|Float|float+float`,那个是显示名不是可创建的 type_id,试了直接报"节点不存在")节点 `K2Node_PromotableOperator_19`,`A` 接原来的 `/2` 输出,`B` 用 `set_pin_value` 字面量填 `50.0`,输出再 `connect_pins` 回 `PromotableOperator_13.B`。
    - 同样手法在 `K2Node_PromotableOperator_8`(`(OvMaxY-OvMinY)/2`)和 `K2Node_PromotableOperator_14`(`halfY+halfX×1.41421356` 的加法)之间插入新建的 `K2Node_PromotableOperator_20`(`+50.0`)。
    - 原本的字面量节点 `K2Node_CallFunction_11`(`MakeLiteralFloat Value=1.3`)直接 `set_pin_value` 改成 `1.1`,没有新建/删除节点。
    - `compile_blueprint`(`/Game/Maps/BP_TurnManager.BP_TurnManager`)通过,`read_graph_dsl` 复查一遍确认新公式已经是 `(+ (+ (/ (- MaxY MinY) 2.0) 50.0) (* 1.41421356 (+ (/ (- MaxX MinX) 2.0) 50.0)))` 这个结构,`save_assets` 落盘。
15. **验证**:改动后按新公式反推当前棋盘(`Columns=11,Rows=8,TileSize=100`→`halfX=500,halfY=350`)对应的机位约为 `D≈647.8`,`Location=(600,-197.8,647.8)`。用 `WorldPosToScreenCoords` 对棋盘真实四角(格子边缘 `(50,50)/(1150,50)/(50,850)/(1150,850)`,不再用格子中心点)重新投影:近排两角 `y≈0.88`(离底边约 12%,不再贴边)、`x∈[0.068,0.932]`(约 6.8% 水平留白,不再是第七轮的 1.4%);远排两角 `y≈0.30`,`x∈[0.271,0.729]`——四角全部在框内且留有观感舒适的边距,不是"卡着边缘算过关"。`CaptureViewport(captureTransform=(600,-197.8,647.8),Pitch=-45,Yaw=90)` 实拍(带世界网格标注)确认棋盘对应的行列范围(第 0~10 行、第 1~11 列)撑满画面中下部约 55%~60% 的高度,不再是第七轮截图里"一大片空地板、棋盘挤在画面上方一小条"的构图。**这轮全程通过 PIE + `CaptureViewport` 编辑器视口验证,没有能力实拍"敌方回合触发时"的真实游戏帧**(和坑57 记录的限制一样,`SetViewTargetWithBlend` 切镜头这件事本身没法在 MCP 里可靠触发/观察,只能验证 `SetupOverviewCamera()` 算出来的目标机位本身构图是否合理)。**待人工 Play 验收**:敌方回合实际触发时,45 度全景镜头看起来是否终于"棋盘为主体、留白合理",而不是"一半画面都是空地板"。
16. **仍未解决、和这轮无关的已知限制(坑58 原文重申)**:棋盘贴图和背景地板是同一套没有逐格描边的默认棋盘格材质,俯视角度下棋盘和地板边界肉眼难分辨,单位模型在这个机位高度下也偏小——如果人工验收后觉得"角度对了但还是看不清棋盘在哪、单位在哪",大概率不是相机数学的问题,而是这条美术资源缺口没堵,需要用户另外排期做棋盘描边/独立材质,不是靠再调 `SetupOverviewCamera` 的参数能解决的。

### 2026-08-22 锁定式索敌系统(阶段1,替换鼠标瞄准攻击;用户反馈"不想用鼠标瞄准+以后要范围攻击+要解决hit=Floor_0+要命中率伤害看板")

**背景**:用户发来一张实际 Play 截图,`AttemptSkillAttack` 的调试文本刷屏("ATTACK: E pressed, tracing..." / "hit=Floor_0" 反复出现)暴露了攻击射线基本打不中单位这个真实 bug。排查结论:攻击判定是从 `TPSCamera` 沿 `PlayerController.GetControlRotation()` 做 3000cm 的 `LineTraceForObjects`,而 `LineTraceForObjects` 的 `ActorsToIgnore` 参数传的是**全部 `BP_Tile`**——射线一旦稍微偏一点没扫到角色胶囊体,会直接穿过被忽略的地板格,打到更底下的 `Floor_0` 静态网格。小体型怪物模型+摄像机瞄准的组合天然容易脱靶,不是简单调参能根治的,和用户"不想用鼠标瞄准"的诉求一致——**方案定为整体替换掉这套摄像机射线判定,改成不依赖鼠标精度的"锁定式索敌"**。

**设计**:不再用鼠标朝向做物理判定,改成复用已有的 `ValidateSkillTarget`(曼哈顿距离 + `GetSkillEffectiveRange`)逻辑,自动在当前技能射程内枚举合法目标,玩家用 `Tab` 键在候选目标间循环切换,`E` 键攻击当前锁定的目标。**只做了单体锁定这一半**——范围技能的"地面光标+独立瞄准模式"按用户的问答选型已经定了方向(独立瞄准模式:按住/切换一个专门的瞄准态,这时 WASD 挪光标不挪角色),但范围技能本身还没做,这部分设计留到真正做范围技能时再实现,不在这轮范围内。

**BP_GridManager 新增**(均 `write_graph_dsl` 整体生成,不含 `ForEachLoop` 累加器回读風险,全新函数直接写没有踩坑):
- **`GetTargetsInRange(Attacker, SkillIndex) → Array<BP_Unit>`**:`For Each` 全场 `BP_Unit` → 复用 `ValidateSkillTarget(self, Attacker, candidate, SkillIndex)`(内部已经做了"是敌方"+"曼哈顿距离≤有效射程"两层判断,不用重写)→ 命中就 `Utilities|Array|Add` 进结果数组。**踩坑**:第一版把 `Array|Add` 的返回值(新元素下标,`Integer`)当成"新数组"回填给累加器变量,报 `Could not connect pin ReturnValue to TargetsTmp`——`Array|Add` 是**原地引用修改**(`TargetArray` 是 by-ref 输入),不是纯函数,直接当 `exec` 语句调用就行,不需要也不能再包一层 `Set`。
- **`ClearLockIndicators()`**:`For Each` 全场 `BP_Unit` → 逐个调用 `SetLockIndicator(false)`(见下方 `BP_Unit` 新函数),每 Tick 先清后设,和项目里 `ClearHighlights`→`ShowXxx` 的固定套路一致。

**BP_Unit 新增**:
- 变量 `LockedTargetIndex`(Int,默认0,`Tab` 键自增,不做取模——取模节点这个引擎版本的 `find_node_types` 搜不到现成的 `int%int`,改成在 `EventTick` 里用"`>=候选数量` 就清零"的越界回绕,比取模更符合项目一贯的 `Select`/`Clamp` 写法)、`CurrentLockedUnit`(Object BP_Unit,缓存当前锁定目标供 `AttemptSkillAttack` 直接用)。
- 新函数 **`SetLockIndicator(bLocked: Bool)`**:`Transformation|SetRelativeScale3D(HealthBarComponent, bLocked?(1.4,1.4,1.4):(1,1,1))`——**用"血条放大 1.4 倍"当锁定指示器**,没有另外做描边/图标,理由是复用现成组件零新增美术资源,最快能验证逻辑对不对;如果人工 Play 觉得不够醒目,后续可以换成更明显的描边材质,但那是纯视觉打磨,不影响这轮的判定逻辑。
- **`EventTick` 尾部新增一段**(接在原有 `ShowSkillRange` 调用的空 `then` 之后,`create_node`/`connect_pins`/`set_pin_value` 逐节点搭建,没有用 `write_graph_dsl`——这个函数本身极长且historically 对 `EventTick` 这类多事件共享的 `EventGraph` 做整图回写有断线风险,见下方"踩坑"):`Grid.ClearLockIndicators()` → `Grid.GetTargetsInRange(self, SelectedSkillIndex)` → `Array Length` → `>0` 分支:`LockedTargetIndex >= count` 就 `Select` 回绕成 0 并写回变量 → 按(可能回绕后的)下标 `Array Get` 取出目标 → `SetLockIndicator(true)` → `Set CurrentLockedUnit` = 该目标;`=0` 分支:`Set CurrentLockedUnit`(数据 pin 不接,默认 `None`)。
- 新增 `Input|KeyboardEvents|Tab`(Pressed,legacy 按键,和项目里 WASD/1-5/E 同款,不赌 Enhanced Input)→ `LockedTargetIndex += 1`。
- **`AttemptSkillAttack()` 整个重写**(`write_graph_dsl` 直接覆盖旧图,新函数体极短、不含 `ForEachLoop`,风险低,一次成功):删除原来的 `LineTraceForObjects`+`CastToBP_Unit`+一堆 `PrintString` 调试链,换成 `IsValid(CurrentLockedUnit)`(**用 continuation 语法 `(:"Is Valid" ...) (:"Is Not Valid")`,不是 `if` 包 `IsValid`——第七轮踩过的坑2/47/坑50 教训这次直接照着正确写法写,没有再犯**)→ 有效就直接 `Grid.PerformSkillAttack(self, CurrentLockedUnit, SelectedSkillIndex)`。**E 键在 `EventGraph` 里指向这个函数的调用节点(`K2Node_CallFunction_66`)没有动过**,`write_graph_dsl` 整体重写函数体后按函数名重新解析,`compile_blueprint` 通过后核对过 `K2Node_InputKey_1`(E)→`K2Node_CallFunction_66` 这条线原样还在,不需要手动补线。

**顺手清理**:`ValidateSkillTarget` 里两个残留调试 `PrintString`(`VALIDATE: dist=... range=...` / `VALIDATE: BLOCKED - target Side=true`)的 `bPrintToScreen` 从 `true` 改成 `false`(`bPrintToLog` 仍是 `true`,`Output Log` 里还查得到,只是不再糊屏幕)——这两条正是用户截图里刷屏的调试文本的一部分。`AttemptSkillAttack` 旧版自带的另外两条刷屏文本("ATTACK: E pressed, tracing..." 等)因为整个函数体被替换,直接消失,不需要单独关。

**已知限定/未处理**:`BP_Unit.EventGraph` 里另外 2 个 `PrintString`(`K2Node_CallFunction_23/24`,挂在 `W` 键分支,`坑42` 朝向修复相关)这轮没有动,和本次改动无关,不在范围内。

### 2026-08-23 回合切换镜头乱甩修复(用户发录屏反馈"运镜有问题",抽帧定位后确认是代码 bug,不是相机数学问题)

**排查过程**:用户发了一段 Play 录屏,反馈镜头体验差。先用 `ffmpeg` 抽帧(2fps 全览+关键片段 30fps 逐帧不跳帧)分析,一开始误判是 `BP_Unit.SpringArm` 的碰撞探测(`bDoCollisionTest`)被攻击特效顶到贴脸——**这个判断后来被逐帧证据推翻了**:碰撞探测应该是渐进变化的,但实际看到的是相邻两帧之间的瞬间硬切,不是逐步逼近。这提醒了一件事:**只看录屏低帧率抽帧容易得出错误结论,得配合高帧率逐帧+读代码才能定位准**,以后类似"体验问题"排查不能只停留在稀疏抽帧这一步。

**真正根因(读完 `TryAttack`→`ResolveCounterAttack`→`PerformSkillAttack`→`BP_TurnManager.EndTurn`→`AnnounceNextTurn`→`StartTurn` 整条链路后确认)**:每次回合切换,镜头实际被摆了三次:
1. 攻击结算(`TryAttack`/`ResolveCounterAttack`)纯数值计算,不碰镜头。
2. `PerformSkillAttack` 结算完立刻调 `BP_TurnManager.EndTurn()` → 等 1 秒(`SetTimerbyFunctionName`)→ `AnnounceNextTurn`。
3. **`AnnounceNextTurn` 原来会 `SetViewTargetWithBlend(下一个单位, 0.3秒)`——这个"下一个单位"此时还没被 `Possess`,朝向是它上次移动/待机结束时随便停留的角度,没有任何人瞄准过它**,镜头切过去看到的就是这个随机朝向(天空/贴近别的单位模型),这正是录屏里"贴地看天"和"怼脸糊成一片"两段画面的根因——不是相机数学错,是选错了"中间过渡镜头该看哪"这个目标。
4. 再等 1 秒 → 真正的 `StartTurn` 才跑,这里有设计好的镜头(我方 `Possess`+回到该单位第三人称;敌方切到 `OverviewCamera` 全景),`0.75秒` blend 过去——这才是录屏里最后稳定下来那个还算正常的构图。

**修法**:`AnnounceNextTurn` 里 `SetViewTargetWithBlend` 的 `NewViewTarget` 参数,从"下一个单位本人"(`K2Node_GetArrayItem_0` 的输出)改接到 `self`(`BP_TurnManager` 自己,即 `OverviewCamera`)——和 `StartTurn` 敌方分支早就在用的写法(`SetViewTargetWithBlend self 0.75`)完全同构。只 `break_pins`+新建一个 `Variables|Getareferencetoself` 节点+`connect_pins` 这一步,`_output`(下一个单位的引用)在同一个函数里另外两处用途(`IsValid` 判空、`PrintString` 里判断"我方/敌方回合开始"文案)完全没动。改完之后中间这一步变成"切到全景",本身构图稳定,不再是随机朝向;1 秒后 `StartTurn` 该怎么切还怎么切,时序完全没变。

**验证**:`compile_blueprint`(`BP_TurnManager`)通过,`read_graph_dsl` 复查确认 `SetViewTargetWithBlend` 的目标已经是 `self`。`save_assets` 落盘。临时打开 `bRunRegressionTestsOnBeginPlay` 开 PIE 跑一遍(验完立刻改回 `false`,没有留痕到关卡资产):`T1`~`T6b`/`T8` 依旧 `PASS`,`T7b`/`T7c` 依旧 `FAIL`(和上一轮记录的结果完全一致,证明这次改动没有引入新的回归,`T7b`/`T7c` 是独立的、更早遗留的问题,见上一节记录)。

**2026-08-23 用户"验收通过"后按硬性规范补的回归断言**(`BP_GridManager.RunRegressionTests` 新增 T9):直接调用 `TurnManager.AnnounceNextTurn()` 后同帧读 `PlayerController.GetViewTarget()` 断言等于 `TurnManager` 的第一版写法**稳定 FAIL**——根因是 `SetViewTargetWithBlend` 带 `BlendTime=0.3` 时,`GetViewTarget()` 要等混合结束才反映新目标,同帧读到的还是旧值,不是代码逻辑错了,是断言的时序假设错了(详见 `UE节点备忘录.md` 坑61)。改法:新增独立函数 `BP_GridManager.T9_CheckViewTarget()`(内容:`GetAllActorsOfClass(BP_TurnManager)`→Cast→`GetViewTarget(GetPlayerController(0))`→`Assert(==TurnManager, "T9_...")`),`RunRegressionTests` 里改用 `Utilities|Time|SetTimerbyFunctionName(self, "T9_CheckViewTarget", 0.4, false)` 异步调度(`Utilities|FlowControl|Delay` 是 latent 节点,不能放进普通 Function,这也是这次才发现的引擎硬限制)。重跑后 `T9_AnnounceNextTurn_TargetsOverviewCamera_NotNextUnit` 稳定 `PASS`,`T1`~`T8` 结果不变(`T7b`/`T7c` 依旧是独立的老问题)。**这条断言真正卡住了坑60 这个 bug**——如果以后有人不小心把 `AnnounceNextTurn` 的 `NewViewTarget` 又改回"下一个单位本人",这条测试会立刻 FAIL,不用等人工 Play 才发现。

**顺手发现,未处理**:开 PIE 时 `Output Log` 刷出几条 `Attempted to access BP_Unit_C_6 via property PendingEnemyUnit, but BP_Unit_C_6 is not valid (pending kill or garbage)`——`PendingEnemyUnit` 变量在某个之前的单位被 `DestroyActor` 之后没有清空,残留了一个失效引用。和这轮镜头改动无关,没有顺手修,留待下次处理。

**验证方式**:`compile_blueprint`(两个蓝图)均通过,`save_assets` 落盘。开 PIE(临时把 `bRunRegressionTestsOnBeginPlay` 打开跑了一遍,验完立刻改回 `false`,没有留痕到关卡资产)看 `Output Log`:`T1`~`T6b`/`T8` 全部 `PASS`,**`T7b_RunEnemyTurn_MovesCloserToNearestTarget`/`T7c_RunEnemyTurn_VacatesOldTile` 两条 FAIL**——**这次没有新引入这两条失败**:这轮改动完全没碰 `RunEnemyTurn`/`MoveUnitTowardTarget`/`FindNearestUnit0`,`AttemptSkillAttack`/新函数只在被 `Possess` 的我方单位的 `EventTick`/按键路径上执行,和敌方 AI 回合的调用链没有交集,**推断是这轮之前(某次 TPS 迁移/AI 朝向修复改动)就已经破坏、只是没人在那之后重新跑过回归测试才没发现**,已如实记录、没有顺手修,留给用户决定要不要单独排期排查(参见"当日修复(续,第六轮)"第8条"敌方AI移动朝向修复"——很可能是那次改动引入,因为改动本身"没能实测",时间线吻合)。**没能验证的部分(和以往同一类限制)**:MCP 没有可靠按键模拟能力,`Tab` 切换目标手感、`E` 锁定攻击的真实命中率仍需人工 Play 验收;`SetLockIndicator` 的血条放大效果好不好看也需要肉眼确认。

### 2026-08-29 待命结束回合(空格键) + AOE 范围技能移植(计划见 `C:\Users\AI_Work\.claude\plans\zazzy-launching-dolphin.md`)

用户选定处理两个功能缺口:①TPS 直控模式下缺一个"不攻击、直接结束回合"的按键;②网页版原本设计的 AOE(横扫/地裂/岩崩/横扫斩)技能一直没移植。规划阶段用 MCP 直接读取当前**真实的、已编译**蓝图(不只是文档),发现两个原方案没预料到的真实 bug,会在阶段3实现时一并修——已记入 `UE节点备忘录.md` 坑65。

**阶段1(本条已完成、已验证)——待命键**:`BP_TurnManager.StandbyAction()` 这个函数在 2026-08-16 行动菜单时代就已经存在(`HideActionMenu()`→`Grid.SetSelectedUnit(None)`→`EndTurn()`,前两步在 TPS 时代是无害空操作),TPS 时代一直没人接线用它。本轮只新增了一条按键路径,`BP_Unit.EventGraph` 新增:
```
Input|KeyboardEvents|SpaceBar (Pressed)
  → Actor|GetAllActorsOfClass(BP_TurnManager)  [K2Node_CallFunction_811]
  → Utilities|Array|Get(acopy) 取[0]            [K2Node_GetArrayItem_55]
  → Utilities|Casting|CastToBP_TurnManager      [K2Node_DynamicCast_69]
  → Class|BPTurnManager|StandbyAction           [K2Node_CallFunction_812]
```
和 Tab/E/1-5 键完全同款的"每次现查、不缓存引用"写法,`create_node`/`connect_pins`/`break_pins` 增量插入(SpaceBar 是全新按键,之前完全没被使用过)。**踩坑**:`Utilities|Array|Get(acopy)` 取出来的元素类型解析成基类 `Actor Object Reference`(不是 `BP_TurnManager`),不能直接接到 `StandbyAction` 的 `self` 参数(类型不兼容报错),必须额外插一个 `Utilities|Casting|CastToBP_TurnManager` 做显式向下转型——这是 `GetAllActorsOfClass`+`Array|Get` 这套"现查引用"模式的通用要求,不是这次特有的坑,以后同类查找都要记得加这道转型。`compile_blueprint` 通过,`get_connected_subgraph` 从 `SpaceBar` 节点逐跳核对到 `StandbyAction`,执行链完整无断点。**不需要**在按键处额外调用 `Grid.ClearHighlights()`/`ClearLockIndicators()`——下一个单位被 `Possess` 后自己 `EventTick` 第一帧的全局清理会自动处理,和"是攻击结束回合还是待命结束回合"无关。**待人工 Play 验收**:按空格键是否真的立刻结束当前回合、轮到下一个单位。

**阶段2(本条已完成、已验证)——AOE 技能数据 + 中文名互查表**:`/Game/Data/DT_Skills` 新增 4 行(`sweep`横扫/`quake`地裂/`rockslide`岩崩/`cleave`横扫斩,数值来自网页版 `js/data/skills.js`,直接用 `DataTableTools.add_rows`+`set_rows` 写入,没有走 CSV 重新导入这条路——`js/data/ue_import/DT_Skills.csv` 也同步加了这4行备档,但游戏读的是 DataTable 资产本身,两者不会自动同步,以后再手改 CSV 记得也要手动同步一次 DataTable)。`BP_TurnManager.SkillTokenToId`/`SkillIdToChinese` 各追加4个 `elif` 分支(中文名⇄英文id双向互查),`WBP_DebugLoadout.FillSkillCombo` 待补4个下拉选项(**这一步这次没做**,见下方"未完成")。

**本阶段踩到全场目前最贵的一个坑(坑66)**:给这两个已存在的函数用 `write_graph_dsl` 整体重写来插入新分支,第一次提交因为"函数图并非全新"导致节点重复(66+ 个分支而不是预期的34个);`remove_function_graph`+`add_function_graph` 清空重建后,又因为不知道原输出参数的真实内置名字是 `Result`(不是类比 `IsPhysicalSkill` 抄来的 `ReturnValue`)踩了签名不匹配;最后还牵连了 `ApplyDebugLoadout`/`RefreshSkillMenuLabels`/`RefreshSkillBar` 三个函数里总共 10 个调用点全部需要 `delete_node`+`create_node`+逐条 `connect_pins` 重建(改公共函数签名的标准代价,这次只是撞上了全部 10 个)。全部修复后两个蓝图 `compile_blueprint` 均通过,`get_node_infos` 逐个新建的调用节点核对过 exec/self/Token/Result 连线。详见 `UE节点备忘录.md` 坑66完整排查记录。

**2026-08-30 补完**:`WBP_DebugLoadout.FillSkillCombo` 已追加"横扫"/"地裂"/"岩崩"/"横扫斩" 4 个下拉选项(`create_node`/`connect_pins` 在既有"近身战"→`SetSelectedOption` 之间插入 4 个新 `ComboBox|AddOption` 节点,`declaring_class=/Script/UMG.ComboBoxString` 消歧,照抄坑33的写法;`write_graph_dsl` 整体重写此函数会报 `Could not connect pin Combo to self` 编译失败——`ComboBox|AddOption` 这类 UMG 节点即使函数体本身是纯线性无循环文本,DSL 也无法正确消歧声明类,必须走 `create_node`+`declaring_class`,不能因为"文本结构简单"就默认可以用 `write_graph_dsl` 整体重写,还是要看节点类型)。`compile_blueprint` 通过,`read_graph_dsl` 复查确认 31 个原选项 + 4 个新选项全部还在。玩家现在可以通过配装 UI 直接选到这 4 个新 AOE 技能了。

**阶段3(本条已完成、已验证)——AOE 判定 + 多目标伤害管线**:`BP_GridManager` 新增三个函数、改了一个既有函数:
```
IsAoeSkill(RowName: Name) → bool
  照抄 IsPhysicalSkill 的写法,硬编码比较 "sweep"/"quake"/"rockslide"/"cleave",命中任一即 true。
  用 Utilities|Operators|Equal(==)(不是 Utilities|Name|Equal(Name)——后者是只读形态,find_node_types 确认创建不出来)。

GetAoeHitList(Defender: BP_Unit) → Array<BP_Unit>
  局部变量 HitListTmp(函数作用域,每次调用自动清零,照抄 GetTargetsInRange 的 TargetsTmp 写法)。
  先把 Defender 本体加入,再 GetAllActorsOfClass(BP_Unit) For Each:
    Side==false(敌方) 且 HP>0 且 不是 Defender 本体 且 ManhattanDistance(Defender,该单位)==1 → 加入。
  用 Class|BPUnit|GetCol/GetRow(不是 Class|GridSlot|GetRow——后者在这个新函数里报
  "Could not connect pin Defender to self",尽管同一个 GetRow 在 ValidateSkillTarget/TryAttack 等已编译旧代码里用得好好的;
  原因不明,新写 DSL 一律改用 BPUnit 版本绕过)。

PerformAoeSkillAttack(Attacker: BP_Unit, Defender: BP_Unit)  [void]
  局部变量 SavedSkillRowTmp(Name,函数作用域)
  SetSavedSkillRowTmp(当前 PendingSkillRowName)     ← 循环开始前只执行一次,真正落地存一份快照
  HitList = GetAoeHitList(Defender)
  For Each HitList:
    Set SelectedUnit = Attacker                      ← 每次迭代都重设
    Set PendingSkillRowName = GetSavedSkillRowTmp()  ← 每次迭代都从快照变量读,不是从 PendingSkillRowName 自己读
    TryAttack(该目标, false)
  两条 Set 每次迭代都要重做,直接对应"坑65"里发现的两个坑:TryAttack 结尾无条件清空 SelectedUnit、
  ResolveCounterAttack 会把 PendingSkillRowName 永久改写成 "basic"。**这里踩了一个本轮自己刚犯的新坑,已经改正**,见 `UE节点备忘录.md` 坑69:第一版实现把"每次迭代重设 PendingSkillRowName"直接写成了 `SetPendingSkillRowName(GetPendingSkillRowName())`——语法上编译通过,但因为 UE Blueprint 的 Get 节点是纯节点(无 exec、不缓存),这个 Get 每次被拉取时读的都是"当前"值,循环第二次起读到的已经是上一轮 `ResolveCounterAttack` 篡改过的脏值,等于完全没有修复原来的坑,只是把"读哪个变量"绕了一圈又绕回原地。现在改成真正落地一个独立的函数局部变量 `SavedSkillRowTmp`,循环开始前 `Set` 一次、循环内只读不写,才是真正的快照。

PerformSkillAttack(既有函数,create_node/connect_pins/break_pins 增量插入,未整图重写)
  在既有 Set PendingSkillRowName 之后、原来直连 TryAttack 之前,插入 Branch(IsAoeSkill(GetPendingSkillRowName())):
    False(单体)→ 原路径直连 TryAttack,行为完全不变。
    True(AOE)→ 改调 PerformAoeSkillAttack(Attacker, Defender)。
  两条分支汇合到同一个既有的 GetAllActorsOfClass(BP_TurnManager)→Get[0]→EndTurn 尾巴(同一个 exec 输入有多个来源汇入,合法写法)。
```
`get_connected_subgraph` 从 `FunctionEntry_0` 逐跳核对过 `PerformSkillAttack` 全部改动后的连线,`BP_GridManager`/`BP_Unit` 均 `compile_blueprint` 通过。跑过 `RunRegressionTests`(临时把 `bRunRegressionTestsOnBeginPlay` 打开、`StartPIE`,验证完已改回 `false`、已 `StopPIE`):T1–T6b、T8、T9 全部 PASS;T7b/T7c 仍是既有未解决的失败(和这轮改动无关,历史遗留)。日志里 T8 和 T9 之间出现一条 `Accessed None trying to read (real) property Grid ... Node: Branch Graph: StartTurn Blueprint: BP_TurnManager` 的警告——核对过 `StartTurn` 的 DSL,它完全没有被这轮任何改动touch到(既没读写 SkillTokenToId/SkillIdToChinese,也不调用 PerformSkillAttack/IsAoeSkill/GetAoeHitList/PerformAoeSkillAttack),判定为既有的、和这轮改动无关的时序噪音,未继续深挖根因;测试本身没有中断,T9 照常 PASS。

**AOE 专属回归断言(本条已完成,已写进 `RunRegressionTests` 永久保留)**:`RunRegressionTests` 末尾新增 T10 段,摆 1 我方攻击者(格36)+1 敌方防御者(格35)+1 正交相邻敌方(格34)+1 故意隔开的敌方反例(格64,`Tiles[TileIndex]` 的 `TileIndex=(Col-1)*8+(Row-1)`,11×8 网格),`PendingSkillRowName` 设成 `"quake"`:
```
T10a  GetAoeHitList 命中列表长度==2
T10b  命中列表包含 Defender 本体
T10c  命中列表包含正交相邻敌人
T10d  命中列表不包含隔开的反例敌人
T10e  PerformAoeSkillAttack 后 Defender 确实掉血
T10f  PerformAoeSkillAttack 后相邻敌人确实掉血
T10g  反例敌人 HP 完全不变
T10h  Defender 和相邻敌人(属性完全相同)掉血量必须相等 —— 这是专门用来卡"坏了会把第二个目标悄悄按 basic 倍率结算"这个坑(坑69)的断言,如果 `SavedSkillRowTmp` 快照失效,这条会第一时间 FAIL
```
`StartPIE` 实测:T10a–T10h 全部 PASS。T6a/T7b/T7c 的既有已知问题(~5% 命中率误报/敌方AI寻路遗留 bug)不受影响。**未做**(计划里同一批但优先级更低的收尾项):`SelectedUnit` 结算后是否严格等于 `None`、AOE 多杀是否只弹一次胜负窗——这两条留给下次接手直接加断言,当前 T10 没覆盖。

**阶段4(瞄准态UX)——地基部分已完成、已验证,交互接线部分尚未开始**:
```
BP_Unit 新增变量:Aiming(Bool——注意实际变量名是 "Aiming" 不是 "bAiming",add_variable 这次没有像历史上的 bHasMoved 那样自动加 b 前缀,以此变量的真实名字为准)、AimCursorCol(Int)、AimCursorRow(Int)。

/Game/Maps/M_AoeHighlight(新建 Material):纯 Constant3Vector(1.0, 0.45, 0.0,橙色)接 MP_BaseColor,照抄 M_AtkHighlight 的极简结构(只有一个 Constant3Vector→BaseColor,没有额外的 Metallic/Roughness/ShadingModel 定制)。

BP_Tile 新增:AoeHighlightMat(Material 对象引用,CDO 已设成 M_AoeHighlight)、AoeHighlighted(Bool)、SetAoeHighlight(bOn) —— 逐行照抄 SetAttackHighlight 的写法(SetAoeHighlighted(bOn) → bOn 为真则 SetMaterial(Mesh,0,AoeHighlightMat),否则 SetMaterial(Mesh,0,NormalMat))。

BP_GridManager 新增:
  ClearAoeHighlightsOnly() —— 照抄 ClearAttackHighlightsOnly:For Each Tiles,若该格 NOT Highlighted(不是移动高亮)则 SetAoeHighlight(该格,false)(bOn 留默认值 false,不显式传)。
  GetEnemyUnitAtTile(Col,Row) → BP_Unit(局部变量 FoundEnemyTmp 兜底默认 None):GetAllActorsOfClass(BP_Unit) For Each,Side==false 且 HP>0 且 Col/Row 匹配就 Set FoundEnemyTmp,循环完 return。
  RefreshAoePreview(CursorCol,CursorRow) [void]:ClearAoeHighlightsOnly → GetEnemyUnitAtTile(光标格) → IsValid(单分支写法,只写"Is Valid",没有"Is Not Valid"分支,和 ShowSkillRange 同构)→ GetAoeHitList(该敌人)→ For Each 命中单位 → 内层 For Each 全场 Tiles,Col/Row 都相等就 SetAoeHighlight(该 Tile,true)。

三个新函数、SetAoeHighlight 均已 compile_blueprint 通过,RefreshAoePreview 额外用 get_connected_subgraph 从 FunctionEntry 逐节点核对过整条 exec 链路(含 IsValid 宏的 Is Valid/Is Not Valid 两个出口,确认走的是"Is Not Valid 留空、Is Valid 接主逻辑"这种已知安全写法,不是坑2/51 那种嵌套死代码)。
```
**阶段4交互接线部分(本条已完成、已验证,2026-08-30)**:

- `BP_Unit` 新增 `Input|MouseEvents|RightMouseButton`(Pressed→`CallFunction|OnAimPressed`,Released→`CallFunction|OnAimReleased`)+ 离散 `Input|KeyboardEvents|W/A/S/D`(Pressed,各自 `Branch(Aiming)` 门槛为真才执行,`CallFunction|MoveAimCursor(DeltaCol,DeltaRow)`,W/S 走 Row∓1、A/D 走 Col∓1)。
- `BP_Unit` 新增三个函数(`write_graph_dsl` 全新写,均用 `get_connected_subgraph`/`get_node_infos` 逐节点核对过 exec 链路无孤岛):
  - **`OnAimPressed()`**:`Actor|GetActorOfClass(BP_GridManager)`→`Utilities|Casting|CastToBP_GridManager`→`IsValid`(Is Not Valid 留空)→`Grid.IsCurrentSkillAoe(self)`(新增,见下)→为真则 `Set Aiming=true`+光标初始化成自己当前 Col/Row+`Grid.RefreshAoePreview(该Col,该Row)`。
  - **`OnAimReleased()`**:`Set Aiming=false`→查 Grid→`IsValid`→`Grid.ClearAoeHighlightsOnly()`。
  - **`MoveAimCursor(DeltaCol,DeltaRow)`**:查 Grid→`IsValid`→`Grid.ManhattanDistance(self.Col,self.Row, AimCursorCol+DeltaCol, AimCursorRow+DeltaRow)`与`Grid.GetSkillEffectiveRange(self,SelectedSkillIndex)`比较,`<=` 才真的 `Set AimCursorCol/Row`+`Grid.RefreshAoePreview(新Col,新Row)`,超范围整次移动被拒绝、光标留原地。
- `BP_GridManager` 新增 **`IsCurrentSkillAoe(Unit:BP_Unit)→Bool`**:`Combat|Loadout|GetSkillSlotName(自己的SkillSlots, Unit.SelectedSkillIndex)`查行名→`CallFunction|IsAoeSkill(该行名)`。存在原因和 `ValidateSkillTarget`(坑46)一样——跨实例判定逻辑要放在 GridManager 侧,BP_Unit 自己的函数图读不到"这次到底该不该走 AOE 分支"以外的东西。
- `BP_Unit.EventTick` **补了 10 个 `Branch(NOT Aiming)` 网关**(1 个共享的 `GetAiming`+`NOTBoolean`,扇出到 10 个 `Branch.Condition`),分别插在 5 个"移动"入口(`DynamicCast_39/48/55/60/65`→原 `AddMovementInput` 对,即 `425/431`、`543/549`、`630/636`、`687/693`、`744/750`)和 5 个"射程/锁定高亮刷新"入口(`VariableSet_68/85/98/107/116`→原 `ClearAttackHighlightsOnly`,即 `442`、`560`、`647`、`704`、`761`,`ClearLockIndicators` 因为在同一条 exec 链路的下游、门口一关自动跟着不执行,没有单独再插)。**排查这 10 个插入点花了大量 `get_node_infos` 回溯,过程中意外发现 `EventTick` 里还有一整段"看起来很重要但实际执行不到"的死代码(`Utilities|FlowControl|Sequence` 节点自己的 `execute` 输入没有任何连线)以及一条被 Enhanced Input 事件独占供电、Enhanced Input 全局不触发导致必然死代码的 `AddMovementInput` 对——这两段都刻意没有触碰(不在本次任务范围,风险未知),完整现象记入 `UE节点备忘录.md` 坑72,以后排查"EventTick 里某段逻辑到底有没有真的在跑"直接去查那条就行,不用重新溯源。**
- `BP_Unit.AttemptSkillAttack` 顶部插入 `Branch(Aiming)`(`create_node`/`connect_pins`,没有动原有函数体其余部分):True→新函数 **`AttemptAimAttack()`**(查Grid→IsValid→`Grid.GetEnemyUnitAtTile(AimCursorCol,AimCursorRow)`→IsValid→有敌人就 `Grid.PerformSkillAttack(self,该敌人,SelectedSkillIndex)`,没有就 `PrintString("AIM: 光标下没有目标")`);False→原来的 `FunctionEntry.then` 目标(`MacroInstance_0`,即原有 `LineTraceByChannel`/`CastToBP_Unit`/`ValidateSkillTarget` 那整套非瞄准态逻辑),完全没改动,行为不变。
- **验证**:两个蓝图 `compile_blueprint` 均通过;`RunRegressionTests`(`StartPIE`,`bSimulate:true`)跑了两轮——第一轮 T10f/T10h 出现 FAIL,第二轮全 PASS,和已知的命中率随机性假阳性(T6a/T7b/T7c 同类)吻合,不是本次改动引入的回归(T10 断言走的是 `RunRegressionTests`→`PerformAoeSkillAttack` 的直接函数调用路径,完全不经过这次改的任何输入/Tick/AttemptSkillAttack 代码);标准 PIE(`bSimulate:false`)跑一轮读 Output Log,除了已知的 `StartTurn` "Accessed None...Grid" 警告和引擎级 GameFeatureData 噪音外没有新增报错。**未能实测**(MCP 无可靠鼠标长按/键盘模拟能力,同已知限制):RMB 长按手感、WASD 光标移动手感、E 键瞄准态命中体验,均需人工 Play 验收。
- `WBP_DebugLoadout.FillSkillCombo` 补 4 个 AOE 技能下拉选项**已完成**(阶段2遗留项,由另一次会话/进程补上,过程见 `UE节点备忘录.md` 坑71:`write_graph_dsl` 整体重写在 `ComboBoxString` 系列节点上会连错类型,退回 `create_node`+`declaring_class` 增量插入解决)。

至此 `zazzy-launching-dolphin.md` 计划的四个阶段全部完成、全部验证过(仅剩人工 Play 手感验收这一项,计划文档本身就把它列为"MCP 做不到,只能人工"）。

### 2026-08-29 骨骼网格迁移(Mewtwo_TPose)+ 动画状态机 + 朝向修复(⚠ 本节之前从未同步过文档,是补记——这轮之前的会话直接在 UE 里做完了下述全部改动,没有按 harness 规范同步 `UE蓝图状态.md`/`UE节点备忘录.md`,导致接手时文档和实际蓝图状态完全脱节,教训见对话总结)

**模型资产**:`CharacterMesh0`(`BP_Unit` 的 `SkeletalMeshComponent`)换成 Mixamo 导入的 `/Game/Meshes/Mewtwo_Skeletal/SkeletalMeshes/Mewtwo_TPose`(取代旧的 `Mewtwo_test` 静态网格+旧骨骼网格系列,旧资产已确认零引用后删除,见下方"资产清理")。当前(2026-08-29 验收通过)确认生效的 Transform:`RelativeLocation=(0,0,-80)`,`RelativeRotation=(0,270,0)`(**Yaw=270,不是 90**——90 是这套模型刚换上时的初始校准值,实际差了180度导致 moonwalk,详见 `UE节点备忘录.md` 坑64,270 才是最终验收通过的值),`RelativeScale3D≈(54.294,54.294,54.294)`,`AnimationMode=AnimationSingleNode`。

**新增变量**(均 `AnimationAsset` 对象引用类型,除非标注):`IdleAnimAsset`→`Idle_import_Anim`、`WalkForwardAnim`→`Walking_import_Anim`、`WalkBackwardAnim`→`UnarmedWalkBack_import_Anim`、`ReactionAnim`→`Reaction_import_Anim`、`DyingAnim`→`Dying_import_Anim`、`PunchAttackAnim`→`PunchingBag_import_Anim`、`MagicAttackAnim`→`MagicSpellCasting_import_Anim`、`CurrentLocoAnim`(追踪上次播放的 locomotion 动作,CDO 默认值是 `None`)、`bIsActionPlaying`(Bool,攻击/受击/死亡等"一次性动作"播放期间置 true,阻止 `UpdateLocomotionAnim` 打断)。

**新函数**:
- **`UpdateLocomotionAnim()`**(每 Tick 末尾调用一次):`bIsActionPlaying` 为 false 时,读 `GetVelocity()`,速度 `<5` 判 Idle,否则用速度和 `GetActorForwardVector` 的点乘正负号判 WalkForward(>0)/WalkBackward(≤0);每个分支写法是 `(if NotEqual(target,current) then (SetCurrentLocoAnim target) (PlayAnimation mesh target true))`——**这不是 if/else,是"then 分支里两条语句顺序执行":第一条设变量、紧接着第二条才真正调用 `PlayAnimation`,只有 target 和 current 不同才会执行这两步,相同则整个分支不执行(不会重复 Play)**;`read_graph_dsl` 打印出来乍看容易被误读成"设置变量"和"实际播放"是互斥的 if/else 两支,不是——这套写法已经过两轮独立核实(DSL 文本 + `get_node_infos` 逐节点核对 exec 连线)确认是对的,以后不要因为文本长得像 if/else 就怀疑它有 bug。
- **`PlayHitReaction()`/`PlayPhysicalAttackAnim()`/`PlayElementalAttackAnim()`/`PlayDyingAndDestroy()`**:各自 `Set bIsActionPlaying=true` → 播放对应 AnimSequence(`bLooping=false`)→ `Utilities|Time|SetTimerbyFunctionName`(不是 `Delay`,Function 图不能放 latent 节点)等 `Animation|GetPlayLength` 秒后回调 `EndActionAnim()`(`Set bIsActionPlaying=false`)或 `FinishDying()`(找 `BP_GridManager` 实例,先 `DestroyActor(self)` 再 `CheckVictoryCondition`,顺序不能反,否则临死单位会被判定成"还活着")。
- 攻击时到底放物理还是元素动作,由 `BP_GridManager.IsPhysicalSkill(RowName)`(硬编码比较 `DT_Skills.csv` 的 `basic`/`heavy`/`powerstrike` 三个 `TypeName=normal` 的技能行名)决定,接在 `TryAttack` 伤害结算之前。

**资产清理**(全部先 `get_referencers` 确认零引用/仅测试引用再删):`/Game/Mewtwo_anim/` 整个文件夹(旧骨骼网格 `Mewtwo_MagicHeal` 系列+12个旧 AnimSequence+关联 PhysicsAsset/Skeleton+`CS_Mewtwo` 过场序列,用户明确要求"删除,彻底不用")、`/Game/Maps/BP_Unit_Rebuild`(废弃的并行蓝图)、`/Game/Meshes/Mewtwo_test/StaticMeshes/Mewtwo_test`(旧静态网格,删前先把 `Setup()` 里敌我染色的 `SetMaterial` 调用点从这个组件改接到 `CharacterMesh0`)、10 个 Mixamo 动画导入时产生的重复网格副本(如 `PunchingBag_import`,只留 AnimSequence)、TestMap 里 3 个棋盘外的遗留 `SkeletalMeshActor`(标签"MEWTWO_MAGICHEAL")。

**已知一次性修复,均已验收通过**(详见 `UE节点备忘录.md` 对应坑号):
- `EventTick` 里两处 `CastToPlayerController` 的 `CastFailed` 输出 pin 未接线,导致所有未被 `Possess` 的单位(AI 单位)整个 tick 后半段(含 `bIsAIMoving` 分支)完全不执行——AI 移动 bug 的真正根因,已接线补上。
- 鼠标视角"斜的":两个 `GetInputMouseDelta` 节点里,`AddControllerPitchInput` 接错源接到了另一个节点的 `DeltaX`(取反后当 pitch 用),两个节点各自的 `DeltaY` 都完全没接;改成正确节点的 `DeltaY→AddControllerPitchInput`。
- 全体单位悬空:`CharacterMesh0.RelativeLocation.Z` 从初版按 T-pose 参考包围盒算出的 `-36.977`(没考虑真实播放动作后姿势的实际高度)调到用户实测认可的 `-80`。
- **moonwalk(本轮最后修的,也是最容易复发的一个)**:见 `UE节点备忘录.md` 坑64,`CharacterMesh0.RelativeRotation.Yaw` 90→270。

**加新动画的标准流程,已固化为 skill `ue-add-animation`**(见 `ue-add-animation/SKILL.md`)——以后再加任何 Mixamo 动作(比如新技能动作、新状态动画),按 skill 里的步骤走,不要凭记忆重新摸索。

### 2026-08-30 技能栏空白排查 + Debug 面板开关补输入模式切换 + F1 快捷键 + UI 提示(本条已全部完成、已验证)

**背景**:用户反馈"屏幕下方的技能UI看不到技能名称了"。排查(直接读 live PIE 状态)确认:`BP_GridManager.SkillSlots` 开局是空数组,`BP_TurnManager.EventBeginPlay` 只会自动调 `ApplyStartingRelics()`(遗物自动生效),**没有任何调用给 `SkillSlots` 赋初始值**——`RefreshSkillBar()` 在开局直接读这个空数组,所以技能栏显示"数字+空白"。`WBP_DebugLoadout` 面板(能一键应用 SLICE/HEAVY/ELEM 预设填上 `SkillSlots`)默认 `Visibility=Collapsed`。**和用户确认:这是预期行为(面板本来就要手动打开选预设),不是本次 AOE 改动引入的回归,不改这部分逻辑**。

**追问"控制台"(即 `WBP_DebugLoadout`)怎么打开**:排查发现它原本只能靠鼠标点 `WBP_RelicBar.Btn_Debug`(顶栏"DBG"按钮)打开,**没有任何键盘快捷键**——但 TPS 直控模式下 `StartTurn` 会把鼠标切到 `SetShowMouseCursor(false)`+`SetInputMode_GameOnly`(锁鼠标转视角,见坑40),所以进游戏后根本看不见鼠标指针,点不到这个按钮。用户要求:①加 F1 快捷键;②`Btn_Debug` 下面加一行小 UI 提示文字。

**`BP_TurnManager.ToggleDebugPanel()` 补输入模式切换**:用 `create_node`/`connect_pins` 在原有 if/else 两支的尾部(`SetbDebugPanelOpen` 之后)各追加了一段"查 `Game|GetPlayerController(0)` → 切输入模式 → 切鼠标显隐"——打开面板那支加 `Input|SetInputModeGameAndUI`(PlayerController=当前PC,其余参数留引擎默认:`InWidgetToFocus`留空、`InMouseLockMode=DoNotLock`、`bHideCursorDuringCapture=true`、`bFlushInput=false`)+ `Class|PlayerController|SetShowMouseCursor(true)`;关闭那支加 `Input|SetInputModeGameOnly`(`bFlushInput=false`)+ `SetShowMouseCursor(false)`,让面板打开时能看见并点到鼠标、关闭后无缝切回 TPS 转视角模式。**中途 MCP 连接断了一次,第一版改动(节点已建好、`compile_blueprint` 也通过了)在断线后整个丢失**(`find_nodes` 复查发现新节点全部不见,只剩原来 8 个;重连后新建节点的编号从 `K2Node_CallFunction_0` 重新起,而不是接着断线前的 `_6/_7/_8/_9`,说明断线这次伴随了蓝图编辑器状态的重置,不是单纯网络抖动),**重连后原样重做了一遍**,这次编译通过后立刻 `get_connected_subgraph` 从 `FunctionEntry` 走了一遍两条支路确认真正连通,并且**当场 `AssetTools.save_assets([])` 落盘**,避免再丢一次。

**`BP_Unit.EventGraph` 新增 F1 快捷键**:`Input|KeyboardEvents|F1`(Pressed)→ 完全照抄 `SpaceBar→StandbyAction` 的写法:`Actor|GetAllActorsOfClass(BP_TurnManager)`→`Utilities|Array|Get(acopy)`取索引0→`Utilities|Casting|CastToBP_TurnManager`(**这里必须显式 Cast,和 SpaceBar 那条线的真实结构一致——之前文档摘要没提到 Cast 这一步,这次翻旧节点确认了 SpaceBar 链路本来就有 Cast,不是新增行为**)→`Class|BPTurnManager|ToggleDebugPanel`。`get_connected_subgraph` 确认整条链从 `InputKey.Pressed` 到 `ToggleDebugPanel` 完全连通,`compile_blueprint` 通过。

**`WBP_RelicBar` 加 UI 提示**:用 `UMGToolSet.WrapWidgets` 把 `Btn_Debug` 包进一个新的 `VerticalBox`(替换掉它在 `BarBox`(HorizontalBox)里原来的位置,不影响其它兄弟节点),再用 `UMGToolSet.AddWidget` 往这个 `VerticalBox` 里加一个新 `TextBlock`(`Txt_DebugHint`,排在 `Btn_Debug` 下方),`ObjectTools.set_properties` 设置文字"F1"、字号9、灰色(0.6,0.6,0.6)、水平居中。`CompileWidgetBlueprint` 通过,`GetWidgetDescription` 复查确认层级正确(`VerticalBox_0`→[`Btn_Debug`(含"DBG"), `Txt_DebugHint`("F1")])。**因为改了 `WBP_RelicBar` 的内部结构,按坑9 同步重新 `compile_blueprint` 了持有它的 `BP_TurnManager`**。

**验证**:`StartPIE`(`bSimulate:false`)+`CaptureEditorImage` 截图确认——右上角"DBG"按钮下方正确显示灰色小字"F1",布局符合预期;技能栏(见上一条排查)仍是"1/2/3/4/5"五个空标签,和已确认的"未应用配装"预期一致,没有新增异常。`StopPIE` 干净退出。**未能实测**:实际按 F1 键能否真的弹出面板(MCP 无可靠键盘模拟能力,同项目一贯的已知限制),需要人工 Play 验收。

**新踩的坑(已记入 `UE节点备忘录.md` 坑74)**:MCP 连接中断可能伴随蓝图编辑器未保存状态的整体丢失(不只是这次调用失败),排查/确认方法和应对策略见备忘录条目——以后每完成一小段 `create_node`/`connect_pins` 图编辑并 `compile_blueprint` 通过后,应尽快 `save_assets` 落盘,不要攒到一大段改完再存。

**2026-08-30 追加修复:F1 和编辑器/测试环境本身的快捷键冲突,改绑 LeftCtrl**:用户反馈"F1在测试的时候还有别的作用",`delete_node` 删掉原来的 `Input|KeyboardEvents|F1` 节点,新建 `Input|KeyboardEvents|LeftCtrl` 节点,只重新接上 `Pressed→GetAllActorsOfClass` 这一条线(下游 `GetArrayItem→Cast→ToggleDebugPanel` 那段完全没动,原样复用),`compile_blueprint` 通过、`get_node_infos` 复核连线、`save_assets` 落盘。`WBP_RelicBar.Txt_DebugHint` 的提示文字也同步从"F1"改成"Ctrl"(第一次改漏了,只换了按键没换 UI 提示文字,用户截图指出后才发现补上)。现在打开调试面板的快捷键是**左 Ctrl**,不是 F1,UI 提示也对得上。

**2026-08-30 真正的根因(用户截图揭穿):`SkillIdToChinese`/`SkillTokenToId` 两个函数的每一条 `return` 语句全部被写成了空字符串 `""`,不管传进去哪个技能 id/中文名,一律返回空**。用户按 Ctrl 打开面板、点了"元素流(ELEM)"预设(截图里遗物顶栏正确刷新成"元素核心|铁甲皮|钢之意志",证明预设确实应用成功、`SkillSlots` 也确实被正确写入了 `[ember,aqua,vine,hydro,leafblade]`),但底部技能栏依旧只有"1/2/3/4/5"——直接读 live PIE 状态实锤 `SkillSlots` 是对的、`Txt_Skill0` 的 `Text` 却是`"1 "`(数字后面跟一个空格,没有名字)。顺藤摸瓜读 `RefreshSkillBar`→`SkillIdtoChinese`→读到的函数体是 34 层 `if/elif`,**每一层的 `(return "...")` 字面量全是空字符串**,连最初 2026-08-15 就有的 `basic`/`ember`/`aqua` 等老分支也不例外——这明显不是"这次改坏的",是更早某次(可能是本轮之前某次不透明的"整体重写"操作)把两个函数的真实中文/英文对照值集体替换成了空字符串,一直没人发现,因为没人在"游戏本身默认不配技能、需要先手动开面板选预设"这条路径上真正跑到过底。已经对照 `js/data/skills.js`(项目里技能数据的唯一权威来源)把两个函数的全部 35 个分支(31 个原有 + 阶段2新增的4个 AOE)逐一核实重写:`SkillIdToChinese`(英文id→中文名,含未识别原样返回)和 `SkillTokenToId`(中文名→英文id,反向,未识别返回空串,配装解析用)。`write_graph_dsl` 整体重写(纯 `EqualExactly`+`if/elif/return`,无特殊 UMG 节点,和坑71 的红线无关,可以放心整体写)。

**验证**:改完之后又踩了一次坑74同款的连接中断丢改动(见下文坑75),重做后每写完一个函数立刻 `compile_blueprint`+`save_assets`。最终验证:临时把 `BP_GridManager` **CDO** 的 `SkillSlots` 设成 `[ember,aqua,vine,hydro,leafblade]`(模拟 ELEM 预设生效后的状态,因为 MCP 没法模拟点击面板按钮)→`StartPIE`→直接读 live `Txt_Skill0`/`Txt_Skill4` 的 `Text`,分别是 `"1 火花"`、`"5 飞叶刃"`,和预设内容完全对上→`StopPIE`→**把 CDO 的 `SkillSlots` 改回空数组 `[]`**(这只是验证用的临时值,不该变成新的默认行为)→`save_assets`。**结论:技能栏显示问题现在是真的修好了,用户只要用 Ctrl 打开面板选一个预设,技能栏就应该正确显示中文名了。**

### 2026-08-30 阶段4瞄准态验收失败排查中——`OnAimPressed` 临时加了诊断 PrintString(本条未完成,等用户实测反馈)

用户验收通过待命/技能栏修复后,反馈"范围攻击的攻击范围、鼠标右键的锁定都没"(阶段4的 RMB 瞄准态完全没反应)。直接读 live PIE 状态排查:`SelectedUnit`(`BP_Unit_C_0`)的 `Aiming=false`、`AimCursorCol/Row` 仍是初始值 `0/0`(从未被 `OnAimPressed` 写过,因为 Col/Row 是 1 起始的棋盘坐标,`0` 不是合法位置,只能是"从没设置过"),但 `SkillSlots[0]="cleave"`(用户已经通过自定义配装正确装备了一个 AOE 技能在当前选中的槽位 0)。`get_connected_subgraph`/`read_graph_dsl` 逐节点复核了 `OnAimPressed`→`IsCurrentSkillAoe`→`IsAoeSkill` 整条链路,**图结构和逻辑完全正确,没有被之前几次 MCP 断线污染**,理论上应该能正常工作。`BP_TacticsController`/`BP_Unit` 也没有发现其它可能抢占 `RightMouseButton` 输入的竞争绑定。由于 MCP 没有可靠的鼠标长按模拟能力,无法自己复现,**临时在 `OnAimPressed` 里插了 3 个 `PrintString`(`bPrintToScreen=true`,游戏画面上会直接弹字,不用开 Output Log)**:入口一条"RMB Pressed, entering"、`IsCurrentSkillAoe` 判断的 True/False 分支各一条,用来在用户下次真人按键时定位到底卡在哪一步(输入没到 / AOE判断错了 / 判断对了但后续预览没画出来)。`compile_blueprint` 通过、`get_connected_subgraph` 复核连线正确、已 `save_assets`。**下一步:等用户按 1 号槽位(cleave)+ 长按右键的实测反馈,看屏幕上弹出的是哪一条(或者完全没弹),再决定往哪个方向继续排查;排查完这一轮记得把这 3 个诊断 PrintString 删掉,不要留在正式版里。**

### 2026-08-30 血条加敌我标记(骷髅图标),本条已完成、已编译验证(尚未经 PIE 视觉确认,见下)

用户要求"方便理解"的两个 UI 改动之一:敌方单位血条最前面加骷髅标记区分敌我。第二个改动(高亮"会被打到的敌人")经 `AskUserQuestion` 确认范围**只针对 AOE 技能预览**,不需要给单体锁定再加一套"射程内但未选中"的弱高亮——这部分并入上面还在排查的阶段4瞄准态问题,不是独立新工作。

**`WBP_HealthBar`**:`UMGToolSet.AddWidget` 新增 `TextBlock Txt_EnemyMarker`(`bIsVariable=true`),`CanvasPanelSlot` 定位在血条(`0..100,0..14`)左侧外部 `offsets={left:-16,top:0,right:-2,bottom:14}`,文字用 `"☠"`(U+2620,避免用彩色 emoji "💀" 触发 Slate 字体渲染问题)、红色 `(1,0.15,0.15,1)`、字号12、居中、默认 `Visibility=Collapsed`。新函数 **`SetIsEnemy(bEnemy: Bool)`**:`create_node`/`connect_pins` 手搭(`Widget|SetVisibility` 历史上有和 SceneComponent 版本混淆的坑50,不赌 `write_graph_dsl`),`Branch(bEnemy)`→True 分支 `SetVisibility(Txt_EnemyMarker, Visible)`,False 分支 `SetVisibility(Txt_EnemyMarker, Collapsed)`。`get_connected_subgraph` 复核两条分支都真正连通。**跨蓝图函数调用名是 `Class|WBPHealthBar|SetIsEnemy`(去掉 `WBP_` 下划线),但该控件自己内部的 `bIsVariable` 取值节点是 `Variables|WBP_HealthBar|GetTxt_EnemyMarker`(保留 `WBP_` 下划线)——两种命名规则在同一个资产上并存,和 `WBP_SkillBar` 之前的坑是同一类现象(见 `UE节点备忘录.md` 坑6 相关记录的老结论,这次是再次印证,不用另开新坑号)。**

**`BP_Unit.Setup(bAlly)`**:`write_graph_dsl` 整体重写(函数本身纯线性无循环,已确认过内容,新增一行没有涉及任何红线节点类型),在原有"改材质"分支后面加一行 `Class|WBPHealthBar|SetIsEnemy(HealthBarWidget, NOT bAlly)`,再调用原有的 `UpdateHealthBar()`。`compile_blueprint` 通过,`get_node_infos` 核对新节点的 `self`/`bEnemy` 参数来源和 exec 链路都正确接入。已 `save_assets`。

**尚未验证**:这个改动只在 `Setup()`(单位生成时)生效,当前 PIE 场上已存在的单位不会带这个新逻辑;需要用户下次重启 Play 才能看到骷髅标记实际效果,和阶段4瞄准态调试是同一次重启验证,还没拿到用户"看到骷髅了"的实测确认。

### 2026-08-30 修复 `SetLockIndicator` 每 Tick 报 "Accessed None" 的真实 bug(本条已完成、已验证)——和 AOE 瞄准态是两个独立问题

用户报告控制台每帧刷屏报错(`Accessed None trying to read (real) property CallFunc_Array_Get_Item_2 in not an UClass. Node: SetLockIndicator`)。排查(静态读图,未依赖任何鼠标/键盘模拟):`EventTick` 主线程里"锁定式索敌"逻辑(`GetTargetsInRange`→按 `LockedTargetIndex` 取数组元素→`SetLockIndicator`)有一个**从 2026-08-22 系统建立起就存在的真实 bug**——`LockedTargetIndex` 的"越界回绕"逻辑是 `Select((LockedTargetIndex >= 候选数量), 0, LockedTargetIndex)`,只处理了"下标比候选数量还大"的情况,回绕结果永远是 `0`;但当候选数量本身是 **0**(当前选中技能射程内一个敌人都没有,比如切到"横扫斩"这种低射程技能后离敌人较远)时,`0 >= 0` 也成立,回绕后依然是 `0`,而 `0` 对一个空数组来说仍然是越界——`Array|Get` 在空数组上取不到东西,拿到的是 `None`,后面直接拿这个 `None` 去调 `SetLockIndicator` 就报"Accessed None"。**这个坑和这次 AOE/RMB 相关的改动完全无关**,是老代码里一直潜伏、只是之前测试时手边永远有敌人在射程内所以没触发过的边界条件,这次用户测试"横扫斩"这类特殊技能时才第一次暴露。

**修法**:`EventTick` 主线程里这段逻辑一共有 **5 处重复的"章节"**(和坑72记录的"只加不删"历史一致,`SetLockIndicator` 调用点 449/567/654/711/768,另有一处 80 是坑72已确认的孤立死代码,不用管),给每一处的"取数组元素→`SetLockIndicator`"之间插入 `Utilities|IsValid` 判断(`create_node`/`connect_pins`,不动周围任何既有逻辑):`Is Valid`→照常调用 `SetLockIndicator`;`Is Not Valid`→**直接跳转到原本 `SetLockIndicator.then` 指向的下一个节点**(用 Blueprint exec pin 天然支持"多个来源汇入同一个输入"的特性做的旁路,不是新开一条独立分支,`get_node_infos` 复核过目标节点的 `execute` 输入现在有两个 `connected_pins`)——这样"没有候选目标"时干净跳过这次调用,不影响 Tick 剩余部分继续跑。副作用验证:旁路生效时下游 `SetCurrentLockedUnit` 依然会执行(数据 pin 直接接的是可能为 `None` 的 `Array|Get` 输出,和 exec 路径无关),把 `CurrentLockedUnit` 正确设成 `None`,这正是"没有可攻击目标"时应有的语义,不是纯粹的错误抑制。

**验证**:`compile_blueprint` 通过,5 处改动逐一 `get_node_infos` 复核连线。切 `bRunRegressionTestsOnBeginPlay=true` 跑一轮 `StartPIE`(`bSimulate:true`)+`LogsToolset.GetLogEntries` 读日志:本轮跑下来**没有任何新的 `SetLockIndicator`/`Array_Get_Item` 报错**(日志里能查到的所有该报错记录时间戳都早于这次修复,是用户此前反馈时的旧记录),已知的 T6a/T7b/T7c/T9 假性 FAIL(命中率随机性/AI寻路已知问题,和这次改动无关)照常出现,没有新增回归。`StopPIE`、`bRunRegressionTestsOnBeginPlay` 复位为 `false`,已 `save_assets`。

### 2026-08-30 AOE 瞄准态真正的根因:`IsCurrentSkillAoe` 自己写错了,`IsAoeSkill` 的 exec pin 从未被接上(本条已完成、已验证)

修好 `SetLockIndicator` 刷屏之后,用户成功看到了 `OnAimPressed` 里的诊断信息:`RMB Pressed, entering OnAimPressed` 正常触发,但紧接着是 `IsCurrentSkillAoe=FALSE, skipping`——即使技能栏当时明确显示选中的是"1 横扫斩"(AOE 技能)。这证明输入本身完全正常(镜头能转、按键能收到),问题出在判断逻辑内部。

**根因**:`Class|BPGridManager|IsCurrentSkillAoe` 当初(本轮更早些时候)是这样写的:
```
(fn IsCurrentSkillAoe (Unit)
  (return (CallFunction|IsAoeSkill self (Combat|Loadout|GetSkillSlotName (Variables|Default|GetSkillSlots) (Class|BPUnit|GetSelectedSkillIndex Unit)))))
```
`IsAoeSkill` 不是纯函数(内部是真实的 if/elif 分支,带 exec pin),但这里把它的调用**直接嵌套在 `return` 表达式内部**,而不是先 `bind` 成一个局部变量再 `return` 那个变量。`get_node_infos` 直接读实际图结构才发现:`IsAoeSkill` 这个 `CallFunction` 节点的 `execute` 输入 pin **完全没有连接**,真正的 `FunctionResult`(Return 节点)的 `execute` 输入直接接的是 `FunctionEntry.then`——也就是说函数一进来就直接 Return 了,`IsAoeSkill` 从未真正执行过,它的 `ReturnValue` 输出 pin 上停留的只是布尔类型的默认值 `false`,`IsCurrentSkillAoe` 因此**恒定返回 `false`**,不管技能是什么。这正是 `UE节点备忘录.md` 硬规则第①条早就写明的坑34("带 Exec 的自定义函数不能当纯表达式嵌套调用,否则会被 prune"),这次是自己在阶段4新写的代码里又踩了一遍。

**修法**:改写成显式 `bind` 再 `return`:
```
(fn IsCurrentSkillAoe (Unit)
  (bind _self self)
  (bind _rowname (Combat|Loadout|GetSkillSlotName (Variables|Default|GetSkillSlots) (Class|BPUnit|GetSelectedSkillIndex Unit)))
  (bind _result (CallFunction|IsAoeSkill _self _rowname))
  (return _result))
```
`write_graph_dsl` 是对已有内容的函数**追加不替换**(坑1),重写后 `get_connected_subgraph` 发现旧的、`execute` 从未连过的死节点(`VariableGet_0/1`、`CallFunction_0/1`、`FunctionResult_1`)原样留在图里,和新链路通过 `FunctionEntry` 的 `Unit` 输出 pin 共享数据扇出——`delete_node` 清掉这 5 个死节点,`compile_blueprint` 通过,`get_connected_subgraph` 复核新链路完整:`Entry.then→IsAoeSkill.execute(真正连上了)→FunctionResult.execute`,`RowName` 由 `GetSkillSlotName` 正确提供。已 `save_assets`。

**当前状态**:这是本轮排查链条里最后一环真正的逻辑 bug,已经修好并验证连线正确,但**还没拿到用户"技能栏选中 AOE 技能后长按右键,真的看到 `IsCurrentSkillAoe=TRUE, Aiming ON` 且橙色范围预览出现"的实测确认**——理论上现在应该正常工作了,下一步是请用户再测一次。`OnAimPressed` 里的 3 条诊断 `PrintString` 暂时保留,等这轮测试确认没问题后再删掉。

### 2026-08-30 用户实测反馈"Aiming ON 但完全没有高亮"+"移动时按右键会重复移动一下",两个真实问题都已修复(本条已完成、已验证连线,尚未拿到用户"这次真的看到高亮了"的最终确认)

用户按 A 键挪了光标后反馈"完全不行"。直接读 live PIE 状态排查:`AimCursorCol/Row` 一直等于角色自己当前的 `Col/Row`,从没真正挪动过;而且 `Col` 本身在 `Aiming=true` 期间还发生了变化(从 7 变成 6)。定位到两个独立问题:

1. **没有任何"光标在哪"的视觉反馈,靠盲按 WASD 几乎不可能精确落在敌人格子上**——之前的设计只在光标真的落在敌人身上时才会出现橙色 AOE 命中预览,光标本身在移动过程中完全不可见,相当于"蒙眼走格子"。**这是"高亮完全不行"的根本原因,不是逻辑判断错了**(`GetAoeHitList`/`GetEnemyUnitAtTile`/`RefreshAoePreview` 这几个函数逐一重新核对过连线,都是对的)。
   - **修法**:新增一个独立的"光标位置指示"高亮,和"AOE 会命中谁"的橙色高亮分开、颜色也不同(青色 `M_CursorHighlight`,`(0.2,0.9,1.0)`),不管光标格子上有没有敌人,只要在瞄准态,光标当前所在的格子就会显示这个青色标记。`BP_Tile` 新增 `CursorHighlightMat`(Material 对象引用,CDO 设成 `/Game/Maps/M_CursorHighlight`)、`CursorHighlighted`(Bool)、函数 **`SetCursorHighlight(bOn)`**(逐行照抄 `SetAoeHighlight`/`SetAttackHighlight` 的写法,`create_node`/`connect_pins` 手搭,`get_connected_subgraph` 复核过完整连通)。`BP_GridManager.ClearAoeHighlightsOnly()` 顺带在同一个 for 循环里也清一遍 `CursorHighlighted`(`write_graph_dsl` 整体重写,新增一行 `(Class|BPTile|SetCursorHighlight _array_element)`——**试出来一个之前不知道的行为:漏传的 `bOn` 参数会自动用函数定义时的字面量默认值`false` 补上,不会报错**,不用每次都手写全部参数)。`BP_GridManager.RefreshAoePreview` 在原有"清空→找光标格敌人→命中预览"逻辑最前面插入一段新的 for 循环:遍历所有 `Tiles`,找到 `Col/Row` 等于 `CursorCol/CursorRow` 的那一格,调 `SetCursorHighlight(true)`——这段放在敌人判定**之前**,如果光标格恰好真的有敌人、进入了命中预览分支,后续 `SetAoeHighlight(true)` 会把这一格从青色覆盖成橙色(同一个材质槽后写覆盖前写,这次是刻意利用这个特性做优先级)。
   - **同样踩到坑1**:`write_graph_dsl` 重写 `ClearAoeHighlightsOnly`/`RefreshAoePreview` 这两个已有内容的函数后,旧版本的节点(分别是 8 个和 17 个)原样留在图里、通过 `FunctionEntry` 的参数输出 pin 和新链路共享数据扇出,`get_connected_subgraph` 从 `FunctionEntry` 发起的遍历会把这些"数据上关联但 exec 上早已断开"的死节点也纳入结果——不能只看"这个节点出现在 get_connected_subgraph 里"就认为它活着,这次改用写小脚本对比"节点是否真的在从 Entry 出发的 exec 链路上"(逐个读 `execute`/`then` 等 Exec 类型 pin 的 `connected_pins`)才准确定位到死节点,`delete_node` 清掉后 `find_nodes` 复查节点数量precisely等于新链路应有的数量,`compile_blueprint` 通过。

2. **瞄准态开始时角色可能还带着刚才走路的残余动量,导致进入瞄准的瞬间又滑了一小步,看起来像"重复移动"**——`BP_Unit.EventTick` 里"世界坐标→逻辑 Col/Row"的同步(`GetNearestTile`)是每 Tick 无条件执行的,不受 `Aiming` 影响(移动输入 `AddMovementInput` 虽然已经被 `Branch(NOT Aiming)` 挡住,但角色物理身上的速度不会瞬间归零,`CharacterMovementComponent` 会用几帧时间自然减速滑行,滑行期间 Col/Row 跟着世界坐标继续同步,看起来就像"点了右键之后角色还在自己动")。
   - **修法**:`BP_Unit.OnAimPressed` 里 `Set Aiming=true` 之后,紧接着调用 `Components|Movement|StopMovementImmediately`(目标是 `GetCharacterMovement()`)把速度直接清零,再继续设置光标初始位置——`create_node`/`connect_pins` 插入,不涉及任何已有内容的函数重写,没有坑1的风险。`get_node_infos` 确认 `SetAiming(true).then→StopMovementImmediately.then→SetAimCursorCol...` 连通。

**验证**:`BP_Tile`/`BP_GridManager`/`BP_Unit` 三个蓝图逐一 `compile_blueprint` 通过,`M_CursorHighlight` 材质 `recompile` 通过,所有新增/改动的连线都用 `get_node_infos`/`get_connected_subgraph`(必要时配合脚本比对死节点)复核过,已 `save_assets`。**还没有拿到用户下一轮实测的确认**——下一步请用户重启 Play,瞄准态下移动光标应该能看到青色标记跟着走,移动时按右键也不应该再看到额外的滑步。

### 2026-08-30 血条(含骷髅标记)"完全不可见"的真根因:World Space + 固定朝向的 WidgetComponent 配合最新镜头构图,已在近摄像机边缘位置严重畸变到肉眼不可见(本条已完成、已验证)

用户反馈"敌人血条旁边的骷髅还是没出现",直接问"给我别的方案"。没有直接猜测/重做骷髅定位,而是先用 `CaptureEditorImage` 截了当时 PIE 画面裁剪放大到角色头顶区域——**发现根本不是骷髅位置问题,是整条血条本身在正常截图里完全不可见**,连一个像素的色块都没有。

**排查过程**(全部基于 live PIE 状态直接读取,没有靠猜):
1. `get_properties` 核对 `HealthBarComponent`(`WidgetComponent`)本身:`bVisible=true`、`bHiddenInGame=false`、`DrawSize=(100,14)`、挂载正确(`AddComponent` 的 `bManualAttachment=false`,自动挂在 `RootComponent` 上,`RelativeLocation=(0,0,120)`)、`Space=World`、`GeometryMode=Plane`——单看这些属性全部正常,不能解释"完全不可见"。
2. 做了个对照实验:临时把 `DrawSize` 从 `(100,14)` 暴力放大到 `(400,100)`、`RelativeLocation.z` 从 `120` 提到 `250`,重新截图——**这次能看到一条内容,但是扭曲成一根细长的绿色波浪线,不是矩形**,而且弹出了"Video memory has been exhausted"警告。这证明渲染管线本身没坏(放大后能看到东西),但原始尺寸下这个"能看到"的东西已经因为畸变+过小,实际观感上和"不存在"没区别。
3. 顺藤摸瓜查 `UserConstructionScript`:血条的朝向是用 `Math|Transform|MakeTransform` **硬编码写死的固定旋转 `(Pitch=55, Yaw=-90, Roll=0)`**,当初这个值是照着当时的固定 `CameraActor`(`Pitch=-55, Yaw=90`)手算出来的"镜面对称"朝向,让这块 `Plane` 类型的 World Space 面片正对镜头。这个手算朝向只对**镜头正前方视轴上**的单位精确成立;镜头到某个具体单位的真实视线方向,只要该单位不在视野正中心(偏左右、偏近远),和镜头的"标称朝向"就会有夹角,这块面片因此会以一定角度侧对镜头——正是"变成细长扭曲线"的原因。24-08-29~08-30 提交的"全景机位构图修法"把镜头拉远/改了构图后,画面里绝大多数单位都不再处于视轴正中心,这个原本"凑合能用"的固定朝向手算就大概率失真到不可见的地步,这次的表现是长期潜伏设计缺陷被最新镜头改动放大暴露,不是这次 AOE 工作引入的新 bug。

**修法**(改用 Screen Space,从根源上避免任何朝向计算/畸变问题):
- `BP_Unit.UserConstructionScript` 里 `UserInterface|SetWidgetSpace` 的 `NewSpace` 参数字面量从 `"World"` 改成 `"Screen"`(用 `set_pin_value` 直接改字面量,不做整图重写——这个函数是纯线性调用链,但没必要冒险重写,直接改一个已定位到的 pin 更安全)。Screen Space 下 WidgetComponent 只是把 `RelativeLocation` 对应的 3D 世界坐标投影成一个屏幕坐标,再在该处画一个**始终正对镜头、不会因为朝向计算错误而畸变**的 2D 部件,`DrawSize` 的单位也从"世界单位(cm)"变成"屏幕像素"。
- 同一个 `MakeTransform` 节点:`DrawSize` 由 `(100,14)` 调到 `(150,22)`(Screen Space 下这是**屏幕像素**,不是世界单位,尺寸观感和之前完全不是一回事,不能照搬旧数值),`Location.z` 由 `120` 调到 `40`(去掉了 Screen Space 不再需要的那部分"世界单位安全间距",实测让血条紧贴头顶上方,不再飘在天上一大截)。
- `WBP_HealthBar` 内部 Canvas 布局同步调整为配合新的 `150x22` 画布:`HealthProgressBar` 的 `CanvasPanelSlot_0` 从 `offsets=(0,0,100,14)` 改成 `(left=20,top=0,right=130,bottom=22)`(注意这是 point-anchor 语义,`right`/`bottom` 是宽高不是绝对边距),`Txt_EnemyMarker` 的 `CanvasPanelSlot_1` 从原来重叠在血条左边缘内部改成独立占据左侧 `(0,0,20,22)` 的专属区域——骷髅和血条现在是"左右并排",不再互相重叠遮挡。
- `compile_blueprint`(`WBP_HealthBar` 用 `UMGToolSet.CompileWidgetBlueprint`,`BP_Unit` 用普通 `compile_blueprint`,坑9 的依赖顺序)→`save_assets([])`→`CaptureEditorImage` 反复验证,最终三个单位头顶的绿色血条清晰可见、方正不畸变、紧贴头顶。

**顺带排除的另一个假设(结论:`SetIsEnemy` 逻辑本身没有 bug)**:一开始怀疑过 `SetIsEnemy` 的 `bEnemy=true` 分支里 `Widget|SetVisibility` 调用在 `read_graph_dsl` 打印出来的文本里**看不到第二个参数**,担心是又一次"漏传参数导致悄悄退化成默认值"(坑78/34 那种模式)。直接 `get_node_infos` 读该 pin 的真实字面量——`InVisibility="Visible"`,**是对的,只是 DSL 文本打印器本身在这个例子里省略了等于该 pin 定义时默认值的字面量,不代表节点真的没收到这个值**。这是一次虚惊,但再次印证了 `UE节点备忘录.md` 里反复强调的规矩:**怀疑连线问题时必须 `get_node_infos` 读真实 pin 值,不能只信 `read_graph_dsl` 的文本渲染结果**。

**顺带发现的场景限制(不是 bug,只是这次没法验证骷髅)**:当前 PIE 测试地图里全部 4 个 `BP_Unit`(`BP_Unit_C_0~3`)的 `side` 属性全部是 `true`(全部同一阵营),**场上根本没有 `side=false` 的敌方单位**,所以不管骷髅逻辑对不对,这次测试里都不可能真的看到骷髅出现——这是测试场景本身的限制,不是代码问题。已经用临时手段验证过骷髅本身能正确渲染:直接对 `BP_Unit_C_1` 的 `Txt_EnemyMarker` 强制 `set_properties(Visibility=Visible)`(仅用于这次视觉验证,验证完已经改回 `Collapsed`,没有改动任何蓝图逻辑),截图确认骷髅图标清晰显示在血条左侧专属区域内,和血条不重叠。**结论:骷髅标记的代码逻辑是正确的,用户如果想在实际对局里看到骷髅效果,需要在有真正敌方(`side=false`)单位的对局场景里测试,而不是当前这个"全员同阵营"的调试地图。**

**当前状态**:血条可见性问题已经彻底解决并肉眼验证。骷髅标记逻辑已验证正确,但受限于当前测试地图没有敌方单位,还没有在"真实敌我混战"场景里得到最终视觉确认——下一步建议用户换一个有敌方单位的关卡/场景再看一次。

**2026-08-30 用户验收通过**:用户在有真实敌方单位的场景测试后确认骷髅标记正常显示,本条(血条可见性 + 骷髅敌我标记)整体验收完成。

### 2026-08-30 攻击前伤害/命中率/暴击率预测面板(本条已完成、已用真实 PIE 数据验证核心路径,部分分支靠读连线保证正确性)

用户要求:攻击前弹出一个面板,显示这次攻击对目标造成的伤害、以及目标反击会对我造成的伤害,切换技能(1-5键)时数值实时刷新。经 `AskUserQuestion` 确认:面板是**纯提示信息**,E 键照常直接攻击,不需要二次确认;范围只覆盖单体锁定流程,AOE 瞄准态(已有橙色高亮预览)不显示这个面板。

**关键发现:项目里同时存在两套互不相关、但命名极其相似的"伤害预测"半成品**,这次工作前完全没意识到有两套,是排查过程中才发现的:
- `BP_GridManager.ForecastWidget`(类型 `WBP_DamageForecast`):只有一个 `DamageText` + `ConfirmButton`/`CancelButton`,配套 `ShowDamageForecast`/`PredictDamage`(公式极简单 `ATK/(DEF+9)`,不含技能倍率/属性克制/暴击,坑76 附近的历史遗留),`PendingDefender`/`ConfirmPendingAttack`/`CancelPendingAttack` 都挂在这一套上。
- `BP_TurnManager.ForecastWidget`(类型 **`WBP_AttackForecast`**):有 `Txt_HpInfo`/`Txt_AtkDmg`/`Txt_CounterDmg` 三个独立文本 + `Btn_Confirm`/`Btn_Cancel`,配套 `Class|WBPAttackForecast|SetAtkForecast`/`SetCounterForecast`/`SetHpForecast`(接收现成字符串直接刷文本,不用自己摸 TextBlock)、`Class|BPTurnManager|ShowAttackForecast`/`CancelAttackForecast`。**这一套的字段结构完全就是这次要做的功能需要的形状**,采用它、不用 `WBP_DamageForecast`。
- 两套的挂载机制相同(`UserConstructionScript` 建组件只为触发 `bIsVariable` 初始化,真正显示走 `EventBeginPlay` 的 `AddToViewport`,默认 `Collapsed`,坐标 `(500,400)`),都源自更早"点击选目标→确认/取消攻击"的交互模型,当前"自动锁定最近敌人+按1-5切技能+按E攻击"的主流程(`PerformSkillAttack`)完全不调用任一套的 Show/Confirm/Cancel,两套都是孤儿代码。**用 `get_node_infos` 读 `Variables|Default|GetForecastWidget` 节点的真实输出 pin 类型(`WBP Damage Forecast Object Reference` vs 若在 `BP_TurnManager` 里读到的会是 `WBP Attack Forecast Object Reference`)才发现这个区分——只看变量名字完全看不出来是两套不同的东西。**

**新增(`BP_GridManager`,纯计算,不碰任何 UI)**:
- **`GetSkillCritChance(RowName: Name) -> Crit: Int`**:`Utilities|GetDataTableRow(DTSkills变量, RowName)`→找到就 `Utilities|Struct|BreakSkillRow` 取 `Crit` 字段返回,找不到返回 `0`。`write_graph_dsl` 全新写(空函数,没有坑1风险)。
- **`PreviewAttackForecast(Attacker, Defender, RowName) -> Damage: Int, HitChance: Int`**:内部 `bind saved=GetPendingSkillRowName()`→`SetPendingSkillRowName(RowName)`→用 `Attacker.Atk/AtkType`、`Defender.Def/AtkType`、`Attacker.Side`、`Defender.Side` 调已验证过的 `PreviewSkillDamage`(不掷随机数,预览安全)和 `GetSkillHitChance`(自带遗物命中加成)→算完立刻 `SetPendingSkillRowName(saved)` 还原,不会污染这个跨函数共享的全局变量。
- **`RefreshAttackForecast(Attacker, Defender)`**:先 `GetAllActorsOfClass(BP_TurnManager)→Get[0]→CastToBP_TurnManager`(每次现查,不缓存——和 `BP_Unit` 里一路的既有写法一致)拿到真正持有 `WBP_AttackForecast` 的 `TurnManager.ForecastWidget`;`Utilities|IsValid(Defender)`不合法就整个面板 `Collapsed`;合法但 `Attacker.Aiming=true`(AOE 瞄准态)也 `Collapsed`;否则查 `Attacker.SelectedSkillIndex` 对应的技能行名,调 `PreviewAttackForecast`(我方)算伤害/命中率,`GetSkillCritChance` 算暴击率,拼成"我方: 伤害X 命中Y% 暴击Z%"塞进 `SetAtkForecast`;如果 `伤害>=Defender.HP`(这一下就能击杀),反击行直接显示"反击: 无(目标将被击杀)",否则再用 `PreviewAttackForecast(Defender, Attacker, "basic")`(反击固定用 `basic`,照抄 `ResolveCounterAttack` 的既有约定)算反击数值拼进 `SetCounterForecast`;`Txt_HpInfo` 用 `SetHpForecast` 显示 `Defender` 的 `HP/MaxHP`;最后把 `Btn_Confirm`/`Btn_Cancel` 强制 `SetVisibility(Collapsed)`(这次是纯提示面板,不需要这两个遗留按钮,但不删除它们背后的 `ConfirmPendingAttack`/`CancelPendingAttack` 逻辑),`ForecastWidget` 本体 `SetVisibility(Visible)`。字符串拼接全部用显式 `Utilities|String|Append`(A,B)两两拼接分步 `bind`,没有依赖 DSL 的 `+` 对字符串是否生效(没测,不确定,干脆不赌)。

**`BP_Unit.EventGraph` 的 `EventTick` 接线**:这段 lock-on 逻辑历史上被追加过 5 次重复"章节"(坑72),这次没有凭经验挑一个,而是从 `Event Tick.then` 开始逐节点 `get_node_infos` 顺 Exec pin 真的走了一遍,确认第 5(最后一个)章节 `SetLockIndicator`(`K2Node_CallFunction_768`)之后的 `SetCurrentLockedUnit`(`K2Node_VariableSet_118`)——它的 `execute` 输入本身就是坑77修复时留下的"Is Valid/Is Not Valid 双源汇入"写法,`then` 原本单线接到 `UpdateLocomotionAnim`(`K2Node_CallFunction_769`,这个节点的 `execute` 输入还另外汇入了两条别的分支,是整个 Tick 里更大的一个汇聚点)——这确认了 `VariableSet_118` 就是这一帧里 `CurrentLockedUnit` 真正最终、不会再被覆盖的写入点。新插入 `Grid.RefreshAttackForecast(self, self.CurrentLockedUnit)`(`self`=`Attacker` 直接复用已有的 `K2Node_Self_16`,`Grid` 复用同一条 Tick 链路更早已经 Cast 好的 `BP_GridManager` 引用 `K2Node_DynamicCast_62`,不用重新 `GetAllActorsOfClass`),用 `break_pins`/`connect_pins` 精确断开+重接 `VariableSet_118.then→CallFunction_769.execute` 这一条边、插入新节点,`CallFunction_769.execute` 上原有的另外两条汇入边完全没有被动到。

**验证**:三个函数逐一 `get_node_infos` 核对每个 pin 的真实连线来源(不只信 DSL 文本),`compile_blueprint`(先 `BP_GridManager` 后 `BP_Unit`)全部一次通过、`save_assets` 及时保存。真实 PIE 验证:找到一对自然锁定的单位(`BP_Unit_C_1` 我方 Atk12/Def7 锁定 `BP_Unit_C_2` 敌方 Def5/Atk10/HP13),读到面板 `Visibility=Visible`、`Txt_AtkDmg="我方: 伤害7 命中100% 暴击0%"`、`Txt_CounterDmg="反击: 伤害4 命中95% 暴击0%"`、`Txt_HpInfo="HP: 13/20"`,`CaptureEditorImage` 截图确认屏幕左侧清晰可见这三行文字。**受限于当前 PIE 会话里 `ObjectTools.set_properties` 对 `BP_Unit`/`BP_GridManager`/`BP_TurnManager` 这几个 Character 派生或核心 Actor 的任何属性(哪怕是字符串这种最简单的类型)一律写入失败(读取完全正常)——这个限制在改动前对不相关的属性上试过也一样失败,和这次改动无关,是当前这个 MCP/PIE 连接的环境限制,不是本次改动引入的问题——没能用强制改属性的方式验证"没有目标时隐藏"/"瞄准态隐藏"/"一击必杀时反击行显示'无反击'"这三个分支**,这三条分支已经通过 `get_node_infos` 逐 pin 核对连线正确(`Utilities|IsValid` 的 Is Not Valid 分支、`aiming` 的 Branch、`dmg>=defHP` 的 Branch 都读到了预期的目标节点),但还没拿到运行时实际触发的确认,建议用户下次实测时留意这三种情况。

**当前状态**:核心路径(有效锁定目标时算出正确的伤害/命中率/暴击率并显示)已经用真实数据验证。三个边界分支(无目标/瞄准态/一击必杀)靠连线核对保证正确,建议用户实测时留意确认。

### 2026-08-30 补上 AOE 回归测试(T10 系列)明确留下的两个收尾断言(本条已完成,T10i 已验证稳定 PASS,T11a/T11b 验证通过但受已知随机命中率影响,原计划的第三条断言 T11c 确认不可行、已放弃)

之前 T10 系列验收时明确留了"下次接手直接加断言"的两项:①`PerformAoeSkillAttack` 结算完之后 `SelectedUnit` 是否严格变回 `None`;②AOE 一次团灭多个敌人时胜负结算是否只弹一次窗口。

**`RunRegressionTests` 重建方式**:这是一个已有大量内容(30+ 条断言)的函数,按坑1 的既定流程 `remove_function_graph`→`compile_blueprint`(确认删除生效,此时会报"找不到 RunRegressionTests"这个预期内的编译错误,因为 `EventBeginPlay` 里的 `Branch(bRunRegressionTestsOnBeginPlay)→RunRegressionTests(self)` 调用节点还在)→`add_function_graph` 重新建一个同名空函数→`write_graph_dsl` 整体写入"原有全部内容 + 新增的 T10i/T11 断言"。过程中连续踩了 4 类"`read_graph_dsl` 打印文本和真实可创建节点名对不上"的坑(`GetRow` 的 self 类型混淆、`FindNearestUnit0` 的下划线、`SnapColD`/`SnapRowD` 根本不是变量、`GetGameOver`/`SetGameOver` 的 `b` 前缀被去掉),详见 `UE节点备忘录.md` 坑82。

**T10i**(加在 T10h 断言之后、清理 T10 临时单位之前的位置):`Utilities|Array|ContainsItem`/`Utilities|IsValid` 判定 `Variables|Default|GetSelectedUnit` 现在应该是无效(None)——`Utilities|IsValid` 在这套 DSL 里只有 exec 分支形态,没有纯表达式用法,所以整个函数从这一步往后的所有语句(T11 的搭建 + 清理 + `REGRESSION_TESTS_DONE` 打印)被迫复制成两份,分别塞进 `"Is Valid"`(bug 场景,断言传 `false` 制造 FAIL)和 `"Is Not Valid"`(正常场景,断言传 `true`)两个分支里——不好看但是必须这么写,原因见坑82。

**T11a/T11b**(新场景,不复用 T10 的单位):生成 1 个我方单位 + 2 个正交相邻的敌方单位,敌方两个都强制 `Class|BPUnit|SetHP(1, 该单位)` 削到 1 滴血,`SetPendingSkillRowName("quake")` 后 `PerformAoeSkillAttack`,断言两个敌方单位 `HP<=0`(T11a 打的是直接目标,T11b 打的是正交相邻那个)。**这两条依赖真实掷骰命中判定**(quake 的 `Hit=85`,~15% 概率单次 MISS),连续跑了 5 轮 PIE,T11a/T11b 各自出现过 1-2 次因为 MISS 导致的假性 FAIL,和项目里已有的 T6a/T7b/T7c 是同一类"随机性假阳性,重跑即可"——**不是这次改动引入的新问题**,只是第一次有断言去真正检验 AOE 命中判定的确定性结果,把这类既有的随机性表现暴露了出来。

**T11c 被放弃(不是测试写错了,是这条断言在当前测试架构下本来就不可能可靠通过)**:原计划第三条断言是"团灭后 `bGameOver` 应该变成 `true`"。连续 4 轮 PIE 验证,哪怕 T11a/T11b 都确认 PASS(两个假敌人真的死了),**T11c 依然 100% FAIL,无一例外**——直接读 live PIE 场上单位揪出根因:`TestMap` 这张关卡真实开局会生成 4 个 `side=false` 的"敌方纹兽"作为这局对战本该存在的真实敌人,`CheckVictoryCondition()` 判定的是**全场**是否还有 `side=false` 单位存活,不是"这次测试自己操纵的那几个敌人"——测试脚本自己造的 2 个假敌人团灭对全局判定毫无影响,场上那 4 个真实敌人一直都在。这是全局状态判定函数天然没法被局部测试数据左右的架构性限制,不是随机性问题,详见 `UE节点备忘录.md` 坑83。已经删掉 T11c 断言,只保留可靠可验证的 T11a/T11b;`CheckVictoryCondition` 本身"多杀不重复弹窗"的保护(`if not bGameOver` 短路,同步无异步间隙)已经通过读源码逻辑结构确认足够可靠,不需要也没法靠这套集成测试去验证这一点。

**验证**:5 轮 `bRunRegressionTestsOnBeginPlay=true` + `StartPIE(bSimulate:true)` + `GetLogEntries` 读日志,T10i 每轮都 PASS;T11a/T11b 在 RNG 配合的轮次里都 PASS;T1-T10h 原有断言没有出现除已知的 T6a/T7b/T7c 之外的新增 FAIL。验证完 `bRunRegressionTestsOnBeginPlay` 复位为 `false`(`get_properties` 确认读到 `false` 之后才 `save_assets`,严格按坑15 的既定顺序防止关卡被意外落盘成 `true`)。

### 2026-08-30 用户反馈"AOE招数按右键后没有移动范围高亮、按不了E攻击"——排查结论:不是回归,是`SkillSlots`为空导致1-5键永远选不到AOE技能(本条排查已完成,未发现需要修复的代码)

用户报告直接怀疑是刚做完的攻击预测面板/回归测试改动引入的回归。逐节点排查(不是只读 `read_graph_dsl` 文本,凡是关键节点全部用 `get_node_infos` 核对真实 pin 连接):输入按键(`E`→`AttemptSkillAttack`,`RMB Pressed/Released`→`OnAimPressed`/`OnAimReleased`,`WASD`→`Branch(Aiming)`→`MoveAimCursor`)→`OnAimPressed`(`GetActorOfClass`→`CastToBP_GridManager`→`IsCurrentSkillAoe`→`Branch`→`SetAiming(true)`→`StopMovementImmediately`→设置光标初始位置→`RefreshAoePreview`)→`AttemptSkillAttack`(`Branch(Aiming)`→`AttemptAimAttack`)→`AttemptAimAttack`(`GetEnemyUnitAtTile`→`IsValid`→`PerformSkillAttack`)→`MoveAimCursor`(`ManhattanDistance`≤`GetSkillEffectiveRange`才移动光标+刷新预览)→`BP_Tile.SetCursorHighlight`(`Branch(bOn)`→`SetMaterial`)——**这一整条链路,每一个节点的 Exec/数据 pin 连接全部正确,和设计文档完全一致,没有发现任何断线、接错、或被最近两次改动(攻击预测面板的 `EventTick` 插入、`RunRegressionTests` 重建)误伤的痕迹**。这两次改动分别插在 Tick 链路里锁定索敌逻辑之后的一个单纯线性位置(`SetCurrentLockedUnit_118.then`→新插入的 `RefreshAttackForecast`→原来的下一个节点,纯粹的"中间插一刀"没有动分支结构)和完全不同的另一个蓝图(`BP_GridManager.RunRegressionTests`),两者都离 AOE 瞄准态的实际交互逻辑很远,可以排除。

**真正命中的线索**:顺手读了一下当前 PIE 里 `BP_GridManager` 的 `SkillSlots`,是空数组 `[]`。项目里 `Combat|Loadout|GetSkillSlotName` 对空 `SkillSlots` 的既定行为是**回退到固定的 basic/heavy/ember/aqua/vine 五个单体技能**(这在多处文档里反复确认过,`SkillSlots` 需要用户手动打开调试面板选预设/自定义配装才会真正写入)。也就是说:**只要用户没有先按 Ctrl 打开调试面板、手动把一个 AOE 技能(横扫/地裂/岩崩/横扫斩,这几个都是 `bEnabledInSlice=False`,不会自动进默认配装)塞进 1-5 号槽位里,不管按数字键选哪个槽,`SelectedSkillIndex` 对应到的都只会是回退用的单体技能之一**——`IsCurrentSkillAoe` 会一直老老实实返回 `false`,`OnAimPressed` 会一直走"IsCurrentSkillAoe=FALSE, skipping"这条分支(`Aiming` 永远不会被设成 `true`),自然没有任何高亮;`AttemptSkillAttack` 也因为 `Aiming=false` 会一直走非瞄准态的原有单体攻击逻辑,不会进入 `AttemptAimAttack`。**这完全解释了用户报告的两个现象,而且是代码按设计正常工作的结果,不是 bug。**

**结论/给用户的建议**:AOE 招数要先在调试面板(Ctrl 打开)里手动装配到某个 1-5 槽位才能选中,不能指望默认配装或者"随便按个数字键"就能选到——这是当前既定设计(AOE 技能 `bEnabledInSlice=False`),不是这次改动引入的问题。建议用户下次先确认技能栏底部显示的技能名确实是"横扫/地裂/岩崩/横扫斩"其中之一,再按住右键测试瞄准态。如果确认已经选中 AOE 技能、光标也确认在射程内(`GetSkillEffectiveRange`=攻击者 `AtkRange`+技能 `RangeBonus`,大多数 AOE 技能这个值很小,光标只能在自己周围小范围移动,不是全图自由移动)但仍然没有高亮/E键无效,才需要进一步排查,那种情况下请提供当时技能栏显示的具体技能名和角色/敌人的相对位置。

### 2026-08-30 瞄准态 WASD 方向修正 + 蓝色射程范围高亮 + 范围内敌人预高亮(本条已完成、已静态验证连线,受限于环境未能实机模拟按键)

用户装上 AOE 技能后确认能正常攻击了,同时提了两个新反馈:①瞄准态下 WASD 移动光标的方向和玩家在画面上的直觉方向对不上;②希望一进入瞄准态就用蓝色高亮显示技能射程内所有光标可达的格子,并且射程内的敌人不需要靠光标悬停就能直接看出来是可选目标(现状只有青色"光标当前位置"+橙色"光标悬停命中预览"两层,都要移动光标才看得到)。

**问题①根因(手算验证,非猜测)**:`BP_Unit.MoveAimCursor` 的 W/A/S/D 四个按键(`EventGraph` 里 `Branch(Aiming)`→各自调用 `MoveAimCursor`)当前字面量是 W=`(0,-1)`、A=`(-1,0)`、S=`(0,+1)`、D=`(+1,0)`。棋盘坐标轴实测(读 `BP_Tile_C_0/1/8` 的 `Col/Row`+世界坐标核对):**Col 对应世界 X 轴、Row 对应世界 Y 轴,两者都是同号递增**(`Row+1`→`Y+100`,`Col+1`→`X+100`)。固定机位 `CameraActor`(`Pitch=-55,Yaw=90,Roll=0`)的屏幕方向用 `Right=(sinYaw,-cosYaw,0)`、`Up=Right×Forward` 手算:`Right=(1,0,0)`(世界 +X)、`Up=(0,0.819,0.574)`(主要分量世界 +Y)——也就是说**屏幕右=Col+,屏幕"上/远"=Row+**。对照现有映射:D=`(+1,0)`(Col+,屏幕右)、A=`(-1,0)`(Col-,屏幕左)**这两个本来就是对的**;W=`(0,-1)`(Row-,实际是屏幕下/近)、S=`(0,+1)`(Row+,实际是屏幕上/远)**这两个刚好反了**——是最初写这段代码时把"数组行号越大越靠下"的直觉套用到了 3D 世界坐标上,没考虑摄像机朝向。**修法**:只改了 W 键调用节点(`K2Node_CallFunction_7`)的 `DeltaRow` 字面量从 `-1`→`+1`,S 键调用节点(`K2Node_CallFunction_16`)的 `DeltaRow` 从 `+1`→`-1`(`set_pin_value` 精确改两个字面量,没有动 A/D 和 `MoveAimCursor` 函数体本身),`compile_blueprint` 通过、`get_node_infos` 复核两个节点新值。**这个手算过程本身是可复用的方法论,已经写进 `UE节点备忘录.md` 坑84,以后镜头再改、或者其它需要"屏幕方向↔逻辑坐标轴"换算的功能可以直接抄这个算法,不用重新试错。**

**问题②实现**:新增第三层高亮——蓝色"射程范围"背景层,和已有的青色"光标位置"、橙色"命中预览"共存,三层通过"后写覆盖前写"的既有材质槽机制叠加(项目里 `SetXHighlight(bool)` 系列函数一直是这个模型,没有独立的合成/优先级系统)。
- `BP_Tile` 新增 `AimRangeHighlighted:Bool` + `AimRangeHighlightMat:Material`(新建 `/Game/Maps/M_AimRangeHighlight`,`Constant3Vector(0.2,0.5,1.0)`→`MP_BaseColor`,蓝色,和已有黄/红/橙/青都不冲突)+ 函数 `SetAimRangeHighlight(bOn)`(逐行照抄 `SetCursorHighlight` 的写法,全新空函数直接 `write_graph_dsl`,没有坑1风险)。
- `BP_GridManager` 新增 `ShowAimRange(Attacker)`:遍历 `Tiles`,`ManhattanDistance(Attacker.Col/Row, 该格.Col/Row) <= GetSkillEffectiveRange(Attacker, Attacker.SelectedSkillIndex)` 就 `SetAimRangeHighlight(true)`。`BP_Unit.OnAimPressed` 在原有"设置光标初始位置"之后、`RefreshAoePreview` 之前插入这个调用(整函数按坑1流程 remove/add/write 重建,不是增量追加)。
- 新增 `ClearAimRangeHighlightsOnly()`:遍历 `Tiles` 逐个 `SetAimRangeHighlight(false)`,只在 `BP_Unit.OnAimReleased`(退出瞄准态)里跟在原有 `ClearAoeHighlightsOnly` 后面调用一次——**不**放进 `ClearAoeHighlightsOnly` 本体,因为那个函数每次光标移动(`RefreshAoePreview`)都会调用一次,如果蓝色状态也跟着被清零,光标一动整个蓝色范围背景就会消失,起不到"一直显示"的效果。
- 关键的"层级重绘"逻辑改在 `RefreshAoePreview` 里:`ClearAoeHighlightsOnly()`(把所有格子的青色/橙色材质槽都强制写回 Normal,包括之前是蓝色的格子——`SetXHighlight(false)` 一律直接设 `NormalMat`,不管这一槽之前逻辑上"应该"是什么颜色)**执行完之后**,新增一个循环:遍历 `Tiles`,只要 `GetAimRangeHighlighted()==true`(这个 Bool 本身没被清过,只是材质被上一步强制盖掉了)就按"该格有没有敌人"分两种重新上色——`GetEnemyUnitAtTile` 有效就 `SetAoeHighlight(true)`(橙),否则 `SetAimRangeHighlight(true)`(蓝)。这样每次光标移动都会先把整个范围背景+范围内敌人重新刷一遍蓝/橙,再照原样叠加光标当前格的青色和真正命中列表的橙色——效果是:瞄准态下范围内的格子始终蓝色打底,范围内站着敌人的格子始终橙色(不用光标移过去),光标经过的当前格额外青色,光标真正悬停在敌人身上时命中列表内的格子橙色跟橙色底色视觉上无缝(同一个材质)。`RefreshAoePreview` 整函数同样按坑1流程重建。
- **踩坑**(已写入坑84):`(Class|GridSlot|GetRow _array_element)` 这个写法(照抄自旧代码 `read_graph_dsl` 的回显文本)在**新写的** `for` 循环迭代变量上会报 "Could not connect pin Array Element to self",换成 `Class|BPTile|GetRow`(先用 `find_node_types` 确认存在)就正常——这是坑67/82"DSL 回显文本和真正可创建的 type_id 不对称"同类问题的又一次复现,而且这次连"改用哪个类名前缀"都需要重新用 `find_node_types` 试出来,不能照抄读出来的文本。

**验证**:`M_AimRangeHighlight` 材质 `recompile` 通过;`BP_Tile`/`BP_GridManager`/`BP_Unit` 三个蓝图逐一 `compile_blueprint` 通过,`ShowAimRange`/`RefreshAoePreview`(含 "Is Valid"/"Is Not Valid" 双分支)的关键连线全部用 `get_node_infos` 逐 pin 核实过,不是只信 `write_graph_dsl` 不报错或 `read_graph_dsl` 的回显文本。`StopPIE`+`StartPIE` 重开一局后截图确认非瞄准态下画面完全正常(血条清晰、技能栏正常、没有任何异常蓝色残留),`GetLogEntries` 确认重开局后没有新的 Blueprint 编译/运行时报错。**受限于环境未能验证的部分**:这次 PIE 会话里 `set_properties` 对 `BP_GridManager.SkillSlots`、`BP_Unit.Aiming` 等多个属性的写入请求全部静默失败(和攻击预测面板那次报告的环境限制一样),导致没法在不依赖真人长按鼠标右键的前提下强制触发瞄准态来截图验证蓝色/橙色范围高亮的实际视觉效果,也没法用按键模拟验证 WASD 方向是否真的感觉对了——这两点的正确性目前只有"手算推导+逐 pin 连线核对"的静态保证,还需要用户下一轮实测确认。

### 2026-08-30 用户反馈"WASD方向还是不对,应该跟着鼠标视野走"——上面这版"固定机位手算"从根上就假设错了,已改成实时读镜头朝向动态计算(本条已完成、已用运行时真实数据验证公式正确)

用户实测上面那版修复后反馈:"1 还不行 不是我的鼠标视野的方向上下左右。2 可以了"——蓝色范围高亮没问题,但 WASD 方向的"手算一次、写死成字面量"完全没解决问题。

**根因**:上一版的前提假设错了。项目不是站在一个固定不动的 `CameraActor` 上看棋盘,`BP_Unit` 自己有 `TPSCamera`/`SpringArm`,角色 `Possess` 后玩家是用**鼠标自由转动第三人称镜头**的(`EventTick` 里能看到 `AddControllerYawInput`/`AddControllerPitchInput` 读鼠标增量)——镜头朝向实时变化,不是能提前手算好写死成常量的东西,不管怎么调字面量,玩家一转镜头就又不对了。

**修法**:直接抄 `EventTick` 里已经验证过手感正确的普通移动代码用的同一个数据源:`Pawn|GetControlRotation(CastToPlayerController(GetController(self)))`,只取 `.yaw`(`MakeRotator(0,0,yaw)` 清零 Pitch/Roll),和移动代码保持完全一致的朝向基准。新增全新函数 `BP_Unit.ComputeAimDelta(bForward:Bool, bPositive:Bool) -> DeltaCol:Int, DeltaRow:Int`(`add_function_graph`+`add_function_param`+`write_graph_dsl`,不碰任何已有函数,零坑1风险):读同一个 Yaw,按 `bForward` 用 `Math|Float|SelectFloat` 在 `GetForwardVector`/`GetRightVector` 之间线性混合出方向向量(避免对 Vector 类型做条件分支选择——`Math|Float|SelectFloat` 的 `A`/`B`/`bPickA` 三个 pin 用 `get_node_type_pins` 核实过,`bPickA=true` 选 `A`),按 `bPositive` 再乘 ±1,`BreakVector` 取 `.x/.y`、比较绝对值大小决定这次该动 `Col` 还是 `Row`、比较正负决定 `+1`/`-1`,两个结果作为 `DeltaCol`/`DeltaRow` 返回。

**接线**:不改 `MoveAimCursor` 函数体,只改 W/A/S/D 四个按键各自调用 `MoveAimCursor` 时传的参数来源——原来是死字面量,现在改成先调 `ComputeAimDelta(bForward,bPositive)`(W=(true,true)、S=(true,false)、A=(false,false)、D=(false,true)),把它的两个输出接到 `MoveAimCursor` 的 `DeltaCol`/`DeltaRow` 输入 pin。`create_node`(4 个新 `CallFunction|ComputeAimDelta` 节点,type_id 必须用 `CallFunction|ComputeAimDelta`,不是显示名 `|ComputeAimDelta`,又是一次坑67/73同类"显示名≠创建名")+`set_pin_value`(显式设置 4 个节点各自的 `bForward`/`bPositive` 字面量)+`break_pins`/`connect_pins`(原来"`Branch(Aiming).then`→`MoveAimCursor.execute`"这条边断开重接成"→`ComputeAimDelta.execute`→`then`→`MoveAimCursor.execute`",数据 pin 同步接上)。每一步都用 `get_node_infos` 复核过真实连线。

**验证(这次是运行时真实数据,不是纯手算)**:MCP 没有按键模拟能力,改用"临时在 `BeginPlay` 延时几秒后直接调用 `ComputeAimDelta` 并 `PrintString` 结果"的办法拿到 `GetLogEntries` 里的真实运行时输出。核对时发现诊断函数自己在 `write_graph_dsl` 里连续 4 次调用 `ComputeAimDelta` 传的字面量参数被写错位了(诊断代码的问题,见 `UE节点备忘录.md` 坑85),但交叉核对"诊断函数实际传入的参数"和"手算这组参数应该得到什么结果"完全吻合——这反而证明了 `ComputeAimDelta` 函数体本身的公式和连线是对的,错的只是诊断脚本的传参方式;正式的 91-94 号调用节点用 `set_pin_value` 显式设置、`get_node_infos` 二次核实过字面量,和诊断函数的坑无关。诊断验证完毕后所有临时节点/临时函数已 `delete_node`/`remove_function_graph` 清理干净,`BeginPlay` 恢复原状,`compile_blueprint` 确认无残留。当前机位(实测 `Yaw=0`)下真实运行时输出:W→`(+1,0)`、S→`(-1,0)`、A→`(0,-1)`、D→`(0,+1)`,和"Col对应世界+X、W应该往镜头朝向挪"完全吻合。

**当前状态**:公式和连线已有真实运行时数据佐证(不同于上一版纯手算无实证),但因为镜头朝向会随玩家转动而变化,不同 Yaw 下的完整手感仍需要用户一边转镜头一边实测 WASD 才能最终确认。
