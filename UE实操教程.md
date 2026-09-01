# 纹兽战记 → UE5 实操教程(垂直切片:到"一场能打的战斗")

> 目标里程碑:在 UE 里跑通**一场 2v2 能分胜负的战斗**。全程蓝图、2.5D 固定相机。
> 逻辑/数值/克制表都从 web 版 `js/data/*` 带走,只重写代码。

---

## 📍 续接区(开新对话先看这里)

> ⚠️ 这一节是**纯追加**的,越往下越旧。**只看下面这个「最新状态」块就够了**,再往下是历史记录,排查时才需要。

---

### 🔴 最新状态(2026-09-01)——下次开工从这里开始

**怎么续**:新会话说「继续UE」即可。必读已经从 542KB 降到 ~130KB(见 `CLAUDE.md` 第 1 条),不用再通读那两份大文档。

**第一件事:确认 MCP 连上了。** 上一轮全程连不上(`ConnectionRefused`),UE 侧一件事都没能做。
- 注意:**端口通 ≠ 能用**。上轮中途 8001 端口已经通了(编辑器启动了),但 MCP 客户端是在会话启动时连接的,**会话中途不会重连**——必须先开编辑器、再开新会话,顺序反了就得重启会话。
- 开工前先 `ToolSearch` 找 `mcp__unreal-mcp__*`,找不到就是没连上,别硬做。

**待办队列(全部需要 UE 编辑器,按建议顺序):**

| # | 事项 | 说明 |
|---|---|---|
| 1 | 🩹 **止血:摘掉预测面板的暴击显示** | `RefreshAttackForecast` 暂时别拼"暴击Z%"。**几分钟的事,优先做**——现在面板会告诉玩家"暴击15%"但结算永远不暴击,是在对玩家撒谎。详见 `UE规则对齐表.md` 第一节 #1 |
| 2 | 🔧 **删 `IMC_TacticsControl` 里失效的 `IA_Attack`/`IA_EndTurn` 映射** | E 键定时炸弹:legacy E 绑的是攻击,Enhanced Input 里 E 注册给了 `IA_EndTurn`,哪天 Enhanced Input 修好了 E 会同时触发两件事。删掉映射即可拆弹 |
| 3 | 🐞 **AOE 反击抑制** | UE 的 AOE 会让每个目标各反击一次,web 一次都不引。修法(含**不用改函数签名**的低风险方案)见 `UE规则对齐表.md` 第一节 #2 |
| 4 | 🧹 **诊断 `PrintString` 挂 `bDebugVerbose` 开关** | `OnAimPressed` 3 条 + `AttemptSkillAttack` 5 条,都写着"验收后删"然后都没删,`bPrintToScreen=true` 会糊玩家屏幕 |
| 5 | 🏗️ **收敛 `BP_Unit.EventTick` 的 5 份重复逻辑** | UE 侧最大的结构债:同一段逻辑复制了 5 份(上次加瞄准态门槛要插 10 个 Branch),还混着两段确认的死代码。**工具现在有了**:`ue/tools/paste_gen.py`(带连线完整性校验,已修好 Windows 崩溃) |
| 6 | 🧪 **修回归测试** | T7b/T7c 长期 FAIL 被容忍;测试地图 4 个单位全是 `side=true`(场上没敌人,涉敌行为测不到);随机命中率导致假阳性要定种子 |
| 7 | 📊 **`IsAoeSkill` 改读表**(web 侧已备好) | CSV 现在有 `Kind` 列了。UE 侧还剩三步:C++ `FSkillRow` 加 `Kind` 字段 → 编辑器里重新导入 `DT_Skills` → `IsAoeSkill` 从硬编码四个字符串改成读 `Kind == "aoe"`。做完之后加 AOE 技能就不用再动蓝图。详见 `UE规则对齐表.md` 第四节 |

**上一轮(2026-09-01)已完成、不用重做:**
- 新增 `UE规则对齐表.md` —— 改战斗规则前必查。核实时发现了上面第 1 条那个暴击 bug。
- 拆分 harness 文档 —— 新增 `UE硬规则.md`(31KB 必读);`UE节点备忘录.md`/`UE蓝图状态.md` 保留原名当档案(改名会断 114+79 处引用);hooks 的 `TARGET_NAMES` 已扩到 4 份。
- 修好 harness 指向不存在工具的引用(`ue-blueprint-paste-gen` skill 仓库里没有)→ 全部改指 `ue/tools/paste_gen.py`,并从遗留分支抢救该工具进 main。
- 坑86:cp1252 编码坑复发两次,规范里的适用范围已扩大。

**待用户决定(不做完不影响开工):**
- 暴击那条走"补齐结算"还是"先摘显示"(建议先摘,补齐另排期,因为会显著提高伤害方差需重验平衡)。
- 属性克制现在是关着的(`bUseTypeChartInSlice=false`),关的理由是"打开后 20 血会被秒"——这是数值问题不是机制问题,建议先提 HP 再打开,而不是一直关着。

---

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
- **2026-08-16 第四轮反馈,修复"点击时灵时不灵"**:用户报"移动有时候点一下有时候要双击"+"不能原地攻击"。排查确认同根同源——`ShowActionMenu`/`HideActionMenu` 每次弹菜单/关菜单都在 `GameAndUI`↔`GameOnly` 之间来回切换输入模式,UE 切换输入模式会重置 Viewport 焦点,连续切换时下一次点击不保证立刻生效,原地攻击(完全不走菜单)又特别容易撞上"上个单位操作后模式停在过渡态"这种情况。**修法**:删掉 `HideActionMenu` 里切回 `GameOnly` 的那一步,游戏从第一次弹菜单起永久留在 `GameAndUI`,不再有过渡态——`bEnableClickEvents` 驱动的 3D 点击在 `GameAndUI` 模式下本来就能正常工作,没必要切回去。附带修了一个次要 bug:原地攻击会读到上一个单位残留的"元素技能"选择,已在 `StartTurn` 里把 `PendingSkillIsElemental` 和 `bHasMoved` 一起清零。11 条自动回归断言重跑全 PASS。详见 `UE节点备忘录.md` 坑25。**待人工 Play 重新验收**:连续移动多个单位确认不再需要双击;原地攻击是否正常。
- **2026-08-16 验收通过,用户提出下一步:"每次攻击都会有被攻击者的反击,和火焰纹章一致。同时UI中加上预计本次攻击对对方的伤害、对自己的伤害等信息,类似网页版的效果"**。先用后台 Agent 调研网页版 `js/core/combat.js`/`js/ui/panels.js` 的反击条件(存活+距离<=自己AtkRange)和预测面板设计(dry-run 算法,不掷骰子,伤害/命中率/HP前后对比),对齐后实现:
  - **反击**:`BP_GridManager` 新增 `ResolveCounterAttack()`(反击永远用普通攻击,和网页版一致)+ `PreviewSkillDamage`/`GetSkillHitChance`(预览用,不掷骰子);`TryAttack` 在"防御方存活"分支插入反击判定,未命中的主攻击也会触发反击(火纹式设计)。敌方 AI 攻击玩家时玩家也会自动反击,不需要额外改 `RunEnemyTurn`。
  - **攻击预测 UI**:新增 `WBP_AttackForecast`(预计伤害/预计反击两行文字 + 确认/取消按钮),`BP_Unit` 点敌方分支改成先弹预测面板,点"确认攻击"才真正调 `TryAttack` 结算,"取消"则什么都不做。
  - **本轮踩到全场最危险的一个坑**:`ResolveCounterAttack` 第一版里,`ComputeSkillDamage`(带随机数)被 `write_graph_dsl` 悄悄复制成两次独立调用(应用到 HP 上的伤害 vs 打印出来的伤害可能对不上,两次独立掷骰子)——哪怕已经拆成完全独立的 `bind` 语句也照样复现,根源是"任何最终流向 Setter 值 pin 的非纯调用都可能被提前物化成一份独立副本"。用"Set 到局部变量再统一 Get"的快照模式修复。详见 `UE节点备忘录.md` 坑26,这是比之前任何一次都更隐蔽、后果更严重(游戏数值静默出错)的坑,以后但凡"非纯调用结果要喂给 Setter"一律无条件走快照模式,不再赌。
  - 另确认了 `create_node` 建跨蓝图函数调用必须用 `Class|<类名>|<函数名>` 前缀(坑22 的第三次复现,已确认是稳定规律)。
  - 11 条自动回归断言全 PASS(加入命中率后 T5/T6a 有 ~5% 概率因为 MISS 假性 FAIL,重跑即可,非回归)。**待人工 Play 验收**:预测面板显示、确认/取消流程、反击是否生效(含敌方攻击我方时的反击)、超出反击距离时面板显示"无反击",见 `UE测试用例.md`"反击 + 攻击预测"一节。
- **2026-08-16 遗物顶栏 + Debug 配装控制台**(接用户「类似 SLS 放最上方 + 自己配 Relic/技能」):C++ `UCombatLoadout` 早就写好,本轮补 UI 和接线。
  - 顶栏 `WBP_RelicBar`:全宽贴顶,显示当前遗物 `BarText`,右侧 **DBG** 开关控制台。没有遗物图标素材,先用文字条,不是 SLS 那种图标+悬停。
  - 控制台 `WBP_DebugLoadout`:靠右,遗物 CSV + 5 个技能 id,APPLY 重算、CLOSE 收起。~~空遗物 = 不装备(不再回退切片默认)~~ **08-17 已否决**:解析 0 件时恢复切片回退,见下方正确因果。开局仍用表里 `bEnabledInSlice`(前提是关卡实例 `bRelicFallbackToSlice=true`)。
  - `ApplyStartingRelics` 改走 `BuildRelicLoadout`,单位 `Atk/Def = BaseAtk/BaseDef + 加成`,APPLY 可以点多次不会叠。HP 不重置。
  - `SelectSkillAndAttack` 按 `Grid.SkillSlots` 查行名;槽空时仍回退 basic/heavy/ember/aqua/vine。**行动菜单按钮上的中文标签还是写死的**,换 id 只换效果不换字。
  - **待人工 Play**:顶栏是否出现;DBG 能否开关;APPLY 后顶栏文字和 Atk 是否跟着变;清空遗物再 APPLY,Atk 是否回到 10。
- **2026-08-16 伤害接线 + 沙盒自动配装**(用户反馈伤害仍不对,并要「自动配遗物和技能,类似沙盒」):
  - 公式本身没改:`ember` 1.4,`DEF_K=9`,克制关。Atk 10/Def 5 约 9;切片 5 遗物后 Atk 12 + 元素核心 1.15,火花约 **12**,HP 20 不应一招秒。
  - 真正的错在蓝图:`TryAttack`/`ResolveCounterAttack` 把带掷骰的 `ComputeSkillDamage` 算了两次(坑26),扣血和 `HIT dmg=` 可以不是同一个数;`ApplyStartingRelics` 的 Break 读的是 Build **之前**的空缓存,遗物加成等于没装。已改成射程内只算一次、写入 `AttackDmgTmp`/`CounterDmgTmp` 再扣血;Break 接到 `BuildRelicLoadout` 的返回值。
  - `UndoAction` 改回 `BP_Unit.StartLocation/StartCol/StartRow`(DSL 里看起来像 GridSlot 的 GetRow,节点 self 其实是 BP_Unit)。
  - 沙盒:控制台加了 **AUTO (slice)** / **RANDOM**。AUTO 填切片 5 遗物+默认 5 技能并 APPLY;RANDOM 从切片遗物预设和 5 个技能 id 里抽。APPLY/AUTO/RANDOM **会把全场 HP 回满**(否则改配装后旧血量会让人误判公式)。**没有**全表下拉、没有给敌方单独配装、诅咒遗物故意不进随机池。
  - **待人工 Play**:火花命中时 `HIT dmg=` 应等于 `SETTLE dmg=` 且约 12;AUTO 后顶栏是 5 件遗物、血条回满;撤销应回到开回合格子。
- **2026-08-16 伤害计算用户验收通过**(公式不再改)。同日用户截图 Debug 面板只有 AUTO/RANDOM/APPLY/CLOSE,看不到遗物/技能清单:
  - 根因:`EditableTextBox` 的 `minimumDesiredWidth=0` 且 `widgetStyle.backgroundImageNormal.imageSize={0,0}`,期望高度≈0,输入框被挤没;标题/提示也跟着看不见。
  - 已修:`Input_Relics`/`Input_S0..S4` 设宽 320 + Box 底;面板加 `ScrollBox_0`;`Txt_Catalog` 列出 **DT_Relics 24 条 + DT_Skills 31 条** id(`*`=切片默认,`!`=诅咒)。顺序:标题 → 提示 → 输入框 → 按钮 → 状态 → **id 列表**(列表在按钮下面,APPLY 不用先滚到底)。
  - **RANDOM 仍只抽切片池**,列表只是给人抄 id。手填 `arrogance`/`berserk_pact` 仍可能秒杀。
  - **2026-08-17 面板开着也看不见**:PIE 里 `bDebugPanelOpen=true`,控件 Visible,但右锚点把宽度收成 **8px**(点锚点的 `offsets.right` 是宽不是边距)。已改成屏幕正中 560×780 不透明面板。
  - **2026-08-17 配装面板**(用户要中文名 + 下拉 + 自己改,不要手填 id)。预设 **切片 / 重击流 / 元素流** 写死英文 id,不读控件。自定义走隐藏输入框 + 下拉。伤害公式未改。
  - **⚠ 中间误判(不要当现状用)**:曾把「开局 `(no relics)`」写成 C++ 没编、把「APPLY 后技能不变」只写成 `GetText` 空 / `RelicCsvToIdsB` prune / 只缺 `FillCombo`。这些都是排查过程,不是验收后的根因。正确因果见下一节,细节见 `UE节点备忘录.md` 坑35–37。
  - **2026-08-17 验收后的正确因果**(用户 Play 通过):
    1. **开局没遗物**:TestMap 里放置的 `BP_GridManager` 把 `bRelicFallbackToSlice` **实例覆盖成 false**(CDO 仍是 true)。空装备又不回退切片 → 顶栏空文案。已 `reset_properties` 并保存关卡。英文 `(no relics)` 只说明当时二进制仍是旧字符串,不是开局为空的原因。
    2. **APPLY 后遗物变 null、技能看起来没换**:`GetComboOption` 的 Return 节点没接 Exec,返回值一直是空串;DoApply 用空串覆盖 Construct 里写好的中文默认 CSV;再无条件 `SetbRelicFallbackToSlice false`。空技能槽回退开局 5 技能。已修:Return 补 Exec;空下拉不覆盖隐藏框;解析 0 件遗物时 fallback 设回 true。
    3. 防护层(有用但不是验收那一刀):运行时 `FillRelicCombo`/`FillSkillCombo`;`RelicCsvToIds`/`SkillTokenToId` 内联,不再调会被 prune 的 B。
    4. 自定义默认技能就是普通攻击/重击/火花/水枪/藤鞭,和开局相同;要换技能点 **重击流 / 元素流**,或下拉真有选中项再点「应用自定义」。APPLY 后不要 Keep Simulation Changes,否则 fallback false 会写回关卡。
- **2026-08-17 方向已定:战棋点击 → 第三人称直控(TPS 视角)迁移**。完整设计见 `C:\Users\AI_Work\.claude\plans\pokemon-tps-misty-walrus.md`(用户已选定"全套"版本:自由连续移动 + 瞄准发动 + 玩家可控相机)。核心思路是只换"操作输入层",不动战斗数值/回合序/属性克制/反击预测这套已跑通的逻辑层。分四阶段(A 操控与相机地基 / B 移动范围软边界 / C 瞄准锁定+攻击 / D 打磨),每阶段独立 Play 验证。**阶段 A 已完成并验收通过**(排查过程见下方 2026-08-17~08-20 各条,含坑40/41/42):
  1. `BP_Unit` 父类 Actor → Character:原有 `DefaultSceneRoot`+`StaticMesh` 完整保留(现在挂在 Character 原生 `CollisionCylinder` 根下面),新增 `SpringArm`(挂 Capsule,`targetArmLength=300`、`relativeLocation.z=100`、`bUsePawnControlRotation=true`、开摄像机碰撞+轻微位置/旋转 lag)+ `TPSCamera`(挂在 SpringArm 末端)。`CharMoveComp.maxWalkSpeed=500`,`bOrientRotationToMovement=true`(移动方向带动身体转向);`bUseControllerRotationYaw/Pitch/Roll` 全关(鼠标只转相机,不转身体)。
  2. 新建 `/Game/Input/` 下 5 个 Enhanced Input 资产:`IA_Move`(Axis2D)、`IA_Look`(Axis2D)、`IA_Attack`(Bool,阶段C才接线)、`IA_EndTurn`(Bool,阶段C才接线)、`IMC_TacticsControl`(映射:WASD→Move 用 Negate+SwizzleAxis(默认YXZ)拼 2D 向量,Move.X=前后/Move.Y=左右;Mouse2D→Look,只对 Y 分量加 Negate 修正俯仰,不碰偏航;LeftMouseButton→Attack、E→EndTurn 都挂 `InputTriggerPressed` 单次触发)。
  3. `BP_Unit.EventGraph` 新增 IA_Move/IA_Look 两条处理链(纯 `create_node`+`connect_pins` 手搭,没有动 `write_graph_dsl`):Move 用 `BreakVector2D`+`GetActorForwardVector`/`GetActorRightVector` 各调一次 `AddMovementInput`;Look 用 `BreakVector2D`+`AddControllerYawInput`(X)/`AddControllerPitchInput`(Y)。**原有** `EventBeginPlay`/`MouseInput|EventActorOnClicked`/`Collision|EventActorBeginOverlap`/`EventTick` 四个事件完全没动。
  4. `BP_TurnManager.StartTurn` 加了 Possess/UnPossess:函数最前面无条件 `GetPlayerController(0)` → `UnPossess` + `RemoveMappingContext(IMC_TacticsControl)`(哪怕没人被 possess 也是空操作,安全);原有 `Side==true` 分支尾部(`ShowAttackRange` 之后)追加 `Possess(该单位)` + `AddMappingContext(IMC_TacticsControl)`。敌方/无效单位分支完全没改,`RunEnemyTurn`/`EndTurn` 路径不受影响。这也是**唯一**碰了 EventGraph 之外的既有函数;用的是 `create_node`/`connect_pins`/`break_pins` 插入,没有整函数 `write_graph_dsl` 重写(见下方新坑)。
  5. **新坑,写进备忘录前先记这里**:`write_graph_dsl` 对 `BP_TurnManager.StartTurn` 里已有的 `(|GetbGameOver _grid)` 这类"无左侧类名的变量取值"简写,`read_graph_dsl` 能读出来,但 `write_graph_dsl` 原样传回去会报 `AssertionError: ... does not exist`——**读写不对称,不是我改坏的**,验证过連**未改动的原始脚本**回写都炸。以后碰到这类历史遗留 DSL(尤其带 `|GetXXX`/`|SetXXX` 裸写法的旧函数),一律改用 `create_node`+`connect_pins`/`break_pins` 做增量编辑,不要整函数 `write_graph_dsl` 重写,除非先小范围试过回写不报错。
  6. 棋盘四周的物理边界墙这轮**没加**——阶段 B 会用"离回合开始点的距离夹断"做移动范围软边界,比整块棋盘的硬边界更贴合玩法,阶段 A 暂不需要。
  7. 风险点,人工验收时留意:`BP_Unit` 换成 Character 后根组件从原来的 `DefaultSceneRoot` 变成 `CollisionCylinder`(胶囊体),现有的 `MouseInput|EventActorOnClicked` 鼠标点击流程(非当前操控单位仍用这套)理论上不受影响(点击命中判定走的是碰撞体,胶囊体只会让可点击范围变化,不会失效),但**没有实测确认过**,不要假设它一定还灵。
  - **待人工 Play 验收**:轮到己方单位时能否直接 WASD 移动、按住鼠标右键或移动鼠标能否转动相机看到角色转向;敌方单位和"未轮到"的己方单位是否仍然不可操控(Possess 没发生在它们身上);敌方 AI 回合和原有点击选人流程是否还正常。
- **2026-08-17 用户 Play 反馈"完全不行,动不了,鼠标没反应"**:用 MCP 直接连 PIE 实测状态排查(不是靠猜)——`get_properties` 读 `BP_TurnManager` 的 `CurrentIndex`/`TurnOrder` 确认轮到的确实是 Side=true 的己方单位;对比 `PlayerCameraManager` 和该单位的 `get_actor_transform`,两者差值正好等于 SpringArm 的 300/100 偏移,证明 `Possess`/`AddMappingContext` 真的执行了,不是接线断流。真正问题是**根因坑40**:项目从点击战棋时代起 `bShowMouseCursor` 就常驻 `true`(配合 `SetInputModeGameAndUI` 给 3D 点击/UMG 按钮用),鼠标常驻可见不捕获时 Enhanced Input 的 `Mouse2D` 基本收不到相对位移,视角转不动;WASD 理论上不受这个影响(键盘输入和鼠标捕获无关),完全无响应更可能是没点进 PIE 视口抢焦点(常见 UE 坑,新开 PIE 窗口要先点一下才会抢到键盘焦点)。**已修**:`StartTurn` 里 `Possess` 之后紧跟 `SetInputMode_GameOnly` + `SetShowMouseCursor(false)`;函数最前面统一 `UnPossess` 之后紧跟 `SetInputModeGameAndUI` + `SetShowMouseCursor(true)` 恢复点击模式(敌方回合/未来还要点击的场景兜底)。MCP 直接读 PIE 里 `bShowMouseCursor` 已确认新逻辑跑起来后确实变成 `false`。**待人工 Play 重新验收**:这次 Play 前先在 PIE 窗口里点一下抢焦点,再试 WASD 和鼠标视角;如果 WASD 还是完全没反应(和鼠标视角是两个独立问题),需要另外排查。
- **2026-08-18/19 用户再次反馈"和之前一样,不动,只有 controller w received"——排查一整轮,未解决,卡在 Enhanced Input 本身**。这次不是猜,是逐层用 MCP 直连 live PIE 状态核实(顺序见下),最后定位到一个**没能解决**的深层问题,详细记录在 `UE节点备忘录.md` 坑41,这里只记结论:
  1. 先核实 `BP_Unit`/`BP_TurnManager` 里 IA_Move/IA_Look 的节点连线、Possess/AddMappingContext 的顺序和参数、`IMC_TacticsControl` 的 modifiers 引用——全部正常,没有断线或坑39那种"静默变 None"。
  2. 新增 `HasMappingContext` 实时诊断(`StartTurn` 里 + `BP_TacticsController` 绑了个 `H` 键随时查)——IMC 全程确认 `TRUE`,不是被移除了。
  3. **决定性实验**:把 IA_Move/IA_Look 整套改绑到 `BP_TacticsController` 自己身上(用 `GetControlledPawn()` 转发移动),Controller 自己的 legacy 按键事件 100% 确认一直在正常触发,但即使这样 IA_Move 依然一次没触发过——证明问题跟"绑在 Pawn 还是 Controller"无关,是这个项目里 Enhanced Input 的 Action 触发管线整体不工作,只有 legacy 按键管线正常。
  4. 排查过 `bEnableInputModeFiltering`/`defaultMappingContexts`/`bEnableUserSettings`/`bShouldFlushPressedKeysOnViewportFocusLost`/`bIgnoreAllPressedKeysUntilRelease`/`DefaultPawnClass`(是否走过标准 `RestartPlayer` 流程)、`.uproject`/`Source/` 下有没有 C++ 拦截输入——全部排除,**没找到根因**。
  5. **临时留了一套绕开 Enhanced Input 的方案**在 `BP_Unit.EventTick`(`IsInputKeyDown`+`GetInputMouseDelta` 轮询,原理上比 Enhanced Input 更底层更可靠),但本轮只用 MCP 模拟按键(瞬时按下松开)测试,没等到确定结果,**必须真人物理长按 WASD 在编辑器里实测**才能知道这条路能不能走通。
  6. UE 已保存全部资产并正常关闭,没有留下未保存的改动。**下次接手先做这件事**:打开编辑器 Play,长按 WASD 看角色动不动;能动就把这套 legacy 轮询转正、Enhanced Input 那套先搁置;不能动就说明问题在比 Blueprint 更底层的地方(引擎/插件/项目安装),需要另开一个干净测试关卡或空白项目验证 Enhanced Input 是否正常。
- **2026-08-20 真人长按测试:legacy 轮询能动,但报了 3 个方向问题,已修**:用户 Play 长按 WASD 确认角色真的会动,按建议把这套方案转正(Enhanced Input 那套原样留着不删,不触发无害)。随后反馈 ①A/D 是"转"不是"平移" ②W 走的是斜的,不是脸朝向 ③鼠标上下镜头方向反了。根因是同一类错误(移动方向用了会跟着身体转的 `GetActorForwardVector`/`GetActorRightVector`,和 `bOrientRotationToMovement=true` 形成反馈环)+ 鼠标 `DeltaY` 少做工程惯例的取反,已用 MCP 直接改 `BP_Unit.EventTick`:移动方向改用 Controller `ControlRotation`(仅取 Yaw)算 `GetForwardVector`/`GetRightVector`;鼠标 Y 轴插了个 `×-1`。`compile_blueprint` 通过、`save_assets` 已落盘。详见 `UE蓝图状态.md`"legacy 轮询移动方向修正"一节、`UE节点备忘录.md` 坑42。
- **2026-08-20 第二轮反馈:A/D、鼠标已确认修好,但"人还是左移着走的"(W 仍横着走)**:用临时 actor 在关卡空地里 `add_to_scene_from_class` + `EditorToolset.EditorAppToolset.CaptureViewport` 截图排查(从正后方沿 local +X 看是否对称、从正前方是否对到脸),定位到真根因:Mewtwo 模型资产建模时的脸朝向是局部 **+Y**,不是 UE 约定的局部 +X,而 `StaticMesh` 组件的 `RelativeRotation` 一直是 `(0,0,0)` 没做补偿——胶囊体转向移动方向后,模型的脸依然侧着 90°,看起来像横着走/螃蟹步,和移动方向数学本身无关(A/D 已证明数学是对的)。**踩坑**:直接用 `ObjectTools.set_properties` 改关卡里已放置实例的 `StaticMesh.RelativeRotation` 不生效(`true` 但读回来被静默还原成 0),改成在 `BP_Unit.UserConstructionScript` 里新增 `StaticMesh(Get)→SetRelativeRotation(Yaw=-90)` 节点才真正持久生效,已用临时 actor 对比截图确认修复后模型脸对准移动方向。`compile_blueprint` 通过、`save_assets` 落盘,临时 actor 已清理不留痕迹。详见 `UE蓝图状态.md`"模型脸朝向和移动方向不对齐"一节、`UE节点备忘录.md` 坑42。
- **2026-08-20 验收通过**:WASD 四向稳定对应前后左右、W 沿脸朝向走、鼠标上下方向符合直觉,三条全部人工 Play 确认。阶段 A 的操控与相机地基(Possess/UnPossess、legacy 轮询移动、TPS 相机)到此完整验收通过,坑40/41/42 均已收尾(坑41 的 Enhanced Input 根因仍未查明但已被 legacy 方案绕开,不阻塞后续进度)。
- **2026-08-20 阶段B:移动范围软边界 + Col/Row 回写**(用户要求"每回合的移动不能超出可移动的移动范围"):复用阶段A之前就有的 `BP_Unit.StartLocation`(原本给 Undo 用,回合开始时快照的世界坐标)当移动范围原点。新增 `BP_GridManager.GetNearestTile()` 把移动后的世界坐标折算回最近的逻辑 `Col`/`Row` 写回单位——这是阶段A遗留的空白(移动方式从瞬移点格子换成连续移动后,`Col`/`Row` 一直没人写回,只是阶段A验收项还没测到这个坑)。
- **2026-08-20 用户验收反馈"移动不能超出棋盘"+"移动范围包含了攻击范围"**:第一版软边界用 `ClampVectorSize`(欧氏圆形距离)夹断,但项目里 `ShowRange`/`ShowAttackRange` 的"移动范围"概念全是**曼哈顿距离**(菱形),圆形边界比菱形大,斜着走能摸到攻击环、也没管棋盘实际边缘。**已改成 `BP_GridManager.ClampMovement()`**(新函数,取代 `EventTick` 里原来手搭的 `Subtract`/`ClampVectorSize`/`Multiply`/`Add`):同时处理①曼哈顿菱形边界(手搭 `|ΔX|+|ΔY|` 按比例缩放,不用内置的圆形 Clamp)②棋盘边缘硬边界(现场算所有 Tile 的真实 min/max 坐标夹一次,不猜公式/不假设原点在 (0,0))。**MCP 已在 live PIE 里验证**:斜向传送到移动范围外,拉回后精确落在曼哈顿距离=500(=5×100)的位置;传送到棋盘外(试了 1500 和 5000 两个不同远近的越界距离),两次都精确拉回到棋盘实际边缘的同一个坐标,证明棋盘边界限制生效且和移动范围菱形是两层独立限制。`RunRegressionTests` 11 条断言(T1-T8)全程 PASS,战斗逻辑层未受影响。过程中踩了三个新坑(`get_node_type_pins` 返回的节点 refPath 不是真实持久节点、DSL 里避免用带括号后缀的 type_id、软边界的距离度量要和项目既有系统保持一致不能凭直觉选欧氏距离),详见 `UE节点备忘录.md` 坑43/44/45、`UE蓝图状态.md`"TPS 阶段B"一节(含已否决的 v1 版本记录)。`compile_blueprint` 通过、`save_assets` 落盘。**待人工 Play 验收**:长按 WASD 斜向走到移动范围边缘是否感觉是菱形(不是圆形)、走到棋盘边缘是否被挡住、移动后攻击命中判定和攻击范围红圈是否跟随实际站位。
- **2026-08-21 ARPG 攻击操作**(用户要求:数字键 1-5 选技能、显示该技能的攻击范围、鼠标左键瞄准攻击——取代原计划阶段C 里"软锁定最近敌人"的设计):技能射程复用了 C++ 早就写好但没接线的 `FSkillRow.RangeBonus` 字段(`DT_Skills` 表数据本来就是对的,`aqua`/`vine`=1、其余=0),没有改任何 C++ 或数据。新增 `BP_GridManager.GetSkillEffectiveRange`/`ShowSkillRange`/`ClearAttackHighlightsOnly`/`ValidateSkillTarget`/`PerformSkillAttack` 五个函数,`BP_Unit` 新增 `SelectedSkillIndex` 变量、数字键 1-5(legacy 按键事件,不是 Enhanced Input,坑41 教训)选技能、鼠标左键(`LineTraceByChannel` 沿准星方向)瞄准攻击。**关键设计决定**:没有改动 `TryAttack`/`ComputeSkillDamage` 的签名(这是全场最复杂、出过"双重掷骰"坑26的函数)——读源码发现 `ComputeSkillDamage` 实际读的是 `PendingSkillRowName` 而不是它自己的 `bUseSkill2` 参数(后者是死代码),新流程只要在调用前把这个变量设成选中的技能行名即可复用现成伤害结算。**MCP 已验证**默认技能(index0=basic)的射程计算链路(`AtkRange+RangeBonus` 精确对应攻击范围高亮),`RunRegressionTests` 全 PASS。**没能验证**:数字键切技能、鼠标左键瞄准命中——这轮 MCP 的 Slate `PressKey` 没能让 PIE 视口拿到键盘焦点,而瞄准射线命中本身就是纯交互体验,MCP 没法模拟。详见 `UE蓝图状态.md`"ARPG 攻击操作"一节、`UE节点备忘录.md` 坑46。`compile_blueprint` 通过、`save_assets` 落盘。**待人工 Play 验收**:1-5 切技能时攻击范围环大小是否正确变化(4/5 号键应该比其余大一圈);准星对准射程内敌人左键能否正确命中结算并结束回合;对准我方单位或超出射程时左键是否正确不触发。
- **已知缺口**:目前没有"不攻击、主动待命结束回合"的按键(原计划里 `IA_EndTurn`/E 键从阶段A起就没真正生效,坑41),只有 `BP_TacticsController` 上一个调试用的 N 键强制结束回合可以兜底。
- **下一步**:上述 ARPG 攻击操作待人工 Play 验收;验收通过后补一个正式的"待命结束回合"按键。伤害公式/回合序/属性克制这轮完全没动,不要再改。
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
