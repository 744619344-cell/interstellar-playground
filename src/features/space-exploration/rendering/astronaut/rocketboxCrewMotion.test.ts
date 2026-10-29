import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Bone, Box3, Group, SkinnedMesh, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MicrogravityCrewRig } from './microgravityCrewRig'
import { disposeShipModel } from '../spacecraft/shipModelRuntime'
import { useMicrogravityCabin } from '../../domain/cabinMode'

test('Rocketbox conversion preserves source attributes and drives original fingers/face without changing bind lengths', async () => {
  const raw = await readFile(new URL('../../../../assets/models/microgravity-cabin-20261025/crew-rocketbox.glb', import.meta.url))
  const conversion = JSON.parse(await readFile(new URL('../../../../../assets-source/characters/rocketbox-medical-female-03/conversion-manifest.json', import.meta.url), 'utf8'))
  assert.equal(createHash('sha256').update(raw).digest('hex'), conversion.sha256)
  const jsonLength = raw.readUInt32LE(12), document = JSON.parse(raw.subarray(20, 20 + jsonLength).toString())
  const encoded = (name: string) => {
    const accessor = document.accessors[document.meshes[0].primitives[0].attributes[name]], view = document.bufferViews[accessor.bufferView]
    const start = 28 + jsonLength + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const components = ({ VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[accessor.type]
    const bytes = components * (accessor.componentType === 5126 ? 4 : 2), packed = Buffer.alloc(accessor.count * bytes)
    for (let i = 0; i < accessor.count; i++) raw.copy(packed, i * bytes, start + i * (view.byteStride ?? bytes), start + i * (view.byteStride ?? bytes) + bytes)
    return packed
  }
  for (const [source, gltf] of Object.entries({ position: 'POSITION', uv: 'TEXCOORD_0', skinIndex: 'JOINTS_0', skinWeight: 'WEIGHTS_0' }))
    assert.equal(createHash('sha256').update(encoded(gltf)).digest('hex'), conversion.meshes[0].attributes[source], `encoded ${source}`)
  const loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'source_skin' } })
  const source = (await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '')).scene
  const skins: SkinnedMesh[] = [], bones: Bone[] = []
  source.traverse(o => { if (o instanceof SkinnedMesh) skins.push(o); if (o instanceof Bone) bones.push(o) })
  assert.equal(bones.length, 80); assert.equal(skins.length, 7)
  assert.equal(skins.reduce((sum, skin) => sum + skin.geometry.index!.count / 3, 0), 7536)
  assert.equal(new Set(skins.map(skin => Array.isArray(skin.material) ? skin.material[0].name : skin.material.name)).size, 3)
  for (const skin of skins) {
    assert.equal(skin.skeleton.bones.length, 80)
    assert.equal(Object.keys(skin.morphTargetDictionary!).length, 52)
    for (const attribute of ['position', 'uv', 'skinIndex']) {
      const array = skin.geometry.getAttribute(attribute).array
      assert.equal(createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex'), conversion.meshes[0].attributes[attribute], attribute)
    }
    // GLTFLoader normalizes float skin weights again; bound the rounding, while bytes above stay exact.
    const weights = skin.geometry.getAttribute('skinWeight').array, bytes = encoded('WEIGHTS_0')
    for (let i = 0; i < weights.length; i++) assert(Math.abs(weights[i] - bytes.readFloatLE(i * 4)) < 1.2e-7)
  }
  const box = new Box3().setFromObject(source, true), scale = 1.8 / box.getSize(new Vector3()).y
  source.scale.multiplyScalar(scale); source.position.copy(box.getCenter(new Vector3()).multiplyScalar(-scale))
  const host = new Group(), actor = new Group(); actor.add(source); host.add(actor)
  host.position.set(8, -3, 6); host.rotation.set(.2, -.4, .1); host.updateMatrixWorld(true)
  const lengths = new Map(bones.map(b => [b, b.position.clone()])), neutral = new Map(bones.map(b => [b, b.quaternion.clone()]))
  const rig = new MicrogravityCrewRig(actor, host, true)
  try {
    rig.pose(0); const relaxed = rig.palm('R'), digit = bones.find(b => b.name === 'Bip01_R_Finger12')!, open = digit.getWorldPosition(new Vector3())
    rig.fingers(true); rig.pose(0)
    assert(digit.getWorldPosition(new Vector3()).distanceTo(open) > .015, 'source phalanges did not curl')
    for (const side of ['L', 'R']) for (let finger = 0; finger < 5; finger++) for (let segment = 0; segment < 3; segment++) {
      const bone = bones.find(b => b.name === `Bip01_${side}_Finger${finger}${segment || ''}`)!
      assert(bone && bone.quaternion.angleTo(neutral.get(bone)!) > .1, `missing finger motion ${side}/${finger}/${segment}`)
    }
    rig.fingers(false); rig.wave()
    let peak = -Infinity, step = 0, previous = rig.palm('R'), blink = 0
    for (let i = 0; i < 240; i++) {
      rig.pose(1 / 60); const hand = rig.palm('R'); peak = Math.max(peak, hand.y); step = Math.max(step, hand.distanceTo(previous)); previous = hand
      const index = skins[0].morphTargetDictionary!.EyeBlinkLeft; blink = Math.max(blink, skins[0].morphTargetInfluences![index])
      assert(rig.bodyPoints().every(p => p.toArray().every(Number.isFinite)))
    }
    assert(peak > rig.head().y - .2); assert(step < .045); assert(blink > .9)
    assert(rig.palm('R').distanceTo(relaxed) < .04)
    let last = rig.palm('R'), motionStep = 0
    rig.locomotion(new Vector3(.6, 0, .6), 1, true)
    for (let i = 0; i < 90; i++) {
      rig.pose(1 / 60); const hand = rig.palm('R'); motionStep = Math.max(motionStep, hand.distanceTo(last)); last = hand
      for (const [bone, position] of lengths) assert(bone.position.distanceTo(position) < 1e-10, 'locomotion changed native bone dimensions')
      assert(rig.bodyPoints().every(p => p.toArray().every(Number.isFinite)))
    }
    assert(motionStep < .02, `locomotion snapped the palm by ${motionStep} m`)
    assert(rig.palm('R').distanceTo(relaxed) > .005, 'new movement response never reached the original source joints')
    rig.locomotion(new Vector3(), 0, false)
    for (let i = 0; i < 120; i++) rig.pose(1 / 60)
    assert(rig.palm('R').distanceTo(relaxed) < .02, 'movement response did not settle back to neutral')
    for (const mode of ['seat', 'sleep'] as const) { rig.pose(0, mode); assert(rig.bodyPoints().every(p => p.toArray().every(Number.isFinite))) }
    rig.pose(0); const target = rig.palm('L').add(new Vector3(.02, .015, .015)), reach = rig.reach(target, 'L')
    assert(reach.reachable && reach.error < .012); rig.grasp('L')
    const beforeQuery = bones.map(b => b.quaternion.toArray()), palms = { L: rig.palm('L'), R: rig.palm('R') }
    for (const side of ['L', 'R'] as const) {
      const surface = rig.palm(side).add(new Vector3(.01, .01, .01))
      rig.canReach(surface, new Vector3(0, 0, 1), side)
      assert(!rig.canReach(new Vector3(10, 10, 10), new Vector3(0, 0, 1), side))
      assert.deepEqual(bones.map(b => b.quaternion.toArray()), beforeQuery, 'prediction altered the visible pose')
      for (const hand of ['L', 'R'] as const) assert(rig.palm(hand).distanceTo(palms[hand]) < 1e-10, 'prediction changed the active palm sample')
    }
    assert(!rig.reach(new Vector3(10, 10, 10), 'L').reachable)
    for (const [bone, position] of lengths) assert(bone.position.distanceTo(position) < 1e-10, 'source bone length changed')
  } finally {
    rig.dispose()
    for (const [bone, q] of neutral) assert(bone.quaternion.angleTo(q) < 1e-6)
    for (const skin of skins) assert(skin.morphTargetInfluences!.every(v => v === 0))
    disposeShipModel(host)
  }
})

test('the integrated cabin is default while the explicit old-scene route remains available', () => {
  assert(useMicrogravityCabin('')); assert(useMicrogravityCabin('?microgravity=1'))
  assert(!useMicrogravityCabin('?microgravity=0')); assert(useMicrogravityCabin('?crew=legacy'))
})
