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

test('device grab button forms actual skin contact, can be cancelled, rejects stale panels and preserves F close', async () => {
  const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'device_grip_source' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  })
  let cabin: MicrogravityCabinRuntime | undefined
  try {
    const surfaces = new MicrogravitySurfaces(asset.scene), id = 'micro-starboard-liner', grip = surfaces.grips.find(g => g.id === `${id}:rail:1`)!
    const point = grip.point.clone().addScaledVector(grip.normal, .62).add(new Vector3(0, -.22, 0)); surfaces.dispose()
    cabin = new MicrogravityCabinRuntime(asset.scene, { float: createCabinFloat(point) })
    const tick = (n = 1, running = true) => { for (let i = 0; i < n; i++) cabin!.update(1 / 60, { forward: 0, right: 0 }, 0, true, false, running) }
    tick(); cabin.equipmentAction(id, 'open'); assert.equal(cabin.snapshot().devicePanel?.id, id)
    cabin.equipmentAction('micro-work', 'grip'); assert(!cabin.snapshot().float.contact); assert(!cabin.snapshot().busy)
    cabin.equipmentAction(id, 'grip'); tick(10); assert.equal(cabin.snapshot().posture, 'reaching', JSON.stringify({ notice: cabin.snapshot().notice, panel: cabin.snapshot().devicePanel, state: cabin.snapshot().float }))
    cabin.cancel(true); tick(); assert(!cabin.snapshot().float.contact); assert(!cabin.snapshot().busy)
    cabin.equipmentAction(id, 'open'); cabin.equipmentAction(id, 'grip'); tick(50)
    assert.equal(cabin.snapshot().float.contact?.id, `station:${id}:contact`, cabin.snapshot().notice)
    assert(new Vector3().copy(cabin.snapshot().position).distanceTo(point) < 1e-7, 'grab changed actor position')
    cabin.equipmentAction(id, 'take-kit'); assert.equal(cabin.snapshot().equipment.kit, 'carried')
    const saved = cabin.save(); tick(3, false); assert.deepEqual(cabin.save(), saved); tick()
    cabin.interact(); assert.equal(cabin.snapshot().devicePanel, undefined)
    assert(cabin.snapshot().float.contact, 'closing a panel unexpectedly released real support')
    cabin.equipmentAction(id, 'grip'); assert(!cabin.snapshot().busy, 'stale closed panel allowed a new reach')
  } finally { cabin?.dispose(); disposeShipModel(asset.scene) }
})
