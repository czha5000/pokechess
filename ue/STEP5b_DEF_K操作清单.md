# Step5b · 真实伤害公式 DEF_K + Class Defaults

> 本清单给**人类在 UE 编辑器里做机械操作**用。Cloud Agent 碰不到你本机的 `MyProject 5.8` / Unreal MCP（只监听 `127.0.0.1`），所以本步靠你粘贴/点节点/Compile/Play，再把 PASS/FAIL 回传。

---

## 0. 开始前先想清楚的 4 个点（质疑清单）

1. **Class Defaults 没设好就改公式 = 测不准**  
   文档里上次测试出现过「打印 -30 / HP 疑似默认 0」。若不先把 HP/Atk/Def 设成已知数，你分不清是公式错了还是默认值垃圾。
2. **本步只换公式，不碰状态机**  
   「移动模式 vs 攻击模式」仍是已知坑。本步刻意不改，避免一次改两处无法定位。
3. **切片公式刻意不含技能倍率/克制/LOS**  
   UE 版：`d = max(1, round(Atk × DEF_K / (DEF_K + Def)))`，`DEF_K = 9`。  
   Web 完整版还乘招倍率、克制、掩体、LOS……那些留到对表阶段，别现在塞进来。
4. **推荐抽独立 Function `CalcDamage`，再让 `TryAttack` 调用**  
   不要在 `TryAttack` 里原地打补丁。独立函数坏了可以整段删掉重建，EventGraph/大函数里补丁成本高得多（见 Harness 原则 2）。

若你不同意以上任一条，回复「停止质疑」并说明改法；否则按下面做。

---

## 1. 先设 Class Defaults（必做，约 2 分钟）

打开 `BP_Unit` → 工具栏旁 **Class Defaults**（不是某个实例）。

| 变量 | 设为 | 为什么 |
|---|---|---|
| MaxHP | 30 | 和 HP 对齐，后面血条也能用 |
| HP | 30 | 足够打几下再死，方便数次数 |
| Atk | 12 | 接近 web「小火龙」量级 |
| Def | 4 | 同上 |
| Spd | 7 | 暂不参与伤害，占位 |
| MoveRange | 4 | 已有默认可核对 |
| AtkRange | 1 | 邻格攻击，便于测距离 |

Compile → Save。

**预期伤害（手算，验收用）：**
```
d = max(1, round(12 × 9 / (9 + 4)))
  = max(1, round(108 / 13))
  = max(1, round(8.307…))
  = 8
```
打满血敌人需要 `ceil(30/8) = 4` 次邻格攻击才会 Destroy。

**对照旧占位公式（用来证明你真换成功了）：**
- 旧：`max(0, 12-4) = 8`（碰巧一样！所以还要测第 2 组）
- 第 2 组临时改 Class Defaults：`Atk=5, Def=20`  
  - 旧占位：`max(0, 5-20) = 0`（无伤）  
  - 新公式：`max(1, round(45/29)) = max(1, round(1.55)) = 2`  
  若仍无伤 → 公式没换上。测完把 Defaults 改回 12/4/30。

---

## 2. 新建纯函数 `CalcDamage`（在 BP_GridManager）

### 2.1 函数签名
- 打开 `BP_GridManager` → My Blueprint → **+ Function** → 命名 `CalcDamage`
- 在 Details 勾选 **Pure**（无白色执行线，只算数值）
- 输入：
  - `Atk` · Integer
  - `Def` · Integer
- 输出：
  - `Damage` · Integer（在函数返回节点上加输出 pin，或用 Return Node）

可选：在 `BP_GridManager` 加变量 `DEF_K`（Integer，默认 **9**），函数里读它而不是写死常量——以后对表改旋钮不用改图。

### 2.2 节点接法（初级版逐步说明）

目标：`Damage = max(1, round(Atk * DEF_K / (DEF_K + Def)))`

推荐用 **浮点 + Round**（对齐 web 的 `Math.round`）：

```
[Atk] ──Conv_IntToFloat──┐
                         ├─ Multiply (× DEF_K 的 float) ─┐
[DEF_K]─Conv_IntToFloat──┘                               │
                                                         ├─ Divide ─┬─ Round ─┬─ Max( , 1) → Damage
[Def] ──┐                                                │         │         │
        ├─ Add_IntInt ─ Conv_IntToFloat ─────────────────┘         │         │
[DEF_K]─┘                                                          │         │
                                                              (整数)      (与常量1)
```

逐步操作：
1. 从 `Atk` 拖线 → 右键搜 `to float` / `Conv_IntToFloat`。
2. 再 `Multiply`（浮点），另一边接 `9.0`（或 `DEF_K` 转 float）。
3. `Def` 与 `DEF_K` 用 `Add_IntInt` 相加 → 再 `Conv_IntToFloat`。
4. `Divide`：分子=步骤2结果，分母=步骤3结果。
5. 右键搜 `Round`（Kismet Math Library，float/double → int）。
6. `Max`（注意函数名是 **`Max`**，不是 `Max_IntInt`！）一边接 Round 结果，一边常量 `1`。
7. Max 输出接到函数的 `Damage` 返回值。

Compile。若报错：把完整 Compile 错误原文贴回来（不要截一半）。

### 2.3 整数兜底（若 Round 节点怎么都找不到）

正整数的四舍五入可用：
```
denom = DEF_K + Def
Damage = Max(1, (Atk * DEF_K + denom / 2) / denom)   // 全是整数节点
```
节点：`Multiply_IntInt`、`Add_IntInt`、`Divide_IntInt`、`Max`。  
与 float Round 在 `.5` 边界偶有差异，切片阶段可接受；对表前再统一。

---

## 3. 改 `TryAttack`：删占位减法，改调 `CalcDamage`

打开 `BP_GridManager` → 函数 `TryAttack`。

找到现在的伤害段（文档快照）：
```
伤害 = Max(SelectedUnit.Atk - Defender.Def, 0)
```

操作：
1. **删掉**「Atk − Def → Max(..., 0)」那一小段节点（只删伤害计算，别动距离判断 / Destroy / ClearHighlights）。
2. 在原位置放 `CalcDamage`：
   - `Atk` ← `SelectedUnit.Atk`（非 self 变量，三件套规则见 `UE节点备忘录.md`）
   - `Def` ← `Defender.Def`
3. `CalcDamage` 的 `Damage` 输出 → 接到原来的「`新HP = Max(Defender.HP - 伤害, 0)`」里的「伤害」那一根线。
4. **临时**在 Set HP 之后加 `Print String`：把 Damage 打出来（方便验收）。测通后再删 Print。

### ⚠ 手动连线必查（历史翻车点）
- `K2_DestroyActor` 的 **Target 必须是 Defender**，绝不能空着（空着会毁 GridManager）。
- 非 self 的 VariableGet（SelectedUnit 的 Atk、Defender 的 Def/HP）必须带 `MemberParent` + `NotSelfContext`（编辑器里从对象拖变量一般会自动对；若你是粘贴块则必须校验）。

Compile → Save。

---

## 4. Play 验收（对照 `UE测试用例.md`）

| # | 操作 | 期望 | 记 PASS/FAIL |
|---|---|---|---|
| A | Class Defaults 已是 Atk12/Def4/HP30 | 打开 Defaults 核对 | |
| B | 点我方 → 点邻格敌方 | Print 伤害 **8**；敌方 HP 30→22 | |
| C | 再打 3 次（共 4 次） | 第 4 次敌方被 Destroy 移除 | |
| D | 点超出 AtkRange 的敌方 | 无掉血、无 Print | |
| E | 临时 Defaults 改 Atk5/Def20，打一下 | Print **2**（若是 0 = 仍是旧公式） | |
| F | E 测完改回 12/4/30 | — | |

全部 PASS 后：删临时 Print；回传本表结果；Agent 再更新 `UE蓝图状态.md` / `UE测试用例.md` / 续接区。

---

## 5. 本步明确不做

- 移动/攻击状态机分离  
- 血条 UMG  
- 胜负判定  
- 敌方 AI  
- 18 属性克制 DataTable  
- Spd 真排序  

做完 Step5b，切片第 5 步才算闭环，下一步才是第 6 步血条+胜负。
