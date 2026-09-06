# -*- coding: utf-8 -*-
"""
实验 2 路径 A:UniRig 环境门禁。

这份脚本跑在系统 Python 上,不进 Blender。
它不装 UniRig(装上需要 conda + Python 3.11 + flash_attn + spconv,
而且 Windows + Blackwell 显卡有已知蒙皮错误)。

它只如实回答:「这台机器现在能不能跑 UniRig?」
回答是否,就把原因写进报告,主路径继续走 Rigify。
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def configure_stdio():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass


def which(name):
    return shutil.which(name)


def py_versions():
    found = []
    py = which("py")
    if py:
        try:
            out = subprocess.check_output([py, "-0p"], text=True, stderr=subprocess.STDOUT)
            found.append(out.strip())
        except Exception as exc:
            found.append("py -0p failed: %s" % exc)
    return found


def look_for_unirig():
    candidates = [
        Path.home() / "UniRig",
        Path("C:/AI/UniRig"),
        Path("D:/AI/UniRig"),
        Path("C:/Users/AI_Work/UniRig"),
        Path(__file__).resolve().parents[2] / "UniRig",
    ]
    return [str(p) for p in candidates if p.exists()]


def gpu_name():
    if not which("nvidia-smi"):
        return None
    try:
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            text=True,
            stderr=subprocess.STDOUT,
        )
        return out.strip()
    except Exception as exc:
        return "nvidia-smi failed: %s" % exc


def main():
    configure_stdio()
    here = Path(__file__).resolve().parent
    report_path = here.parent / "reports" / "02_unirig_gate.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)

    blockers = []
    if not which("conda"):
        blockers.append("没有 conda,UniRig 官方安装路径走不通")
    versions = py_versions()
    has_311 = any("3.11" in v for v in versions)
    if not has_311:
        blockers.append("系统 py 启动器没有 Python 3.11(当前只有 3.14)")
    repos = look_for_unirig()
    if not repos:
        blockers.append("磁盘上没有现成的 UniRig 仓库")

    gpu = gpu_name()
    notes = [
        "UniRig issue 记录过 Windows 蒙皮权重错误、Linux 才正常。",
        "本机是 RTX 5080(Blackwell)。有人给 5090 提过补丁,不能默认开箱能跑。",
        "官方还依赖 flash_attn / spconv / torch_scatter,和现有 Hunyuan(torch 2.10/cu130)环境会打架。",
        "所以对照实验的结论是:路径 A 在环境门禁被拦住,不污染现有 Comfy/Hunyuan 环境去强装。",
    ]

    status = "BLOCKED" if blockers else "READY"
    report = {
        "experiment": 2,
        "path": "A_unirig",
        "status": status,
        "python": sys.version,
        "py_launcher_versions": versions,
        "conda": which("conda"),
        "unirig_repos": repos,
        "gpu": gpu,
        "blockers": blockers,
        "notes": notes,
        "decision": "主路径继续用 Rigify wolf metarig。等单独备好 conda+3.11 再做真正的 UniRig 对照。",
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("UNIRIG_GATE", status)
    for b in blockers:
        print(" -", b)
    print("REPORT", report_path)


if __name__ == "__main__":
    main()
