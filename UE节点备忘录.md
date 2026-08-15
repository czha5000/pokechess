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

## 通用陷阱:整数除法截断(2026-08-15,血条百分比 bug)

`(/ a b)` 里 `a`、`b` 都是 Integer 时,DSL/蓝图的除法节点做的是**整数除法**,不会因为下游 pin 要 Float 就自动升格成浮点除法——`15/20` 算出来是 `0`,不是 `0.75`。这个坑在"两个整数变量算比例"的场景特别容易中招(血条百分比、进度条、任何 `当前值/最大值` 的场景),而且**编译不报错、运行不报错、单纯数值不对**,很难从代码本身看出来,得靠"实际数值 approximately 0" 这种现象反推。**只要是拿两个 Integer 变量算"比例"、"百分比"这类需要精度的结果,必须显式 `Math|Conversions|ToFloat(Integer)` 转换后再做除法**,不要依赖隐式转换。回归测试里判断这类值时,除了"变了"(`< 原值`)也要顺手判断"没被腰斩成 0"(`> 0`),否则测试会把这个 bug 放过去(本轮真实踩过:`T6` 断言写成"< 1.0"没抓到,加了个"> 0.0"的 `T6b` 才抓到)。

## 请求用户回传时的省 token 原则

- **默认不要求整张 EventGraph** —— 只要新加的那几个节点 + 它们连接的邻居节点。整图回传只在"怀疑有旧节点/其他事件干扰"时才要。
- 复杂改动优先做成**独立 Function**(像 ShowRange/StartTurn/EndTurn),而不是往 EventGraph 里加分支——Function 出错时可以整体重新生成替换,不需要连蒙带猜patch。
