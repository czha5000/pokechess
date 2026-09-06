# -*- coding: utf-8 -*-
"""
实验 5 v5:bpy 程序化建模伊布——「手办质感版」。

v5(2026-09-06 用户给了手办渲染参考图,明确「要更像真实伊布的材质」,不走赛璐璐):
1. **表面回归光滑**:删掉 v2 的毛皮噪声位移——参考图是黏土般的哑光光滑曲面,
   噪声在 UE 默认光照下只会变成高光碎斑(2026-09-06 UE 同屏对比实拍验证)。
2. **毛簇改雕塑化**:围脖从「尖刺锥」改成两排下垂的圆润毛绺(长锥体+体素融合磨圆),
   参考图的围脖是一撮撮垂下来的软毛,不是刺猬。
3. **PBR 材质分层**:毛=高粗糙度哑光;眼睛=近黑高光泽(玻璃珠感);鼻子=半光泽。
   这些是 Principled BSDF 参数,**能随 GLB/FBX 进 UE**,赛璐璐节点树则出不去。
4. **软光渲染预览**:三点面光 + 米色地面/背景,复刻参考图的柔光棚拍感。
   (赛璐璐 toonify/Freestyle 代码保留在文件里但 v5 不再调用。)

—— 以下为 v2 的历史说明 ——

v1(球堆版)的问题:部件接缝全部可见,腿像气球动物,没有肌肉起伏 → 玩具感。
v2 的解法(2026-09-06 用户反馈「太卡通,要更像真的」):

1. **体素融合**:身体所有部件(躯干/头/腿/围脖/尾巴)先摆好,join 成一个对象后
   体素重网格 → 接缝彻底消失,变成一张连续的有机曲面,像雕出来的而不是拼出来的。
2. **解剖结构**:后腿加臀肌团、前腿加肩肌、腿分上下两段加脚掌 → 四足动物的体块感。
3. **毛皮噪声**:融合后叠一层很轻的 Clouds 位移(±8mm) → 表面不再是数学球面。
4. **颜色重分配**:融合会丢材质,用 BVH 最近表面查询把每个面重新分给棕/奶油。
5. 需要保持锐利的部件(锥形耳朵、眼睛、鼻子)不参与融合,最后再 join 进来。

坐标约定不变:+Y 脸朝向,+Z 向上,脚底 z=0,总高约 1m。
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import _common as C  # noqa: E402

# ---------------------------------------------------------------- 材质

PALETTE = {
    # v5 对照手办参考图校色:手办是柔和的浅茶棕 + 灰奶油,比官图动画色淡一档
    "brown": (0.58, 0.38, 0.20, 1.0),       # 主体毛色(浅茶棕)
    "dark": (0.26, 0.14, 0.08, 1.0),        # 内耳(哑光深棕)
    "cream": (0.88, 0.84, 0.74, 1.0),       # 围脖/尾尖(灰奶油,参考图偏灰)
    "nose": (0.06, 0.04, 0.03, 1.0),        # 鼻子
    "white": (0.98, 0.98, 0.98, 1.0),       # 眼睛高光
    "eye": (0.05, 0.03, 0.02, 1.0),         # 眼珠(近黑,靠低粗糙度出玻璃感)
    "tongue": (0.85, 0.45, 0.45, 1.0),      # 舌头(粉)
}

# v5 每种材质的 PBR 粗糙度:毛哑光、眼珠像玻璃珠、鼻子半湿润。
# 这些参数 glTF/FBX 都认,会原样带进 UE 的 Lit 材质
ROUGHNESS = {
    "brown": 0.92,
    "dark": 0.92,
    "cream": 0.90,
    "nose": 0.35,
    "white": 0.25,
    "eye": 0.08,
    "tongue": 0.55,
}


def make_materials():
    mats = {}
    for name, rgba in PALETTE.items():
        mat = bpy.data.materials.new("Eevee_" + name)
        # Workbench 的 MATERIAL 配色读的是 viewport display color
        mat.diffuse_color = rgba
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = rgba
            bsdf.inputs["Roughness"].default_value = ROUGHNESS[name]
        mats[name] = mat
    return mats


# ---------------------------------------------------------------- 基础件

def add_sphere(name, loc, scale, mat, rot=(0, 0, 0), segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.scale = scale
    obj.rotation_euler = Euler(rot)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def add_cone(name, loc, r1, depth, mat, rot=(0, 0, 0), scale=(1, 1, 1), r2=0.004):
    """锥体。耳朵用默认尖头(r2=0.004);毛绺传大一点的 r2(圆钝尖,体素融合后
    才是软毛感——v5 第 2 版教训:尖头锥的尖端撑过融合,渲出来像蜡滴)。"""
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r1, radius2=r2, depth=depth, location=loc)
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    obj.rotation_euler = Euler(rot)
    obj.scale = scale
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


# ---------------------------------------------------------------- 可融合部件

def build_fusible(mats):
    """
    返回 (brown_parts, cream_parts, tail)。
    这三组之后 join 成一个对象做体素融合;颜色靠 BVH 最近表面查询恢复。
    """
    brown = []
    cream = []

    # --- 躯干:主体 + 胸腔。v3 对照官图:身体缩短、胸抬高 → 挺胸抬头的坐姿感,
    # 不是 v2 那种四平八稳的香肠狗
    brown.append(add_sphere("body", (0, -0.10, 0.33), (0.20, 0.26, 0.19), mats["brown"]))
    brown.append(add_sphere("chest", (0, 0.10, 0.38), (0.18, 0.16, 0.17), mats["brown"]))
    # 脖子:填掉头和躯干之间的缝(藏在围脖下面)
    brown.append(add_sphere("neck", (0, 0.15, 0.50), (0.14, 0.14, 0.13), mats["brown"]))

    # --- 头:抬高 + 两颊加宽(官图是宽脸)。脸是平的!官图几乎没有吻部,
    # v2 的两段式长吻是「像狗不像伊布」的主因,只留一个小鼓包
    brown.append(add_sphere("head", (0, 0.20, 0.64), (0.225, 0.20, 0.20), mats["brown"]))
    for sx in (+1, -1):
        brown.append(add_sphere("cheek" + ("L" if sx > 0 else "R"),
                                (0.10 * sx, 0.30, 0.58), (0.075, 0.075, 0.07), mats["brown"]))
    brown.append(add_sphere("muzzleBump", (0, 0.385, 0.59), (0.06, 0.05, 0.05), mats["brown"]))

    # v5 头顶呆毛:进融合组(体素会把锥尖磨圆成软毛绺,不会像犄角)。
    # 参考手办:两耳之间一撮向前上方翘的大毛簇,前倾 40° 左右
    fringe = [
        ((0.00, 0.26, 0.83), (math.radians(40), 0, 0), 0.060, 0.16),
        ((0.075, 0.25, 0.81), (math.radians(44), 0, math.radians(24)), 0.045, 0.11),
        ((-0.075, 0.25, 0.81), (math.radians(44), 0, math.radians(-24)), 0.045, 0.11),
    ]
    for i, (loc, rot, r1, depth) in enumerate(fringe):
        brown.append(add_cone("fringe%02d" % i, loc, r1, depth, mats["brown"],
                              rot=rot, scale=(1.0, 0.6, 1.0), r2=0.016))

    # --- 四足肌肉:后腿臀团、前腿肩团(v1 缺这个,腿是直接插在球上的)
    for sx in (+1, -1):
        # 臀团要往身体里埋(x 0.125),太靠外融合后会凸出一个独立的球形轮廓
        brown.append(add_sphere("haunch" + ("L" if sx > 0 else "R"),
                                (0.125 * sx, -0.26, 0.27), (0.085, 0.13, 0.12), mats["brown"]))
        brown.append(add_sphere("shoulder" + ("L" if sx > 0 else "R"),
                                (0.115 * sx, 0.13, 0.32), (0.07, 0.09, 0.10), mats["brown"]))

    # --- 腿:上段粗下段细 + 脚掌。v3 比 v2 更细(官图是细腿),但别回到气球腿
    for sx in (+1, -1):
        s = "L" if sx > 0 else "R"
        # 前腿
        brown.append(add_sphere("legF%s_up" % s, (0.10 * sx, 0.15, 0.20), (0.048, 0.052, 0.13), mats["brown"]))
        brown.append(add_sphere("legF%s_lo" % s, (0.10 * sx, 0.145, 0.08), (0.040, 0.043, 0.080), mats["brown"]))
        brown.append(add_sphere("pawF%s" % s, (0.10 * sx, 0.16, 0.04), (0.050, 0.065, 0.040), mats["brown"]))
        # 后腿(大腿被臀团盖住,只出小腿和脚)
        brown.append(add_sphere("legB%s_lo" % s, (0.125 * sx, -0.28, 0.085), (0.042, 0.046, 0.085), mats["brown"]))
        brown.append(add_sphere("pawB%s" % s, (0.125 * sx, -0.26, 0.04), (0.052, 0.066, 0.042), mats["brown"]))

    # --- 围脖:底座 + 胸前一团 + 一圈短尖簇(融合后会变成连绵的毛领)。
    # 底座别太高:顶过头底时奶油色会爬上后颈变成兜帽
    cream.append(add_sphere("ruffBase", (0, 0.12, 0.46), (0.29, 0.27, 0.15), mats["cream"]))
    cream.append(add_sphere("ruffChest", (0, 0.20, 0.38), (0.15, 0.13, 0.12), mats["cream"]))
    tufts = 13
    for i in range(tufts):
        ang = (i / tufts) * 2 * math.pi
        cx = math.sin(ang) * 0.245
        cy = 0.12 + math.cos(ang) * 0.235
        cream.append(
            add_sphere("tuft%02d" % i, (cx, cy, 0.40), (0.060, 0.060, 0.105), mats["cream"],
                       rot=(math.radians(35), 0, -ang), segments=12, rings=8)
        )
    # v5 手办毛绺:参考图的围脖是一撮撮**下垂的软毛绺**,不是 v4 的尖刺。
    # 做法:粗底长锥体、切向压扁(像一片毛),往下外方向垂;体素融合再磨圆一次,
    # 出来就是雕塑感的毛簇。两排错位,下排更长 → 有层次的垂坠感
    for i in range(tufts):
        ang = ((i + 0.5) / tufts) * 2 * math.pi  # 和圆簇错位半格
        cx = math.sin(ang) * 0.255
        cy = 0.12 + math.cos(ang) * 0.245
        cream.append(
            add_cone("lockA%02d" % i, (cx, cy, 0.345), 0.062, 0.18, mats["cream"],
                     rot=(math.radians(158), 0, -ang), scale=(1.0, 0.55, 1.0), r2=0.020)
        )
    for i in range(tufts):
        ang = (i / tufts) * 2 * math.pi  # 和上排再错半格,补空隙
        cx = math.sin(ang) * 0.235
        cy = 0.12 + math.cos(ang) * 0.225
        cream.append(
            add_cone("lockB%02d" % i, (cx, cy, 0.30), 0.050, 0.12, mats["cream"],
                     rot=(math.radians(165), 0, -ang), scale=(1.0, 0.55, 1.0), r2=0.016)
        )

    # 尾巴的毛绺:同样从「刺」改「绺」——更长更圆润,顺着尾巴的流向铺
    # 侧向的绺埋得更深(x 0.13→0.09)、缩短:v5 第 3 版侧视时尖端戳出尾巴像根刺
    tail_fur = [
        ((0.00, -0.58, 0.76), (math.radians(-30), 0, 0), 0.065, 0.20),           # 上缘,指向后上
        ((0.09, -0.52, 0.58), (math.radians(-90), math.radians(35), 0), 0.060, 0.14),   # 左侧
        ((-0.09, -0.52, 0.58), (math.radians(-90), math.radians(-35), 0), 0.060, 0.14), # 右侧
        ((0.05, -0.50, 0.42), (math.radians(-140), math.radians(20), 0), 0.055, 0.13),  # 左下
        ((-0.05, -0.50, 0.42), (math.radians(-140), math.radians(-20), 0), 0.055, 0.13),# 右下
    ]
    for i, (loc, rot, r1, depth) in enumerate(tail_fur):
        cream.append(add_cone("tailFur%02d" % i, loc, r1, depth, mats["cream"],
                              rot=rot, scale=(1.0, 0.6, 1.0), r2=0.018))

    tail = build_tail(mats)
    return brown, cream, tail


def build_tail(mats):
    """贝塞尔曲线 + 沿线倒角一体成型的狐狸尾。前 60% 棕、尖端 40% 奶油。"""
    curve = bpy.data.curves.new("tailCurve", "CURVE")
    curve.dimensions = "3D"
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(3)  # 共 4 个控制点
    # (位置, 该点的粗细):根部埋进屁股 → 中段最蓬 → 上翘收尖
    # v3:官图的尾巴接近半个身子大,加粗加长、翘得更高
    ctrl = [
        ((0, -0.22, 0.36), 0.11),
        ((0, -0.46, 0.46), 0.185),
        ((0, -0.62, 0.66), 0.145),
        ((0, -0.70, 0.92), 0.035),
    ]
    for bp, (co, r) in zip(spline.bezier_points, ctrl):
        bp.co = Vector(co)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
        bp.radius = r
    curve.bevel_depth = 1.0  # 实际粗细由每个控制点的 radius 决定
    curve.bevel_resolution = 8
    curve.resolution_u = 24
    curve.use_fill_caps = True

    obj = bpy.data.objects.new("tail", curve)
    bpy.context.scene.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active

    obj.data.materials.append(mats["brown"])   # 槽 0
    obj.data.materials.append(mats["cream"])   # 槽 1
    for poly in obj.data.polygons:
        poly.material_index = 1 if poly.center.y < -0.50 else 0
    bpy.ops.object.shade_smooth()
    return obj


# ---------------------------------------------------------------- 颜色查询用 BVH

def collect_tris(entries):
    """
    entries: [(obj, wanted_mat_index or None), ...]
    收集这些对象的世界坐标三角面,拼一棵 BVH。
    wanted_mat_index=None 表示整个对象都算;否则只取该材质槽的面(给双色尾巴用)。
    """
    verts = []
    tris = []
    for obj, want in entries:
        mesh = obj.data
        mesh.calc_loop_triangles()
        mw = obj.matrix_world
        base = len(verts)
        verts.extend([mw @ v.co for v in mesh.vertices])
        for lt in mesh.loop_triangles:
            if want is not None and lt.material_index != want:
                continue
            tris.append(tuple(base + i for i in lt.vertices))
    return BVHTree.FromPolygons(verts, tris)


# ---------------------------------------------------------------- 融合

def fuse(brown_parts, cream_parts, tail, mats, voxel=0.011):
    """join → 体素融合 → 平滑 → 毛皮噪声 → BVH 重新上色。"""
    # 1) 先建好颜色查询 BVH(必须在 join 之前,join 会移动/合并网格)
    brown_bvh = collect_tris([(o, None) for o in brown_parts] + [(tail, 0)])
    cream_bvh = collect_tris([(o, None) for o in cream_parts] + [(tail, 1)])

    # 2) join 成一个对象并应用变换(之后 local 坐标 == world 坐标,BVH 查询才对得上)
    parts = brown_parts + cream_parts + [tail]
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = "Eevee_Proc"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # 3) 体素融合:所有接缝消失,变成一张连续曲面
    C.voxel_remesh(obj, voxel)

    # 4) 平滑掉体素台阶。v5 比 v2 多平滑两轮:参考图是黏土般的光滑曲面
    mod = obj.modifiers.new("Smooth", "SMOOTH")
    mod.factor = 0.6
    mod.iterations = 6
    bpy.ops.object.modifier_apply(modifier=mod.name)

    # 5) v5 删掉了 v2 的毛皮噪声位移:UE 同屏对比实拍(2026-09-06)证明
    # 噪声表面在默认 Lit 光照下会变成高光碎斑,而参考手办是光滑哑光的。
    # 毛的「蓬松感」全部交给几何毛绺(围脖/尾巴/刘海)表达

    # 6) 重新上色:每个面查「离棕色原件近还是离奶油原件近」
    obj.data.materials.clear()
    obj.data.materials.append(mats["brown"])   # 槽 0
    obj.data.materials.append(mats["cream"])   # 槽 1
    for poly in obj.data.polygons:
        c = poly.center
        _, _, _, d_brown = brown_bvh.find_nearest(c)
        _, _, _, d_cream = cream_bvh.find_nearest(c)
        poly.material_index = 1 if d_cream < d_brown else 0

    # 7) 颜色边界多数票平滑:BVH 逐面判色会沿体素网格出碎锯齿,
    #    每个面跟邻居投票 2 轮,把孤立色块和楼梯纹抹掉
    smooth_material_boundary(obj, passes=2)

    bpy.ops.object.shade_smooth()
    return obj


def smooth_material_boundary(obj, passes=2):
    mesh = obj.data
    # 边 → 面 的邻接表
    edge_faces = {}
    for poly in mesh.polygons:
        for ek in poly.edge_keys:
            edge_faces.setdefault(ek, []).append(poly.index)
    neighbors = [[] for _ in mesh.polygons]
    for faces in edge_faces.values():
        if len(faces) == 2:
            a, b = faces
            neighbors[a].append(b)
            neighbors[b].append(a)
    idx = [p.material_index for p in mesh.polygons]
    for _ in range(passes):
        nxt = list(idx)
        for i, nbrs in enumerate(neighbors):
            if not nbrs:
                continue
            votes = [idx[i]] + [idx[n] for n in nbrs]
            ones = sum(votes)
            nxt[i] = 1 if ones * 2 > len(votes) else 0
        idx = nxt
    for p, m in zip(mesh.polygons, idx):
        p.material_index = m


# ---------------------------------------------------------------- 锐利部件(不融合)

def build_sharp(mats):
    """耳朵/眼睛/鼻子:融合会把它们糊掉,单独建,最后 join。"""
    parts = []

    # 耳朵:锥体,底大尖小。教训(v2 第 1、2 版):
    # - 底半径太小 + y 压到 0.42 以下会变成刀片
    # - 内耳锥只要长过外耳一半,侧视就会露出第三根刺
    # 修正:内耳压到 0.14 长、贴外耳前面只露出正面一层,侧视只剩两只外耳
    # v3 对照官图:耳朵占全身高近 40%,是伊布轮廓的主角,底半径 0.145 × 高 0.40,
    # 往外撇 30°。内耳深色占外耳前面的大部分面积
    # 教训(v3 第 1 版):底半径 0.145 时两耳中距至少要 0.38,近了底部在头顶交叉打架
    for sx in (+1, -1):
        s = "L" if sx > 0 else "R"
        rot = (math.radians(-10), math.radians(26 * sx), math.radians(-6 * sx))
        parts.append(add_cone("ear" + s, (0.19 * sx, 0.10, 0.96), 0.145, 0.40,
                              mats["brown"], rot=rot, scale=(1.0, 0.50, 1.0)))
        parts.append(add_cone("earIn" + s, (0.185 * sx, 0.135, 0.91), 0.095, 0.22,
                              mats["dark"], rot=rot, scale=(1.0, 0.32, 1.0)))

    # 眼睛:官图的眼睛巨大、朝前、竖椭圆,不是 v2 那种偏侧面的小圆眼。
    # v5:眼珠换专用「eye」材质(近黑 + 粗糙度 0.08),PBR 光照下自带玻璃珠反光;
    # 白色高光球仍保留——手办参考图的高光就是画上去的大白点,两者不冲突
    for sx in (+1, -1):
        s = "L" if sx > 0 else "R"
        parts.append(add_sphere("eye" + s, (0.088 * sx, 0.395, 0.66), (0.062, 0.028, 0.082),
                                mats["eye"], rot=(0, 0, math.radians(-8 * sx))))
        # 高光球贴着眼珠正面放,别越过眼珠外缘——越过去侧视会像浮空的护目镜(v5 第 3 版教训)
        parts.append(add_sphere("eyeHiBig" + s, (0.090 * sx, 0.432, 0.685), (0.016, 0.009, 0.020),
                                mats["white"]))
        parts.append(add_sphere("eyeHiSmall" + s, (0.070 * sx, 0.426, 0.635), (0.008, 0.006, 0.009),
                                mats["white"]))

    # 鼻子:小,贴在平脸的小鼓包上
    parts.append(add_sphere("nose", (0, 0.435, 0.615), (0.020, 0.012, 0.014), mats["nose"]))

    # v5 嘴:参考手办是微张的小嘴 + 一点粉舌。深色小椭球半埋进吻部当口腔,
    # 粉色更小的一颗嵌在下缘当舌头。
    # 第 1 版教训:嘴做到 0.024 宽会跟鼻子连成「猪鼻孔」,压小并下移拉开距离
    parts.append(add_sphere("mouth", (0, 0.438, 0.572), (0.017, 0.009, 0.011), mats["nose"]))
    parts.append(add_sphere("tongue", (0, 0.441, 0.566), (0.010, 0.007, 0.006), mats["tongue"]))

    # (v5 第 1 版教训:呆毛放在 sharp 组里保持锐利,渲出来像三根犄角。
    #  已挪进 build_fusible 的棕色组,让体素融合把它磨成软毛绺。)

    # (v4 第 1 版试过腮毛锥,位置在头颊交界怎么摆都像嘴边长角,删了。
    #  官图的腮毛靠描边+贴图表达,几何做不出来。)
    return parts


def join_final(fused, sharp_parts):
    bpy.ops.object.select_all(action="DESELECT")
    fused.select_set(True)
    for p in sharp_parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = fused
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = "Eevee_Proc"
    return obj


# ---------------------------------------------------------------- 赛璐璐渲染

def toonify_materials():
    """
    把所有 Eevee_* 材质换成两档赛璐璐着色(EEVEE 专用):
    Diffuse → Shader to RGB → ColorRamp(CONSTANT 两档) → Emission。

    注意:这一步必须在「导出 GLB / 保存 blend」**之后**做——
    FBX/glTF 导出器只认 Principled BSDF,换成 toon 节点树后导出就没颜色了。
    """
    for mat in bpy.data.materials:
        if not mat.name.startswith("Eevee_"):
            continue
        base = tuple(mat.diffuse_color)
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
        diff.inputs["Color"].default_value = base
        s2rgb = nt.nodes.new("ShaderNodeShaderToRGB")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "CONSTANT"
        shadow = tuple(c * 0.62 for c in base[:3]) + (1.0,)
        e0 = ramp.color_ramp.elements[0]
        e0.position = 0.0
        e0.color = shadow
        e1 = ramp.color_ramp.elements[1]
        e1.position = 0.40
        e1.color = base
        emis = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(diff.outputs["BSDF"], s2rgb.inputs["Shader"])
        nt.links.new(s2rgb.outputs["Color"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], emis.inputs["Color"])
        nt.links.new(emis.outputs["Emission"], out.inputs["Surface"])


def setup_toon_render():
    """切 EEVEE + Freestyle 深棕描边 + 亮灰背景,复刻官图的赛璐璐观感。"""
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.use_freestyle = True
    scene.render.line_thickness = 1.0
    fs = bpy.context.view_layer.freestyle_settings
    for ls in list(fs.linesets):
        fs.linesets.remove(ls)
    ls = fs.linesets.new("Outline")
    # 只描剪影 + 材质边界。折痕(crease)一开,融合表面的每道起伏都会被画成
    # 碎裂纹(v4 第 1 版的教训)
    ls.select_silhouette = True
    ls.select_external_contour = True
    ls.select_contour = True
    ls.select_material_boundary = True   # 棕/奶油交界描一圈,官图就是这么画的
    ls.select_crease = False
    ls.select_border = False
    ls.linestyle.color = (0.10, 0.05, 0.02)
    ls.linestyle.thickness = 3.0
    if scene.world is None:
        scene.world = bpy.data.worlds.new("ToonWorld")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.92, 0.92, 0.92, 1.0)
        bg.inputs[1].default_value = 1.0
    # AgX 会把 Emission 压灰压暗——赛璐璐要的是「颜色直出」,切 Standard
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"


# ---------------------------------------------------------------- v5 软光棚拍(PBR)

def setup_pbr_render():
    """
    v5 手办质感预览:EEVEE + 三点面光 + 米色地面/背景,复刻参考图的柔光棚拍感。

    和 toonify 的本质区别:**材质一个节点都不改**——渲的就是导出 GLB/FBX 用的那套
    Principled 参数,所以这里看到的质感(哑光毛/玻璃珠眼)和 UE Lit 里的是同一回事,
    预览不再「美化」模型。
    """
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.use_freestyle = False

    # 清掉 workbench 相机带的太阳灯:方向硬、会在软光里投出第二层锐利影子
    for o in list(bpy.data.objects):
        if o.name.startswith("PipeKey"):
            bpy.data.objects.remove(o, do_unlink=True)

    # 米色无缝背景,同时兼当环境光(强度别抢主光)
    if scene.world is None:
        scene.world = bpy.data.worlds.new("StudioWorld")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.80, 0.76, 0.72, 1.0)
        bg.inputs[1].default_value = 0.30

    # 地面:接柔和落影用(不参与 GLB 导出,export_glb 是 use_selection 只导模型)
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
    floor = bpy.context.view_layer.objects.active
    floor.name = "StudioFloor"
    fm = bpy.data.materials.new("StudioFloorMat")
    fm.use_nodes = True
    fb = fm.node_tree.nodes.get("Principled BSDF")
    if fb:
        fb.inputs["Base Color"].default_value = (0.80, 0.75, 0.70, 1.0)
        fb.inputs["Roughness"].default_value = 1.0
    floor.data.materials.append(fm)

    def area(name, loc, energy, size):
        """一盏对着模型胸口打的面光。面光越大影子越软,棚拍感就是这么来的。"""
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.size = size
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = Vector(loc)
        direction = Vector((0, 0.1, 0.5)) - light.location
        light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return light

    # 曝光教训(v5 第 1 版):Standard 视图变换没有高光滚降,320W 主光直接把
    # 浅茶棕冲成奶白。能量全部减半以下,靠面光的「大」而不是「亮」出软感
    area("KeyLight", (1.4, 1.8, 2.2), 105, 2.0)    # 主光:右前上
    area("FillLight", (-1.8, 0.6, 1.2), 40, 2.5)   # 补光:左侧,压暗部反差
    area("RimLight", (0.2, -2.0, 1.8), 80, 1.5)    # 轮廓光:后方,把毛边从背景里拉出来

    # 软光棚拍不会爆高光,Standard 保浅茶棕的饱和度(AgX 会压灰,v4 教训)
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"


# ---------------------------------------------------------------- 渲染对照

def render_views(obj, out_dir, prefix, setup_camera=True):
    """
    setup_camera=False 时复用已有相机、**不碰渲染引擎**。
    坑(v4 第 2 版):setup_workbench_camera 内部会把引擎重置回 Workbench,
    赛璐璐那趟如果重跑它,toon 材质/Freestyle/EEVEE 全部白设。
    """
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mn = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    mx = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    center = (mn + mx) * 0.5
    size = mx - mn
    dist = max(size) * 2.2
    scene = bpy.context.scene
    if setup_camera or scene.camera is None:
        C.setup_workbench_camera(center, dist)
        scene.display.shading.show_cavity = True
    cam = scene.camera
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024

    offsets = {
        "front": Vector((0, dist, size.z * 0.15)),
        "left": Vector((dist, 0, size.z * 0.15)),
        "back": Vector((0, -dist, size.z * 0.15)),
        "three_quarter": Vector((dist * 0.72, dist * 0.85, size.z * 0.35)),
    }
    shots = {}
    for view, off in offsets.items():
        cam.location = center + off
        direction = center - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        path = out_dir / ("%s_%s.png" % (prefix, view))
        C.render_still(path)
        shots[view] = str(path)
    return shots


def main():
    C.configure_stdio()
    args = C.parse_args({"--out-dir": str})
    out_dir = C.ensure_dir(args.get("--out-dir") or (HERE.parent / "output" / "compare"))

    C.reset_scene()
    mats = make_materials()

    brown, cream, tail = build_fusible(mats)
    fused = fuse(brown, cream, tail, mats)
    sharp = build_sharp(mats)
    obj = join_final(fused, sharp)

    # 先导出(材质是 Principled + v5 粗糙度分层,导出器全认),再渲两套对照图:
    # Workbench(看形)+ 软光 PBR(看质感,和 UE Lit 同一套材质参数)
    glb_path = HERE.parent / "output" / "eevee_proc.glb"
    C.export_glb(obj, glb_path)
    blend_path = HERE.parent / "output" / "eevee_proc.blend"

    shots = render_views(obj, out_dir, "proc")
    setup_pbr_render()
    pbr_shots = render_views(obj, out_dir, "pbr", setup_camera=False)
    shots.update({("pbr_" + k): v for k, v in pbr_shots.items()})

    # 存盘放在棚拍搭好之后:打开 blend 直接就是软光场景,不用重新布光
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    analysis = C.analyze_mesh(obj, "proc")
    report = {
        "experiment": 5,
        "version": "v5_figurine",
        "name": "procedural_eevee",
        "verts": analysis["verts"],
        "faces": analysis["faces"],
        "paw_count": analysis["paw_count"],
        "bbox": analysis["bbox"],
        "shots": shots,
        "glb": str(glb_path),
        "blend": str(blend_path),
        "notes": [
            "v5 手办质感:删噪声位移(UE Lit 下是高光碎斑),表面回归光滑;围脖/尾巴改两排下垂毛绺。",
            "PBR 材质分层:毛 roughness 0.9 哑光,眼珠 0.08 玻璃珠,鼻 0.35;参数随 GLB/FBX 进 UE。",
            "预览渲染 = 导出材质本身(软光棚拍,无 toon 节点),预览不再美化模型。",
            "颜色在融合后用 BVH 最近表面查询重新分配(棕/奶油);耳/眼/鼻/嘴不融合保锐利。",
        ],
    }
    C.write_json(HERE.parent / "reports" / "05_proc_eevee.json", report)
    print("VERTS", analysis["verts"], "FACES", analysis["faces"], "PAWS", analysis["paw_count"])
    print("DONE proc")


if __name__ == "__main__":
    main()
