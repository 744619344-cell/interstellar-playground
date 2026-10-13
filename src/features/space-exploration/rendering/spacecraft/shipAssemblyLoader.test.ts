import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { loadShipAssembly } from './shipAssemblyLoader'
import { installShipCeilingRepair } from './shipCeilingRepair'
import { disposeShipModel, ShipModelRuntime, shipModelRadius } from './shipModelRuntime'
import { ShipVisibility } from './shipVisibility'

async function actual(url: string) {
  const filename = url.slice(url.lastIndexOf('/') + 1)
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'geometry_only_test' } })
  const bytes = await readFile(new URL('../../../../assets/models/' + filename, import.meta.url))
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')
}

function fixture() {
  const scene = new Group(), adapted = new Group(), mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  adapted.name = 'Ship_Adapted'; mesh.userData.module = 'cockpit-ceiling'; adapted.add(mesh); scene.add(adapted)
  return { scene, animations: [], mesh }
}

test('actual ceiling repair installs into frozen assembly, preserves radius, anchors and door clips, and releases once', async () => {
  let radius = 0
  const requests: string[] = []
  const asset = await loadShipAssembly(new AbortController().signal, disposeShipModel, async (url, _signal) => {
    requests.push(url); const gltf = await actual(url)
    if (requests.length === 1) radius = shipModelRadius(gltf.scene)
    return gltf
  })
  assert.equal(requests.length, 3); assert(requests[1].endsWith('spacecraft-ceiling-repair.glb'))
  assert(requests[2].endsWith('spacecraft-floor-repair.glb')); assert.equal(asset.scene.userData.floorsRepaired, true)
  assert.equal(asset.scene.userData.ceilingRepaired, true)
  assert.equal(shipModelRadius(asset.scene), radius)
  assert.deepEqual(asset.animations.map(a => a.name), ['InnerDoorOpen', 'InnerDoorClose', 'OuterDoorOpen', 'OuterDoorClose', 'ConsoleActive'])
  const roofs: Mesh[] = []
  asset.scene.traverse(o => { if (o instanceof Mesh && o.userData.module === 'cockpit-ceiling') roofs.push(o) })
  assert.equal(roofs.length, 2)
  const original = roofs.find(o => o.userData.supersededByAtlas)!, replacement = roofs.find(o => !o.userData.supersededByAtlas)!
  assert.deepEqual(replacement.matrix.elements, original.matrix.elements)
  const counts = { geometry: 0, material: 0, texture: 0 }
  replacement.geometry.addEventListener('dispose', () => counts.geometry++)
  const material = replacement.material as MeshStandardMaterial
  material.addEventListener('dispose', () => counts.material++)
  material.map!.addEventListener('dispose', () => counts.texture++)
  const runtime = new ShipModelRuntime(() => {}, async () => asset)
  await new Promise(done => setImmediate(done))
  assert.equal(runtime.snapshot().status, 'ready'); assert.equal(runtime.snapshot().anchors.length, 7)
  const visibility = new ShipVisibility(asset.scene)
  visibility.apply({ view: 'cockpit', innerOpen: false, outerOpen: false })
  assert.equal(original.visible, false); assert.equal(replacement.visible, true)
  runtime.dispose()
  assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1 })
})

test('optional repair fetch failure returns the visible original instead of failing the whole ship', async () => {
  const original = fixture(); let calls = 0
  const result = await loadShipAssembly(new AbortController().signal, disposeShipModel, async () => {
    if (calls++) throw Error('404')
    return original
  })
  assert.equal(result, original); assert(original.mesh.visible)
  assert.equal(original.scene.userData.ceilingRepairFailed, true)
  disposeShipModel(original.scene)
})

test('mismatched repair surface is rejected before hiding the original and is released', async () => {
  const original = fixture(), repair = fixture(); let calls = 0, released = 0
  repair.mesh.geometry.getAttribute('position').setX(0, 8)
  repair.mesh.geometry.addEventListener('dispose', () => released++)
  await loadShipAssembly(new AbortController().signal, disposeShipModel, async () => {
    if (calls++ === 0) return original
    if (calls === 2) return repair
    throw Error('floor unavailable')
  })
  assert(original.mesh.visible); assert.equal(released, 1); assert.equal(original.scene.userData.ceilingRepairFailed, true)
  assert.equal(original.mesh.parent!.children.length, 1)
  disposeShipModel(original.scene)
})

test('late repair after cancellation releases both assets and never falls back to a ready scene', async () => {
  const original = fixture(), repair = fixture(), aborter = new AbortController()
  const released: Group[] = []; let calls = 0
  await assert.rejects(loadShipAssembly(aborter.signal, scene => { released.push(scene); disposeShipModel(scene) }, async () => {
    if (!calls++) return original
    aborter.abort(); return repair
  }), { name: 'AbortError' })
  assert.deepEqual(released, [repair.scene, original.scene]); assert(original.mesh.visible)
})

test('cancelled main parse is released before starting an optional repair', async () => {
  const original = fixture(), aborter = new AbortController(); let calls = 0, released = 0
  await assert.rejects(loadShipAssembly(aborter.signal, () => { released++; disposeShipModel(original.scene) }, async () => {
    calls++; aborter.abort(); return original
  }), { name: 'AbortError' })
  assert.equal(calls, 1); assert.equal(released, 1)
})

test('repeated repair installation is rejected without transferring a second mesh', () => {
  const original = fixture(), first = fixture(), second = fixture()
  assert(installShipCeilingRepair(original.scene, first.scene))
  assert.equal(installShipCeilingRepair(original.scene, second.scene), false)
  assert.equal(second.mesh.parent!.name, 'Ship_Adapted')
  disposeShipModel(original.scene); disposeShipModel(first.scene); disposeShipModel(second.scene)
})
