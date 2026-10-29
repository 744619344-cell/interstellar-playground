import { ImageBitmapLoader, type LoadingManager } from 'three'

export const SHIP_TEXTURE_EDGE = 1024
let decodeTail: Promise<unknown> = Promise.resolve()

/** Inspect encoded headers so known large images are resized during decoding, before GPU upload. */
export function shipImageDimensions(bytes: Uint8Array): [number, number] | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a)
    return [view.getUint32(16), view.getUint32(20)]
  if (bytes[0] !== 255 || bytes[1] !== 216) return
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 255) { offset++; continue }
    const marker = bytes[offset + 1]; offset += 2
    if (marker === 255) { offset--; continue }
    if (marker === 0xd9 || marker === 0xda) return
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    const length = view.getUint16(offset)
    if (length < 2 || offset + length > bytes.length) return
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)
      && length >= 7) return [view.getUint16(offset + 5), view.getUint16(offset + 3)]
    offset += length
  }
}

export function shipImageSize(width: number, height: number, edge = SHIP_TEXTURE_EDGE) {
  if (!(width > 0 && height > 0 && Number.isFinite(width + height))) return
  const scale = Math.min(1, Math.max(128, Math.min(2048, edge)) / Math.max(width, height))
  return { resizeWidth: Math.max(1, Math.round(width * scale)), resizeHeight: Math.max(1, Math.round(height * scale)) }
}

type Decode = (image: ImageBitmapSource, options?: ImageBitmapOptions) => Promise<ImageBitmap>
export async function decodeShipImage(blob: Blob, signal: AbortSignal, decode: Decode = createImageBitmap, edge = SHIP_TEXTURE_EDGE) {
  signal.throwIfAborted()
  const dimensions = shipImageDimensions(new Uint8Array(await blob.slice(0, 65536).arrayBuffer()))
  const size = dimensions && shipImageSize(...dimensions, edge)
  const options: ImageBitmapOptions = { premultiplyAlpha: 'none', colorSpaceConversion: 'none',
    ...(size && (size.resizeWidth < dimensions![0] || size.resizeHeight < dimensions![1]) ? { ...size, resizeQuality: 'high' } : {}) }
  signal.throwIfAborted()
  let bitmap = await decode(blob, options)
  try {
    signal.throwIfAborted()
    // Unrecognized formats still obey the residency budget; only one image decodes at a time.
    if (Math.max(bitmap.width, bitmap.height) > edge) {
      const original = bitmap
      bitmap = await decode(original, { ...options, ...shipImageSize(original.width, original.height, edge), resizeQuality: 'high' })
      original.close()
    }
    signal.throwIfAborted()
    return bitmap
  } catch (error) { bitmap.close(); throw error }
}

/** Shared queue bounds simultaneous image decodes across concurrently downloaded GLBs. */
export function queueShipImage<T>(signal: AbortSignal, task: () => Promise<T>) {
  const pending = decodeTail.then(() => { signal.throwIfAborted(); return task() })
  decodeTail = pending.then(() => undefined, () => undefined)
  return pending
}

export class ShipBitmapLoader extends ImageBitmapLoader {
  failure?: unknown
  private bitmaps = new Set<ImageBitmap>()
  private discarded = false
  constructor(manager: LoadingManager, private signal: AbortSignal, private edge = SHIP_TEXTURE_EDGE) { super(manager) }

  override load(url: string, onLoad?: (image: ImageBitmap) => void,
    _onProgress?: (event: ProgressEvent) => void, onError?: (error: unknown) => void) {
    const resolved = this.manager.resolveURL(this.path + url)
    this.manager.itemStart(resolved)
    void queueShipImage(this.signal, async () => {
      if (this.discarded) throw Error('Discarded ship image loader')
      const response = await fetch(resolved, { signal: this.signal, headers: this.requestHeader,
        credentials: this.crossOrigin === 'anonymous' ? 'same-origin' : 'include' })
      if (!response.ok) throw Error(`Ship image unavailable: ${response.status}`)
      return decodeShipImage(await response.blob(), this.signal, createImageBitmap, this.edge)
    }).then(bitmap => {
      // Cancellation can occur between the decoder resolving and this handler running.
      if (this.signal.aborted || this.discarded) { bitmap.close(); throw this.signal.reason ?? Error('Discarded ship image loader') }
      this.bitmaps.add(bitmap); onLoad?.(bitmap)
    }).catch(error => {
      this.failure ??= error; onError?.(error); this.manager.itemError(resolved)
    }).finally(() => this.manager.itemEnd(resolved))
  }

  /** On parse failure none of these images has reached a render owner. */
  discard() { this.discarded = true; this.bitmaps.forEach(bitmap => bitmap.close()); this.bitmaps.clear() }
  transfer() { this.bitmaps.clear() }
}
