import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { disposeShipModel } from './shipModelRuntime'

test('real initial rail accepts an arrow-only push and the nearby sleep bay no longer folds ordinary orbit', async () => {
  const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'source_controls' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  })
  const cabin = new MicrogravityCabinRuntime(asset.scene)
  const tick = (n = 1, running = true) => { for (let i = 0; i < n; i++) cabin.update(1 / 60, { forward: 0, right: 0 }, 0, true, false, running) }
  try {
    tick(45); cabin.toggleControls(); assert.equal(cabin.snapshot().controlMode, 'inertial'); assert(cabin.snapshot().float.contact)
    const before = cabin.save(), inboard = cabin.camera(Math.PI / 2, .22)!, opposite = cabin.camera(-Math.PI / 2, .22)!
    assert(inboard.position.x > inboard.target.x + .2)
    assert(opposite.position.x < opposite.target.x - .02, 'nearby bed still folded the opposite orbit into the inboard half')
    for (let i = 0; i < 24; i++) {
      const view = cabin.camera(i * Math.PI / 12, .22)!
      assert([...Object.values(view.position), ...Object.values(view.target)].every(Number.isFinite))
    }
    assert.deepEqual(cabin.save(), before, 'observing changed the body or restraint')
    cabin.key('ArrowRight', true); tick(60); cabin.key('ArrowRight', false)
    const pushed = cabin.snapshot().float
    assert(!pushed.contact); assert(pushed.position.x > before.float.position.x + .35, JSON.stringify(pushed))
    assert(Math.abs(pushed.velocity.x - .52) < 1e-6)
    tick(30); assert(cabin.snapshot().position.x > pushed.position.x + .2)
    assert.deepEqual(cabin.snapshot().float.velocity, pushed.velocity)
    const saved = cabin.save(); cabin.key('ArrowLeft', true); tick(10, false)
    assert.deepEqual(cabin.save(), saved, 'pause advanced the new key mapping')
  } finally { cabin.dispose(); disposeShipModel(asset.scene) }
})
