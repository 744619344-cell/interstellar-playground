# 宇航员候选资产（当前第五版）

## 驾驶座动作候选

在第五版模型基础上新增 `assets-source/blender/astronaut/seating/`：三段实际 GLB 动作 SitDown、SeatedIdle、StandUp，独立驾驶座适配查看器为同目录 `viewer.html`。支持连续演示、暂停、进度拖动与三视角。

候选座面从原 0.79 m 降至 0.45 m；生产飞船未替换。147 个时间采样点检查脚部稳定、家具包围盒穿插、座面接触、舱罩采样净空与片段衔接；Validator 0 错误/0 警告。GLB 12176488 字节，SHA-256 `f796d99d131c1fde18eb5431c97bf5cbbfad1bc8e47a1b8ceee4c07278dfdffc`。详细范围与限制见唯一任务记录，不能代替完整舱内碰撞、握持与行走验收。未接入游戏或发布。

## 第五版基础模型

第五版为当前默认预览：修正两条供氧管和两条背带的权重、平滑管线、修补头盔后侧小孔，保留第四版材质。新增六组静态姿态检查；无正式动作、未接入游戏、未发布。

- 文件：`astronaut_rig_v5.blend`、`astronaut-rigged-v5.glb`；复现脚本 `build_astronaut_v5.py` 在第四版源文件基础上生成。
- 结构：99999 三角面、19 mesh、48 骨骼、1 skin、最大 2 影响、5 张纹理、0 动画。
- GLB：7836508 字节；SHA-256 `e5280a20ff59d0f32085206a5e79e7f293fe35dad2353e5b7799ea625ac4875a`。
- 后处理与 Validator 脚本使用 `--revision5`；姿态检查运行 `check_astronaut_deformation.mjs --revision5`。结果见 `gltf-v5-report.json` 和 `deformation-v5/`；Validator 0 错误/0 警告。
- 预览：`/assets-source/blender/astronaut/viewer.html?revision=5`。坐姿落地仅是静态定位，不代表座椅适配或行走验收。

## 第四版历史记录

第四版为第三版的材质派生版本，几何与骨架保持一致；以下记录保留用于比较。

当前文件：`assets-source/blender/astronaut/astronaut_rig_v4.blend`、`astronaut-rigged-v4.glb`；同目录 `previews-v4/`、`gltf-v4-report.json` 和 `browser-v4-report.json` 为本轮证据。

- 材质：织物/外壳的 2K 基础色与粗糙度图、交织法线图，共 5 张内嵌 WebP。原始 PNG 保留；未进行完整场景显存预算验收。
- 最终 GLB：7817020 字节；SHA-256 `2b9c84392287f5092b7bb155e8719d75480a2f99190699c5fcf6630919c34700`。
- 复现：先生成第三版，再运行 `build_astronaut_v4.py`（Blender）；后处理、Validator、浏览器检查脚本加 `--revision4`；渲染脚本加 `-- --revision4`。
- 查看：`/assets-source/blender/astronaut/viewer.html?revision=4`；对比：同目录 `material-comparison.html`。对比页的机位、光照与曝光相同。
- 验证：Validator 0 错误/0 警告；Chrome 贴图、姿态、权重及附件/复位检查通过。

状态：基础技术检查通过，外观与完整变形验收未完成；不代表正式角色或动画通过。
唯一任务记录：[P4-T01](../tasks/2026-09-21-p4-t01-astronaut-rig.md)。

## 来源与交付

- 来源：本项目 Blender Python 原创几何与程序材质，没有导入下载目录中的外部宇航员。
- 制作记录：`astronaut_design.py`、`astronaut_refinement.py`、`astronaut_surface.py`。
- 高细节源：`assets-source/blender/astronaut/astronaut_design_v3.blend`。
- 优化与绑定源：`assets-source/blender/astronaut/astronaut_rig_v3.blend`。
- 候选 GLB：`assets-source/blender/astronaut/astronaut-rigged-v3.glb`。
- 2K 织物法线：同目录 `fabric-normal.png`，已嵌入 GLB。
- 原创制作记录不替代项目最终发布许可审计；未下载第三方资产。
- 第一版已被用户否决，`src/assets/models/astronaut-rigged.glb` 为历史未采用候选，不能接入产品。

## 结构

| 项目 | 数值 |
| --- | --- |
| 高度 | Blender 1.83 m；压缩导出约 1.83008 m |
| 前向 | Blender -Y；GLB +Z |
| 向上 | Blender +Z；GLB +Y |
| 脚底 | 源文件 0，导出误差小于 1 mm |
| 三角面 | 97084 |
| Mesh | 17 |
| 骨架 | 48 joints，1 skin |
| 每顶点影响 | 最大 2，权重已归一 |
| 硬附件 | 头盔/面罩跟随 head；背包跟随 backpack_socket |
| 动作 | 0；查看器姿态由临时旋转生成，不是交付动作 |
| GLB 字节数 | 5027300 |
| SHA-256 | `c48a2a41ad84e28161ae88291ccb03923e6e50594ca03116666a734cc3e5988a` |

## 复现顺序

使用已经安装的 Blender、Node、gltf-validator 和 Playwright。通过环境变量 `GLTF_VALIDATOR_PATH`、`PLAYWRIGHT_PATH` 指向本机既有包，不写入本机路径或安装新依赖。

```text
blender --background --factory-startup --python assets-source/blender/scripts/build_astronaut_v3.py
node assets-source/blender/scripts/finalize_astronaut.mjs
node assets-source/blender/scripts/validate_astronaut.mjs
blender --background --python assets-source/blender/scripts/render_astronaut.py -- --revision3
npm run dev
node assets-source/blender/scripts/check_astronaut.mjs --revision3
```

开发服务打开 `/assets-source/blender/astronaut/viewer.html?revision=3` 查看第三版；默认入口已更新第四版；`revision=1/2` 仅保留历史对比。

## 验证与限制

- `gltf-v3-report.json`：Meshopt 解码后 Validator 0 错误、0 警告；未使用 accessor 为信息提示。
- `browser-v3-report.json`：真实 Chrome 加载、三视角、姿态切换、实际导出权重、法线贴图、刚性距离与复位检查通过。
- `previews-v3/`：Blender 四视角及浏览器静态/测试姿态三视图。
- 当前仅验证代表性弯肘、抬腿和扭转姿态；不覆盖所有极限动作、坐姿、手部 IK、连续走动、舱内碰撞或 20 分钟性能。
- 尚未进入产品运行时或生产构建；外观、动作和发布验收不得提前勾选。
