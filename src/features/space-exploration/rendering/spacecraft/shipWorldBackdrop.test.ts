import test from 'node:test'
import assert from 'node:assert/strict'
import { Color, HalfFloatType, LinearSRGBColorSpace, PerspectiveCamera, Scene, Texture, UnsignedByteType,
  Vector2, WebGLRenderTarget, type WebGLRenderer } from 'three'
import { ShipWorldBackdrop } from './shipWorldBackdrop'

function fixture(floatSupport = true) {
  const ship = new Scene(), universe = new Scene(), camera = new PerspectiveCamera()
  const original = new Color('black'); ship.background = original
  const owner = new ShipWorldBackdrop(ship), size = new Vector2(1280, 720)
  const previousTarget = new WebGLRenderTarget(16, 16)
  let active: WebGLRenderTarget | null = previousTarget, fail = false, renders = 0
  const renderer = {
    autoClear: false,
    extensions: { has: () => floatSupport },
    getDrawingBufferSize: (value: Vector2) => value.copy(size),
    getRenderTarget: () => active,
    setRenderTarget: (target: WebGLRenderTarget | null) => { active = target },
    copyFramebufferToTexture: () => assert.fail('must not copy incompatible canvas pixels'),
    render: (scene: Scene, view: PerspectiveCamera) => {
      renders++; assert.equal(scene, universe); assert.equal(view, camera)
      assert.equal(renderer.autoClear, true); assert.notEqual(active, previousTarget)
      if (fail) throw Error('world render failure')
    }
  }
  return { ship, universe, camera, original, owner, size, previousTarget, renderer,
    active: () => active, fail: () => { fail = true }, renders: () => renders,
    draw: (callback: () => void) => owner.render(renderer as unknown as WebGLRenderer, universe, camera, callback) }
}

test('glass uses a linear world target, preserves canvas depth and restores scene/render state', () => {
  const f = fixture(); let target: WebGLRenderTarget | undefined, releases = 0
  f.draw(() => {
    assert.equal(f.active(), f.previousTarget); assert.equal(f.renderer.autoClear, false)
    assert(f.ship.background instanceof Texture)
  })
  // Observe the target through the renderer binding on the next world draw.
  const bind = f.renderer.setRenderTarget
  f.renderer.setRenderTarget = value => {
    if (value && value !== f.previousTarget) target = value
    bind(value)
  }
  f.draw(() => {})
  assert(target); assert.equal(target.texture.colorSpace, LinearSRGBColorSpace)
  assert.equal(target.texture.type, HalfFloatType); assert.equal(target.depthBuffer, true)
  target.addEventListener('dispose', () => releases++)
  f.draw(() => assert.equal(f.ship.background, target!.texture))
  assert.equal(f.ship.background, f.original); assert.equal(f.renders(), 3); assert.equal(releases, 0)
  f.size.set(640, 480)
  f.draw(() => { assert.equal(target!.width, 640); assert.equal(target!.height, 480) })
  assert.equal(releases, 1)
  f.owner.dispose(); f.owner.dispose(); assert.equal(releases, 2)
  f.previousTarget.dispose()
})

test('world failure or ship failure cannot leak a render target, clear flag or background', () => {
  for (const failWorld of [true, false]) {
    const f = fixture()
    if (failWorld) f.fail()
    assert.throws(() => f.draw(() => { throw Error('ship render failure') }), /render failure/)
    assert.equal(f.active(), f.previousTarget); assert.equal(f.renderer.autoClear, false)
    assert.equal(f.ship.background, f.original)
    f.owner.dispose(); f.previousTarget.dispose()
  }
})

test('devices without float color attachments use the supported unsigned-byte target', () => {
  const f = fixture(false)
  f.draw(() => assert.equal((f.ship.background as import('three').Texture).type, UnsignedByteType))
  f.owner.dispose(); f.previousTarget.dispose()
})

test('large drawing buffers obey a one-megapixel backdrop budget without changing aspect or HDR format', () => {
  const f = fixture(); let target: WebGLRenderTarget | null = null
  const bind = f.renderer.setRenderTarget
  f.renderer.setRenderTarget = value => { if (value !== f.previousTarget) target = value; bind(value) }
  f.size.set(3840, 2160)
  f.draw(() => {
    assert(target); assert(target.width * target.height <= 1_048_576)
    assert(Math.abs(target.width / target.height - 16 / 9) < .005)
    assert.equal(target.texture.type, HalfFloatType)
  })
  f.owner.dispose(); f.previousTarget.dispose()
})
