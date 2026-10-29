import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createCabinFloat } from '../../domain/cabinFloatMotion'
import { createEvaProcedure } from '../../domain/evaProcedure'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { disposeShipModel } from './shipModelRuntime'

// Explicit phase fixtures exercise the actual source bodies/doors/cable; they do not certify a continuous journey.
test('actual-source phase fixtures: attached indoor coasting has no RCS; outside control consumes fuel and obeys the cable length', async () => {
  const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'actual_source' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  })
  let cabin: MicrogravityCabinRuntime | undefined
  try {
    const base = { ...createEvaProcedure(), suit: 'ready' as const, location: 'lock' as const, tether: true,
      checks: { helmet: true, seal: true, oxygen: true, battery: true, lifeSupport: true } }
    cabin = new MicrogravityCabinRuntime(asset.scene, { float: { ...createCabinFloat({ x: 0, y: -.2, z: 5.5 }), velocity: { x: .03, y: 0, z: -.05 } }, eva: base })
    const tick = (n: number, running = true) => { for (let i = 0; i < n; i++) cabin!.update(.05, { forward: 0, right: 0 }, 0, true, false, running) }
    tick(1); const indoor = cabin.save(); cabin.key('KeyS', true); tick(20); cabin.key('KeyS', false)
    assert.equal(cabin.snapshot().tether.fuel, 1, 'indoor directional input spent RCS fuel')
    assert(Math.abs(cabin.snapshot().float.velocity.z - indoor.float.velocity.z) < 1e-6)
    const paused = cabin.save(); tick(5, false); assert.deepEqual(cabin.save(), paused)
    cabin.dispose()
    // 7.9 m at this height intersects the source aft roof; its failed diagnosis is retained in the evidence folder.
    // Begin this independent flight fixture beyond that roof, rather than disabling the real hull collision.
    cabin = new MicrogravityCabinRuntime(asset.scene, { float: { ...createCabinFloat({ x: 0, y: -.2, z: 9.5 }), velocity: { x: 0, y: 0, z: .2 } },
      eva: { ...base, location: 'outside', pressure: 'vacuum', outerOpen: true },
      doors: { inner: { progress: 0, target: 0, blocked: false }, outer: { progress: 1, target: 1, blocked: false } } })
    tick(1); const before = cabin.snapshot(); assert(before.tether.clear, before.notice)
    cabin.key('KeyS', true); tick(100); cabin.key('KeyS', false)
    const driven = cabin.snapshot(); assert(driven.position.z > before.position.z + 1, JSON.stringify({ before: before.position, after: driven.position, velocity: driven.float.velocity, notice: driven.notice, tether: driven.tether }))
    assert(driven.tether.fuel < 1 && driven.float.velocity.z > .7, JSON.stringify(driven.tether))
    tick(20); assert(Math.abs(cabin.snapshot().float.velocity.z - driven.float.velocity.z) < 1e-6, 'free EVA lost inertia')
    tick(200); const extended = cabin.snapshot()
    assert(extended.tether.deployed <= extended.tether.lineLength + .005, JSON.stringify(extended.tether))
    assert(extended.tether.taut, JSON.stringify(extended.tether)); assert(Math.abs(extended.float.velocity.z) < .01)
    const saved = cabin.save(); cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, saved)
    assert(new Vector3().copy(cabin.snapshot().position).distanceTo(new Vector3().copy(saved.float.position)) < 1e-9)
    assert.equal(cabin.snapshot().eva.tether, true); assert.equal(cabin.snapshot().eva.suit, 'ready')
    tick(1); cabin.evaAction('wear'); assert.equal(cabin.snapshot().eva.suit, 'ready', 'outside action removed suit')
  } finally { cabin?.dispose(); disposeShipModel(asset.scene) }
})
