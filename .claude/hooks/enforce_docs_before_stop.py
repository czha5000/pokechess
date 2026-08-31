#!/usr/bin/env python3
"""Stop hook: refuses to let the agent end its turn while there is an
unsynced blueprint change (a compile_blueprint call with no subsequent
edit to the harness docs). Fails open on any unexpected error or schema
change so a bug in this script can never hard-block the session.
"""
import json
import os
import sys

for _stream in (sys.stdin, sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8")
    except Exception:
        pass


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0

    # Already blocked once this stop cycle -- do not loop forever.
    if payload.get("stop_hook_active"):
        return 0

    try:
        project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or "."
        sentinel = os.path.join(project_dir, ".claude", "hooks", ".ue_docs_dirty")
        if os.path.exists(sentinel):
            sys.stderr.write(
                "本次会话有 compile_blueprint 改动还没同步进 "
                "UE蓝图状态.md / UE节点备忘录.md。"
                "先更新这两份文档(或至少相关的一份,并说明为什么另一份不需要改),"
                "再结束这一轮——这是 UE协作Harness规范.md 的硬性要求,不是可选项。\n"
            )
            return 2
    except Exception:
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
