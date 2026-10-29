import test from 'node:test'
import assert from 'node:assert/strict'
import { LoadingManager } from 'three'
import { readFile } from 'node:fs/promises'
import { decodeShipImage, queueShipImage, ShipBitmapLoader, shipImageDimensions, shipImageSize } from './shipBitmapBudget'

function png(width: number, height: number) {
  const bytes = new Uint8Array(24), view = new DataView(bytes.buffer)
  view.setUint32(0, 0x89504e47); view.setUint32(4, 0x0d0a1a0a)
  view.setUint32(16, width); view.setUint32(20, height)
  return new Blob([bytes], { type: 'image/png' })
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve))

test('encoded PNG and JPEG sizes retain aspect ratio and never upscale small textures', async () => {
  assert.deepEqual(shipImageDimensions(new Uint8Array(await png(4096, 2048).arrayBuffer())), [4096, 2048])
  const jpeg = new Uint8Array([255, 216, 255, 224, 0, 4, 0, 0, 255, 194, 0, 7, 8, 16, 0, 8, 0])
  assert.deepEqual(shipImageDimensions(jpeg), [2048, 4096])
  assert.deepEqual(shipImageSize(2048, 4096), { resizeWidth: 512, resizeHeight: 1024 })
  assert.deepEqual(shipImageSize(512, 341), { resizeWidth: 512, resizeHeight: 341 })
  assert.equal(shipImageSize(0, 1), undefined)
  for (let end = 0; end < jpeg.length; end++) assert.doesNotThrow(() => shipImageDimensions(jpeg.subarray(0, end)))
})

test('large images request bounded first decode rather than allocating a full-size intermediate', async () => {
  const calls: ImageBitmapOptions[] = [], controller = new AbortController()
  const result = await decodeShipImage(png(4096, 2048), controller.signal, async (_image, options) => {
    calls.push(options!); return { width: options!.resizeWidth, height: options!.resizeHeight, close() {} } as ImageBitmap
  })
  assert.equal(result.width, 1024); assert.equal(result.height, 512); assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], { premultiplyAlpha: 'none', colorSpaceConversion: 'none', resizeWidth: 1024, resizeHeight: 512, resizeQuality: 'high' })
  await decodeShipImage(png(512, 341), controller.signal, async (_image, options) => {
    assert.equal(options!.resizeWidth, undefined); return { width: 512, height: 341, close() {} } as ImageBitmap
  })
})

test('unknown headers resize once, close the intermediate and release late cancelled output', async () => {
  const aborter = new AbortController(); let calls = 0, originalClosed = 0, outputClosed = 0
  await assert.rejects(decodeShipImage(new Blob(['unknown']), aborter.signal, async (_source, options) => {
    if (++calls === 1) return { width: 4096, height: 2048, close() { originalClosed++ } } as ImageBitmap
    assert.equal(options!.resizeWidth, 1024); assert.equal(options!.resizeHeight, 512)
    aborter.abort(); return { width: 1024, height: 512, close() { outputClosed++ } } as ImageBitmap
  }), { name: 'AbortError' })
  assert.equal(calls, 2); assert.equal(originalClosed, 1); assert.equal(outputClosed, 1)
})

test('global queue serializes images across sources; cancelled and failed jobs cannot block the next asset', async () => {
  let resolve!: () => void, active = 0, maximum = 0, called = 0
  const signal = new AbortController().signal, cancelled = new AbortController()
  const first = queueShipImage(signal, async () => {
    maximum = Math.max(maximum, ++active); await new Promise<void>(done => { resolve = done }); active--
  })
  const second = queueShipImage(cancelled.signal, async () => { called++ })
  const rejected = assert.rejects(second, { name: 'AbortError' })
  const third = queueShipImage(signal, async () => { maximum = Math.max(maximum, ++active); active--; throw Error('decode failure') })
  const failed = assert.rejects(third, /decode failure/)
  const fourth = queueShipImage(signal, async () => { called++; maximum = Math.max(maximum, ++active); active-- })
  await tick(); cancelled.abort(); assert.equal(called, 0); resolve()
  await Promise.all([first, rejected, failed, fourth])
  assert.equal(maximum, 1); assert.equal(called, 1)
})

test('discarded loaders close a late bitmap and balance loading-manager lifecycle', async () => {
  const originalDecode = globalThis.createImageBitmap, originalFetch = globalThis.fetch
  let deliver!: (image: ImageBitmap) => void, started = 0, ended = 0, loaded = 0, closed = 0
  const manager = new LoadingManager(); manager.onStart = () => { started++ }; manager.onLoad = () => { ended++ }
  globalThis.createImageBitmap = async () => new Promise<ImageBitmap>(done => { deliver = done })
  globalThis.fetch = async () => new Response(png(4096, 4096))
  const loader = new ShipBitmapLoader(manager, new AbortController().signal)
  try {
    const error = new Promise<void>(resolve => loader.load('https://example.invalid/image.png', () => { loaded++ }, undefined, () => resolve()))
    while (!deliver) await tick()
    loader.discard(); deliver({ width: 1024, height: 1024, close() { closed++ } } as ImageBitmap)
    await error; await tick()
    assert.equal(loaded, 0); assert.equal(closed, 1); assert.equal(started, 1); assert.equal(ended, 1)
  } finally { globalThis.createImageBitmap = originalDecode; globalThis.fetch = originalFetch }
})

test('actual 4K ship source images fit into sixteen MiB of base RGBA under the decoding budget', async () => {
  let originalBytes = 0, boundedBytes = 0, count = 0
  for (const file of ['aft-bulkhead.glb', 'crew.glb']) {
    const data = await readFile(new URL(`../../../../assets/models/current-ship-20261022/${file}`, import.meta.url))
    const jsonSize = data.readUInt32LE(12), json = JSON.parse(data.subarray(20, 20 + jsonSize).toString())
    const bin = data.subarray(28 + jsonSize)
    for (const image of json.images) {
      const view = json.bufferViews[image.bufferView], offset = view.byteOffset ?? 0
      const size = shipImageDimensions(bin.subarray(offset, offset + view.byteLength))!
      const bounded = shipImageSize(...size)!
      originalBytes += size[0] * size[1] * 4; boundedBytes += bounded.resizeWidth * bounded.resizeHeight * 4; count++
    }
  }
  assert.equal(count, 4); assert.equal(originalBytes, 256 * 1048576); assert.equal(boundedBytes, 16 * 1048576)
})
