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

## UMG / Widget 相关踩坑(2026-08-15,搭血条时)

- **`AddComponent|UserInterface|AddWidgetComponent`(Construction Script 里"动态加 WidgetComponent"节点)没有 `WidgetClass` 输入 pin**,这个引擎版本里也**没有 `SetWidgetClass` 这个蓝图可调用节点**(`find_node_types`/`create_node` 都确认不存在)。正确做法:用 `Game|ConstructObjectfromClass`(Class 传 `/Game/UI/WBP_XXX.WBP_XXX_C`,`set_pin_value` 设置)单独构造一个 Widget 实例,再用 `UserInterface|SetWidget`(接受 Widget **实例**,不是 Class)把它挂到 WidgetComponent 上。副作用是这个实例可以顺手存一份到 Actor 自己的成员变量里,后面调用 `SetPercent` 之类的函数不用再 `GetUserWidgetObject()+Cast` 一遍。
- **`ConstructObjectfromClass` 的输出 pin 类型会在 `set_pin_value` 设置 Class 参数之后自动跟着变**(从泛型 `Object Reference` 变成具体的 `WBP_XXX Object Reference`),不需要额外 Cast 节点就能直接接到期望该具体类型的输入 pin 上。
- **UMG `UToolsetRegistry.UMGToolSet` 没有"属性 Binding"(就是编辑器里属性旁边点 Bind 生成一个 Get 函数那种)的对应工具**——`BindToEventProperty` 是绑事件委托(OnClicked 这类),不是属性绑定。想让 Widget 跟着数据自动刷新,只能走"外部主动 Push 新值"模式:给 Widget 蓝图写一个 `SetXXX(Value)` 函数,数据源变化时显式调用它。
- **跨蓝图调用自定义 Function 时,"self/target 参数排在第几位"没有固定规律,不能死记硬背**——同样是"这个函数只有一个数据参数+一个 self pin"的形状,`ProgressBar.SetPercent(value, self)` 是 value 在前,而 `WBP_HealthBar.SetHealthPercent(self, value)` 却是 self 在前。**每次都用 `write_graph_dsl` 先按直觉顺序试一次,报错信息里会明确说"是把谁的输出接到了 self 上"(比如 `Could not connect pin ReturnValue to self`),照着报错把参数顺序倒过来重试一次基本就能过。**
- **加了 UMG 内容后,某些 `Class|X|GetY` 类型的变量名解析可能改变**——本轮在给 GridManager 加新断言时,`Class|GridSlot|GetRow`(之前在 TryAttack 里读出来能用的写法)突然报 `Could not connect pin Output to self`,因为 UMG 的 `UGridSlot` 类也有一个 `Row` 属性,新增 Widget 资产后这个名字的解析多了一个候选、指向变了。**同名属性存在多类歧义时,一律用能唯一定位到目标类的显式写法**(比如 `Class|BPTile|GetRow`),不要偷懒抄旧代码里的写法。
- **`(if (Utilities|IsValid X) ...)` 这种用法没问题,但把 `(Utilities|IsValid X)` 当纯表达式嵌到别的函数调用参数位置里(比如 `(SomeFunc (Utilities|IsValid X))`)会导致图编译通过、但运行时执行流程在那条语句后"静默卡死"**——后续所有语句(包括最后的收尾 Print)全部不执行,Output Log 不留任何报错。根因推测是 `IsValid` 底层是个带 True/False 两个 exec 输出的分支节点(`K2Node_IsValid`),不是纯函数,只有直接当 `if` 的条件语句写才能被正确处理成分支合并;嵌套用法会生成出图但连不上后续 exec 链路。**只在 `(if (Utilities|IsValid X) 真分支 (else 假分支))` 这种独立语句形式里用它。**
- **`AssetTools.save_assets([])`("存所有 dirty 资产")连关卡文件(.umap)一起存**——如果为了测试临时改过某个 Actor 实例属性(比如本轮的 `bRunRegressionTestsOnBeginPlay` 开关),中途任何一次 `save_assets([])` 都会把这个临时改动顺带落盘。**改完临时属性、测试完之后,先确认改回原值(`get_properties` 验证一遍),再执行任何后续的 `save_assets` 调用**,不要假设"不主动存关卡=不会被存"。

## UMG 补充踩坑(2026-08-15,做胜负弹窗时)

- **`TextBlock.ColorAndOpacity` 是 `FSlateColor`,不是 `FLinearColor`**——直接把 `Math|Color|MakeColor` 的输出接到 `Class|Text|SetColorandOpacity` 会报 "Could not connect pin ReturnValue to ColorAndOpacity"(类型不兼容)。要先过一道 `Utilities|Struct|MakeSlateColor`(参数:`SpecifiedColor`=LinearColor,`ColorUseRule`="UseColor_Specified"),转成 SlateColor 再接。
- **DSL 里没有"可变的循环计数器/累加器"原语**——`bind` 只是给某个节点的输出取个名字,不能在 `for` 循环里被反复重新赋值当计数器用。需要"遍历一堆东西、累加/标记状态"这种逻辑时,老老实实用**Function 的局部变量**(`add_variable(...,graph=<该函数的graph引用>)` 建局部 bool/int 变量),循环体内用 `Variables|Default|SetX`/`GetX` 读写它,和用类成员变量的语法完全一样,只是作用域局部于这个 Function。本轮 `CheckVictoryCondition` 用两个局部 bool(`AllyAliveTmp`/`EnemyAliveTmp`)分别标记"循环过程中有没有见到我方/敌方单位"就是这个模式。
- **`Class|X|SetY` 这类"设置某个 Widget 属性"的自定义/包装函数,同一个函数在不同 Widget 类型上参数顺序也可能不一样**,不止是"self 在前/在后"这么简单——`Class|ProgressBar|SetPercent` 是 `(value, target)`,`Class|Text|SetColorandOpacity` 也是 `(value, target)`,但 `Class|WBPHealthBar|SetHealthPercent`(自定义函数,不是引擎内置的)是 `(target, value)`。**引擎内置的 Widget 方法(Class|<UMG类名>|...)大概率是 `(value..., target)`;自己用 `add_function_graph` 建的自定义函数,self/target pin 位置看它是第几个加的参数,没有通用规律,每次都用报错信息反推**(参考本文件"跨蓝图调用自定义 Function"那条)。

## 重要陷阱:`ConstructObjectfromClass` 造出来的 Widget,`bIsVariable` 控件树绑定不生效(2026-08-15,胜负弹窗 bug)

**现象**:`Game|ConstructObjectfromClass` 造一个 Widget Blueprint 实例,`AddToViewport` 后背景/默认样式能正常显示,但只要运行时调用任何"读/改某个 `bIsVariable` 子控件"的函数(比如 `ResultText.SetText(...)`),就会报 `Accessed None trying to read (real) property <控件名>`——这个子控件变量在运行时是 `None`。

**根因**:UMG 里勾了"Is Variable"的子控件(比如 `ResultText`),这个变量指向"控件树里具体哪个控件实例"这件事,不是造对象的时候自动就有的,而是要靠正规的 `Create Widget`(`UWidgetBlueprintLibrary::Create`)流程里的 `Initialize()` 去建立绑定。`Game|ConstructObjectfromClass` 走的是裸 `NewObject`,不会触发这一步。**先 `AddToViewport` 再调用依赖 `bIsVariable` 的函数也没用**——`AddToViewport` 不会补上这个初始化(本轮实测过,顺序换了照样报错)。

**已知限制**:目前这套 MCP 工具的 `find_node_types`/`create_node` 找不到正规的 "Create Widget" 节点(试过 `UserInterface|Create`、`Widget|Create`、`Game|Create` 等各种猜测都不存在),所以**目前没有已知办法通过 MCP 正确初始化一个"运行时会被调用改内容"的 Widget 实例**。

**当前绕过方案**:如果 Widget 的内容是"有限的几种固定状态"(比如胜利/失败只有两种),**把每种状态做成一个独立的 Widget Blueprint,子控件的文字/颜色全部烤进设计时默认值,不在运行时调用任何碰 `bIsVariable` 绑定的函数**——`ConstructObjectfromClass` + `AddToViewport` 只负责"选造哪个类、扔上屏",不做任何运行时改控件内容的操作。设计时默认值(比如 Border 的背景色)不受这个 bug 影响,因为它们不经过运行时代码,是渲染时直接读的类默认数据。**如果以后确实需要"运行时动态改内容的 Widget"(比如内容是从变量拼出来的字符串,没法枚举成有限几种),这个坑还没有已知解法,得先想办法找到真正的 Create Widget 节点或者其他初始化手段,不要重蹈覆辙。**

## 重大陷阱合集:`write_graph_dsl` 的三个系统性坑(2026-08-15,敌方 AI 开发实录)

这轮做敌方 AI(`FindNearestUnit`/`MoveUnitTowardTarget`/`RunEnemyTurn`)踩了一整套连环坑,教训价值很高,详细记录:

### 坑1:`write_graph_dsl` 对同一个 Function 图**是追加,不是整体替换**
反复对同一个 Function 调用 `write_graph_dsl`(比如改一次逻辑就重写一次),旧版本的节点**不会被清掉**,会作为孤立的垃圾节点一直堆在图里(`FunctionEntry` 的 exec 输出 pin 只能连一个下家,新写入的链条会"抢线",旧链条变成没人执行的死节点,但节点本身还占着图)。重写 5~10 次之后,图里会有几十个孤立节点,并且**这些残留节点偶尔会让 `write_graph_dsl` 的后续写入把连线接到错误的旧节点上**(本轮真实碰到:改了老半天一个"距离比较"逻辑,百思不得其解地跑出错误结果,最后发现是新语句复用了错误的孤立残留节点)。
**规矩**:同一个 Function 图但凡重写超过 2~3 次还没调通,别继续在上面叠 `write_graph_dsl`——用 `remove_function_graph` 删掉整个 Function 再 `add_function_graph` 重建,拿到一张干净的图再写一次。**加分注意**:`remove_function_graph` 之后立刻 `add_function_graph` 同名字,偶尔会因为内部还残留一个占用中的引用,自动改名成 `<原名>_0`(本轮 `FindNearestUnit` 变成了 `FindNearestUnit_0`,DSL 里对应的 type_id 变成 `FindNearestUnit0`,不带下划线,需要用 `find_node_types` 现查确认实际名字,不要想当然按原名字硬写)。删除 Function 之前,记得**先去调用方(尤其是 EventGraph 里散落的 CallFunction 节点)找到并删掉对它的引用**,否则 `compile_blueprint` 会报 "Could not find a function named X"。

### 坑2:`(if (Utilities|IsValid X) ...)` 通过 `write_graph_dsl` 写出来的图**经常性地"编译成功但没连线"**
不止是"嵌套在别的表达式里"才会坏(那条已经记在下面"整数除法"那节前面的旧笔记里)——**哪怕写成推荐的"独立语句"形式 `(if (Utilities|IsValid X) 真分支 (else 假分支))`,一样有相当概率生成一个 `execute`/`Condition` 两个 pin 都完全没连线的孤立 Branch 节点**,现象因上下文而异:
  - 出现在 `for` 循环内部的 if 分支里 → 循环体那部分逻辑整个不执行,变量停留在默认值,函数悄悄返回错误结果(**不报任何错误**)。
  - 出现在函数体顶层、后面还有代码 → 后续所有语句都不执行,包括最后的收尾 Print(**同样不报任何错误**,表现为"卡住不动"，其实是提前把 exec 链路断掉了)。
  - 出现在函数体顶层、是最后一批语句 → 有时反而能正常工作(本轮唯一一次侥幸能跑的用例)。
  没有找到规律能预判哪种情况会坏——**唯一可靠的做法是完全不通过 `write_graph_dsl` 写 `Utilities|IsValid` 相关的 if 语句**,改用不需要判空的等价逻辑:
  - 找"数组/循环里的最优解"场景(比如"最近的单位"):不要用"当前最优解是否 IsValid"来判断"是不是第一个候选",改成给距离一个**大哨兵初始值**(比如 9999),每次发现更小的距离就直接更新,不用关心"有没有候选"这件事。
  - 需要"是否发生过某件事"这种布尔标记场景:加一个局部 bool 变量(默认 false),事件发生时显式 `Set` 成 true,最后 `if` 这个 bool 变量而不是 `IsValid`。
  只有 `TryAttack` 里原来那处 `IsValid` 是安全的——但那是这个会话**开始之前就已经存在**的代码(不是这轮用 `write_graph_dsl` 写出来的),不能作为"这样写就安全"的参考样本。

### 坑3:`bind` 对**结构相同、输入不同**的纯函数(Get 类)表达式,可能被错误地当成同一个节点复用,导致"读到的是别的时间点的值"
`Class|BPUnit|GetCol enemyD` 这种纯读取调用没有 exec pin,只在被消费的时候求值。如果同一个 Function 里出现**两处文本结构完全相同**的表达式(哪怕通过不同的 `bind` 名字绑定,比如"移动前"读一次 `GetCol enemyD`,"移动后"又读一次同样的 `GetCol enemyD`),`write_graph_dsl` 有概率把它们**编译成同一个底层节点**——纯节点只有一份,它的求值时机是"被消费的那一刻",如果两次绑定共享同一个节点,"移动前"的那个绑定其实会读到"移动后"的值(因为节点被求值的时机被推迟到了图里更晚的地方),导致两个应该不同的值变得完全相同,连带用它们算出来的比较结果全部失真(本轮真实症状:`(< 距离After 距离Before)` 明明手算是 `2 < 7` 应该为真,断言却稳定失败;后来发现是 `distBefore`/`distAfter` 两个同结构表达式被别名到了一起)。
**规矩**:
  1. **需要在一次改动(移动/攻击/生成等有副作用的调用)前后各读一次同一个纯属性的值时,不要指望 `bind` 会自动帮你在正确的时间点各求值一次**——在"之前"的读取点上,显式用 `Variables|Default|SetXxx(纯读取表达式)` 把值存进一个局部变量,强制在那个精确的 exec 时间点完成一次有序(非纯、按 exec 顺序执行)的快照,后面全部用 `Variables|Default|GetXxx` 读这个局部变量,不要再直接读原始的纯表达式。
  2. **两处需要各自独立求值的"结构相同"的运算表达式(即使输入变量不同),优先包成一个真正的 Function 调用**(`CallFunction|Xxx`,天然带 exec pin,不会被去重/别名),而不是各自在 DSL 里现场重复写一遍算式。本轮把重复了 4 次的曼哈顿距离算式抽成 `ManhattanDistance(ColA,RowA,ColB,RowB)` 这一个 Function,不仅解决了别名 bug,顺便也是应该做的重构。

### 坑4:不只是 `write_graph_dsl`——**手工 `create_node`/`connect_pins` 拼图**(`BP_TurnManager.StartTurn`)也照样能拼出"看似有 IsValid 判断、实际执行链路完全不可达"的图,而且更隐蔽
`StartTurn` 加"死亡单位跳过 + 敌方AI分支"这次改动,是用 raw node surgery(不是 `write_graph_dsl` 整段重写)一步步搭出来的,按理说"每条连线都是自己亲手点的",应该比 DSL 生成更可信——结果照样出了坑,而且比坑2更彻底:
  - `FunctionEntry` 的 exec 输出**只连到了 `Utilities|IsValid` 宏节点的 `exec` 输入**;但这个宏的两条 exec 出口(`Is Valid`/`Is Not Valid`)**完全没有接到任何下家**,是彻底的死路。
  - 与此同时,图里另外还单独立着一个 `Branch` 节点,它的 `Condition` 接的是一个 `NOTBoolean` 节点,而这个 `NOTBoolean` 的输入 `A` **同样没有任何连线**,用的是字面量默认值 `false`——于是 `Condition` 恒为 `true`,这个 `Branch` 的 then/else 才是后面 `EndTurn`/`ShowRange`/`RunEnemyTurn` 真正接着的地方。
  - 两段图(`IsValid` 宏 vs `NOTBoolean`+`Branch`)结构上各自"看起来完整",但从来没有真正接到一起过——**这是"先搭了一版方案又换了另一版,旧的没删干净、新的没接上"的典型残留状态**,`compile_blueprint` 对此完全不报错(两段图各自都是合法的、类型匹配的子图,只是彼此不连通,以及 `FunctionEntry` 之后第一步就断流)。
  - 后果比坑2的任何一种表现都严重:**从 `StartTurn` 唯一的入口 `FunctionEntry` 往下,第一个节点(`IsValid` 宏)就是终点**,意味着这次改动一旦上线,不仅敌方 AI 不会跑,连原本正常工作的"点我方单位→`ShowRange`高亮"和"`EndTurn`推进回合"都会一起失效——一个看似只是"加新分支"的改动,实际上会整体打断已经验收过的旧功能。
  - 之所以没被 T7a/T7b/T7c 三条回归测试发现:那三条测试**直接调用 `RunEnemyTurn`**(单独测敌方 AI 的移动/攻击逻辑本身),完全绕过了 `StartTurn` 这个真正的游戏内入口,所以图里这个致命的断流对测试结果毫无影响。
  - 发现过程:在给 `UE蓝图状态.md` 写"这里的 IsValid 检查是手工确认过wiring正确的"这句话之前,决定真的动手核实一下(而不是凭"是自己一步步连的,应该没问题"的直觉下结论)——`find_nodes(title="Branch")` 先定位到两个 `Branch`,`get_node_infos` 逐个查 `execute`/`Condition` 的 `connected_pins`,一查就发现其中一个 `Branch` 的 `execute` 输入是空数组(不可达),另一个 `Branch` 的 `Condition` 来自一个输入同样空数组的 `NOTBoolean`。
  - 修法:删掉 `NOTBoolean` 驱动的那个 `Branch`(及其常量比较节点),把 `IsValid` 宏的 `Is Valid`/`Is Not Valid` 两条 exec 出口直接接到原本 `Branch` then/else 后面挂着的两段逻辑上,`compile_blueprint` 通过后重跑一遍完整的 9 条回归断言(T1–T7c)确认没有连带破坏其它功能。
**教训(比坑2更普适)**:"这段图是我自己手工一条条连出来的"不等于"我核实过它真的从入口能执行到出口"。**任何时候往文档里写"手工确认过 wiring 正确"这种断言之前,必须真的用 `get_node_infos` 顺着 `FunctionEntry`(或相关的 Branch/宏节点)往下游追一遍每个 exec pin 的 `connected_pins`,而不是凭"我是自己连的"这种记忆或直觉背书**——本轮如果不是在写文档的那一刻多问了自己一句"这是真的验证过的吗",这个能打断整个游戏可玩性的 bug 会被当作"已确认没问题"直接写进文档定稿。

### 排查心法
以后再遇到"图结构看起来完全正确、`compile_blueprint` 也不报错,但运行时结果就是不对/流程就是卡住不往下走"这种诡异现象,优先怀疑上面几条,而不是怀疑自己的业务逻辑写错了——**加 `PrintString` 逐段打印中间变量的实际运行时值**(不要只信任静态读图或手算推理)是定位坑2和坑3的关键手段;而**怀疑"整条 exec 链路是否真的从入口连到出口"时,`get_node_infos` 逐节点核对 `connected_pins` 比 `PrintString` 更直接**(坑4就是这么查出来的,因为问题根本不是"值不对",而是"代码压根没跑")。**任何要写进文档的"wiring 已确认正确"类断言,写之前都必须真的跑一遍这个核对,不能凭直觉或"是我自己连的"来背书。**

## 陷阱合集:速度条/行动顺序开发实录(2026-08-15)

### 坑5:`find_node_types` 返回的"可搜到"字符串,和 `create_node`/`write_graph_dsl` 真正"可创建"的 `type_id`,经常是两套不同的名字
`FindNearestUnit0`(自定义 Function)在**读**已有节点时(`get_node_infos`)看到的 `type_id` 是 `|FindNearestUnit_0`(带下划线、裸 `|` 前缀);但这个字符串**不能用来新建节点**(`does not exist`)——真正能喂给 `create_node`/`write_graph_dsl` 的字符串是 `find_node_types` 搜出来的 `CallFunction|FindNearestUnit0`(不带下划线、带 `CallFunction|` 前缀)。同理,`Class|BPUnit|GetSpd` 这种"取别的类的成员变量"节点,`find_node_types` 不传 `context_pins` 时能搜到且能建;但像 `GetCol`/`GetRow`/`GetSide` 这类**多个类都有同名属性**(`BP_Unit.Col` 和 `BP_Tile.Col` 撞名)的情况,`find_node_types` 常常只搜到 `Variables|Default|GetCol` 这个"本类自己变量"专用的别名,**这个别名对"取别的对象的属性"这种场景是无效的**(`create_node`/`write_graph_dsl` 建出来会报 `does not exist`)。**规矩**:先按直觉试 `Class|<类名>|Get<变量名>`(通常最可靠,尤其是变量名唯一不撞名的情况,比如本轮的 `Class|BPUnit|GetSpd`);如果报 `does not exist`,不要死磕,直接 `find_node_types(type_id_filter="<变量名>", context_pins=[])` 广撒网,把返回列表里所有候选都记下来,挨个试(`CallFunction|Xxx` 和 `Class|类名|GetXxx` 是最常见的两种能用的形式,`Variables|Default|GetXxx` 对同名撞了别的类基本不能用)。**已确认属于"读出来的 type_id 和能建的 type_id 不是同一个字符串"这类坑的具体案例**:`FindNearestUnit_0` vs `FindNearestUnit0`、`GetCol`/`GetRow`(`Slot0Text` 这类 UMG 子控件变量同理,见坑6)。

### 坑6:UMG Widget 蓝图里,`bIsVariable` 子控件的取值别名不是 `Variables|Default|Get<Name>`,而是 `Variables|<WidgetBlueprint名字>|Get<Name>`
普通 Actor 蓝图(比如 `BP_TurnManager`)自己的成员变量,取值用 `Variables|Default|GetXxx` 没问题;但 Widget Blueprint(`WBP_XXX`)里通过 `ToggleWidgetAsVariable` 标记出来的子控件(比如 `Slot0Text`),对应的可创建别名是 **`Variables|<WBP类名去掉WBP前缀>|Get<控件名>`**(本轮实测 `WBP_OrderBar` 里的 `Slot0Text` 对应 `Variables|WBP_OrderBar|GetSlot0Text`,不是 `Variables|Default|GetSlot0Text`——后者会报 `does not exist`)。Widget Blueprint 自己真正的"蓝图变量"(比如用 `add_object_variable` 额外加的 `SlotTexts` 数组)反而还是走 `Variables|Default|GetSlotTexts` 这个标准形式——**同一个 Widget Blueprint 里,"子控件"和"手动加的普通变量"取值要用两套不同前缀,搞混了两个都会报 `does not exist`,先 `find_node_types(type_id_filter="<名字>", context_pins=[])` 广撒网确认哪个能用,不要猜。**

### 坑7:`WidgetComponent` 初始化顺序——`SetWidgetSpace` 必须排在 `SetWidget` **之后**,不能在之前,否则 Widget 内部所有 `bIsVariable` 子控件运行时全是 `None`
本轮给行动顺序条挂 `WidgetComponent`(Screen Space)时,按"先配置组件属性、再挂内容"的直觉顺序写(`AddWidgetComponent → SetWidgetSpace(Screen) → SetDrawSize → ConstructObjectfromClass → SetWidget`),结果 `WBP_OrderBar` 里 8 个 `bIsVariable` 的 `TextBlock` 运行时全部读出来是 `None`——这正是"`ConstructObjectfromClass` 不触发 `bIsVariable` 绑定初始化"那个老坑(见"重大陷阱:`ConstructObjectfromClass` 造出来的 Widget"一节),但这次连**血条那条"`WidgetComponent`+`SetWidget` 能绕开这个坑"的已知经验都失效了**。对比血条(`BP_Unit.UserConstructionScript`)真正跑通的顺序:`ConstructObjectfromClass → AddWidgetComponent → SetWidget → SetWidgetSpace(不传参,默认 World) → SetDrawSize`——**唯一关键差异是 `SetWidget` 排在 `SetWidgetSpace` 前面**。把顺序换成"先 `SetWidget` 再 `SetWidgetSpace`"之后,子控件全部变成有效引用。**结论(具体引擎机制未知,但两次独立对照实锤了现象)**:`WidgetComponent` 相关的初始化,`SetWidget` 必须是第一个"内容相关"的调用,`SetWidgetSpace`/`SetDrawSize` 这类纯外观属性放在 `SetWidget` 之后更安全。以后凡是"新建 `WidgetComponent` + 挂一个需要运行时读写 `bIsVariable` 子控件的 Widget"这种模式,直接照抄血条这个顺序,不要凭直觉重新排。

### 坑8:用 `connect_pins` "挪动"一个节点在 exec 链路里的位置时,必须显式 `break_pins` 断开它原有的连接,否则会拼出一个环,`compile_blueprint` 直接死循环
为了修坑7,把 `SetWidgetSpace` 节点从链路中间挪到末尾,只加了两条新线(`前一个节点.then → SetDrawSize`,`SetWidget.then → SetWidgetSpace`),但漏了断开 `SetWidgetSpace` 自己原来还连着 `SetDrawSize` 的旧线——结果图里出现一个环(`SetDrawSize → ... → SetWidget → SetWidgetSpace → SetDrawSize → ...`),`compile_blueprint` 直接跑成死循环(`Runaway loop detected (over 1,000,000 iterations)`,MCP 调用在后台跑了 2 分钟才把错误报回来,期间前台完全没反馈)。**教训**:`connect_pins` 只负责"接上新线",不会自动帮你断开某个节点原有的其它连接——它"顶掉旧连接"这个直觉**只对同一个 pin** 成立(一个 exec 输出 pin 确实只能接一个下家,对它 `connect_pins` 新目标会自动顶掉旧目标),对"这个节点通过另一个 pin 还连着别处"完全不成立。**凡是"移动一个已有节点在 exec 链路里的位置"(不是单纯新增一段),动手前先 `get_node_infos` 看清楚该节点当前**全部**的 exec 连接,该断的连接用 `break_pins` 显式断掉,再连新的,不要只顾着接新线。**

### 坑9:改了一个 Widget Blueprint 的内部结构后,**引用它的其它蓝图也要重新 `compile_blueprint`**,不然运行时子控件又变回 `None`
给 `WBP_OrderBar` 加 hover 提示文字这轮,只 `CompileWidgetBlueprint(WBP_OrderBar)` 编译了这个 Widget 自己,`BP_TurnManager`(持有一个 `WBP Order Bar Object Reference` 类型的变量)没有跟着重新编译——结果重开 PIE 后 `Slot0Text` 等一圈 `bIsVariable` 子控件又双叒读出来是 `None`,现象和坑7一模一样,但这次跟 `SetWidget`/`SetWidgetSpace` 顺序无关(顺序完全没动)。把 `BP_TurnManager` 也重新 `compile_blueprint` 一遍(内容没改,单纯触发重编译)之后,问题消失。**教训**:这和"改了 Function 签名、调用点的 pin 对不上"是同一类问题(见坑"给 Function 新增/修改输出参数后…"那条)的 Widget 版本——**只要改了一个 Widget Blueprint 的内部结构(加子控件、加变量),所有持有"该 Widget 类型引用变量"的其它蓝图,都要跟着重新编译一遍,不能只编译改动的那一个**。以后但凡碰这种跨蓝图引用的场景,改完总是把"这个改动波及到的所有蓝图"都跑一遍 `compile_blueprint`,不要只编译直接改的那个。

### 坑10:`Class|<类名>|GetXxx` 里的类名必须和目标对象的真实类一致,写错类名不会报错,而是悄悄建出"另一个类"的同名属性 getter
之前(坑5)记录过"多个类有同名属性时,`find_node_types` 不传 `context_pins` 常只搜到本类的 `Variables|Default|GetXxx`,对跨对象取值无效"。这轮进一步实测清楚了根因和正确用法:**`create_node`/`write_graph_dsl` 里的 `Class|<类名>|GetXxx` 语法,`<类名>` 部分不是"随便找一个能用的前缀",而是真的按这个类名去查该类自己的成员**——`Col`/`Row` 在 `BP_Tile` 和 `BP_Unit` 两个类都有同名变量,`Class|BPTile|GetCol` 建出来的就是 `BP_Tile.Col` 的 getter(`self` pin 类型 `BP Tile Object Reference`),就算你把返回值硬接到一个 `BP_Unit` 引用上,`connect_pins`/`write_graph_dsl` 会直接报 `Could not connect pin ReturnValue to self`(类型不匹配)拒绝,不会静默出错——**但如果你压根没意识到自己抄错了类名,只看到报错信息里的"self"两个字,很容易误诊成"这个函数需要 self 参数"而不是"类名选错了"**。正确做法:目标是 `BP_Unit` 的 `Col` 就老老实实写 `Class|BPUnit|GetCol`,目标是 `BP_Tile` 的 `Col` 就写 `Class|BPTile|GetCol`,类名和实际对象类型对应,不要图省事抄别处代码里出现过的字符串。`create_node` 还额外支持传 `declaring_class` 参数(值为目标类的 Class 引用,如 `/Game/Maps/BP_Unit.BP_Unit_C`)显式消歧,`write_graph_dsl` 的 DSL 文本里没有等价语法,只能靠类名本身写对。

## 陷阱合集:一回合一次移动 + 攻击范围语义修正(2026-08-16)

### 坑11:`write_graph_dsl` 整函数重写时,如果图里有历史遗留的孤立(exec 不可达但数据仍互相连着)节点,重写可能悄悄把新逻辑接到**孤立分支**上,而不是报错
`ShowAttackRange` 在早前 v1→v2 迭代时留下了一整套 v1 的孤立节点(`GetAllActorsOfClass(BP_Unit)` 那套逐敌判定逻辑,`get_connected_subgraph` 一查有 40 个节点,`read_graph_dsl` 却只干净地显示 v2 那 5 行——因为 `read_graph_dsl` 只沿 `FunctionEntry` 真正的 exec 链路走,孤立分支不显示,但它们仍然通过共享的 `Unit` 参数等**数据 pin** 互相连着,`get_connected_subgraph` 这种无向遍历会把它们也扫进来)。这轮想把攻击半径从 `AtkRange` 改成 `MoveRange+AtkRange`,第一次尝试用 `write_graph_dsl` 整函数重写,直接在 `ManhattanDistance` 那步报 `Could not connect pin Unit to self`——**放弃整函数重写、改用增量 `create_node`+`connect_pins` 后,新插入的 Add 节点第一次被错误地接到了孤立分支的比较节点上**(因为凭"哪个 `GetAtkRange` 节点的输出连着 `Unit` 参数"这种数据侧线索去猜哪个是"活的"节点,猜错了——孤立分支的 `GetAtkRange` 同样直接吃 `Unit` 参数,数据侧完全看不出死活)。**唯一可靠的判活方法**:从 `FunctionEntry` 开始,只顺着 **exec pin**(`then`/`execute`/`LoopBody` 这类,不是数据 pin)一路 `get_node_infos` 往下走,能从 `FunctionEntry.then` 顺 exec 链路走到的节点才是活的;`find_nodes(entry_points_only=true)` 只能找到入口,不能证明其余节点是否可达,`read_graph_dsl` 虽然只显示活的逻辑,但它给出的是**逻辑摘要**,不直接暴露具体是哪个 `K2Node_XXX_N` 在跑,还得靠 exec 链路回溯去对号入座。**如果发现一个函数有历史孤立节点残留(`get_connected_subgraph` 节点数远超 `read_graph_dsl` 摘要能解释的量),优先纯粹顺 exec pin 追踪要改的具体节点,不要相信"这个节点吃了某个参数/变量"这类数据侧证据来判断它是否在执行路径上。**

### 坑12:`find_node_types` 返回的字符串本身也可能不可创建——即使它是**通过精确匹配的 `context_pins` 搜出来的**
坑5记录过"读出来的 type_id 和能建的 type_id 不是同一套字符串",这轮进一步实测:反过来,`find_node_types` **搜出来**的字符串也不保证能 `create_node`/`write_graph_dsl` 建出来。给 `BP_TurnManager.StartTurn` 加 `bGameOver` 判断时,依次试了三个来源都失败:①直接抄 `read_graph_dsl` 读出来的 `|GetbGameOver`(空前缀,报 `does not exist`,预期内,坑5已知);②改用常规 `Class|BPGridManager|GetbGameOver` 形式(同样报 `does not exist`);③改用 `find_node_types(type_id_filter="GameOver", context_pins=[<_grid变量输出pin>])` 精确搜出来的 `Variables|Default|GetGameOver`(**这次连搜出来的字符串本身都建不出来**,同样报 `does not exist`)。三次都失败后放弃了对 `bGameOver` 这个特定 getter 的整函数重写,改成对 `StartTurn` 做纯增量 `create_node`(只建 `Class|BPUnit|SetHasMoved`,没有触碰 `bGameOver` 相关的任何节点)。**教训**:`write_graph_dsl` 整函数重写只应该用在"函数里所有涉及的 type_id 都已经在这次任务中被验证过能创建"的情况;只要函数里有**任何一个**读出来正常但创建路径不确定的 getter(尤其是历史遗留、命名带 `b` 前缀的 Bool 变量,坑13),优先改用增量 `create_node`+`connect_pins`,别赌整函数重写会成功——失败是事务性的(不会破坏原图,可以放心重试),但反复试错烧时间。**如果确实需要用 DSL 整体重写包含某个不确定 getter 的函数,先用 `create_node` 单独试探性建一次那个 getter,确认可行再整体重写,不要直接在整函数 DSL 里第一次验证。**

### 坑13:Bool 类型成员变量的 type_id,创建时要去掉 `b` 前缀——`bHasMoved` 建的时候是 `HasMoved`
`add_variable` 里按 UE 命名规范传的变量名是 `bHasMoved`(Bool 类型加 `b` 前缀是 UE 的既定风格,`add_variable` 也确实照原样建出了一个叫 `bHasMoved` 的变量,`get_node_infos` 读它时 pin 名字也叫 `bHasMoved`),但 `create_node`/`find_node_types` 认的 **type_id** 里这个前缀被去掉了:`find_node_types(type_id_filter="SetbHasMoved")` 搜不到,搜 `"HasMoved"`(不带 `b`)才搜到 `Class|BPUnit|GetHasMoved`/`Class|BPUnit|SetHasMoved`(跨对象形式)和 `Variables|Default|GetHasMoved`/`Variables|Default|SetHasMoved`(self 形式)。**这大概率是所有 `b` 前缀 Bool 变量的通用规律**(`bGameOver`、`bIsMoved` 这类都可能一样),以后建类似节点时,先按"去掉 b 前缀"的形式去搜/建,而不是原样带 `b` 去猜。变量名本身(pin 上显示的名字、蓝图编辑器里看到的名字)依然带 `b`,只有 `create_node` 的 `type_id` 字符串不带——两者是两套独立的命名。

### 坑14(顺带记录):跨对象**设值**的 DSL 语法是"值在前、目标对象在后",和取值的"目标对象在前"参数顺序相反
`TryAttack` 里已有先例 `(Class|BPUnit|SetHP _returnvalue_15 Defender)`——`SetHP` 的两个参数是 `(新值, 目标对象)`,不是 `(目标对象, 新值)`。这次新增 `(Class|BPUnit|SetHasMoved false _output)` 照抄了这个顺序。**取值**的形式反过来是"目标对象在前、没有值参数":`(Class|BPUnit|GetCol Unit)`。两者顺序不对称,写的时候容易凭直觉搞反,尤其是从 Getter 抄参数顺序去写 Setter 的时候——下笔前找一个项目里已经在用的同类型 Setter 抄参数顺序,不要自己猜。`create_node` 建出来的 `SetXxx` 节点,`get_node_infos` 读出来的 input_pins 顺序是 `[execute(exec), <变量名>(值,默认带字面量), self(目标对象)]`——值 pin 排在 self 前面,和 DSL 文本的参数顺序一致,可以互相对照检查。

### 坑15(顺带记录):`create_node` 的算术运算符(`+`/`-`/`*`/`/`)不在 `find_node_types` 的搜索结果里,type_id 要从 `create_node` 工具自己的 docstring 里找
DSL 文本里的 `+`/`-`/`*`/`/`/`<=` 等符号是**解析器特殊语法**(见 `get_graph_dsl_docs`),不经过 `find_node_types` 这条路;但 `create_node` 增量建节点时不能直接传符号,得传具体 type_id。翻遍 `find_node_types(type_id_filter="Math|Integer|")`、`"Add"`、`"integer+integer"`、`"Promotable"` 都搜不到整数加法节点(反而 `<=`/`>` 这类比较符能在 `get_node_infos` 读出来的 type_id 里看到 `Math|Integer|integer<=integer` 这种字符串,但同样搜不到、建不出来——这些是节点创建后根据实际连线类型**自动解析**出来的显示名,不是可创建的种子 type_id)。**真正能建通用算术节点的 type_id 是 `Utilities|Operators|Add`(减/乘/除同理换成 `Subtract`/`Multiply`/`Divide`,推测,本轮只验证了 Add)——这个字符串写在 `create_node` 工具自身的参数说明里,不用靠 `find_node_types` 搜**,建出来是一个 `PromotableOperator` 通用节点(初始两个输入输出都是 `Wildcard` 类型),连上具体类型的 pin(比如两个 Integer 输出)后类型会自动解析确定,`get_node_infos` 复查一遍能看到解析后的 `type_id` 变成类似 `Utilities|TimeManagement|FrameNumber+Int` 这种(具体解析成哪个由 UE 内部决定,不用关心,只要输入输出 pin 类型对就行)。

## 陷阱合集:行动菜单(交互按钮 UI)开发实录(2026-08-16)

### 坑16:`create_node` 的 `declaring_class` 参数是解决坑10(类名撞名)的**可靠**手段,不是"额外支持"的边角功能
坑10记录过"类名写错会悄悄建出另一个类的同名属性 getter",这轮实测确认了正确的解法:`create_node(type_id="Class|BPUnit|GetRow", declaring_class={refPath: "/Game/Maps/BP_Unit.BP_Unit_C"})` 每次都能可靠建出 `self` pin 类型正确的节点(`get_node_infos` 复查确认过好几次),而不传 `declaring_class` 直接写 `Class|BPUnit|GetRow`(或者抄 `read_graph_dsl` 读出来的 `Class|GridSlot|GetRow`)大概率建出 `self` 是 `Grid Slot Object Reference` 的错误节点——**编译不报错**(因为这个节点本身是合法的,只是没连任何东西),必须靠 `get_node_infos` 主动核对 `self` pin 的 `type_id` 才能发现。**规矩更新**:凡是 `Col`/`Row`(或任何"多个类都有同名成员"的属性),`create_node` 一律带上 `declaring_class` 显式指定,不要省略这一步图省事——省略后"看起来建成功了"不等于"建对了"。反过来,`write_graph_dsl` 整函数解析时**不需要**手写 `declaring_class`,DSL 解析器自己会根据参数实际类型正确消歧(`ShowAttackRange`/`ShowRange` 现有代码里的 `Class|GridSlot|GetRow` 写法能跑通,就是因为它们是通过 `write_graph_dsl` 整函数创建的,不是 `create_node` 逐个建的)——**这个消歧能力只在 DSL 解析路径上生效,`create_node` 路径必须自己用 `declaring_class` 补上**。

### 坑17:`add_function_param` 不支持 Object 类的输入/输出参数,只支持基础类型和少数结构体
文档字符串明确列了支持的类型:`bool/int/float/byte/string/name/text` 和 `Vector/Rotator/Transform/Vector2D/LinearColor`——没有"任意 Object 引用"这一项。想给 `ShowActionMenu` 加一个 `Unit: BP_Unit` 输入参数时才发现这个限制。**解法**:不用函数参数传对象,改成"调用前先把值写进一个成员变量,函数内部读那个变量"的模式——本轮是调用方(`BP_Tile.ActorOnClicked`)先 `Set TurnManager.PendingActionUnit = SelectedUnit`,再调用不带参数的 `TurnManager.ShowActionMenu()`,函数内部自己读 `PendingActionUnit`。这也顺便解决了"多个地方都要用同一个'当前操作对象'"的问题(`HideActionMenu`/`UndoAction` 都要用到同一个单位引用,不用每次都传参)。**以后凡是想给自定义 Function 加对象类型参数,先假设这条路走不通,直接设计"参数化的成员变量"模式。**

### 坑18:`get_node_type_pins` 会在图里实际创建一个临时节点来读取 pin 信息,不是纯只读查询
调用 `get_node_type_pins(graph, type_id="Class|Widget|SetVisibility")` 后,返回的 pin 信息里 `node.refPath` 指向一个真实存在的 `K2Node_VariableSet_N`——**这个节点是这次调用本身建出来的**,不是预先存在的。实测紧接着 `read_graph_dsl` 复查,该函数体仍然是空的(`(fn ShowActionMenu ())`),说明这个探测节点要么没有被计入"活跃"图(exec 不可达,不出现在 DSL 摘要里),要么被工具自己清理了——总之**没有污染最终产物**,但如果后续还要在同一个函数里手动核对节点数量(比如用 `find_nodes` 数节点总数来判断"这个函数是不是意外变复杂了"),要留意这类探测调用可能会让计数偏高。这次没有深究到底是"从不真正持久化"还是"事后被撤销",只确认了**最终编译产物是干净的**,不必因为这个工具的存在而改变工作流程,正常用就行,只是心里有个数,不要被 `find_nodes` 数字的短暂波动搞糊涂。

### 坑19:项目现有的 3D Actor 点击(`bEnableClickEvents`)和 UMG 交互控件(按钮点击)走的是两套不同的输入路由,加按钮前必须显式切输入模式
项目一直靠 `PlayerController.bEnableClickEvents=true` + 纯 `Game` 输入模式驱动 `ActorOnClicked` 事件(`BP_Tile`/`BP_Unit` 全靠这个),这套路径下鼠标点击直接做 3D 场景拾取,**不会路由给屏幕上的 UMG 控件**——`WBP_OrderBar`/`WBP_HealthBar`/`WBP_GameOver` 之前都只是纯展示,没人点过它们,所以这个问题一直没暴露。这轮第一次加交互按钮(`WBP_ActionMenu`)时,补了 `Input|SetInputModeGameAndUI(GetPlayerController(0))` 在 `ShowActionMenu` 里切到"游戏+UI"混合输入模式(弹菜单时),`HideActionMenu` 里再 `Input|SetInputModeGameOnly` 切回纯游戏模式(该恢复 3D 点击了)。**这一步本身没有被人工 Play 验证过是否真的让按钮收到点击**——纯粹是按 UE 的标准输入路由规则做的防御性修复,MCP 工具集没有"模拟鼠标点击某个 UMG 按钮"的通用能力去验证,只能靠人工 Play 确认。**以后项目里如果还要加别的交互 UI(不只是按钮,任何需要接收鼠标事件的 UMG 控件都一样),都要检查是不是也需要这套输入模式切换**,不要假设"Widget 加到 Viewport 上了就自动能收到点击"。

## 陷阱合集:行动菜单 bug 排查(2026-08-16,火纹对比后动手修复)

### 坑20:`write_graph_dsl` 整函数写入时,**局部绑定变量**(`Variables|Default|GetX` 的结果)身上的 Col/Row 这类撞名属性,坑10/16 记录的"DSL 解析器自己会消歧"结论不总成立——第二次引用同一个变量的撞名属性时会连错
坑16 说"`write_graph_dsl` 整函数解析不需要手写 `declaring_class`,解析器自己会根据参数实际类型正确消歧",这轮实测发现这个结论**对函数参数(FunctionEntry 的 pin)成立,对局部 `bind` 出来的变量不成立**——新建 `ShowAttackRangeCurrent()` 时,`(bind _unit (Variables|Default|GetSelectedUnit)) (bind _ucol (Class|BPUnit|GetCol _unit)) (bind _urow (Class|GridSlot|GetRow _unit))` 这段代码,第一次用 `_unit` 取 `Col` 能成功,**第二次用同一个 `_unit` 取 `Row`(写成 `Class|GridSlot|GetRow`,抄自 `read_graph_dsl` 读旧代码时看到的显示形式)就报 `Could not connect pin SelectedUnit to self`**——因为 `GridSlot|GetRow` 不是一个真实可写的 type_id,只是"给 BP_Unit 建 Row getter"这件事在 `read_graph_dsl` 反编译时的**显示名怪癖**(坑10/16 已经记录过这个怪癖存在,但当时以为只影响 `create_node` 路径,这轮证实 `write_graph_dsl` 路径同样受影响,只是报错更隐蔽——报的是"pin 不兼容",不是"does not exist",容易误诊成别的问题)。**规矩更新**:不管是 `create_node` 还是 `write_graph_dsl`,只要是给 `BP_Unit` 取 `Row`,永远写 `Class|BPUnit|GetRow`,**不要抄 `read_graph_dsl` 读出来的 `Class|GridSlot|GetRow`**——读和写不对称,读出来的字符串只保证"人类看得懂大概是干嘛的",不保证能原样喂回去。同理排查："Could not connect pin <变量名> to self" 这个报错,不一定是"没传 self"或"类型真不兼容",大概率是"用错了显示名而非可写 type_id",优先检查是不是撞名属性、类名是不是从 `read_graph_dsl` 抄来的。

### 坑21:一段"移动完成后清理"的收尾代码里混进了一条属于"结束操作"语义的逻辑,导致后续所有"移动后还想再操作这个单位"的功能全部静默失效——教训是"收尾代码"要按"这一步真正对应哪个语义阶段"分类,不能全堆在一起
`BP_Tile.ActorOnClicked` 的移动分支收尾原本是 `ClearHighlights → SetCol → SetRow → SetSelectedUnit(None)`——这条 `SetSelectedUnit(None)` 是行动菜单系统上线**之前**就有的老代码(坑记录里 2026-08-13 那次编译修复提到过这个节点),当时的语义是对的:那时候点完格子移动就是这个单位本回合唯一能做的事,移动完清空"当前选中"完全合理。**行动菜单系统上线后,这条老代码的语义已经过时了,但没人回头检查它是否还该留在这里**——移动之后玩家还要通过菜单选"攻击/待命/撤销",这几个后续操作全都要读 `GridManager.SelectedUnit` 才知道"当前操作的是哪个单位"(`TryAttack` 内部就是这么读的),移动那一刻就把它清空,直接导致:点"攻击"再点敌人,`TryAttack` 读到 `SelectedUnit` 已经是 `None`,内部唯一的 `if IsValid` 判断直接跳过整个函数体(**没有 else 分支,静默什么都不做**);`BP_Unit.ActorOnClicked` 敌方分支紧接着又读一次 `SelectedUnit`,同样是 `None` → 判定"IsValid 变成了 Not Valid"(因为它本来就是 Not Valid,不是 `TryAttack` 打完后才变的)→ 误判成"已经打过了"直接 `EndTurn`——**表现就是用户反馈的"点攻击再点敌人没有反应",而且回合还悄悄结束了。**
**排查方法**:没有靠猜或加 `PrintString`,而是顺着"点击→事件→读哪个变量→这个变量什么时候被写"这条数据流,把 `BP_Tile.ActorOnClicked`(移动收尾)、`BP_GridManager.TryAttack`(攻击判断)、`BP_GridManager.ShowRange`(唯一的 `SetSelectedUnit` 写入点)三个函数的 `read_graph_dsl` 完整读了一遍,直接在收尾代码里看到这条不该在那个时机出现的 `SetSelectedUnit(0)`,不需要人工 Play 复现就已经能确认根因。
**修法**:把"清空 SelectedUnit"这个动作,从"移动刚完成"这个时机,挪到真正"这个单位的回合彻底结束"的时机——也就是 `StandbyAction()`(待命按钮,补了一条 `Class|BPGridManager|SetSelectedUnit(0, Grid)`)。`TryAttack` 命中时本来就会自己清空(见 `TryAttack` 最后一步),`UndoAction` 因为"撤销=当作没行动过",干脆不清空(保持 `SelectedUnit` 还指着这个单位,后续再点自己重新触发 `ShowRange` 也会重新写一遍,不影响)。
**教训**:一段"收尾清理代码"里的每一行,都要能明确回答"这一步对应的是哪个语义阶段的结束"——`ClearHighlights`/`SetCol`/`SetRow` 对应的是"移动这个动作完成",`SetSelectedUnit(None)` 对应的是"这个单位的整个回合/操作序列完成",**两者时机不同,混在一起写只在"移动即回合结束"这个旧设计下恰好成立**,新增中间状态(移动后还能弹菜单选择别的操作)时,必须把"移动完成"和"操作序列完成"两个时机的收尾代码分离到各自真正发生的地方,不能图省事全堆在移动那一步的末尾。

## 陷阱合集:技能与遗物最小闭环开发实录(2026-08-16)

### 坑22:`create_node` 跨蓝图调用"另一个蓝图上的自定义 Function"时,正确的 `type_id` 格式是 `Class|<类名>|<函数名>`,不是 `CallFunction|<函数名>`——即使 `find_node_types` 带正确 `context_pins` 精确搜出来的就是 `CallFunction|<函数名>` 这个字符串
本轮新建 `BP_GridManager.ApplyStartingRelics()`(无参数)后,想在 `BP_TurnManager.EventBeginPlay` 里插入一次调用,`create_node(type_id="CallFunction|ApplyStartingRelics")` 报 `does not exist`;`find_node_types` 传上正确的 `context_pins`(指向一个 `BP_GridManager` 引用的输出 pin)精确搜出来的候选**恰好也是** `CallFunction|ApplyStartingRelics` 这个字符串,直接拿去建**同样失败**(和坑12"搜出来的字符串本身也可能不可创建"是同一现象,这次终于找到了系统性规律,不再是"未知原因")。同样的情况在给 `WBP_ActionMenu` 调用 `BP_TurnManager.SelectSkillAndAttack` 时也踩到过一次。**规律**:`CallFunction|<函数名>` 这个前缀形式只对"自己蓝图内部的自定义 Function"(self-context)有效;调用**另一个蓝图**上的自定义 Function,必须用 `Class|<目标类名>|<函数名>` 这个前缀形式(和跨对象取值 `Class|BPUnit|GetCol` 是同一套命名体系),并且最好同时传 `declaring_class` 显式指定目标类——`Class|BPGridManager|ApplyStartingRelics` + `declaring_class={refPath: ".../BP_GridManager.BP_GridManager_C"}` 一次建成功。**以后凡是 `create_node` 建"调用别的蓝图自定义函数"的节点,一律直接用 `Class|<类名>|<函数名>` 形式起手,不要先试 `CallFunction|` 前缀再踩坑。**

### 坑23:对一个已经跑通的 EventGraph 事件做 `write_graph_dsl` 整体重写,哪怕文本是原样照抄 `read_graph_dsl` 的输出 + 只加一行,也可能在**完全没动过的旧代码行**上报类型不兼容错误
给 `BP_TurnManager.EventBeginPlay` 插入一次 `ApplyStartingRelics()` 调用时,先尝试了"读出完整 DSL → 原文本里插入一行 → 整体 `write_graph_dsl` 写回去"这个看似最简单的做法,结果报 `Could not connect pin ActionMenuWidget to bNewVisibility`,报错定位在 `(Rendering|SetVisibility "Collapsed" _actionmenuwidget)` 这一行——**这行文本和读出来的一模一样,本轮完全没有修改它**,但整体重写时解析出了不同的节点(命中了某个"接受 bool 而不是 Visibility 枚举"的同名 `SetVisibility` 重载,大概率是 Actor/Component 通用的那个可见性开关,而不是 Widget 专用的枚举版本),原来是靠增量 `create_node`/`connect_pins` 一步步搭出来的图里没有这个歧义(因为当时是显式建的 Widget 专用节点)。和坑16 的教训是同一类现象("write_graph_dsl 整函数解析不需要 declaring_class,解析器自己会消歧"这个说法不总成立)在 EventGraph 层面的新案例。**教训**:凡是要往一个**已经验收过、正常工作的**大 EventGraph 事件里加东西,哪怕只加一行,只要该事件本身逻辑不简单(有过 Widget/组件相关的同名方法歧义史),优先用增量 `create_node`+`connect_pins` 插入,不要图省事做"读出来改一行再整体写回去"——这类整体重写只在**全新空函数**或**逻辑足够简单确认没有歧义历史**的场合下才可靠。这次改用 `create_node(type_id="Class|BPGridManager|ApplyStartingRelics", declaring_class=...)` + `connect_pins` 精确插入到 `SetGrid.then` 和 `BuildTurnOrder` 调用之间,完全没有触碰 `SetVisibility` 那几行,一次成功。

### 坑24(重要,容易造成静默错误的游戏数值 bug):给新建 Function 加输出参数(`add_function_param(..., input_param=false)`)之前就先用 `write_graph_dsl` 写含 `(return X)` 的函数体,会编译成功但函数其实是 **void**——`(return X)` 里的值被悄悄丢弃,调用方读不到任何返回值,graph 里也看不出报错
新建 `GetTypeMultiplier` 时,第一次是"先 `add_function_graph` → 直接写 `(return 1.0)`/`(return 2.0)` 等多分支返回值的函数体 → `compile_blueprint` 无报错"——但 `read_graph_dsl` 读回来发现所有分支体都显示成占位符 `_`(不是具体数值),用 `find_nodes` 查这个函数的节点列表,**压根没有 `K2Node_FunctionResult` 节点**;进一步用 `get_node_type_pins` 探测这个函数的调用点签名,确认它只有 `execute`/`then` 两个 Exec pin,**没有任何数据输出 pin**——函数虽然逻辑上算出了正确的分支值,但从未真正"返回"过,是个不折不扣的 void 函数,调用方无法获取任何计算结果。这是本轮踩到的最危险的一类坑:**编译不报错、图看起来完整、DSL 摘要甚至显示了"看似正确"的分支结构,唯独漏了最关键的返回值——不主动用 `find_nodes`/`get_node_type_pins` 交叉核实,根本发现不了。** 如果这次没有多问一句"这函数真的返回东西了吗",这个 `GetTypeMultiplier` 会被接到 `TryAttack` 的伤害公式里,导致"属性克制"这个核心玩法数值**永远是默认值、完全不生效**,而所有自动化测试和编译检查都会显示一切正常。**修法**:`remove_function_graph` + `add_function_graph` 重建,**先用 `add_function_param(..., input_param=false)` 显式声明输出参数**(这一步会自动生成一个带正确 pin 的 `K2Node_FunctionResult_0`),**确认后再** `write_graph_dsl` 写函数体——这次 `(return X)` 的每一处都正确生成了独立的 `K2Node_FunctionResult` 节点(一个函数体里多处 `return` 完全没问题,每处各自建一个 Return 节点,`get_node_infos` 逐个核对输入 pin 的值和连接来源即可验证)。**规矩**:任何新建的、需要有返回值的 Function,`write_graph_dsl` 写函数体之前,一律先用 `add_function_param` 把输出参数声明好;写完之后,一律用 `find_nodes` 确认存在至少一个 `K2Node_FunctionResult` 节点、再用 `get_node_infos` 核对它的值 pin 确实接了东西,不能只看 `compile_blueprint` 不报错就认为函数是对的。

## 陷阱合集:输入模式反复横跳导致点击时灵时不灵(2026-08-16)

### 坑25:`SetInputMode_GameAndUI`/`SetInputMode_GameOnly` 来回切换(不是切完就不管了),会导致 3D Actor 点击"有时候一下就好,有时候要点两下"——正确做法是切一次就永远留在 `GameAndUI`,不要切回去
坑19 当时只确认了"加交互 UMG 按钮必须切输入模式",但没深挖"切回去"这一步是否安全。这轮用户实测反馈两个现象:①"移动有时候点一下就可以,有时候要双击";②"不能原地攻击"(点自己单位不移动、直接点相邻敌人,没反应)。排查思路:这两个现象都发生在"该单位这次操作之前,输入模式是否处于 `GameAndUI` 到 `GameOnly` 的过渡态"这个条件附近——`ShowActionMenu` 每次弹菜单都切到 `GameAndUI`,`HideActionMenu` 每次都切回 `GameOnly`,一局游戏里这个来回切换会发生几十上百次。UE 的 `SetInputMode_GameOnly`/`SetInputMode_GameAndUI` 底层会重新设置 Viewport 的鼠标捕获/焦点状态,连续快速切换时不保证在下一次点击到达前完全生效——第一次点击可能被"重新夺回 Viewport 焦点"这个动作本身消耗掉,不会被当成语义上的"点击 Actor"事件,必须再点一次才算数,这解释了"有时候要双击"。而"不能原地攻击"是同一根因的另一种表现:原地攻击这个操作**完全不经过 `ShowActionMenu`/`HideActionMenu`**(菜单只在移动之后才弹),如果上一个单位的操作恰好让输入模式停留在 `GameAndUI` 过渡态(比如上一次点了菜单按钮),当前单位点自己 + 点敌人这两次点击都可能被吞。
**修法**:`bEnableClickEvents` 驱动的 3D 点击(`ActorOnClicked`)在 `GameAndUI` 模式下本来就能正常工作(只要鼠标没有点在会拦截点击的可见 Widget 上,项目里除了 `WBP_ActionMenu` 之外的其它 Widget 都是纯展示、行动菜单本身隐藏时是 `Collapsed` 不参与命中测试)——**没有必要在隐藏菜单时切回 `GameOnly`**。直接把 `HideActionMenu` 里的 `Input|SetInputMode_GameOnly` 那个调用删掉(`ShowActionMenu` 里的 `SetInputModeGameAndUI` 保留,反正切换到同一个模式是幂等的,多切几次无害),让游戏从第一次弹出菜单开始就永久停留在 `GameAndUI` 模式,不再有"从 A 模式过渡到 B 模式"这个不稳定窗口。**教训**:任何"临时切一下输入模式,用完再切回去"的模式,如果这个"用完"的时机很频繁(每次菜单交互都触发),来回切换本身就是风险源——优先考虑"只切一次,永久留在新模式"这种更简单的方案,而不是精心维护一对"切入/切出"逻辑。

### 附带修复:攻击技能选择在"原地攻击"(不走行动菜单)路径下会读到上一个单位的残留值
`BP_TurnManager.PendingSkillIsElemental`(记录玩家选了"普通攻击"还是"元素技能")只在点行动菜单按钮(`SelectSkillAndAttack`)时才会写入,原地攻击(不移动、不经过菜单)直接点敌人时,`BP_Unit.ActorOnClicked` 依然会读这个变量传给 `TryAttack.bUseSkill2`——如果没有归零,读到的是**上一个单位**、**上一次**选的值,而不是"这个单位这次没做任何选择,应该默认普通攻击"。修法:在 `StartTurn` 我方分支重置 `bHasMoved=false` 的同一处,顺手加一行 `SetPendingSkillIsElemental(false)`,保证每个单位轮到自己时这个选择清零成"默认普通攻击",除非本回合真的移动后又在菜单里选了元素技能。

## 陷阱合集:反击系统 + 攻击预测 UI 开发实录(2026-08-16)

### 坑26(重要,真实数值 bug):`write_graph_dsl` 里,一条数据链路只要最终喂给了某个"属性 Setter"(比如 `Class|BPUnit|SetHP`)的值 pin,哪怕这条链路已经拆成好几个独立的 `bind` 语句、完全没有内联嵌套,链路里任何一次**带 exec pin 的非纯函数调用**(比如 `ComputeSkillDamage`,内部有随机数+分支)都可能被**悄悄复制成两份独立调用**——一份在 if 分支外面提前算好喂给 Setter,另一份在 if 分支里面按原样重新调一次(通常是为了别的用途,比如打印)。两份调用各自独立掷骰子,结果可能完全不同。
本轮写 `ResolveCounterAttack` 时,原始写法是:
```
(if (and ...)
  (bind _dmg (CallFunction|ComputeSkillDamage ...))
  (bind _newhp (Math|Integer|Max(Integer) (- (GetHP _countertarget) _dmg) 0))
  (Class|BPUnit|SetHP _newhp _countertarget)
  ...
  (Development|PrintString ... _dmg ...))
```
`read_graph_dsl` 读回来发现:`ComputeSkillDamage` 被调用了两次,一次在 if **外面**(全局作用域)算出 `_returnvalue`/`_returnvalue_1` 喂给 `SetHP`,另一次在 if **里面**单独为 `PrintString` 重新调用一次算出 `_damage`——**两次独立掷骰,SetHP 用的伤害值和打印出来的伤害值完全可能对不上**,而且哪怕 counter-attacker 已经死亡/不在射程内(if 条件为假),外层那次调用依然会执行、白白消耗一次随机数。**改成完全拆分成独立语句(每一步一个 `bind`,不做任何算术包裹)之后,这个复制 bug 依然原样复现**,说明问题根源不是"嵌套导致的意外求值顺序",而是 `write_graph_dsl` 对"最终流向某个 Setter 值 pin 的表达式"有一种类似"提前预计算/物化"的内部处理逻辑,会在这个过程中重新生成一份独立的调用链,而不是复用已经 `bind` 好的节点。
**唯一验证有效的修法**:在需要复用的非纯调用结果和它的消费者之间,插入一次**真正的 exec 语句**(用 `Variables|Default|SetXxx(表达式)` 把结果存进一个局部/成员变量),强制在这个精确的 exec 时间点完成一次求值并"物化"成一个具体的值;之后所有需要用这个结果的地方,一律通过 `Variables|Default|GetXxx` 读这个变量,不要再直接引用原来的 `bind` 名字或让原表达式本身流向任何 Setter。这次给 `ResolveCounterAttack` 加了一个 `CounterDmgTmp`(Int)局部变量,`SetCounterDmgTmp (ComputeSkillDamage ...)` 后再全部读 `GetCounterDmgTmp`,`read_graph_dsl` 验证只剩一次调用,数值正确。**这是坑3(纯函数被错误当同一节点复用导致读到旧值)的镜像问题**——坑3是"该分开的被合并了",这次是"该合并的被拆开复制了",但两者的修法完全一样(都是靠显式 `Set` 强制物化一次快照),以后遇到"图看起来对、数值却对不上"的诡异情况,无论是"复用"还是"复制"方向,都先怀疑这条路。
**补充观察**:同一轮写的 `ShowAttackForecast` 里,`(bind _damage (CallFunction|PreviewSkillDamage ...)) (Variables|Default|SetFcDmg _damage)` 这种"先 bind 再直接 Set,中间不做任何算术包裹"的写法,`read_graph_dsl` 验证**没有**复制成两份——这暗示触发复制的条件可能更接近"表达式在流向 Setter 之前经过了额外的纯运算符包裹(`Max`/`-` 等)",而不是任何间接引用都会触发。但鉴于成本很低、后果很严重(游戏数值静默出错),**以后凡是"非纯函数调用的结果需要喂给任何 Setter 或者被多处使用"的场景,一律无条件走 Set-then-Get 快照模式,不再赌"这次会不会触发"。**

### 坑27:`create_node` 建"调用另一个蓝图自定义函数"节点失败时,不要死磕 `CallFunction|` 前缀,直接换 `Class|<类名>|<函数名>` + `declaring_class`(坑22 的进一步确认)
本轮再次在两个新场景下复现了坑22的规律:`BP_TurnManager.EventBeginPlay` 里插入 `ApplyStartingRelics()` 调用时,`create_node("CallFunction|ApplyStartingRelics")` 报 `does not exist`,换成 `create_node("Class|BPGridManager|ApplyStartingRelics", declaring_class=BP_GridManager)` 一次成功;`BP_Unit.EventGraph` 里插入 `TurnManager.ShowAttackForecast()`/`SetPendingAttackTarget()` 调用时同样如此。**规矩已经稳定复现三次,可以确认为通用规律**:`create_node` 建自身蓝图内部函数用 `CallFunction|`,建**另一个蓝图**的自定义函数一律直接用 `Class|<目标类名>|<函数名>` + 显式 `declaring_class`,不要再浪费一次 `CallFunction|` 尝试。

### 已知测试脚动:加入命中率后,`RunRegressionTests` 的 T5/T6a 偶尔会假性 FAIL(~5% 概率),不是真回归
`ComputeSkillDamage` 内部会真的掷骰子判定命中(基础攻击 95% 命中),`RunRegressionTests` 里 T5(`TryAttack_DamagesDefender_HP`)和 T6a(`HealthBar_DecreasesAfterDamage`)都是靠一次性的 `TryAttack` 调用断言"HP 确实下降了"——如果那一次刚好掷出了 MISS(约 5% 概率),攻击不造成伤害,这两条断言就会假性 FAIL,`Output Log` 里能看到 `MISS`(而不是某种真实错误)紧跟在失败的测试前面。**排查步骤**:T5/T6a FAIL 时,先查一下失败那次运行的 log 里紧邻的是不是 `MISS` 字样——如果是,直接重跑一遍regression即可,不是代码退化。这是给战斗系统加入随机数之后必然引入的测试不确定性,目前没有对 `RunRegressionTests` 做"保证命中"的特殊旁路,可以接受(重跑成本很低)。

### 坑31:对 `ConstructObjectfromClass` 出来的 `EditableTextBox` 调 `GetText`,经常拿到空串,尽管 Details 里 `text` 默认值还在
`ApplyDebugLoadout` 用 `Widget|GetText(TextBox)` 读遗物 CSV 和五个技能槽,PIE 里 Grid 变成 `EquippedRelicIds=[]`、`SkillSlots=[]`、`bRelicFallbackToSlice=false`。空技能槽走 `GetSkillSlotName` 回退,行动菜单效果还是 basic/heavy/ember/aqua/vine,玩家会觉得「APPLY 了但技能没变」。`text` UPROPERTY 仍显示默认字符串,不能当 GetText 的证据。**如果要读输入框,必须在 `EventConstruct` 里 `Widget|SetText(TextBox)` 再写一遍默认值**;预设按钮可以继续用写死的 `ParseCommaSeparatedNames`。中文名不能直接当 FName 行名,要先 `SkillTokenToId` / `RelicCsvToIds`。自定义路径后来改成下拉;`GetText` 空仍是真坑,但 08-17 APPLY 清空的验收根因是坑37,不要把本条当唯一解释。

### 坑35:关卡里的 `BP_GridManager` 把 `bRelicFallbackToSlice` 覆盖成 false,开局顶栏就是空遗物
**验收根因(开局没遗物)**:蓝图 CDO 是 true,但 TestMap 放置实例曾是 false。PIE 复制的是关卡实例不是 CDO。开局 `EquippedRelicIds` 空 + fallback false → `BuildRelicLoadout` 不读 `bEnabledInSlice`。英文 `(no relics)` 只说明当时 C++ 空文案还是旧字符串,**不是开局为空的原因**;不要把「没 Compile C++」写成开局没遗物的根因。自定义 APPLY 会在 PIE 里把 fallback 关掉;若点了「保留模拟更改」,false 写回关卡,下次一打开就没遗物。修法:`reset_properties` 掉实例覆盖;不要 Keep Simulation Changes。查的时候 `tiles=[]` 的 `_C_1` 是编辑器关卡实例,不是 PIE 副本。

### 坑33:`ComboBoxString` 的 DefaultOptions / selectedOption 运行时经常是空的,必须自己 AddOption
和坑31同一类:资产里写了选项,Play 时 `GetSelectedOption` 仍可能是空串。运行时 `FillRelicCombo`/`FillSkillCombo`(`ClearOptions`→`AddOption`→`SetSelectedOption`)是防护层。这四个节点必须 `create_node` + `declaring_class=/Script/UMG.ComboBoxString`,DSL 里写 `ComboBox|AddOption` 会接到错误类型。不要 `write_graph_dsl` 重写已经用 create_node 搭好的 Fill 函数。**不要把「只缺 FillCombo」写成 APPLY 清空的唯一原因**;验收后主因是坑37。

### 坑34:带 Exec 的自定义函数不能当纯表达式调用,否则会被 prune,返回值变默认空串
`RelicCsvToIds` 里嵌 `CallFunction|RelicCsvtoIdsB`、`SkillTokenToId` 里嵌 B,编译器报 `was pruned because its Exec pin is not connected, the connected value is not available and will instead be read as default`。这是真警告,返回值会变默认空串,所以对照必须内联进 A。**当时误把 B prune 写成 APPLY 清空的唯一原因**;验收时主路径已经不调 B,清空仍发生,真正打穿的是坑37 + 无条件关 fallback。`if` 当语句用(匹配就 `return`),不要 30 层 `elif` 手数括号。

### 坑37:`GetComboOption` 的 Return 节点 Exec 没接 FunctionEntry,返回值按默认空串(APPLY 清空的验收根因)
带 Exec 的自定义函数如果 Return 的 execute pin 悬空,函数会跑完但返回值是类型默认值(String 就是 `""`)。DoApply 用这个空串 `SetText` 覆盖 Construct 里已经写好的中文默认 CSV,再调 `ApplyDebugLoadout`;当时 APPLY **无条件** `SetbRelicFallbackToSlice false`,于是 `EquippedRelicIds=[]` + fallback false → 顶栏空。空 `SkillSlots` 走 `GetSkillSlotName` 回退开局 5 技能,看起来「APPLY 了技能没变」。`get_node_infos` 能看出 Return.execute 没连;`read_graph_dsl` 不一定写得清楚。修法:Entry.then → Return.execute;下拉空串则**不覆盖**隐藏框;解析 0 件遗物时 fallback 设回 true。

### 坑36:排查结论只追加、不改写旧条目,文档里会长期留着已被否决的「当前真相」
08-17 配装问题查了好几轮,中间把开局空遗物写成「没编 C++」、把 APPLY 清空写成「只缺 FillCombo」或「只是 RelicCsvToIdsB prune」。这些曾写进 `UE实操教程.md` 续接区和测试清单,后来查清了只在文件末尾再加一条,前面的误判还当现状。下个会话会按文档把错因再修一遍。规矩:新结论必须回头把否决掉的旧条目标「误判/已否决」;验收后只留最终根因(本轮:坑35 开局、坑37 APPLY)。

### 坑32:蓝图里 String 不能用 `==`,嵌套 `select` 一次不要超过约 20 层
`==` 接 String pin 会报 `Could not connect pin Token to A`。用 `Utilities|String|EqualExactly(String)`。31 个技能一次性 nested select 会 `Unexpected )` / 写不进去,拆成 `SkillIdToChinese` + `SkillIdToChineseB` 再 `CallFunction|SkillIdtoChineseB self Token`(注意生成的 type_id 会把 To 收成 to)。同蓝图纯函数当表达式用时 target 是 `self`,参数在后面。

### 坑30:Canvas 点锚点时 `offsets.right/bottom` 是尺寸,不是边距
`WBP_DebugLoadout` 右贴边用 `anchors min(1,0) max(1,1)`(X 轴 min==max,是点锚点;Y 轴才是拉伸)。设计者把 `right=8` 当成「离右缘 8px」,引擎却把 Right 当成**宽度 8**。运行时 `bDebugPanelOpen=true`、Visibility=Visible,截图上却几乎没有面板。修法:改成屏幕中心点锚点 + `SizeBox` 写死 560×780,`bAutoSize=true`。**X 轴要贴边拉伸必须让 min.x ≠ max.x**(例如 1,1 配不上宽度)。

### 坑29:UMG `EditableTextBox` 默认 `minimumDesiredWidth=0` 且 `widgetStyle.backgroundImage*.imageSize={0,0}` 时,期望高度≈0
`WBP_DebugLoadout` 里遗物 CSV / 五个技能槽资产都在、`visibility=Visible`、也有默认文本,Play 截图却只剩 AUTO/RANDOM/APPLY/CLOSE。按钮自带样式所以有高度;输入框被 VerticalBox 按 Desired Size 排布时高度塌掉,看起来像「没有列表」。修法:给每个 `EditableTextBox` 设 `minimumDesiredWidth`(本项目 320)并把 `backgroundImageNormal.imageSize.y` 设成 ≥28、`drawAs=Box`;长内容外面包 `ScrollBox`(滚轮 `Always`)。**不要**用「控件在 WidgetTree 里」推断运行时可见。

### 坑28:预览和结算必须调同一个 C++ 函数,命中骰只能在确认时掷
蓝图里曾经两套公式(预览硬编码 0.9/1.4 + `GetTypeMultiplier_0`,结算查表 + 克制 ×2 + 遗物乘区),表现就是「面板 11 点、确认秒杀 20 血」。修法:两边都只调 `UCombatFormula::CalculateSkillDamageValue`,用 `bRollHit` 区分。**不要把命中骰放进预览**,否则面板每次点开都可能显示 0。反击预览如果也读 `PendingSkillRowName`,必须先快照再改成 `basic` 再还原,否则点确认会打出普通攻击。

## 通用陷阱:整数除法截断(2026-08-15,血条百分比 bug)

`(/ a b)` 里 `a`、`b` 都是 Integer 时,DSL/蓝图的除法节点做的是**整数除法**,不会因为下游 pin 要 Float 就自动升格成浮点除法——`15/20` 算出来是 `0`,不是 `0.75`。这个坑在"两个整数变量算比例"的场景特别容易中招(血条百分比、进度条、任何 `当前值/最大值` 的场景),而且**编译不报错、运行不报错、单纯数值不对**,很难从代码本身看出来,得靠"实际数值 approximately 0" 这种现象反推。**只要是拿两个 Integer 变量算"比例"、"百分比"这类需要精度的结果,必须显式 `Math|Conversions|ToFloat(Integer)` 转换后再做除法**,不要依赖隐式转换。回归测试里判断这类值时,除了"变了"(`< 原值`)也要顺手判断"没被腰斩成 0"(`> 0`),否则测试会把这个 bug 放过去(本轮真实踩过:`T6` 断言写成"< 1.0"没抓到,加了个"> 0.0"的 `T6b` 才抓到)。

- **`Class|Factory|SetText` 不是 TextBlock.SetText**(2026-08-16,遗物条):会接到 Factory 的 Bool `bText`,报 `Could not connect pin ReturnValue to bText`。TextBlock 正确节点是 **`Widget|SetText(Text)`**,参数顺序是 `(target, ToText(String))`。`WBP_AttackForecast.SetHpForecast` 已验证。

- **`read_graph_dsl` 把 `BP_Unit.GetRow` 显示成 `Class|GridSlot|GetRow` 是别名,不是真用了 UMG**(2026-08-16):`get_node_infos` 里 self pin 类型是 `BP Unit Object Reference` 才算数。不要只凭 DSL 就整段重写 SpawnUnit/StartTurn 的 Col/Row。反过来,`UndoAction` 里 `GameplayAbilityTargetActor|GetStartLocation` 是真错,必须改成 `Class|BPUnit|GetStartLocation`。

- **`ApplyStartingRelics` 的 Break 必须接 `BuildRelicLoadout` 的返回值,不能接 Build 之前的 `GetRelicCache`**(2026-08-16):DSL 会把 Break 写在函数最前面,exec 上却是先 Build 再 Set。Break 若仍读旧缓存,遗物加成全是 0,公式看起来「永远不对」。增量修法:把 Break 的 struct 输入从 `GetRelicCache` 改接到 Build 的 `ReturnValue`。

## 请求用户回传时的省 token 原则

- **默认不要求整张 EventGraph** —— 只要新加的那几个节点 + 它们连接的邻居节点。整图回传只在"怀疑有旧节点/其他事件干扰"时才要。
- 复杂改动优先做成**独立 Function**(像 ShowRange/StartTurn/EndTurn),而不是往 EventGraph 里加分支——Function 出错时可以整体重新生成替换,不需要连蒙带猜patch。

### 坑38:`write_graph_dsl` 对历史遗留的 `|GetXXX`/`|SetXXX` 裸写法读写不对称,回写会 `AssertionError: does not exist`(2026-08-17,TPS 迁移阶段A)
`read_graph_dsl` 能把 `BP_TurnManager.StartTurn` 读成含 `(|GetbGameOver _grid)`(无左侧类名前缀)这种简写,但把**原样未改动**的同一段脚本喂回 `write_graph_dsl` 会报 `The node could not be created / |GetbGameOver does not exist`——验证过不是我改坏了语法,是这套 DSL 工具链本身读写不对称,对这类旧函数**任何** `write_graph_dsl` 整函数重写都会炸,哪怕一个字都不改。以后要给这类历史函数(尤其是 5-15 版本之前生成的、带裸 `|GetXXX` 语法的老函数)加逻辑,一律用 `find_nodes`/`get_node_infos` 先读清楚现有节点和 pin index,再用 `create_node`+`connect_pins`(要在中间插入用 `break_pins` 先断开旧连接)做增量编辑,不要赌整函数回写能过。`BP_TurnManager.StartTurn` 加 Possess/UnPossess + AddMappingContext/RemoveMappingContext 就是这么手搭的。

### 坑39:MCP 内省类工具(`get_node_type_pins`/`list_properties`)不会真的在图里创建节点,`set_properties`/`create_node` 才会(2026-08-17)
`get_node_type_pins(graph, type_id)` 会返回一个看起来像真实节点的 `refPath`(例如 `K2Node_EnhancedInputAction_0`),但那只是查询用的预览态,不会持久化进图——之后 `create_node` 建同类型节点时,编号会从这个"幽灵节点"之后继续排(比如变成 `_1`),用 `find_nodes(entry_points_only=true)` 能确认幽灵节点从未真正出现过。不要因为拿到了 `refPath` 就以为节点已经在图里,后续操作要用 `create_node` 实际建出来的 `refPath`。
`ObjectTools.set_properties` 的 `values` 参数是**字符串**(JSON 编码后的字符串),不是原生 JSON object,直接传对象会报 `input param "values" is required`。给 `Instanced` 子对象数组赋值(例如 `InputMappingContext.mappings[].modifiers`)时,数组元素直接写**类路径字符串**(如 `"/Script/EnhancedInput.InputModifierNegate"`)就会就地实例化一个新的子对象并写回 `refPath`;写成 `{"class": "..."}` 这种对象形式不会生效,回读会发现该项变成 `"None"`。改一个已经有内容的数组前,先整体清空成 `[]` 再重新整体赋值,否则会报 `ArrayAdd: elements changed alongside the size change`。
