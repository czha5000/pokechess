# UE 硬规则速查表(必读)

> **这是做 UE 工作前唯一必读的坑相关文档。** 全部 86 条踩坑记录的纯结论提炼,去掉了案例背景和排查过程。
>
> 需要某条的完整排查过程时,按括号里的"(见坑XX)"到 `UE节点备忘录.md` 里 grep 那个编号——那份文件是**案例档案,按需查,不必通读**(261KB)。
>
> 拆分原因:此前 `UE节点备忘录.md`(289KB)+ `UE蓝图状态.md`(253KB)= 542KB 被列为每次会话必读,实际必然退化成"只读最近几节 + grep",而这正是 harness 想防止的失败模式。拆分后必读量降到约 130KB(实测,原 542KB 的 24%)。详见 `工程评估报告.md` 第五节。
>
> **新踩的坑**:完整记录仍然写进 `UE节点备忘录.md`(保持编号连续),但如果它能提炼成一条通用规则,**同时**在这里加一行结论 + `(见坑XX)`。

---

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
