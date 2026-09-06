# -*- coding: utf-8 -*-
"""
把 03 写出的六条 Action 渲成短片,给人眼看「动起来」而不是单帧峰值。

只读 `eevee_rigify_anim.blend`,不改骨骼/关键帧。
每条片子先出 PNG 序列,再交给外面的 ffmpeg 拼 GIF/MP4
(Blender 自带的 FFmpeg 封装在无头模式下经常缺编码器,外部 ffmpeg 更稳)。
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import _common as C  # noqa: E402

# (Action 名, 最后一帧, 是否循环预览)
# 片长必须和 03_walk_cycle.py 的 needed 表一致,否则 GIF 会截断或播到空帧。
CLIPS = (
    ("Eevee_Idle", 24, True),
    ("Eevee_Walk", 32, True),
    ("Eevee_Attack", 32, False),
    ("Eevee_Magic", 32, False),
    ("Eevee_Hurt", 24, False),
    ("Eevee_Death", 42, False),
)


def find_armature():
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if not arms:
        raise RuntimeError("场景里没有 Armature")
    return arms[0]


def find_mesh():
    meshes = [o for o in bpy.data.objects if o.type == "MESH" and not o.hide_get()]
    meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
    return meshes[0]


def hide_studio_extras():
    for o in bpy.data.objects:
        if o.name.startswith(("Studio", "KeyLight", "FillLight", "RimLight")):
            o.hide_set(True)
            o.hide_render = True


def setup_preview_camera(mesh):
    """
    侧视偏 3/4,和 03 峰值帧同一机位。
    后侧 3/4 会把脸和前爪挡在围脖后面,六条片子看起来都像站着。
    """
    analysis = C.analyze_mesh(mesh, "preview")
    look = Vector(analysis["bbox"]["center"])
    C.setup_silhouette_camera(look, analysis["bbox"]["size"])


def setup_fast_render():
    """Workbench 足够看动作;EEVEE 全序列太慢,预览不值得。"""
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 480
    scene.render.fps = 30
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"


def find_action(name):
    """FBX 进口后 Action 名可能带骨架前缀,用后缀匹配。"""
    if name in bpy.data.actions:
        return bpy.data.actions[name]
    for a in bpy.data.actions:
        if a.name.endswith(name) or name in a.name:
            return a
    raise RuntimeError("缺 Action: %s / 现有 %s" % (name, [x.name for x in bpy.data.actions]))


def render_clip(arm, name, frame_end, out_dir):
    action = find_action(name)
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frame_end
    seq_dir = C.ensure_dir(out_dir / "frames" / name)
    for frame in range(1, frame_end + 1):
        scene.frame_set(frame)
        path = seq_dir / ("frame_%04d.png" % frame)
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
    return seq_dir


def main():
    C.configure_stdio()
    args = C.parse_args({"--blend": str, "--out-dir": str})
    out_dir = C.ensure_dir(args.get("--out-dir") or (HERE.parent / "output" / "proc" / "preview"))
    blend_in = Path(args.get("--blend") or (HERE.parent / "output" / "proc" / "eevee_rigify_anim.blend"))
    if not blend_in.exists():
        raise FileNotFoundError(blend_in)

    fbx_in = blend_in.with_suffix(".fbx")
    if not fbx_in.exists():
        fbx_in = blend_in.parent / "eevee_rigify_anim.fbx"
    if not fbx_in.exists():
        raise FileNotFoundError("找不到动画 FBX: %s" % fbx_in)
    # 03 存盘时 Blender 5 会丢掉没挂在骨架上的 Action;FBX 才是六条片子的真源
    C.reset_scene()
    bpy.ops.import_scene.fbx(filepath=str(fbx_in))
    hide_studio_extras()
    arm = find_armature()
    mesh = find_mesh()
    print("ACTIONS", [a.name for a in bpy.data.actions])
    setup_preview_camera(mesh)
    setup_fast_render()

    clips = {}
    for name, end, cyclic in CLIPS:
        seq = render_clip(arm, name, end, out_dir)
        clips[name] = {"frames": str(seq), "end": end, "cyclic": cyclic}
        print("CLIP", name, "frames", end)

    C.write_json(out_dir / "preview_manifest.json", {"clips": clips})
    print("DONE preview frames")


if __name__ == "__main__":
    main()
