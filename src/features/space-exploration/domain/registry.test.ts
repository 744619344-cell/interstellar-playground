import assert from 'node:assert/strict'
import test from 'node:test'
import { childrenOf, getSystemBody, SYSTEM_BODIES, SYSTEM_BODY_IDS } from './registry'

test('registry contains exactly ten stable bodies in order', () => {
  assert.equal(SYSTEM_BODIES.length, 10)
  assert.deepEqual(SYSTEM_BODIES.map((body) => body.id), [...SYSTEM_BODY_IDS])
  assert.deepEqual(SYSTEM_BODIES.map((body) => body.order), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  assert.equal(new Set(SYSTEM_BODY_IDS).size, 10)
})

test('sun is the root, planets orbit the sun, moon orbits the earth', () => {
  assert.equal(getSystemBody('sun').parentId, null)
  assert.equal(getSystemBody('sun').kind, 'star')
  for (const id of ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'] as const) {
    assert.equal(getSystemBody(id).parentId, 'sun')
    assert.equal(getSystemBody(id).kind, 'planet')
  }
  assert.equal(getSystemBody('moon').parentId, 'earth')
  assert.equal(getSystemBody('moon').kind, 'satellite')
  assert.deepEqual(childrenOf('earth').map((body) => body.id), ['moon'])
})
