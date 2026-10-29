import assert from 'node:assert/strict'
import test from 'node:test'
import { MeshBasicMaterial, Scene } from 'three'
import { addSystemSky, createSystemMapWorld } from './systemMapWorld'

test('world construction failure disposes the renderer', () => {
  const disposed: string[] = []
  const renderer = {
    setPixelRatio() { throw new Error('pixel ratio failed') },
    setSize() {},
    dispose() { disposed.push('renderer') }
  }
  assert.throws(
    () => createSystemMapWorld({} as HTMLCanvasElement, 800, 600, 1, {
      createRenderer: () => renderer as any
    }),
    /pixel ratio failed/
  )
  assert.deepEqual(disposed, ['renderer'])
})

test('microgravity render mode requests a consistent high-precision depth buffer for the world and ship', () => {
  let options: ConstructorParameters<typeof import('three').WebGLRenderer>[0]
  const renderer = { setPixelRatio() {}, setSize() {}, dispose() {} }
  const world = createSystemMapWorld({} as HTMLCanvasElement, 800, 600, 1, {
    createRenderer: value => { options = value; return renderer as any }
  }, true)
  assert.equal(options!.logarithmicDepthBuffer, true)
  assert.equal(world.renderer, renderer)
})

test('sky draws before bodies without obscuring them beyond its radius', () => {
  const sky = addSystemSky(new Scene(), 'sky', { load() {} } as any, { isWorldCurrent: () => true } as any)
  const material = sky.material as MeshBasicMaterial
  assert.ok(sky.renderOrder < 0)
  assert.equal(material.transparent, false)
  assert.equal(material.depthTest, false)
  assert.equal(material.depthWrite, false)
})
