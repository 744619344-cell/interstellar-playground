# 我们的宇宙

“我们的宇宙”是一套面向桌面 Web 的单画布太阳系探索项目。打开项目根地址即进入新版太阳系，不依赖查询参数、旧版航行入口或微信小程序。

在线体验：[GitHub Pages](https://744619344-cell.github.io/interstellar-playground/)

当前能力：压缩视觉尺度的太阳系全景与星体聚焦（LOD2/LOD1）、飞船相机试验（跟随 / 驾驶舱 / 自由观察）、W/S 前后与 A/D 横移、鼠标拖拽与滚轮缩放、目标锁定、航向辅助和防撞、地球/月球/土星手动航线、程序化推进光焰与基础推进声，以及仅保存在当前浏览器的本地音乐。

尚未具备：太阳系浮动原点、星体 LOD0 近景、宇航员资产的运行时接入、舱内行走与 EVA、运行时资源预算检查、20 分钟性能验收。路线图校准见 [开发路线](docs/space-exploration/04-DELIVERY-ROADMAP.md)。

模型资产进度（2026-09-13）：外部 LOD0/1/2 与静态内舱 LOD0/1 均已通过资产级验收，内舱布局已获用户确认。开发服务支持 [外部预览](assets-source/blender/spacecraft/viewer.html) 与 [内舱预览](assets-source/blender/spacecraft/interior/viewer.html)，这些独立查看器尚未接入游戏流程。

P3-T04 机械动画已通过资产级验收：[机械预览](assets-source/blender/spacecraft/mechanisms/viewer.html)，支持内外门、控制台、推进器反馈及暂停/复位。[任务记录](docs/tasks/2026-09-13-p3-t04-spacecraft-mechanisms.md)与[资产登记](docs/space-exploration/12-SPACECRAFT-MECHANISM-ASSETS.md)包含复现方式；尚未接入游戏运行时。

P3-T05 图集优化已验收：[PBR 预览](assets-source/blender/spacecraft/pbr/viewer.html) 仍是独立资产检查入口，不是产品驾驶流程；完整装配视角绘制次数 45 → 24，保留几何和六个动画。[资产登记](docs/space-exploration/13-SPACECRAFT-PBR-ASSETS.md)记录纹理内存与文件体积取舍。

P3-T06 / P3-T07 已接入真实驾驶座、七个锚点、控制台及内外舱门，支持按钮/`F` 键、机械互锁、暂停与复位。历史验收见 [P3-T06](docs/tasks/2026-09-13-p3-t06-spacecraft-visibility.md)和 [P3-T07](docs/tasks/2026-09-20-p3-t07-spacecraft-interactions.md)。

当前活动任务为 [P3-R01 飞船重制](docs/tasks/2026-09-23-p3-r01-spacecraft-art-redesign.md)（2026-10-09），状态 `changes_requested`：用户已否决 Codex 自主建模方式及整舱 v6 视觉，明确要求今后未经明确授权不得自主建模，包括程序化几何、接口母版和补洞。后续路线改为整舱统一视觉设计、模块一致多视图与尺寸/接口说明、混元 3D 生成、来源检查和逐件试装，详见任务 AG 节及根目录 AGENTS.md。被否决的自建 v6、25 类拆件与技术检查仅保留历史记录；实际产品仍加载该版本，本次规则调整没有替换资产。完整 LOD、人体净空及长时性能仍未验收，技术自查不能代表美术合格。

AK 逐件试装：v3、v4实物接边不合格；v15使用4张独立多视图，混元V3.0/50k免费接收1次，额度15→14，累计15个已接收任务。当前：第十五版V3.0原件及实测内墙净宽六角度试装完成；隔舱视觉试装候选可保留，进入匹配门叶。合适才处理下一件，没有自主建模，产品仍未替换。 见[舱内逐件试装](output/hunyuan-adaptation/hunyuan-design-20261009/舱内逐件试装.html)和任务AK节。

匹配门叶v1因上角干涉拒绝；v2原件八向及六角度槽内试装完成，按宽1.538m等比接边可保留为静态候选，继续前窗总成。四输入原字节复用V3.0/50k，额度13→12，累计17个已接收任务；原件未改、产品未替换，整舱未验收。见[门叶同框试装](output/hunyuan-adaptation/hunyuan-design-20261009/门叶同框试装-v2.html)。

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

GitHub Pages 项目站点构建使用：

```bash
npm run build:pages
```

## 质量检查

```bash
npm run typecheck
npm test
```

项目实行文件规模约束：React 页面/业务组件不超过 300 行，通用工具不超过 200 行，渲染引擎不超过 400 行。后续开发采用 Codex × Grok Build 联合模式，见 [AI 开发与验收流程](docs/DEVELOPMENT_WORKFLOW.md) 与 [Codex × Grok Build 联合开发工作流](docs/CODEX_GROK_WORKFLOW.md)。

前窗v1顶棚穿入拒绝；v2原件八向与两组六向试装完成，仅刚性安装定位后保留静态视觉接边候选，继续驾驶围护一致设计。原件未改、产品未替换，整舱未验收。见[前窗同舱试装](output/hunyuan-adaptation/hunyuan-design-20261009/前窗同舱试装-v2.html)。

驾驶围护（2026-10-13）：暂停云端重生成，v11六图留存、未受理。用户明确允许只修选中的混元v9前窗/顶棚接口、两处变形把手和缺失灯带，不重建整舱。局部修订已另存并完成八角度对照、观察移动、缩放与切页恢复实测，见[原件/局部修订预览](output/hunyuan-adaptation/hunyuan-design-20261009/驾驶围护局部调整.html)。来源原件、地板及授权区域以外几何保留；产品未替换。当前为局部修订候选，整舱无缝、完整几何质量和用户美术尚未验收，详见同一任务AK节。
