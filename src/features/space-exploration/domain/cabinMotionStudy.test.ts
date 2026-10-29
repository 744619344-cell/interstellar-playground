import test from 'node:test'
import assert from 'node:assert/strict'
import { armCabinMotionStudy, stepCabinMotionStudy, cabinMotionStudyCsv, cancelCabinMotionStudy, type MotionStudyInput } from './cabinMotionStudy'
const input = (t = 0): MotionStudyInput => ({ position: { x: .52 * t, y: 0, z: 0 }, velocity: { x: .52, y: 0, z: 0 }, free: true, stable: true, blocked: false })
test('study reads actual position/velocity samples, retains constant speed and exports declared SI columns', () => {
  let s = armCabinMotionStudy(); assert.equal(stepCabinMotionStudy(s, { ...input(), free: false }, .1), s)
  s = stepCabinMotionStudy(s, input(), .1)
  for (let i = 1; i <= 30; i++) s = stepCabinMotionStudy(s, input(i / 10), .1)
  assert.equal(s.phase, 'complete'); assert(Math.abs(s.result!.displacement - 1.56) < 1e-9)
  assert(s.result!.residual < 1e-10); assert.equal(s.result!.speedMax, .52); assert.equal(s.samples.length, 31)
  const csv = cabinMotionStudyCsv(s).split('\n'); assert.equal(csv.length, 32); assert.equal(csv[0], 'seconds,x_m,y_m,z_m,vx_m_s,vy_m_s,vz_m_s')
  assert.equal(stepCabinMotionStudy(s, input(4), .1), s)
})
test('pause preserves exact state; contact, collision, maneuver and nonfinite samples invalidate rather than fabricate a report', () => {
  const s = stepCabinMotionStudy(armCabinMotionStudy(), input(), .1)
  assert.equal(stepCabinMotionStudy(s, input(1), 10, false), s)
  for (const bad of [{ ...input(), free: false }, { ...input(), blocked: true }, { ...input(), stable: false }, { ...input(), position: { x: NaN, y: 0, z: 0 } }]) {
    const invalid = stepCabinMotionStudy(s, bad, .1); assert.equal(invalid.phase, 'invalid'); assert.equal(invalid.result, undefined)
  }
  const cancelled = cancelCabinMotionStudy(s); assert.equal(cancelled.phase, 'cancelled'); assert.equal(cancelled.samples.length, s.samples.length)
})
