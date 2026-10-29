import test from 'node:test'
import assert from 'node:assert/strict'
import { Group } from 'three'
import { readShipAsset, shipLoadingLabel, type ShipLoadProgress } from './shipLoadProgress'
import { loadShipSources } from './shipSourceQueue'

const tick = () => new Promise<void>(resolve => setImmediate(resolve))

test('stream progress counts decoded bytes rather than the CDN compressed length', async () => {
  const original = globalThis.fetch, events: Array<[number, string]> = []
  globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(new Uint8Array([1, 2])); controller.enqueue(new Uint8Array([3, 4, 5])); controller.close()
  } }), { headers: { 'Content-Length': '2' } })
  try {
    const buffer = await readShipAsset('https://example.invalid/ship.glb', new AbortController().signal,
      (bytes, phase) => events.push([bytes, phase]))
    assert.deepEqual([...new Uint8Array(buffer)], [1, 2, 3, 4, 5])
    assert.deepEqual(events, [[0, 'download'], [2, 'download'], [5, 'download'], [5, 'parse']])
  } finally { globalThis.fetch = original }
})

test('cancelling a stalled stream releases its reader and stops waiting', async () => {
  const original = globalThis.fetch, aborter = new AbortController(); let cancelled = 0
  globalThis.fetch = async () => new Response(new ReadableStream({ cancel() { cancelled++ } }))
  try {
    const pending = readShipAsset('https://example.invalid/ship.glb', aborter.signal, () => {})
    const rejected = assert.rejects(pending, { name: 'AbortError' })
    await tick(); aborter.abort(); await rejected; assert.equal(cancelled, 1)
  } finally { globalThis.fetch = original }
})

test('one failed parallel source aborts siblings and waits to release late parse results once', async () => {
  let deliver!: (asset: { scene: Group }) => void, sibling: AbortSignal | undefined, calls = 0, releases = 0
  const late = new Group()
  const pending = loadShipSources([0, 1, 2, 3].map(id => ({ id: String(id), url: String(id), bytes: 10 })),
    new AbortController().signal, async (url, signal) => {
      calls++
      if (url === '0') { await tick(); throw Error('connection failed') }
      sibling = signal
      return new Promise(resolve => { deliver = resolve })
    }, owner => { releases++; assert.deepEqual(owner.children, [late]) })
  const rejected = assert.rejects(pending, /connection failed/)
  await tick(); await tick()
  assert.equal(sibling?.aborted, true); assert.equal(calls, 2); assert.equal(releases, 0)
  deliver({ scene: late }); await rejected; assert.equal(releases, 1)
})

test('loading labels distinguish network transfer, parsing and final assembly', () => {
  const progress: ShipLoadProgress = { loadedBytes: 32e6, totalBytes: 130e6, completed: 4, total: 10,
    phase: 'download', asset: '宇航员' }
  assert.match(shipLoadingLabel(progress), /32\.0 \/ 130\.0 MB/)
  assert.match(shipLoadingLabel({ ...progress, phase: 'parse' }), /解析宇航员/)
  assert.match(shipLoadingLabel({ ...progress, phase: 'assembly' }), /装配/)
})
