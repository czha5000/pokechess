---
name: wenshou-ue-add-animation
description: 纹兽战记 UE 项目里给 BP_Unit(或同类 Character 蓝图)新增/替换 Mixamo 动画的标准流程,含骨骼网格迁移、动画状态机接线、以及"朝向/方向不对"这类最容易踩坑的验收方法。当需要给角色加新动作(新技能动画、新状态动画、换新模型)或排查"动画方向/朝向不对"时使用。
---

# 纹兽战记 · UE 新增动画接入流程

> 背景:2026-08-29 那一轮"骨骼网格迁移 + 动画状态机 + moonwalk 朝向修复"暴露了这类工作最容易反复踩的坑——本 skill 把流程和验收方法固化下来,下次加新动作/换新模型直接照走,不要凭记忆重新摸索。踩坑细节见 `UE节点备忘录.md` 坑62/63/64;当前 `BP_Unit` 的动画系统状态快照见 `UE蓝图状态.md`"骨骼网格迁移"一节。

## 什么时候用这个 skill

- 给角色加一个新的 Mixamo 动作(新技能动画、新状态动画,比如"闪避""昏迷")。
- 整体换模型/骨骼网格(比如从占位模型换成正式美术资源)。
- 排查"角色动画播的是对的,但看起来方向/朝向不对"这类问题。

## 第一步:导入动画资产

1. Mixamo 下载的 FBX 用 `SkeletalMeshTools.import_file` 导入,`skeleton` 参数传现有骨骼网格的 Skeleton(保证共用骨骼,不要每次都建新 Skeleton)。
2. 每个动画 FBX 导入后除了 `AnimSequence`,通常会**顺带产生一份重复的 SkeletalMesh 副本**(FBX 自带的网格数据)——这份副本用不上,`get_referencers` 确认零引用后直接删除,不要留着堆积。
3. 只需要 `import_animations=True`,不需要重复 `import_materials`/`import_textures`(共用已导入模型的材质)。

## 第二步:加变量 + 接入播放逻辑

1. 新变量类型统一用 `AnimationAsset`(不要用更窄的 `AnimSequence`,免得以后想换成 Montage/BlendSpace 要改类型)。
2. 状态类动作(Idle/Walk 这种循环、Tick 驱动切换的)接进 `UpdateLocomotionAnim` 这类"目标变了才 Play"的函数,写法固定是:
   ```
   (if (Utilities|NotEqual(Object) target current)
     (Variables|Default|SetCurrentXxx target)
     (Components|Animation|PlayAnimation mesh target true/false))
   ```
   **这两条语句是顺序执行,不是 if/else 两个分支**——`read_graph_dsl` 打印出来容易被误读成互斥分支,不是,别看错了就去"修"一个根本没有 bug 的函数(见坑64 教训)。
3. 一次性动作(攻击/受击/死亡)接的是"播放 + 定时器回调结束"模式,不要用 `Delay`(Function 图不允许 latent 节点,只有 EventGraph/Macro 能用):
   ```
   Set bIsActionPlaying=true → PlayAnimation(bLooping=false)
     → SetTimerbyFunctionName(Time=Animation|GetPlayLength(该动作), Function="EndActionAnim或专用回调")
   ```
   `bIsActionPlaying=true` 期间,locomotion 状态机(`UpdateLocomotionAnim`)要在函数入口就 `if (not bIsActionPlaying)` 整体跳过,不能被一次性动作打断。

## 第三步:验收——这是本轮最容易出错、也是最该重视的部分

### 3.1 先确认真的在 PIE 里,而且测的是正确的单位

- 任何要读 live 状态之前,先 `EditorAppToolset.IsPIERunning()` 确认 `true`——**不要相信"我记得之前 StartPIE 过"**,长会话/上下文压缩后 PIE 可能已经结束了,`find_actors` 还是能返回看着正常的 `UEDPIE_0_...` 路径,但对它调用任何 `get_properties`/`get_actor_transform` 都会报 "not valid",报错信息不会提示真正原因(坑62)。
- 想知道"当前操控的是哪个单位",读 `BP_TurnManager.currentIndex`/`turnOrder[currentIndex]`,不要拍脑袋挑 actor 数组第 0 个。

### 3.2 不要用 `AnimationData` 属性判断"现在在播什么"

`SkeletalMeshComponent.AnimationData` 只是组件初始化/序列化时的静态配置缓存,运行时 `PlayAnimation()` 调用**不会**回写它——不管游戏里实际切换过多少次动作,读出来的永远是这个组件刚注册那一刻的值。想确认"现在真的在播哪个动作",只能靠:
- 自建的追踪变量(比如 `CurrentLocoAnim`),前提是已经核实过赋值时机/调用链路正确;
- 直接截图/人工肉眼确认视觉效果。

不要把 `AnimationData` 当"运行时状态查询接口"用,会得出完全误导的结论(坑63)。

### 3.3 排查"方向/朝向不对",第一步先分清楚是哪一类

用户说"动画方向不对"时,背后可能是两类完全不同的 bug,**修法互斥,治错一个不会顺带治好另一个**:

| 症状 | 真正的问题 | 修法 |
|---|---|---|
| "该往前走的时候放了往后走的那份动作数据"——但角色朝向本身是对的 | Clip 选择/资产引用接反了(比如 `WalkForwardAnim`/`WalkBackwardAnim` 两个变量的默认值被接反) | 检查/修正对应的 `AnimationAsset` 变量引用 |
| "不管放哪份动作,角色身体朝向都和实际移动方向对不上,像在倒退着走(moonwalk)/侧着走(螃蟹步)" | 模型挂载朝向补偿值(`SkeletalMeshComponent.RelativeRotation`)本身偏了固定角度,和播放哪份动作无关 | 调整 `RelativeRotation.Yaw`(常见是差了 90 度倍数,尤其是 180 度) |

**先做一次排除实验**:把疑似接反的两个动画变量互相 swap 一下,如果现象完全没变化,说明不是 clip 选错,直接跳到"模型朝向补偿值"这个方向,不要在同一个方向反复试。

### 3.4 校准/验证朝向补偿值的方法(按可靠程度排序)

1. **最快、最可靠:直接问正在玩游戏的人**。截图/渲染质量不够、姿势本身不够有方向性时,靠自己反复截图猜前后很容易两个方向看着都"过得去"(90 和 270 这种相差 180 度的值,在光照平淡的静止姿势下经常分不出来)。与其自己来回切换角度截图五六轮,不如用 `AskUserQuestion` 直接问一句"是背对着移动方向走、侧对着走、还是转圈"——一次性拿到确定性答案。
2. **编辑器里的可控测试**:`SceneTools.add_to_scene_from_class` 生成一个临时测试 actor(不影响正式关卡,验证完 `remove_from_scene` 删掉),强制设置它的 `CharacterMesh0.AnimationData`(`savedPosition` 设成非 0,取一个有代表性的动作中间帧,不要用静止 Idle 姿势——前后不对称的姿势更容易看出朝向差异),配合 `EditorAppToolset.CaptureViewport` 显式传 `captureTransform`(**这个参数哪怕想用默认值,也必须传完整的 `{location,rotation,scale}` 结构,传 `{}` 或不传都会报错或被当成字面量零变换,不是"沿用当前视口相机"**)从不同角度截图,对照 `Arrow` gizmo(胶囊体真实 forward 方向的 ground truth)判断模型朝向。这个方法在光照/渲染质量足够、姿势足够不对称时才可靠,不够的话直接跳回方法1。
3. **不可靠,不要用**:`SkeletalMeshComponent.AnimationData` 反射读值(见 3.2)、`CaptureViewport` 在 PIE 运行期间截图(拍到的是 PIE 自己的实时游戏摄像机,`captureTransform` 覆盖参数不生效,想控制机位必须停 PIE 在编辑器静态场景里测)。

### 3.5 改了朝向之后,记得检查有没有需要撤销的"误诊补丁"

如果排查过程中先按"clip 选错"的假设做过 swap(3.3 表格第一行的修法),等确认真正问题是朝向补偿值之后,**要把这次 swap 撤销**,不要留着——朝向修好后如果 clip 还是反的,会变成"朝向对了,但该迈右脚时在迈左脚"这个新的复合问题,比原来更难发现。

## 相关文档

- 完整踩坑记录:`UE节点备忘录.md` 坑62(PIE 状态确认)/坑63(`AnimationData` 死胡同)/坑64(moonwalk 完整排查过程)。
- 当前 `BP_Unit` 动画系统的变量/函数/Transform 快照:`UE蓝图状态.md`"2026-08-29 骨骼网格迁移"一节。
- 协作规范(何时要同步这几份文档):`UE协作Harness规范.md`。
