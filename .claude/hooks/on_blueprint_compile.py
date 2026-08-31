#!/usr/bin/env python3
"""PostToolUse hook: fires after every unreal-mcp call_tool invocation.
If the call was compile_blueprint, drop a sentinel file marking
"there is an unsynced blueprint change" and print a reminder that
Claude Code surfaces back into the agent's context.
"""
import json
import os
import sys
import time

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

    tool_input = payload.get("tool_input") or {}
    inner_tool = tool_input.get("tool_name") or ""
    toolset = tool_input.get("toolset_name") or ""

    if inner_tool != "compile_blueprint":
        return 0

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or "."
    hooks_dir = os.path.join(project_dir, ".claude", "hooks")
    os.makedirs(hooks_dir, exist_ok=True)
    sentinel = os.path.join(hooks_dir, ".ue_docs_dirty")

    try:
        with open(sentinel, "a", encoding="utf-8") as f:
            f.write(f"{time.time()}\tcompile_blueprint\ttoolset={toolset}\n")
    except Exception:
        pass

    print(
        "[harness] compile_blueprint 刚执行完。这轮任务结束前必须同步 "
        "UE蓝图状态.md / UE节点备忘录.md(见 UE协作Harness规范.md)——"
        "结束回合时如果没同步,Stop hook 会拦住。"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
