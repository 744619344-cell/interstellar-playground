import test from 'node:test'
import assert from 'node:assert/strict'
import { Bone } from 'three'
import { createCabinFloat } from '../../domain/cabinFloatMotion'
import type { MicrogravityCrewRig } from '../astronaut/microgravityCrewRig'
import { SeatClearancePose } from '../astronaut/seatClearancePose'
import { SeatEscapeAssist, seatEscapeCandidate } from './seatEscapeAssist'

test('seat recovery is explicit, starts only after a real stall and immediately releases for reverse or loss of control', () => {
  assert(!seatEscapeCandidate('')); assert(!seatEscapeCandidate('?seatEscape=0')); assert(seatEscapeCandidate('?seatEscape=1'))
  let begun = 0, stopped = 0, ready = false
  const rig = { beginSeatClearance() { begun++ }, endSeatClearance() { stopped++ }, get seatClearanceReady() { return ready } } as MicrogravityCrewRig
  const assist = new SeatEscapeAssist(true), state = createCabinFloat({ x: 0, y: 0, z: 0 }), forward = { right: 1, followYaw: 1 }
  assist.begin('seat', 'shin_R', forward, state, rig); assert.equal(begun, 0)
  for (let i = 0; i < 13; i++) assist.sync(1 / 60, forward, state, rig, true)
  assist.begin('wall', 'shin_R', forward, state, rig); assist.begin('seat', 'hand_R', forward, state, rig); assert.equal(begun, 0)
  assist.begin('seat', 'shin_R', forward, state, rig); assert.equal(begun, 1); assert(assist.active)
  const input = { ...forward }, prepared = assist.prepare(input, { ...state, velocity: { x: .2, y: 0, z: 0 } }, rig)
  assert.equal(input.right, 0); assert.equal(input.followYaw, undefined); assert.deepEqual(prepared.velocity, { x: 0, y: 0, z: 0 })
  ready = true; const moving = { ...forward }; assist.prepare(moving, state, rig); assert.equal(moving.right, 1); assert.equal(moving.followYaw, undefined)
  assist.sync(.01, { right: -1 }, state, rig, true); assert(!assist.active); assert(stopped > 0)
  for (let i = 0; i < 13; i++) assist.sync(1 / 60, forward, state, rig, true)
  assist.begin('seat_1', 'foot_R', forward, state, rig); assert(assist.active)
  assist.sync(.01, forward, state, rig, false); assert(!assist.active)
})

test('clearance pose moves existing joints in small steps and rolls back a rejected step', () => {
  const thigh = new Bone(), shin = new Bone(), bones = new Map([['thigh_R', thigh], ['shin_R', shin]])
  const pose = new SeatClearancePose(); pose.begin(); const first = thigh.quaternion.clone()
  pose.step(1 / 60, bones); assert(first.angleTo(thigh.quaternion) > 0)
  thigh.quaternion.copy(first); pose.rollback()
  for (let i = 0; i < 16; i++) pose.step(1 / 60, bones)
  assert(pose.ready); assert(Math.abs(first.angleTo(thigh.quaternion) - .2) < 1e-8)
  pose.cancel(); assert(!pose.active); assert(!pose.ready)
})

test('motion is not interrupted by transient contact and a stuck pose attempt cannot repeat forever', () => {
  let begun = 0, ended = 0
  const rig = { beginSeatClearance() { begun++ }, endSeatClearance() { ended++ }, seatClearanceReady: false } as unknown as MicrogravityCrewRig
  const assist = new SeatEscapeAssist(true), state = createCabinFloat({ x: 0, y: 0, z: 0 }), input = { right: 1 }
  for (let i = 0; i < 15; i++) assist.sync(1 / 60, input, { ...state, position: { x: i * .003, y: 0, z: 0 } }, rig, true)
  assist.begin('seat', 'foot_R', input, state, rig); assert.equal(begun, 0)
  for (let i = 0; i < 28; i++) assist.sync(1 / 60, input, state, rig, true)
  assist.begin('seat', 'foot_R', input, state, rig); assert(assist.active)
  for (let i = 0; i < 90; i++) assist.sync(1 / 60, input, state, rig, true)
  assert(!assist.active); assert(ended > 0)
  for (let i = 0; i < 20; i++) assist.sync(1 / 60, input, state, rig, true)
  assist.begin('seat', 'foot_R', input, state, rig); assert.equal(begun, 1, 'timeout locks repeated attempts until the command changes')
  assist.sync(.01, { right: -1 }, state, rig, true)
  for (let i = 0; i < 13; i++) assist.sync(1 / 60, { right: -1 }, state, rig, true)
  assist.begin('seat', 'foot_R', { right: -1 }, state, rig); assert.equal(begun, 2)
})
