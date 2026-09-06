# -*- coding: utf-8 -*-
"""
实验 2 路径 B:Rigify 狼型 metarig 套到同一只伊布灰模上。

流程:
1. 读实验 1 产出的 eevee_remesh.blend(没有就现导 remesh glb)。
2. 启用 Rigify,加入 wolf metarig。
3. 按脚掌/头/尾巴把关键骨头挪过去(不是盲缩放)。
4. 网格用自动权重挂到 metarig 上。
5. 验收三个姿势:站姿、抬左前腿、弯尾巴,各渲一张图。
6. 量包围盒有没有炸模。

这里故意不用「Generate Rig」出整套 IK 控制器。
原因:UE 只要变形骨;metarig 的骨名已经够标准,实验 3 的走循环可以直接写在这些骨上。
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import addon_utils
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import _common as C  # noqa: E402


def enable_rigify():
    addon_utils.enable("rigify", default_set=True, persistent=True)


def find_mesh():
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_get()]
    if not meshes:
        raise RuntimeError("场景里没有可见 Mesh")
    meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
    return meshes[0]


def add_quad_metarig():
    """
    用 basic_quadruped(34 骨)而不是 wolf(190 骨)。

    wolf/cat 自带整张脸和手指,自动权重会把围脖/耳朵权重分给这些用不上的骨头,
    抬腿时容易从胸口拉出一条带。basic_quadruped 只有脊柱+四肢,更适合灰模棋子。
    它没有尾巴,后面 add_tail_chain() 自己补 4 节。
    """
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.object.armature_basic_quadruped_metarig_add()
    arm = bpy.context.view_layer.objects.active
    arm.name = "EeveeMetarig"
    return arm


def add_tail_chain(arm, analysis, segments=4):
    """从屁股后方长出 tail.001..tail.00N,铺到尾巴地标。

    不能从 spine.head(骨盆中心)起笔——那根骨会分到半个身子的权重,
    一旋转整只怪就炸成碎片。起点必须已经在尾巴体积里。
    """
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    ebs = arm.data.edit_bones
    parent_name = "spine" if "spine" in ebs else ebs[0].name
    parent = ebs[parent_name]
    box = analysis["bbox"]
    # 屁股:身体最后 18% 的中线,略高于脚底。这才是尾巴该长出来的地方。
    rump_world = Vector(
        (
            box["center"][0],
            box["min"][1] + box["length"] * 0.18,
            box["min"][2] + box["height"] * 0.38,
        )
    )
    start = arm.matrix_world.inverted() @ rump_world
    end = arm.matrix_world.inverted() @ Vector(
        (analysis["tail"]["x"], analysis["tail"]["y"], max(analysis["tail"]["z"], rump_world.z))
    )
    prev = parent
    created = []
    for i in range(segments):
        name = "tail.%03d" % (i + 1)
        if name in ebs:
            ebs.remove(ebs[name])
        bone = ebs.new(name)
        t0 = i / segments
        t1 = (i + 1) / segments
        bone.head = start.lerp(end, t0)
        bone.tail = start.lerp(end, t1)
        bone.parent = prev
        bone.use_connect = i > 0
        bone.use_deform = True
        prev = bone
        created.append(name)
    bpy.ops.object.mode_set(mode="OBJECT")
    print("TAIL_BONES", created)
    return created


def bone_world_head(arm, name):
    bone = arm.data.bones[name]
    return arm.matrix_world @ bone.head_local


def set_edit_bone(arm, name, head=None, tail=None):
    """在 Edit Mode 里改一根骨头的头/尾。骨头不存在就跳过并打印。"""
    if name not in arm.data.edit_bones:
        print("SKIP_BONE", name)
        return False
    eb = arm.data.edit_bones[name]
    if head is not None:
        eb.head = arm.matrix_world.inverted() @ Vector(head)
    if tail is not None:
        eb.tail = arm.matrix_world.inverted() @ Vector(tail)
    return True


def fit_wolf_to_mesh(arm, mesh, analysis):
    """
    把默认狼人 metarig 对到伊布体积上。

    策略分两层,避免「只整体缩放、膝盖还在肚子里」:
    1. 先按包围盒整体平移 + 缩放,让骨架落进模型里。
    2. 再把脚、头、尾巴的骨头吸附到实验 1 算出来的地标。
    """
    box = analysis["bbox"]
    paws = C.label_paws(analysis["paws"], box)
    paw_map = {p["tag"]: p for p in paws}

    # --- 第一层:整体对齐 ---
    # wolf 默认站在原点附近、大约 1.7m 高。先量它自己的骨头包围盒。
    bpy.context.view_layer.update()
    heads = [arm.matrix_world @ b.head_local for b in arm.data.bones]
    tails = [arm.matrix_world @ b.tail_local for b in arm.data.bones]
    pts = heads + tails
    src_box = C.bbox_of_points(pts)

    # 目标:脚踩模型最低点,脊柱沿模型 Y 轴(前后),高度对齐模型身高的 70%
    # (伊布腿短身子圆,骨架拉满身高会把脊椎顶出头顶)
    sx = box["width"] / max(src_box["width"], 1e-4)
    sy = box["length"] / max(src_box["length"], 1e-4)
    sz = (box["height"] * 0.72) / max(src_box["height"], 1e-4)
    scale = (sx + sy + sz) / 3.0
    arm.scale = (scale, scale, scale)
    bpy.context.view_layer.update()

    # 再量一次缩放后的脚底,把整个骨架落到模型脚底和中心
    heads = [arm.matrix_world @ b.head_local for b in arm.data.bones]
    src_box = C.bbox_of_points(heads)
    delta = Vector(
        (
            box["center"][0] - src_box["center"][0],
            box["center"][1] - src_box["center"][1],
            box["min"][2] - src_box["min"][2],
        )
    )
    arm.location += delta
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # --- 第二层:地标吸附 ---
    bpy.ops.object.mode_set(mode="EDIT")

    def paw_xyz(tag, fallback):
        if tag in paw_map:
            p = paw_map[tag]
            return Vector((p["x"], p["y"], p["z"]))
        return Vector(fallback)

    # basic_quadruped:后腿 thigh/shin/foot/toe ;前腿 front_* 。按名字片段匹配,避免写死版本。
    name_index = {b.name: b.name for b in arm.data.edit_bones}
    print("QUAD_BONES", sorted(name_index.keys()))

    def first_match(parts):
        for name in name_index:
            low = name.lower()
            if all(p in low for p in parts):
                return name
        return None

    used = set()
    for parts, tag in [
        (("front", "toe", ".l"), "FL"),
        (("front", "toe", ".r"), "FR"),
        (("front", "foot", ".l"), "FL"),
        (("front", "foot", ".r"), "FR"),
    ]:
        name = first_match(parts)
        if not name or name in used:
            continue
        target = paw_xyz(tag, (0, 0, box["min"][2]))
        # toe/foot:保持骨头长度,只把 tail 挪到脚掌,head 沿原方向回退
        eb = arm.data.edit_bones[name]
        length = (eb.tail - eb.head).length
        direction = (eb.tail - eb.head).normalized()
        eb.tail = arm.matrix_world.inverted() @ target
        eb.head = eb.tail - direction * max(length, box["height"] * 0.04)
        used.add(name)

    # 后脚:名字含 foot/toe 且不含 front
    for side, tag in ((".l", "BL"), (".r", "BR")):
        for kind in ("toe", "foot"):
            name = None
            for cand in name_index:
                low = cand.lower()
                if kind in low and side in low and "front" not in low:
                    name = cand
                    break
            if not name or name in used:
                continue
            target = paw_xyz(tag, (0, 0, box["min"][2]))
            eb = arm.data.edit_bones[name]
            length = (eb.tail - eb.head).length
            direction = (eb.tail - eb.head).normalized()
            eb.tail = arm.matrix_world.inverted() @ target
            eb.head = eb.tail - direction * max(length, box["height"] * 0.04)
            used.add(name)

    # 把大腿放到腿的体积里,避免默认骨头穿过围脖(抬腿会从胸口拉出一条带)
    def place_leg(thigh_parts, shin_parts, tag, forward_sign):
        thigh = first_match(thigh_parts)
        shin = first_match(shin_parts)
        if thigh is None or tag not in paw_map:
            return
        paw = Vector((paw_map[tag]["x"], paw_map[tag]["y"], paw_map[tag]["z"]))
        hip = Vector(
            (
                paw.x,
                paw.y + box["length"] * 0.05 * forward_sign,
                box["min"][2] + box["height"] * 0.40,
            )
        )
        knee = Vector((paw.x, paw.y + box["length"] * 0.01 * forward_sign, box["min"][2] + box["height"] * 0.20))
        inv = arm.matrix_world.inverted()
        ebs = arm.data.edit_bones
        ebs[thigh].head = inv @ hip
        ebs[thigh].tail = inv @ knee
        if shin is not None:
            ebs[shin].head = inv @ knee
            ebs[shin].tail = inv @ paw

    place_leg(("front", "thigh", ".l"), ("front", "shin", ".l"), "FL", +1)
    place_leg(("front", "thigh", ".r"), ("front", "shin", ".r"), "FR", +1)
    # 后腿不能用 first_match("thigh")——会先命中 front_thigh。必须排除 front。
    for side, tag in ((".l", "BL"), (".r", "BR")):
        thigh = None
        shin = None
        for name in name_index:
            low = name.lower()
            if "thigh" in low and side in low and "front" not in low:
                thigh = name
            if "shin" in low and side in low and "front" not in low:
                shin = name
        if thigh and tag in paw_map:
            paw = Vector((paw_map[tag]["x"], paw_map[tag]["y"], paw_map[tag]["z"]))
            hip = Vector((paw.x, paw.y - box["length"] * 0.04, box["min"][2] + box["height"] * 0.40))
            knee = Vector((paw.x, paw.y - box["length"] * 0.01, box["min"][2] + box["height"] * 0.20))
            inv = arm.matrix_world.inverted()
            arm.data.edit_bones[thigh].head = inv @ hip
            arm.data.edit_bones[thigh].tail = inv @ knee
            if shin:
                arm.data.edit_bones[shin].head = inv @ knee
                arm.data.edit_bones[shin].tail = inv @ paw

    # 头
    head = analysis["head"]
    for parts in (("head",), ("spine.006",), ("spine.005",)):
        name = first_match(parts) if parts[0] != "head" else ("head" if "head" in name_index else first_match(("head",)))
        if name and name in arm.data.edit_bones:
            eb = arm.data.edit_bones[name]
            target = Vector((head["x"], head["y"], head["z"]))
            local = arm.matrix_world.inverted() @ target
            offset = local - eb.tail
            eb.tail += offset
            # 头骨短一点,避免穿出鼻尖太远
            break

    # 尾巴链:把整条 tail 骨骼按比例铺到尾巴地标
    tail_bones = [n for n in name_index if n.lower().startswith("tail")]
    tail_bones.sort()
    if tail_bones:
        start = arm.data.edit_bones[tail_bones[0]].head.copy()
        end = arm.matrix_world.inverted() @ Vector(
            (analysis["tail"]["x"], analysis["tail"]["y"], analysis["tail"]["z"])
        )
        for i, name in enumerate(tail_bones):
            t0 = i / max(len(tail_bones), 1)
            t1 = (i + 1) / max(len(tail_bones), 1)
            arm.data.edit_bones[name].head = start.lerp(end, t0)
            arm.data.edit_bones[name].tail = start.lerp(end, t1)

    bpy.ops.object.mode_set(mode="OBJECT")
    return paw_map, sorted(name_index.keys())


def bind_auto_weights(mesh, arm):
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")


def pose_bone(arm, name_parts, axis, degrees):
    """按名字片段找一根 pose bone,绕局部轴转角度。返回实际骨名。"""
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    target = None
    for pb in arm.pose.bones:
        low = pb.name.lower()
        if all(p in low for p in name_parts):
            target = pb
            break
    if target is None:
        bpy.ops.object.mode_set(mode="OBJECT")
        return None
    target.rotation_mode = "XYZ"
    euler = target.rotation_euler.copy()
    idx = {"x": 0, "y": 1, "z": 2}[axis]
    euler[idx] += math.radians(degrees)
    target.rotation_euler = euler
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode="OBJECT")
    return target.name


def clear_pose(arm):
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.rot_clear()
    bpy.ops.pose.loc_clear()
    bpy.ops.pose.scale_clear()
    bpy.ops.object.mode_set(mode="OBJECT")


def mesh_bbox_volume(mesh):
    deps = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(deps)
    corners = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return max(1e-9, (max(xs) - min(xs)) * (max(ys) - min(ys)) * (max(zs) - min(zs)))


def sample_evaluated_verts(mesh, stride=7):
    """取形变后(armature modifier 生效)的世界坐标顶点,每 stride 个采一个。"""
    deps = bpy.context.evaluated_depsgraph_get()
    ev = mesh.evaluated_get(deps)
    ev_mesh = ev.to_mesh()
    mw = ev.matrix_world
    pts = [mw @ ev_mesh.vertices[i].co for i in range(0, len(ev_mesh.vertices), stride)]
    ev.to_mesh_clear()
    return pts


def max_displacement(before, after):
    """姿势前后逐点最大位移。
    教训(2026-09-06 程序化伊布):包围盒体积对「抬腿」是坏指标——
    大尾巴把包围盒撑得很大,腿抬到哪都在盒子里,体积纹丝不动 → 误报 FAIL。
    顶点位移才是「网格有没有跟着骨头动」的直接证据。
    """
    n = min(len(before), len(after))
    return max((before[i] - after[i]).length for i in range(n)) if n else 0.0


def main():
    C.configure_stdio()
    args = C.parse_args({"--blend": str, "--glb": str, "--out-dir": str, "--report": str})
    out_dir = C.ensure_dir(args.get("--out-dir") or (HERE.parent / "output"))
    report_path = Path(args.get("--report") or (HERE.parent / "reports" / "02_rigify.json"))
    blend_in = Path(args.get("--blend") or (out_dir / "eevee_remesh.blend"))
    glb_in = Path(args.get("--glb") or (out_dir / "eevee_remesh.glb"))

    enable_rigify()
    if blend_in.exists():
        bpy.ops.wm.open_mainfile(filepath=str(blend_in))
    else:
        C.reset_scene()
        C.import_glb(glb_in)

    mesh = find_mesh()
    analysis = C.analyze_mesh(mesh, "bind_input")
    analysis["paws"] = C.label_paws(analysis["paws"], analysis["bbox"])

    look = analysis["bbox"]["center"]
    dist = max(analysis["bbox"]["size"]) * 2.4
    # 打开旧文件时可能已有相机;没有再补
    if bpy.context.scene.camera is None:
        C.setup_workbench_camera(look, dist)

    rest_vol = mesh_bbox_volume(mesh)
    arm = add_quad_metarig()
    paw_map, bone_names = fit_wolf_to_mesh(arm, mesh, analysis)
    add_tail_chain(arm, analysis)
    # 尾巴是后加的,骨名列表要重读
    bone_names = sorted(b.name for b in arm.data.bones)
    bind_auto_weights(mesh, arm)

    vg_count = len(mesh.vertex_groups)
    print("VERTEX_GROUPS", vg_count)

    shots = {}
    C.render_still(out_dir / "02_rest.png")
    shots["rest"] = str(out_dir / "02_rest.png")
    rest_after_bind = mesh_bbox_volume(mesh)
    rest_verts = sample_evaluated_verts(mesh)

    # 侧机位:从 +X 看过去,抬腿/弯尾才看得出,3/4 正面很容易「看起来没动」
    side_look = Vector(look)
    side_dist = dist
    if bpy.context.scene.camera:
        bpy.context.scene.camera.location = side_look + Vector((side_dist * 1.15, 0.0, side_dist * 0.12))
        direction = side_look - bpy.context.scene.camera.location
        bpy.context.scene.camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    # 抬左前腿:大腿 + 小腿一起折,动作才够大
    lifted = pose_bone(arm, ("front", "thigh", ".l"), "x", -45)
    pose_bone(arm, ("front", "shin", ".l"), "x", 25)
    C.render_still(out_dir / "02_lift_front_leg.png")
    shots["lift_front_leg"] = str(out_dir / "02_lift_front_leg.png")
    lift_vol = mesh_bbox_volume(mesh)
    lift_disp = max_displacement(rest_verts, sample_evaluated_verts(mesh))
    lift_bone = lifted
    clear_pose(arm)

    # 只弯尾巴中段,不转 tail.001(贴屁股那节,权重容易沾到身体)
    bent = pose_bone(arm, ("tail.003",), "x", 35) or pose_bone(arm, ("tail.002",), "x", 35)
    # pose_bone 用 startswith 更稳:上面 ("tail",) 会匹配到第一根 tail
    C.render_still(out_dir / "02_bend_tail.png")
    shots["bend_tail"] = str(out_dir / "02_bend_tail.png")
    tail_vol = mesh_bbox_volume(mesh)
    tail_disp = max_displacement(rest_verts, sample_evaluated_verts(mesh))
    tail_bone = bent
    clear_pose(arm)

    explode_ratio = rest_after_bind / rest_vol
    lift_explode = lift_vol / rest_after_bind
    tail_explode = tail_vol / rest_after_bind
    # 炸模:绑完之后包围盒暴涨,或摆姿势时体积翻倍(尾巴扫过半个身子)。
    exploded = explode_ratio > 3.0 or lift_explode > 2.5 or tail_explode > 2.5
    # 「有没有动」看顶点最大位移(占身高比例),不看包围盒(见 max_displacement 注释)
    height = analysis["bbox"]["height"]
    lift_moved = lift_disp > height * 0.02
    tail_moved = tail_disp > height * 0.01
    print("DISP lift=%.4f tail=%.4f height=%.3f" % (lift_disp, tail_disp, height))
    gate = "PASS"
    reasons = []
    if exploded:
        gate = "FAIL"
        reasons.append(
            "炸模 bind=%.2fx lift=%.2fx tail=%.2fx" % (explode_ratio, lift_explode, tail_explode)
        )
    if lift_bone is None:
        gate = "FAIL"
        reasons.append("找不到前腿骨头")
    elif not lift_moved:
        gate = "FAIL"
        reasons.append("抬前腿网格几乎没动,权重没刷上")
    if tail_bone is None:
        # 没尾巴骨不直接 FAIL,伊布应该有
        reasons.append("找不到尾巴骨头(警告)")
        if gate == "PASS":
            gate = "WARN"
    elif not tail_moved:
        reasons.append("弯尾巴网格几乎没动(警告,可能焊在屁股上)")
        if gate == "PASS":
            gate = "WARN"
    if not reasons:
        reasons.append("站姿未炸模,抬前腿和弯尾巴都有位移。")

    out_blend = out_dir / "eevee_rigify.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))

    report = {
        "experiment": 2,
        "path": "B_rigify_basic_quadruped_plus_tail",
        "bone_names": bone_names,
        "vertex_groups": vg_count,
        "paws": analysis["paws"],
        "volumes": {
            "rest_before_bind": rest_vol,
            "rest_after_bind": rest_after_bind,
            "explode_ratio": explode_ratio,
            "lift": lift_vol,
            "tail": tail_vol,
        },
        "displacement": {"lift": lift_disp, "tail": tail_disp},
        "posed_bones": {"lift": lift_bone, "tail": tail_bone},
        "shots": shots,
        "blend": str(out_blend),
        "gate": {"status": gate, "reason": " / ".join(reasons)},
    }
    C.write_json(report_path, report)
    print("GATE", gate, report["gate"]["reason"])
    print("REPORT", report_path)


if __name__ == "__main__":
    main()
