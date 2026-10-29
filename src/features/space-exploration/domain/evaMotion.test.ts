import test from 'node:test'
import assert from 'node:assert/strict'
import { createEvaMotion, stepEvaMotion, type EvaMotion } from './evaMotion'
import { dot3, length3, sub3 } from './vec3'
const anchor = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } }
const near = (a: number, b: number, epsilon = 1e-8) => assert(Math.abs(a - b) < epsilon, `${a} != ${b}`)

test('EVA coasts without air drag or fuel consumption and preserves angular motion', () => {
  let s = { ...createEvaMotion(), velocity: { x: .2, y: -.05, z: .01 }, angularVelocity: { x: 0, y: .1, z: 0 } }
  const original = structuredClone(s)
  for (let i = 0; i < 200; i++) s = stepEvaMotion(s, {}, anchor, .05)
  near(s.position.x, 2); near(s.position.y, -.5); near(s.position.z, -.55)
  assert.deepEqual(s.velocity, original.velocity); assert.equal(s.fuel, 1)
  near(s.angularVelocity.y, .1); near(Math.hypot(...Object.values(s.orientation)), 1)
  assert(s.orientation.y > .47)
})

test('EVA thrust follows body heading, diagonal input has no extra acceleration, and input is not mutated', () => {
  const initial = { ...createEvaMotion(), orientation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 } }
  const backup = structuredClone(initial)
  let turned = initial, straight = createEvaMotion(), diagonal = createEvaMotion()
  for (let i = 0; i < 20; i++) {
    turned = stepEvaMotion(turned, { forward: 1, thrusters: true }, anchor, .05)
    straight = stepEvaMotion(straight, { right: 1, thrusters: true }, anchor, .05)
    diagonal = stepEvaMotion(diagonal, { right: 1, up: 1, forward: 1, thrusters: true }, anchor, .05)
  }
  near(turned.velocity.x, -.14); near(turned.velocity.z, 0)
  near(length3(diagonal.velocity), length3(straight.velocity)); near(diagonal.fuel, straight.fuel)
  assert.deepEqual(initial, backup)
})

test('taut tether removes only outward radial motion and preserves tangential or inward velocity', () => {
  const outward = { ...createEvaMotion({ x: 8, y: 0, z: 0 }), velocity: { x: 1, y: .4, z: 0 } }
  const constrained = stepEvaMotion(outward, {}, anchor, .01)
  near(length3(constrained.position), 8)
  assert(dot3(constrained.velocity, constrained.position) <= 1e-8)
  assert(constrained.velocity.y > .39); assert(constrained.radialCorrection > .99); assert(constrained.taut)
  const inward = stepEvaMotion({ ...outward, velocity: { x: -1, y: 0, z: 0 } }, {}, anchor, .01)
  near(inward.velocity.x, -1); assert(!inward.taut)
})

test('tether response is invariant when the same world velocity is added to ship anchor and astronaut', () => {
  const a = { ...createEvaMotion({ x: 7.99, y: 0, z: 0 }), velocity: { x: 1, y: .2, z: 0 } }
  const b = { ...a, velocity: { x: 4, y: .2, z: 0 } }
  const endA = stepEvaMotion(a, {}, anchor, .1)
  const endB = stepEvaMotion(b, {}, { ...anchor, velocity: { x: 3, y: 0, z: 0 } }, .1)
  near(endB.position.x - endA.position.x, .3); near(endB.position.y, endA.position.y)
  near(endB.velocity.x - endA.velocity.x, 3); near(endB.velocity.y, endA.velocity.y)
})

test('explicit assisted reeling stays bounded, then payout releases the length constraint without teleporting', () => {
  let s: EvaMotion = createEvaMotion({ x: 8, y: 0, z: 0 })
  for (let i = 0; i < 600; i++) {
    s = stepEvaMotion(s, { reel: 1 }, anchor, .05)
    assert(length3(s.position) <= s.lineLength + 1e-8)
    assert([s.position.x, s.velocity.x, s.lineLength].every(Number.isFinite))
  }
  near(s.lineLength, .8)
  const before = s.position.x
  s = stepEvaMotion(s, { reel: -1 }, anchor, .05)
  assert(s.lineLength > .8); assert(Math.abs(s.position.x - before) < .02)
})

test('stabilization consumes available propellant and cannot erase inertia when empty or disabled', () => {
  const s = { ...createEvaMotion(), velocity: { x: .3, y: 0, z: 0 }, angularVelocity: { x: 0, y: .2, z: 0 } }
  const braking = stepEvaMotion(s, { thrusters: true, brake: true, stabilize: true }, anchor, .1)
  assert(braking.velocity.x < .3); assert(braking.angularVelocity.y < .2); assert(braking.fuel < 1)
  for (const input of [{ thrusters: false, brake: true }, { thrusters: true, brake: true }]) {
    const empty = stepEvaMotion({ ...s, fuel: 0 }, input, anchor, .1)
    assert.deepEqual(empty.velocity, s.velocity); assert.deepEqual(empty.angularVelocity, s.angularVelocity)
  }
})

test('pause, malformed inputs and frame gaps do not inject momentum or corrupt state', () => {
  const s = createEvaMotion()
  assert.equal(stepEvaMotion(s, {}, anchor, .1, false), s)
  assert.equal(stepEvaMotion(s, {}, anchor, NaN), s)
  assert.deepEqual(stepEvaMotion(s, { right: NaN, thrusters: true }, anchor, .1).velocity, s.velocity)
  assert.deepEqual(stepEvaMotion(s, { right: 1, thrusters: true }, anchor, 10), stepEvaMotion(s, { right: 1, thrusters: true }, anchor, .25))
  assert.throws(() => stepEvaMotion(s, {}, { ...anchor, velocity: { x: NaN, y: 0, z: 0 } }, .01))
  assert.throws(() => stepEvaMotion({ ...s, lineLength: 0 }, {}, anchor, .01))
  near(length3(sub3(s.position, anchor.position)), .65)
})
