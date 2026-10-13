import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'

/** Owners discard any parse result arriving after cancellation; fetch itself is abortable. */
export async function loadShipAsset(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Ship asset unavailable: ${response.status}`)
  const bytes = await response.arrayBuffer()
  signal.throwIfAborted()
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes, url.slice(0, url.lastIndexOf('/') + 1))
}
