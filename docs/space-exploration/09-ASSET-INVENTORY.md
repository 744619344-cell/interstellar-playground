# 现有资产登记

> 登记日期：2026-09-12  
> 方法：遍历仓库（跳过 `node_modules/`、`dist/`）；字节数与 SHA-256 由 Node `crypto.createHash('sha256')` 对文件全部字节计算。  
> 模板：[08-ASSET-MANIFEST-TEMPLATE.md](08-ASSET-MANIFEST-TEMPLATE.md)  
> 本文件只反映现状，不移动或删除资产，不批准发布。

许可、作者、来源在仓库内没有证据时一律填 **未确认**。禁止根据文件名猜测 NASA、公有领域或商用许可。`生产构建允许=否` 表示许可待审，不是本轮删除指令。

## 1. 扫描结果摘要

| 类别 | 数量 | 说明 |
| --- | ---: | --- |
| 纹理 | 15 | `src/assets/textures/` |
| UI 参考图 | 1 | `src/features/space-exploration/ui/assets/` |
| 模型 / GLB / glTF | 0 | 未发现；P3-T02 尚未导出 |
| Blender `.blend` | 0 | 未发现 `assets-source/` |
| 音频文件 | 0 | 未发现；本地音乐不在仓库 |
| 字体 | 0 | 未发现 |

程序生成、无仓库文件：`systemMapStars.ts` 的 `DataTexture` 星点、`shipThrusterVisuals.ts` 的锥形光焰。不登记为外部资产。

P3-T01 概念板仅为对话内预览，**未落库**，不得当作已有模型。

## 2. 本地音乐（不扫描私人目录）

背景音乐是用户在当前浏览器选择后写入 IndexedDB 的数据，不是仓库资产。

| 字段 | 内容 |
| --- | --- |
| 存储位置 | 浏览器 IndexedDB |
| 数据库名 | `our-universe-system-map-music-v1` |
| 对象键 | `background-track` |
| 音量键 | `our-universe-system-map-volume-v1`（localStorage） |
| 代码 | `src/features/space-exploration/storage/systemMapMusicStorage.ts` |
| 仓库文件 | 无 |
| 本轮操作 | 未扫描用户目录、未读取 Blob、未登记私人文件名 |

推进声是 Web Audio 程序合成，无音频文件。

## 3. 哈希一览

| 仓库路径 | 字节 | SHA-256 |
| --- | ---: | --- |
| `src/assets/textures/moon-surface.jpg` | 116729 | `a42b4302207f38bc4ab497868ac13f7e67b36cf2f7ec2b1a7df5efa1e9f1d9b2` |
| `src/assets/textures/voyage-earth_clouds.jpg` | 695506 | `71ea0c2eeff758dd25f9ce768c90beeb6bc160d52d5cf2fe4972a495ce835dac` |
| `src/assets/textures/voyage-earth_day.jpg` | 262698 | `f04c0eff2f3c01ec6bbad4d6b05070a07f964c1d8826569e08dce4487bb7f3fb` |
| `src/assets/textures/voyage-earth_night.jpg` | 144621 | `9554d16e45ac1665ea8165db47115957d1c07540fd31aa460e66033d68f3f73f` |
| `src/assets/textures/voyage-jupiter.jpg` | 280756 | `6b8ca074a98a71a7d18b9dd2bfab87230124ff18167878e8ac9a3280352dde9f` |
| `src/assets/textures/voyage-mars.jpg` | 387177 | `8ef6fdeb43635c28af9b56c457fc76f6b3d26343e29b9f88aa4bb15fb1598a6e` |
| `src/assets/textures/voyage-mercury.jpg` | 569514 | `db7437245b4ba27188faabcb1b0535da96d5afc0495636de844598c815355174` |
| `src/assets/textures/voyage-milkyway.jpg` | 95756 | `c4dcec62ca27777374e4a3d2a462e8b8bf9654ce3be3fad86131ebb1795d3c3b` |
| `src/assets/textures/voyage-moon.jpg` | 705478 | `8d9d3c5d64d9850271f8c5a0a6f72b01a712842641c869a617546db9a5a5ed2a` |
| `src/assets/textures/voyage-neptune.jpg` | 81652 | `7c302524b6ba0b83d0938f21a7cd0815eaa5f40f29e0e9d2490e111cefa17fb2` |
| `src/assets/textures/voyage-saturn-ring.png` | 38460 | `9fddac75f0f1ab108ba2e1754d5ce9cb9b41dcc95d0b2f01c969dea13494848a` |
| `src/assets/textures/voyage-saturn.jpg` | 125497 | `f9bb7a2ad0a2e9cb1f391955369423fc7779c1ea61be2d18cf2e927cdf17b03b` |
| `src/assets/textures/voyage-sun.jpg` | 403576 | `2809cc45fd6e643c4e134285a6da72b515e8cfd135792d146ff853a77ea3dcb4` |
| `src/assets/textures/voyage-uranus.jpg` | 51921 | `eedcda8c648233aeb2ba439adada644a0e7471ec6bc95be10ca31c12bf38bf7e` |
| `src/assets/textures/voyage-venus_surface.jpg` | 477650 | `b56808d31ba82df5dc329cf119bbcc6e1998333c5b80bb2cf123816be1e17fa7` |
| `src/features/space-exploration/ui/assets/system-map-design-reference.png` | 2036154 | `948edc479e68e68a061e32da075b68df1782550fea5aea939741b25193b3853f` |

共用未确认许可（下列每条记录均适用，除非另有说明）：

| 字段 | 内容 |
| --- | --- |
| 作者/权利人 | 未确认 |
| 原始来源 URL | 未确认 |
| 下载/创建日期 | 未确认 |
| 许可证 | 未确认 |
| 商用允许 | 未确认 |
| 修改允许 | 未确认 |
| 再分发允许 | 未确认 |
| 署名要求 | 未确认 |
| 本项目修改 | 未确认 |
| 生产构建允许 | 否（许可待审） |
| 审核人 | 未审核 |
| 审核日期 | 未审核 |

## 4. 逐项记录

### texture-moon-surface-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-moon-surface-unversioned` |
| 类型 | texture |
| 显示名称 | HUD 目的地球体贴图 |
| 仓库路径 | `src/assets/textures/moon-surface.jpg` |
| 源文件路径 | `src/assets/textures/moon-surface.jpg` |
| 字节数 | 116729 |
| SHA-256 | `a42b4302207f38bc4ab497868ac13f7e67b36cf2f7ec2b1a7df5efa1e9f1d9b2` |
| 引用位置 | `src/features/space-exploration/ui/SystemMapHud.tsx`（目的地球 `backgroundImage`） |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-earth-clouds-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-earth-clouds-unversioned` |
| 类型 | texture |
| 显示名称 | 地球云层 |
| 仓库路径 | `src/assets/textures/voyage-earth_clouds.jpg` |
| 源文件路径 | `src/assets/textures/voyage-earth_clouds.jpg` |
| 字节数 | 695506 |
| SHA-256 | `71ea0c2eeff758dd25f9ce768c90beeb6bc160d52d5cf2fe4972a495ce835dac` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.earthClouds`；`rendering/solar-system/systemMapBodies.ts`（地球 LOD1 extras） |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-earth-day-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-earth-day-unversioned` |
| 类型 | texture |
| 显示名称 | 地球白昼表面 |
| 仓库路径 | `src/assets/textures/voyage-earth_day.jpg` |
| 源文件路径 | `src/assets/textures/voyage-earth_day.jpg` |
| 字节数 | 262698 |
| SHA-256 | `f04c0eff2f3c01ec6bbad4d6b05070a07f964c1d8826569e08dce4487bb7f3fb` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.earth`；`systemMapBodies.ts` 表面贴图 |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-earth-night-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-earth-night-unversioned` |
| 类型 | texture |
| 显示名称 | 地球夜景 |
| 仓库路径 | `src/assets/textures/voyage-earth_night.jpg` |
| 源文件路径 | `src/assets/textures/voyage-earth_night.jpg` |
| 字节数 | 144621 |
| SHA-256 | `9554d16e45ac1665ea8165db47115957d1c07540fd31aa460e66033d68f3f73f` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.earthNight`；`systemMapBodies.ts`（地球 LOD1 extras） |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-jupiter-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-jupiter-unversioned` |
| 类型 | texture |
| 显示名称 | 木星表面 |
| 仓库路径 | `src/assets/textures/voyage-jupiter.jpg` |
| 源文件路径 | `src/assets/textures/voyage-jupiter.jpg` |
| 字节数 | 280756 |
| SHA-256 | `6b8ca074a98a71a7d18b9dd2bfab87230124ff18167878e8ac9a3280352dde9f` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.jupiter`；`systemMapBodies.ts` |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-mars-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-mars-unversioned` |
| 类型 | texture |
| 显示名称 | 火星表面 |
| 仓库路径 | `src/assets/textures/voyage-mars.jpg` |
| 源文件路径 | `src/assets/textures/voyage-mars.jpg` |
| 字节数 | 387177 |
| SHA-256 | `8ef6fdeb43635c28af9b56c457fc76f6b3d26343e29b9f88aa4bb15fb1598a6e` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.mars`；`systemMapBodies.ts` |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-mercury-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-mercury-unversioned` |
| 类型 | texture |
| 显示名称 | 水星表面 |
| 仓库路径 | `src/assets/textures/voyage-mercury.jpg` |
| 源文件路径 | `src/assets/textures/voyage-mercury.jpg` |
| 字节数 | 569514 |
| SHA-256 | `db7437245b4ba27188faabcb1b0535da96d5afc0495636de844598c815355174` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.mercury`；`systemMapBodies.ts` |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-milkyway-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-milkyway-unversioned` |
| 类型 | texture |
| 显示名称 | 银河背景 |
| 仓库路径 | `src/assets/textures/voyage-milkyway.jpg` |
| 源文件路径 | `src/assets/textures/voyage-milkyway.jpg` |
| 字节数 | 95756 |
| SHA-256 | `c4dcec62ca27777374e4a3d2a462e8b8bf9654ce3be3fad86131ebb1795d3c3b` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.milkyWay`；`rendering/solar-system/systemMapEngine.ts` → `addSystemSky` |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-moon-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-moon-unversioned` |
| 类型 | texture |
| 显示名称 | 月球表面（星体网格） |
| 仓库路径 | `src/assets/textures/voyage-moon.jpg` |
| 源文件路径 | `src/assets/textures/voyage-moon.jpg` |
| 字节数 | 705478 |
| SHA-256 | `8d9d3c5d64d9850271f8c5a0a6f72b01a712842641c869a617546db9a5a5ed2a` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.moon`；`systemMapBodies.ts` |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-neptune-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-neptune-unversioned` |
| 类型 | texture |
| 显示名称 | 海王星表面 |
| 仓库路径 | `src/assets/textures/voyage-neptune.jpg` |
| 源文件路径 | `src/assets/textures/voyage-neptune.jpg` |
| 字节数 | 81652 |
| SHA-256 | `7c302524b6ba0b83d0938f21a7cd0815eaa5f40f29e0e9d2490e111cefa17fb2` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.neptune`；`systemMapBodies.ts` |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-saturn-ring-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-saturn-ring-unversioned` |
| 类型 | texture |
| 显示名称 | 土星环 |
| 仓库路径 | `src/assets/textures/voyage-saturn-ring.png` |
| 源文件路径 | `src/assets/textures/voyage-saturn-ring.png` |
| 字节数 | 38460 |
| SHA-256 | `9fddac75f0f1ab108ba2e1754d5ce9cb9b41dcc95d0b2f01c969dea13494848a` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.saturnRing`；`systemMapBodies.ts`（土星环，全景亦保留） |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-saturn-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-saturn-unversioned` |
| 类型 | texture |
| 显示名称 | 土星表面 |
| 仓库路径 | `src/assets/textures/voyage-saturn.jpg` |
| 源文件路径 | `src/assets/textures/voyage-saturn.jpg` |
| 字节数 | 125497 |
| SHA-256 | `f9bb7a2ad0a2e9cb1f391955369423fc7779c1ea61be2d18cf2e927cdf17b03b` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.saturn`；`systemMapBodies.ts` |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-sun-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-sun-unversioned` |
| 类型 | texture |
| 显示名称 | 太阳表面 |
| 仓库路径 | `src/assets/textures/voyage-sun.jpg` |
| 源文件路径 | `src/assets/textures/voyage-sun.jpg` |
| 字节数 | 403576 |
| SHA-256 | `2809cc45fd6e643c4e134285a6da72b515e8cfd135792d146ff853a77ea3dcb4` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.sun`；`systemMapBodies.ts` |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-uranus-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-uranus-unversioned` |
| 类型 | texture |
| 显示名称 | 天王星表面 |
| 仓库路径 | `src/assets/textures/voyage-uranus.jpg` |
| 源文件路径 | `src/assets/textures/voyage-uranus.jpg` |
| 字节数 | 51921 |
| SHA-256 | `eedcda8c648233aeb2ba439adada644a0e7471ec6bc95be10ca31c12bf38bf7e` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.uranus`；`systemMapBodies.ts` |
| 许可 | 见第 3 节共用未确认许可 |

### texture-voyage-venus-surface-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `texture-voyage-venus-surface-unversioned` |
| 类型 | texture |
| 显示名称 | 金星表面 |
| 仓库路径 | `src/assets/textures/voyage-venus_surface.jpg` |
| 源文件路径 | `src/assets/textures/voyage-venus_surface.jpg` |
| 字节数 | 477650 |
| SHA-256 | `b56808d31ba82df5dc329cf119bbcc6e1998333c5b80bb2cf123816be1e17fa7` |
| 引用位置 | `ui/voyageTextures.ts` → `VOYAGE_TEXTURES.surface.venus`；`systemMapBodies.ts` |
| 许可 | 见第 3 节共用未确认许可 |

### reference-system-map-design-unversioned

| 字段 | 内容 |
| --- | --- |
| 资产 ID | `reference-system-map-design-unversioned` |
| 类型 | reference |
| 显示名称 | 系统地图飞船/宇航员概念插图 |
| 仓库路径 | `src/features/space-exploration/ui/assets/system-map-design-reference.png` |
| 源文件路径 | `src/features/space-exploration/ui/assets/system-map-design-reference.png` |
| 字节数 | 2036154 |
| SHA-256 | `948edc479e68e68a061e32da075b68df1782550fea5aea939741b25193b3853f` |
| 引用位置 | `ui/SystemMapExplorePanel.tsx`（飞船与宇航员预览裁切，非正式 GLB） |
| 许可 | 见第 3 节共用未确认许可 |

## 5. 待审结论

- 16 个已落库图像均 **许可未确认**，不得自行批准进入正式发布包。
- 它们目前已被生产构建打包（`voyageTextures.ts` / HUD / 探索面板），这是现状，不是本轮许可通过。
- 无 GLB、无 Blender 源、无仓库音频、无字体。
- 发布审计仍属 P7-T06，未开始。
