import test from 'node:test'
import assert from 'node:assert/strict'
import { assistCabinControls } from './cabinControlAssist'
import { createCabinFloat, stepCabinFloat } from './cabinFloatMotion'
import { microgravityInput } from '../input/microgravityInput'
const nudge = { forward: 0, right: 0, up: 0, seconds: 0 }
const spawn = () => createCabinFloat({ x: 0, y: 0, z: 0 })

test('desktop float starts without a rail, reverses, and releasing input gently stops', () => {
  let s = spawn()
  const step = (keys: string[], count: number) => { for (let i = 0; i < count; i++) {
    const input = microgravityInput(new Set(keys), true, s.orientation, 0, nudge, true, true)
    s = stepCabinFloat(assistCabinControls(s, input, {}, 1 / 60), input, {}, 1 / 60)
  } }
  step(['ArrowRight'], 60); assert(s.position.x > .4); assert(Math.abs(s.velocity.x - .6) < 1e-8)
  const x = s.position.x; step([], 45); assert(s.position.x > x + .15 && s.position.x < x + .2)
  assert(Math.hypot(...Object.values(s.velocity)) < 1e-8)
  const stopped = { ...s.position }; step([], 30); assert.deepEqual(s.position, stopped)
  step(['ArrowLeft'], 65); assert(s.velocity.x < -.59)
  step(['KeyB'], 30); assert(Math.hypot(...Object.values(s.velocity)) < 1e-8)
})

test('assisted turning works in free space and does not rotate the camera-relative movement basis', () => {
  let s = spawn()
  for (let i = 0; i < 60; i++) {
    const input = microgravityInput(new Set(['KeyE']), true, s.orientation, 0, nudge, true, true)
    s = stepCabinFloat(assistCabinControls(s, input, {}, 1 / 60), input, {}, 1 / 60)
  }
  assert(s.orientation.y < -.5)
  for (let i = 0; i < 180; i++) {
    const input = microgravityInput(new Set(['KeyW']), true, s.orientation, 0, nudge, true, true)
    s = stepCabinFloat(assistCabinControls(s, input, {}, 1 / 60), input, {}, 1 / 60)
  }
  assert(s.velocity.z < -.59); assert(Math.abs(s.velocity.x) < 1e-8)
  assert(Math.abs(s.orientation.y) < .02, 'moving crew did not turn toward the camera')
  assert(Math.hypot(...Object.values(s.angularVelocity)) < .05)
})

test('desktop rise, descend, sprint and braking have single-key mappings without affecting strict Space push', () => {
  const map = (keys: string[], assisted = true) => microgravityInput(new Set(keys), true, spawn().orientation, 0, nudge, true, assisted)
  assert.equal(map(['Space']).up, 1); assert.equal(map(['KeyC']).up, -1)
  assert.equal(map(['KeyW', 'ShiftLeft']).forward, 1); assert.equal(map(['KeyW', 'ShiftLeft']).fast, true)
  assert.equal(map(['KeyB']).brake, true); assert.equal(map(['Space'], false).push, true)
  assert.equal(map(['Space'], false).up, 0)
  let s = spawn()
  for (let i = 0; i < 90; i++) s = assistCabinControls(s, map(['KeyW', 'ShiftLeft']), {}, 1 / 60)
  assert(Math.abs(Math.hypot(...Object.values(s.velocity)) - .85) < 1e-8)
})

test('assist cannot alter a fixed/held actor or advance at an invalid elapsed time', () => {
  const fixed = { ...spawn(), fixed: 'sleep-restraint' }, input = { right: 1, yaw: 1 }
  assert.deepEqual(assistCabinControls(fixed, input, {}, .05), fixed)
  const held = { ...spawn(), contact: { id: 'source-rail', point: { x: 0, y: 0, z: 0 }, normal: { x: 1, y: 0, z: 0 } } }
  assert.deepEqual(assistCabinControls(held, input, {}, .05), held)
  for (const dt of [0, -1, NaN, Infinity]) assert.deepEqual(assistCabinControls(spawn(), input, {}, dt), spawn())
})

test('simultaneous axes do not increase assisted speed and snapshots stay immutable', () => {
  const initial = spawn(), copy = structuredClone(initial)
  const diagonal = assistCabinControls(initial, { forward: 1, right: 1, up: 1 }, {}, .05)
  assert(Math.abs(Math.hypot(...Object.values(diagonal.velocity)) - .06) < 1e-8)
  assert.deepEqual(initial, copy)
})
