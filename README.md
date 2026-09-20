# 我们的宇宙

“我们的宇宙”是一套面向桌面 Web 的单画布太阳系探索项目。打开项目根地址即进入新版太阳系，不依赖查询参数、旧版航行入口或微信小程序。

当前能力：压缩视觉尺度的太阳系全景与星体聚焦（LOD2/LOD1）、飞船相机试验（跟随 / 驾驶舱 / 自由观察）、W/S 前后与 A/D 横移、鼠标拖拽与滚轮缩放、目标锁定、航向辅助和防撞、地球/月球/土星手动航线、程序化推进光焰与基础推进声，以及仅保存在当前浏览器的本地音乐。

尚未具备：太阳系浮动原点、星体 LOD0 近景、宇航员资产的运行时接入、舱内行走与 EVA、运行时资源预算检查、20 分钟性能验收。路线图校准见 [开发路线](docs/space-exploration/04-DELIVERY-ROADMAP.md)。

模型资产进度（2026-09-13）：外部 LOD0/1/2 与静态内舱 LOD0/1 均已通过资产级验收，内舱布局已获用户确认。开发服务支持 [外部预览](assets-source/blender/spacecraft/viewer.html) 与 [内舱预览](assets-source/blender/spacecraft/interior/viewer.html)，这些独立查看器尚未接入游戏流程。

P3-T04 机械动画已通过资产级验收：[机械预览](assets-source/blender/spacecraft/mechanisms/viewer.html)，支持内外门、控制台、推进器反馈及暂停/复位。[任务记录](docs/tasks/2026-09-13-p3-t04-spacecraft-mechanisms.md)与[资产登记](docs/space-exploration/12-SPACECRAFT-MECHANISM-ASSETS.md)包含复现方式；尚未接入游戏运行时。

P3-T05 图集优化已验收：[PBR 预览](assets-source/blender/spacecraft/pbr/viewer.html) 仍是独立资产检查入口，不是产品驾驶流程；完整装配视角绘制次数 45 → 24，保留几何和六个动画。[资产登记](docs/space-exploration/13-SPACECRAFT-PBR-ASSETS.md)记录纹理内存与文件体积取舍。

P3-T06 已将 PBR LOD1 接入根产品：点击“相机试验”即可驾驶正式飞船并切换真实驾驶座视角；内外灯光隔离，退出释放模型，碰撞保护已适配完整船体。外部/内舱/机械/舱室 HTML 查看器以及座椅、舱门、控制台交互仍不是产品流程。证据见 [P3-T06](docs/tasks/2026-09-13-p3-t06-spacecraft-visibility.md)。下一项为 P3-T07 座椅、舱门、控制台和锚点交互。

本仓库不包含移动端适配、微信小程序、H5 多端抽象、旧十星体独立玩法、照片球或旧航行回退。唯一目标平台是桌面 Web。

开发需求、架构、资产规范和路线从 [单画布太阳系探索计划](docs/space-exploration/README.md) 进入。

## 技术栈

- React 18
- Vite
- TypeScript
- Three.js
- Node Test Runner + TSX

## 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本
- 桌面浏览器，最小支持宽度 1280px

## 安装

```bash
npm install
```

## 开发

```bash
npm run dev
```

默认访问 `http://localhost:5173/`，无需任何 feature flag。

## 构建

```bash
npm run build
```

生产构建输出到 `dist`。预览使用 `npm run preview`。

## 质量检查

```bash
npm run typecheck
npm test
```

项目实行文件规模约束：React 页面/业务组件不超过 300 行，通用工具不超过 200 行，渲染引擎不超过 400 行。后续开发采用 Codex × Grok Build 联合模式，见 [AI 开发与验收流程](docs/DEVELOPMENT_WORKFLOW.md) 与 [Codex × Grok Build 联合开发工作流](docs/CODEX_GROK_WORKFLOW.md)。
