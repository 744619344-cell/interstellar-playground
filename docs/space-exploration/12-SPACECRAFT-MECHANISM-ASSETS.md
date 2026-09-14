# P3-T04 机械动画资产登记

规格、实现与唯一验收记录：[P3-T04](../tasks/2026-09-13-p3-t04-spacecraft-mechanisms.md)。

## 共同字段

| 字段 | 内容 |
| --- | --- |
| 资产 ID | spacecraft-mechanisms-lod0-v1 / spacecraft-mechanisms-lod1-v1 |
| 类型 / 显示名称 | model / 双人探索艇机械动画装配件 |
| 仓库路径 | `src/assets/models/spacecraft-mechanisms-lod0.glb`、`spacecraft-mechanisms-lod1.glb` |
| 源文件 | `assets-source/blender/spacecraft/mechanisms/spacecraft_mechanisms_lod0.blend`、`spacecraft_mechanisms_lod1.blend` |
| 作者/权利人 | Codex 按用户确认的项目方向程序化制作；权利由项目方依适用条款管理 |
| 原始来源 URL | 无；派生自项目已验收的 P3-T02 / P3-T03 自制源，无第三方模型或贴图 |
| 创建日期 | 2026-09-13 |
| 许可证 | 项目自制，无新增第三方许可证，不另声明公开授权 |
| 商用 / 修改允许 | 是，项目自用 / 是，项目内修改 |
| 再分发允许 | 随项目构建；单独公开资产许可由项目方决定 |
| 署名要求 | 无新增第三方署名要求 |
| 本项目修改 | 后门局部开孔、机械枢轴、门芯、独立状态条与喷焰、六个动画、两档装配导出 |
| 生产构建允许 | 来源登记及资产级验收允许；尚未被产品代码引用，运行时接入须另行验收 |
| 审核人 / 日期 | Codex 技术检查 / 2026-09-13；展示后用户指示继续，动作外观确认 |
| 材质 / 纹理 / 骨骼 | 每档 16 / 0 / 0 |
| 动作名称 | OuterDoorOpen、OuterDoorClose、InnerDoorOpen、InnerDoorClose、ConsoleActive、ThrusterBurn |
| 动作时长 | 门片段约 1.3 s；控制台 2 s；喷焰 1 s，时间量化误差小于 1 ms |
| glTF Validator | 原始与完整解码均 0 错误 / 0 警告；原始各 2 条 Meshopt 相关信息，解码后无信息 |
| 工具 / 脚本版本 | Blender 5.2.1 LTS；P3-T04 v1，build_mechanisms.py + finalize_glbs.mjs --mechanisms |

## 两档数据

| LOD | 字节 | 三角面 | 网格 | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| LOD0 | 2426936 | 237312 | 45 | `2d4f35365a72abd94d8ce5007d694965120b63d3075322d761911dfdfaa98a82` |
| LOD1 | 1422236 | 123408 | 45 | `b66ee0d4826d42e6e9249a58a1e9ce9dd2288f762a5e9ec9d1ef064d5db6831f` |

装配件含内外部，不与单独外部 LOD 的面数预算混用。远景继续使用静态外部 LOD2，运行时流送与分包尚未实现。

## 坐标、节点与静止状态

- 单位米，原点沿用静态模型；Blender +Y 船首、+Z 向上，GLB -Z 船首、+Y 向上。原锚点保留，不绑定到反馈动画。
- 外门部件统一在 `Rig_OuterDoor` 下，内门在 `Rig_InnerDoor` 下；八个 `Console_Bar_*`、两个 `ThrusterPlume_*` 是独立反馈目标。
- 喷焰静止缩放 0.001，控制条静止缩放 1；控制台和推进器反馈必须显式开启。播放器停止动作恢复静止状态。
- 查看器的双门限制只防止两门同时打开，不是完整气闸控制系统。门洞网格采样与角色碰撞仍有不同验收范围，详见任务 D 节。
- 查看器 URL：开发服务中的 `/assets-source/blender/spacecraft/mechanisms/viewer.html`。

## 复现

在仓库根目录使用已有工具；环境变量指向本机工具，不新增依赖。每步退出码非零即停止。

```powershell
& $env:BLENDER_EXE --background --factory-startup --python-exit-code 1 --python assets-source/blender/scripts/build_mechanisms.py
node assets-source/blender/scripts/finalize_glbs.mjs --mechanisms
node assets-source/blender/scripts/validate_glbs.mjs --mechanisms
node assets-source/blender/scripts/mechanisms.test.mjs
node assets-source/blender/scripts/check_mechanisms_viewer.mjs
```

校验使用 `GLTF_VALIDATOR_PATH`；浏览器检查使用 `PLAYWRIGHT_PATH`、`CHROME_PATH`，先启动开发服务。生成脚本只读引用静态外部和内舱源，不覆盖它们。`geometry-report.json`、`gltf-report.json`、`browser-report.json` 和 `previews/` 位于派生源目录。
