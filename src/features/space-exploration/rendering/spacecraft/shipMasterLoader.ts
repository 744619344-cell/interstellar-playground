import type { AnimationClip, Group } from 'three'
import { loadShipAsset } from './shipAssetLoader'

const masterUrl = new URL('../../../../assets/models/spacecraft-master-lod0.glb', import.meta.url).href
type Asset = { scene: Group; animations: readonly AnimationClip[] }
type Loader = (url: string, signal: AbortSignal) => Promise<Asset>

/** The master contains its fitted structure. No legacy repair asset is requested or installed. */
export async function loadShipMaster(signal: AbortSignal, release: (scene: Group) => void,
  load: Loader = loadShipAsset): Promise<Asset> {
  const asset = await load(masterUrl, signal)
  try {
    signal.throwIfAborted()
    if (asset.scene.getObjectByName('Ship_Adapted')?.userData.masterInterior !== true)
      throw new Error('Missing unified ship master metadata')
    asset.scene.userData.masterInterior = true
    return asset
  } catch (error) {
    release(asset.scene)
    throw error
  }
}
