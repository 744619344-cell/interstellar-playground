import test from 'node:test'
import assert from 'node:assert/strict'
import { createShipFlightState } from './shipFlightModel'
import { shipFeedback } from './shipFeedback'

test('forward, reverse and lateral commands share one directional feedback model', () => {
  const state = createShipFlightState()
  assert.equal(shipFeedback({ throttle: 1 }, state).thrustLabel, '前进推进')
  assert.equal(shipFeedback({ throttle: -1 }, state).thrustLabel, '倒车推进')
  assert.equal(shipFeedback({ strafe: -1 }, state).thrustLabel, '向左横移')
  assert.equal(shipFeedback({ strafe: 1 }, state).thrustLabel, '向右横移')
  assert.equal(shipFeedback({}, state).thrustLabel, '待机')
})

test('release braking fades to idle when the ship stops', () => {
  const moving = createShipFlightState()
  moving.velocity.z = -4
  const braking = shipFeedback({}, moving)
  assert.equal(braking.thrustLabel, '制动')
  assert.equal(braking.braking, 1)
  assert.ok(braking.audioLevel > 0)
  assert.equal(shipFeedback({}, createShipFlightState()).audioLevel, 0)
})

test('attitude and paused feedback are stable and isolated', () => {
  const state = createShipFlightState()
  state.angularVelocity.y = 0.2
  assert.equal(shipFeedback({}, state).attitudeLabel, '姿态调整中')
  const paused = shipFeedback({ throttle: 1 }, state, false)
  assert.deepEqual(paused, shipFeedback({}, createShipFlightState(), false))
  paused.forward = 1
  assert.equal(shipFeedback({}, createShipFlightState(), false).forward, 0)
})

