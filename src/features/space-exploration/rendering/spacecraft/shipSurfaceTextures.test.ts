import test from 'node:test'
import assert from 'node:assert/strict'
import { SRGBColorSpace, Texture } from 'three'
import { remapSurfaceOrm, ShipSurfaceTextures } from './shipSurfaceTextures'

test('bounded ORM remapping retains numerical variation, AO/alpha and the immutable source', () => {
  const pixels = new Uint8ClampedArray([255, 0, 255, 255, 128, 128, 128, 210, 20, 255, 0, 128]), original = pixels.slice()
  const result = remapSurfaceOrm(pixels, { roughMin: .55, roughMax: .83, metalMax: .09 })
  assert.deepEqual(pixels, original); assert(result[1] >= 140 && result[9] <= 212)
  assert(result[1] < result[5] && result[5] < result[9]); assert(result[2] <= 23)
  for (const i of [0, 3, 4, 7, 8, 11]) assert.equal(result[i], pixels[i])
})

test('derived samplers share once, preserve UV/color-space, and never close or dispose the source image', () => {
  let sourceDisposed = 0, closed = 0, disposed = 0
  const source = new Texture({ width: 16, height: 16, close: () => closed++ } as unknown as HTMLImageElement)
  source.colorSpace = SRGBColorSpace; source.channel = 1; source.repeat.set(2, 3); source.flipY = false
  source.addEventListener('dispose', () => sourceDisposed++)
  const cache = new ShipSurfaceTextures(), copy = cache.sampler(source)
  copy.addEventListener('dispose', () => disposed++)
  assert.equal(cache.sampler(source), copy); assert.equal(copy.image, source.image)
  assert.equal(copy.colorSpace, SRGBColorSpace); assert.equal(copy.channel, 1); assert.equal(copy.flipY, false)
  assert.deepEqual(copy.repeat.toArray(), [2, 3]); assert.equal(copy.anisotropy, 8); assert.equal(source.anisotropy, 1)
  cache.dispose(); cache.dispose(); assert.equal(disposed, 1); assert.equal(sourceDisposed, 0); assert.equal(closed, 0)
  source.dispose()
})
