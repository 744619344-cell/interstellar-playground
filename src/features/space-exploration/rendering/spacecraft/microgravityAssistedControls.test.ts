import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { disposeShipModel } from './shipModelRuntime'
import { createCabinFloat } from '../../domain/cabinFloatMotion'

test('actual source: unsupported stopped crew moves, hits structure, reverses away, turns, brakes and reloads', async () => {
  const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'actual_assisted_controls' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  })
  // Explicit read-only fixture from the user's failed location, not a main-game route/teleport claim.
  let cabin = new MicrogravityCabinRuntime(asset.scene, { float: createCabinFloat({ x: .26804849, y: -.82331903, z: -.10863804 }) })
  const tick = (n = 1, running = true) => { for (let i = 0; i < n; i++) cabin.update(1 / 60, { forward: 0, right: 0 }, 0, true, false, running) }
  const hold = (code: string, frames: number) => { cabin.key(code, true); tick(frames); cabin.key(code, false) }
  try {
    tick(); assert.equal(cabin.snapshot().controlMode, 'assisted'); assert(!cabin.snapshot().float.contact)
    const before = cabin.snapshot().position; hold('ArrowRight', 60)
    assert(cabin.snapshot().position.x > before.x + .25, JSON.stringify(cabin.snapshot().float))
    let collided = false; cabin.key('ArrowRight', true)
    for (let i = 0; i < 240; i++) { tick(); collided ||= cabin.snapshot().blocked }
    cabin.key('ArrowRight', false); assert(collided, 'fixture never reached actual structure')
    const stopped = cabin.snapshot().position; hold('ArrowLeft', 75)
    assert(cabin.snapshot().position.x < stopped.x - .3, JSON.stringify(cabin.snapshot().float))
    hold('KeyB', 30); assert(Math.hypot(...Object.values(cabin.snapshot().float.velocity)) < 1e-6)
    const facing = cabin.snapshot().float.orientation; hold('KeyE', 50); tick(20)
    const turned = cabin.snapshot().float.orientation
    assert(Math.abs(facing.x * turned.x + facing.y * turned.y + facing.z * turned.z + facing.w * turned.w) < .95, 'unsupported orientation input did not turn the crew')
    const saved = cabin.save(); cabin.key('ArrowUp', true); tick(10, false); assert.deepEqual(cabin.save(), saved)
    cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, saved); assert.deepEqual(cabin.save(), saved)
    const reloaded = cabin.snapshot().position; hold('ArrowDown', 55)
    assert(cabin.snapshot().position.z > reloaded.z + .2, 'default assisted controls lost after reload')
    cabin.key('KeyW', true); tick(15); cabin.clearInput(); tick(60)
    assert(Math.hypot(...Object.values(cabin.snapshot().float.velocity)) < 1e-6, 'canvas blur left movement held')
    cabin.toggleControls(); assert.equal(cabin.snapshot().controlMode, 'inertial')
    hold('Space', 30); const coast = cabin.snapshot().float.velocity
    hold('ArrowUp', 20)
    assert(Math.hypot(...Object.values(cabin.snapshot().float.velocity)) <= Math.hypot(...Object.values(coast)) + 1e-8, 'inertial input added propulsion; source collisions may remove velocity')
  } finally { cabin.dispose(); disposeShipModel(asset.scene) }
})
