# 纹兽战记 · UE 过场动画管线(可复用手册)

> 目标:一只静态模型 → **绑骨 → 套动画 → Sequencer 电影化过场**。
> ✅ 已跑通(2026-07-19):超梦静态灰模 → Mixamo 绑骨 → Magic Heal 动画 → UE Skeletal Mesh → Sequencer 运镜 + 冷光打光,出了一段阴森过场。
> 前置:先按 `UE美术管线.md` 拿到模型(最好是 **T-pose** 灰模 .glb,绑骨才准)。

---

## 第 1 步 · 模型转 OBJ 给 Mixamo(关键:别用 UE-FBX)
- Mixamo 只吃 **FBX / OBJ / ZIP**,**不吃 glb**。
- **坑:UE 导出的 FBX 带厘米单位 → Mixamo 里模型巨大,镜头钻进模型内部(大灰块)。**
- **解法:转成 OBJ**(无单位,Mixamo 自动归一化)。转换方式:
  - 在线搜 "glb to obj"(灰模无隐私顾虑);或 Blender import glb → export obj;
  - 或让脚本归一化(居中、脚底对齐 y=0、高度归一)后导 OBJ。
- 记住:**给 Mixamo = OBJ,不是 UE-FBX。**

## 第 2 步 · Mixamo 自动绑骨(mixamo.com,免费,需 Adobe 账号)
1. **UPLOAD CHARACTER** → 传 OBJ;
2. **Orient**:箭头转到正面朝前、T-pose;
3. **Place markers**:下巴、手腕、手肘、膝盖、胯——**手肘在手臂正中、膝盖在腿弯处、下巴贴头底**;勾 Use Symmetry;
4. NEXT → 自动绑骨(几十秒);
5. 选动画(idle / magic / taunt 等,**避开太剧烈的**,尾巴/兽腿会扭);
6. **DOWNLOAD**:Format=**FBX Binary(.fbx)**、Skin=**With Skin**(第一次必须带皮)、30fps、Keyframe Reduction=none;
   - 之后加更多动作:同一角色下载选 **Without Skin**(共用骨架)。
- 限制:免费商用免版税;每天下载次数有限(够用);工具已停更、偶尔抽风。

## 第 3 步 · 导入 UE(Skeletal Mesh)
- 拖 .fbx 进 Content Browser,导入框:
  - **Skeletal Mesh = ✅**;
  - **Skeleton = None**(第一次让 UE 新建骨架;**加额外动画时选已存在的那副超梦 Skeleton**,只导动画);
  - **Import Animations = ✅**。
- 生成:Skeletal Mesh + Skeleton + Anim Sequence + Material。
- **坑:尺寸**。若模型被归一化过,导进来可能很小 → 重导时 **Import Uniform Scale = 100**,或在场景里放大 actor。

## 第 4 步 · Sequencer 搭过场
1. 模型拖进关卡;**Add → Cinematics → Level Sequence**(如 `CS_Xxx`),打开时间轴;
2. 选中角色 → **+Track → Actor To Sequencer**;
3. **加动画**:把 Anim Sequence **从 Content Browser 拖到角色轨道上**(最稳),让它成为子轨;
   - **坑:动画不动**,多半是加到了序列根节点没挂到角色轨 → 拖到角色轨上重加。
   - 动画片段记得**拖到帧 0** 起始,别悬在中间。

## 第 5 步 · 摄像机 + 运镜
1. Sequencer 工具栏**电影摄像机图标(Create Camera)点一次**——自动建 Cine Camera + Camera Cuts 并绑定;
2. **坑:别重复 Create / 删摄像机!** 删了会让 Camera Cuts 绑定失效,报红 "Object Binding / Bound Object is missing"。
   - 修复:删掉坏的 Camera Cuts 轨 → **+Add → Camera Cut Track** → 点它的摄像机按钮 → 选现有 CineCameraActor。
3. **打关键帧运镜(手动最稳)**:
   - 展开 CineCameraActor → **Transform** 子轨;
   - 播放头到帧 0 → 摆镜头(远、略仰)→ 点 Transform 行的**中间菱形 ◆(Add Key)**(或按 Enter);
   - 播放头到末尾 → 推近镜头 → 再点 ◆;
   - **坑:底部左下那个红圈是 "录制游戏"(Take Recorder),不是 Auto-key,别点。**
4. 概念:**关键帧=某时间点记一个值,中间 UE 自动补间**。两帧位置不同才有运镜。

## 第 6 步 · 打光(氛围,阴森感的关键)
1. **压暗**:DirectionalLight(太阳)Intensity 调低、颜色冷蓝;SkyLight Intensity Scale ~0.2;
   - **概念:DirectionalLight 是无限远的太阳,无位置、只有旋转;影子方向 = 它的旋转**(Ctrl+L 拖可实时转)。
2. **主角光(轮廓光)**:Add → Lights → **Spot Light**,放**超梦侧后方、略高**(Z~180),Pitch ~-35 斜射向它;Color 冷青/紫;Intensity 拉到边缘发光;
   - **坑:必须关 Cast Shadows**——否则多光源各投一条影,方向冲突;让太阳当唯一投影灯。
3. **雾**:ExponentialHeightFog 的 Fog Density 调高一点,加纵深。
4. **锁曝光(去掉 Lumen 曝光红字 + 暗色更沉)**:Add → Volumes → **Post Process Volume** → 勾 **Infinite Extent(Unbound)** → Exposure → **Metering Mode = Manual**。
5. 编辑器里灯的**放射状白线是选中辅助线**,取消选中/渲染时不显示。

---

## 一页速查(坑清单)
- 给 Mixamo:**OBJ,不是 UE-FBX**(FBX 厘米单位→巨大)。
- Mixamo 标记点:手肘手臂正中、膝盖腿弯、下巴贴头底。
- 下载:FBX Binary + With Skin(首个),额外动画 Without Skin。
- UE 导入尺寸小 → Import Uniform Scale 100。
- 动画不动 → 拖到角色轨上重加,片段移到帧0。
- **别重复 Create Camera / 删摄像机** → Camera Cuts 绑定会断。
- 打关键帧用 Transform 行的 ◆,**红圈是录制不是 Auto-key**。
- 轮廓光**关 Cast Shadows**,免得影子打架。
- 暗场加 Post Process Volume + Manual Exposure 锁曝光。
