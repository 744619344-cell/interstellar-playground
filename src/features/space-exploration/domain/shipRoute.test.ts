import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SHIP_ROUTE, SHIP_ROUTE_IDS, createShipRoute, observeShipRoute, stepShipRoute, type ShipRouteSample
} from './shipRoute'
import { createShipFlightState } from './shipFlightModel'
import type { ShipNavigationBody } from './shipNavigation'

const body = (id: 'earth' | 'moon' | 'saturn', z = -30, radius = 2): ShipNavigationBody => ({
  id, center: { x: 0, y: 0, z }, radius, velocity: { x: 0, y: 0, z: 0 }
})
const sample = (over: Partial<ShipRouteSample> = {}): ShipRouteSample => ({
  clearance: 80, closingSpeed: 0, relativeSpeed: 0, shipSpeed: 0, ...over
})
const run = (id: typeof SHIP_ROUTE_IDS[number], start: ShipRouteSample, steps: ShipRouteSample[]) => {
  let route = createShipRoute(id)
  route = stepShipRoute(route, start, true)
  for (const next of steps) route = stepShipRoute(route, next, true)
  return route
}

test('earth, moon and saturn share one machine and stay idle until the ship itself moves', () => {
  const idleNear = sample({ clearance: 10, relativeSpeed: 4 })
  for (const id of SHIP_ROUTE_IDS) {
    assert.deepEqual(createShipRoute(id), { id, phase: 'idle' })
    assert.equal(stepShipRoute(createShipRoute(id), idleNear, true).phase, 'idle')
    assert.equal(run(id, sample({ shipSpeed: 1 }), [sample({ shipSpeed: 1, clearance: 50 })]).phase, 'cruise')
  }
})

test('manual cruise must enter approach before arrival; arrival is sticky', () => {
  const moving = sample({ shipSpeed: 2, relativeSpeed: 2, clearance: 80 })
  const band = sample({
    shipSpeed: 1, relativeSpeed: 1, closingSpeed: 0.4,
    clearance: (SHIP_ROUTE.arrivalMinClearance + SHIP_ROUTE.arrivalMaxClearance) / 2
  })
  let route = stepShipRoute(createShipRoute('earth'), moving, true)
  assert.equal(route.phase, 'cruise')
  assert.equal(stepShipRoute(route, band, true).phase, 'approach')
  route = stepShipRoute(stepShipRoute(route, band, true), band, true)
  assert.equal(route.phase, 'arrived')
  assert.equal(stepShipRoute(route, sample({ clearance: 90, shipSpeed: 8, relativeSpeed: 8 }), true).phase, 'arrived')
})

test('high-speed periapsis flyby and protection overlap never complete a route', () => {
  const approach = { id: 'moon' as const, phase: 'approach' as const }
  const periapsis = sample({
    clearance: 10, closingSpeed: 0, relativeSpeed: 40, shipSpeed: 40
  })
  const inside = sample({
    clearance: SHIP_ROUTE.arrivalMinClearance - 1, closingSpeed: 0.1, relativeSpeed: 0.4, shipSpeed: 0.4
  })
  const contact = sample({ clearance: -2, closingSpeed: 1, relativeSpeed: 1, shipSpeed: 1 })
  assert.equal(stepShipRoute(approach, periapsis, true).phase, 'approach')
  assert.equal(stepShipRoute(approach, inside, true).phase, 'approach')
  assert.equal(stepShipRoute(approach, contact, true).phase, 'approach')
})

test('leaving the neighborhood returns to cruise; invalid samples cannot finish', () => {
  const approach = { id: 'saturn' as const, phase: 'approach' as const }
  const far = sample({ clearance: SHIP_ROUTE.approachClearance + 1, shipSpeed: 3, relativeSpeed: 3 })
  assert.equal(stepShipRoute(approach, far, true).phase, 'cruise')
  const band = sample({ clearance: 10, relativeSpeed: 1, shipSpeed: 1, closingSpeed: 0.2 })
  assert.equal(stepShipRoute(approach, { ...band, clearance: Number.NaN }, true).phase, 'approach')
  assert.equal(stepShipRoute(approach, { ...band, relativeSpeed: Infinity }, true).phase, 'approach')
  assert.equal(stepShipRoute(approach, undefined, true).phase, 'approach')
  assert.equal(observeShipRoute(createShipFlightState(), { ...body('earth'), radius: Number.NaN }), undefined)
  assert.equal(observeShipRoute(createShipFlightState()), undefined)
})

test('paused or unadvanced ticks cannot promote a ready arrival sample', () => {
  const ready = sample({ clearance: 10, relativeSpeed: 0.5, closingSpeed: 0.2, shipSpeed: 0.5 })
  const approach = { id: 'earth' as const, phase: 'approach' as const }
  assert.equal(stepShipRoute(approach, ready, false).phase, 'approach')
  assert.equal(stepShipRoute(createShipRoute('earth'), sample({ shipSpeed: 5 }), false).phase, 'idle')
})

test('observeShipRoute uses live body motion and switching starts a fresh idle route', () => {
  const state = createShipFlightState()
  state.velocity.z = -1
  const moving = body('earth')
  moving.velocity.z = -4
  const observed = observeShipRoute(state, moving)!
  assert.equal(observed.shipSpeed, 1)
  assert.ok(observed.relativeSpeed > 2)
  const next = createShipRoute('saturn')
  assert.equal(next.id, 'saturn')
  assert.equal(next.phase, 'idle')
})
