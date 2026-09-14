import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, Texture, Vector3, Quaternion, type WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { disposeShipModel, renderShipLayer, ShipModelRuntime } from './shipModelRuntime'
import { ShipViewCamera } from './shipViewCamera'

test('shared PBR geometry, materials, all texture slots and image bitmap release exactly once', () => {
  const root = new Group(), geometry = new BoxGeometry(), material = new MeshStandardMaterial(), texture = new Texture()
  const counts = { geometry: 0, material: 0, texture: 0, image: 0 }
  texture.image = { close: () => counts.image++ }
  material.roughnessMap = texture; material.metalnessMap = texture; material.aoMap = texture
  geometry.addEventListener('dispose', () => counts.geometry++)
  material.addEventListener('dispose', () => counts.material++)
  texture.addEventListener('dispose', () => counts.texture++)
  root.add(new Mesh(geometry, material), new Mesh(geometry, material))
  disposeShipModel(root)
  assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1, image: 1 })
})

test('late loading after exit releases the asset without restoring a disposed scene', async () => {
  let resolve!: (model: Group) => void, disposed = 0, seated = 0
  const runtime = new ShipModelRuntime(() => seated++, () => new Promise(done => { resolve = done }))
  const model = new Group(), geometry = new BoxGeometry()
  geometry.addEventListener('dispose', () => disposed++)
  model.add(new Mesh(geometry, new MeshStandardMaterial()))
  runtime.dispose(); runtime.dispose(); resolve(model)
  await new Promise(done => setImmediate(done))
  assert.equal(disposed, 1); assert.equal(seated, 0); assert.equal(runtime.scene.children.length, 0)
})

test('ship pass retains world depth and restores renderer state even on failure', () => {
  const renderer = { autoClear: true, render: () => { assert.equal(renderer.autoClear, false); throw new Error('lost') } }
  assert.throws(() => renderShipLayer(renderer as unknown as WebGLRenderer, new Scene(), new PerspectiveCamera()), /lost/)
  assert.equal(renderer.autoClear, true)
})

test('actual Meshopt PBR assembly fits protection and its seat follows ship rotation', async () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'geometry_only_test' } })
  const bytes = await readFile(new URL('../../../../assets/models/spacecraft-pbr-lod1.glb', import.meta.url))
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')
  let seat: { x: number; y: number; z: number } | undefined
  const runtime = new ShipModelRuntime(value => { seat = value }, async () => gltf.scene)
  await new Promise(done => setImmediate(done))
  assert.equal(runtime.snapshot().status, 'ready'); assert(seat)
  assert(Math.abs(seat.z + 4.256158829) < .001)
  const subject = { position: { x: 25, y: -8, z: 13 }, orientation: new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 1.2) }
  const camera = new ShipViewCamera(subject, seat); camera.setMode('cockpit')
  for (let i = 0; i < 120; i++) camera.update(subject, 1 / 120)
  const expected = new Vector3(seat.x, seat.y, seat.z).applyQuaternion(subject.orientation).add(new Vector3(25, -8, 13))
  assert(expected.distanceTo(new Vector3().copy(camera.snapshot().position)) < 1e-8)
  runtime.dispose()
})

test('rejected asset load keeps fallback status and teardown remains safe', async () => {
  const runtime = new ShipModelRuntime(() => assert.fail('must not seat'), async () => { throw new Error('offline') })
  await new Promise(done => setImmediate(done))
  assert.equal(runtime.snapshot().status, 'failed'); runtime.dispose(); runtime.dispose()
})
