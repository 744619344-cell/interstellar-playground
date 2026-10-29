import test from 'node:test'
import assert from 'node:assert/strict'
import { cabinEvaControls, isCabinEvaAction, type EvaControlsContext } from './cabinEvaControls'
import { cancelEvaProcedure, createEvaProcedure, stepEvaProcedure, type EvaProcedure } from './evaProcedure'
const context: EvaControlsContext = { atLocker: true, atInnerDoor: true, atOuterDoor: true, atAnchor: true,
  shipStable: true, outerBlocked: false, lineClear: true, held: true, busy: false,
  lockerReady: true, lockerAvailable: true, brake: false, reel: false }
const checks = { helmet: true, seal: true, oxygen: true, battery: true, lifeSupport: true }
const control = (s: EvaProcedure, id: string, c = context) => cabinEvaControls(s, c).controls.find(item => item.id === id)

test('locker controls require a real hold, an open and fully opened door; open-source fallback never advertises a movable door', () => {
  const s = createEvaProcedure()
  assert(!control(s, 'wear')!.enabled)
  assert.match(control(s, 'locker', { ...context, held: false })!.reason!, /抓稳/)
  assert(!control({ ...s, lockerOpen: true }, 'wear', { ...context, lockerReady: false })!.enabled)
  assert(control({ ...s, lockerOpen: true }, 'wear')!.enabled)
  const openSource = { ...context, lockerAvailable: false }
  assert(!control({ ...s, lockerOpen: true }, 'locker', openSource)!.enabled)
  assert(control({ ...s, lockerOpen: true }, 'wear', openSource)!.enabled)
})
test('lock procedure allows closing an already open inner door while tethered, but blocks unsafe outer door and pressure requests', () => {
  const s: EvaProcedure = { ...createEvaProcedure(), suit: 'ready', checks, location: 'lock', innerOpen: true, tether: true }
  assert(control(s, 'inner')!.enabled)
  assert(!control(s, 'outer')!.enabled); assert(!control(s, 'pressure')!.enabled)
  const closed = { ...s, innerOpen: false }
  assert(control(closed, 'pressure')!.enabled)
  assert(!control(closed, 'inner')!.enabled)
  assert(control({ ...closed, pressure: 'vacuum' }, 'outer')!.enabled)
  assert(!control({ ...closed, pressure: 'vacuum', tether: false }, 'outer')!.enabled)
  assert(!control({ ...closed, pressure: 'vacuum', outerOpen: true }, 'outer', { ...context, lineClear: false })!.enabled)
  assert(!control(closed, 'tether', { ...context, held: false })!.enabled)
})
test('outside controls expose finite maneuver and reel assistance without allowing remote suit/door operations', () => {
  const s: EvaProcedure = { ...createEvaProcedure(), suit: 'ready', checks, location: 'outside', pressure: 'vacuum', outerOpen: true, tether: true }
  const c = { ...context, atLocker: false, atInnerDoor: false, atOuterDoor: false, atAnchor: false }
  const view = cabinEvaControls(s, c)
  assert(view.visible); assert.match(view.hint, /松键保留惯性/)
  assert(control(s, 'brake', c)!.enabled && control(s, 'reel', c)!.enabled)
  assert(!control(s, 'wear', c)); assert(!control(s, 'outer', c))
  assert(cabinEvaControls(s, { ...c, busy: true }).controls.every(action => !action.enabled))
  assert(isCabinEvaAction('wear')); assert(!isCabinEvaAction('exit')); assert(!isCabinEvaAction('unrecognized'))
})
test('explicit equipment/pressure cancellation restores stable states; paused steps do not cancel or advance them', () => {
  for (const suit of ['donning', 'doffing'] as const) {
    const s = { ...createEvaProcedure(), suit, elapsed: 1.8 }
    assert.equal(stepEvaProcedure(s, 1, false), s)
    const stopped = cancelEvaProcedure(s)
    assert.equal(stopped.suit, suit === 'donning' ? 'stowed' : 'ready'); assert.equal(stopped.elapsed, 0)
    assert.equal(s.suit, suit)
  }
  for (const pressure of ['depressurizing', 'repressurizing'] as const) {
    const s = { ...createEvaProcedure(), pressure, elapsed: 2 }
    assert.equal(stepEvaProcedure(s, 1, false), s)
    assert.equal(cancelEvaProcedure(s).pressure, pressure === 'depressurizing' ? 'cabin' : 'vacuum')
  }
  const stable = createEvaProcedure(); assert.equal(cancelEvaProcedure(stable), stable)
})
