# 纹兽战记 · 四足 3D 动画管线(实验本)

路卡利欧 v1 使用单一状态单：[当前阶段、批准与产物](output/lucario/v1/STATUS.md)。

## 卡比兽 v1 七动作与正常速度预览完成（最新）

用户同意图像服务四视图生成失败后，按三张输入直接Blender建模，再从模型渲染四视图，并以“ok”批准模型。静态源：`output/snorlax/v1/snorlax_v1_static_review.blend`；四视图：`output/snorlax/v1/renders/snorlax_v1_four_view_board.png`。高1.30m，29,222求值顶点、5材质。最新绑定源：`output/snorlax/v1/rigging/snorlax_v1_rigged.blend`，17骨（14变形），0动作；六个静态诊断姿势见 `rigging/renders/snorlax_v1_static_pose_board.png`，权重及接地结果见 `rigging/validation_rigging.json`。这些是绑定诊断，不是动画全帧验收。角色卡`snorlax_v1_character_card.md`，验收`output/snorlax/v1/acceptance.md`。动画意图方案A见 `output/snorlax/v1/ANIMATION_INTENT.md`，用户已另行回复“ok”批准全部七动作，最新动画源为 `output/snorlax/v1/animation/snorlax_v1_animated.blend`；正常速度总览 `output/snorlax/v1/animation/videos/Snorlax_All_Actions_30fps.mp4`（28.40秒，30fps，循环各两遍），同目录含七个单动作MP4。615帧采样检查完成，主代理关键姿势审阅及总览完整解码通过，最终观感待用户观看。无FBX、无UE。

**新角色工作顺序**：你提供1–2张参考图 → 生成正/左/右/背四视图 → 制作模型并审阅 → 模型确认后绑骨 → 简述动作意图，等你批准 → 制作动画并展示正常速度视频。动画制作前必须记录方案批准；不默认导出FBX或接入UE。适用于双足和四足，按实际体态选骨架。

> **长期范围（2026-09-12 用户确认）**：新角色默认交付Blender模型、骨架权重、动画与正常速度视频，做到绑骨动画即止。UE接入不自动执行；FBX和引擎步骤仅另行明确要求时做，下面相关内容为历史/可选流程。

**2026-09-12 晚已导入 UE**:`scripts/pikachu_export_v2.py`(源 = `magic_discharge/pikachu_v1_magic_discharge.blend`,七 clip 全导,Magic 81 帧)取代 v1 导出脚本;同时修了眼睛/高光/腮红 6 片法线朝内的问题(`scripts/pikachu_fix_face_normals_v1.py`,修前备份 `magic_discharge/backups/pikachu_v1_magic_discharge_pre_normalfix.blend`),UE 的 `SK_Pikachu`/`A_Pikachu_Magic` 已替换。皮卡丘Magic已改成低重心蓄力→双臂侧展放电→恢复，最新源 `output/pikachu/v1/animation/magic_discharge/pikachu_v1_magic_discharge.blend`。同目录 `videos/PikachuV1_Magic_Discharge_3x_30fps_1x.mp4` 为正常速度三遍预览，`PikachuV1_AllActions_Discharge_30fps_1x.mp4` 为更新总览；其余六动作保持原样。81帧验证通过，详见 `MAGIC_DISCHARGE_REVIEW.md`。UE停止时仅导入了旧版资产，未修改蓝图或启动PIE；不继续推进，UE暂存资源不代表最新Magic。

通用流程入口：[通用3D管线流程](../通用3D管线流程.md)。包含分阶段验收、导出、UE 接入、朝向/尺寸/接地公式及交付模板。

## 2026-09-12 皮卡丘 v1：静态审阅

最新用户反馈修订：双手增加可辨短指/拇指，头部与腹臀侧面加厚变圆。当前源改为 `output/pikachu/v1/hand_refinement/pikachu_v1_hands_volume_static_review.blend`，预览及旧新侧面对比见同目录 `previews/`。最新28,860顶点、5材质、65.70×64.11×90.00cm；详见 `hand_refinement/HANDS_VOLUME_REVIEW.md`，仍待人工模型确认。以下原始版本保留对照。

- [角色卡](pikachu_v1_character_card.md)；[验收记录](output/pikachu/v1/acceptance.md)。当前停在人工MODEL APPROVED门禁，尚未制作骨架、动作、FBX或写入UE。
- 源文件：`output/pikachu/v1/pikachu_v1_static_review.blend`；四视图：`output/pikachu/v1/previews/review_board.png`；分阶段checkpoint保留。
- 以多视图设定为参考在Blender直接建模，完成宽脸、短肢、红脸颊、黑耳尖、背纹和闪电尾，已修整耳根连接与耳尖色界。
- 静态尺寸：宽65.70×深55.39×高90.00 cm，脚底Z=0；28,768求值顶点、5材质。数字检查与主代理审阅不能代替用户的最终造型确认。
- UE实时只读预检表明当前现场已更新为Mewtwo默认、Tile52的Gyarados显式外观，后续增加皮卡丘时保留现有角色；下文9月11日伊布接入为历史记录。

## 最新状态：2026-09-11 Blender v6 修复

用户否定旧伊布的模型质量、动作表达与碎裂问题后，本轮通过 **Blender MCP 直接操作编辑器**，另存并重建了模型和骨架。旧 v5 文件及工作区已有改动保留。

- **当前 Blender 修复文件**：`output/repair_v6/eevee_v6_animated.blend`。旧场景备份：同目录 `before_repair.blend`。
- **打开即看**：默认选中 `V6_Preview_All`，空格播放 401 帧串联预览，时间线有六个动作名称标记。这是额外的审阅动作，不是第七条游戏动作，也不应导出进游戏。
- **修复脚本**：`scripts/06_repair_eevee.py`；分阶段调用 `build_model()` → `build_rig()` → `build_actions()` → `ground_actions()` → `validate()`。脚本不是原 `run_pipeline.ps1` 的一部分，直接运行脚本只定义函数；`build_model()` 会重建当前场景，调用前先另存。
- **模型**：重做头脸、叶片形厚耳、收尖尾巴与较整齐的奶油毛领；尾尖采用打包进 blend 的 UV 基础色贴图，避免逐面判色锯齿；鼻嘴/眼睛与头部骨架一致，眼部有闭眼控制。
- **骨架**：按 +Y 朝向与真实解剖位置建立 28 骨（含四脚 IK 控制），不再套用旧 Rigify 错位骨链。身体权重沿网格邻接边平滑，并固定脚掌和躯干中心的权重。耳、头、尾各有明确归属。
- **动作**：`V6_Idle` 61 帧、`V6_Walk` 33 帧、`V6_Attack` 46 帧、`V6_Magic` 61 帧、`V6_Hurt` 31 帧、`V6_Death` 76 帧，30 fps。前两条循环，后四条一次性。攻击是蓄力→前冲撞击→恢复；施法是聚拢→抬身举爪→前推释放；死亡是腿软→闭眼侧倒→停住。
- **验证**：全 308 帧检查通过。无缺失/未归一化权重、无地面穿透；头部刚性跟随误差 < 0.001 mm；身体边长拉伸的最坏 99.9 分位 < 1.83 倍，最大值 < 2 倍。详细指标见 `reports/06_repair_v6.json`。这些是几何门禁，**不代替模型外观、动作意图的人工验收**。
- **预览**：`output/repair_v6/` 中有 `final_*.png`、每条动作的 MP4 和六动作总览；`frames/` 保留预览帧。
- **预览复跑**：`start_previews()` 通过 Blender 定时器逐帧渲染；待 `preview_status.json` 显示 `complete` 后运行 `scripts/06_encode_previews.ps1`，得到 `review_grid.mp4`。视频是 15 fps 审阅采样，源动作仍为 30 fps。
- **UE 状态（2026-09-11）**：已导入 `/Game/Meshes/EeveeV6/` 并替换 BP_Unit 网格及七个动作变量（增加倒放 Walk 的 WalkBackward）。PIE 已确认四个实例、Idle/Walk 引用及组件变换。scale=0.75、局部旋转0、Z=-88.173；参考尺寸约91.13×55.40×94.51 cm。最终 UE 动作视觉、四向及接地仍待验收，不继承旧版本 PASS。
- **UE 导出**：`scripts/07_export_ue_v6.py` 在 Blender 内调用 `export()`；源骨架28骨烘焙成24骨，产物见 `output/repair_v6/ue/export.json`。该脚本未接入旧 `run_pipeline.ps1`，含伊布专属名称和路径。

现场确认的旧骨架问题：胸口根骨 `spine.004` 的 Z≈1.024 m，脸链伸到 Y≈1.012 m，脚骨长度约 0.000002 m；骨名、实际位置和动作驱动不一致。仅仅继续添加尾巴/眼睛的局部权重补丁不足以修好整套变形。

下面保留 9 月 6 日实验史，不能将旧 PASS 当作 v6 的 UE 验收。

本目录把「Hunyuan 灰模 → Blender 重网格/绑骨/程序化动作 → UE 隔离导入」收成可复跑脚本。
第一只实验体是仓库里已有的伊布四视图灰模,不是超梦。

## 已拍板的试点(实验 0)

| 项 | 决定 | 为什么 |
|---|---|---|
| 第一只实验体 | `eevee-4view/Hy3D_mv_grey.glb` | 四视图比单视图稳;计划实验 1–4 都写的是伊布;超梦 OBJ 只当「人形对照」,不挡四足主线 |
| 成功标准 | Content 里有一套**新 Skeleton** 的伊布骨骼网格,能播 Idle/Walk | 计划明确「先不改 `SpawnUnit`」。棋盘上第二只怪是下一阶段 |
| 绑骨主路径 | Blender Rigify `wolf` metarig + 自动权重 | 本机 Blender 5.2.1 已带 Rigify;骨名相对标准,后面动作脚本能复用 |
| UniRig 对照 | 环境门禁记录结果,不阻塞主路径 | 本机无 conda、无 Python 3.11、无现成 UniRig 目录;Windows + RTX 5080 是已知雷区 |

超梦 OBJ 仍留在 `mewtwo-mixamo/test_mew2.obj`,哪天要验证「同一套 bpy 脚本对人形是否可复用」再跑,不和伊布实验绑在一起。

## 本机实测环境(2026-09-06)

- Blender `5.2.1 LTS`:`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`
- Rigify 可启用;可用 `armature_wolf_metarig_add` / `armature_cat_metarig_add` / `armature_basic_quadruped_metarig_add`
- GPU: RTX 5080 16GB(和 `UE美术管线.md` 里 Hunyuan 环境一致)
- UniRig: 未安装;系统 `py` 只有 3.14;没有 conda

## 怎么跑

在仓库根目录用 PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File art-pipeline/run_pipeline.ps1
```

分步跑:

```powershell
powershell -ExecutionPolicy Bypass -File art-pipeline/run_pipeline.ps1 -Step inspect
powershell -ExecutionPolicy Bypass -File art-pipeline/run_pipeline.ps1 -Step rigify
powershell -ExecutionPolicy Bypass -File art-pipeline/run_pipeline.ps1 -Step walk
powershell -ExecutionPolicy Bypass -File art-pipeline/run_pipeline.ps1 -Step unirig
```

产物都写进 `art-pipeline/output/` 和 `art-pipeline/reports/`。

## 实验门禁(过不了就停)

1. **拓扑**:至少找出 3 个脚掌簇(理想 4)。少於 3 = 腿根本分不开,禁止绑骨。
2. **绑骨**:站姿包围盒不炸(体积比 < 3);抬前腿、弯尾巴时网格有位移且不整体飞走。
3. **动作**:导出的 FBX 带 Armature + 至少 Idle / Walk 两条 Action。
4. **UE**:导入到 `/Game/Meshes/Eevee_Skeletal/`,新建 Skeleton,不改 `BP_Unit` / `SpawnUnit`。

## 2026-09-06 第一轮实验结果

| 实验 | 状态 | 结论 |
|---|---|---|
| 0 试点 | 已拍板 | 伊布四视图灰模;成功标准 = Content 能播,不改 SpawnUnit |
| 1 拓扑 | PASS | 重网格后 4 个脚掌簇。围脖仍焊在身上(Hunyuan 预期) |
| 2A UniRig | BLOCKED | 无 conda / 无 Python 3.11 / 无仓库。不污染 Hunyuan 环境强装 |
| 2B Rigify | PASS | `basic_quadruped`(34 骨)+ 自补 4 节尾巴。wolf 没有尾巴且 190 骨会抢权重 |
| 3 动作 | PASS | 程序化 Idle(24f) + Walk(32f) + Attack(24f) + Magic(28f) + Hurt(18f) + Death(36f),FBX 已出 |
| 4 UE | PASS | `/Game/Meshes/Eevee_Skeletal/` 新 Skeleton,Idle/Walk 在。`BP_Unit` 未动 |
| 4b 质量对照 | FAIL | Hunyuan 灰模 vs 概念图:没脸、围脖碎、尾巴烂,角色资产不合格(`reports/04_quality_vs_ref.md`) |
| 5 程序化建模 | PASS | 不走 Hunyuan,bpy 直接建:有脸、有颜色分区,v2 体素融合版(`reports/05_proc_eevee.json`) |
| 5b 全链路 | PASS | 程序化伊布过同一套 02 绑骨 + 03 六条动作,FBX 在 `output/proc/`,UE 导入 `/Game/Meshes/EeveeProc_Skeletal/`(`reports/04_ue_import_proc.json` / `04_ue_import_proc_v5.json` / `04_ue_import_proc_units.json`) |

## 实验 5:程序化建模(2026-09-06,Hunyuan 的替代来源)

`scripts/05_build_eevee.py` 直接用 bpy 建出带颜色的伊布,
产物 `output/eevee_proc.glb` / `.blend`,四视角渲染在 `output/compare/proc_*.png`。

对比 Hunyuan 灰模的优势:**有颜色**(材质分区,不依赖已坏的贴图步)、**有脸**(眼/鼻/内耳)、
拓扑干净(自动权重的输入比碎网格好)、参数化(改 `build_fusible()` 里的尺寸表就是下一只四足)。

**v1(球堆版)被用户否了:太卡通/玩具感**。v2「融合版」的做法:

1. 身体部件(躯干/头/口鼻/臀肌/肩肌/两段腿/围脖/曲线尾巴)摆好后 join,
   **体素重网格融合成一张连续曲面** → 部件接缝彻底消失,气球感没了。
2. 融合会丢材质 → join 前先给棕/奶油两组部件各建一棵 **BVH**,融合后逐面查
   「离哪组原件表面近」重新上色,再跑 2 轮邻居多数票把锯齿边抹平。
3. 表面叠很轻的 Clouds 位移(±5mm)模拟毛皮起伏,strength 0.008 就会起「脑纹」。
4. 耳朵(锥体)/眼睛/鼻子**不参与融合**(会被糊掉),最后 join 进来。

建模踩坑(细节都在脚本注释里):

- 球串排尾巴无论多密都会被 cavity 阴影显出环状棱,**必须用曲线倒角一体成型**
  (贝塞尔 + `bevel_depth` + 逐控制点 `radius`,`use_fill_caps` 封口)。
- 眼睛要凸出头表面,陷进去像熊猫眼斑;围脖尖簇要短、上端埋进底座。
- 耳朵锥体:底半径 × 高 ≈ 等宽高才是普通兽耳;但伊布这种「耳朵是主角」的设计要
  底 0.145 × 高 0.40,且两耳中距 ≥ 0.38,近了底部会在头顶交叉打架。
  内耳锥长度不能超过外耳一半,否则侧视穿出「第三根刺」。
- 围脖底座顶不能超过头底,否则奶油色爬上后颈变成兜帽。
- **v3 对照官图的比例结论**(2026-09-06 用户对比官方立绘后修的):脸要平(几乎无吻部,
  只留小鼓包 + 鼻点),眼睛要巨大、朝前、竖椭圆、双高光(上大下小),身体缩短胸抬高,
  配色用暖橙棕(Workbench 灯会压饱和度,基色要比目标更暖一档)。「像不像」主要输在
  比例表,不是建模手法。
- **v4 官图观感 = 赛璐璐渲染**(用户要「做出官图效果」后加的):
  - 几何:围脖加一圈下垂尖刺锥(和圆簇错位半格)、尾巴色界插 4 根奶油毛簇锥、
    额前 3 根刘海锥。锥体进体素融合会被磨圆,刚好是毛簇感。腮毛锥试过,删了(像嘴边长角)。
  - 渲染:toon 材质(Diffuse→ShaderToRGB→ColorRamp 两档 CONSTANT→Emission)+
    Freestyle 描边(只开 silhouette/contour/**material_boundary**,crease 一开全是碎裂纹)+
    **view_transform 必须切 Standard**(AgX 会把赛璐璐压灰)。
  - ⚠️ toonify 必须在导出 GLB/保存 blend **之后**——FBX/glTF 导出器只认 Principled。
  - ⚠️ `render_views` 的 `setup_workbench_camera` 会把引擎重置回 Workbench,
    toon 那趟要传 `setup_camera=False`。
  - toon 观感目前只在 Blender 渲染里;UE 里要同款效果需要 UE 侧的 cel 材质 + 描边后处理(未做)。

## Hunyuan 路径审计(2026-09-06)

如果还要继续 Hunyuan 抽卡,先修这些(按优先级):

1. **权重疑似配错**:`ComfyUI/input/eevee_hy3d_mv_prompt.json` 的 Loader 用的是
   单视图 `v2-0-fp16` 喂 `Hy3DGenerateMeshMultiView`,和文档「必须 mv-fast」矛盾。
2. `octree_resolution` 只有 256(VAE 解码分辨率,细节糊就在这),该上 384/512。
3. `seed` 固定 123,从没批量抽过卡。`submit_eevee_hy3d.py` 循环换 seed 即可批量,
   再用 `_common.py` 的脚掌聚类当自动初筛。
4. 输入图 left 是 3/4 透视不是正交侧视,违反工作流自己的要求。

已知质量债(下一阶段再修,不挡「管线跑通」):

- 自动权重会把围脖拉出碎片,抬腿时身体会跟着走一点。要量产得手修权重或更准的骨头地标。
- **UE 单位(2026-09-06 订正)**:`export_fbx()` 用 `global_scale=1` + `apply_unit_scale=True` + `FBX_SCALE_NONE`,把米→厘米写进顶点。MCP `import_file` 不会 Convert Scene。验收:`EeveeProc` 总高约 114cm(`boxExtent.z≈57`)。`global_scale=100` 会叠乘成 57 米;`FBX_SCALE_ALL` 又会缩回厘米。主资产是 `/Game/Meshes/EeveeProc_Skeletal/EeveeProc`,**不要用**厘米级旧资产 `EeveeProc_V5` / `EeveeProc_Rigify`,**不要抄超梦 Scale≈54**。
- **UE 朝向(2026-09-06 订正)**:Blender 脸朝 +Y,不转的话进 UE 脸朝 -Y。`export_fbx` 导出前给根物体绕 Z -90°,导出后转回来(不污染 .blend)。验收:`boxExtent.x≈60`、`boxExtent.y≈32`,Actor Yaw=0 时脸朝 +X。接 `BP_Unit` 不要抄超梦 `Yaw=270`。
- 仍然是灰模,贴图步没打通。
- 棋盘上所有单位仍是超梦。种类 → 模型映射还没做。

## 生成器版本(不要换 Hy4)

2026-09-06 对齐过一次:用户说的「hy4 而不是 hy3」对不上任何可换的本地 3D 模型。

- 现用的 `hy3d_*` = Hunyuan3D-**2.0** 本地(四视图权重已在本机)。
- **Hy4 preview** = 混元 770B **语言模型**,不产出 glb。
- Hunyuan3D **3.0** = Comfy 云 API,和「本地免费无墙」冲突。
- 本地能升的只有 **Hunyuan3D 2.1**,而且 Kijai 节点 `Hy3D_2_1SimpleMeshGen` **只有单视图**。伊布试点靠的是四视图 2.0,拿 2.1 单视图替换主路径,几何上大概率退步。

完整对照表见 `UE美术管线.md`「版本对照」一节。

## 脚本地图

- `scripts/_common.py` — 网格分析、脚掌聚类、相机、报告写入(Blender 内共用)
- `scripts/01_inspect_remesh.py` — 实验 1
- `scripts/02_rigify_quad.py` — 实验 2 路径 B(`basic_quadruped` + 尾巴链)
- `scripts/02b_unirig_gate.py` — 实验 2 路径 A 的环境门禁(系统 Python,不进 Blender)
- `scripts/03_walk_cycle.py` — 实验 3,在 Rigify 骨名上写 Idle/Walk/Attack/Hurt/Death 并导出 FBX
- `scripts/04_compare_ref.py` — 实验 4b,把 Hunyuan 灰模四视角渲染出来和概念图对照
- `scripts/05_build_eevee.py` — 实验 5,bpy 程序化建模(不走 Hunyuan 的替代来源)
