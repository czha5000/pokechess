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

TARGET_NAMES = ("UE蓝图状态.md", "UE节点备忘录.md")


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
