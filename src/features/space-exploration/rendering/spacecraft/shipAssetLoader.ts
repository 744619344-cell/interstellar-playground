import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { readShipAsset, type ShipAssetObserver } from './shipLoadProgress'
import { ShipBitmapLoader } from './shipBitmapBudget'

/** Owners discard any parse result arriving after cancellation; fetch itself is abortable. */
export async function loadShipAsset(url: string, signal: AbortSignal, staticScene = false, observe?: ShipAssetObserver, textureEdge = 1024) {
  const bytes = await readShipAsset(url, signal, observe)
  signal.throwIfAborted()
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  let images: ShipBitmapLoader | undefined
  loader.register(parser => {
    // Embedded browsers can omit a Safari Version token. Use the actual API capability.
    if (typeof createImageBitmap === 'function') {
      images = new ShipBitmapLoader(parser.options.manager, signal, textureEdge)
      images.setCrossOrigin(parser.options.crossOrigin).setRequestHeader(parser.options.requestHeader)
      parser.textureLoader = images
    }
    return { name: 'bounded_ship_images' }
  })
  if (staticScene) loader.register(parser => ({ name: 'current_static_scene', beforeRoot() {
    // Static snapshots contain old clips targeting inactive nodes. Do not instantiate those orphan meshes/textures.
    parser.json.animations = []
    return null
  } }))
  try {
    const asset = await loader.parseAsync(bytes, url.slice(0, url.lastIndexOf('/') + 1))
    // GLTFLoader can swallow texture errors. Do not present a partly untextured ship as ready.
    if (images?.failure && !signal.aborted) throw images.failure
    images?.transfer()
    return asset
  } catch (error) { images?.discard(); throw error }
}
