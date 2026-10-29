import test from 'node:test'
import assert from 'node:assert/strict'
import { frameProbeStats } from './frameProbeStats'

test('frame report includes slow frames in delivered FPS and uses the mean slowest one percent', () => {
  const stats = frameProbeStats([...Array(198).fill(10), 40, 60, NaN, 0])
  assert.equal(stats.frames, 200); assert.equal(stats.activeSeconds, 2.08)
  assert(Math.abs(stats.averageFps - 200 / 2.08) < 1e-8)
  assert.equal(stats.onePercentLowFps, 20); assert.equal(stats.longestFrameMs, 60)
  assert.equal(frameProbeStats([]).frames, 0)
})
