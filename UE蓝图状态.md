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
  - **v3(当前版本,2026-08-16 第三次修复,改了语义)**:用户明确反馈"红色高亮应该是移动范围的最外围,也就是最远能打哪里,而不是当下位置的攻击范围"——v2 的半径只算 `Unit` **当前站的格子**能打多远,没考虑"先移动再攻击"这个战术意图。改成半径 `1..(Unit.MoveRange + Unit.AtkRange)`(仍然以 `Unit` 当前 Col/Row 为圆心算曼哈顿距离,只是上限从 `AtkRange` 换成 `MoveRange+AtkRange`),代表"移动到射程边缘后最远能打到的格子"。**已知简化**:红圈仍然是从当前位置算的固定半径圆,不是"先精确算可达移动格集合、再对每个可达格子分别画攻击范围再取并集"的精确战术威胁区(那样需要真实寻路,当前移动本身就是曼哈顿距离占位、不绕障碍物,见 `ShowRange` 已知简化),半径相加是这套简化寻路下的等价近似。改动仅涉及"半径怎么算"这一处比较条件,`ManhattanDistance` 调用和其它逻辑都没动;实现细节(踩过的孤立节点识别坑)见 `UE节点备忘录.md` 坑11。**已知简化(v2 遗留,v3 未变)**:调用顺序是先 `ShowRange`(黄)后 `ShowAttackRange`(红),如果某格子同时落在移动范围和攻击范围内,会被红色覆盖(材质槽只有一个,后调用的赢),目前没有做双色叠加或优先级区分——v3 半径变大后,移动范围内的格子基本必然也落在新的攻击范围内,所以移动范围的黄色高亮实际上**几乎全部会被红色盖掉**,这是本次改动的直接副作用,和用户"红色=最远能打哪里"的描述一致(红色本就该覆盖到比黄色更大的范围),不算 bug,但人工 Play 验收时会看到"点自己之后几乎看不到黄色、大片都是红色",属于预期表现,不要误判成回归。
  - 由 `BP_TurnManager.StartTurn` 和 `BP_Unit.ActorOnClicked`(点自己单位重新选中时)两处调用,`ShowRange` 之后紧接着调用,`ClearHighlights` 已同步扩展会同时清 `AtkHighlighted`。⚠ 建 Col/Row 相关的跨对象取值节点踩过坑:`Class|BPTile|GetCol`/`Class|GridSlot|GetRow` 这类"类名写错"的别名(历史遗留、`read_graph_dsl` 解码出来的)不能直接抄去用在 `BP_Unit` 引用上,必须显式写 `Class|BPUnit|GetCol`/`Class|BPUnit|GetRow`(类名和实际目标类一致)才能通过 `write_graph_dsl` 正确建出节点,细节记进了 `UE节点备忘录.md`。
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
- ActorOnClicked → Branch(self.Highlighted) → True:`GetAllActorsOfClass(GridManager)[0]` → `Get SelectedUnit` → `Set Actor Location`(SelectedUnit,本格世界坐标 + Z50)→ **`Set SelectedUnit.bHasMoved = true`(2026-08-16 新增,`Class|BPUnit|SetHasMoved`,MCP `create_node`/`connect_pins` 增量插入在 `SetActorLocation.then` 和原来的 `ClearHighlights` 之间)** → `ClearHighlights` → **`Set SelectedUnit.Col`/`Set SelectedUnit.Row`(本轮新增,读本格 self.Col/self.Row 写回 SelectedUnit)** → (链路到此结束)
  - False(未高亮):不执行任何逻辑,符合"点非高亮格子不应移动"的预期。
  - **2026-08-16 新增 `bHasMoved` 置位**:配合 `BP_Unit.bHasMoved`/`BP_TurnManager.StartTurn` 的重置,修复"一回合能无限移动"的 bug,见 `UE蓝图状态.md` → `BP_Unit.ActorOnClicked` 词条和已知问题9。这里只负责"移动真的发生了"这一个事实的记录,不判断是否允许移动(允许与否的门槛在 `BP_Unit.ActorOnClicked` 里)。
  - ⚠ 修复前这里只有 `SetActorLocation + ClearHighlights`,完全没有更新逻辑坐标这一步(旧文档记录有误,实际从未实现),导致移动只改视觉位置、不改 Col/Row,是"攻击距离判断失效"的根本原因之一(另一处是 SpawnUnit,见 BP_Unit 已知问题8)。
  - ~~⚠ 已知遗留:链路末尾没有 `Set SelectedUnit = None`~~ ✅ **2026-08-13 已修复**:节点其实早就存在(`K2Node_ClearSU`,`|SetSelectedUnit`),但之前某轮编辑漏接了 `self`(Target,类型 `BP Grid Manager Object Reference`)引脚,导致蓝图**编译失败但没人发现**——直到本轮 MCP 会话触发重新编译才暴露(`load_level` 时引擎报 `EnsureFailed`,Play 时报 `Blueprint failed to compile: BP_Tile`,棋盘因此生不出来)。用 MCP `BlueprintTools`(`find_nodes`→`get_node_infos`→`connect_pins`→`compile_blueprint`)把 `self` 接到图里已有的 GridManager 引用(`K2Node_GetArrayItem_1` 输出,和旁边 `ClearHighlights` 用的是同一个)上,重新编译无报错,`save_assets` 落盘,`git diff` 确认改动(`BP_Tile.uasset` 111462→110054 字节)。**这是 `BlueprintTools` 图编辑路径第一次在真实内容上验证通过**,详见 `UE协作Harness规范.md` 0.1 节。
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
  - **`true`(我方)分支新增 `Set (该单位).bHasMoved = false`**(2026-08-16,MCP `create_node`/`connect_pins` 增量插入在 `Branch(Side).then` 和 `ShowRange` 之间,用 `read_graph_dsl`/`write_graph_dsl` 整函数重写失败——`bGameOver` getter 的可创建 type_id 三次尝试都不对,详见 `UE节点备忘录.md` 坑12,最后改用纯增量节点插入):每次轮到该单位时把"本回合是否已移动"清零,配合 `BP_Unit.ActorOnClicked` 的门槛检查和 `BP_Tile.ActorOnClicked` 的置位,修复"一回合能无限移动"的 bug。只在我方分支重置,敌方走 `RunEnemyTurn` 不受影响(敌方本来就不通过这套点击门槛移动)。
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
