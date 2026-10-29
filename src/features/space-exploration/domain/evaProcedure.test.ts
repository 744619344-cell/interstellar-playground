import test from 'node:test'
import assert from 'node:assert/strict'
import { commandEva, createEvaProcedure, evaChecked, inspectEvaSuit, stepEvaProcedure, type EvaContext, type EvaProcedure } from './evaProcedure'
const context: EvaContext = { atLocker: true, atInnerDoor: true, atOuterDoor: true, atAnchor: true,
  shipStable: true, outerBlocked: false, lineClear: true }
const checks = { helmet: true, seal: true, oxygen: true, battery: true, lifeSupport: true }
function finish(s: EvaProcedure) { for (let i = 0; i < 42; i++) s = stepEvaProcedure(s, .1); return s }
function readyLock() {
  let s = finish(commandEva(createEvaProcedure(), 'wear', context))
  s = inspectEvaSuit(s, checks)
  for (const cmd of ['inner', 'enter', 'attach', 'inner'] as const) s = commandEva(s, cmd, context)
  return s
}

test('wearing requires the locker, cannot restart midway, pauses, and does not silently certify the suit', () => {
  const initial = createEvaProcedure()
  assert.equal(commandEva(initial, 'wear', { ...context, atLocker: false }).suit, 'stowed')
  const working = stepEvaProcedure(commandEva(initial, 'wear', context), .1)
  assert.equal(commandEva(working, 'wear', context).elapsed, working.elapsed)
  assert.equal(stepEvaProcedure(working, 10, false), working)
  const worn = finish(working)
  assert.equal(worn.suit, 'ready'); assert(!evaChecked(worn)); assert.equal(initial.suit, 'stowed')
  assert.equal(inspectEvaSuit(worn, { ...checks, oxygen: false }).checks.oxygen, false)
})

test('pressure and outer door reject missing checks, tether, unstable flight and inner-door leaks', () => {
  const ready = readyLock()
  for (const state of [{ ...ready, tether: false }, { ...ready, innerOpen: true }, { ...ready, checks: { ...checks, helmet: false } }])
    assert.equal(commandEva(state, 'depress', context).pressure, 'cabin')
  assert.equal(commandEva(ready, 'depress', { ...context, shipStable: false }).pressure, 'cabin')
  assert.equal(commandEva(ready, 'outer', context).outerOpen, false)
  const vacuum = finish(commandEva(ready, 'depress', context))
  assert.equal(vacuum.pressure, 'vacuum')
  assert.equal(commandEva(vacuum, 'inner', context).innerOpen, false)
  assert.equal(commandEva(vacuum, 'outer', { ...context, shipStable: false }).outerOpen, false)
  assert.equal(commandEva({ ...vacuum, tether: false }, 'outer', context).outerOpen, false)
})

test('complete preview round trip keeps tether outside and forbids premature doffing or distant return', () => {
  let s = finish(commandEva(readyLock(), 'depress', context))
  s = commandEva(s, 'outer', context); s = commandEva(s, 'exit', context)
  assert.equal(s.location, 'outside'); assert(s.tether)
  assert.equal(commandEva(s, 'detach', context).tether, true)
  assert.equal(commandEva(s, 'doff', context).suit, 'ready')
  assert.equal(commandEva(s, 'return', { ...context, atOuterDoor: false }).location, 'outside')
  s = commandEva(s, 'return', context)
  assert.equal(commandEva(s, 'outer', { ...context, lineClear: false }).outerOpen, true)
  assert.equal(commandEva(s, 'outer', { ...context, outerBlocked: true }).outerOpen, true)
  s = commandEva(s, 'outer', context); s = commandEva(s, 'repress', context)
  assert.equal(commandEva(s, 'inner', context).innerOpen, false)
  s = finish(s); s = commandEva(s, 'detach', context); s = commandEva(s, 'inner', context)
  s = commandEva(s, 'leave', context); s = finish(commandEva(s, 'doff', context))
  assert.equal(s.location, 'cabin'); assert.equal(s.suit, 'stowed'); assert(!s.tether); assert(!s.outerOpen)
})

test('transitions require physical proximity reports and double doors never open together', () => {
  let s = readyLock()
  assert.equal(commandEva(s, 'inner', { ...context, atInnerDoor: false }).innerOpen, false)
  s = finish(commandEva(s, 'depress', context)); s = commandEva(s, 'outer', context)
  assert.equal(commandEva(s, 'inner', context).innerOpen, false)
  assert.equal(commandEva(s, 'exit', { ...context, atOuterDoor: false }).location, 'lock')
  const bad = inspectEvaSuit({ ...s, location: 'outside' }, checks)
  assert.match(bad.notice, /增压区/)
})

test('physical return through an already open inner door updates the zone even when the line remains attached', () => {
  const s = { ...readyLock(), innerOpen: true }
  const returned = commandEva(s, 'leave', context)
  assert.equal(returned.location, 'cabin'); assert(returned.tether)
  assert.equal(commandEva(returned, 'depress', context).pressure, 'cabin')
  assert.equal(commandEva(returned, 'doff', context).suit, 'ready')
  assert.equal(commandEva(returned, 'locker', context).lockerOpen, returned.lockerOpen)
})
