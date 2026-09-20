# GitHub Pages 部署发布

## A. 规格

- 状态：`implementing`。
- 等级/路线：G1 小任务，Codex 独立完成。
- 目标：通过 GitHub Actions 将 `main` 的桌面 Web 生产构建发布到 GitHub Pages，并验证公开地址可加载应用与主要静态资源。
- 公开地址：`https://744619344-cell.github.io/interstellar-playground/`。

### 范围

- 为 GitHub Pages 项目站点配置 Vite 生产资源基路径，本地开发仍使用根路径。
- 新增 GitHub Actions 工作流，在发布前运行类型检查、测试和生产构建。
- 使用 GitHub Pages 官方 artifact/deploy actions 发布 `dist`。
- 在 GitHub 仓库设置中启用 Actions 作为 Pages 发布源，并检查部署结果。

### 禁止范围

- 不引入新依赖、域名、密钥、分析脚本或外部资产。
- 不改变产品功能、模型、渲染器、持久化或音频。
- 不部署到其他平台，不创建额外长期分支。

## B. Codex 前置评审

- 仓库为项目站点 `744619344-cell/interstellar-playground`，GitHub Pages 路径必须包含 `/interstellar-playground/`。
- Pages 工作流需要 `contents: read`、`pages: write` 与 `id-token: write`；发布目录仅为 `dist`。
- 工作流失败不能表述为发布成功；必须检查 Actions 结论和公开 URL。

## C. Codex 实现与自查

- `vite.config.ts` 仅在 GitHub Actions 环境将生产基路径设为 `/interstellar-playground/`，本地开发继续使用 `/`。
- 新增 `.github/workflows/deploy-pages.yml`：`main` 推送或手动触发后依次安装锁定依赖、类型检查、测试、构建、上传 `dist` 并发布 Pages。
- 本地门禁：`npm run typecheck` 通过；`npm test` 为 159 passed / 0 failed；模拟 GitHub Actions 的生产构建通过。
- 生成的 `dist/index.html` 中脚本和样式均以 `/interstellar-playground/assets/` 开头，符合项目站点路径。

## D. Codex 验收

部署完成后填写唯一结论。

## E. 面向用户的结果

验收后填写。
