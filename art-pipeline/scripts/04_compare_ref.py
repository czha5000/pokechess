# -*- coding: utf-8 -*-
"""
把 Hunyuan 灰模按正/左/后/3-4 机位渲出来,方便和 eevee-4view 概念图对质量。

不改网格,只看「生成出来的东西到底长什么样」。
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import _common as C  # noqa: E402


def world_bbox(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    mn = Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners)))
    mx = Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners)))
    return mn, mx, (mn + mx) * 0.5, mx - mn


def place_camera(center, size, view):
    """
    Blender: +Y 前,-Y 后,+X 左(从模型看是右?)。
    Hunyuan 导入后伊布脸朝 +Y,脚朝 -Z。
    front = 站在 +Y 看向原点; left = 站在 +X。
    """
    dist = max(size) * 2.2
    offsets = {
        "front": Vector((0.0, dist, size.z * 0.15)),
        "left": Vector((dist, 0.0, size.z * 0.15)),
        "back": Vector((0.0, -dist, size.z * 0.15)),
        "three_quarter": Vector((dist * 0.72, -dist * 0.85, size.z * 0.35)),
    }
    loc = center + offsets[view]
    if "PipeCam" in bpy.data.objects:
        cam = bpy.data.objects["PipeCam"]
    else:
        C.setup_workbench_camera(center, dist)
        cam = bpy.context.scene.camera
    cam.location = loc
    direction = center - loc
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam


def set_workbench(wireframe=False):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.film_transparent = False
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "MATERIAL"
    shading.show_object_outline = True
    shading.show_cavity = True
    if wireframe:
        shading.color_type = "SINGLE"
        bpy.context.space_data  # 背景模式没有 3D view space,改用显示设置
        for obj in bpy.data.objects:
            if obj.type == "MESH":
                obj.show_wire = True
                obj.show_all_edges = True


def render_views(obj, out_dir, prefix):
    mn, mx, center, size = world_bbox(obj)
    print("BBOX", prefix, "size", [round(x, 4) for x in size], "verts", len(obj.data.vertices))
    C.setup_workbench_camera(center, max(size) * 2.2)
    set_workbench(False)
    shots = {}
    for view in ("front", "left", "back", "three_quarter"):
        place_camera(center, size, view)
        path = out_dir / ("%s_%s.png" % (prefix, view))
        C.render_still(path)
        shots[view] = str(path)
        print("SHOT", path.name)
    return shots


def main():
    C.configure_stdio()
    args = C.parse_args({"--glb": str, "--out-dir": str, "--prefix": str})
    repo = HERE.parents[1]
    src = Path(args.get("--glb") or (repo / "eevee-4view" / "Hy3D_mv_grey.glb"))
    out_dir = C.ensure_dir(args.get("--out-dir") or (HERE.parent / "output" / "compare"))
    prefix = args.get("--prefix") or "src"

    C.reset_scene()
    mesh = C.import_glb(src)
    # 给一个浅灰材质,避免导入后纯黑看不清形体
    mat = bpy.data.materials.new("Clay")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.62, 0.62, 0.64, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.55
    if mesh.data.materials:
        mesh.data.materials[0] = mat
    else:
        mesh.data.materials.append(mat)

    shots = render_views(mesh, out_dir, prefix)
    analysis = C.analyze_mesh(mesh, prefix)
    report = {
        "source": str(src),
        "verts": analysis["verts"],
        "faces": analysis["faces"],
        "bbox": analysis["bbox"],
        "paws": analysis["paw_count"],
        "shots": shots,
        "notes": [
            "灰模没有眼睛/鼻子/嘴巴几何,概念图的脸全靠贴图,2.0 贴图步本机是坏的。",
            "围脖是高频锯齿体积,不是概念图那种几片奶油色簇。",
            "尾巴大、面碎,侧面轮廓和概念图的「上翘奶油尖」对不齐。",
        ],
    }
    C.write_json(HERE.parent / "reports" / ("04_compare_%s.json" % prefix), report)
    print("DONE", prefix)


if __name__ == "__main__":
    main()
