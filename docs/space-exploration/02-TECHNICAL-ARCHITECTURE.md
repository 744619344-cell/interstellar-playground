# 单画布太阳系技术架构

## 1. 架构目标

- 一个 Canvas、一个渲染器、一套太阳系状态。
- 全景、航行、近轨、内舱和舱外之间不通过重载页面切换。
- 游戏规则与 Three.js 渲染解耦，可在无 WebGL 环境运行单元测试。
- 资源、更新频率和画质随距离、视角与设备能力变化。
- 任何层级暂停、隐藏或卸载后都能可靠释放帧循环、监听器、音频和 GPU 资源。

## 2. 建议模块边界

```text
src/features/space-exploration/
├─ application/       场景编排、模式切换、存档协调
├─ domain/            航行、气闸、EVA、任务纯逻辑
├─ input/             键盘、鼠标、手柄、触控映射
├─ rendering/
│  ├─ core/           renderer、composer、相机与生命周期
│  ├─ solar-system/   星体注册、轨道、视觉尺度
│  ├─ spacecraft/     飞船外部、内舱、灯光与特效
│  ├─ astronaut/      骨骼、动画状态机与附件
│  └─ streaming/      LOD、纹理、模型加载与回收
├─ audio/             音乐状态、SFX、总线和焦点策略
├─ ui/                HUD、导航、气闸清单、设置
├─ storage/           版本化存档与容错
└─ tests/             领域、生命周期、资源和端到端测试
```

React 只负责页面外壳和可访问 UI，不承载逐帧状态。高频遥测通过节流快照进入 React，目标为 5–10 Hz。

## 3. 世界坐标与尺度

### 3.1 三层坐标

1. **天文逻辑坐标**：使用双精度数值保存天体与航线关系，不直接传给 GPU。
2. **局部渲染坐标**：以飞船或当前目标为浮动原点，将可见对象转换到安全范围。
3. **角色坐标**：飞船内部和 EVA 使用米级单位，挂接到飞船局部参考系。

每当飞船距局部原点超过阈值，执行无感知的原点重定位。领域状态保存绝对逻辑位置，Three.js 对象只保存局部位置。

### 3.2 视觉尺度

- 太阳系全景使用压缩轨道半径和夸张星体半径。
- 航行模式使用分段距离映射，避免玩家等待真实尺度航程。
- 进入星体影响范围后切到局部近轨尺度。
- 飞船内部始终保持 1 unit = 1 meter，不能随太阳系缩放。

## 4. 场景模式

```ts
type ExplorationMode =
  | 'system-map'
  | 'ship-exterior'
  | 'cockpit'
  | 'cabin'
  | 'airlock'
  | 'eva'
```

模式切换只改变相机、输入上下文、可见集合和更新频率，不销毁太阳系根状态。

## 5. 星体系统与 LOD

每颗星体由稳定 ID 注册，并具有三档视觉代理：

| LOD | 触发条件 | 内容 |
| --- | --- | --- |
| LOD2 远景 | 全景或远距离 | 低面数球、512–1K 纹理、无独立后处理 |
| LOD1 中景 | 被聚焦或进入航线 | 中等网格、1K–2K 纹理、大气/星环简化层 |
| LOD0 近景 | 当前目标近轨 | 2K–4K 纹理、法线/粗糙度、云层、局部效果 |

要求：

- LOD 切换通过交叉淡化或遮蔽期完成。
- 同一时间最多一个星体处于 LOD0，最多三个处于 LOD1。
- 纹理请求支持取消；迟到资源不得写入已销毁场景。
- 未使用资源进入引用计数缓存，超预算后按最近最少使用回收。

## 6. 飞船系统

飞船采用一个逻辑刚体和多个渲染/交互节点：

```text
SpacecraftRoot
├─ ExteriorLOD
├─ InteriorRoot
├─ CockpitCameraAnchor
├─ ThirdPersonCameraAnchor
├─ Airlock
│  ├─ InnerDoor
│  ├─ OuterDoor
│  └─ EVAAnchor
├─ Seats
├─ InteractionSockets
└─ ThrusterSockets
```

领域模型负责线速度、角速度、燃料抽象、辅助驾驶和防撞；渲染层负责插值、推进器、灯光与相机。采用固定时间步模拟，渲染帧使用插值，避免不同刷新率改变手感。

## 7. 宇航员与动画状态机

- 一个标准人形骨架，角色蒙皮与背包附件分离。
- 动画使用 `AnimationMixer`，动作以语义名称注册，禁止依赖数组下标。
- 行走使用代码位移 + in-place 动画，避免重复 root motion。
- 手部、背包、头盔和安全绳使用独立约束或附件节点，不让非人体硬表面跟随躯干蒙皮扭曲。
- 状态切换使用短交叉淡化，跳转前验证动作存在。
- 加载失败时回退到稳定待机姿态，不允许角色滑行。

建议动作：`SeatedIdle`、`PilotControls`、`StandUp`、`CabinWalk`、`Turn`、`AirlockBrace`、`EVAExit`、`EVAIdle`、`EVAThruster`、`EVAGrab`、`EVAEnter`、`SitDown`。

## 8. 气闸安全状态机

气闸规则必须属于纯领域模块：

```text
CabinOpen
→ InnerDoorClosed
→ SuitVerified
→ TetherAttached
→ Depressurizing
→ VacuumReady
→ OuterDoorOpen
→ EVA
```

约束：

- 内外门不能同时打开。
- 压力不满足时外门不可开。
- 未连接安全绳时不可离开锚点安全区。
- 任何非法状态恢复到最近安全状态并给出原因。

## 9. 相机与输入

- 输入层输出统一动作，不让业务代码读取原始键码。
- 每种模式拥有自己的输入映射和指针捕获策略。
- 自由观察相机不得改变飞船姿态。
- 驾驶舱视角与飞船旋转一致，第三人称加入阻尼但不产生方向反转。
- UI、弹窗、设置和气闸面板必须排除场景指针捕获。

## 10. 音频架构

使用一个需要用户手势解锁的 AudioContext，建立四条总线：`music`、`ambience`、`effects`、`ui`。

- 音乐状态：`system`、`cruise`、`approach`、`danger`、`eva`。
- 切换采用 2–6 秒交叉淡化，不重新创建播放器。
- 大文件流式播放，不解码整首到内存。
- 页面隐藏时暂停；恢复时遵守浏览器自动播放规则。
- 音源通过配置清单引用，不允许把本机绝对路径写入仓库。

## 11. 生命周期

统一运行时接口：

```ts
interface ExplorationRuntime {
  start(): void
  pause(reason: PauseReason): void
  resume(reason: PauseReason): void
  resize(viewport: Viewport): void
  setQuality(profile: QualityProfile): void
  destroy(): void
}
```

暂停原因必须可组合：用户暂停、弹窗、页面隐藏和系统节能互不覆盖。`destroy()` 必须取消 RAF、加载请求、定时器、事件、音频节点、几何、材质、纹理和后处理目标。

## 12. 性能预算

| 指标 | 桌面标准 | 桌面节能 | 移动 Web |
| --- | --- | --- | --- |
| FPS | 60 目标，45 下限 | 30 下限 | 30 目标 |
| 像素比 | 最大 1.5 | 最大 1.0 | 最大 1.0–1.25 |
| 可见三角面 | ≤ 500k | ≤ 250k | ≤ 150k |
| 常驻 GPU 纹理 | ≤ 384 MB | ≤ 192 MB | ≤ 128 MB |
| 首次交互资源 | ≤ 8 MB | ≤ 6 MB | ≤ 5 MB |
| 单次近景增量 | ≤ 18 MB | ≤ 10 MB | ≤ 6 MB |
| Draw calls | ≤ 300 | ≤ 180 | ≤ 120 |

连续运行 20 分钟，JS Heap 和 GPU 资源不能随模式切换持续线性增长。

## 13. 渐进迁移

1. 保留现有太阳系入口和旧体验作为回退路径。
2. 在新 feature 目录实现独立垂直切片。
3. 新单画布通过验收后，将 `/desktop-web-entry/index` 指向新世界。
4. 独立星体路由暂时重定向到新世界并聚焦对应星体。
5. 稳定后再单独评审旧引擎删除，不在功能任务中顺手删除。
