import test from 'node:test'
import assert from 'node:assert/strict'
import { assistedShipInput, shipTargetInfo, type ShipNavigationBody } from './shipNavigation'
import { createShipFlightState, SHIP_FLIGHT, stepShipFlight } from './shipFlightModel'
import { constrainShipFlight, shipBrakingRisk, stepNavigatedShip } from './shipFlightSafety'
import { distance3 } from './vec3'
import { ShipFlightSimulation } from '../application/shipFlightSimulation'

const body = (x = 0, y = 0, z = -50): ShipNavigationBody => ({ id: 'earth', center: { x, y, z }, radius: 2, velocity: { x: 0, y: 0, z: 0 } })

test('target cues use ship local axes and missing target clears assistance', () => {
  const state = createShipFlightState()
  assert.ok(shipTargetInfo(state, body(-20, 10))!.yaw > 0)
  assert.ok(shipTargetInfo(state, body(-20, 10))!.pitch > 0)
  assert.ok(shipTargetInfo(state, body(20, -10))!.yaw < 0)
  assert.ok(shipTargetInfo(state, body(20, -10))!.pitch < 0)
  assert.equal(shipTargetInfo(state), undefined)
  assert.equal(assistedShipInput(state, {}, undefined, true).yaw, 0)
})
test('manual axes, brake, roll and stabilizer take precedence; assistance never applies thrust', () => {
  const state = createShipFlightState()
  const input = { yaw: -0.4, pitch: -0.3, roll: 0.6, brake: 0.8 }
  const assisted = assistedShipInput(state, input, body(-20, 10), true)
  assert.equal(assisted.yaw, input.yaw); assert.equal(assisted.pitch, input.pitch)
  assert.equal(assisted.roll, input.roll); assert.equal(assisted.brake, input.brake)
  assert.equal(assisted.throttle, 0)
  assert.equal(assistedShipInput(state, { stabilize: true }, body(-20, 10), true).yaw, 0)
  assert.equal(assistedShipInput(state, {}, body(-20, 10), false).yaw, 0)
})
test('assistance converges to front, side, behind and above targets without moving the ship', () => {
  for (const target of [body(), body(50, 0, 0), body(0, 0, 50), body(0, 50, 0)]) {
    let state = createShipFlightState()
    for (let i = 0; i < 2400; i++) state = stepShipFlight(state, assistedShipInput(state, {}, target, true))
    assert.ok(shipTargetInfo(state, target)!.angleDegrees < 1, JSON.stringify(shipTargetInfo(state, target)))
    assert.deepEqual(state.position, { x: 0, y: 0, z: 0 })
  }
})
test('braking considers closing velocity and misses trajectories outside protection sphere', () => {
  const state = createShipFlightState(); state.velocity.z = -40
  assert.ok(shipBrakingRisk(state, [body()]))
  assert.equal(shipBrakingRisk(state, [body(30)]), undefined)
  state.velocity.z = 40
  assert.equal(shipBrakingRisk(state, [body()]), undefined)
})
test('safety stops a sustained full-throttle approach before protected surface', () => {
  let state = createShipFlightState()
  const target = body()
  let braking = false
  for (let i = 0; i < 2400; i++) {
    const step = stepNavigatedShip(state, { throttle: 1 }, [target], undefined, false)
    state = step.state; braking ||= !!step.risk
    assert.ok(distance3(state.position, target.center) >= 10 - 1e-9)
  }
  assert.ok(braking)
  assert.ok(Math.abs(state.velocity.z) < 0.2)
})
test('swept protection catches a crossing with both endpoints outside', () => {
  const start = createShipFlightState(); start.position.z = 20; start.velocity.z = -80
  const desired = structuredClone(start); desired.position.z = -20
  const result = constrainShipFlight(start, desired, [body(0, 0, 0)])
  assert.equal(result.contact, 'earth')
  assert.ok(result.state.position.z > 10)
  assert.equal(result.state.velocity.z, 0)
})
test('moving sphere crossing stationary ship resolves to the arrival side with relative velocity', () => {
  const start = createShipFlightState()
  const moving = body(0, 0, 20); moving.velocity.z = -4800
  const result = constrainShipFlight(start, start, [moving])
  assert.equal(result.contact, 'earth')
  const end = { x: 0, y: 0, z: -20 }
  assert.ok(distance3(result.state.position, end) > 10)
  assert.ok(result.state.position.z < end.z)
  assert.equal(result.state.velocity.z, -4800)
})
test('center overlap has finite recovery, tangential velocity survives and input objects remain unchanged', () => {
  const start = createShipFlightState(); start.velocity.x = 2
  const original = structuredClone(start)
  const result = constrainShipFlight(start, start, [body(0, 0, 0)])
  assert.ok(result.state.position.y > 10)
  assert.equal(result.state.velocity.x, 2)
  assert.deepEqual(start, original)
})
test('protection is independent of chosen target and malformed bodies are ignored', () => {
  const state = createShipFlightState(); state.velocity.z = -40
  const result = stepNavigatedShip(state, { throttle: 1 }, [body()], 'saturn', false)
  assert.ok(result.risk)
  const invalid = { ...body(), radius: NaN }
  assert.deepEqual(stepNavigatedShip(state, {}, [invalid], undefined, false).state, stepShipFlight(state, {}))
})

test('recovery leaves all overlapping protection envelopes, not just the first contact', () => {
  const start = createShipFlightState()
  const bodies = [body(-5, 0, 0), { ...body(5, 0, 0), id: 'moon' }]
  const result = constrainShipFlight(start, start, bodies)
  for (const b of bodies) assert.ok(distance3(result.state.position, b.center) >= 10)
})
test('fixed-step navigation and safety give identical 30/60/120 FPS and jitter results', () => {
  const execute = (frames: number[]) => {
    const sim = new ShipFlightSimulation(); sim.setInput({ throttle: 1 })
    for (const dt of frames) sim.advance(dt, (s, input) => stepNavigatedShip(s, input, [body()], 'earth', true).state)
    return sim.snapshot().state
  }
  const expected = execute(Array(1200).fill(SHIP_FLIGHT.stepSeconds))
  for (const frames of [Array(300).fill(1 / 30), Array(600).fill(1 / 60), Array(200).fill([.01, .017, .023]).flat()]) {
    assert.deepEqual(execute(frames), expected)
  }
})
test('pause and destroy never execute the navigation stepper', () => {
  const sim = new ShipFlightSimulation()
  const fail = () => { throw new Error('navigation advanced while paused') }
  sim.setPaused('overlay', true); sim.advance(1, fail)
  sim.setPaused('overlay', false); sim.destroy(); sim.advance(1, fail)
})
