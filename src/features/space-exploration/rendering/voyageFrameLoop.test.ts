import assert from 'node:assert/strict'
import test from 'node:test'
import { VoyageFrameLoop, type FrameClock } from './voyageFrameLoop'

class FakeClock implements FrameClock {
  nextId = 1
  queue: Array<{ id: number, callback: (time: number) => void }> = []
  cancelled: number[] = []

  requestAnimationFrame(callback: (time: number) => void) {
    const id = this.nextId++
    this.queue.push({ id, callback })
    return id
  }

  cancelAnimationFrame(handle: number) {
    this.cancelled.push(handle)
    this.queue = this.queue.filter((item) => item.id !== handle)
  }

  flush(time = 16) {
    const batch = this.queue.splice(0)
    batch.forEach((item) => item.callback(time))
  }
}

test('onComplete calling stop does not schedule another frame', () => {
  const clock = new FakeClock()
  const loop = new VoyageFrameLoop(clock)
  let ticks = 0
  loop.start(() => {
    ticks += 1
    loop.stop()
  })
  assert.equal(clock.queue.length, 1)
  clock.flush(16)
  assert.equal(ticks, 1)
  assert.equal(loop.running, false)
  assert.equal(clock.queue.length, 0)
})

test('onComplete calling destroy does not schedule another frame', () => {
  const clock = new FakeClock()
  const loop = new VoyageFrameLoop(clock)
  loop.start(() => loop.destroy())
  clock.flush(16)
  assert.equal(loop.running, false)
  assert.equal(clock.queue.length, 0)
  loop.start(() => undefined)
  assert.equal(clock.queue.length, 0)
})

test('repeated start stop and destroy stay idempotent', () => {
  const clock = new FakeClock()
  const loop = new VoyageFrameLoop(clock)
  loop.start(() => undefined)
  loop.start(() => undefined)
  assert.equal(clock.queue.length, 1)
  loop.stop()
  loop.stop()
  assert.equal(loop.running, false)
  loop.destroy()
  loop.destroy()
  loop.start(() => undefined)
  assert.equal(clock.queue.length, 0)
})

test('stop and restart inside a tick invalidates the old frame generation', () => {
  const clock = new FakeClock()
  const loop = new VoyageFrameLoop(clock)
  loop.start(() => {
    loop.stop()
    loop.start(() => undefined)
  })
  clock.flush(16)
  assert.equal(clock.queue.length, 1)
  loop.destroy()
  assert.equal(clock.queue.length, 0)
})
