import test from 'node:test'
import assert from 'node:assert/strict'
import { ShipFrameStats } from './shipFrameStats'

test('render cadence uses real intervals, including frames much slower than simulation caps', () => {
  for (const fps of [1, 30, 60, 120]) {
    const stats = new ShipFrameStats()
    for (let frame = 0; frame <= 100; frame++) stats.frame(frame * 1000 / fps)
    assert(Math.abs(stats.snapshot().fps - fps) < 1e-8)
    assert(Math.abs(stats.snapshot().lowFps - fps) < 1e-8)
  }
})

test('one-percent low counts real stalls and obsolete frames leave the bounded window', () => {
  const stats = new ShipFrameStats()
  let time = 0; stats.frame(time)
  for (let frame = 0; frame < 100; frame++) stats.frame(time += frame === 20 ? 200 : 10)
  assert.equal(stats.snapshot().lowFps, 5)
  assert(stats.snapshot().fps < 100)
  for (let frame = 0; frame < 300; frame++) stats.frame(time += 10)
  assert.deepEqual(stats.snapshot(), { samples: 300, fps: 100, lowFps: 100 })
})

test('invalid timestamps and hidden time cannot pollute a resumed sample', () => {
  const stats = new ShipFrameStats()
  stats.frame(0); stats.frame(10)
  for (const time of [0, 10, -100, NaN, Infinity]) stats.frame(time)
  stats.frame(20); assert.equal(stats.snapshot().fps, 100)
  stats.reset(); stats.frame(100000); stats.frame(100010)
  assert.deepEqual(stats.snapshot(), { samples: 1, fps: 100, lowFps: 100 })
})
