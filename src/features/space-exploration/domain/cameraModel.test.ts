import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyOrbitDrag, applyPan, applyZoom, cameraEye, cameraUp, clonePose, focusPose, MAX_DISTANCE, MIN_DISTANCE,
  fitOverviewDistance, overviewPose, startTransition, stepTransition
} from './cameraModel'
import { visualScale } from './visualScale'

test('overview pose looks at the system origin from a safe distance', () => {
  const pose = overviewPose()
  assert.deepEqual(pose.target, { x: 0, y: 0, z: 0 })
  assert.ok(pose.distance > 200)
  const eye = cameraEye(pose)
  assert.ok(eye.z > 0)
  assert.ok(eye.y > 0)
})

test('overview distance expands the system while fitting supported desktop viewports', () => {
  const design = fitOverviewDistance({ width: 1680, height: 941 })
  const minimum = fitOverviewDistance({ width: 1280, height: 720 })
  assert.ok(design > 0)
  assert.ok(minimum > design)
  assert.ok(minimum < MAX_DISTANCE)
})

test('dragging right decreases yaw so the map follows the pointer', () => {
  const pose = overviewPose()
  const dragged = applyOrbitDrag(pose, 40, 0)
  assert.ok(dragged.yaw < pose.yaw)
  const down = applyOrbitDrag(pose, 0, 30)
  assert.ok(down.pitch > pose.pitch)
})

test('vertical orbit can pass both poles and keeps a stable camera up vector', () => {
  const pose = overviewPose()
  const overNorthPole = applyOrbitDrag(pose, 0, 500)
  const overSouthPole = applyOrbitDrag(pose, 0, -700)
  assert.ok(overNorthPole.pitch > Math.PI / 2)
  assert.ok(overSouthPole.pitch < -Math.PI / 2)
  for (const rotated of [overNorthPole, overSouthPole]) {
    const up = cameraUp(rotated)
    assert.ok(Math.abs(Math.hypot(up.x, up.y, up.z) - 1) < 1e-9)
  }
})

test('zoom is clamped and scrolling down moves farther away', () => {
  const pose = overviewPose()
  const out = applyZoom(pose, 400)
  const inn = applyZoom(pose, -400)
  assert.ok(out.distance > pose.distance)
  assert.ok(inn.distance < pose.distance)
  assert.equal(applyZoom({ ...pose, distance: 0.5 }, 0).distance, MIN_DISTANCE)
  assert.equal(applyZoom({ ...pose, distance: 9000 }, 0).distance, MAX_DISTANCE)
})

test('ctrl drag pan makes the scene follow the pointer without changing orbit', () => {
  const pose = overviewPose()
  const horizontal = applyPan(pose, 80, 0, 768)
  const vertical = applyPan(pose, 0, 80, 768)
  assert.equal(horizontal.yaw, pose.yaw)
  assert.equal(horizontal.pitch, pose.pitch)
  assert.equal(horizontal.distance, pose.distance)
  assert.notDeepEqual(horizontal.target, pose.target)
  assert.notDeepEqual(vertical.target, pose.target)
})

test('focus fills most of the viewport without crossing the body surface', () => {
  const overview = overviewPose()
  for (const id of ['earth', 'moon', 'saturn'] as const) {
    const focused = focusPose(id, overview)
    const scale = visualScale(id)
    assert.ok(focused.distance < overview.distance)
    assert.ok(focused.distance > Math.max(scale.radius, scale.ringOuter ?? 0))
  }
})

test('focus and overview transitions are interruptible without snapping past done', () => {
  const overview = overviewPose()
  const earth = focusPose('earth', overview)
  const first = startTransition(overview, earth, 1)
  const mid = stepTransition(first, 0.2)
  assert.equal(mid.done, false)
  const moon = focusPose('moon', mid.pose)
  const second = startTransition(mid.pose, moon, 2)
  assert.equal(second.generation, 2)
  const done = stepTransition(second, 2)
  assert.equal(done.done, true)
  assert.ok(Math.abs(clonePose(done.pose).distance - moon.distance) < 1e-9)
})
