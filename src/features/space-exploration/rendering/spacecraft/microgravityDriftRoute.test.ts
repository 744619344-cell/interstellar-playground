import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { disposeShipModel } from './shipModelRuntime'

test('actual initial rail route cancels/rearms, withdraws from a close work grip, observes, pauses/rebuilds and returns by source contacts', async () => {
  const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'source_route' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  })
  let cabin = new MicrogravityCabinRuntime(asset.scene)
  const tick = (n = 1, running = true) => { for (let i = 0; i < n; i++) cabin.update(1 / 60, { forward: 0, right: 0 }, 0, true, false, running) }
  const tap = (key: string) => { cabin.key(key, true); cabin.key(key, false) }
  const push = () => { cabin.key('Space', true); tick(); cabin.key('Space', false) }
  try {
    tick(45); cabin.toggleControls(); assert.equal(cabin.snapshot().controlMode, 'inertial')
    cabin.key('ShiftLeft', true); cabin.key('ArrowRight', true); tick(42); cabin.key('ArrowRight', false); cabin.key('ShiftLeft', false)
    cabin.key('KeyW', true); cabin.key('KeyD', true); push(); cabin.key('KeyW', false); cabin.key('KeyD', false)
    tick(446); tap('KeyX'); tick(140)
    assert.equal(cabin.snapshot().float.contact?.id, 'micro-starboard-liner:rail:1')
    const arrival = cabin.snapshot().position
    assert(arrival.x > 1.9, 'regression must exercise the close main-route grip, not the wider device fixture')
    cabin.equipmentAction('micro-work', 'open'); cabin.equipmentAction('micro-work', 'study-arm')
    assert.equal(cabin.snapshot().equipment.study?.phase, 'armed')
    cabin.cancel(true); assert.equal(cabin.snapshot().equipment.study?.phase, 'cancelled')
    cabin.equipmentAction('micro-work', 'open'); cabin.equipmentAction('micro-work', 'study-arm'); push(); tick(5)
    assert.equal(cabin.snapshot().equipment.study?.phase, 'recording', 'push failed before the forearm withdrawal cleared the liner')
    cabin.cancel(); const saved = cabin.save(); tick(120, false); assert.deepEqual(cabin.save(), saved)
    cabin.dispose(); cabin = new MicrogravityCabinRuntime(asset.scene, saved); assert.deepEqual(cabin.save(), saved)
    tick(185)
    const study = cabin.snapshot().equipment.study!
    assert.equal(study.phase, 'complete', JSON.stringify({ phase: study.phase, notice: study.notice, position: cabin.snapshot().position }))
    assert(study.samples.length >= 30); assert(Math.abs(study.result!.displacement - 1.56) < .01)
    assert(Math.abs(study.result!.speedMin - .52) < 1e-6); assert(study.result!.residual < 1e-5)
    for (let i = 0; i < 500 && cabin.snapshot().position.x > -1.6; i++) tick()
    tap('KeyX'); tick(90); assert.equal(cabin.snapshot().float.contact?.id, 'micro-port-liner:rail:3')
    push()
    for (let i = 0; i < 600 && cabin.snapshot().position.x < 1.65; i++) tick()
    tap('KeyX'); tick(90); assert.equal(cabin.snapshot().float.contact?.id, 'micro-starboard-liner:rail:1')
    cabin.equipmentAction('micro-work', 'open'); assert.equal(cabin.snapshot().devicePanel?.id, 'micro-work')
    assert.equal(cabin.snapshot().equipment.study?.phase, 'complete', 'later regrasp changed the completed report')
  } finally { cabin.dispose(); disposeShipModel(asset.scene) }
})
