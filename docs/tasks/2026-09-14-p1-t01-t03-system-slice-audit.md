# P1-T01～T03：太阳系垂直切片现状核验

## A. 规格

- 状态：`accepted`；G1 标准联合中的只读验收准备，Grok Build 执行，Codex 最终验收。
- 目标：对已存在的注册表、视觉尺度、十星体低模、全景拖动/缩放、命中与聚焦补齐独立的源码、测试和桌面浏览器证据。
- 范围仅为 P1-T01、P1-T02、P1-T03；不得把浮动原点、LOD0、第三档 LOD 或完整阶段性能验收写成已完成。

## B. 前置评审

- 源码核对：`domain/registry.ts`、`visualScale.ts`、`cameraModel.ts`，`input/systemMapInput.ts`，`rendering/solar-system/systemMapBodies.ts`、`systemMapPick.ts`、`systemMapEngine.ts` 及对应测试。
- 自动检查：注册表恰含太阳、八大行星和月球且 ID 唯一；视觉尺度输入有效且结果有限；根地址无需参数进入一个 canvas 的太阳系。
- 桌面浏览器至少验证 1440×900：十星体存在；拖动、滚轮缩放、点击地球/月球/土星聚焦及返回全景；暂停与失焦期间不误触发；连续三目标往返 10 轮无控制台错误、无 canvas 重建，并记录预热前后资源数字。不得把 10 轮冒充路线图 30 轮阶段验收。
- 保存证据仅允许新增 `docs/evidence/2026-09-14-p1-slice/` 下最多 4 张 PNG 和一个 JSON/Markdown 报告；不得收集浏览历史、Cookie、账号或私人页面。
- 允许修改：本任务文档 C 节和上述证据目录。禁止修改 README、路线图、源码、测试、配置、依赖、资产和 Git 历史。若浏览器行为失败，只记录复现并停止，不修代码。
- 必须运行：`npm run typecheck`、`npm test`、`npm run build`、`git diff --check`、`git status --short --branch`。测试数字必须来自本轮。
- 完成后状态为 `waiting_codex_review`；逐项给出 P1-T01/T02/T03 的“证据足够 / 证据不足”，不得填写 D 节或自行标为 accepted。

## C. Grok Build 实现与自查

- 执行者：Grok Build
- 状态：`waiting_codex_review`
- 未把浮动原点、LOD0、第三档 LOD 或 30 轮性能写成完成

### 源码与测试

- P1-T01：`domain/registry.ts` 十个唯一 ID（太阳、八行星、月球）；`registry.test.ts` 断言 length=10 且 Set size=10。`visualScale.ts` 覆盖全部 ID，坐标有限；`visualScale.test.ts` 校验分离与 `MAX_SAFE_COORD`。
- P1-T02：`systemMapBodies.ts` `createSystemContent` 对 `SYSTEM_BODIES` 建网格；测试覆盖 LOD 切回与土星环。
- P1-T03：`cameraModel.ts` 拖动/缩放/聚焦过渡；`systemMapInput.ts` tap/doubletap/orbit/pan/zoom；`systemMapPick.ts` 射线与投影命中；`systemMapEngine.ts` `focus`/`overview`。`systemMapEngine.test.ts`：`focusing earth then moon then saturn leaves only saturn selected`；暂停冻行星；单 renderer。

### 浏览器 1440×900

Chrome headless CDP（未装 Playwright，未装新依赖）。证据：`docs/evidence/2026-09-14-p1-slice/`（4 PNG + `report.json`）。

- 视口 1440×900；始终 1 个 canvas；无文档滚动溢出。
- 十个星体标签均在：太阳、水星、金星、地球、月球、火星、木星、土星、天王星、海王星。
- 暂停按钮变为「继续」；`document.hidden` 后仍 1 canvas；放大/缩小按钮存在。
- 控制台无 page error。
- **失败/不足：** 标签叠在画布上，CDP 双击未进入 `is-focus`；10 轮地球/月球/土星往返未在浏览器证实。预热前后仅有 `performance.memory`（约 18MB used），无 `renderer.info`。不得冒充 30 轮阶段验收。

### 路线图项

| 项 | 结论 | 路径 |
| --- | --- | --- |
| P1-T01 | **证据足够** | `registry.ts` + 测试；浏览器十标签 |
| P1-T02 | **证据足够** | `systemMapBodies.ts` + 测试；浏览器十标签 |
| P1-T03 | **证据不足**（源码/测试足够；浏览器聚焦与 10 轮往返未成功） | 测试 `systemMapEngine.test.ts`；证据目录记录失败 |

### 共享验证

与 P0/P2 同一轮：`typecheck` 通过；`npm test` 153/153；`build` 通过；时间 2026-09-14T00:49:39Z–00:49:48Z。未填写 D 节，未标 accepted。

## D. Codex 验收

- 结论：P1-T01、P1-T02、P1-T03 均为 `accepted`。注册表/尺度测试、十星体创建、相机输入与命中测试和实际浏览器行为相互印证。
- Grok 报告中的聚焦失败属于自动化取点问题：标签通过 `pointer-events: none` 不会截获点击，标签位置也不等于星体中心，因此其四张命名为 `focus` 的截图只作为全景画面证据，不作为聚焦成功证据。
- Codex 在 1440×900 产品页面独立重测：拖动使地球投影移动 54.87 px，滚轮缩放使其移动 259.14 px；地球、月球、土星连续 10 轮共 30 次均完成选择、双击聚焦和返回全景；canvas 实例不变，页面错误为 0。模拟 `document.hidden` 后 600 ms 投影漂移为 0。
- Codex 于 2026-09-14 独立执行：`npm run typecheck` 通过；`npm test` 153 passed / 0 failed；`npm run build` 通过，保留既有大包提示。
- 本结论不覆盖浮动原点、LOD0、第三档 LOD 或路线图要求的 30 轮完整阶段性能门禁。
