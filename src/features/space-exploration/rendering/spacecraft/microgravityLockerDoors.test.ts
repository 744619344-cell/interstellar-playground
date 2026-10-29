import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3, Group, Mesh, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createCabinFloat } from '../../domain/cabinFloatMotion'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { MicrogravitySurfaces } from './microgravitySurfaces'
import { MicrogravityLockerDoors } from './microgravityLockerDoors'
import { createLockerDoorCandidate, LOCKER_DOOR_FIT } from './microgravityLockerDoorParts'
import { disposeShipModel } from './shipModelRuntime'

test('actual cabinet candidate: closed/moving doors deny wear; open/wear/cancel/doff and reload preserve native outfit state', async () => {
  const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'actual_source' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  }, undefined, undefined, { lockerDoors: true })
  let cabin: MicrogravityCabinRuntime | undefined
  try {
    const surfaces = new MicrogravitySurfaces(asset.scene), grip = surfaces.grips.find(g => g.id.startsWith('micro-locker'))!; surfaces.dispose()
    cabin = new MicrogravityCabinRuntime(asset.scene, { float: createCabinFloat(grip.point.clone().add(new Vector3(-.62, -.22, 0))) })
    const tick = (count: number) => { for (let i = 0; i < count; i++) cabin!.update(1 / 60, { forward: 0, right: 0 }, 0, true, false, true) }
    tick(1); cabin.evaAction('locker'); assert.equal(cabin.save().lockerDoor!.target, 0, 'unheld click opened cabinet')
    cabin.key('KeyX', true); cabin.key('KeyX', false); tick(50); assert(cabin.snapshot().float.contact)
    cabin.evaAction('wear'); assert.equal(cabin.snapshot().eva.suit, 'stowed')
    cabin.evaAction('locker'); tick(30); assert(cabin.save().lockerDoor!.progress > 0 && cabin.save().lockerDoor!.progress < 1)
    cabin.evaAction('wear'); assert.equal(cabin.snapshot().eva.suit, 'stowed')
    const moving = cabin.save(); cabin.update(.1, { forward: 0, right: 0 }, 0, true, false, false); assert.deepEqual(cabin.save(), moving)
    cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, moving); assert.deepEqual(cabin.save(), moving)
    tick(125); assert.equal(cabin.save().lockerDoor!.progress, 1)
    cabin.evaAction('wear'); tick(110); assert.equal(cabin.snapshot().eva.suit, 'donning')
    const wearPosition = cabin.snapshot().position
    cabin.key('ArrowRight', true); tick(15); cabin.key('ArrowRight', false)
    assert.deepEqual(cabin.snapshot().position, wearPosition, 'assistance moved the crew during actual suit donning')
    cabin.cancel(true); assert.equal(cabin.snapshot().eva.suit, 'stowed'); assert(asset.scene.getObjectByName('MicrogravityCrew')!.visible)
    cabin.evaAction('wear'); tick(40); cabin.key('KeyX', true); cabin.key('KeyX', false); tick(1)
    assert.equal(cabin.snapshot().eva.suit, 'stowed', 'wear continued after the actual support contact was released')
    cabin.key('KeyX', true); cabin.key('KeyX', false); tick(50)
    cabin.evaAction('wear'); tick(190); assert.equal(cabin.snapshot().eva.suit, 'ready'); assert(asset.scene.getObjectByName('MicrogravitySuit')!.visible)
    cabin.evaAction('inspect'); assert(Object.values(cabin.snapshot().eva.checks).every(Boolean))
    cabin.evaAction('wear'); tick(190); assert.equal(cabin.snapshot().eva.suit, 'stowed'); assert(asset.scene.getObjectByName('MicrogravityStowedSuit')!.visible)
    cabin.evaAction('locker'); tick(150); assert.equal(cabin.save().lockerDoor!.progress, 0)
    cabin.reset(); assert.equal(cabin.save().lockerDoor!.progress, 0); assert.equal(cabin.snapshot().eva.lockerOpen, false)
  } finally { cabin?.dispose(); disposeShipModel(asset.scene) }
})

test('four bifold leaves retain authorized dimensions, outward faces and block/resume against a real leaf sweep', () => {
  const model = new Group(), root = createLockerDoorCandidate(); model.add(root)
  let controller = new MicrogravityLockerDoors(model, { progress: .5, target: 1, blocked: false })
  const leaf = root.getObjectByName('LockerPortOuter')!, mesh = leaf.children.find(o => o instanceof Mesh) as Mesh
  const point = new Vector3(0, .2, .17), before = leaf.localToWorld(point.clone().setX(-.007))
  controller.dispose(); controller = new MicrogravityLockerDoors(model, { progress: .5 + 1 / 132, target: 1, blocked: false })
  const after = leaf.localToWorld(point.clone().setX(-.007)), person = before.clone().lerp(after, .5)
  controller.dispose(); controller = new MicrogravityLockerDoors(model, { progress: .5, target: 1, blocked: false })
  const surfaces = new MicrogravitySurfaces(model)
  try {
    controller.step(1 / 60, [person], surfaces); assert(controller.snapshot().blocked); assert.equal(controller.snapshot().progress, .5)
    controller.step(1 / 60, [], surfaces); assert(controller.snapshot().progress > .5); assert(!controller.snapshot().blocked)
    let maximum = 0
    for (let i = 0; i <= 30; i++) {
      controller.dispose(); controller = new MicrogravityLockerDoors(model, { progress: i / 30, target: 1, blocked: false })
      const box = new Box3().setFromObject(root); maximum = Math.max(maximum, LOCKER_DOOR_FIT.x - box.min.x)
      assert(box.max.y - box.min.y <= 2.05); assert(maximum <= .28)
    }
    const p = mesh.geometry.getAttribute('position'), n = mesh.geometry.getAttribute('normal')
    for (let i = 0; i < p.count; i += 3) {
      const a = new Vector3().fromBufferAttribute(p, i), b = new Vector3().fromBufferAttribute(p, i + 1), c = new Vector3().fromBufferAttribute(p, i + 2)
      assert(b.clone().sub(a).cross(c.clone().sub(a)).length() > 1e-9)
      assert(a.add(b).add(c).divideScalar(3).dot(new Vector3().fromBufferAttribute(n, i)) > 0)
    }
    assert(mesh.geometry.boundingBox === null || mesh.geometry.boundingBox.getSize(new Vector3()).x <= .016)
  } finally { controller.dispose(); surfaces.dispose(); disposeShipModel(model) }
})
