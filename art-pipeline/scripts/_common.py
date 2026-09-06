# -*- coding: utf-8 -*-
"""
四足管线在 Blender 里共用的小工具。

这份文件会被 01/02/03 三个脚本 import。
它故意不依赖仓库外的包,只使用 Blender 自带的 bpy / mathutils。

给初级同学的坐标约定(非常容易混):
- Blender 世界:Z 向上,Y 向前,-X/X 是左右。
- Hunyuan 导出的 glTF 常常是 Y 向上。Blender 导入 glb 时会自动转一次,
  所以脚本里永远读「导入之后」的世界坐标,不要去猜文件里原来的轴。
"""

from __future__ import annotations

import json
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def configure_stdio():
    """Windows 控制台默认 cp1252,打印中文会崩。坑 86:先切 utf-8。"""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass


def argv_after_double_dash():
    """
    Blender 启动命令是:
        blender --background --python script.py -- --input xx.glb --out-dir yy
    「--」前面是给 Blender 自己的,后面才是我们的参数。
    """
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def parse_args(pairs):
    """极简 argv 解析,避免 Blender 自带 Python 没有 argparse 的边角坑。

    pairs 例子: {"--input": str, "--voxel": float}
    缺省的键不会出现在返回值里。
    """
    raw = argv_after_double_dash()
    out = {}
    i = 0
    while i < len(raw):
        key = raw[i]
        if key in pairs and i + 1 < len(raw):
            caster = pairs[key]
            out[key] = caster(raw[i + 1])
            i += 2
        else:
            i += 1
    return out


def ensure_dir(path):
    Path(path).mkdir(parents=True, exist_ok=True)
    return Path(path)


def reset_scene():
    """背景模式从空场景开始,避免默认 Cube 污染包围盒。"""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path):
    """导入 glb,返回场景里体积最大的 Mesh 物体(Hunyuan 有时会带空物体)。"""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new_objs = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new_objs if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("glb 里没有 Mesh: %s" % path)
    # 选包围盒体积最大的那只,丢掉辅助空物体
    meshes.sort(key=lambda o: _bbox_volume(o), reverse=True)
    mesh = meshes[0]
    mesh.name = "CreatureMesh"
    # 把其它新物体藏起来,后面分析不会被干扰
    for o in new_objs:
        if o != mesh:
            o.hide_set(True)
            o.hide_render = True
    return mesh


def _bbox_volume(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return max(1e-9, (max(xs) - min(xs)) * (max(ys) - min(ys)) * (max(zs) - min(zs)))


def world_verts(obj):
    """物体所有顶点的世界坐标列表。"""
    mw = obj.matrix_world
    return [mw @ v.co.copy() for v in obj.data.vertices]


def bbox_of_points(points):
    xs = [p.x for p in points]
    ys = [p.y for p in points]
    zs = [p.z for p in points]
    mn = Vector((min(xs), min(ys), min(zs)))
    mx = Vector((max(xs), max(ys), max(zs)))
    size = mx - mn
    center = (mn + mx) * 0.5
    return {
        "min": [mn.x, mn.y, mn.z],
        "max": [mx.x, mx.y, mx.z],
        "size": [size.x, size.y, size.z],
        "center": [center.x, center.y, center.z],
        "height": size.z,
        "length": size.y,
        "width": size.x,
    }


def analyze_mesh(obj, label):
    """统计顶点数/面数/包围盒,并尝试找出脚掌、头、尾巴。"""
    points = world_verts(obj)
    box = bbox_of_points(points)
    paws = cluster_paws(points, box)
    head = guess_head(points, box)
    tail = guess_tail(points, box)
    neck = guess_neck_ruff(points, box, head)
    return {
        "label": label,
        "object": obj.name,
        "verts": len(obj.data.vertices),
        "faces": len(obj.data.polygons),
        "bbox": box,
        "paws": paws,
        "head": head,
        "tail": tail,
        "neck_ruff": neck,
        "paw_count": len(paws),
    }


def cluster_paws(points, box, slice_ratio=0.12, min_sep_ratio=0.12):
    """
    脚掌检测:

    1. 只看最下面 12% 高度的顶点(脚应该贴地)。
    2. 用贪心聚类:一个点离已有簇中心够远就开新簇。
    3. 按「前/后 × 左/右」最多收 4 个最大簇。

    这不是精确解剖学,只回答「这只灰模有没有分得开的四条腿」。
    """
    height = max(box["height"], 1e-6)
    z_cut = box["min"][2] + height * slice_ratio
    low = [p for p in points if p.z <= z_cut]
    if not low:
        return []

    min_sep = max(box["width"], box["length"]) * min_sep_ratio
    clusters = []
    for p in low:
        placed = False
        for c in clusters:
            dx = p.x - c["sum"].x / c["n"]
            dy = p.y - c["sum"].y / c["n"]
            if math.hypot(dx, dy) < min_sep:
                c["sum"] += p
                c["n"] += 1
                placed = True
                break
        if not placed:
            clusters.append({"sum": p.copy(), "n": 1})

    clusters.sort(key=lambda c: c["n"], reverse=True)
    paws = []
    for c in clusters[:6]:
        center = c["sum"] / c["n"]
        paws.append(
            {
                "x": center.x,
                "y": center.y,
                "z": center.z,
                "n": c["n"],
            }
        )

    # 若超过 4 个,按「离身体中心最远的 4 个」丢掉碎噪声
    if len(paws) > 4:
        cx, cy = box["center"][0], box["center"][1]
        paws.sort(key=lambda p: math.hypot(p["x"] - cx, p["y"] - cy), reverse=True)
        paws = paws[:4]
    return paws


def guess_head(points, box):
    """头:取 Y 最大(身体前方)且 Z 偏高的顶点平均。"""
    y_cut = box["min"][1] + box["length"] * 0.72
    z_cut = box["min"][2] + box["height"] * 0.45
    cand = [p for p in points if p.y >= y_cut and p.z >= z_cut]
    if not cand:
        cand = [p for p in points if p.y >= y_cut]
    if not cand:
        return {"x": box["center"][0], "y": box["max"][1], "z": box["max"][2]}
    acc = Vector((0, 0, 0))
    for p in cand:
        acc += p
    acc /= len(cand)
    return {"x": acc.x, "y": acc.y, "z": acc.z, "n": len(cand)}


def guess_tail(points, box):
    """尾巴:取 Y 最小(身体后方)的一团。伊布尾巴又大又翘,Z 不会贴地。"""
    y_cut = box["min"][1] + box["length"] * 0.22
    cand = [p for p in points if p.y <= y_cut]
    if not cand:
        return {"x": box["center"][0], "y": box["min"][1], "z": box["center"][2]}
    acc = Vector((0, 0, 0))
    for p in cand:
        acc += p
    acc /= len(cand)
    return {"x": acc.x, "y": acc.y, "z": acc.z, "n": len(cand)}


def guess_neck_ruff(points, box, head):
    """
    脖圈(伊布那圈奶油色围脖)检测:

    Hunyuan 灰模几乎一定把围脖和身体焊成一体。我们量的是:
    「头后面、半身高附近」这一圈的宽度,是不是明显比腹部宽。
    宽很多 = 围脖作为体积存在(可以后来单独加骨头);
    和腹一样宽 = 围脖没被做出来,或完全糊进身体。
    """
    y0 = box["center"][1]
    y1 = head["y"]
    z0 = box["min"][2] + box["height"] * 0.35
    z1 = box["min"][2] + box["height"] * 0.75
    band = [p for p in points if min(y0, y1) <= p.y <= max(y0, y1) and z0 <= p.z <= z1]
    belly = [p for p in points if abs(p.y - box["center"][1]) < box["length"] * 0.08]
    ruff_width = 0.0
    belly_width = 0.0
    if band:
        ruff_width = max(p.x for p in band) - min(p.x for p in band)
    if belly:
        belly_width = max(p.x for p in belly) - min(p.x for p in belly)
    welded = True
    if belly_width > 1e-6:
        # 围脖比肚子宽 18% 以上,认为「体积在」,但仍和身体同一片网格 = 焊死
        welded = ruff_width < belly_width * 1.18
    return {
        "ruff_width": ruff_width,
        "belly_width": belly_width,
        "wider_than_belly": ruff_width >= belly_width * 1.18 if belly_width else False,
        "welded_to_body": welded,
        "note": "Hunyuan 灰模的围脖几乎总会和身体共面,焊死是预期,不是实验失败。",
    }


def voxel_remesh(obj, voxel_size):
    """
    体素重网格:把烂三角面变成比较均匀的网格,自动权重才有机会。

    注意:体素重网格**不会**把已经焊死的腿切开,它只是换拓扑。
    「腿分不分开」要看脚掌聚类,不要看重网格本身。
    """
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    obj.data.remesh_voxel_size = float(voxel_size)
    obj.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
    return obj


def decimate(obj, ratio):
    """面数还是太多时再减面。ratio=0.4 表示留下 40%。"""
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new(name="Decimate", type="DECIMATE")
    mod.ratio = float(ratio)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def write_json(path, data):
    ensure_dir(Path(path).parent)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def setup_workbench_camera(look_at, distance, name="PipeCam"):
    """放一盏灯 + 一台 3/4 视角相机,给验收截图用。"""
    look = Vector(look_at)
    loc = look + Vector((distance * 0.75, -distance * 0.95, distance * 0.55))
    cam_data = bpy.data.cameras.new(name)
    cam = bpy.data.objects.new(name, cam_data)
    bpy.context.scene.collection.objects.link(cam)
    direction = look - loc
    cam.location = loc
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    light_data = bpy.data.lights.new(name="PipeKey", type="SUN")
    light_data.energy = 3.0
    light = bpy.data.objects.new("PipeKey", light_data)
    bpy.context.scene.collection.objects.link(light)
    light.location = loc
    light.rotation_euler = cam.rotation_euler

    fill = bpy.data.lights.new(name="PipeFill", type="AREA")
    fill.energy = 80.0
    fill_obj = bpy.data.objects.new("PipeFill", fill)
    bpy.context.scene.collection.objects.link(fill_obj)
    fill_obj.location = look + Vector((-distance * 0.4, distance * 0.2, distance * 0.8))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 768
    scene.render.film_transparent = False
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    return cam


def setup_silhouette_camera(look_at, size):
    """
    棋盘可读预览用的侧视偏 3/4。

    角色在 Blender 里脸朝 +Y。从 +X 看,走路抬腿、前扑、侧倒的剪影都在画面里。
    后侧 3/4 会把脸和前爪挡在围脖后面,六条片子看起来都像站着。
    """
    look = Vector(look_at)
    dist = max(size) * 2.6
    if bpy.context.scene.camera is None:
        setup_workbench_camera(look, dist)
    cam = bpy.context.scene.camera
    # 主要在侧面(+X),略偏前方(+Y),避免正侧变成一条竖线
    cam.location = look + Vector((dist * 1.15, dist * 0.35, dist * 0.22))
    cam.rotation_euler = (look - cam.location).to_track_quat("-Z", "Y").to_euler()
    return cam


def render_still(filepath):
    ensure_dir(Path(filepath).parent)
    bpy.context.scene.render.filepath = str(filepath)
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    return filepath


def export_glb(obj, filepath):
    ensure_dir(Path(filepath).parent)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        use_selection=True,
        export_format="GLB",
        export_yup=True,
    )


def export_fbx(filepath, objects):
    """
    导出给 UE 的 FBX。

    单位:Blender 默认 1.0 = 1 米;UE 默认 1.0 = 1 厘米。
    编辑器里拖 FBX 进 Content 时 Interchange 会做 Convert Scene(×100),
    但 MCP `SkeletalMeshTools.import_file` **不会**(2026-09-06 实测:
    1.14m 高的伊布进 UE 变成 1.14cm)。所以这里必须把厘米数字写进 FBX 本身。

    FBX_SCALE_NONE 把 unit_scale*global_scale 打进顶点/骨头,文件级 UnitScale 保持 1。
    UE/MCP 按「文件数字 = 厘米」读,不再依赖 Convert Scene。
    用 Blender 再导入这份 FBX 仍会显示约 1.14m——Blender 会把厘米折回米,不能拿来验收。

    朝向:Blender 里脸朝 +Y;UE Character 前方是 +X。导出前给根物体绕 Z 转 -90°,
    导出后转回来。验收:Actor Yaw=0 时,从世界 -X 看是背影,从 +X 看是正脸。
    """
    ensure_dir(Path(filepath).parent)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

    # UE Character 默认前方是局部 +X。这套管线在 Blender 里脸朝 +Y。
    # 现有 axis_forward=-Z / axis_up=Y 进 MCP 后,脸落在 UE 局部 -Y
    # (2026-09-06 实测:从世界 -Y 看是正脸,从 -X 看是侧脸)。
    # 只转骨架根物体即可,网格是它的子物体会跟着转。
    # 导出后立刻转回来,避免 03 把转过的场景存进 .blend、把动画坐标搞乱。
    roots = [obj for obj in objects if obj.parent is None]
    saved_rot = [(obj, obj.rotation_euler.copy()) for obj in roots]
    for obj in roots:
        obj.rotation_euler.z += math.radians(-90.0)
    bpy.context.view_layer.update()

    bpy.ops.export_scene.fbx(
        filepath=str(filepath),
        use_selection=True,
        object_types={"ARMATURE", "MESH"},
        add_leaf_bones=False,
        bake_anim=True,
        bake_anim_use_all_actions=True,
        bake_anim_use_nla_strips=False,
        bake_anim_force_startend_keying=True,
        armature_nodetype="NULL",
        # Blender FBX 插件内部(export_fbx_bin.py 3541-3545):
        #   unit_scale = 米→厘米的 100(apply_unit_scale 开或关都是 100)
        #   FBX_SCALE_NONE 把 unit_scale * global_scale 打进顶点/骨头
        # 所以 global_scale 必须是 1。写成 100 会变成 10000 倍(57 米高的伊布)。
        # FBX_SCALE_ALL 只改文件头 UnitScale,MCP import_file 会忽略 → 又缩回厘米级。
        global_scale=1.0,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_NONE",
        axis_forward="-Z",
        axis_up="Y",
    )
    for obj, rot in saved_rot:
        obj.rotation_euler = rot
    bpy.context.view_layer.update()


def label_paws(paws, box):
    """给脚掌打上 FL/FR/BL/BR,方便绑骨时对骨头。"""
    if not paws:
        return []
    # Y 大 = 前,X 大 = 左(Blender)
    ys = sorted(p["y"] for p in paws)
    mid_y = (ys[0] + ys[-1]) * 0.5
    labeled = []
    for p in paws:
        front = p["y"] >= mid_y
        left = p["x"] >= box["center"][0]
        tag = ("F" if front else "B") + ("L" if left else "R")
        item = dict(p)
        item["tag"] = tag
        labeled.append(item)
    return labeled
