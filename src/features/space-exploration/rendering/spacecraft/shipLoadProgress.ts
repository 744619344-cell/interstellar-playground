import { shipTransferAsset } from './shipTransferAssets'

export interface ShipLoadProgress {
  loadedBytes: number
  totalBytes: number
  completed: number
  total: number
  phase: 'download' | 'parse' | 'assembly'
  asset: string
}

export type ShipLoadObserver = (progress: ShipLoadProgress) => void
export type ShipAssetObserver = (loadedBytes: number, phase: 'download' | 'parse') => void

export function shipLoadingLabel(progress?: ShipLoadProgress, previewReady = false) {
  const prefix = previewReady ? '飞船外观已显示 · ' : ''
  if (!progress) return `${prefix}飞船加载中…`
  const bytes = `${(progress.loadedBytes / 1e6).toFixed(1)} / ${(progress.totalBytes / 1e6).toFixed(1)} MB`
  if (progress.phase === 'assembly') return `${prefix}正在装配内舱与宇航员…`
  return prefix + (progress.phase === 'parse' ? `正在解析${progress.asset} · ${bytes}` : `正在加载${progress.asset} · ${bytes}`)
}

/** Read decompressed bytes: CDN Content-Length may describe a compressed representation. */
export async function readShipAsset(url: string, signal: AbortSignal, observe?: ShipAssetObserver) {
  signal.throwIfAborted()
  observe?.(0, 'download')
  const archive = typeof DecompressionStream === 'function' ? shipTransferAsset(url) : undefined
  let response = await fetch(archive?.url ?? url, { signal })
  let gzip = !!archive
  if (!response.ok && archive) { response = await fetch(url, { signal }); gzip = false }
  if (!response.ok) throw new Error(`Ship asset unavailable: ${response.status}`)
  // Some static servers declare the archive as HTTP gzip: fetch has already decoded that layer.
  if (gzip && response.body && !response.headers.get('Content-Encoding')?.toLowerCase().includes('gzip'))
    response = new Response(response.body.pipeThrough(new DecompressionStream('gzip')))
  if (!observe || !response.body) {
    const bytes = await response.arrayBuffer()
    signal.throwIfAborted(); observe?.(bytes.byteLength, 'parse')
    return bytes
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  // Known source sizes let the decoder fill one final buffer rather than retaining a second copy in chunks.
  const allocated = archive ? new Uint8Array(archive.originalBytes) : undefined
  const cancel = () => { void reader.cancel(signal.reason).catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  let length = 0
  try {
    signal.throwIfAborted()
    while (true) {
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      if (allocated) {
        if (length + value.byteLength > allocated.length) throw Error('Ship transfer exceeds expected source size')
        allocated.set(value, length)
      } else chunks.push(value)
      length += value.byteLength; observe(length, 'download')
    }
  } catch (error) {
    await reader.cancel(error).catch(() => {})
    throw error
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock() }
  if (allocated && length !== allocated.length) throw Error('Incomplete ship transfer')
  const bytes = allocated ?? new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  chunks.length = 0
  observe(length, 'parse')
  return bytes.buffer
}
