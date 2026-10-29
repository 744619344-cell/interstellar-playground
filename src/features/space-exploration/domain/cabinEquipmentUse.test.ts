import test from 'node:test'
import assert from 'node:assert/strict'
import { CABIN_EQUIPMENT, parseCabinEquipmentAction } from './cabinEquipmentCatalog'
import { commandCabinEquipment, createCabinEquipmentUse, stepCabinEquipment, type CabinEquipmentContext } from './cabinEquipmentUse'
const storage = 'micro-starboard-liner', bench = 'micro-work'
const context = (id = storage): CabinEquipmentContext => ({ id, near: true, held: true, ready: true, pressure: 'cabin', doorsClosed: true, suit: 'ready', oxygen: .76, battery: .61, tether: false })

test('catalog covers all ten actual source stations and action parser rejects unknown targets and commands', () => {
  assert.equal(CABIN_EQUIPMENT.length, 10); assert.equal(new Set(CABIN_EQUIPMENT.map(e => e.id)).size, 10)
  assert(parseCabinEquipmentAction(`equipment:${storage}:take-kit`))
  for (const action of [`equipment:${storage}:take-kit:extra`, 'equipment:unknown:take-kit', `equipment:${bench}:eval`, 'eva:wear']) assert.equal(parseCabinEquipmentAction(action), undefined)
})
test('storage conserves a unique kit and rejects repeated, remote, stale, unsupported and wrong-device actions', () => {
  const empty = createCabinEquipmentUse()
  for (const c of [{ ...context(), held: false }, { ...context(), near: false }, { ...context(), ready: false }, context(bench)])
    assert.equal(commandCabinEquipment(empty, storage, 'take-kit', c).kit, 'storage')
  let s = commandCabinEquipment(empty, storage, 'take-kit', context()); assert.equal(s.kit, 'carried'); assert.equal(s.log.length, 1)
  s = commandCabinEquipment(s, storage, 'take-kit', context()); assert.equal(s.log.length, 1)
  s = commandCabinEquipment(s, bench, 'return-kit', context(bench)); assert.equal(s.kit, 'carried')
  s = commandCabinEquipment(s, storage, 'return-kit', context()); assert.equal(s.kit, 'storage'); assert.equal(s.log.length, 2)
  assert.equal(empty.log.length, 0); assert.equal(empty.kit, 'storage')
})
test('inspection requires kit/support, pauses exactly, cancels without losing kit and resumes from saved state', () => {
  let s = createCabinEquipmentUse()
  assert.equal(commandCabinEquipment(s, bench, 'inspect-start', context(bench)).inspection, undefined)
  s = commandCabinEquipment(s, storage, 'take-kit', context()); s = commandCabinEquipment(s, bench, 'inspect-start', context(bench))
  for (let i = 0; i < 13; i++) s = stepCabinEquipment(s, context(bench), .1)
  assert.equal(stepCabinEquipment(s, { ...context(bench), ready: false }, 10, false), s)
  const restored = createCabinEquipmentUse(s); assert.deepEqual(restored, s); assert.notEqual(restored.log, s.log)
  const cancelled = stepCabinEquipment(s, { ...context(bench), held: false }, .1)
  assert.equal(cancelled.inspection, undefined); assert.equal(cancelled.inspections, 0); assert.equal(cancelled.kit, 'carried')
  s = restored; for (let i = 0; i < 28; i++) s = stepCabinEquipment(s, context(bench), .1)
  assert.equal(s.inspections, 1); assert.equal(s.inspection, undefined); assert.match(s.log.at(-1)!.detail, /76%.*61%/)
  for (let i = 0; i < 50; i++) s = stepCabinEquipment(s, context(bench), .1)
  assert.equal(s.inspections, 1); assert.equal(s.log.length, 2)
})
test('closing/changing panels cancels inspection, explicit cancel works, and logs stay bounded and ordered', () => {
  let s = commandCabinEquipment(createCabinEquipmentUse(), storage, 'take-kit', context())
  s = commandCabinEquipment(s, bench, 'inspect-start', context(bench))
  assert.equal(commandCabinEquipment(s, bench, 'inspect-cancel', context(bench)).inspection, undefined)
  assert.equal(stepCabinEquipment(s, context(), .1).inspection, undefined)
  s = commandCabinEquipment(s, bench, 'inspect-cancel', context(bench))
  for (let i = 0; i < 35; i++) s = commandCabinEquipment(s, storage, 'record-status', context())
  assert.equal(s.log.length, 24); assert(s.log.every((r, i) => !i || r.sequence > s.log[i - 1].sequence))
  s = commandCabinEquipment(s, storage, 'light-rest', context()); assert.equal(s.light, 'rest')
  s = commandCabinEquipment(s, 'reused-main-console-1', 'light-normal', context('reused-main-console-1')); assert.equal(s.light, 'normal')
})
