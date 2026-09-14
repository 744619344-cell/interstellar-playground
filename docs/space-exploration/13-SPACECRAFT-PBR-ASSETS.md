# P3-T05 图集与优化资产登记

唯一规格、实现与验收记录：[P3-T05](../tasks/2026-09-13-p3-t05-spacecraft-pbr-atlas.md)。

## 共同字段

| 字段 | 内容 |
| --- | --- |
| 资产 ID | spacecraft-pbr-lod0-v1 / spacecraft-pbr-lod1-v1；Atlas_Exterior / Atlas_Interior 的 Base、ORM、Emission 各一张 |
| 类型 / 显示名称 | model + texture / 双人探索艇 PBR 图集装配件 |
| 仓库路径 | `src/assets/models/spacecraft-pbr-lod0.glb`、`spacecraft-pbr-lod1.glb`（嵌入六张 WebP） |
| 源路径 | `assets-source/blender/spacecraft/pbr/spacecraft_pbr_lod0.blend`、`spacecraft_pbr_lod1.blend`；同目录 `Atlas_{Exterior,Interior}_{Base,ORM,Emission}.webp` |
| 作者/权利人 | Codex 按用户确认的方向制作；权利由项目方依适用条款管理 |
| 原始来源 URL | 无；来自 P3-T04 已验收自制源和常量 PBR 材质，无第三方下载 |
| 创建日期 | 2026-09-13 |
| 许可证 | 项目自制，无新增第三方许可证，不另声明公开授权 |
| 商用 / 修改允许 | 是，项目自用 / 是，项目内修改 |
| 再分发允许 | 随项目构建；单独公开资产许可由项目方决定 |
| 署名要求 | 无新增第三方署名要求 |
| 本项目修改 | 常量 PBR 烘焙、色块 UV、分区网格合并、无损 WebP、Meshopt、纹理共享及释放 |
| 生产构建允许 | 来源登记及资产优化级验收允许；未被产品代码引用，运行时接入须另验收 |
| 审核人 / 日期 | Codex / 2026-09-13；沿用用户确认的 P3-T04 外观并完成前后对比 |
| 材质 / 纹理 / 骨骼 | 每档 3 / 6 / 0；两档使用同一套六张纹理 |
| 动画 | OuterDoorOpen、OuterDoorClose、InnerDoorOpen、InnerDoorClose（约 1.3 s）、ConsoleActive（2 s）、ThrusterBurn（1 s） |
| 图集 | 两区各三张 2048²；Base / Emission 为 sRGB，ORM 线性，R=AO=1、G=Roughness、B=Metallic |
| glTF Validator | 原始与完整解码均 0 错误、0 警告；原始各 1 条 Meshopt 信息，解码后无信息 |
| 工具 / 脚本版本 | Blender 5.2.1 LTS、已有 Pillow / Three.js；P3-T05 v1 |

## 模型与成本

| LOD | GLB 字节 | 三角面 | 网格 | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| LOD0 | 2464244 | 237312 | 24 | `97630c143574f0f94da819394f109f4c901a398ed30e67f0573281c1086f15ef` |
| LOD1 | 1437104 | 123408 | 24 | `9664bc8b85fb3f07d540101a5a48c8f52f8f9b31b890434e418e9defe785e333` |

完整装配视角绘制次数由 45 到 24；总文件约 3.72 MiB，较机制版增加 52176 字节。六张图集按 RGBA8 含 mip 约 128 MiB；WebP 只压缩传输体积，不等于 GPU 压缩。查看器验证两档共享图集，运行时需继续做分区加载。原静态 LOD2 不变。

## 纹理哈希

路径均位于 `assets-source/blender/spacecraft/pbr/`，且与两档 GLB 嵌入图片字节一致。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| Atlas_Exterior_Base.webp | 778 | `102d635b4b02b4bf41b098c1fdc5e46c6032e5820a220a509aabaa197588b72f` |
| Atlas_Exterior_ORM.webp | 768 | `9bb5f896033968ad99f96acb5b1535cf1310e235d2ebd1265e45aa35fa52516a` |
| Atlas_Exterior_Emission.webp | 242 | `8702295e2643707b40347ebad8d9501b5bd17659691266a33bb7dbe39cf0f0c2` |
| Atlas_Interior_Base.webp | 800 | `1ffc112439054126f8d797cb0f097cb581ff6724ea410f5c1afedeaa5ccb036b` |
| Atlas_Interior_ORM.webp | 792 | `a8e380f682967b237a391b3736930a33faf70138330cd12713efe9dd05492014` |
| Atlas_Interior_Emission.webp | 460 | `c6db552c73ecc90f129fc19bbf992487e5100d01a67739a3b0ad8d0bc723df95` |

## 约定与边界

- 轴向、单位、原点、46 个指定锚点/机械节点变换及 extras 对照 P3-T04 保持一致。Blender +Y 船首、+Z 向上，GLB -Z 船首、+Y 向上，单位米。
- 已合并的静态模块名：`Exterior_Hull_Atlas`、`Exterior_EnginePod_1_Atlas`、`Exterior_EnginePod_-1_Atlas`、`Furniture_Atlas`、`Ceiling_Atlas`、`AftFrame_Atlas`。门、状态条、喷焰、墙壁和座舱罩仍独立。
- 图集忠实保存常量材质；无空间 AO、高低模法线或新磨损细节，不将色块 UV 当作独立绘制 UV。
- 喷焰默认关闭、八状态条默认静止，六动画语义与机制版一致。
- 可在开发服务中访问 `/assets-source/blender/spacecraft/pbr/viewer.html`，页面提供原材质对照入口。
- 纹理及迟到加载释放经过浏览器测试；Three.js 空采样纹理在最终上下文销毁后回收，保留原始统计值，不假报计数归零。

## 复现

仓库根目录，使用已安装工具；每一步退出码非零即停止，不自动安装依赖。

```powershell
python assets-source/blender/scripts/bake_pbr_atlas.py
& $env:BLENDER_EXE --background --factory-startup --python-exit-code 1 --python assets-source/blender/scripts/build_pbr.py
node assets-source/blender/scripts/finalize_glbs.mjs --pbr
node assets-source/blender/scripts/validate_glbs.mjs --pbr
python assets-source/blender/scripts/validate_pbr_atlas.py
node assets-source/blender/scripts/mechanisms.test.mjs --pbr
node assets-source/blender/scripts/check_mechanisms_viewer.mjs --pbr
node assets-source/blender/scripts/check_mechanisms_viewer.mjs
node assets-source/blender/scripts/check_pbr_loading.mjs
python assets-source/blender/scripts/compare_pbr_previews.py
```

校验使用 `GLTF_VALIDATOR_PATH`；浏览器使用 `PLAYWRIGHT_PATH`、`CHROME_PATH`，开发服务需先启动。源目录保留 atlas / geometry / pixel / gltf / browser / loading 报告与 12 张截图、截图差异 JSON。旧版浏览器回归会刷新其报告和截图，但不改旧源与 GLB。
