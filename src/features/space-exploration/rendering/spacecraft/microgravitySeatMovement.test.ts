import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MicrogravitySurfaces } from './microgravitySurfaces'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime } from './microgravityCabinRuntime'
import { seatSlideCandidate } from './seatEscapeAssist'
import { disposeShipModel } from './shipModelRuntime'
import { createCabinFloat } from '../../domain/cabinFloatMotion'

test('optional collision probe records the winning actual hit without changing movement', () => {
  const field = { probe: true, lastCollision: undefined as any, cast(a: Vector3, b: Vector3) {
    if (a.x <= 0 || b.x >= 0) return undefined
    const point = a.clone().lerp(b, a.x / (a.x - b.x))
    return { owner: { name: 'seat' }, triangle: 12, point, distance: point.distanceTo(a), normal: { x: 1, y: 0, z: 0 } }
  } } as unknown as MicrogravitySurfaces
  const points = [new Vector3(.1, 0, 0), new Vector3(.05, 0, 0)]
  const result = MicrogravitySurfaces.prototype.translate.call(field, points, { x: 0, y: 0, z: 0 }, { x: -.2, y: 0, z: 0 }, { x: -.2, y: 0, z: 0 })
  assert(Math.abs(result.position.x + .046) < 1e-9)
  assert.equal(field.lastCollision?.owner, 'seat'); assert.equal(field.lastCollision?.triangle, 12); assert.equal(field.lastCollision?.sample, 1)
  assert.equal(field.lastCollision?.point.x, .05)
  assert.deepEqual(field.lastCollision?.samples, [{ x: .1, y: 0, z: 0 }, { x: .05, y: 0, z: 0 }])
})

test('a collision preserves tangential motion without crossing a wall, and inertial mode remains unchanged', () => {
  assert(!seatSlideCandidate('')); assert(!seatSlideCandidate('?seatSlide=0')); assert(seatSlideCandidate('?seatSlide=1'))
  const wall = { cast(from: Vector3, to: Vector3) {
    if (from.x <= 0 || to.x >= 0) return undefined
    const fraction = from.x / (from.x - to.x), point = from.clone().lerp(to, fraction)
    return { point, distance: point.distanceTo(from), normal: { x: 1, y: 0, z: 0 } }
  } } as unknown as MicrogravitySurfaces
  const points = [new Vector3(.1, 0, 0)], from = { x: 0, y: 0, z: 0 }, to = { x: -.2, y: 0, z: .3 }
  const speed = { x: -.2, y: 0, z: .3 }
  const sliding = MicrogravitySurfaces.prototype.translate.call(wall, points, from, to, speed, undefined, true)
  assert(sliding.position.x > -.1); assert(sliding.position.z > .29)
  assert.equal(sliding.velocity.x, 0)
  assert(Math.hypot(sliding.velocity.x, sliding.velocity.y, sliding.velocity.z) <= Math.hypot(speed.x, speed.y, speed.z) + 1e-10)
  assert(sliding.position.length() <= Math.hypot(to.x, to.y, to.z) + 1e-10)
  const headOn = MicrogravitySurfaces.prototype.translate.call(wall, points, from,
    { x: -.2, y: 0, z: .001 }, { x: -.2, y: 0, z: .001 }, undefined, true)
  assert(Math.abs(headOn.velocity.z - .001) < 1e-10, 'tiny sideways noise must not be boosted')
  const inertial = MicrogravitySurfaces.prototype.translate.call(wall, points, from, to, speed)
  assert(inertial.position.z < .15); assert(inertial.position.x > -.1)
  const corner = { cast(a: Vector3, b: Vector3) {
    const hitX = wall.cast(a, b)
    if (a.y <= 0 || b.y >= 0) return hitX
    const point = a.clone().lerp(b, a.y / (a.y - b.y)), distance = point.distanceTo(a)
    return !hitX || distance < hitX.distance ? { point, distance, normal: { x: 0, y: 1, z: 0 } } : hitX
  } } as unknown as MicrogravitySurfaces
  const result = MicrogravitySurfaces.prototype.translate.call(corner, [new Vector3(.1, .1, 0)], from,
    { x: -.2, y: -.2, z: .3 }, { x: -.2, y: -.2, z: .3 }, undefined, true)
  assert(result.position.x > -.1 && result.position.y > -.1 && result.position.z > .29)
  const slope = { cast(a: Vector3, b: Vector3) {
    const fromSide = .6 * a.y + .8 * a.z, toSide = .6 * b.y + .8 * b.z
    if (fromSide <= 0 || toSide >= 0) return undefined
    const point = a.clone().lerp(b, fromSide / (fromSide - toSide))
    return { point, distance: point.distanceTo(a), normal: { x: 0, y: .6, z: .8 } }
  } } as unknown as MicrogravitySurfaces
  const sloped = MicrogravitySurfaces.prototype.translate.call(slope, [new Vector3(0, .1, .1)], from,
    { x: .3, y: 0, z: -.3 }, { x: .3, y: 0, z: -.3 }, undefined, true)
  assert(Math.abs(sloped.position.y) < 1e-10); assert(sloped.position.x > .29)
  assert(.6 * (.1 + sloped.position.y) + .8 * (.1 + sloped.position.z) > 0)
})

test('actual seat source permits lateral escape from the reported position and camera orientation', async () => {
  const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'seat_control_source' } })
  const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
    const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '')
  })
  const float = createCabinFloat({ x: -.6814494406519505, y: -.7074372655819307, z: -3.6401887568211824 })
  float.orientation = { x: .000023207919430950093, y: .3676821111041187, z: -.00004579504541612472, w: .9299515377363622 }
  const cabin = new MicrogravityCabinRuntime(asset.scene, { float }, true)
  try {
    const initial = cabin.snapshot().position; cabin.key('ArrowLeft', true)
    for (let i = 0; i < 72; i++) cabin.update(1 / 60, { forward: 0, right: 0 }, -1.9139981428729482, true, false, true)
    cabin.key('ArrowLeft', false); const end = cabin.snapshot().position
    const moved = Math.hypot(end.x - initial.x, end.y - initial.y, end.z - initial.z)
    assert(moved > .12, `movement ${moved.toFixed(4)} m; ${JSON.stringify(end)}`)
    assert((end.x - initial.x) * .336 - (end.z - initial.z) * .942 > .04, `wrong-way movement: ${JSON.stringify(end)}`)
  } finally { cabin.dispose(); disposeShipModel(asset.scene) }
})
