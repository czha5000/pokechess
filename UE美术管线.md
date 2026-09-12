# 纹兽战记 · 2D→3D 美术管线(可复用手册)

> **2026-09-11 更新**：通用操作与验收标准已整理为 [通用3D管线流程](通用3D管线流程.md)。伊布 v6 完成 Blender 修复、七动作导出和 UE BP_Unit 接入，PIE 已确认四个实例使用新网格及动画引用。缩放0.75，参考尺寸约91.13×55.40×94.51 cm；最终 UE 动作视觉、朝向与接地仍待验证。下文旧骨架与旧 PASS 不作为 v6 验收证据。

> 目标:一只怪的 **2D 概念 → 3D 模型 → 套到 UE 棋子**。每做一只照着走。
> 版权:私用练手可用宝可梦;**公开发布必须原创设计**。
> ✅ 已跑通(2026-07-19):Nano Banana 概念图 → ComfyUI 本地 Hunyuan3D 出灰模 .glb → UE 导入 → BP_Unit 棋子。整条免费、无付费墙。

---

## 主路线:ComfyUI 本地 Hunyuan3D(推荐,免费无墙)

在线工具(Tripo/Meshy)反复卡付费墙、内容审核。**本地是正解**,机器够就一劳永逸。
- 本机:**RTX 5080(16G)+ PyTorch 2.10 / cu130**,跑形状生成绰绰有余(一次约 4 分钟)。

### 第 1 步 · Nano Banana 出概念图(为 3D 优化)
```
full-body character concept, original creature,
front view, standing A-pose, symmetric, arms slightly out,
plain white background, flat neutral lighting, no cast shadows,
clean design, centered, game character
```
- **平光、无强阴影**很关键——阴影会被 AI 烤成棕色斑块伪影(Meshy 皮卡丘肚子那次的坑)。
- 进阶:要 **三/四视图 model sheet**(FRONT/SIDE/REAR),3D 更准。

### 第 2 步 · 装 ComfyUI + Hunyuan3D(一次性)
1. **ComfyUI 桌面版**(自带 Manager,不用手动 clone manager,会冲突)。
2. 装节点:加载官方示例工作流 `hy3d_example_01` → 右侧 **Missing Node Packs → Install All**(装 `comfyui_essentials` + `comfyui-hunyuan3dwrapper`)→ 重启。
3. **下模型权重**(约 4.9GB),放进 `<ComfyUI>/models/diffusion_models/`。
   PowerShell 里注意用 **`curl.exe`**(不是 `curl`,那是 Invoke-WebRequest 别名):
   ```
   cd <ComfyUI>\models\diffusion_models
   curl.exe -L -O https://huggingface.co/Kijai/Hunyuan3D-2_safetensors/resolve/main/hunyuan3d-dit-v2-0-fp16.safetensors
   ```
   下完 Refresh,在模型加载节点下拉里选它。
4. 其余模型(去背景 rembg 等)首次 Run 自动下。

### 第 3 步 · 生成(出灰模)

单视图和四视图是**两套工作流、两份权重**,不能在 `hy3d_example_01` 上多接几张图。

| | 单视图(超梦那次) | 四视图 |
|---|---|---|
| 工作流 | `hy3d_example_01` | `user/default/workflows/hy3d_mv_grey_4view.json` |
| 生成节点 | `Hy3DGenerateMesh`(1 个 image) | `Hy3DGenerateMeshMultiView`(front/left/right/back) |
| 权重 | `hunyuan3d-dit-v2-0-fp16.safetensors`(已有) | `hunyuan3d-dit-v2-0-mv-fast-fp16.safetensors`(**另下一份**,不是把单图模型改名) |

四视图用法:
1. Comfy 打开 `hy3d_mv_grey_4view`。Loader 必须选 **mv-fast**,不要选 v2-0。
2. 四个 Load Image 各放一张**独立**图:正 / 左 / 右 / 后。不要一张四宫格。右视如果是 3/4 透视,断开 right 口,不要硬喂。
3. 四张会 pad 到 518×518(尺寸不一致会在拼 preview 时崩)。背景尽量黑或透明。
4. Run → `output/3D/Hy3D_mv_*.glb`。

贴图这步会报错 `No module named 'custom_rasterizer'`(torch 2.10 对不上预编译 wheel)。**灰模工作流已经旁路贴图组**。想要真彩 = 以后编译扩展,或改用带贴图的在线工具。完整带贴图官方示例另存为 `hy3d_multiview_example_02.json`,这台机器上先别跑。

---

## 备用路线:在线工具(常卡付费墙)
- **Tripo**(tripo3d.ai):Smart Mesh / Triangle / ~5000 面。多视图=Subscribers Only,导出常要付费。
- **Meshy**:Gen Textured Shape 带贴图,但下载 +$20;审核可能误判(裸人形超梦被判违规,动物类如皮卡丘不会)。
- **HF Space Demo**(huggingface.co 搜 Hunyuan3D / TripoSR):在线免费生成+下 .glb,零安装,适合偶尔做一只。

---

## 第 4 步 · 导入 UE(✅ 实测)
- 把 **.glb 拖进 Content 浏览器** → glTF Interchange 导入窗**默认设置直接 Import**。
- **没法线也没事**:Interchange 检测到缺法线会**自动重算**(实测灰超梦法线光滑、正常投影)。
- glTF 米制会自动转 UE 单位;得到 Static Mesh(纯灰、无材质/UV)。

## 第 5 步 · 套到棋子 BP_Unit(✅ 实测)
- BP_Unit → **Mesh 组件** → **Static Mesh** 换成导入的模型。
- **Scale**:先试 **0.4** 左右,拖到跟一个格子匹配。
- **Location Z**:抬到脚踩格子面(原点常在中心)。
- **Rotation Z(Yaw)**:转到正面朝向想要的方向。

## 第 6 步 · 敌我区分
- 目前:Setup(bAlly) 给一方套**红色材质**(整只变红),另一方灰。清晰够用。
- 更好(不盖外观、以后每只怪不同模型时):敌方脚下加**红色底座圆盘**,或头顶红标/红描边。

---

## 常见坑(实战记录)
- PowerShell 的 `curl`/`wget` 是别名,下载用 **`curl.exe`** 或 `Invoke-WebRequest -OutFile`。
- ComfyUI 桌面版**自带 Manager**,别再手动 clone `comfyui-manager`(冲突 → 后端 Reconnecting)。
- 自定义节点**只在启动时加载**,clone/装完必须**重启**。
- Hunyuan3D **贴图步要编译 custom_rasterizer**,torch 太新时预编译 wheel 对不上——占位就跳过。
- 概念图要**平光无阴影**,否则贴图出棕斑伪影。
- 尺寸/朝向/上轴对不上是常态,第 5 步基本都要调。
- 多视图 > 单图 > 动态姿势单图(效果依次变差)。

---

## 第 7 步 · 四足绑骨/动画(2026-09-06 伊布试点已跑通)

按角色实际体态选择骨架：伊布使用四足骨架；皮卡丘、杰尼龟通常是直立双足，不能因同属宝可梦而套用伊布四足骨链。超梦的近人形 Mixamo 路也不能直接套到短肢、长耳和特殊尾部角色。制作与导出遵循 [通用3D管线流程](通用3D管线流程.md)。

已验证(伊布四视图灰模 `eevee-4view/Hy3D_mv_grey.glb`):

1. Blender 5.2 体素重网格 → 至少 3 个脚掌簇才允许绑骨。
2. Rigify `basic_quadruped` + 自补 `tail.001..004`(wolf metarig 没有尾巴,190 根脸/手指骨会把围脖权重抢走)。
3. `bpy` 程序化 Idle / 对角快步 Walk / Attack / Hurt / Death,导出 FBX。
4. UE 导入到 **`/Game/Characters/<Species>/`**(2026-09-12 起统一,旧的 `Meshes/*` 目录已删),网格 `SK_<Species>`、动画 `Animations/A_<Species>_<动作>`,每只角色独立 Skeleton,不要绑到别的角色骨头上。完整规则和加角色 SOP 见 `UE角色资产规范.md`。

本轮**没有**改 `BP_Unit` / `SpawnUnit`。棋盘上所有单位仍是超梦。种类映射是下一阶段。

复跑:`powershell -ExecutionPolicy Bypass -File art-pipeline/run_pipeline.ps1`

注意:

- UniRig 在这台机器上门禁失败(无 conda / 无 Python 3.11),对照实验记在 `art-pipeline/reports/02_unirig_gate.json`。
- **单位(2026-09-06 订正)**:MCP `import_file` 不做 Convert Scene。导出必须用 `FBX_SCALE_NONE` + `global_scale=1`(插件自己会把米→厘米的 100 打进顶点)。验收 `boxExtent.z≈57` → 总高约 114cm。写成 `global_scale=100` 会变成 57 米(见坑95)。**不要抄超梦 Scale≈54**,那是给 1.8cm 灰模用的;正确厘米网格 Scale=1。旧资产 `EeveeProc_V5` 仍是 1cm 级,主资产是 `EeveeProc`。
- **朝向(2026-09-06 订正)**:Blender 脸朝 +Y,UE Character 前方是 +X。未修正时 MCP 导入后面朝 **-Y**(从 -X 看是侧脸)。`export_fbx` 现在导出前绕 Z 转 -90°。验收:Actor Yaw=0,从 -X 看背影、从 +X 看正脸,`boxExtent.x > boxExtent.y`。接 `BP_Unit` **不要抄**超梦 `Yaw=270`(见坑64/坑96)。
- 自动权重会撕围脖,量产前要手修或换更准的骨头地标。

---

## 灰模来源审计(2026-09-06:Hunyuan 路径的四个未拧过的旋钮 + 程序化替代)

伊布灰模「没脸、围脖碎、尾巴烂」之后整体审了一遍生成路径,结论:

**疑似配置错误(最优先查)**:API 提交用的 `ComfyUI/input/eevee_hy3d_mv_prompt.json` 里
`Hy3DModelLoader` 加载的是**单视图权重 `hunyuan3d-dit-v2-0-fp16`**,喂给了
`Hy3DGenerateMeshMultiView`——违反本文件上面写的「Loader 必须选 mv-fast」。如果当时
灰模走的是这个 API prompt(而不是 GUI 工作流),质量差有一部分就是权重配错。

**从没调过的参数**(都在那个 prompt json 里):

| 旋钮 | 当时值 | 该试的值 |
|---|---|---|
| 权重 | `v2-0-fp16`(单视图!) | `v2-0-mv-fast-fp16` |
| `seed` | 固定 123,只抽过一次卡 | 批量 8~16 个种子,用 `_common.py` 的脚掌聚类/碎片计数自动初筛 |
| `octree_resolution` | 256(偏低,尾巴/围脖细节就是在这一步糊掉的) | 384 或 512 |
| 输入图 | left 是 3/4 透视图不是正交侧视 | 重新出正交三视图 |

批量抽卡的提交脚本模式已经有了(`ComfyUI/input/submit_eevee_hy3d.py`),循环换 seed 排队即可,无阻碍。

**程序化建模替代路线已验证**:`art-pipeline/scripts/05_build_eevee.py` 不走 Hunyuan,
直接 bpy 建出带颜色分区(棕/奶油/深棕)、带脸(眼/鼻/内耳)的伊布。
v1 球堆版被否(太卡通),v2 改成**体素融合成连续曲面 + BVH 重新上色 + 毛皮噪声位移**,
接缝消失、有臀肌/肩肌体块,单次构建约 8 秒。灰模路径给不了颜色(本机贴图步是坏的)
和脸,这条路线天生就有。细节见 `art-pipeline/README.md` 实验 5。

## 渲染风格对齐(2026-09-06:超梦根本没有材质,库里不存在"既定风格")

用户问"程序化伊布该不该用赛璐璐(cel-shading),对齐超梦效果"。实测查证:

- **`Mewtwo_TPose` 唯一材质槽 `MaterialSlot` 是空的**(`get_material` 返回 No material assigned)——
  超梦在 UE 里就是引擎默认灰材质 + 默认光照。它看着"干净"全靠雕刻本身好,不是有什么风格化处理。
  **所以"对齐超梦"没有可对齐的渲染风格,只有"默认 Lit + 素色"这一个事实状态。**
- **Blender 里做的赛璐璐(toon 材质 + Freestyle 描边)不进 FBX/GLB**——那是渲染侧设置,
  资产只带 mesh/骨骼/基础色。UE 里 `EeveeProc_Rigify` 现在就是 5 个普通 Lit 材质(Eevee_brown 等)。
- 同屏对比截图:`art-pipeline/output/compare/ue_side_by_side.png`、`ue_eevee_closeup.png`
  (临时 SkeletalMeshActor 拍完已删,关卡未留痕)。观感结论:UE 默认光照下程序化伊布的
  **毛皮噪声位移 + 几何毛刺会产生高光碎斑**,比 Blender 赛璐璐渲染难看一截;超梦胜在曲面光滑。
- 待拍板的真正问题:**全游戏的 UE 渲染风格**选哪个——
  (a) 维持默认 Lit(伊布要改:降噪声位移、几何毛刺收敛、颜色按 Lit 调),
  (b) UE 侧做全局 toon(后处理描边 + 色带材质函数,超梦等所有单位一起变赛璐璐)。
  单独给伊布上 toon、超梦保持素模是最差解(风格分裂)。

---

## 版本对照(2026-09-06:不要把 Hy4 当成 3D)

名字很容易串。本机现在跑的是 **Hunyuan3D-2.0**(Comfy 工作流文件叫 `hy3d_*`),不是 Hunyuan3D 3,更不是 Hy4。

| 名字 | 实际是什么 | 本机能不能当生成器 |
|---|---|---|
| 现用 `hy3d` | Hunyuan3D-**2.0** 本地。权重已在 `Documents/ComfyUI/models/diffusion_models/`:单视图 `v2-0-fp16` + 四视图 `v2-0-mv-fast-fp16` | ✅ 已跑通,四视图伊布就是这条 |
| Hunyuan3D **2.1** | 开源下一代形状 + PBR 贴图。Kijai wrapper 已有 `Hy3D_2_1SimpleMeshGen` | ⚠️ **只有单视图**。2.1 权重还没下。贴图仍要编译 `custom_rasterizer`,官方贴图显存约 21G,5080 16G 可能 OOM |
| Hunyuan3D **3.0/3.1** | 质量更好,Comfy Partner **云 API** | ❌ 破坏「本地免费无墙」;宝可梦外形可能再撞审核 |
| **Hy4 preview** | 2026-08-28 发布的 **770B 语言模型**(49B 激活),要多卡 vLLM | ❌ 不生成 mesh。和 3D 管线无关 |
| Hunyuan3D **4.0** | 到 2026-09-06 没有这个 3D 产品 | ❌ 不存在 |

要「更新一代、仍本地免费」:只试 **2.1 单视图对照**,不要拆掉四视图 2.0。四足几何四视图仍然更稳;2.1 单视图很可能比现成的 `eevee-4view/Hy3D_mv_grey.glb` 更差,不值得整条绑骨重做。
