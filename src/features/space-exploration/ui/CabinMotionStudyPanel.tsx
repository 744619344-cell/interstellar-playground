import { cabinMotionStudyCsv, MOTION_STUDY_SECONDS, motionStudyActive, type CabinMotionStudy } from '../domain/cabinMotionStudy'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'

export default function CabinMotionStudyPanel({ study, paused, onAction, embedded=false }: { study?: CabinMotionStudy; paused: boolean; onAction: (action: ShipFlightAction) => void; embedded?: boolean }) {
  if (!study) return <p>尚未登记观测。</p>
  const active = motionStudyActive(study), result = study.result
  const speed = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z)
  const max = Math.max(.1, ...study.samples.map(s => speed(s.velocity))) * 1.1
  const points = study.samples.map(s => `${8 + s.seconds / Math.max(MOTION_STUDY_SECONDS, study.seconds) * 270},${78 - speed(s.velocity) / max * 65}`).join(' ')
  return <section className={`cabin-study-panel${embedded?' is-embedded':''}`} aria-label='漂移惯性观测'>
    <div><strong>漂移惯性观测</strong></div>
    <p>{study.notice}</p><progress max={MOTION_STUDY_SECONDS} value={Math.min(MOTION_STUDY_SECONDS, study.seconds)}/>
      <small>{study.samples.length} 个样本 · {study.seconds.toFixed(2)} s · 船舱坐标系</small>
      {study.samples.length > 1 && <svg viewBox='0 0 292 94' role='img' aria-label='实际模拟遥测速率随时间曲线'><path d='M8 8V80H280' fill='none' stroke='#799198'/><polyline points={points} fill='none' stroke='#9be1c8' strokeWidth='2'/><text x='12' y='17' fill='#c9dedb' fontSize='9'>速率 m/s</text><text x='247' y='92' fill='#c9dedb' fontSize='9'>时间 s</text></svg>}
      {result && <p>位移 {result.displacement.toFixed(3)} m<br/>速率 {result.speedMin.toFixed(3)}–{result.speedMax.toFixed(3)} m/s<br/>匀速预测残差 {result.residual.toFixed(4)} m</p>}
      {active && <button type='button' disabled={paused} onClick={() => onAction('equipment:micro-work:study-cancel')}>停止观测</button>}
      {study.phase === 'complete' && <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(cabinMotionStudyCsv(study))}`} download='cabin-motion-observation.csv'>保存实验数据 CSV</a>}
      <small>记录当前游戏模拟数据。未接触、未系绳且飞船稳定时有效；未模拟空气阻力与轨道重力梯度。</small>
  </section>
}
