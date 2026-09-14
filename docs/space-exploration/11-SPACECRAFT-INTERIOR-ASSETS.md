# P3-T03 内舱资产登记

规格及唯一验收记录：[P3-T03](../tasks/2026-09-13-p3-t03-spacecraft-interior.md)。

## 共同字段

| 字段 | 内容 |
| --- | --- |
| 资产 ID | spacecraft-interior-lod0-v1 / spacecraft-interior-lod1-v1 |
| 类型 | model |
| 显示名称 | 双人探索艇静态内舱 |
| 仓库路径 | `src/assets/models/spacecraft-interior-lod0.glb`、`spacecraft-interior-lod1.glb` |
| 源文件路径 | `assets-source/blender/spacecraft/interior/spacecraft_interior_production.blend`、`spacecraft_interior_export.blend` |
| 作者/权利人 | Codex 按用户已确认的项目方向程序化制作；项目自制资产，权利由项目方依适用条款管理 |
| 原始来源 URL | 无；未下载第三方模型或贴图 |
| 下载/创建日期 | 2026-09-13 创建 |
| 许可证 | 项目自制，无新增第三方许可证；不另声明向公众开放授权 |
| 商用允许 | 是，项目自用 |
| 修改允许 | 是，项目内修改 |
| 再分发允许 | 是，随项目构建；单独公开资产许可由项目方决定 |
| 署名要求 | 无新增第三方署名要求 |
| 本项目修改 | 原创静态舱室、家具、仪表、灯条与内门/外门内衬；两档 LOD、Meshopt 压缩及解码后边界修正 |
| 生产构建允许 | 是（来源登记门禁）；尚未被产品代码引用，外观确认和运行时接入仍按任务门禁执行 |
| 审核人 | Codex（来源及技术检查）；用户于 2026-09-13 明确确认最终内舱布局，资产级验收通过 |
| 审核日期 | 2026-09-13 |
| 材质/纹理数量 | 每档 9 / 0 |
| 骨骼数量 | 0 |
| 动作名称 | 无；静态资产 |
| glTF Validator | 原始与完整解码文件均 0 错误 / 0 警告；原始文件各有 2 条 Meshopt 信息，解码后无信息 |
| Blender 版本 | 5.2.1 LTS |
| 导出脚本版本 | P3-T03 v1：`build_interior.py`；`finalize_glbs.mjs --interior` |

## 两档数据

| LOD | GLB 字节 | 三角面 / 源顶点 | 网格 |
| --- | ---: | ---: | ---: |
| LOD0 | 1362440 | 126124 / 63632 | 14 |
| LOD1 | 758652 | 63324 / 32136 | 14 |

源顶点是 Blender 计数，GLB 会因材质与法线边界拆分顶点。内舱无 LOD2。

| 文件 | SHA-256 |
| --- | --- |
| `spacecraft-interior-lod0.glb` | `1930d9211bce38b5011af93460ed1945bd89a85632477f194644d5ff936773cf` |
| `spacecraft-interior-lod1.glb` | `908499c353bbc5e48b4ebecf7e078d02ac99e6cd708b52b9af9ecd61f69acca5` |

## 对齐与查看

- Blender +Y 船首、+Z 向上、单位米；GLB -Z 船首、+Y 向上。根缩放为 1，沿用外部原点。
- `Seat_Pilot`、`Seat_Copilot`、`Anchor_CockpitCamera` 从外部源读取，导出后与外部 GLB 锚点逐项对比。站立点、生活舱、装备和气闸锚点单独保留。
- `Door_Inner` 独立；`Door_Outer_Lining` 包含外门内衬和接缝，后续随外门联动。当前无门动画、交互或互锁。
- `Ceiling_*`、`Walls_*` 与家具分组，便于静态剖面查看；不是产品运行时裁剪实现。
- 开发服务内访问 `/assets-source/blender/spacecraft/interior/viewer.html`，可以切换两档 LOD 与五个视角。舱内视角只读加载外部 LOD1、隐藏外部座舱罩，未修改外部文件。
- `previews/` 含 Blender 六视角与浏览器两档五视角；三份实测 JSON 位于同一内舱目录。

## 复现

在仓库根目录运行，环境变量指向已有本机工具，未新增依赖。

```powershell
& $env:BLENDER_EXE --background --factory-startup --python-exit-code 1 --python assets-source/blender/scripts/build_interior.py
node assets-source/blender/scripts/finalize_glbs.mjs --interior
node assets-source/blender/scripts/validate_glbs.mjs --interior
& $env:BLENDER_EXE --background --python-exit-code 1 --python assets-source/blender/scripts/render_interior.py
node assets-source/blender/scripts/check_interior_viewer.mjs
```

Validator 使用 `GLTF_VALIDATOR_PATH`；浏览器检查使用 `PLAYWRIGHT_PATH` 与 `CHROME_PATH`，需先启动开发服务。命令失败时停止后续步骤；各命令退出码均需检查。
