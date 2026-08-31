# ue-blueprint-paste-gen（仓库内最小替代）

> 原 skill 不在 Cloud Agent 环境里。本目录用 `ue/tools/paste_gen.py` 顶上「pin 注册表 + 连线校验」这条硬规则。完整操作仍以 `ue/STEP5b_DEF_K操作清单.md` 为准。

## 生成 CalcDamage 数学子图

```bash
python3 ue/tools/paste_gen.py calc_damage > ue/paste/CalcDamage_subgraph.txt
```

然后：
1. 打开生成的 txt，从第一行 `Begin Object` 起全选复制（不要带开头的 `;` 注释行——脚本已把注释写成 `;` 开头，若 UE 拒贴，先删注释行）。
2. 在 `BP_GridManager` → `CalcDamage` 函数图空白处 Ctrl+V。
3. 按 txt 头注释把 Atk/Def/返回值三条线手动接上（粘贴块连不到「图里已有的旧节点」）。
4. Compile。若 `Round` 节点静默消失：手搜 `Round` 重建那一颗，按备忘录核对函数名。

## 硬规则（从 UE节点备忘录搬过来）

- 生成后必须跑校验（脚本默认 `validate()`，失败不输出可用块）。
- 禁止手写大段 LinkedTo。
- `Max` 不是 `Max_IntInt`。
- 非 self 变量三件套：本最小生成器**不**生成 TryAttack 全文；那部分继续人工或等本机 MCP。
