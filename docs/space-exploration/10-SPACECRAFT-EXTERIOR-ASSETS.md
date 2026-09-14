# P3-T02 飞船外部资产登记

关联规格与唯一验收记录：[P3-T02](../tasks/2026-09-12-p3-t02-spacecraft-exterior-lods.md)。

## 共同登记字段

| 字段 | 内容 |
| --- | --- |
| 资产 ID | spacecraft-exterior-lod0-v2 / spacecraft-exterior-lod1-v2 / spacecraft-exterior-lod2-v2 |
| 类型 | model |
| 显示名称 | 双人探索飞船外部细化版，三个 LOD |
| 仓库路径 | `src/assets/models/spacecraft-exterior-lod{0,1,2}.glb` |
| 源文件路径 | `assets-source/blender/spacecraft/spacecraft_production.blend`、`spacecraft_export.blend`；生成脚本位于 `assets-source/blender/scripts/` |
| 作者/权利人 | Codex 按用户确认的 P3-T01 方向程序化制作；项目自制资产，权利由项目方依适用条款管理 |
| 原始来源 URL | 无；非下载资产，无第三方模型或贴图 |
| 下载/创建日期 | 2026-09-12 创建 |
| 许可证 | 项目自制；未附加第三方许可证，未声明向公众开放授权 |
| 商用允许 | 是，项目自用；不构成对第三方权利的法律保证 |
| 修改允许 | 是，项目内修改 |
| 再分发允许 | 是，随项目构建；单独公开资产的许可由项目方决定 |
| 署名要求 | 无新增第三方署名要求 |
| 本项目修改 | 原创几何、六种基础 PBR 材质、三档 LOD、语义锚点、Meshopt 导出和压缩后包围盒修正；v2 增加分层护板、检修百叶、推进舱装甲及凹入喷嘴 |
| 生产构建允许 | 是（来源登记门禁）；当前未被应用引用，外观验收与运行时接入另受任务门禁约束 |
| 审核人 | Codex；用户在外观展示后指示继续，按上下文确认 v2 定稿；仍未接产品运行时 |
| 审核日期 | 2026-09-13（v2 文件和技术检查为 2026-09-12） |
| 材质/纹理数量 | 每档 6 / 0 |
| 骨骼数量 | 0 |
| 动作名称 | 无；门与推进器状态不在本任务实现 |
| glTF Validator | 三档压缩文件均 0 错误、0 警告；解码后均 0 错误、0 警告、0 信息 |
| Blender 版本 | 5.2.1 LTS |
| 导出脚本版本 | 本任务 v2：`build_spacecraft_exterior.py` + `finalize_glbs.mjs`，细节模块 `ship_detail.py` |

## 各档实测

| LOD | GLB 大小（字节） | 三角面 / 源顶点 | 网格 / 绘制调用 |
| --- | ---: | ---: | ---: |
| LOD0 | 1083040 | 110824 / 58095 | 17 / 17 |
| LOD1 | 667764 | 59720 / 31603 | 17 / 17 |
| LOD2 | 284908 | 17156 / 9427 | 17 / 17 |

顶点数取 Blender 几何报告；GLB 为法线和材质边界拆分后的顶点，不应混用两者计数。

| 文件 | SHA-256 |
| --- | --- |
| `spacecraft-exterior-lod0.glb` | `04e485ed4da6d3d0a77be2c022aa2039f9b28e0cf48532d972378d0b99070a56` |
| `spacecraft-exterior-lod1.glb` | `82ba7019130c951a32529724fe3015f9c7161fe614b69bf6080fb516937eb683` |
| `spacecraft-exterior-lod2.glb` | `42045e8b4cc19e067fa15656c06c4a8f673aaa6e51ffeec6e558d35bc55c9ebf` |

## 坐标与接入边界

- Blender 单位米，XYZ 宽/长/高为 7.8 / 15.6 / 4.8；源文件船首 +Y、上方 +Z。GLB 经 glTF 标准导出后船首 -Z、上方 +Y。
- 根缩放为 1。三档共享原点与锚点；简化和压缩后的尺寸偏差最大 6.25 mm，校验容差 20 mm。
- 源文件对象名附 `_LOD0/1/2` 后缀避免重名；导出的语义节点名跨 LOD 一致，根节点按 LOD 区分。
- `Collider_*` 是具名 EMPTY 节点及 `extras.shape/size` 粗碰撞盒描述，size 按 Blender 局部 XYZ 解释；它们不是可渲染网格，也未接入现有碰撞。内舱/EVA 通行不能使用整船粗盒。
- `Canopy_Glass` 为独立不透明外观材质，避免外部透明排序；尚未制作可从内侧观察的座舱玻璃。驾驶员前向视野需在内舱任务中验证，不能据外观截图宣称通过。
- v2 增加静态射线检查：隐藏外部座舱罩后，前向 15 条采样中 14 条畅通，偏航 +20° / 俯仰 +10° 一条受结构遮挡，正前方畅通；外门后方 1 × 1.5 × 2.1 m 通道的 25 条纵向采样无遮挡。这是外部几何采样，不替代驾驶舱、门动画或完整体积碰撞验收。
- Meshopt 解码器必须在 GLTFLoader 中配置。Validator 原文件的两条信息为不支持验证 Meshopt 扩展及备用缓冲区未使用；另解码全部 bufferView 后重新执行完整校验，未屏蔽错误。

## 复现与查看

在仓库根目录设置本机 `BLENDER_EXE` 环境变量后运行；不在文档中保存安装绝对路径。

```powershell
& $env:BLENDER_EXE --background --factory-startup --python-exit-code 1 --python assets-source/blender/scripts/build_spacecraft_exterior.py
node assets-source/blender/scripts/finalize_glbs.mjs
node assets-source/blender/scripts/validate_glbs.mjs
& $env:BLENDER_EXE --background --python-exit-code 1 --python assets-source/blender/scripts/render_spacecraft.py
```

`validate_glbs.mjs` 使用 `GLTF_VALIDATOR_PATH` 指向现有 gltf-validator 模块目录；浏览器校验脚本使用环境变量指定现有 Playwright 和 Chrome，详见脚本。未安装依赖。

开发服务运行后访问 `/assets-source/blender/spacecraft/viewer.html`，拖动旋转、滚轮缩放、按钮切换 LOD。独立查看器使用一个 renderer，退出页面释放资源，不改变产品 renderer。

几何、glTF 与浏览器实测报告保存在 `assets-source/blender/spacecraft/`；三视图、前后视角、四张转台角度截图和三档 Three.js 截图保存在其 `previews/` 子目录。
