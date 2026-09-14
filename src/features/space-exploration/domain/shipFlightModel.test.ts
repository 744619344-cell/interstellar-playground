import assert from 'node:assert/strict'
import test from 'node:test'
import { createShipFlightState, SHIP_FLIGHT, stepShipFlight } from './shipFlightModel'
import { integrateShipRotation, interpolateShipRotation, rotateShipVector } from './shipFlightMath'
import { length3 } from './vec3'

const close = (a: number, b: number, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`)

test('one second of thrust follows local -Z and preserves the source state', () => {
  const initial = createShipFlightState()
  let s = initial
  for (let i = 0; i < 120; i++) s = stepShipFlight(s, { throttle: 1 })
  close(s.velocity.z, -8)
  close(s.position.z, -4, .04)
  assert.deepEqual(initial, createShipFlightState())
})

test('release decelerates to a stop after respecting the speed limit', () => {
  let s = createShipFlightState()
  for (let i = 0; i < 2400; i++) s = stepShipFlight(s, { throttle: 1 })
  close(length3(s.velocity), SHIP_FLIGHT.maxSpeed)
  for (let i = 0; i < 840; i++) s = stepShipFlight(s, {})
  close(length3(s.velocity), 0)
})

test('braking stops without reversing; stopping distance matches v²/2a within one step', () => {
  let s = createShipFlightState()
  s.velocity = { x: 0, y: 0, z: -24 }
  for (let i = 0; i < 300; i++) {
    s = stepShipFlight(s, { brake: 1, throttle: 1 })
    assert.ok(s.velocity.z <= 0)
  }
  close(length3(s.velocity), 0)
  close(-s.position.z, 24, .11)
})

test('braking acts against arbitrary world velocity, even when the ship faces elsewhere', () => {
  const s = createShipFlightState()
  s.velocity = { x: 3, y: 4, z: 0 }
  const next = stepShipFlight(s, { brake: 1 })
  close(length3(next.velocity), 4.9)
  close(next.velocity.x / next.velocity.y, 3 / 4)
})

test('pitch raises the nose, yaw turns left, roll banks right', () => {
  const pitch = stepShipFlight(createShipFlightState(), { pitch: 1 })
  const yaw = stepShipFlight(createShipFlightState(), { yaw: 1 })
  const roll = stepShipFlight(createShipFlightState(), { roll: 1 })
  assert.ok(rotateShipVector(pitch.orientation, { x: 0, y: 0, z: -1 }).y > 0)
  assert.ok(rotateShipVector(yaw.orientation, { x: 0, y: 0, z: -1 }).x < 0)
  assert.ok(rotateShipVector(roll.orientation, { x: 0, y: 1, z: 0 }).x > 0)
})

test('thrust rotates with the ship instead of remaining along the world axis', () => {
  const s = createShipFlightState()
  s.orientation = integrateShipRotation(s.orientation, { x: 0, y: Math.PI / 2, z: 0 }, 1)
  const next = stepShipFlight(s, { throttle: 1 })
  close(next.velocity.z, 0)
  assert.ok(next.velocity.x < 0)
})

test('stabilization acts as an immediate all-axis stop command', () => {
  let s = createShipFlightState()
  s.velocity = { x: 10, y: 5, z: -20 }
  for (let i = 0; i < 240; i++) s = stepShipFlight(s, { stabilize: true })
  close(length3(s.velocity), 0)
})

test('reverse, strafe and supplied camera basis control translation directly', () => {
  let reverse = createShipFlightState()
  let strafe = createShipFlightState()
  let cameraForward = createShipFlightState()
  const basis = { forward: { x: -1, y: 0, z: 0 }, right: { x: 0, y: 0, z: -1 } }
  for (let i = 0; i < 120; i++) {
    reverse = stepShipFlight(reverse, { throttle: -1 })
    strafe = stepShipFlight(strafe, { strafe: 1 })
    cameraForward = stepShipFlight(cameraForward, { throttle: 1 }, basis)
  }
  assert.ok(reverse.position.z > 0)
  assert.ok(strafe.position.x > 0)
  assert.ok(cameraForward.position.x < 0)
})

test('stabilization damps angular momentum without snapping the orientation', () => {
  let s = createShipFlightState()
  s.angularVelocity = { x: .3, y: -.4, z: 0 }
  for (let i = 0; i < 120; i++) s = stepShipFlight(s, { stabilize: true })
  close(length3(s.angularVelocity), .5 * Math.exp(-4))
  assert.notDeepEqual(s.orientation, createShipFlightState().orientation)
})

test('long combined rotation remains normalized and angular speed stays bounded', () => {
  let s = createShipFlightState()
  for (let i = 0; i < 12000; i++) {
    s = stepShipFlight(s, { pitch: 1, yaw: -1, roll: 1 })
    assert.ok(length3(s.angularVelocity) <= SHIP_FLIGHT.maxAngularSpeed + 1e-12)
  }
  close(Math.hypot(s.orientation.x, s.orientation.y, s.orientation.z, s.orientation.w), 1)
})

test('non-finite controls are neutral and out-of-range controls are clamped', () => {
  const state = createShipFlightState()
  assert.deepEqual(stepShipFlight(state, { throttle: NaN, yaw: Infinity, brake: -1 }), stepShipFlight(state, {}))
  assert.deepEqual(stepShipFlight(state, { throttle: 12, pitch: -12 }), stepShipFlight(state, { throttle: 1, pitch: -1 }))
})

test('quaternion interpolation handles antipodal representations without a flip', () => {
  assert.deepEqual(interpolateShipRotation(
    { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0, w: -1 }, .5
  ), { x: 0, y: 0, z: 0, w: 1 })
})
