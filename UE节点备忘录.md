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
| Engine.KismetMathLibrary | Conv_IntToFloat | Step5b CalcDamage 用(粘贴块已生成,**编辑器内尚未实测**) |
| Engine.KismetMathLibrary | Multiply_FloatFloat / Add_FloatFloat / Divide_FloatFloat | 同上,待实测 |
| Engine.KismetMathLibrary | Round | float→int 四舍五入;若粘贴后节点静默消失,手搜 Round 重建 |
| (自身蓝图函数) | K2_DestroyActor | `FunctionReference=(MemberName="K2_DestroyActor",bSelfContext=True)`,self pin 类型填 `/Script/CoreUObject.Class'/Script/Engine.Actor'` 即可,子类自动兼容,不用精确到具体蓝图类 |

## Cloud 环境补充(2026-08-16)

- 原 `ue-blueprint-paste-gen` skill **不在** Cloud Agent 技能列表里;仓库内替代:`ue/tools/paste_gen.py`(pin 注册表 + LinkedTo 校验)→ 输出 `ue/paste/*.txt`。
- Unreal MCP 只绑本机 `127.0.0.1:8000`,Cloud VM 无法直连;大图改动继续剪贴板/人工,小改动等你本机开着编辑器再走 MCP。

## 已知踩过的坑(不要重犯)

- ❌ `Max_IntInt` 不存在 → 用 `Max`
- ❌ InputKey 节点手写 `InputKey=(KeyName="N",...)` 的 FKey struct 格式经常被拒(编译警告 invalid FKey)→ 生成节点后让用户在编辑器下拉里手动选键,别硬凑格式
- ❌ VariableGet/VariableSet 读取非 self 变量时三件套漏写 → 见上面规则2
- ❌ **手写大段粘贴文本时,连线用"字段名简写"而不是"完整符号 key"去查 GUID,会导致连线全部指向随机生成的、不存在的 GUID,且不会立刻报错**——本轮真实踩过:脚本里 `nodekey, pinkey = other` 把一个 `(节点key, 字段key)` 元组拆开后只用字段名去查 pin 表,结果连线全错。**教训:生成脚本必须做"每条 LinkedTo 引用的 PinId 都能在声明集合里找到"的自动校验,校验不过不能发给用户。**
- ❌ **手动补线清单里,"目标不是 self 的操作型函数"(比如 `K2_DestroyActor`)的 Target pin 极易漏接**——这类 pin 是可见的(`bHidden=False`)但没有强制报错提示,漏接后不报编译错误,只在运行时才暴露,而且后果可能很严重(本轮漏接 `Destroy.Target→Defender`,运行时误删了 `GridManager` 本体,导致地图彻底失效,报错信息还完全指向别的地方,排查绕了好几轮)。**教训:交付"剩余手动连线清单"时,但凡涉及 `DestroyActor`/`SetActorLocation` 这类"对某个目标对象做破坏性操作"的函数,要单独加粗提醒用户优先检查,而不是和其他连线混在一条列表里等同优先级。**

- ❌ **视觉位置(世界坐标/SetActorLocation)和逻辑位置(自定义 Col/Row 整数变量)是两套独立数据,UE 不会自动同步**——本轮真实踩过两次:`SpawnUnit` 只把新单位摆到了正确的世界坐标,从没 `Set Col`/`Set Row`;`BP_Tile` 的移动逻辑只做了 `SetActorLocation`,同样没更新 `SelectedUnit.Col/Row`。表现是"单位看起来在正确位置,但所有基于 Col/Row 的逻辑判断(比如曼哈顿距离)全部失效",而且不报任何错误,只能靠打印实际数值才能发现。**教训:任何"挪动/生成一个用逻辑坐标系统追踪位置的 Actor"的地方,都要显式检查——有没有在改视觉坐标的同时,也把逻辑坐标（自定义 Col/Row 这类变量）同步写掉,不能想当然认为"位置对了"就等于"坐标对了"。**

## 生成粘贴块的标准流程(已固化为 skill)

从这一轮开始,**所有粘贴块生成都走 `ue-blueprint-paste-gen` 这个 skill**,核心是:写 Python 脚本 + pin 注册表模式生成文本(而不是手打)→ 生成后自动校验连线完整性 → 大文本写成 txt 文件交付,不直接堆进聊天。细节见 skill 内容,这里不重复。

## 请求用户回传时的省 token 原则

- **默认不要求整张 EventGraph** —— 只要新加的那几个节点 + 它们连接的邻居节点。整图回传只在"怀疑有旧节点/其他事件干扰"时才要。
- 复杂改动优先做成**独立 Function**(像 ShowRange/StartTurn/EndTurn),而不是往 EventGraph 里加分支——Function 出错时可以整体重新生成替换,不需要连蒙带猜patch。
