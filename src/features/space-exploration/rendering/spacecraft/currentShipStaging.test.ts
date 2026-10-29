import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Mesh, Texture, Group, type BufferGeometry } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { loadCurrentShipAssembly } from './currentShipAssembly'
import { disposeShipModel, ShipModelRuntime } from './shipModelRuntime'
import { SHIP_MODEL_ASSETS } from './shipModelAssets'

const tick = () => new Promise<void>(resolve => setImmediate(resolve))
async function parseReal(url: string) {
  const data = await readFile(new URL(url)), loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'geometry_only_test' } })
  return loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, '')
}
function watchGeometry(scene: Group) {
  const geometries = new Map<BufferGeometry, number>()
  scene.traverse(o => { if (o instanceof Mesh) geometries.set(o.geometry, 0) })
  geometries.forEach((_count, geometry) => geometry.addEventListener('dispose', () => geometries.set(geometry, geometries.get(geometry)! + 1)))
  return geometries
}

for (const cancel of [false, true]) test(`real hull appears before a blocked crew download; ${cancel ? 'cancel releases the loan once' : 'full assembly takes ownership once'}`, async () => {
  let unblock!: () => void, crewRequested = false, hull: Group | undefined
  let watched = new Map<BufferGeometry, number>(), finished = false
  const crewGate = new Promise<void>(resolve => { unblock = resolve })
  const requests: string[] = []
  const runtime = new ShipModelRuntime(() => {}, (signal, observe, preview) => loadCurrentShipAssembly(signal,
    disposeShipModel, async url => {
      requests.push(url)
      if (url === SHIP_MODEL_ASSETS.crew) { crewRequested = true; await crewGate }
      const asset = await parseReal(url)
      if (url === SHIP_MODEL_ASSETS.assembly) { hull = asset.scene; watched = watchGeometry(hull) }
      return asset
    }, observe, preview).finally(() => { finished = true }))
  try {
    while (!crewRequested) await tick()
    const partial = runtime.snapshot()
    assert.equal(requests[0], SHIP_MODEL_ASSETS.assembly)
    assert.equal(partial.status, 'loading'); assert.equal(partial.previewReady, true)
    assert.equal(runtime.root.children.includes(hull!), true)
    assert.equal(hull!.getObjectByName('ExistingAstronautInPilotSeat'), undefined)
    assert([...watched.values()].every(n => n === 0))
    if (cancel) { runtime.dispose(); assert([...watched.values()].every(n => n === 0)) }
    unblock(); while (!finished) await tick(); await tick()
    if (!cancel) {
      assert.equal(runtime.snapshot().status, 'ready'); assert.equal(runtime.snapshot().previewReady, false)
      assert(hull!.getObjectByName('ExistingAstronautInPilotSeat'))
      assert([...watched.values()].every(n => n === 0)); runtime.dispose()
    }
    assert([...watched.values()].every(n => n === 1)); assert.equal(runtime.root.children.length, 0)
  } finally { unblock(); runtime.dispose() }
})

test('background failure withdraws the borrowed hull before its resources are released', async () => {
  let hull: Group | undefined, finished = false, watched = new Map<BufferGeometry, number>()
  const runtime = new ShipModelRuntime(() => {}, (signal, observe, preview) => loadCurrentShipAssembly(signal,
    scene => { assert.equal(runtime.root.children.includes(hull!), false); disposeShipModel(scene) }, async url => {
      if (url !== SHIP_MODEL_ASSETS.assembly) throw Error('offline interior')
      const asset = await parseReal(url); hull = asset.scene; watched = watchGeometry(hull); return asset
    }, observe, preview).finally(() => { finished = true }))
  try {
    while (!finished) await tick(); await tick()
    assert.equal(runtime.snapshot().status, 'failed'); assert.equal(runtime.snapshot().previewReady, false)
    assert([...watched.values()].every(n => n === 1)); assert.equal(runtime.root.children.length, 0)
  } finally { runtime.dispose() }
})

test('timeout removes a borrowed preview and late background results cannot restore it', async () => {
  const hull = await parseReal(SHIP_MODEL_ASSETS.assembly), watched = watchGeometry(hull.scene)
  const pending: ((asset: { scene: Group; animations: [] }) => void)[] = []
  let finished = false
  const runtime = new ShipModelRuntime(() => {}, (signal, observe, preview) => loadCurrentShipAssembly(signal,
    disposeShipModel, async url => url === SHIP_MODEL_ASSETS.assembly ? hull
      : new Promise(resolve => pending.push(resolve)), observe, preview).finally(() => { finished = true }), 20)
  try {
    while (pending.length < 2) await tick()
    assert.equal(runtime.snapshot().previewReady, true)
    await new Promise(resolve => setTimeout(resolve, 60))
    assert.equal(runtime.snapshot().status, 'failed'); assert.equal(runtime.snapshot().previewReady, false)
    assert.equal(runtime.root.children.length, 0)
    pending.forEach(resolve => resolve({ scene: new Group(), animations: [] }))
    while (!finished) await tick(); await tick()
    assert([...watched.values()].every(n => n === 1)); assert.equal(runtime.snapshot().status, 'failed')
  } finally { pending.forEach(resolve => resolve({ scene: new Group(), animations: [] })); runtime.dispose() }
})
