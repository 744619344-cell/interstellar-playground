import test from 'node:test'
import assert from 'node:assert/strict'
import { microgravityInput } from './microgravityInput'
import { createCabinFloat, stepCabinFloat } from '../domain/cabinFloatMotion'
const nudge = { forward: 0, right: 0, up: 0, seconds: 0 }
const identity = { x: 0, y: 0, z: 0, w: 1 }

test('arrows push in view directions even when the body faces another way', () => {
  for (const [code, yaw, normal] of [
    ['ArrowRight', 0, { x: 1, y: 0, z: 0 }],
    ['ArrowUp', Math.PI / 2, { x: -1, y: 0, z: 0 }],
    ['ArrowDown', Math.PI, { x: 0, y: 0, z: -1 }]
  ] as const) {
    const state = { ...createCabinFloat({ x: 0, y: 0, z: 0 }),
      orientation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }, contactSeconds: 1,
      contact: { id: 'real-support-fixture', point: { x: 0, y: 0, z: 0 }, normal, kind: 'handrail' as const } }
    const next = stepCabinFloat(state, microgravityInput(new Set([code]), true, state.orientation, yaw, nudge, true), {}, .02)
    assert.equal(next.contact, undefined)
    for (const axis of ['x', 'y', 'z'] as const) assert(Math.abs(next.velocity[axis] - normal[axis] * .52) < 1e-10)
  }
})

test('Shift arrows keep posture controls, opposing arrows cancel, and blocked/paused input cannot push', () => {
  const turning = microgravityInput(new Set(['ShiftLeft', 'ArrowRight']), true, identity, 0, nudge, true)
  assert.equal(turning.push, false); assert.equal(turning.yaw, -1)
  const opposed = microgravityInput(new Set(['ArrowLeft', 'ArrowRight']), true, identity, 0, nudge, true)
  assert.equal(opposed.push, false); assert.equal(opposed.right, 0)
  assert.equal(microgravityInput(new Set(['ArrowUp']), true, identity, 0, nudge, false).push, false)
  assert.deepEqual(microgravityInput(new Set(['ArrowUp']), false, identity, 0, nudge, true), {})
  assert.equal(microgravityInput(new Set(['KeyW']), true, identity, 0, nudge, true).push, false)
  assert.equal(microgravityInput(new Set(['KeyW', 'Space']), true, identity, 0, nudge, true).push, true)
})

test('arrows cannot invent cabin thrust in free flight or overcome a device restraint', () => {
  const input = microgravityInput(new Set(['ArrowRight']), true, identity, 0, nudge, true)
  const free = { ...createCabinFloat({ x: 0, y: 0, z: 0 }), velocity: { x: .2, y: 0, z: 0 } }
  const next = stepCabinFloat(free, input, {}, .1)
  assert.deepEqual(next.velocity, free.velocity); assert(Math.abs(next.position.x - .02) < 1e-10)
  const fixed = { ...free, fixed: 'sleep-restraint' }
  assert.deepEqual(stepCabinFloat(fixed, input, {}, .1), fixed)
})
