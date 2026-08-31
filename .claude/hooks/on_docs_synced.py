#!/usr/bin/env python3
"""PostToolUse hook: fires after Edit/Write calls.
If the edited file is one of the harness docs, clear the
"unsynced blueprint change" sentinel dropped by on_blueprint_compile.py.
"""
import json
import os
import sys

for _stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 2026-09-01:文档拆分后,"算作已同步"的目标从 2 份扩到 4 份。
#   UE蓝图状态.md   —— 蓝图结构快照(改了变量/函数/连线必须写这里)
#   UE节点备忘录.md —— 案例档案(踩了新坑写这里,编号连续)
#   UE硬规则.md     —— 坑的结论提炼(能提炼成通用规则的,同时写这里)
#   UE规则对齐表.md —— 改了战斗规则、与 web 的对齐状态有变化时写这里
TARGET_NAMES = (
    "UE蓝图状态.md",
    "UE节点备忘录.md",
    "UE硬规则.md",
    "UE规则对齐表.md",
)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or ""
    base = os.path.basename(file_path)

    if base not in TARGET_NAMES:
        return 0

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or "."
    sentinel = os.path.join(project_dir, ".claude", "hooks", ".ue_docs_dirty")

    try:
        if os.path.exists(sentinel):
            os.remove(sentinel)
    except Exception:
        pass

    return 0


if __name__ == "__main__":
    sys.exit(main())
