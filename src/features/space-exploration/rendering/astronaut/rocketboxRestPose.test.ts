import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Bone, Box3, Group, SkinnedMesh, Texture, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MicrogravityCrewRig } from './microgravityCrewRig'
import { disposeShipModel } from '../spacecraft/shipModelRuntime'

test('Rocketbox upper torso sleep alignment clears the neck without moving its native leg branch or changing source skin', async () => {
  const bytes = await readFile(new URL('../../../../assets/models/microgravity-cabin-20261025/crew-rocketbox.glb', import.meta.url))
  const loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'actual_source_skin' } })
  const source = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene
  const box = new Box3().setFromObject(source, true), scale = 1.8 / box.getSize(new Vector3()).y
  source.scale.multiplyScalar(scale); source.position.copy(box.getCenter(new Vector3()).multiplyScalar(-scale))
  const host = new Group(), original = new Group(), aligned = new Group()
  original.add(source); aligned.add(clone(source)); host.add(original, aligned)
  host.position.set(8, -3, 6); host.rotation.set(.2, -.4, .1); host.updateMatrixWorld(true)
  const before: { mesh: SkinnedMesh; arrays: Float32Array[] }[] = [], bones: Bone[] = []
  source.traverse(o => {
    if (o instanceof SkinnedMesh) before.push({ mesh: o, arrays: ['position', 'normal', 'uv', 'skinWeight'].map(name => new Float32Array(o.geometry.getAttribute(name).array)) })
    if (o instanceof Bone) bones.push(o)
  })
  const legs = ['pelvis', 'spine', 'thigh_L', 'shin_L', 'foot_L', 'toe_L', 'thigh_R', 'shin_R', 'foot_R', 'toe_R']
  const old = new MicrogravityCrewRig(original, host, true, false), next = new MicrogravityCrewRig(aligned, host, true, true)
  const lengths = bones.map(b => b.position.clone()), points = (root: Group, names: string[]) => names.map(name => root.getObjectByName(name)!.getWorldPosition(new Vector3()))
  let nextMesh: SkinnedMesh | undefined
  aligned.traverse(o => { if (o instanceof SkinnedMesh) nextMesh = o })
  const mesh = before[0].mesh, index = mesh.geometry.index!, position = mesh.geometry.getAttribute('position')
  try {
    assert.equal(original.getObjectByName('thigh_L')!.parent!.name, 'spine', 'fixture must include the source hierarchy that caused the first trial to hit the wall')
    for (const amount of [0, .2, .4, .6, .8, 1]) {
      old.pose(0, 'sleep', amount); next.pose(0, 'sleep', amount)
      const a = points(original, legs), b = points(aligned, legs)
      a.forEach((p, i) => assert(p.distanceTo(b[i]) < 1e-8, `sleep ${amount} altered ${legs[i]}`))
      let maximumGrowth = 0, collapsed = 0
      const baseline = Array.from({ length: position.count }, (_, i) => mesh.getVertexPosition(i, new Vector3()))
      const candidate = baseline.map((_, i) => nextMesh!.getVertexPosition(i, new Vector3()))
      for (let i = 0; i < index.count; i += 3) for (let k = 0; k < 3; k++) {
        const a = index.getX(i + k), b = index.getX(i + (k + 1) % 3), originalLength = baseline[a].distanceTo(baseline[b]) * scale
        const changedLength = candidate[a].distanceTo(candidate[b]) * scale
        maximumGrowth = Math.max(maximumGrowth, changedLength - originalLength)
        if (originalLength > .01 && changedLength < originalLength * .25) collapsed++
      }
      assert(maximumGrowth < .06, `sleep ${amount} grew a skin edge by ${maximumGrowth}m`)
      assert.equal(collapsed, 0, `sleep ${amount} collapsed a source skin edge`)
    }
    const forward = new Vector3(0, 0, 1).transformDirection(aligned.matrixWorld)
    const neckShift = points(aligned, ['neck'])[0].sub(points(original, ['neck'])[0]).dot(forward)
    assert(neckShift > .07 && neckShift < .2, `upper torso did not move out of the pad: ${neckShift}m`)
    for (const side of ['Left', 'Right']) {
      const eye = nextMesh!.morphTargetDictionary![`EyeBlink${side}`]
      assert(Math.abs(nextMesh!.morphTargetInfluences![eye] - 1) < 1e-9, 'settled sleep did not close the native eyelid channel')
    }
    let previous = points(aligned, ['head', 'hand_L', 'hand_R'])
    for (let frame = 0; frame <= 180; frame++) {
      next.pose(1 / 60, 'sleep', 1 - frame / 180)
      const current = points(aligned, ['head', 'hand_L', 'hand_R'])
      current.forEach((p, i) => assert(p.distanceTo(previous[i]) < .04, `sleep exit jumped ${p.distanceTo(previous[i])}m`)); previous = current
    }
    assert(nextMesh!.morphTargetInfluences![nextMesh!.morphTargetDictionary!.EyeBlinkLeft] < .1, 'eyes did not reopen after leaving the rest pose')
    bones.forEach((b, i) => {
      assert(b.position.distanceTo(lengths[i]) < 1e-10, 'source bone length changed')
      assert(aligned.getObjectByName(b.name)!.position.distanceTo(lengths[i]) < 1e-10, 'candidate bone length changed')
    })
    for (const row of before) ['position', 'normal', 'uv', 'skinWeight'].forEach((name, i) => assert.deepEqual(row.mesh.geometry.getAttribute(name).array, row.arrays[i]))
    assert(original.position.equals(aligned.position) && original.quaternion.equals(aligned.quaternion) && original.scale.equals(aligned.scale))
  } finally { old.dispose(); next.dispose(); disposeShipModel(host) }
})
