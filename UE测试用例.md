# UE 切片测试用例(验收清单)

> 每次改动后,把相关用例跑一遍,汇报 PASS/FAIL(一行就行,不用截图除非 FAIL)。全绿才能把对应任务标完成。
>
> **2026-08-15 起,这份清单只覆盖"需要人工点鼠标看视觉/交互表现"的用例。纯逻辑断言(比如某个 Function 在给定输入下算出的值对不对)优先写进 `BP_GridManager.RunRegressionTests`,跑法和当前覆盖的断言列表见 `UE蓝图状态.md` 末尾"自动回归测试"一节。** 两者互补:自动回归测试几秒内出结果、适合每次改动后马上跑;这份清单适合验证"看起来对不对""点起来顺不顺手"这类自动测试测不出来的东西。

## 移动
- [x] 点我方单位(不移动)→ 移动范围内格子高亮
- [x] 点高亮格子 → 单位移动过去,Z 轴不下沉,范围清除
- [ ] 点非高亮格子 → 不应该移动(待重新验证,状态机重构后再测;2026-08-15 已部分收窄——只有轮到的单位能点出高亮,见下方"回合"一节,但"移动/攻击模式互斥"仍未做完整状态机)
- [x] 移动目标格若有其他单位占用 → 不应该能选中(2026-08-15 已在 `ShowRange` 加 `IsTileOccupied` 占位检查,MCP 直接图编辑完成、编译通过,人工 Play 实测确认重叠格子不再高亮)

## 回合(2026-08-15 大改:不再是"生成顺序 + N 键手动切",已重写为下面这套流程,见 `UE蓝图状态.md` `BP_TurnManager` 一节)
- [x] 行动顺序条 UI(`WBP_OrderBar`)在屏幕左上角正确显示,内容跟随 `RefreshOrder` 更新(2026-08-15 实测截图确认显示出占位数字;根因是 `AddToViewport` 必须放在 `BeginPlay` 而不是 `UserConstructionScript` 里才生效,踩坑细节见 `UE蓝图状态.md`/`UE节点备忘录.md`)
- [ ] `BuildTurnOrder` 真按 `Spd` 降序排序(不再是生成顺序),同速随机 tiebreak,每轮结束(`CurrentIndex` 超出数组长度)自动重排——待人工 Play 观察多轮顺序变化确认
- [ ] 只有 `TurnOrder[CurrentIndex]` 对应的我方单位能点出移动/攻击高亮,其余我方单位点击无效(逻辑已加在 `ActorOnClicked`,待人工 Play 确认体验符合预期)
- [ ] 攻击命中后自动 `EndTurn`;单纯移动(未命中攻击、或超出射程点了无效)不结束回合
- [ ] 敌方单位轮到时自动 `RunEnemyTurn` + `EndTurn`,连续多个敌方单位相邻时能一路自动跑完不卡住(2026-08-15 修复了 `StartTurn` 一段彻底断流的接线 bug,重跑全部回归断言确认无连带破坏,但这是"逻辑不断流"的自动化验证,"人工连续按流程走几轮观感顺不顺"仍待做)

## 攻击(Step5 ✅ 垂直切片已完成,伤害公式已换成真实版)
- [x] 点我方(不移动)→ 点相邻敌方 → 攻击链路执行(早期 Print 验证时数值 -30,是因为 HP 默认值当时未设,链路本身通;Class Defaults 补上后见下一条)
- [x] HP/Atk/Def/MaxHP 的 Class Defaults 数值已设置为合理测试值(2026-08-15 核实:HP=MaxHP=20,Atk=10,Def=5,Spd=6,MoveRange=5,AtkRange=2)
- [ ] 攻击范围红色高亮(`ShowAttackRange`)——点自己单位后屏幕上真的能看到一圈红格子(2026-08-15 自动回归测试 T8 只验证了 `AtkHighlighted` 布尔标记被正确置位,"视觉上真的渲染出红色"这一步仍需要人工在编辑器里 Play 验收——MCP 工具集目前没有 3D 视口鼠标点选能力,`SlateInspectorToolset.Click` 只能点 Slate UI 控件,不支持按世界坐标点选 actor)
- [ ] 攻击后 HP 按新公式 `max(1, round(Atk×9/(9+Def)))` 正确变化,不再是占位版 `max(0,Atk-Def)`(2026-08-15 已切换实现,自动回归测试 T5 只确认"HP 确实下降"这一件事,没有断言具体数值;按 Atk=10/Def=5 手算应扣 6 血,这个数值本身还没有专门的自动断言或人工 Play 逐帧核对过,建议下次顺手验一下)
- [x] 超出 AtkRange 的敌方点击 → 无效果(根因是 SpawnUnit/BP_Tile 移动都没写逻辑坐标 Col/Row,修复后实测通过)
- [x] HP≤0 → 单位从场上移除(DestroyActor)——修复了 Target 未接 Defender、误伤 GridManager 自己的 bug 后确认正常
- [ ] 移动和攻击两个模式不会互相干扰(2026-08-15 部分收窄:加了"只有轮到的单位能点"门槛,减少了跨单位误触,但同一个我方单位自己回合内"点自己看范围"和"点敌方触发攻击"之间仍没有明确的状态机,完整的重新设计仍未做)

## 待补(第6/7步)
- [x] 血条 UI 跟随 HP 变化(2026-08-15 完整实现并人工 Play 验收通过:`WBP_HealthBar` + `BP_Unit.HealthBarComponent`/`UpdateHealthBar`,`Setup` 时初始化满血、`TryAttack` 扣血后调用更新。过程中修了两个真实 bug——①Transform 类型 pin 不支持字符串默认值导致血条位置一直是 (0,0,0)、旋转也没面向固定相机,看起来是一条细线;②HP/MaxHP 整数相除截断成 0,导致随便掉一滴血就整条全红。两个都已修复,`RunRegressionTests` T5/T6a/T6b 三条断言覆盖。)
- [x] 一方全灭 → 胜负弹窗(2026-08-15 已实现并修过一个真实 bug、人工 Play 验收通过:`BP_GridManager.CheckVictoryCondition` 挂在 `TryAttack` 的死亡分支后面,全屏半透明遮罩 + 居中大字 "VICTORY"/"DEFEAT"(先用英文占位,没确认项目字体支不支持中文)。**中途踩过坑**:最初设计是一个共享 Widget 运行时 `SetText`,结果 `ConstructObjectfromClass` 造的实例控件树绑定没初始化,文字死活显示不出来(只看到灰色遮罩),报 `Accessed None`——已改成 `WBP_GameOver`(胜利)/`WBP_GameOverDefeat`(失败)两个独立 Widget,文字颜色全烤在设计时默认值里,不再运行时碰这个绑定,已用 MCP 直接读取 PIE 里的活对象确认文字("VICTORY")和颜色(绿色)都正确显示。详见 `UE节点备忘录.md`。人工 Play 已确认:连续攻击同一个敌方单位到死会正确弹出带文字的 "DEFEAT"/"VICTORY",且只弹一次不会重复弹。2026-08-15 又追加了 `bGameOver` 门槛,防止一方全灭后 `StartTurn` 继续推进导致 `Accessed None` 级联报错,见 `UE蓝图状态.md`。)
- [ ] 敌方 AI 自动移动+攻击(2026-08-15 自动化逻辑已完成:`FindNearestUnit0`/`MoveUnitTowardTarget`/`RunEnemyTurn` 三个函数本身由 `RunRegressionTests` 的 T7a/T7b/T7c 三条断言覆盖并全部 PASS。**过程中修了两个真实 bug**:①三个函数最初都用 `write_graph_dsl` 写的 `Utilities|IsValid` 判断,全部编译通过但静默断流/返回默认值,改成哨兵值/局部 bool 标记规避;②这三个函数以及 `RunRegressionTests` 反复用 `write_graph_dsl` 重写导致孤立节点堆积并被错误复用,改用 `remove_function_graph`+`add_function_graph` 清空重建解决,细节见 `UE节点备忘录.md`。**另外顺带发现并修复了一个更严重的问题**:`BP_TurnManager.StartTurn`(真正的游戏内入口,靠手工 `create_node`/`connect_pins` 拼图加的死亡跳过+AI分支逻辑)有一段接线是彻底断流的死路——不只是敌方 AI 调不到,连我方"点单位→`ShowRange`高亮"和`EndTurn`推进回合都会一起失效,只是没被 T7a/b/c 发现(那三条测试绕开 `StartTurn` 直接测 `RunEnemyTurn`)。已用 `get_node_infos` 核实并修好,重跑全部回归断言确认无连带破坏。**待人工 Play 验收**:按流程连续推进回合,确认①我方单位轮到时依旧能正常点鼠标选格子(验证上面这个断流 bug 真的修好了、没有回归,且新加的"只有轮到的单位能点"门槛没有误伤);②敌方单位轮到时无需任何操作,自动朝最近的我方单位移动、进入攻击范围就自动打一下,然后自动 `EndTurn` 轮到下一个;③连续多个敌方单位相邻时能不能一路自动跑完不卡住;④行动顺序条 UI 在敌方回合推进时是否也跟着正确刷新高亮。)
