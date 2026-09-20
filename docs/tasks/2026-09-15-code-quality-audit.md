# 全仓库代码质量审计

## A. 规格

- 状态：`accepted`；Codex 只读审计并划分后续任务。
- 目标：检查桌面 Web 源码的类型安全、文件规模、模块边界、事件与 WebGL 资源释放、测试覆盖、构建体积、HTML 语义和当前文档一致性。
- 本任务只记录证据和分级，不修改产品代码、测试、配置、依赖、资产或 Git 历史。

## B. 审计范围与方法

- 读取根入口、feature 公共入口、UI、领域层、应用层、Three.js 渲染与资源模块、测试、README 和当前 Phase 3 文档。
- 搜索 `any`、调试输出、待办标记、事件监听、renderer 创建和 dispose 路径；统计源码文件行数。
- 独立执行 `npm run typecheck`、`npm test`、`npm run build`。
- 按项目规则将低风险维护交给 Grok；WebGL 生命周期、状态机、依赖与构建配置保留给 Codex。

## C. 发现与分级

### 当前门禁

- `tsconfig.json` 已启用 `strict`；`npm run typecheck` 通过。
- `npm test`：153 passed / 0 failed。
- `npm run build`：通过；Vite 报告主 JS `866.77 kB`（gzip `239.56 kB`）并产生大 chunk 警告。
- 未发现生产代码中的 `TODO`、`FIXME`、`HACK` 或调试日志。
- renderer 只在 `systemMapWorld.ts` 创建；现有监听器可找到对应移除路径，资源释放和迟到加载已有回归测试。本轮没有发现可复现泄漏。

### 交给 Grok 的低风险维护

统一任务：[入口、UI 语义与当前文档整理](2026-09-15-grok-entry-ui-docs-cleanup.md)。

1. 根 `App.tsx` 绕过 `features/space-exploration/index.ts`，直接引用内部 UI 文件；改走已存在的公共入口并补强入口测试。
2. `ShipCameraPreviewPanel.tsx` 和 `ShipNavigationPanel.tsx` 的普通按钮缺少显式 `type='button'`；补齐 HTML 语义，不改变事件和文案。
3. README 的 P3-T05 “下一项为 P3-T06”及独立查看器描述未体现 P3-T06 已接入；预览指南仍称飞船 GLB 未接入 `SystemMapShell`。只校正当前事实。

### Codex 保留项

1. `systemMapEngine.ts` 为 372 行，仍低于 400 行渲染引擎上限，但只余 28 行空间。P3-T07 开始前由 Codex 设计职责拆分，不能让 Grok 为降行数机械搬移 WebGL 代码。
2. 主 JS 大 chunk 需要评估 Three.js、飞船运行时和页面入口的动态加载边界；会触及 Vite 配置或 WebGL 资源时序，按 C1 由 Codex 前审。
3. `voyageResources.ts` 与 `systemMapBodies.ts` 存在少量生产 `any`，均位于 Three.js 材质/纹理释放或 extras 处理。后续与资源边界调整一起由 Codex 收紧类型，避免低风险清理改变释放覆盖面。
4. 当前没有 lint 脚本。新增 lint 工具会修改依赖、锁文件与配置，不纳入本次 Grok 任务。
5. `systemMapEngine.test.ts` 为 377 行，但测试文件未违反现有业务/引擎规模限制；仅为拆文件而拆分不会带来足够收益，本轮不改。

## D. Codex 结论

- 结论：`accepted`。当前代码通过已有质量门禁，没有发现阻断 P3-T07 的已知功能回归。
- Grok 只执行已批准的低风险整理任务；完成后状态必须停在 `waiting_codex_review`，由 Codex 读取真实差异并复验。
- 构建拆包、渲染器拆分、Three.js 类型与释放路径均保留为后续 Codex 工作，不与本轮简单维护并行修改。

## E. 面向用户的结果

- 已完成整体代码质量检查，并将全部当前可确认的简单调整合并为一个 Grok 任务。
- 本审计未提交、推送、部署、安装依赖或引入资产。
