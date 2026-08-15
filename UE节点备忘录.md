# UE 蓝图节点备忘录(踩坑记录,减少重复试错)

> 目的:省 token——别让我对同一类错误重新猜第二次。每次踩到新坑,加一条。

---

## 剪贴板粘贴技术的硬规则

1. **粘贴是纯增量的**:新节点内部互相连线(LinkedTo 指向同一段粘贴文本里的其他节点)可靠生效;但**新节点连到"已经存在于图里的旧节点"不会生效**——文本导入只在这次粘贴的对象集合里解析引用。跨旧节点的连线**必须让用户手动拖一条**。
2. **K2Node_VariableGet/Set 读取"不是 self 自己"的变量时,必须三件套齐全**:①`VariableReference` 里写 `MemberParent="<目标类的 BlueprintGeneratedClass 路径>"`;②Get 节点加一行 `SelfContextInfo=NotSelfContext`;③self/Target pin 显式写 `PinType.PinSubCategoryObject="<同样的类路径>"`。三者漏任何一个,轻则 pin 退化成泛型 `Object Reference` 报「XXX Object Reference is not compatible with Object Reference」,重则编译器直接去当前函数所在的类里找这个变量,报「Could not find a variable named "X" in 'BP_XXX'」。**这是本轮最大最反复的坑,TryAttack 函数从头到尾至少踩了 3 轮。**
3. **`ErrorType=1` / `ErrorMsg="..."` 经常是缓存的旧报错**,不代表当前真的有问题——连线修好后点一次 **Compile** 就会清掉。别被这种残留报错误导。
4. **一次粘贴里偶尔会丢 1 条 exec 连线**(原因不明,概率性),数据线基本不丢。生成较大的节点块后,第一件事永远是让用户检查每个节点的 exec 输入/输出是否都非空。
5. **函数名必须精确**,写错会导致整个节点在导入时**静默丢弃**(不报错,直接没了),下游连它的线全部退化成默认值——比"编译报错"更难发现。发现"生成的节点少了"时优先怀疑这个。

## 已验证可用的 FunctionReference(直接抄,别现猜)

| 类 (MemberParent) | MemberName | 说明 |
|---|---|---|
| Engine.GameplayStatics | GetAllActorsOfClass | |
| Engine.KismetSystemLibrary | IsValid | 纯函数,Object→Bool |
| Engine.KismetMathLibrary | Subtract_IntInt | |
| Engine.KismetMathLibrary | Add_IntInt | |
| Engine.KismetMathLibrary | Percent_IntInt | 显示成 "NO_OP" 是显示 bug,功能正常(取模) |
| Engine.KismetMathLibrary | **Max**(不是 Max_IntInt!) | 整数取最大值,真实函数名就是 `Max` |
| Engine.KismetMathLibrary | LessEqual_IntInt | 整数 ≤ 比较,已在 TryAttack 里验证可用 |
| (自身蓝图函数) | K2_DestroyActor | `FunctionReference=(MemberName="K2_DestroyActor",bSelfContext=True)`,self pin 类型填 `/Script/CoreUObject.Class'/Script/Engine.Actor'` 即可,子类自动兼容,不用精确到具体蓝图类 |

## 已知踩过的坑(不要重犯)

- ❌ `Max_IntInt` 不存在 → 用 `Max`
- ❌ InputKey 节点手写 `InputKey=(KeyName="N",...)` 的 FKey struct 格式经常被拒(编译警告 invalid FKey)→ 生成节点后让用户在编辑器下拉里手动选键,别硬凑格式
- ❌ VariableGet/VariableSet 读取非 self 变量时三件套漏写 → 见上面规则2
- ❌ **手写大段粘贴文本时,连线用"字段名简写"而不是"完整符号 key"去查 GUID,会导致连线全部指向随机生成的、不存在的 GUID,且不会立刻报错**——本轮真实踩过:脚本里 `nodekey, pinkey = other` 把一个 `(节点key, 字段key)` 元组拆开后只用字段名去查 pin 表,结果连线全错。**教训:生成脚本必须做"每条 LinkedTo 引用的 PinId 都能在声明集合里找到"的自动校验,校验不过不能发给用户。**
- ❌ **手动补线清单里,"目标不是 self 的操作型函数"(比如 `K2_DestroyActor`)的 Target pin 极易漏接**——这类 pin 是可见的(`bHidden=False`)但没有强制报错提示,漏接后不报编译错误,只在运行时才暴露,而且后果可能很严重(本轮漏接 `Destroy.Target→Defender`,运行时误删了 `GridManager` 本体,导致地图彻底失效,报错信息还完全指向别的地方,排查绕了好几轮)。**教训:交付"剩余手动连线清单"时,但凡涉及 `DestroyActor`/`SetActorLocation` 这类"对某个目标对象做破坏性操作"的函数,要单独加粗提醒用户优先检查,而不是和其他连线混在一条列表里等同优先级。**

- ❌ **视觉位置(世界坐标/SetActorLocation)和逻辑位置(自定义 Col/Row 整数变量)是两套独立数据,UE 不会自动同步**——本轮真实踩过两次:`SpawnUnit` 只把新单位摆到了正确的世界坐标,从没 `Set Col`/`Set Row`;`BP_Tile` 的移动逻辑只做了 `SetActorLocation`,同样没更新 `SelectedUnit.Col/Row`。表现是"单位看起来在正确位置,但所有基于 Col/Row 的逻辑判断(比如曼哈顿距离)全部失效",而且不报任何错误,只能靠打印实际数值才能发现。**教训:任何"挪动/生成一个用逻辑坐标系统追踪位置的 Actor"的地方,都要显式检查——有没有在改视觉坐标的同时,也把逻辑坐标（自定义 Col/Row 这类变量）同步写掉,不能想当然认为"位置对了"就等于"坐标对了"。**

## 生成粘贴块的标准流程(已固化为 skill)

从这一轮开始,**所有粘贴块生成都走 `ue-blueprint-paste-gen` 这个 skill**,核心是:写 Python 脚本 + pin 注册表模式生成文本(而不是手打)→ 生成后自动校验连线完整性 → 大文本写成 txt 文件交付,不直接堆进聊天。细节见 skill 内容,这里不重复。

## MCP `BlueprintTools` 实测细节(2026-08-15,修 ShowRange 占位检查时踩的坑)

这一轮发现实际的 `BlueprintTools` 比 `UE协作Harness规范.md` 0.1 节记录的(仅 `find_nodes`/`get_node_infos`/`connect_pins`/`compile_blueprint`)丰富得多,还有一整套 DSL 工具:`read_graph_dsl`/`write_graph_dsl`/`get_graph_dsl_docs`,以及 `create_node`/`break_pins`/`find_node_types`/`get_node_type_pins`/`add_function_graph`/`add_function_param` 等。

- **`read_graph_dsl` 对含 Macro 节点(比如 `ForEachLoop`)的图,反编译文本可能失真**——本轮读 `ShowRange` 时,内部一个"曼哈顿距离"计算实际是靠 Macro/多个节点组合出来的,但 DSL 打印成了看着像类型不对的怪表达式(对 Vector 直接做 `Integer|Absolute`)。**教训:对一个已经跑通、你不完全确定内部结构的现有 Function,不要直接把 `read_graph_dsl` 的文本原样喂回 `write_graph_dsl` 做整体重写**——用 `get_node_infos`/`find_nodes` 先看真实节点图,新增逻辑用 `create_node`+`connect_pins`+`break_pins` 做外科手术式插入(只插新节点、只接你要改的那几根线),不动现有节点。`write_graph_dsl` 更适合**全新 Function**(比如本轮新建的 `IsTileOccupied`),从空图开始写,没有"猜错现有结构"的风险。
- **`create_node` 建"取别的类的成员变量"节点时,`type_id` 要用 `Class|<类名>|Get<变量名>` 格式**(不是 `find_node_types` 无 context 列出来的 `Variables|Default|GetXxx`,那个直接建会报 "does not exist")。如果多个类有同名变量(比如 `BP_Tile.Col` 和 `BP_Unit.Col` 都叫 `Col`),`create_node` 的 `declaring_class` 参数可以显式指定目标类消歧——但实测哪怕不传,只要 `type_id` 里类名标对(如 `Class|BPTile|GetCol`),生成的节点 `self` pin 类型也会正确落在对应类上,可以用 `get_node_infos` 读 pin 的 `type_id`(比如 `"BP Tile Object Reference"`)直接验证有没有认错类。
- **`find_node_types` 不传 `context_pins`(空数组)时返回的是全局模糊匹配,噪音很大**(一次查 "Not" 返回几百条不相关结果),关键字尽量用完整/独特的词(比如直接查 `NOT Boolean` 的核心词 `Not`,再自己从结果里挑 `Math|Boolean|NOTBoolean`)。
- **`AssetTools.save_assets` 传显式资产路径经常报 "Asset does not exist"**,即使这个路径是 `find_assets` 自己搜出来的(本轮 `/Game/Maps/BP_GridManager` 精确路径也不认)——直接传 `asset_paths: []` 保存所有 dirty 资产更稳,存完用宿主 git 仓库(UE 工程自己的 `.git`,不是纹兽战记文档仓库)`git diff --stat` 确认改动范围只覆盖预期的 `.uasset`。
- **函数体带 `for` 循环 + 循环内 `return` 的 Function 不是 Pure 函数**,调用它生成的 `K2Node_CallFunction` 会带 `execute`/`then` exec pin,不能只当纯数据节点接线——必须显式接入 exec 链路(否则编译或运行时行为不对)。
- **`write_graph_dsl` 里调用"自己蓝图上的自定义 Function"(哪怕是自调用/self-context),必须显式把 `self` 当第一个位置参数传进去**——比如 `(CallFunction|IsTileOccupied self colA rowA)`,不能只写 `(CallFunction|IsTileOccupied colA rowA)`。这类自定义 Function 节点(不同于引擎内置的纯函数/操作符)天生带一个可见的 `self` pin,DSL 按"pin 顺序"填位置参数,不传 self 会导致第一个真实参数被错误地塞进 self pin,报类似 `Could not connect pin Col to self` 的类型不匹配错误(本轮修 `RunRegressionTests` 时踩到,加上 `self` 后立刻解决)。反过来,`Utilities|String|Append` 这类引擎自带的纯函数/操作符节点没有 self pin,不受此规则影响。
- **`write_graph_dsl` 不能可靠地整体重写"含 `SpawnActorFromClass` 的图"**——`read_graph_dsl` 会把这类节点打印成形如 `Game|SpawnActorBPTile`/`Game|SpawnActorBPUnit` 的"类型特化"标签(按目标类动态生成的显示名),但这个标签不是一个真实可创建的 `type_id`,回写时会报 "does not exist"。这和之前记录的"含 Macro 节点的图不能整体回写"是同一类坑(DSL 反编译对某些动态生成的节点失真),遇到 `SpawnActorFromClass` 同样要退回 `create_node`/`connect_pins` 外科手术式编辑,或者干脆调用一个已经包含该 Spawn 逻辑的现成 Function(比如需要拿到"刚 spawn 出来的 Actor 引用"时,给现成的 Function 加一个 Object 类型的输出参数——`add_object_function_param`,`object_class` 传目标类的 Class 引用——比在别处重新拼一遍 Spawn 节点安全得多)。
- **给 Function 新增/修改输出参数后,图里所有已存在的调用点(`K2Node_CallFunction`)不会自动跟着刷新 pin**,编译会报 `Could not find a pin for the parameter <NewParam> of <FuncName> on  <FuncName>`。目前没找到"刷新单个节点签名"的工具,只能把这些调用点 `delete_node` 后用 `create_node`(同 `type_id`)重建,再用 `set_pin_value` 补回原来的字面量参数、`connect_pins` 补回原来的 exec 链路。**改 Function 签名前先 `find_nodes` 数一下有几个调用点,做好心理准备要重建那么多个节点。**
- **`ObjectTools.set_properties` 设不了刚用 `add_variable` 新建的变量**,哪怕 `get_properties`/`list_properties` 都能正常读到它——报 "the following properties could not be set",原因是新变量默认没勾 "Instance Editable"。先 `BlueprintTools.set_variable_instance_editable(blueprint, variable_name, instance_editable=true)` 再 `compile_blueprint`,`set_properties` 才会生效。
- 控制台起 MCP 服务用 `ModelContextProtocol.StartServer <port>`(位置参数),不是 `-ModelContextProtocolPort=<port>`(那是编辑器启动命令行参数,控制台里这么写端口会被解析成 0 报 "Invalid port 0")。
- 项目 `.mcp.json`(UE 工程根目录)和用户全局 `~/.claude.json` 里都各自存了一份 `unreal-mcp` 的端口配置,两边可能不一致(本轮就撞上了:一个写 8000 一个写 8001,且 8000 还被 ComfyUI 占用)。**编辑器里手动 `StartServer <port>` 之后,当前会话的 MCP 连接不会自动重连**,要在 Claude Code 里跑一次 `/mcp` 手动重连。

## 请求用户回传时的省 token 原则

- **默认不要求整张 EventGraph** —— 只要新加的那几个节点 + 它们连接的邻居节点。整图回传只在"怀疑有旧节点/其他事件干扰"时才要。
- 复杂改动优先做成**独立 Function**(像 ShowRange/StartTurn/EndTurn),而不是往 EventGraph 里加分支——Function 出错时可以整体重新生成替换,不需要连蒙带猜patch。
