# Grok：进度校准、桌面验收清单与现有资产登记

## A. 需求与验收标准

- 等级：G0，纯文档整理任务包。
- 状态：accepted。
- 写入者：Grok Build；Codex 暂停 P3-T02，额度恢复后统一复核。
- 用户要求：先交给 Grok 简单工作，保留复杂建模给 Codex。
- 本任务包括三个独立文档子项，可顺序全部完成，无需逐项等待 Codex；不提前执行任何路线图功能。

### 1. 校准真实进度，避免重复派发

阅读代码、测试及现有任务文档，更新 README 当前能力和路线图。每项注明已验收、已实现待核验、未开始、部分完成或已被独立桌面架构取代，并列出仓库相对路径证据。只有验收记录确凿才勾选完成；发现历史结论与当前实现不一致时保留差异，不擅自认定通过。

已知：P2-T06、P2-T07 有 accepted 记录；P3-T01 已获用户确认；P3-T02 仅工具检查和规格完成，未生成模型，因用户额度安排暂停。旧入口/feature flag/旧页回退不再作为新任务。不得仅依据文件名或存在某个类认定浮动原点、完整 LOD 或性能验收已完成。

### 2. 清除桌面规范中的旧平台要求

仅针对明确与 AGENTS.md 冲突的移动端、微信小程序、移动降级条款进行修订。保留桌面三档视口、浏览器及性能门禁，不修改建模预算、坐标设计或业务规则。统一记录“桌面 Web”为唯一目标平台。

在本任务 C 节列出可供后续执行的桌面体验清单：三视角、三航线、暂停/失焦、返回全景、音频和 UI 裁切。清单不是测试结果，未实测写未执行。

### 3. 登记当前仓库资产和许可证据

新增 docs/space-exploration/09-ASSET-INVENTORY.md，按现有模板登记仓库内纹理和 UI 参考图（遍历仓库发现其他资产也应登记），记录相对路径、类型、字节数、SHA-256、引用位置，以及来源/作者/许可证据。

来源、作者和许可没有仓库证据就填“未确认”，禁止按文件名猜测 NASA、公有领域或商用许可。确认本地音乐为用户浏览器数据，不扫描私人目录。不能把概念预览当成已经落库的模型，不能虚构 GLB、LOD 或授权。

登记仅反映现状，不移动/删除既有资产、不改变构建、不实现许可扫描工具。未知许可列为待审，不能自行批准发布。

## B. Codex 开工授权与范围

结论：允许 Grok 执行上述三个 G0 子项。

允许修改：
- 本任务文档。
- README.md。
- docs/space-exploration/README.md。
- docs/space-exploration/03-BLENDER-ASSET-PIPELINE.md（仅过时平台条款）。
- docs/space-exploration/04-DELIVERY-ROADMAP.md。
- docs/space-exploration/05-QA-AND-RELEASE.md（仅过时平台条款）。
- docs/space-exploration/06-CODEBASE-AUDIT.md。
- docs/space-exploration/07-DECISIONS-RISKS-LICENSING.md（仅已确认决策与过时平台条款）。
- docs/space-exploration/09-ASSET-INVENTORY.md（新增）。

允许只读：仓库源码、测试、资产、其他任务文档和 Git 状态。
禁止：修改 src、依赖/锁文件、配置、AGENTS.md、联合工作流、其他任务文档；建模、安装、下载资产、提交、推送、部署、清理未跟踪文件、修改系统 Git 配置。不得填写 Codex 验收通过。

验证：开工/交接分别读取 git status --short --branch，结束执行 git diff --check；确认 Markdown 链接、字节数、哈希和每项状态的证据。Git 因所有权限制失败时如实记录，不修改全局配置，也不能声称 diff 检查通过。仓库文件可能未跟踪，须直接检查这些文件，不能把空 diff 当作无改动。
纯文档任务无需运行 npm 测试/构建，不为本任务编写测试；不得沿用历史数字声称本轮通过。
停止条件：需要超出允许文件、修改业务规则或新增外部工具时，仅记录问题，不扩范围；继续其余不受影响的文档工作。

## C. Grok 实现与交接

### 执行信息

- 执行者：Grok Build
- 状态：`waiting_codex_review`
- 下一位接收者：Codex 额度恢复后统一复核
- 未接手：P3-T02 建模仍由 Codex 保留

### 子项 1：进度校准

- 已修改：`docs/space-exploration/04-DELIVERY-ROADMAP.md`、`README.md`、`docs/space-exploration/README.md`、`docs/space-exploration/06-CODEBASE-AUDIT.md`
- 勾选完成仅限有 `accepted` 记录的项：P2-T06、P2-T07、P3-T01
- 未勾选但有代码：P0-T04、P1-T01–T03、P2-T02–T05（已实现待核验）
- 部分完成：P0-T01、P0-T05（清单已建、无运行时预算）、P1-T05（仅 LOD2/LOD1）、P2-T01（球体锥体灰盒）、P3-T02（仅 Blender 工具门禁）
- 未开始（明确不把占位当完成）：P1-T04 浮动原点、P1-T06 LOD0、P0-T06 性能采样
- 已被独立桌面架构取代、不再派发：P0-T02、P0-T03、P0-T07、P1-T07、P7-T01、P7-T02
- 证据路径写在路线图各条下；P3-T02 无 GLB/`.blend`

### 子项 2：桌面规范

- 已改过时平台条款：`03-BLENDER-ASSET-PIPELINE.md`（去掉移动端 1K）、`05-QA-AND-RELEASE.md`（去掉 390×844 / 412×915 与移动 FPS）、`07-DECISIONS-RISKS-LICENSING.md`（平台改为仅桌面 Web，删除移动 Web 待选项，登记 P3-T01 已确认项）
- 未改（白名单外）：`01-PRODUCT-REQUIREMENTS.md`、`02-TECHNICAL-ARCHITECTURE.md` 仍含历史移动端句子/性能列
- 未改建模预算、坐标或业务规则

#### 后续桌面体验清单（不是本轮测试结果）

| 项 | 范围 | 本轮 |
| --- | --- | --- |
| 三视角 | 跟随 / 驾驶舱 / 自由观察 | 未执行 |
| 三航线 | 地球、月球、土星手动闭环 | 未执行 |
| 暂停/失焦 | 用户暂停、隐藏、失焦后模拟与输入 | 未执行 |
| 返回全景 | 退出飞船预览回到太阳系 | 未执行 |
| 音频 | 本地音乐手势播放；推进声解锁/静音/销毁 | 未执行 |
| UI 裁切 | 1366×768、1920×1080、2560×1440 无滚动/HUD 溢出 | 未执行 |

### 子项 3：资产登记

- 新增：`docs/space-exploration/09-ASSET-INVENTORY.md`
- 16 个图像：15 张纹理 + 1 张 UI 参考图；字节数与 SHA-256 已写入该文件
- 未发现：GLB、`.blend`、音频文件、字体
- 许可/作者/来源：全部 **未确认**，生产构建允许=否（待审），未猜测 NASA/公有领域
- 本地音乐：仅记录 IndexedDB 键名，未扫描私人目录
- 未把概念预览登记为模型

### 检查

- 开工与交接 `git status --short --branch`：`## No commits yet on master`，顶层未跟踪集合与开工一致
- `git diff --check`：exit 0；仓库无提交，已跟踪 diff 为空，已直接核对未跟踪文档
- 本轮未运行 npm test/build，未引用历史测试数字
- 未安装、下载、提交、推送、部署；未改 `src`、依赖、其他任务文档

### 未确认与剩余风险

- 全部落库图像许可待审，不能当作发布通过
- P0-T05 仍缺运行时预算检查
- 产品需求与技术架构文档仍有历史移动端表述，需 Codex 决定是否另开文档任务
- 本任务不是 P3-T02、性能验收或建模完成

### 实现者 → Codex

- 主要修改：路线图校准、桌面平台条款、资产登记
- 验证：文档链接与哈希已按文件核对；无 npm 测试
- 重点复核：1）未把部分实现勾成完成；2）未虚构 GLB/授权；3）白名单外文件未改

### 第 1 轮返修

- 返修轮次：`1/2`
- 问题：`voyage-saturn-ring.png` 的 SHA-256 误写为 `...cb1b41...`，正确为 `...cb9b41...`
- 已改：`docs/space-exploration/09-ASSET-INVENTORY.md` 哈希一览与逐项记录共两处，现为 `9fddac75f0f1ab108ba2e1754d5ce9cb9b41dcc95d0b2f01c969dea13494848a`
- 未改：其他文档、代码、模型、配置
- 状态：`waiting_codex_review`

## D. Codex 最终复核

### 第 1 轮结论：`changes_requested`

- 阻断问题：`docs/space-exploration/09-ASSET-INVENTORY.md` 中 `src/assets/textures/voyage-saturn-ring.png` 的 SHA-256 登记错误。磁盘实际值为 `9fddac75f0f1ab108ba2e1754d5ce9cb9b41dcc95d0b2f01c969dea13494848a`；哈希一览及逐项记录均写成 `9fddac75f0f1ab108ba2e1754d5ce9cb1b41dcc95d0b2f01c969dea13494848a`。
- 返修范围：只修正上述文件中的两处土星环哈希，并在 C 节增加第 1 轮返修记录；不得修改其他文档或代码。
- 复核通过项：仓库实际媒体文件为 16 个（15 张纹理、1 张 UI 参考图）；其余 15 条哈希/大小与磁盘一致；全部本地 Markdown 链接可解析；路线图仅勾选 P2-T06、P2-T07、P3-T01，P3-T02 保持部分完成且由 Codex 保留；桌面范围修订符合任务边界；未发现冲突标记或非 Markdown 换行所需的尾随空白。
- Git 说明：`git status --short --branch` 显示仓库尚无提交，顶层文件均未跟踪；`git diff --check` 因此没有可检查的已跟踪差异，Codex 已直接读取并核对本任务涉及的未跟踪文档。
- 本轮未运行 npm 测试或构建，符合纯文档任务约定。
- 返修轮次：1/2。修正后重新设为 `waiting_codex_review` 并交回 Codex。

### 第 1 轮返修复验：`accepted`

- 土星环文件实际 SHA-256 为 `9fddac75f0f1ab108ba2e1754d5ce9cb9b41dcc95d0b2f01c969dea13494848a`。
- 资产清单的哈希一览与逐项记录各出现一次正确值，共两处；原错误值出现次数为 0。
- C 节已记录第 1 轮返修，返修内容符合限定范围；未发现冲突标记。
- 最终结论：进度校准、桌面验收清单与现有资产登记通过 Codex 复验，任务状态为 `accepted`。

## E. 用户说明

本任务已通过 Codex 复验。它不代表 P0-T05 全部完成（尚无运行时预算检查），也不代表任何建模、发布或完整性能验收已完成；P3-T02 继续由 Codex 保留。
