# P2-T02～T05：飞船灰盒能力现状核验

## A. 规格

- 状态：`accepted`；G1 标准联合中的只读验收准备，Grok Build 执行，Codex 最终验收。
- 目标：对固定时间步、三视角与相机避障、驾驶舱机位、目标锁定/航向辅助/近星体防撞补齐独立证据。
- 范围仅为 P2-T02、P2-T03、P2-T04、P2-T05。P2-T06/T07 和 P3-T01～T06 已验收，必须跳过；不得接手 P3-T07。

## B. 前置评审

- 源码核对：`domain/shipFlightModel.ts`、`shipCameraCollision.ts`、`shipNavigation.ts`、`shipFlightSafety.ts`，`application/shipFlightSimulation.ts`、`shipCameraRig.ts`，`rendering/spacecraft/shipViewCamera.ts`、`shipCameraPreview.ts` 及对应测试。
- 自动检查：确认 1/120 固定步语义及异常 dt；30/60/120 FPS 等价证据；相机障碍约束；锁定、辅助、保护半径和连续碰撞的测试边界。只引用实际断言，不扩写没有覆盖的结论。
- 桌面浏览器至少验证 1440×900：进入驾驶；跟随/驾驶舱/自由视角及 C 键循环；鼠标转向、滚轮、W/S/A/D、空格制动；锁定地球/月球/土星；辅助开关；前方防撞；暂停、失焦、复位、退出。记录单 canvas、控制台错误和一次资源基线。
- 保存证据仅允许新增 `docs/evidence/2026-09-14-p2-flight/` 下最多 5 张 PNG 和一个 JSON/Markdown 报告；不得重复提交现有 P3 产品截图。
- 允许修改：本任务文档 C 节和上述证据目录。禁止修改 README、路线图、源码、测试、配置、依赖、模型/纹理/音频和 Git 历史。若发现失败，只记录最小复现并停止，不修代码。
- 必须运行：`npm run typecheck`、`npm test`、`npm run build`、`git diff --check`、`git status --short --branch`。测试数字必须来自本轮。
- 完成后状态为 `waiting_codex_review`；逐项给出 P2-T02/T03/T04/T05 的“证据足够 / 证据不足”，不得填写 D 节或自行标为 accepted。

## C. Grok Build 实现与自查

- 执行者：Grok Build
- 状态：`waiting_codex_review`
- 未改 P2-T06/T07、P3 任务或源码

### 源码与测试

- P2-T02：`SHIP_FLIGHT.stepSeconds = 1/120`，`maxFrameSeconds = 0.25`；`advance` 拒绝非有限/`<=0` dt。`shipFlightSimulation.test.ts`：30/60/120 FPS 与抖动同态；非法 dt 不变。
- P2-T03：`constrainShipCamera` 球扫掠；`shipViewCamera.ts` follow/free + 障碍；`shipCameraRig.test.ts` / `shipViewCamera.test.ts` 约束与模式。
- P2-T04：`ShipViewMode` 含 `cockpit`；座椅 `setSeat`；C 键 `nextShipView`。测试：座椅跟随、三模式循环。
- P2-T05：`SHIP_PROTECTION` radius 10 + margin 3；`assistedShipInput` 只改 yaw/pitch；`constrainShipFlight` 扫掠。`shipNavigation.test.ts`：辅助不给推力、高速穿越、30/60/120 导航同态。`systemMapEngine.test.ts`：锁定/辅助/复位。

### 浏览器 1440×900

证据：`docs/evidence/2026-09-14-p2-flight/`（5 PNG + `report.json`）。

- 进入「相机试验」：1 canvas，跟随视角，飞船已就绪，HUD `纹理 16 · 几何 38 · 程序 14`。
- 驾驶舱文案「驾驶舱 · 固定座椅」；自由观察；C 键出现「视角过渡中」。
- 地球航线「地球 · 未开始」；航向辅助 `aria-pressed=true`；前方防撞试验 `true`。
- 暂停→「继续」；复位后航线清空；退出后仍 1 canvas 且「相机试验」按钮回来。无 page error。
- **不足：** CDP 的 W/S/A/D 后速度仍 0.00 m/s，本轮未证明键盘推进。空格/鼠标拖拽未单独读出速度变化。

### 路线图项

| 项 | 结论 | 路径 |
| --- | --- | --- |
| P2-T02 | **证据足够** | 飞行模型+仿真测试（浏览器非时间步必要条件） |
| P2-T03 | **证据足够** | 相机测试 + 跟随/自由截图 |
| P2-T04 | **证据足够** | 驾驶舱测试 + 驾驶舱截图/文案 |
| P2-T05 | **证据足够**（键盘推进的浏览器演示不足，测试覆盖锁定/辅助/防撞） | `shipNavigation.test.ts`；`04-earth-route.png`、`05-assist-safety.png` |

### 共享验证

与 P0/P1 同一轮：`typecheck` 通过；`npm test` 153 pass / 0 fail；`build` 通过；`git diff --check` exit 0。时间 2026-09-14T00:49:39Z–00:49:48Z。未填写 D 节，未标 accepted。

## D. Codex 验收

- 结论：P2-T02、P2-T03、P2-T04、P2-T05 均为 `accepted`。固定时间步及异常 dt、三视角和相机避障、真实座椅机位、锁定/辅助/连续防撞均有独立自动测试覆盖。
- Grok 的 CDP 键盘操作未产生推进，属于该次浏览器输入证据不足，不据此认定产品失败。Codex 重新执行已有产品浏览器脚本，W 键改变飞行位置；暂停和失焦冻结；跟随/驾驶舱/自由视角、三条航线、复位、失败回退和加载中退出均通过。
- 产品脚本连续退出重进三轮后资源稳定为纹理 19 / 几何 44 / 程序 15，单 canvas，页面错误为 0。该数字是渲染器 HUD 资源计数，不冒充 GPU 性能分析。
- Codex 于 2026-09-14 独立执行：`npm run typecheck` 通过；`npm test` 153 passed / 0 failed；`npm run build` 通过，保留既有大包提示。
- 未重新验收 P2-T06/T07 或 P3，未修改源码、配置、依赖、资产及 Git 历史。
