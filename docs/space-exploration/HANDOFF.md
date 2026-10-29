# 桌面 Web 项目交接

更新：2026-10-29。本文是接手指南；唯一的当前任务规格、范围、授权、实现与验收记录仍是 [P3-R01 任务文档](../tasks/2026-09-23-p3-r01-spacecraft-art-redesign.md)。请先读 [AGENTS.md](../../AGENTS.md)、[开发工作流](../DEVELOPMENT_WORKFLOW.md)、[Codex × Grok 工作流](../CODEX_GROK_WORKFLOW.md) 和[垂直切片质量门禁](17-VERTICAL-SLICE-QUALITY-GATES.md)。用户本次明确表示将用其他模型继续开发；历史模型偏好不应阻止用户选择。

## 当前状态

- 项目仅面向桌面 Web，技术栈为 React、TypeScript、Vite 和 Three.js；微重力舱内场景默认开启。`microgravity=0` 可查看旧舱内分支。
- 默认人物是用户选定的 Microsoft Rocketbox Medical_Female_03；其许可和来源记录见 [内舱资产说明](../../src/assets/models/microgravity-cabin-20261025/ATTRIBUTION.md)、[许可](../../src/assets/models/microgravity-cabin-20261025/ROCKETBOX-LICENSE.txt) 和 [转换清单](../../assets-source/characters/rocketbox-medical-female-03/conversion-manifest.json)。宇航服来源与 CC BY 4.0 归属见[当前飞船资产说明](../../src/assets/models/current-ship-20261022/ATTRIBUTION.md)。
- 正常入口的座椅附近移动**尚未修好**。人物的手指、手掌或腿可能被座椅的不同来源面挡住；某些视角摄像机还会贴近结构并遮挡画面。默认保持既有碰撞规则，不能将测试通过等同于体验通过。
- `seatSlide=1` 是沿面滑动的隔离试验，`seatEscape=1` 是仅针对部分右腿阻挡的隔离试验；两者均未通过用户截图区域的验收，不应默认启用或宣传为修复完成。`cabinDiagnostics=1` 在 Tab 菜单开放诊断，额外的 `cabinContactProbe=1` 会记录真实蒙皮采样与来源面，仅供调试。
- 最近一次测试：完整 367 项、0 失败，类型检查及生产构建通过。构建仍有较大的 JavaScript chunk 警告；这些结果不证明动作自然、视觉质量、长时性能或完整 EVA 已达标。具体版本、实景和失败条件见任务文档末尾。
- 整批暂存检查发现部分既有验收文本行末空格和原有源码文件末尾空行；为保留已有改动未批量格式化，`git diff --check` 对这些历史内容会给出空白警告。
- 完整 EVA 门框穿行仍是已记录的两轮失败停止点；设备、科学实验、模型质感和长时性能均有未完成部分，勿把提示或原型当作完整实现。

## 运行与验证

项目要求 Node.js 20 或更新版本。依赖按锁文件安装后，运行 `npm run dev` 进入本地游戏；`npm test`、`npm run typecheck` 和 `npm run build` 分别执行回归、类型检查及构建。游戏由完整源模型组成，首次加载较大；调试时注意浏览器与测试并行可能造成加载超时。

近期实景与数据见 [座椅移动记录](../../output/hunyuan-adaptation/microgravity-cabin-20261025/seat-control-20261029/)、[舱内 HUD 记录](../../output/hunyuan-adaptation/microgravity-cabin-20261025/cabin-hud-20261029/index.html) 和[表面质感对比](../../output/hunyuan-adaptation/microgravity-cabin-20261025/surface-quality-20261029/index.html)。数值姿态重建与实际浏览器画面必须分开解释：捕获的实际骨骼可精确复原，但用户最初截图没有完整骨骼快照。

## 资源范围

本次交接包含当前代码直接引用的模型、压缩传输副本、许可证、角色来源、关键测试所需的历史源模型和近期验收记录。清单见两个模型目录中的 `manifest.json`；测试对生产件与来源件的字节一致性有独立断言。历史工作区中还有大量未提交的生成模型、中间版本、渲染图和大压缩包，**并非全部包含在此 Git 交接中**；原始历史整合包和船壳依赖包的既有下载入口见项目 [README](../../README.md)。需要其他历史素材时应先核对来源、权限和用户授权，不假设本交接包含所有版本。

不要自动重建或修改三维几何、绑定、权重，也不要擅自上传第三方素材、安装依赖或发布。用户已有授权仅覆盖任务文档中记录的具体范围；新的模型、局部几何和外部来源仍须按项目规则处理。保留旧候选和失败证据，遇到两轮同类返修失败应重新诊断而不是扩大原方案。
