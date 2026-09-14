import assert from 'node:assert/strict'
import test from 'node:test'
import { VoyageRunController } from './voyageRunController'

class FakeRunner {
  starts = 0
  stops = 0
  clears = 0
  inputEnabled: boolean[] = []
  start() { this.starts += 1 }
  stop() { this.stops += 1 }
  clearInput() { this.clears += 1 }
  setInputEnabled(enabled: boolean) { this.inputEnabled.push(enabled) }
}

test('initial hidden state does not start the loop', () => {
  const runner = new FakeRunner()
  const controller = new VoyageRunController(runner)
  controller.mount(true)
  assert.equal(runner.starts, 0)
  assert.equal(controller.getSnapshot().running, false)
  controller.setHidden(false)
  assert.equal(runner.starts, 1)
})

test('user pause survives hide and show', () => {
  const runner = new FakeRunner()
  const controller = new VoyageRunController(runner)
  controller.mount(false)
  assert.equal(runner.starts, 1)
  controller.setUserPaused(true)
  assert.equal(runner.stops, 1)
  controller.setHidden(true)
  controller.setHidden(false)
  assert.equal(runner.starts, 1)
  assert.equal(controller.getSnapshot().running, false)
  controller.setUserPaused(false)
  assert.equal(runner.starts, 2)
})

test('saturn overlay pause survives hide and show', () => {
  const runner = new FakeRunner()
  const controller = new VoyageRunController(runner)
  controller.mount(false)
  controller.setOverlayPaused(true)
  assert.equal(runner.stops, 1)
  assert.ok(runner.clears >= 1)
  controller.setHidden(true)
  controller.setHidden(false)
  assert.equal(controller.getSnapshot().running, false)
  assert.equal(runner.starts, 1)
})

test('closing overlay while user is still paused keeps the loop stopped', () => {
  const runner = new FakeRunner()
  const controller = new VoyageRunController(runner)
  controller.mount(false)
  controller.setUserPaused(true)
  controller.setOverlayPaused(true)
  controller.setOverlayPaused(false)
  assert.equal(controller.getSnapshot().running, false)
  assert.equal(runner.starts, 1)
})

test('hide and overlay clear input so restore does not keep thrusting', () => {
  const runner = new FakeRunner()
  const controller = new VoyageRunController(runner)
  controller.mount(false)
  const clearsAfterStart = runner.clears
  controller.setHidden(true)
  assert.ok(runner.clears > clearsAfterStart)
  controller.setHidden(false)
  controller.setOverlayPaused(true)
  assert.ok(runner.clears > clearsAfterStart + 1)
  assert.equal(runner.inputEnabled.at(-1), false)
})

test('every pause reason disables input until all reasons are cleared', () => {
  const runner = new FakeRunner()
  const controller = new VoyageRunController(runner)
  controller.mount(false)
  assert.equal(runner.inputEnabled.at(-1), true)
  controller.setUserPaused(true)
  assert.equal(runner.inputEnabled.at(-1), false)
  controller.setOverlayPaused(true)
  controller.setUserPaused(false)
  assert.equal(runner.inputEnabled.at(-1), false)
  controller.setOverlayPaused(false)
  assert.equal(runner.inputEnabled.at(-1), true)
})

test('destroy is idempotent and leaves the runner stopped', () => {
  const runner = new FakeRunner()
  const controller = new VoyageRunController(runner)
  controller.mount(false)
  controller.destroy()
  controller.destroy()
  controller.setHidden(false)
  controller.setUserPaused(false)
  controller.setOverlayPaused(false)
  assert.equal(runner.starts, 1)
  assert.equal(controller.getSnapshot().destroyed, true)
})
