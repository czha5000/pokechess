# UE 角色资产规范(命名 / 目录 / 加新角色 SOP)

> 2026-09-12 起生效。此前 4 只角色(超梦/伊布/暴鲤龙/皮卡丘)已全部按此搬迁改名,旧目录 `Meshes/`、`Gyarados/`、`Mewtwo_anim/`、`_TempDiag/` 已删除。
> 角色是数据:**加一只角色 = 放好资产 + `DT_Species` 加一行**,不改任何蓝图。

## 1. 目录与命名(硬性)

```
/Game/Characters/<Species>/                  <Species> = 行名首字母大写:Mewtwo / Eevee / Gyarados / Pikachu
    SK_<Species>                             骨骼网格(唯一)
    SK_<Species>_Skeleton                    骨架(导入时自动生成,跟着网格改名)
    SK_<Species>_PhysicsAsset                物理资产(可选)
    Animations/
        A_<Species>_Idle                     循环,站立
        A_<Species>_Walk                     循环,前进(暴鲤龙的 Swim 也叫 Walk——名字表达"用途",不表达"动作内容")
        A_<Species>_WalkBackward             循环,后退
        A_<Species>_Attack                   一次性,普通攻击
        A_<Species>_Magic                    一次性,元素技能
        A_<Species>_Hurt                     一次性,受击
        A_<Species>_Death                    一次性,死亡(末帧定住)
    Materials/
        M_<Species>_<部位>                   材质,部位用英文单词(Fur / Eyes / Teeth …),不要用导出器给的 "Cyan_•_raised_diamond_scales" 这种
        T_<Species>_<用途>                   贴图
```

- **7 个动作名固定**,一个不能少、也不要多。`BP_Unit` 的 7 个动画变量按用途一一对应(Idle→`IdleAnimAsset`、Walk→`WalkForwardAnim`、WalkBackward→`WalkBackwardAnim`、Attack→`PunchAttackAnim`、Magic→`MagicAttackAnim`、Hurt→`ReactionAnim`、Death→`DyingAnim`),类型必须是 **AnimSequence**。
- 行名(`DT_Species` Row Name)= 目录名小写:`mewtwo / eevee / gyarados / pikachu`。DBG 面板、`ParseSpeciesCsv` 中文名/行名都认。
- 版本迭代(v2、Revision…)**不进资产名**。新版本直接覆盖同名资产(重导入)或先导到临时目录、验收后 `move` 顶替;旧版本不留在工程里(源文件在 `art-pipeline/output/` 和 git)。
- 每只角色一副独立 Skeleton,**不要**把新角色的动画绑到别的角色骨架上。
- 通用/共享的东西不放这里:战斗蓝图在 `Maps/`,UI 在 `UI/`,表在 `Data/`,特效在 `VFX/`。

## 2. 数据:`DT_Species`(`/Game/Data/DT_Species`)

| 列 | 含义 |
|---|---|
| `DisplayName` | 中文名,DBG 下拉显示 |
| `MaxHP / Atk / Def / Spd / MoveRange / AtkRange` | 基础数值,对应 web `js/data/creatures.js`;web 没有的角色自己拍初稿,走 `balance/SKILL.md` 调 |
| `AtkType` | 0–17,对照 `属性克制配置.md` 第 1 节(0 normal 1 fire 2 water 3 grass 4 electric 5 ghost 6 flying 7 fighting 8 rock 9 poison 10 dark 11 ground 12 bug 13 ice 14 steel 15 psychic 16 fairy 17 dragon)。2026-09-12 起克制走 `DT_TypeChart` 全表,任何 id 都安全 |
| `Mesh` + 7 个 `*Anim` | 硬引用,按第 1 节规则可以机械推出 |
| `MeshRelativeLocation.Z` | `-88 - 模型局部最低点Z × Scale`(88 = 胶囊半高),`add_species.py` 自动算 |
| `MeshRelativeRotation.Yaw` | **必须 A/B 拍照定**(第 3 步),Blender 管线出来的通常是 0,Mixamo 类通常 270 |
| `MeshRelativeScale` | 厘米网格 = 1;米制/灰模才需要 0.15、54 这种 |

CSV 备档 `js/data/ue_import/DT_Species.csv`(BOM + `---` 首列)。**资产才是真相**,脚本会同步 CSV,手改表记得也改 CSV。

## 3. 加一只新角色(SOP)

1. **导入**:`SkeletalMeshTools.import_file`(或编辑器手动)把 FBX 导到 `/Game/Characters/<Species>/`,网格命名 `SK_<Species>`;7 个动画 FBX 各导一次,`skeleton` 传 `SK_<Species>_Skeleton`。导出参数按 `UE美术管线.md`(`global_scale=1` + `apply_unit_scale=True` + `FBX_SCALE_NONE`)。
2. **整理**:**导出前在 Blender 里核对法线朝外**(贴片类部件——眼睛、腮红、花纹——很容易整片朝内,Blender 双面渲染看不出,UE 单面剔除后直接消失;`pikachu_fix_face_normals_v1.py` 是现成的检查+翻转脚本)。每个动画 FBX 会顺带生成一个重复网格 `<Name>`(和 `<Name>_Anim` 成对)——`get_referencers` 确认零引用后 **删掉**;`_Anim` 改名成 `A_<Species>_<动作>` 搬进 `Animations/`;材质改名进 `Materials/`。`AssetTools.move` 会自动修引用、不留重定向器。
3. **朝向 A/B**(不可跳过,坑105):编辑器里 `add_to_scene_from_asset` 把 `SK_<Species>` 摆到 `(10000,10000,0)`、Rot 0,`CaptureViewport` 分别从 +X 侧(`x=10200, yaw=180`)和 -X 侧(`x=9800, yaw=0`)各拍一张——**哪张看得到脸,脸就朝哪边**。脸朝 +X → `Yaw=0`;脸朝 -X → `Yaw=180`;朝 ±Y → 270/90。拍完 `remove_from_scene`。
4. **写表**:
   ```
   python ue/tools/add_species.py <id> <中文名> --hp .. --atk .. --def .. --spd .. --mov .. --rng .. --type 0 --scale 1 --yaw <第3步>
   ```
   脚本会核对 8 个资产、量 bounds 算 Z、写 DataTable、更新 CSV。`--check` 只核对不写。
5. **看一眼**:DBG(左 Ctrl)阵容下拉里选它 → 应用阵容并重开;或临时改 `TestMap` 里 `BP_GridManager` 放置实例的 `DefaultAllyRoster`(改 CDO 没用,实例有自己的值)开 PIE,`get_properties` 读 `SpeciesId/CurrentLocoAnim/CharacterMesh0.SkeletalMeshAsset`。
6. **文档**:`UE蓝图状态.md` 的 `## DT_Species` 表格加一行;数值初稿写进 `UE规则对齐表.md` 的"单位基础数值"行。

## 3b. 替换已有角色的网格 / 某个动画(不改名、不改表结构)

1. `SkeletalMeshTools.import_file` 导到 `/Game/Characters/<S>/_Import/`(`skeleton` 传现有 `SK_<S>_Skeleton`;换网格时 `import_materials=false`,之后用 `set_material` 把 5 个槽指回 `M_<S>_*`,`assign_physics_asset` 指回物理资产)。
2. `DataTableTools.set_rows` 把表里对应列**先指向 `_Import` 里的新资产**(否则删旧资产会被引用挡住)。
3. `AssetTools.delete` 旧资产 → `AssetTools.move` 新资产到旧名字(表引用自动跟回)→ `delete` `_Import` 里的副本和目录 → `save_assets`。
4. `get_rows` 复读 + PIE 里 `get_properties` 看 `CharacterMesh0.SkeletalMeshAsset` / `MagicAttackAnim.SequenceLength`。

## 4. 现有角色(2026-09-12 快照)

| 行名 | 名 | 网格 | Yaw | Scale | Z | 备注 |
|---|---|---|---|---|---|---|
| mewtwo | 超梦 | `SK_Mewtwo`(Mixamo 灰模,局部尺寸 ≈2 cm) | 270 | 54.294 | -80 | 唯一还在用 Mixamo 命名来源的;单材质 |
| eevee | 伊布 | `SK_Eevee`(EeveeV6) | 0 | 0.75 | -88.173 | 8 材质 + 1 贴图 |
| gyarados | 暴鲤龙 | `SK_Gyarados`(v3_4_Revision_CM) | 270 | 0.15 | -93.54 | 14 材质(敌我靠脚下光环,不再染材质) |
| pikachu | 皮卡丘(电,AtkType 4) | `SK_Pikachu`(V1,法线修复版) | 0 | 1 | -88 | 90 cm;Magic = 放电版 81 帧。导出源 `art-pipeline/output/pikachu/v1/animation/magic_discharge/pikachu_v1_magic_discharge.blend`,脚本 `scripts/pikachu_export_v2.py` |
