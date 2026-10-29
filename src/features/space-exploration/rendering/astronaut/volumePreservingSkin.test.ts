import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Quaternion, SkinnedMesh, Texture, Vector3, Vector4 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VolumePreservingSkin } from './volumePreservingSkin'
import { disposeShipModel } from '../spacecraft/shipModelRuntime'

test('actual source sleeve retains its radius through a half turn, restores LBS and leaves source buffers intact', async () => {
  const raw = await readFile(new URL('../../../../assets/models/microgravity-cabin-20261025/crew-bound-v6.glb', import.meta.url)), loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'volume_source' } })
  const source = (await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '')).scene
  let mesh!: SkinnedMesh; source.traverse(o => { if (o instanceof SkinnedMesh) mesh = o })
  source.updateMatrixWorld(true); mesh.skeleton.update()
  const positions = mesh.geometry.getAttribute('position'), savedPositions = positions.array.slice(), indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight')
  const forearm = source.getObjectByName('forearm_L')!, hand = source.getObjectByName('hand_L')!, oldMaterial = mesh.material, oldTransform = mesh.applyBoneTransform
  const origin = forearm.getWorldPosition(new Vector3()), axis = hand.getWorldPosition(new Vector3()).sub(origin).normalize()
  const radius = (p: Vector3) => p.clone().sub(origin).addScaledVector(axis, -p.clone().sub(origin).dot(axis)).length()
  const samples: { index: number; radius: number }[] = []
  for (let i = 0; i < positions.count; i++) {
    const ids = [indices.getX(i), indices.getY(i), indices.getZ(i), indices.getW(i)], ws = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)]
    const influence = ids.reduce((sum, id, k) => sum + (/forearm_L|hand_L/.test(mesh.skeleton.bones[id].name) ? ws[k] : 0), 0)
    const r = radius(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld))
    if (influence > .35 && influence < .65 && r > .015) samples.push({ index: i, radius: r })
  }
  assert(samples.length > 20)
  forearm.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI)); source.updateMatrixWorld(true); mesh.skeleton.update()
  const linear = samples.reduce((sum, s) => sum + radius(mesh.getVertexPosition(s.index, new Vector3()).applyMatrix4(mesh.matrixWorld)) / s.radius, 0) / samples.length
  const skin = new VolumePreservingSkin([mesh])
  try {
    const error = Math.max(...samples.map(s => Math.abs(radius(mesh.getVertexPosition(s.index, new Vector3()).applyMatrix4(mesh.matrixWorld)) / s.radius - 1)))
    assert(linear < .35, `linear radius ${linear}`); assert(error < .00002, `DQ radius error ${error}`)
    const sample = samples[0].index, point = new Vector3().fromBufferAttribute(positions, sample), a = mesh.applyBoneTransform(sample, point.clone())
    const b = mesh.applyBoneTransform(sample, new Vector4(point.x, point.y, point.z, 1))
    assert(a.distanceTo(new Vector3(b.x, b.y, b.z)) < 1e-10)
    const normal = mesh.applyBoneTransform(sample, new Vector4(0, 0, 1, 0)); assert.equal(normal.w, 0)
    assert.deepEqual(positions.array, savedPositions)
  } finally { skin.dispose(); assert.equal(mesh.material, oldMaterial); assert.equal(mesh.applyBoneTransform, oldTransform); disposeShipModel(source) }
})

test('upper-arm blend follows the same weighted linear and volume skinning without changing the source', async () => {
  const raw = await readFile(new URL('../../../../assets/models/microgravity-cabin-20261025/crew-bound-v6.glb', import.meta.url)), loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'hybrid_source' } })
  const source = (await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '')).scene
  let mesh!: SkinnedMesh; source.traverse(o => { if (o instanceof SkinnedMesh) mesh = o })
  const arm = source.getObjectByName('upper_arm_R')!, originalTransform = mesh.applyBoneTransform, positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight')
  arm.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 1)); source.updateMatrixWorld(true); mesh.skeleton.update()
  const upper = mesh.skeleton.bones.findIndex(b => b.name === 'upper_arm_R'), samples: { index: number; influence: number; linear: Vector3; volume: Vector3 }[] = []
  const full = new VolumePreservingSkin([mesh])
  for (let i = 0; i < positions.count; i++) {
    const ids = [indices.getX(i), indices.getY(i), indices.getZ(i), indices.getW(i)], ws = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)]
    const influence = ids.reduce((sum, id, k) => sum + (id === upper ? ws[k] : 0), 0)
    if (influence < .3 || influence > .9) continue
    const point = new Vector3().fromBufferAttribute(positions, i)
    samples.push({ index: i, influence, linear: originalTransform.call(mesh, i, point.clone()) as Vector3, volume: mesh.applyBoneTransform(i, point) })
    if (samples.length === 60) break
  }
  assert.equal(samples.length, 60); full.dispose()
  const hybrid = new VolumePreservingSkin([mesh], .8)
  try {
    for (const sample of samples) {
      const point = new Vector3().fromBufferAttribute(positions, sample.index), expected = sample.volume.clone().lerp(sample.linear, sample.influence * .8)
      assert(mesh.applyBoneTransform(sample.index, point).distanceTo(expected) < 1e-7)
    }
  } finally { hybrid.dispose(); disposeShipModel(source) }
})




