# GitHub Pages 部署发布

## A. 规格

- 状态：`accepted`。
- 等级/路线：G1 小任务，Codex 独立完成。
- 目标：将桌面 Web 生产构建发布到 GitHub Pages，并验证公开地址可加载应用与主要静态资源。
- 公开地址：`https://744619344-cell.github.io/interstellar-playground/`。

### 范围

- 为 GitHub Pages 项目站点增加独立生产构建命令，本地开发和普通构建仍使用根路径。
- 发布前运行类型检查、测试和 Pages 生产构建。
- 将 `dist` 发布到独立 `gh-pages` 分支，并在 GitHub Pages 中选择该分支作为来源。
- 检查 GitHub Pages 状态和公开地址。

### 禁止范围

- 不引入新依赖、域名、密钥、分析脚本或外部资产。
- 不改变产品功能、模型、渲染器、持久化或音频。
- 不部署到其他平台，不创建额外长期分支。

## B. Codex 前置评审

- 仓库为项目站点 `744619344-cell/interstellar-playground`，GitHub Pages 路径必须包含 `/interstellar-playground/`。
- 当前 HTTPS OAuth 凭据可推送代码，但缺少修改 `.github/workflows` 的 `workflow` scope；因此采用 GitHub Pages 官方支持的发布分支，不要求扩大账户令牌权限。
- 发布分支只包含 `dist` 产物；发布失败不能表述为成功，必须检查 Pages API 状态和公开 URL。

## C. Codex 实现与自查

- 新增 `npm run build:pages`，只为 Pages 构建设置 `/interstellar-playground/` 基路径；本地开发和普通构建不变。
- 本地门禁：`npm run typecheck` 通过；`npm test` 为 159 passed / 0 failed；Pages 生产构建通过。
- 生成的 `dist/index.html` 中脚本和样式均以 `/interstellar-playground/assets/` 开头，符合项目站点路径。

## D. Codex 验收

- 结论：通过。
- 仓库已按用户确认由 Private 改为 Public；GitHub Pages 来源为 `gh-pages` 分支根目录，HTTPS 强制开启。
- 发布分支提交：`777aadef812f3a36bf284ef2903bdac6aa637222`。
- GitHub Pages API 状态：`built`。
- 公网检查：首页、JavaScript、CSS 与 `spacecraft-pbr-lod1` GLB 均返回 HTTP 200。
- 已知非阻断项：生产构建仍报告主 JavaScript 分块超过 500 kB；该性能优化不属于本部署任务。

## E. 面向用户的结果

- 在线地址：`https://744619344-cell.github.io/interstellar-playground/`。
- 发布完成，可通过桌面浏览器直接访问；后续重新发布需运行 `npm run build:pages` 并更新 `gh-pages` 分支。
