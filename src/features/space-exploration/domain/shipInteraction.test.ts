import test from 'node:test'
import assert from 'node:assert/strict'
import { activateShipInteraction, createShipInteraction, selectShipInteraction, setShipSeated,
  shipDoorLabel, stepShipInteraction, type ShipInteractionState } from './shipInteraction'

test('seat anchors enter and leave the real cockpit view', () => {
  let state = createShipInteraction()
  let result = activateShipInteraction(state)
  assert.equal(result.view, 'cockpit'); assert.equal(result.state.seated, true)
  state = selectShipInteraction(result.state, 'stand-up')
  result = activateShipInteraction(state)
  assert.equal(result.view, 'follow'); assert.equal(result.state.seated, false)
  assert.equal(setShipSeated(result.state, false), result.state)
})

test('doors reverse smoothly and mechanical interlock rejects the other door', () => {
  let state: ShipInteractionState = selectShipInteraction(createShipInteraction(), 'inner-door')
  state = activateShipInteraction(state).state
  state = stepShipInteraction(state, .05, true)
  assert.equal(shipDoorLabel(state.doors.inner), '开启中')
  const blocked = activateShipInteraction(selectShipInteraction(state, 'airlock')).state
  assert.equal(blocked.doors.outer.target, 0)
  assert.match(blocked.notice!, /机械互锁/)
  state = activateShipInteraction(selectShipInteraction(state, 'inner-door')).state
  const before = state.doors.inner.progress
  state = stepShipInteraction(state, .05, true)
  assert(state.doors.inner.progress < before)
  for (let i = 0; i < 40; i++) state = stepShipInteraction(state, .05, true)
  assert.equal(shipDoorLabel(state.doors.inner), '已关闭')
  state = activateShipInteraction(selectShipInteraction(state, 'airlock')).state
  assert.equal(state.doors.outer.target, 1)
})

test('pause and invalid time freeze mechanisms while console uses bounded time', () => {
  let state = activateShipInteraction(selectShipInteraction(createShipInteraction(), 'console')).state
  const paused = stepShipInteraction(state, 1, false)
  assert.equal(paused, state)
  assert.equal(stepShipInteraction(state, Number.NaN, true), state)
  state = stepShipInteraction(state, 10, true)
  assert.equal(state.consoleTime, .05)
  assert.equal(state.consoleActive, true)
})

test('EVA and tether anchors stay reserved without changing mechanisms', () => {
  for (const anchor of ['eva', 'tether'] as const) {
    const state = selectShipInteraction(createShipInteraction(), anchor)
    const result = activateShipInteraction(state)
    assert.match(result.state.notice!, /EVA 阶段/)
    assert.deepEqual(result.state.doors, state.doors)
    assert.equal(result.state.consoleActive, false)
  }
})
