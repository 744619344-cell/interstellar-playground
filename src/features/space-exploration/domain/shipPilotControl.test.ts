import test from 'node:test'
import assert from 'node:assert/strict'
import { createShipFlightState } from './shipFlightModel'
import { stepNavigatedShip } from './shipFlightSafety'

test('released controls settle rotation and translation to zero', () => {
  let state = createShipFlightState()
  state.velocity = { x: 2, y: 1, z: -5 }
  state.angularVelocity = { x: 0.8, y: -0.8, z: 0.8 }
  for (let i = 0; i < 120; i++) state = stepNavigatedShip(state, {}, [], undefined, false).state
  assert.deepEqual(state.angularVelocity, { x: 0, y: 0, z: 0 })
  assert.deepEqual(state.velocity, { x: 0, y: 0, z: -0 })
  const orientation = state.orientation
  for (let i = 0; i < 120; i++) state = stepNavigatedShip(state, {}, [], undefined, false).state
  assert.deepEqual(state.orientation, orientation)
})

test('holding one turn axis does not prevent the released axes from settling', () => {
  let state = createShipFlightState()
  state.angularVelocity = { x: 0.2, y: 0.2, z: 0.2 }
  for (let i = 0; i < 120; i++) state = stepNavigatedShip(state, { yaw: 1 }, [], undefined, false).state
  assert.equal(state.angularVelocity.x, 0); assert.equal(state.angularVelocity.z, 0)
  assert.ok(state.angularVelocity.y > 0.7)
})
