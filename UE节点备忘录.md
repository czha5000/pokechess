# UE 蓝图节点备忘录(踩坑记录,减少重复试错)

> 目的:省 token——别让我对同一类错误重新猜第二次。每次踩到新坑,加一条。

---

## 硬规则速查表

> 本区块是全文"规律沉淀/教训/规矩"的纯结论提炼,按主题分组、去掉案例背景和排查过程。需要细节时按括号里的引用跳到下面"案例归档"部分看原文。

### ① DSL / `write_graph_dsl` 相关

- `write_graph_dsl` 对同一个 Function 图是追加不是整体替换,旧节点不会被清掉;重写超过 2~3 次还没调通就该 `remove_function_graph` 删掉整个 Function 再 `add_function_graph` 重建,不要继续叠写。(见坑1、坑47尾注)
- `Utilities|IsValid` 绝不能写成 `(if (Utilities|IsValid X) ...)`,必须用 `(Utilities|IsValid X (:"Is Valid" ...) (:"Is Not Valid" ...))` continuation 语法——前者编译通过但生成完全不连通的死代码,`read_graph_dsl` 显示成"if 包 IsValid"的样子只是反编译失真,不能照抄。(见坑2、坑51,这是最终定论)
- 需要"一次改动前后各读一次同一个纯属性的值"时不要依赖 `bind` 会自动分时求值——结构相同的纯表达式可能被别名成同一个节点,读到错误时间点的值;要显式 `Set` 到局部变量做一次快照,再全部 `Get` 这个变量。(见坑3)
- 一条数据链路只要最终流向某个 Setter 的值 pin,链路里任何带 exec pin 的非纯函数调用都可能被悄悄复制成两次独立调用(各自重新求值,比如重新掷随机数);同样必须用 Set-then-Get 显式物化快照。(见坑26,是坑3的镜像问题)
- `find_node_types` 搜到的 / `read_graph_dsl` 读到的字符串,和 `create_node`/`write_graph_dsl` 真正能创建的 `type_id` 经常不是同一套,不能直接拿去建节点,要用 `find_node_types` 广撒网试。(见坑5、坑12、坑38)
- Bool 类型成员变量的 type_id 创建时要去掉 `b` 前缀(`bHasMoved`→`HasMoved`),变量名本身仍带 `b`。(见坑13)
- 跨对象**设值**的 DSL 语法是"值在前、目标对象在后",跨对象**取值**反而是"目标对象在前";两者顺序不对称,别凭直觉抄反。(见坑14)
- 算术运算符 `+`/`-`/`*`/`/` 的 type_id 不在 `find_node_types` 搜索结果里,要从 `create_node` 工具自身的参数说明(docstring)里找(如 `Utilities|Operators|Add`)。(见坑15)
- `add_function_param` 不支持 Object 类输入/输出参数,只支持基础类型和少数结构体;需要传对象时改成"调用前把值写进成员变量,函数内部读这个变量"的模式。(见坑17)
- `get_node_type_pins` 会在图里创建一个临时/预览节点来读取 pin 信息,不是纯只读查询,它返回的 `refPath` 不保证是图里持久存在的真实节点——真正要用的节点必须显式 `create_node` 建,拿那次调用自己返回的 `refPath`。(见坑18、坑39、坑43)
- 给已有 Function 新增/修改输出参数后,已存在的调用点(`K2Node_CallFunction`)不会自动刷新 pin,只能 `delete_node` 后 `create_node` 重建;改签名前先 `find_nodes` 数一下有几个调用点。(见'MCP BlueprintTools实测细节'第8条,坑66 是这条规律的一次代价高昂的重演)
- `write_graph_dsl` 对**通过 `add_function_graph` 刚创建的、真正空白**的函数图是安全的整体写入(不会重复);但对着**已经有内容**的既有函数图(哪怕只想整体替换成"看起来一样但加了几个分支"的新版本)提交,行为是追加不是替换,旧节点全部留着不被清掉,新旧内容一起变成图里的孤儿——这条规律早就写在这个文件最上面,但"这个函数早就存在、不是全新的"这件事很容易在专注于内容对不对时被忽略,必须先用 `list_functions`/`find_nodes` 确认目标函数**当前是否已有节点**,已有就先 `remove_function_graph`→`compile_blueprint`→`add_function_graph` 清空重建,再 `write_graph_dsl`,不能图省事直接覆盖着写。(见坑66)
- 给一个已有 Function 用 `add_function_param` 声明输出参数时,参数名必须和 `write_graph_dsl` 内部生成 `(return ...)` 终止节点时使用的**内置默认输出 pin 名**一致(实测这个内置默认名是 `"Result"`,不是更常见的 `"ReturnValue"`)——命名不一致会在编译时报"Pin Result 找不到匹配的参数"这类错误,即使函数体本身逻辑完全正确。判断一个函数的输出参数该叫什么,不要凭记忆套用别处的命名(比如 `IsPhysicalSkill` 用的是 `ReturnValue`),遇到报错就老老实实读报错文本里点名的那个 pin 名字,照着改成一致,不要用同义词硬猜。(见坑66)
- 新建的、需要有返回值的 Function,写函数体之前必须先 `add_function_param(..., input_param=false)` 声明输出参数;写完后必须用 `find_nodes` 确认存在 `K2Node_FunctionResult` 节点、`get_node_infos` 核对它的值 pin 确实接了东西——否则可能编译成功但函数其实是 void,返回值被悄悄丢弃。(见坑24)
- 带 Exec 的自定义函数(非纯函数)不能当纯表达式嵌套调用,否则会被 prune(`Exec pin is not connected`),返回值变成默认空值。(见坑34)
- 自定义函数的 `Return` 节点如果 `execute` pin 没接 `FunctionEntry`,函数会跑完但返回值按类型默认值返回(String 是空串),编译不报错,必须用 `get_node_infos` 核实 Return 节点的 exec 输入确实连着。(见坑37)
- 对一个已经跑通、结构不完全确定的现有 Function,不要把 `read_graph_dsl` 的文本原样喂回 `write_graph_dsl` 做整体重写;新增逻辑优先用 `create_node`+`connect_pins`+`break_pins` 做外科手术式插入,`write_graph_dsl` 整体重写只适合全新空函数或确认没有歧义历史的简单函数。(见坑23、'MCP BlueprintTools实测细节'第1/7条)
- `write_graph_dsl` 里调用自己蓝图上的自定义 Function,哪怕是 self-context,也必须显式把 `self` 当第一个位置参数传进去。(见'MCP BlueprintTools实测细节'第6条)
- 函数体带 `for` 循环+循环内 `return` 的 Function 不是 Pure 函数,调用它生成的节点带 exec pin,必须显式接入 exec 链路。(见'MCP BlueprintTools实测细节'第5条)
- DSL 里没有"可变的循环计数器/累加器"原语,`bind` 只是给某次求值取名字,不能当计数器反复赋值;需要遍历累加/状态标记时要用 Function 的局部变量(`Variables|Default|SetX`/`GetX`)。(见'UMG补充踩坑'第2条)
- `write_graph_dsl`/`create_node` 里函数调用的位置参数严格按 `get_node_type_pins` 返回的 pin 声明顺序绑定,self pin 排第几位在不同函数间完全不统一,不能凭"目标对象习惯放第一个"之类的直觉猜,每次先 `get_node_type_pins` 确认。(见坑49、'UMG补充踩坑'第3条)
- type_id 字符串本身带圆括号的节点(如 `Math|Vector|Distance(Vector)`,常见于同名重载消歧后缀)容易在 S-表达式解析里出问题,优先换一个不带括号的等价节点,否则改用 `create_node`+`connect_pins` 手搭。(见坑44)
- 蓝图里 String 不能用 `==` 比较,要用 `Utilities|String|EqualExactly`;嵌套 `select`/`if` 一次不要超过约 20 层,拆成多个子函数。(见坑32)
- 两个 Integer 相除的除法节点做的是整数除法,不会因为下游要 Float 就自动升格;需要精度必须显式 `Math|Conversions|ToFloat` 转换;回归测试除了判断"变了"也要判断"没被腰斩成 0"。(见'通用陷阱:整数除法截断')

### ② `create_node`/`connect_pins`/`break_pins` 手工连线相关

- 手工 `create_node`/`connect_pins` 拼图同样能拼出"看似有 IsValid 判断、实际执行链路完全不可达"的图,而且更隐蔽;"这段图是我自己手工连的"不等于"我核实过它真的从入口能执行到出口"——写进文档的"wiring已确认正确"之前必须用 `get_node_infos` 顺着 exec pin 真的追一遍。(见坑4)
- `create_node` 建"取别的类的成员变量"节点(如 Col/Row 这类多个类都有同名属性的),类名写错不会报错,而是悄悄建出另一个类的同名属性 getter;一律用 `declaring_class` 参数显式指定目标类消歧,不要图省事省略。(见坑10、坑16)
- 用 `connect_pins` 挪动一个已有节点在 exec 链路里的位置时,必须先用 `get_node_infos` 看清楚该节点当前全部的 exec 连接,该断的用 `break_pins` 显式断开,再连新的——`connect_pins` 只会顶掉"同一个 pin"的旧连接,不会自动断开这个节点通过别的 pin 挂着的其它连接,漏断会拼出环导致死循环。(见坑8)
- `get_node_type_pins`/`list_properties` 这类内省工具不会真的在图里创建持久节点,只有 `set_properties`/`create_node` 才会;`get_node_type_pins` 返回的 `refPath` 即使之前连线成功过,后续操作也可能让它失效(报 `not valid EdGraphNode`),这时应重新 `create_node` 补建,不要怀疑是自己抄错了 refPath。(见坑39、坑43)
- 一个只有单一 exec 输出的事件(`EventTick`/`EventBeginPlay` 等)如果先后被不同阶段的改动各自接上"应该始终执行"的独立分支,必须显式插入 `Utilities|FlowControl|Sequence` 分流,否则后接的线会静默顶掉先接的线,不产生任何编译/运行时报错。(见坑54)
- `create_node` 建"自身类成员函数调用"节点必须写 `CallFunction|函数名`,即使 `get_node_infos`/`get_connected_subgraph` 把同一个节点的 `type_id` 显示成裸 `|函数名`。(见坑48)
- `ObjectTools.set_properties` 的 `values` 参数是字符串(JSON 编码后的字符串),不是原生 JSON object;给 Instanced 子对象数组赋值时数组元素直接写类路径字符串才会实例化,写成 `{"class":...}` 不生效;改一个已有内容的数组前先整体清空成 `[]` 再重新整体赋值。(见坑40尾注)

### ③ 跨蓝图/跨实例调用相关

- `create_node` 跨蓝图调用"另一个蓝图上的自定义 Function",正确 type_id 格式是 `Class|<类名>|<函数名>`,不是 `CallFunction|<函数名>`——即使 `find_node_types` 精确搜出来的候选就是 `CallFunction|` 前缀,建的时候依然会失败;一律直接用 `Class|<类名>|<函数名>` + `declaring_class` 起手。(见坑22、坑27)
- 跨蓝图调用自定义 Function 时,"self/target 参数排第几位"没有固定规律,不能死记硬背;先按直觉试一次,报错信息会明确说是把谁的输出接到了 self 上,照着报错倒过来重试。(见'UMG/Widget相关踩坑'第4条、'UMG补充踩坑'第3条)
- 同一个类的蓝图图里读不到"另一个同类实例"的变量——MCP 反射工具的限制是:跨实例读取的显式 Target 版本只有当前图所属类≠目标类时才会出现在可创建列表里;要在自己类的图里读别的同类实例的变量,必须把判定逻辑包到第三方蓝图(比如 GridManager)的小函数里,传对象引用进去、拿结果出来。(见坑46)
- 排查"某个操作还能通过意料之外的方式触发"这类问题,必须从**真正执行这个操作的终点函数**反向搜索全项目所有调用方,不能从"最近改过的输入"或"看起来相关的事件"出发局部排查——历史遗留的叠加系统里,触发点可能挂在完全无关的事件名字上。(见坑52)
- `Actor|GetAllActorsOfClass`+`Utilities|Array|Get(acopy)` 这套"现查引用"模式取出来的数组元素,类型只会解析成基类(`Actor Object Reference`),不会自动收窄成 `ActorClass` 参数指定的具体子类——接到需要具体子类的 pin(比如跨蓝图函数调用的 `self`)之前必须显式插一个 `Utilities|Casting|CastToXxx` 做向下转型,否则 `connect_pins` 报"pins may be incompatible types"。每次用这套模式都要加这一步,不是一次性的坑。(见坑65)
- 一个函数如果被设计成"循环里反复调用",调用前必须审查它内部会不会**无条件重置**某个被下一次迭代依赖的共享状态(GridManager 成员变量、单例引用等)——`TryAttack` 结尾无条件把 `SelectedUnit` 清成 `None`、`ResolveCounterAttack` 无条件把 `PendingSkillRowName` 改写成 `"basic"` 且从不恢复,这类"函数只被设计成调一次"时完全无害的收尾操作,一旦被循环复用就会让第二次及以后的迭代静默失败或用错数据,且不报错、不影响第一次迭代的正确性,很容易在"看起来能命中多个目标"的粗测下蒙混过关。循环体内每次迭代都要重新显式 `Set` 这些会被清空/篡改的共享状态,而不是只在循环开始前设一次。(见坑65)

### ④ UMG/Widget 相关

- `AddComponent|UserInterface|AddWidgetComponent` 没有 `WidgetClass` 输入 pin,这个引擎版本也没有 `SetWidgetClass` 节点;正确做法是 `ConstructObjectfromClass` 单独构造 Widget 实例,再 `UserInterface|SetWidget` 挂到 WidgetComponent 上。(见'UMG/Widget相关踩坑'第1条)
- `ConstructObjectfromClass` 的输出 pin 类型会在 `set_pin_value` 设置 Class 参数后自动跟着变成具体类型,不需要额外 Cast。(见'UMG/Widget相关踩坑'第2条)
- UMG 工具集没有"属性 Binding"对应工具(`BindToEventProperty` 是绑事件委托,不是属性绑定);想让 Widget 跟着数据自动刷新只能走"外部主动 Push 新值"模式,给 Widget 写 `SetXXX(Value)` 函数。(见'UMG/Widget相关踩坑'第3条)
- 加了新 UMG 内容后,某些 `Class|X|GetY` 变量名解析可能改变(新增了同名歧义候选);同名属性存在多类歧义时一律用能唯一定位到目标类的显式写法,不要偷懒抄旧代码。(见'UMG/Widget相关踩坑'第5条)
- `save_assets([])`("存所有 dirty 资产")连关卡文件(.umap)一起存;改临时属性测试完必须先确认改回原值再执行任何后续 `save_assets`。(见'UMG/Widget相关踩坑'第7条)
- `TextBlock.ColorAndOpacity` 是 `FSlateColor` 不是 `FLinearColor`,要先过一道 `Utilities|Struct|MakeSlateColor` 转换。(见'UMG补充踩坑'第1条)
- `ConstructObjectfromClass` 造出来的 Widget 实例,`bIsVariable` 子控件的绑定不会生效(裸 `NewObject` 不触发 `Initialize()`),运行时读取会是 `None`;`AddToViewport` 不能补上这个初始化。如果内容是有限几种固定状态,把每种状态做成独立 Widget 蓝图、把内容烤进设计时默认值,不在运行时调用任何碰 `bIsVariable` 绑定的函数;动态改内容的 Widget 这个坑目前无解。(见'重要陷阱:ConstructObjectfromClass造出来的Widget'一节)
- UMG Widget 蓝图里,`bIsVariable` 子控件的取值别名是 `Variables|<WBP类名去掉WBP前缀>|Get<Name>`,不是 `Variables|Default|Get<Name>`(后者只对手动加的普通蓝图变量有效)。(见坑6)
- `WidgetComponent` 初始化必须先 `SetWidget` 再 `SetWidgetSpace`/`SetDrawSize` 这类纯外观属性,顺序反了会导致 `bIsVariable` 子控件运行时全是 `None`。(见坑7)
- 改了一个 Widget Blueprint 的内部结构(加子控件/加变量)后,所有持有"该 Widget 类型引用变量"的其它蓝图也要重新 `compile_blueprint`,不能只编译改动的那一个。(见坑9)
- 项目里 3D Actor 点击(`bEnableClickEvents`)和 UMG 交互控件点击走两套不同的输入路由;加任何需要接收鼠标事件的交互 UMG 控件之前,必须显式切 `SetInputMode_GameAndUI`。(见坑19)
- `SetInputMode_GameAndUI`/`GameOnly` 来回切换(而不是切完就不管)会导致 3D 点击"有时候点一下就好,有时候要点两下",甚至吞掉紧邻的点击;优先方案是切一次就永久留在新模式,不要维护一对"切入/切出"逻辑。(见坑25)
- `ConstructObjectfromClass` 出来的 `EditableTextBox` 调 `GetText` 经常拿到空串(Details 里默认值只是显示,不代表运行时读得到);必须在 `EventConstruct` 里 `SetText` 主动写一遍默认值再读。(见坑31)
- `ComboBoxString` 的 `DefaultOptions`/`selectedOption` 运行时经常是空的,必须运行时 `ClearOptions`→`AddOption`→`SetSelectedOption`;这几个节点必须 `create_node`+`declaring_class=/Script/UMG.ComboBoxString`,DSL 里直接写会接到错误类型。(见坑33)
- `EditableTextBox` 默认 `minimumDesiredWidth=0` 且背景图 `imageSize={0,0}` 时期望高度约等于 0,视觉上像"控件消失了";必须显式设置 `minimumDesiredWidth` 和背景图 `imageSize.y`;不要用"控件在 WidgetTree 里存在"去推断运行时真的可见。(见坑29)
- Canvas 点锚点时 `offsets.right`/`bottom` 是**尺寸**不是**边距**;X 轴要贴边拉伸,必须让 `min.x ≠ max.x`(min==max 是点锚点,不是拉伸锚点)。(见坑30)

### ⑤ Transform/Construction Script 相关

- 视觉位置(世界坐标)和逻辑位置(自定义 Col/Row 变量)是两套独立数据,UE 不会自动同步——挪动/生成任何用逻辑坐标追踪位置的 Actor,都要显式检查是否同时写了逻辑坐标。(见'已知踩过的坑'倒数第1条)
- `RelativeRotation`/`RelativeLocation` 这类 Transform 属性,在**已经放置在关卡里的 Blueprint 实例**上用 `ObjectTools.set_properties` 直接改不一定真的生效(尤其 SCS 组件,读回来可能被静默还原);要走 Blueprint 图里插 `SetXXX` 节点的方式(`UserConstructionScript`/`EventBeginPlay`),这是真正会持久生效的路径。(见坑42)
- 给一个"新写的第三人称/TPS 移动"角色接线时,只要开了 `bOrientRotationToMovement`,移动方向就必须来自 Controller 的 `ControlRotation`(仅取 Yaw),不能用 `GetActorForwardVector`/`GetActorRightVector`(会和身体自动转向形成反馈环,导致原地打转/斜着走)。(见坑42)
- 鼠标 `GetInputMouseDelta` 的 Y 轴是屏幕原始像素差,没有经过引擎传统 Axis Mapping 惯例的 `Scale=-1.0`;直接接 `AddControllerPitchInput` 方向是反的,要手动乘 `-1.0`。(见坑42)
- 给一个"格子/网格"系统加连续移动的软边界时,边界的距离度量必须和系统原有的距离度量保持一致(比如项目其它系统全用曼哈顿距离,新加的软边界就不能凭直觉选欧氏距离/`ClampVectorSize`),否则会出现"移动范围吃掉攻击范围"这类不等价效果;"移动范围"和"棋盘边界"是两个独立约束,要分别单独夹,不能假设一个自动包含另一个。(见坑45)
- 把 Actor 从普通 `Actor` 改成 `Character`(加 `CapsuleComponent`)之后,所有历史上"把这个 Actor 放到某个位置"的 Z 轴常量都要重新核算——基准点从模型局部原点变成了胶囊体中心,换算公式是 `目标世界Z = 地面实际顶面Z + CapsuleHalfHeight`,两个数都要用 `get_actor_bounds`/`get_properties` 现场量,不能套用旧常量。同一个错误的历史常量可能在多个互不调用的函数里被独立复制过,只改一处要记得搜一下整个项目是否还有其它复制品。(见坑55)
- `CharacterMovementComponent` 默认对没有 `Controller`(没被 `Possess`)的 `Character` 不跑重力/碰撞修正物理;同一局游戏里如果"有的单位数值正常,有的精确卡在一个可疑整数上",这种数值分裂本身是强线索,指向"初始化/出生"阶段而不是"运行中的逻辑"。(见坑55)
- 给 `StaticMeshComponent` 算相对父组件(如胶囊体)的挂载偏移之前,必须用 `StaticMeshTools.get_bounds` 现场查这个资产的局部包围盒,确认 pivot 到底在哪——不能套用"骨骼网格局部原点在脚底"的经验公式,静态网格的 pivot 由美术/导入流程决定,可能在模型中心或任意位置。(见坑56)
- "读到某个属性值,判断这个值是对的"这个结论本身也是需要交叉验证的断言,不能只满足于"这个值存在、看起来合理";要找另一组独立数据源(比如资产自身的 bounds)交叉核实这个值是不是真的算对了。(见坑56)

### ⑥ `read_graph_dsl` 反编译失真相关

- `read_graph_dsl` 对含 Macro 节点(如 `ForEachLoop`)的图,反编译文本可能失真,不要原样喂回 `write_graph_dsl` 整体重写。(见'MCP BlueprintTools实测细节'第1条)
- `read_graph_dsl` 对含 `SpawnActorFromClass` 的图,会把这类节点打印成"类型特化"的显示标签(如 `Game|SpawnActorBPTile`),这个标签不是真实可创建的 type_id,回写会报 does not exist。(见'MCP BlueprintTools实测细节'第7条)
- `write_graph_dsl` 对局部 `bind` 出来的变量,"解析器自己会消歧"这个结论不成立——第二次引用同一个变量的撞名属性(如先取 Col 再取 Row)会连错;不要抄 `read_graph_dsl` 读出来的显示形式(如 `Class|GridSlot|GetRow`),永远按目标对象真实类型写(`Class|BPUnit|GetRow`)。(见坑20)
- `read_graph_dsl` 能把历史遗留的裸 `|GetXXX`/`|SetXXX` 写法读出来,但原样喂回 `write_graph_dsl` 会报 does not exist,哪怕一个字都没改——读写不对称;这类老函数一律先 `find_nodes`/`get_node_infos` 读清楚,再用 `create_node`+`connect_pins` 增量编辑。(见坑38)
- `read_graph_dsl` 把跨对象的同名属性 Get 节点(Col/Row 这类)反序列化时可能选错所属类,原样喂回会导致连线彻底连错,报错信息里的 pin 名字具有误导性、和真实问题无关;写 DSL 前必须用 `find_node_types` 按字段名确认目标对象真实类型对应的正确 type_id。(见坑47)
- `read_graph_dsl` 把"自身类成员函数调用"节点的 `type_id` 显示成裸 `|函数名`,但 `create_node` 建它必须写 `CallFunction|函数名`——读和建不是同一套字符串。(见坑48)
- `read_graph_dsl` 会把两种完全不同的 `SetVisibility` 节点(Widget 属性赋值器 vs SceneComponent 函数)反序列化成同一个显示名 `Rendering|SetVisibility`,原样喂回可能把枚举字符串错连到 bool 参数上;必须用 `get_node_infos` 核实真实 type_id 再决定怎么写。(见坑50)
- `read_graph_dsl` 会把用 continuation 语法写的 `Utilities|IsValid`(唯一正确写法)反编译显示成"`if` 包 `IsValid`"的外观——这只是显示层失真,绝不能照抄这种显示文本去写新代码,否则会写出"编译通过但是死代码"的 bug。(见坑51)
- `read_graph_dsl` 显示"某段逻辑不存在"和"这段逻辑真的被删了"必须用 `find_nodes`+`get_connected_subgraph`/`get_node_infos` 交叉验证,不能划等号——它只沿 `FunctionEntry` 真正的 exec 链路显示,孤立/断头的分支不会出现在文本里,但节点可能仍然全须全尾地留在图里。(见坑11、坑54)
- `read_graph_dsl` 对手工 `create_node`/`connect_pins` 拼出来的图,可能漏报连线(显示成空的 `(bind _self self)`),必须用 `find_nodes`+`get_node_infos` 交叉核实,不能信。(见坑41 排查记录)

### ⑦ 编译/保存/版本管理相关

- `ErrorType=1`/`ErrorMsg` 经常是缓存的旧报错,连线修好后点一次 Compile 就会清掉,别被残留报错误导。(见'剪贴板粘贴技术的硬规则'第3条)
- `AssetTools.save_assets` 传显式资产路径经常报 "Asset does not exist",直接传 `asset_paths: []` 保存所有 dirty 资产更稳,存完用宿主 UE 工程自己的 git 仓库 `git diff --stat` 确认改动范围只覆盖预期文件。(见'MCP BlueprintTools实测细节'第4条)
- `ObjectTools.set_properties` 设不了刚用 `add_variable` 新建的变量(报 could not be set),要先 `set_variable_instance_editable(...,true)` 再 `compile_blueprint`。(见'MCP BlueprintTools实测细节'第9条)
- 控制台起 MCP 服务用 `ModelContextProtocol.StartServer <port>` 位置参数,不是 `-ModelContextProtocolPort=<port>`(那是编辑器启动命令行参数)。(见'MCP BlueprintTools实测细节'第10条)
- 项目 `.mcp.json` 和用户全局 `~/.claude.json` 里各自存了一份 `unreal-mcp` 端口配置,可能不一致;编辑器手动 `StartServer <port>` 之后当前会话的 MCP 连接不会自动重连,要跑一次 `/mcp` 手动重连。(见'MCP BlueprintTools实测细节'第11条)
- `save_assets([])` 连关卡文件(.umap)一起存,任何为了测试临时改过的关卡实例属性都会被顺带落盘;改完临时属性测试完先确认改回原值再 save。(见'UMG/Widget相关踩坑'第7条)
- 排查结论只追加、不改写旧条目,文档里会长期留着已被否决的"当前真相";新结论必须回头把否决掉的旧条目标"误判/已否决",不能只在末尾再加一条。(见坑36)

### ⑧ 其它

- 粘贴是纯增量的:新节点内部互相连线可靠生效,但新节点连到"已经存在于图里的旧节点"不会生效,这类连线必须让用户手动拖。(见'剪贴板粘贴技术的硬规则'第1条)
- K2Node_VariableGet/Set 读取"不是 self 自己"的变量时,`MemberParent`/`SelfContextInfo=NotSelfContext`/self pin 的 `PinSubCategoryObject` 三件套必须齐全,漏一个轻则 pin 退化成泛型报错,重则编译器去错误的类里找变量。(见'剪贴板粘贴技术的硬规则'第2条)
- 一次粘贴里偶尔会概率性丢 1 条 exec 连线(数据线基本不丢);生成较大节点块后第一件事永远是检查每个节点的 exec 输入/输出是否都非空。(见'剪贴板粘贴技术的硬规则'第4条)
- 函数名写错会导致整个节点在导入时静默丢弃(不报错),下游连它的线全部退化成默认值——比编译报错更难发现;发现"生成的节点少了"时优先怀疑这个。(见'剪贴板粘贴技术的硬规则'第5条)
- 手写大段粘贴文本时,连线必须用"完整符号 key"去查 GUID,不能用字段名简写去查,否则连线全部指向不存在的随机 GUID 且不会立刻报错;生成脚本必须做"每条 LinkedTo 引用的 PinId 都能在声明集合里找到"的自动校验。(见'已知踩过的坑'第4条)
- "目标不是 self 的操作型函数"(如 `K2_DestroyActor`/`SetActorLocation`)的 Target pin 极易漏接,漏接不报编译错误、只在运行时才暴露且后果可能很严重;交付"剩余手动连线清单"时要单独加粗提醒优先检查这类连线。(见'已知踩过的坑'第5条)
- 一段"收尾清理代码"里的每一行都要能明确回答"这一步对应的是哪个语义阶段的结束",不能把不同语义阶段(如"移动完成" vs "整个操作序列完成")的清理代码堆在同一个时机执行。(见坑21)
- 关卡里放置的蓝图实例属性会覆盖蓝图 CDO 的默认值,PIE 运行时复制的是关卡实例不是 CDO;查"为什么默认值没生效"要用 `reset_properties` 清掉实例覆盖,不要 "Keep Simulation Changes"。(见坑35)
- 预览和结算(比如伤害数值)必须调用同一个底层公式函数,不能各自维护一套硬编码近似值;带随机性的判定(如命中骰)只能在真正确认执行时掷,不能放进预览路径。(见坑28)
- 战斗类回归测试如果依赖一次性、带随机数的判定(如命中率),要预留"假性 FAIL"的可能性(检查失败前的日志是不是命中了 MISS),不代表真回归。(见'已知测试脚动')
- 默认不要求整张 EventGraph 回传核对,只要新加的那几个节点+邻居节点即可,只有怀疑有旧节点/其他事件干扰时才要整图;复杂改动优先做成独立 Function 而不是往 EventGraph 里加分支,出错时可以整体重新生成替换。(见'请求用户回传时的省token原则')
- Enhanced Input 鼠标常驻可见(`bShowMouseCursor=true`)时视角输入基本收不到;需要"看得见鼠标点UI"和"锁鼠标转视角"两种模式来回切换,按 Possess/UnPossess 状态显式切 `SetInputMode`+`SetShowMouseCursor`。(见坑40)
- 排查"某个功能编译不报错但运行时结果不对/卡住不动"的诡异问题,加 `PrintString` 逐段打印中间变量实际运行时值,比只信任静态读图/手算推理更可靠;怀疑"exec 链路是否真的从入口连到出口"时,`get_node_infos` 逐节点核对 `connected_pins` 比打印更直接。(见'排查心法'、坑53)
- 向量按分量相乘(`vector*vector`)的输入 pin 如果完全没连线也没填值,`get_node_infos` 读出来是**空字符串**而不是 `"0,0,0"`,容易被忽略当成"没什么信息";方向向量×距离这类场景优先找专门的"向量乘标量"节点,不要用分量相乘再手动广播。(见坑53)
- 面对一个未解决的深层引擎/项目问题(比如 Enhanced Input 全局不触发),留一套排查用的诊断基础设施(探针 PrintString、备用输入方案)在项目里且明确记录在文档中,方便下一次接手直接复用,不需要重新排查一遍。(见坑41)
- `SetViewTargetWithBlend` 换镜头时,`NewViewTarget` 要传"设计上就该在这个时刻被看到的东西"(比如全景相机自己),不能传"跟这件事有关联但状态还没就绪"的对象(比如还没被 `Possess`、没人瞄准过的下一个单位)——后者朝向随机,表现上像"镜头乱甩",根因其实是选错了目标,不是相机数学错。(见坑60)
- 验证 `SetViewTargetWithBlend`(`BlendTime>0`)是否换对了目标,不能在同一帧里读 `PlayerController.GetViewTarget()` 断言——Blend 没跑完之前它还返回旧目标,必须等 Blend 时长过去之后再读;而 `Delay` 节点不能放进普通 Function(只有 EventGraph/Macro 能用),要在 Function 里验证"延迟后的状态",得拆成 `SetTimerbyFunctionName` 调另一个函数来做断言。(见坑61)
- 任何"读 live PIE 状态排查"之前,第一步先 `EditorAppToolset.IsPIERunning()` 确认真的在跑——`StartPIE` 调用成功过不代表这一刻 PIE 仍然活着(可能已经被停掉/因故结束),`find_actors` 返回的 `UEDPIE_0_...` 路径哪怕看着眼熟也可能是上一次残留的假象,后续 `ObjectTools`/`ActorTools` 对同一路径的调用会全部报"not valid Object"且报错信息本身不会提示"其实是 PIE 没在跑"。(见坑62)
- `SkeletalMeshComponent.AnimationData` 这个属性只在组件初始化/序列化时有意义,不会随运行时 `PlayAnimation()` 调用同步更新;想确认"现在到底在播放哪个动作",读这个属性是死路,只能通过——功能是否触发看蓝图变量(如自建的 `CurrentLocoAnim`)、视觉效果是否正确只能靠截图或人工肉眼确认。(见坑63)
- 一个挂了 `CapsuleComponent`(`ACharacter`)的角色,如果玩家反馈"移动时头朝向不对/像在倒退着走(moonwalk)",且换动画资产(swap 两个 AnimationAsset 变量)没有效果,第一时间应该怀疑 `SkeletalMeshComponent.RelativeRotation`(挂载在胶囊体下的静态朝向补偿值)差了 180 度,而不是"选错了哪个动作";这类角度补偿值如果通过"肉眼看渲染截图猜前后"校准出来的,本身有 50% 概率猜反,前后各差 180 度都可能被误判成"看起来还行"——最终判定必须回到真实玩家的直接描述(比如"背对着移动方向走"),不要靠继续截图硬猜。(见坑64)

---

## 案例归档(按时间顺序,含完整排查过程)

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

## 生成粘贴块的标准流程(工具在 `ue/tools/paste_gen.py`)

**所有粘贴块生成都走脚本,不手打**,核心是:写 Python 脚本 + pin 注册表模式生成文本 → 生成后自动校验连线完整性(每条 `LinkedTo` 引用的 `(NodeName, PinId)` 都必须存在,校验不过直接 `exit(1)`)→ 大文本写成 txt 文件交付,不直接堆进聊天。

> ⚠️ **2026-09-01 更正**:这里原本写的是"走 `ue-blueprint-paste-gen` 这个 skill,细节见 skill 内容"——但**这个 skill 在本仓库里根本不存在**(`.claude/skills/` 没有这个目录),等于规范强制了一个拿不到的工具。实际可用的实现是 `ue/tools/paste_gen.py`(419 行),当时只存在于遗留分支 `cursor/ue-step5-defk-formula-a3e8` 上,已抢救进 `main`。用法 `python3 ue/tools/paste_gen.py --help`,配套说明见 `ue/README.md`。

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

### 坑1:`write_graph_dsl` 对同一个 Function 图**是追加,不是整体替换** #WriteGraphDSL #历史孤立节点 #函数重建
反复对同一个 Function 调用 `write_graph_dsl`(比如改一次逻辑就重写一次),旧版本的节点**不会被清掉**,会作为孤立的垃圾节点一直堆在图里(`FunctionEntry` 的 exec 输出 pin 只能连一个下家,新写入的链条会"抢线",旧链条变成没人执行的死节点,但节点本身还占着图)。重写 5~10 次之后,图里会有几十个孤立节点,并且**这些残留节点偶尔会让 `write_graph_dsl` 的后续写入把连线接到错误的旧节点上**(本轮真实碰到:改了老半天一个"距离比较"逻辑,百思不得其解地跑出错误结果,最后发现是新语句复用了错误的孤立残留节点)。
**规矩**:同一个 Function 图但凡重写超过 2~3 次还没调通,别继续在上面叠 `write_graph_dsl`——用 `remove_function_graph` 删掉整个 Function 再 `add_function_graph` 重建,拿到一张干净的图再写一次。**加分注意**:`remove_function_graph` 之后立刻 `add_function_graph` 同名字,偶尔会因为内部还残留一个占用中的引用,自动改名成 `<原名>_0`(本轮 `FindNearestUnit` 变成了 `FindNearestUnit_0`,DSL 里对应的 type_id 变成 `FindNearestUnit0`,不带下划线,需要用 `find_node_types` 现查确认实际名字,不要想当然按原名字硬写)。删除 Function 之前,记得**先去调用方(尤其是 EventGraph 里散落的 CallFunction 节点)找到并删掉对它的引用**,否则 `compile_blueprint` 会报 "Could not find a function named X"。

### 坑2:`(if (Utilities|IsValid X) ...)` 通过 `write_graph_dsl` 写出来的图**经常性地"编译成功但没连线"** #WriteGraphDSL #IsValid #死代码
不止是"嵌套在别的表达式里"才会坏(那条已经记在下面"整数除法"那节前面的旧笔记里)——**哪怕写成推荐的"独立语句"形式 `(if (Utilities|IsValid X) 真分支 (else 假分支))`,一样有相当概率生成一个 `execute`/`Condition` 两个 pin 都完全没连线的孤立 Branch 节点**,现象因上下文而异:
  - 出现在 `for` 循环内部的 if 分支里 → 循环体那部分逻辑整个不执行,变量停留在默认值,函数悄悄返回错误结果(**不报任何错误**)。
  - 出现在函数体顶层、后面还有代码 → 后续所有语句都不执行,包括最后的收尾 Print(**同样不报任何错误**,表现为"卡住不动"，其实是提前把 exec 链路断掉了)。
  - 出现在函数体顶层、是最后一批语句 → 有时反而能正常工作(本轮唯一一次侥幸能跑的用例)。
  没有找到规律能预判哪种情况会坏——**唯一可靠的做法是完全不通过 `write_graph_dsl` 写 `Utilities|IsValid` 相关的 if 语句**,改用不需要判空的等价逻辑:
  - 找"数组/循环里的最优解"场景(比如"最近的单位"):不要用"当前最优解是否 IsValid"来判断"是不是第一个候选",改成给距离一个**大哨兵初始值**(比如 9999),每次发现更小的距离就直接更新,不用关心"有没有候选"这件事。
  - 需要"是否发生过某件事"这种布尔标记场景:加一个局部 bool 变量(默认 false),事件发生时显式 `Set` 成 true,最后 `if` 这个 bool 变量而不是 `IsValid`。
  只有 `TryAttack` 里原来那处 `IsValid` 是安全的——但那是这个会话**开始之前就已经存在**的代码(不是这轮用 `write_graph_dsl` 写出来的),不能作为"这样写就安全"的参考样本。

### 坑3:`bind` 对**结构相同、输入不同**的纯函数(Get 类)表达式,可能被错误地当成同一个节点复用,导致"读到的是别的时间点的值" #WriteGraphDSL #bind别名 #纯函数求值
`Class|BPUnit|GetCol enemyD` 这种纯读取调用没有 exec pin,只在被消费的时候求值。如果同一个 Function 里出现**两处文本结构完全相同**的表达式(哪怕通过不同的 `bind` 名字绑定,比如"移动前"读一次 `GetCol enemyD`,"移动后"又读一次同样的 `GetCol enemyD`),`write_graph_dsl` 有概率把它们**编译成同一个底层节点**——纯节点只有一份,它的求值时机是"被消费的那一刻",如果两次绑定共享同一个节点,"移动前"的那个绑定其实会读到"移动后"的值(因为节点被求值的时机被推迟到了图里更晚的地方),导致两个应该不同的值变得完全相同,连带用它们算出来的比较结果全部失真(本轮真实症状:`(< 距离After 距离Before)` 明明手算是 `2 < 7` 应该为真,断言却稳定失败;后来发现是 `distBefore`/`distAfter` 两个同结构表达式被别名到了一起)。
**规矩**:
  1. **需要在一次改动(移动/攻击/生成等有副作用的调用)前后各读一次同一个纯属性的值时,不要指望 `bind` 会自动帮你在正确的时间点各求值一次**——在"之前"的读取点上,显式用 `Variables|Default|SetXxx(纯读取表达式)` 把值存进一个局部变量,强制在那个精确的 exec 时间点完成一次有序(非纯、按 exec 顺序执行)的快照,后面全部用 `Variables|Default|GetXxx` 读这个局部变量,不要再直接读原始的纯表达式。
  2. **两处需要各自独立求值的"结构相同"的运算表达式(即使输入变量不同),优先包成一个真正的 Function 调用**(`CallFunction|Xxx`,天然带 exec pin,不会被去重/别名),而不是各自在 DSL 里现场重复写一遍算式。本轮把重复了 4 次的曼哈顿距离算式抽成 `ManhattanDistance(ColA,RowA,ColB,RowB)` 这一个 Function,不仅解决了别名 bug,顺便也是应该做的重构。

### 坑4:不只是 `write_graph_dsl`——**手工 `create_node`/`connect_pins` 拼图**(`BP_TurnManager.StartTurn`)也照样能拼出"看似有 IsValid 判断、实际执行链路完全不可达"的图,而且更隐蔽 #CreateNode #ConnectPins #IsValid #死代码 #排查方法
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

### 坑5:`find_node_types` 返回的"可搜到"字符串,和 `create_node`/`write_graph_dsl` 真正"可创建"的 `type_id`,经常是两套不同的名字 #TypeID #FindNodeTypes #CreateNode
`FindNearestUnit0`(自定义 Function)在**读**已有节点时(`get_node_infos`)看到的 `type_id` 是 `|FindNearestUnit_0`(带下划线、裸 `|` 前缀);但这个字符串**不能用来新建节点**(`does not exist`)——真正能喂给 `create_node`/`write_graph_dsl` 的字符串是 `find_node_types` 搜出来的 `CallFunction|FindNearestUnit0`(不带下划线、带 `CallFunction|` 前缀)。同理,`Class|BPUnit|GetSpd` 这种"取别的类的成员变量"节点,`find_node_types` 不传 `context_pins` 时能搜到且能建;但像 `GetCol`/`GetRow`/`GetSide` 这类**多个类都有同名属性**(`BP_Unit.Col` 和 `BP_Tile.Col` 撞名)的情况,`find_node_types` 常常只搜到 `Variables|Default|GetCol` 这个"本类自己变量"专用的别名,**这个别名对"取别的对象的属性"这种场景是无效的**(`create_node`/`write_graph_dsl` 建出来会报 `does not exist`)。**规矩**:先按直觉试 `Class|<类名>|Get<变量名>`(通常最可靠,尤其是变量名唯一不撞名的情况,比如本轮的 `Class|BPUnit|GetSpd`);如果报 `does not exist`,不要死磕,直接 `find_node_types(type_id_filter="<变量名>", context_pins=[])` 广撒网,把返回列表里所有候选都记下来,挨个试(`CallFunction|Xxx` 和 `Class|类名|GetXxx` 是最常见的两种能用的形式,`Variables|Default|GetXxx` 对同名撞了别的类基本不能用)。**已确认属于"读出来的 type_id 和能建的 type_id 不是同一个字符串"这类坑的具体案例**:`FindNearestUnit_0` vs `FindNearestUnit0`、`GetCol`/`GetRow`(`Slot0Text` 这类 UMG 子控件变量同理,见坑6)。

### 坑6:UMG Widget 蓝图里,`bIsVariable` 子控件的取值别名不是 `Variables|Default|Get<Name>`,而是 `Variables|<WidgetBlueprint名字>|Get<Name>` #UMG #Widget #TypeID
普通 Actor 蓝图(比如 `BP_TurnManager`)自己的成员变量,取值用 `Variables|Default|GetXxx` 没问题;但 Widget Blueprint(`WBP_XXX`)里通过 `ToggleWidgetAsVariable` 标记出来的子控件(比如 `Slot0Text`),对应的可创建别名是 **`Variables|<WBP类名去掉WBP前缀>|Get<控件名>`**(本轮实测 `WBP_OrderBar` 里的 `Slot0Text` 对应 `Variables|WBP_OrderBar|GetSlot0Text`,不是 `Variables|Default|GetSlot0Text`——后者会报 `does not exist`)。Widget Blueprint 自己真正的"蓝图变量"(比如用 `add_object_variable` 额外加的 `SlotTexts` 数组)反而还是走 `Variables|Default|GetSlotTexts` 这个标准形式——**同一个 Widget Blueprint 里,"子控件"和"手动加的普通变量"取值要用两套不同前缀,搞混了两个都会报 `does not exist`,先 `find_node_types(type_id_filter="<名字>", context_pins=[])` 广撒网确认哪个能用,不要猜。**

### 坑7:`WidgetComponent` 初始化顺序——`SetWidgetSpace` 必须排在 `SetWidget` **之后**,不能在之前,否则 Widget 内部所有 `bIsVariable` 子控件运行时全是 `None` #WidgetComponent #UMG
本轮给行动顺序条挂 `WidgetComponent`(Screen Space)时,按"先配置组件属性、再挂内容"的直觉顺序写(`AddWidgetComponent → SetWidgetSpace(Screen) → SetDrawSize → ConstructObjectfromClass → SetWidget`),结果 `WBP_OrderBar` 里 8 个 `bIsVariable` 的 `TextBlock` 运行时全部读出来是 `None`——这正是"`ConstructObjectfromClass` 不触发 `bIsVariable` 绑定初始化"那个老坑(见"重大陷阱:`ConstructObjectfromClass` 造出来的 Widget"一节),但这次连**血条那条"`WidgetComponent`+`SetWidget` 能绕开这个坑"的已知经验都失效了**。对比血条(`BP_Unit.UserConstructionScript`)真正跑通的顺序:`ConstructObjectfromClass → AddWidgetComponent → SetWidget → SetWidgetSpace(不传参,默认 World) → SetDrawSize`——**唯一关键差异是 `SetWidget` 排在 `SetWidgetSpace` 前面**。把顺序换成"先 `SetWidget` 再 `SetWidgetSpace`"之后,子控件全部变成有效引用。**结论(具体引擎机制未知,但两次独立对照实锤了现象)**:`WidgetComponent` 相关的初始化,`SetWidget` 必须是第一个"内容相关"的调用,`SetWidgetSpace`/`SetDrawSize` 这类纯外观属性放在 `SetWidget` 之后更安全。以后凡是"新建 `WidgetComponent` + 挂一个需要运行时读写 `bIsVariable` 子控件的 Widget"这种模式,直接照抄血条这个顺序,不要凭直觉重新排。

### 坑8:用 `connect_pins` "挪动"一个节点在 exec 链路里的位置时,必须显式 `break_pins` 断开它原有的连接,否则会拼出一个环,`compile_blueprint` 直接死循环 #ConnectPins #BreakPins #死循环
为了修坑7,把 `SetWidgetSpace` 节点从链路中间挪到末尾,只加了两条新线(`前一个节点.then → SetDrawSize`,`SetWidget.then → SetWidgetSpace`),但漏了断开 `SetWidgetSpace` 自己原来还连着 `SetDrawSize` 的旧线——结果图里出现一个环(`SetDrawSize → ... → SetWidget → SetWidgetSpace → SetDrawSize → ...`),`compile_blueprint` 直接跑成死循环(`Runaway loop detected (over 1,000,000 iterations)`,MCP 调用在后台跑了 2 分钟才把错误报回来,期间前台完全没反馈)。**教训**:`connect_pins` 只负责"接上新线",不会自动帮你断开某个节点原有的其它连接——它"顶掉旧连接"这个直觉**只对同一个 pin** 成立(一个 exec 输出 pin 确实只能接一个下家,对它 `connect_pins` 新目标会自动顶掉旧目标),对"这个节点通过另一个 pin 还连着别处"完全不成立。**凡是"移动一个已有节点在 exec 链路里的位置"(不是单纯新增一段),动手前先 `get_node_infos` 看清楚该节点当前**全部**的 exec 连接,该断的连接用 `break_pins` 显式断掉,再连新的,不要只顾着接新线。**

### 坑9:改了一个 Widget Blueprint 的内部结构后,**引用它的其它蓝图也要重新 `compile_blueprint`**,不然运行时子控件又变回 `None` #UMG #Compile
给 `WBP_OrderBar` 加 hover 提示文字这轮,只 `CompileWidgetBlueprint(WBP_OrderBar)` 编译了这个 Widget 自己,`BP_TurnManager`(持有一个 `WBP Order Bar Object Reference` 类型的变量)没有跟着重新编译——结果重开 PIE 后 `Slot0Text` 等一圈 `bIsVariable` 子控件又双叒读出来是 `None`,现象和坑7一模一样,但这次跟 `SetWidget`/`SetWidgetSpace` 顺序无关(顺序完全没动)。把 `BP_TurnManager` 也重新 `compile_blueprint` 一遍(内容没改,单纯触发重编译)之后,问题消失。**教训**:这和"改了 Function 签名、调用点的 pin 对不上"是同一类问题(见坑"给 Function 新增/修改输出参数后…"那条)的 Widget 版本——**只要改了一个 Widget Blueprint 的内部结构(加子控件、加变量),所有持有"该 Widget 类型引用变量"的其它蓝图,都要跟着重新编译一遍,不能只编译改动的那一个**。以后但凡碰这种跨蓝图引用的场景,改完总是把"这个改动波及到的所有蓝图"都跑一遍 `compile_blueprint`,不要只编译直接改的那个。

### 坑10:`Class|<类名>|GetXxx` 里的类名必须和目标对象的真实类一致,写错类名不会报错,而是悄悄建出"另一个类"的同名属性 getter #TypeID #命名撞名 #CreateNode
之前(坑5)记录过"多个类有同名属性时,`find_node_types` 不传 `context_pins` 常只搜到本类的 `Variables|Default|GetXxx`,对跨对象取值无效"。这轮进一步实测清楚了根因和正确用法:**`create_node`/`write_graph_dsl` 里的 `Class|<类名>|GetXxx` 语法,`<类名>` 部分不是"随便找一个能用的前缀",而是真的按这个类名去查该类自己的成员**——`Col`/`Row` 在 `BP_Tile` 和 `BP_Unit` 两个类都有同名变量,`Class|BPTile|GetCol` 建出来的就是 `BP_Tile.Col` 的 getter(`self` pin 类型 `BP Tile Object Reference`),就算你把返回值硬接到一个 `BP_Unit` 引用上,`connect_pins`/`write_graph_dsl` 会直接报 `Could not connect pin ReturnValue to self`(类型不匹配)拒绝,不会静默出错——**但如果你压根没意识到自己抄错了类名,只看到报错信息里的"self"两个字,很容易误诊成"这个函数需要 self 参数"而不是"类名选错了"**。正确做法:目标是 `BP_Unit` 的 `Col` 就老老实实写 `Class|BPUnit|GetCol`,目标是 `BP_Tile` 的 `Col` 就写 `Class|BPTile|GetCol`,类名和实际对象类型对应,不要图省事抄别处代码里出现过的字符串。`create_node` 还额外支持传 `declaring_class` 参数(值为目标类的 Class 引用,如 `/Game/Maps/BP_Unit.BP_Unit_C`)显式消歧,`write_graph_dsl` 的 DSL 文本里没有等价语法,只能靠类名本身写对。

## 陷阱合集:一回合一次移动 + 攻击范围语义修正(2026-08-16)

### 坑11:`write_graph_dsl` 整函数重写时,如果图里有历史遗留的孤立(exec 不可达但数据仍互相连着)节点,重写可能悄悄把新逻辑接到**孤立分支**上,而不是报错 #WriteGraphDSL #历史孤立节点 #排查方法
`ShowAttackRange` 在早前 v1→v2 迭代时留下了一整套 v1 的孤立节点(`GetAllActorsOfClass(BP_Unit)` 那套逐敌判定逻辑,`get_connected_subgraph` 一查有 40 个节点,`read_graph_dsl` 却只干净地显示 v2 那 5 行——因为 `read_graph_dsl` 只沿 `FunctionEntry` 真正的 exec 链路走,孤立分支不显示,但它们仍然通过共享的 `Unit` 参数等**数据 pin** 互相连着,`get_connected_subgraph` 这种无向遍历会把它们也扫进来)。这轮想把攻击半径从 `AtkRange` 改成 `MoveRange+AtkRange`,第一次尝试用 `write_graph_dsl` 整函数重写,直接在 `ManhattanDistance` 那步报 `Could not connect pin Unit to self`——**放弃整函数重写、改用增量 `create_node`+`connect_pins` 后,新插入的 Add 节点第一次被错误地接到了孤立分支的比较节点上**(因为凭"哪个 `GetAtkRange` 节点的输出连着 `Unit` 参数"这种数据侧线索去猜哪个是"活的"节点,猜错了——孤立分支的 `GetAtkRange` 同样直接吃 `Unit` 参数,数据侧完全看不出死活)。**唯一可靠的判活方法**:从 `FunctionEntry` 开始,只顺着 **exec pin**(`then`/`execute`/`LoopBody` 这类,不是数据 pin)一路 `get_node_infos` 往下走,能从 `FunctionEntry.then` 顺 exec 链路走到的节点才是活的;`find_nodes(entry_points_only=true)` 只能找到入口,不能证明其余节点是否可达,`read_graph_dsl` 虽然只显示活的逻辑,但它给出的是**逻辑摘要**,不直接暴露具体是哪个 `K2Node_XXX_N` 在跑,还得靠 exec 链路回溯去对号入座。**如果发现一个函数有历史孤立节点残留(`get_connected_subgraph` 节点数远超 `read_graph_dsl` 摘要能解释的量),优先纯粹顺 exec pin 追踪要改的具体节点,不要相信"这个节点吃了某个参数/变量"这类数据侧证据来判断它是否在执行路径上。**

### 坑12:`find_node_types` 返回的字符串本身也可能不可创建——即使它是**通过精确匹配的 `context_pins` 搜出来的** #TypeID #FindNodeTypes #WriteGraphDSL
坑5记录过"读出来的 type_id 和能建的 type_id 不是同一套字符串",这轮进一步实测:反过来,`find_node_types` **搜出来**的字符串也不保证能 `create_node`/`write_graph_dsl` 建出来。给 `BP_TurnManager.StartTurn` 加 `bGameOver` 判断时,依次试了三个来源都失败:①直接抄 `read_graph_dsl` 读出来的 `|GetbGameOver`(空前缀,报 `does not exist`,预期内,坑5已知);②改用常规 `Class|BPGridManager|GetbGameOver` 形式(同样报 `does not exist`);③改用 `find_node_types(type_id_filter="GameOver", context_pins=[<_grid变量输出pin>])` 精确搜出来的 `Variables|Default|GetGameOver`(**这次连搜出来的字符串本身都建不出来**,同样报 `does not exist`)。三次都失败后放弃了对 `bGameOver` 这个特定 getter 的整函数重写,改成对 `StartTurn` 做纯增量 `create_node`(只建 `Class|BPUnit|SetHasMoved`,没有触碰 `bGameOver` 相关的任何节点)。**教训**:`write_graph_dsl` 整函数重写只应该用在"函数里所有涉及的 type_id 都已经在这次任务中被验证过能创建"的情况;只要函数里有**任何一个**读出来正常但创建路径不确定的 getter(尤其是历史遗留、命名带 `b` 前缀的 Bool 变量,坑13),优先改用增量 `create_node`+`connect_pins`,别赌整函数重写会成功——失败是事务性的(不会破坏原图,可以放心重试),但反复试错烧时间。**如果确实需要用 DSL 整体重写包含某个不确定 getter 的函数,先用 `create_node` 单独试探性建一次那个 getter,确认可行再整体重写,不要直接在整函数 DSL 里第一次验证。**

### 坑13:Bool 类型成员变量的 type_id,创建时要去掉 `b` 前缀——`bHasMoved` 建的时候是 `HasMoved` #TypeID #命名规则
`add_variable` 里按 UE 命名规范传的变量名是 `bHasMoved`(Bool 类型加 `b` 前缀是 UE 的既定风格,`add_variable` 也确实照原样建出了一个叫 `bHasMoved` 的变量,`get_node_infos` 读它时 pin 名字也叫 `bHasMoved`),但 `create_node`/`find_node_types` 认的 **type_id** 里这个前缀被去掉了:`find_node_types(type_id_filter="SetbHasMoved")` 搜不到,搜 `"HasMoved"`(不带 `b`)才搜到 `Class|BPUnit|GetHasMoved`/`Class|BPUnit|SetHasMoved`(跨对象形式)和 `Variables|Default|GetHasMoved`/`Variables|Default|SetHasMoved`(self 形式)。**这大概率是所有 `b` 前缀 Bool 变量的通用规律**(`bGameOver`、`bIsMoved` 这类都可能一样),以后建类似节点时,先按"去掉 b 前缀"的形式去搜/建,而不是原样带 `b` 去猜。变量名本身(pin 上显示的名字、蓝图编辑器里看到的名字)依然带 `b`,只有 `create_node` 的 `type_id` 字符串不带——两者是两套独立的命名。

### 坑14(顺带记录):跨对象**设值**的 DSL 语法是"值在前、目标对象在后",和取值的"目标对象在前"参数顺序相反 #DSL语法 #TypeID #参数顺序
`TryAttack` 里已有先例 `(Class|BPUnit|SetHP _returnvalue_15 Defender)`——`SetHP` 的两个参数是 `(新值, 目标对象)`,不是 `(目标对象, 新值)`。这次新增 `(Class|BPUnit|SetHasMoved false _output)` 照抄了这个顺序。**取值**的形式反过来是"目标对象在前、没有值参数":`(Class|BPUnit|GetCol Unit)`。两者顺序不对称,写的时候容易凭直觉搞反,尤其是从 Getter 抄参数顺序去写 Setter 的时候——下笔前找一个项目里已经在用的同类型 Setter 抄参数顺序,不要自己猜。`create_node` 建出来的 `SetXxx` 节点,`get_node_infos` 读出来的 input_pins 顺序是 `[execute(exec), <变量名>(值,默认带字面量), self(目标对象)]`——值 pin 排在 self 前面,和 DSL 文本的参数顺序一致,可以互相对照检查。

### 坑15(顺带记录):`create_node` 的算术运算符(`+`/`-`/`*`/`/`)不在 `find_node_types` 的搜索结果里,type_id 要从 `create_node` 工具自己的 docstring 里找 #CreateNode #TypeID #FindNodeTypes
DSL 文本里的 `+`/`-`/`*`/`/`/`<=` 等符号是**解析器特殊语法**(见 `get_graph_dsl_docs`),不经过 `find_node_types` 这条路;但 `create_node` 增量建节点时不能直接传符号,得传具体 type_id。翻遍 `find_node_types(type_id_filter="Math|Integer|")`、`"Add"`、`"integer+integer"`、`"Promotable"` 都搜不到整数加法节点(反而 `<=`/`>` 这类比较符能在 `get_node_infos` 读出来的 type_id 里看到 `Math|Integer|integer<=integer` 这种字符串,但同样搜不到、建不出来——这些是节点创建后根据实际连线类型**自动解析**出来的显示名,不是可创建的种子 type_id)。**真正能建通用算术节点的 type_id 是 `Utilities|Operators|Add`(减/乘/除同理换成 `Subtract`/`Multiply`/`Divide`,推测,本轮只验证了 Add)——这个字符串写在 `create_node` 工具自身的参数说明里,不用靠 `find_node_types` 搜**,建出来是一个 `PromotableOperator` 通用节点(初始两个输入输出都是 `Wildcard` 类型),连上具体类型的 pin(比如两个 Integer 输出)后类型会自动解析确定,`get_node_infos` 复查一遍能看到解析后的 `type_id` 变成类似 `Utilities|TimeManagement|FrameNumber+Int` 这种(具体解析成哪个由 UE 内部决定,不用关心,只要输入输出 pin 类型对就行)。

## 陷阱合集:行动菜单(交互按钮 UI)开发实录(2026-08-16)

### 坑16:`create_node` 的 `declaring_class` 参数是解决坑10(类名撞名)的**可靠**手段,不是"额外支持"的边角功能 #CreateNode #declaring_class #命名撞名
坑10记录过"类名写错会悄悄建出另一个类的同名属性 getter",这轮实测确认了正确的解法:`create_node(type_id="Class|BPUnit|GetRow", declaring_class={refPath: "/Game/Maps/BP_Unit.BP_Unit_C"})` 每次都能可靠建出 `self` pin 类型正确的节点(`get_node_infos` 复查确认过好几次),而不传 `declaring_class` 直接写 `Class|BPUnit|GetRow`(或者抄 `read_graph_dsl` 读出来的 `Class|GridSlot|GetRow`)大概率建出 `self` 是 `Grid Slot Object Reference` 的错误节点——**编译不报错**(因为这个节点本身是合法的,只是没连任何东西),必须靠 `get_node_infos` 主动核对 `self` pin 的 `type_id` 才能发现。**规矩更新**:凡是 `Col`/`Row`(或任何"多个类都有同名成员"的属性),`create_node` 一律带上 `declaring_class` 显式指定,不要省略这一步图省事——省略后"看起来建成功了"不等于"建对了"。反过来,`write_graph_dsl` 整函数解析时**不需要**手写 `declaring_class`,DSL 解析器自己会根据参数实际类型正确消歧(`ShowAttackRange`/`ShowRange` 现有代码里的 `Class|GridSlot|GetRow` 写法能跑通,就是因为它们是通过 `write_graph_dsl` 整函数创建的,不是 `create_node` 逐个建的)——**这个消歧能力只在 DSL 解析路径上生效,`create_node` 路径必须自己用 `declaring_class` 补上**。

### 坑17:`add_function_param` 不支持 Object 类的输入/输出参数,只支持基础类型和少数结构体 #函数签名 #WriteGraphDSL
文档字符串明确列了支持的类型:`bool/int/float/byte/string/name/text` 和 `Vector/Rotator/Transform/Vector2D/LinearColor`——没有"任意 Object 引用"这一项。想给 `ShowActionMenu` 加一个 `Unit: BP_Unit` 输入参数时才发现这个限制。**解法**:不用函数参数传对象,改成"调用前先把值写进一个成员变量,函数内部读那个变量"的模式——本轮是调用方(`BP_Tile.ActorOnClicked`)先 `Set TurnManager.PendingActionUnit = SelectedUnit`,再调用不带参数的 `TurnManager.ShowActionMenu()`,函数内部自己读 `PendingActionUnit`。这也顺便解决了"多个地方都要用同一个'当前操作对象'"的问题(`HideActionMenu`/`UndoAction` 都要用到同一个单位引用,不用每次都传参)。**以后凡是想给自定义 Function 加对象类型参数,先假设这条路走不通,直接设计"参数化的成员变量"模式。**

### 坑18:`get_node_type_pins` 会在图里实际创建一个临时节点来读取 pin 信息,不是纯只读查询 #CreateNode #内省工具
调用 `get_node_type_pins(graph, type_id="Class|Widget|SetVisibility")` 后,返回的 pin 信息里 `node.refPath` 指向一个真实存在的 `K2Node_VariableSet_N`——**这个节点是这次调用本身建出来的**,不是预先存在的。实测紧接着 `read_graph_dsl` 复查,该函数体仍然是空的(`(fn ShowActionMenu ())`),说明这个探测节点要么没有被计入"活跃"图(exec 不可达,不出现在 DSL 摘要里),要么被工具自己清理了——总之**没有污染最终产物**,但如果后续还要在同一个函数里手动核对节点数量(比如用 `find_nodes` 数节点总数来判断"这个函数是不是意外变复杂了"),要留意这类探测调用可能会让计数偏高。这次没有深究到底是"从不真正持久化"还是"事后被撤销",只确认了**最终编译产物是干净的**,不必因为这个工具的存在而改变工作流程,正常用就行,只是心里有个数,不要被 `find_nodes` 数字的短暂波动搞糊涂。

### 坑19:项目现有的 3D Actor 点击(`bEnableClickEvents`)和 UMG 交互控件(按钮点击)走的是两套不同的输入路由,加按钮前必须显式切输入模式 #InputMode #UMG #点击路由
项目一直靠 `PlayerController.bEnableClickEvents=true` + 纯 `Game` 输入模式驱动 `ActorOnClicked` 事件(`BP_Tile`/`BP_Unit` 全靠这个),这套路径下鼠标点击直接做 3D 场景拾取,**不会路由给屏幕上的 UMG 控件**——`WBP_OrderBar`/`WBP_HealthBar`/`WBP_GameOver` 之前都只是纯展示,没人点过它们,所以这个问题一直没暴露。这轮第一次加交互按钮(`WBP_ActionMenu`)时,补了 `Input|SetInputModeGameAndUI(GetPlayerController(0))` 在 `ShowActionMenu` 里切到"游戏+UI"混合输入模式(弹菜单时),`HideActionMenu` 里再 `Input|SetInputModeGameOnly` 切回纯游戏模式(该恢复 3D 点击了)。**这一步本身没有被人工 Play 验证过是否真的让按钮收到点击**——纯粹是按 UE 的标准输入路由规则做的防御性修复,MCP 工具集没有"模拟鼠标点击某个 UMG 按钮"的通用能力去验证,只能靠人工 Play 确认。**以后项目里如果还要加别的交互 UI(不只是按钮,任何需要接收鼠标事件的 UMG 控件都一样),都要检查是不是也需要这套输入模式切换**,不要假设"Widget 加到 Viewport 上了就自动能收到点击"。

## 陷阱合集:行动菜单 bug 排查(2026-08-16,火纹对比后动手修复)

### 坑20:`write_graph_dsl` 整函数写入时,**局部绑定变量**(`Variables|Default|GetX` 的结果)身上的 Col/Row 这类撞名属性,坑10/16 记录的"DSL 解析器自己会消歧"结论不总成立——第二次引用同一个变量的撞名属性时会连错 #WriteGraphDSL #命名撞名 #反序列化失真
坑16 说"`write_graph_dsl` 整函数解析不需要手写 `declaring_class`,解析器自己会根据参数实际类型正确消歧",这轮实测发现这个结论**对函数参数(FunctionEntry 的 pin)成立,对局部 `bind` 出来的变量不成立**——新建 `ShowAttackRangeCurrent()` 时,`(bind _unit (Variables|Default|GetSelectedUnit)) (bind _ucol (Class|BPUnit|GetCol _unit)) (bind _urow (Class|GridSlot|GetRow _unit))` 这段代码,第一次用 `_unit` 取 `Col` 能成功,**第二次用同一个 `_unit` 取 `Row`(写成 `Class|GridSlot|GetRow`,抄自 `read_graph_dsl` 读旧代码时看到的显示形式)就报 `Could not connect pin SelectedUnit to self`**——因为 `GridSlot|GetRow` 不是一个真实可写的 type_id,只是"给 BP_Unit 建 Row getter"这件事在 `read_graph_dsl` 反编译时的**显示名怪癖**(坑10/16 已经记录过这个怪癖存在,但当时以为只影响 `create_node` 路径,这轮证实 `write_graph_dsl` 路径同样受影响,只是报错更隐蔽——报的是"pin 不兼容",不是"does not exist",容易误诊成别的问题)。**规矩更新**:不管是 `create_node` 还是 `write_graph_dsl`,只要是给 `BP_Unit` 取 `Row`,永远写 `Class|BPUnit|GetRow`,**不要抄 `read_graph_dsl` 读出来的 `Class|GridSlot|GetRow`**——读和写不对称,读出来的字符串只保证"人类看得懂大概是干嘛的",不保证能原样喂回去。同理排查："Could not connect pin <变量名> to self" 这个报错,不一定是"没传 self"或"类型真不兼容",大概率是"用错了显示名而非可写 type_id",优先检查是不是撞名属性、类名是不是从 `read_graph_dsl` 抄来的。

### 坑21:一段"移动完成后清理"的收尾代码里混进了一条属于"结束操作"语义的逻辑,导致后续所有"移动后还想再操作这个单位"的功能全部静默失效——教训是"收尾代码"要按"这一步真正对应哪个语义阶段"分类,不能全堆在一起 #逻辑设计 #状态管理
`BP_Tile.ActorOnClicked` 的移动分支收尾原本是 `ClearHighlights → SetCol → SetRow → SetSelectedUnit(None)`——这条 `SetSelectedUnit(None)` 是行动菜单系统上线**之前**就有的老代码(坑记录里 2026-08-13 那次编译修复提到过这个节点),当时的语义是对的:那时候点完格子移动就是这个单位本回合唯一能做的事,移动完清空"当前选中"完全合理。**行动菜单系统上线后,这条老代码的语义已经过时了,但没人回头检查它是否还该留在这里**——移动之后玩家还要通过菜单选"攻击/待命/撤销",这几个后续操作全都要读 `GridManager.SelectedUnit` 才知道"当前操作的是哪个单位"(`TryAttack` 内部就是这么读的),移动那一刻就把它清空,直接导致:点"攻击"再点敌人,`TryAttack` 读到 `SelectedUnit` 已经是 `None`,内部唯一的 `if IsValid` 判断直接跳过整个函数体(**没有 else 分支,静默什么都不做**);`BP_Unit.ActorOnClicked` 敌方分支紧接着又读一次 `SelectedUnit`,同样是 `None` → 判定"IsValid 变成了 Not Valid"(因为它本来就是 Not Valid,不是 `TryAttack` 打完后才变的)→ 误判成"已经打过了"直接 `EndTurn`——**表现就是用户反馈的"点攻击再点敌人没有反应",而且回合还悄悄结束了。**
**排查方法**:没有靠猜或加 `PrintString`,而是顺着"点击→事件→读哪个变量→这个变量什么时候被写"这条数据流,把 `BP_Tile.ActorOnClicked`(移动收尾)、`BP_GridManager.TryAttack`(攻击判断)、`BP_GridManager.ShowRange`(唯一的 `SetSelectedUnit` 写入点)三个函数的 `read_graph_dsl` 完整读了一遍,直接在收尾代码里看到这条不该在那个时机出现的 `SetSelectedUnit(0)`,不需要人工 Play 复现就已经能确认根因。
**修法**:把"清空 SelectedUnit"这个动作,从"移动刚完成"这个时机,挪到真正"这个单位的回合彻底结束"的时机——也就是 `StandbyAction()`(待命按钮,补了一条 `Class|BPGridManager|SetSelectedUnit(0, Grid)`)。`TryAttack` 命中时本来就会自己清空(见 `TryAttack` 最后一步),`UndoAction` 因为"撤销=当作没行动过",干脆不清空(保持 `SelectedUnit` 还指着这个单位,后续再点自己重新触发 `ShowRange` 也会重新写一遍,不影响)。
**教训**:一段"收尾清理代码"里的每一行,都要能明确回答"这一步对应的是哪个语义阶段的结束"——`ClearHighlights`/`SetCol`/`SetRow` 对应的是"移动这个动作完成",`SetSelectedUnit(None)` 对应的是"这个单位的整个回合/操作序列完成",**两者时机不同,混在一起写只在"移动即回合结束"这个旧设计下恰好成立**,新增中间状态(移动后还能弹菜单选择别的操作)时,必须把"移动完成"和"操作序列完成"两个时机的收尾代码分离到各自真正发生的地方,不能图省事全堆在移动那一步的末尾。

## 陷阱合集:技能与遗物最小闭环开发实录(2026-08-16)

### 坑22:`create_node` 跨蓝图调用"另一个蓝图上的自定义 Function"时,正确的 `type_id` 格式是 `Class|<类名>|<函数名>`,不是 `CallFunction|<函数名>`——即使 `find_node_types` 带正确 `context_pins` 精确搜出来的就是 `CallFunction|<函数名>` 这个字符串 #CreateNode #跨蓝图 #TypeID
本轮新建 `BP_GridManager.ApplyStartingRelics()`(无参数)后,想在 `BP_TurnManager.EventBeginPlay` 里插入一次调用,`create_node(type_id="CallFunction|ApplyStartingRelics")` 报 `does not exist`;`find_node_types` 传上正确的 `context_pins`(指向一个 `BP_GridManager` 引用的输出 pin)精确搜出来的候选**恰好也是** `CallFunction|ApplyStartingRelics` 这个字符串,直接拿去建**同样失败**(和坑12"搜出来的字符串本身也可能不可创建"是同一现象,这次终于找到了系统性规律,不再是"未知原因")。同样的情况在给 `WBP_ActionMenu` 调用 `BP_TurnManager.SelectSkillAndAttack` 时也踩到过一次。**规律**:`CallFunction|<函数名>` 这个前缀形式只对"自己蓝图内部的自定义 Function"(self-context)有效;调用**另一个蓝图**上的自定义 Function,必须用 `Class|<目标类名>|<函数名>` 这个前缀形式(和跨对象取值 `Class|BPUnit|GetCol` 是同一套命名体系),并且最好同时传 `declaring_class` 显式指定目标类——`Class|BPGridManager|ApplyStartingRelics` + `declaring_class={refPath: ".../BP_GridManager.BP_GridManager_C"}` 一次建成功。**以后凡是 `create_node` 建"调用别的蓝图自定义函数"的节点,一律直接用 `Class|<类名>|<函数名>` 形式起手,不要先试 `CallFunction|` 前缀再踩坑。**

### 坑23:对一个已经跑通的 EventGraph 事件做 `write_graph_dsl` 整体重写,哪怕文本是原样照抄 `read_graph_dsl` 的输出 + 只加一行,也可能在**完全没动过的旧代码行**上报类型不兼容错误 #WriteGraphDSL #EventGraph #命名撞名
给 `BP_TurnManager.EventBeginPlay` 插入一次 `ApplyStartingRelics()` 调用时,先尝试了"读出完整 DSL → 原文本里插入一行 → 整体 `write_graph_dsl` 写回去"这个看似最简单的做法,结果报 `Could not connect pin ActionMenuWidget to bNewVisibility`,报错定位在 `(Rendering|SetVisibility "Collapsed" _actionmenuwidget)` 这一行——**这行文本和读出来的一模一样,本轮完全没有修改它**,但整体重写时解析出了不同的节点(命中了某个"接受 bool 而不是 Visibility 枚举"的同名 `SetVisibility` 重载,大概率是 Actor/Component 通用的那个可见性开关,而不是 Widget 专用的枚举版本),原来是靠增量 `create_node`/`connect_pins` 一步步搭出来的图里没有这个歧义(因为当时是显式建的 Widget 专用节点)。和坑16 的教训是同一类现象("write_graph_dsl 整函数解析不需要 declaring_class,解析器自己会消歧"这个说法不总成立)在 EventGraph 层面的新案例。**教训**:凡是要往一个**已经验收过、正常工作的**大 EventGraph 事件里加东西,哪怕只加一行,只要该事件本身逻辑不简单(有过 Widget/组件相关的同名方法歧义史),优先用增量 `create_node`+`connect_pins` 插入,不要图省事做"读出来改一行再整体写回去"——这类整体重写只在**全新空函数**或**逻辑足够简单确认没有歧义历史**的场合下才可靠。这次改用 `create_node(type_id="Class|BPGridManager|ApplyStartingRelics", declaring_class=...)` + `connect_pins` 精确插入到 `SetGrid.then` 和 `BuildTurnOrder` 调用之间,完全没有触碰 `SetVisibility` 那几行,一次成功。

### 坑24(重要,容易造成静默错误的游戏数值 bug):给新建 Function 加输出参数(`add_function_param(..., input_param=false)`)之前就先用 `write_graph_dsl` 写含 `(return X)` 的函数体,会编译成功但函数其实是 **void**——`(return X)` 里的值被悄悄丢弃,调用方读不到任何返回值,graph 里也看不出报错 #WriteGraphDSL #函数签名 #Void函数 #FunctionResult
新建 `GetTypeMultiplier` 时,第一次是"先 `add_function_graph` → 直接写 `(return 1.0)`/`(return 2.0)` 等多分支返回值的函数体 → `compile_blueprint` 无报错"——但 `read_graph_dsl` 读回来发现所有分支体都显示成占位符 `_`(不是具体数值),用 `find_nodes` 查这个函数的节点列表,**压根没有 `K2Node_FunctionResult` 节点**;进一步用 `get_node_type_pins` 探测这个函数的调用点签名,确认它只有 `execute`/`then` 两个 Exec pin,**没有任何数据输出 pin**——函数虽然逻辑上算出了正确的分支值,但从未真正"返回"过,是个不折不扣的 void 函数,调用方无法获取任何计算结果。这是本轮踩到的最危险的一类坑:**编译不报错、图看起来完整、DSL 摘要甚至显示了"看似正确"的分支结构,唯独漏了最关键的返回值——不主动用 `find_nodes`/`get_node_type_pins` 交叉核实,根本发现不了。** 如果这次没有多问一句"这函数真的返回东西了吗",这个 `GetTypeMultiplier` 会被接到 `TryAttack` 的伤害公式里,导致"属性克制"这个核心玩法数值**永远是默认值、完全不生效**,而所有自动化测试和编译检查都会显示一切正常。**修法**:`remove_function_graph` + `add_function_graph` 重建,**先用 `add_function_param(..., input_param=false)` 显式声明输出参数**(这一步会自动生成一个带正确 pin 的 `K2Node_FunctionResult_0`),**确认后再** `write_graph_dsl` 写函数体——这次 `(return X)` 的每一处都正确生成了独立的 `K2Node_FunctionResult` 节点(一个函数体里多处 `return` 完全没问题,每处各自建一个 Return 节点,`get_node_infos` 逐个核对输入 pin 的值和连接来源即可验证)。**规矩**:任何新建的、需要有返回值的 Function,`write_graph_dsl` 写函数体之前,一律先用 `add_function_param` 把输出参数声明好;写完之后,一律用 `find_nodes` 确认存在至少一个 `K2Node_FunctionResult` 节点、再用 `get_node_infos` 核对它的值 pin 确实接了东西,不能只看 `compile_blueprint` 不报错就认为函数是对的。

## 陷阱合集:输入模式反复横跳导致点击时灵时不灵(2026-08-16)

### 坑25:`SetInputMode_GameAndUI`/`SetInputMode_GameOnly` 来回切换(不是切完就不管了),会导致 3D Actor 点击"有时候一下就好,有时候要点两下"——正确做法是切一次就永远留在 `GameAndUI`,不要切回去 #InputMode #点击路由
坑19 当时只确认了"加交互 UMG 按钮必须切输入模式",但没深挖"切回去"这一步是否安全。这轮用户实测反馈两个现象:①"移动有时候点一下就可以,有时候要双击";②"不能原地攻击"(点自己单位不移动、直接点相邻敌人,没反应)。排查思路:这两个现象都发生在"该单位这次操作之前,输入模式是否处于 `GameAndUI` 到 `GameOnly` 的过渡态"这个条件附近——`ShowActionMenu` 每次弹菜单都切到 `GameAndUI`,`HideActionMenu` 每次都切回 `GameOnly`,一局游戏里这个来回切换会发生几十上百次。UE 的 `SetInputMode_GameOnly`/`SetInputMode_GameAndUI` 底层会重新设置 Viewport 的鼠标捕获/焦点状态,连续快速切换时不保证在下一次点击到达前完全生效——第一次点击可能被"重新夺回 Viewport 焦点"这个动作本身消耗掉,不会被当成语义上的"点击 Actor"事件,必须再点一次才算数,这解释了"有时候要双击"。而"不能原地攻击"是同一根因的另一种表现:原地攻击这个操作**完全不经过 `ShowActionMenu`/`HideActionMenu`**(菜单只在移动之后才弹),如果上一个单位的操作恰好让输入模式停留在 `GameAndUI` 过渡态(比如上一次点了菜单按钮),当前单位点自己 + 点敌人这两次点击都可能被吞。
**修法**:`bEnableClickEvents` 驱动的 3D 点击(`ActorOnClicked`)在 `GameAndUI` 模式下本来就能正常工作(只要鼠标没有点在会拦截点击的可见 Widget 上,项目里除了 `WBP_ActionMenu` 之外的其它 Widget 都是纯展示、行动菜单本身隐藏时是 `Collapsed` 不参与命中测试)——**没有必要在隐藏菜单时切回 `GameOnly`**。直接把 `HideActionMenu` 里的 `Input|SetInputMode_GameOnly` 那个调用删掉(`ShowActionMenu` 里的 `SetInputModeGameAndUI` 保留,反正切换到同一个模式是幂等的,多切几次无害),让游戏从第一次弹出菜单开始就永久停留在 `GameAndUI` 模式,不再有"从 A 模式过渡到 B 模式"这个不稳定窗口。**教训**:任何"临时切一下输入模式,用完再切回去"的模式,如果这个"用完"的时机很频繁(每次菜单交互都触发),来回切换本身就是风险源——优先考虑"只切一次,永久留在新模式"这种更简单的方案,而不是精心维护一对"切入/切出"逻辑。

### 附带修复:攻击技能选择在"原地攻击"(不走行动菜单)路径下会读到上一个单位的残留值
`BP_TurnManager.PendingSkillIsElemental`(记录玩家选了"普通攻击"还是"元素技能")只在点行动菜单按钮(`SelectSkillAndAttack`)时才会写入,原地攻击(不移动、不经过菜单)直接点敌人时,`BP_Unit.ActorOnClicked` 依然会读这个变量传给 `TryAttack.bUseSkill2`——如果没有归零,读到的是**上一个单位**、**上一次**选的值,而不是"这个单位这次没做任何选择,应该默认普通攻击"。修法:在 `StartTurn` 我方分支重置 `bHasMoved=false` 的同一处,顺手加一行 `SetPendingSkillIsElemental(false)`,保证每个单位轮到自己时这个选择清零成"默认普通攻击",除非本回合真的移动后又在菜单里选了元素技能。

## 陷阱合集:反击系统 + 攻击预测 UI 开发实录(2026-08-16)

### 坑26(重要,真实数值 bug):`write_graph_dsl` 里,一条数据链路只要最终喂给了某个"属性 Setter"(比如 `Class|BPUnit|SetHP`)的值 pin,哪怕这条链路已经拆成好几个独立的 `bind` 语句、完全没有内联嵌套,链路里任何一次**带 exec pin 的非纯函数调用**(比如 `ComputeSkillDamage`,内部有随机数+分支)都可能被**悄悄复制成两份独立调用**——一份在 if 分支外面提前算好喂给 Setter,另一份在 if 分支里面按原样重新调一次(通常是为了别的用途,比如打印)。两份调用各自独立掷骰子,结果可能完全不同。 #WriteGraphDSL #重复求值 #随机数
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

### 坑27:`create_node` 建"调用另一个蓝图自定义函数"节点失败时,不要死磕 `CallFunction|` 前缀,直接换 `Class|<类名>|<函数名>` + `declaring_class`(坑22 的进一步确认) #CreateNode #跨蓝图 #TypeID
本轮再次在两个新场景下复现了坑22的规律:`BP_TurnManager.EventBeginPlay` 里插入 `ApplyStartingRelics()` 调用时,`create_node("CallFunction|ApplyStartingRelics")` 报 `does not exist`,换成 `create_node("Class|BPGridManager|ApplyStartingRelics", declaring_class=BP_GridManager)` 一次成功;`BP_Unit.EventGraph` 里插入 `TurnManager.ShowAttackForecast()`/`SetPendingAttackTarget()` 调用时同样如此。**规矩已经稳定复现三次,可以确认为通用规律**:`create_node` 建自身蓝图内部函数用 `CallFunction|`,建**另一个蓝图**的自定义函数一律直接用 `Class|<目标类名>|<函数名>` + 显式 `declaring_class`,不要再浪费一次 `CallFunction|` 尝试。

### 已知测试脚动:加入命中率后,`RunRegressionTests` 的 T5/T6a 偶尔会假性 FAIL(~5% 概率),不是真回归
`ComputeSkillDamage` 内部会真的掷骰子判定命中(基础攻击 95% 命中),`RunRegressionTests` 里 T5(`TryAttack_DamagesDefender_HP`)和 T6a(`HealthBar_DecreasesAfterDamage`)都是靠一次性的 `TryAttack` 调用断言"HP 确实下降了"——如果那一次刚好掷出了 MISS(约 5% 概率),攻击不造成伤害,这两条断言就会假性 FAIL,`Output Log` 里能看到 `MISS`(而不是某种真实错误)紧跟在失败的测试前面。**排查步骤**:T5/T6a FAIL 时,先查一下失败那次运行的 log 里紧邻的是不是 `MISS` 字样——如果是,直接重跑一遍regression即可,不是代码退化。这是给战斗系统加入随机数之后必然引入的测试不确定性,目前没有对 `RunRegressionTests` 做"保证命中"的特殊旁路,可以接受(重跑成本很低)。

### 坑31:对 `ConstructObjectfromClass` 出来的 `EditableTextBox` 调 `GetText`,经常拿到空串,尽管 Details 里 `text` 默认值还在 #UMG #EditableTextBox #ConstructObjectfromClass
`ApplyDebugLoadout` 用 `Widget|GetText(TextBox)` 读遗物 CSV 和五个技能槽,PIE 里 Grid 变成 `EquippedRelicIds=[]`、`SkillSlots=[]`、`bRelicFallbackToSlice=false`。空技能槽走 `GetSkillSlotName` 回退,行动菜单效果还是 basic/heavy/ember/aqua/vine,玩家会觉得「APPLY 了但技能没变」。`text` UPROPERTY 仍显示默认字符串,不能当 GetText 的证据。**如果要读输入框,必须在 `EventConstruct` 里 `Widget|SetText(TextBox)` 再写一遍默认值**;预设按钮可以继续用写死的 `ParseCommaSeparatedNames`。中文名不能直接当 FName 行名,要先 `SkillTokenToId` / `RelicCsvToIds`。自定义路径后来改成下拉;`GetText` 空仍是真坑,但 08-17 APPLY 清空的验收根因是坑37,不要把本条当唯一解释。

### 坑35:关卡里的 `BP_GridManager` 把 `bRelicFallbackToSlice` 覆盖成 false,开局顶栏就是空遗物 #关卡实例 #CDO覆盖
**验收根因(开局没遗物)**:蓝图 CDO 是 true,但 TestMap 放置实例曾是 false。PIE 复制的是关卡实例不是 CDO。开局 `EquippedRelicIds` 空 + fallback false → `BuildRelicLoadout` 不读 `bEnabledInSlice`。英文 `(no relics)` 只说明当时 C++ 空文案还是旧字符串,**不是开局为空的原因**;不要把「没 Compile C++」写成开局没遗物的根因。自定义 APPLY 会在 PIE 里把 fallback 关掉;若点了「保留模拟更改」,false 写回关卡,下次一打开就没遗物。修法:`reset_properties` 掉实例覆盖;不要 Keep Simulation Changes。查的时候 `tiles=[]` 的 `_C_1` 是编辑器关卡实例,不是 PIE 副本。

### 坑33:`ComboBoxString` 的 DefaultOptions / selectedOption 运行时经常是空的,必须自己 AddOption #UMG #ComboBox #CreateNode
和坑31同一类:资产里写了选项,Play 时 `GetSelectedOption` 仍可能是空串。运行时 `FillRelicCombo`/`FillSkillCombo`(`ClearOptions`→`AddOption`→`SetSelectedOption`)是防护层。这四个节点必须 `create_node` + `declaring_class=/Script/UMG.ComboBoxString`,DSL 里写 `ComboBox|AddOption` 会接到错误类型。不要 `write_graph_dsl` 重写已经用 create_node 搭好的 Fill 函数。**不要把「只缺 FillCombo」写成 APPLY 清空的唯一原因**;验收后主因是坑37。

### 坑34:带 Exec 的自定义函数不能当纯表达式调用,否则会被 prune,返回值变默认空串 #WriteGraphDSL #Prune #函数签名
`RelicCsvToIds` 里嵌 `CallFunction|RelicCsvtoIdsB`、`SkillTokenToId` 里嵌 B,编译器报 `was pruned because its Exec pin is not connected, the connected value is not available and will instead be read as default`。这是真警告,返回值会变默认空串,所以对照必须内联进 A。**当时误把 B prune 写成 APPLY 清空的唯一原因**;验收时主路径已经不调 B,清空仍发生,真正打穿的是坑37 + 无条件关 fallback。`if` 当语句用(匹配就 `return`),不要 30 层 `elif` 手数括号。

### 坑37:`GetComboOption` 的 Return 节点 Exec 没接 FunctionEntry,返回值按默认空串(APPLY 清空的验收根因) #CreateNode #FunctionResult #Void函数
带 Exec 的自定义函数如果 Return 的 execute pin 悬空,函数会跑完但返回值是类型默认值(String 就是 `""`)。DoApply 用这个空串 `SetText` 覆盖 Construct 里已经写好的中文默认 CSV,再调 `ApplyDebugLoadout`;当时 APPLY **无条件** `SetbRelicFallbackToSlice false`,于是 `EquippedRelicIds=[]` + fallback false → 顶栏空。空 `SkillSlots` 走 `GetSkillSlotName` 回退开局 5 技能,看起来「APPLY 了技能没变」。`get_node_infos` 能看出 Return.execute 没连;`read_graph_dsl` 不一定写得清楚。修法:Entry.then → Return.execute;下拉空串则**不覆盖**隐藏框;解析 0 件遗物时 fallback 设回 true。

### 坑36:排查结论只追加、不改写旧条目,文档里会长期留着已被否决的「当前真相」 #文档管理
08-17 配装问题查了好几轮,中间把开局空遗物写成「没编 C++」、把 APPLY 清空写成「只缺 FillCombo」或「只是 RelicCsvToIdsB prune」。这些曾写进 `UE实操教程.md` 续接区和测试清单,后来查清了只在文件末尾再加一条,前面的误判还当现状。下个会话会按文档把错因再修一遍。规矩:新结论必须回头把否决掉的旧条目标「误判/已否决」;验收后只留最终根因(本轮:坑35 开局、坑37 APPLY)。

### 坑32:蓝图里 String 不能用 `==`,嵌套 `select` 一次不要超过约 20 层 #DSL语法 #String比较
`==` 接 String pin 会报 `Could not connect pin Token to A`。用 `Utilities|String|EqualExactly(String)`。31 个技能一次性 nested select 会 `Unexpected )` / 写不进去,拆成 `SkillIdToChinese` + `SkillIdToChineseB` 再 `CallFunction|SkillIdtoChineseB self Token`(注意生成的 type_id 会把 To 收成 to)。同蓝图纯函数当表达式用时 target 是 `self`,参数在后面。

### 坑30:Canvas 点锚点时 `offsets.right/bottom` 是尺寸,不是边距 #UMG #Canvas锚点 #布局
`WBP_DebugLoadout` 右贴边用 `anchors min(1,0) max(1,1)`(X 轴 min==max,是点锚点;Y 轴才是拉伸)。设计者把 `right=8` 当成「离右缘 8px」,引擎却把 Right 当成**宽度 8**。运行时 `bDebugPanelOpen=true`、Visibility=Visible,截图上却几乎没有面板。修法:改成屏幕中心点锚点 + `SizeBox` 写死 560×780,`bAutoSize=true`。**X 轴要贴边拉伸必须让 min.x ≠ max.x**(例如 1,1 配不上宽度)。

### 坑29:UMG `EditableTextBox` 默认 `minimumDesiredWidth=0` 且 `widgetStyle.backgroundImage*.imageSize={0,0}` 时,期望高度≈0 #UMG #EditableTextBox #布局
`WBP_DebugLoadout` 里遗物 CSV / 五个技能槽资产都在、`visibility=Visible`、也有默认文本,Play 截图却只剩 AUTO/RANDOM/APPLY/CLOSE。按钮自带样式所以有高度;输入框被 VerticalBox 按 Desired Size 排布时高度塌掉,看起来像「没有列表」。修法:给每个 `EditableTextBox` 设 `minimumDesiredWidth`(本项目 320)并把 `backgroundImageNormal.imageSize.y` 设成 ≥28、`drawAs=Box`;长内容外面包 `ScrollBox`(滚轮 `Always`)。**不要**用「控件在 WidgetTree 里」推断运行时可见。

### 坑28:预览和结算必须调同一个 C++ 函数,命中骰只能在确认时掷 #数值一致性 #随机数
蓝图里曾经两套公式(预览硬编码 0.9/1.4 + `GetTypeMultiplier_0`,结算查表 + 克制 ×2 + 遗物乘区),表现就是「面板 11 点、确认秒杀 20 血」。修法:两边都只调 `UCombatFormula::CalculateSkillDamageValue`,用 `bRollHit` 区分。**不要把命中骰放进预览**,否则面板每次点开都可能显示 0。反击预览如果也读 `PendingSkillRowName`,必须先快照再改成 `basic` 再还原,否则点确认会打出普通攻击。

## 通用陷阱:整数除法截断(2026-08-15,血条百分比 bug)

`(/ a b)` 里 `a`、`b` 都是 Integer 时,DSL/蓝图的除法节点做的是**整数除法**,不会因为下游 pin 要 Float 就自动升格成浮点除法——`15/20` 算出来是 `0`,不是 `0.75`。这个坑在"两个整数变量算比例"的场景特别容易中招(血条百分比、进度条、任何 `当前值/最大值` 的场景),而且**编译不报错、运行不报错、单纯数值不对**,很难从代码本身看出来,得靠"实际数值 approximately 0" 这种现象反推。**只要是拿两个 Integer 变量算"比例"、"百分比"这类需要精度的结果,必须显式 `Math|Conversions|ToFloat(Integer)` 转换后再做除法**,不要依赖隐式转换。回归测试里判断这类值时,除了"变了"(`< 原值`)也要顺手判断"没被腰斩成 0"(`> 0`),否则测试会把这个 bug 放过去(本轮真实踩过:`T6` 断言写成"< 1.0"没抓到,加了个"> 0.0"的 `T6b` 才抓到)。

- **`Class|Factory|SetText` 不是 TextBlock.SetText**(2026-08-16,遗物条):会接到 Factory 的 Bool `bText`,报 `Could not connect pin ReturnValue to bText`。TextBlock 正确节点是 **`Widget|SetText(Text)`**,参数顺序是 `(target, ToText(String))`。`WBP_AttackForecast.SetHpForecast` 已验证。

- **`read_graph_dsl` 把 `BP_Unit.GetRow` 显示成 `Class|GridSlot|GetRow` 是别名,不是真用了 UMG**(2026-08-16):`get_node_infos` 里 self pin 类型是 `BP Unit Object Reference` 才算数。不要只凭 DSL 就整段重写 SpawnUnit/StartTurn 的 Col/Row。反过来,`UndoAction` 里 `GameplayAbilityTargetActor|GetStartLocation` 是真错,必须改成 `Class|BPUnit|GetStartLocation`。

- **`ApplyStartingRelics` 的 Break 必须接 `BuildRelicLoadout` 的返回值,不能接 Build 之前的 `GetRelicCache`**(2026-08-16):DSL 会把 Break 写在函数最前面,exec 上却是先 Build 再 Set。Break 若仍读旧缓存,遗物加成全是 0,公式看起来「永远不对」。增量修法:把 Break 的 struct 输入从 `GetRelicCache` 改接到 Build 的 `ReturnValue`。

## 请求用户回传时的省 token 原则

- **默认不要求整张 EventGraph** —— 只要新加的那几个节点 + 它们连接的邻居节点。整图回传只在"怀疑有旧节点/其他事件干扰"时才要。
- 复杂改动优先做成**独立 Function**(像 ShowRange/StartTurn/EndTurn),而不是往 EventGraph 里加分支——Function 出错时可以整体重新生成替换,不需要连蒙带猜patch。

### 坑38:`write_graph_dsl` 对历史遗留的 `|GetXXX`/`|SetXXX` 裸写法读写不对称,回写会 `AssertionError: does not exist`(2026-08-17,TPS 迁移阶段A) #WriteGraphDSL #ReadGraphDSL #反序列化失真 #TypeID
`read_graph_dsl` 能把 `BP_TurnManager.StartTurn` 读成含 `(|GetbGameOver _grid)`(无左侧类名前缀)这种简写,但把**原样未改动**的同一段脚本喂回 `write_graph_dsl` 会报 `The node could not be created / |GetbGameOver does not exist`——验证过不是我改坏了语法,是这套 DSL 工具链本身读写不对称,对这类旧函数**任何** `write_graph_dsl` 整函数重写都会炸,哪怕一个字都不改。以后要给这类历史函数(尤其是 5-15 版本之前生成的、带裸 `|GetXXX` 语法的老函数)加逻辑,一律用 `find_nodes`/`get_node_infos` 先读清楚现有节点和 pin index,再用 `create_node`+`connect_pins`(要在中间插入用 `break_pins` 先断开旧连接)做增量编辑,不要赌整函数回写能过。`BP_TurnManager.StartTurn` 加 Possess/UnPossess + AddMappingContext/RemoveMappingContext 就是这么手搭的。

### 坑39:MCP 内省类工具(`get_node_type_pins`/`list_properties`)不会真的在图里创建节点,`set_properties`/`create_node` 才会(2026-08-17) #内省工具 #CreateNode
`get_node_type_pins(graph, type_id)` 会返回一个看起来像真实节点的 `refPath`(例如 `K2Node_EnhancedInputAction_0`),但那只是查询用的预览态,不会持久化进图——之后 `create_node` 建同类型节点时,编号会从这个"幽灵节点"之后继续排(比如变成 `_1`),用 `find_nodes(entry_points_only=true)` 能确认幽灵节点从未真正出现过。不要因为拿到了 `refPath` 就以为节点已经在图里,后续操作要用 `create_node` 实际建出来的 `refPath`。
### 坑40:`bShowMouseCursor=true` 常驻时,Enhanced Input 的鼠标视角(Mouse2D)基本收不到,WASD 倒是不受影响(2026-08-17,TPS 迁移阶段A 用户验收"完全不行/鼠标没反应") #EnhancedInput #InputMode
项目从点击战棋时代起就一直 `bShowMouseCursor=true`+`SetInputModeGameAndUI`(见 `UE蓝图状态.md` `ShowActionMenu`)常驻,给 3D 点击/UMG 按钮用。阶段A 加了 TPS 相机后原样沿用这套输入模式,`Possess`/`AddMappingContext` 用 MCP 直接查live PIE 状态确认都成功执行了(相机世界坐标 = 单位坐标 + SpringArm 偏移量,分毫不差),但鼠标视角仍然不转——**软件鼠标常驻可见+未捕获时,Enhanced Input 收不到稳定的相对位移**,这是需要"看得见鼠标点UI"和"锁鼠标转视角"两种模式来回切的经典 TPS/点击混合游戏坑,不是 Possess 或 IMC 配错。**修法**:`StartTurn` 里 Possess 到己方单位后紧跟 `SetInputMode_GameOnly` + `SetShowMouseCursor(false)`;函数最前面统一 UnPossess 之后紧跟 `SetInputModeGameAndUI` + `SetShowMouseCursor(true)` 恢复点击模式(给敌方回合/未来还要点击的场景兜底)。**排查方法留档**:`get_properties` 直接读 PIE 里 PlayerController 的 `bShowMouseCursor` 能立刻确认当前模式,不用靠人工描述;`get_actor_transform` 对比 `PlayerCameraManager` 和目标单位坐标能验证 Possess 是否真的生效(差值应该正好等于 SpringArm 的 `relativeLocation`/`targetArmLength`),比读 `pawn`/`controller` 这两个字段可靠——这两个字段在 `ObjectTools.list_properties`/`get_properties` 里根本读不出来(`GetObjectProperties ... could not be read: pawn`),这套反射工具对它们没有暴露。

`ObjectTools.set_properties` 的 `values` 参数是**字符串**(JSON 编码后的字符串),不是原生 JSON object,直接传对象会报 `input param "values" is required`。给 `Instanced` 子对象数组赋值(例如 `InputMappingContext.mappings[].modifiers`)时,数组元素直接写**类路径字符串**(如 `"/Script/EnhancedInput.InputModifierNegate"`)就会就地实例化一个新的子对象并写回 `refPath`;写成 `{"class": "..."}` 这种对象形式不会生效,回读会发现该项变成 `"None"`。改一个已经有内容的数组前,先整体清空成 `[]` 再重新整体赋值,否则会报 `ArrayAdd: elements changed alongside the size change`。

### 坑41(未解决,留给下次接手):Enhanced Input 在这个项目里**全项目范围**收不到任何 Action 触发,原始 legacy 按键事件完全正常(2026-08-18/19,TPS 阶段A WASD 移动排查) #EnhancedInput #未解决 #排查方法
用户反馈"和之前一样,不动,移动不了镜头,只有 controller w received"——这句是屏幕上一条调试 PrintString(`BP_TacticsController.EventGraph` 里一个早先加的原始 `Input|KeyboardEvents|W → PrintString("CONTROLLER RAW W RECEIVED")`,和真正的移动逻辑无关,纯粹是之前排查用的探针)。本轮排查链路(**每一步都是用 MCP 直接读 live PIE 状态或改图验证的,不是靠猜**):
1. `BP_Unit.EventGraph` 里 `EnhancedInputActionIA_Move`/`IA_Look` 事件的 `Triggered` 出口确实接到了 `BreakVector2D → AddMovementInput`/`AddControllerYawInput+PitchInput`,节点连线用 `get_node_infos` 逐个 pin 核实过,不是断的(`read_graph_dsl` 在这类手工拼节点的图上会**漏报**连线,显示成空的 `(bind _self self)`,不能信,必须用 `find_nodes`+`get_node_infos` 交叉核实)。
2. `BP_TurnManager.StartTurn` 里 `Possess → EnableInput → AddMappingContext(IMC_TacticsControl, Priority=0) → SetInputMode_GameOnly → SetShowMouseCursor(false)` 整条链路连线也逐 pin 核实过,顺序对、参数对。
3. `IMC_TacticsControl` 的 W/S/A/D/Mouse2D 映射,`modifiers` 数组读出来全部是真实的 `InputModifierNegate_N`/`InputModifierSwizzleAxis_N` 引用,不是坑39说的那种"静默变 None"。
4. 新增 `Input|MappingQueries|HasMappingContext(IMC_TacticsControl)` 诊断节点,分别在 `StartTurn` 里(AddMappingContext 之后)和 `BP_TacticsController` 里绑一个独立的 `H` 键做**实时按需检测**,两处结果都是 `TRUE`——context 全程真的处于 active 状态,不存在"registered 之后又被移除"的情况。
5. 用 `PlayerController|LocalPlayerSubsystems|GetEnhancedInputLocalPlayerSubsystem` 拿到的 subsystem 引用、`Game|GetPlayerController(0)` 拿到的 controller,和真正接收按键的那个 `BP_TacticsController_C_0` 是同一个实例(全场只有一个 PlayerController)。
6. **决定性实验**:把 `IA_Move`/`IA_Look` 的 Enhanced Input 事件**直接搬到 `BP_TacticsController` 自己身上**绑(而不是 Pawn),内部用 `GetControlledPawn()` 转发 `AddMovementInput`——Controller 自己的 `InputComponent` 100% 确认一直在处理输入(它上面绑的原始 legacy `W` 事件每次都正常触发),但即使这样,`IA_Move` 依然一次都没有触发过。**这排除了"是 Pawn 的 InputComponent 没被正确 Possess/入栈"这整条假设**——问题和"绑在谁身上"无关,是 Enhanced Input 这条 Action 触发管线本身在这个项目里完全不工作,legacy 按键管线（无论是 controller 上还是 pawn 上的原始 `Input|KeyboardEvents|W` 事件）则完全正常。
7. 已排查并排除、确认无关的配置项(均用 `ConfigSettingsToolset` 读到真实值,不是猜的):`DefaultPlayerInputClass`/`DefaultInputComponentClass` 都正确指向 Enhanced 版本;`EnhancedInputDeveloperSettings.bEnableInputModeFiltering=true` 但 `defaultMappingContextInputModeQuery` 和 `defaultInputMode` 的 tag(`EnhancedInput.Modes.Default`)本来就匹配,IMC 的 `inputModeFilterOptions` 也是默认的 `UseProjectDefaultQuery`,不会被过滤掉;`defaultMappingContexts`/`defaultWorldSubsystemMappingContexts` 都是空数组,没有优先级更高的默认 IMC 抢输入;`bEnableUserSettings=true` 且已生成 `EnhancedInputUserSettings` 运行时对象,但项目 `Saved/SaveGames` 目录下**没有**存档文件,不存在"玩家自定义按键被禁用"的可能;`IA_Move` 本身 `triggers=[]`、`bConsumeInput=true`、`valueType=Axis2D`,没有奇怪的设置。**以下两项试过改值重启 PIE 测试,均无效,已改回原值**:`RemoveMappingContext` 的 `bIgnoreAllPressedKeysUntilRelease`(True→False,已保留改成 False,无害);`Input.bShouldFlushPressedKeysOnViewportFocusLost`(改 False 无效,已还原成 True);`EnhancedInputDeveloperSettings.bEnableUserSettings`(改 False 无效,已还原成 True);`BP_TacticsGameMode.DefaultPawnClass`(从 `None` 改成 `/Script/Engine.DefaultPawn` 测试"controller 从未走过标准 RestartPlayer 流程"这个假设,无效,已还原成 `None`)。
8. 检查过 `.uproject`/`Source/` 下仅有的 4 对 C++ 文件(`CombatFormula`/`CombatLoadout`/`CombatTables`/`MyProject` 模块入口),没有任何和 `PlayerController`/`PlayerInput`/`InputComponent`/Enhanced Input 相关的 C++ override,排除"C++ 层悄悄拦截了输入"的可能。

**没有解决,原因未知**:这不像是这套项目的 Blueprint 配错了什么,更像是这个 UE 5.8 编辑器实例/项目组合本身 Enhanced Input 的触发管线有问题(可能是引擎层面或者插件冲突,MCP 反射工具够不到这一层)。**留了两套排查基础设施在项目里,没清理,下次接手直接能用**:
- `BP_Unit.EventGraph`:一个原始 `Input|KeyboardEvents|W` 事件 → `PrintString("RAW W KEY RECEIVED")`(用于对比"这个 Pawn 到底有没有在处理输入");一个 `EventTick` 里用 `IsInputKeyDown`(轮询 W/S/A/D)+`Select Float`+`AddMovementInput`、`GetInputMouseDelta`+`AddControllerYawInput/PitchInput` 搭的**完全绕开 Enhanced Input** 的移动/视角实现(走的是最原始的 legacy 轮询,原理上应该可靠,但本轮只用 Slate `PressKey`(瞬间按下+松开,可能撑不到一次 Tick 轮询)测试过,**没有拿到确定结果**,需要真人物理长按 WASD 在编辑器里实测)。
- `BP_TacticsController.EventGraph`:`IA_Move`/`IA_Look` 的 Controller 版实现(同样受 Enhanced Input 这个未解之谜影响,预期也不会动);一个 `H` 键绑定的 `HasMappingContext` 实时检测(按 H 会在屏幕和日志打印 "H CHECK: TRUE/FALSE",可以随时确认 IMC 是否 active);`N` 键强制 `EndTurn`(更早留下的调试快捷键,和这轮无关但顺手记一下)。
- `BP_TurnManager.StartTurn`:`AddMappingContext` 之后有一段 `HasMappingContext` 检测 + `PrintString("IMC ACTIVE: TRUE/FALSE")`,每次 `StartTurn` 跑到该分支都会打一次。
**下一步建议**:①先用真人物理长按测一次 `BP_Unit.EventTick` 那套 legacy 轮询移动方案,如果这个也不动,基本可以确认问题在更底层(不是 Blueprint 层面能修的),需要考虑换一个干净的空白测试关卡/项目验证 Enhanced Input 本身是否正常,排除这个项目/这份 5.8 编辑器安装是否有损坏;②如果 legacy 轮询方案能动,直接把它转正、删掉 Enhanced Input 那一整套(IA_Move/IA_Look/IMC_TacticsControl 保留给阶段C 的 Attack/EndTurn 用,如果那两个到时候发现也不触发,同样换成 legacy 方案)。

**结果:legacy 轮询方案真人长按测试确认能动**(2026-08-20),按建议②转正。移动/视角本身能用,但用户报了 3 个方向性 bug,根因是同一类错误——见坑42。

### 坑42:legacy 轮询移动第一版用 `GetActorForwardVector`/`GetActorRightVector` 当移动方向,和 `bOrientRotationToMovement=true` 打架;鼠标 Y 轴原始 delta 没做工程惯例的取反(2026-08-20) #Transform #EnhancedInput #ConstructionScript #移动方向
用户长按测试反馈三个问题:①A/D 按下时角色是"转"而不是"平移"、体感很怪;②按 W 时角色是横着走,不是朝着"脸"的方向走;③鼠标上下移动,镜头转动方向是反的。

**根因(①②同源)**:`BP_Unit.EventTick` 第一版把 `AddMovementInput` 的 `WorldDirection` 接到 `GetActorForwardVector`/`GetActorRightVector`(即角色自身当前朝向算出来的前后左右)。但 `CharMoveComp.bOrientRotationToMovement=true`(阶段A 就设的,见 `UE蓝图状态.md`),身体朝向会自动转向"最近一次移动的方向"。这两者接在一起就会形成反馈环:按 A/D 让角色朝侧面走一步 → 身体转过去面朝侧面 → 下一帧"前"这个概念已经变了(因为 `GetActorForwardVector` 也跟着转了)→ 视觉上就是角色原地打转/斜着走,不是稳定的"这个方向一直是前、那个方向一直是右"。这是 TPS/第三人称控制器的经典坑:**移动输入的参考系应该用镜头(Controller 的 `ControlRotation`),不能用角色自身的 `ActorForwardVector`**——`bOrientRotationToMovement` 本来就是"身体去追相机决定的移动方向",如果移动方向本身又依赖身体朝向,这个"追"就永远追不上、还会震荡。

**修法**:新增 `GetControlRotation`(在 `CastToPlayerController` 得到的 Controller 上调,不是 Pawn 上那个重载)→ `BreakRotator` 只取 `Yaw` → `MakeRotator(Roll=0,Pitch=0,Yaw=该值)` → 分别接 `Math|Vector|GetForwardVector`/`GetRightVector`(这两个是纯函数,吃一个 `Rotator` 参数,不是 `Transformation|GetForwardVector` 那个吃 Actor 的版本,注意 `find_node_types` 同名前缀下有好几个同名条目,要用 `get_node_type_pins` 核实入参类型)。把这两个纯函数的输出接到原来 `AddMovementInput` 的 `WorldDirection`,`GetActorForwardVector`/`GetActorRightVector` 两个节点保留在图上没删(还被 Enhanced Input 那条不触发的 IA_Move 分支用着,留着无害)。

**根因③**:`GetInputMouseDelta` 返回的是屏幕坐标系原始像素差,没有经过 UE 传统 Input Axis Mapping 里对 `MouseY` 惯例加的 `Scale=-1.0`(引擎默认工程的 `LookUp` 轴绑定就是这么配的,让"鼠标往上推、镜头往上抬"符合直觉)。这里直接把 `DeltaY` 传给 `AddControllerPitchInput`,少了这一次取反,方向就是反的。**修法**:插一个 `Utilities|Operators|Multiply`(通用可提升的乘法节点,接上浮点会自动特化成 `Math|Float|float*float`)在 `DeltaY` 和 `AddControllerPitchInput.Val` 之间,`B` 端设常量 `-1.0`。`DeltaX`→`AddControllerYawInput` 没这个问题,没动。

**规律沉淀**:这条项目里往后凡是"新写一段第三人称/TPS 风格的移动输入",一律先问自己"移动方向的参考系是镜头还是角色自己",只要角色开了 `bOrientRotationToMovement`,移动方向就必须来自 Controller 的 `ControlRotation`(仅取 Yaw),不能用 `GetActorForwardVector`/`GetActorRightVector`。

**结果:①②的移动方向参考系改对之后,A/D 平移和鼠标方向用户确认已修好,但 W 仍然"横着走"(2026-08-20 第二轮反馈)**。由于 A/D(用同一个相机 Yaw 算出来的 `GetRightVector`)已经验证方向正确,说明移动方向的数学本身没问题;问题缩小到**视觉朝向**——`bOrientRotationToMovement=true` 会让胶囊体(Actor 根)转向去对齐移动方向,但**挂在胶囊体下面的 `StaticMesh` 组件本身没有任何 `RelativeRotation` 补偿(一直是 0,0,0)**,而这个 Mewtwo 模型资产本身建模时的"脸朝向"并不是 UE 约定的局部 +X,而是局部 **+Y**——也就是说胶囊体转到正确朝向后,模型的脸依然侧对着旅行方向 90°,视觉上就是"身体在走但脸一直朝着一侧",给人"横着走/像螃蟹一样平移"的错觉,和移动方向数学是否正确无关。

**排查方法(留档)**:直接改 `StaticMesh.RelativeRotation` 这条路走不通——**用 `ObjectTools.set_properties` 在关卡里已放置的 Blueprint 实例上改 `StaticMesh` 组件的 `RelativeRotation`,`return true` 但读回来立刻还原成 `(0,0,0)`,不会报错也不会生效**(疑似这类 Blueprint 实例的组件 Relative Transform 走的是 SCS 模板同步机制,直接反射赋值会被下一次同步悄悄冲掉,不同于 CDO 上可以正常读写的简单 UPROPERTY)。改用 `EditorToolset.EditorAppToolset.CaptureViewport` 在一个远离主关卡(挪到世界坐标 `(10000,10000,0)` 附近空地,避开其他 actor 的编辑器图标干扰)现场生成的临时 `BP_Unit` 实例上做视觉验证:先看"从正后方沿角色 local +X 看过去"是否对称(对称说明模型主轴已经和胶囊体 forward 对齐,不对称/侧脸说明还偏着),再看"从正前方看" 是否正对着脸——用这两张图确认模型朝向后,再把修法写回 Blueprint 图里的正式逻辑,不能光靠盲改一次属性就收工。

**真正的修法**:不改组件属性(改不动),改成在 `BP_Unit.UserConstructionScript` 里(血条搭建逻辑末尾追加)新增 `StaticMesh(变量 Get)` → `SetRelativeRotation(NewRotation=(Pitch=0, Yaw=-90, Roll=0))`,这样编辑器预览和运行时都会执行到(构造脚本每次实例化/属性变化都会重跑,比只在 `EventBeginPlay` 里改更保险,编辑器里摆放时也能看到效果)。**用临时 actor 验证过**:改之前从正后方看是侧脸(左右不对称,尾巴甩在一侧),改之后从正后方看完全对称(说明模型主轴对齐了胶囊体 forward),从正前方看确认对到的正是 Mewtwo 的脸——不是猜的,是靠两张对比截图确认的。

**规律沉淀(第二条)**:`RelativeRotation` 这类 Transform 属性,在**已经放置在关卡里的 Blueprint 实例**上用 `ObjectTools.set_properties` 直接改,不一定真的生效(读回来可能被静默还原),尤其是 SCS(Simple Construction Script)组件——遇到"`set_properties` 返回 `true` 但读回来没变"这种情况,不要重试同一个调用,改用 Blueprint 图里插 `SetXXX` 节点的方式(`create_node`+`connect_pins`,走 `UserConstructionScript` 或 `EventBeginPlay`),这是真正会持久生效的路径。

**2026-08-20 用户人工 Play 验收通过**:WASD 四向稳定对应前后左右、W 沿脸朝向走、鼠标上下方向符合直觉,三条全部确认。坑42 到此收尾——根因是两层独立问题(移动方向参考系用错、模型资产脸朝向和 UE 约定的局部轴不一致),不是同一个 bug 的两次反复,记录时不要合并成一条。

### 坑43:`get_node_type_pins` 返回的节点 refPath 不保证是图里真实存在的持久节点(2026-08-20,TPS 阶段B 移动范围软边界排查) #内省工具 #CreateNode
写 `BP_Unit.EventTick` 的软边界+Col/Row回写逻辑时,查了好几个陌生节点类型(`Actor|GetAllActorsOfClass`/`Transformation|SetActorLocation`/`Math|Vector|ClampVectorSize`/`Variables|Default|GetMoveRange`/`Class|BPGridManager|GetTileSize`/`Utilities|Array|Get(acopy)`)的 pin 信息,每次都是只调 `get_node_type_pins`(没有配对调用 `create_node`)就直接拿返回结果里的节点 refPath 去 `connect_pins`——一开始这样是能连上的(甚至能编译通过),但中途一次不相关的 `connect_pins` 报了类型不兼容错误之后,**再回头用同一批 refPath 做任何操作(`connect_pins`/`get_node_infos`)全部报 `not valid EdGraphNode`**,包括之前明明连接/查询成功过的节点。

**推测机制**:`get_node_type_pins` 内部大概率是创建了一个真实但**未提交/事务性**的预览节点来读 pin 信息,这类节点在某个事务边界(很可能是任意一次失败操作触发的回滚,或者别的图操作触发的一次批量清理)会被整批销毁,而真正通过 `create_node` 显式创建、且已经成功参与过 `connect_pins` 的节点不受影响——但这个"已经连过线就安全"的假设也不完全可靠(本轮亲眼看到已经连线成功的 `GetAllActorsOfClass`/`SetActorLocation` 节点后来同样失效),所以不能依赖"用过一次就稳了"这种侥幸。

**规律沉淀(硬规则)**:`get_node_type_pins` 只用来读 pin 名字/类型/方向,**它返回的 `node.refPath` 一律不要当成图里可用的真实节点**。任何要保留使用的节点,必须显式调用一次 `create_node`,拿**那次调用自己返回**的 refPath 去连线——哪怕 `get_node_type_pins` 之前已经告诉过你这个类型的 pin 长什么样,也要重新 `create_node` 一次,不能省这一步图快。本轮踩坑的表现是编译一度报错、之后重新用 `create_node` 补建 5 个节点才修好,浪费了一整轮排查;以后但凡看到 `not valid EdGraphNode` 这个报错,第一反应就是"这个节点大概率来自 `get_node_type_pins` 预览,不是真节点",直接重新 `create_node`,不用怀疑是不是自己 refPath 抄错了。

### 坑44:DSL 里 `write_graph_dsl` 对 type_id 带圆括号的节点名(如 `Math|Vector|Distance(Vector)`)容易出问题,换成不带括号的等价节点更省心(2026-08-20) #WriteGraphDSL #TypeID #DSL语法
写 `BP_GridManager.GetNearestTile` 这个全新函数时,本想用 `Math|Vector|Distance(Vector)`(直接两个 Vector 参数算距离,语义最直接)但 DSL 语法本身用圆括号做分组,type_id 字符串自带的 `(Vector)` 后缀在 S-表达式里容易被解析成函数调用的一部分,有歧义风险——**没有实测出具体报错,但为了不赌,改用了没有括号的 `Math|Vector|VectorLength`(单参数)配合 `-`(相减)运算符,效果等价且规避了这个隐患**。**规律沉淀**:以后 `write_graph_dsl` 里要用的节点,`find_node_types` 搜出来的候选如果 type_id 字符串本身带圆括号(常见于同名重载的消歧后缀,比如 `XXX(Vector)`/`XXX(acopy)`),优先找一个不带括号的等价节点;如果确实只有带括号的版本,改用 `create_node`+`connect_pins` 手动搭,不要冒险塞进 DSL 文本。

### 坑45:移动范围软边界第一版用欧氏距离(`ClampVectorSize`)夹断,但项目里"移动范围"这个概念全是曼哈顿距离——两种度量在斜向上不等价,导致"移动范围包含了攻击范围"(2026-08-20,TPS 阶段B 用户验收反馈) #Transform #距离度量
`BP_Unit.EventTick` 里给移动加软边界时,直接抄了最直觉的写法:`ClampVectorSize(Delta, 0, MoveRange×TileSize)`——限制离回合起点的**直线(欧氏)距离**不超过半径,圆形边界。看起来合理,编译通过、MCP 也验证过"正对着走"会在半径处被拉回,但用户 Play 反馈"移动不能超出棋盘"+"移动范围包含了攻击范围"——**根因**:这个项目从战棋点击时代起,`ShowRange`(黄色移动范围高亮)、`ShowAttackRange`(红色攻击范围高亮)全部是基于 `ManhattanDistance(Col/Row)` 算的,也就是**菱形**边界,不是圆形。同样"半径 R"下,欧氏圆形的面积比曼哈顿菱形大(圆形包住了菱形四个角外面那圈区域),斜着走 45°方向时圆形边界能摸到的格子,换算成格子数早就超过了 `MoveRange`——而 `MoveRange` 到 `MoveRange+AtkRange` 之间的格子正是 `ShowAttackRange` 画的红色攻击环,所以视觉上"移动范围"看起来吃掉了"攻击范围"的一部分。另外欧氏圆形边界本身也没有对棋盘实际大小做任何限制,离棋盘边缘近的位置斜着走还会直接冲出棋盘。

### 坑46:同一个类的 Blueprint 图里,读不到"另一个同类实例"的变量——跨实例读取必须放到别的蓝图里做(2026-08-21,ARPG 攻击操作接线) #跨实例 #CreateNode #TypeID
写 `BP_Unit.AttemptSkillAttack()` 时,需要读**另一个** `BP_Unit` 实例(被准星命中的敌人 `HitUnit`,不是 `self`)的 `Side`/`Col`/`Row`。之前在 `BP_GridManager` 的图里(跨类)可以顺利 `create_node` 出 `Class|BPUnit|GetCol`/`Class|BPUnit|GetAtkRange` 这种带独立 `self` 输入 pin、能接任意 `BP_Unit` 引用的"跨实例读取"节点——但同样的 `Class|BPUnit|GetSide` 在 **`BP_Unit` 自己的图里**用 `create_node` 建会直接报 `does not exist`,`declaring_class` 消歧也救不了;`find_node_types` 不管加不加 `context_pins` 都只搜得到 `Variables|Default|GetSide`,而这个版本**没有 `self`/`Target` 输入 pin**,只能读隐式的 `self`(也就是永远读到"我自己"的 `Side`,不是想要的 `HitUnit` 的)。

**规律沉淀**:MCP 这套反射工具里,"跨实例读取某个类的变量"这种节点,只有在**当前图所属的类和目标类不同**时才会出现在可创建列表里;当前图所属类 == 目标类时,系统只给隐式 `self` 版本,没有显式 `Target` 版本可选(即使 UE 编辑器 GUI 里手动拖一条 `BP_Unit` 引用线出来是能建出带 `Target` 的版本的,这个限制目前只存在于 MCP 的节点创建接口,不代表引擎本身不支持)。**应对方法**:凡是要在 `BP_Unit` 自己的图里读**另一个** `BP_Unit` 实例的变量,不要在 `BP_Unit` 里硬解,改成在 `BP_GridManager`(或任何非 `BP_Unit` 的蓝图)里新建一个小函数把判定逻辑包起来,`BP_Unit` 只传对象引用进去、拿布尔/数值结果出来——这次是新增 `BP_GridManager.ValidateSkillTarget(Attacker, Defender, SkillIndex)` 解决的,不是绕弯子,是这条限制下唯一稳定可行的路径。

**规律沉淀**:给一个已经存在"格子/网格"概念的系统加连续移动的软边界时,**边界的距离度量必须和这个系统原有的距离度量保持一致**,不能凭直觉选"看起来对"的欧氏距离——先去翻现有的 `ShowRange`/`ManhattanDistance` 之类的函数,确认项目"官方"用的是哪种距离,新加的软边界必须复用同一种(这里改成手搭 `|Delta.X|+|Delta.Y|` 曼哈顿和按比例缩放,而不是内置的 `ClampVectorSize`)。同时"移动范围"和"棋盘边界"是两个独立的约束,即使移动范围本身没问题,也不能假设它自动帮你挡住棋盘边缘——**棋盘边界要单独夹一次**,直接从真实 Tile 位置现算 min/max(见 `GetNearestTile`/`ClampMovement` 同款"不猜公式,查真实数据"套路),不要假设棋盘原点在世界坐标 (0,0) 或用 `Columns×TileSize` 心算,坐标系里可能有你不知道的偏移。修法详见 `UE蓝图状态.md` "TPS 阶段B" 一节的 v2 版本(`BP_GridManager.ClampMovement`)。

### 坑47:`read_graph_dsl` 把跨对象的同名属性 Get 节点(`Col`/`Row` 这类在多个类上都存在的字段)**反向序列化时可能选错所属类**,原样喂回 `write_graph_dsl` 会导致后面无关的 `self` 参数连线彻底连错(2026-08-21,排查"技能射程环刷屏 Accessed None 读 SelectedUnit"报错) #ReadGraphDSL #反序列化失真 #命名撞名

**背景**:`BP_GridManager.ShowSkillRange` 直接读 `Variables|Default|GetSelectedUnit` 后立刻调 `GetCol`/`GetRow`,没有判空,而 `BP_Unit.EventTick` 每 Tick 无条件调用它——一旦 `SelectedUnit` 还没被设置(开局第一帧、或选中的单位被清空/销毁后),每个还在 Tick 的单位每帧都会报一条 `Accessed None trying to read (real) property SelectedUnit`,日志刷屏。

**排查弯路**:一开始以为是 `Utilities|IsValid` 通过 `write_graph_dsl` 写 if 分支不可靠(坑2 的老问题),换过好几种写法都复现同一个报错:`RuntimeError: Could not connect pin SelectedUnit to self`。逐层剥离后发现和 `IsValid`、`if` 嵌套、`bind` 命名全都无关——**只要函数体里出现 `(Class|BPTile|GetCol (Variables|Default|GetSelectedUnit))` 这种写法(`SelectedUnit` 实际类型是 `BP_Unit`,却用 `BPTile` 的 `GetCol` 节点去读它),`write_graph_dsl` 编译时就会把这个节点内部的连线搞乱,报错信息里提到的 pin 名字(`SelectedUnit`/`Array Element`/`NearestTile`)其实就是"被错误当成目标类型"的那个变量名,和报错文本里出现的 `self` 没有任何语义关系,纯粹是误导**。用 `find_node_types(type_id_filter="GetCol")` 一查,`Class|BPTile|GetCol` 和 `Class|BPUnit|GetCol` 是两个真实存在的不同节点;`read_graph_dsl` 读回原本已经编译好的图时,把作用在 `BP_Unit` 实例上的 `GetCol` 错误标注成了 `Class|BPTile|GetCol`(`GetRow` 同理,真实存在的是 `Class|BPUnit|GetRow`,读回来却被标成了风马牛不相及的 `Class|GridSlot|GetRow`)——这是 `read_graph_dsl` 反向序列化的显示 bug,不代表图里实际连的就是这个节点。

**规律沉淀(硬规则)**:任何时候只要要对一个 Get 节点的**目标对象**做 `write_graph_dsl` 重写,不能盲目照抄 `read_graph_dsl` 读回来的 type_id——**先用 `find_node_types` 按字段名查一遍该目标对象的真实类(比如 `GetCol`/`GetRow`/`GetAtkRange` 这类多个类共享同名字段的属性),确认 type_id 里的类名前缀和目标变量的实际类型一致,再写进 DSL**。本轮修法是把 `ShowSkillRange` 里所有 `(Class|BPTile|GetCol SelectedUnit)`/`(Class|GridSlot|GetRow SelectedUnit)` 改成 `(Class|BPUnit|GetCol SelectedUnit)`/`(Class|BPUnit|GetRow SelectedUnit)`(`SelectedUnit` 是 `BP_Unit`),`Tile` 数组元素那边保留 `Class|BPTile|GetCol`/`Class|BPTile|GetRow`(这两个本来就是 `BP_Tile`,不受影响)。

**排查过程中顺带踩的另一个真实存在的坑**:反复 `write_graph_dsl` 到同一个函数超过 5~6 次后(哪怕每次都因编译失败而回滚),图里偶发残留垃圾节点导致 `add_function_graph` 用原名重建时被迫改名成 `<原名>_0`(坑1 已记录过这个现象)——这次用 `remove_function_graph` → `compile_blueprint`(强制清理一次悬空引用)→ 再 `add_function_graph` 才顺利拿回原名,直接连续 `remove`+`add` 不经过 `compile_blueprint` 会立刻撞上改名。删掉重建后 `BP_Unit.EventTick` 里原有的 `Class|BPGridManager|ShowSkillRange` 调用节点没有失效,`compile_blueprint` 两个蓝图都顺利通过——说明只要函数名重建后完全一致,跨蓝图的 `CallFunction` 引用是按名字在编译期重新解析的,不需要手动去调用方补线。

**最终修法**:`ShowSkillRange` 顶层加 `Utilities|IsValid SelectedUnit` 的多消息(`:"Is Valid"`/`:"Is Not Valid"`)包一层,无效直接跳过整个循环——这个写法本身没问题(`BP_TurnManager.StartTurn` 里早就有一个成功的先例),这次卡住纯粹是因为同一段代码里混进了上面这个类名写错的 bug,和 `IsValid` 本身无关。

### 坑48:`create_node` 建"自身类成员函数调用"节点必须写 `CallFunction|函数名`,即使 `get_node_infos`/`get_connected_subgraph` 把同一个节点的 `type_id` 显示成裸 `|函数名`(2026-08-22,技能快捷栏 UI 接线) #CreateNode #ReadGraphDSL #TypeID #反序列化失真

新建 `BP_TurnManager.RefreshSkillBar()`/`BP_Unit.UpdateSkillBarUI()`/`BP_Unit.AttemptSkillAttack()` 这类"调用同一个蓝图自己的成员函数"的节点时,`create_node(type_id="|RefreshSkillBar")` 会直接报 `does not exist`;但读现有图(比如已经接好的 `LeftMouseButton→AttemptSkillAttack`)时,`get_connected_subgraph` 把这个调用节点的 `type_id` 显示成 `|AttemptSkillAttack`(裸竖线,没有前缀)。用 `find_node_types(type_id_filter="RefreshSkillBar")` 一查,真正能创建的 type_id 是 `CallFunction|RefreshSkillBar`。**规律**:`create_node` 的输入 type_id 词表和 `get_node_infos`/`get_connected_subgraph` 的输出显示词表不是同一套——**新建"自身类函数调用"节点前,一律先 `find_node_types` 查一遍确认可创建的确切拼法(通常要加 `CallFunction|` 前缀),不要照抄读图工具显示的 `type_id`**。（对比:跨蓝图/跨实例调用另一个类的函数用的是 `Class|类名|函数名`,这条不受影响。）

### 坑49:`write_graph_dsl`/`create_node` 里,函数调用的位置参数严格按 `get_node_type_pins` 返回的 pin 声明顺序绑定,不能按"目标对象习惯上放第一个"之类的直觉猜(2026-08-22,技能快捷栏 UI 接线) #WriteGraphDSL #CreateNode #参数顺序

写 `Class|Border|SetBrushColor` 时凭 `Class|BPGridManager|ShowRange grid unit` 这类"目标实例在前、普通参数在后"的既有印象,把 `(Class|Border|SetBrushColor 边框实例 颜色)` 这样写,结果报 `Could not connect pin Slot0 to BrushColor`——`get_node_type_pins` 一查才发现这个函数的 input pin 顺序其实是 `execute, BrushColor, self`(颜色在前,目标实例在后),和 `ShowRange` 的 `execute, self, Unit` 顺序正好相反。同一轮里 `Class|WBPSkillBar|SetSelectedIndex` 又是 `execute, self, Index`(目标在前)——**两个自定义/引擎函数的 self pin 位置完全不统一,没有通用规律**。**规律沉淀**:任何一次新的跨实例/跨蓝图函数调用,写 DSL 前先 `get_node_type_pins` 确认输入 pin 的真实顺序(排除 `execute`,按剩下的 `index_id` 从小到大就是位置参数顺序),不要凭其他函数的调用习惯去猜,猜错的报错信息(比如"Could not connect pin A to B")里的 A/B 名字往往就是"实参output pin名"和"被误连的那个形参pin名",可以反推正确顺序。

### 坑50:`read_graph_dsl` 把"Widget 的 `Visibility` 属性直接赋值"节点(裸 `type_id="|SetVisibility"`,给 `ESlateVisibility` 枚举赋值)和"SceneComponent 的 `SetVisibility(bool)` 函数调用"节点(`type_id="Rendering|SetVisibility"`)**反序列化成同一个显示名 `Rendering|SetVisibility`**,原样喂回 `write_graph_dsl` 会把字符串枚举值错连到布尔参数上报类型不兼容(2026-08-22,技能快捷栏挂到 BeginPlay 时重写 EventBeginPlay) #ReadGraphDSL #反序列化失真 #UMG

`BP_TurnManager.EventGraph.EventBeginPlay` 原文本里 `(Rendering|SetVisibility (Variables|Default|GetOrderBarComponent))`(单参数,给 `WidgetComponent` 设可见性,来自真正的 `Rendering|SetVisibility` 函数)和 `(Rendering|SetVisibility "Collapsed" _actionmenuwidget)`(两参数,给 `UUserWidget` 设 `ESlateVisibility`,实际节点是属性赋值器 `|SetVisibility`)在 `read_graph_dsl` 输出里**用了同一个前缀**,肉眼完全看不出区别。原样把后者喂回 `write_graph_dsl` 时,写入器按 `Rendering|SetVisibility` 函数的 pin 顺序(`execute, self:SceneComponent, bNewVisibility:Bool, bPropagateToChildren:Bool`)解析两个位置参数,把字符串 `"Collapsed"` 硬连去匹配 `_actionmenuwidget`(Widget 引用)所在的 `self` 位置、`_actionmenuwidget` 又被顶去接 `bNewVisibility`,类型全错,报 `Could not connect pin ActionMenuWidget to bNewVisibility`。用 `get_node_infos` 直接查原图对应节点才发现它真实 `type_id` 是 `|SetVisibility`(`execute, Visibility:ESlateVisibility Enum, self:Widget Object Reference`)。**规律沉淀**:凡是要对既有图里的 `SetVisibility` 语句做 `write_graph_dsl` 整段重写,一律先用 `get_node_infos`/`find_nodes` 核实该语句对应的真实节点(`Rendering|SetVisibility` 是 SceneComponent 的 bool 版本,`Widget|SetVisibility` 才是 Widget 的 `ESlateVisibility` 版本,两者 pin 类型完全不同),改写成明确的 `Widget|SetVisibility 目标 "枚举值"` 而不是照抄 `read_graph_dsl` 显示的 `Rendering|SetVisibility`。同一轮还确认了另一条独立规律:同一个跨实例变量 Getter 在不同节点种类里,类名前缀"是否去掉下划线"不统一——`Variables|WBP_SkillBar|GetTxt_Skill0`(变量读取,保留下划线)和 `Class|WBPSkillBar|SetSkillLabels`(函数调用,去掉下划线)是同一个资产 `WBP_SkillBar` 却拼法不同,必须各自 `find_node_types` 验证,不能类推。

### 坑51:`Utilities|IsValid` 写成 `(if (Utilities|IsValid X) 真分支...)` 这种"包在 `if` 条件位里"的形式,`write_graph_dsl` 能编译通过,但生成的是完全不连通的死代码——必须用 `:"Is Valid"`/`:"Is Not Valid"` continuation 语法(2026-08-22,排查"技能栏按 1-4 完全没反应"的 bug 根因) #WriteGraphDSL #IsValid #死代码 #ReadGraphDSL #反序列化失真

`BP_Unit.UpdateSkillBarUI()` 第一版这样写:`(if (Utilities|IsValid tm) (bind bar ...) (if (Utilities|IsValid bar) (SetSelectedIndex ...)))`。`write_graph_dsl` 没有报任何错、`compile_blueprint` 也顺利通过,表面上一切正常,唯一的症状是**运行时这个函数完全没有可观察效果**(高亮永远不变)。用 `get_node_infos` 逐节点核对才发现:`if` 生成了一个真正的 `Branch` 节点,但它的 `Condition` 输入 pin 是**硬编码字面量 `"true"`**、`execute` 输入 pin **完全没有连接任何东西**;与此同时另外生成了一个 `Utilities|IsValid` 宏实例,它的 `exec` 输入倒是接对了(接在 `Cast.then` 后面),但它的两个真实输出 `Is Valid`/`Is Not Valid` **哪个都没往下接**——等于这条 exec 链跑到 `IsValid` 宏就彻底断头,`Branch`/后续所有节点都是孤岛,只是因为图本身没有语法错误,`compile_blueprint` 检测不出来。

**根因**:`Utilities|IsValid` 是"多出口"(multi-exec)宏,只有两个 exec continuation,**没有 Bool 类型的输出 pin**,不能当一个返回 Bool 的纯表达式塞进 `if`/`select`/其他函数的参数位——`get_graph_dsl_docs` 的语法说明和唯一示例("Example — IsValid (pin names contain spaces)")用的都是 `(Utilities|IsValid obj (:"Is Valid" ...) (:"Is Not Valid" ...))` 这种 continuation 形式,从来没有出现过 `if` 包 `IsValid` 的写法。之前（坑47 尾注、`RunRegressionTests` 相关记录)反复出现过"`if` 包 `IsValid`"这种表述,那是因为 `read_graph_dsl` **反编译时把 continuation 形式的 `IsValid` 又显示成了 `if` 的外观**(坑47 早就点出过 `read_graph_dsl` 对这类结构反编译会失真,但没有强调"这条失真具体会诱导人写出错误的 DSL 源码"这一后果)——照抄那种"看起来是 `if` 包 `IsValid`"的显示文本去写新代码,正是这次踩坑的直接原因。

**规律沉淀(硬规则)**:任何新写的 `IsValid` 判断,一律用 `(Utilities|IsValid 目标 (:"Is Valid" 真分支...) (:"Is Not Valid" 假分支...))` 的 continuation 语法,**永远不要**写成 `(if (Utilities|IsValid 目标) ...)`。如果某处 `read_graph_dsl` 读出来的旧代码显示成了 `if` 包 `IsValid` 的样子,那只是反编译显示层的失真,不代表图里真实节点就是这样连的,更不能照抄这种显示文本去写新函数——**这类"看起来正常但运行时是死代码"的 bug 不会被 `compile_blueprint` 或任何编译期检查发现**,只能靠 `get_node_infos` 逐节点核对 exec 链路是否真的从头到尾连通,或者干脆运行时观察不到预期效果时,第一时间怀疑是不是又把 `IsValid` 写错了语法。修复流程(和坑47 尾注一致):`remove_function_graph` → `compile_blueprint`(强制清悬空引用)→ `add_function_graph` 拿回原名 → 用 continuation 语法重写,EventGraph 里原有的跨函数调用(比如这次 5 个数字键 fan-in 到 `UpdateSkillBarUI` 调用节点的连线)按名字重新解析,不用手动补线。

### 坑52:排查"某个操作还能通过意料之外的方式触发"这类问题,必须从**终点函数**反向搜索所有调用方,不能从"最近改过的输入"出发局部排查——否则会像"删鼠标攻击"这次一样连续三轮才堵完(2026-08-22) #排查方法 #跨蓝图

用户要求"鼠标不再控制攻击,只用 E 键",第一轮删了 ARPG 阶段新加的 `LeftMouseButton→AttemptSkillAttack` 按键绑定,用户反馈"还是不行";第二轮又找到 `BP_Unit.ReceiveActorOnClicked`(点击 3D 网格触发的"clickable"接口事件,和按键事件是完全不同的机制)里"点敌方→弹攻击预测面板"这条 2026-08-16 就存在的老分支删掉,用户反馈"还是不行"；第三轮才顺着 `TryAttack`/`ShowActionMenu` 这些真正产生游戏效果的函数,反向搜索**所有**调用方,发现了第三条、也是最隐蔽的一条:`BP_TurnManager.StartTurn` 轮到我方单位时会**无条件**自动高亮移动/攻击范围格子,`BP_Tile.EventActorOnClicked` 一直监听"点一个高亮格子"→ 瞬移单位 + 弹出鼠标可点的行动菜单(`ShowActionMenu`)——这条链完全不挂在"攻击"或"点敌人"相关的任何事件上,而是挂在"点地板格子(移动)"这个看起来跟"攻击"毫不相关的入口上,前两轮排查压根没往这个方向想。

**根因(项目结构性的)**:这个项目从"回合制点选"重构到"ARPG 直控"的过程中,新系统是**叠加**上去的,不是替换——旧系统的多个独立触发点(自动弹出高亮、点格子的响应、点单位的响应、UI 菜单按钮)分散在 `BP_TurnManager`/`BP_Tile`/`BP_Unit` 三个不同蓝图的不同事件里,任何一个"感觉相关"的输入点都可能只是冰山一角。

**规律沉淀(硬规则)**:遇到"某个操作(移动/攻击/选择/弹窗)还能被意料之外的方式触发"类问题,**第一步永远是先确定"真正执行这个操作的终点函数"是哪个**(这次是 `TryAttack`——真正扣血的函数;或者 `ShowActionMenu`——真正弹出鼠标菜单的函数),然后用 `find_nodes`/逐个蓝图 `read_graph_dsl` **搜出这个函数在全项目所有蓝图里的每一处调用**,再对每一处调用点分别判断"这条调用路径是否应该继续存在"。不要从"哪个输入最近被改过"或"哪个输入看起来和这个操作直接相关"出发去局部排查——那样只能覆盖到你自己能想到的路径,覆盖不到"事件名字和操作名字对不上"(比如"点地板格子"触发"弹攻击菜单")这种历史遗留的隐蔽关联。

### 坑53:`Math|Vector|vector*vector`(向量按分量相乘)的某个输入 pin 如果完全没连线也没手动填值,`get_node_infos`/`get_pin_value` 读出来是**空字符串**,不会像别处那样显示成看得出问题的 `"0, 0, 0"` 字面量——这种"看不见的零向量"会让 `LineTraceByChannel` 之类下游节点安静地失效,不报任何错(2026-08-22,排查"E 键完全打不中任何东西") #向量运算 #CreateNode #排查方法

`BP_Unit.AttemptSkillAttack()`(当初就是 `create_node`/`connect_pins` 手工搭的,文档原话"DSL 不适合")里,`LineTraceByChannel` 的终点(`End`)算法是 `TPSCamera世界坐标 + (准星前向量 × 距离)`,这个"× 距离"用的是 `Math|Vector|vector*vector`(向量按分量相乘,不是向量乘标量)。它的第二个输入 `B` 从这个函数第一次被搭出来就没有连任何节点、也没有手动填过字面量。`get_node_infos` 读这个 pin 时 `value` 字段是**空字符串 `""`**,不是 `"0, 0, 0"`(和别处"确实设成了零向量"的 pin 显示方式不一样,后者会老老实实显示 `"0, 0, 0"`)——纯看 `get_node_infos` 的输出,这个空字符串很容易被当成"这个字段没什么信息"而略过,不会第一眼联想到"这其实是个会参与实际计算的零向量"。结果是准星前向量 `×(0,0,0)=(0,0,0)`,`End = Start`,射线长度恒为 0,不管准星对着哪、离敌人多近,`LineTraceByChannel` 永远返回"没打中"——**编译不报错、运行不报错、`if bHit` 分支从第一天起就没被走到过**,现象是"按 E 完全没反应",很容易被误判成"按键没接上"或"目标校验太严格"这类完全不同方向的问题。

**规律沉淀(硬规则)**:
1. **排查"某个节点算出来的结果不对/恒为默认值"时,不能只看 `get_node_infos` 里那个可疑 pin 的 `value` 字段是不是"看起来正常"**——空字符串和真实的零值字面量长得不一样,但效果一样致命,必须显式想清楚"这个 pin 如果没人填,运行时到底会取什么值",而不是假设"没显示 = 没问题"。
2. **用 `read_graph_dsl` 把整条计算链摊开来看,比一个个查 `get_node_infos` 更容易发现这类"孤零零缺了一环"的 bug**——这次是 `read_graph_dsl` 把 `(Math|Vector|vector*vector (Math|Vector|GetForwardVector ...) 0)` 里那个形单影只的字面量 `0` 摊在纸面上,才一眼看出"这里应该是个距离值,不应该是常量 0"。
3. **凡是"方向向量 × 距离"这种场景,优先找专门的"向量乘标量"节点(通常叫 `vector*float` 或类似),而不是 `vector*vector`**——用 `vector*vector` 就必须记得把标量"广播"成三个分量都相同的向量(比如 `(3000,3000,3000)`),多一步就多一次忘记填的机会,这次的坑本质上就是"该用标量乘却选了分量乘,又忘了填第二个操作数"两个失误叠在一起。
4. **调试这类"看起来什么都没发生"的问题,加 `Development|PrintString` 在每个分支节点上,比反复读图猜测更快**——这次在函数入口、射线未命中、命中了非 `BP_Unit`、`ValidateSkillTarget` 判定无效、`PerformSkillAttack` 真正触发这 5 个关键位置各插了一条打印(同时输出到屏幕和 Output Log),之后再遇到类似"死代码 vs 判定失败 vs 真的没触发"分不清的场景,应该直接复用这个套路,而不是纯靠读图推理。

### 坑54:`BP_Unit.EventTick` 的两条并行分支(legacy AI 插值移动 / WASD+鼠标+技能射程直控)只能有一条真正挂在 `EventTick` 输出上——`Utilities|FlowControl|Sequence` 缺失导致其中一条被静默顶掉,`compile_blueprint` 不报任何错(2026-08-22,用户验收反馈"键盘移动完全没反应",在坑41-53 那一整串"改按E攻击/删鼠标攻击"改动之后才出现的回归) #EventTick #Sequence #ReadGraphDSL #反序列化失真

用户人工 Play 验收反馈"ARPG 技能栏/E键攻击验收不通过,而且键盘 WASD 移动现在反而完全没反应了"——这是一次新出现的回归,坑42 记录过"2026-08-20 用户人工 Play 验收通过:WASD 四向稳定对应前后左右、W 沿脸朝向走、鼠标上下方向符合直觉",说明 WASD 在那之后的某一轮改动(坑41 尾注的技能栏/E键攻击/删鼠标攻击几轮)中被连带弄坏了,但当时每一轮改动后的 `compile_blueprint` 全部通过、PIE 截图也都正常,没有任何报错能提示这个问题。

**排查方法(纯 MCP,只读,没有人工干预)**:没有轻信 `read_graph_dsl` 对 `EventTick` 的显示——它把整个函数体显示成只有"`bIsAIMoving` 插值移动到 `AIMoveTarget`"这一条分支,WASD/鼠标/技能射程那一大段(`CastToPlayerController` 开头)完全没有出现在文本里。**这次没有把"文本里没有"直接当成"逻辑被删了"**(坑41 早就记录过这类手工拼节点的图,`read_graph_dsl` 会漏报),而是用 `find_nodes(title="Tick", entry_points_only=true)` 找到真正的 `EventTick` 节点(`K2Node_Event_2`),`get_connected_subgraph` 从它开始顺着连线走一遍——结果证实 `K2Node_Event_2.then` 确实**只连到** `bIsAIMoving` 那条分支(`K2Node_IfThenElse_4`),不是显示漏报,是真的只有一条路。再用 `find_nodes(title="AddMovementInput")` 确认 WASD 用的 `AddMovementInput` 节点(`K2Node_CallFunction_35/36`)**仍然存在**于图里,`get_node_infos` 查它们的 `execute` 输入一路溯源到 `K2Node_DynamicCast_0`(`CastToPlayerController`)——这个节点的 `execute` 输入 pin 的 `connected_pins` 是**空数组**,即整条 WASD/鼠标/`ClampMovement`/`GetNearestTile`/`ClearAttackHighlightsOnly`/`GetSkillEffectiveRange`/`ShowSkillRange` 链路(用 `get_connected_subgraph` 从 `K2Node_DynamicCast_0` 整体拉出来核对,52 个节点,除了这一个入口和几个本来就该是死端的 `CastFailed`/`Enhanced Input` 分支外,exec 连线全部完好)只是**从入口就断了**,内容本身一个节点都没丢、一根线都没乱。

**根因(推测,没有实锤到具体是哪一次操作导致的)**:`bIsAIMoving` 插值分支是这个项目更早期(点击瞬移单位的"平滑过渡"动画)就有的逻辑,和后来坑41 加的 WASD/坑42 加的鼠标/後续加的技能射程逻辑,理论上都应该**每 Tick 都跑**(`bIsAIMoving` 分支只在极少数情况下才做事,`CastToPlayerController` 对没被 `Possess` 的单位会自然 `CastFailed` 短路,两条分支互不打架)——但 Unreal 的 exec 输出 pin 只能同时连一条线出去,要"两条分支都跑"必须显式插一个 `Utilities|FlowControl|Sequence` 节点分流,而当前图里**根本没有** `Sequence` 节点(`find_nodes(title="Sequence")` 返回空),`EventTick.then` 就只能二选一地直连其中一条。合理推测:坑41 最初把 WASD 分支接上 `EventTick` 时,大概率是直接把 `EventTick.then` 从"AI 插值分支"改接到"CastToPlayerController 分支"(单分支互斥,当时 AI 插值这条本来就没什么单位在用,没人注意到它被静默顶掉);后续某一轮改动(具体哪一轮不确定,`compile_blueprint`/PIE 截图都测不出这种"看起来一切正常,只是另一条分支的入口丢了"的问题)又把 `EventTick.then` 的目标换回了"AI 插值分支",这次轮到 WASD 分支被顶掉——**两条分支互相排斥、谁"最后连线"谁生效,是一个没有 `Sequence` 节点做支撑的结构性隐患,不是某一次操作"手滑"的偶然事故**。

**修法**:`create_node` 新建一个 `Utilities|FlowControl|Sequence` 节点,`break_pins` 断开 `EventTick.then → bIsAIMoving 分支` 的直连,改成 `EventTick.then → Sequence.execute`,再 `connect_pins` 把 `Sequence.then_0 → bIsAIMoving 分支`、`Sequence.then_1 → CastToPlayerController 分支` 分别接上,两条历史分支都不删、不改内部一个节点,只是从"二选一直连"换成"经 Sequence 分流,每 Tick 都跑"。`compile_blueprint`/`save_assets` 确认无警告。

**规律沉淀(硬规则)**:
1. **凡是一个事件(尤其 `EventTick`/`EventBeginPlay` 这类只有一个 exec 输出的入口)上先后被不同阶段的改动各自接上过“应该始终执行”的独立逻辑分支,必须显式用 `Utilities|FlowControl|Sequence` 分流,不能依赖"当前这条线接的是谁"——只要没有 `Sequence`,任何一次看似无害的"把这个事件重新接到别的分支"都会静默顶掉之前接的那条,而且这种问题不产生编译警告、不产生运行时报错,只有实际操作对应功能("键盘移动"/"AI 单位平滑移动")的人能感觉到"没反应了"。
2. **`read_graph_dsl` 显示"某段逻辑不存在"和"这段逻辑真的被删了"必须用 `find_nodes`+`get_connected_subgraph`/`get_node_infos` 交叉验证,不能划等号**——这次 `AddMovementInput`/`ClampMovement`/`ShowSkillRange` 等一系列节点全须全尾地留在图里,只是入口断了,如果直接相信 `read_graph_dsl` 的文本去重新手搭一遍,会凭空多出一整套重复节点。
3. **排查"这个功能之前测过是好的,现在突然不行了"这类回归,`get_connected_subgraph` 从真正的入口事件(`find_nodes(entry_points_only=true)` 找到的那个)出发做一次完整遍历,比逐个怀疑"是不是这次改动的哪一步手滑"更快定位——这次没有去逐条回放坑41-53 的每一次 `break_pins`/`create_node` 操作日志去猜是哪一步弄坏的,而是直接从`EventTick` 现在的真实连线状态反推出"结构性缺 `Sequence`"这个更根本的问题。

### 坑55:`BP_Unit` 从普通 `Actor` 改成 `Character`(TPS 阶段A)后,`BP_GridManager.SpawnUnit`/`MoveUnitTowardTarget` 里放置单位用的 Z 轴偏移量`+50`是**旧 Actor 时代的遗留常量**,从没随 `CapsuleComponent`(半高 88)一起更新过,导致新单位一落地就有 43 单位陷进地板里(2026-08-22,坑54 修好 WASD 后用户验收反馈"地板高度不对,人物陷进去了") #Transform #Character #CapsuleComponent

**背景**:坑42 记录过"给 `StaticMesh` 组件在 `UserConstructionScript` 里补 `SetRelativeRotation(Yaw=-90)`"修脸朝向,但从没人检查过这个 Character 的 Z 轴放置高度对不对——这次验收暴露的正是这个漏网的维度。

**排查过程(全部现场 MCP 实测,没有一步是猜的)**:
1. 先读 `BP_Unit` 的 CDO 组件层级:`CollisionCylinder`(根组件,`CapsuleComponent`,`capsuleHalfHeight=88`)、`StaticMesh`(挂在 Capsule 下)。开一次 PIE 后读**运行时实例**的真实值:`StaticMesh.RelativeLocation=(0,0,-88)`——这个值是对的(模型自己的脚部局部原点被放到了胶囊体底部,坑42 的构造脚本改动其实是完整的,没有遗漏 Z)。这一步先排除了"模型相对胶囊体的挂载位置有问题"这个假设。
2. 用 `find_actors(actor_type=BP_Unit)` + `get_actor_transform` 直接读 PIE 里活着的单位世界坐标:几个单位的 Z 分别是精确的 `50`(未被 Possess 过、从没受过物理修正的"原始出生高度")和 `95.15`(已经被 Possess 过至少一次、`CharacterMovementComponent` 靠碰撞深度穿出(depenetration)慢慢把它顶出地板之后的"自我修正高度")——两种数值同时并存在同一局游戏里,说明**根本原因发生在出生瞬间,不是移动逻辑的问题**;而"已修正"和"未修正"的差异,是因为 `CharacterMovementComponent` 默认 `bRunPhysicsWithNoController=false`,没被 `Possess` 过的单位从出生起就从来没有真正 tick 过重力/碰撞穿出,会一直**精确地**卡在出生那一刻的错误高度上,直到轮到它那一回合被 `Possess`。
3. 用 `get_actor_bounds`/`get_actor_transform` 读 `BP_Tile` 的实测数据:tile 自身 `Location.Z=0`,`bounds.max.z=5`——也就是说棋盘地面的真实顶面世界高度是 `TileLocation.Z + 5`,不是 tile 的 pivot 本身。
4. 读 `BP_GridManager.SpawnUnit` 的 `read_graph_dsl`:单位出生点是 `Tile.GetActorLocation() + (0,0,50)`——这个 `MakeVector`/`vector+vector` 里的字面量 `50` 是 `Character` 化之前那套"扁平 2.5D `Actor`+`StaticMesh`"年代校准出来的老数字(那时演员原点就是模型自身局部原点,不涉及胶囊体)。换算下来:出生点世界 Z = `0+50=50`,而"胶囊体底部贴合地面顶面"所需要的世界 Z 其实是 `地面顶面(5) + 胶囊体半高(88) = 93`——差了整整 43,新出生的单位胶囊体(以及绑在它下面、`Z=-88` 挂载的模型)因此有 43 个单位陷进地板网格里,直到轮到它那一回合被 `Possess` 才会被物理引擎慢慢顶出来(顶出后停在 95.15,比 93 略高一点点,是 UE 碰撞检测本身留的一点安全余量,不是新的 bug)。
5. 同样读 `BP_GridManager.MoveUnitTowardTarget`(敌方 AI 走位用的目标点计算函数,和 `SpawnUnit` 完全独立的一段代码)的 `read_graph_dsl`,发现里面单独有一个 `Math|Vector|MakeVector 0.0 0.0 50.0` 用来给 `AIMoveTarget` 加 Z 偏移——**同一个 `50` 的历史遗留数字在这个项目里独立抄了两遍**,`SpawnUnit` 管"出生放置"、`MoveUnitTowardTarget` 管"AI 单位每次移动的目标高度",两处互不调用彼此,只改一处不会把另一处也带上。

**修法**:`SpawnUnit` 里 `Math|Vector|vector+vector` 节点的字面量输入 `B`(原 `"0,0,50"`)`set_pin_value` 改成 `"0,0,93"`;`MoveUnitTowardTarget` 里 `Math|Vector|MakeVector` 节点的 `Z` 输入(原 `"50.0"`)`set_pin_value` 改成 `"93.0"`。两处都只改了一个字面量,没有动周围任何节点或连线。`compile_blueprint`(`BP_GridManager`)通过、`save_assets` 落盘。**验证**(全部读 live PIE 实测,不是纯看代码就收工):改之前一局里同时出现 Z=50(未修正)和 Z=95.15(已修正)两种高度;改之后重开一局,四个单位里三个精确落在新的出生高度 `93`,当前回合被 `Possess` 那个已经开始被物理顶到 `95.15`(和之前"已修正"的收敛值完全一致,说明 93 才是真正贴合地面的目标值,95.15 是物理引擎的正常余量,不是又一层新偏差)。

**规律沉淀(硬规则)**:
1. **给一个 Actor 从"普通 `Actor`/`StaticMeshComponent` 挂件"改造成 `Character`/`CapsuleComponent` 之后,所有"把这个 Actor 放到某个位置"的历史代码里的 Z 轴常量都要重新核算一遍**,不能只顾着"模型局部朝向/挂载偏移"这一个维度(坑42 修的是脸朝向和相对胶囊体的挂载,这次漏掉的是"胶囊体本身该放多高")——`Character` 的 Z 轴放置基准点是**胶囊体中心**,不是模型自己的局部原点,换算公式是`目标世界Z = 地面实际顶面Z + CapsuleHalfHeight`,两个数都要用 `get_actor_bounds`/`get_properties` 现场量,不能凭旧代码里的历史常量直接套。
2. **同一个"错误的历史常量"可能在多个互不调用的函数里被独立复制粘贴过**,只修一处、只验证一处,可能会漏掉另一处功能相同但代码路径完全独立的重复实现——这次 `SpawnUnit`(出生)和 `MoveUnitTowardTarget`(AI 移动目标点)是两个完全不相关的函数,却抄了同一个错误的 `50`。以后遇到"文档/代码里一个孤立的历史魔数"要修,应该在整个蓝图(甚至整个项目)范围内搜一下这个数字/这个语义(比如"给单位摆放世界坐标时手动加的 Z 偏移")还出现在哪些其他函数里,不要修完一处就当作全修好了。
3. **`CharacterMovementComponent` 默认 `bRunPhysicsWithNoController=false`,没有 `Controller`(没被 `Possess`)的 `Character` 不会跑重力/碰撞穿出物理**,这意味着"错误的出生位置"在没轮到那个单位之前会**精确保持不变**(不会随时间自我暴露或自我掩盖),而已经轮到过的单位又会因为物理修正呈现出一个不同的、更"正常"的数值——同一局游戏里如果发现"有的单位数值资正常、有的分毫不差卡在一个可疑的整数"上,这种**数值上的分裂本身就是强线索**,说明问题出在"从来没被这套物理机制处理过的初始状态",要往"出生/初始化"的方向去查,而不是"移动过程"的方向。

### 坑56:坑55 排查时"读到 `StaticMesh.RelativeLocation=(0,0,-88)` 就断言这个值是对的",没有用 `StaticMeshTools.get_bounds` 核实模型自身 pivot 到底在哪——这个未经验证的假设本身就是错的,静态网格资产的局部原点不一定在"脚底"(2026-08-22,坑55 的"93"修复之后用户验收反馈"身体还是下去了一半") #Transform #StaticMesh #Pivot #ConstructionScript

**背景**:坑42 在 `BP_Unit.UserConstructionScript` 里给 `StaticMesh` 组件加了 `SetRelativeRotation(Yaw=-90)` 修脸朝向,当时(或更早)顺手也加了一条 `SetRelativeLocation(0,0,-88)`——这个 `-88` 明显是抄了标准 `ACharacter` 的经验公式:骨骼网格(`SkeletalMeshComponent`)的局部原点通常在角色脚底,所以把它挂在胶囊体下 `(0,0,-CapsuleHalfHeight)` 就能让脚底对齐胶囊体底部。**但这个项目挂的是静态网格**(`/Game/Meshes/Mewtwo_test/StaticMeshes/Mewtwo_test`,一个直接导入的 Pokémon 模型),静态网格的原始 pivot 是美术/导入流程决定的,不保证在脚底,套用骨骼网格的经验公式之前必须先用 `StaticMeshTools.get_bounds` 现场量一下,坑55 排查时没做这一步,只看了运行时读回来的 `-88` 这个数字"看起来"是合理的构造脚本产物,就直接采信了。

**现场实测(全部用 MCP 直接读,不是推算)**:
1. `BlueprintTools.get_default_object(BP_Unit)` → `ActorTools.get_components` → 找到 `CollisionCylinder`(`CapsuleComponent`,`capsuleHalfHeight=88`,`capsuleRadius=34`,`relativeLocation=(0,0,0)`,`relativeScale3D=(1,1,1)`)和 `StaticMesh_GEN_VARIABLE`(`relativeLocation=(0,0,0)` 在 CDO 层面是这个,运行时被 `UserConstructionScript` 改写;`relativeScale3D=(0.5,0.5,0.5)`;`staticMesh` 资产是 `/Game/Meshes/Mewtwo_test/StaticMeshes/Mewtwo_test`)。
2. `StaticMeshTools.get_bounds(Mewtwo_test)` 直接查这个资产的**局部空间包围盒**:`min={x:-100.09,y:-73.77,z:-99.065}`,`max={x:97.35,y:69.73,z:97.370}`——`z` 几乎左右对称(`-99.065`/`97.370`),说明这个模型的局部原点在**竖直方向的中心附近**,不是在脚底(如果在脚底,`min.z` 应该接近 `0`,`max.z` 应该接近模型总高)。
3. 读 `BP_Unit.UserConstructionScript` 的 `read_graph_dsl`,确认坑42当时留下的语句是 `(Transformation|SetRelativeRotation _staticmesh "0, -90, 0") (Transformation|SetRelativeLocation _staticmesh "0.000000,0.000000,-88.000000")`——`-88` 是死字面量,不是算出来的。
4. 结合 ①`capsuleHalfHeight=88`、②模型局部 `min.z=-99.065`、③组件 `relativeScale3D.z=0.5` 三个实测数字反推:套用 `-88` 之后,模型中心被放到 `actorZ-88`(试图对齐"胶囊体底部"),但模型中心往下还要延伸 `99.065×0.5≈49.53` 才是真正的脚底——也就是说脚底实际落在 `actorZ-88-49.53≈actorZ-137.5`,比胶囊体底部(`actorZ-88`)还要再往下 `49.53` 个单位,不是贴合胶囊体底部,而是**穿过胶囊体底部继续往下沉了近半个身位**,和用户反馈的"身体还是下去了一半"(模型总高约 98,沉了约 47~49 个单位,接近半身)完全吻合。

**修法**:正确的 `RelativeLocation.Z` 应该让"模型的局部最低点(缩放后)"贴合"胶囊体底部(相对胶囊体中心为 `-CapsuleHalfHeight`)",公式是 `RelativeLocation.Z = -CapsuleHalfHeight - (模型局部min.z × RelativeScale3D.Z)`,代入实测数字 `-88 - (-99.065155×0.5) = -88 + 49.532578 = -38.467422`。用 `find_nodes`(标题"Set Relative Location")在 `UserConstructionScript` 里定位到现成的那个 `Transformation|SetRelativeLocation` 节点(`K2Node_CallFunction_4`),`get_node_infos` 确认 `NewLocation` 是 `index_id=2` 的输入 pin,`set_pin_value` 直接把字面量从 `"0.000000,0.000000,-88.000000"` 改成 `"0.000000,0.000000,-38.467422"`,没有新增/删除任何节点。`compile_blueprint`/`save_assets` 通过。

**验证方式**:①开 PIE,`get_actor_transform` 确认单位仍稳定收敛在坑55验证过的 `95.15`(排除这次改动影响了坑55的修复,两个坑改的是不同组件的不同属性,理论上互不干扰,现场读数字确认没有交叉影响)。②在世界坐标 `(10000,10000,93)`(远离主关卡,坑42 同款做法)`SceneTools.add_to_scene_from_class` 现场摆一个临时 `BP_Unit` 实例,`EditorAppToolset.CaptureViewport` 截图(带 `gridHeight=5` 的网格标注,对应地面顶面世界高度)肉眼确认模型下半身贴合胶囊体碰撞体调试轮廓的下缘,不再有"半身沉入地面"的既视感,验证完 `SceneTools.remove_from_scene` 删除临时实例,不留垃圾。

**规律沉淀(硬规则)**:
1. **"标准 `ACharacter` 的 Mesh 组件默认挂 `(0,0,-CapsuleHalfHeight)`"这条经验规律,前提是这个 Mesh 是骨骼网格且局部原点在脚底**——这个项目挂的是**静态网格**,原始 pivot 是美术/导入流程决定的,不能想当然套用骨骼网格的经验公式。任何时候要给一个 `StaticMeshComponent` 算"应该往下(或往上)挪多少来对齐某个基准面"之前,必须先用 `StaticMeshTools.get_bounds` 现场查这个资产的局部包围盒,确认它的 pivot 到底在哪(是在底部、中心还是别的位置),不能凭"这个数字读回来看着眼熟/看着合理"就采信。
2. **验收报告里"读到某个属性值,判断这个值是对的"这个结论本身也是一个需要交叉验证的断言,不是只要读到了值就等于验证完毕**——坑55 排查时确实老老实实读了 `StaticMesh.RelativeLocation`,但只满足于"这个值存在、看起来是构造脚本正常运行的产物",没有再往下一步去验证"这个值本身是不是算对了"，这才是这次踩坑真正的教训:**读到一个值 ≠ 验证了这个值是对的**,后者需要独立找到另一组数据源(这次是 `get_bounds` 查模型自身尺寸)来交叉核实。
3. 这次和坑55 是**同一次用户反馈("陷进地板")背后的两层独立根因**,不要在文档里把它们合并成一条——坑55 修的是"胶囊体(碰撞体)贴不贴地面"(出生/AI移动的世界 Z 坐标),坑56 修的是"渲染模型贴不贴胶囊体"(`StaticMesh` 相对胶囊体的挂载偏移),两层各自独立验证、各自独立修复,只是表现症状相似都叫"陷进地板"。

### 坑57:给一个既有 Actor 类新增真正的 SCS 组件,正确工具是 `ActorTools.add_component`,不是 UMG 那套"Construction Script 里插 `AddComponent|...` 节点动态造"的老套路;`EditorAppToolset.CaptureViewport` 截的是**编辑器视口相机**,PIE 运行时不会自动跟着玩家视角,验证 PIE 里的实际画面必须用 `CaptureEditorImage`(2026-08-22,敌方回合全景镜头功能) #Component #Camera #PIE #Viewport

**背景**:给 `BP_TurnManager` 加一个 `OverviewCamera`(`CameraComponent`)用于敌方回合切全景镜头。之前文档里唯一记录过的"加组件"套路是 UMG 那条("`AddComponent|UserInterface|AddWidgetComponent`…在 Construction Script 里动态加"),容易被误认为"加组件"只能走蓝图图里插节点这一条路。

**实测确认的正确工具**:`editor_toolset.toolsets.actor.ActorTools.add_component(owner, component_type, name)` 可以直接给一个 Blueprint 类(`owner` 传 Blueprint 资产本身的 refPath,不是某个已放置的实例)挂载一个真正的 SCS 组件(`component_type` 传形如 `/Script/Engine.CameraComponent` 的类引用)——加完之后这个组件会立刻在 `find_node_types(type_id_filter="<组件名>")` 里出现 `Variables|Default|Get<组件名>`/`Set<组件名>` 这两个可创建节点(和其它既有组件变量比如 `RelicBarComponent` 完全同构),但**不会**出现在 `BlueprintTools.list_variables` 的返回列表里(那个列表似乎只列 `add_variable`/`add_object_variable` 加的普通变量,不列组件)——不要因为 `list_variables` 里没看到就以为组件没加上,想确认组件是否存在要么用 `ActorTools.get_components(actor, component_type=筛选类型)`,要么直接用 `find_node_types` 搜组件名对应的 Get/Set 节点是否存在。新加组件的 Transform 类属性(`RelativeLocation`等)在这个**类模板本身**(不是关卡里的某个放置实例)上用 `ObjectTools.set_properties` 直接改是可以生效的——坑42/56 记录的"改了返回 true 但读回来被静默还原"那个坑,只发生在**已经放置在关卡里的实例**上,不适用于类模板/CDO 层面的修改,两者不要混为一谈。

**PIE 视觉验证的坑**:一开始想用 `EditorToolset.EditorAppToolset.CaptureViewport` 在 PIE 运行时截图确认镜头切换效果,结果截出来的 `cameraLocation`/`cameraRotation` 全是 `(0,0,0)`——**这个工具截的是 Unreal 编辑器自己的 3D 视口相机(Level Viewport Camera),和 PIE 里玩家实际看到的画面是两回事**,哪怕 PIE 用的是 `PlayMode_InViewPort`(游戏画面本来就画在同一块视口面板里),`CaptureViewport` 也只会给这个编辑器相机的默认/上次位置拍照,不会跟着 `SetViewTargetWithBlend` 切的玩家视角走。**真正想看"玩家在 PIE 里实际看到的画面"要用 `EditorToolset.EditorAppToolset.CaptureEditorImage`**(截整个编辑器应用程序窗口,PIE 用 `PlayMode_InViewPort` 时游戏画面正好画在那块视口区域里,这张截图里能看到真实的游戏渲染结果,包括 UI 抬头显示、技能栏等)。**规律沉淀**:以后但凡要截 PIE 里"玩家实际看到的东西"来验证效果,一律用 `CaptureEditorImage`,不要用 `CaptureViewport`——后者是编辑器工具相机专用,只在需要摆放/检视关卡里的静态物件(不涉及 PIE 玩家视角)时才有用(比如坑42/56 里"造一个临时 actor 摆在空地上截图看模型朝向"这种非 PIE 场景)。

**功能实现摘要**(细节见 `UE蓝图状态.md` `BP_TurnManager` 一节):新增 `BP_TurnManager.SetupOverviewCamera()`(`write_graph_dsl` 整体生成的全新函数,`For Each Tiles` 现场量棋盘世界坐标 min/max 算出中心点和"够看全"的俯视高度,`Transformation|SetWorldLocationAndRotation` 摆好 `OverviewCamera`),在 `EventBeginPlay` 里 `BuildTurnOrder` 和 `StartTurn` 之间插了一次调用(棋盘布局整局不变,只需算一次)。`StartTurn` 里两处分别插了 `Game|Player|SetViewTargetWithBlend`:敌方分支(`RunEnemyTurn` 调用**之前**,这样敌方AI移动的过程才能被全景镜头看到,不是移动完了才切镜头)`NewViewTarget` 传 `self`(`BP_TurnManager` 自己,靠它身上的 `OverviewCamera` 生效);我方分支(`Possess`+`AddMappingContext` 那一串**之后**,原本是空的语句末尾)`NewViewTarget` 传被 `Possess` 的那个单位(它自带的 `SpringArm`+`Camera` 生效)。两处都给了 `BlendTime=0.75` 秒做柔和过渡,不是硬切。

**验证情况**:两个蓝图 `compile_blueprint` 通过,`get_node_infos` 逐节点核对过两处 `SetViewTargetWithBlend` 的 exec 链路和参数接线(自己一步步连的,没有假设它对,核实过)。开 PIE 后台自动跑了一轮"敌方回合→我方回合"(项目自带的开局自动流程,不是我手动触发的),读 live 场景里 `OverviewCamera.RelativeLocation` 确认是 `(960,810,1500)`(非退化的、和棋盘规模匹配的真实数值,不是卡在初始的 `(0,0,0)`,证明 `SetupOverviewCamera` 确实成功找到了 Tile 并算出了合理的机位),`CaptureEditorImage` 在我方回合窗口截图确认游戏画面/UI 正常无报错。**没能验证的部分**:MCP 没有可靠手段主动触发"再来一次敌方回合"(项目一贯的按键模拟限制),所以**没有拿到一张敌方回合时全景镜头的实际截图**,全景镜头俯角/高度是否好看、敌方单位移动过程是否完整落在画面内,仍需人工在编辑器里 Play 到敌方回合时肉眼确认;如果高度/俯角观感不理想,`SetupOverviewCamera` 函数体末尾那段"`longest×1.2+300`"的经验系数是最直接的调参入口。

### 坑58:敌方 AI 移动"朝向不对"的根因是 `EventTick` 的 `bIsAIMoving` 插值分支从来没有 `SetActorRotation`;全景镜头"看不到整个棋盘"排查到最后发现**不是坐标/FOV 数学问题,而是棋盘地板没有可视化边界、单位在必要的俯视高度下小到肉眼分辨不出**——这是本轮唯一一次"验证完发现问题不在代码里"的案例(2026-08-22,用户验收反馈"敌人移动方向不对"+"敌方回合仍看不到整个棋盘") #EventTick #Rotation #FindLookAtRotation #Camera #FOV #艺术资产

**背景**:坑54(`EventTick` 加 `Sequence` 分流)修好 WASD 后,用户实测反馈两个新问题:①敌方 AI 移动时朝向不对;②切到敌方回合的全景镜头依然看不到整个棋盘。这条继续排查这两个问题,不是重新做坑54。

**问题①根因(已确认并修复)**:`read_graph_dsl`/`get_connected_subgraph` 交叉核对 `BP_Unit.EventTick` 里 `GetbIsAIMoving→Branch(true)→VInterpTo_Constant→SetActorLocation→[到达判定]Branch→SetActorLocation(吸附终点)→SetCol/SetRow/SetbIsAIMoving(false)` 这整条链路,从头到尾没有任何 `SetActorRotation`/朝向计算节点——`MoveUnitTowardTarget`(`BP_GridManager`)也只是算出 `AIMoveTarget` 这个目标点然后 `SetbIsAIMoving=true`,同样不碰朝向。也就是说这套战棋时代就有的 AI 移动逻辑,从诞生起就没人给它接过朝向,阶段A/坑42 给 WASD 直控接的"胶囊体转向移动方向+`StaticMesh.RelativeRotation.Yaw=-90` 做脸部补偿"那套,AI 这条完全独立的路径上一直是空的——单位挪动位置但胶囊体朝向原地不变(默认出生朝向),表现正是"移动方向和脸朝向对不上"。

**修法**:在 `Transformation|SetActorLocation`(每 tick 的插值挪动那一步,`K2Node_CallFunction_3`)之后、原本紧接的到达判定 `Branch`(`K2Node_IfThenElse_5`)之前,插入 `Math|Rotator|FindLookAtRotation(Start=当前坐标, Target=AIMoveTarget) → BreakRotator(只取Yaw) → MakeRotator(Roll=0,Pitch=0,Yaw=该值) → Transformation|SetActorRotation(self)`,复用了图里已有的 `GetActorLocation`(`K2Node_CallFunction_1`,tick 开始时读的当前坐标)和 `GetAIMoveTarget`(`K2Node_VariableGet_6`)两个既有输出 pin 当输入,没有新增变量。和坑42 WASD 那条"胶囊体转向+`StaticMesh` 脸部补偿叠加生效"的逻辑复用同一套胶囊体朝向机制,`StaticMesh.RelativeRotation` 完全没动。`compile_blueprint` 通过。**没能实测**:MCP 没有办法让敌方真的动一步来肉眼确认转向效果(触发敌方回合本身就做不到,见坑57"没能验证"部分同款限制),这次只做到"确认了根因(exec链路上确实没有任何朝向节点)+补上了和 WASD 路径完全同构、已验证有效的修法",逻辑上应该正确但没有截图/实测收尾,**需要人工 Play 到敌方回合实测确认**。

**问题②排查过程(全部是 MCP 现场量出来的真实数据,没有靠猜)**:
1. 读 `BP_TurnManager.OverviewCamera` 的真实运行时属性:`FieldOfView=90`(水平FOV)、`AspectRatio=1.7778`(16:9)、`RelativeRotation=(Pitch:-90,Yaw:0,Roll:0)`——严格正俯视,不是文档以为的"可能没传全 MakeRotator 三个参数导致 Yaw 是脏值"这种猜测,现场读回来 Yaw 确实是 `0`,没有问题。
2. 直接查真实 Tile 布局:`SceneTools.find_actors` 找到 88 个 `BP_Tile_C`(索引0~87),抽样读 `get_actor_transform` 确认是 11 列×8 行的规则网格,世界坐标 `X∈[100,1100]`、`Y∈[100,800]`(`TileSize=100`)。
3. 用 `EditorToolset.EditorAppToolset.CaptureViewport` 的 `captureTransform` 参数直接把编辑器视口相机摆到 `SetupOverviewCamera` 算出来的真实世界坐标/角度(不依赖能不能触发敌方回合,这个工具可以摆哪就拍哪),配合 `annotations.gridSpacing`/`gridHeight` 打网格坐标标注,**用真实米制网格数字读出当前画面实际覆盖的世界范围**:原实现(高度 1500)覆盖 `X∈[-2,14]m,Y∈[-10,18]m`,和棋盘 `X∈[0.5,11.5]m,Y∈[0.5,8.5]m` 对比,**四个方向都有正margin,棋盘完整落在画面内,不存在裁切**——这一步直接推翻了"高度/系数算错导致露不全"这个最初的怀疑方向,不能不查就认定原公式有问题。
4. 用两次相机手摆的方位角(`Yaw=0`,`Pitch=-90`)反推 `CameraComponent.FieldOfView=90` 在 `AspectRatio=1.7778` 下的真实几何覆盖:水平FOV(半角45°)对应世界 Y 轴(屏幕左右),覆盖 `2×高度×tan45°`;由 `AspectRatio` 派生的垂直FOV(半角≈29.36°)对应世界 X 轴(屏幕上下),覆盖 `2×高度×tan29.36°≈高度×1.125`——**哪个世界轴对应屏幕哪个方向,不能靠猜,是从网格截图上实际标出的坐标数字反推出来的**(网格数字随屏幕位置变化的方向,直接说明了世界轴到屏幕轴的映射关系)。用这套关系反算,原公式(`max(dx,dy)×1.2+300`)算出来的高度 `1500`,换算成两个轴各自的覆盖量都比棋盘实际半宽/半高富余,**原公式本身在数学上是安全的,不是"以为够用其实不够用"那种半吊子安全余量**。
5. 用 `SceneTools.find_actors(actor_type=BP_Unit_C)` 找到全部 8 个真实单位实例,`get_actor_transform` 确认它们的世界坐标分布在棋盘范围内各处(不是全挤在一角),换算到相机画面里也都落在步骤3验证过的可见范围内。**但截图里肉眼完全看不出任何单位的可辨认轮廓**,画面里唯一能看清的是几个和棋盘无关的环境道具(`Floor`/`PlayerStart`/`SM_SkySphere`/一个叫 `MEWTWO_MAGICHEAL` 的技能特效道具,不是真正的战斗单位,`get_actor_transform` 确认它在世界坐标 `(100,-700,0)`,棋盘范围之外)聚在画面一角,棋盘本体是一整片没有任何分色/描边的默认棋盘格贴图(疑似默认/占位材质,不是真的按 Tile 逐格上色的美术资源),从这个高度看和背景的大棋盘格贴图完全融为一体,分辨不出"棋盘的边界在哪""单位站在哪个格子上"。

**结论(和最初假设不同,如实记录)**:全景镜头"看不到整个棋盘"**不是坐标计算或 FOV 数学的 bug**——高度/朝向都经过现场量出的真实数据核实过是对的,棋盘和全部单位确实都在画面几何范围内。真正的原因是**美术/关卡层面缺少能在俯视角下分辨"棋盘边界在哪""单位在哪"的视觉元素**(棋盘没有逐格描边/分色,单位没有由上往下看依然醒目的标记,而战场本身×90°FOV下必然只占画面一小部分,人物这种正常大小的角色模型缩小到这个比例后肉眼确实很难认出来)——这不是蓝图节点接线能解决的问题,已经超出"镜头逻辑"这个改动范围。

**顺带做的改进(即使不是根因也值得做)**:原高度公式 `max(dx,dy)×1.2+300` 里的 `1.2`/`300` 是坑57那轮拍脑袋给的经验系数,没有对应真实的FOV/宽高比几何关系。这次用 `get_node_infos` 定位到 `SetupOverviewCamera` 里算高度那一段(`PromotableOperator_5/6` 算出的 `dx`/`dy` 保留复用,原来的 `Select_5`/`PromotableOperator_7/12/13`/两个 `MakeLiteralFloat` 常量节点全部 `delete_node` 删除),换成按步骤4反推出的真实两轴覆盖关系分别计算所需高度(`(dx/2+100)×1.7778` 和 `(dy/2+100)`,`Utilities|Operators|Divide/Add/Multiply/Greater(>)` 手工 `create_node`+`connect_pins` 搭出来,不敢赌 `write_graph_dsl` 整段重写这种已经跑通、有 `ForEachLoop` 在里面的函数,原因见坑46/坑47 一贯的教训),取两者较大值再乘 `1.15` 安全系数,`compile_blueprint`/重开 PIE 读 `OverviewCamera.RelativeLocation.z` 确认从 `1500` 变成了 `1226.682`(和手算的预期值一致),重新截图确认棋盘依然完整在画面内、margin 变小但还在——**这个改动只是让机位更紧凑合理,不改变"看不清棋盘"这个根本问题的结论**。

**规律沉淀(硬规则)**:
1. **验收反馈说"效果不对"时,不要预设"一定是我这段逻辑算错了",先用真实数据核实"我算出来的东西到底对不对"这件事本身**——这次如果一上来就直接改高度系数,只会做无用功(甚至可能因为改小了系数意外裁到棋盘边缘,把一个"数学上没问题但观感不好"的情况改成真正的"裁切"bug)。`CaptureViewport` 的 `captureTransform` 参数(不依赖能否触发游戏内事件,指哪打哪)+ `annotations` 的真实米制网格标注,是验证"某个相机机位到底能看见哪些真实世界坐标范围"最直接可靠的手段,比反复调参数再截图靠感觉判断快得多。
2. **"镜头逻辑正确"和"玩家能看清楚"是两个独立的问题,前者是蓝图能力范围内的事,后者往往是美术/关卡资源的责任**——排查这类"视觉效果不对"的反馈,先确认是不是坐标/接线的锅,如果坐标/接线全部核实无误,要敢于把结论指向"这可能是缺美术资源/缺游戏性设计"而不是继续死磕蓝图逻辑,不能因为"这是我这轮的任务"就一定要在代码里找出一个能改的东西来交差。

### 坑59:`CameraComponent.RelativeLocation` 是相对"所属 Actor 自身世界坐标"的偏移,不是世界坐标本身——拿它直接跟手算的 Tile 世界坐标比对,会在 Actor 本身不在原点时得出一个看似"整体偏移了一个常数"的假 bug,白白重建了一遍本来没问题的循环(2026-08-22,敌方回合镜头从正俯视改斜45度俯视) #Transform #WorldSpace #RelativeLocation #ForEachLoop #WorldPosToScreenCoords

**背景**:用户要求把敌方回合全景镜头从正俯视(`Pitch=-90`)改成斜上 45 度俯视(`Pitch=-45`),要求棋盘四角完整入画且大致居中。正俯视版本可以直接摆在棋盘正上方,斜 45 度版本必须沿某个水平轴后退一段距离、同时抬高相应高度(`H=D`,`Pitch=-45` 决定了退多远和抬多高相等),这个后退/抬高距离 `D` 用"棋盘半宽 `halfX`/半深 `halfY` + 水平FOV(90°)+ 宽高比反推出的垂直FOV"算,取 `D=((halfY+√2×halfX)/2)×1.3`(近排点的水平视野约束是主要瓶颈,推导过程见下方规律沉淀),`Location=(centerX, centerY-D, boardTopZ+D)`,`Rotation=(Pitch=-45,Yaw=90,Roll=0)`。

**排查弯路(记录下来避免下次重蹈)**:改完 `SetupOverviewCamera` 后,用 `ObjectTools.get_properties` 读 `OverviewCamera.RelativeLocation`,想验证 `X`/`Y` 是否等于手算的棋盘中心 `(600,450)`(真实 Tile 边界现场用 `find_actors`+`get_actor_transform` 核实过是 `X∈[100,1100]`、`Y∈[100,800]`,11×8 网格,`TileSize=100`,绝对可靠)——结果读回来是 `(960, 122.88, 687.12)`,`X`/`Y` 都比手算的 `600`/`-237.12`(`cy-D`)大了整整 `360`,`Z` 却和手算的 `D=687.12` 完全吻合。这个"`X`/`Y` 都偏移同一个常数,`Z` 完全不偏"的模式,和坑57/58 里记录过的老代码"`_x`/`_y` 提到循环外绑定"那个真实 bug长得非常像,于是判断"新写的 `ForEachLoop` 累加 min/max 又踩了同一个坑",做了一整套排查/重建:`remove_function_graph`→`compile_blueprint`清悬空引用→`add_function_graph`拿回原名→为局部变量`OvMinX`/`OvMaxX`/`OvMinY`/`OvMaxY`/`OvMaxZ`重新`add_variable`(函数体被删空后局部变量也跟着没了)→`write_graph_dsl`重写整个函数→逐节点`get_node_infos`核对`GetActorLocation`→`BreakVector`→`Select`→`SetOvMinX`等每一条连线(结论:全部正确,`Array Element`确实接的是`ForEachLoop`的当次循环元素)→仍不信邪,插了4组`GetOvXxx→ToString(Float)→PrintString`临时调试节点,**开 PIE 读 Output Log 里的真实运行时打印值,确认 `OvMinX=100.0`/`OvMaxX=1100.0`/`OvMinY=100.0`/`OvMaxY=800.0`——和真实棋盘边界分毫不差,循环从头到尾都没有错**。

**真正的根因**:`get_actor_transform(BP_TurnManager 实例)` 一查,这个 Actor 本身在关卡里的世界坐标是 `(-360,-360,0)`,不是原点。`CameraComponent.RelativeLocation` 是相对"所属 Actor 自身"的坐标,不是世界坐标——`SetWorldLocationAndRotation` 传入的是真正正确的世界坐标 `(600,-237.12,687.12)`,引擎内部换算成 `RelativeLocation` 时减去了 Actor 自身的世界偏移 `(-360,-360,0)`,也就是加上了 `(360,360,0)`,读回来自然是 `(960,122.88,687.12)`——`Z` 之所以完全不偏,是因为 `BP_TurnManager` 的 `RelativeLocation.Z` 偏移量是 `0`(它的世界 Z 坐标本来就是 `0`)。**这次排查从头到尾都没有真的错,是拿"组件相对坐标"和"手算的世界坐标"直接比,比错了对象。**

**规律沉淀(硬规则)**:
1. **验证一个 `SceneComponent`/`CameraComponent` 的实际世界位置对不对,不要读它的 `RelativeLocation` 去跟手算的世界坐标比**——除非先确认过它所属的 Actor(或更上层的父组件链)世界坐标就是 `(0,0,0)`。`RelativeLocation` 只在"所属 Actor 本身就在世界原点、且没有中间层级的父组件偏移"这个前提下才等于世界坐标,这个前提不能想当然,要先 `ActorTools.get_actor_transform` 读一下这个 Actor 自己摆在关卡哪——这次 `BP_TurnManager` 就摆在 `(-360,-360,0)`,不是原点,是这次排查绕远路的唯一原因。
2. **想验证一个相机机位是否覆盖了预期的世界坐标范围,最可靠的办法是 `EditorAppToolset.SetCameraTransform`(把编辑器视口相机摆到目标世界坐标+旋转)之后配合 `WorldPosToScreenCoords`,直接查"某个已知世界坐标点投影到屏幕的归一化坐标落不落在 `[0,1]` 范围内"**——这次用这个方法把棋盘真实四角 `(100,100,0)`/`(1100,100,0)`/`(100,800,0)`/`(1100,800,0)` 和中心 `(600,450,0)` 各投影一遍,直接读到数值结果(四角都在 `[0.155,0.845]×[0.326,0.793]` 内,中心几乎精确落在 `(0.5,0.5)`),比读 `RelativeLocation` 再手动做坐标系换算可靠,也比截图肉眼判断"棋盘在不在画面里"更精确、更不会被视觉上的干扰(比如坑58 记录的"棋盘和背景地板材质糊在一起分不清边界")误导。
3. **在怀疑"新写的循环/累加逻辑又是不是重蹈了某个历史坑"之前,先想有没有更便宜的方法证伪**——这次如果一开始就用 `SetCameraTransform`+`WorldPosToScreenCoords` 或者临时插 `PrintString` 直接验证运行时的真实数值,几步之内就能排除"循环算错了"这个方向,不需要经过一整套`remove_function_graph`+`write_graph_dsl`重建+逐节点`get_node_infos`核对的大动作。**怀疑一段刚写的逻辑有 bug 时,优先用最直接的手段验证"这段逻辑的输出值到底对不对"(哪怕是临时插 PrintString),而不是先入为主往复杂的方向去查连线结构**——复杂的结构性核查应该是"直接验证发现输出确实不对"之后才需要动用的下一步,不该是排查的第一步。

**本轮最终改动**(`SetupOverviewCamera` 函数体,细节见 `UE蓝图状态.md` `BP_TurnManager` 一节):循环本身在排查过程中被完整重建过一遍,但重建前后逻辑等价(都是正确的),不是"修复"了循环,只是把局部变量和节点重新搭了一遍;真正改变行为的是最后一步——把 `Location`/`Rotation` 的计算从"棋盘正上方、`Pitch=-90`"换成"沿 `-Y` 方向后退 `D`、`Location.Z=boardTopZ+D`、`Pitch=-45,Yaw=90`"。排查途中为了验证真实数据插入的 4 组 `PrintString` 调试节点,以及为了验证"是不是 `SetupOverviewCamera` 在 `BeginPlay` 里跑得太早、`Tile` 还没生成完"这个候补假设而加的 `Utilities|FlowControl|Delay(0.3s)`(插在 `BuildTurnOrder`→`SetupOverviewCamera` 之间),排查结束后**全部已经清理删除,`EventGraph`/`SetupOverviewCamera` 恢复成只包含最终有效逻辑的干净状态**,不会遗留调试残留物。

### 坑60:`SetViewTargetWithBlend` 的 `NewViewTarget` 传了"跟这一刻相关但状态还没就绪"的对象,而不是"这一刻真正该看的东西",表现成"镜头乱甩"(2026-08-23,用户发录屏反馈"运镜有问题") #Camera #状态时序 #逻辑设计

**背景**:用户发来一段 Play 录屏反馈"运镜有问题"。一开始用 `ffmpeg` 抽帧(先 2fps 全览,再对可疑片段抽 30fps 逐帧不跳帧)分析画面,一开始误判成 `BP_Unit.SpringArm` 的碰撞探测(`bDoCollisionTest`)被攻击特效顶到贴脸——这个判断后来被 30fps 逐帧证据推翻了(碰撞探测应该是渐进变化的距离,但实际是相邻两帧之间的瞬间硬切,不是逐步逼近),提醒了一件事:**光看录屏抽帧,哪怕加密到逐帧,也只能验证"现象是什么",验证不了"为什么"——必须回头读代码,两者要配合,不能停在抽帧这一步就下结论**。

**真正根因**:读完 `TryAttack`→`ResolveCounterAttack`→`PerformSkillAttack`→`BP_TurnManager.EndTurn`→`AnnounceNextTurn`→`StartTurn` 整条链路后发现,每次回合切换镜头其实被摆了三次,中间那次纯属选错了目标:`AnnounceNextTurn` 会 `SetViewTargetWithBlend(下一个单位本人, 0.3秒)`,但这个"下一个单位"此时还没被 `Possess`,朝向是它上次移动/待机结束时随便停留的角度,没有任何人瞄准过它——镜头切过去看到的就是这个随机朝向(天空/贴近别的单位模型),这正是录屏里"贴地看天"和"怼脸糊成一片"两段画面的根因。1 秒后 `StartTurn` 才会把镜头切到真正设计好的位置(我方 `Possess`+第三人称;敌方切 `OverviewCamera`)。

**教训**:选摄像机/镜头的 `ViewTarget`,不能图省事传"这一刻手头现成的、逻辑上相关的那个 Actor"(这里是"下一个要行动的单位"),要传"这一刻真正设计上想让玩家看到的东西"(这里是全景相机,和 `StartTurn` 敌方分支早就在用的目标一致)。这类 bug 编译不报错、逻辑上"看起来对"(确实是切到了下一个单位没错),只有跑起来看画面才会暴露,而且容易被误判成相机数学/碰撞体的问题——**排查镜头"看起来乱"的问题,第一步应该是列出这段时间内所有 `SetViewTargetWithBlend`/`Possess` 调用点和它们各自的目标,而不是先怀疑碰撞探测或数学公式**。

**修法**:`AnnounceNextTurn` 里 `SetViewTargetWithBlend` 的 `NewViewTarget` 参数,从"下一个单位本人"(`K2Node_GetArrayItem_0` 的输出)改接到 `self`(`BP_TurnManager` 自己)。只 `break_pins`+新建一个 `Variables|Getareferencetoself` 节点+`connect_pins`,`_output`(下一个单位的引用)在同一个函数里另外两处用途(`IsValid` 判空、`PrintString` 判断"我方/敌方回合开始"文案)完全没动。

### 坑61:验证 `SetViewTargetWithBlend`(非零 `BlendTime`)换没换对目标,不能同一帧读 `GetViewTarget()`;Function 里放不了 `Delay`,只能用 `SetTimerbyFunctionName` 拆成异步(2026-08-23,坑60 修完后按硬性规范给 `RunRegressionTests` 补断言) #Camera #Blend #Delay #Function限制 #回归测试

**背景**:坑60 的修法本身通过 `read_graph_dsl` 复查过连线,肉眼确认无误,但项目硬性规范要求"验收通过后必须补一条能真正卡住这个 bug 复发的运行时断言",不能只满足于"读图确认接线对了"。第一版断言写法:在 `RunRegressionTests` 里直接调用 `TurnManager.AnnounceNextTurn()`,紧接着同一帧内 `Pawn|GetViewTarget(PlayerController)` 读取当前视角目标,断言它等于 `TurnManager`——开 PIE 实测,这条断言**稳定 FAIL**,而 `read_graph_dsl` 复查过的连线明明是对的。

**根因**:`SetViewTargetWithBlend` 传入非零 `BlendTime`(这里是 `0.3` 秒)时,`APlayerCameraManager` 不会立刻把"当前生效的 `ViewTarget`"切换成新目标——它会记录混合参数,在接下来的 `Tick` 里逐步过渡,`ViewTarget`(`GetViewTarget()` 读到的)只有在混合结束后才真正变成新目标,混合期间读到的还是旧目标。也就是说:**代码逻辑（选对了目标)是对的,断言的时序假设(改的瞬间就能读到新值)是错的**——这是一次"测试本身设计有 bug,不是被测代码有 bug"的典型案例,排查时要先怀疑断言的时序前提,不要立刻回头怀疑刚验证过是对的连线。

**衍生的工具限制**:想到"那就在断言前插一个 `Delay(0.4秒)` 等混合结束"来修断言,结果 `create_node`/`find_node_types` 都搜不到 `Utilities|FlowControl|Delay` 这个 type_id——`Delay` 是**latent(异步/延迟)节点,只能放在 EventGraph/Macro 里,UE 的普通 Function 图从设计上就不允许包含 latent 节点**,这是引擎级别的硬限制,不是 MCP 工具的缺陷。

**修法**:把"检查 `ViewTarget`"这部分逻辑拆成一个独立的新 Function(`T9_CheckViewTarget`),在 `RunRegressionTests` 里改用 `Utilities|Time|SetTimerbyFunctionName(self, "T9_CheckViewTarget", 0.4, false)` 异步调度它(和 `AnnounceNextTurn`/`EndTurn` 自己内部调度 `StartTurn` 用的是同一套机制),0.4 秒后混合肯定已经结束,这时候读到的 `GetViewTarget()` 才是断言应该比对的值。改完重跑,断言稳定 `PASS`。**教训**:任何"调用一个带 Blend/Tween/Interp 效果的函数,紧接着验证效果"的断言,都要先确认这个效果是不是瞬时生效的——凡是叫 `...WithBlend`/`...Interp`/`Tween` 之类名字的函数,大概率不是瞬时的,同帧断言几乎必错;Function 里验证"过一段时间后的状态",只能靠 `SetTimerbyFunctionName` 拆成独立函数异步验证,不能指望 `Delay`。

### 坑62:`StartPIE` 调用成功过不代表这一刻 PIE 还在跑,`find_actors` 返回的 `UEDPIE_0_...` 路径可能是残留假象,排查前先 `IsPIERunning()`(2026-08-29,骨骼网格换新模型后排查"按W不出前进动画") #PIE #StateAssumption #排查心法

**背景**:接手一个"按 W 前进时不出现向前走动画"的问题,会话早前(上下文压缩之前)已经调用过一次 `StartPIE`。基于这个记忆直接调用 `SceneTools.find_actors(actor_type=BP_Unit_C)`,拿到 4 个 `/Game/Maps/UEDPIE_0_TestMap.TestMap:...` 路径,看起来完全正常;紧接着对这些路径调用 `ObjectTools.get_properties` 却全部报 `is not valid Object for property 'instance'`,`ActorTools.get_actor_transform`/`get_class` 同样报 `is not valid Actor`。一开始怀疑是 API 参数格式问题(`instance`/`actor` 到底要不要额外包一层),换了好几种 payload 形状都不行。

**根因**:`EditorAppToolset.IsPIERunning()` 一查是 `false`——早前那次 `StartPIE` 对应的 PIE 会话在两次工具调用之间的这段时间(很可能是上下文压缩期间)已经结束了,但 `find_actors` 依然能返回带 `UEDPIE_0_` 前缀的路径字符串(推测是 `SceneTools` 内部缓存或者查询到了一个刚失效、尚未被完全清理的 `UWorld`),这些路径字符串本身"看起来"完全合法,唯独指向的对象已经不存在,所以任何试图解析成真实 `UObject`/`AActor` 的调用都会失败,而报错信息("not valid Object")完全没有提示"PIE 根本没在跑"这个真正原因。

**教训**:任何要"读 live PIE 状态"的排查动作,第一步必须显式 `IsPIERunning()` 确认为 `true`,不能依赖"记得自己之前调用过 `StartPIE`"这种历史记忆——尤其是长会话、经历过上下文压缩/长时间空隙之后接手时,PIE 可能已经因为各种原因(用户手动停止、编辑器本身超时、compaction 期间的意外)结束了。确认为 `false` 就重新 `StartPIE`,不要先花时间怀疑工具参数格式。

### 坑63:`SkeletalMeshComponent.AnimationData` 属性只是初始化/序列化用的静态缓存,不会随运行时 `PlayAnimation()` 调用更新,拿它判断"现在到底在播什么动作"是死路(2026-08-29,同一轮排查) #Animation #PropertyReflection #死胡同

**背景**:怀疑 `UpdateLocomotionAnim` 没能正确让角色从 Idle 切到 WalkForward,想找一个"零信任"的验证手段,而不是只看蓝图变量 `CurrentLocoAnim`(担心变量本身被设对了但视觉没变)。想到用 `ObjectTools.get_properties` 直接读 `CharacterMesh0.AnimationData`(`FSingleAnimationPlayData`,包含 `animToPlay`/`bSavedPlaying`/`savedPosition` 等字段),预期它能反映"这个组件此刻真实在播放哪个动作、播到第几秒"。

**结果**:PIE 里读全场 4 个单位,`AnimationData.animToPlay` 全部精确等于 `CharacterMesh0` 的 **CDO 默认值**(`Walking_import_Anim`,`savedPosition=0`),即便蓝图变量 `CurrentLocoAnim` 已经确认是 `Idle_import_Anim`——看起来像是"BeginPlay 的 Idle 初始化压根没有真正调用 `PlayAnimation`",一度怀疑这是本轮 bug 的根源,准备去查 BeginPlay 的动画初始化逻辑。

**根因**:`AnimationData` 这个 `UPROPERTY` 只在组件**注册/反序列化**阶段被引擎读取一次,用来初始化内部真正驱动播放的 `UAnimSingleNodeInstance` 对象;之后蓝图 `PlayAnimation()`/`SetPlayRate()` 等运行时调用只会改这个内部 instance 对象的状态,**不会**回写更新 `AnimationData` 这个缓存字段。所以不管运行时实际切换过多少次动作,`ObjectTools.get_properties` 读到的永远是组件初始化那一刻(也就是 CDO 序列化时)的原始值,和"现在真的在播什么"完全没有关系。这是一次纯粹的假线索,浪费了一整轮排查,最后靠交叉核对——变量 `CurrentLocoAnim` 在 4 个单位上全部正确变成 `Idle`,证明 `PlayAnimation` 调用链路本身其实是通的——才推翻了"BeginPlay 没调用"这个错误方向。

**教训**:凡是"某个组件现在实际的运行时状态"这类问题,只有两条可靠路径——①功能层面的自定义追踪变量(比如这里的 `CurrentLocoAnim`,前提是确认过赋值时机和调用链路正确)、②直接的视觉/截图确认;`AnimationData`/类似的"初始化配置结构体"属性只应该用来核对**资产配置**(比如 CDO 上 `IdleAnimAsset` 到底指向哪个 AnimSequence),不能用来核对**运行时行为**。

### 坑64:玩家反馈"移动动画方向不对"时,不要立刻假设"选错了动画 clip",先分清是"clip 选择错"还是"整个模型朝向反了 180 度(moonwalk)"——两者修法完全不同,前者治不了后者(2026-08-29,Mewtwo_TPose 骨骼网格迁移后的朝向排查) #Animation #Orientation #误诊 #排查心法

**背景**:用户反馈"按 W 前进时,变成后退走的动画;按 A/D 也是倒着走的动画"。第一反应是"`WalkForwardAnim`/`WalkBackwardAnim` 这两个 `AnimationAsset` 变量的资产引用被接反了",于是直接把这两个变量的默认值互相调换。验收:**没有任何变化**,用户追加反馈"往前走的时候还是头朝向有问题,不是正着走路"——这句话才是关键线索,指向的是"朝向"(整个角色面朝哪),不是"该播哪一份动作数据"。

**排查过程**:
1. 先做了一轮"选错 clip"方向的验证——read_graph_dsl/get_node_infos 逐节点核对 `UpdateLocomotionAnim` 内部的分支逻辑(速度阈值/点乘正负号选 Idle/WalkForward/WalkBackward),确认逻辑和接线本身完全正确,` if (NotEqual(target,current)) { Set; Play }` 这种"看起来像 if/else 但其实是顺序执行两条语句"的写法也核实过是对的,不是坑。这一轮排除了"函数逻辑错"。
2. 又用一个后台 agent 完整回溯了 `EventTick` 里 WASD 输入到 `UpdateLocomotionAnim` 的整条 642 节点执行链路,确认没有类似历史上 CastFailed 那种断线——图结构层面完全正常。
3. 到这一步"程序逻辑没问题"已经反复验证两次,但用户仍然反馈方向不对,而且明确说"swap 动画没用"——这时才真正把假设从"选错 clip"切换到"模型挂反了"。用 `SceneTools.add_to_scene_from_class` 生成一个临时测试 actor,强制把它的 `CharacterMesh0.AnimationData` 设成目标动作(`savedPosition=0.3` 取一个有代表性的动作中间帧),用 `EditorAppToolset.CaptureViewport` 显式传 `captureTransform` 从多个角度(45度俯视/纯侧面/正后方/纯俯视)截图,试图用肉眼判断角色的头/尾朝向和 `Arrow` gizmo(胶囊体真实 forward 方向)是否一致——**这一步的截图在当前的光照(项目风格化的紫色天空,整体偏暗、缺乏方向性阴影)下始终无法给出有把握的结论**,来回切换 `CharacterMesh0.RelativeRotation.Yaw` 在 90/270 之间对比,肉眼看不出预期中应有的"180度镜像"差异(推测是这个姿势本身左右/前后轮廓不够有区分度,加上渲染质量不足)。
4. 最终**放弃继续靠截图猜,直接用 `AskUserQuestion` 让实际在玩游戏、能清楚看到画面的用户自己描述现象**("背对前进方向(moonwalk)" / "侧对" / "转圈" 三选一)——这一步一次性给出了确定性答案,比继续截图排查快得多。

**真正根因**:`CharacterMesh0.RelativeRotation.Yaw` 这个挂载在胶囊体下的静态朝向补偿值,从骨骼网格换成 `Mewtwo_TPose` 那一轮起就被设成了 `90`,但正确值应该是 `270`(即 `90+180`)——早前"确认过朝向正确"的验收只是对**静止 Idle 姿势**的截图肉眼判断,而 90/270 这两个值相差整 180 度,恰好都能在某些静态角度的截图里"看起来大致过得去"(尤其是模型本身不是左右强不对称的设计),真正的偏差只有在**移动起来后模型朝向和实际行进方向的关系**上才会被人一眼看穿——这正是"以为闭环验收过的东西,其实一开始就带着 50% 概率的隐藏错误"的一次典型案例。

**修法**:`BP_Unit.Default__BP_Unit_C:CharacterMesh0` 的 `RelativeRotation.Yaw` 从 `90` 改成 `270`(其余不动)。**同时撤销了第一轮"swap WalkForward/WalkBackward 资产引用"这个误诊改动**,恢复成原来的对应关系——如果不撤销,朝向修好之后会变成"朝向对了,但步伐动作是反的"(该迈右脚的时候在迈左脚)这个新问题,两个 bug 会叠加成更难排查的复合状态。`compile_blueprint` 通过,用户 Play 验收通过。

**教训**:
1. "换动画播放" 和 "整个模型挂载朝向偏了固定角度" 是两类完全不同、修法互斥的 bug——前者的信号是"该往前走的时候放了往后走的动作数据"(比如 `WalkForwardAnim` 和 `WalkBackwardAnim` 引用真的接反了),后者的信号是"不管放哪个动作,角色身体朝向都和实际移动方向对不上"。玩家用自然语言描述的"动画不对"经常混着说,排查者需要主动追问/靠"swap 有没有效果"这类排除法来区分,不能选一个看起来省事的方向就直接动手改。
2. 一个角度补偿值如果是靠"看渲染截图猜前后"校准出来的(不是从模型资产的几何/骨骼数据算出来的精确值),就有真实的 50% 概率整体猜反 180 度,而且静止姿势的截图经常两个方向看着都"过得去"——这类校准值上线前,理想情况应该是找一个方向性极强的姿势(比如伸手指向一个方向、明显不对称的动作)专门做一次验证,而不是用 Idle 这种前后大致对称的姿势去定。
3. 当"读代码/读图/截图"这类工具侧排查反复验证"逻辑是对的"但用户反馈依然存在时,不要继续加码同一类排查手段(比如换个截图角度再试一次)——应该直接问能看到真实画面的人一个具体到可以三选一回答的问题,这往往比自己再猜五轮更快拿到确定性结论。

### 坑65:规划 AOE 范围技能时,直接读了 live 蓝图(不是只看文档),发现 `TryAttack`/`ResolveCounterAttack` 一旦被循环调用就会静默出错——两个此前从未暴露过的真实 bug,因为历史上从没人调过第二次(2026-08-29,待命键+AOE 移植规划阶段) #规划验证 #共享状态 #循环陷阱

**背景**:计划给 AOE 技能设计"命中列表里每个敌人都独立走一遍现有 `TryAttack` 单体伤害/反击管线"这个方案(而不是另写一套平行逻辑),规划阶段没有只信任 `UE蓝图状态.md` 里的文字描述,而是直接用 MCP 对**当前真实、已编译**的 `BP_GridManager.TryAttack`/`ResolveCancelAttack` 做了 `read_graph_dsl` 复查,结果读到两处此前完全没人发现、也不可能靠"看文档"发现的真实 bug——因为这两个函数从诞生起，从来没有在同一次玩家操作里被调用超过一次，这条隐藏路径此前无从触发。

**bug①**:`TryAttack` 函数体末尾,不管命中/未命中、存活/死亡,最终都会汇合到同一句 `(Variables|Default|SetSelectedUnit 0)`(清空成 `None`)——这在"一次攻击=一次 `TryAttack` 调用"的原有设计下完全合理(收尾清场)。但 `TryAttack` 开头会 `(Utilities|IsValid _selectedunit (:"Is Valid" ...))`且**没有 "Is Not Valid" 分支**——如果在循环里对同一批 AOE 目标反复调 `TryAttack`,第 1 次调用结束时 `SelectedUnit` 已经被清成 `None`，第 2 次调用一进来这个 `IsValid` 判断就会失败且没有 else，整个函数体从这一句开始直接静默跳过，不掉血、不报错、什么都不做。

**bug②**:`TryAttack` 在防御方存活的分支里无条件调用 `ResolveCounterAttack`(不管主攻击是否命中，这是既有设计)，而 `ResolveCounterAttack` 内部只要反击条件成立，就会执行 `(Variables|Default|SetPendingSkillRowName "basic")`且**这个函数里没有任何地方把它改回来**。`ComputeSkillDamage`/`GetSkillHitChance` 这两个真正算伤害的 C++ 包装函数，内部都是拿 `Grid.PendingSkillRowName` 去查 `DT_Skills` 表取 `Mult`/`Hit`/`TypeId`——也就是说，AOE 命中列表里只要第 1 个目标存活并触发了一次反击（这是绝大多数情况），`PendingSkillRowName` 就会在循环打到第 2 个目标之前被悄悄改成 `"basic"`，导致第 2 个及以后的目标全部按普通攻击的倍率结算，而不是这个 AOE 技能自己的倍率——伤害数字会不对，但不会报错，粗测"AOE 能不能打中多个敌人"这种测试完全发现不了，是那种会静默通过验收又在数值层面出错的坑。

**教训**:一个原本只被设计成"整个游戏动作里只调一次"的函数，即使内部逻辑本身完全正确、经过了大量验证（`TryAttack`/`ResolveCounterAttack` 都是这个项目里被验证/踩坑最多的函数之一，历史上出过坑26"双重掷骰"这种级别的问题），**把它复用进一个新的"循环调用"场景之前，必须重新审查它内部有没有"函数收尾时无条件清空/篡改某个共享状态、且不负责为下一次调用恢复"这种假设"我只会被调一次"的收尾代码**——这类代码在原场景下是完全正确的（该清空就清空），只有在被复用进循环时才会变成 bug，而且是那种"第一次迭代完全正确、后续迭代悄悄出错"的最难被粗测发现的模式。规划阶段主动去读 live 蓝图（而不是只信任已有文档的文字描述）是发现这两个 bug 的关键——`UE蓝图状态.md`/`UE节点备忘录.md` 都没有以任何形式记录过这两处行为，因为在坑65之前，这两个函数确实从未被这样调用过，文档只能记录"已经发生过的事"，不能替代对"即将复用到新场景的现有代码"做一次针对性复查。

**修法(设计阶段定的方案，实现阶段执行)**:新写的 `PerformAoeSkillAttack` 循环体里，每一次迭代调 `TryAttack` 之前都重新显式 `Set SelectedUnit = Attacker` 和 `Set PendingSkillRowName = 保存下来的 AOE 技能行名`（循环开始前先用一次 `bind` 快照原始行名，因为第一次 `TryAttack` 调用本身就会把它改掉），而不是只在循环开始前设一次。

### 坑66:给已有 Function(`SkillTokenToId`/`SkillIdToChinese`)追加分支时,`write_graph_dsl` 整体重写(而不是走 remove/add 重建流程)造成节点重复;修复过程中又连续踩中输出参数命名(`ReturnValue` vs `Result`)和调用点刷新两个已知坑,三层问题叠在一起排查(2026-08-29,AOE 移植阶段2) #write_graph_dsl #FunctionSignature #调用点刷新 #代价高昂

**背景**:阶段2需要给两个既有、已经跑了很久的技能名⇄中文名互查函数各追加4个 `elif` 分支。因为原函数是"单一已验证正确的线性 if/elif/return 文本",觉得"整体重写一遍、只在末尾多插4段"比手工在 30 层嵌套 `elif` 中间穿针引线风险更低,于是直接对着**这两个已经存在多年、图里本来就有内容**的函数调用了 `write_graph_dsl`。

**第一层坑(本该被记住却被忽略)**:`write_graph_dsl` 对已有内容的函数图是**追加不是替换**——这条规律其实早就写在这份备忘录最上面的硬规则速查表第一条,但因为这次的判断依据是"内容层面这是个我完全理解、可以安全整体覆盖的简单函数",注意力全在"新文本对不对"上,压根没有回头检查"这个函数当前是不是空的"这个前提条件。结果 `find_nodes` 一查,两个函数各自变成了 66+ 个 `IfThenElse`(应该是 34 个)——旧的 30 分支和新提交的 34 分支全部堆在一起,新提交的内容混进了一堆孤立/半连通的旧节点里,`compile_blueprint` 竟然报告成功(说明编译器只要求"入口能连通到某条出口",不要求"图里没有多余节点"),但图的真实状态完全不可信。

**修法**:`remove_function_graph` 整个删掉两个函数 → `compile_blueprint` 清悬空引用(报"找不到函数"是预期中的正常现象,这一步就是要让所有旧调用点先失效)→ `add_function_graph` 用原名重建空函数 → `add_function_param` 补输入参数 `Token`(String)。

**第二层坑(新发现,此前没人踩过,因为没人在"重建过的空函数"上加过带返回值的 `write_graph_dsl` 全新写)**:补输出参数时,类比这个项目里另一个成功先例 `IsPhysicalSkill`(用的是 `ReturnValue`)命名成了 `ReturnValue`,写完 `write_graph_dsl`(34 分支的干净版本,这次图里确实只有一份,没有重复)后编译报错:`Could not find a pin for the parameter ReturnValue... Pin Result named Result doesn't match`。逐节点 `get_node_infos` 核实发现:函数体内部所有 `(return X)` 自动生成的 `K2Node_FunctionResult` 节点,pin 名实际上全部是 `ReturnValue`(和我声明的一致),矛盾的地方在别处——反复交叉验证后才确认,报错其实来自图里其它地方(调用点),不是这个函数自己内部。第一次诊断把"函数自身签名"和"外部调用点缓存的旧签名"这两件事搞混了,原地重复 `compile_blueprint` 两次都是同一个报错,一度怀疑是这次工具调用本身有 bug。

**真正原因(第三层坑,和第8条硬规则同源但代价大得多)**:这两个函数存在多年,是被**其它 5+5 处调用点**(`ApplyDebugLoadout` 里 5 次 `SkillTokenToId`、`RefreshSkillMenuLabels`+`RefreshSkillBar` 里各 5 次 `SkillIdToChinese`)引用的公共函数,不是新写的孤立函数。这些调用点的 `K2Node_CallFunction` 节点缓存了函数**原本**的输出 pin(标准 UE 行为:一个手工在编辑器里加输出参数的函数,默认生成的 pin 就叫 `Result`,不是 `ReturnValue`——`IsPhysicalSkill` 那次侥幸把两者都试过一遍,选中的是巧合而非规律),`remove_function_graph`+`add_function_graph` 重建后,不管新参数取什么名字,只要和原来不是同一个底层 Pin/Guid,所有旧调用点全部变成"stale"状态,报错信息里明确写了 `In use pin Result no longer exists`——这才是最终线索,倒推出原参数名其实是 `Result`。改名成 `Result` 后编译依然报同样的错,证明问题**不是名字对不对,是调用点的 pin 引用本身(哪怕名字凑巧一样)已经失效**,和文件顶部硬规则"改签名后调用点不会自动刷新,只能 delete_node+create_node 重建"完全对应,只是这次一次性命中了全部 10 个调用点,逐个 `get_node_infos`→`delete_node`→`create_node`→按原有的 exec/self/Token/Result 连线逐条 `connect_pins` 补回去,耗费的操作量远超预期。

**教训**:
1. 对着**内容已存在**的函数图做任何 `write_graph_dsl` 提交之前,**不管多大把握"这次整体重写没问题"**,先 `find_nodes`(或 `list_functions` 数节点数)确认图当前是不是真的空——这条检查只需要一次工具调用,能完全规避第一层坑,而这次是在事后靠"分支数量翻倍"这个异常现象才发现问题,晚了。
2. 一个函数的输出参数具体叫什么名字,是这个函数**自己的历史**决定的,不能类比同项目里另一个函数的命名"抄"过来用——分歧极小概率碰巧一致(比如都叫 `ReturnValue`),但没有任何机制保证一致,唯一可靠的确认方式是重建前**没有机会**看到旧签名时,重建后老老实实读报错信息里明确点名的 pin 名字来定,而不是凭偏好或先例选一个。
3. **改一个被多处引用的公共函数的签名/身份(哪怕只是"删了重建、内容看起来一样"),连带影响的调用点数量要提前用 `find_nodes`/全文搜索摸清楚**,不能默认"这只是内部实现细节的调整"——这次两个函数一共牵连了 3 个不同 Function(`ApplyDebugLoadout`/`RefreshSkillMenuLabels`/`RefreshSkillBar`)里的 10 个调用点,如果没有心理准备,遇到 10 条相同报错很容易误判成"同一个 bug 报了很多遍"而不是"确实有 10 个独立位置都要修"。

### 坑67:同一个 `Class|GridSlot|GetRow` 节点,在旧代码(已编译)里能用,在**新写的** `write_graph_dsl` 里报 "Could not connect pin Defender to self"——不是节点坏了,是新函数的上下文没有已编译代码里那条隐式的类型收窄路径(2026-08-29,AOE 移植阶段3,`GetAoeHitList`) #WriteGraphDSL #类型解析 #GridSlot #BPUnit

**现象**:`GetAoeHitList` 新函数里想用 `Class|GridSlot|GetRow(Defender)` 读某个 `BP_Unit` 参数的行号——这个写法在 `ValidateSkillTarget`/`TryAttack` 等既有代码里用得好好的(`BP_Unit` 继承链上确实有 `GridSlot` 这一层,`GetRow`/`GetCol` 是 `GridSlot` 的函数)。但在这个全新写的 `write_graph_dsl` 里,同样的调用直接报错 `Could not connect pin Defender to self`,像是类型不兼容。

**绕过法(未深挖根因)**:换成 `Class|BPUnit|GetRow`/`Class|BPUnit|GetCol`(照抄 `GetCol` 的既有惯例,而不是 `GetRow` 抄的 `GridSlot` 版本),同样的参数、同样的意图,直接编译通过。以后**新写**涉及 `BP_Unit` 参数取行列号的 DSL,一律优先试 `Class|BPUnit|GetRow`/`GetCol`,不要照抄旧代码里的 `Class|GridSlot|GetRow` 写法——旧代码能用大概率是因为那个上下文里 `self`/参数的静态类型推导路径不同(比如 `self` 就是 `BP_GridManager` 内部对既有局部变量的引用,类型信息在编译期已经"具体化"过一次),新写的 DSL 从零推导时拿到的是基类层级的 `GridSlot` 视角,`self` 连接会不兼容。

### 坑68:`Utilities|Name|Equal(Name)` 只有"读"的形态,创建新节点时这个 type_id 不存在——真正能建出来的是 `Utilities|Operators|Equal(==)`(2026-08-29,AOE 移植阶段3,`IsAoeSkill`) #TypeID #FindNodeTypes #Name比较

**现象**:`IsAoeSkill` 要比较一个 `Name` 类型的 `RowName` 参数和几个字符串字面量(`"sweep"`等),直觉找 `Utilities|Name|Equal(Name)`(read_graph_dsl 反序列化既有代码时确实会打印出类似形态的文本),但拿这个 type_id 去 `create_node`/`write_graph_dsl` 建新节点会失败。

**修法**:`find_node_types` 配 `context_pins` 精确匹配 `Name` 类型的输入,搜出来真正可创建的是 `Utilities|Operators|Equal(==)`,直接换用即可,行为完全一致。**教训**:`read_graph_dsl` 打印出来的算子写法名字,不能保证就是 `create_node`/`write_graph_dsl` 能拿去创建新节点的那个 type_id——这类"只读形态"和坑12(`find_node_types` 搜到的字符串本身也可能不可创建)是同一类陷阱的另一个变种,遇到"反序列化里见过、但建不出来"的算子,直接上 `find_node_types`+`context_pins` 重新搜,不要死磕原文本里的名字。

### 坑70:整体重写一个内容已存在多年的大函数(`RunRegressionTests`)时,同一份从 `read_graph_dsl` 原样拷贝出来的文本,连续撞上了三种完全不同类型的"读写不对称"陷阱,缺一不可全部修完才能编译通过(2026-08-29,补写 AOE 的 T10 回归断言) #ReadGraphDSL #WriteGraphDSL #反序列化失真 #self参数 #TypeID

**背景**:给 `RunRegressionTests` 追加 T10 断言,判断"内容不新鲜"(有12条已验证正确的历史断言)不能用 `write_graph_dsl` 直接追加(坑1/坑66 的教训),于是按标准流程 `remove_function_graph`→`compile_blueprint`→`add_function_graph`→整体重写"原文本 + 新增 T10 段"。**原文本是直接从这次会话稍早前 `read_graph_dsl` 读出来的、当时已经确认过和历史文档一致的内容**,按理说"原样抄一遍"应该零风险,结果连续报了三类错,分三轮才全部修完:

1. **跨类同名属性解析漂移(坑10/16/坑67 的再次复现,但这次更极端)**:原文本里 `(Class|BPUnit|GetCol _output)`(`_output` 其实是个 `BP_Tile`)、`(Class|GridSlot|GetRow _output)`——这两行在**本轮任何代码改动之前**就已经是这样写的,而且是**在同一个函数被删除重建之前**用 `read_graph_dsl` 原样读出来的历史文本,重新写回去却报"Could not connect pin Output to self"。说明这类跨类属性解析结果**不是文本决定的,是"当前蓝图里存在哪些类/哪些同名属性候选"这个全局上下文决定的**——哪怕一个字都没改,只要中间新增过别的类/变量(本轮新增了 `BP_Tile.AoeHighlightMat`/`BP_GridManager.GetEnemyUnitAtTile` 等好几个新东西),同一段旧文本重新编译时解析结果都可能变。**修法**:全部换成明确指向真实目标类的写法(`Class|BPTile|GetCol`/`Class|BPTile|GetRow`,以及后面 `_spawnedunit_2` 是 `BP_Unit` 时换成 `Class|BPUnit|GetRow`)——不能再假设"以前编译通过的写法保真",每次整体重写都要按"这个变量实际是哪个类"重新判断,不能照抄旧文本里的类名前缀。
2. **`CallFunction|函数名` 的实际 type_id 和 `read_graph_dsl`/`list_functions` 显示的函数名不是同一个字符串,而且这次连规律都不一致**:`list_functions` 显示函数名是 `FindNearestUnit_0`(带下划线),`read_graph_dsl` 把调用点显示成裸 `|FindNearestUnit_0`(坑48 的"裸函数名"现象,补 `CallFunction|` 前缀是标准修法),但补上前缀后依然报"does not exist"——最后用 `find_node_types(type_id_filter="FindNearestUnit")` 才搜出真正能建的是 `CallFunction|FindNearestUnit0`(**没有下划线**)。也就是说这个函数真实的内部名字和显示名字之间,不只是"少了 CallFunction| 前缀"这一种差异,**下划线本身也可能在显示层和真实 type_id 之间不一致**,遇到"报 does not exist"不要止步于"加前缀",要用 `find_node_types` 精确搜一遍确认真实字符串。
3. **`self` 参数在 `read_graph_dsl` 输出里被静默吞掉,而且不是每处都吞,只吞了一小段**:同一份原文本里,前面大多数调用都规规矩矩带着 `_self` 作为第一个参数,但靠后的一小段(`ShowAttackRange`/`ClearHighlights`/`Assert` 各一次,刚好是 T8 那几行)显示成了"缺 self"的裸调用形式(比如 `(CallFunction|ShowAttackRange _spawnedunit_3)`,只有一个参数)。这几行在**没有改动过的历史代码里本来就必须有 self**(和同一函数其它九成调用点的写法完全同构),但 `read_graph_dsl` 只在这一小段漏显示了——原样抄录必然报"Could not connect pin SpawnedUnit to self"。**教训**:`read_graph_dsl` 会不会漏显示 `self` 参数,和"这段代码是不是最近改过"无关,是不可预测的局部反序列化失真,**每次要整体重写一个已有函数,遇到某个调用点看起来"参数比同类调用少一个"就要高度怀疑是 self 被吞了,补上再试,不要因为它是"原样照抄"就默认可信**。
4. **重建函数图时,函数自己的局部变量(`graph` 参数绑定到该函数的变量,如 `SnapColD`/`SnapRowD`)会跟着 `remove_function_graph` 一起被删除,必须重新 `add_variable` 声明一遍才能在新函数体里继续用**——这条其实是坑66 教训 1 的直接推论(重建=删了重建,局部变量也是"这个函数的内容"的一部分),但因为这次局部变量藏在 `RunRegressionTests` 中间不起眼,直到写 DSL 时报"Variables|Default|SetSnapColD does not exist"才想起来要重新声明。**以后重建任何用到函数局部变量的既有函数,清单要先列全局部变量名字和类型,重建后第一步就是 `add_variable`/`add_object_variable` 补回来,不要等报错才发现漏了。**

**最终结果**:四类问题全部修完后一次性 `write_graph_dsl`+`compile_blueprint` 通过,`StartPIE` 实测 T1–T9(除已知的 T7b/T7c 和约5%概率误报的 T6a)全部 PASS,新增的 T10a–T10h 全部 PASS(含专门用来卡"坏了会静默把第二个目标伤害算成 basic 倍率"这个坑69 场景的 `T10h_PerformAoeSkillAttack_ConsistentMultiplierAcrossTargets`)。

### 坑69(自己踩自己写过的规矩):`PerformAoeSkillAttack` 第一版把"循环内重设 PendingSkillRowName"写成 `SetPendingSkillRowName(GetPendingSkillRowName())`,编译通过、`get_connected_subgraph` 也显示"连线正确",但这其实是坑3同一个坑的重演——纯 Get 节点没有独立求值时机,循环里现读现写等于没做快照(2026-08-29,AOE 移植阶段3,事后自查发现) #WriteGraphDSL #bind别名 #纯函数求值 #自己违反自己的规矩

**背景**:阶段3计划里明确写了修法是"循环开始前只读一次 PendingSkillRowName 存下来,循环内每次迭代都从这个存下来的快照重新赋值"——这正是全文最上面硬规则第③条(坑3)早就总结过的"需要在副作用调用前后各读一次同一个纯属性时,必须显式 Set 到局部变量做快照,不能依赖对同一个纯表达式的重复读取"。但实际写 `write_graph_dsl` 时图省事,直接写了 `(Variables|Default|SetPendingSkillRowName (Variables|Default|GetPendingSkillRowName))`——语法上是"取当前值、设回去",`compile_blueprint` 通过,`get_connected_subgraph` 顺着 exec 链条追下去，连线也确实"哪里连到哪里"都对——但这条 Get 是纯节点,没有独立的求值时机,循环第 1 次迭代时它读到的是循环开始前的原始值(正确),但循环第 2 次迭代开始时,`ResolveCounterAttack` 已经在第 1 次 `TryAttack` 内部把 `PendingSkillRowName` 悄悄改写成了 `"basic"`,这条 Get 再次被拉取求值,读到的就是这个被污染的脏值,又原样设回去——等于这一整条"修复"从第二个目标开始就完全没生效,而且**编译和连线检查都测不出这个问题**,因为图的拓扑结构完全合法,问题出在"求值时机"这个纯节点语义层面,不是连线错误。

**修法**:新增一个真正独立的函数局部变量 `SavedSkillRowTmp`(Name 类型,`graph` 参数指向本函数),循环开始前用一次 `SetSavedSkillRowTmp(GetPendingSkillRowName())`(只执行一次,在循环外),循环体内改成 `SetPendingSkillRowName(GetSavedSkillRowTmp())`——因为 `SavedSkillRowTmp` 在循环内从未被重新 `Set` 过,循环内的这个 Get 每次求值都读到的是同一份从未变过的快照值,不会受 `ResolveCounterAttack` 篡改 `PendingSkillRowName` 的影响。

**教训**:
1. **规划阶段写的"修法"文字描述("每次迭代都重设成保存的值")和实际 DSL 实现是否真的做到"保存"是两件事**——用同一个变量"读了又设回自己"不叫保存,叫抄近路,表面上文字对得上,实际语义完全不同,必须落地一个真正独立的新变量才算数。
2. **`compile_blueprint` 通过 + `get_connected_subgraph` 连线正确,不能证明"求值时机"也对**——这次连线本身从头到尾都没有错,`get_connected_subgraph` 能验证的是"图连通、类型匹配",验证不了"这条纯 Get 求值时读到的到底是哪个时间点的值"。这类 bug 必须回到硬规则第③条(坑3)本身去核对:凡是"循环里要用到一个循环开始前就该定型、且循环体内其它调用可能会悄悄改写它"的值,一律要有一个专门的、循环体内绝不再被 `Set` 的独立局部变量兜底,不能图省事直接 Get 原变量。
3. 这是本项目第二次在"该用局部变量快照"这件事上摔跟头(上一次是坑3本身),说明这条规则光写在备忘录顶部不够,以后每次涉及"循环内重复读取一个可能被循环体自身改写的值"的新函数,写完 DSL 之后要专门用 `find_nodes`+`get_node_infos` 确认:循环体内负责"重设"的 `Set` 节点,它的输入到底连的是原始变量的 Get,还是一个独立快照变量的 Get——前者几乎总是这个坑的复发。

### 坑71:`WBP_DebugLoadout.FillSkillCombo` 是纯线性、无循环、内容已验证过的老函数,按坑1/66 的经验"这类简单文本可以放心整体 `write_graph_dsl` 重写",结果照样在 `ComboBoxString` 节点上翻车(2026-08-30,补 4 个 AOE 技能下拉选项) #WriteGraphDSL #UMG #ComboBoxString #declaring_class

**背景**:`FillSkillCombo` 函数体是一长串 `ClearOptions`→30多个 `AddOption`→`SetSelectedOption`,没有分支也没有循环,是"结构最简单、最该放心整体重写"的那类函数(阶段2计划文档就是照着这个假设去处理 `SkillTokenToId`/`SkillIdToChinese` 的)。但把 `read_graph_dsl` 读出来的原文本 + 4 行新增 `AddOption` 一起喂给 `write_graph_dsl`,直接报 `Could not connect pin Combo to self`,`ClearOptions` 那一行就失败,函数内容完全没被写入(整体失败,不是部分污染)。

**根因**:`ComboBoxString` 的 `ClearOptions`/`AddOption`/`SetSelectedOption` 这几个节点,在这个引擎版本里存在多个同名候选(坑33 已经记过"`ComboBoxString` 的这几个节点运行时经常拿不到默认值,必须 `create_node`+`declaring_class=/Script/UMG.ComboBoxString` 才能建对类型"),但坑33原本只验证过 `create_node` 路径,没验证过 `write_graph_dsl` 路径——这次证实 `write_graph_dsl` 内部对 `ComboBox|XXX` 这类 type_id **同样没有办法自动消歧declaring_class**,不管函数体多么线性简单,只要涉及这几个特定 UMG 节点,DSL 整体重写就会连错类型/连不上。

**修法**:退回 `create_node`+`connect_pins`+`break_pins` 增量插入(`ComboBox|AddOption` 显式传 `declaring_class: {refPath: "/Script/UMG.ComboBoxString"}`),在既有最后一个 `AddOption`("近身战")和 `SetSelectedOption` 之间插入 4 个新节点,`self` 参数从 `FunctionEntry` 的 `Combo` 输出 pin 扇出连接(和其余 30+ 个既有 `AddOption` 节点的接法完全一致),`Option` 字符串走 `set_pin_value` 设字面量。`compile_blueprint` 通过,`read_graph_dsl` 复查确认原有选项一个没丢、新增4个都在正确位置。

**教训**:"函数体是不是纯线性无循环"只回答了"能不能用 `write_graph_dsl` 整体重写"这个问题的一半——另一半是"这个函数体里用到的节点类型,`write_graph_dsl` 能不能正确消歧"。已知在这条红线上的节点类型(`ComboBoxString` 系列,见坑33)一律不能整体重写,不管外层函数逻辑多简单;遇到"看起来是文本问题但报的是 pin 类型不兼容"这类错误,先怀疑是不是撞上了某个已知需要 `declaring_class` 消歧的节点类型,而不是去抠字符串写法本身。

### 坑73:`get_node_infos`/`read_graph_dsl` 读旧代码里 `SetInputMode_GameOnly`/`SetInputMode_GameAndUI` 显示成带下划线的类型名,但 `find_node_types`/`create_node` 真正能建的是无下划线版本(2026-08-30,`ToggleDebugPanel` 补输入模式切换) #TypeID #InputMode #下划线

**背景**:给 `BP_TurnManager.ToggleDebugPanel()` 补"打开面板切 `GameAndUI`+显示鼠标、关闭切回 `GameOnly`+隐藏鼠标"逻辑时,想抄 `StartTurn` 里已经验证过在用的写法——`get_node_infos` 读 `StartTurn` 现有节点,显示的 type_id 是 `Input|SetInputMode_GameOnly`(带下划线)。直接拿这个字符串去 `find_node_types(type_id_filter="SetInputMode_GameOnly")` 搜,**返回空**;换成不带下划线的 `SetInputModeGameOnly`/`SetInputModeGameAndUI`/`InputMode` 做前缀搜索,才搜到真正能创建的是 `Input|SetInputModeGameOnly`/`Input|SetInputModeGameAndUI`(全部无下划线)。用 `get_node_type_pins` 拿这两个无下划线字符串去建预览节点,返回的 pin 信息里那个预览节点自己的 `type_id` 字段又显示回带下划线的 `Input|SetInputMode_GameOnly`——说明**这就是坑70点2(`FindNearestUnit_0` vs `FindNearestUnit0`)的同一类陷阱,这次撞在了引擎原生函数节点上,不止历史上出现过的自定义蓝图函数**:反序列化显示名和真正建节点用的 type_id 可能只差一个下划线,`find_node_types`/`get_node_type_pins` 两个工具在这件事上互相印证(用不带下划线的字符串能建、建出来再读回显示带下划线),但**只信 `get_node_infos`/`read_graph_dsl` 读到的旧代码显示名去抄,大概率抄不动**。

`Class|PlayerController|SetShowMouseCursor`(原生 `PlayerController.bShowMouseCursor` 属性的 setter)反而是不带任何下划线歧义、`find_node_types` 用完整属性名 "PlayerController" 广撒网就能直接搜到的干净结果,同一次排查里两种情况都遇到了,说明**没有一概而论的规律,新增任何"看起来眼熟"的原生引擎节点前,一律先 `find_node_types` 用不带下划线/不带特殊符号的关键词广搜一遍,不要直接照抄旧代码里 `read_graph_dsl`/`get_node_infos` 显示的字符串**。

### 坑74:MCP 连接中断不只是"这次调用失败",可能伴随蓝图编辑器未保存改动的整体丢失(2026-08-30,`ToggleDebugPanel` 补输入模式切换) #MCP连接 #未保存丢失 #save_assets

**现象**:给 `ToggleDebugPanel()` 用 `create_node`/`connect_pins` 加完 6 个新节点、`compile_blueprint` 也拿到了干净的返回值(`null`,无错误)之后,MCP 连接报 `Unable to connect. Is the computer able to access the url?`。按以往经验(`/mcp` 手动重连即可恢复,见"MCP BlueprintTools实测细节"第11条),重连后第一件事是 `get_connected_subgraph` 复核连线——结果**这个函数只剩最初的 8 个节点,新加的 6 个全部消失**,`find_nodes` 也确认了同样的结果,不是查询/反序列化的问题。重新 `create_node` 补建时,新节点编号从 `K2Node_CallFunction_0` 重新起,而不是接着断线前已经用到的 `_6/_7/_8/_9`——说明**断线这次伴随的是蓝图这个"图"对象本身某种程度的重置(内存态被丢弃/重新加载),不是一次单纯的网络抖动那么简单**,`compile_blueprint` 曾经返回"通过"这件事**不代表改动已经持久化**,只代表那一刻内存里的图是自洽的。

**应对**:
1. 每完成一小段 `create_node`/`connect_pins`+`compile_blueprint` 且确认通过后,**立刻 `AssetTools.save_assets([])` 落盘**,不要攒到一整个功能都做完再存——保存的间隔就是潜在丢失的窗口大小。
2. 连接中断重连后,**不能假设"重连前最后一次成功的操作结果还在"**,哪怕那次操作返回值明确是成功的;对任何"断线前完成、断线后要接着往下做"的图编辑,重连后的第一步必须是 `find_nodes`/`get_connected_subgraph` 重新核实现状,而不是直接往下续。
3. 断线后重连,`create_node` 系列工具建出来的节点编号可能从 0(或某个更低的基线)重新计数——不能用"节点编号是否连续递增"去判断某次改动是否成功持久化,唯一可信的判断标准是重新 `find_nodes`/`get_node_infos` 实测查询。

### 坑72:`BP_Unit.EventTick` 不是"一条线从头执行到尾"的单线程,里面混了至少三种不同"供电"方式的代码段,其中两段结构上完全执行不到——排查 AOE 瞄准态"移动/射程刷新要在 Aiming 时暂停"这个需求时才第一次被系统性发现(2026-08-30,阶段4 EventTick 网关插入) #EventTick #死代码 #ExecutionSequence #EnhancedInput坑41

**背景**:计划文档(`zazzy-launching-dolphin.md`)描述 `EventTick` 是"现有两个连续移动用的 `AddMovementInput` 调用"、"`ClearAttackHighlightsOnly→ShowSkillRange`、`ClearLockIndicators→GetTargetsInRange→SetLockIndicator` 这两段"——听起来像总共 2~3 处调用。实际用 `get_node_infos` 从 `K2Node_Event_2`(Tick)开始逐节点回溯/前进后发现,`EventGraph` 里同名函数调用点数量远超预期(`AddMovementInput` 14 处、`ClearAttackHighlightsOnly` 6 处、`ClearLockIndicators` 6 处),且分属三种完全不同的"谁在驱动它执行"的情况:

1. **真正在跑的主线程**(`Tick.then`→`Actor|GetAllActorsOfClass(BP_GridManager)`[`K2Node_CallFunction_715`]→`CastToBP_GridManager`[`DynamicCast_62`]→`GetTargetsInRange`[`716`]→`CastToPlayerController`[`DynamicCast_63`,处理"是否已 Possess"分支,两个分支后续汇合]→……一路向下,中途多次重复"`GetAllActorsOfClass`+`Cast`"式的"每次现查"(和项目"每个新按键都自己现查引用"的既有风格一致,只是被现查的对象是 GridManager/PlayerController 不是按键触发的一次性查询,所以在 Tick 里被反复现查了十几次)——本次要新加的 `Branch(NOT Aiming)` 网关全部插在这条主线程上的 10 个节点上(见 `UE蓝图状态.md` 对应小节的具体 refPath 列表)。
2. **完全没有 exec 供电、结构性死代码**:`K2Node_ExecutionSequence_0`(`Utilities|FlowControl|Sequence`)自己的 `execute` 输入 pin 的 `connected_pins` 是空数组——没有任何东西触发它。它的 `then_1` output 接到 `CastToPlayerController`[`DynamicCast_0`]再接一整段"移动+看向+Col/Row同步+清高亮"逻辑(`AddMovementInput`[`35`/`36`]→`AddControllerPitchInput`[`38`]→`GetAllActorsOfClass`+`Cast`[`48`/`DynamicCast_1`]→`GetNearestTile`[`44`]/`SetActorLocation`[`49`]→`SetCol`/`SetRow`[`VariableSet_1`/`_2`]→`ClearAttackHighlightsOnly`[`72`]→…→`ClearLockIndicators`[`78`]→…)——这一整段图结构完整、内容看起来正是文档描述的"Col/Row 回写+高亮刷新"该有的样子,**但因为顶端的 Sequence 节点没人触发,整段永远不会执行**。没有查这段代码是哪次改动留下的(不在本次任务范围),只确认了它现在确实是死的,**没有动它**(删除/修复都有风险,且不影响本次 Aiming 网关的正确性——死代码不需要额外挡住)。
3. **被 Enhanced Input 事件独占供电、必然死代码**(和坑41 是同一个根因的另一处受害者):`AddMovementInput`[`15`/`17`]这一对的 `execute` 链一路回溯到 `K2Node_EnhancedInputAction_1`(`IA_Move` 事件本身,不是 Tick),而项目里 Enhanced Input 全局不触发(坑41),所以这对调用和它前面挂着的调试 `PrintString("MOVE INPUT RECEIVED")`永远不会执行。同样没有动它。

**教训**:
1. **`get_connected_subgraph` 从 Tick 事件本身发起会返回极大的结果(本次实测 82万字符,直接超工具输出上限)**,因为 Tick 的 `DeltaSeconds` 输出数据 pin 会被十几处独立逻辑各自消费,传播范围覆盖几乎整个 EventGraph;排查这类"入口极度扇出"的事件,不要对着事件本身跑连通子图,改成对**具体某个可疑调用点的 `execute` 输入 pin 顺着 `connected_pins` 一路手动回溯**(每次一两个节点,`get_node_infos` 批量查),直到确认它到底连回了 Tick 本体还是连去了别的、可能供电不足的分支起点(`ExecutionSequence`/`EnhancedInputAction`/`InputKey` 等)。
2. **`find_nodes` 按函数名搜出来的多个同名调用点,不能假设它们都在同一条活的执行链上**——项目历史上不同阶段各自往 Tick 里"追加",从未清理过旧的,新旧版本的调用点会同时以合法节点的形式留在图里,只是有的有电、有的没电;这和坑52 记录的"点击驱动的三代输入系统同时存在"是同一类"只加不删的历史包袱",只是这次出现在 Tick 而不是点击事件上。
3. **一个 exec 输入 pin 的 `connected_pins` 为空数组,是"结构性无法执行"的权威判据**——不需要也不应该靠"这段代码看起来功能上很合理/很重要"去反推它一定在跑,MCP 反射工具在这一点上比读代码逻辑猜测靠谱得多。
4. 本次为了保险,`Branch(NOT Aiming)` 网关**只插在了确认存在于 Tick 主线程上的 10 个调用点**,没有连带"顺手"给死代码那两段也插网关——给死代码插网关没有任何收益(它本来就不会执行),硬插反而是无意义的图膨胀,遇到类似情况不用纠结"要不要一并处理",跳过就是了。

### 坑75:MCP 连接中断这次不只是丢了未保存的图编辑(坑74),还把编辑器当前打开的关卡整个换成了空白的 `/Temp/Untitled_1`(2026-08-30,验证技能栏修复时发现) #MCP连接 #关卡状态丢失 #get_current_level #load_level

**现象**:修完 `SkillIdToChinese`/`SkillTokenToId` 后想开 PIE 实测,`StartPIE` 调用本身成功,但后续所有 `get_properties`/`find_actors` 对着"应该存在"的 `TestMap` 相关 refPath(比如 `/Game/Maps/UEDPIE_0_TestMap.TestMap:PersistentLevel.BP_TurnManager_C_1`)全部报"not valid Object"。一开始怀疑是坑62 那种"PIE 其实没在跑"或者实例编号变了(`_C_0` vs `_C_1`),但 `IsPIERunning()` 明确返回 `true`,换编号也试了不行。最后用 `find_actors`(不带任何过滤条件)兜底一查,返回的全是 `/Temp/Untitled_1`/`/Memory/...OpenWorld` 这种带大地形(Landscape)的默认模板关卡内容,完全不是项目自己的 `TestMap`——`SceneTools.get_current_level()` 确认编辑器当前打开的关卡确实是 `/Temp/Untitled_1`,不是 `/Game/Maps/TestMap`。

**根因(推测,未深究引擎内部机制)**:本轮会话里发生过至少两次 MCP 连接中断(见坑74),其中一次导致编辑器当前打开的关卡被换成了一个从未保存过的空白模板关卡——大概率是编辑器进程本身在那次中断期间发生了某种重置/重新加载,新建了默认的 "Untitled" 关卡,而不仅仅是"丢了几个未保存的蓝图节点"这么局部的影响。这比坑74原本记录的范围更大:**连接中断可能连"当前在编辑哪个关卡"这个最基本的编辑器状态都保不住**。

**修法**:`SceneTools.get_current_level()` 确认现状 →`SceneTools.load_level("/Game/Maps/TestMap")` 重新加载正确的关卡 → 再次 `get_current_level()` 确认切换成功,之后所有基于 `TestMap` 的 `find_actors`/`get_properties` 才恢复正常。

**教训**:
1. 任何一次 MCP 连接中断之后,**除了按坑74重新核实"刚才的图编辑是否还在"之外,还要额外核实"当前打开的关卡对不对"**——`SceneTools.get_current_level()` 是一次开销很低的检查,连接中断后、准备做任何 PIE 相关操作之前,应该养成先调一次的习惯,不要看到 `IsPIERunning()==true` 就默认"关卡状态一切正常"。
2. 排查"明明 `IsPIERunning()` 是 true,但所有已知 actor refPath 都报 not valid Object"这类问题时,`find_actors`(不带过滤条件,直接看返回的 actor 长什么样)是比反复猜测实例编号更快定位问题的手段——一眼就能看出"这些压根不是我认识的关卡里的东西"。

### 坑76:`BP_TurnManager.SkillIdToChinese`/`SkillTokenToId` 两个函数,**全部 35 条分支的 `return` 字面量在某次不明的历史改动里被集体替换成了空字符串**,导致"配装预设明明生效了,技能栏/自定义下拉却一直显示不出中文名"这个问题被误判成"用户没有正确应用配装"排查了两轮才找到真根因(2026-08-30,用户截图揭穿) #数据完整性 #ReturnValue #未察觉的静默坏数据

**背景**:用户反馈"技能栏没有名字",第一轮排查(见 `UE蓝图状态.md` 对应小节)基于"`SkillSlots` 开局是空数组,需要先手动开配装面板选预设"这条合理但不完整的解释,顺带发现并修了"面板打不开/点不动"这个真实存在的输入模式坑,以为问题解决了。用户按修复后的流程(Ctrl 开面板→点 ELEM 预设)操作后截图反馈"还是没有"——**关键线索在截图里:遗物顶栏正确刷新成了"元素核心丨铁甲皮丨钢之意志",证明预设确实生效、`RefreshRelicBar` 这条链路完全正常,只有技能栏这一条链路显示不出来**。这排除了"配装没生效"的可能性,把嫌疑锁定到"`SkillSlots`→中文名"这条转换链路本身。直接读 live PIE 的 `SkillSlots`(确认是 `[ember,aqua,vine,hydro,leafblade]`,完全正确)和 `Txt_Skill0.Text`(是 `"1 "`,只有数字没有名字),再顺着 `RefreshSkillBar`→`CallFunction|SkillIdtoChinese` 读函数体,发现**这个函数 34 层 `if/elif`,每一层的 `(return "...")` 全部是空字符串** `""`,包括最早 2026-08-15 就存在的 `basic`/`ember`/`aqua` 这些老分支;反向的 `SkillTokenToId`(中文名→英文id,配装自定义下拉解析用)是同样的病——全部分支返回空串。

**根因**:未查明具体是哪一次操作造成的(两个函数从建立到现在经手过很多轮"整体重写"/"追加分支",包括本项目 2026-08-15 最初创建、之后多次因为新增技能追加分支),但结果是**这两个函数的核心数据内容在某个时间点被整体清空成空字符串,此后一直没人发现**——因为项目里"游戏默认不配技能,需要先手动开面板选预设"这条路径,在此之前很可能从来没有人在配装生效之后真的去看过技能栏文字对不对(historical 验收记录基本都是看"预设按钮点了没报错"/"遗物顶栏刷新了"这类间接证据,没有一条断言真正检查过 `Txt_Skill0.Text` 里到底有没有中文名)。

**修法**:对照项目里技能数据的唯一权威来源 `js/data/skills.js`,把两个函数全部 35 条分支(31 条原有技能 + 阶段2新增的4条 AOE 技能)逐一核对 id↔中文名,`write_graph_dsl` 整体重写(纯 `Utilities|String|EqualExactly`+`if/elif/return`,没有涉及 `ComboBoxString` 这类需要 `declaring_class` 消歧的节点,和坑71 的红线无关,可以放心整体写)。`SkillIdToChinese` 的 `else` 分支改成 `(return Token)`(未识别原样返回,匹配 `UE蓝图状态.md` 里"认不出则原样返回"的既有文档描述);`SkillTokenToId` 的 `else` 保留 `(return "")`(未识别返回空串,避免把非法值写进 `SkillSlots`)。

**教训**:
1. **"预设按钮点了、旁边的顶栏刷新了"不能证明"这条配装链路上所有下游 UI 都在正确显示"**——同一次 `ApplyPresetXxx` 调用里,`RefreshRelicBar`(遗物顶栏)和 `RefreshSkillMenuLabels→RefreshSkillBar`(技能栏)是两条独立的展示链路,一条工作正常不代表另一条也正常;下次类似"某个信息没显示出来"的反馈,要分别验证每一条独立的展示链路,不能因为看到"隔壁的东西刷新了"就推断"配装系统整体没问题"。
2. **回归测试/验收记录里"某功能点了没报错"和"某功能显示的具体文字内容是对的"是两个不同强度的断言**,前者测不出这类"数据内容被清空但结构完好、编译和运行都不报错"的坏数据问题——这类问题只能靠"真的把最终显示给用户看的文字读出来,和期望值逐字比对"才能发现,`RunRegressionTests` 目前没有一条断言检查任何 UI 文本内容(全是数值/HP/数组长度这类),这是当前回归覆盖的一个盲区,值得以后补充。
3. **排查"应用了配置但效果没体现"类问题,除了怀疑"配置有没有真的生效"(第一层)之外,同等重要的是要单独怀疑"生效的配置有没有被正确转换成最终展示形式"(第二层)**——本次两轮排查都栽在只验证了第一层(`SkillSlots` 数组内容确实对),第二层的转换函数(`SkillIdToChinese`)才是真正埋雷的地方,而且这类"数据被清空成空字符串"的坏法,`compile_blueprint`/`get_connected_subgraph` 完全测不出来(图结构、连线、参数类型全部合法),必须要么读 `read_graph_dsl` 的字面量内容,要么直接读运行时最终值,靠"编译通过/连线正确"这类结构性检查是查不出来的。

### 坑77:"越界回绕"逻辑只处理了"下标比数量大"这一种越界,没处理"数量本身是 0"这种越界,`LockedTargetIndex` 用了两年多才第一次暴露(2026-08-30,`SetLockIndicator` 每 Tick 报 Accessed None) #边界条件 #空数组 #越界回绕 #EventTick

**背景**:`BP_Unit.EventTick` 里锁定式索敌逻辑(2026-08-22 建立,见该日期章节)用 `Select((LockedTargetIndex >= 候选数量), 0, LockedTargetIndex)` 处理"候选数量变少导致原下标失效"的情况——这个写法只对"候选数量 ≥ 1 但下标碰巧比它大"这一种越界有效,回绕目标固定是字面量 `0`。**候选数量恰好是 0(当前技能射程内一个敌人都没有)时,`0 >= 0` 同样成立,回绕结果还是 `0`,但 `0` 对长度为 0 的数组仍然是非法下标**——`Utilities|Array|Get(acopy)` 在这种情况下直接返回 `None`(不产生自己的报错),下游把这个 `None` 传给需要真实对象引用的函数调用(`SetLockIndicator`)时才报"Accessed None"。这个坑从系统建立起就存在,一直没暴露是因为**日常测试/开发时手边永远有至少一个敌人在默认技能射程内**,直到这次用户切换到"横扫斩"(基础射程技能,`RangeBonus=0`)且离敌人较远时才第一次踩中候选数量为 0 的边界。

**修法**:不是去改"越界回绕"本身的算法(那个算法对非空数组是对的,没必要动),而是在**消费这个可能为 None 的下标结果**的地方(`Array|Get` 之后、`SetLockIndicator` 之前)补一道 `Utilities|IsValid` 检查,`Is Not Valid` 时跳过这次调用——这是"生产端算法有盲区"和"消费端加保护"两种修法的取舍:生产端(越界回绕算法本身)要处理"数量为0"这个特例还得再套一层判断,不如在消费端一次性堵住"任何情况下都不能拿 None 去调用需要非空引用的函数"这个更通用的原则。

**教训**:
1. 写"下标越界回绕"类逻辑时,`回绕目标是否合法`本身也可能是假设——**默认"回绕到 0"这个决定隐含了"数组至少有一个元素"的前提,这个前提在写这段代码的当下可能顺理成章,但会随着上游数据源的变化(这里是"候选目标数量")在未来某个不显眼的场景下失效**,类似的"回绕/夹断到某个常量"写法,新增时应该多问一句"如果集合是空的,这个常量还合法吗"。
2. **这类 bug 的报错信息(`Accessed None ... CallFunc_Array_Get_Item_N`)指向的是消费端节点(`SetLockIndicator`),但真正的根因在更上游的生产端(越界回绕算法)**——排查"Accessed None"报错不能止步于报错信息里点名的那个节点,要往前追一步,找到"这个 None 到底是从哪个上游计算出来的",本次是靠反向读 `execute` 输入链路(`GetArrayItem`←`Array|Get`的Array参数←`GetTargetsInRange`,Dimension参数←`SetLockedTargetIndex`←`Select`←`>=`比较)一路溯源找到的。

### 坑78(自己踩自己写过的规矩,第二次):`IsCurrentSkillAoe` 把非纯函数 `IsAoeSkill` 直接嵌套进 `return` 表达式,exec pin 从未接上,函数恒定返回默认值(2026-08-30,阶段4 AOE 瞄准态排查到最后一环) #WriteGraphDSL #Exec不能嵌套 #坑34 #自己违反自己的规矩

**背景**:本轮阶段4排查(F1/Ctrl 快捷键→技能栏空白→`SetLockIndicator`刷屏,一路修下来)最后卡在:`OnAimPressed` 明确打出了 `RMB Pressed, entering`,紧接着却总是 `IsCurrentSkillAoe=FALSE`——即使技能栏显示选中的确实是 AOE 技能"横扫斩"。而 `IsCurrentSkillAoe` 当时的写法是:
```
(fn IsCurrentSkillAoe (Unit)
  (return (CallFunction|IsAoeSkill self (Combat|Loadout|GetSkillSlotName ...))))
```
直接读 `get_node_infos` 才发现:`IsAoeSkill`(内部是真实 if/elif 分支,带 exec pin,不是纯函数)这个 `CallFunction` 节点的 `execute` 输入完全没有连接——`FunctionEntry.then` 直接接到了 `FunctionResult.execute`,函数一进来就直接 Return,`IsAoeSkill` 从未真正跑过,它的 `ReturnValue` 停留在布尔默认值 `false`,导致 `IsCurrentSkillAoe` 恒定返回 `false`。

**这正是本文件硬规则第①条早就写明的坑34**("带 Exec 的自定义函数[非纯函数]不能当纯表达式嵌套调用,否则会被 prune[Exec pin is not connected],返回值变成默认空值")——本轮自己新写 `IsCurrentSkillAoe` 时又把同一个坑踩了一遍,而且这次的表现形式比坑34原始案例更隐蔽:**`compile_blueprint` 完全不报错**(嵌套调用在语法上合法,只是被静默剪掉了 exec 连接),`get_connected_subgraph`/`read_graph_dsl` 之前也没有专门去查过这一条(因为看起来"逻辑很短很简单,应该不会有问题"),直到有了用户实测的诊断信息(`IsCurrentSkillAoe=FALSE`)明确指向这个函数本身,才回头用 `get_node_infos` 逐 pin 核实,发现 `execute` 真的没接。

**修法**:改成显式 `bind` 落地成局部变量,再 `return` 那个变量:
```
(bind _result (CallFunction|IsAoeSkill _self _rowname))
(return _result)
```
`write_graph_dsl` 对已有内容的函数是追加不是替换(坑1),重写后用 `delete_node` 清掉了旧的、从未真正连通过的死节点。

**教训**:
1. **"函数体只有一行 `return`,逻辑看起来极简单"不能作为"不用查连线"的理由**——这次的 bug 恰恰藏在这行"看起来最简单"的代码里,`return` 表达式内部嵌套的函数调用是不是纯函数,是判断"要不要先 `bind`"的唯一标准,和这行代码写起来"顺不顺手"没关系。
2. **任何新写的、被其它已验证代码依赖的判断函数(哪怕只有一行),只要内部调用了自定义函数,写完就应该立刻 `get_connected_subgraph` 核实一遍,不能因为"逻辑短"就跳过这一步**——本轮 `OnAimPressed`/`RefreshAoePreview` 这类"看起来复杂"的函数反而每次都老老实实核对过连线,真正漏查的恰恰是这种"就一行,肯定没问题"的函数,以后不能按"复杂度"决定要不要验证,只按"是否嵌套了非纯函数调用"决定。

### 坑79:`get_connected_subgraph` 从 `FunctionEntry` 发起遍历,会把"数据上还挂着但 exec 早已断开"的死节点也收进结果里——判断一个节点"是否真的在跑",必须专门核对 Exec 类型 pin 的连通性,不能看它出不出现在 `get_connected_subgraph` 的返回列表里(2026-08-30,`ClearAoeHighlightsOnly`/`RefreshAoePreview` 补光标高亮时二次踩到坑1/66) #WriteGraphDSL #GetConnectedSubgraph #死节点 #Exec连通性

**背景**:坑78 修 `IsCurrentSkillAoe` 时已经发现过一次"`write_graph_dsl` 重写已有函数是追加不是替换,旧节点变成死节点但还留在图里"(坑1/66 的教训),这次给 `ClearAoeHighlightsOnly`(补充清除光标高亮)和 `RefreshAoePreview`(补充设置光标高亮)重写时又踩了一遍——而且这次因为函数体本身有 `ForEachLoop`/嵌套循环,`get_connected_subgraph` 返回的死节点数量更多(分别是 8 个和 17 个)、混在新链路里更不容易一眼看出来。**最容易踩的坑是:直接假设"`get_connected_subgraph(FunctionEntry)` 返回的所有节点 = 真正会执行的节点"**——这个假设是错的,`get_connected_subgraph` 会沿着**任何类型的 pin**(包括纯数据 pin)扩散,只要死节点和活节点共享哪怕一个数据来源(典型情况是 `FunctionEntry` 自己的参数输出 pin,同一个参数值同时喂给旧链路和新链路),死节点就会被一起收进结果,和"这个节点的 exec 链是否真的从 Entry 连过来"完全是两回事。

**验证方法**:光靠肉眼读 `get_connected_subgraph` 的大段 JSON 找不出死节点(本次两个函数分别有 44 和 8+17=25 个节点混在一起),改用小脚本精确核对——对每个节点,只看它 `type_id` 为 `Exec` 的那些 pin(`execute`/`then`/`LoopBody`/`Completed`/`Is Valid` 等),检查其 `IN`(输入)方向的 `connected_pins` 是否为空:**一个非事件入口节点,如果它所有 Exec 类型的输入 pin 都是空的,它就是死节点,不管它在数据层面和活节点共享了多少个来源**。本次是用 Python 脚本对着保存到本地文件的 JSON 结果做的这个筛选,比人工翻几十个节点的 JSON 靠谱得多。

**教训**:
1. **`write_graph_dsl` 重写一个已有内容的函数之后,"清点死节点"这一步不能省,而且节点数量会随着函数复杂度(循环层数、分支数)非线性增长**——简单函数(如 `IsCurrentSkillAoe`)死节点只有 5 个,凭经验也能一眼看出来;稍微复杂一点的函数(带嵌套 `ForEachLoop`)死节点能有十几二十个,必须借助脚本化的"看 Exec pin 连通性"筛查,不能再靠"读一遍 JSON 找不对劲的地方"这种人工方式。
2. **重写前先想清楚:这个函数是不是已经有内容**——如果是,`remove_function_graph`→`compile_blueprint`→`add_function_graph` 重建一遍是能从根源上避免这整类问题的做法(坑1 早就写了这个流程),这次两次(坑78、坑79)都是图省事直接对着已有内容的函数调 `write_graph_dsl`,省下的一步操作换来的是排查死节点的更多工作量,长期看不划算,以后只要确认函数"已有内容",一律先走重建流程,不要心存侥幸。

### 坑81:两个不同蓝图上都叫 `ForecastWidget` 的变量,指向两套完全不同的 Widget 类(`WBP_DamageForecast` vs `WBP_AttackForecast`),只看变量名字/文档描述完全分不出来,必须 `get_node_infos` 读变量取值节点的真实输出 `type_id` 才能确认(2026-08-30,攻击预测面板开发) #跨蓝图同名变量 #命名混淆 #GetNodeInfos必查

**背景**:实现"攻击前伤害预测面板"时,按之前规划(以为 `BP_GridManager.ForecastWidget` 就是要用的那个富文本面板)直接对 `Variables|Default|GetForecastWidget` 的结果调用 `Class|WBPAttackForecast|SetHpForecast`,`write_graph_dsl` 直接报错"Could not connect pin ForecastWidget to self. The pins may be incompatible types"——起初以为是自己哪里拼错了函数名,`get_node_infos` 读那个 `VariableGet` 节点的真实输出 pin 才发现它的 `type_id` 是 `"WBP Damage Forecast Object Reference"`,根本不是 `WBP_AttackForecast`。进一步排查发现项目里同时存在两套结构、命名都叫"预测/预报"的独立 Widget 系统:`BP_GridManager.ForecastWidget`(→`WBP_DamageForecast`,只有一个 `DamageText`,配套 `ShowDamageForecast`/`PredictDamage`/`PendingDefender`/`ConfirmPendingAttack`/`CancelPendingAttack`)和 `BP_TurnManager.ForecastWidget`(→`WBP_AttackForecast`,有 `Txt_HpInfo`/`Txt_AtkDmg`/`Txt_CounterDmg`/`Btn_Confirm`/`Btn_Cancel`,配套 `Class|BPTurnManager|ShowAttackForecast`/`CancelAttackForecast`)——两套变量名完全一样(`ForecastWidget`)、字段含义高度相似(都是"伤害预测+确认/取消"),分别挂在两个不同的蓝图上,是历史上两次独立、互不知情的尝试留下的产物,当前主流程(`PerformSkillAttack`)两套都不调用。

**教训**:
1. **`list_variables`/文档里的变量名相同,不代表引用的是同一个东西**——尤其是像"Forecast"/"Preview"/"Damage"这类通用词汇命名的变量,换一个蓝图查看前必须重新用 `get_node_infos` 核实一次真实的 `type_id`(对象引用类变量的 `type_id` 就是它的具体类名,比如 `"WBP Damage Forecast Object Reference"`),不能因为在 A 蓝图里查过一次、名字对得上就假设 B 蓝图里同名变量是同一个类。
2. **`write_graph_dsl`/`connect_pins` 报"Could not connect pin ... incompatible types"这类错误时,大概率不是语法错了,是对某个变量/函数的真实类型/归属蓝图有错误假设**——遇到这类报错,第一反应应该是 `get_node_infos` 读一下报错涉及的那个具体 pin 的真实 `type_id`,而不是反复检查 DSL 语法本身。
3. **项目里存在的"半成品/遗留系统"经常不止一份**——排查前不能只满足于"找到了一个看起来相关的系统就直接用",尤其是当它的字段结构和当前需求不完全吻合、或者归属的蓝图和预期不符时,应该多问一句"会不会还有另一份更合适的",用 `find_node_types` 搜关键词(这次搜 "AttackForecast" 才带出 `Class|WBPAttackForecast|Set*Forecast` 这一整套现成的、结构完全匹配需求的辅助函数)。

### 坑80:World Space 的 `WidgetComponent` 用硬编码固定旋转"手算"对齐镜头,只在视轴正中心精确,镜头一改构图/单位一偏离画面中心就畸变到肉眼不可见——血条(含骷髅标记)"完全看不见"排查了大半天才定位(2026-08-30) #WidgetComponent #WorldSpace #Screen Space #视角畸变 #镜头构图变更

**背景**:用户反馈"敌人血条旁边的骷髅还是没出现",一开始怀疑是骷髅本身的定位/可见性逻辑有问题(此前确实修过一次"定位在 WidgetComponent DrawSize 边界外导致被裁掉"的问题),但这次深入排查发现**问题比骷髅本身大得多——整条血条在正常游戏画面里都完全不可见,不是骷髅一个人的问题**。

**排查方法**(关键在于没有停留在"读属性看起来都对"就下结论,而是做了对照实验):
1. `get_properties` 核对 `HealthBarComponent`:`bVisible`/`bHiddenInGame`/`DrawSize`/`RelativeLocation`/挂载关系/`Space`/`GeometryMode` **全部正常**,单看属性完全找不出问题。
2. 关键一步:**临时把 `DrawSize` 和 `RelativeLocation.z` 都大幅放大**(`100x14`→`400x100`,`z=120`→`250`),重新截图对比——如果放大后仍然什么都看不见,说明是更底层的渲染管线问题(比如没真正 `RegisterComponent`);如果放大后能看到东西,哪怕形状不对,也证明"渲染管线是通的,只是原始尺寸/形态下观感等于不可见"。本次是后者:放大后看到一条**扭曲成波浪形的细线**,不是矩形。
3. 顺着"扭曲"这个线索查 `UserConstructionScript`:发现这个 World Space 面片(`GeometryMode=Plane`)的朝向是用 `Math|Transform|MakeTransform` **写死的固定 `Rotator` 字面量**,值是当初照着某个固定 `CameraActor` 的朝向手算出来的"镜面对称"值,让面片理论上"正对镜头"。

**根因**:World Space 的 `Plane` 类型 WidgetComponent 不会自动朝向摄像机(不是天然的 billboard),它的朝向就是它自己的 `RelativeRotation`(经过 attach chain 变换后的世界朝向)。如果这个朝向是**针对镜头当前朝向手算的一个常量**,那这个常量**只对"摄像机视线方向 = 摄像机标称朝前方向"这一种情况精确成立**——也就是只有站在视轴正中心的单位才会看到一个方方正正的血条。其它单位(镜头到该单位的真实视线方向,和摄像机标称朝前方向有夹角)看到的面片会以一定角度侧对镜头,夹角越大、视觉上越接近"看不见的一条线"(退化到极限就是完全侧对、宽度趋近于0)。这个设计缺陷从写下那行硬编码就存在,只是早期镜头离场景近、构图集中在中心附近,夹角小到不明显;08-29~08-30 的"全景机位构图修法"把镜头拉远/改了取景范围后,大多数单位不再处于视轴中心,夹角被放大,这个原本"凑合能用"的手算朝向就大概率失真到不可见——**是老设计缺陷被新的镜头改动放大暴露,不是这次 AOE 相关工作引入的新 bug**。

**修法**:不修朝向计算本身(继续手算+适配镜头是治标不治本,镜头以后再变还得重算),而是把 `WidgetComponent` 的 `Space` 从 `World` 改成 `Screen`——Screen Space 下组件只是把 `RelativeLocation` 对应的世界坐标投影成屏幕坐标,在该处画一个**天然永远正对镜头**的 2D 部件,`DrawSize` 语义也从"世界单位(cm)"变成"屏幕像素",不存在任何朝向/畸变问题,一劳永逸,以后镜头再怎么改都不用重新手算这个 Rotator。副作用:`DrawSize`/`RelativeLocation.z` 的合适取值在两种 Space 下完全不是一回事(像素 vs 世界单位、投影后视觉间距 vs 世界间距),切换 Space 后旧的数值经验不能照搬,要重新试出合适的值(这次是 `DrawSize (100,14)→(150,22)`,`z 120→40`)。

**教训**:
1. **World Space 的 `WidgetComponent` 默认不会自动朝向摄像机**——如果需求是"永远让玩家看得清、不用管镜头怎么摆",应该优先考虑 `Screen` Space,而不是手算一个固定朝向去"追"某一个特定镜头姿态;固定朝向只在"镜头姿态和单位相对位置都不再变"的强假设下成立,这个假设在一个会不断调镜头构图的项目里几乎注定会被打破。
2. **"读组件属性显示一切正常"不能排除"看起来不像 bug 的视觉表现问题"**——`bVisible=true`/`DrawSize` 数值本身没有任何异常,如果只满足于核对这些标量属性就下结论"配置没问题",会完全漏掉"朝向导致的视觉畸变"这类靠属性值本身看不出来、必须靠实际截图才能发现的问题。往极端方向"暴力放大关键数值再截图对比"是低成本区分"渲染管线没通"和"渲染管线通了但观感等于不可见"的有效手段。
3. **排查"某个东西应该出现在敌人身上但没出现"类反馈时,第一步应该先确认测试场景本身是否具备复现条件**——本次场上 4 个单位全是同一阵营(`side` 全部 `true`),压根没有可以显示"敌方骷髅标记"的敌人,如果一开始就查一下 `side` 属性分布,能更早排除"骷髅逻辑本身有没有 bug"这个方向,把精力集中到"血条本身为什么看不见"这个真正的大问题上。

### 坑82:`read_graph_dsl` 打印出来的节点标识和 `write_graph_dsl`/`find_node_types` 真正认识的创建字符串,在好几类节点上都对不上——补 AOE 回归断言时一次性踩了 4 种(2026-08-30) #WriteGraphDSL #ReadGraphDSL #命名不对称 #IsValid宏

**背景**:给 `RunRegressionTests` 补 T10i/T11 断言,先用 `read_graph_dsl` 读出完整现有内容再原样喂给 `write_graph_dsl`(避免坑1/66,走的是"整个函数删了重建"流程),结果**逐字照抄读出来的文本反而写不进去**,连续踩了 4 个不同的命名不对称:

1. `Class|GridSlot|GetRow`(对一个实际是 `BP_Tile`/`BP_Unit` 的对象取 Row)——真正能创建的是 `Class|BPTile|GetRow`/`Class|BPUnit|GetRow`,`read_graph_dsl` 把两种不同 self 类型的 `GetRow` 节点都打印成了同一个 `GridSlot` 前缀,单看打印文本完全看不出实际 self 类型是哪个,必须按上下文(这个变量的产生来源是 Tile 还是 Unit)自己判断该用哪个。
2. `|FindNearestUnit_0`(裸的、不带 category 前缀,还带了下划线)——真正能创建的是 `CallFunction|FindNearestUnit0`(**没有下划线**,`find_node_types` 一查便知)。
3. `Variables|Default|GetSnapColD`/`SetSnapColD`——这两个变量**根本不存在**(不在 `list_variables` 里,也搜不到对应 `find_node_types`),原函数删除重建后就跟着消失了——因为它们本来就不是类成员变量,只是旧版本图里两个孤立的局部值,`read_graph_dsl` 打印时给它们编了看着像成员变量存取器的名字。修法是老老实实用 `bind` 局部变量重新实现同样的"存一下再读"语义,不要迷信打印出来的名字一定对应一个可创建的节点。
4. `Variables|Default|GetbGameOver`/`SetbGameOver`——变量本体叫 `bGameOver`,但真正的存取器创建字符串是 `Variables|Default|GetGameOver`/`SetGameOver`(**去掉了 `b` 前缀**),`read_graph_dsl` 回显时又会**加回** `b` 前缀显示成 `GetbGameOver`。这是这几天第 N 次踩到"布尔变量的匈牙利记号前缀在存取器创建名里被去掉,但读图打印时又加回来"这个模式(参考坑73),这次首次在 `Variables|Default|Get/Set` 这一类节点上验证到同样的规律,不只是 `Class|X|GetY` 这类跨蓝图函数调用才有这个问题。

另外,`Class|BPUnit|SetHP` 的参数顺序是 `(HP:Int, self:BPUnit)`,不是直觉上的 `(self, value)`——任何"设置某个实例的某个字段"类节点,写之前都应该先 `get_node_type_pins` 确认参数顺序,不能凭做 Setter 的直觉猜。

**`Utilities|IsValid` 不能当纯表达式内联使用,哪怕看起来只是想要一个 bool**:`(not (Utilities|IsValid obj))` 这种写法会报 `Unreachable code after branch/return`——`IsValid` 在这套 DSL 里只有多出口(`"Is Valid"`/`"Is Not Valid"`)的宏形态,任何一次多出口节点调用都会终止当前的顺序执行流,后面所有语句必须写进某一个具体的出口分支里,不能指望它退化成一个能塞进表达式里的纯布尔值。判断"某个 Object 引用是否为 None"如果只需要在一个断言里用一次,只能整体用 `(Utilities|IsValid X (:"Is Valid" ... 剩下的所有语句 ...) (:"Is Not Valid" ... 剩下的所有语句复制一份 ...))` 的形态包住函数剩余部分(两个分支各自完整地把后续逻辑走一遍),没有更省事的写法;`==`/`!=` 也不能直接拿字面量 `None` 当右值(会报 `Undefined variable "None"`),这套 DSL 没有暴露空字面量。

**教训**:
1. **`read_graph_dsl` 是给人看的调试视图,不是"喂给 `write_graph_dsl` 保真回放"的序列化格式**——哪怕是"删掉整个函数重建"这种理论上最干净的流程,也不能假设读出来的文本能原样写回去,每一个不认识的 `type_id` 都要单独过一遍 `find_node_types`/`get_node_type_pins` 核实,尤其是变量存取器和跨类的同名方法。
2. **`write_graph_dsl` 遇到语法/连线错误时的实际行为需要谨慎验证**——本次一开始怀疑"报错前已创建的节点会残留、每次重试都在累加垃圾节点",专门做了一次"删除重建后只写一次干净版本"和之前多次重试版本的 `read_graph_dsl` 对比,发现两者结构一致,**证明这次的重试没有产生垃圾节点堆积**——但不能因此得出"`write_graph_dsl` 保证任何情况下都会失败原子回滚"的结论,只是这次具体场景恰好没暴露问题;不确定的时候,`remove_function_graph`→`compile_blueprint`→`add_function_graph` 重建一遍、只在确认所有节点名都对了之后再一次性 `write_graph_dsl` 写入,仍然是最保险的做法。

### 坑83:`CheckVictoryCondition` 检查的是**全场**是否还有敌方单位存活,不是"这次测试自己造的那几个敌人",导致"AOE 团灭触发胜负结算"这条断言在挂了 `bRunRegressionTestsOnBeginPlay` 的正常关卡里**永远无法可靠通过**——不是随机性假阳性,是测试设计本身和关卡真实开局状态冲突(2026-08-30) #RunRegressionTests #全局状态 #测试隔离性

**背景**:补 AOE 回归断言,原计划里有一条"AOE 一次团灭多个敌人时,`bGameOver` 应该被置 `true`(验证胜负结算不会因为多杀而重复弹窗)"。写好断言后连续跑了 4 轮 PIE:测试自己生成的两个假敌人(`SetHP` 强制设成 1,quake AOE 命中)确实都死了(`T11a`/`T11b` 在 RNG 配合的轮次里稳定 PASS),但"`bGameOver` 应该变成 `true`"这条(`T11c`)**每一轮都 FAIL,包括两个假敌人都确认死亡的那一轮**——排除了随机 MISS 的可能性(那种情况下失败模式应该是偶发,不会每次都失败在同一条断言上)。

**根因**:直接在 live PIE 里 `find_actors`+`get_properties` 核对了这张 `TestMap` 关卡在 `RunRegressionTests` 跑完之后场上所有 `BP_Unit`,发现除了测试脚本自己生成又销毁的临时单位之外,**这张关卡本身的正常开局流程会生成 4 个 `side=false` 的"敌方纹兽"单位,作为这次真实对局本该存在的敌人,从 `BeginPlay` 起就一直活着**。而 `CheckVictoryCondition()` 的判定逻辑是遍历 `GetAllActorsOfClass(BP_Unit)`**全场**所有单位、按 `Side` 分类,只要还有任何一个 `side=false` 的单位活着就判定"敌方还没输"——这个逻辑本身完全正确(它就应该看全局,不应该只看"某次攻击涉及的几个单位"),但意味着**任何只操纵自己临时生成的几个"假敌人"的局部测试,永远无法让"敌方全灭"这个全局条件成立**,因为关卡里那 4 个真实敌人根本没被这次测试的攻击波及。

**处理方式**:这条"`bGameOver` 会被正确置位"的断言在当前"挂在真实关卡 `BeginPlay`、和正常对局共享同一个世界状态"的测试架构下**没有可靠的写法**——要么接受"先摧毁全场所有真实敌人再测"这种对正常游玩会造成破坏性副作用的做法(测试本应该无害地嵌在正常开局流程里,不应该顺手团灭真实对局),要么放弃这条断言。选择了后者:**删除 `T11c` 这条断言,只保留 `T11a`/`T11b`(验证 AOE 确实能同时杀死命中列表里的多个单位,这条不依赖全局敌人数量,可以可靠验证)**。`CheckVictoryCondition` 里"多杀不重复弹窗"的保护本身(`if not bGameOver` 短路)已经通过直接读源码逻辑确认——它是一段没有任何异步/延迟的线性代码,`SetGameOver true` 和后续跳过检查在同一帧同步完成,结构上不可能出现"两次弹窗"的竞态,不需要也没办法靠这套集成测试框架去额外验证这一点。

**教训**:
1. **写涉及"全局胜负判定"这类跨越"当前测试临时数据"和"整个游戏世界状态"边界的断言之前,先确认这个判定函数的作用域到底是"局部"还是"全局"**——`CheckVictoryCondition` 名字和用途都暗示了"全局"(判定的是整场对局的胜负,不是某一次攻击的局部结果),这类函数的断言天然没法在"共享同一个正在跑的真实关卡"的测试环境里被局部数据完全左右,写断言前应该先问一句"这个函数关心的状态,我的测试能不能真的控制住全部输入"。
2. **一条断言反复在同一个位置 FAIL、且失败与否和"局部前提条件是否满足"无关,是"测试设计有结构性问题"的信号,不能默认套用"随机性假阳性,重跑即可"的老经验**——本项目已经有 T6a/T7b/T7c/T9 这几条公认的随机性假阳性,容易先入为主地把任何 FAIL 都归为"老毛病",这次是靠"局部前提(两个假敌人都死了)满足时断言依然 100% FAIL"这个反直觉现象,才倒逼着去核实全局状态,没有轻信"多跑几次总会过"。
3. **`RunRegressionTests` 目前是嵌在关卡真实 `BeginPlay` 流程里跑的(靠 `bRunRegressionTestsOnBeginPlay` 开关),不是一个独立、干净、可控的沙盒环境**——它天然要和"这张关卡这一局到底放了哪些单位"共享世界状态,以后新增任何涉及"数全场单位数量/存活状态"的断言,都要先想清楚这个耦合关系,不能假设测试脚本生成的单位就是场上仅有的单位。

### 坑84:固定机位下"屏幕方向↔逻辑坐标轴(Col/Row)"的映射不能凭直觉写,必须手算摄像机 Right/Up 向量;`for` 循环迭代变量上 `Class|GridSlot|GetRow` 会报"Could not connect pin"、需要换成 `Class|BPTile|GetRow`(2026-08-30,AOE 瞄准态 WASD 反向排查+蓝色射程高亮开发) #坐标系换算 #Camera #WriteGraphDSL #ReadGraphDSL #命名不对称

**背景**:用户反馈瞄准态下"按了鼠标右键后,wasd的方向和玩家面向不同,完全不知道怎么移动"。`MoveAimCursor` 的 W/A/S/D 字面量映射(`DeltaCol`/`DeltaRow`)从功能建立起就是 W=`(0,-1)`、S=`(0,+1)`,凭"数组行号越大越靠下"的直觉写的,完全没考虑这个项目用的是固定机位(`CameraActor`,`Pitch=-55,Yaw=90`),不是自由视角。

**手算方法(可复用)**:
1. 先实测棋盘坐标轴和世界坐标的对应关系——不要假设,直接读几个已知 `Col`/`Row` 的 `BP_Tile` 世界坐标反推:本项目是 `Col`→世界 X(`Col+1`→`X+100`)、`Row`→世界 Y(`Row+1`→`Y+100`),两者都是同号递增。
2. 再手算固定机位在这个朝向下,屏幕"右"/"上(远)"分别对应哪个世界方向——`Right=(sin(Yaw),-cos(Yaw),0)`(与 Pitch 无关,Pitch 只影响 Forward/Up,不影响 Right),`Up=Right×Forward`(叉乘顺序影响符号,先用 `Pitch=0` 的简单情况验证叉乘顺序对不对,水平机位时 `Up` 应该正好是 `(0,0,1)`,验证通过再代入真实 Pitch)。本项目算出来 `Right=(1,0,0)`(世界 +X)、`Up=(0,0.819,0.574)`(主要分量世界 +Y)。
3. 把"棋盘坐标轴↔世界方向"和"屏幕方向↔世界方向"两张表拼起来,就能推出"屏幕方向↔ `DeltaCol`/`DeltaRow`"——本项目结论是屏幕右=`Col+1`,屏幕"上/远"=`Row+1`。
4. 和现有 W/A/S/D 字面量比对:A/D(`Col∓1`)已经和推导结果一致,不用改;W/S(`Row`)的符号刚好反了,只需要把这两个键各自调用节点的 `DeltaRow` 字面量互换符号即可,不用碰 A/D 和 `MoveAimCursor` 函数体。

**这个方法论比"改一次测一次玩家感觉对不对"的试错法更可靠**,尤其是在 MCP 没有可靠按键模拟能力、只能靠静态推导+连线核对来交付、要等用户下一轮实测才能拿到最终确认的场景下——手算能在"根本没法真人测试"的情况下依然给出有几何依据的判断,不是纯猜。

**顺带踩的坑**:给 `ShowAimRange`(全新函数)/`RefreshAoePreview`(整体重建)写 `for` 循环时,照抄旧代码 `read_graph_dsl` 回显里的 `(Class|GridSlot|GetRow _array_element)`(在其它已编译多年的函数里,这个写法对 `BP_Tile` 类型的循环变量是能用的),结果在**新写**的 `for` 循环迭代变量上报错 `"Could not connect pin Array Element to self. The pins may be incompatible types."`——排查发现存在一个更直接对口的 `Class|BPTile|GetRow`(先 `find_node_types` 确认存在),换过去就正常编译。这是坑67/82"`read_graph_dsl` 回显文本和 `write_graph_dsl` 真正认识的创建字符串不对称"同一大类问题的又一次变体,新增的教训是:**这次连"换成哪个类名前缀"都需要重新用 `find_node_types` 试出来,不能假设"某个 type_id 字符串在旧代码里能用,新代码里换个位置(比如从 `Utilities|Array|Get` 的结果换成 `for` 循环的迭代变量)还照样能用"**——同一个显示名字背后可能对应不同的底层节点解析路径,上下文(数据来源是 `Array|Get` 还是 `for` 迭代变量)会影响哪个路径生效。

### 坑85:`write_graph_dsl` 里连续多次调用**同一个带 2 个以上 Bool 参数的自定义函数**,后续调用的字面量参数会错位/漏传;判定"参数到底传对了没有",只能用 `get_node_infos` 逐个读该调用节点自己的 pin 字面量,不能相信"我在 DSL 里就是这么写的" #WriteGraphDSL #参数错位 #BoolParam #运行时验证

**背景**:排查坑84"固定机位假设错了"那次修复(改成 `ComputeAimDelta(bForward,bPositive)` 实时算),需要在 PIE 里拿到真实运行时数据验证公式对不对(MCP 没有按键模拟能力,手算和连线核对都没法完全替代"真的跑一遍看数字对不对")。写了一个临时诊断函数 `TEMP_TestComputeAimDelta`,函数体里连续 4 次调用 `(CallFunction|ComputeAimDelta true true)`、`(CallFunction|ComputeAimDelta false false)`、`(CallFunction|ComputeAimDelta true false)`、`(CallFunction|ComputeAimDelta false true)`,分别对应 W/A/S/D 四个按键"应该"传的参数,配 `PrintString` 打印结果。`StartPIE` 拿到真实 log 后发现数字对不上手算预期,一度以为 `ComputeAimDelta` 函数体本身写错了。

**根因**:`get_node_infos` 逐个读这 4 个调用节点自己的 `bForward`/`bPositive` 字面量,发现和 DSL 源码写的完全不一致——W 那次调用(源码写 `true true`)实际节点上是 `bForward=true, bPositive=false`;S 那次调用(源码写 `true false`)实际是 `bForward=false, bPositive=false`;D 那次调用(源码写 `false true`)实际是 `bForward=true, bPositive=false`;只有 A 那次(源码写 `false false`,凑巧和"全部落空"的默认值一致)看起来是对的。规律是:**`bPositive` 这个 pin 在全部 4 次调用里都变成了 `false`,`bForward` 拿到的值反而是源码里那次调用"本该给 bPositive 的值"**——像是"同一个函数被连续调用多次"时,`write_graph_dsl` 对这批调用节点的参数字面量赋值出现了错位/串位,而不是简单的"忘记赋值"(忘记赋值该表现为全部落到该参数的默认值,不会呈现这种"跟错了别的参数值"的规律)。目前没有继续深挖 `write_graph_dsl` 内部具体是怎么错位的(不在这次任务范围内,且核心目标——验证 `ComputeAimDelta` 本身正确性——已经用交叉验证的办法达成,见下)。

**如何确认这不是`ComputeAimDelta`自己的bug**:虽然诊断函数传参传错了,但只要知道"这次调用实际收到的是哪一组 `(bForward,bPositive)`"(通过 `get_node_infos` 读出来的真实值,不是源码写的值),再手算这组真实参数"应该"算出什么 `(DeltaCol,DeltaRow)`,和 log 里打印出来的实际结果逐一比对——**四组全部精确吻合**。这说明 `ComputeAimDelta` 函数体内部的公式和连线本身完全正确,错的只是诊断脚本"怎么把参数传进去"这一层,两者是完全独立的问题,不能因为最终数字和"我以为传的参数"对不上就误判成函数体本身写错了。

**教训**:
1. **`write_graph_dsl` 里如果要连续多次调用同一个自定义函数(尤其是带多个同类型参数,比如两个 Bool),不能只信源码写的字面量,调完必须逐个 `get_node_infos` 读每一个调用节点自己的参数 pin,确认真实收到的值和源码写的一致**——这次的错位现象在 `compile_blueprint` 阶段完全没有任何报错或警告,是彻头彻尾的静默参数错位,不核实就会得出完全错误的排查结论(一度怀疑函数体本身错了)。
2. **对"真正会被正式使用"的关键调用点(比如这次的 91-94 号 `ComputeAimDelta` 调用,W/A/S/D 四个按键实际接的那几个),干脆别赌 `write_graph_dsl` 的位置参数写法,改用 `create_node` 建空节点 + `set_pin_value` 显式挨个设置每一个字面量参数**——这种方式每一步都是独立的、可以单独核实的 API 调用,不存在"一次性写一大段 DSL,内部某个参数悄悄错位却整体不报错"这类批量操作特有的风险,这次实际交付用的 91-94 号节点就是用这种方式做的,已经二次核实过完全正确,和诊断函数用 `write_graph_dsl` 踩的坑是两回事。
3. **诊断代码本身出 bug 是完全可能的,不能默认"我是为了验证而写的辅助代码,所以它一定是对的"**——花时间交叉核对"诊断代码实际做了什么"和"被测代码算出了什么",能把两类独立的错误(诊断代码的错 vs 被测代码的错)分开,避免把诊断代码自己的问题误判成被测代码的问题(或者反过来,放过被测代码里真正存在的问题)。

### 坑86:在 Linux/云端写的 Python 工具脚本,拿到本机 Windows 一跑就崩(cp1252),这是坑的**第二次**复发 #编码 #Windows #跨环境 #工具链

**现象**:`ue/tools/paste_gen.py`(粘贴块生成器)在本机执行 `python3 ue/tools/paste_gen.py calc_damage`,直接抛 `UnicodeEncodeError: 'charmap' codec can't encode characters`,连 `--help` 都打不出来——因为帮助文本和节点注释里有中文。

**根因**:Windows 上 `python3` 的 `sys.stdout`/`sys.stderr` 默认编码是 **cp1252**,写中文直接抛异常。这个脚本写于 Cursor Cloud 的 Linux 环境(默认 UTF-8),在那边跑得好好的,**跨到 Windows 才暴露**。

**这已经是同一个坑的第二次**:`UE协作Harness规范.md` 1.5 节记录过 `.claude/hooks/*.py` 三个脚本全部踩过并修掉,规范原话是"**以后再加同类 hook 脚本记得照抄这一步,别重新掉进去**"。当时那句话的作用域写窄了(只说了 hook 脚本),没覆盖到"工具脚本"。

**修法**(照抄 hooks 的写法,加在 import 之后):
```python
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass
```
`stdin` 也要读中文的话一并加上。用 `try/except` 包住是因为 `reconfigure` 在某些被重定向/包装过的流上不存在。

**扩大后的规则(取代 1.5 节那句窄版)**:**这个项目里任何会输出中文的 Python 脚本,不管是 hook、工具、还是临时诊断脚本,开头一律先 `reconfigure(encoding="utf-8")`。**

**顺带一提,同一轮里我自己又踩了第三次**:写了个临时的 `python3 - <<'PY'` 脚本做文本批量替换,末尾 `print()` 中文进度又崩了一次(文件替换本身已经写成功,只有打印失败)。说明这个坑对"随手写的一次性脚本"同样成立,不能因为"就跑一次"就省掉这三行。
