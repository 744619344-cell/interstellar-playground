# P3 资产只读核对与接入边界

> 核对日期：2026-09-13  
> 方法：对 9 个 GLB、6 张源 WebP 读取全部字节，用 Node `crypto.createHash('sha256')` 计算；与 10–13 号登记对照。  
> **未修改任何资产或原登记。** 本清单供 P3-T06 只读核对，不设计新 API、裁剪规则或灯光参数。  
> 飞船资产 **尚未** 被产品代码引用。P3-T06 由 Codex 保留。

## 1. 字节数与 SHA-256

| 文件 | 登记出处 | 登记字节 | 实测字节 | 登记 SHA-256 | 实测 SHA-256 | 结论 |
| --- | --- | ---: | ---: | --- | --- | --- |
| `src/assets/models/spacecraft-exterior-lod0.glb` | [10](10-SPACECRAFT-EXTERIOR-ASSETS.md) | 1083040 | 1083040 | `04e485ed4da6d3d0a77be2c022aa2039f9b28e0cf48532d972378d0b99070a56` | 同左 | 一致 |
| `src/assets/models/spacecraft-exterior-lod1.glb` | [10](10-SPACECRAFT-EXTERIOR-ASSETS.md) | 667764 | 667764 | `82ba7019130c951a32529724fe3015f9c7161fe614b69bf6080fb516937eb683` | 同左 | 一致 |
| `src/assets/models/spacecraft-exterior-lod2.glb` | [10](10-SPACECRAFT-EXTERIOR-ASSETS.md) | 284908 | 284908 | `42045e8b4cc19e067fa15656c06c4a8f673aaa6e51ffeec6e558d35bc55c9ebf` | 同左 | 一致 |
| `src/assets/models/spacecraft-interior-lod0.glb` | [11](11-SPACECRAFT-INTERIOR-ASSETS.md) | 1362440 | 1362440 | `1930d9211bce38b5011af93460ed1945bd89a85632477f194644d5ff936773cf` | 同左 | 一致 |
| `src/assets/models/spacecraft-interior-lod1.glb` | [11](11-SPACECRAFT-INTERIOR-ASSETS.md) | 758652 | 758652 | `908499c353bbc5e48b4ebecf7e078d02ac99e6cd708b52b9af9ecd61f69acca5` | 同左 | 一致 |
| `src/assets/models/spacecraft-mechanisms-lod0.glb` | [12](12-SPACECRAFT-MECHANISM-ASSETS.md) | 2426936 | 2426936 | `2d4f35365a72abd94d8ce5007d694965120b63d3075322d761911dfdfaa98a82` | 同左 | 一致 |
| `src/assets/models/spacecraft-mechanisms-lod1.glb` | [12](12-SPACECRAFT-MECHANISM-ASSETS.md) | 1422236 | 1422236 | `b66ee0d4826d42e6e9249a58a1e9ce9dd2288f762a5e9ec9d1ef064d5db6831f` | 同左 | 一致 |
| `src/assets/models/spacecraft-pbr-lod0.glb` | [13](13-SPACECRAFT-PBR-ASSETS.md) | 2464244 | 2464244 | `97630c143574f0f94da819394f109f4c901a398ed30e67f0573281c1086f15ef` | 同左 | 一致 |
| `src/assets/models/spacecraft-pbr-lod1.glb` | [13](13-SPACECRAFT-PBR-ASSETS.md) | 1437104 | 1437104 | `9664bc8b85fb3f07d540101a5a48c8f52f8f9b31b890434e418e9defe785e333` | 同左 | 一致 |
| `assets-source/blender/spacecraft/pbr/Atlas_Exterior_Base.webp` | [13](13-SPACECRAFT-PBR-ASSETS.md) | 778 | 778 | `102d635b4b02b4bf41b098c1fdc5e46c6032e5820a220a509aabaa197588b72f` | 同左 | 一致 |
| `assets-source/blender/spacecraft/pbr/Atlas_Exterior_ORM.webp` | [13](13-SPACECRAFT-PBR-ASSETS.md) | 768 | 768 | `9bb5f896033968ad99f96acb5b1535cf1310e235d2ebd1265e45aa35fa52516a` | 同左 | 一致 |
| `assets-source/blender/spacecraft/pbr/Atlas_Exterior_Emission.webp` | [13](13-SPACECRAFT-PBR-ASSETS.md) | 242 | 242 | `8702295e2643707b40347ebad8d9501b5bd17659691266a33bb7dbe39cf0f0c2` | 同左 | 一致 |
| `assets-source/blender/spacecraft/pbr/Atlas_Interior_Base.webp` | [13](13-SPACECRAFT-PBR-ASSETS.md) | 800 | 800 | `1ffc112439054126f8d797cb0f097cb581ff6724ea410f5c1afedeaa5ccb036b` | 同左 | 一致 |
| `assets-source/blender/spacecraft/pbr/Atlas_Interior_ORM.webp` | [13](13-SPACECRAFT-PBR-ASSETS.md) | 792 | 792 | `a8e380f682967b237a391b3736930a33faf70138330cd12713efe9dd05492014` | 同左 | 一致 |
| `assets-source/blender/spacecraft/pbr/Atlas_Interior_Emission.webp` | [13](13-SPACECRAFT-PBR-ASSETS.md) | 460 | 460 | `c6db552c73ecc90f129fc19bbf992487e5100d01a67739a3b0ad8d0bc723df95` | 同左 | 一致 |

15 项全部一致。未发现需交回 Codex 修复的哈希/大小差异。登记写明六张 WebP 与两档 PBR GLB 的嵌入图像字节一致；本轮只核了对磁盘上的独立 WebP 与 GLB 文件整体哈希，没有拆 GLB 再比嵌入块。

## 2. 接入时核对（当前事实）

### 2.1 建议使用的派生件

运行时若接「带动画的正式外观」，现有登记指向 **PBR 装配** `spacecraft-pbr-lod{0,1}.glb`（内嵌六张图集）。静态远景仍用 `spacecraft-exterior-lod2.glb`。机械版用于原材质对照，不含图像纹理；PBR 版减少绘制次数，但新增约 128 MiB 的图集预算。整体 GPU 成本需在实际场景测量，不能仅凭版本或文件大小判断。

独立查看器与产品场景都尚未做分区流送。

### 2.2 坐标

- 单位：米。根缩放 1。
- Blender 源：船首 **+Y**，上 **+Z**。
- 导出 GLB（glTF 标准）：船首 **-Z**，上 **+Y**。
- 外部包围：宽 7.8 × 长 15.6 × 高 4.8 m。
- Meshopt：`GLTFLoader` 必须配置 `MeshoptDecoder`。

出处：[10](10-SPACECRAFT-EXTERIOR-ASSETS.md)、[11](11-SPACECRAFT-INTERIOR-ASSETS.md)、[12](12-SPACECRAFT-MECHANISM-ASSETS.md)、[13](13-SPACECRAFT-PBR-ASSETS.md)。

### 2.3 模块名（PBR 已合并的静态件）

出处 [13](13-SPACECRAFT-PBR-ASSETS.md)：

- `Exterior_Hull_Atlas`
- `Exterior_EnginePod_1_Atlas`
- `Exterior_EnginePod_-1_Atlas`
- `Furniture_Atlas`
- `Ceiling_Atlas`
- `AftFrame_Atlas`

门、状态条、喷焰、墙壁、座舱罩仍独立。这是现有网格边界，不是已实现的运行时裁剪。

### 2.4 相机 / 座椅 / EVA 锚点

外部几何报告节点（三档共享语义名，根为 `Ship_Exterior_LOD*`）：

- `Seat_Pilot`、`Seat_Copilot`（驾驶员在左）
- `Anchor_CockpitCamera`、`Anchor_ThirdPersonCamera`
- `Anchor_EVA`、`Anchor_Tether`
- `Door_Outer`；内舱另有 `Door_Inner`、`Door_Outer_Lining`
- `Thruster_Main_*`、`Thruster_Reverse_*`、`Thruster_RCS_*`
- `Collider_Hull`、`Collider_Pod_-1`、`Collider_Pod_1`（EMPTY + extras，未接现有碰撞）

内舱源还保留：`Anchor_StandUp`、`Anchor_Console`、`Anchor_Living`、`Anchor_Equipment`、`Anchor_Airlock`、`Anchor_DoorInner`（`assets-source/blender/scripts/interior_modules.py`）。P3-T03 验收核对了座椅与驾驶眼位与外部 translation 一致。P3-T05 称 46 个指定锚点/机械节点变换与 P3-T04 一致。

查看器驾驶位只读 `Anchor_CockpitCamera`。

### 2.5 六个动画名

`OuterDoorOpen`、`OuterDoorClose`、`InnerDoorOpen`、`InnerDoorClose`、`ConsoleActive`、`ThrusterBurn`。

门约 1.3 s，控制台 2 s，喷焰 1 s。喷焰默认关，控制条默认静止。播放器停止后应回静止。查看器双门限制：不能两门同时开，**不是** P5 气闸状态机。

出处：[12](12-SPACECRAFT-MECHANISM-ASSETS.md)、`mechanismPlayer.mjs`。

### 2.6 材质与颜色空间

PBR 两档各 3 材质、6 纹理，两档同一套图集：

| 图集 | 颜色空间（登记） |
| --- | --- |
| `Atlas_Exterior_Base` / `Atlas_Interior_Base` | sRGB |
| `Atlas_Exterior_Emission` / `Atlas_Interior_Emission` | sRGB |
| `Atlas_Exterior_ORM` / `Atlas_Interior_ORM` | 线性；R=AO=1，G=Roughness，B=Metallic |

图集为 2048² 色块 UV，无空间 AO、无高低模法线。喷焰材质独立。

**不要**把 WebP 字节（242–800）当成 GPU 内存。P3-T05 D 节：两套 2K RGBA 含 mip **约 128 MiB**。

### 2.7 纹理共享与释放（已有证据，非本轮实测）

- 查看器：`shareAtlasTextures` 按 `name:colorSpace:channel` 去重，多余纹理 `dispose`，无主引用的 ImageBitmap `close`。
- 退出：`disposeAssets` 释放几何与材质槽中的纹理；PBR/机械页再 `environment.dispose()`、`renderer.dispose()`、`forceContextLoss()`。
- [P3-T05 D 节](../tasks/2026-09-13-p3-t05-spacecraft-pbr-atlas.md)（2026-09-13）：图集查看器多次 LOD 切换后纹理计数保持 **8**；退出后几何 0，`renderer.info` 纹理统计仍为 **1**（Three.js 空采样纹理）。`pbr/loading-report.json`：`textures: 1`，`contextLost: true`。不得把该 1 写成 0。

产品 `ShipCameraPreview` **尚未**加载这些 GLB，上述释放只存在于独立查看器。

## 3. 待实现（P3-T06 及之后，不在本任务）

- 内外部可见性裁剪与灯光切换（P3-T06，Codex）
- 将 GLB 接入游戏场景 / 单一产品 renderer
- 运行时按可见区分区加载图集
- 用 `Collider_*` 替换或接入现有飞行碰撞
- 完整气闸互锁、角色胶囊、舱内行走

## 4. 本轮未做

- 未改资产、登记 10–13、查看器或 `src`
- 未跑 npm 测试/构建，未引用历史通过数冒充本轮
- 未在浏览器打开查看器（步骤见 [14](14-SPACECRAFT-PREVIEW-GUIDE.md)）
