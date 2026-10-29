import { distance3, length3, sub3, add3, scale3, type Vec3 } from './vec3'

export interface MotionStudyInput { position: Vec3; velocity: Vec3; free: boolean; stable: boolean; blocked: boolean }
export interface MotionStudySample { seconds: number; position: Vec3; velocity: Vec3 }
export interface CabinMotionStudy {
  phase: 'armed' | 'recording' | 'complete' | 'invalid' | 'cancelled'; seconds: number; sampleClock: number
  samples: MotionStudySample[]; notice: string; result?: { displacement: number; speedMin: number; speedMax: number; residual: number }
}
export const MOTION_STUDY_SECONDS = 3
export const armCabinMotionStudy = (): CabinMotionStudy => ({ phase: 'armed', seconds: 0, sampleClock: 0, samples: [], notice: '观测已登记；选安全方向推离，松键后记录漂移' })
export const motionStudyActive = (s?: CabinMotionStudy) => s?.phase === 'armed' || s?.phase === 'recording'
export const cancelCabinMotionStudy = (s: CabinMotionStudy): CabinMotionStudy => ({ ...s, phase: 'cancelled', notice: '观测已取消，已有样本保留但不形成有效报告' })
const sample = (input: MotionStudyInput, seconds: number): MotionStudySample => ({ seconds, position: { ...input.position }, velocity: { ...input.velocity } })

/** Reads actual simulation telemetry. No force, damping, body transform or experiment geometry is authored. */
export function stepCabinMotionStudy(s: CabinMotionStudy, input: MotionStudyInput, dt: number, running = true): CabinMotionStudy {
  if (!motionStudyActive(s) || !running || !Number.isFinite(dt) || dt <= 0) return s
  const valid = [input.position, input.velocity].every(v => Object.values(v).every(Number.isFinite))
  if (!valid || !input.stable || input.blocked || s.phase === 'recording' && !input.free)
    return { ...s, phase: 'invalid', notice: '观测中止：发生接触、碰撞、飞船机动或无效数据；请重新登记' }
  if (s.phase === 'armed') return input.free && length3(input.velocity) >= .05
    ? { ...s, phase: 'recording', samples: [sample(input, 0)], notice: '记录舱内相对漂移，保持无接触' } : s
  const seconds = s.seconds + Math.min(dt, .1), clock = s.sampleClock + Math.min(dt, .1), complete = seconds + 1e-8 >= MOTION_STUDY_SECONDS
  const samples = clock + 1e-8 >= .1 || complete ? [...s.samples, sample(input, seconds)].slice(-64) : s.samples
  const next = { ...s, seconds, sampleClock: clock + 1e-8 >= .1 ? 0 : clock, samples }
  if (!complete) return next
  const start = samples[0], end = samples.at(-1)!, speeds = samples.map(row => length3(row.velocity))
  const expected = add3(start.position, scale3(start.velocity, seconds))
  return { ...next, phase: 'complete', notice: '舱内漂移观测完成，已生成模拟数据报告', result: {
    displacement: distance3(start.position, end.position), speedMin: Math.min(...speeds), speedMax: Math.max(...speeds), residual: length3(sub3(end.position, expected))
  } }
}
export function cabinMotionStudyCsv(s: CabinMotionStudy) {
  return ['seconds,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s', ...s.samples.map(r => [r.seconds, r.position.x, r.position.y, r.position.z, r.velocity.x, r.velocity.y, r.velocity.z].map(n => n.toFixed(6)).join(','))].join('\n')
}
