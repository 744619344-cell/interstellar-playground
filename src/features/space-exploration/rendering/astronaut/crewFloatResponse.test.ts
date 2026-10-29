import test from 'node:test'
import assert from 'node:assert/strict'
import { CrewFloatResponse } from './crewFloatResponse'

test('movement response eases in and out, is bounded, and does not tick while paused', () => {
  const response = new CrewFloatResponse()
  response.set({ x: 4, y: 0, z: .6 }, -4, true); response.step(1 / 60)
  assert(response.forward > 0 && response.forward < .1)
  assert(response.side > 0 && response.side < .1); assert(response.turn < 0 && response.turn > -.1)
  const paused = response.forward; response.step(0); response.step(NaN); assert.equal(response.forward, paused)
  for (let i = 0; i < 90; i++) response.step(1 / 60)
  assert(response.forward > .99 && response.side <= 1 && response.turn >= -1)
  response.set({ x: 0, y: 0, z: 0 }, 0, false)
  for (let i = 0; i < 120; i++) response.step(1 / 60)
  assert(Math.abs(response.forward) < .001 && Math.abs(response.side) < .001 && Math.abs(response.turn) < .001)
})
