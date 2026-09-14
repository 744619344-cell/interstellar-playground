import test from 'node:test'
import assert from 'node:assert/strict'
import { ShipPreviewInput } from './shipPreviewInput'

test('preview input combines controls, cancels opposite axes and clears all held keys', () => {
  const input = new ShipPreviewInput()
  for (const code of ['KeyW', 'KeyA', 'KeyD', 'ArrowUp', 'Space']) assert.ok(input.key(code, true))
  assert.deepEqual(input.snapshot(), { throttle: 2, strafe: 0, brake: 0, yaw: 0, pitch: 0, roll: 0, stabilize: true })
  input.key('KeyA', false)
  assert.equal(input.snapshot().strafe, 1)
  assert.equal(input.key('KeyQ', true), false)
  input.clear()
  assert.deepEqual(input.snapshot(), { throttle: 0, strafe: 0, brake: 0, yaw: 0, pitch: 0, roll: 0, stabilize: false })
})

test('WASD and arrow keys map to direct forward, reverse and lateral movement', () => {
  const input = new ShipPreviewInput()
  input.key('KeyS', true); input.key('KeyA', true)
  assert.equal(input.snapshot().throttle, -1)
  assert.equal(input.snapshot().strafe, -1)
  input.key('KeyS', false); input.key('KeyA', false)
  input.key('ArrowDown', true); input.key('ArrowRight', true)
  assert.equal(input.snapshot().throttle, -1)
  assert.equal(input.snapshot().strafe, 1)
})
