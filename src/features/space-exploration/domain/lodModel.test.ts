import assert from 'node:assert/strict'
import test from 'node:test'
import { acceptLateResource, focusLod, initialLodState, lod1Count, lodForBody } from './lodModel'

test('overview keeps every body at lod2', () => {
  const state = initialLodState()
  assert.equal(lodForBody('earth', state), 'lod2')
  assert.equal(lod1Count(state), 0)
})

test('only the focused body is lod1 and late resources only attach to the latest generation', () => {
  let state = focusLod(initialLodState(), 'earth')
  const earthGen = state.generation
  state = focusLod(state, 'moon')
  const moonGen = state.generation
  state = focusLod(state, 'saturn')
  assert.equal(lodForBody('earth', state), 'lod2')
  assert.equal(lodForBody('moon', state), 'lod2')
  assert.equal(lodForBody('saturn', state), 'lod1')
  assert.equal(lod1Count(state), 1)
  assert.equal(acceptLateResource(state, 'earth', earthGen), false)
  assert.equal(acceptLateResource(state, 'moon', moonGen), false)
  assert.equal(acceptLateResource(state, 'saturn', state.generation), true)
})
