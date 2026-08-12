# 纹兽战记 · 2D→3D 美术管线(可复用手册)

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
1. Load Image 节点传概念图(FRONT)。
2. 点 **Run** → 出灰模(375k 面 → 自动精简到 25k 面/50k 三角,棋子够用)。
3. **贴图这步会报错** `No module named 'custom_rasterizer'` —— 那是要编译的贴图渲染扩展。
   - torch 2.10/cu130 太新,kijai 的预编译 wheel(torch2.6/cu126)对不上,得自己编译(装 VS 生成工具),很折腾。
   - **占位棋子不需要贴图** → 直接跳过:选 `Hy3DRenderMultiView`(及后面贴图组)按 **Ctrl+B 旁路**,用 `Hy3DExportMesh` 导出灰模。
   - 想要真彩贴图 = 以后单独攻编译,或改用带贴图的在线工具。
4. 导出 **glTF(.glb)** → 文件在 `<ComfyUI>/output/`。

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
