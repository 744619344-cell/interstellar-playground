# 入口、UI 语义与当前文档整理

## A. 规格

- 状态：`accepted`。
- 等级/路线：G1 标准联合；Codex 已完成规格与边界，Grok Build 实现和自测，Codex 最终验收。
- 目标：完成全仓库质量审计中已确认的低风险维护，不改变产品行为、视觉、渲染和数据。

验收标准：

1. `src/App.tsx` 只从 `./features/space-exploration` 公共入口导入 `SystemMapShell`，不再直接引用 `ui/SystemMapShell`。
2. `src/App.test.ts` 明确验证根应用使用公共 feature 入口，并拒绝内部 `/ui/` 导入；保留原有桌面根入口断言。
3. `ShipCameraPreviewPanel.tsx` 与 `ShipNavigationPanel.tsx` 的每个 `<button>` 都显式声明 `type='button'`；按钮文案、禁用状态、`aria-*`、action 字符串和回调不变。
4. `README.md` 不再把 P3-T06 写成下一项；清楚区分独立资产查看器与已经接入根产品流程的 PBR LOD1 飞船，仍说明其他预览/机械交互的边界。
5. `docs/space-exploration/14-SPACECRAFT-PREVIEW-GUIDE.md` 的开头不再声称所有飞船 GLB 均未接入；说明独立查看器不是产品流程，而 P3-T06 已将 PBR LOD1 接入 `SystemMapShell`。不要把历史人工检查写成新实测。
6. 类型检查、153 项现有测试和生产构建均通过，不减少或删除测试。

## B. Codex 前置评审

允许修改：

- `src/App.tsx`
- `src/App.test.ts`
- `src/features/space-exploration/ui/ShipCameraPreviewPanel.tsx`
- `src/features/space-exploration/ui/ShipNavigationPanel.tsx`
- `README.md`
- `docs/space-exploration/14-SPACECRAFT-PREVIEW-GUIDE.md`
- 本任务文档 C 节和实现状态

禁止修改：

- 其他源码、测试、文档、CSS、配置、依赖、锁文件、模型、纹理和生成资产。
- 不修改 UI 文案、样式、事件映射、飞行/航线状态机、WebGL renderer、资源加载或释放逻辑。
- 不更新历史任务记录或资产快照；`09-ASSET-INVENTORY.md` 的 2026-09-12 快照保持原样。
- 不提交、推送、部署、安装依赖或格式化任务外文件。

实现要求：

- 只做上述最小差异，不顺手重构组件或重新导出 API。
- `App.test.ts` 的新断言应检查真实导入边界，不能只检查组件名存在。
- HTML 语义修正不需要添加镜像实现的脆弱测试；用现有测试、类型检查和构建证明无回归。
- 若公共入口导入产生循环依赖、构建差异或需要更改 `index.ts`，立即停止并在 C 节记录阻塞，不自行扩大范围。

必须执行：

- `npm run typecheck`
- `npm test`
- `npm run build`
- `git diff --check`
- `git status --short --branch`

完成后：将状态改为 `waiting_codex_review`，填写 C 节的实际文件、测试数量、构建结果和明确未做事项，然后停止写入并交回 Codex。Grok 不得填写 D 节或宣称验收通过。

## C. Grok Build 实现与自查

- 执行者：Grok Build
- 状态：`waiting_codex_review`
- 未改 `index.ts`；公共入口导入无循环依赖，构建通过

### 实际修改

- `src/App.tsx`：改为 `from './features/space-exploration'`
- `src/App.test.ts`：断言公共入口，拒绝 `/ui/`
- `ShipCameraPreviewPanel.tsx`、`ShipNavigationPanel.tsx`：全部普通按钮增加 `type='button'`，文案/`aria-*`/回调未改
- `README.md`：不再把 P3-T06 写成下一项；区分独立查看器与已接入的 PBR LOD1
- `docs/space-exploration/14-SPACECRAFT-PREVIEW-GUIDE.md`：开头改为查看器不是产品流程，P3-T06 已接入 PBR LOD1

### 验证（本轮）

- `npm run typecheck`：通过
- `npm test`：`# tests 153` `# pass 153` `# fail 0`（2026-09-15T13:48:19Z–13:48:28Z）
- `npm run build`：通过（既有 chunk 体积警告）
- `git diff --check`：exit 0（有 LF/CRLF 提示，无空白错误）
- `git status --short --branch`：`## main...origin/main`；上述 6 个已跟踪文件已改；本任务文档未跟踪

### 明确未做

- 未改 renderer、飞行/航线、CSS、文案、事件映射、依赖、资产
- 未更新历史任务或 `09-ASSET-INVENTORY.md`
- 未提交、推送、部署、安装依赖
- 未填写 D 节，未宣称验收通过

## D. Codex 验收

- 结论：`accepted`。实际差异只涉及 B 节允许的 6 个既有文件；另有本任务文档及 Codex 审计文档处于未跟踪状态，没有发现 Grok 扩大业务范围。
- `App.tsx` 已通过既有 feature barrel 导入默认 `SystemMapShell`；`App.test.ts` 同时要求公共入口并拒绝 `/ui/` 路径。类型检查和生产构建均通过，未产生循环依赖。
- 静态逐项核对：`ShipCameraPreviewPanel.tsx` 6 个按钮、`ShipNavigationPanel.tsx` 4 个按钮，全部显式使用 `type='button'`；diff 中没有文案、`aria-*`、disabled、action 或回调变化。
- README 与独立预览指南准确记录 P3-T06 已接入 PBR LOD1，并继续限定 HTML 查看器和机械交互不属于已完成的产品流程；没有把历史检查冒充本轮浏览器实测。
- Codex 独立执行：`npm run typecheck` 通过；`npm test` 为 153 passed / 0 failed；`npm run build` 通过，保留既有大 chunk 警告；`git diff --check` 无空白错误。
- 未提交、推送、部署、安装依赖或修改资产。Git 的 LF/CRLF 输出是既有换行转换提示，不是 diff 错误。

## E. 面向用户的结果

- 公共入口、按钮语义与当前文档整理已通过 Codex 验收。产品行为和视觉保持不变，可继续后续任务。
