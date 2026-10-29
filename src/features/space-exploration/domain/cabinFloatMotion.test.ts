import test from 'node:test'
import assert from 'node:assert/strict'
import { createCabinFloat, catchCabinFloat, stepCabinFloat, fixCabinFloat, releaseCabinFloat } from './cabinFloatMotion'
const near = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`)
const origin = { x: 0, y: 0, z: 0 }, touch = { id: 'source-rail', point: { x: -.5, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } }
test('free indoor input cannot create thrust, drag or automatic angular braking', () => {
  let s = { ...createCabinFloat(origin), velocity: { x: .2, y: -.1, z: .3 }, angularVelocity: { x: 0, y: .2, z: 0 } }
  for (let i = 0; i < 100; i++) s = stepCabinFloat(s, { forward: 1, up: 1, yaw: 1 }, {}, .1)
  near(s.position.x, 2); near(s.position.y, -1); near(s.position.z, 3); near(s.velocity.x, .2); near(s.angularVelocity.y, .2)
})
test('catch requires real, reachable skin contact and bounded approach speed', () => {
  const s = createCabinFloat(origin)
  assert.equal(catchCabinFloat(s, touch, origin).contact, undefined)
  assert.equal(catchCabinFloat(s, { ...touch, point: { x: -2, y: 0, z: 0 } }, { x: -2, y: 0, z: 0 }).contact, undefined)
  assert.equal(catchCabinFloat({ ...s, velocity: { x: 1, y: 0, z: 0 } }, touch, touch.point).contact, undefined)
  assert.equal(catchCabinFloat(s, touch, touch.point).contact?.id, touch.id)
})
test('only a real grasp damps velocity and enables outward push; release preserves inertia', () => {
  let s = catchCabinFloat({ ...createCabinFloat(origin), velocity: { x: .1, y: 0, z: 0 } }, touch, touch.point)
  for (let i = 0; i < 5; i++) s = stepCabinFloat(s, {}, {}, .1)
  assert.ok(s.velocity.x < .001); const rejected = stepCabinFloat(s, { push: true, right: -1 }, {}, .01)
  assert.ok(rejected.contact); const pushed = stepCabinFloat(s, { push: true, right: 1 }, {}, .01)
  assert.equal(pushed.contact, undefined); near(pushed.velocity.x, .52)
  const free = stepCabinFloat(releaseCabinFloat(pushed), { right: -1 }, {}, .1); near(free.velocity.x, .52)
})
test('ship acceleration and rotating-frame forces act without player input', () => {
  const a = stepCabinFloat(createCabinFloat(origin), {}, { acceleration: { x: 1, y: 0, z: 0 } }, .1)
  near(a.velocity.x, -.1)
  const rotating = stepCabinFloat(createCabinFloat({ x: 2, y: 0, z: 0 }), {}, { angularVelocity: { x: 0, y: 0, z: 1 } }, .01)
  assert.ok(rotating.velocity.x > 0); assert.ok(rotating.orientation.z < 0)
})
test('a verified grasped handrail permits tangent push without inventing normal velocity', () => {
  let rail = catchCabinFloat(createCabinFloat(origin), { ...touch, kind: 'handrail' }, touch.point)
  for (let i = 0; i < 40; i++) rail = stepCabinFloat(rail, {}, {}, 1 / 60)
  const forward = stepCabinFloat(rail, { push: true, forward: 1 }, {}, .01)
  near(forward.velocity.x, 0); near(forward.velocity.z, -.52); assert(!forward.contact)
  assert(stepCabinFloat(rail, { push: true, right: -1 }, {}, .01).contact)
  let wall = catchCabinFloat(createCabinFloat(origin), touch, touch.point)
  for (let i = 0; i < 40; i++) wall = stepCabinFloat(wall, {}, {}, 1 / 60)
  assert(stepCabinFloat(wall, { push: true, forward: 1 }, {}, .01).velocity.x > .1)
})
test('contact permits attitude torque but free flight retains acquired spin', () => {
  let s = catchCabinFloat(createCabinFloat(origin), touch, touch.point)
  for (let i = 0; i < 5; i++) s = stepCabinFloat(s, { yaw: 1 }, {}, .1)
  assert.ok(s.angularVelocity.y > .4); const released = releaseCabinFloat(s),next = stepCabinFloat(released, { yaw: -1 }, {}, .1)
  near(next.angularVelocity.y, released.angularVelocity.y)
})
test('collision adapter is substepped and can remove normal velocity while preserving tangent', () => {
  let calls = 0
  const s = stepCabinFloat({ ...createCabinFloat(origin), velocity: { x: 2, y: .3, z: 0 } }, {}, {}, .1, (_from,p,v) => {
    calls++; return p.x > .05 ? { position: { ...p, x: .05 }, velocity: { ...v, x: 0 } } : { position: p, velocity: v }
  })
  assert.ok(calls >= 12); near(s.position.x, .05); near(s.velocity.x, 0); near(s.velocity.y, .3)
})
test('restraints reject remote docking; pause and frame-gap guards preserve valid state', () => {
  const s = createCabinFloat(origin),fixed = fixCabinFloat(s, 'sleep-1', origin)
  assert.equal(fixCabinFloat(s, 'sleep-1', { x: 3, y: 0, z: 0 }).fixed, undefined)
  assert.equal(stepCabinFloat(fixed, { push: true }, { acceleration: { x: 10, y: 0, z: 0 } }, .1), fixed)
  assert.equal(stepCabinFloat(s, {}, {}, .1, undefined, false), s)
  assert.throws(() => stepCabinFloat({ ...s, velocity: { x: NaN, y: 0, z: 0 } }, {}, {}, .1))
  const limited = stepCabinFloat({ ...s, velocity: { x: 1, y: 0, z: 0 } }, {}, {}, 100); near(limited.position.x, .1)
})
