import test from 'node:test'
import assert from 'node:assert/strict'
import { ShipMouseSteering } from './shipMouseSteering'
import { createShipFlightState, type ShipFlightInput } from './shipFlightModel'
import { rotateShipVector, integrateShipRotation } from './shipFlightMath'
import { stepNavigatedShip } from './shipFlightSafety'
import { ShipFlightSimulation } from '../application/shipFlightSimulation'
import { dot3, normalize3 } from './vec3'

const settle = (steering: ShipMouseSteering, state = createShipFlightState(), seconds = 6) => {
  for (let i = 0; i < seconds * 120; i++) state = stepNavigatedShip(state, steering.command(state, {}), [], undefined, false).state
  return state
}

test('right and upward drags turn the nose right and upward, then settle without ongoing spin', () => {
  const steering = new ShipMouseSteering(), original = createShipFlightState()
  steering.drag(original.orientation, 180, -80)
  const state = settle(steering)
  const nose = rotateShipVector(state.orientation, { x: 0, y: 0, z: -1 })
  assert(nose.x > .6); assert(nose.y > .25); assert(nose.z < -.6)
  assert(Math.hypot(...Object.values(state.angularVelocity)) < .001)
  assert(Math.abs(Math.hypot(...Object.values(state.orientation)) - 1) < 1e-12)
  const later = settle(steering, state)
  assert.deepEqual(later.orientation, state.orientation)
  assert.deepEqual(original, createShipFlightState())
})

test('mouse steering is identical at 30/60/120 Hz and thrust aligns with the actual nose', () => {
  const results = [30, 60, 120].map(fps => {
    const sim = new ShipFlightSimulation(), steering = new ShipMouseSteering()
    steering.drag(sim.snapshot().state.orientation, 220, -60)
    for (let i = 0; i < fps * 6; i++) sim.advance(1 / fps,
      (state, input) => stepNavigatedShip(state, steering.command(state, input), [], undefined, false).state)
    sim.setInput({ throttle: 1 })
    for (let i = 0; i < fps; i++) sim.advance(1 / fps,
      (state, input) => stepNavigatedShip(state, steering.command(state, input), [], undefined, false).state)
    const state = sim.snapshot().state
    assert(dot3(normalize3(state.velocity), rotateShipVector(state.orientation, { x: 0, y: 0, z: -1 })) > .99999)
    return state
  })
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2])
})

test('reverse and deliberate strafe stay in the rotated ship frame', () => {
  const steering = new ShipMouseSteering()
  steering.drag(createShipFlightState().orientation, 240, -100)
  const state = settle(steering), nose = rotateShipVector(state.orientation, { x: 0, y: 0, z: -1 })
  for (const [input, expected] of [
    [{ throttle: -1 }, { x: -nose.x, y: -nose.y, z: -nose.z }],
    [{ strafe: 1 }, rotateShipVector(state.orientation, { x: 1, y: 0, z: 0 })]
  ] as const) {
    const next = stepNavigatedShip(state, input, [], undefined, false).state
    assert(dot3(normalize3(next.velocity), expected) > .99999)
  }
})

test('clear and stabilize cancel the target; invalid deltas do not enqueue a turn', () => {
  const steering = new ShipMouseSteering(), state = createShipFlightState()
  for (const [dx, dy] of [[NaN, 2], [2, Infinity], [0, 0]]) steering.drag(state.orientation, dx, dy)
  assert.deepEqual(steering.command(state, {}), {})
  steering.drag(state.orientation, 200, 0); steering.clear()
  assert.deepEqual(steering.command(state, {}), {})
  steering.drag(state.orientation, 200, 0)
  const brake = { stabilize: true }
  assert.deepEqual(steering.command(state, brake), brake)
  assert.deepEqual(steering.command(state, {}), {})
})

test('quaternion sign and long turns use the shortest finite rotation', () => {
  for (const dx of [Math.PI / .004 - .1, Math.PI / .004 + .1, 1600]) {
    const steering = new ShipMouseSteering(), state = createShipFlightState()
    state.orientation = integrateShipRotation(state.orientation, { x: .2, y: .8, z: -.1 }, 1)
    steering.drag(state.orientation, dx, 0)
    const a = steering.command(state, {})
    const q = state.orientation
    const negative = { ...state, orientation: { x: -q.x, y: -q.y, z: -q.z, w: -q.w } }
    const b = steering.command(negative, {})
    for (const key of ['pitch', 'yaw', 'roll'] as (keyof ShipFlightInput)[]) {
      assert(Number.isFinite(a[key])); assert(Math.abs(Number(a[key])) <= 1)
      assert(Math.abs(Number(a[key]) - Number(b[key])) < 1e-12)
    }
  }
})
