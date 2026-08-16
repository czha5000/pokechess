# UE 蓝图状态快照(harness 核心文档)

> 用途:我不用每次靠翻聊天记录/整图回传来确认现状——直接读这份文档就知道每个蓝图有什么变量、什么函数、大致怎么连的。**每次改动后必须同步更新这里**,否则下次就是瞎猜。
> 配套文档:`UE节点备忘录.md`(踩过的坑/验证过的节点名)、`UE测试用例.md`(功能验收清单)。

---

## BP_Unit (`/Game/Maps/BP_Unit.BP_Unit_C`)

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
- **ActorOnClicked**(核心逻辑,已重构;**2026-08-15 加了"只有轮到的单位才能点"门槛 + 攻击命中后自动结束回合;同日再追加 ShowAttackRange 重触发修复;2026-08-16 再加"一回合只能移动一次"门槛**):
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

---

## BP_Tile (`/Game/Maps/BP_Tile.BP_Tile_C`)

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
- **ApplyStartingRelics()**(无参数):`For Each GetAllActorsOfClass(BP_Unit)`,只处理 `Side=true`(我方)的单位,`Set Atk = Atk+2` 且 `Set Def = Def+2`——硬编码代表两件遗物"力量头带"(全队攻击+2)+"钢之意志"(全队防御+2)一起生效,不做"选哪个"的三选一界面,也不做遗物的数据结构(没有 `RELICS` 数组这种东西,加成直接写死在这个函数体里)。由 `BP_TurnManager.EventBeginPlay` 在 `Set Grid` 之后、`BuildTurnOrder()` 之前调用一次(全局只生效一次,不会重复叠加),对 `RunRegressionTests` 里另外单独 `SpawnUnit` 出来的测试单位没有影响(那条路径不经过 `EventBeginPlay`)。

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

### BP_TurnManager 新增
| 名字 | 类型/签名 | 说明 |
|---|---|---|
| `PendingAttackTarget` | Object 变量(BP_Unit) | 玩家点击的、还没确认攻击的敌方单位 |
| `ForecastComponent`/`ForecastWidget` | WidgetComponent / WBP_AttackForecast | 和 `ActionMenuComponent`/`ActionMenuWidget` 完全同构的挂载方式(`UserConstructionScript` 建组件仅用于触发 `bIsVariable` 初始化,真正显示走 `EventBeginPlay` 里的 `AddToViewport`,默认 `Collapsed`,屏幕坐标同样是 `(500,400)`——和行动菜单不会同时显示,共用坐标不冲突) |
| `ShowAttackForecast()` | 函数,无参数 | 读 `Grid.SelectedUnit`(攻击方)和 `PendingAttackTarget`(防御方),先做距离/`AtkRange` 判断,**不在攻击范围内则什么都不做**(保留旧版"点了没反应,得挪近了再点"的行为);在范围内则:调用 `Grid.PreviewSkillDamage`/`GetSkillHitChance` 算主攻击的预计伤害+命中率,拼成字符串塞进 `ForecastWidget.SetAtkForecast`;再判断反击条件(距离<=防御方自己的 `AtkRange`),成立则同样算一遍反击预测塞进 `SetCounterForecast`,不成立则显示"无反击";最后 `SetVisibility(Visible)` 弹出面板。**同样用了 Set-then-Get 快照模式**避免坑26 的重复调用问题。 |
| `ConfirmAttack()` | 函数,无参数 | 隐藏预测面板 → `Grid.TryAttack(PendingAttackTarget, PendingSkillIsElemental)`(这时才真正掷骰子结算,含反击)→ 检查 `Grid.SelectedUnit` 是否还有效,无效说明攻击真的发生了 → `EndTurn()`(逻辑上和旧版"点敌人直接判断是否结束回合"完全一致,只是往后挪了一步,靠玩家点确认触发) |
| `CancelAttackForecast()` | 函数,无参数 | 只隐藏面板,不做任何攻击相关的事,`SelectedUnit`/`PendingSkillIsElemental` 都不受影响,玩家可以重新点别的敌人或者重新考虑 |

### WBP_AttackForecast(`/Game/UI/WBP_AttackForecast.WBP_AttackForecast_C`,全新 Widget)
`ForecastBox`(VerticalBox,根)→ `Txt_AtkDmg`/`Txt_CounterDmg`(TextBlock,`bIsVariable=true`,运行时动态改文字)→ `Btn_Confirm`("确认攻击")/`Btn_Cancel`("取消")(Button,`bIsVariable=true`,各挂一个静态 `TextBlock` 标签)。两个公开函数 `SetAtkForecast(Msg: String)`/`SetCounterForecast(Msg: String)` 内部各自把字符串转 `Text`(`Utilities|Text|ToText(String)`)后 `SetText` 到对应 TextBlock——和 `WBP_HealthBar.SetHealthPercent` 一样走"外部主动 Push"模式,不用属性 Binding。`EventGraph` 两个 `OnClicked` 事件分别调 `TurnManager.ConfirmAttack()`/`CancelAttackForecast()`。

### 已知简化 / 待人工 Play 验收
1. 预测面板的伤害数字是"假设命中"的确定值,不会因为随机数而在面板上跳动——这是刻意对齐网页版效果(网页版 `showForecast` 同样是 dry-run,不掷骰子),真正的随机结果要点"确认攻击"之后才在 `Output Log`(`HIT dmg=`/`MISS`/`COUNTER dmg=`)和 HP 变化里体现。
2. **自动回归测试新增了一点点不确定性**:`ComputeSkillDamage` 现在会真的掷骰子,`RunRegressionTests` 的 T5/T6a 大约有 5% 概率因为 MISS 假性 FAIL(重跑即可,不是回归),见 `UE节点备忘录.md` 对应记录。
3. **待验收**:①点敌方是否正确弹出预测面板而不是直接攻击;②面板上的"预计伤害"数字是否和实际点确认后的 `Output Log` 数量级吻合(允许因为随机数不同而不完全相等,但克制/反克制的倍率关系应该能从数字大小差异看出来);③防御方在射程内时是否显示"预计反击"信息,超出射程时是否显示"无反击";④点"确认攻击"后是否正常结算(含反击),点"取消"后是否能重新选择/不影响后续操作;⑤敌方 AI 攻击玩家单位时,玩家单位是否会自动反击(不需要任何 UI 交互,`TryAttack` 内部自动处理)。

---

## WBP_ActionMenu (`/Game/UI/WBP_ActionMenu.WBP_ActionMenu_C`,2026-08-16 新增;同日追加第 4 个按钮见下)

> 移动后弹出的操作菜单。项目里第一个带**交互按钮**的 Widget(之前的 `WBP_OrderBar`/`WBP_HealthBar`/`WBP_GameOver` 都是纯展示,没有需要接收点击的控件)。

### 结构
`MenuBox`(VerticalBox,根)→ 4 个 `Button`(`Btn_Attack`/`Btn_Skill2`/`Btn_Standby`/`Btn_Undo`,均 `bIsVariable=true`,用于绑定 `OnClicked`)→ 每个 Button 各挂一个子 `TextBlock`(`Txt_Attack`="普通攻击"〔2026-08-16 由"攻击"改名〕/`Txt_Skill2`="元素技能"〔2026-08-16 新增〕/`Txt_Standby`="待命"/`Txt_Undo`="撤销",纯设计时默认文字,`bIsVariable=false`,不需要运行时改,直接绕开了 `bIsVariable`/`ConstructObjectfromClass` 那一整套坑)。`Btn_Skill2` 用 `UMGToolSet.AddWidget(childIndex=1)` 插在 `Btn_Attack` 和 `Btn_Standby` 之间。

### 事件(EventGraph,`UMGToolSet.BindToEventProperty` 自动生成的 `ComponentBoundEvent` 节点,逐个手工接了后续逻辑)
- `OnClicked(Btn_Attack)`(2026-08-16 改写,原来是 `HideActionMenu`):`GetAllActorsOfClass(BP_TurnManager)[0]` → `TurnManager.SelectSkillAndAttack(bElemental=false)`
- `OnClicked(Btn_Skill2)`(2026-08-16 新增):`GetAllActorsOfClass(BP_TurnManager)[0]` → `TurnManager.SelectSkillAndAttack(bElemental=true)`
- `OnClicked(Btn_Standby)`:`GetAllActorsOfClass(BP_TurnManager)[0]` → `TurnManager.StandbyAction()`
- `OnClicked(Btn_Undo)`:`GetAllActorsOfClass(BP_TurnManager)[0]` → `TurnManager.UndoAction()`

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

### RunRegressionTests 覆盖的断言(当前 9 条)

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

⚠ T7a/b/c 测的是**直接调用 `RunEnemyTurn`**,刻意绕开了 `BP_TurnManager.StartTurn` 这个真正的游戏内入口——这也是为什么 `StartTurn` 那个"整条 exec 链路从 `FunctionEntry` 起就断流"的 bug(见上面 `BP_TurnManager.StartTurn` 一节)完全没被这三条断言捕捉到。目前还没有一条断言覆盖"`StartTurn` 本身的分支是否真的可达",这类"入口函数的 exec 链路是否连通"目前只能靠 `get_node_infos` 人工核对,是这套回归测试机制现在的一个已知盲区。

测试自带清理:结束前会 `ClearHighlights` + `DestroyActor` 掉两个临时生成的测试单位,不会污染同一 PIE 会话里后续的人工测试。

### 以后怎么扩展

**改完任何 GridManager/Unit/Tile 的逻辑,尤其是修 bug 之后,顺手在 `RunRegressionTests` 里加一条对应断言**,复用 `Assert(Condition, TestName)` 这个内部函数(PASS/FAIL 都走 `PrintString`,可以直接在 Output Log 里 grep)。新增断言时:
- 如果要调用自身(GridManager)的其他函数,DSL 里**必须显式传 `self` 作为第一个参数**(哪怕是自己调自己),比如 `(CallFunction|IsTileOccupied self colA rowA)`——这类自定义 Function 节点即使自调用也会暴露一个 `self` pin,不传会报 "Could not connect pin X to self"。
- 需要新增的临时测试对象记得在断言完之后 `DestroyActor` 清理掉。
- **⚠ 已知坑,别踩第二次**:`(Utilities|IsValid X)` 嵌在 `Assert` 这类普通函数调用的参数位置里(纯表达式写法)不可靠——本轮实测会导致执行流程"静默卡住"(编译通过、不报运行时错误,但 `RunRegressionTests` 跑到那一句之后,后面所有语句,包括结尾的 `REGRESSION_TESTS_DONE`,全部不再执行,Output Log 里也不留任何报错痕迹,非常难排查)。**正确写法是把 `IsValid` 当 `if` 的条件单独起一整条语句**,像 `TryAttack` 里的用法一样:`(if (Utilities|IsValid X) (真分支...) (else (假分支...)))`,不要嵌到别的函数调用参数里。
