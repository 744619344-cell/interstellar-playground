import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Mesh, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { MicrogravitySurfaces } from './microgravitySurfaces'
import { MicrogravityStations } from './microgravityStations'
import { createCabinFloat } from '../../domain/cabinFloatMotion'
import { disposeShipModel } from './shipModelRuntime'

test('actual closed locker leaf is its viewable front, while unrelated structure still occludes the panel', async () => {
  const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'closed_locker_prompt' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  }, undefined, undefined, { lockerDoors: true })
  // Explicit static fixture from the independently recorded production arrival; no in-game teleport.
  const position = { x: .5090343668956694, y: .17098426650200294, z: 2.1339851262076954 }
  const cabin = new MicrogravityCabinRuntime(asset.scene, { float: createCabinFloat(position) })
  const surfaces = new MicrogravitySurfaces(asset.scene), stations = new MicrogravityStations(asset.scene, surfaces)
  try {
    cabin.update(1 / 60, { forward: 0, right: 0 }, 0, true, false, true)
    assert.equal(cabin.snapshot().prompt?.deviceId, 'micro-locker')
    cabin.interact(); assert.equal(cabin.snapshot().devicePanel?.id, 'micro-locker')
    assert(!cabin.snapshot().float.contact, 'a viewable door must not create an imaginary grasp')
    const cast = surfaces.cast.bind(surfaces)
    let occluder: Mesh | undefined
    asset.scene.getObjectByName('micro-work')!.traverse(o => { if (o instanceof Mesh) occluder ??= o }); assert(occluder)
    // Visibility-only counterexample with an existing unrelated source owner; collision is never changed in the game.
    surfaces.cast = () => ({ distance: .1, point: new Vector3(.6, .47, 2.13), normal: new Vector3(-1, 0, 0), owner: occluder!, triangle: 0 })
    assert(!stations.near('micro-locker', position), 'unrelated equipment stopped occluding the locker')
    surfaces.cast = cast
    assert(stations.near('micro-locker', position)); assert(!stations.near('micro-locker', { x: -4, y: 0, z: 2 }))
    cabin.interact(); assert.equal(cabin.snapshot().devicePanel, undefined)
  } finally { stations.dispose(); surfaces.dispose(); cabin.dispose(); disposeShipModel(asset.scene) }
})
