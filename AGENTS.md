# AGENTS.md

## Cursor Cloud specific instructions

本仓库是 **纹兽战记**：一个纯前端、零构建的浏览器战棋游戏（原生 HTML/CSS/JavaScript，无框架、无打包器、无 `package.json`），外加 `balance/` 目录下的一批 Node.js 平衡性模拟脚本。没有后端、数据库或构建步骤。

### 服务与常用命令

| 用途 | 命令 | 说明 |
| --- | --- | --- |
| 运行游戏（本体） | `python3 -m http.server 8000`（在仓库根目录），浏览器打开 `http://localhost:8000/index.html` | 纯静态托管即可。README 说可直接双击 `index.html`，但在云端用静态服务器托管更可靠。 |
| 平衡性模拟（“测试”层） | `cd balance && node sim.js [局数]` | 无头模拟整局对战并输出平衡指标。默认 100 局；`node sim.js 5` 跑 5 局。`TRACE=1 node sim.js 1` 逐步追踪单局。 |
| 三份规则实现对拍（一致性检查） | `cd balance && node difftest.js [样本数]` | 校验 `js/core/combat.js` / `js/core/rules.js` / `balance/sim.js` 三份公式无漂移。默认 50000 样本。 |
| 语法检查（“lint”层） | `node --check <文件.js>` | 仓库没有配置 ESLint/Prettier。维护文档推荐用 `node --check` 捕捉语法/截断错误。 |

### 非显而易见的注意事项

- **没有 `npm install` / 构建 / lint 框架。** 更新脚本本质是 no-op；不要凭空引入 `package.json` 或包管理器。
- **不要修改源码来“修复”环境**——环境本身无需安装依赖，Node（22.x）和 Python3 均已预装。
- `balance/*.js` 通过 `balance/loadData.js` 直接读取 `js/data/*.js` 的真实游戏数据，因此数值不会与游戏漂移；改数据时同时影响游戏与模拟。
- 占位精灵图运行时从 PokeAPI 公开 CDN 加载，**离线时自动回退为 emoji**，不影响游戏逻辑与模拟。
- 存档用浏览器 `localStorage`（`js/core/save.js`），无服务端持久化。
- 游戏内还有自动演示（`js/ui/autoplay.js`）与外部 agent 桥接（`js/ui/agent_api.js`，暴露 `window.snapshot()` / `window.act()`），可用真实引擎在浏览器里自动跑对战。
- 脚本在 `index.html` 末尾按依赖顺序（data → core → ui → main）以 `<script>` 标签加载，共享全局作用域，无模块系统。
