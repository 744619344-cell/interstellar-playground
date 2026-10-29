# 座椅移动问题：离线诊断脚本

这些脚本保留当前失败案例的来源对照，**不修改模型文件或默认游戏逻辑**。从项目根目录运行，要求项目依赖已安装；结果写入忽略目录 `.cache/`，不覆盖已交付的证据。它们在内存中读取真实模型、临时设置已有骨骼姿态或采样，并在退出时释放资源，不生成模型几何。

- `npx tsx tools/seat-diagnostics/runtime-candidate-study.ts`：用保存的真实碰撞姿态，对照原逻辑和 `seatEscape` 候选的左右移动；可将 `seat-escape-browser-after.json` 作为可选参数，改用另一份实景姿态。
- `npx tsx tools/seat-diagnostics/pose-clearance.ts`：对真实碰撞帧的既有身体采样做多方向固定姿态源面扫掠。
- `npx tsx tools/seat-diagnostics/pose-greedy.ts`：用用户原根位置和来源初始骨骼姿态测试有限、多关节避让。它不是原始现场完整骨骼姿态，也不证明连续动作安全或视觉通过。

相关输入和原始结果位于 `output/hunyuan-adaptation/microgravity-cabin-20261025/seat-control-20261029/`。这些研究代码的结果不应覆盖实际游戏验收，具体限制见 P3-R01 任务记录。
