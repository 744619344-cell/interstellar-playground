export default function CabinFeatureGuide({expanded=false}:{expanded?:boolean}) {
  const content = <>
    <p>靠近后按 F，按照当前面板操作；F 结束查看，Esc 取消动作。</p>
    <ul>
      <li><strong>睡眠舱：</strong>脱服后 F 进入，F 离开；过渡中 Esc 退出。</li>
      <li><strong>驾驶座：</strong>F 入座，约束到位后驾驶；F 起身。</li>
      <li><strong>储物面板：</strong>抓稳设备后领还工具包、切换照明、记录船载状态。</li>
      <li><strong>维护工位：</strong>带工具包抓稳后巡检；漂移观测会切到真实惯性，需手动推离。</li>
      <li><strong>宇航服舱：</strong>F 查看 → 抓稳设备 → 开柜 → 穿服 → 检查；返舱后脱服收纳。</li>
      <li><strong>气闸：</strong>门旁 F 操作，穿服检查、系留、双门互锁和压力流程已有逻辑。</li>
    </ul>
    <p className='cabin-feature-pending'>待完成：气闸门框实际穿行与完整 EVA 回路；毛细流、植物、舱外材料实验装置；全部动作视觉验收和长时性能验证。当前不能保证连续出舱成功。</p>
  </>
  return expanded ? <section className='cabin-feature-guide' aria-label='设备手册'>{content}</section> : <details className='cabin-feature-guide'><summary>设备用法与未完成项目</summary>{content}</details>
}
