import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Mesh, Texture, Quaternion, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { ShipModelRuntime } from './shipModelRuntime'
import { ShipCabinCamera } from './shipCabinCamera'
import { ShipVisibility } from './shipVisibility'
import { createShipInteraction, activateShipInteraction, selectShipInteraction, stepShipInteraction } from '../../domain/shipInteraction'

async function load() {
  const bytes = await readFile(new URL('../../../../assets/models/spacecraft-master-lod0.glb', import.meta.url))
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'geometry_only_test' } })
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength) as ArrayBuffer, '')
}
const tick = () => new Promise<void>(done => setImmediate(done))

test('actual master installs without legacy fit, releases once, and keeps its real passage usable', async () => {
  const first = await load(), second = await load(); let calls = 0, standing: { x: number; y: number; z: number } | undefined
  const runtime = new ShipModelRuntime((_, pitch, anchor) => { assert.equal(pitch, -.13); standing = anchor }, async () => calls++ ? second : first)
  await tick(); assert.equal(runtime.snapshot().status, 'ready'); assert.equal(runtime.snapshot().anchors.length, 7)
  assert.equal(first.scene.userData.interiorFitted, undefined)
  assert.equal(first.scene.getObjectByName('ShipPressureBoundaries'), undefined)
  assert(standing); const camera = new ShipCabinCamera(); camera.setSeat(standing)
  camera.setVolume(runtime.cabinVolume()); camera.setObstacles(runtime.cabinObstacles())
  for (let i = 0; i < 6; i++) camera.move(-1, 0, 0, 0, false)
  assert(camera.snapshot().z > 3, 'the observer must move past the actual assembled furniture')
  camera.move(-1, 0, 0, 0, true); camera.move(-1, 0, 0, 0, true)
  assert(camera.snapshot().z > 5.2)
  const mesh = first.scene.getObjectByProperty('type', 'Mesh') as Mesh; let releases = 0
  mesh.geometry.addEventListener('dispose', () => releases++)
  runtime.suspend(true); runtime.suspend(true); assert.equal(releases, 1); assert.equal(runtime.root.children.length, 0)
  runtime.suspend(false); await tick(); assert.equal(runtime.snapshot().status, 'ready'); assert.equal(calls, 2)
  runtime.dispose(); runtime.dispose()
})

test('actual master clips open the correct leaf and preserve the pressure interlock', async () => {
  const asset = await load(), runtime = new ShipModelRuntime(() => {}, async () => asset); await tick()
  assert.equal(runtime.snapshot().status, 'ready')
  let state = activateShipInteraction(selectShipInteraction(createShipInteraction(), 'inner-door')).state
  for (let i = 0; i < 30; i++) state = stepShipInteraction(state, .05, true)
  runtime.update({ position: { x: 0, y: 0, z: 0 }, orientation: new Quaternion() }, { x: 0, y: 0, z: 0 }, true, true, 0, state)
  const expected = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI/2)
  assert(asset.scene.getObjectByName('Door_Inner')!.quaternion.clone().normalize().angleTo(expected) < 1e-5)
  assert.equal(activateShipInteraction(selectShipInteraction(state, 'airlock')).state.doors.outer.target, 0)
  runtime.dispose()
})

test('actual cockpit retains its designed glazing and fits the complete visible interior triangle budget', async () => {
  const asset = await load(), visibility = new ShipVisibility(asset.scene)
  visibility.apply({ view: 'cockpit', innerOpen: true, outerOpen: false })
  assert(visibility.snapshot().triangles < 160000)
  asset.scene.traverse(o => {
    if (o instanceof Mesh && o.userData.module === 'exterior-glass') assert.equal(o.visible, false)
    if (o instanceof Mesh && o.userData.module === 'front-window-frame' && o.userData.part === 'glass') assert.equal(o.visible, true)
  })
  visibility.dispose()
  const runtime = new ShipModelRuntime(() => {}, async () => asset); await tick(); runtime.dispose()
})
