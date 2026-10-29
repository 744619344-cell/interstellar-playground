import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { MicrogravitySurfaces } from './microgravitySurfaces'
import { createCabinFloat } from '../../domain/cabinFloatMotion'
import { disposeShipModel } from './shipModelRuntime'

test('actual registered service/work surfaces complete kit -> inspection -> saved pause/resume -> return without changing device position', async () => {
  const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'actual_source' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  })
  let cabin: MicrogravityCabinRuntime | undefined
  const storage = 'micro-starboard-liner', bench = 'micro-work'
  try {
    const surfaces = new MicrogravitySurfaces(asset.scene), grip = surfaces.grips.find(g => g.id === `${storage}:rail:1`)!
    const point = grip.point.clone().addScaledVector(grip.normal, .62).add(new Vector3(0, -.22, 0)); surfaces.dispose()
    cabin = new MicrogravityCabinRuntime(asset.scene, { float: createCabinFloat(point) })
    const tick = (n: number, running = true) => { for (let i = 0; i < n; i++) cabin!.update(1 / 60, { forward: 0, right: 0 }, 0, true, false, running) }
    tick(1); cabin.interact(); assert.equal(cabin.snapshot().devicePanel!.id, bench)
    assert(cabin.snapshot().nearbyEquipment.some(e => e.id === storage)); cabin.equipmentAction(storage, 'open')
    assert.equal(cabin.snapshot().devicePanel!.id, storage)
    cabin.equipmentAction(storage, 'take-kit'); assert.equal(cabin.snapshot().equipment.kit, 'storage')
    cabin.key('KeyX', true); cabin.key('KeyX', false); tick(50); assert(cabin.snapshot().float.contact)
    cabin.equipmentAction(storage, 'take-kit'); assert.equal(cabin.snapshot().equipment.kit, 'carried')
    cabin.equipmentAction(storage, 'take-kit'); assert.equal(cabin.snapshot().equipment.log.length, 1)
    cabin.equipmentAction(storage, 'light-rest'); assert.equal(cabin.cabinLight, 'rest')
    cabin.equipmentAction(storage, 'record-status'); assert.match(cabin.snapshot().equipment.log.at(-1)!.detail, /宇航服未穿戴/)
    cabin.equipmentAction(bench, 'open'); assert.equal(cabin.snapshot().devicePanel!.id, bench)
    cabin.equipmentAction(storage, 'return-kit'); assert.equal(cabin.snapshot().equipment.kit, 'carried', 'stale storage button returned kit remotely')
    cabin.equipmentAction(bench, 'inspect-start'); tick(90); assert(cabin.snapshot().equipment.inspection)
    cabin.cancel(); const saved = cabin.save(); tick(5, false); assert.deepEqual(cabin.save(), saved)
    cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, saved)
    assert.deepEqual(cabin.save(), saved); assert.equal(cabin.cabinLight, 'rest'); tick(180)
    assert.equal(cabin.snapshot().equipment.inspections, 1); assert.equal(cabin.snapshot().equipment.inspection, undefined)
    assert(new Vector3().copy(cabin.snapshot().position).distanceTo(point) < 1e-7, 'equipment actions moved the actor')
    cabin.equipmentAction(bench, 'inspect-start'); tick(10); cabin.interact(); tick(1)
    assert.equal(cabin.snapshot().equipment.inspection, undefined); assert.equal(cabin.snapshot().equipment.inspections, 1)
    cabin.equipmentAction(bench, 'open'); cabin.equipmentAction(bench, 'inspect-start'); cabin.cancel(true)
    assert.equal(cabin.snapshot().equipment.inspection, undefined); assert.equal(cabin.snapshot().equipment.kit, 'carried')
    cabin.equipmentAction(storage, 'open'); cabin.equipmentAction(storage, 'return-kit'); assert.equal(cabin.snapshot().equipment.kit, 'storage')
    cabin.equipmentAction(storage, 'light-normal'); assert.equal(cabin.cabinLight, 'normal')
    cabin.equipmentAction(bench, 'open'); cabin.equipmentAction(bench, 'study-arm'); assert.equal(cabin.snapshot().equipment.study!.phase, 'armed')
    assert.equal(cabin.snapshot().controlMode, 'inertial', 'observation must exclude the default game assistance')
    cabin.toggleControls(); assert.equal(cabin.snapshot().controlMode, 'inertial', 'active observation allowed assistance')
    cabin.key('Space', true); tick(1); cabin.key('Space', false); tick(210)
    const observed = cabin.snapshot().equipment.study!
    assert.equal(observed.phase, 'complete', JSON.stringify({ observed, position: cabin.snapshot().position, notice: cabin.snapshot().notice }))
    assert(observed.samples.length >= 30); assert(observed.result!.residual < .002)
  } finally { cabin?.dispose(); disposeShipModel(asset.scene) }
})
