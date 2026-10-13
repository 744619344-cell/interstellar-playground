import test from 'node:test'
import assert from 'node:assert/strict'
import { Group } from 'three'
import { distantExterior, ShipExteriorDetail } from './shipExteriorDetail'

test('exterior distance hysteresis never substitutes a cockpit or open-door assembly', () => {
  assert(distantExterior(24, false, false, false))
  assert(distantExterior(20, true, false, false))
  assert(!distantExterior(20, false, false, false))
  assert(!distantExterior(18, true, false, false))
  assert(!distantExterior(60, true, true, false))
  assert(!distantExterior(60, true, false, true))
  assert(!distantExterior(Infinity, true, false, false))
})

test('late exterior loads release once after exit and a loaded detail disposes idempotently', async () => {
  let deliver!: (model: Group) => void, releases = 0, request: AbortSignal | undefined
  const pending = new ShipExteriorDetail(() => releases++, signal => {
    request = signal; return new Promise(resolve => { deliver = resolve })
  })
  assert(!pending.apply(50, false, false))
  pending.dispose(); assert(request?.aborted)
  deliver(new Group()); await new Promise(done => setImmediate(done))
  assert.equal(releases, 1); assert(!pending.apply(50, false, false))
  const ready = new ShipExteriorDetail(() => releases++, async () => new Group())
  assert(!ready.apply(50, false, false))
  await new Promise(done => setImmediate(done))
  assert(ready.apply(50, false, false)); assert(ready.snapshot())
  assert(!ready.apply(50, false, true))
  ready.dispose(); ready.dispose(); assert.equal(releases, 2)
})

test('exterior requests only on demand, cancels obsolete loads and releases when returning near', async () => {
  const requests: { signal: AbortSignal; deliver: (model: Group) => void }[] = []
  const released: Group[] = []
  const detail = new ShipExteriorDetail(model => released.push(model), signal =>
    new Promise(deliver => requests.push({ signal, deliver })))
  assert.equal(requests.length, 0)
  for (const [distance, cockpit, door] of [[50, true, false], [50, false, true], [20, false, false]] as const)
    assert(!detail.apply(distance, cockpit, door))
  assert.equal(requests.length, 0)
  detail.apply(30, false, false); assert.equal(requests.length, 1)
  detail.apply(30, true, false); assert(requests[0].signal.aborted)
  detail.apply(30, false, false); assert.equal(requests.length, 2)
  const obsolete = new Group(), current = new Group()
  requests[0].deliver(obsolete); requests[1].deliver(current)
  await new Promise(done => setImmediate(done))
  assert.deepEqual(released, [obsolete]); assert(detail.apply(20, false, false))
  assert(detail.root.children.includes(current))
  assert(!detail.apply(18, false, false)); assert(requests[1].signal.aborted)
  assert.deepEqual(released, [obsolete, current]); assert.equal(detail.root.children.length, 0)
  detail.dispose(); assert.equal(released.length, 2)
})

test('obsolete rejection cannot remove a replacement and active failure retries only after leaving its range', async () => {
  let rejectOld!: (error: Error) => void, loads = 0, releases = 0
  const detail = new ShipExteriorDetail(() => releases++, () => {
    loads++
    if (loads === 1) return new Promise<Group>((_, reject) => { rejectOld = reject })
    return Promise.resolve(new Group())
  })
  detail.apply(30, false, false); detail.apply(30, false, true); detail.apply(30, false, false)
  await new Promise(done => setImmediate(done))
  rejectOld(new Error('obsolete')); await new Promise(done => setImmediate(done))
  assert(detail.apply(30, false, false)); assert.equal(loads, 2)
  assert(!detail.apply(30, false, false, true)); assert.equal(releases, 1); detail.dispose()
  let failures = 0
  const failed = new ShipExteriorDetail(() => {}, async () => { failures++; throw new Error('offline') })
  failed.apply(30, false, false); await new Promise(done => setImmediate(done))
  for (let i = 0; i < 30; i++) assert(!failed.apply(30, false, false))
  assert.equal(failures, 1)
  failed.apply(18, false, false); failed.apply(30, false, false)
  await new Promise(done => setImmediate(done)); assert.equal(failures, 2); failed.dispose()
})
