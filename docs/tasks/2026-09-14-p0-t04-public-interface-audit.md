# P0-T04：公开接口现状核验

## A. 规格

- 状态：`accepted`；G0 只读核验与文档补证，Grok Build 执行，Codex 最终验收。
- 目标：独立核对 `features/space-exploration` 的公开入口、根应用接入和模块边界，为路线图 P0-T04 补充可复现证据。
- 本任务不重构源码，不因存在文件名就宣称架构完整，不顺带处理其他路线图任务。

## B. 前置评审

- 必查：`src/features/space-exploration/index.ts`、`src/App.tsx`、所有对该 feature 的跨目录 import、现有关联测试。
- 证明公开入口可被根应用使用；列出公开导出及内部实现是否被外部绕过引用。发现绕过或循环依赖时记录证据，不修改代码。
- 允许修改：仅本任务文档 C 节。禁止修改其他文档、源码、测试、配置、依赖、资产和 Git 历史。
- 必须运行：`npm run typecheck`、`npm test`、`git diff --check`、`git status --short --branch`。测试数字必须来自本轮。
- 完成后状态为 `waiting_codex_review`；不得填写 D 节或自行标为 accepted。

## C. Grok Build 实现与自查

- 执行者：Grok Build
- 状态：`waiting_codex_review`
- 未改源码、测试、路线图、README

### 公开入口

- `src/features/space-exploration/index.ts` 仅导出 `SystemMapShell`（default 与 named）。
- `src/App.tsx` 渲染 `<SystemMapShell />`；`src/main.tsx` → `App`；`index.html` 加载 `/src/main.tsx`，无 feature flag。
- **绕过：** 根应用从 `./features/space-exploration/ui/SystemMapShell` 导入，**没有**走 `index.ts`。功能仍接到同一组件。未改代码。
- 仓库内 `from '...features/space-exploration'` 仅 `App.tsx` 一处。
- Feature 向外引用：`engines/webRenderQuality`、`src/assets/textures/*`（资源与画质，不是旧页回退）。
- 未见 feature 再导入 `App.tsx` 的循环依赖。
- 边界测试：`domain/systemMapBoundary.test.ts`（公开入口暴露 shell、禁止旧页/远程 URL）；`src/App.test.ts`（根地址无 flag）；`ui/SystemMapShell.test.ts`（单 canvas、无独立星体页）。

### 路线图项

| 项 | 结论 | 路径 |
| --- | --- | --- |
| P0-T04 | **证据足够**（存在可启动公开壳层；根应用绕过 barrel 已记录） | `index.ts`、`App.tsx`、`App.test.ts`、`systemMapBoundary.test.ts` |

### 共享验证（本轮 2026-09-14T00:49:39Z–00:49:48Z）

- `npm run typecheck`：通过
- `npm test`：`# tests 153` `# pass 153` `# fail 0`
- `npm run build`：通过（既有大 chunk 警告）
- `git diff --check`：exit 0；无已跟踪 diff
- `git status --short --branch`：`## main...origin/main`；本任务仅 C 节，无 evidence 目录

未填写 D 节，未标 accepted，未勾选路线图。

## D. Codex 验收

- 结论：`accepted`。公开入口同时提供默认和具名 `SystemMapShell`，根地址启动同一个壳层，边界测试证明没有旧页面、远程入口或额外 canvas。
- `App.tsx` 直接引用 UI 实现而未走 barrel 是可维护性建议，不影响公开入口存在、根应用接入或本任务行为；后续新消费者应从 `features/space-exploration` 入口引用。
- Codex 于 2026-09-14 独立执行：`npm run typecheck` 通过；`npm test` 153 passed / 0 failed；`npm run build` 通过，保留既有大包提示。
- 未修改源码、配置、依赖或资产；P0-T04 可在路线图标为已验收。
