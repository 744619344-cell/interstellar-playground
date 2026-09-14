import test from 'node:test'
import assert from 'node:assert/strict'
import { ShipCameraRig, SHIP_CAMERA } from './shipCameraRig'
import { createShipFlightState } from '../domain/shipFlightModel'
import { constrainShipCamera } from '../domain/shipCameraCollision'
import { dampCameraDirection } from '../domain/shipCameraDirection'
import { distance3, dot3, length3, normalize3, scale3, sub3 } from '../domain/vec3'

const close = (a: number, b: number, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`)
const origin = { x: 0, y: 0, z: 0 }

test('camera begins behind and above ship, translating exactly with the subject', () => {
  const subject = createShipFlightState(), rig = new ShipCameraRig(subject)
  const before = rig.snapshot()
  close(distance3(before.position, origin), 24)
  assert.ok(before.position.z > 0 && before.position.y > 0)
  subject.position = { x: 10000, y: 500, z: -800 }
  const after = rig.update(subject, 1 / 60)
  close(distance3(sub3(after.position, subject.position), before.position), 0)
})

test('follow rotates to the ship heading with damping instead of snapping', () => {
  const subject = createShipFlightState(), rig = new ShipCameraRig(subject)
  subject.orientation = { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }
  const first = rig.update(subject, 1 / 60)
  assert.ok(first.position.x > 0 && first.position.x < 10)
  for (let i = 0; i < 240; i++) rig.update(subject, 1 / 60)
  assert.ok(rig.snapshot().position.x > 23)
  close(rig.snapshot().position.z, 0, 1e-6)
})

test('free observation keeps its reference while ship rotates, without modifying the subject', () => {
  const subject = createShipFlightState(), rig = new ShipCameraRig(subject)
  rig.setMode('free')
  const before = rig.snapshot()
  subject.orientation = { x: 0, y: 1, z: 0, w: 0 }
  const saved = structuredClone(subject)
  const after = rig.update(subject, 0.1)
  close(distance3(before.position, after.position), 0)
  rig.orbit(0.5, 0.4)
  rig.update(subject, 0.1)
  assert.deepEqual(subject, saved)
})

test('mode switches preserve the current pose and then return smoothly to follow', () => {
  const subject = createShipFlightState(), rig = new ShipCameraRig(subject)
  rig.setMode('free'); rig.orbit(2, 0.5)
  for (let i = 0; i < 120; i++) rig.update(subject, 1 / 60)
  const before = rig.snapshot().position
  rig.setMode('follow')
  assert.deepEqual(rig.snapshot().position, before)
  const after = rig.update(subject, 1 / 120).position
  assert.ok(distance3(before, after) > 0 && distance3(before, after) < 4)
})

test('orbit avoids poles and permits full observation in follow and free modes', () => {
  const rig = new ShipCameraRig(createShipFlightState())
  rig.orbit(2, 100)
  close(rig.snapshot().yaw, 2)
  close(rig.snapshot().pitch, SHIP_CAMERA.pitchLimit)
  rig.setMode('free'); rig.orbit(1, -100)
  assert.ok(rig.snapshot().yaw > SHIP_CAMERA.followYawLimit)
  close(rig.snapshot().pitch, -SHIP_CAMERA.pitchLimit)
})

test('zoom is bounded; invalid controls and elapsed time cannot corrupt the pose', () => {
  const subject = createShipFlightState(), rig = new ShipCameraRig(subject)
  rig.zoom(1000); close(rig.snapshot().requestedDistance, 64)
  rig.zoom(-1000); close(rig.snapshot().requestedDistance, 14)
  rig.update(subject, 0.1)
  const before = rig.snapshot()
  rig.zoom(NaN); rig.orbit(Infinity, NaN)
  for (const dt of [NaN, Infinity, -1, 0]) rig.update(subject, dt)
  assert.deepEqual(rig.snapshot(), before)
})

test('sphere sweep stops before the nearest obstacle independent of array order', () => {
  const far = { center: { x: 0, y: 0, z: 15 }, radius: 2 }
  const near = { center: { x: 0, y: 0, z: 8 }, radius: 1 }
  const a = constrainShipCamera(origin, { x: 0, y: 0, z: 24 }, [far, near])
  const b = constrainShipCamera(origin, { x: 0, y: 0, z: 24 }, [near, far])
  close(a.distance, 6.63); assert.deepEqual(a, b)
  assert.ok(a.occluded && !a.blocked)
})

test('sweep ignores obstacles behind target or beyond camera and handles tangency', () => {
  const result = constrainShipCamera(origin, { x: 0, y: 0, z: 24 }, [
    { center: { x: 0, y: 0, z: -5 }, radius: 1 },
    { center: { x: 0, y: 0, z: 30 }, radius: 1 }
  ])
  close(result.distance, 24)
  const tangent = constrainShipCamera(origin, { x: 0, y: 0, z: 24 }, [
    { center: { x: 1.35, y: 0, z: 10 }, radius: 1 }
  ])
  assert.ok(tangent.distance < 10)
})

test('camera contracts immediately and recovers slowly when obstacle clears', () => {
  const subject = createShipFlightState(), rig = new ShipCameraRig(subject)
  const direction = normalize3(rig.snapshot().position)
  const obstacles = [{ center: scale3(direction, 10), radius: 2 }]
  const closePose = rig.update(subject, 1 / 120, obstacles)
  close(closePose.distance, 7.63)
  assert.ok(closePose.occluded)
  const recovery = rig.update(subject, 1 / 120)
  assert.ok(recovery.distance > 7.63 && recovery.distance < 10)
  for (let i = 0; i < 240; i++) rig.update(subject, 1 / 60)
  close(rig.snapshot().distance, 24, 1e-6)
})

test('target inside obstacle reports blocked, including zero-length booms', () => {
  const obstacles = [{ center: origin, radius: 2 }]
  for (const desired of [origin, { x: 0, y: 0, z: 24 }]) {
    const result = constrainShipCamera(origin, desired, obstacles)
    assert.ok(result.blocked); close(result.distance, 0)
    assert.deepEqual(result.position, origin)
  }
})

test('opposite orbit directions move along an arc rather than getting stuck', () => {
  let direction = { x: 0, y: 0, z: 1 }
  const goal = { x: 0, y: 0, z: -1 }
  direction = dampCameraDirection(direction, goal, 0.1)
  assert.ok(direction.x > 0)
  for (let i = 0; i < 200; i++) direction = dampCameraDirection(direction, goal, 0.1)
  close(distance3(direction, goal), 0, 1e-6)
})

test('up remains normalized and perpendicular during inverted flight', () => {
  const subject = createShipFlightState(), rig = new ShipCameraRig(subject)
  subject.orientation = { x: 0, y: 0, z: 1, w: 0 }
  for (let i = 0; i < 240; i++) {
    const pose = rig.update(subject, 1 / 60)
    close(length3(pose.up), 1)
    close(dot3(pose.up, normalize3(sub3(pose.position, pose.target))), 0)
  }
  assert.ok(rig.snapshot().up.y < -0.9)
})

test('returned vectors are isolated from internal camera state', () => {
  const rig = new ShipCameraRig(createShipFlightState())
  const expected = rig.snapshot(), exposed = rig.snapshot()
  exposed.position.x = 999; exposed.target.y = 999; exposed.up.z = 999
  assert.deepEqual(rig.snapshot(), expected)
})
