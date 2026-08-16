#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ue/tools/paste_gen.py
=====================
最小可用的 UE Blueprint 剪贴板粘贴块生成器（Cloud 环境缺 ue-blueprint-paste-gen skill 时的仓库内替代）。

为什么需要这个脚本？
- 手写 K2Node 文本时，很容易把 LinkedTo 指到「不存在的 PinId」，编辑器静默丢线。
- 本脚本用「pin 注册表」：先登记每个节点的每个 pin，再连线；生成结束后校验
  「每条 LinkedTo 引用的 (NodeName, PinId) 都存在」，校验不过直接 exit(1)。

用法示例：
  python3 ue/tools/paste_gen.py calc_damage > ue/paste/CalcDamage_subgraph.txt

注意：
- 粘贴块是「增量」：块内互连可靠；连到图里已有旧节点的线不会自动接上，需人工拖线。
- 函数名必须精确，写错会静默丢节点（见 UE节点备忘录.md）。
- 本生成器覆盖「纯数学子图」；含 BP_Unit 非 self 变量的完整 TryAttack 仍建议人工接线
  或等本机 Unreal MCP / 完整 skill 可用后再自动生成。
"""

from __future__ import annotations

import argparse
import sys
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


def new_guid() -> str:
    """生成 UE 风格的 32 位十六进制 GUID（无连字符）。"""
    return uuid.uuid4().hex.upper()


@dataclass
class Pin:
    """一个节点引脚的完整描述，写入 CustomProperties Pin (...) 时用。"""

    pin_id: str
    name: str
    category: str  # exec / int / real / bool / object / ...
    direction: str = ""  # "" = input, "EGPD_Output" = output
    default: Optional[str] = None
    subcategory_object: Optional[str] = None
    hidden: bool = False
    tool_tip: str = ""
    # 连线目标：(对方节点 Name 属性, 对方 pin_id)
    linked_to: List[Tuple[str, str]] = field(default_factory=list)


@dataclass
class Node:
    """一个 Begin Object ... End Object 节点。"""

    key: str  # 逻辑键，脚本内部用（稳定、好读）
    class_path: str
    name: str  # 写入 Name="..."，也是 LinkedTo 里引用的名字
    fields: List[str] = field(default_factory=list)  # 额外属性行，如 FunctionReference=...
    pins: Dict[str, Pin] = field(default_factory=dict)  # pin 逻辑名 → Pin
    pos_x: int = 0
    pos_y: int = 0
    node_guid: str = field(default_factory=new_guid)


class PasteBuilder:
    """
    粘贴块构建器：登记节点/引脚 → 连线 → 校验 → 导出文本。
    """

    def __init__(self) -> None:
        self.nodes: Dict[str, Node] = {}

    def add_node(
        self,
        key: str,
        class_path: str,
        name: Optional[str] = None,
        fields: Optional[List[str]] = None,
        pos: Tuple[int, int] = (0, 0),
    ) -> Node:
        """登记一个节点。name 默认用 key，保证 LinkedTo 引用稳定。"""
        if key in self.nodes:
            raise ValueError(f"重复节点 key: {key}")
        node = Node(
            key=key,
            class_path=class_path,
            name=name or key,
            fields=list(fields or []),
            pos_x=pos[0],
            pos_y=pos[1],
        )
        self.nodes[key] = node
        return node

    def add_pin(
        self,
        node_key: str,
        pin_key: str,
        name: str,
        category: str,
        *,
        output: bool = False,
        default: Optional[str] = None,
        subcategory_object: Optional[str] = None,
        hidden: bool = False,
        tool_tip: str = "",
    ) -> Pin:
        """给已登记节点加一个 pin，并分配唯一 PinId。"""
        node = self.nodes[node_key]
        if pin_key in node.pins:
            raise ValueError(f"节点 {node_key} 重复 pin: {pin_key}")
        pin = Pin(
            pin_id=new_guid(),
            name=name,
            category=category,
            direction="EGPD_Output" if output else "",
            default=default,
            subcategory_object=subcategory_object,
            hidden=hidden,
            tool_tip=tool_tip,
        )
        node.pins[pin_key] = pin
        return pin

    def link(self, a: Tuple[str, str], b: Tuple[str, str]) -> None:
        """
        双向登记一条连线。
        a/b = (node_key, pin_key)。校验阶段会确认双方 PinId 都在注册表里。
        """
        na, pa = a
        nb, pb = b
        pin_a = self.nodes[na].pins[pa]
        pin_b = self.nodes[nb].pins[pb]
        pin_a.linked_to.append((self.nodes[nb].name, pin_b.pin_id))
        pin_b.linked_to.append((self.nodes[na].name, pin_a.pin_id))

    def validate(self) -> None:
        """
        硬校验：每条 LinkedTo 引用的 (NodeName, PinId) 必须存在。
        这是当年手写粘贴块翻车的根因防护。
        """
        # name → node
        by_name = {n.name: n for n in self.nodes.values()}
        # (name, pin_id) 集合
        known = set()
        for n in self.nodes.values():
            for p in n.pins.values():
                known.add((n.name, p.pin_id))

        errors: List[str] = []
        for n in self.nodes.values():
            for pkey, p in n.pins.items():
                for target_name, target_pid in p.linked_to:
                    if target_name not in by_name:
                        errors.append(
                            f"{n.key}.{pkey} → 未知节点名 {target_name}"
                        )
                    elif (target_name, target_pid) not in known:
                        errors.append(
                            f"{n.key}.{pkey} → {target_name} 上不存在 PinId {target_pid}"
                        )
        if errors:
            raise SystemExit(
                "粘贴块连线校验失败（拒绝输出）:\n  - " + "\n  - ".join(errors)
            )

    def _fmt_pin(self, pin: Pin) -> str:
        """把一个 Pin 格式化成 UE 剪贴板里的 CustomProperties Pin (...) 行。"""
        linked = ""
        if pin.linked_to:
            # LinkedTo=(NodeName PinId, NodeName2 PinId2,)
            parts = [f"{name} {pid}" for name, pid in pin.linked_to]
            linked = "LinkedTo=(" + ",".join(parts) + ",),"

        direction = f'Direction="{pin.direction}",' if pin.direction else ""
        default = f'DefaultValue="{pin.default}",' if pin.default is not None else ""
        sub_obj = (
            f"PinType.PinSubCategoryObject={pin.subcategory_object},"
            if pin.subcategory_object
            else "PinType.PinSubCategoryObject=None,"
        )
        tip = f'PinToolTip="{pin.tool_tip}",' if pin.tool_tip else ""

        return (
            f'CustomProperties Pin (PinId={pin.pin_id},PinName="{pin.name}",'
            f"{tip}"
            f"{direction}"
            f'PinType.PinCategory="{pin.category}",'
            f'PinType.PinSubCategory="",'
            f"{sub_obj}"
            f"PinType.PinSubCategoryMemberReference=(),"
            f"PinType.PinValueType=(),"
            f"PinType.ContainerType=None,"
            f"PinType.bIsReference=False,PinType.bIsConst=False,"
            f"PinType.bIsWeakPointer=False,PinType.bIsUObjectWrapper=False,"
            f"PinType.bSerializeAsSinglePrecisionFloat=False,"
            f"{linked}"
            f"{default}"
            f"PersistentGuid=00000000000000000000000000000000,"
            f"bHidden={'True' if pin.hidden else 'False'},"
            f"bNotConnectable=False,bDefaultValueIsReadOnly=False,"
            f"bDefaultValueIsIgnored=False,bAdvancedView=False,bOrphanedPin=False,)"
        )

    def export(self) -> str:
        """校验通过后，导出可 Ctrl+V 的完整文本。"""
        self.validate()
        chunks: List[str] = []
        for node in self.nodes.values():
            lines = [
                f"Begin Object Class={node.class_path} Name=\"{node.name}\""
            ]
            lines.extend(f"   {f}" for f in node.fields)
            lines.append(f"   NodePosX={node.pos_x}")
            lines.append(f"   NodePosY={node.pos_y}")
            lines.append(f"   NodeGuid={node.node_guid}")
            for pin in node.pins.values():
                lines.append(f"   {self._fmt_pin(pin)}")
            lines.append("End Object")
            chunks.append("\n".join(lines))
        return "\n".join(chunks) + "\n"


# ---------------------------------------------------------------------------
# 具体子图：CalcDamage 纯数学部分（浮点 Round 版）
# ---------------------------------------------------------------------------

MATH = "Class'/Script/Engine.KismetMathLibrary'"
# UE 剪贴板里 MemberParent 常见写法：
MATH_REF = f'(MemberParent={MATH},MemberName="{{name}}")'


def build_calc_damage_math() -> str:
    """
    生成 CalcDamage 函数内部的「纯数学」子图（不含入口参数节点）。

    假设你已经在函数里有：
      - 输入 pin: Atk, Def（或两个 VariableGet）
      - 可选: DEF_K VariableGet（默认 9）
    粘贴后需要手动把 Atk/Def/DEF_K 接到标注了 TODO 的输入 pin。

    公式: max(1, round(Atk * DEF_K / (DEF_K + Def)))
    """
    b = PasteBuilder()

    # --- 常量 DEF_K=9（若你改用变量，删掉这个节点，改接 VariableGet）---
    # 用 CallFunction 的默认值更稳：直接在 Multiply/Add 的 pin 上写 DefaultValue。

    # Conv Atk: 外部手工接 Atk → 本节点 self 无，用 CallFunction Conv_IntToFloat
    # 简化：用一组 CallFunction 搭完整公式，Atk/Def 以「未连接的输入 pin」暴露。

    # 1) Atk 转 float —— 输入 pin "InInt" 留给人工接 Atk
    b.add_node(
        "conv_atk",
        "/Script/BlueprintGraph.K2Node_CallFunction",
        fields=[
            "bIsPureFunc=True",
            f'FunctionReference=(MemberParent={MATH},MemberName="Conv_IntToFloat")',
        ],
        pos=(-600, 0),
    )
    b.add_pin("conv_atk", "self", "self", "object", hidden=True,
              subcategory_object="Class'/Script/Engine.KismetMathLibrary'")
    b.add_pin("conv_atk", "in", "InInt", "int", default="0",
              tool_tip="TODO: 接函数输入 Atk")
    b.add_pin("conv_atk", "out", "ReturnValue", "real", output=True)

    # 2) Def 转 float
    b.add_node(
        "conv_def",
        "/Script/BlueprintGraph.K2Node_CallFunction",
        fields=[
            "bIsPureFunc=True",
            f'FunctionReference=(MemberParent={MATH},MemberName="Conv_IntToFloat")',
        ],
        pos=(-600, 200),
    )
    b.add_pin("conv_def", "self", "self", "object", hidden=True,
              subcategory_object="Class'/Script/Engine.KismetMathLibrary'")
    b.add_pin("conv_def", "in", "InInt", "int", default="0",
              tool_tip="TODO: 接函数输入 Def")
    b.add_pin("conv_def", "out", "ReturnValue", "real", output=True)

    # 3) DEF_K 常量 9 → float（用 Conv，DefaultValue=9，无需外部输入）
    b.add_node(
        "conv_k",
        "/Script/BlueprintGraph.K2Node_CallFunction",
        fields=[
            "bIsPureFunc=True",
            f'FunctionReference=(MemberParent={MATH},MemberName="Conv_IntToFloat")',
        ],
        pos=(-600, 400),
    )
    b.add_pin("conv_k", "self", "self", "object", hidden=True,
              subcategory_object="Class'/Script/Engine.KismetMathLibrary'")
    b.add_pin("conv_k", "in", "InInt", "int", default="9",
              tool_tip="DEF_K 常量=9；若改用变量，断开默认值改接 VariableGet")
    b.add_pin("conv_k", "out", "ReturnValue", "real", output=True)

    # 4) Atk * DEF_K
    b.add_node(
        "mul",
        "/Script/BlueprintGraph.K2Node_CallFunction",
        fields=[
            "bIsPureFunc=True",
            f'FunctionReference=(MemberParent={MATH},MemberName="Multiply_FloatFloat")',
        ],
        pos=(-200, 0),
    )
    b.add_pin("mul", "self", "self", "object", hidden=True,
              subcategory_object="Class'/Script/Engine.KismetMathLibrary'")
    b.add_pin("mul", "a", "A", "real", default="0.0")
    b.add_pin("mul", "b", "B", "real", default="0.0")
    b.add_pin("mul", "out", "ReturnValue", "real", output=True)
    b.link(("conv_atk", "out"), ("mul", "a"))
    b.link(("conv_k", "out"), ("mul", "b"))

    # 5) DEF_K + Def（先 int 加，再转 float）—— 用 float 加更少节点：
    #    Add_FloatFloat(conv_k, conv_def)
    b.add_node(
        "add",
        "/Script/BlueprintGraph.K2Node_CallFunction",
        fields=[
            "bIsPureFunc=True",
            f'FunctionReference=(MemberParent={MATH},MemberName="Add_FloatFloat")',
        ],
        pos=(-200, 250),
    )
    b.add_pin("add", "self", "self", "object", hidden=True,
              subcategory_object="Class'/Script/Engine.KismetMathLibrary'")
    b.add_pin("add", "a", "A", "real", default="0.0")
    b.add_pin("add", "b", "B", "real", default="0.0")
    b.add_pin("add", "out", "ReturnValue", "real", output=True)
    b.link(("conv_k", "out"), ("add", "a"))
    b.link(("conv_def", "out"), ("add", "b"))

    # 6) Divide
    b.add_node(
        "div",
        "/Script/BlueprintGraph.K2Node_CallFunction",
        fields=[
            "bIsPureFunc=True",
            f'FunctionReference=(MemberParent={MATH},MemberName="Divide_FloatFloat")',
        ],
        pos=(100, 80),
    )
    b.add_pin("div", "self", "self", "object", hidden=True,
              subcategory_object="Class'/Script/Engine.KismetMathLibrary'")
    b.add_pin("div", "a", "A", "real", default="0.0")
    b.add_pin("div", "b", "B", "real", default="1.0")
    b.add_pin("div", "out", "ReturnValue", "real", output=True)
    b.link(("mul", "out"), ("div", "a"))
    b.link(("add", "out"), ("div", "b"))

    # 7) Round → int
    # UE5 常见名: Round（返回 int）。若粘贴后节点丢失，改手搜 Round。
    b.add_node(
        "round",
        "/Script/BlueprintGraph.K2Node_CallFunction",
        fields=[
            "bIsPureFunc=True",
            f'FunctionReference=(MemberParent={MATH},MemberName="Round")',
        ],
        pos=(400, 80),
    )
    b.add_pin("round", "self", "self", "object", hidden=True,
              subcategory_object="Class'/Script/Engine.KismetMathLibrary'")
    b.add_pin("round", "a", "A", "real", default="0.0")
    b.add_pin("round", "out", "ReturnValue", "int", output=True)
    b.link(("div", "out"), ("round", "a"))

    # 8) Max(round, 1) —— 已验证函数名就是 Max，不是 Max_IntInt
    b.add_node(
        "max1",
        "/Script/BlueprintGraph.K2Node_CallFunction",
        fields=[
            "bIsPureFunc=True",
            f'FunctionReference=(MemberParent={MATH},MemberName="Max")',
        ],
        pos=(700, 80),
    )
    b.add_pin("max1", "self", "self", "object", hidden=True,
              subcategory_object="Class'/Script/Engine.KismetMathLibrary'")
    b.add_pin("max1", "a", "A", "int", default="0")
    b.add_pin("max1", "b", "B", "int", default="1")  # 地板伤害 1
    b.add_pin("max1", "out", "ReturnValue", "int", output=True,
              tool_tip="TODO: 接到函数返回 Damage")
    b.link(("round", "out"), ("max1", "a"))

    return b.export()


def main() -> None:
    parser = argparse.ArgumentParser(description="UE Blueprint 粘贴块生成器（最小版）")
    parser.add_argument(
        "target",
        choices=["calc_damage"],
        help="要生成的子图：calc_damage = CalcDamage 纯数学部分",
    )
    args = parser.parse_args()

    if args.target == "calc_damage":
        text = build_calc_damage_math()
        # 文件头注释（不会被 UE 当作节点；粘贴前请删掉注释行，或从 Begin Object 起选）
        header = (
            "; CalcDamage math subgraph — 粘贴前从第一行 Begin Object 开始全选复制\n"
            "; 粘贴进 BP_GridManager.CalcDamage 函数图空白处后：\n"
            ";   1) conv_atk.InInt  ← 函数输入 Atk\n"
            ";   2) conv_def.InInt  ← 函数输入 Def\n"
            ";   3) max1.ReturnValue → 函数返回 Damage\n"
            ";   4) Compile；若 Round 节点丢失，手搜 Round 替换\n"
        )
        sys.stdout.write(header + text)


if __name__ == "__main__":
    main()
