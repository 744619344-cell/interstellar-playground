import test from 'node:test'
import assert from 'node:assert/strict'
import { ACESFilmicToneMapping, Color, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, SRGBColorSpace, WebGLRenderTarget, type WebGLRenderer } from 'three'
import { ShipContactShading } from './shipContactShading'

test('AO failure restores the renderer, shadow state, glass visibility and prior scene override', () => {
  const scene = new Scene(), glass = new Mesh(undefined, new MeshPhysicalMaterial({ transmission: 1 })), prior = new MeshStandardMaterial()
  scene.add(glass); scene.overrideMaterial = prior
  const oldTarget = new WebGLRenderTarget(8, 8), clear = new Color(0x123456), expected = clear.clone()
  let target: WebGLRenderTarget | null = oldTarget, alpha = .35, renders = 0
  const renderer = {
    autoClear: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: SRGBColorSpace,
    shadowMap: { enabled: true },
    getDrawingBufferSize: (v: import('three').Vector2) => v.set(128, 72),
    getRenderTarget: () => target, setRenderTarget: (value: WebGLRenderTarget | null) => { target = value },
    getClearColor: (value: Color) => value.copy(clear), getClearAlpha: () => alpha,
    setClearColor: (value: Color | number, opacity?: number) => { clear.set(value); if (opacity !== undefined) alpha = opacity },
    setClearAlpha: (value: number) => { alpha = value }, clear: () => {},
    render: () => { if (++renders === 2) { assert(!glass.visible); assert(!renderer.shadowMap.enabled); throw Error('normal pass failed') } }
  }
  const pass = new ShipContactShading(scene)
  try {
    assert.throws(() => pass.render(renderer as unknown as WebGLRenderer, new PerspectiveCamera(), true), /normal pass failed/)
    assert.equal(target, oldTarget); assert.equal(alpha, .35); assert(clear.equals(expected))
    assert.equal(renderer.toneMapping, ACESFilmicToneMapping); assert(renderer.autoClear && renderer.shadowMap.enabled)
    assert(glass.visible); assert.equal(scene.overrideMaterial, prior)
  } finally { pass.dispose(); pass.dispose(); oldTarget.dispose(); glass.geometry.dispose(); glass.material.dispose(); prior.dispose() }
})
