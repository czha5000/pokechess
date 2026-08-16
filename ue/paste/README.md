# 粘贴块目录

| 文件 | 用途 | 粘贴到哪里 |
|---|---|---|
| `CalcDamage_subgraph.txt` | `max(1, round(Atk×9/(9+Def)))` 纯数学节点 | `BP_GridManager` → 函数 `CalcDamage` 空白处 |

## 粘贴步骤（简）

1. 先按 `ue/STEP5b_DEF_K操作清单.md` 建好空函数 `CalcDamage(Atk, Def)→Damage`（勾 Pure）。
2. 打开 `CalcDamage_subgraph.txt`，**全选复制**（文件里没有注释行，可直接贴）。
3. 在函数图空白处 Ctrl+V。
4. **手动接 3 条线**（粘贴块连不到图里已有节点）：
   - 函数输入 `Atk` → `conv_atk` 的 `InInt`
   - 函数输入 `Def` → `conv_def` 的 `InInt`
   - `max1` 的 `ReturnValue` → 函数返回 `Damage`
5. Compile。若 `Round` 节点没出现：手搜 `Round` 补上，输入接 `div` 输出，输出接 `max1.A`。

重新生成：

```bash
python3 ue/tools/paste_gen.py calc_damage
# 或
python3 -c "import runpy; ns=runpy.run_path('ue/tools/paste_gen.py'); open('ue/paste/CalcDamage_subgraph.txt','w').write(ns['build_calc_damage_math']())"
```
