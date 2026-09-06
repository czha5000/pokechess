# -*- coding: utf-8 -*-
"""
实验 3:在 Rigify 四足骨名上写程序化动作,然后导出 FBX。

为什么不用 Mixamo / 动物 mocap:
- Mixamo 是人形骨架,对不上四足。
- UniRig 每只怪骨架拓扑都不同,mocap retarget 成本高。
- Rigify basic_quadruped 骨名相对稳定,同一套动作可以套下一只猫狗形。

动作设计(2026-09-06 改成「棋盘可读」不是写实):
剪影必须一眼能分清六条片子。幅度加大、峰值停住几帧、缓动用 BEZIER。
- Idle:呼吸 + 尾巴摆,24 帧循环。
- Walk:对角快步,抬腿够高、身子跟着颠,32 帧循环。
- Attack:蹲住 → 整只冲出去咬 → 停一下 → 收回。32 帧一次性。
- Magic:后坐抬身、双前爪离地(竖剪影,和 Attack 横冲必须分开)。32 帧一次性。
- Hurt:被打停住再弹回。24 帧一次性。
- Death:侧倒躺平,末段定住。42 帧一次性。

导出给 UE 的是「网格 + 变形骨架 + 全部 Action」。
Idle/Walk 标循环;Attack/Hurt/Death 不循环,避免一次性动作播完自己重来。
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Vector

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import _common as C  # noqa: E402


def find_armature():
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if not arms:
        raise RuntimeError("场景里没有 Armature,先跑 02_rigify_quad.py")
    return arms[0]


def find_mesh():
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_get()]
    meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
    return meshes[0]


def find_bone(arm, *parts, exclude=()):
    """
    先精确匹配骨名,再退回子串。
    教训:parts=("spine",) 会先命中 spine.004(名字里也含 spine),
    根骨 spine 反而永远选不到,死亡侧倒的位移就加在胸口上、整只怪几乎不倒。
    """
    if len(parts) == 1:
        want = parts[0].lower()
        for pb in arm.pose.bones:
            if pb.name.lower() == want:
                return pb
    for pb in arm.pose.bones:
        low = pb.name.lower()
        if all(p in low for p in parts) and not any(e in low for e in exclude):
            return pb
    return None


def resolve_bones(arm):
    """
    把 basic_quadruped + 自补尾巴的常用骨头一次找齐。
    骨名来自 02 实测:front_thigh.L / thigh.L / spine / spine.011 / tail.001...
    """
    bones = {
        "fl": find_bone(arm, "front", "thigh", ".l") or find_bone(arm, "front", ".l"),
        "fr": find_bone(arm, "front", "thigh", ".r") or find_bone(arm, "front", ".r"),
        "fl_shin": find_bone(arm, "front", "shin", ".l"),
        "fr_shin": find_bone(arm, "front", "shin", ".r"),
        "bl": find_bone(arm, "thigh", ".l", exclude=("front",)),
        "br": find_bone(arm, "thigh", ".r", exclude=("front",)),
        "bl_shin": find_bone(arm, "shin", ".l", exclude=("front",)),
        "br_shin": find_bone(arm, "shin", ".r", exclude=("front",)),
        "spine": find_bone(arm, "spine"),
        "chest": find_bone(arm, "spine.004") or find_bone(arm, "spine.003"),
        "head": (
            find_bone(arm, "head")
            or find_bone(arm, "spine.011")
            or find_bone(arm, "spine.010")
            or find_bone(arm, "spine.006")
        ),
        "tail": find_bone(arm, "tail.001") or find_bone(arm, "tail"),
        "tail_mid": find_bone(arm, "tail.003") or find_bone(arm, "tail.002"),
    }
    print("ANIM_BONES", {k: (None if v is None else v.name) for k, v in bones.items()})
    return bones


def ensure_xyz(pb):
    pb.rotation_mode = "XYZ"
    return pb


def reset_pose(arm):
    """每条 Action 开写前把姿势空间清零,避免上一条动作的残余角度被当成 rest。"""
    for pb in arm.pose.bones:
        ensure_xyz(pb)
        pb.rotation_euler = Euler((0.0, 0.0, 0.0))
        pb.location = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)


def insert_rot(pb, frame, euler):
    pb.rotation_euler = euler
    pb.keyframe_insert(data_path="rotation_euler", frame=frame)


def insert_loc(pb, frame, loc):
    pb.location = loc
    pb.keyframe_insert(data_path="location", frame=frame)


def pose_keys(pb, keys):
    """
    给一根骨头插一组相对 rest 的关键帧。

    keys 每项:(frame, rx, ry, rz) 或 (frame, rx, ry, rz, lx, ly, lz)
    角度是度,位移是米(Blender 姿势空间)。初级程序员只需改这张表,不用碰欧拉。
    约定(basic_quadruped 实测):大腿 rotation X 负值 = 抬腿/前伸。
    """
    if pb is None:
        return
    ensure_xyz(pb)
    for item in keys:
        frame, rx, ry, rz = item[0], item[1], item[2], item[3]
        loc = item[4:7] if len(item) >= 7 else (0.0, 0.0, 0.0)
        insert_rot(pb, frame, Euler((math.radians(rx), math.radians(ry), math.radians(rz))))
        insert_loc(pb, frame, loc)


def make_action(arm, name, frame_end, builder, cyclic=True):
    """清掉同名 Action,新建一条,只在这条 Action 上插关键帧。"""
    if name in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions[name])
    action = bpy.data.actions.new(name)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    reset_pose(arm)
    builder(arm, frame_end)
    # Blender 5 把 FCurve 从 Action 挪到了 layered Action 的 channelbag 里。
    # 旧的 action.fcurves 已经不存在,硬读会 AttributeError。
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fcurve in bag.fcurves:
                    for kp in fcurve.keyframe_points:
                        # LINEAR 会让所有动作像滑杆匀速拖,棋盘上看不出快慢。
                        # AUTO_CLAMPED 避免 BEZIER 在循环处过冲把脚抬穿身子。
                        kp.interpolation = "BEZIER"
                        kp.handle_left_type = "AUTO_CLAMPED"
                        kp.handle_right_type = "AUTO_CLAMPED"
    action.use_cyclic = cyclic
    # Blender 5 分层 Action:骨架同时只挂一条,另外几条没有用户,
    # 存盘会被清掉。fake user 钉住它们,下次打开 blend 还能渲预览。
    action.use_fake_user = True
    return action


def build_idle(arm, frame_end):
    """呼吸要大到围脖挡不住:胸起伏 + 头跟着点 + 尾巴慢摆。"""
    b = resolve_bones(arm)
    mid = frame_end // 2
    pose_keys(b["spine"], [
        (1, 0, 0, 0),
        (mid, 10, 0, 0, 0.0, 0.0, 0.04),
        (frame_end + 1, 0, 0, 0),
    ])
    pose_keys(b["chest"], [
        (1, 0, 0, 0),
        (mid, 8, 0, 0),
        (frame_end + 1, 0, 0, 0),
    ])
    pose_keys(b["head"], [
        (1, 0, 0, 0),
        (mid, 12, 0, 4, 0.0, 0.0, 0.02),
        (frame_end + 1, 0, 0, 0),
    ])
    pose_keys(b["tail"], [
        (1, 0, 0, 8),
        (mid, 8, 0, -10),
        (frame_end + 1, 0, 0, 8),
    ])


def build_walk(arm, frame_end):
    """
    对角快步,幅度按「棋盘上能看出在走」来写。
    相位 0:左前 + 右后 抬起(大腿 rotation X 负值 = 抬腿/前伸)
    相位 半圈:右前 + 左后 抬起
    小腿反向折一点,否则只有大腿转、脚还贴地。
    """
    def rot_cycle(pb, phase, lift_deg, swing_deg):
        if pb is None:
            return
        ensure_xyz(pb)
        steps = 8
        for i in range(steps + 1):
            frame = 1 + int(round(i * frame_end / steps))
            t = (i / steps + phase) * 2.0 * math.pi
            # 只取正弦正半周当抬腿,落地半周贴 0,避免脚往地底下折
            lift = lift_deg * max(0.0, math.sin(t))
            swing = swing_deg * math.sin(t)
            insert_rot(pb, frame, Euler((math.radians(lift), 0.0, math.radians(swing))))

    def bob_cycle(pb):
        """一步两颠,让身体剪影上下动,不要只有腿在晃。"""
        if pb is None:
            return
        ensure_xyz(pb)
        steps = 8
        for i in range(steps + 1):
            frame = 1 + int(round(i * frame_end / steps))
            t = (i / steps) * 2.0 * math.pi
            amp = abs(math.sin(t * 2.0))
            insert_rot(pb, frame, Euler((math.radians(8.0 * amp), 0.0, math.radians(6.0 * math.sin(t)))))
            insert_loc(pb, frame, (0.0, 0.0, 0.035 * amp))

    b = resolve_bones(arm)
    rot_cycle(b["fl"], 0.0, -48, 10)
    rot_cycle(b["br"], 0.0, -42, -8)
    rot_cycle(b["fr"], 0.5, -48, -10)
    rot_cycle(b["bl"], 0.5, -42, 8)
    rot_cycle(b["fl_shin"], 0.0, 28, 0)
    rot_cycle(b["br_shin"], 0.0, 24, 0)
    rot_cycle(b["fr_shin"], 0.5, 28, 0)
    rot_cycle(b["bl_shin"], 0.5, 24, 0)
    bob_cycle(b["spine"])
    rot_cycle(b["tail"], 0.25, 22, 16)
    rot_cycle(b["tail_mid"], 0.25, 16, 10)


def build_attack(arm, frame_end):
    """
    蹲住(停) → 整只冲出去咬(停) → 收回。
    同一姿势连写两帧 = 停顿。前冲用 spine 的 Y 位移,不要只点头。
    """
    b = resolve_bones(arm)
    pose_keys(b["spine"], [
        (1, 0, 0, 0),
        (7, 22, 0, 0, 0.0, -0.04, -0.04),
        (10, 22, 0, 0, 0.0, -0.04, -0.04),
        (16, -32, 0, 0, 0.0, 0.22, 0.04),
        (20, -32, 0, 0, 0.0, 0.22, 0.04),
        (26, 6, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["chest"], [
        (1, 0, 0, 0),
        (7, 14, 0, 0),
        (10, 14, 0, 0),
        (16, -22, 0, 0),
        (20, -22, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["head"], [
        (1, 0, 0, 0),
        (7, 16, 0, 0),
        (10, 16, 0, 0),
        (16, -42, 0, 0),
        (20, -42, 0, 0),
        (26, -8, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fl"], [
        (1, 0, 0, 0),
        (7, 22, 0, 10),
        (10, 22, 0, 10),
        (16, -52, 0, 12),
        (20, -52, 0, 12),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fr"], [
        (1, 0, 0, 0),
        (7, 22, 0, -10),
        (10, 22, 0, -10),
        (16, -52, 0, -12),
        (20, -52, 0, -12),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fl_shin"], [
        (1, 0, 0, 0),
        (7, 28, 0, 0),
        (10, 28, 0, 0),
        (16, -12, 0, 0),
        (20, -12, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fr_shin"], [
        (1, 0, 0, 0),
        (7, 28, 0, 0),
        (10, 28, 0, 0),
        (16, -12, 0, 0),
        (20, -12, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["bl"], [
        (1, 0, 0, 0),
        (7, 26, 0, 0),
        (10, 26, 0, 0),
        (16, -18, 0, 0),
        (20, -18, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["br"], [
        (1, 0, 0, 0),
        (7, 26, 0, 0),
        (10, 26, 0, 0),
        (16, -18, 0, 0),
        (20, -18, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["tail"], [
        (1, 0, 0, 0),
        (7, -28, 0, 0),
        (10, -28, 0, 0),
        (16, 32, 0, 10),
        (20, 32, 0, 10),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["tail_mid"], [
        (1, 0, 0, 0),
        (7, -18, 0, 0),
        (16, 22, 0, 0),
        (frame_end, 0, 0, 0),
    ])


def build_magic(arm, frame_end):
    """
    竖剪影施法:后坐、抬头、双前爪离地抱在胸前,停住,再往前一送。
    没有光效,所以姿势必须和 Attack 的「横着冲」完全不像。
    """
    b = resolve_bones(arm)
    pose_keys(b["spine"], [
        (1, 0, 0, 0),
        (8, -28, 0, 0, 0.0, -0.08, 0.10),
        (14, -28, 0, 0, 0.0, -0.08, 0.10),
        (20, -10, 0, 0, 0.0, 0.10, 0.04),
        (24, -6, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["chest"], [
        (1, 0, 0, 0),
        (8, -20, 0, 0),
        (14, -20, 0, 0),
        (20, -6, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["head"], [
        (1, 0, 0, 0),
        (8, 38, 0, 0),
        (14, 38, 0, 0),
        (20, -12, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fl"], [
        (1, 0, 0, 0),
        (8, -58, 0, 18),
        (14, -58, 0, 18),
        (20, -28, 0, 8),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fr"], [
        (1, 0, 0, 0),
        (8, -58, 0, -18),
        (14, -58, 0, -18),
        (20, -28, 0, -8),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fl_shin"], [
        (1, 0, 0, 0),
        (8, 32, 0, 0),
        (14, 32, 0, 0),
        (20, 12, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fr_shin"], [
        (1, 0, 0, 0),
        (8, 32, 0, 0),
        (14, 32, 0, 0),
        (20, 12, 0, 0),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["bl"], [
        (1, 0, 0, 0),
        (8, 32, 0, 8),
        (14, 32, 0, 8),
        (20, 12, 0, 4),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["br"], [
        (1, 0, 0, 0),
        (8, 32, 0, -8),
        (14, 32, 0, -8),
        (20, 12, 0, -4),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["tail"], [
        (1, 0, 0, 0),
        (8, 28, 0, 0),
        (14, 28, 0, 0),
        (20, -12, 0, 8),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["tail_mid"], [
        (1, 0, 0, 0),
        (8, 20, 0, 0),
        (14, 20, 0, 0),
        (frame_end, 0, 0, 0),
    ])


def build_hurt(arm, frame_end):
    """被打:瞬间闪到受击姿势,停几帧让人看清,再弹回。"""
    b = resolve_bones(arm)
    pose_keys(b["spine"], [
        (1, 0, 0, 0),
        (4, -16, 0, 28, 0.0, -0.08, 0.03),
        (10, -16, 0, 28, 0.0, -0.08, 0.03),
        (16, -6, 0, 10),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["chest"], [
        (1, 0, 0, 0),
        (4, -10, 0, 12),
        (10, -10, 0, 12),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["head"], [
        (1, 0, 0, 0),
        (4, 28, 0, -36),
        (10, 28, 0, -36),
        (16, 8, 0, -10),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fl"], [
        (1, 0, 0, 0),
        (4, 28, 0, 16),
        (10, 28, 0, 16),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["fr"], [
        (1, 0, 0, 0),
        (4, 18, 0, -8),
        (10, 18, 0, -8),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["bl"], [
        (1, 0, 0, 0),
        (4, -16, 0, 10),
        (10, -16, 0, 10),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["br"], [
        (1, 0, 0, 0),
        (4, 16, 0, -10),
        (10, 16, 0, -10),
        (frame_end, 0, 0, 0),
    ])
    pose_keys(b["tail"], [
        (1, 0, 0, 0),
        (4, -36, 0, 18),
        (10, -36, 0, 18),
        (frame_end, 0, 0, 0),
    ])


def build_death(arm, frame_end):
    """
    踉跄 → 侧倒躺平,末段定住不回 rest。
    侧倒必须用 Y 滚转。Z 偏航只是原地转身,预览里看起来还站着。
    """
    b = resolve_bones(arm)
    down = (6, -95, -4, 0.28, 0.0, -0.38)
    pose_keys(b["spine"], [
        (1, 0, 0, 0),
        (8, 12, -22, -8, 0.04, 0.0, -0.03),
        (16, 10, -55, -8, 0.14, 0.0, -0.16),
        (26, 6, -88, -4, 0.24, 0.0, -0.32),
        (32, down[0], down[1], down[2], down[3], down[4], down[5]),
        (frame_end, down[0], down[1], down[2], down[3], down[4], down[5]),
    ])
    pose_keys(b["chest"], [
        (1, 0, 0, 0),
        (16, 10, -20, 0),
        (32, 14, -28, 0),
        (frame_end, 14, -28, 0),
    ])
    pose_keys(b["head"], [
        (1, 0, 0, 0),
        (8, 14, -10, -8),
        (16, 22, -26, -12),
        (32, 30, -36, -10),
        (frame_end, 30, -36, -10),
    ])
    pose_keys(b["fl"], [
        (1, 0, 0, 0),
        (8, 20, 0, 12),
        (16, 12, 16, 22),
        (32, 10, 26, 32),
        (frame_end, 10, 26, 32),
    ])
    pose_keys(b["fr"], [
        (1, 0, 0, 0),
        (8, 14, 0, -10),
        (16, -10, -16, -20),
        (32, -16, -24, -26),
        (frame_end, -16, -24, -26),
    ])
    pose_keys(b["bl"], [
        (1, 0, 0, 0),
        (8, 16, 0, 10),
        (16, 24, 14, 20),
        (32, 30, 22, 26),
        (frame_end, 30, 22, 26),
    ])
    pose_keys(b["br"], [
        (1, 0, 0, 0),
        (8, 12, 0, -8),
        (16, -8, -14, -18),
        (32, -14, -22, -24),
        (frame_end, -14, -22, -24),
    ])
    pose_keys(b["tail"], [
        (1, 0, 0, 0),
        (8, -16, -10, 8),
        (16, 8, -24, 14),
        (32, 18, -32, 16),
        (frame_end, 18, -32, 16),
    ])
    pose_keys(b["tail_mid"], [
        (1, 0, 0, 0),
        (16, 14, -14, 10),
        (32, 22, -20, 12),
        (frame_end, 22, -20, 12),
    ])


def hide_studio_extras():
    """v5 blend 里的地面/灯不该进角色 FBX,导出前藏起来。"""
    for o in bpy.data.objects:
        if o.name.startswith("Studio") or o.name.startswith("KeyLight") or o.name.startswith("FillLight") or o.name.startswith("RimLight"):
            o.hide_set(True)
            o.hide_render = True


def render_preview(out_dir, arm, action_name, frame, filename):
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = bpy.data.actions[action_name]
    bpy.context.scene.frame_set(frame)
    C.render_still(out_dir / filename)


def main():
    C.configure_stdio()
    args = C.parse_args({"--blend": str, "--out-dir": str, "--report": str})
    out_dir = C.ensure_dir(args.get("--out-dir") or (HERE.parent / "output"))
    report_path = Path(args.get("--report") or (HERE.parent / "reports" / "03_walk.json"))
    blend_in = Path(args.get("--blend") or (out_dir / "eevee_rigify.blend"))
    if not blend_in.exists():
        raise FileNotFoundError("找不到绑骨文件,先跑 02: %s" % blend_in)

    bpy.ops.wm.open_mainfile(filepath=str(blend_in))
    hide_studio_extras()
    arm = find_armature()
    mesh = find_mesh()

    # 场景长度取最长一条(Death=42),FBX bake 才不会把死亡片截断
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 42
    bpy.context.scene.render.fps = 30

    needed = (
        ("Eevee_Idle", 24, build_idle, True),
        ("Eevee_Walk", 32, build_walk, True),
        ("Eevee_Attack", 32, build_attack, False),
        ("Eevee_Magic", 32, build_magic, False),
        ("Eevee_Hurt", 24, build_hurt, False),
        ("Eevee_Death", 42, build_death, False),
    )
    actions = {}
    for name, end, builder, cyclic in needed:
        actions[name] = make_action(arm, name, end, builder, cyclic=cyclic)

    analysis = C.analyze_mesh(mesh, "walk_preview")
    look = Vector(analysis["bbox"]["center"])
    C.setup_silhouette_camera(look, analysis["bbox"]["size"])

    previews = {
        "idle": "03_idle_mid.png",
        "walk_a": "03_walk_a.png",
        "walk_b": "03_walk_b.png",
        "attack": "03_attack_peak.png",
        "magic": "03_magic_peak.png",
        "hurt": "03_hurt_peak.png",
        "death": "03_death_down.png",
    }
    render_preview(out_dir, arm, "Eevee_Idle", 13, previews["idle"])
    render_preview(out_dir, arm, "Eevee_Walk", 8, previews["walk_a"])
    render_preview(out_dir, arm, "Eevee_Walk", 24, previews["walk_b"])
    render_preview(out_dir, arm, "Eevee_Attack", 16, previews["attack"])
    render_preview(out_dir, arm, "Eevee_Magic", 10, previews["magic"])
    render_preview(out_dir, arm, "Eevee_Hurt", 6, previews["hurt"])
    render_preview(out_dir, arm, "Eevee_Death", 36, previews["death"])

    arm.animation_data.action = actions["Eevee_Walk"]
    fbx_path = out_dir / "eevee_rigify_anim.fbx"
    C.export_fbx(fbx_path, [arm, mesh])

    out_blend = out_dir / "eevee_rigify_anim.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))

    action_names = [a.name for a in bpy.data.actions]
    must = [n for n, _, _, _ in needed]
    missing = [n for n in must if n not in action_names]
    gate = "PASS" if (not missing and fbx_path.exists()) else "FAIL"
    report = {
        "experiment": 3,
        "motion_source": "procedural_rigify_quad_fk",
        "actions": action_names,
        "lengths_30fps": {
            "Eevee_Idle": 24,
            "Eevee_Walk": 32,
            "Eevee_Attack": 32,
            "Eevee_Magic": 32,
            "Eevee_Hurt": 24,
            "Eevee_Death": 42,
        },
        "fbx": str(fbx_path),
        "blend": str(out_blend),
        "previews": {k: str(out_dir / v) for k, v in previews.items()},
        "gate": {
            "status": gate,
            "reason": (
                "Idle/Walk/Attack/Magic/Hurt/Death 已写入并导出 FBX。"
                if gate == "PASS"
                else "缺 Action 或 FBX: %s" % missing
            ),
        },
        "reuse_note": "下一只猫/狗形只要仍用 basic_quadruped 骨名,这六条动作可以原样套。",
        "ue_note": "一次性动作不要循环。本轮只出资产,不改 BP_Unit / SpawnUnit。",
    }
    C.write_json(report_path, report)
    print("GATE", gate, report["gate"]["reason"])
    print("FBX", fbx_path)
    print("REPORT", report_path)


if __name__ == "__main__":
    main()
