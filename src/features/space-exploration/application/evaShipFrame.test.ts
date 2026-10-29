import test from 'node:test'
import assert from 'node:assert/strict'
import { evaCabinPoint, evaCabinRotation, evaCabinVelocity, evaWorldPoint, evaWorldRotation, evaWorldVelocity, type EvaShipFrame } from './evaShipFrame'
import { distance3 } from '../domain/vec3'
import { createEvaMotion, stepEvaMotion } from '../domain/evaMotion'

const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-8, `${a} != ${b}`)
const frame: EvaShipFrame = { position: { x: 12, y: -8, z: 40 }, velocity: { x: 3, y: 1, z: -.5 }, orientation: { x: 0, y: Math.SQRT1_2, z: 0, w: Math.SQRT1_2 }, angularVelocity: { x: 0, y: 0, z: .2 } }
test('EVA conversion includes hull translation, rotation and tangential point velocity, and round trips', () => {
  const point = { x: 2, y: -.2, z: 1 }, relative = { x: .1, y: 0, z: -.3 }, world = evaWorldPoint(frame, point), velocity = evaWorldVelocity(frame, point, relative)
  assert(distance3(evaCabinPoint(frame, world), point) < 1e-8)
  assert(distance3(evaCabinVelocity(frame, point, velocity), relative) < 1e-8)
  near(velocity.x, 2.7); near(velocity.y, 1.4); near(velocity.z, -.64)
  const q = { x: .5, y: .5, z: .5, w: .5 }, restored = evaCabinRotation(frame, evaWorldRotation(frame, q))
  near(restored.x, q.x); near(restored.y, q.y); near(restored.z, q.z); near(restored.w, q.w)
})
test('an EVA body coasts in world space while a changing ship pose moves underneath it', () => {
  const point = { x: 0, y: 0, z: 7 }, velocity = evaWorldVelocity({ ...frame, angularVelocity: { x: 0, y: 0, z: 0 } }, point, { x: 0, y: 0, z: .2 })
  const initial = { ...createEvaMotion(evaWorldPoint(frame, point)), velocity }
  const anchor = { position: evaWorldPoint(frame, { x: 0, y: 0, z: 6.7 }), velocity: frame.velocity }
  const next = stepEvaMotion(initial, {}, anchor, .1)
  near(next.position.x, initial.position.x + velocity.x * .1)
  const turned = { ...frame, position: { x: 13, y: -8, z: 40 }, orientation: { x: 0, y: 0, z: 0, w: 1 } }
  assert(distance3(evaCabinPoint(turned, next.position), evaCabinPoint(frame, next.position)) > 5)
  assert.deepEqual(next.velocity, velocity); assert.equal(next.fuel, 1)
})
