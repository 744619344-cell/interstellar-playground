# 我们的宇宙

“我们的宇宙”是一套面向桌面 Web 的单画布太阳系探索项目。打开项目根地址即进入新版太阳系，不依赖查询参数、旧版航行入口或微信小程序。

2026-10-17：用户已停止当前飞船返修并要求换模型接手。未通过的新内舱及玻璃黑块仍未解决；接手状态、可复用代码、实测检查与本机未提交素材范围见[唯一任务末尾交接记录](docs/tasks/2026-09-23-p3-r01-spacecraft-art-redesign.md)。下文 `output/` 和 `assets-source/` 中的实验入口可能只存在于本机，不能视为本次提交包含或验收通过的资产。

用户指定的历史整合包已提供[交接附件下载](https://github.com/744619344-cell/interstellar-playground/releases/download/integration-20261008-archive-20261017/integration-20261008.zip)（1.084 GB，原包 SHA256 与远端一致）。归档说明和完整校验值见[附件页面](https://github.com/744619344-cell/interstellar-playground/releases/tag/integration-20261008-archive-20261017)；该历史包不代表包含后续 v7/v8 全部本机素材或已通过模型验收。

船壳脚本缺失依赖已另提供[依赖包下载](https://github.com/744619344-cell/interstellar-playground/releases/download/hull-build-dependencies-20261017/hull-build-dependencies-20261017.zip)（1.108 GB，含两个完整 assembly 目录、exterior-reference.glb 及补充依赖）。保留 `output/` 与 `assets-source/` 层级解压至项目根目录，包内含说明及逐文件校验清单；[附件说明](https://github.com/744619344-cell/interstellar-playground/releases/tag/hull-build-dependencies-20261017)记录完整 SHA256。本机未找到 `build_hull.fixed.py`，本次没有运行模型构建或生成修复 GLB。

在线体验：[GitHub Pages](https://744619344-cell.github.io/interstellar-playground/)

当前能力：压缩视觉尺度的太阳系全景与星体聚焦（LOD2/LOD1）、太阳系中的飞船模型与驾驶视角（跟随 / 驾驶舱 / 自由观察）、W/S 前后与 A/D 横移、鼠标拖拽与滚轮缩放、目标锁定、航向辅助和防撞、地球/月球/土星手动航线、推进反馈与基础推进声，以及仅保存在当前浏览器的本地音乐。

太阳系飞船接入（2026-10-15）：已移除“相机试验”和固定轨道图标，根页面直接加载现有飞船模型。点击模型/标签进入跟随观察，右侧卡片或“飞船”按钮进入驾驶舱；返回全景保留同一飞船的位置、姿态和航线。模型仍待完善，今后通过[统一资产配置](src/features/space-exploration/rendering/spacecraft/shipModelAssets.ts)替换总成及外观LOD；新资产需保持现有坐标、锚点和动画约定，不必重写太阳系入口或航行逻辑。重启后已实测模型显示/点击、驾驶切换、飞行位置与航线保留、缩放及加载失败重试；右侧卡片同步实际泊位/航行状态。真实页面隐藏恢复及长时性能仍待验，软件通过不代表模型美术通过。

尚未具备：太阳系浮动原点、星体 LOD0 近景、宇航员资产的运行时接入、舱内行走与 EVA、运行时资源预算检查、20 分钟性能验收。路线图校准见 [开发路线](docs/space-exploration/04-DELIVERY-ROADMAP.md)。

模型资产进度（2026-09-13）：外部 LOD0/1/2 与静态内舱 LOD0/1 均已通过资产级验收，内舱布局已获用户确认。开发服务支持 [外部预览](assets-source/blender/spacecraft/viewer.html) 与 [内舱预览](assets-source/blender/spacecraft/interior/viewer.html)，这些独立查看器尚未接入游戏流程。

P3-T04 机械动画已通过资产级验收：[机械预览](assets-source/blender/spacecraft/mechanisms/viewer.html)，支持内外门、控制台、推进器反馈及暂停/复位。[任务记录](docs/tasks/2026-09-13-p3-t04-spacecraft-mechanisms.md)与[资产登记](docs/space-exploration/12-SPACECRAFT-MECHANISM-ASSETS.md)包含复现方式；尚未接入游戏运行时。

P3-T05 图集优化已验收：[PBR 预览](assets-source/blender/spacecraft/pbr/viewer.html) 仍是独立资产检查入口，不是产品驾驶流程；完整装配视角绘制次数 45 → 24，保留几何和六个动画。[资产登记](docs/space-exploration/13-SPACECRAFT-PBR-ASSETS.md)记录纹理内存与文件体积取舍。

P3-T06 / P3-T07 已接入真实驾驶座、七个锚点、控制台及内外舱门，支持按钮/`F` 键、机械互锁、暂停与复位。历史验收见 [P3-T06](docs/tasks/2026-09-13-p3-t06-spacecraft-visibility.md)和 [P3-T07](docs/tasks/2026-09-20-p3-t07-spacecraft-interactions.md)。

当前活动任务为 [P3-R01 飞船重制](docs/tasks/2026-09-23-p3-r01-spacecraft-art-redesign.md)（2026-10-09），状态 `changes_requested`：用户已否决 Codex 自主建模方式及整舱 v6 视觉，明确要求今后未经明确授权不得自主建模，包括程序化几何、接口母版和补洞。后续路线改为整舱统一视觉设计、模块一致多视图与尺寸/接口说明、混元 3D 生成、来源检查和逐件试装，详见任务 AG 节及根目录 AGENTS.md。被否决的自建 v6、25 类拆件与技术检查仅保留历史记录；实际产品仍加载该版本，本次规则调整没有替换资产。完整 LOD、人体净空及长时性能仍未验收，技术自查不能代表美术合格。

2026-10-17：v7圆弧肩顶/舱长/空后门联合返修已完成，选4张图（侧图换槽，上传5次），V3.1/50k免费单次16→15、累计46。官方原件38.70MB/59,243面，八方向实看与9张真实装船检查完成：后门贯通恢复，按宽7.1m为7.10×4.35×11.52m，向后不再明显露第二层原顶；但上部余量、后段和前口衔接、发白地板及接缝粗糙仍未通过。按长13.2m为8.14×4.98×13.20m，原壳穿插拒绝。15份GLB原字节不变，产品未替换，玻璃黑块未修复，整体changes_requested，不自动再受理。 [查看v7实际原件、三轮对照与试装](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/全空间重设计-v7-20261017/主结构-v7/主结构审查.html)。

此前重设计方向与诊断（2026-10-16）：用户要求整舱适配现有船壳，先生成完整内舱结构，再评估旧设备复用；前窗与舱罩同步重设计。[整舱与前窗设计历史](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/设计评审.html)保留旧件和来源记录。黑块已定位为原壳实体表面与深色贴图，仍未修复，二维图的通透玻璃不代表实际模型问题已解决。

装船接续（2026-10-16）：[新整舱实际试装](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/装船试装.html)已加入原船壳、摆正并整件等比至4.40×2.95×12.46m的新舱、旧座椅/主台v2/中央台与后舱重新试排的两床/工作台；驾驶区地板有限采样校准。新前窗原件明显偏矮/短且不透明，未采用；当前使用原舱罩玻璃节点的标准PBR透射候选。后舱右侧低顶、墙面固定、人体与连续穿插待验，黑块未修复，整体仍changes_requested。九份来源哈希一致，本轮新受理0、累计40，产品未替换。

拆图生成接续（2026-10-16）：用户明确要求拆开上传并生成。内舱先纠正完整屋顶并补背面，前窗沿已有四视角机械拆图；两对象各上传四张独立图片，V3.1/50k分别单次受理，免费次数19→17，无付款、累计受理40。已下载[整舱原件](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/整舱-混元-v1/混元原始模型.glb)（38.12MB/50,056面）和[前窗原件](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/前窗-混元-v1/混元原始模型.glb)（41.45MB/50,014面），基本只读检查及[真实GLB查看器](output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/模型原件查看.html)加载/视角实测完成。前窗窗框与窗面共用一个OPAQUE材质，真实透射未保留；实际装船、旧件复用与原壳黑块仍未完成，不把生成成功当适配通过。原件和产品未替换，详情见唯一任务AP末尾。

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

### 浏览器连接超时后的桌面重启

下次浏览器控制无法连接时，可双击项目根目录的[重启Codex.cmd](重启Codex.cmd)。程序会倒计时8秒，先正常关闭当前商店版ChatGPT/Codex桌面应用，仍未退出时才结束同一Windows会话、同一可执行文件的进程，再重新启动。倒计时内可按Ctrl+C取消；重启会关闭该应用全部窗口，并可能中断正在执行的任务。项目已保存文件保留。

只检查目标和本地服务，不重启：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\restart-codex.ps1 -CheckOnly
```

显式运行或预演：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\restart-codex.ps1 -Restart
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\restart-codex.ps1 -Restart -WhatIf
```

直接运行PowerShell脚本而不传`-Restart`也只检查。入口适配当前`OpenAI.Codex`商店安装包，每次动态读取版本位置和启动标识；身份无法确认即退出。结果日志在忽略目录`.cache/codex-restart/`，不写账号、Cookie或本机路径。仅检查项目服务，不关闭Chrome/Node、不修改浏览器资料、不安装依赖/定时任务、不永久改变执行策略。进程重新出现只代表桌面应用启动，浏览器控制是否恢复需再测试。2026-10-15用户确认重开后，浏览器控制已实际恢复；脚本日志仅记录到关闭阶段，未确认自动激活完成，不能视为完整自动重开实测通过。

实现参考微软的[AUMID应用标识](https://learn.microsoft.com/en-us/windows/configuration/store/find-aumid)、[应用启动](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/debugging)与[正常关闭窗口](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.process.closemainwindow)文档。

2026-10-15反复卡住复核：内置浏览器与Chrome的轻量页面点击、文件选择均正常；经用户明确授权重启Chrome，完整关闭/重开和标签恢复已观察到，重启后基础操作再次通过，但混元生成页切换模式和随后读取仍超时。因此上传权限可用，Chrome重启没有修复当前混元控制故障，根因尚未确认；不重复开启文件权限或循环重启。主仪表台v2四张输入保留，未上传、未生成。实测证据见[浏览器连接诊断](output/hunyuan-adaptation/hunyuan-design-20261009/浏览器连接诊断-20261015/诊断结果.json)，后续按[官方扩展排障](https://learn.chatgpt.com/docs/chrome-extension)处理；桌面重启脚本只能作为一次恢复手段，不能保证修复此类故障。

2026-10-16续查：恢复离线的5173开发服务，并通过专用浏览器接口实际验证太阳系画面、说明打开/关闭、截图和本地文件选择。此前仅据函数编排清单判断接口未加载的推断已撤回，今后直接验证已声明的接口，不反复要求用户重选插件或重启。混元页面的初始化/截图/读取仍超时，上传生成继续受阻；基础浏览器恢复不代表该流程修复。见[本轮更正与实测](output/hunyuan-adaptation/hunyuan-design-20261009/浏览器连接诊断-20261015/修复复查-20261016.json)。

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

交接后续修（2026-10-13）：局部预览默认r13，修正灯带遮挡与端部、缩小前窗上框及肩角间距，支持同机位修订前对照、左右肩角近景、WASD/方向键移动和Q/E升降。八视角及观察操作完成本轮复验；来源贴图折痕仍保留，整舱/用户美术未验收，产品未替换。详情见同一任务AM及AN节；这些续修文件尚未提交推送，920d1ed云端交接快照仍为r9。

接口图像续修（2026-10-13）：两次内置图像编辑已另存局部UV诊断纹理并完成实际模型同机位对照；r15/r16/r17因剩余折痕及不自然局部过渡均未通过，默认继续保留r13。预览中的r17链接明确标为“未通过，仅对照”；完整提示词、范围外像素/逐面属性检查和本轮实测记录见同一任务AO节。接口视觉修复仍未完成，产品未替换，未提交推送。

路线恢复（2026-10-14）：用户弃用Nomad等外部模型方案，恢复混元模块生成与实际试装。r13与四类混元设备候选保留，继续后舱长侧墙、地板、顶棚；长侧墙已单次V3.1/50k受理，等待原件检查，详见同一任务AP末尾。默认[混元试装入口](output/hunyuan-adaptation/hunyuan-design-20261009/驾驶围护局部调整.html)保持，产品与用户美术尚未验收。

装配返修（2026-10-15）：用户否决外侧落地台堵塞座椅两侧过道，两台已从默认布局撤下，原件及否决证据保留；旧扶手杆不恢复。两侧通路留空，操纵杆方案待整体重排，驾驶控制尚不完整。隔舱v15/门叶v2继续静态试装；来源静帧不代替WebGL、可达性、门机构及用户美术验收。后舱其他生成暂停，详见同一任务AP末尾。

内外装配（2026-10-15）：同一[试装入口](output/hunyuan-adaptation/hunyuan-design-20261009/驾驶围护局部调整.html)恢复已选外壳/舱罩玻璃，并复用现有前窗玻璃节点，支持整船与驾驶眼位切换。来源静帧发现内舱顶棚在曲面舱罩下显出盒状轮廓，整船视觉未通过；没有以隐藏外壳或改变透明度掩盖问题，没有修改源几何或替换产品。证据与接续点见同一任务AP末尾。

离机远程续作（2026-10-15）：已保存[统一适配设计v2](output/hunyuan-adaptation/hunyuan-design-20261009/内外舱装配-20261015/统一适配设计-v2.png)及[集成操纵杆主仪表台四视图](output/hunyuan-adaptation/hunyuan-design-20261009/内舱装配-20261013/主仪表台-v2/一致四视图.png)。这是二维候选；浏览器控制超时期间尚未上传混元或生成新模型，r13和既有来源未改，详见同一任务AP末尾。

主仪表台八视图（2026-10-16）：按用户纠正改以V3.1正面主图+七辅助视图为目标，原四图不改，内置imagegen补顶/底及左右前45°候选。见[八视图同屏检查与完整提示词](output/hunyuan-adaptation/hunyuan-design-20261009/内舱装配-20261013/主仪表台-v2/八视图补充-20261016/八视图候选检查.html)。八张均已在本机检查页加载；独立二维图不证明共用几何，网页槽位/免费设置与用户视觉仍待验，尚未上传、生成新GLB或替换原件。

主仪表台生成与装配接续（2026-10-16）：上述生成前断点已推进。八图V3.1/50k单次生成完成，原始GLB及来源哈希已保存，额度20→19、无付款；[原件与v1/v2同机位试装](output/hunyuan-adaptation/hunyuan-design-20261009/内舱装配-20261013/主仪表台-v2/来源试装.html)已实际检查。用户委托Codex把关后，保留v2作为整舱试装候选，现有[整舱试装入口](output/hunyuan-adaptation/hunyuan-design-20261009/驾驶围护局部调整.html)代码默认加载集成双握把的v2，支持旧主台v1显式对照；原件、r13和产品资产保留。有限包络/射线检查未见座椅相交或所测前向遮挡，但不是人体净空或完整碰撞通过。内置浏览器本轮已完成带外壳/玻璃的驾驶眼位、驾驶席、左右过道及台下观察并保存新截图，读取/点击/后续读取通过，控制台error/warn为空。双握把与留空过道可见；来源细节、人体可达和膝部净空、顶棚与外壳匹配及整舱美术仍未验收，详见唯一活动任务AP末尾。

内舱云端素材补齐（2026-10-18）：截图缺失的主结构 v7、主仪表台 v2、折叠床 v1、工作台 v1 原始 GLB 及其直接设计输入/来源记录已补入本分支，云端拉取即可获得。见[获取、校验与接续说明](docs/CLOUD_INTERIOR_HANDOFF_20261018.md)。这次补齐不覆盖云端已确认的玻璃 r10，不代表整舱验收通过。
