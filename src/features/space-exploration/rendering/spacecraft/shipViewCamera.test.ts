import test from 'node:test'
import assert from 'node:assert/strict'
import { Quaternion, Vector3 } from 'three'
import { ShipViewCamera, nextShipView } from './shipViewCamera'
const subject = () => ({ position: { x: 3, y: 4, z: 5 }, orientation: { x: 0, y: 0, z: 0, w: 1 } })
const settle = (camera: ShipViewCamera, ship = subject(), fps = 60) => {
  for (let i = 0; i < fps; i++) camera.update(ship, 1 / fps)
  return camera.snapshot()
}
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('seat follows translated and rotated ship exactly without mutating flight state', () => {
  const ship = subject()
  ship.orientation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2)
  const original = structuredClone(ship)
  const camera = new ShipViewCamera(ship)
  camera.setMode('cockpit')
  const pose = settle(camera, ship)
  near(pose.position.x, 1); near(pose.position.y, 4.8); near(pose.position.z, 5)
  near(pose.target.x - pose.position.x, -1)
  near(pose.target.z - pose.position.z, 0)
  assert.deepEqual(structuredClone(ship), original)
})
test('cockpit accepts mouse look, keeps seat position and cycles all modes', () => {
  const camera = new ShipViewCamera(subject())
  camera.setMode('cockpit'); const before = settle(camera)
  camera.orbit(4, 2); camera.zoom(200)
  const after = settle(camera)
  assert.deepEqual(after.position, before.position)
  assert.notDeepEqual(after.target, before.target)
  assert.equal(after.requestedDistance, before.requestedDistance)
  assert.equal(after.interiorFov, 85)
  camera.zoom(-1000); assert.equal(camera.snapshot().interiorFov, 35)
  camera.zoom(NaN); assert.equal(camera.snapshot().interiorFov, 35)
  camera.setMode('free'); assert.equal(settle(camera).mode, 'free')
  assert.deepEqual(['follow', 'cockpit', 'cabin', 'free'].map((v) => nextShipView(v as 'follow' | 'cockpit' | 'cabin' | 'free')), ['cockpit', 'cabin', 'free', 'follow'])
})

test('movement basis follows the current mouse view direction', () => {
  const camera = new ShipViewCamera(subject())
  const before = camera.movementBasis()
  camera.orbit(Math.PI / 2, -0.22)
  settle(camera)
  const after = camera.movementBasis()
  assert.ok(before.forward.z < -0.9)
  assert.ok(after.forward.x < -0.9)
  near(Math.hypot(after.right.x, after.right.y, after.right.z), 1)
})
test('sitting after looking aft restores the forward cockpit view through a continuous transition',()=>{
  const camera=new ShipViewCamera(subject())
  camera.setMode('cabin');camera.lookAft();const aft=settle(camera)
  assert(aft.target.z>aft.position.z)
  camera.setMode('cockpit');assert.deepEqual(camera.snapshot().position,aft.position)
  const seated=settle(camera)
  assert(seated.target.z<seated.position.z)
  near(seated.yaw,0)
  camera.orbit(.2,0);assert.notEqual(camera.snapshot().yaw,0,'subsequent look remains available')
})
test('switch and rapid interruption keep current pose; transitions finish at all frame rates', () => {
  for (const fps of [30, 60, 120]) {
    const camera = new ShipViewCamera(subject())
    const before = camera.snapshot()
    camera.setMode('cockpit')
    assert.deepEqual(camera.snapshot().position, before.position)
    camera.update(subject(), 0.2)
    const partial = camera.snapshot()
    assert.ok(partial.transitioning)
    camera.setMode('free')
    assert.deepEqual(camera.snapshot().position, partial.position)
    camera.setMode('cockpit')
    const result = settle(camera, subject(), fps)
    assert.equal(result.transitioning, false)
    near(result.position.z, 3)
    for (const value of [...Object.values(result.position), ...Object.values(result.up)]) assert.ok(Number.isFinite(value))
  }
})
test('inside seat/body transitions keep cabin geometry visible without changing exterior transition rules',()=>{
  const camera=new ShipViewCamera(subject())
  camera.setMode('cockpit');assert.equal(camera.snapshot().interiorTransition,false)
  settle(camera);camera.setMode('cabin');assert.equal(camera.snapshot().interiorTransition,true)
  settle(camera);assert.equal(camera.snapshot().interiorTransition,false)
  camera.setMode('free');assert.equal(camera.snapshot().interiorTransition,false)
})

test('invalid elapsed time freezes transition and snapshots cannot change internal pose', () => {
  const camera = new ShipViewCamera(subject()); camera.setMode('cockpit')
  const before = camera.snapshot()
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(camera.update(subject(), dt), before)
  camera.snapshot().position.x = 999
  assert.deepEqual(camera.snapshot(), before)
})
test('view transition remains constrained by sphere obstacles', () => {
  const camera = new ShipViewCamera(subject()); camera.setMode('cockpit')
  const pose = camera.update(subject(), 0.01, [{ center: { x: 3, y: 4, z: 5 }, radius: 2 }])
  assert.equal(pose.blocked, true)
})
