# UE 切片测试用例(验收清单)

> 每次改动后,把相关用例跑一遍,汇报 PASS/FAIL(一行就行,不用截图除非 FAIL)。全绿才能把对应任务标完成。
>
> **2026-08-15 起,这份清单只覆盖"需要人工点鼠标看视觉/交互表现"的用例。纯逻辑断言(比如某个 Function 在给定输入下算出的值对不对)优先写进 `BP_GridManager.RunRegressionTests`,跑法和当前覆盖的断言列表见 `UE蓝图状态.md` 末尾"自动回归测试"一节。** 两者互补:自动回归测试几秒内出结果、适合每次改动后马上跑;这份清单适合验证"看起来对不对""点起来顺不顺手"这类自动测试测不出来的东西。

## 移动
- [x] 点我方单位(不移动)→ 移动范围内格子高亮
- [x] 点高亮格子 → 单位移动过去,Z 轴不下沉,范围清除
- [ ] 点非高亮格子 → 不应该移动(待重新验证,状态机重构后再测)
- [x] 移动目标格若有其他单位占用 → 不应该能选中(2026-08-15 已在 `ShowRange` 加 `IsTileOccupied` 占位检查,MCP 直接图编辑完成、编译通过,人工 Play 实测确认重叠格子不再高亮)

## 回合
- [x] N 键 → CurrentIndex 按生成顺序(我我敌敌)循环推进,当前单位高亮切换
- [x] 循环到末尾后 wraparound 回到第一个单位

## 攻击(Step5,进行中)
- [x] 点我方(不移动)→ 点相邻敌方 → 攻击链路执行(早期 Print 验证时数值 -30,是因为 HP 默认值当时未设,链路本身通;Class Defaults 补上后见下一条)
- [x] HP/Atk/Def/MaxHP 的 Class Defaults 数值已设置为合理测试值(2026-08-15 核实:HP=MaxHP=20,Atk=10,Def=5,Spd=6,MoveRange=5,AtkRange=2)
- [ ] 攻击后 HP 按 `max(0, Atk-Def)` 正确变化(占位公式版)
- [ ] 换成真实公式 `max(1, round(Atk×9/(9+Def)))` 后数值正确
- [x] 超出 AtkRange 的敌方点击 → 无效果(根因是 SpawnUnit/BP_Tile 移动都没写逻辑坐标 Col/Row,修复后实测通过)
- [x] HP≤0 → 单位从场上移除(DestroyActor)——修复了 Target 未接 Defender、误伤 GridManager 自己的 bug 后确认正常
- [ ] 移动和攻击两个模式不会互相干扰(重新设计后测试)

## 待补(第6/7步)
- [x] 血条 UI 跟随 HP 变化(2026-08-15 完整实现并人工 Play 验收通过:`WBP_HealthBar` + `BP_Unit.HealthBarComponent`/`UpdateHealthBar`,`Setup` 时初始化满血、`TryAttack` 扣血后调用更新。过程中修了两个真实 bug——①Transform 类型 pin 不支持字符串默认值导致血条位置一直是 (0,0,0)、旋转也没面向固定相机,看起来是一条细线;②HP/MaxHP 整数相除截断成 0,导致随便掉一滴血就整条全红。两个都已修复,`RunRegressionTests` T5/T6a/T6b 三条断言覆盖。)
- [x] 一方全灭 → 胜负弹窗(2026-08-15 已实现并修过一个真实 bug、人工 Play 验收通过:`BP_GridManager.CheckVictoryCondition` 挂在 `TryAttack` 的死亡分支后面,全屏半透明遮罩 + 居中大字 "VICTORY"/"DEFEAT"(先用英文占位,没确认项目字体支不支持中文)。**中途踩过坑**:最初设计是一个共享 Widget 运行时 `SetText`,结果 `ConstructObjectfromClass` 造的实例控件树绑定没初始化,文字死活显示不出来(只看到灰色遮罩),报 `Accessed None`——已改成 `WBP_GameOver`(胜利)/`WBP_GameOverDefeat`(失败)两个独立 Widget,文字颜色全烤在设计时默认值里,不再运行时碰这个绑定,已用 MCP 直接读取 PIE 里的活对象确认文字("VICTORY")和颜色(绿色)都正确显示。详见 `UE节点备忘录.md`。**触发路径本身(拖到一方全灭)没做自动化验证**——把一方场上所有单位都打死太容易误伤正常游玩用的初始单位,风险大于收益,所以没往 `RunRegressionTests` 里加。**待人工 Play 实测**:①连续攻击同一个敌方单位到死(占位公式 `max(0,Atk-Def)`,Atk=10 Def=5,20血打4刀死)看死亡瞬间会不会弹出带文字的 "DEFEAT"/"VICTORY"(不再只是灰屏);②确认弹窗只弹一次,不会每死一个多余的单位就重复弹。)
- [ ] 敌方 AI 自动移动+攻击(2026-08-15 自动化逻辑已完成:`FindNearestUnit0`/`MoveUnitTowardTarget`/`RunEnemyTurn` 三个函数本身由 `RunRegressionTests` 的 T7a/T7b/T7c 三条断言覆盖并全部 PASS。**过程中修了两个真实 bug**:①三个函数最初都用 `write_graph_dsl` 写的 `Utilities|IsValid` 判断,全部编译通过但静默断流/返回默认值,改成哨兵值/局部 bool 标记规避;②这三个函数以及 `RunRegressionTests` 反复用 `write_graph_dsl` 重写导致孤立节点堆积并被错误复用,改用 `remove_function_graph`+`add_function_graph` 清空重建解决,细节见 `UE节点备忘录.md`。**另外顺带发现并修复了一个更严重的问题**:`BP_TurnManager.StartTurn`(真正的游戏内入口,靠手工 `create_node`/`connect_pins` 拼图加的死亡跳过+AI分支逻辑)有一段接线是彻底断流的死路——不只是敌方 AI 调不到,连我方"点单位→`ShowRange`高亮"和`EndTurn`推进回合都会一起失效,只是没被 T7a/b/c 发现(那三条测试绕开 `StartTurn` 直接测 `RunEnemyTurn`)。已用 `get_node_infos` 核实并修好,重跑全部 9 条回归断言确认无连带破坏。**待人工 Play 验收**:按 N 键连续推进回合,确认①我方单位轮到时依旧能正常点鼠标选格子(验证上面这个断流 bug 真的修好了、没有回归);②敌方单位轮到时无需任何操作,自动朝最近的我方单位移动、进入攻击范围就自动打一下,然后自动 `EndTurn` 轮到下一个;③连续多个敌方单位相邻时能不能一路自动跑完不卡住。)
