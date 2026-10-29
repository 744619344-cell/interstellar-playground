import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { MicrogravitySleepFabric } from './microgravitySleepFabric'
import { createCabinFloat } from '../../domain/cabinFloatMotion'
import { disposeShipModel } from './shipModelRuntime'

test('actual v5 cabin: aligned torso completes all three berths, inertial retry and exit without changing target points or collision', async () => {
  const loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'actual_source_geometry' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const bytes = await readFile(new URL(url)); return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  })
  const fabric = new MicrogravitySleepFabric(asset.scene, false, true, true, 'v5')
  let cabin: MicrogravityCabinRuntime | undefined
  // Select the same explicit candidate profile as ?sleepPose=v2 without adding a browser global to Node.
  const select = () => { (cabin as unknown as { rig: { alignedSleep: boolean } }).rig.alignedSleep = true }
  try {
    for (const name of ['micro-sleep-1', 'micro-sleep-2', 'micro-sleep-3', 'initial-rail']) {
      const box = new Box3().setFromObject(asset.scene.getObjectByName(name === 'initial-rail' ? 'micro-sleep-2' : name)!, true)
      const start = box.getCenter(new Vector3()); start.x = box.max.x + .45; start.y = .05
      cabin = new MicrogravityCabinRuntime(asset.scene, name === 'initial-rail' ? undefined : { float: createCabinFloat(start) }); select()
      const dt = 1 / 55, tick = (running = true) => cabin!.update(dt, { forward: 0, right: 0 }, 0, true, false, running)
      if (name === 'initial-rail') {
        for (let i = 0; i < 240; i++) tick()
        cabin.toggleControls(); assert.equal(cabin.snapshot().controlMode, 'inertial')
        cabin.nudgeMove(1, 0)
        for (let i = 0; i < 180 && cabin.snapshot().prompt?.deviceId !== 'micro-sleep-2'; i++) tick()
        cabin.interact(); tick(); const inertia = cabin.snapshot().float
        cabin.cancel(true); assert.deepEqual(cabin.snapshot().float, inertia)
        for (let i = 0; i < 24; i++) tick()
      } else tick()
      const expected = name === 'initial-rail' ? 'micro-sleep-2' : name
      assert.equal(cabin.snapshot().prompt?.deviceId, expected)
      const entry = { ...cabin.snapshot().position }; cabin.interact()
      let previous = new Vector3().copy(entry)
      for (let i = 0; i < 230; i++) {
        tick(); const current = new Vector3().copy(cabin.snapshot().position)
        assert(current.distanceTo(previous) < 2.4 * dt, 'candidate entry jumped'); previous = current
        assert(!/路径被|无法保持|未形成/.test(cabin.snapshot().notice), `${name}: ${cabin.snapshot().notice}`)
      }
      assert.equal(cabin.snapshot().posture, 'resting', `${name}: ${cabin.snapshot().notice}`)
      assert.equal(cabin.snapshot().position.x, -2.390000082212169)
      assert(Math.abs(cabin.snapshot().position.y + .08) < 1e-8)
      const fixed = cabin.save(); tick(false); assert.deepEqual(cabin.save(), fixed)
      cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, fixed); select(); tick()
      assert.deepEqual(cabin.save().float.position, fixed.float.position)
      cabin.interact(); for (let i = 0; i < 210; i++) tick()
      assert.equal(cabin.snapshot().posture, 'floating', `${name}: ${cabin.snapshot().notice}`)
      const returnPoint = fixed.stations!.dock!.from
      assert(new Vector3().copy(cabin.snapshot().position).distanceTo(new Vector3().copy(returnPoint)) < 1e-7,
        `${name}: exit missed its actual contact position; a drifting click position is not the later contact position`)
      cabin.key('KeyX', true); cabin.key('KeyX', false); for (let i = 0; i < 55; i++) tick()
      assert(cabin.snapshot().float.contact, `${name}: ${cabin.snapshot().notice}`)
      cabin.dispose(); cabin = undefined
    }
  } finally { cabin?.dispose(); fabric.dispose(); disposeShipModel(asset.scene) }
})
