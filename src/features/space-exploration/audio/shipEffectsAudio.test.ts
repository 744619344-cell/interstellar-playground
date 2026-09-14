import test from 'node:test'
import assert from 'node:assert/strict'
import { ShipEffectsAudio, type ShipEffectsAudioContext } from './shipEffectsAudio'
import { shipFeedback } from '../domain/shipFeedback'
import { createShipFlightState } from '../domain/shipFlightModel'

class FakeParam {
  value = 0
  targets: number[] = []
  cancelScheduledValues() {}
  setTargetAtTime(value: number) { this.targets.push(value); this.value = value }
}
class FakeNode {
  connections = 0
  disconnects = 0
  connect() { this.connections += 1; return this }
  disconnect() { this.disconnects += 1 }
}
class FakeOscillator extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  starts = 0
  stops = 0
  start() { this.starts += 1 }
  stop() { this.stops += 1 }
}
class FakeGain extends FakeNode { gain = new FakeParam() }
class FakeContext {
  currentTime = 2
  destination = new FakeNode()
  state = 'suspended'
  oscillator = new FakeOscillator()
  gain = new FakeGain()
  resumes = 0
  suspends = 0
  closes = 0
  createOscillator() { return this.oscillator }
  createGain() { return this.gain }
  async resume() { this.resumes += 1; this.state = 'running' }
  async suspend() { this.suspends += 1; this.state = 'suspended' }
  async close() { this.closes += 1; this.state = 'closed' }
}

const asContext = (context: FakeContext) => context as unknown as ShipEffectsAudioContext

test('audio graph is created only by unlock and reused', async () => {
  const context = new FakeContext()
  let creates = 0
  const audio = new ShipEffectsAudio(() => { creates += 1; return asContext(context) })
  audio.setFeedback(shipFeedback({ throttle: 1 }, createShipFlightState()), true)
  assert.equal(creates, 0)
  assert.equal(await audio.unlock(), true)
  assert.equal(await audio.unlock(), true)
  assert.equal(creates, 1)
  assert.equal(context.oscillator.starts, 1)
  assert.equal(context.resumes, 1)
})

test('feedback controls a quiet engine tone and pause requires a new unlock', async () => {
  const context = new FakeContext()
  const audio = new ShipEffectsAudio(() => asContext(context))
  await audio.unlock()
  audio.setFeedback(shipFeedback({ throttle: 1 }, createShipFlightState()), true)
  assert.ok(context.gain.gain.value > 0)
  assert.ok(context.gain.gain.value <= 0.006)
  assert.equal(context.oscillator.type, 'sine')
  assert.ok(context.oscillator.frequency.value > 46)
  audio.setSuspended(true)
  await Promise.resolve()
  assert.equal(context.gain.gain.value, 0)
  assert.equal(context.suspends, 1)
  audio.setSuspended(false)
  audio.setFeedback(shipFeedback({ throttle: 1 }, createShipFlightState()), true)
  assert.equal(context.gain.gain.value, 0)
  await audio.unlock()
  audio.setFeedback(shipFeedback({ throttle: 1 }, createShipFlightState()), true)
  assert.ok(context.gain.gain.value > 0)
  assert.equal(context.resumes, 2)
})

test('destroy stops, disconnects and closes once', async () => {
  const context = new FakeContext()
  const audio = new ShipEffectsAudio(() => asContext(context))
  await audio.unlock()
  audio.destroy()
  audio.destroy()
  await Promise.resolve()
  assert.equal(context.oscillator.stops, 1)
  assert.equal(context.oscillator.disconnects, 1)
  assert.equal(context.gain.disconnects, 1)
  assert.equal(context.closes, 1)
  assert.equal(await audio.unlock(), false)
})
