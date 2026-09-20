# 飞船独立查看器操作与人工检查指南

> 编写日期：2026-09-13  
> 依据：四个查看器的 HTML/JS 源码只读核查  
> **本文件是操作指南，不是本轮浏览器实测结果。** 下列检查项在未实际点击前一律为「待人工执行」。  
> 独立查看器 **不是** 产品驾驶流程。P3-T06 已将 PBR LOD1 接入根页面 `SystemMapShell` 的“相机试验”；本指南中的 HTML 查看器仍只用于资产检查，不能当作游戏已接入全部 GLB 或机械交互。

开发服务：仓库根目录 `npm run dev`，默认 `http://localhost:5173/`。下列路径均相对于该源。查看器通过 importmap 读取 `/node_modules/three/`，须在已安装依赖的开发服务中打开，不要当静态文件双击。

四个查看器各自创建 **一个** WebGLRenderer；`pagehide` 时停止动画循环并释放几何/材质/环境/renderer。它们不改产品 renderer。

源码中 **没有** 自定义键盘热键。环绕与缩放来自 Three.js `OrbitControls`（拖动环绕、滚轮缩放）。不要添加文档中不存在的快捷键。

## 1. 外部模型

| 项 | 内容 |
| --- | --- |
| 页面 | `/assets-source/blender/spacecraft/viewer.html` |
| 源 | 同目录 `viewer.html` 内联脚本 |
| 加载 | `/src/assets/models/spacecraft-exterior-lod0.glb`、`lod1`、`lod2` |
| LOD | 0 近景、1 航行、2 远景；默认显示 LOD0 |
| 按钮 | `LOD0 近景`、`LOD1 航行`、`LOD2 远景` |
| 不适用 | 无舱门、控制台、喷焰、暂停、复位、视角预设 |

### 人工检查（待人工执行）

1. 打开页面，状态从「加载中」变为 `LOD0 · …三角面` 与 `宽 7.8 m · 长 15.6 m · 高 4.8 m`。
2. 拖动环绕、滚轮缩放；应只有一个 canvas。
3. 依次点三个 LOD，画面切换，状态行 LOD 编号变化。
4. 关闭或离开页面后，不把此预览当成游戏已接入。

历史外观截图在 `assets-source/blender/spacecraft/previews/`，日期见 [P3-T02 登记](10-SPACECRAFT-EXTERIOR-ASSETS.md)，不能代替本轮点击。

## 2. 静态内舱

| 项 | 内容 |
| --- | --- |
| 页面 | `/assets-source/blender/spacecraft/interior/viewer.html` |
| 源 | `interior/viewer.html`、`interior/viewer.mjs` |
| 加载 | 内舱 `spacecraft-interior-lod0/1.glb`；只读加载外部 `spacecraft-exterior-lod1.glb` 并隐藏 `Canopy_Glass` |
| LOD | 0 近景、1 标准；默认 LOD0 |
| 视角按钮 | `整体剖面`、`生活舱`、`驾驶舱`、`驾驶位`、`气闸` |
| 其他按钮 | `LOD0 近景`、`LOD1 标准`、`显示内门`（再点变为 `隐藏内门`） |
| 不适用 | 无开门动画、双门互锁、控制台/喷焰、暂停/复位 |

内门按钮只切换 `Door_Inner` 网格可见性，用于检查通道，**不是** `InnerDoorOpen` 动画。剖面视角会隐藏名称以 `Ceiling`/`Walls` 开头的网格，并隐藏外部壳。

`驾驶位` 把相机放到 `Anchor_CockpitCamera`。其余四档为脚本内写死的机位。

### 人工检查（待人工执行）

1. 默认整体剖面；五个视角都能切过去，无控制台报错，单 canvas。
2. 切换 LOD0/LOD1，状态行三角面变化。
3. `显示内门` / `隐藏内门` 只改变内门网格，外门不会动。
4. 驾驶位应能同时看到前向与仪表区域（静态资产）。

历史截图与 2026-09-13 P3-T03 验收记录不得当作本轮结果。

## 3. 机械动画

| 项 | 内容 |
| --- | --- |
| 页面 | `/assets-source/blender/spacecraft/mechanisms/viewer.html` |
| 源 | `mechanisms/viewer.html`、`viewer.mjs`、`mechanismPlayer.mjs` |
| 加载 | `/src/assets/models/spacecraft-mechanisms-lod0.glb`、`lod1` |
| LOD | 0、1；默认 LOD0 |
| 视角 | `船尾`、`外门近景`、`内门`、`驾驶位`、`剖面` |
| 舱门 | `开启外门`、`关闭外门`、`开启内门`、`关闭内门` |
| 反馈 | `控制台反馈`、`推进器反馈` |
| 时间 | `暂停`（按下后按钮文案为 `继续`）、`复位` |
| 不适用 | 无 LOD2；查看器互锁不是完整气闸系统 |

`commandDoor`：若另一扇门 `progress>0` 或目标为开，返回 false，状态区显示「请先完全关闭另一扇门。」页面 `visibilitychange` 时 `player.suspended=document.hidden`，隐藏期间不推进动画。`复位` 把门进度、控制台、喷焰、暂停清零。

六个动画名：`OuterDoorOpen`、`OuterDoorClose`、`InnerDoorOpen`、`InnerDoorClose`、`ConsoleActive`、`ThrusterBurn`。喷焰默认关闭（登记：静止缩放 0.001），须点「推进器反馈」才显示。

### 人工检查（待人工执行）

1. 船尾视角开启外门，外门进度升高；未关外门时点「开启内门」，应出现上述提示，内门不动。
2. 关闭外门后再开内门，应能打开。
3. 控制台反馈：八根 `Console_Bar_*` 应有动作；再点一次关闭。
4. 推进器反馈：喷焰可见；再点一次关闭。
5. 开门过程中点暂停，进度冻结；点继续后恢复。
6. 复位后两门关闭、反馈关闭、提示清空。
7. 切 LOD0/LOD1，机械控制仍作用在当前可见档。
8. 切到其他标签页再回来：隐藏期间动画不应自己走完。

历史浏览器报告：`assets-source/blender/spacecraft/mechanisms/browser-report.json`，P3-T04 验收日期 2026-09-13。

## 4. PBR 图集

| 项 | 内容 |
| --- | --- |
| 页面 | `/assets-source/blender/spacecraft/pbr/viewer.html` |
| 源 | `pbr/viewer.html`；**复用** `../mechanisms/viewer.mjs`（`body data-assets="pbr"`） |
| 加载 | `/src/assets/models/spacecraft-pbr-lod0.glb`、`lod1` |
| 按钮 | 与机械查看器相同（视角、四门按钮、控制台、喷焰、暂停、复位、LOD0/LOD1） |
| 额外 | 文案链接「原材质对照」→ `/assets-source/blender/spacecraft/mechanisms/viewer.html` |
| 不适用 | 无单独「切换图集」按钮；对照靠打开机械页 |

两档按图集名与颜色空间共享纹理（`reviewTextures.mjs` 的 `shareAtlasTextures`）。WebP 文件体积不是 GPU 内存。P3-T05 验收（2026-09-13）记载：完整装配视角绘制次数 45→24；图集版多次 LOD 切换后纹理计数保持 8（六图集 + PMREM + Three.js 空采样纹理）；退出后 `renderer.info` 纹理统计值仍为 **1**，不要写成 0。含 mip 的两套 2K RGBA 约 128 MiB 预算。

### 人工检查（待人工执行）

1. 机械查看器中的门、互锁、控制台、喷焰、暂停、复位步骤在本页各做一遍，预期相同。
2. 点「原材质对照」打开机械页，同一机位比较色块外观是否仍接近已确认配色（常量烘焙，无新磨损细节）。
3. 切 LOD0/LOD1，不应出现丢失贴图的品红/黑块。
4. 不要用 WebP 的几百字节体积判断显存是否下降。

历史报告：`pbr/browser-report.json`、`loading-report.json`（迟到加载释放）、`visual-comparison.json`；任务 [P3-T05](../tasks/2026-09-13-p3-t05-spacecraft-pbr-atlas.md) D 节。

## 5. 本轮未执行

- 未启动开发服务，未在浏览器点击上述按钮。
- 未测量 FPS、未打开产品根地址验证游戏接入。
- 未修改查看器、模型或产品代码。
