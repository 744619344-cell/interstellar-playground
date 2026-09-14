import assert from 'node:assert/strict'
import test from 'node:test'
import { pickClosestSphere, pickProjectedBody, screenRay } from './systemMapPick'

test('picking hits the closer sphere along the ray', () => {
  const origin = { x: 0, y: 0, z: 10 }
  const direction = { x: 0, y: 0, z: -1 }
  const id = pickClosestSphere(origin, direction, [
    { id: 'earth', center: { x: 0, y: 0, z: 0 }, radius: 2 },
    { id: 'moon', center: { x: 0, y: 0, z: 4 }, radius: 1 }
  ])
  assert.equal(id, 'moon')
})

test('screen rays from the center look toward the target', () => {
  const ray = screenRay(0, 0, { x: 0, y: 0, z: 10 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 50, 1)
  assert.ok(ray.direction.z < 0)
  assert.ok(Math.abs(ray.direction.x) < 0.001)
})

test('projected picking gives tiny overview bodies a stable hit target', () => {
  const bodies = [
    { id: 'earth', x: 100, y: 100, radius: 3, visible: true },
    { id: 'moon', x: 140, y: 100, radius: 2, visible: true }
  ]
  assert.equal(pickProjectedBody(110, 100, bodies, 14), 'earth')
  assert.equal(pickProjectedBody(128, 100, bodies, 14), 'moon')
  assert.equal(pickProjectedBody(180, 100, bodies, 14), null)
})
