import assert from 'node:assert/strict'
import test from 'node:test'
import { allBodyWorldPositions } from './layout'
import { SYSTEM_BODY_IDS } from './registry'
import {
  allVisualScales, BODY_RADIUS_MULTIPLIER, MAX_SAFE_COORD, maxSystemRadius, SUN_RADIUS_MULTIPLIER,
  solarOrbitEnvelope, SYSTEM_FAR_PLANE, visualOuterRadius, visualScale
} from './visualScale'

test('visual scale is deterministic and covers every registered body', () => {
  assert.deepEqual(allVisualScales().map((item) => item.id), [...SYSTEM_BODY_IDS])
  assert.deepEqual(allVisualScales(), allVisualScales())
  assert.ok(visualScale('saturn').ringOuter)
  assert.equal(visualScale('earth').radius, 2.4 * BODY_RADIUS_MULTIPLIER)
  assert.equal(visualScale('sun').radius, 10 * SUN_RADIUS_MULTIPLIER)
})

test('sun-mercury and earth-moon stay separated in compressed space', () => {
  const sun = visualScale('sun')
  const mercury = visualScale('mercury')
  const earth = visualScale('earth')
  const moon = visualScale('moon')
  assert.ok(sun.radius + mercury.radius < mercury.orbitRadius)
  assert.ok(earth.radius + moon.radius < moon.orbitRadius)
})

test('adjacent orbital envelopes cannot intersect at any orbital phase', () => {
  const orbitOrder = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const
  const sun = visualScale('sun')
  assert.ok(sun.radius + visualOuterRadius('mercury') < visualScale('mercury').orbitRadius)
  for (let index = 1; index < orbitOrder.length; index += 1) {
    const inner = orbitOrder[index - 1]
    const outer = orbitOrder[index]
    const orbitGap = visualScale(outer).orbitRadius - visualScale(inner).orbitRadius
    assert.ok(
      solarOrbitEnvelope(inner) + solarOrbitEnvelope(outer) < orbitGap,
      `${inner}-${outer} orbital envelopes overlap`
    )
  }
})

test('all world positions stay inside the safe render envelope', () => {
  const positions = allBodyWorldPositions()
  for (const body of positions) {
    assert.ok(Math.abs(body.position.x) < MAX_SAFE_COORD, body.id)
    assert.ok(Math.abs(body.position.z) < MAX_SAFE_COORD, body.id)
  }
  assert.ok(maxSystemRadius() < SYSTEM_FAR_PLANE / 4)
})
