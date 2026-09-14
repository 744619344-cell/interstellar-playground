import assert from 'node:assert/strict'
import test from 'node:test'
import { bodyPositionsAt, bodySpinAt } from './orbitMotion'
import { visualScale } from './visualScale'

test('planets orbit the sun and the moon follows the moving earth', () => {
  const start = bodyPositionsAt(0)
  const later = bodyPositionsAt(12)
  assert.notDeepEqual(later.get('earth'), start.get('earth'))
  assert.notDeepEqual(later.get('moon'), start.get('moon'))
  const earth = later.get('earth')!
  const moon = later.get('moon')!
  const moonScale = visualScale('moon')
  const visualRadius = moonScale.orbitRadius
  assert.ok(Math.abs(Math.hypot(moon.x - earth.x, moon.z - earth.z) - visualRadius) < 1e-9)
})

test('motion is deterministic and spin only depends on accumulated simulation time', () => {
  assert.deepEqual(bodyPositionsAt(8), bodyPositionsAt(8))
  assert.equal(bodySpinAt('earth', 0), 0)
  assert.ok(bodySpinAt('earth', 5) > bodySpinAt('earth', 2))
  assert.ok(bodySpinAt('venus', 5) < 0)
})
