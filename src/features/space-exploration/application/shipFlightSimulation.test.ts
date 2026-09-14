import assert from 'node:assert/strict'
import test from 'node:test'
import { ShipFlightSimulation, type ShipPauseReason } from './shipFlightSimulation'
import { SHIP_FLIGHT, type ShipFlightInput } from '../domain/shipFlightModel'
import { length3 } from '../domain/vec3'

function run(frames: number[]) {
  const sim = new ShipFlightSimulation()
  const phases: Partial<ShipFlightInput>[] = [
    { throttle: 1, yaw: .3, pitch: -.2, roll: .1 }, {}, { stabilize: true }, { brake: 1 }
  ]
  for (const command of phases) {
    sim.setInput(command)
    for (const dt of frames) sim.advance(dt)
  }
  return sim.snapshot()
}

test('30/60/120 FPS and jittered frames yield identical thrust, turn, coast and brake states', () => {
  const expected = run(Array(240).fill(1 / 120))
  for (const frames of [Array(60).fill(1 / 30), Array(120).fill(1 / 60), Array(40).fill([.01, .017, .023]).flat()]) {
    const actual = run(frames)
    assert.equal(actual.steps, 960)
    assert.deepEqual(actual.state, expected.state)
    assert.equal(actual.droppedSeconds, 0)
  }
})

test('sub-step frames accumulate, and interpolation stays between previous/current states', () => {
  const sim = new ShipFlightSimulation()
  sim.setInput({ throttle: 1 })
  assert.equal(sim.advance(SHIP_FLIGHT.stepSeconds / 2).steps, 0)
  const snap = sim.advance(SHIP_FLIGHT.stepSeconds)
  assert.equal(snap.steps, 1)
  assert.ok(Math.abs(snap.alpha - .5) < 1e-10)
  assert.ok(snap.renderPose.position.z < snap.previous.position.z)
  assert.ok(snap.renderPose.position.z > snap.state.position.z)
})

test('a large elapsed time is bounded and discarded time is reported without later catch-up', () => {
  const sim = new ShipFlightSimulation()
  sim.setInput({ throttle: 1 })
  const snap = sim.advance(30)
  assert.equal(snap.steps, 30)
  assert.equal(snap.droppedSeconds, 29.75)
  assert.equal(sim.advance(1 / 120).steps, 31)
})

test('invalid and negative elapsed times cannot change the simulation', () => {
  const sim = new ShipFlightSimulation()
  sim.setInput({ throttle: 1 })
  const before = sim.snapshot()
  for (const dt of [NaN, Infinity, -1, 0]) assert.deepEqual(sim.advance(dt), before)
})

for (const reason of ['user', 'hidden', 'blur', 'overlay'] as ShipPauseReason[]) {
  test(`${reason} freezes the ship and clears old controls and fractional time`, () => {
    const sim = new ShipFlightSimulation()
    sim.setInput({ throttle: 1, pitch: .5 })
    sim.advance(.1 + SHIP_FLIGHT.stepSeconds / 2)
    sim.setPaused(reason, true)
    const before = sim.snapshot()
    sim.setInput({ throttle: 1, yaw: 1 })
    assert.deepEqual(sim.advance(100), before)
    sim.setPaused(reason, false)
    const after = sim.advance(SHIP_FLIGHT.stepSeconds / 2)
    assert.equal(after.steps, before.steps)
    sim.advance(SHIP_FLIGHT.stepSeconds / 2)
    assert.ok(length3(sim.snapshot().state.velocity) < length3(before.state.velocity))
    assert.deepEqual(sim.snapshot().state.angularVelocity, before.state.angularVelocity)
  })
}

test('one pause reason cannot resume another, and repeated lifecycle operations are safe', () => {
  const sim = new ShipFlightSimulation()
  sim.setPaused('user', true)
  sim.setPaused('hidden', true)
  sim.setPaused('hidden', false)
  assert.equal(sim.advance(1).steps, 0)
  assert.equal(sim.snapshot().paused, true)
  sim.setPaused('user', false)
  assert.equal(sim.advance(1 / 120).steps, 1)
  sim.destroy()
  const destroyed = sim.snapshot()
  sim.destroy()
  sim.setInput({ throttle: 1 })
  sim.setPaused('user', false)
  assert.deepEqual(sim.advance(10), destroyed)
})

test('snapshots and caller input cannot mutate the internal state', () => {
  const sim = new ShipFlightSimulation()
  const input = { throttle: 1 }
  sim.setInput(input)
  input.throttle = 0
  const snap = sim.advance(1 / 120)
  assert.ok(snap.state.velocity.z < 0)
  snap.state.position.x = 999
  snap.state.orientation.w = 0
  snap.previous.velocity.z = 999
  snap.renderPose.position.y = 999
  const again = sim.snapshot()
  assert.equal(again.state.position.x, 0)
  assert.equal(again.state.orientation.w, 1)
  assert.equal(again.previous.velocity.z, 0)
  assert.equal(again.renderPose.position.y, 0)
})
