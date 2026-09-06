# -*- coding: utf-8 -*-
"""
实验 1:伊布灰模拓扑门禁。

做什么:
1. 导入 eevee-4view 的 Hunyuan 灰模。
2. 量包围盒、找脚掌/头/尾巴/脖圈。
3. 体素重网格(+必要时减面),再量一次。
4. 渲染前后对比图,写 JSON 报告。

过关标准(见 README):
- 重网格后至少找出 3 个脚掌簇。少於 3 = 腿分不开,后面禁止绑骨。
- 脖圈焊在身上是 Hunyuan 灰模的预期,只记录,不单独判 FAIL。
"""

from __future__ import annotations

import sys
from pathlib import Path

# Blender 不会自动把脚本所在目录加入 path
HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import _common as C  # noqa: E402


def main():
    C.configure_stdio()
    args = C.parse_args(
        {
            "--input": str,
            "--out-dir": str,
            "--report": str,
            "--voxel": float,
            "--decimate": float,
        }
    )
    repo = HERE.parents[1]
    src = Path(args.get("--input") or (repo / "eevee-4view" / "Hy3D_mv_grey.glb"))
    out_dir = C.ensure_dir(args.get("--out-dir") or (HERE.parent / "output"))
    report_path = Path(args.get("--report") or (HERE.parent / "reports" / "01_topo.json"))

    print("INPUT", src)
    if not src.exists():
        raise FileNotFoundError(src)

    C.reset_scene()
    mesh = C.import_glb(src)
    before = C.analyze_mesh(mesh, "before_remesh")
    print("BEFORE verts=%s faces=%s paws=%s height=%.4f" % (
        before["verts"], before["faces"], before["paw_count"], before["bbox"]["height"]
    ))

    look = before["bbox"]["center"]
    dist = max(before["bbox"]["size"]) * 2.4
    C.setup_workbench_camera(look, dist)
    C.render_still(out_dir / "01_before.png")

    # 体素边长:身高的 1/70。太粗会糊掉腿缝,太细会让权重计算慢且噪声多。
    voxel = args.get("--voxel")
    if voxel is None:
        voxel = max(before["bbox"]["height"] / 70.0, 0.004)
    C.voxel_remesh(mesh, voxel)

    after = C.analyze_mesh(mesh, "after_remesh")
    print("AFTER_REMESH verts=%s faces=%s paws=%s" % (
        after["verts"], after["faces"], after["paw_count"]
    ))

    # 面数仍高于 2 万就减一刀,自动权重在密网上又慢又容易糊
    decimate_ratio = args.get("--decimate")
    if after["faces"] > 20000:
        if decimate_ratio is None:
            decimate_ratio = 12000.0 / float(after["faces"])
            decimate_ratio = max(0.25, min(0.7, decimate_ratio))
        C.decimate(mesh, decimate_ratio)
        after = C.analyze_mesh(mesh, "after_decimate")
        print("AFTER_DECIMATE verts=%s faces=%s paws=%s" % (
            after["verts"], after["faces"], after["paw_count"]
        ))

    C.render_still(out_dir / "01_after.png")

    remesh_path = out_dir / "eevee_remesh.glb"
    C.export_glb(mesh, remesh_path)
    blend_path = out_dir / "eevee_remesh.blend"
    bpy_save(blend_path)

    paw_count = after["paw_count"]
    gate = "PASS" if paw_count >= 3 else "FAIL"
    report = {
        "experiment": 1,
        "name": "eevee_topology_gate",
        "source": str(src),
        "voxel_size": voxel,
        "decimate_ratio": decimate_ratio,
        "before": before,
        "after": after,
        "outputs": {
            "remesh_glb": str(remesh_path),
            "blend": str(blend_path),
            "before_png": str(out_dir / "01_before.png"),
            "after_png": str(out_dir / "01_after.png"),
        },
        "gate": {
            "status": gate,
            "paw_count": paw_count,
            "need_paws": 3,
            "neck_ruff_welded": after["neck_ruff"]["welded_to_body"],
            "reason": (
                "重网格后找到 %s 个脚掌簇。" % paw_count
                + ("可以进入绑骨。" if paw_count >= 3 else "少於 3,腿分不开,停止绑骨。")
            ),
        },
    }
    C.write_json(report_path, report)
    print("GATE", gate, report["gate"]["reason"])
    print("REPORT", report_path)


def bpy_save(path):
    import bpy

    C.ensure_dir(Path(path).parent)
    bpy.ops.wm.save_as_mainfile(filepath=str(path))


if __name__ == "__main__":
    main()
