import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Group, Mesh, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import weights from '../../../../assets/models/microgravity-cabin-20261025/sleep-fabric-weights.json'
import { MicrogravitySleepFabric } from './microgravitySleepFabric'
import { disposeShipModel } from './shipModelRuntime'
import layout from '../../../../assets/models/microgravity-cabin-20261025/layout-candidate.json'
import scope from '../../../../assets/models/microgravity-cabin-20261025/sleep-fit-v2-mask.json'

test('authorized soft bag expands existing fabric, keeps rigid vertices and original source buffers, and releases the pose', async () => {
  const raw = await readFile(new URL('../../../../assets/models/microgravity-cabin-20261025/sleep-v1.glb', import.meta.url)), loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'source_fabric' } })
  const source = (await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '')).scene
  const root = new Group(), original: Mesh[] = []; source.traverse(o => { if (o instanceof Mesh) original.push(o) })
  const position = original[0].geometry.getAttribute('position'), normal = original[0].geometry.getAttribute('normal'), before = new Float32Array(position.array), normalBefore = new Float32Array(normal.array)
  for (let i = 1; i <= 3; i++) { const bag = new Group(); bag.name = `micro-sleep-${i}`; bag.add(source.clone(true)); root.add(bag) }
  const fabric = new MicrogravitySleepFabric(root, true)
  try {
    fabric.apply('micro-sleep-2', 1)
    const meshes: Mesh[] = []; root.getObjectByName('micro-sleep-2')!.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
    const mesh = meshes[0], target = mesh.geometry.morphAttributes.position![0], normalTarget = mesh.geometry.morphAttributes.normal![0]
    assert.equal(mesh.morphTargetInfluences?.[0], 1)
    let moved = 0, fixed = 0
    for (let i = 0; i < position.count; i++) {
      const delta = new Vector3().fromBufferAttribute(target, i).distanceTo(new Vector3().fromBufferAttribute(position, i))
      assert(Number.isFinite(delta) && delta < .105)
      if (!weights.weights[i]) {
        assert(delta < 1e-7); assert(new Vector3().fromBufferAttribute(normalTarget, i).distanceTo(new Vector3().fromBufferAttribute(normal, i)) < 1e-5); fixed++
      } else if (delta > .001) moved++
    }
    assert(moved > 7000); assert(fixed > 25000)
    assert.deepEqual(position.array, before); assert.deepEqual(normal.array, normalBefore)
    fabric.dispose(); assert.equal(mesh.morphTargetInfluences?.[0], 0)
    const restored = new MicrogravitySleepFabric(root, true); restored.apply('micro-sleep-1', 1); restored.dispose()
    assert.deepEqual(position.array, before)
  } finally { fabric.dispose(); disposeShipModel(root); disposeShipModel(source) }
})

for (const version of ['v2', 'v4', 'v5'] as const) test(`${version}: actual three berths keep head/back/frame and attributes while front and straps move at most18cm`, async () => {
  for (const frameOrCurtain of [29703, 27715, 12714, 10699, 23343, 9949, 12175, 11919, 11484]) assert(scope.protectedComponentIds.includes(frameOrCurtain))
  const loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'real_geometry' } })
  const bytes = await readFile(new URL('../../../../assets/models/microgravity-cabin-20261025/sleep-v1.glb', import.meta.url))
  const source = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const model = new Group(), roots: Group[] = []
  let original: Mesh | undefined
  source.scene.traverse(object => { if (object instanceof Mesh) original = object })
  assert(original)
  const geometry = original.geometry
  for (const placement of layout.placements.filter(p => p.id === 'sleep-v1')) {
    const root = new Group(); root.name = placement.name; root.scale.setScalar(placement.scale)
    root.position.fromArray(placement.offset); root.rotation.y = placement.yaw; root.add(source.scene.clone(true)); model.add(root); roots.push(root)
  }
  const fabric = new MicrogravitySleepFabric(model, false, false, version !== 'v2', version === 'v5' ? 'v5' : version === 'v4' ? 'v4' : 'v3')
  try {
    let shared: object | undefined
    for (const root of roots) root.traverse(object => {
      if (!(object instanceof Mesh)) return
      if (shared) assert.equal(object.geometry, shared); else shared = object.geometry
      for (const name of ['position', 'normal', 'uv']) assert.deepEqual(object.geometry.getAttribute(name).array, geometry.getAttribute(name).array)
      assert.deepEqual(object.geometry.index!.array, geometry.index!.array)
      const positions = object.geometry.getAttribute('position'), target = object.geometry.morphAttributes.position[0]
      const matrix = root.matrixWorld.clone().invert().multiply(object.matrixWorld)
      let head = 0, rear = 0, frame = 0, moved = 0, fullyMovedFront = 0
      for (let i = 0; i < positions.count; i++) {
        const base = new Vector3().fromBufferAttribute(positions, i), next = new Vector3().fromBufferAttribute(target, i)
        const local = base.clone().applyMatrix4(matrix), posed = next.clone().applyMatrix4(matrix), distance = next.distanceTo(base) * root.scale.x
        assert(distance <= .180001, `unapproved displacement ${distance} at ${i}`)
        assert(Math.abs(local.x - posed.x) < 1e-6 && Math.abs(local.y - posed.y) < 1e-6)
        if (local.y >= .845) { assert.deepEqual(next, base); head++ }
        if (local.z <= -.012) { assert.deepEqual(next, base); rear++ }
        if (local.x <= -.218 || local.x >= .17 || local.y <= .08) { assert.deepEqual(next, base); frame++ }
        if (!scope.weights[i]) assert.deepEqual(next, base, 'protected source component moved')
        if (distance > 1e-6) moved++
        if (scope.weights[i] && local.x > -.15 && local.x < .1 && local.y > .2 && local.y < .7 && local.z >= .006) {
          assert(Math.abs(distance - .18) < 1e-6, 'front fabric or strap failed to move together'); fullyMovedFront++
        }
      }
      assert(head > 5000 && rear > 5000 && frame > 5000 && moved > 5000 && fullyMovedFront > 1000)
    })
    fabric.apply('micro-sleep-2', 1)
    for (const root of roots) root.traverse(object => { if (object instanceof Mesh) assert.equal(object.morphTargetInfluences![0], root.name === 'micro-sleep-2' ? 1 : 0) })
    fabric.dispose()
    for (const root of roots) root.traverse(object => { if (object instanceof Mesh) assert.equal(object.morphTargetInfluences![0], 0) })
  } finally { fabric.dispose(); disposeShipModel(model); disposeShipModel(source.scene) }
})
