import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3, Group, SkinnedMesh, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MicrogravityCrewRig } from './microgravityCrewRig'
import { disposeShipModel } from '../spacecraft/shipModelRuntime'

test('authorized indoor skin supports continuous floating/wave return and actual palm IK under a rotated host', async () => {
  const raw = await readFile(new URL('../../../../assets/models/microgravity-cabin-20261025/crew-bound-v6.glb', import.meta.url)), loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'actual_skin' } })
  const source = (await loader.parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '')).scene
  const box = new Box3().setFromObject(source, true), scale = 1.8 / box.getSize(new Vector3()).y
  source.scale.setScalar(scale); source.position.copy(box.getCenter(new Vector3()).multiplyScalar(-scale))
  const host = new Group(), actor = new Group(); host.position.set(13, -5, 9); host.rotation.set(.2, -.6, .15)
  actor.rotation.y = Math.PI; actor.add(source); host.add(actor); host.updateMatrixWorld(true)
  const rig = new MicrogravityCrewRig(actor, host, true), lengths = new Map<string, number>()
  actor.traverse(o => { if (o.type === 'Bone') lengths.set(o.name, o.position.length()) })
  try {
    rig.pose(0); const relaxed = rig.palm('R'), head = rig.head(), torso: { mesh: SkinnedMesh; index: number; point: Vector3 }[] = [], skins: { mesh: SkinnedMesh; rest: Vector3[] }[] = []
    actor.traverse(o => { if (o instanceof SkinnedMesh) {
      const rest: Vector3[] = []
      for (let i = 0; i < o.geometry.getAttribute('position').count; i++) {
        const point = actor.worldToLocal(o.getVertexPosition(i, new Vector3()).applyMatrix4(o.matrixWorld))
        rest.push(point); if (i % 3 === 0 && Math.abs(point.x) < .13 && point.y > .02 && point.y < .30) torso.push({ mesh: o, index: i, point })
      }
      skins.push({ mesh: o, rest })
    } })
    assert(torso.length > 100); rig.wave()
    let raised = -Infinity, largestStep = 0, torsoMotion = 0, edgeGrowth = 0, previous = relaxed.clone()
    for (let frame = 0; frame < 240; frame++) {
      rig.pose(1 / 60); const palm = rig.palm('R'); largestStep = Math.max(largestStep, previous.distanceTo(palm)); raised = Math.max(raised, palm.y); previous = palm
      assert(rig.bodyPoints().length >= 40); assert(rig.bodyPoints().every(v => v.toArray().every(Number.isFinite)))
      if (frame % 12 === 0) for (const s of torso) torsoMotion = Math.max(torsoMotion, actor.worldToLocal(s.mesh.getVertexPosition(s.index, new Vector3()).applyMatrix4(s.mesh.matrixWorld)).distanceTo(s.point))
      if (frame === 84) for (const s of skins) {
        const posed = s.rest.map((_, i) => actor.worldToLocal(s.mesh.getVertexPosition(i, new Vector3()).applyMatrix4(s.mesh.matrixWorld))), index = s.mesh.geometry.index!
        for (let i = 0; i < index.count; i += 3) for (let k = 0; k < 3; k++) { const a = index.getX(i + k), b = index.getX(i + (k + 1) % 3); edgeGrowth = Math.max(edgeGrowth, posed[a].distanceTo(posed[b]) - s.rest[a].distanceTo(s.rest[b])) }
      }
    }
    assert(raised > head.y - .2, `wave height ${raised}, head ${head.y}`)
    assert(largestStep < .045, `largest palm step ${largestStep}`)
    assert(rig.palm('R').distanceTo(relaxed) < .04, `return error ${rig.palm('R').distanceTo(relaxed)}`)
    assert(torsoMotion < .02, `arm motion pulled the waist by ${torsoMotion} m`)
    assert(edgeGrowth < .14, `wave stretched a source edge by ${edgeGrowth} m`)
    for (const mode of ['sleep', 'seat'] as const) for (const amount of [0, .2, .4, .6, .8, 1]) {
      rig.pose(0, mode, amount)
      for (const s of skins) {
        const posed = s.rest.map((_, i) => actor.worldToLocal(s.mesh.getVertexPosition(i, new Vector3()).applyMatrix4(s.mesh.matrixWorld))), index = s.mesh.geometry.index!
        let growth = 0, compression = 0, collapsed = 0
        for (let i = 0; i < index.count; i += 3) for (let k = 0; k < 3; k++) {
          const a = index.getX(i + k), b = index.getX(i + (k + 1) % 3), before = s.rest[a].distanceTo(s.rest[b]), after = posed[a].distanceTo(posed[b])
          if (before > .01) { growth = Math.max(growth, after - before); compression = Math.max(compression, before - after); if (after < before * .25) collapsed++ }
        }
        assert(growth < .14 && compression < .05 && collapsed === 0, `${mode} ${amount}: growth=${growth} compression=${compression} collapsed=${collapsed}`)
      }
    }
    rig.pose(0); const reachable = rig.palm('L').add(new Vector3(.04, .02, .025)), touch = rig.reach(reachable, 'L')
    assert(touch.reachable); assert(touch.error < .012); assert(touch.point.distanceTo(reachable) < .012)
    const wrist = actor.getObjectByName('hand_L')!, rest = (rig as unknown as { rest: { bone: typeof wrist; rotation: import('three').Quaternion }[] }).rest.find(s => s.bone === wrist)!.rotation
    rig.pose(0); const surface = rig.palm('L').add(new Vector3(.01, .015, .01)), aligned = rig.reach(surface, 'L', new Vector3(0, 0, 1))
    if (aligned.reachable) { assert(aligned.error < .012); assert(rest.angleTo(wrist.quaternion) <= .721) }
    assert(!rig.reach(new Vector3(5, 5, 5), 'L').reachable)
    actor.traverse(o => { if (o.type === 'Bone') assert(Math.abs(o.position.length() - lengths.get(o.name)!) < 1e-9) })
  } finally { rig.dispose(); disposeShipModel(host) }
})




