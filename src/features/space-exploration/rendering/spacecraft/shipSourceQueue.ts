import { Group } from 'three'
import type { ShipAssetObserver, ShipLoadObserver } from './shipLoadProgress'

interface Job { id: string; url: string; bytes: number }
type Loader = (url: string, signal: AbortSignal, observe?: ShipAssetObserver) => Promise<{ scene: Group }>

export function releaseShipSources(sources: Iterable<Group>, release: (owner: Group) => void) {
  const groups = [...sources]
  if (groups.length) { const owner = new Group(); owner.add(...groups); release(owner) }
}

/** Two in-flight sources at most; wait for late parses before deduplicated failure cleanup. */
export async function loadShipSources(jobs: readonly Job[], signal: AbortSignal,
  load: Loader, release: (owner: Group) => void, observe?: ShipLoadObserver) {
  const acquired: Group[] = [], controller = new AbortController()
  const sources = new Map<string, Group>(), loaded = new Map<string, number>()
  const cancel = () => controller.abort(signal.reason)
  signal.addEventListener('abort', cancel, { once: true })
  let next = 0, failed = false, failure: unknown
  const report = (id: string, phase: 'download' | 'parse' | 'assembly') => observe?.({
    loadedBytes: [...loaded.values()].reduce((a, b) => a + b, 0),
    totalBytes: jobs.reduce((sum, job) => sum + job.bytes, 0), completed: sources.size, total: jobs.length,
    phase, asset: id === 'hull' ? '船体' : id === 'crew' ? '宇航员' : '内舱部件'
  })
  async function worker() {
    try {
      while (next < jobs.length) {
        controller.signal.throwIfAborted()
        const job = jobs[next++]
        const asset = await load(job.url, controller.signal, (bytes, phase) => {
          if (controller.signal.aborted) return
          loaded.set(job.id, bytes); report(job.id, phase)
        })
        if (!(asset.scene instanceof Group)) throw new Error('Invalid current ship source scene')
        acquired.push(asset.scene)
        controller.signal.throwIfAborted()
        sources.set(job.id, asset.scene); loaded.set(job.id, job.bytes); report(job.id, 'parse')
      }
    } catch (error) { if (!failed) { failed = true; failure = error; controller.abort(error) } }
  }
  try {
    signal.throwIfAborted(); report('hull', 'download')
    await Promise.all([worker(), worker()])
    if (failed) throw failure
    signal.throwIfAborted(); report('hull', 'assembly')
    return sources
  } catch (error) {
    releaseShipSources(acquired, release)
    throw error
  } finally { signal.removeEventListener('abort', cancel) }
}
