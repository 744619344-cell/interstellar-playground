import assert from 'node:assert/strict'
import test from 'node:test'
import { PerspectiveCamera, Vector3 } from 'three'
import { applyPan, cameraEye, cameraFov, cameraUp, overviewPose } from './cameraModel'
import { placeLabels } from './labels'
import { inSafeFrame, projectBodies, projectedOverlap, projectPoint } from './projection'
import { SYSTEM_BODIES } from './registry'
import { visualScale } from './visualScale'

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1680, height: 941 },
  { width: 1920, height: 1080 },
]

test('projection and pointer-following pan match the renderer across both poles', () => {
  const viewport = { width: 1366, height: 768 }
  const point = { x: 20, y: 8, z: -12 }
  for (const pitch of [-3, -2, -Math.PI / 2, 0, Math.PI / 2, 2, 3]) {
    const pose = { ...overviewPose(viewport), pitch }
    const eye = cameraEye(pose), up = cameraUp(pose)
    const camera = new PerspectiveCamera(cameraFov(), viewport.width / viewport.height, 0.2, 2200)
    camera.position.set(eye.x, eye.y, eye.z)
    camera.up.set(up.x, up.y, up.z)
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
    camera.updateMatrixWorld(true)
    const actual = new Vector3(point.x, point.y, point.z).project(camera)
    const projected = projectPoint(point, pose, viewport)
    assert.ok(Math.abs(projected.x - (actual.x + 1) * viewport.width / 2) < 1e-7, `x pitch ${pitch}`)
    assert.ok(Math.abs(projected.y - (1 - actual.y) * viewport.height / 2) < 1e-7, `y pitch ${pitch}`)
    const before = projectPoint(pose.target, pose, viewport)
    const after = projectPoint(pose.target, applyPan(pose, 24, 16, viewport.height), viewport)
    assert.ok(Math.abs(after.x - before.x - 24) < 1e-7, `pan x pitch ${pitch}`)
    assert.ok(Math.abs(after.y - before.y - 16) < 1e-7, `pan y pitch ${pitch}`)
  }
})

test('default overview keeps key bodies apart and inside the safe frame', () => {
  for (const viewport of VIEWPORTS) {
    const bodies = projectBodies(overviewPose(viewport), viewport)
    const byId = Object.fromEntries(bodies.map((body) => [body.id, body]))
    assert.equal(projectedOverlap(byId.sun, byId.mercury), false, `sun-mercury ${viewport.width}`)
    assert.equal(projectedOverlap(byId.earth, byId.moon), false, `earth-moon ${viewport.width}`)
    assert.ok(inSafeFrame(byId.neptune, viewport), `neptune ${viewport.width}`)
    assert.ok(inSafeFrame(byId.sun, viewport), `sun ${viewport.width}`)
    assert.equal(bodies.filter((body) => body.visible).length, 10)
  }
})

test('parent-child visual radii do not collide', () => {
  assert.ok(visualScale('sun').radius + visualScale('mercury').radius < visualScale('mercury').orbitRadius)
  assert.ok(visualScale('earth').radius + visualScale('moon').radius < visualScale('moon').orbitRadius)
})

test('earth remains visibly sized in every supported overview viewport', () => {
  for (const viewport of VIEWPORTS) {
    const earth = projectBodies(overviewPose(viewport), viewport).find((body) => body.id === 'earth')!
    assert.ok(earth.radius >= 5.5, `earth radius ${earth.radius.toFixed(2)}px at ${viewport.width}x${viewport.height}`)
  }
})

test('labels avoid other labels and planet discs', () => {
  const names = Object.fromEntries(SYSTEM_BODIES.map((body) => [body.id, body.displayName]))
  const viewport = { width: 1280, height: 720 }
  const bodies = projectBodies(overviewPose(viewport), viewport)
  const labels = placeLabels(bodies, names, viewport)
  assert.equal(labels.length, 10)
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const a = labels[i], b = labels[j]
      const overlap = Math.abs(a.x - b.x) < (a.width + b.width) / 2
        && Math.abs((a.y + a.height / 2) - (b.y + b.height / 2)) < (a.height + b.height) / 2
      assert.equal(overlap, false, `${a.id}-${b.id}`)
    }
    const label = labels[i]
    const left = label.x - label.width / 2
    for (const body of bodies.filter((body) => body.id !== label.id)) {
      const nearestX = Math.max(left, Math.min(body.x, left + label.width))
      const nearestY = Math.max(label.y, Math.min(body.y, label.y + label.height))
      assert.ok(Math.hypot(body.x - nearestX, body.y - nearestY) >= body.radius + 5, `${label.id}-${body.id}`)
    }
  }
})

test('earth label stays below earth and moon label stays away from earth', () => {
  const names = Object.fromEntries(SYSTEM_BODIES.map((body) => [body.id, body.displayName]))
  const viewport = { width: 1280, height: 720 }
  const bodies = projectBodies(overviewPose(viewport), viewport)
  const labels = placeLabels(bodies, names, viewport)
  const earth = bodies.find((body) => body.id === 'earth')!
  const moon = bodies.find((body) => body.id === 'moon')!
  const earthLabel = labels.find((label) => label.id === 'earth')!
  const moonLabel = labels.find((label) => label.id === 'moon')!
  assert.equal(earthLabel.x, earth.x)
  assert.ok(earthLabel.y > earth.y + earth.radius)
  const moonDirection = { x: moon.x - earth.x, y: moon.y - earth.y }
  const labelDirection = { x: moonLabel.x - moon.x, y: moonLabel.y + moonLabel.height / 2 - moon.y }
  assert.ok(moonDirection.x * labelDirection.x + moonDirection.y * labelDirection.y > 0)
})
