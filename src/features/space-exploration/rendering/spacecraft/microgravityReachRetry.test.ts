import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { disposeShipModel } from './shipModelRuntime'

test('actual rail drift: canceled sleep entry can retry after 0.44s without losing reach, inertia or a continuous exit', async () => {
  const loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'actual_source_geometry' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const bytes = await readFile(new URL(url))
    return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  })
  let cabin: MicrogravityCabinRuntime | undefined
  try {
    for (const dt of [1 / 55, 1 / 30, .05]) {
      cabin = new MicrogravityCabinRuntime(asset.scene)
      const tick = (running = true) => cabin!.update(dt, { forward: 0, right: 0 }, 0, true, false, running)
      for (let i = 0; i < 240; i++) tick()
      cabin.toggleControls(); assert.equal(cabin.snapshot().controlMode, 'inertial')
      cabin.nudgeMove(1, 0)
      for (let i = 0; i < 180 && cabin.snapshot().prompt?.deviceId !== 'micro-sleep-2'; i++) tick()
      assert.equal(cabin.snapshot().prompt?.deviceId, 'micro-sleep-2')
      cabin.interact(); tick()
      assert.equal(cabin.snapshot().posture, 'reaching')
      const beforeCancel = cabin.save().float
      cabin.cancel(true)
      assert.deepEqual(cabin.save().float, beforeCancel, 'cancel must not brake, teleport or catch an absent contact')
      for (let i = 0; i < Math.round((24 / 55) / dt); i++) tick()
      assert.equal(cabin.snapshot().prompt?.deviceId, 'micro-sleep-2', `dt=${dt}: retry prompt lost`)
      const beforeRetry = cabin.save().float
      cabin.interact()
      assert.equal(cabin.snapshot().posture, 'reaching')
      assert.deepEqual(cabin.save().float, beforeRetry, 'selecting a contact must leave inertial state unchanged')
      let previous = new Vector3().copy(cabin.snapshot().position)
      for (let i = 0; i < Math.ceil(4 / dt); i++) {
        tick(); const position = new Vector3().copy(cabin.snapshot().position)
        // Preserve the existing 4cm / 60Hz continuity bound across these slower frame rates.
        assert(position.distanceTo(previous) < 2.4 * dt, `dt=${dt}: entry moved discontinuously by ${position.distanceTo(previous)}m`)
        assert(!/无法保持|未形成|路径被/.test(cabin.snapshot().notice), cabin.snapshot().notice)
        previous = position
      }
      assert.equal(cabin.snapshot().posture, 'resting', `dt=${dt}: ${cabin.snapshot().notice}`)
      const paused = cabin.save(); for (let i = 0; i < 4; i++) tick(false)
      assert.deepEqual(cabin.save(), paused)
      cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, paused)
      assert.deepEqual(cabin.save(), paused)
      tick(); cabin.interact()
      for (let i = 0; i < Math.ceil(3.5 / dt); i++) tick()
      assert.equal(cabin.snapshot().posture, 'floating')
      cabin.key('KeyX', true); cabin.key('KeyX', false)
      for (let i = 0; i < Math.ceil(1 / dt); i++) tick()
      assert(cabin.snapshot().float.contact, `dt=${dt}: ${cabin.snapshot().notice}`)
      cabin.dispose(); cabin = undefined
      const fast = structuredClone(paused)
      fast.float = { ...beforeRetry, velocity: { x: 0, y: 0, z: -.66 }, contact: undefined, fixed: undefined }
      fast.stations = { checked: [] }
      cabin = new MicrogravityCabinRuntime(asset.scene, fast)
      assert.notEqual(cabin.snapshot().prompt?.id, 'bed', 'a too-fast drift must not advertise sleep entry')
      cabin.interact()
      assert.notEqual(cabin.snapshot().posture, 'docking')
      assert.equal(cabin.snapshot().float.fixed, undefined)
      assert.deepEqual(cabin.snapshot().float.velocity, fast.float.velocity)
      cabin.dispose(); cabin = undefined
    }
  } finally { cabin?.dispose(); disposeShipModel(asset.scene) }
})
