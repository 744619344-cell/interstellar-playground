import test from 'node:test'
import assert from 'node:assert/strict'
import { Scene, WebGLRenderTarget, type WebGLRenderer } from 'three'
import { ShipModelEnvironment } from './shipModelEnvironment'

test('reflection target is created once, released on hide, recreated on return and released once on exit', () => {
  const scene = new Scene(), renderer = {} as WebGLRenderer
  let created = 0, released = 0
  const environment = new ShipModelEnvironment(scene, () => {
    created++; const target = new WebGLRenderTarget(16, 16)
    target.addEventListener('dispose', () => released++); return target
  })
  environment.ensure(renderer); const first = scene.environment
  assert(first); environment.ensure(renderer); assert.equal(created, 1)
  environment.dispose(); environment.dispose(); assert.equal(released, 1); assert.equal(scene.environment, null)
  environment.ensure(renderer); assert.notEqual(scene.environment, first); assert.equal(created, 2)
  environment.dispose(); assert.equal(released, 2); assert.equal(scene.environment, null)
})
