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
| MaxHP | Integer | 未知 | |
| HP | Integer | 7E7CE5CF43871663225F4B9260614168 | ⚠ Class Defaults 当前值未确认,测试打出 -30 疑似默认 0 |
| Atk | Integer | 5630A3C3448BD43A03C96DA37CDA3333 | |
| Def | Integer | 1B57114147085BA71CDBC081B6E015F3 | |
| Spd | Integer | 未知 | |
| AtkType | Integer | 未知 | 占位,未接入属性克制表 |
| EnemyMat | Material | - | |
| AtkRange | Integer | 未知 | 默认 1,**已建但逻辑还没接入判断** |

### 函数
- **Setup(bAlly: Bool)**:`Set Side = bAlly` → Branch(Side) → False 分支 `Mesh.SetMaterial(0, M_Enemy)`

### EventGraph
- BeginPlay / ActorBeginOverlap / Tick:模板残留,**Disabled,不用管**
- **ActorOnClicked**(核心逻辑,已重构):
  ```
  Event → Branch(Side)
    True(点我方) → GetAllActorsOfClass(GridManager)[0] → ShowRange(Unit=self)
    False(点敌方) → GetAllActorsOfClass(GridManager)[0] → TryAttack(Defender=self)   [调用 GridManager 的独立 Function]
  ```
  旧的内联攻击链(GetSelectedUnit/Atk/Def/HP 一堆节点堆在这里)已删除,逻辑整体搬进了 `BP_GridManager.TryAttack`。

### 已知问题(更新于本轮 TryAttack 重构后)
1. ~~HP 无下限~~ ✅ 已解决:`TryAttack` 内部用 `Max(HP-伤害, 0)` clamp,且 `newHP≤0 → K2_DestroyActor(Defender)`。
2. ~~AtkRange 没接入判断~~ ✅ 已解决:`TryAttack` 用曼哈顿距离 `LessEqual(distance, SelectedUnit.AtkRange)` 判断,超出范围无效果。**实测验证通过**——过程中发现并修复了两个更深层的坑,见问题8。
3. **移动/攻击状态未分离** —— `BP_Tile.ActorOnClicked` 的移动逻辑和这里的攻击逻辑共用同一个 `GridManager.SelectedUnit`,没有明确的"移动模式 vs 攻击模式"状态机,存在误触风险。仍未解决,需要重新设计。
4. **HP/Atk/Def 等 Class Defaults 具体数值未核实** —— 需要打开 BP_Unit → Class Defaults 面板确认。
5. 伤害公式仍是占位版 `max(0, Atk-Def)`(用户明确认可"可以无伤,合理"),要换成真实 `max(1, round(Atk×DEF_K/(DEF_K+Def)))`,DEF_K=9(已从 config.js 核实)——留作后续步骤。
6. `BP_Unit` 里 `Col`/`Row` 的 MemberGuid 已在本轮确认:Col=`EC5111B2499BDFC8487A6CB7A0531A60`,Row=`989E623C43F9417073E99FA096C78C35`(此前"未知"已更新,见上方变量表)。
7. ~~`K2_DestroyActor` 的 Target 没接 `Defender`~~ ✅ 已修复:曾经因为这条手动线漏接,导致死亡分支触发时销毁的是 `GridManager` 自己(而不是被打死的敌方单位),表现为攻击几次后地图彻底失效(`GetAllActorsOfClass(BP_GridManager)` 返回空数组)。现已手动补上 `Defender → Destroy.Target` 的连线,验证正常。**这是本轮 TryAttack 手动连线清单里最容易漏、后果最严重的一条,以后生成同类 Function 时要在交付清单里特别提醒检查。**
8. ~~攻击距离判断形同虚设(Dist 恒为 0 或恒为固定值)~~ ✅ 已修复,根因是**逻辑坐标 Col/Row 从未真正被写入过**,分两处:
   - `SpawnUnit`(GridManager):只把新单位摆到了正确的世界坐标(`SetActorTransform`/`SpawnActorFromClass` 的 Location),从没 `Set Col`/`Set Row`——生成的单位逻辑坐标永远是默认值 0。已修复:生成后从对应 `BP_Tile` 读 `Col`/`Row` 写回新单位。
   - `BP_Tile.ActorOnClicked`:移动逻辑只做了 `SetActorLocation`(挪世界坐标)+ `ClearHighlights`,文档里记的"更新 SelectedUnit.Col/Row"这一步实际上从没实现过。已修复:`ClearHighlights` 之后补上从本格读 `Col`/`Row` 写入 `SelectedUnit` 的两个 `Set` 节点。
   - **教训(已写入节点备忘录)**:视觉位置(世界坐标)和逻辑位置(Col/Row 整数变量)是两套独立数据,挪动/生成 Actor 只会同步视觉位置,逻辑坐标必须显式手动同步,UE 不会自动帮你对齐。

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

### 函数
- **ClearHighlights**(GUID `0F31C30A44B85167E0CE73A25A1D95FC`):For Each Tiles → `SetHighlight(False)`
- **ShowRange(Unit: BP_Unit)**(GUID `365A39F74D91FB2F1BEFE78294302FF7`):ClearHighlights → `Set SelectedUnit=Unit` → For Each Tiles → 曼哈顿距离 ≤ `Unit.MoveRange` 且 ≠0 → `SetHighlight(True)`(⚠不查占位、不是BFS,已知简化)
- **SpawnUnit(TileIndex: Int, bAlly: Bool)**:`Tiles[TileIndex]` → 取该 Tile 的世界坐标 `+ (0,0,50)` → `SpawnActorFromClass(BP_Unit)` → `Setup(bAlly)` → **`Set Col`/`Set Row`(本轮新增,读 `Tiles[TileIndex]` 自己的 Col/Row 写回新单位)**。修复前只摆了世界坐标,没写逻辑坐标,导致新单位 Col/Row 恒为默认值0。
- **TryAttack(Defender: BP_Unit)**(本轮新建,已编译通过):
  ```
  Get SelectedUnit(self) → IsValid? →True→
    曼哈顿距离(SelectedUnit.Col/Row vs Defender.Col/Row, 用 Max(x,-x) 组合出 Abs)
    → LessEqual(distance, SelectedUnit.AtkRange) →True→
      伤害 = Max(SelectedUnit.Atk - Defender.Def, 0)          [占位公式]
      新HP = Max(Defender.HP - 伤害, 0)
      Set Defender.HP = 新HP
      → LessEqual(新HP, 0) →True→ K2_DestroyActor(Defender)
      → (两分支汇合) → ClearHighlights(self) → Set SelectedUnit=None
  ```
  非 self 变量(Defender 的 Col/Row/Def/HP)全部走 `MemberParent + SelfContextInfo=NotSelfContext` 三件套,详见 `UE节点备忘录.md`。

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

### EventGraph
- ActorOnClicked → Branch(self.Highlighted) → True:`GetAllActorsOfClass(GridManager)[0]` → `Get SelectedUnit` → `Set Actor Location`(SelectedUnit,本格世界坐标 + Z50)→ `ClearHighlights` → **`Set SelectedUnit.Col`/`Set SelectedUnit.Row`(本轮新增,读本格 self.Col/self.Row 写回 SelectedUnit)** → (链路到此结束)
  - False(未高亮):不执行任何逻辑,符合"点非高亮格子不应移动"的预期。
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

### 函数
- **StartTurn**(GUID `B1B2BD0C4A80D0C6355B6A862565F459`):取 `TurnOrder[CurrentIndex]` → `Grid.ShowRange(Unit=该单位)`
- **EndTurn**:`CurrentIndex = (CurrentIndex+1) % TurnOrder.Length` → `StartTurn`

### EventGraph
- BeginPlay → Delay(0.2s)→ `GetAllActorsOfClass(BP_Unit)` → `Set TurnOrder` → `GetAllActorsOfClass(BP_GridManager)[0]` → `Set Grid` → `StartTurn`
- 行动序目前是**生成顺序**(我我敌敌),不是真 Spd 排序,已知简化,待补 Sort。

---

## BP_TacticsController

- `InputKey(N)` → `GetAllActorsOfClass(BP_TurnManager)[0]` → `EndTurn`
