import assert from 'node:assert/strict'
import test from 'node:test'
import {
  adoptTexture,
  collectMaterialTextures,
  disposeObject,
  VoyageResourceGate
} from './voyageResources'

test('late textures for a previous target or destroy are discarded', () => {
  const gate = new VoyageResourceGate()
  const first = gate.bumpTarget()
  const second = gate.bumpTarget()
  const disposed: string[] = []
  let assigned = ''
  const late = { dispose() { disposed.push('late') } }
  const current = { dispose() { disposed.push('current') } }
  assert.equal(gate.isTargetCurrent(first), false)
  assert.equal(adoptTexture(gate.isTargetCurrent(first), late, () => { assigned = 'late' }), false)
  assert.equal(adoptTexture(gate.isTargetCurrent(second), current, () => { assigned = 'current' }), true)
  assert.equal(assigned, 'current')
  assert.deepEqual(disposed, ['late'])
  gate.destroy()
  const afterDestroy = { dispose() { disposed.push('after') } }
  assert.equal(adoptTexture(gate.isTargetCurrent(second), afterDestroy, () => { assigned = 'after' }), false)
  assert.deepEqual(disposed, ['late', 'after'])
  assert.equal(gate.isWorldCurrent(), false)
})

test('shared map and alphaMap dispose once by instance', () => {
  const disposed: string[] = []
  const shared = { dispose() { disposed.push('shared') } }
  const unique = { dispose() { disposed.push('unique') } }
  const material = {
    map: shared,
    alphaMap: shared,
    emissiveMap: unique,
    dispose() { disposed.push('material') }
  }
  assert.equal(collectMaterialTextures(material).size, 2)
  disposeObject({
    traverse(callback) { callback({ material }) }
  })
  assert.deepEqual(disposed, ['shared', 'unique', 'material'])
})
