import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3, SkinnedMesh, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { disposeShipModel } from './shipModelRuntime'
import { MicrogravityOutfit } from '../astronaut/microgravityOutfit'
import { MicrogravitySurfaces } from './microgravitySurfaces'
import { createCabinFloat } from '../../domain/cabinFloatMotion'

test('real cabin candidate starts at a reachable source rail, pushes only after contact, coasts and restores after reload', async () => {
  const loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'real_geometry' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const bytes = await readFile(new URL(url)); return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  })
  let cabin: MicrogravityCabinRuntime | undefined
  try {
    const outfit = new MicrogravityOutfit(asset.scene), fit = outfit.bounds()
    assert(fit.locker.containsBox(fit.stowed), JSON.stringify({ locker: fit.locker, suit: fit.stowed }))
    outfit.dispose()
    cabin = new MicrogravityCabinRuntime(asset.scene)
    const tick = () => cabin!.update(1 / 60, { forward: 0, right: 0 }, 0, true, false, true)
    for (let i = 0; i < 30; i++) tick()
    cabin.toggleControls(); assert.equal(cabin.snapshot().controlMode, 'inertial')
    assert(cabin.snapshot().float.contact, cabin.snapshot().notice)
    assert.equal(cabin.snapshot().float.velocity.x, 0)
    const character = asset.scene.getObjectByName('MicrogravityCrew')!, wavingHand = character.getObjectByName('hand_R')!, head = character.getObjectByName('head')!
    const restingHand = wavingHand.getWorldPosition(new Vector3()); let highest = -Infinity
    cabin.key('KeyX', true); cabin.key('KeyX', false); cabin.key('KeyV', true); cabin.key('KeyV', false)
    for (let i = 0; i < 240; i++) { tick(); highest = Math.max(highest, wavingHand.getWorldPosition(new Vector3()).y) }
    assert(highest > head.getWorldPosition(new Vector3()).y + .1, `release/wave frozen at ${highest}`)
    assert(wavingHand.getWorldPosition(new Vector3()).distanceTo(restingHand) < .04)
    cabin.key('KeyX', true); cabin.key('KeyX', false); for (let i = 0; i < 45; i++) tick()
    assert(cabin.snapshot().float.contact, cabin.snapshot().notice)
    for (let i = 0; i < 30; i++) tick() // Let the newly caught hand absorb motion before pushing again.
    cabin.key('Space', true); tick(); cabin.key('Space', false)
    let state = cabin.snapshot().float
    assert(!state.contact); assert(state.velocity.x > .1, JSON.stringify(state))
    const before = { ...state.position }, speed = Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z)
    for (let i = 0; i < 30; i++) tick()
    state = cabin.snapshot().float
    assert(state.position.x > before.x + .1, JSON.stringify({ before, state, blocked: cabin.snapshot().blocked }))
    assert(Math.abs(Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) - speed) < .0001, JSON.stringify({ speed, state }))
    const saved = cabin.save(); cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, saved)
    assert.deepEqual(cabin.snapshot().float.position, saved.float.position)
    cabin.update(1, { forward: 1, right: 1 }, 0, true, false, false)
    assert.deepEqual(cabin.save(), saved)
    assert(cabin.camera(0, .22)); assert(cabin.snapshot().microgravity)
    cabin.dispose(); cabin = undefined
    const surfaces = new MicrogravitySurfaces(asset.scene), grip = surfaces.grips.find(g => g.id.startsWith('micro-locker'))!
    assert(grip); surfaces.dispose()
    const point = grip.point.clone().add(new Vector3(-.62, -.22, 0))
    cabin = new MicrogravityCabinRuntime(asset.scene, { float: createCabinFloat(point) })
    tick(); cabin.key('KeyX', true); cabin.key('KeyX', false)
    assert.equal(cabin.snapshot().posture, 'reaching')
    assert.equal(cabin.snapshot().float.contact, undefined)
    for (let i = 0; i < 45; i++) tick()
    assert(cabin.snapshot().float.contact, JSON.stringify({ notice: cabin.snapshot().notice, point, grip }))
    cabin.key('KeyR', true); cabin.key('KeyR', false)
    assert.equal(cabin.snapshot().eva.suit, 'donning', cabin.snapshot().notice)
    for (let i = 0; i < 65; i++) cabin.update(.05, { forward: 0, right: 0 }, 0, true, false, true)
    assert.equal(cabin.snapshot().eva.suit, 'ready', cabin.snapshot().notice)
    assert.equal(asset.scene.getObjectByName('MicrogravityStowedSuit')!.visible, false)
    assert.equal(asset.scene.getObjectByName('MicrogravityCrew')!.visible, false)
    assert.equal(asset.scene.getObjectByName('MicrogravitySuit')!.visible, true)
    const dressed = cabin.save(); cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, dressed)
    cabin.update(.05, { forward: 0, right: 0 }, 0, true, false, false)
    assert.deepEqual(cabin.save(), dressed)
    tick(); cabin.key('KeyR', true); cabin.key('KeyR', false)
    assert.equal(cabin.snapshot().eva.suit, 'doffing', cabin.snapshot().notice)
    for (let i = 0; i < 65; i++) cabin.update(.05, { forward: 0, right: 0 }, 0, true, false, true)
    assert.equal(cabin.snapshot().eva.suit, 'stowed', cabin.snapshot().notice)
    assert.equal(asset.scene.getObjectByName('MicrogravityStowedSuit')!.visible, true)
    assert.equal(asset.scene.getObjectByName('MicrogravityCrew')!.visible, true)
    assert.equal(asset.scene.getObjectByName('MicrogravitySuit')!.visible, false)
    cabin.dispose(); cabin = undefined
    for (const name of ['micro-sleep-1', 'micro-sleep-2', 'micro-sleep-3', 'reused-seat--1', 'reused-seat-1']) {
      const box = new Box3().setFromObject(asset.scene.getObjectByName(name)!, true), point = box.getCenter(new Vector3()), bed = name.includes('sleep')
      if (bed) { point.x = box.max.x + .45; point.y = .05 }
      else { point.x = Math.sign(point.x) * 1.6; point.y = -.65; point.z = -4.6 }
      cabin = new MicrogravityCabinRuntime(asset.scene, { float: createCabinFloat(point) }); tick()
      assert.equal(cabin.snapshot().prompt?.deviceId, name)
      if (name === 'micro-sleep-2') {
        cabin.interact(); assert.equal(cabin.snapshot().posture, 'reaching')
        cabin.cancel(true); tick()
        assert(!cabin.snapshot().busy); assert.equal(cabin.snapshot().prompt?.deviceId, name)
        assert(!cabin.snapshot().notice.includes('正在伸手'), 'cancel left the old reaching notice visible')
      }
      cabin.interact()
      for (let i = 0; i < 75; i++) {
        cabin.update(.05, { forward: 0, right: 0 }, 0, true, false, true)
        if (bed) {
          const view = cabin.camera(2.4, .15)!
          assert(character.visible, `${name}: crew disappeared on frame ${i}`)
          assert(new Vector3().copy(view.position).distanceTo(new Vector3().copy(view.target)) > .7, `${name}: camera entered cabin geometry on frame ${i}`)
          if (i % 6 === 0) for (const yaw of [-Math.PI, -2.4, -Math.PI / 2, 0, Math.PI / 2, 2.4, Math.PI]) {
            cabin.camera(yaw, .15); assert(character.visible, `${name}: disappeared entering at frame ${i}, yaw ${yaw}`)
          }
        }
      }
      assert.equal(cabin.snapshot().posture, bed ? 'resting' : 'seated', `${name}: ${cabin.snapshot().notice}`)
      if (bed) {
        for (const yaw of [-Math.PI, -2.4, -Math.PI / 2, 0, Math.PI / 2, 2.4, Math.PI]) {
          const view = cabin.camera(yaw, .15)!
          assert(character.visible && view.position.x > cabin.snapshot().position.x + .7, `${name}: obstructed at yaw ${yaw}`)
        }
        const body = new Box3(); character.traverse(o => { if (o instanceof SkinnedMesh) {
          for (let i = 0; i < o.geometry.getAttribute('position').count; i++) body.expandByPoint(o.getVertexPosition(i, new Vector3()).applyMatrix4(o.matrixWorld))
        } })
        const size = body.getSize(new Vector3())
        assert(size.y > 1.68 && size.y < 1.86, `${name}: unexpected body height ${size.y}`)
        assert(Math.max(size.x, size.z) > .4, `${name}: body is compressed across both horizontal axes`)
      }
      const fixed = cabin.save(); cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, fixed)
      assert.deepEqual(cabin.save(), fixed); tick(); cabin.interact()
      for (let i = 0; i < 75; i++) {
        cabin.update(.05, { forward: 0, right: 0 }, 0, true, false, true)
        if (bed && i % 6 === 0) for (const yaw of [-Math.PI, -2.4, -Math.PI / 2, 0, Math.PI / 2, 2.4, Math.PI]) {
          const view = cabin.camera(yaw, .15)!
          if (cabin.snapshot().busy) assert(character.visible, `${name}: disappeared leaving at frame ${i}, yaw ${yaw}`)
          else assert([...Object.values(view.position), ...Object.values(view.target)].every(Number.isFinite), `${name}: invalid free orbit after exit`)
        }
      }
      assert.equal(cabin.snapshot().posture, 'floating', `${name}: ${cabin.snapshot().notice}`)
      assert(new Vector3().copy(cabin.snapshot().position).distanceTo(point) < .0001)
      cabin.dispose(); cabin = undefined
    }
    cabin = new MicrogravityCabinRuntime(asset.scene)
    for (let i = 0; i < 40; i++) tick()
    cabin.toggleControls(); assert.equal(cabin.snapshot().controlMode, 'inertial')
    const initial = cabin.snapshot().position
    cabin.key('KeyW', true); cabin.key('Space', true); tick(); cabin.key('KeyW', false); cabin.key('Space', false)
    for (let i = 0; i < 180 && cabin.snapshot().prompt?.deviceId !== 'micro-sleep-2'; i++) tick()
    assert.equal(cabin.snapshot().prompt?.deviceId, 'micro-sleep-2')
    assert(Math.abs(cabin.snapshot().position.x - initial.x) < 1e-6, 'tangent rail push drifted away from the wall')
    cabin.interact(); let previous = new Vector3().copy(cabin.snapshot().position)
    for (let i = 0; i < 240; i++) {
      tick(); const position = new Vector3().copy(cabin.snapshot().position)
      assert(position.distanceTo(previous) < .04, 'entry jumped the body position'); previous = position
    }
    assert.equal(cabin.snapshot().posture, 'resting', cabin.snapshot().notice)
    cabin.interact(); for (let i = 0; i < 220; i++) tick()
    assert.equal(cabin.snapshot().posture, 'floating')
    cabin.key('KeyX', true); cabin.key('KeyX', false); for (let i = 0; i < 55; i++) tick()
    assert(cabin.snapshot().float.contact, `cannot regrasp after leaving sleep: ${cabin.snapshot().notice}`)
  } finally { cabin?.dispose(); disposeShipModel(asset.scene) }
})
