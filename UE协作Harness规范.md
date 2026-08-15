# UE 蓝图协作 Harness 规范

> **任何接手这个 UE 部分的 agent,先读这一份。** 这里定义了协作协议本身,不是某个具体功能的进度——具体进度看 `UE实操教程.md` 的续接区。

---

## 0. 为什么需要这套规范

**2026-08-13 更新:MCP 实时连接已打通并验证可用,协作方式发生了根本变化,见第 0.1 节。以下是历史背景,仍有参考价值(尤其是"返工率"这个核心矛盾,MCP 只是换了一种方式解决它)。**

历史上 UE 的 Blueprint 是编译过的二进制 `.uasset`,agent 没有直接读写权限,也没有 Python/Remote Control 之类的实时连接。唯一的交互通道是:**agent 生成 UE 编辑器剪贴板文本 → 人类 Ctrl+V 粘贴/手动操作 → 人类把结果(报错/截图/回传文本)发回来**。

这个通道的特点是:每一轮交互都很贵(人要动手、agent 要处理大段结构化文本),而且容易因为 agent 猜错细节(函数名、pin 类型)导致返工。这套规范就是为了压低返工率和每轮信息量。

### 0.1 现状:MCP 实时连接(主通道)

项目从 UE 5.8 起自带官方 "Unreal MCP" 插件,已在 `MyProject 5.8` 里启用(`ModelContextProtocol` + `AllToolsets`),编辑器开着时自动在 `http://127.0.0.1:8000/mcp` 起 HTTP server,Claude Code 通过项目根目录的 `.mcp.json` 自动发现并连接,工具以 `mcp__unreal-mcp__*` 出现(可能是 deferred 工具,先用 `ToolSearch` 加载)。

**已验证可用的能力**(2026-08-13,`mcp-ue-linked-patterson.md` plan 步骤6/7):
- **读**:`SceneTools.find_actors`/`get_current_level` 读关卡里的 actor 列表;`ObjectTools.get_properties`/`get_class`/`list_properties` 读变量值、Class Defaults、CDO(注意 Class 本身的 refPath 读不到实例属性,要用 `Default__<ClassName>` 这个 CDO 路径)。
- **写**:`SceneTools.add_to_scene_from_class`/`remove_from_scene` 增删 actor;`AssetTools.save_assets` 落盘。写操作会立刻反映在 `.umap`/`.uasset` 二进制文件里,能被 git 捕捉到。

**2026-08-13 追加验证:`BlueprintTools` 图级别编辑已验证可用**(修复 `BP_Tile` 的 `Set SelectedUnit` 断线 bug,见 `UE蓝图状态.md`)。完整链路:`list_graphs` 定位图 → `read_graph_dsl` 看整体结构(排查用)→ `find_nodes(title=...)` 按标题定位具体节点 → `get_node_infos` 读节点的输入/输出 pin 明细(哪些接了、接到哪、类型是什么)→ `connect_pins(output_pin, input_pin)` 接线 → `compile_blueprint` 编译验证(失败会直接抛出报错文本,成功返回 null)→ `save_assets` 落盘。**结论:小范围、定位明确的图编辑(接一根线、改一个节点)可以直接走 MCP,不必再退回剪贴板协议**;但大范围新增节点/重构 Function 内部逻辑仍建议走剪贴板协议(`ue-blueprint-paste-gen` skill 生成的粘贴块经过连线完整性校验,MCP 这条路径目前没有等价的"整体校验"能力,节点越多手工逐个接线出错概率越高)。

**2026-08-15 追加**:`BlueprintTools` 实际比本节原先记录的丰富得多——除 `find_nodes`/`get_node_infos`/`connect_pins`/`compile_blueprint` 外,还有 `read_graph_dsl`/`write_graph_dsl`(S-表达式 DSL,整图读写,配 `get_graph_dsl_docs` 查语法)、`create_node`/`break_pins`/`find_node_types`/`get_node_type_pins`/`add_function_graph`/`add_function_param` 等。经本轮实测(新建 `BP_GridManager.IsTileOccupied` 函数并接入 `ShowRange`):**全新 Function 直接用 `write_graph_dsl` 整体生成可靠;修改现有、内部含 Macro 节点(如 `ForEachLoop`)的 Function 不要把 `read_graph_dsl` 的文本直接回写**(反编译对 Macro 内部逻辑可能失真),改用 `create_node`+`connect_pins`+`break_pins` 只新增/改动目标节点——本质上还是"小范围定位明确的改动"这条准则,只是现在"小范围"里已经能包含"新增几个节点、插入一段 exec 链路"这种量级,不必再退回剪贴板协议。踩坑细节见 `UE节点备忘录.md` 的"MCP `BlueprintTools` 实测细节"一节。

**写之前主动查编译状态**:`.uasset` 自上次 git 提交起字节没变,不代表它是"健康"的——蓝图编译校验只在被触发重新编译时才跑(`load_level`、Play、或显式 `compile_blueprint`),错误可能潜伏很久不暴露。新会话接手或做任何改动前,建议先对相关蓝图跑一遍 `compile_blueprint` 确认现状干净,不要假设"没 diff = 没问题"。

**MCP 写操作的安全习惯**(比剪贴板+人工审查风险更高,因为没有人在中间审一遍):
1. 写之前 `git status` 确认工作区干净。
2. 写之后 `git status`/`git diff --stat` 确认改动范围符合预期。
3. **⚠ `.uasset`/`.umap` 是二进制,每次保存都会带一点嵌入元数据(GUID/时间戳类),哪怕逻辑内容完全没变,重新保存后 `git diff` 也不会是空的**——不要因为看到"有 diff"就怀疑改动没生效或没撤销干净。要精确撤销用 `git checkout -- <path>`,不要指望"删除测试内容再保存"能让 diff 自动归零。
4. 改完不确定是否要保留的探索性改动,一律 `git checkout` 撤销,不要留在工作区"以后再说"。

### 0.2 剪贴板粘贴协议(fallback)

以下场景仍然用剪贴板协议:
- 编辑器没开着,或 MCP server 没启动(`ModelContextProtocol.StartServer` 手动起)。
- Blueprint 图逻辑的**大范围新增/重构**(一次要加好几个节点、搭一整条新链路)——`ue-blueprint-paste-gen` skill 生成的粘贴块有连线完整性自动校验,MCP 逐个 `connect_pins` 手工接线在节点多的时候出错概率更高、没有等价的整体校验。小范围改动(接一根线、查/改单个节点)直接走 MCP,见 0.1 节。

流程和原则不变(见第 2、3 节)。

---

## 1. 文档地图

都在 `纹兽战记/` 目录下,与本文件同级:

| 文件 | 作用 | 更新频率 |
|---|---|---|
| `UE实操教程.md` | 总体教程+进度追踪,顶部"续接区"是新会话的入口 | 每完成一个切片步骤 |
| `UE蓝图状态.md` | 每个蓝图的变量/函数/GUID/EventGraph 结构快照 | **每次改动蓝图后** |
| `UE节点备忘录.md` | 踩过的坑 + 验证过能用的 FunctionReference 清单 | 每次踩到新坑 |
| `UE测试用例.md` | 功能验收清单(PASS/FAIL) | 每次新增/验证功能 |
| `UE协作Harness规范.md` | 本文件,协议本身 | 协议变化时 |
| `UE美术管线.md` / `UE过场动画管线.md` | 美术/动画相关的独立手册,和蓝图协作无关 | 按需 |

---

## 2. 新会话接手流程

0. **先确认 MCP 是否连着**:看工具列表里有没有 `mcp__unreal-mcp__*`(可能要先 `ToolSearch`),或直接试调 `list_toolsets`。连得上就走 0.1 节的 MCP 通道,连不上(编辑器没开/server 没起)就走 0.2 节的剪贴板 fallback,不要假设。
1. 读 `UE实操教程.md` 的续接区 —— 知道整体做到第几步。
2. 读 `UE蓝图状态.md` —— 知道现有蓝图的变量/函数/GUID,**不要求用户重新粘贴现状**。
3. 生成任何粘贴块之前,先扫一眼 `UE节点备忘录.md` —— 避免重犯已知错误(函数名、pin 写法等)。
4. 看 `UE测试用例.md` —— 知道哪些功能已验证、哪些还没测。
5. 只有当文档信息不足以判断问题时,才要求用户提供当前蓝图的实际粘贴文本(且只要相关节点,不要整图,见第4条原则)。

---

## 3. 核心原则(8条)

1. **状态靠文件,不靠聊天记录**。每次开始工作先读文档,不为了"保险"让用户重新粘贴一遍现状。
2. **复杂逻辑做成独立 Function**,不要在 EventGraph 里见招拆招打补丁。Function 出错时整体重新生成替换;EventGraph patch 出错时需要逐线诊断,成本高得多。
3. **反馈按需索取**:默认只要"新增节点+其直接邻居"回传,不要整张 EventGraph。只有怀疑有旧节点/其他逻辑冲突时才升级为整图回传。
4. **生成粘贴块前查备忘录**,别对函数名/pin 类型现猜——猜错的代价是节点被静默丢弃或编译报错,通常要再来一整轮才能发现。
   - **生成粘贴块一律走 `ue-blueprint-paste-gen` skill**:写 Python 脚本 + pin 注册表模式生成文本,生成后自动校验所有连线完整性,再交付给用户,不要手写大段 K2Node 文本。这条规则是从多轮"连线看着对、实际类型没解析上"的返工里总结出来的,是硬性要求,不是建议。
5. **每次改动后立刻更新配套文档**(状态、备忘录、测试用例),不要攒到"以后一起补"——攒着就等于下个会话/压缩后要重新推导一遍。
6. **验证要有明确 PASS/FAIL 口径**,不接受"应该可以了"这种模糊结论。标记任务完成前,必须对照 `UE测试用例.md` 里的相关项全部确认。
7. **人类只做机械动作**:粘贴、Compile、Play 测试、按清单报 PASS/FAIL、遇到报错整段贴回来。所有判断性工作(为什么错、怎么修、下一步做什么)由 agent 做,不要把判断丢给人类。
8. **每轮结束前自检**:这次改动是否让状态文档过期了?过期立刻同步更新,不要拖延。

---

## 4. 已知硬限制(2026-08-13 更新)

- ~~不能直接读写 `.uasset`~~ / ~~没有 Python/Remote Control 之类的实时连接~~ —— **已过时**,MCP 连接打通后这两条不再成立,见第 0.1 节。
- 仍然成立的限制:
  - `.uasset`/`.umap` 是二进制,直接文本 diff/review 看不出实质内容变了什么,只能靠 `UE蓝图状态.md` 这类结构化快照 + 编辑器里 Play 测试来验证语义正确性。
  - Blueprint 图逻辑(EventGraph/Function 内部)的直接 MCP 编辑路径(`BlueprintTools`)**小范围改动已验证可用**(接线、改单个节点);大范围新增/重构仍建议走剪贴板协议,见第 0.1/0.2 节。
  - MCP server 只认本机连接(`127.0.0.1:8000`,无鉴权),编辑器必须开着、server 必须在跑,否则自动回落到剪贴板协议。
- 剪贴板文本的技术细节(哪些字段必须写、常见坑)记录在 `UE节点备忘录.md`,不在本文件重复。
